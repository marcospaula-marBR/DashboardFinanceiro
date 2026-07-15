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

    // Extrair dados do corpo da requisição
    const { markdownReport } = body;

    const promptText = `
Aja como um analista financeiro (CFO) e crie slides profissionais, limpos e direto ao ponto. 
Use a paleta de cores neutra (tons de cinza e laranja/âmbar, evite cores espalhafatosas).
Seções recomendadas:
1. Resumo Executivo
2. Desempenho de Receitas
3. Análise de Custos e Despesas
4. Lucratividade e Fluxo de Caixa Livre
5. Conclusões.

Abaixo estão os dados financeiros do período e os filtros aplicados. Crie a apresentação baseada EXCLUSIVAMENTE nestes dados reais (não invente números):

${markdownReport}
`;

    // Chamada para a API do Gamma
    const response = await fetch('https://public-api.gamma.app/v1.0/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': GAMMA_API_KEY,
      },
      body: JSON.stringify({
        inputText: promptText,
        textMode: 'generate'
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro na API do Gamma:', errorData);
      return NextResponse.json({ error: `Gamma API Error: ${errorData}` }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json(data);
    
  } catch (error: unknown) {
    console.error('Erro na rota /api/gamma/generate:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
