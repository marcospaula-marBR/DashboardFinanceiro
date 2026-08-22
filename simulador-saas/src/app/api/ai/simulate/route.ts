import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { companyName, prompt, result } = body;

    const variance = result.variance;
    const sim = result.simulatedKPIs;

    // Resposta executiva simulada de consultor financeiro de PMEs
    const reply = `Análise para ${companyName}: Com base no cenário simulado, seu resultado líquido teve uma variação de R$ ${Math.round(variance.resultadoLiquidoDiff).toLocaleString('pt-BR')} com um Ponto de Equilíbrio de R$ ${Math.round(sim.breakEvenReceitaBruta).toLocaleString('pt-BR')}. ` +
      `Em resposta a "${prompt}": Recomendamos manter uma reserva mínima de 3 a 6 meses de custos fixos em caixa para absorver eventuais oscilações de mercado antes de expandir novos investimentos.`;

    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      { error: 'Falha ao processar análise por IA' },
      { status: 500 }
    );
  }
}
