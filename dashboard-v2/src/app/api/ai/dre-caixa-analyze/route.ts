import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      summary,
      despesasPorSetor,
      despesasPorCategoria,
      topFornecedores,
      maioresAtrasos,
      empresa,
      periodo
    } = body;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        analysis: "A chave de API do Gemini (GEMINI_API_KEY) não está configurada no ambiente. Configure-a para habilitar o parecer inteligente do CFO Virtual.",
        alerts: []
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const prompt = `
Você é o "BrisinhAI", o CFO Virtual executivo e consultor financeiro de alta gestão do grupo empresarial (Mar Brasil, DZM, G2, Conectius).
A diretoria está reunida agora e você deve emitir um PARECER EXECUTIVO ESTRATÉGICO sobre o Regime de Caixa (valores efetivamente liquidados e compensados no banco).

DADOS DO CONTEXTO:
- Empresa: ${empresa || 'Consolidado'}
- Período Analisado: ${periodo || 'Mês em Foco'}

INDICADORES CHAVE DE CAIXA (KPIs):
- Total Recebido (Entradas Reais): ${formatBRL(summary?.totalRecebido)}
- Total Pago (Desembolsos Efetivos): ${formatBRL(summary?.totalPago)}
- Resultado Líquido de Caixa: ${formatBRL(summary?.resultadoLiquido)} (${(summary?.resultadoLiquido || 0) >= 0 ? 'Superávit / Caixa Positivo' : 'Déficit / Caixa Negativo'})
- Média Mensal de Despesas: ${formatBRL(summary?.mediaMensalDespesas)}
- Maior Centro de Custo / Setor: ${summary?.maiorSetor?.nome} (${formatBRL(summary?.maiorSetor?.valor)})
- Taxa de Pontualidade de Recebimentos: ${(summary?.taxaPontualidadeRecebimentos || 100).toFixed(1)}% em dia
- Taxa de Pontualidade de Pagamentos: ${(summary?.taxaPontualidadePagamentos || 100).toFixed(1)}% em dia
- Prazo Médio de Atraso na Carteira: ${(summary?.mediaDiasAtraso || 0)} dias
- Conciliação Bancária: ${summary?.percentualConciliado || 100}% dos lançamentos conciliados com extrato

TOP 5 SETORES / CONTRATOS COM MAIORES DESEMBOLSOS:
${(despesasPorSetor || []).slice(0, 5).map((s: any) => `- ${s.setor}: ${formatBRL(s.valor)} (${(s.percentual || 0).toFixed(1)}%)`).join('\n')}

TOP 5 CATEGORIAS DE DESPESA:
${(despesasPorCategoria || []).slice(0, 5).map((c: any) => `- ${c.categoria}: ${formatBRL(c.valor)} (${(c.percentual || 0).toFixed(1)}%)`).join('\n')}

TOP 5 MAIORES FORNECEDORES / CREDORES:
${(topFornecedores || []).slice(0, 5).map((f: any) => `- ${f.fornecedor}: ${formatBRL(f.valor)} (${(f.percentual || 0).toFixed(1)}%)`).join('\n')}

CASOS DE MAIOR ATRASO OBSERVADOS:
${(maioresAtrasos || []).slice(0, 4).map((a: any) => `- ${a.favorecido}: ${formatBRL(a.valor)} com ${a.dias_atraso} dias de atraso (Doc: ${a.doc || 'N/D'})`).join('\n') || '- Nenhum atraso expressivo no período.'}

DIRETRIZES DE RESPOSTA:
1. Comece com um DIAGNÓSTICO EXECUTIVO DE LIQUIDEZ E RESULTADO DE CAIXA (2 parágrafos concisos e objetivos).
2. APONTE OS MAIORES DESVIOS E CONCENTRAÇÕES DE RISCO (quais categorias, contratos ou fornecedores estão pressionando a liquidez).
3. AVALIE A PONTUALIDADE E AGING (comente se os clientes públicos ou privados estão atrasando os recebimentos e como isso impacta o capital de giro).
4. FORNEÇA 3 PERGUNTAS PROVÁVEIS DA DIRETORIA E SUAS RESPECTIVAS RESPOSTAS ESTRATÉGICAS (para que o gestor possa responder com firmeza sem precisar consultar o ERP).

Seja elegante, pragmático, use linguagem executiva de negócios (C-Level). Não use introduções vazias como "Olá". Vá direto ao parecer.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({
      analysis: text,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[API dre-caixa-analyze] Erro ao consultar IA:', error);
    return NextResponse.json(
      { error: 'Falha ao processar análise inteligente.', details: error.message },
      { status: 500 }
    );
  }
}
