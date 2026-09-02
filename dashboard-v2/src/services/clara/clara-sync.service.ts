import axios from 'axios';
import { supabase } from '@/lib/supabase';
import { 
  ClaraConfig, 
  ClaraTransactionRecord, 
  ClaraRawTransaction, 
  ClaraSyncRun, 
  ClaraSyncStatus,
  ClaraTransactionType,
  ClaraTransactionStatus
} from '@/types/clara.types';
import { ClaraConfigService } from './clara-config.service';
import { ClaraClient } from './clara-client';
import { ClaraOmieMapper } from './clara-omie-mapper';

// Armazenamento em memória para caso a tabela ainda não exista no Supabase
let memoryTransactions: Map<string, ClaraTransactionRecord> = new Map();
let memorySyncRuns: ClaraSyncRun[] = [];

export interface SyncOptions {
  trigger?: 'MANUAL' | 'SCHEDULED';
  forceSafeMode?: boolean;
  forceFullSync?: boolean;
}

export interface SyncResultSummary {
  success: boolean;
  runId: string;
  trigger: 'MANUAL' | 'SCHEDULED';
  safeMode: boolean;
  received: number;
  created: number;
  updated: number;
  synced: number;
  alreadySynced: number;
  mappingRequired: number;
  ignored: number;
  attachmentsUploaded: number;
  errors: number;
  errorMessage?: string;
}

export class ClaraSyncService {
  /**
   * Adquire lock de sincronização para evitar execuções simultâneas
   */
  private static async acquireLock(): Promise<boolean> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    try {
      const { data, error } = await supabase
        .from('clara_sync_runs')
        .select('id, started_at')
        .eq('status', 'RUNNING')
        .gte('started_at', fifteenMinutesAgo)
        .limit(1);

      if (!error && data && data.length > 0) {
        return false; // Bloqueado por outra execução ativa
      }
    } catch {
      // Se der erro ao consultar Supabase, verifica memória
      const hasRunning = memorySyncRuns.some(r => r.status === 'RUNNING' && new Date(r.started_at).getTime() > Date.now() - 15 * 60 * 1000);
      if (hasRunning) return false;
    }

