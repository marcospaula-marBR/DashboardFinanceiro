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

    // Extrair dados do corpo da requisição (suporta markdownReport ou markdown)
    const markdownReport = body.markdownReport || body.markdown || body.text || '';

    const promptText = `
Aja como um conversor estrito de documentos em apresentações visuais executivas (C-level).
Gere uma apresentação estritamente em PORTUGUÊS DO BRASIL.
Utilize APENAS o modelo e o conteúdo fornecidos no documento Markdown abaixo.
NÃO adicione análises próprias, não faça inferências extras, não invente dados e NÃO crie slides de análise executiva própria.
Preserve todos os dados numéricos, nomes de empresas, filtros, valores de cada KPI e explicações exatamente como constam no documento.

Se o documento incluir uma seção "Análise Executiva (Por BrisinhAI)", inclua essa seção integralmente. Se NÃO incluir essa seção, NÃO adicione qualquer análise executiva extra.

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
        textMode: 'preserve'
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
