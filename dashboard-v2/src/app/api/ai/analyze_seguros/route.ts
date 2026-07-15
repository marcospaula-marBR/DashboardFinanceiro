import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { kpis, policies, filtros } = body;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        analysis: 'A chave de API do Gemini não está configurada no servidor (Vercel). Por favor, configure a variável GEMINI_API_KEY.',
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const formatBRL = (val: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Montar lista das apólices urgentes
    const urgentes = (policies || [])
      .filter((p: any) => p.statusVencimento === 'urgente' || p.statusVencimento === 'vencido')
      .map((p: any) => `- ${p.tipo} (${p.segurado || p.contratante}) — vence em ${p.diasParaVencer ?? '?'} dia(s) pela seguradora ${p.seguradora || 'N/I'}`)
      .join('\n');

    // Montar breakdown por tipo
    const porTipo = Object.entries(kpis.porTipo || {})
      .map(([tipo, qtd]) => `- ${tipo}: ${qtd} apólice(s)`)
      .join('\n');

    const prompt = `
Você é o "BrisinhAI", um Gerente de Riscos e Facilities virtual experiente e pragmático do Grupo Mar Brasil.
Escreva uma análise executiva de gestão de seguros em 2 a 3 parágrafos.
Seja direto e profissional. Não use saudações. Foque em:
1) Avaliar o custo anual de seguros em relação ao portfólio de apólices
2) Alertar sobre as apólices mais urgentes de renovação
3) Fazer uma recomendação final sobre a gestão de risco (ex: cobertura, renovação, diversificação de seguradoras)

Contexto dos Filtros Aplicados:
${filtros || 'Todas as empresas e todos os tipos de seguro.'}

Dados do Portfólio de Seguros:
- Total de Apólices: ${kpis.totalApólices}
- Apólices Ativas: ${kpis.apólicesAtivas}
- Prêmio Mensal Total (Custo Mensal): ${formatBRL(kpis.premioMensalTotal)}
- Prêmio Anual Total (Custo Anual): ${formatBRL(kpis.premioAnualTotal)}
- Apólices vencendo em até 7 dias: ${kpis.vencendoEm7Dias?.length ?? 0}
- Apólices vencendo em até 30 dias: ${kpis.vencendoEm30Dias?.length ?? 0}

Apólices Críticas (urgentes ou vencidas):
${urgentes || 'Nenhuma apólice crítica no momento.'}

Distribuição por Tipo:
${porTipo || 'Não disponível.'}

Gere a análise executiva em texto corrido, sem usar Markdown pesado (apenas texto puro, pois será incluído em uma apresentação formal).
Responda estritamente em PORTUGUÊS DO BRASIL.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ analysis: text });
  } catch (error: any) {
    console.error('Erro na API BrisinhAI/Seguros:', error);
    return NextResponse.json(
      { error: 'Falha na comunicação com a Inteligência Artificial.' },
      { status: 500 }
    );
  }
}
