import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Modelos em ordem de prioridade (mais moderno → mais antigo)
const MODEL_CASCADE = [
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.0-pro',
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt } = body;

    // Suporte a variações de maiúsculas/minúsculas da variável de ambiente
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.Gemini_API_Key ||
      process.env.gemini_api_key;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: {
            message:
              'A chave de API do Gemini não está configurada no servidor (Vercel). Por favor, configure a variável GEMINI_API_KEY nas configurações do projeto no Vercel.',
          },
        },
        { status: 500 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: { message: 'Prompt não fornecido.' } },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const maskedKey = `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 6)}`;

    let lastError = '';
    let responseText = '';
    let usedModel = '';

    for (const modelName of MODEL_CASCADE) {
      try {
        console.log(`[BrisinhAI] Tentando modelo: ${modelName}`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        if (text) {
          responseText = text;
          usedModel = modelName;
          console.log(`[BrisinhAI] Sucesso com modelo: ${modelName}`);
          break;
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        lastError = `[${modelName}] ${msg}`;
        console.warn(`[BrisinhAI] Falha no modelo ${modelName}: ${msg}`);
      }
    }

    if (!responseText) {
      return NextResponse.json(
        {
          error: {
            message: `Não foi possível conectar a nenhum modelo do Gemini (Chave ativa no Vercel: ${maskedKey}). Último erro: ${lastError}`,
          },
        },
        { status: 500 }
      );
    }

    // Mantém o formato esperado pelo ai.service.v2.js no frontend
    return NextResponse.json({
      candidates: [
        {
          content: {
            parts: [{ text: responseText }],
          },
        },
      ],
      _model: usedModel,
    });
  } catch (error: any) {
    console.error('[BrisinhAI] Erro inesperado na API de Chat:', error);
    return NextResponse.json(
      {
        error: {
          message:
            error.message || 'Falha na comunicação com a Inteligência Artificial.',
        },
      },
      { status: 500 }
    );
  }
}
