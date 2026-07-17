import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'A chave GEMINI_API_KEY não está configurada no servidor.' },
        { status: 500 }
      );
    }

    let base64Data = '';
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const { fileUrl } = await req.json();
      if (!fileUrl) {
        return NextResponse.json({ error: 'Nenhum fileUrl informado.' }, { status: 400 });
      }
      
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) {
        return NextResponse.json(
          { error: `Falha ao baixar o arquivo do storage (${fileRes.status}).` }, 
          { status: 400 }
        );
      }
      
      const bytes = await fileRes.arrayBuffer();
      const buffer = Buffer.from(bytes);
      base64Data = buffer.toString('base64');
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      base64Data = buffer.toString('base64');
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
Analise este holerite (recibo de pagamento / contracheque) ou folha de pagamento CLT do colaborador e extraia o máximo de informações financeiras estruturadas possíveis. 

Retorne um objeto JSON estrito com os seguintes campos (use nulo se não encontrar ou não for aplicável):

{
  "name": "Nome completo do funcionário/colaborador (ex: João da Silva)",
  "cpf": "CPF do funcionário (formato 000.000.000-00)",
  "competencia": "Mês e ano de referência da folha (ex: '06/2026' ou 'Junho/2026'). IMPORTANTE: Converta obrigatoriamente para o formato de data YYYY-MM-01 (ex: '2026-06-01')",
  "valor_fixo": Salário Base contratual / Provento Base mensal do cargo (apenas número decimal),
  "valor_holerite": Total de Proventos / Vencimentos Brutos (soma de todos os recebimentos sem os descontos - apenas número decimal),
  "valor_adiantamento": Valor de adiantamento salarial / vale se houver (apenas número decimal),
  "valor_hora_extra": Valor total pago de Horas Extras no mês (apenas número decimal),
  "valor_adicional_not": Valor total pago de Adicional Noturno no mês (apenas número decimal),
  "valor_vr": Valor descontado ou creditado referente a Vale Refeição / Alimentação (apenas número decimal),
  "valor_vt": Valor descontado ou pago de Vale Transporte (apenas número decimal),
  "valor_cesta": Valor de cesta básica ou auxílio alimentação complementar se houver (apenas número decimal),
  "valor_ferias": Valor pago referente a Férias (e 1/3 constitucional) se gozadas/pagas neste recibo (apenas número decimal),
  "valor_rescisao": Valores de verbas rescisórias se for recibo de quitação/rescisão (apenas número decimal),
  "valor_decimo_terceiro": Valor de 13º Salário (1ª ou 2ª parcela, ou integral) se pago neste recibo (apenas número decimal),
  "valor_descontos": Total de Descontos da folha (soma de INSS, IRRF, coparticipações, faltas, etc. - apenas número decimal),
  "valor_faltas": Valor descontado especificamente por faltas ou atrasos no mês se houver (apenas número decimal),
  "dias_faltas": Quantidade de dias ou fração de dia das faltas/atrasos do mês (apenas número decimal. Ex: se no recibo constar 'Dias Faltas 1.50' ou similar, retorne 1.50; se não houver faltas retorne 0),
  "valor_consignado": Valor descontado em folha referente a Empréstimo Consignado de bancos ou FGTS (ex: 'Empréstimo Consignado', 'Desc. Consignado', etc. - apenas número decimal),
  "banco_horas": Saldo de horas extras acumuladas no banco de horas se mencionado no rodapé/detalhe do holerite (ex: se mencionar '+15:30' retorne 15.5; se for '-5:00' retorne -5; retorne apenas o número decimal correspondente às horas totais),
  "valor_incentivos": Premiações, PLR, quebra de caixa ou gratificações fixas e garantidas se houver (apenas número decimal),
  "valor_bonus": Bônus variável ou prêmio por desempenho se houver (apenas número decimal),
  "valor_comissao": Comissões de vendas se houver (apenas número decimal),
  "valor_ajuda_custo": Auxílio home office, ajuda de custo de internet ou reembolso de despesas corporativas se houver (apenas número decimal),
  "valor_liquido": Valor Líquido final a receber pelo funcionário (geralmente rotulado como 'Líquido a Receber' ou 'Total Líquido' - Vencimentos Brutos menos Descontos - apenas número decimal),
  "observacao": "Breve nota sobre ocorrências especiais observadas no documento (ex: 'Recibo referente a primeira parcela do 13o', 'Contém desconto de falta injustificada')"
}

Trabalhe com máxima precisão. Valores monetários devem ser estritamente numéricos decimais.
Retorne APENAS o JSON, sem nenhuma outra formatação, texto adicional ou blocos de código markdown.
`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf'
        }
      },
      prompt
    ]);

    const textResponse = result.response.text();
    
    try {
      const parsedData = JSON.parse(textResponse);
      return NextResponse.json(parsedData);
    } catch {
      return NextResponse.json({ 
        rawText: textResponse,
        error: 'A IA não retornou um JSON perfeitamente válido.' 
      }, { status: 422 });
    }

  } catch (error: unknown) {
    console.error('Erro ao processar folha de pagamento por IA:', error);
    return NextResponse.json(
      { error: 'Erro interno durante o processamento do holerite.' },
      { status: 500 }
    );
  }
}
