/**
 * API Route: /api/seguros/ocr
 * Leitura de PDF/Imagem de apólice de seguro via Gemini API (Vision)
 * Extrai campos estruturados e retorna JSON para preenchimento automático do formulário
 * @version v.02.48.97
 */

import { NextRequest, NextResponse } from 'next/server';
import { InsuranceOCRResult } from '@/types/insurance';

import { GoogleGenerativeAI } from '@google/generative-ai';

// Modelos em ordem de prioridade para a cascata — compatíveis com generateContent
const MODEL_CASCADE = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-002',
  'gemini-1.5-pro-002',
  'gemini-1.5-flash-001',
  'gemini-1.5-pro-001',
  'gemini-1.0-pro',
  'gemini-1.0-pro-latest',
  'gemini-pro'
];

const OCR_PROMPT = `Você é um especialista em análise de apólices de seguro. Analise o documento enviado (pode ser PDF, imagem ou scan de apólice) e extraia os seguintes dados em formato JSON.

Retorne APENAS o JSON, sem texto adicional, seguindo exatamente esta estrutura:
{
  "contratante": "nome da empresa contratante (ex: Mar Brasil, DZM)",
  "tipo": "tipo do seguro (ex: Automóvel, Saúde, Responsabilidade Civil, Vida, Patrimonial, Residencial, Transporte)",
  "segurado": "nome da pessoa ou bem segurado",
  "seguradora": "nome da seguradora (ex: Porto Seguro, Bradesco, Allianz, SulAmérica)",
  "apolice": "número da apólice exato",
  "senha": "senha de acesso ao portal da seguradora, se houver",
  "assistencia_24h": "telefone de assistência 24 horas",
  "inicio": "data de início da vigência no formato YYYY-MM-DD",
  "vencimento": "data de vencimento/fim da vigência no formato YYYY-MM-DD",
  "premio": número total do prêmio em reais (apenas número, sem R$),
  "parcelas_total": número inteiro de parcelas,
  "valor_parcela": valor em reais de cada parcela (apenas número),
  "dia_pgto": "dia do mês de pagamento",
  "formato_parcelas": "como são pagas: Anual, Mensal, Semestral, Recorrente, etc.",
  "corretor": "nome completo do corretor",
  "telefone_corretor": "telefone/WhatsApp do corretor com DDD",
  "email_corretor": "e-mail do corretor",
  "indicador": "quem indicou o corretor ou o seguro, se mencionado",
  "franquia": número do valor da franquia em reais (apenas número, sem R$),
  "franquia_reduzida": true se a franquia for reduzida ou false caso contrário (booleano),
  "cobertura_vidros": true se possuir cobertura para vidros ou false caso contrário (booleano),
  "cobertura_lanternas": true se possuir cobertura para lanternas ou false caso contrário (booleano),
  "cobertura_farois": true se possuir cobertura para faróis ou false caso contrário (booleano),
  "coberturas_adicionais": "detalhes de outras coberturas adicionais ou observações do plano",
  "observacoes": "informações relevantes não cobertas pelos campos acima",
  "confianca": "alta | media | baixa",
  "camposNaoEncontrados": ["lista", "de", "campos", "que", "não", "foram", "encontrados", "no", "documento"]
}

Regras:
- Se não encontrar um campo, coloque null (não invente)
- Para valores monetários, retorne apenas o número (ex: 1250.50)
- Para datas, use sempre o formato YYYY-MM-DD
- O campo "confianca" avalia a qualidade geral da leitura
- "camposNaoEncontrados" lista apenas os campos importantes que faltaram`;

