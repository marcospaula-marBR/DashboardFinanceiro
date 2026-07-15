/**
 * API Route: /api/seguros/ocr
 * Leitura de PDF/Imagem de apólice de seguro via Gemini API (Vision)
 * Extrai campos estruturados e retorna JSON para preenchimento automático do formulário
 * @version v.02.48.97
 */

import { NextRequest, NextResponse } from 'next/server';
import { InsuranceOCRResult } from '@/types/insurance';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada. Adicione ao .env.local' },
        { status: 500 }
      );
    }

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

    // Converte arquivo para base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type;

    // Monta payload para Gemini API
    const payload = {
      contents: [
        {
          parts: [
            {
              text: OCR_PROMPT,
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,     // Baixa temperatura para respostas mais determinísticas
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    };

    // Chama Gemini API
    const geminiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error('[OCR] Gemini API error:', errorBody);
      return NextResponse.json(
        { error: `Erro na API Gemini: ${geminiResponse.status}` },
        { status: 502 }
      );
    }

    const geminiData = await geminiResponse.json();

    // Extrai texto da resposta
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

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
