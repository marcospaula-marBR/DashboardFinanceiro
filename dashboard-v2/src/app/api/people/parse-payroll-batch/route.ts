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
Analise este documento PDF contendo o Extrato Mensal da folha de pagamento de múltiplos colaboradores (vários holerites ou listagem).

Instruções de Extração:
1. **Competência**: Identifique a competência (mês/ano) da folha no cabeçalho do documento (ex: '06/2026' ou 'Junho de 2026') e formate obrigatoriamente como 'YYYY-MM-01' (ex: '2026-06-01').
2. **Colaboradores**: Extraia os dados individuais de cada colaborador CLT celetista identificado no documento.
3. **Verbas Financeiras & Informativos Patronais**:
   - Salário base contratual no campo "valor_fixo".
   - Total de Proventos/Vencimentos Brutos no campo "valor_holerite" (consta no campo 'Proventos:' do resumo do colaborador, ex: '1.849,81' ou '1.917,35').
   - Total de Descontos no campo "valor_descontos" (consta no campo 'Descontos:', ex: '993,07').
   - **Desconto de Adiantamento Salarial (CRUCIAL!)**: Procure por rubricas como '981 DESC.ADIANT.SALARIAL', 'DESC.ADIANT.SALARIAL', 'ADIANTAMENTO' ou similares nos descontos. Capture o valor monetário descontado (ex: '739,92') e COLOQUE NO CAMPO "valor_adiantamento".
   - **Salário Família (CRUCIAL!)**: Procure por rubricas como '995 SALARIO FAMILIA' ou 'SALARIO FAMILIA' nos proventos. Capture o valor em R$ (ex: '67,54' ou '58,53') e COLOQUE NO CAMPO "salario_familia".
   - **Informativo FGTS da Empresa (CRUCIAL!)**: Extraia o valor do FGTS mensal pago pela empresa no campo "valor_fgts" (localizado nas linhas informativas, ex: 'Valor FGTS: 147,98'). Extraia também a "base_fgts".
   - **Bases e Encargos**: Extraia "base_inss", "base_irrf", o INSS descontado ("inss_empregado", rubrica 998 I.N.S.S.) e o IRRF descontado ("irrf_empregado").
   - Empréstimo Consignado: Se houver descontos com termos como "DESC. EMP. CRED. TRAB N..." ou "Consignado", some os respectivos valores e adicione no campo "valor_consignado".
   - Faltas/Atrasos: Some todos os descontos de faltas ou faltas DSR (ex: "DIAS FALTAS", "DIAS FALTAS DSR") e coloque no campo "valor_faltas". Extraia também o quantitativo total de dias de falta acumulados no campo "dias_faltas".
   - Banco de Horas: Se houver desconto de banco de horas (ex: "Desconto Banco de Horas 15:22"), converta as horas/minutos para formato decimal e coloque no campo "banco_horas".
   - Demais proventos e descontos mapeados nos respectivos campos (hora extra, adicional noturno, férias, décimo terceiro, VR, VT, cesta básica, bônus, comissão, ajuda de custo).

Retorne obrigatoriamente um objeto JSON com o seguinte formato:

{
  "competencia": "YYYY-MM-01",
  "records": [
    {
      "name": "Nome Completo do Colaborador",
      "cpf": "CPF no formato 000.000.000-00",
      "situation": "Trabalhando" ou "Demitido" (conforme consta no campo Situação/Situaçao do extrato),
      "admission_date": "Data de admissão no formato YYYY-MM-DD (ex: se '13/04/2026' retorne '2026-04-13')",
      "valor_fixo": 0.00,
      "valor_holerite": 0.00,
      "valor_adiantamento": 0.00,
      "valor_hora_extra": 0.00,
      "valor_adicional_not": 0.00,
      "valor_vr": 0.00,
      "valor_vt": 0.00,
      "valor_cesta": 0.00,
      "valor_ferias": 0.00,
      "valor_rescisao": 0.00,
      "valor_decimo_terceiro": 0.00,
      "valor_descontos": 0.00,
      "valor_faltas": 0.00,
      "dias_faltas": 0.00,
      "valor_consignado": 0.00,
      "banco_horas": 0.00,
      "valor_incentivos": 0.00,
      "valor_bonus": 0.00,
      "valor_comissao": 0.00,
      "valor_ajuda_custo": 0.00,
      "valor_fgts": 0.00,
      "base_fgts": 0.00,
      "base_inss": 0.00,
      "base_irrf": 0.00,
      "inss_empregado": 0.00,
      "irrf_empregado": 0.00,
      "salario_familia": 0.00,
      "valor_liquido": 0.00,
      "observacao": "Breve observacao se for demitido ou tiver faltas"
    }
  ]
}

Trabalhe com máxima precisão. Valores monetários e banco de horas devem ser estritamente numéricos decimais.
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
