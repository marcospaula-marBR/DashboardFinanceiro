import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
// @ts-expect-error pdf-parse internal module has no bundled types
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import {
  detectXmlDocumentType,
  normalizeDetectedCompany,
  parseBenefitsPdfText,
  parseDominioPayrollText,
  parseEsocialS1200Xml,
  parseNfseXml,
  sanitizeParsedPayrollRecords,
} from '@/services/people-ingestion-parser.service';

export const dynamic = 'force-dynamic';

const RUBRICA_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    codigo: { type: Type.STRING },
    descricao: { type: Type.STRING },
    valor: { type: Type.NUMBER },
  },
  required: ['codigo', 'descricao', 'valor'],
};

const PAYROLL_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    competencia: { type: Type.STRING },
    empresa: { type: Type.STRING },
    records: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          matricula: { type: Type.STRING },
          name: { type: Type.STRING },
          cpf: { type: Type.STRING },
          cargo: { type: Type.STRING },
          empresa: { type: Type.STRING },
          situation: { type: Type.STRING },
          admission_date: { type: Type.STRING },
          valor_fixo: { type: Type.NUMBER },
          valor_hora_extra: { type: Type.NUMBER },
          valor_adicional_not: { type: Type.NUMBER },
          salario_familia: { type: Type.NUMBER },
          valor_ferias: { type: Type.NUMBER },
          valor_decimo_terceiro: { type: Type.NUMBER },
          valor_rescisao: { type: Type.NUMBER },
          valor_outros_recebidos: { type: Type.NUMBER },
          valor_holerite: { type: Type.NUMBER },
          inss_empregado: { type: Type.NUMBER },
          irrf_empregado: { type: Type.NUMBER },
          desconto_vt_6: { type: Type.NUMBER },
          desconto_adiantamento_folha: { type: Type.NUMBER },
          valor_adiantamento: { type: Type.NUMBER },
          valor_faltas: { type: Type.NUMBER },
          dias_faltas: { type: Type.NUMBER },
          valor_consignado: { type: Type.NUMBER },
          valor_pensao_alimenticia: { type: Type.NUMBER },
          banco_horas: { type: Type.NUMBER },
          valor_descontos: { type: Type.NUMBER },
          valor_folha_liquido: { type: Type.NUMBER },
          valor_fgts: { type: Type.NUMBER },
          valor_vt: { type: Type.NUMBER },
          valor_vr: { type: Type.NUMBER },
          valor_cesta: { type: Type.NUMBER },
          valor_bonus: { type: Type.NUMBER },
          valor_ajuda_custo: { type: Type.NUMBER },
          rubricas_proventos: { type: Type.ARRAY, items: RUBRICA_SCHEMA },
          rubricas_descontos: { type: Type.ARRAY, items: RUBRICA_SCHEMA },
          observacao: { type: Type.STRING },
        },
        required: ['name', 'valor_holerite', 'valor_descontos'],
      },
    },
  },
  required: ['competencia', 'records'],
};

const BENEFITS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    competencia: { type: Type.STRING },
    empresa: { type: Type.STRING },
    records: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          matricula: { type: Type.STRING },
          name: { type: Type.STRING },
          cpf: { type: Type.STRING },
          cargo: { type: Type.STRING },
          valor: { type: Type.NUMBER },
          valor_vt: { type: Type.NUMBER },
          valor_vr: { type: Type.NUMBER },
          valor_cesta: { type: Type.NUMBER },
          valor_bonus: { type: Type.NUMBER },
          valor_premiacao: { type: Type.NUMBER },
          valor_ajuda_custo: { type: Type.NUMBER },
          observacao: { type: Type.STRING },
        },
        required: ['name', 'valor'],
      },
    },
  },
  required: ['competencia', 'records'],
};

const ADVANCE_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    competencia: { type: Type.STRING },
    empresa: { type: Type.STRING },
    records: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          matricula: { type: Type.STRING },
          name: { type: Type.STRING },
          cpf: { type: Type.STRING },
          cargo: { type: Type.STRING },
          valor_adiantamento: { type: Type.NUMBER },
          observacao: { type: Type.STRING },
        },
        required: ['name', 'valor_adiantamento'],
      },
    },
  },
  required: ['competencia', 'records'],
};

