import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Instanciar o SDK do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: { message: "A chave de API do Gemini não está configurada no servidor (Vercel). Por favor, configure a variável GEMINI_API_KEY." } },
        { status: 500 }
      );
    }

    if (!prompt) {
      return NextResponse.json({ error: { message: "Prompt não fornecido." } }, { status: 400 });
    }

    // Preparar o modelo
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Gerar conteúdo via API do Google
    const result = await model.generateContent(prompt);
    
    // Garantir extração robusta de texto
    let text = "";
    try {
      text = result.response.text();
    } catch (e: any) {
      console.warn("Falha ao extrair texto direto do response.text():", e);
      text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    if (!text) {
      const candidate = result.response.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== "STOP") {
        text = `⚠️ A resposta foi interrompida ou bloqueada pela IA. Motivo de bloqueio: ${candidate.finishReason}`;
      } else {
        text = "Não foi possível obter uma resposta em formato de texto da Inteligência Artificial.";
      }
    }

    // O ai.service.v2.js antigo espera uma resposta no formato da API direta do Google, 
    // ou seja: { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
    return NextResponse.json({
      candidates: [
        {
          content: {
            parts: [{ text: text }]
          }
        }
      ]
    });
    
  } catch (error: any) {
    console.error("Erro na API de Chat (BrisinhAI Legacy):", error);
    return NextResponse.json(
      { error: { message: error.message || "Falha na comunicação com a Inteligência Artificial." } },
      { status: 500 }
    );
  }
}
