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
Aja como um gerador de relatórios executivos de alto nível (C-level).
Gere uma apresentação estritamente em PORTUGUÊS DO BRASIL.
Utilize o modelo padrão fornecido no documento Markdown abaixo, mantendo todos os dados numéricos, os nomes das empresas, os filtros exatos, os valores de cada KPI, bem como suas respectivas explicações breves e parâmetros aceitáveis. 
NÃO invente, não altere dados e não alucine gráficos que não estejam descritos nos dados reais. Apenas exponha de forma limpa e direta.

Se o documento incluir uma seção "Análise Executiva (Por BrisinhAI)", garanta que ela seja incluída integralmente como um slide ou conjunto de slides na sua apresentação final. Preserve os comentários e o feedback.

Se houver logomarcas (tags <img src=...>), tente posicioná-las adequadamente na capa ou rodapé da apresentação.

Abaixo estão os dados corporativos estruturados do período analisado:

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
