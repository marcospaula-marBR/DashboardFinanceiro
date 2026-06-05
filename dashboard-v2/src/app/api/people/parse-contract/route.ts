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

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    // Converter arquivo para buffer e depois base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
Analise este contrato de prestação de serviços (ou contrato de trabalho) e extraia o máximo de informações estruturadas possíveis.
Retorne um objeto JSON estrito com os seguintes campos (use nulo ou string vazia se não encontrar):

{
  "name": "Nome do contratado/colaborador (Pessoa Física representante/prestador)",
  "document_id": "CPF do contratado (formato 000.000.000-00)",
  "document_rg": "RG do contratado se houver",
  "corporate_name": "Razão Social / Nome da Empresa contratada (se for contrato de PJ/MEI)",
  "cnpj": "CNPJ da empresa contratada (formato 00.000.000/0000-00, se for PJ)",
  "linkType": "PJ" se houver CNPJ ou menção a prestação de serviço por pessoa jurídica, caso contrário "CLT",
  "remuneration_fixed": Valor monetário base mensal da remuneração/salário/honorário (apenas número decimal),
  "email": "E-mail de contato pessoal",
  "phone": "Telefone de contato pessoal (DDD + Número)",
  "email_professional": "E-mail de contato profissional/corporativo (trabalho)",
  "phone_professional": "Telefone de contato profissional/corporativo (trabalho, DDD + Número)",
  "zip_code": "CEP residencial do contratado (formato 00000-000)",
  "street": "Rua/logradouro do endereço residencial",
  "number": "Número do endereço residencial",
  "neighborhood": "Bairro residencial",
  "city": "Cidade residencial",
  "state": "UF residencial (ex: SP, RJ)",
  "cnpj_zip_code": "CEP do endereço comercial/CNPJ se houver",
  "cnpj_street": "Logradouro do CNPJ se houver",
  "cnpj_number": "Número do endereço do CNPJ se houver",
  "cnpj_neighborhood": "Bairro do CNPJ se houver",
  "cnpj_city": "Cidade do CNPJ se houver",
  "cnpj_state": "UF do CNPJ se houver",
  "responsible_name": "Nome do responsável legal (geralmente igual ao Name em contratos MEI/PJ)",
  "responsible_cpf": "CPF do responsável legal (formato 000.000.000-00, geralmente igual ao CPF do prestador)"
}

Trabalhe com máxima precisão. Caso seja um contrato PJ (MEI ou outro), o 'linkType' deve ser obrigatoriamente 'PJ' ou 'MEI'.
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
    
    // Parsear a resposta para garantir que seja um JSON válido
    try {
      const parsedData = JSON.parse(textResponse);
      return NextResponse.json(parsedData);
    } catch {
      return NextResponse.json({ 
        rawText: textResponse,
        error: 'A IA não retornou um JSON perfeitamente válido.' 
      }, { status: 422 });
    }

  } catch (error: any) {
    console.error('Erro ao processar contrato por IA:', error);
    return NextResponse.json(
      { error: 'Erro interno durante o processamento do contrato.' },
      { status: 500 }
    );
  }
}
