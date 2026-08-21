import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Modelos em ordem de prioridade
const MODEL_CASCADE = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-pro'
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workstations, misallocatedEmployees, metrics, customPrompt } = body;

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.Gemini_API_Key ||
      process.env.gemini_api_key;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'A chave de API do Gemini (Google AI Studio) não está configurada no servidor (Vercel). Configure a variável GEMINI_API_KEY no painel do Vercel.',
        },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const systemContext = `
Você é o Chief People Officer & Especialista em Logística Operacional e Geografia Corporativa do Grupo Mar Brasil (empresas: Mar Brasil, DZM, G2, Ybox, Conectius, Usatell).
Sua missão é fornecer um Parecer Executivo de Alto Nível analisando a distribuição geográfica das moradias dos colaboradores em relação aos postos de trabalho/bases operacionais (Sedes, Galpões, Bases e Terminais).

DADOS DO CENÁRIO ATUAL:
- Total de Colaboradores Mapeados: ${metrics?.totalEmployeesWithAddress || 0}
- Total de Postos/Bases Cadastradas: ${workstations?.length || 0}
- Colaboradores com Oportunidade de Remanejamento: ${metrics?.misallocatedCount || 0}
- Economia Total Estimada por Trajeto: ${metrics?.potentialKmSaved || 0} km

BASES / POSTOS DISPONÍVEIS:
${(workstations || []).map((w: any) => `- ${w.name} (${w.neighborhood}, ${w.city}) | Vagas: ${w.capacity || 'N/A'}`).join('\n')}

LISTA DE COLABORADORES COM OPORTUNIDADE DE OTIMIZAÇÃO (Moram mais perto de outra base):
${(misallocatedEmployees || []).slice(0, 40).map((e: any, idx: number) => `${idx + 1}. ${e.name} (${e.job_role || 'Colaborador'}, ${e.linkType})
   - Moradia: ${e.neighborhood || 'Bairro'}, ${e.city || 'Cidade'}
   - Posto Atual: ${e.assigned_workstation?.name || e.current_service_location || 'Não definido'} (${e.distance_to_current_workstation_km || '?'} km)
   - Posto Sugerido (Mais Próximo): ${e.potential_optimization?.better_workstation?.name || e.nearest_workstation?.workstation?.name} (${e.nearest_workstation?.distance_km || '?'} km)
   - Economia por trajeto: ${e.potential_optimization?.saved_distance_km || '?'} km
`).join('\n')}

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO EXECUTIVO (formate em Markdown elegante com emojis, títulos claros, métricas e tabelas):
1. 🎯 **Sumário Executivo & Diagnóstico Geral**: Panorama da alocação atual e impacto da dispersão geográfica.
2. 💰 **Impacto Financeiro & Operacional**: Projeção de economia com Vale-Transporte, combustível e ganhos em qualidade de vida/produtividade (tempo de trânsito reduzido).
3. 🔄 **Plano de Remanejamento Sugerido**: Agrupamento por Base/Posto de Destino com os colaboradores prioritários recomendados para troca.
4. ⚖️ **Análise de Lotação das Bases**: Avaliação do impacto na capacidade física das unidades.
5. 🚀 **Recomendações e Próximos Passos para o RH e Diretoria**: Ações práticas e graduais de transição.

${customPrompt ? `CONSIDERAÇÃO ESPECÍFICA DO USUÁRIO: ${customPrompt}` : ''}
`;

    let report = '';
    let lastError = null;

    for (const modelName of MODEL_CASCADE) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(systemContext);
        const response = await result.response;
        report = response.text();
        if (report) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[RouteAdvisor] Falha no modelo ${modelName}:`, err.message);
      }
    }

    if (!report) {
      throw lastError || new Error('Não foi possível gerar a análise com o Gemini.');
    }

    return NextResponse.json({ report });
  } catch (error: any) {
    console.error('[RouteAdvisor Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar análise do Gemini Route Advisor' },
      { status: 500 }
    );
  }
}
