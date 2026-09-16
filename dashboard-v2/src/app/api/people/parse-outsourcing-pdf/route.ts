import { NextResponse } from 'next/server';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ExtractedOutsourcingEmployee {
  name: string;
  cpf: string;
  employeeType: 'CLT' | 'PJ' | 'Estagio' | 'Outro';
  cargo?: string;
  valorBruto: number;
  valorDesconto: number;
  valorLiquido: number;
  valorVR: number;
  valorVT: number;
  valorFGTS: number;
  valorGPS: number;
  valorAjudaCusto: number;
  valorEmprestimo: number;
  salarioFamilia: number;
  valorFaltas: number;
}

type PdfDocType = 'extrato_mensal' | 'va' | 'vt' | 'unknown';

// ─── Utilitários ──────────────────────────────────────────────────────────────

/**
 * Limpa valores monetários no formato pdf-parse (Node.js).
 * Neste formato, o valor vem ANTES do R$ e sem espaços espúrios.
 * Exemplos: '320,00' → 320.00 | '4.980,00' → 4980.00 | '6.649,65' → 6649.65
 */
function cleanNum(val: any): number {
  if (!val) return 0;
  let s = String(val).trim().replace(/R\$\s*/gi, '').trim();
  if (!s || s === '-' || s === '0-') return 0;
  if (s.includes(',') && s.includes('.')) {
    if (s.indexOf('.') < s.indexOf(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) || n < 0 ? 0 : parseFloat(n.toFixed(2));
}

/** Mapeia nome de mês por extenso para número MM */
const MONTHS_MAP: Record<string, string> = {
  JANEIRO: '01', FEVEREIRO: '02', MARCO: '03', ABRIL: '04',
  MAIO: '05', JUNHO: '06', JULHO: '07', AGOSTO: '08',
  SETEMBRO: '09', OUTUBRO: '10', NOVEMBRO: '11', DEZEMBRO: '12',
};

/**
 * Extrai competência (YYYY-MM) do texto.
 * No pdf-parse, o cabeçalho "DZM - AGOSTO/2026" aparece no FINAL do texto.
 */
function extractCompetencia(text: string): string {
  const extMatch = text.match(
    /(JANEIRO|FEVEREIRO|MAR[CÇ]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)[\/\-\s]+(\d{4})/i
  );
  if (extMatch) {
    const key = extMatch[1].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = MONTHS_MAP[key] ?? '01';
    return `${extMatch[2]}-${month}`;
  }
  const numMatch = text.match(/Compet[êe]ncia:?\s*(\d{2}\/\d{4})/i) || text.match(/(\d{2}\/\d{4})/);
  if (numMatch) {
    const [m, y] = numMatch[1].split('/');
    return `${y}-${m}`;
  }
  return new Date().toISOString().slice(0, 7);
}

/**
 * Detecta o tipo de documento PDF pelo conteúdo.
 * No pdf-parse, o título (VALE ALIMENTAÇÃO / VALE TRANSPORTE) aparece no FINAL do texto.
 */
function detectDocType(text: string): PdfDocType {
  const upper = text.toUpperCase();
  if (upper.includes('VALE ALIMENTA') || upper.includes('VALE REFEIC') || upper.includes('CESTA BASICA')) {
    return 'va';
  }
  if (upper.includes('VALE TRANSPORTE')) {
    return 'vt';
  }
  if (upper.includes('EMPR.:') || upper.includes('PROVENTOS') || upper.includes('HOLERITE')) {
    return 'extrato_mensal';
  }
  if (/\b\d{3,4}\s+[\d,\.]+[DC]\b/.test(text.slice(0, 2000))) {
    return 'extrato_mensal';
  }
  return 'unknown';
}

/** Extrai empresa do texto (pdf-parse coloca no final). Ex: "DZM - AGOSTO/2026" */
function extractEmpresa(text: string): string {
  const m = text.match(
    /^([A-Z][A-Z\s\.]+?)\s*-\s*(JANEIRO|FEVEREIRO|MAR|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)/im
  );
  return m ? m[1].trim() : 'DZM';
}

// ─── Parser: VA (Vale Alimentação / Refeição / Cesta Básica) ──────────────────
//
// Formato real do pdf-parse (Node.js):
//   "1Flavio Pereira da Silva320,00R$                    "
//   "14Irailde Rodrigues da Silva820,00R$                 "
//   "TOTAL GERAL: 4.980,00R$                        "
//
// ⚠️ O valor (ex: '320,00') está IMEDIATAMENTE ANTES do 'R$', colado ao nome.
// Regex: número_seq + nome_completo (greedy mínimo) + valor_monetário + R$

function parseVa(text: string): { employees: ExtractedOutsourcingEmployee[]; totalGeral: number } {
  const lines = text.split('\n');
  const employees: ExtractedOutsourcingEmployee[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(COLABORADOR:|TOTAL\s+GERAL|SEGUNDA|SÁBADO|SABADO|VALE\s+ALIMENTA|VALE\s+REFEIC|CESTA|DZM|MAR\s*BRASIL)/i.test(trimmed)) continue;

    // Padrão: sequência + nome colado ao valor + R$
    // Ex: "1Flavio Pereira da Silva320,00R$"
    // Ex: "3Olavo Carvalho de Jesus Montte Carlos 320,00R$" (com espaço antes do valor)
    // Ex: "14Irailde Rodrigues da Silva820,00R$"
    const m = trimmed.match(/^(\d+)\s*(.+?)\s*((?:\d{1,3}\.?)?\d+,\d{2})R\$/);
    if (m) {
      const nome = m[2].trim();
      const valorVR = cleanNum(m[3]);
      if (nome && valorVR > 0) {
        employees.push({
          name: nome, cpf: '', employeeType: 'CLT',
          valorBruto: 0, valorDesconto: 0, valorLiquido: 0,
          valorVR, valorVT: 0, valorFGTS: 0, valorGPS: 0,
          valorAjudaCusto: 0, valorEmprestimo: 0, salarioFamilia: 0, valorFaltas: 0,
        });
      }
    }
  }

  // Total geral — formato: "TOTAL GERAL: 4.980,00R$"
  const totalMatch = text.match(/TOTAL\s+GERAL:\s*([\d\.]+,\d{2})R?\$?/i);
  const totalGeral = totalMatch ? cleanNum(totalMatch[1]) : 0;

  return { employees, totalGeral };
}

// ─── Parser: VT (Vale Transporte) ─────────────────────────────────────────────
//
// Formato real do pdf-parse (Node.js) — seção SÁBADO:
//   Cabeçalho: "COLABORADOR:QTD SABADO ONIBUS 1 ... TOTAL SÁBADO TOTAL Á PAGAR"
//   Linha: "1 Andrea Aparecida de Oliveira Ferreira 55,25R$ 2-R$ -R$ 10,50R$ 52,50R$ 273,00R$"
//   → O TOTAL A PAGAR é o último valor positivo (NN,NN) antes de R$ na linha.
//
// ⚠️ Colaboradores sem VT sábado: "9 Gustavo Dias de Oliveira 0-R$ 0-R$ -R$ ..." 
//    → Ainda assim têm valor em TOTAL A PAGAR (ex: 220,50 da seção SEG-SEX).
//
// Estratégia para o NOME:
//   Entre o número sequencial e a primeira ocorrência de um valor+R$ na linha.
//   Limpeza: remover sufixos de quantidade (dígito solto no final do nome).

function parseVt(text: string): { employees: ExtractedOutsourcingEmployee[]; totalGeral: number } {
  const lines = text.split('\n');
  const employees: ExtractedOutsourcingEmployee[] = [];

  // Encontrar cabeçalho da seção SÁBADO
  let sabadoHeaderIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const upper = lines[i].toUpperCase();
    if ((upper.includes('SABADO') || upper.includes('SÁBADO')) && upper.includes('TOTAL')) {
      sabadoHeaderIdx = i;
      break;
    }
  }

  const startLine = sabadoHeaderIdx >= 0 ? sabadoHeaderIdx + 1 : 2;

  // Total geral: última linha com TOTAL GERAL + R$ (a da seção SÁBADO tem 3 valores)
  let totalGeral = 0;
  const totalLines = lines.filter(l => /TOTAL\s+GERAL/i.test(l) && /R\$/.test(l));
  if (totalLines.length > 0) {
    const lastTotal = totalLines[totalLines.length - 1];
    const allVals = [...lastTotal.matchAll(/([\d\.]+,\d{2})R\$/g)];
    if (allVals.length > 0) {
      totalGeral = cleanNum(allVals[allVals.length - 1][1]);
    }
  }

  // Processar linhas da seção SÁBADO
  for (let i = startLine; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (/^(TOTAL\s+GERAL|DZM|MAR|VALE\s+TRANSPORTE|SEGUNDA|COLABORADOR:|QTD\s+SAB)/i.test(trimmed)) continue;
    if (/^(SÁBADO|SABADO)$/i.test(trimmed)) continue;

    // Extrair todos os valores NN,NNR$ (positivos) da linha
    const allVals = [...trimmed.matchAll(/((?:\d{1,3}\.?)?\d+,\d{2})R\$/g)]
      .map(v => cleanNum(v[1]))
      .filter(v => v > 0);

    if (allVals.length === 0) continue;

    const valorVT = allVals[allVals.length - 1]; // último = TOTAL A PAGAR

    // Extrair nome: da posição após o número sequencial até antes do primeiro valor+R$
    // Inclui padrões negativos/zero como "0-R$" para casos como Gustavo (sem VT sábado)
    const firstRsIdx = trimmed.search(/(?:(?:\d{1,3}\.?)?\d+,\d{2}|\d+-?)R\$/);

    if (firstRsIdx <= 0) continue;

    // Substring do início até o primeiro valor: "N Nome NVALOR..."
    const beforeFirstVal = trimmed.slice(0, firstRsIdx);
    // Remover o número sequencial do início e espaços
    let nome = beforeFirstVal.replace(/^\d+\s*/, '').trim();
    // Remover dígito solto no final (quantidade de ônibus): "... Ferreira 5" → "... Ferreira"
    nome = nome.replace(/\s+\d+\s*$/, '').trim();
    // Remover hífen ou traço solto no final
    nome = nome.replace(/[-\s]+$/, '').trim();

    if (nome && nome.length >= 3 && valorVT > 0) {
      employees.push({
        name: nome, cpf: '', employeeType: 'CLT',
        valorBruto: 0, valorDesconto: 0, valorLiquido: 0,
        valorVR: 0, valorVT, valorFGTS: 0, valorGPS: 0,
        valorAjudaCusto: 0, valorEmprestimo: 0, salarioFamilia: 0, valorFaltas: 0,
      });
    }
  }

  return { employees, totalGeral };
}

