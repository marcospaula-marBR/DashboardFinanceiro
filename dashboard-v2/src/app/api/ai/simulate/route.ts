import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      questionId,
      questionLabel,
      scenarioType,
      originalKpis,
      simulatedKpis,
      empresa,
      periodo,
      targetDepartamento,
      rescisaoDate,
      impactMode,
      impactValue,
      recoveryData,
    } = body;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        analysis: 'A chave de API do Gemini não está configurada no servidor. Configure a variável GEMINI_API_KEY.',
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const fmt = (v: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    const fmtPct = (v: number) => `${v.toFixed(1)}%`;

    const deltaReceita = simulatedKpis.totalEntradas - originalKpis.totalEntradas;
    const deltaFcl = simulatedKpis.fcl - originalKpis.fcl;
    const deltaCustos = simulatedKpis.totalCustos - originalKpis.totalCustos;
    const deltaDespesas = simulatedKpis.totalDespesas - originalKpis.totalDespesas;

    const scenarioLabels: Record<string, string> = {
      revenue_increase: 'Aumento de Receita',
      revenue_decrease: 'Queda de Receita',
      costs_cut: 'Corte de Custos Operacionais',
      expenses_cut: 'Redução de Despesas Rateadas',
      contract_loss: 'Perda de Contrato/Departamento',
      goal_seek: 'Busca de Meta (FCL Target)',
      custom: 'Cenário Personalizado',
    };

    let recoverySection = '';
    if (scenarioType === 'contract_loss' && recoveryData && recoveryData.length > 0) {
      recoverySection = `
Cronograma de Reposição de Receita (${recoveryData.length} meses até recomposição):
- Meta mensal de reposição: ${fmt(recoveryData[0]?.metaMensal || 0)}
- Primeiro mês: ${recoveryData[0]?.mes} | A reconquistar: ${fmt(recoveryData[0]?.aReconquistar || 0)}
- Último mês projetado: ${recoveryData[recoveryData.length - 1]?.mes} | Acumulado: ${fmtPct(recoveryData[recoveryData.length - 1]?.percAcumulado || 0)}
`;
    }

    const prompt = `
Você é o "BrisinhAI", um CFO virtual experiente e pragmático da empresa ${empresa}.
Responda APENAS à pergunta específica abaixo, com base no cenário financeiro simulado. 
Seja direto, profissional (2 a 3 parágrafos no máximo). Sem saudações. Sem markdown.

PERGUNTA DO USUÁRIO: "${questionLabel}"

CONTEXTO DO CENÁRIO SIMULADO:
- Tipo de Cenário: ${scenarioLabels[scenarioType] || scenarioType}
- Empresa: ${empresa} | Período de Referência: ${periodo}
${targetDepartamento ? `- Departamento/Contrato Impactado: ${targetDepartamento}` : ''}
${rescisaoDate ? `- Data de Rescisão/Impacto Projetada: ${rescisaoDate}` : ''}
${impactMode === 'percent' ? `- Impacto Aplicado: ${impactValue > 0 ? '+' : ''}${impactValue}%` : `- Impacto Aplicado: ${fmt(impactValue)}`}

COMPARATIVO ORIGINAL vs SIMULADO:
Receita Total:      ${fmt(originalKpis.totalEntradas)}  →  ${fmt(simulatedKpis.totalEntradas)}  (${deltaReceita >= 0 ? '+' : ''}${fmt(deltaReceita)})
Custos Operac.:     ${fmt(originalKpis.totalCustos)}    →  ${fmt(simulatedKpis.totalCustos)}    (${deltaCustos >= 0 ? '+' : ''}${fmt(deltaCustos)})
Despesas Rateadas:  ${fmt(originalKpis.totalDespesas)}  →  ${fmt(simulatedKpis.totalDespesas)}  (${deltaDespesas >= 0 ? '+' : ''}${fmt(deltaDespesas)})
FCL (Fluxo Caixa):  ${fmt(originalKpis.fcl)}            →  ${fmt(simulatedKpis.fcl)}            (${deltaFcl >= 0 ? '+' : ''}${fmt(deltaFcl)})
Margem FCL:         ${fmtPct(originalKpis.percFcl)}     →  ${fmtPct(simulatedKpis.percFcl)}
${recoverySection}
Responda à pergunta "${questionLabel}" com base exclusivamente neste cenário. Seja objetivo e forneça insight acionável.
    `.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ analysis: text });
  } catch (error: any) {
    console.error('Erro na API BrisinhAI Simulate:', error);
    return NextResponse.json(
      { error: 'Falha na comunicação com a Inteligência Artificial.' },
      { status: 500 }
    );
  }
}