    return true;
  }

  /**
   * Registra início de uma execução
   */
  private static async createSyncRun(trigger: 'MANUAL' | 'SCHEDULED'): Promise<ClaraSyncRun> {
    const run: ClaraSyncRun = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `run_${Date.now()}`,
      started_at: new Date().toISOString(),
      trigger_type: trigger,
      status: 'RUNNING',
      transactions_received: 0,
      transactions_created: 0,
      transactions_updated: 0,
      transactions_ignored: 0,
      transactions_synced: 0,
      transactions_failed: 0,
      attachments_uploaded: 0,
    };

    memorySyncRuns.unshift(run);

    try {
      await supabase.from('clara_sync_runs').insert(run);
    } catch (e: any) {
      console.warn('[ClaraSyncService] Aviso ao criar clara_sync_runs no Supabase:', e.message);
    }

    return run;
  }

  /**
   * Finaliza uma execução
   */
  private static async finishSyncRun(run: ClaraSyncRun, status: 'SUCCESS' | 'ERROR' | 'PARTIAL', errorMsg?: string): Promise<void> {
    run.finished_at = new Date().toISOString();
    run.status = status;
    run.error_message = errorMsg || null;

    const idx = memorySyncRuns.findIndex(r => r.id === run.id);
    if (idx >= 0) memorySyncRuns[idx] = run;

    try {
      await supabase
        .from('clara_sync_runs')
        .update({
          finished_at: run.finished_at,
          status: run.status,
          transactions_received: run.transactions_received,
          transactions_created: run.transactions_created,
          transactions_updated: run.transactions_updated,
          transactions_ignored: run.transactions_ignored,
          transactions_synced: run.transactions_synced,
          transactions_failed: run.transactions_failed,
          attachments_uploaded: run.attachments_uploaded,
          error_message: run.error_message,
        })
        .eq('id', run.id);
    } catch (e: any) {
      console.warn('[ClaraSyncService] Aviso ao finalizar clara_sync_runs no Supabase:', e.message);
    }
  }

  /**
   * Normaliza o objeto retornado pela Clara para o registro local
   */
  private static normalizeClaraTransaction(raw: ClaraRawTransaction): ClaraTransactionRecord {
    const claraUuid = (raw.uuid || raw.id || '').trim();
    const typeStr = (raw.transactionType || raw.type || 'PURCHASE').toUpperCase();
    const statusStr = (raw.status || 'AUTHORIZED').toUpperCase();

    const txType: ClaraTransactionType = 
      ['PURCHASE', 'REFUND', 'FEE', 'CREDIT', 'PAYMENT'].includes(typeStr)
        ? (typeStr as ClaraTransactionType)
        : 'PURCHASE';

    const txStatus: ClaraTransactionStatus =
      ['AUTHORIZED', 'NOTIFICATION', 'PRE_AUTHORIZED', 'REJECTED'].includes(statusStr)
        ? (statusStr as ClaraTransactionStatus)
        : 'AUTHORIZED';

    const opDate = raw.audit?.operationDate || raw.operationDate || raw.audit?.accountingDate || raw.accountingDate || new Date().toISOString();
    const acDate = raw.audit?.accountingDate || raw.accountingDate || null;
    const updDate = raw.audit?.lastUpdateDate || raw.lastUpdateDate || opDate;
    
    // Suporte ao formato amountValue.amount da Clara v3
    const amountVal = raw.amountValue?.amount !== undefined 
      ? Number(raw.amountValue.amount) 
      : (typeof raw.amount === 'number' ? raw.amount : parseFloat(String(raw.amount || 0)));

    const currencyVal = raw.amountValue?.currency || raw.currency || 'BRL';

    const cardDigits = raw.card?.maskedPan 
      ? raw.card.maskedPan.replace(/\D/g, '').slice(-4) 
      : (raw.card?.lastFourDigits || null);

    const userName = raw.user?.holderName || raw.user?.name || null;

    const docs = raw.documents || raw.receipts || raw.hasAttachments?.links || raw.hasInvoice?.links || [];
    const hasAttachments = Boolean(raw.hasAttachments?.value || docs.length > 0);

    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      clara_uuid: claraUuid,
      transaction_type: txType,
      transaction_status: txStatus,
      transaction_label: raw.transactionLabel || raw.label || null,
      operation_date: opDate,
      accounting_date: acDate,
      last_update_date: updDate,
      merchant_name: raw.merchant?.name || 'Estabelecimento Desconhecido',
      merchant_category: raw.merchant?.category || null,
      original_amount: raw.originalAmount?.amount || amountVal,
      original_currency: raw.originalAmount?.currency || currencyVal,
      amount: amountVal,
      currency: currencyVal,
      authorization_number: raw.authorizationNumber || null,
      card_uuid: raw.card?.uuid || raw.card?.id || null,
      card_last_digits: cardDigits,
      user_uuid: raw.user?.uuid || raw.user?.id || null,
      user_name: userName,
      user_email: raw.user?.email || null,
      billing_statement_uuid: raw.billingStatement?.uuid || raw.billingStatementUuid || null,
      comment: raw.comment || null,
      labels: raw.labels || [],
      accounting_fields: raw.accountingFields || {},
      raw_payload: raw,
      omie_integration_id: ClaraOmieMapper.generateOmieIntegrationId(claraUuid),
      omie_launch_id: null,
      omie_account_id: null,
      omie_category_code: null,
      omie_department_code: null,
      has_attachments: hasAttachments,
      attachments_count: docs.length,
      attachments_synced: false,
      sync_status: 'PENDING',
      sync_attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Executa a sincronização completa:
   * 1. Consulta Clara
   * 2. Upsert local
   * 3. Classificação De-Para
   * 4. Envio ao Omie (IncluirLancCC)
   * 5. Envio dos comprovantes (IncluirAnexo)
   */
  public static async syncClaraTransactions(options: SyncOptions = {}): Promise<SyncResultSummary> {
    const trigger = options.trigger || 'MANUAL';
    const hasLock = await this.acquireLock();

    if (!hasLock) {
      throw new Error('Já existe uma sincronização Clara em andamento no momento.');
    }

    const run = await this.createSyncRun(trigger);
    const config = await ClaraConfigService.getConfig();
    const isSafeMode = options.forceSafeMode !== undefined ? options.forceSafeMode : config.safe_mode;

    let received = 0;
    let created = 0;
    let updated = 0;
    let synced = 0;
    let alreadySynced = 0;
    let mappingRequired = 0;
    let ignored = 0;
    let attachmentsUploaded = 0;
    let errors = 0;

    try {
      // 1. Configura cliente da Clara
      const claraClient = new ClaraClient(config);

      // 2. Calcula janela de busca incremental
      const overlapDays = config.overlap_days || 3;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (options.forceFullSync ? 60 : overlapDays));
      const startDateIso = startDate.toISOString();

      let claraRawList: ClaraRawTransaction[] = [];
      try {
        claraRawList = await claraClient.getAllTransactions({
          lastUpdateDateRangeStart: startDateIso,
        });
      } catch (err: any) {
        // Se a busca com filtro de data falhar na Clara, tenta busca padrão das primeiras páginas
        console.warn('[ClaraSyncService] Busca por range falhou, buscando sem filtro de data:', err.message);
        claraRawList = await claraClient.getAllTransactions({ size: 100, page: 1 });
      }

      received = claraRawList.length;
      run.transactions_received = received;

      // 3. Carrega mapeamentos ativos de De-Para
      const categoryMappings = await ClaraConfigService.getCategoryMappings();
      const departmentMappings = await ClaraConfigService.getDepartmentMappings();

      const catMap = new Map<string, string>();
      categoryMappings.forEach(m => catMap.set(m.clara_category.trim().toLowerCase(), m.omie_category_code.trim()));

      // 4. Processa cada transação Clara
      const toSyncReady: ClaraTransactionRecord[] = [];

      for (const raw of claraRawList) {
        const normalized = this.normalizeClaraTransaction(raw);
        if (!normalized.clara_uuid) continue;

        // Verifica se já existe no banco
        let existingRecord: ClaraTransactionRecord | null = null;
        try {
          const { data } = await supabase
            .from('clara_transactions')
            .select('*')
            .eq('clara_uuid', normalized.clara_uuid)
            .maybeSingle();
          if (data) existingRecord = data;
        } catch {
          existingRecord = memoryTransactions.get(normalized.clara_uuid) || null;
        }

        if (existingRecord) {
          // Já sincronizada com o Omie?
          if (existingRecord.omie_launch_id) {
            alreadySynced++;
            // Verifica se tem anexos pendentes para subir
            if (normalized.has_attachments && !existingRecord.attachments_synced) {
              toSyncReady.push(existingRecord);
            }
            continue;
          }
          // Transação existente mas ainda não enviada: atualiza dados
          updated++;
          normalized.id = existingRecord.id;
          normalized.sync_attempts = existingRecord.sync_attempts;
        } else {
          created++;
        }

        // Regra de elegibilidade para envio ao Omie:
        // No MVP, apenas transações PURCHASE com status AUTHORIZED são enviadas
        if (normalized.transaction_type !== 'PURCHASE') {
          normalized.sync_status = 'IGNORED';
          ignored++;
          await this.saveLocalTransaction(normalized);
          continue;
        }

        if (normalized.transaction_status !== 'AUTHORIZED') {
          normalized.sync_status = 'IGNORED';
          ignored++;
          await this.saveLocalTransaction(normalized);
          continue;
        }

        // De-Para de Categoria
        const merchantCategory = (normalized.merchant_category || '').toLowerCase();
        const merchantName = (normalized.merchant_name || '').toLowerCase();
        const mappedCategory = 
          catMap.get(merchantCategory) || 
          catMap.get(merchantName) || 
          config.default_omie_category || 
          null;

        normalized.omie_category_code = mappedCategory;

        // De-Para de Departamento
        let mappedDept = config.default_omie_department || null;
        const userName = (normalized.user_name || '').toLowerCase();
        const cardDigits = normalized.card_last_digits || '';

        const deptMatch = departmentMappings.find(d => {
          const key = d.clara_key.toLowerCase();
          if (d.mapping_type === 'USER' && key === userName) return true;
          if (d.mapping_type === 'CARD' && key === cardDigits) return true;
          return false;
        });

        if (deptMatch) {
          mappedDept = deptMatch.omie_department_code;
        }
        normalized.omie_department_code = mappedDept;

        // Avalia se está READY ou se necessita mapeamento
        if (!mappedCategory && config.block_if_unmapped) {
          normalized.sync_status = 'MAPPING_REQUIRED';
          mappingRequired++;
        } else {
          normalized.sync_status = 'READY';
          toSyncReady.push(normalized);
        }

        await this.saveLocalTransaction(normalized);
      }

      run.transactions_created = created;
      run.transactions_updated = updated;
      run.transactions_ignored = ignored;

      // 5. Processamento dos elegíveis (READY) para envio ao Omie
      const omieCreds = ClaraConfigService.getOmieCredentials(config.company_name);
      const nCodCC = config.omie_n_cod_cc;

      if (!isSafeMode && (!nCodCC || !omieCreds.appKey || !omieCreds.appSecret)) {
        throw new Error('Conta Omie da Clara (nCodCC) ou credenciais Omie não configuradas.');
      }

      for (const tx of toSyncReady) {
        // Se já possui omie_launch_id, não recria lançamento financeiro (Idempotência Absoluta)
        let nCodLanc = tx.omie_launch_id;

        if (!nCodLanc) {
          if (isSafeMode) {
            // Em Modo de Teste: simula montagem sem disparar chamada real
            tx.sync_status = 'READY';
            tx.last_sync_attempt = new Date().toISOString();
            tx.last_sync_error = 'Modo de Teste ativo: lançamento pronto para inclusão no Omie.';
            await this.saveLocalTransaction(tx);
            continue;
          }

          // PRODUÇÃO: dispara IncluirLancCC no Omie
          try {
            const omiePayload = ClaraOmieMapper.buildOmieLancamentoPayload(
              tx,
              nCodCC!,
              tx.omie_category_code || config.default_omie_category || '1.01.01',
              tx.omie_department_code
            );

            const res = await axios.post('https://app.omie.com.br/api/v1/financas/contacorrentelancamentos/', {
              call: 'IncluirLancCC',
              app_key: omieCreds.appKey,
              app_secret: omieCreds.appSecret,
              param: [omiePayload],
            }, { timeout: 20000 });

            nCodLanc = Number(res.data?.nCodLanc);
            if (!nCodLanc) {
              throw new Error(res.data?.faultstring || res.data?.cDescStatus || 'Omie não retornou nCodLanc.');
            }

            tx.omie_launch_id = nCodLanc;
            tx.omie_account_id = nCodCC;
            tx.sync_status = 'SYNCED';
            tx.synced_at = new Date().toISOString();
            tx.last_sync_error = null;
            synced++;
          } catch (err: any) {
            errors++;
            const msg = err.response?.data?.faultstring || err.message;
            tx.sync_status = 'ERROR';
            tx.last_sync_error = `Omie IncluirLancCC: ${msg}`;
            tx.sync_attempts = (tx.sync_attempts || 0) + 1;
            await this.saveLocalTransaction(tx);
            continue;
          }
        }

        // 6. ENVIO DE COMPROVANTES / ANEXOS AO OMIE (IncluirAnexo)
        if (nCodLanc && !tx.attachments_synced) {
          try {
            // Busca documentos da transação na Clara
            let docs = tx.raw_payload?.documents || tx.raw_payload?.receipts || [];
            if (docs.length === 0) {
              docs = await claraClient.getTransactionDocuments(tx.clara_uuid);
            }

            if (docs.length > 0) {
              for (const doc of docs) {
                const docUrl = doc.url || doc.downloadUrl;
                if (!docUrl) continue;

                // Baixa o binário do comprovante em base64 com mTLS
                const { base64, fileName } = await claraClient.downloadDocumentAsBase64(docUrl);
                
                if (base64) {
                  const anexoPayload = ClaraOmieMapper.buildOmieAnexoPayload(
                    nCodLanc,
                    doc.name || fileName || `comprovante_${tx.authorization_number || tx.clara_uuid}.pdf`,
                    base64
                  );

                  await axios.post('https://app.omie.com.br/api/v1/geral/anexo/', {
                    call: 'IncluirAnexo',
                    app_key: omieCreds.appKey,
                    app_secret: omieCreds.appSecret,
                    param: [anexoPayload],
                  }, { timeout: 30000 });

                  attachmentsUploaded++;
                }
              }

              tx.attachments_synced = true;
              tx.attachments_count = docs.length;
              tx.has_attachments = true;
              tx.attachments_error = null;
            }
          } catch (anexoErr: any) {
            console.warn(`[ClaraSyncService] Aviso ao subir anexo para lançamento ${nCodLanc}:`, anexoErr.message);
            tx.attachments_error = `Erro anexo: ${anexoErr.response?.data?.faultstring || anexoErr.message}`;
          }
        }

        await this.saveLocalTransaction(tx);
      }

      run.transactions_synced = synced;
      run.transactions_failed = errors;
      run.attachments_uploaded = attachmentsUploaded;

      const finalStatus = errors === 0 ? 'SUCCESS' : (synced > 0 ? 'PARTIAL' : 'ERROR');
      await this.finishSyncRun(run, finalStatus);

      return {
        success: errors === 0,
        runId: run.id,
        trigger,
        safeMode: isSafeMode,
        received,
        created,
        updated,
        synced,
        alreadySynced,
        mappingRequired,
        ignored,
        attachmentsUploaded,
        errors,
      };
    } catch (err: any) {
      await this.finishSyncRun(run, 'ERROR', err.message);
      throw err;
    }
  }

  /**
   * Salva transação localmente com persistência dupla (Supabase + fallback memória)
   */
  private static async saveLocalTransaction(tx: ClaraTransactionRecord): Promise<void> {
    tx.updated_at = new Date().toISOString();
    memoryTransactions.set(tx.clara_uuid, tx);

    try {
      await supabase
        .from('clara_transactions')
        .upsert(tx, { onConflict: 'clara_uuid' });
    } catch (e: any) {
      console.warn('[ClaraSyncService] Aviso ao salvar clara_transactions no Supabase:', e.message);
    }
  }

  /**
   * Consulta transações paginadas e filtradas para o painel administrativo
   */
  public static async getTransactions(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    syncStatus?: string;
    claraStatus?: string;
    transactionType?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<{ transactions: ClaraTransactionRecord[]; total: number }> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let query = supabase.from('clara_transactions').select('*', { count: 'exact' });

      if (params.syncStatus && params.syncStatus !== 'ALL') {
        query = query.eq('sync_status', params.syncStatus);
      }
      if (params.claraStatus && params.claraStatus !== 'ALL') {
        query = query.eq('transaction_status', params.claraStatus);
      }
      if (params.transactionType && params.transactionType !== 'ALL') {
        query = query.eq('transaction_type', params.transactionType);
      }
      if (params.startDate) {
        query = query.gte('operation_date', params.startDate);
      }
      if (params.endDate) {
        query = query.lte('operation_date', params.endDate);
      }
      if (params.search) {
        query = query.or(`merchant_name.ilike.%${params.search}%,user_name.ilike.%${params.search}%,authorization_number.ilike.%${params.search}%,clara_uuid.ilike.%${params.search}%`);
      }

      query = query.order('operation_date', { ascending: false }).range(from, to);

      const { data, count, error } = await query;

      if (!error && data) {
        return { transactions: data, total: count || data.length };
      }
    } catch {
      // Fallback memória
    }

    // Filtro em memória
    let items = Array.from(memoryTransactions.values());
    if (params.syncStatus && params.syncStatus !== 'ALL') {
      items = items.filter(t => t.sync_status === params.syncStatus);
    }
    if (params.claraStatus && params.claraStatus !== 'ALL') {
      items = items.filter(t => t.transaction_status === params.claraStatus);
    }
    if (params.transactionType && params.transactionType !== 'ALL') {
      items = items.filter(t => t.transaction_type === params.transactionType);
    }
    if (params.search) {
      const s = params.search.toLowerCase();
      items = items.filter(t => 
        (t.merchant_name || '').toLowerCase().includes(s) ||
        (t.user_name || '').toLowerCase().includes(s) ||
        (t.authorization_number || '').toLowerCase().includes(s) ||
        t.clara_uuid.toLowerCase().includes(s)
      );
    }

    items.sort((a, b) => new Date(b.operation_date).getTime() - new Date(a.operation_date).getTime());
    const total = items.length;
    const paginated = items.slice(from, from + pageSize);

    return { transactions: paginated, total };
  }

  /**
   * Retorna métricas de KPIs para o painel de topo
   */
  public static async getMetrics(): Promise<{
    totalTransactions: number;
    syncedCount: number;
    pendingCount: number;
    mappingRequiredCount: number;
    errorCount: number;
    ignoredCount: number;
    syncedAmountTotal: number;
    lastSyncDate: string | null;
    safeMode: boolean;
  }> {
    const config = await ClaraConfigService.getConfig();
    let rows: ClaraTransactionRecord[] = [];

    try {
      const { data } = await supabase
        .from('clara_transactions')
        .select('sync_status, amount, omie_launch_id, updated_at');
      if (data) rows = data as any;
    } catch {
      rows = Array.from(memoryTransactions.values());
    }

    if (rows.length === 0) {
      rows = Array.from(memoryTransactions.values());
    }

    let syncedCount = 0;
    let pendingCount = 0;
    let mappingRequiredCount = 0;
    let errorCount = 0;
    let ignoredCount = 0;
    let syncedAmountTotal = 0;

    rows.forEach(r => {
      if (r.sync_status === 'SYNCED' || r.omie_launch_id) {
        syncedCount++;
        syncedAmountTotal += Number(r.amount || 0);
      } else if (r.sync_status === 'MAPPING_REQUIRED') {
        mappingRequiredCount++;
      } else if (r.sync_status === 'ERROR') {
        errorCount++;
      } else if (r.sync_status === 'IGNORED') {
        ignoredCount++;
      } else {
        pendingCount++;
      }
    });

    const lastRun = memorySyncRuns[0];

    return {
      totalTransactions: rows.length,
      syncedCount,
      pendingCount,
      mappingRequiredCount,
      errorCount,
      ignoredCount,
      syncedAmountTotal: Math.round(syncedAmountTotal * 100) / 100,
      lastSyncDate: lastRun?.finished_at || lastRun?.started_at || null,
      safeMode: config.safe_mode,
    };
  }

  /**
   * Reprocessa manualmente uma transação específica
   */
  public static async retryTransaction(idOrUuid: string): Promise<ClaraTransactionRecord> {
    let tx: ClaraTransactionRecord | null = null;
    try {
      const { data } = await supabase
        .from('clara_transactions')
        .select('*')
        .or(`id.eq.${idOrUuid},clara_uuid.eq.${idOrUuid}`)
        .maybeSingle();
      if (data) tx = data;
    } catch {
      tx = memoryTransactions.get(idOrUuid) || null;
    }

    if (!tx) {
      throw new Error(`Transação ${idOrUuid} não encontrada.`);
    }

    // Se já estiver sincronizada e com anexos, não faz nada
    if (tx.omie_launch_id && tx.attachments_synced) {
      return tx;
    }

    const config = await ClaraConfigService.getConfig();
    const omieCreds = ClaraConfigService.getOmieCredentials(config.company_name);
    const nCodCC = config.omie_n_cod_cc;

    if (!config.safe_mode && !nCodCC) {
      throw new Error('Conta Omie da Clara (nCodCC) não selecionada na configuração.');
    }

    let nCodLanc = tx.omie_launch_id;

    if (!nCodLanc && !config.safe_mode) {
      const omiePayload = ClaraOmieMapper.buildOmieLancamentoPayload(
        tx,
        nCodCC!,
        tx.omie_category_code || config.default_omie_category || '1.01.01',
        tx.omie_department_code
      );

      const res = await axios.post('https://app.omie.com.br/api/v1/financas/contacorrentelancamentos/', {
        call: 'IncluirLancCC',
        app_key: omieCreds.appKey,
        app_secret: omieCreds.appSecret,
        param: [omiePayload],
      }, { timeout: 20000 });

      nCodLanc = Number(res.data?.nCodLanc);
      if (!nCodLanc) throw new Error(res.data?.faultstring || 'Omie não retornou nCodLanc.');

      tx.omie_launch_id = nCodLanc;
      tx.sync_status = 'SYNCED';
      tx.synced_at = new Date().toISOString();
      tx.last_sync_error = null;
    }

    // Envio do anexo se ainda pendente
    if (nCodLanc && !tx.attachments_synced) {
      try {
        const claraClient = new ClaraClient(config);
        let docs = tx.raw_payload?.documents || tx.raw_payload?.receipts || [];
        if (docs.length === 0) docs = await claraClient.getTransactionDocuments(tx.clara_uuid);

        if (docs.length > 0) {
          for (const doc of docs) {
            const docUrl = doc.url || doc.downloadUrl;
            if (!docUrl) continue;
            const { base64, fileName } = await claraClient.downloadDocumentAsBase64(docUrl);
            if (base64) {
              const anexoPayload = ClaraOmieMapper.buildOmieAnexoPayload(nCodLanc, fileName, base64);
              await axios.post('https://app.omie.com.br/api/v1/geral/anexo/', {
                call: 'IncluirAnexo',
                app_key: omieCreds.appKey,
                app_secret: omieCreds.appSecret,
                param: [anexoPayload],
              }, { timeout: 30000 });
            }
          }
          tx.attachments_synced = true;
          tx.has_attachments = true;
        }
      } catch (err: any) {
        console.warn(`[retryTransaction] Falha ao enviar anexo:`, err.message);
      }
    }

    await this.saveLocalTransaction(tx);
    return tx;
  }
}
