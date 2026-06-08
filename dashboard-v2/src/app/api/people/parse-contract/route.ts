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
Analise este contrato de prestação de serviços (ou contrato de trabalho) e extraia o máximo de informações estruturadas possíveis. 
Procure também em qualquer página de "checklist", resumo, folha de conferência ou anexos de validação que possam estar incluídos no documento, pois estes costumam conter o resumo das datas de início, validade e outras informações importantes do contrato.

Retorne um objeto JSON estrito com os seguintes campos (use nulo ou string vazia se não encontrar):

{
  "document_type": "Qualifique este documento como 'Contrato', 'Aditivo' ou 'Distrato' (Termo de Rescisão)",
  "document_title": "TÍTULO EXATO do documento conforme consta no topo/início (ex: 'CONTRATO PRESTAÇÃO DE SERVIÇO', 'TERMO DE DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS', 'ADITIVO CONTRATUAL')",
  "additive_changes": "Se for Aditivo, liste de forma sucinta o que mudou (ex: 'Mudança de Função', 'Aditivo de Remuneração', 'Prorrogação de Prazo'). Se não for, deixe nulo.",
  "signature_date": "Data da assinatura do documento ou data de emissão/fechamento que consta nele (formato YYYY-MM-DD). Procure nas últimas páginas próximo à assinatura",
  "name": "Nome do contratado/colaborador (Pessoa Física representante/prestador)",
  "document_id": "CPF do contratado (formato 000.000.000-00)",
  "document_rg": "RG do contratado se houver",
  "corporate_name": "Razão Social / Nome da Empresa contratada (se for contrato de PJ/MEI)",
  "cnpj": "CNPJ da empresa contratada (formato 00.000.000/0000-00, se for PJ)",
  "linkType": "\"PJ\" se houver CNPJ ou menção a prestação de serviço por pessoa jurídica, caso contrário \"CLT\"",
  "remuneration_fixed": Valor monetário base mensal da remuneração/salário/honorário (apenas número decimal),
  "remuneration_bonus": Valor monetário base mensal de bônus/premiação/variável se houver (apenas número decimal). Analise todo o contrato por cláusulas de bônus, remuneração variável ou metas e extraia o maior valor de bônus encontrado,
  "bonus_description": "Breve descrição do bônus/remuneração variável (ex: Bônus por meta de X, ou Bônus mensal de assiduidade)",
  "email": "E-mail de contato pessoal",
  "phone": "Telefone de contato pessoal (DDD + Número. NÃO INCLUA o código de país +55/55 sob nenhuma hipótese)",
  "email_professional": "E-mail de contato profissional/corporativo (trabalho)",
  "phone_professional": "Telefone de contato profissional/corporativo (trabalho, DDD + Número. NÃO INCLUA o código de país +55/55)",
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
  "responsible_cpf": "CPF do responsável legal (formato 000.000.000-00, geralmente igual ao CPF do prestador)",
  "start_date": "Data de início do contrato/admissão/início da prestação (formato YYYY-MM-DD)",
  "contract_expiry_date": "Data de término/vencimento/validade/fim da vigência do contrato se houver (formato YYYY-MM-DD)",
  "termination_date": "Se for Distrato, busque a DATA EFETIVA DO ÚLTIMO DIA TRABALHADO ou data real do encerramento da prestação de serviços. Atenção: pode não ser a data de assinatura! Procure por frases como 'tendo seu término no dia X' ou 'o último dia de serviço será Y' (formato YYYY-MM-DD)",
  "contracting_company": "Nome/Razão Social da empresa contratante (ex: G2 Tecnologia e Inovação, Mar Brasil Serviços e Locações, D.Z.M, etc.)"
}

Trabalhe com máxima precisão. Caso seja um contrato PJ (MEI ou outro), o 'linkType' deve ser EXCLUSIVAMENTE 'PJ'. O termo MEI diz respeito apenas a regime tributário e nunca deve ser listado como linkType.
Se document_type for 'Distrato', a termination_date deve refletir o último dia real de vínculo/serviço, e não necessariamente o dia em que o distrato foi assinado. Se o documento mencionar que os serviços encerram no dia X, X será a termination_date.
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

  } catch (error: unknown) {
    console.error('Erro ao processar contrato por IA:', error);
    return NextResponse.json(
      { error: 'Erro interno durante o processamento do contrato.' },
      { status: 500 }
    );
  }
}
