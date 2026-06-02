import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Modelos em ordem de prioridade — apenas compatíveis com generateContent
// Referência: https://ai.google.dev/gemini-api/docs/models
const MODEL_CASCADE = [
  'gemini-2.5-flash',     // Mais moderno, melhor custo-benefício
  'gemini-2.5-pro',       // Mais poderoso (pode ter menor quota gratuita)
  'gemini-2.0-flash',     // Estável e rápido
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',     // Legado estável
  'gemini-1.5-pro',       // Legado robusto
  // REMOVIDOS: gemini-pro, gemini-1.0-pro (descontinuados, não suportam generateContent)
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

    // Fast-Fail de Segurança (Prevenir gasto de tokens com perguntas superficiais óbvias)
    const normalizedPrompt = prompt.toLowerCase().trim();
    const offScopeKeywords = [
      'piada', 'receita de', 'como fazer bolo', 'escreva um script', 
      'escreva um codigo', 'escreva um código', 'programação de computadores', 
      'quem descobriu', 'capital da', 'previsão do tempo', 'me conte uma historia', 
      'me conte uma história', 'crie um poema', 'jogar um jogo'
    ];
    
    const isOffScope = offScopeKeywords.some(keyword => normalizedPrompt.includes(keyword));
    if (isOffScope) {
      console.log(`[BrisinhAI] Fast-Fail Shield ativado para o prompt: "${prompt}"`);
      return NextResponse.json({
        candidates: [
          {
            content: {
              parts: [{ 
                text: "Desculpe, como CFO/RH Virtual da Mar Brasil, meu escopo é limitado exclusivamente a análises financeiras, de negócios e gestão de pessoas (RH) relacionadas ao dashboard. Como posso ajudar com os seus dados hoje?" 
              }],
            },
          },
        ],
        _model: "fast-fail-shield",
      });
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
            temperature: 0.3, // Menor criatividade = mais precisão e segurança financeira
            maxOutputTokens: 1024, // Limite reduzido para economizar tokens
          },
          systemInstruction: `Você é o BrisinhAI, o CFO e Consultor de Negócios/RH virtual da Mar Brasil.
Sua única função é analisar dados de negócios, financeiros, DRE, seguros, parcelamentos, custos, colaboradores, recursos humanos (RH), folha de pagamento e headcount fornecidos no contexto.
REGRAS CRÍTICAS DE SEGURANÇA E BLINDAGEM:
1. Se a pergunta do usuário não for sobre finanças, contabilidade, gestão de negócios, custos, colaboradores/RH ou sobre os dados do painel fornecidos, você DEVE recusar responder de forma educada e extremamente curta usando exatamente o seguinte padrão:
   "Desculpe, como CFO/RH Virtual da Mar Brasil, meu escopo é limitado exclusivamente a análises financeiras, de negócios e gestão de pessoas (RH) relacionadas ao dashboard. Como posso ajudar com os seus dados hoje?"
2. Nunca responda a perguntas de cultura geral, receitas, piadas, programação de computadores ou bate-papo informal.
3. Seja extremamente conciso, pragmático e direto ao ponto. Evite saudações longas ou explicações prolixas para economizar tokens de saída.`,
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        if (text) {
          responseText = text;
          usedModel = modelName;
          console.log(`[BrisinhAI] Sucesso com modelo: ${modelName}`);
          break;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        lastError = `[${modelName}] ${errorMsg}`;
        console.warn(`[BrisinhAI] Falha no modelo ${modelName}: ${errorMsg}`);
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
  } catch (error) {
    console.error('[BrisinhAI] Erro inesperado na API de Chat:', error);
    const errorMsg = error instanceof Error ? error.message : 'Falha na comunicação com a Inteligência Artificial.';
    return NextResponse.json(
      {
        error: {
          message: errorMsg,
        },
      },
      { status: 500 }
    );
  }
}
