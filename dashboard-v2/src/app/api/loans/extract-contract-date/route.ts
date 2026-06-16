import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { contractUrl } = await req.json();

    if (!contractUrl) {
      return NextResponse.json({ error: 'contractUrl é obrigatório' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chave GEMINI_API_KEY não configurada' }, { status: 500 });
    }

    // 1. Baixar o arquivo do Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('contracts')
      .download(contractUrl);

    if (downloadError || !fileData) {
      console.error('Erro ao baixar arquivo do Supabase:', downloadError);
      return NextResponse.json({ error: 'Falha ao baixar o arquivo do contrato' }, { status: 500 });
    }

    // 2. Converter para base64
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64Data = buffer.toString('base64');
    
    let contentType = fileData.type;
    if (!contentType || contentType === 'application/octet-stream') {
      if (contractUrl.toLowerCase().endsWith('.pdf')) {
        contentType = 'application/pdf';
      } else if (contractUrl.toLowerCase().endsWith('.png')) {
        contentType = 'image/png';
      } else if (contractUrl.toLowerCase().endsWith('.jpg') || contractUrl.toLowerCase().endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      }
    }

    // 3. Preparar chamada ao Gemini
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const prompt = `
Você é uma IA especialista em auditoria financeira de contratos de empréstimos consignados ou mútuos.
Analise o documento do contrato anexado (pode ser PDF ou imagem). Extraia com precisão as seguintes informações:

1. Data de vencimento da primeira parcela/prestação (quando começa o desconto ou pagamento do empréstimo). Geralmente descrita em cláusulas de 'Forma de Pagamento', 'Desconto em Folha', 'Cronograma de Vencimento' ou nas condições específicas. Exemplo: "primeiro desconto em 10/05/2025" ou "vencimento da primeira parcela em 05/2025" (considere o primeiro dia do mês ou o dia do pagamento estipulado).
2. Data de assinatura ou solicitação do contrato.
3. Número total de parcelas pactuadas.
4. Valor total contratado (valor bruto do empréstimo).

Importante: se a data do primeiro pagamento vier apenas como Mês/Ano (ex: 05/2025), converta para o formato AAAA-MM-DD assumindo o dia 1 do mês, ou seja, "2025-05-01", ou o dia de pagamento padrão se houver (ex: dia 10). Se houver uma data de vencimento exata descrita (ex: "10 de Maio de 2025"), use a data exata "2025-05-10".

Retorne obrigatoriamente um objeto JSON estruturado da seguinte forma:
{
  "first_payment_date": "YYYY-MM-DD" ou null se não encontrada ou impossível ler,
  "request_date": "YYYY-MM-DD" ou null se não encontrada ou impossível ler,
  "installments": número inteiro ou null se não encontrado,
  "amount": número decimal ou null se não encontrado,
  "confidence": número decimal entre 0.0 e 1.0 indicando o grau de confiança na extração das datas
}
    `;

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: contentType
      }
    };

    const result = await model.generateContent([filePart, prompt]);
    const responseText = result.response.text();
    
    try {
      const parsed = JSON.parse(responseText.trim());
      return NextResponse.json(parsed);
    } catch (parseErr) {
      console.error('Erro ao fazer parse da resposta do Gemini:', responseText);
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsedFallback = JSON.parse(match[0]);
        return NextResponse.json(parsedFallback);
      }
      throw new Error('Resposta do Gemini não pôde ser parseada como JSON');
    }

  } catch (error: any) {
    console.error('Erro na rota de extração do contrato:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
