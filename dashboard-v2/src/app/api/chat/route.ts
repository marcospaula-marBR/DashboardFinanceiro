import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Modelos em ordem de prioridade — apenas compatíveis com generateContent
// Referência: https://ai.google.dev/gemini-api/docs/models
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

    const systemInstructionText = `Você é o BrisinhAI, o CFO Virtual e Consultor Executivo Corporativo da Mar Brasil.
Sua missão é atuar como copiloto analítico de alta gestão da diretoria e dos gestores em TODOS os módulos do Dashboard:
- DRE e Controladoria (Receitas Operacionais, Custos Diretos, Despesas Estruturais/Rateadas DR_p, Margens, EBITDA, FCL)
- Simulações de Cenários e Precificação (Preço Mínimo, Markup, Perda de Contratos, Variações por Rubricas, Recomposição de Margem)
- Gestão de Pessoas / RH / People (Headcount, Folha de Pagamento, CLT vs PJ, Bonificações, BPR)
- Conciliação Clara & Cartões Corporativos (Despesas de cartões, faturas, categorias Omie, centros de custo, auditoria fiscal/OCR)
- Fluxo de Caixa, Faturamento & Emissão de Notas Fiscais
- Empréstimos, Financiamentos, Dívidas & Parcelamentos
- Gestão de Seguros & Apólices
- Recebíveis & Inadimplência
- Comissões de Vendas & Metas Comerciais

DIRETRIZES DE RESPOSTA EXECUTIVA:
1. Sempre responda a perguntas, diagnósticos, simulações, análises de risco, preocupações e recomendações sobre o painel com pragmatismo, números concretos e visão estratégica de C-level.
2. Quando solicitado análise de simulação ou cenário, estruture a resposta de forma executiva contendo:
   - 📊 Diagnóstico do Cenário
   - ⚠️ Pontos de Preocupação e Riscos Financeiros
   - 💡 Medidas Práticas e Recomendações Acionáveis
3. Use os dados da tela fornecidos no contexto como base factual. Se algum dado específico não estiver presente no contexto, faça a análise com base nas premissas corporativas disponíveis e oriente o gestor.
4. Mantenha o foco estrito em negócios, finanças, controladoria e gestão corporativa. Recuse apenas futilidades completamente alheias à empresa (ex: receitas de comida, piadas, esportes não corporativos, programação genérica de computadores).
5. Seja direto, conciso, profissional, estruturado (use tópicos em negrito) e evite saudações prolixas para otimizar tokens.`;

    let allErrors: string[] = [];
    let responseText = '';
    let usedModel = '';

    for (const modelName of MODEL_CASCADE) {
      try {
        console.log(`[BrisinhAI] Tentando modelo: ${modelName}`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstructionText,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
          }
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
        allErrors.push(`[${modelName}] ${errorMsg}`);
        console.warn(`[BrisinhAI] Falha no modelo ${modelName}: ${errorMsg}`);
      }
    }

    if (!responseText) {
      return NextResponse.json(
        {
          error: {
            message: `Não foi possível conectar a nenhum modelo do Gemini (Chave ativa no Vercel: ${maskedKey}). Erros encontrados:\n${allErrors.slice(0, 3).join('\n')}`,
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
