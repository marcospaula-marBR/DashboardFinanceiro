import { GoogleGenerativeAI } from '@google/generative-ai';
import { ClaraTransactionRecord, ClaraConfig } from '@/types/clara.types';
import { ClaraClient } from '@/services/clara/clara-client';
import { ClaraStorageService } from '@/services/clara/clara-storage.service';
import { supabase } from '@/lib/supabase';

export interface ClaraOcrResult {
  cnpj_tomador?: string | null;
  razao_social_tomador?: string | null;
  cnpj_emitente?: string | null;
  razao_social_emitente?: string | null;
  numero_documento?: string | null;
  data_emissao?: string | null; // Formato YYYY-MM-DD
  valor_total?: number | null;
  parcelas?: Array<{
    numero: number;
    vencimento?: string | null;
    valor?: number | null;
  }>;
  cnpj_match_status: 'MATCH' | 'DIVERGENT' | 'NOT_FOUND';
  cnpj_divergence_reason?: string | null;
  raw_ai_text?: string;
}

export class ClaraOcrService {
  private static cleanCnpj(val?: string | null): string {
    if (!val) return '';
    return val.replace(/\D/g, '').trim();
  }

  public static formatCnpj(digits?: string | null): string {
    const clean = this.cleanCnpj(digits);
    if (clean.length !== 14) return digits || '';
    return `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}/${clean.substring(8, 12)}-${clean.substring(12, 14)}`;
  }

  /**
   * Executa a extração OCR de um comprovante ou NF-e em base64 via Gemini 2.5 Flash.
   * Confronta o CNPJ do tomador (destinatário) com o CNPJ da empresa ativa selecionada.
   */
  public static async analyzeDocument(
    base64Data: string,
    mimeType: string = 'application/pdf',
    expectedCompanyCnpj?: string | null,
    expectedCompanyName?: string | null
  ): Promise<ClaraOcrResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada no ambiente.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const prompt = `
Você é um auditor fiscal contábil experiente. Analise detalhadamente este comprovante / Nota Fiscal (DANFE, NFC-e, NFS-e, Recibo ou Extrato) e extraia os dados fiscais em formato JSON estrito.

Campos obrigatórios a extrair:
- "cnpj_tomador": CNPJ do TOMADOR / DESTINATÁRIO / CLIENTE / PAGADOR da nota fiscal ou serviço (apenas números ou formatado). Procure na seção "DESTINATÁRIO / REMETENTE" ou "TOMADOR DE SERVIÇOS". Se for pessoa física (CPF), retorne o CPF.
- "razao_social_tomador": Nome ou Razão Social do tomador/destinatário.
- "cnpj_emitente": CNPJ da empresa que emitiu o documento (prestador/vendedor).
- "razao_social_emitente": Nome ou Razão Social do emitente/prestador.
- "numero_documento": Número da Nota Fiscal ou comprovante.
- "data_emissao": Data de emissão da Nota Fiscal no formato "YYYY-MM-DD" (se houver dia/mês/ano converta).
- "valor_total": Valor numérico total do documento (ex: 119.67).
- "parcelas": Lista de parcelas/duplicatas se a compra foi a prazo/parcelada. Cada item: { "numero": 1, "vencimento": "YYYY-MM-DD", "valor": 100.00 }. Se for à vista ou pagamento único, retorne array vazio.

Retorne SOMENTE o JSON puro com essa estrutura:
{
  "cnpj_tomador": string | null,
  "razao_social_tomador": string | null,
  "cnpj_emitente": string | null,
  "razao_social_emitente": string | null,
  "numero_documento": string | null,
  "data_emissao": string | null,
  "valor_total": number | null,
  "parcelas": []
}
    `;

