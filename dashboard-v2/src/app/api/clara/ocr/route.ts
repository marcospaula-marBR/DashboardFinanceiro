import { NextResponse } from 'next/server';
import { ClaraOcrService } from '@/services/clara/clara-ocr.service';
import { ClaraStorageService } from '@/services/clara/clara-storage.service';
import { ClaraClient } from '@/services/clara/clara-client';
import { DEFAULT_CLARA_CONFIG } from '@/services/clara/clara-config.service';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transactionId, companyCnpj, companyName } = body;

    if (!transactionId) {
      return NextResponse.json({ status: 'error', message: 'transactionId é obrigatório.' }, { status: 400 });
    }

    const config = await ClaraStorageService.getConfig(DEFAULT_CLARA_CONFIG);
    const state = await ClaraStorageService.getState(config);
    const tx = state.transactions[transactionId] || Object.values(state.transactions).find(t => t.clara_uuid === transactionId);

    if (!tx) {
      return NextResponse.json({ status: 'error', message: `Transação ${transactionId} não encontrada.` }, { status: 404 });
    }

    const claraClient = new ClaraClient(config);

    // 1. Busca documentos anexados
    let docs = tx.raw_payload?.documents || tx.raw_payload?.receipts || [];
    if (docs.length === 0) {
      docs = await claraClient.getTransactionDocuments(tx.clara_uuid);
    }

    if (!docs || docs.length === 0) {
      return NextResponse.json({
        status: 'warning',
        message: 'Nenhum documento comprovante encontrado para esta transação na Clara.',
        data: tx,
      });
    }

    // 2. Baixa o primeiro anexo (NF ou comprovante)
    const primaryDoc = docs[0];
    const docUrl = (primaryDoc as any).download?.url || primaryDoc.url || primaryDoc.downloadUrl;

    if (!docUrl) {
      return NextResponse.json({
        status: 'error',
        message: 'URL de download do comprovante não disponível.',
      }, { status: 400 });
    }

    const { base64, mimeType } = await claraClient.downloadDocumentAsBase64(docUrl);
    if (!base64) {
      return NextResponse.json({
        status: 'error',
        message: 'Não foi possível baixar o binário do comprovante para análise OCR.',
      }, { status: 500 });
    }

    // 3. Executa a análise OCR confrontando com a empresa ativa
    const targetCnpj = companyCnpj || config.active_company_cnpj || '02.233.923/0001-19'; // Padrão: Mar Brasil
    const targetName = companyName || config.active_company_name || 'Mar Brasil';

    const ocrResult = await ClaraOcrService.analyzeDocument(
      base64,
      mimeType || 'application/pdf',
      targetCnpj,
      targetName
    );

    // 4. Atualiza os campos fiscais na transação
    tx.invoice_cnpj_tomador = ocrResult.cnpj_tomador;
    tx.invoice_cnpj_emitente = ocrResult.cnpj_emitente;
    tx.invoice_razao_social_tomador = ocrResult.razao_social_tomador;
    tx.invoice_numero = ocrResult.numero_documento;
    tx.cnpj_match_status = ocrResult.cnpj_match_status;
    tx.cnpj_divergence_reason = ocrResult.cnpj_divergence_reason;

    if (ocrResult.data_emissao) {
      tx.invoice_issue_date = ocrResult.data_emissao;
      // Se a data de registro ainda não estiver definida, usa a data de emissão como competência inicial
      if (!tx.registration_date) {
        tx.registration_date = ocrResult.data_emissao;
      }
    }

    if (ocrResult.parcelas && ocrResult.parcelas.length > 1) {
      tx.installments_info = {
        current: 1,
        total: ocrResult.parcelas.length,
      };
    }

    // 5. Salva a transação atualizada no storage remoto (Supabase)
    await ClaraStorageService.saveTransaction(tx, config);

    // Se houver tabela clara_transactions, atualiza também
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
    } catch {
      // Ignora se tabela relacional ainda não tiver essas colunas
    }

    return NextResponse.json({
      status: 'success',
      data: tx,
      ocr: ocrResult,
      message: ocrResult.cnpj_match_status === 'MATCH'
        ? `✅ CNPJ Tomador validado com sucesso: ${ocrResult.cnpj_tomador} (${targetName})`
        : ocrResult.cnpj_match_status === 'DIVERGENT'
          ? `⚠️ CNPJ Tomador divergente: ${ocrResult.cnpj_tomador || 'Não encontrado'}`
          : 'Comprovante analisado (CNPJ do tomador não identificado).',
    });

  } catch (error: any) {
    console.error('[API Clara OCR Error]:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao processar OCR do comprovante.',
    }, { status: 500 });
  }
}
