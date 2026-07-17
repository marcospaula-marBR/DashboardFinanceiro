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
3. **Verbas Financeiras**:
   - Salário base contratual no campo "valor_fixo".
   - Total de Proventos/Vencimentos Brutos no campo "valor_holerite".
   - Total de Descontos no campo "valor_descontos".
   - Empréstimo Consignado: Se houver descontos com termos como "DESC. EMP. CRED. TRAB N..." ou "Consignado", some os respectivos valores e adicione no campo "valor_consignado".
   - Faltas/Atrasos: Some todos os descontos de faltas ou faltas DSR (ex: "DIAS FALTAS", "DIAS FALTAS DSR") e coloque no campo "valor_faltas".
   - Banco de Horas: Se houver desconto de banco de horas (ex: "Desconto Banco de Horas 15:22"), converta as horas/minutos para formato decimal (ex: 15h22m = 15.37) e coloque no campo "banco_horas" como número positivo representando a quantidade de horas descontadas.
   - Demais proventos e descontos mapeados nos respectivos campos (adiantamento, hora extra, adicional noturno, férias, décimo terceiro, VR, VT, cesta básica, bônus, comissão, ajuda de custo).

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
      "valor_consignado": 0.00,
      "banco_horas": 0.00,
      "valor_incentivos": 0.00,
      "valor_bonus": 0.00,
      "valor_comissao": 0.00,
      "valor_ajuda_custo": 0.00,
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
