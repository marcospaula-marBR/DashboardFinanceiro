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

    let mimeType = 'application/pdf';
    let base64Data = '';
    let importType = 'payroll';
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { fileUrl, type } = body;
      if (type) importType = type;
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
      
      const resType = fileRes.headers.get('content-type');
      if (resType) mimeType = resType;

      const bytes = await fileRes.arrayBuffer();
      const buffer = Buffer.from(bytes);
      base64Data = buffer.toString('base64');
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const typeParam = formData.get('type') as string | null;
      if (typeParam) importType = typeParam;

      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
      }

      if (file.type) {
        mimeType = file.type;
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      base64Data = buffer.toString('base64');
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const isAdvanceMode = importType === 'advance';
    const isBenefitsMode = importType === 'benefits';

    let prompt = "";

    if (isAdvanceMode) {
      prompt = `
Analise este documento (PDF ou imagem) contendo a Folha de Adiantamento Salarial (Relação de Adiantamento Quinzenal, Folha de Vales ou Recibos de Adiantamento Salarial de colaboradores).

Instruções de Extração:
1. **Competência**: Identifique a competência (mês/ano) de referência no cabeçalho ou datas do documento (ex: '07/2026', 'Competência: 07/2026' ou 'Julho/2026') e formate obrigatoriamente como 'YYYY-MM-01' (ex: '2026-07-01'). Se não encontrar, retorne string vazia "".
2. **Colaboradores**: Extraia cada linha ou recibo individual de colaborador contido na relação de adiantamento salarial.
3. **Valores do Adiantamento**:
   - "name": Nome completo do colaborador.
   - "cpf": CPF do colaborador (formatado 000.000.000-00 ou números puros).
   - "matricula": Matrícula ou código se houver.
   - "cargo": Cargo se houver.
   - "valor_adiantamento": Valor nominal do adiantamento salarial a receber / crédito pago ao colaborador (ex: 1767.26, 800.00). Caso haja valor bruto e líquido do adiantamento, priorize o valor efetivo a receber.
   - "observacao": Descrição ou identificador (ex: 'Folha de Adiantamento Quinzenal').

Retorne obrigatoriamente um objeto JSON com o seguinte formato:
{
  "competencia": "YYYY-MM-01",
  "records": [
    {
      "matricula": "1",
      "name": "Nome Completo do Colaborador",
      "cpf": "000.000.000-00",
      "cargo": "Cargo",
      "valor_adiantamento": 0.00,
      "observacao": "Adiantamento Salarial"
    }
  ]
}

Valores monetários devem ser estritamente numéricos decimais (ex: 1767.26, 500.00).
Retorne APENAS o JSON, sem nenhuma outra formatação, texto adicional ou blocos de código markdown.
`;
    } else if (isBenefitsMode) {
      prompt = `
Analise este documento (PDF ou imagem) contendo um Relatório, Demonstrativo ou Planilha de Benefícios (Vale Transporte / VT, Vale Refeição / Alimentação / Cesta, Flash, Sodexo, Alelo, VR, Bonificação, Premiação, Bônus, Ajuda de Custo).

Instruções de Extração:
1. **Competência**: Identifique a competência (mês/ano) de referência no cabeçalho ou datas do documento (ex: '07/2026', 'Competência: 07/2026' ou 'Julho/2026') e formate obrigatoriamente como 'YYYY-MM-01' (ex: '2026-07-01'). Se não encontrar, retorne string vazia "".
2. **Colaboradores**: Extraia cada linha ou registro individual de colaborador contido no relatório.
3. **Valores dos Benefícios**:
   - "name": Nome completo do colaborador.
   - "cpf": CPF do colaborador (formatado 000.000.000-00 ou números puros).
   - "matricula": Matrícula ou código se houver.
   - "cargo": Cargo se houver.
   - "valor_vt": Valor de Vale Transporte (crédito recebido, recarga no cartão, Sodexo VT, Top, etc.).
   - "valor_vr": Valor de Vale Refeição / Alimentação creditado ao colaborador.
   - "valor_cesta": Valor de Cesta Básica ou VR/Cesta creditado.
   - "valor_bonus": Valor de Bonificação, Premiação, Bônus ou Incentivo concedido.
   - "valor_ajuda_custo": Ajuda de custo, home-office ou conectividade.
   - "observacao": Descrição ou categoria do benefício (ex: 'Recarga VT Sodexo', 'Premiação', 'VR / Cesta').

Retorne obrigatoriamente um objeto JSON com o seguinte formato:
{
  "competencia": "YYYY-MM-01",
  "records": [
    {
      "matricula": "1",
      "name": "Nome Completo do Colaborador",
      "cpf": "000.000.000-00",
      "cargo": "Cargo",
      "valor_vt": 0.00,
      "valor_vr": 0.00,
      "valor_cesta": 0.00,
      "valor_bonus": 0.00,
      "valor_ajuda_custo": 0.00,
      "observacao": "Recarga Benefícios"
    }
  ]
}

Valores monetários devem ser estritamente numéricos decimais (ex: 273.00, 500.00).
Retorne APENAS o JSON, sem nenhuma outra formatação, texto adicional ou blocos de código markdown.
`;
    } else {
      prompt = `
Analise este documento (PDF ou imagem) contendo o Extrato Mensal da folha de pagamento de múltiplos colaboradores (listagem celetista ou múltiplos recibos).

Instruções de Extração:
1. **Competência**: Identifique a competência (mês/ano) da folha no cabeçalho do documento (ex: '07/2026', 'Competência: 07/2026' ou 'Julho de 2026') e formate obrigatoriamente como 'YYYY-MM-01' (ex: '2026-07-01').
2. **Colaboradores**: Extraia os dados individuais de cada colaborador CLT celetista identificado no documento (identificado por 'Empr.:', 'Nome', 'CPF', etc.).
3. **Verbas de Provento (Receita Bruta do Colaborador - uma por uma)**:
   - Salário base contratual no campo "valor_fixo".
   - Horas Extras ('150 HORAS EXTRAS 50%', 100%, etc.) somando com reflexo DSR ('8125 REFLEXO HORAS EXTRAS DSR') no campo "valor_hora_extra".
   - Adicional Noturno e reflexos no campo "valor_adicional_not".
   - Salário Família no campo "salario_familia" (ex: rubrica 995 SALARIO FAMILIA).
   - Férias gozadas / proporcionais + 1/3 Constitucional no campo "valor_ferias".
   - 13º Salário (1ª/2ª parcela ou integral) no campo "valor_decimo_terceiro".
   - Verbas Rescisórias no campo "valor_rescisao".
   - Demais proventos no campo "valor_outros_recebidos".
   - **Total de Proventos (Receita Bruta)** no campo "valor_holerite" (soma exata de todos os proventos da folha, ex: '3.037,67').
   - Extraia a lista detalhada de cada provento em "rubricas_proventos": [{"codigo": "1", "descricao": "SALARIO BASE", "valor": 2211.68}, ...].

4. **Verbas de Desconto da Folha (uma por uma)**:
   - INSS descontado no campo "inss_empregado" (rubrica 998 I.N.S.S.).
   - IRRF descontado no campo "irrf_empregado".
   - Desconto de Vale Transporte 6% no campo "desconto_vt_6" (rubrica 48 VALE TRANSPORTE).
   - Desconto de Faltas e DSR no campo "valor_faltas", com quantitativo em "dias_faltas".
   - Empréstimo Consignado no campo "valor_consignado".
   - Pensão Alimentícia no campo "valor_pensao_alimenticia".
   - Desconto de Banco de Horas em "banco_horas" (em horas decimais).
   - **Desconto de Adiantamento Salarial em Folha (CRUCIAL)**: Procure por rubricas de desconto de adiantamento ordinário da quinzena (como '981 DESC.ADIANT.SALARIAL', 'DESC. ADIANTAMENTO SALARIAL'). Capture no campo "desconto_adiantamento_folha" e no campo "valor_adiantamento".
     *ATENÇÃO RIGOROSA*: NUNCA capture adiantamento de férias como adiantamento salarial. Férias têm tratamento rescisório/gozo próprio em valor_ferias.
   - **Total de Descontos da Folha** no campo "valor_descontos" (soma exata de todos os descontos da folha, ex: '1.104,01').
   - Extraia a lista detalhada de cada desconto em "rubricas_descontos": [{"codigo": "998", "descricao": "INSS", "valor": 253.10}, ...].

5. **Salário Líquido da Folha**:
   - Salário líquido a receber da folha oficial no campo "valor_folha_liquido" (Total Proventos - Total Descontos).

6. **Informativo FGTS da Empresa**:
   - Valor do FGTS pago pela empresa em "valor_fgts" (das linhas informativas, ex: 'Valor FGTS: 243,01').

7. **REGRA DE EXCLUSÃO DE BASES (CRUCIAL!)**:
   - IGNORE E NÃO EXTRAIA bases informativas ('Base FGTS', 'Base INSS', 'Base IRRF'). Elas NÃO são proventos nem descontos.

Retorne obrigatoriamente um objeto JSON com o seguinte formato:

{
  "competencia": "YYYY-MM-01",
  "records": [
    {
      "matricula": "1",
      "name": "Nome Completo do Colaborador",
      "cpf": "000.000.000-00",
      "cargo": "Cargo do colaborador",
      "situation": "Trabalhando" ou "Demitido",
      "admission_date": "YYYY-MM-DD",
      "valor_fixo": 0.00,
      "valor_hora_extra": 0.00,
      "valor_adicional_not": 0.00,
      "salario_familia": 0.00,
      "valor_ferias": 0.00,
      "valor_decimo_terceiro": 0.00,
      "valor_rescisao": 0.00,
      "valor_outros_recebidos": 0.00,
      "valor_holerite": 0.00,
      "inss_empregado": 0.00,
      "irrf_empregado": 0.00,
      "desconto_vt_6": 0.00,
      "desconto_adiantamento_folha": 0.00,
      "valor_adiantamento": 0.00,
      "valor_faltas": 0.00,
      "dias_faltas": 0.00,
      "valor_consignado": 0.00,
      "valor_pensao_alimenticia": 0.00,
      "banco_horas": 0.00,
      "valor_descontos": 0.00,
      "valor_folha_liquido": 0.00,
      "valor_fgts": 0.00,
      "valor_vt": 0.00,
      "valor_vr": 0.00,
      "valor_cesta": 0.00,
      "valor_bonus": 0.00,
      "valor_ajuda_custo": 0.00,
      "rubricas_proventos": [
        {"codigo": "1", "descricao": "SALARIO BASE", "valor": 0.00}
      ],
      "rubricas_descontos": [
        {"codigo": "998", "descricao": "INSS", "valor": 0.00}
      ],
      "observacao": "Folha Oficial CLT"
    }
  ]
}

Trabalhe com máxima precisão. Valores monetários devem ser estritamente numéricos decimais.
Retorne APENAS o JSON, sem nenhuma outra formatação, texto adicional ou blocos de código markdown.
`;
    }

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType.includes('image') ? mimeType : 'application/pdf'
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
        error: 'A IA não retornou um JSON de lote perfeitamente válido.' 
      }, { status: 422 });
    }

  } catch (error: unknown) {
    console.error('Erro ao processar folha de pagamento em lote por IA:', error);
    return NextResponse.json(
      { error: 'Erro interno durante o processamento do lote da folha.' },
      { status: 500 }
    );
  }
}