    // Detecta mimeType adequado para o inlineData
    const resolvedMime = mimeType.toLowerCase().includes('png') 
      ? 'image/png' 
      : mimeType.toLowerCase().includes('jpg') || mimeType.toLowerCase().includes('jpeg')
        ? 'image/jpeg'
        : 'application/pdf';

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: resolvedMime,
          data: base64Data,
        },
      },
    ]);

    const responseText = result.response.text();
    let parsed: any = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Fallback regex se houver invólucro markdown
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    const rawTomadorCnpj = parsed.cnpj_tomador || null;
    const cleanExtracted = this.cleanCnpj(rawTomadorCnpj);
    const cleanExpected = this.cleanCnpj(expectedCompanyCnpj);

    let matchStatus: 'MATCH' | 'DIVERGENT' | 'NOT_FOUND' = 'NOT_FOUND';
    let divergenceReason: string | null = null;

    if (!cleanExtracted) {
      matchStatus = 'NOT_FOUND';
      divergenceReason = 'CNPJ/CPF do tomador não identificado no documento anexo.';
    } else if (cleanExpected && cleanExtracted.length >= 11) {
      if (cleanExtracted === cleanExpected) {
        matchStatus = 'MATCH';
      } else {
        matchStatus = 'DIVERGENT';
        const formattedExtracted = this.formatCnpj(cleanExtracted);
        const formattedExpected = this.formatCnpj(cleanExpected);
        divergenceReason = `NF emitida para o CNPJ ${formattedExtracted}${parsed.razao_social_tomador ? ` (${parsed.razao_social_tomador})` : ''}, divergindo da empresa selecionada: ${expectedCompanyName || 'Empresa'} (${formattedExpected}).`;
      }
    } else {
      matchStatus = 'NOT_FOUND';
    }

    return {
      cnpj_tomador: this.formatCnpj(cleanExtracted) || rawTomadorCnpj,
      razao_social_tomador: parsed.razao_social_tomador || null,
      cnpj_emitente: this.formatCnpj(this.cleanCnpj(parsed.cnpj_emitente)) || parsed.cnpj_emitente || null,
      razao_social_emitente: parsed.razao_social_emitente || null,
      numero_documento: parsed.numero_documento || null,
      data_emissao: parsed.data_emissao || null,
      valor_total: typeof parsed.valor_total === 'number' ? parsed.valor_total : null,
      parcelas: Array.isArray(parsed.parcelas) ? parsed.parcelas : [],
      cnpj_match_status: matchStatus,
      cnpj_divergence_reason: divergenceReason,
      raw_ai_text: responseText,
    };
  }

  /**
   * Audita uma única transação: localiza anexo, faz download do binário, roda OCR via Gemini
   * e persiste o enriquecimento fiscal no Supabase.
   */
  public static async auditTransaction(
    tx: ClaraTransactionRecord,
    claraClient: ClaraClient,
    config: ClaraConfig,
    expectedCompanyCnpj?: string | null,
    expectedCompanyName?: string | null
  ): Promise<{ success: boolean; result?: ClaraOcrResult; error?: string }> {
    try {
      // 1. Localiza documentos
      let docs = tx.raw_payload?.documents || tx.raw_payload?.receipts || [];
      if (docs.length === 0) {
        docs = await claraClient.getTransactionDocuments(tx.clara_uuid);
      }

      if (!docs || docs.length === 0) {
        return { success: false, error: 'Nenhum comprovante anexado na Clara.' };
      }

      // 2. Baixa o anexo principal
      const primaryDoc = docs[0];
      const docUrl = (primaryDoc as any).download?.url || primaryDoc.url || primaryDoc.downloadUrl;
      if (!docUrl) {
        return { success: false, error: 'URL do anexo não acessível.' };
      }

      const { base64, mimeType } = await claraClient.downloadDocumentAsBase64(docUrl);
      if (!base64) {
        return { success: false, error: 'Falha ao baixar binário do comprovante.' };
      }

      // 3. Executa OCR
      const targetCnpj = expectedCompanyCnpj || config.active_company_cnpj || '02.233.923/0001-19';
      const targetName = expectedCompanyName || config.active_company_name || 'Mar Brasil';

      const result = await this.analyzeDocument(base64, mimeType || 'application/pdf', targetCnpj, targetName);

      // 4. Atualiza campos fiscais
      tx.invoice_cnpj_tomador = result.cnpj_tomador;
      tx.invoice_cnpj_emitente = result.cnpj_emitente;
      tx.invoice_razao_social_tomador = result.razao_social_tomador;
      tx.invoice_numero = result.numero_documento;
      tx.cnpj_match_status = result.cnpj_match_status;
      tx.cnpj_divergence_reason = result.cnpj_divergence_reason;

      if (result.data_emissao) {
        tx.invoice_issue_date = result.data_emissao;
        if (!tx.registration_date) {
          tx.registration_date = result.data_emissao;
        }
      }

      if (result.parcelas && result.parcelas.length > 1) {
        tx.installments_info = {
          current: 1,
          total: result.parcelas.length,
        };
      }

      // 5. Salva na persistência
      await ClaraStorageService.saveTransaction(tx, config);

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
        // Ignora se tabela relacional ainda não existir
      }

      return { success: true, result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Processa auditoria em lote com concorrência controlada para alta performance e escala.
   */
  public static async processBatchOcr(
    transactions: ClaraTransactionRecord[],
    config: ClaraConfig,
    expectedCompanyCnpj?: string | null,
    expectedCompanyName?: string | null,
    concurrency = 3
  ): Promise<{
    total: number;
    processed: number;
    matches: number;
    divergent: number;
    notFound: number;
    errors: number;
    updatedTransactions: ClaraTransactionRecord[];
  }> {
    const claraClient = new ClaraClient(config);
    const updatedTransactions: ClaraTransactionRecord[] = [];
    let matches = 0;
    let divergent = 0;
    let notFound = 0;
    let errors = 0;

    // Processa em chunks paralelos de tamanho 'concurrency'
    for (let i = 0; i < transactions.length; i += concurrency) {
      const chunk = transactions.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (tx) => {
          const outcome = await this.auditTransaction(
            tx,
            claraClient,
            config,
            expectedCompanyCnpj,
            expectedCompanyName
          );

          if (outcome.success && outcome.result) {
            if (outcome.result.cnpj_match_status === 'MATCH') matches++;
            else if (outcome.result.cnpj_match_status === 'DIVERGENT') divergent++;
            else notFound++;
            updatedTransactions.push(tx);
          } else {
            errors++;
          }
        })
      );
    }

    return {
      total: transactions.length,
      processed: updatedTransactions.length,
      matches,
      divergent,
      notFound,
      errors,
      updatedTransactions,
    };
  }
}
