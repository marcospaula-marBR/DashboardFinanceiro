import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: { message: "A chave de API do Gemini não está configurada no servidor (Vercel). Por favor, configure a variável GEMINI_API_KEY nas configurações do projeto no Vercel." } },
        { status: 500 }
      );
    }

    if (!prompt) {
      return NextResponse.json({ error: { message: "Prompt não fornecido." } }, { status: 400 });
    }

    // Chamada direta à API REST do Gemini - Mais leve, rápida e estável em ambientes serverless (Vercel)
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDesc = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDesc = errorJson.error?.message || errorText;
      } catch {
        // Fallback
      }
      return NextResponse.json(
        { error: { message: `Erro na API do Gemini: ${errorDesc}` } },
        { status: response.status }
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      const candidate = data?.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== "STOP") {
        return NextResponse.json({
          candidates: [{ content: { parts: [{ text: `⚠️ A resposta foi interrompida ou bloqueada pela IA. Motivo: ${candidate.finishReason}` }] } }]
        });
      }
    }

    // Mantém compatibilidade com o formato esperado pelo ai.service.v2.js
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
    console.error("Erro na API de Chat (BrisinhAI):", error);
    return NextResponse.json(
      { error: { message: error.message || "Falha na comunicação com a Inteligência Artificial." } },
      { status: 500 }
    );
  }
}
