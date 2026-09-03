import axios from 'axios';
import crypto from 'crypto';
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
import { ClaraConfigService, DEFAULT_CLARA_CONFIG } from './clara-config.service';
import { ClaraClient } from './clara-client';
import { ClaraOmieMapper } from './clara-omie-mapper';
import { ClaraStorageService } from './clara-storage.service';

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
   * Garante que o estabelecimento comercial exista como Fornecedor no Omie.
   * Se já existir, retorna o código. Se não existir, cadastra automaticamente.
   * Caso falhe ou não haja nome, usa o fornecedor corporativo padrão (Clara Cartões).
   */
  public static async ensureSupplier(
    merchantName: string | undefined | null,
    omieCreds: { appKey: string; appSecret: string },
    fallbackSupplierCode: number = 12323918318
  ): Promise<number> {
    if (!merchantName || !merchantName.trim()) return fallbackSupplierCode;
    const cleanName = merchantName.trim().substring(0, 60);
    const hash = crypto.createHash('md5').update(cleanName.toLowerCase()).digest('hex').substring(0, 15);
    const codInt = `CL-M-${hash}`;

    // 1. Tenta consultar pelo código de integração determinístico
    try {
      const res = await axios.post('https://app.omie.com.br/api/v1/geral/clientes/', {
        call: 'ConsultarCliente',
        app_key: omieCreds.appKey,
        app_secret: omieCreds.appSecret,
        param: [{ codigo_cliente_integracao: codInt }],
      }, { timeout: 10000 });

      if (res.data?.codigo_cliente_omie) {
        return Number(res.data.codigo_cliente_omie);
      }
    } catch {
      // Prossegue para criação
    }

    // 2. Tenta incluir o fornecedor
    try {
      const incRes = await axios.post('https://app.omie.com.br/api/v1/geral/clientes/', {
        call: 'IncluirCliente',
        app_key: omieCreds.appKey,
        app_secret: omieCreds.appSecret,
        param: [{
          codigo_cliente_integracao: codInt,
          razao_social: cleanName,
          nome_fantasia: cleanName,
          inativo: 'N',
        }],
      }, { timeout: 10000 });

      if (incRes.data?.codigo_cliente_omie) {
        return Number(incRes.data.codigo_cliente_omie);
      }
    } catch (e: any) {
      console.warn(`[ensureSupplier] Aviso ao cadastrar fornecedor "${cleanName}":`, e.response?.data?.faultstring || e.message);
    }

    return fallbackSupplierCode;
  }

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
    await ClaraStorageService.addSyncRun(run, DEFAULT_CLARA_CONFIG).catch(() => {});

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

    await ClaraStorageService.updateSyncRun(run, DEFAULT_CLARA_CONFIG).catch(() => {});
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
      omie_integration_id: ClaraOmieMapper.generateOmieContaPagarIntegrationId(claraUuid),
      omie_launch_id: null,
      omie_account_id: null,
      omie_category_code: null,
      omie_department_code: null,
      has_attachments: hasAttachments,
      attachments_count: docs.length,
      attachments_synced: false,
      cnpj_match_status: hasAttachments ? 'PENDING' : 'NOT_FOUND',
      installments_info: (() => {
        const rawInst = raw.installmentNumber || raw.installments;
        if (typeof rawInst === 'string' && rawInst.includes('/')) {
          const parts = rawInst.split('/').map((p: string) => parseInt(p.trim(), 10));
          if (!isNaN(parts[0]) && !isNaN(parts[1])) {
            return {
              current: parts[0],
              total: parts[1],
              installment_group_uuid: raw.installment || undefined,
            };
          }
        }
        return null;
      })(),
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

      // 2. Determina estratégia de busca
      // Se for a primeira execução ou forceFullSync, busca sem filtro restritivo de data para trazer o histórico da Clara
      let claraRawList: ClaraRawTransaction[] = [];
      const isInitialSync = options.forceFullSync || memoryTransactions.size === 0;

      try {
        if (isInitialSync) {
          claraRawList = await claraClient.getAllTransactions({ size: 100, page: 0 });
        } else {
          const overlapDays = config.overlap_days || 15;
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - overlapDays);
          const startDateStr = startDate.toISOString().split('T')[0];
          claraRawList = await claraClient.getAllTransactions({
            lastUpdateDateRangeStart: startDateStr,
            size: 100,
            page: 0,
          });
        }
      } catch (err: any) {
        console.warn('[ClaraSyncService] Busca com filtro falhou, buscando sem filtro de data:', err.message);
        claraRawList = await claraClient.getAllTransactions({ size: 100, page: 0 });
      }

      // Fallback: se a busca com filtro retornou vazia, busca todas as páginas disponíveis
      if (claraRawList.length === 0) {
        try {
          claraRawList = await claraClient.getAllTransactions({ size: 100, page: 0 });
        } catch {}
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
        let existingRecord: ClaraTransactionRecord | null = await ClaraStorageService.getTransaction(normalized.clara_uuid, DEFAULT_CLARA_CONFIG);
        if (!existingRecord) {
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

      // 5. Processamento dos elegíveis (READY) para envio ao Omie (IncluirContaPagar)
      const omieCreds = ClaraConfigService.getOmieCredentials(config.company_name);
      const supplierCode = config.omie_supplier_code ?? 12323918318; // Clara Cartoes Corporativos

      if (!isSafeMode && (!supplierCode || !omieCreds.appKey || !omieCreds.appSecret)) {
        throw new Error('Código do fornecedor Clara ou credenciais Omie não configuradas. Configure em Configurações → Clara.');
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

          // PRODUÇÃO: dispara IncluirContaPagar no Omie
          try {
            const merchantSupplierCode = await this.ensureSupplier(tx.merchant_name, omieCreds, supplierCode);
            const contaPagarPayload = ClaraOmieMapper.buildOmieContaPagarPayload(
              tx,
              merchantSupplierCode,
              tx.omie_category_code || config.default_omie_category || '2.01.01',
              tx.omie_department_code,
              tx.omie_project_code || config.default_omie_project,
              config.omie_n_cod_cc || 12291364271
            );

            const res = await axios.post('https://app.omie.com.br/api/v1/financas/contapagar/', {
              call: 'IncluirContaPagar',
              app_key: omieCreds.appKey,
              app_secret: omieCreds.appSecret,
              param: [contaPagarPayload],
            }, { timeout: 20000 });

            nCodLanc = Number(res.data?.codigo_lancamento_omie);
            if (!nCodLanc) {
              throw new Error(res.data?.faultstring || res.data?.descricao_status || 'Omie não retornou codigo_lancamento_omie.');
            }

            tx.omie_launch_id = nCodLanc;
            tx.sync_status = 'SYNCED';
            tx.synced_at = new Date().toISOString();
            tx.last_sync_error = null;
            synced++;
          } catch (err: any) {
            errors++;
            const msg = err.response?.data?.faultstring || err.message;
            tx.sync_status = 'ERROR';
            tx.last_sync_error = `Omie IncluirContaPagar: ${msg}`;
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
                const docUrl = (doc as any).download?.url || doc.url || doc.downloadUrl;
                if (!docUrl) continue;

                // Baixa o binário do comprovante em base64 com mTLS
                const { base64, fileName } = await claraClient.downloadDocumentAsBase64(docUrl);
                
                if (base64) {
                  const anexoPayload = ClaraOmieMapper.buildOmieAnexoPayload(
                    nCodLanc,
                    doc.name || fileName || `comprovante_${tx.authorization_number || tx.clara_uuid}.pdf`,
                    base64,
                    'conta-pagar'
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
  /**
   * Salva transação localmente com persistência dupla (ClaraStorageService + Supabase + memória)
   */
  private static async saveLocalTransaction(tx: ClaraTransactionRecord): Promise<void> {
    tx.updated_at = new Date().toISOString();
    memoryTransactions.set(tx.clara_uuid, tx);

    // Persiste no storage seguro do Supabase
    await ClaraStorageService.saveTransaction(tx, DEFAULT_CLARA_CONFIG).catch(() => {});

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

      if (!error && data && data.length > 0) {
        return { transactions: data, total: count || data.length };
      }
    } catch {
      // Fallback para ClaraStorageService
    }

    // Busca itens do storage compartilhado e memória
    const storedItems = await ClaraStorageService.getAllTransactions(DEFAULT_CLARA_CONFIG);
    for (const item of storedItems) {
      if (!memoryTransactions.has(item.clara_uuid)) {
        memoryTransactions.set(item.clara_uuid, item);
      }
    }

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
      if (data && data.length > 0) rows = data as any;
    } catch {
      // Fallback
    }

    if (rows.length === 0) {
      const storedItems = await ClaraStorageService.getAllTransactions(DEFAULT_CLARA_CONFIG);
      for (const item of storedItems) {
        if (!memoryTransactions.has(item.clara_uuid)) {
          memoryTransactions.set(item.clara_uuid, item);
        }
      }
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
    let tx: ClaraTransactionRecord | null = await ClaraStorageService.getTransaction(idOrUuid, DEFAULT_CLARA_CONFIG);

    if (!tx) {
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
    }

    if (!tx) {
      try {
        const config = await ClaraConfigService.getConfig();
        const claraClient = new ClaraClient(config);
        const raw = await claraClient.getTransaction(idOrUuid);
        if (raw && (raw.uuid || raw.id)) {
          tx = this.normalizeClaraTransaction(raw);
          const docs = await claraClient.getTransactionDocuments(tx.clara_uuid);
          if (docs && docs.length > 0) {
            tx.has_attachments = true;
            tx.attachments_count = docs.length;
            if (tx.raw_payload) tx.raw_payload.documents = docs;
          }
        }
      } catch (err: any) {
        console.warn(`[retryTransaction] Falha ao recuperar transação na Clara API:`, err.message);
      }
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

    // Código do fornecedor 'Clara Cartões' no Omie (criado automaticamente se ausente)
    const supplierCode = config.omie_supplier_code ?? 12323918318; // fallback ao código criado no setup

    if (!config.safe_mode && !supplierCode) {
      throw new Error('Código do fornecedor Clara no Omie não configurado. Acesse Configurações → Clara → Conta Omie.');
    }

    let nCodLanc = tx.omie_launch_id;

    if (!nCodLanc && !config.safe_mode) {
      const merchantSupplierCode = await this.ensureSupplier(tx.merchant_name, omieCreds, supplierCode);
      const contaPagarPayload = ClaraOmieMapper.buildOmieContaPagarPayload(
        tx,
        merchantSupplierCode,
        tx.omie_category_code || config.default_omie_category || '2.01.01',
        tx.omie_department_code,
        tx.omie_project_code || config.default_omie_project,
        config.omie_n_cod_cc || 12291364271
      );

      let res;
      try {
        res = await axios.post('https://app.omie.com.br/api/v1/financas/contapagar/', {
          call: 'IncluirContaPagar',
          app_key: omieCreds.appKey,
          app_secret: omieCreds.appSecret,
          param: [contaPagarPayload],
        }, { timeout: 20000 });
      } catch (axiosErr: any) {
        const omieError = axiosErr.response?.data?.faultstring || axiosErr.message;
        throw new Error(`Omie IncluirContaPagar: ${omieError}`);
      }

      nCodLanc = Number(res.data?.codigo_lancamento_omie);
      if (!nCodLanc) {
        const errMsg = res.data?.faultstring || res.data?.descricao_status || 'Omie não retornou codigo_lancamento_omie.';
        throw new Error(`Omie IncluirContaPagar falhou: ${errMsg}`);
      }

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
            const docUrl = (doc as any).download?.url || doc.url || doc.downloadUrl;
            if (!docUrl) continue;
            const { base64, fileName } = await claraClient.downloadDocumentAsBase64(docUrl);
            if (base64) {
              const anexoPayload = ClaraOmieMapper.buildOmieAnexoPayload(nCodLanc, fileName, base64, 'conta-pagar');
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

  /**
   * Atualiza diretamente categoria, departamento e/ou projeto de uma transação
   */
  public static async updateTransactionFields(
    idOrUuid: string,
    fields: {
      omie_category_code?: string | null;
      omie_department_code?: string | null;
      omie_project_code?: string | null;
      invoice_issue_date?: string | null;
      registration_date?: string | null;
      due_date?: string | null;
      invoice_cnpj_tomador?: string | null;
      cnpj_match_status?: any;
      sync_status?: any;
    }
  ): Promise<ClaraTransactionRecord> {
    let tx: ClaraTransactionRecord | null = await ClaraStorageService.getTransaction(idOrUuid, DEFAULT_CLARA_CONFIG);

    if (!tx) {
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
    }

    // Se ainda não encontrou no storage nem em memória, busca diretamente na API Clara
    if (!tx) {
      try {
        const config = await ClaraConfigService.getConfig();
        const claraClient = new ClaraClient(config);
        const raw = await claraClient.getTransaction(idOrUuid);
        if (raw && (raw.uuid || raw.id)) {
          tx = this.normalizeClaraTransaction(raw);
          // Se tiver anexos, contabiliza
          const docs = await claraClient.getTransactionDocuments(tx.clara_uuid);
          if (docs && docs.length > 0) {
            tx.has_attachments = true;
            tx.attachments_count = docs.length;
            if (tx.raw_payload) tx.raw_payload.documents = docs;
          }
        }
      } catch (err: any) {
        console.warn(`[updateTransactionFields] Falha ao recuperar transação na Clara API:`, err.message);
      }
    }

    if (!tx) {
      throw new Error(`Transação ${idOrUuid} não encontrada.`);
    }

    if (fields.omie_category_code !== undefined) tx.omie_category_code = fields.omie_category_code;
    if (fields.omie_department_code !== undefined) tx.omie_department_code = fields.omie_department_code;
    if (fields.omie_project_code !== undefined) tx.omie_project_code = fields.omie_project_code;
    if (fields.invoice_issue_date !== undefined) tx.invoice_issue_date = fields.invoice_issue_date;
    if (fields.registration_date !== undefined) tx.registration_date = fields.registration_date;
    if (fields.due_date !== undefined) tx.due_date = fields.due_date;
    if (fields.invoice_cnpj_tomador !== undefined) tx.invoice_cnpj_tomador = fields.invoice_cnpj_tomador;
    if (fields.cnpj_match_status !== undefined) tx.cnpj_match_status = fields.cnpj_match_status;

    // Se categoria foi preenchida e status era MAPPING_REQUIRED, atualiza para READY
    if (tx.omie_category_code && tx.sync_status === 'MAPPING_REQUIRED') {
      tx.sync_status = 'READY';
      tx.last_sync_error = null;
    } else if (fields.sync_status) {
      tx.sync_status = fields.sync_status;
    }

    await this.saveLocalTransaction(tx);
    return tx;
  }

  /**
   * Dispara envio ao Omie para múltiplas transações selecionadas
   */
  public static async syncSelectedTransactions(uuids: string[]): Promise<{
    total: number;
    success: number;
    failed: number;
    results: Array<{ uuid: string; status: string; message?: string }>;
  }> {
    const results: Array<{ uuid: string; status: string; message?: string }> = [];
    let success = 0;
    let failed = 0;

    for (const uuid of uuids) {
      try {
        const updated = await this.retryTransaction(uuid);
        if (updated.sync_status === 'SYNCED' || updated.sync_status === 'READY') {
          success++;
          results.push({ uuid, status: updated.sync_status });
        } else {
          failed++;
          results.push({ uuid, status: updated.sync_status, message: updated.last_sync_error || 'Status não sincronizado' });
        }
      } catch (err: any) {
        failed++;
        results.push({ uuid, status: 'ERROR', message: err.message });
      }
    }

    return {
      total: uuids.length,
      success,
      failed,
      results,
    };
  }
}