const BONUS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    competencia: { type: Type.STRING },
    empresa: { type: Type.STRING },
    records: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          matricula: { type: Type.STRING },
          name: { type: Type.STRING },
          cpf: { type: Type.STRING },
          cargo: { type: Type.STRING },
          valor_bonus: { type: Type.NUMBER },
          valor_premiacao: { type: Type.NUMBER },
          observacao: { type: Type.STRING },
        },
        required: ['name'],
      },
    },
  },
  required: ['competencia', 'records'],
};

function buildPromptForMode(importType: string): { prompt: string; schema: Schema } {
  const isAdvanceMode = importType === 'advance';
  const isBenefitsMode = importType === 'benefits';
  const isBonusMode = importType === 'bonus' || importType === 'premiacao';

  if (isBonusMode) {
    return {
      schema: BONUS_RESPONSE_SCHEMA,
      prompt: `
Analise este documento (PDF ou imagem) contendo um Relatório, Demonstrativo, Recibo ou Planilha de Bônus, Bonificação, Premiação, Prêmios e Incentivos de colaboradores.
1. Identifique "competencia" no formato YYYY-MM-01 (ou "" se ausente) e "empresa" ("DZM", "MarBR" ou "G2").
2. Extraia cada colaborador em "records" com: name, cpf, matricula, cargo, valor_bonus (metas/bonificação), valor_premiacao (prêmios/campanhas) e observacao.
Valores estritamente numéricos decimais.`,
    };
  }

  if (isAdvanceMode) {
    return {
      schema: ADVANCE_RESPONSE_SCHEMA,
      prompt: `
Analise este documento (PDF ou imagem) contendo a Folha de Adiantamento Salarial quinzenal.
1. Identifique "competencia" no formato YYYY-MM-01 (ou "" se ausente) e "empresa" ("DZM", "MarBR" ou "G2").
2. Extraia cada colaborador em "records" com: name, cpf, matricula, cargo, valor_adiantamento (valor efetivo a receber) e observacao.
Valores estritamente numéricos decimais.`,
    };
  }

  if (isBenefitsMode) {
    return {
      schema: BENEFITS_RESPONSE_SCHEMA,
      prompt: `
Analise este documento (PDF ou imagem) contendo um Relatório ou Planilha de Benefícios / Pagamentos de Colaboradores (Vale Transporte / VT, Vale Refeição / Alimentação / Cesta Básica, Flash, Sodexo, Alelo, Bônus, Premiação ou Outros).
1. Identifique "competencia" no formato YYYY-MM-01 (ou "" se ausente) e "empresa" ("DZM", "MarBR" ou "G2").
2. Extraia RIGOROSAMENTE CADA LINHA individual de colaborador sem pular nenhum nome.
3. Em "valor", informe sempre o TOTAL FINAL A PAGAR / CREDITADO para aquele colaborador (ex.: coluna TOTAL A PAGAR, VALOR LIQUIDO, TOTAL). Preencha também o campo específico (valor_vt, valor_vr, valor_cesta, valor_bonus, valor_premiacao, valor_ajuda_custo) conforme a natureza do relatório.
Valores estritamente numéricos decimais.`,
    };
  }

  return {
    schema: PAYROLL_RESPONSE_SCHEMA,
    prompt: `
Analise este documento (PDF ou imagem) contendo o Extrato Mensal da folha de pagamento celetista (listagem ou múltiplos holerites).
REGRAS ESTRITAS:
0. Empresa Contratante ("empresa"): identifique no cabeçalho e padronize como 'DZM', 'MarBR' ou 'G2' no topo e em cada registro.
1. Competência ("competencia"): formate obrigatoriamente como 'YYYY-MM-01'.
2. Proventos: extraia valor_fixo (salário base), valor_hora_extra (com reflexo DSR), valor_adicional_not, salario_familia, valor_ferias, valor_decimo_terceiro, valor_rescisao, valor_outros_recebidos, valor_holerite (TOTAL DE PROVENTOS) e rubricas_proventos.
3. Descontos: extraia inss_empregado (998), irrf_empregado, desconto_vt_6 (rubrica 48 - ATENÇÃO: rubrica 48 é estritamente DESCONTO; mantenha valor_vt SEMPRE 0.00 na folha mensal), valor_faltas, dias_faltas, valor_consignado, valor_pensao_alimenticia, banco_horas, valor_descontos (TOTAL DE DESCONTOS) e rubricas_descontos.
4. Adiantamento Salarial em Folha (CRUCIAL): procure exclusivamente pela rubrica 981 ou descrição 'DESC.ADIANT.SALARIAL' / 'Desc. Adiant. Salarial' / 'ADIANTAMENTO SALARIAL' na coluna de descontos (NUNCA adiantamento de férias) e preencha desconto_adiantamento_folha e valor_adiantamento com esse valor (ou 0.00 se ausente).
5. Líquido e FGTS: preencha valor_folha_liquido (Proventos - Descontos) e valor_fgts (informativo da empresa).
6. IGNORE bases informativas (Base FGTS, Base INSS, Base IRRF) — elas não são proventos nem descontos.`,
  };
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  try {
    let mimeType = 'application/pdf';
    let fileName = '';
    let buffer: Buffer;
    let importType = 'payroll';
    let forceAi = false;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { fileUrl, type, forceAi: forceAiFlag } = body;
      if (type) importType = String(type);
      if (forceAiFlag === true) forceAi = true;
      if (!fileUrl) {
        return NextResponse.json({ error: 'Nenhum fileUrl informado.' }, { status: 400 });
      }

      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) {
        return NextResponse.json(
          { error: `Falha ao baixar o arquivo do storage (${fileRes.status}).` },
          { status: 400 }
        );
      }
      const resType = fileRes.headers.get('content-type');
      if (resType) mimeType = resType;
      fileName = String(fileUrl).split('/').pop() || '';
      buffer = Buffer.from(await fileRes.arrayBuffer());
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const typeParam = formData.get('type') as string | null;
      const forceAiParam = formData.get('forceAi') as string | null;
      if (typeParam) importType = typeParam;
      if (forceAiParam === 'true') forceAi = true;

      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
      }
      if (file.type) mimeType = file.type;
      fileName = file.name || '';
      buffer = Buffer.from(await file.arrayBuffer());
    }

    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const lowerName = fileName.toLowerCase();
    const isXmlFile =
      importType === 'nfse_xml' ||
      importType === 'esocial_xml' ||
      lowerName.endsWith('.xml') ||
      mimeType.includes('xml');

    // ─── CAMADA 1A: PARSER DETERMINÍSTICO XML (NFS-e & eSocial S-1200) (< 20ms, custo zero) ───
    if (isXmlFile) {
      const xmlText = buffer.toString('utf8');
      const detectedXml =
        importType === 'nfse_xml'
          ? 'nfse'
          : importType === 'esocial_xml'
            ? 'esocial_s1200'
            : detectXmlDocumentType(xmlText);

      if (detectedXml === 'nfse') {
        const parsed = parseNfseXml(xmlText);
        if (!parsed.matched) {
          return NextResponse.json(
            { error: parsed.reason || 'XML de NFS-e não reconhecido.' },
            { status: 422 }
          );
        }
        return NextResponse.json({
          competencia: parsed.competencia,
          empresa: parsed.empresa,
          nfseRecords: parsed.records,
          records: parsed.records,
          engine: 'deterministic_xml_nfse',
          fileHash,
          durationMs: Date.now() - startedAt,
        });
      }

      if (detectedXml === 'esocial_s1200') {
        const parsed = parseEsocialS1200Xml(xmlText);
        if (!parsed.matched) {
          return NextResponse.json(
            { error: parsed.reason || 'XML eSocial S-1200 não reconhecido.' },
            { status: 422 }
          );
        }
        return NextResponse.json({
          competencia: parsed.competencia,
          empresa: parsed.empresa,
          records: parsed.records,
          engine: 'deterministic_xml_esocial',
          fileHash,
          durationMs: Date.now() - startedAt,
        });
      }

      return NextResponse.json(
        { error: 'Arquivo XML não identificado como NFS-e (ABRASF/Nacional) nem eSocial S-1200.' },
        { status: 422 }
      );
    }

    // ─── CAMADA 1B: PARSER DETERMINÍSTICO DE PDF VETORIAL (< 50ms, custo zero) ───
    let deterministicFallbackReason = '';
    const isPdfFile = !mimeType.includes('image') && (mimeType.includes('pdf') || lowerName.endsWith('.pdf'));

    if (!forceAi && isPdfFile && (importType === 'payroll' || importType === 'benefits')) {
      try {
        const parsedPdf = await pdfParse(buffer);
        const extractedText = String(parsedPdf?.text || '');

        if (importType === 'payroll') {
          const detPayroll = parseDominioPayrollText(extractedText);
          if (detPayroll.matched && detPayroll.records.length > 0) {
            return NextResponse.json({
              competencia: detPayroll.competencia,
              empresa: detPayroll.empresa,
              records: detPayroll.records,
              engine: 'deterministic_pdf',
              fileHash,
              durationMs: Date.now() - startedAt,
              totalCheck: detPayroll.totalCheck,
            });
          }
          deterministicFallbackReason = detPayroll.reason || 'Layout não determinístico.';
        } else if (importType === 'benefits') {
          const detBenefits = parseBenefitsPdfText(extractedText);
          if (detBenefits.matched && detBenefits.records.length > 0) {
            return NextResponse.json({
              competencia: detBenefits.competencia,
              empresa: detBenefits.empresa,
              records: detBenefits.records,
              engine: 'deterministic_pdf',
              fileHash,
              durationMs: Date.now() - startedAt,
              totalCheck: detBenefits.totalCheck,
            });
          }
          deterministicFallbackReason = detBenefits.reason || 'Layout de benefícios não determinístico.';
        }
      } catch (pdfErr) {
        deterministicFallbackReason = `Fallback pdf-parse: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`;
      }
    }

    // ─── CAMADA 2: @google/genai (Gemini 2.5 Flash + responseSchema estrito + temperature: 0) ───
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'A chave GEMINI_API_KEY não está configurada no servidor.' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { prompt, schema } = buildPromptForMode(importType);
    const base64Data = buffer.toString('base64');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType.includes('image') ? mimeType : 'application/pdf',
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    const textResponse = response.text || '';

    try {
      const parsedData = JSON.parse(textResponse);
      const detectedEmpresa = normalizeDetectedCompany(parsedData.empresa);

      // ─── CAMADA 3: SANITIZAÇÃO CONTÁBIL DETERMINÍSTICA PÓS-IA ───
      if (importType === 'payroll' && Array.isArray(parsedData.records)) {
        parsedData.records = sanitizeParsedPayrollRecords(parsedData.records, 'payroll', detectedEmpresa);
      } else if (Array.isArray(parsedData.records)) {
        // Garante auto-cura de adiantamento caso venha em outros modos
        for (const rec of parsedData.records) {
          if (rec && rec.desconto_adiantamento_folha !== undefined && rec.valor_adiantamento === undefined) {
            rec.valor_adiantamento = Number(rec.desconto_adiantamento_folha || 0);
          }
        }
      }

      if (detectedEmpresa) {
        parsedData.empresa = detectedEmpresa;
      }

      return NextResponse.json({
        ...parsedData,
        engine: 'gemini_structured',
        fileHash,
        durationMs: Date.now() - startedAt,
        deterministicFallbackReason: deterministicFallbackReason || undefined,
      });
    } catch {
      return NextResponse.json(
        {
          rawText: textResponse,
          error: 'A IA não retornou um JSON de lote perfeitamente válido.',
        },
        { status: 422 }
      );
    }
  } catch (error: unknown) {
    console.error('Erro ao processar folha de pagamento em lote:', error);
    return NextResponse.json(
      { error: 'Erro interno durante o processamento do lote da folha.' },
      { status: 500 }
    );
  }
}
