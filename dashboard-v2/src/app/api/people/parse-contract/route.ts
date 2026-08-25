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

    const prompt = `
Analise este contrato de prestação de serviços (ou contrato de trabalho, aditivo ou distrato/rescisão) e extraia o máximo de informações estruturadas possíveis. 
Procure também em qualquer página de "checklist", resumo, folha de conferência ou anexos de validação que possam estar incluídos no documento, pois estes costumam conter o resumo das datas de início, validade, encerramento e outras informações importantes do contrato.

Retorne um objeto JSON estrito com os seguintes campos (use nulo ou string vazia se não encontrar):

{
  "document_type": "Qualifique este documento como 'Contrato', 'Aditivo' ou 'Distrato' (Termo de Rescisão/Distrato)",
  "document_title": "TÍTULO EXATO do documento conforme consta no topo/início (ex: 'CONTRATO PRESTAÇÃO DE SERVIÇO', 'TERMO DE DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS', 'ADITIVO CONTRATUAL')",
  "additive_changes": "Se for Aditivo, liste de forma sucinta o que mudou (ex: 'Mudança de Função', 'Aditivo de Remuneração', 'Prorrogação de Prazo'). Se não for, deixe nulo.",
  "signature_date": "Data EXATA da assinatura do documento ou data de emissão/fechamento. Leia as últimas páginas e procure por trechos como 'cidade, 01 de Junho de 2026' ou o carimbo da assinatura digital (formato YYYY-MM-DD).",
  "job_role": "Cargo ou Função do contratado (ex: Médico, Desenvolvedor, Técnico, Assistente). Se houver mudança de cargo no aditivo, extraia o novo cargo/função para cá.",
  "name": "Nome do contratado/colaborador (Pessoa Física representante/prestador)",
  "document_id": "CPF do contratado (formato 000.000.000-00)",
  "document_rg": "RG do contratado se houver",
  "corporate_name": "Razão Social / Nome da Empresa contratada (se for contrato de PJ/MEI)",
  "cnpj": "CNPJ da empresa contratada (formato 00.000.000/0000-00, se for PJ)",
  "linkType": "\"PJ\" se houver CNPJ ou menção a prestação de serviço por pessoa jurídica, caso contrário \"CLT\"",
  "remuneration_fixed": Valor monetário base mensal da remuneração/salário/honorário (apenas número decimal),
  "remuneration_bonus": Valor monetário de BÔNUS VARIÁVEL ligado a metas, desempenho ou resultados (apenas número decimal),
  "bonus_description": "Breve descrição do bônus variável",
  "remuneration_incentives": Valor monetário de INCENTIVOS FIXOS OU PERIÓDICOS (ajuda de custo veicular, combustível, PLR, etc.),
  "incentives_description": "Breve descrição dos incentivos",
  "remuneration_connectivity": Valor monetário de auxílio conectividade se houver,
  "email": "E-mail de contato pessoal",
  "phone": "Telefone de contato pessoal (DDD + Número, sem +55)",
  "email_professional": "E-mail de contato profissional/corporativo",
  "phone_professional": "Telefone de contato profissional/corporativo (sem +55)",
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
  "responsible_name": "Nome do responsável legal",
  "responsible_cpf": "CPF do responsável legal (formato 000.000.000-00)",
  "start_date": "Data de início do contrato/admissão/início da prestação (formato YYYY-MM-DD)",
  "contract_expiry_date": "Data de término/vencimento/validade/fim da vigência do contrato se houver ou DATA DO DISTRATO/RESCISÃO (formato YYYY-MM-DD)",
  "termination_date": "Se for Distrato (Termo de Rescisão/Encerramento), busque a DATA EFETIVA DO ÚLTIMO DIA TRABALHADO ou data real do encerramento da prestação de serviços (formato YYYY-MM-DD)",
  "contracting_company": "Nome/Razão Social da empresa contratante (ex: G2 Tecnologia e Inovação, Mar Brasil Serviços e Locações, D.Z.M, etc.)",
  "executive_summary": "Resumo profissional executivo baseado no OBJETO DO CONTRATO."
}

Trabalhe com máxima precisão. Caso seja um contrato PJ (MEI ou outro), o 'linkType' deve ser EXCLUSIVAMENTE 'PJ'.
ATENÇÃO MÁXIMA A DISTRATOS: Se o documento contiver palavras-chave como 'Distrato', 'Rescisão', 'Encerramento de Contrato', 'Termo de Quitação', defina document_type = 'Distrato'. Preencha Obrigatoriamente 'termination_date' E 'contract_expiry_date' com a data final da prestação de serviços encontrada no documento.
Retorne APENAS o JSON puro, sem nenhuma outra formatação markdown.
`;

    // Lista de modelos suportados com fallback automático
    const modelCandidates = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let textResponse = '';
    let lastModelError: Error | null = null;

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent([
          {
            inlineData: {
              data: base64Data,
              mimeType: 'application/pdf'
            }
          },
          prompt
        ]);

        textResponse = result.response.text();
        if (textResponse && textResponse.trim().length > 0) {
          break; // Sucesso!
        }
      } catch (err: any) {
        console.warn(`Tentativa com modelo ${modelName} falhou:`, err?.message || err);
        lastModelError = err;
      }
    }

    if (!textResponse) {
      throw lastModelError || new Error('Nenhum modelo Gemini conseguiu processar o documento PDF.');
    }

    // Limpar markdown wrappers se presentes (```json ... ```)
    let cleanedText = textResponse.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Parsear a resposta para garantir que seja um JSON válido
    try {
      const parsedData = JSON.parse(cleanedText);
      return NextResponse.json(parsedData);
    } catch {
      return NextResponse.json({ 
        rawText: textResponse,
        error: 'A IA não retornou um JSON perfeitamente válido.' 
      }, { status: 422 });
    }

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Erro ao processar contrato por IA:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno durante o processamento do contrato.' },
      { status: 500 }
    );
  }
}