import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.Gemini_API_Key ||
      process.env.gemini_api_key;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave de API do Gemini não configurada no servidor (Vercel).' },
        { status: 500 }
      );
    }

    let base64Data = '';
    let mimeType = 'application/pdf';
    
    // Tenta ler o body como JSON (upload via Supabase Storage, que previne corrupção de arquivo e bypassa limites)
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { fileUrl } = body;

      if (!fileUrl) {
        return NextResponse.json({ error: 'Nenhum fileUrl informado.' }, { status: 400 });
      }

      // Download do arquivo do storage do Supabase
      // Se a URL for completa (ex: signedUrl do contracts), extraímos o path relativo para baixar
      let storagePath = fileUrl;
      if (fileUrl.includes('/object/sign/')) {
        // Extrai o caminho relativo do storage após o nome do bucket 'contracts/'
        const match = fileUrl.match(/\/contracts\/([^?]+)/);
        if (match && match[1]) {
          storagePath = decodeURIComponent(match[1]);
        }
      }

      console.log(`[OCR Seguros] Baixando arquivo do Supabase Storage: ${storagePath}`);
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('contracts')
        .download(storagePath);

      if (downloadError || !fileData) {
        console.error('[OCR Seguros] Erro ao baixar do Supabase:', downloadError);
        return NextResponse.json(
          { error: 'Falha ao processar o arquivo da apólice no armazenamento.' },
          { status: 500 }
        );
      }

      const bytes = await fileData.arrayBuffer();
      const buffer = Buffer.from(bytes);
      base64Data = buffer.toString('base64');
      mimeType = fileData.type || 'application/pdf';
      if (mimeType === 'application/octet-stream') {
        if (fileUrl.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
        else if (fileUrl.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        else mimeType = 'image/jpeg';
      }
    } else {
      // Fallback para FormData (caso legado)
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
      }

      // Valida tipo de arquivo
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: 'Tipo de arquivo não suportado. Use PDF, JPEG, PNG ou WebP.' },
          { status: 400 }
        );
      }

      // Limite de 10MB
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Arquivo muito grande. Máximo: 10MB.' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Data = buffer.toString('base64');
      mimeType = file.type;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    let rawText = '';
    let usedModel = '';
    let allErrors: string[] = [];

    // Executa a cascata de modelos para tolerar indisponibilidades ou deprecations
    for (const modelName of MODEL_CASCADE) {
      try {
        console.log(`[OCR Seguros] Tentando modelo: ${modelName}`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          }
        });

        const result = await model.generateContent([
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          OCR_PROMPT
        ]);

        const text = result.response.text();
        if (text) {
          rawText = text;
          usedModel = modelName;
          console.log(`[OCR Seguros] Sucesso com o modelo: ${modelName}`);
          break;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        allErrors.push(`[${modelName}] ${errorMsg}`);
        console.warn(`[OCR Seguros] Falha no modelo ${modelName}: ${errorMsg}`);
      }
    }

    if (!rawText) {
      return NextResponse.json(
        { error: `Não foi possível conectar a nenhum modelo do Gemini. Erros encontrados:\n${allErrors.slice(0, 3).join('\n')}` },
        { status: 502 }
      );
    }

    let result: InsuranceOCRResult;
    try {
      // Tenta parsear JSON diretamente
      result = JSON.parse(rawText);
    } catch {
      // Gemini às vezes retorna JSON dentro de markdown ```json ... ```
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1]);
      } else {
        console.error('[OCR] Falha ao parsear JSON:', rawText);
        return NextResponse.json(
          { error: 'Não foi possível interpretar a resposta da IA. Tente com outro arquivo.' },
          { status: 422 }
        );
      }
    }

    // Normalização e limpeza inteligente dos valores extraídos
    if (result) {
      result.premio = parseNumber(result.premio);
      result.franquia = parseNumber(result.franquia);
      result.valor_parcela = parseNumber(result.valor_parcela);
      result.parcelas_total = parseInteger(result.parcelas_total);

      // Autocompleta valor_parcela se tivermos premio e parcelas_total
      if (result.premio && result.parcelas_total && !result.valor_parcela) {
        result.valor_parcela = Math.round((result.premio / result.parcelas_total) * 100) / 100;
      }

      // Converte booleanos de franquia e coberturas
      result.franquia_reduzida = result.franquia_reduzida === true || String(result.franquia_reduzida).toLowerCase() === 'true';
      result.cobertura_vidros = result.cobertura_vidros === true || String(result.cobertura_vidros).toLowerCase() === 'true';
      result.cobertura_lanternas = result.cobertura_lanternas === true || String(result.cobertura_lanternas).toLowerCase() === 'true';
      result.cobertura_farois = result.cobertura_farois === true || String(result.cobertura_farois).toLowerCase() === 'true';
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[OCR] Erro interno:', error.message);
    return NextResponse.json(
      { error: 'Erro interno ao processar o arquivo.' },
      { status: 500 }
    );
  }
}


// ──────────────────────────────────────────────────────────
// AUXILIARY PARSING HELPERS
// ──────────────────────────────────────────────────────────

function parseNumber(val: any): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    let clean = val.replace(/R\$/gi, '').replace(/\s/g, '');
    
    // Se tiver vírgula e ponto, ex: 1.250,00 ou 1,250.00
    if (clean.includes(',') && clean.includes('.')) {
      if (clean.indexOf(',') > clean.indexOf('.')) {
        // Formato brasileiro: 1.250,00
        clean = clean.replace(/\./g, '').replace(/,/g, '.');
      } else {
        // Formato americano: 1,250.00
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
      // Apenas vírgula: ex: 1250,00 ou 1,250 (se for milhar)
      const parts = clean.split(',');
      if (parts[1] && parts[1].length === 2) {
        clean = clean.replace(/,/g, '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    }
    const num = parseFloat(clean);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

function parseInteger(val: any): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return Math.round(val);
  if (typeof val === 'string') {
    const clean = val.replace(/\D/g, '');
    const num = parseInt(clean, 10);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}
