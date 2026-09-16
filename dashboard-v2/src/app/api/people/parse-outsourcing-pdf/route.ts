import { NextResponse } from 'next/server';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';

function cleanNum(val: any): number {
  if (!val) return 0;
  let s = String(val).trim();
  s = s.replace(/R\$\s*/gi, '').replace(/\s+/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.indexOf('.') < s.indexOf(',')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : parseFloat(n.toFixed(2));
}

export interface ExtractedOutsourcingEmployee {
  name: string;
  cpf: string;
  employeeType: 'CLT' | 'PJ' | 'Estagio' | 'Outro';
  cargo?: string;
  valorBruto: number;
  valorDesconto: number;
  valorLiquido: number;
  valorVT: number;
  valorFGTS: number;
  valorGPS: number;
  valorAjudaCusto: number;
  valorEmprestimo: number;
  salarioFamilia: number;
  valorFaltas: number;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo PDF enviado.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const data = await pdf(buffer);
    const text = data.text;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Não foi possível extrair texto do documento PDF.' }, { status: 422 });
    }

    // 1. Identificar Competência (ex: 08/2026 -> 2026-08)
    let competencia = '';
    const compMatch = text.match(/Compet[êe]ncia:?\s*(\d{2}\/\d{4})/i) || text.match(/(\d{2}\/\d{4})\s*[\r\n]+Empresa:/i);
    if (compMatch) {
      const [m, y] = compMatch[1].split('/');
      competencia = `${y}-${m}`;
    } else {
      const m2 = text.match(/(\d{2}\/\d{4})/);
      if (m2) {
        const [m, y] = m2[1].split('/');
        competencia = `${y}-${m}`;
      }
    }

    // 2. Identificar Razão Social / Filial
    let empresa = 'D.Z.M LTDA';
    const filialMatch = text.match(/Filial:\s*([^\r\n]+)/i);
    const empMatch = text.match(/(\d+\s*-\s*[A-Z0-9\.\s]+(?:LTDA|S\/A|ME|EPP))/i);
    if (empMatch) {
      empresa = empMatch[1].trim();
    } else if (filialMatch) {
      empresa = filialMatch[1].trim();
    }

    // 3. Delimitar blocos individuais de colaboradores
    // Padrão do sistema contábil (Domínio / Realcontabil):
    // Cada colaborador inicia com um número e nome maiúsculo seguido por "Empr.:"
    const regexSplit = /(\d+\s*[A-ZÀ-Ú\s]{3,}Empr\.:)/g;
    const parts = text.split(regexSplit);

    const employees: ExtractedOutsourcingEmployee[] = [];

    for (let i = 1; i < parts.length; i += 2) {
      const header = parts[i];
      let body = parts[i + 1] || '';

      // Corta o body no final do recibo individual para não herdar totais de resumo da filial
      if (body.includes('Resumo por Rubricas')) {
        body = body.split('Resumo por Rubricas')[0];
      }
      if (body.includes('Data de pagamento')) {
        body = body.split('Data de pagamento')[0];
      }

      const fullBlock = header + body;

      // Nome completo
      const nameMatch = header.match(/^\d+\s*([A-ZÀ-Ú\s]+?)Empr\.:/);
      let rawName = nameMatch ? nameMatch[1].trim() : 'Desconhecido';
      // Limpeza de ruídos de sobreposição
      rawName = rawName.replace(/Situa[çc][ãa]o.*$/i, '').replace(/CPF:.*$/i, '').trim();

      // CPF
      const cpfMatch = fullBlock.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
      const cpf = cpfMatch ? cpfMatch[1] : '';

      // Vínculo
      const vinculoMatch = fullBlock.match(/(Celetista|Estagi[áa]rio|Prazo\s+det[^\r\n]+|PJ|Prestador)/i);
      let vinculo: 'CLT' | 'PJ' | 'Estagio' | 'Outro' = 'CLT';
      if (vinculoMatch) {
        const v = vinculoMatch[1].toLowerCase();
        if (v.includes('estag')) vinculo = 'Estagio';
        else if (v.includes('pj') || v.includes('prestador')) vinculo = 'PJ';
        else vinculo = 'CLT';
      }

      // Cargo / Função
      const cargoMatch = fullBlock.match(/Cargo:?\s*(\d+[^\r\n\d]+)/i);
      const cargo = cargoMatch ? cargoMatch[1].replace(/^\d+/, '').trim() : '';

      // Proventos / Bruto
      const provMatch = fullBlock.match(/Proventos:?\s*([\d\.,]+)/i);
      const bruto = provMatch ? cleanNum(provMatch[1]) : 0;

      // Descontos totais
      const descMatch = fullBlock.match(/Descontos:?\s*([\d\.,]+)/i);
      const desconto = descMatch ? cleanNum(descMatch[1]) : 0;

      // Valor Líquido (prioriza campo explícito ou Bruto - Desconto)
      let liquido = cleanNum(bruto - desconto);
      const directLiq = fullBlock.match(/L[íi]quido:?\s*([\d\.,]+)/i);
      if (directLiq) {
        const parsedL = cleanNum(directLiq[1]);
        if (parsedL > 0) liquido = parsedL;
      }

      // FGTS (informativo patronal da folha)
      const fgtsMatch = fullBlock.match(/Valor\s+FGTS:?\s*([\d\.,]+)/i) || fullBlock.match(/Informativa:?\s*([\d\.,]+)/i);
      const fgts = fgtsMatch ? cleanNum(fgtsMatch[1]) : 0;

      // Vale Transporte (Rubrica 48) - fronteira de dígitos obrigatória
      const vtMatch = fullBlock.match(/(?:^|[^\d])48\s*([\d\.,]+)D/i) || fullBlock.match(/VALE\s+TRANSPORTE[^\d]+([\d\.,]+)D/i);
      const vt = vtMatch ? cleanNum(vtMatch[1]) : 0;

      // INSS Previdência (Rubrica 998) - fronteira de dígitos obrigatória
      const inssMatch = fullBlock.match(/(?:^|[^\d])998\s*([\d\.,]+)D/i) || fullBlock.match(/I\.N\.S\.S\.[^\d]+([\d\.,]+)D/i);
      const inss = inssMatch ? cleanNum(inssMatch[1]) : 0;

      // Adiantamento Salarial (Rubrica 981) - fronteira de dígitos obrigatória
      const adiantMatch = fullBlock.match(/(?:^|[^\d])981\s*([\d\.,]+)D/i) || fullBlock.match(/DESC\.ADIANT\.SALARIAL\s*([\d\.,]+)/i);
      const adiantamento = adiantMatch ? cleanNum(adiantMatch[1]) : 0;

      // Empréstimos Consignados (Rubricas 201, 203, 206, 9750 DESC. EMP. CRED. TRAB)
      let emprestimo = 0;
      const empMatches = fullBlock.matchAll(/(?:^|[^\d])(?:201|203|206|9750)\s*([\d\.,]+)D/gi);
      for (const em of empMatches) {
        emprestimo += cleanNum(em[1]);
      }
      emprestimo = cleanNum(emprestimo);

      // Salário Família (Rubrica 995)
      const sfMatch = fullBlock.match(/(?:^|[^\d])995\s*([\d\.,]+)P/i) || fullBlock.match(/SALARIO\s+FAMILIA[^\d]+([\d\.,]+)P/i);
      const salarioFamilia = sfMatch ? cleanNum(sfMatch[1]) : 0;

      // Faltas (Rubricas 8792, 8794)
      let faltas = 0;
      const faltasMatches = fullBlock.matchAll(/(?:8792|8794)\s*([\d\.,]+)D\s*DIAS\s+FALTAS/gi);
      for (const fm of faltasMatches) {
        faltas += cleanNum(fm[1]);
      }

      employees.push({
        name: rawName,
        cpf,
        employeeType: vinculo,
        cargo,
        valorBruto: bruto,
        valorDesconto: desconto,
        valorLiquido: liquido,
        valorVT: vt,
        valorFGTS: fgts,
        valorGPS: inss,
        valorAjudaCusto: adiantamento,
        valorEmprestimo: emprestimo,
        salarioFamilia,
        valorFaltas: cleanNum(faltas)
      });
    }

    return NextResponse.json({
      success: true,
      competencia: competencia || new Date().toISOString().slice(0, 7),
      empresa,
      totalParsed: employees.length,
      employees
    });
  } catch (error: any) {
    console.error('Erro ao processar Extrato Mensal PDF:', error);
    return NextResponse.json(
      { error: `Erro no processamento do PDF: ${error?.message || 'Arquivo corrompido ou formato incompatível.'}` },
      { status: 500 }
    );
  }
}
