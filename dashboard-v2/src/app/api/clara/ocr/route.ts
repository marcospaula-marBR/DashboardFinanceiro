import { NextResponse } from 'next/server';
import { ClaraOcrService } from '@/services/clara/clara-ocr.service';
import { ClaraStorageService } from '@/services/clara/clara-storage.service';
import { ClaraClient } from '@/services/clara/clara-client';
import { ClaraConfigService, DEFAULT_CLARA_CONFIG, DEFAULT_CLARA_CONFIG_DZM } from '@/services/clara/clara-config.service';
import { supabase } from '@/lib/supabase';
import { ClaraTransactionRecord } from '@/types/clara.types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transactionId, companyCnpj, companyName, companyId } = body;

    if (!transactionId) {
      return NextResponse.json({ status: 'error', message: 'transactionId é obrigatório.' }, { status: 400 });
    }

    const compId = companyId || (companyName?.toLowerCase().includes('dzm') ? 'dzm' : 'marbrasil');
    const isDZM = compId.toLowerCase().includes('dzm');
    const defaultConfig = isDZM ? DEFAULT_CLARA_CONFIG_DZM : DEFAULT_CLARA_CONFIG;

    let config = await ClaraStorageService.getConfig(defaultConfig, isDZM ? 'dzm' : 'marbrasil');
    let state = await ClaraStorageService.getState(config);
    let tx: ClaraTransactionRecord | null =
      state.transactions[transactionId] ||
      Object.values(state.transactions).find(t => t.clara_uuid === transactionId || t.id === transactionId) ||
      null;

    // Se não encontrou no estado primário, busca no outro tenant ou Supabase
    if (!tx) {
      const altConfig = isDZM ? DEFAULT_CLARA_CONFIG : DEFAULT_CLARA_CONFIG_DZM;
      const altState = await ClaraStorageService.getState(altConfig);
      tx =
        altState.transactions[transactionId] ||
        Object.values(altState.transactions).find(t => t.clara_uuid === transactionId || t.id === transactionId) ||
        null;
    }

    if (!tx) {
      try {
        const { data } = await supabase
          .from('clara_transactions')
          .select('*')
          .or(`id.eq.${transactionId},clara_uuid.eq.${transactionId}`)
          .maybeSingle();
        if (data) tx = data;
      } catch {}
    }

    if (!tx) {
      tx = {
        id: transactionId,
        clara_uuid: transactionId,
        company_id: isDZM ? 'dzm' : 'marbrasil',
        company_name: isDZM ? 'D.Z.M LTDA' : 'Mar Brasil',
        merchant_name: 'Desconhecido',
        amount: 0,
        currency: 'BRL',
        transaction_type: 'PURCHASE',
        operation_date: new Date().toISOString(),
        transaction_status: 'AUTHORIZED',
        sync_status: 'READY',
        has_attachments: true,
        attachments_count: 1,
        attachments_synced: false,
        sync_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Garante que o claraClient utiliza a credencial da empresa certa (DZM vs Mar Brasil)
    const effectiveCompanyId = tx.company_id || (tx.company_name?.toLowerCase().includes('dzm') ? 'dzm' : compId);
    const effectiveConfig = await ClaraConfigService.getConfig(effectiveCompanyId);
    const claraClient = new ClaraClient(effectiveConfig);

    // 1. Busca documentos anexados na Clara v3
    let docs = tx.raw_payload?.documents || tx.raw_payload?.receipts || [];
    if (!docs || docs.length === 0) {
      docs = await claraClient.getTransactionDocuments(tx.clara_uuid);
    }

    if (!docs || docs.length === 0) {
      return NextResponse.json({
        status: 'warning',
        message: 'Nenhum documento comprovante encontrado para esta transação na Clara.',
        data: tx,
      });
    }

    // 2. Itera sobre os comprovantes (fotos JPG/JPEG/PNG ou PDFs)
    const targetCnpj = companyCnpj || effectiveConfig.active_company_cnpj || (effectiveCompanyId.includes('dzm') ? '46.394.311/0001-83' : '02.233.923/0001-19');
    const targetName = companyName || effectiveConfig.active_company_name || (effectiveCompanyId.includes('dzm') ? 'DZM' : 'Mar Brasil');

    let bestOcrResult: any = null;
    let anyDocDownloaded = false;

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const docUrl = (doc as any).download?.url || doc.url || doc.downloadUrl;
      if (!docUrl) continue;

      try {
        const { base64, mimeType, fileName } = await claraClient.downloadDocumentAsBase64(docUrl);
        if (!base64) continue;
        anyDocDownloaded = true;

        const docFormat = ((doc as any).format || doc.fileType || '').toLowerCase();
        let effectiveMime = mimeType;
        if (docFormat === 'jpeg' || docFormat === 'jpg' || fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) {
          effectiveMime = 'image/jpeg';
        } else if (docFormat === 'png' || fileName.toLowerCase().endsWith('.png')) {
          effectiveMime = 'image/png';
        }

        const ocrResult = await ClaraOcrService.analyzeDocument(
          base64,
          effectiveMime,
          targetCnpj,
          targetName
        );

        if (!bestOcrResult) {
          bestOcrResult = ocrResult;
        }

        if (ocrResult.cnpj_match_status === 'MATCH') {
          bestOcrResult = ocrResult;
          break; // CNPJ compatível encontrado com sucesso!
        } else if (ocrResult.cnpj_tomador && !bestOcrResult.cnpj_tomador) {
          bestOcrResult = ocrResult;
        }
      } catch (docErr: any) {
        console.warn(`[OCR] Falha ao processar anexo ${i} (${doc.fileName || doc.name}):`, docErr.message);
      }
    }

    if (!anyDocDownloaded || !bestOcrResult) {
      return NextResponse.json({
        status: 'error',
        message: 'Não foi possível baixar ou ler os arquivos anexados pelo leitor OCR.',
      }, { status: 500 });
    }

    // 4. Atualiza os campos fiscais na transação
    tx.invoice_cnpj_tomador = bestOcrResult.cnpj_tomador;
    tx.invoice_cnpj_emitente = bestOcrResult.cnpj_emitente;
    tx.invoice_razao_social_tomador = bestOcrResult.razao_social_tomador;
    tx.invoice_numero = bestOcrResult.numero_documento;
    tx.cnpj_match_status = bestOcrResult.cnpj_match_status;
    tx.cnpj_divergence_reason = bestOcrResult.cnpj_divergence_reason;

    if (bestOcrResult.data_emissao) {
      tx.invoice_issue_date = bestOcrResult.data_emissao;
      if (!tx.registration_date) {
        tx.registration_date = bestOcrResult.data_emissao;
      }
    }

    if (bestOcrResult.parcelas && bestOcrResult.parcelas.length > 1) {
      tx.installments_info = {
        current: 1,
        total: bestOcrResult.parcelas.length,
      };
    }

    // 5. Salva a transação atualizada no storage remoto (Supabase)
    await ClaraStorageService.saveTransaction(tx, effectiveConfig);

    try {
      await supabase
        .from('clara_transactions')
        .update({
          invoice_cnpj_tomador: tx.invoice_cnpj_tomador,
          cnpj_match_status: tx.cnpj_match_status,
          cnpj_divergence_reason: tx.cnpj_divergence_reason,
          invoice_issue_date: tx.invoice_issue_date,
          registration_date: tx.registration_date,
          updated_at: new Date().toISOString(),
        })
        .or(`id.eq.${tx.id},clara_uuid.eq.${tx.clara_uuid}`);
    } catch {}

    const feedbackMsg = bestOcrResult.cnpj_match_status === 'MATCH'
      ? `✅ CNPJ Tomador validado com sucesso: ${bestOcrResult.cnpj_tomador} (${targetName})`
      : bestOcrResult.cnpj_match_status === 'DIVERGENT'
        ? `⚠️ CNPJ Tomador divergente: ${bestOcrResult.cnpj_divergence_reason || bestOcrResult.cnpj_tomador}`
        : 'Comprovante analisado (CNPJ do tomador não identificado).';

    return NextResponse.json({
      status: 'success',
      data: tx,
      ocr: bestOcrResult,
      message: feedbackMsg,
    });

  } catch (error: any) {
    console.error('[API Clara OCR Error]:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao processar OCR do comprovante.',
    }, { status: 500 });
  }
}
