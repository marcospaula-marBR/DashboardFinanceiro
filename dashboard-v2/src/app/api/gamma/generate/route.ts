import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Configurações do Gamma
    const GAMMA_API_KEY = process.env.GAMMA_API_KEY;
    
    if (!GAMMA_API_KEY) {
      console.error('GAMMA_API_KEY não configurada no servidor.');
      return NextResponse.json(
        { error: 'Chave de API do Gamma não configurada.' },
        { status: 500 }
      );
    }

    // Extrair dados do corpo da requisição (que será enviado pelo DreExportModal)
    const { 
      empresa, 
      periodo, 
      indicadores, 
      rawData 
    } = body;

    // Construção do Prompt Inteligente baseado nos dados da DRE e Indicadores
    let promptText = `Crie uma apresentação executiva financeira para a empresa ${empresa || 'Mar Brasil'}.
Período de referência: ${periodo || 'Últimos 12 meses'}.

# INDICADORES PRINCIPAIS (KPIs)
`;

    if (indicadores) {
      if (indicadores.receita) promptText += `- Receita Operacional Bruta: ${indicadores.receita}\n`;
      if (indicadores.custos) promptText += `- Custos Operacionais: ${indicadores.custos}\n`;
      if (indicadores.despesas) promptText += `- Despesas Operacionais (Rateadas): ${indicadores.despesas}\n`;
      if (indicadores.lucro) promptText += `- Lucro antes do FCL: ${indicadores.lucro}\n`;
      if (indicadores.fcl) promptText += `- Fluxo de Caixa Livre (FCL): ${indicadores.fcl}\n`;
    }

    promptText += `
Aja como um analista financeiro (CFO) e crie slides profissionais, limpos e direto ao ponto. 
Use a paleta de cores neutra (tons de cinza e laranja/âmbar, evite cores espalhafatosas).
Seções recomendadas:
1. Resumo Executivo
2. Desempenho de Receitas
3. Análise de Custos e Despesas
4. Lucratividade e Fluxo de Caixa Livre
5. Conclusões.
`;

    // Chamada para a API do Gamma
    const response = await fetch('https://public-api.gamma.app/v1.0/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': GAMMA_API_KEY,
      },
      body: JSON.stringify({
        prompt: promptText
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro na API do Gamma:', errorData);
      return NextResponse.json({ error: 'Falha ao comunicar com API do Gamma' }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json(data);
    
  } catch (error: unknown) {
    console.error('Erro na rota /api/gamma/generate:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
