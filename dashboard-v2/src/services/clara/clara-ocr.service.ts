import { GoogleGenerativeAI } from '@google/generative-ai';

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
}