// ─── Parser: Extrato Mensal (holerites CLT — Domínio / Realcontabil) ──────────

function parseExtratoMensal(text: string): { employees: ExtractedOutsourcingEmployee[]; empresa: string } {
  let empresa = 'D.Z.M LTDA';
  const filialMatch = text.match(/Filial:\s*([^\r\n]+)/i);
  const empMatch = text.match(/(\d+\s*-\s*[A-Z0-9\.\s]+(?:LTDA|S\/A|ME|EPP))/i);
  if (empMatch) empresa = empMatch[1].trim();
  else if (filialMatch) empresa = filialMatch[1].trim();

  const employees: ExtractedOutsourcingEmployee[] = [];
  const regexSplit = /(\d+\s*[A-ZÀ-Ú\s]{3,}Empr\.?:)/g;
  const parts = text.split(regexSplit);

  for (let i = 1; i < parts.length; i += 2) {
    const header = parts[i];
    let body = parts[i + 1] || '';
    if (body.includes('Resumo por Rubricas')) body = body.split('Resumo por Rubricas')[0];
    if (body.includes('Data de pagamento')) body = body.split('Data de pagamento')[0];
    const fullBlock = header + body;

    const nameMatch = header.match(/^\d+\s*([A-ZÀ-Ú\s]+?)Empr\.?:/);
    let rawName = nameMatch ? nameMatch[1].trim() : 'Desconhecido';
    rawName = rawName.replace(/Situa[çc][ãa]o.*$/i, '').replace(/CPF:.*$/i, '').trim();

    const cpfMatch = fullBlock.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
    const cpf = cpfMatch ? cpfMatch[1] : '';

    const vinculoMatch = fullBlock.match(/(Celetista|Estagi[áa]rio|Prazo\s+det[^\r\n]+|PJ|Prestador)/i);
    let vinculo: 'CLT' | 'PJ' | 'Estagio' | 'Outro' = 'CLT';
    if (vinculoMatch) {
      const v = vinculoMatch[1].toLowerCase();
      if (v.includes('estag')) vinculo = 'Estagio';
      else if (v.includes('pj') || v.includes('prestador')) vinculo = 'PJ';
    }

    const cargoMatch = fullBlock.match(/Cargo:?\s*(\d+[^\r\n\d]+)/i);
    const cargo = cargoMatch ? cargoMatch[1].replace(/^\d+/, '').trim() : '';

    const provMatch = fullBlock.match(/Proventos:?\s*([\d\.,]+)/i);
    const bruto = provMatch ? cleanNum(provMatch[1]) : 0;
    const descMatch = fullBlock.match(/Descontos:?\s*([\d\.,]+)/i);
    const desconto = descMatch ? cleanNum(descMatch[1]) : 0;
    let liquido = cleanNum(bruto - desconto);
    const directLiq = fullBlock.match(/L[íi]quido:?\s*([\d\.,]+)/i);
    if (directLiq) { const l = cleanNum(directLiq[1]); if (l > 0) liquido = l; }

    const fgtsMatch = fullBlock.match(/Valor\s+FGTS:?\s*([\d\.,]+)/i) || fullBlock.match(/Informativa:?\s*([\d\.,]+)/i);
    const fgts = fgtsMatch ? cleanNum(fgtsMatch[1]) : 0;
    const vtMatch = fullBlock.match(/(?:^|[^\d])48\s*([\d\.,]+)D/i) || fullBlock.match(/VALE\s+TRANSPORTE[^\d]+([\d\.,]+)D/i);
    const vt = vtMatch ? cleanNum(vtMatch[1]) : 0;
    const inssMatch = fullBlock.match(/(?:^|[^\d])998\s*([\d\.,]+)D/i) || fullBlock.match(/I\.N\.S\.S\.[^\d]+([\d\.,]+)D/i);
    const inss = inssMatch ? cleanNum(inssMatch[1]) : 0;
    const adiantMatch = fullBlock.match(/(?:^|[^\d])981\s*([\d\.,]+)D/i) || fullBlock.match(/DESC\.ADIANT\.SALARIAL\s*([\d\.,]+)/i);
    const adiantamento = adiantMatch ? cleanNum(adiantMatch[1]) : 0;
    let emprestimo = 0;
    const empMatches = fullBlock.matchAll(/(?:^|[^\d])(?:201|203|206|9750)\s*([\d\.,]+)D/gi);
    for (const em of empMatches) emprestimo += cleanNum(em[1]);
    const sfMatch = fullBlock.match(/(?:^|[^\d])995\s*([\d\.,]+)P/i);
    const salarioFamilia = sfMatch ? cleanNum(sfMatch[1]) : 0;
    let faltas = 0;
    const faltasMatches = fullBlock.matchAll(/(?:8792|8794)\s*([\d\.,]+)D\s*DIAS\s+FALTAS/gi);
    for (const fm of faltasMatches) faltas += cleanNum(fm[1]);

    employees.push({
      name: rawName, cpf, employeeType: vinculo, cargo,
      valorBruto: bruto, valorDesconto: desconto, valorLiquido: liquido,
      valorVR: 0, valorVT: vt, valorFGTS: fgts, valorGPS: inss,
      valorAjudaCusto: adiantamento, valorEmprestimo: emprestimo,
      salarioFamilia, valorFaltas: cleanNum(faltas),
    });
  }

  return { employees, empresa };
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

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
    const text = data.text as string;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Não foi possível extrair texto do PDF.' }, { status: 422 });
    }

    const competencia = extractCompetencia(text);
    const docType = detectDocType(text);
    const empresa = extractEmpresa(text);

    // ── VA ─────────────────────────────────────────────────────────────────────
    if (docType === 'va') {
      const { employees, totalGeral } = parseVa(text);
      if (employees.length === 0) {
        return NextResponse.json(
          { error: 'Nenhum colaborador identificado no PDF de VA. Verifique se o arquivo é o relatório correto de Vale Alimentação/Refeição.' },
          { status: 422 }
        );
      }
      return NextResponse.json({ success: true, docType: 'va', competencia, empresa, totalParsed: employees.length, totalGeral, employees });
    }

    // ── VT ─────────────────────────────────────────────────────────────────────
    if (docType === 'vt') {
      const { employees, totalGeral } = parseVt(text);
      if (employees.length === 0) {
        return NextResponse.json(
          { error: 'Nenhum colaborador identificado no PDF de VT. Verifique se o arquivo é o relatório correto de Vale Transporte.' },
          { status: 422 }
        );
      }
      return NextResponse.json({ success: true, docType: 'vt', competencia, empresa, totalParsed: employees.length, totalGeral, employees });
    }

    // ── Extrato Mensal (holerites CLT — Domínio / Realcontabil) ─────────────────
    const { employees, empresa: empName } = parseExtratoMensal(text);
    if (employees.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum colaborador ou verba foi identificado no Extrato Mensal PDF.' },
        { status: 422 }
      );
    }
    return NextResponse.json({ success: true, docType: 'extrato_mensal', competencia, empresa: empName, totalParsed: employees.length, employees });

  } catch (error: any) {
    console.error('Erro ao processar PDF:', error);
    return NextResponse.json(
      { error: `Erro no processamento do PDF: ${error?.message || 'Arquivo corrompido ou formato incompatível.'}` },
      { status: 500 }
    );
  }
}
