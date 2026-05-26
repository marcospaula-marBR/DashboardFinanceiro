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

    // Lista de endpoints e modelos para tentar em cascata (Fallback)
    // Isso garante compatibilidade total mesmo se a chave do usuário for antiga ou restrita a certos modelos.
    const endpoints = [
      {
        url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        name: "Gemini 1.5 Flash (v1)"
      },
      {
        url: `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`,
        name: "Gemini Pro 1.0 (v1)"
      },
      {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        name: "Gemini 1.5 Flash (v1beta)"
      },
      {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        name: "Gemini Pro 1.0 (v1beta)"
      }
    ];

    let lastErrorMsg = "";
    let response = null;
    let selectedEndpointName = "";

    for (const ep of endpoints) {
      try {
        console.log(`Tentando conectar via: ${ep.name}`);
        response = await fetch(ep.url, {
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

        if (response.ok) {
          selectedEndpointName = ep.name;
          break; // Sucesso! Sai do loop de fallback
        } else {
          const errorText = await response.text();
          let errorDesc = errorText;
          try {
            const errorJson = JSON.parse(errorText);
            errorDesc = errorJson.error?.message || errorText;
          } catch {
            // ignore
          }
          lastErrorMsg = `[${ep.name}] ${errorDesc}`;
          console.warn(`Falha no endpoint ${ep.name}: ${errorDesc}`);
          response = null;
        }
      } catch (err: any) {
        lastErrorMsg = `[${ep.name}] ${err.message}`;
        console.warn(`Erro de conexão no endpoint ${ep.name}: ${err.message}`);
        response = null;
      }
    }

    if (!response) {
      const maskedKey = apiKey ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 6)}` : 'Nenhuma';
      return NextResponse.json(
        { error: { message: `Não foi possível conectar a nenhum modelo do Gemini (Chave ativa no Vercel: ${maskedKey}). Último erro: ${lastErrorMsg}` } },
        { status: 500 }
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      const candidate = data?.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== "STOP") {
        return NextResponse.json({
          candidates: [{ content: { parts: [{ text: `⚠️ A resposta foi interrompida pela IA (${selectedEndpointName}). Motivo: ${candidate.finishReason}` }] } }]
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
