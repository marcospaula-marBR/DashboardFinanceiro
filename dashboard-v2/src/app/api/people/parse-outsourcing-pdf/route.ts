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
 * Limpa valores monetários com espaços espúrios gerados pelo PDF.
 * Exemplos:
 *   'R$ 3 20,00' → 320.00
 *   'R$ 4 51,25' → 451.25
 *   'R$ 6 .649,65' → 6649.65
 *   '320,00' → 320.00
 */
function cleanNum(val: any): number {
  if (!val) return 0;
  let s = String(val).trim();
  s = s.replace(/R\$\s*/gi, '').trim();
  // Remove espaços entre dígitos (artefato do PDF): '3 20' → '320'
  s = s.replace(/(\d)\s+(\d)/g, '$1$2');
  // Trata milhar com ponto+espaço: '6 .649' → '6649' (já resolvido acima, mas garante)
  s = s.replace(/(\d)\s*\.\s*(\d{3})/g, '$1$2');
  // Formato BR → float: '320,00' → '320.00'
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
  return isNaN(n) ? 0 : parseFloat(n.toFixed(2));
}

/** Mapeia nome de mês por extenso para número MM */
const MONTHS_MAP: Record<string, string> = {
  JANEIRO: '01', FEVEREIRO: '02', MARCO: '03', ABRIL: '04',
  MAIO: '05', JUNHO: '06', JULHO: '07', AGOSTO: '08',
  SETEMBRO: '09', OUTUBRO: '10', NOVEMBRO: '11', DEZEMBRO: '12',
};

/** Extrai competência (YYYY-MM) do texto, suportando formatos numéricos e por extenso */
function extractCompetencia(text: string): string {
  // Formato numérico: 08/2026
  const numMatch = text.match(/Compet[êe]ncia:?\s*(\d{2}\/\d{4})/i)
    || text.match(/(\d{2}\/\d{4})/);
  if (numMatch) {
    const [m, y] = numMatch[1].split('/');
    return `${y}-${m}`;
  }
  // Formato por extenso: AGOSTO/2026 ou AGOSTO 2026
  const extMatch = text.match(
    /(JANEIRO|FEVEREIRO|MAR[CÇ]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)[\/\-\s]+(\d{4})/i
  );
  if (extMatch) {
    const key = extMatch[1].toUpperCase().replace('Ç', 'C').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = MONTHS_MAP[key] ?? '01';
    return `${extMatch[2]}-${month}`;
  }
  return new Date().toISOString().slice(0, 7);
}

/** Detecta o tipo de documento PDF pelo conteúdo do cabeçalho */
function detectDocType(text: string): PdfDocType {
  const header = text.slice(0, 500).toUpperCase();
  if (header.includes('VALE ALIMENTA') || header.includes('VALE REFEIC') || header.includes('CESTA BASICA')) {
    return 'va';
  }
  if (header.includes('VALE TRANSPORTE')) {
    return 'vt';
  }
  // Heurística do Extrato Mensal (Domínio/Realcontabil): tem rubricas numéricas
  if (header.includes('EMPR.:') || header.includes('PROVENTOS') || header.includes('HOLERITE')) {
    return 'extrato_mensal';
  }
  // Fallback: se tem estrutura de rubricas (ex: "48 220,00D") → extrato
  if (/\b\d{3,4}\s+[\d,\.]+[DC]\b/.test(text.slice(0, 2000))) {
    return 'extrato_mensal';
  }
  return 'unknown';
}

// ─── Parser: VA (Vale Alimentação / Refeição / Cesta Básica) ──────────────────

function parseVa(text: string): { employees: ExtractedOutsourcingEmployee[]; totalGeral: number } {
  const lines = text.split('\n');
  const employees: ExtractedOutsourcingEmployee[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/TOTAL|COLABORADOR:|SEGUNDA|S[AÁ]BADO|VALE\s+ALIMENTA|VALE\s+REFEI|CESTA/i.test(trimmed)) continue;

    // Padrão: N Nome completo R$ valor
    // Ex: '1 Flavio Pereira da Silva R$ 3 20,00'
    // Ex: '14 Irailde Rodrigues da Silva R$ 8 20,00'
    const m = trimmed.match(/^\d+\s+(.+?)\s+R\$\s*([\d\s,\.]+)$/);
    if (m) {
      const nome = m[1].trim();
      const valorVR = cleanNum(m[2]);
      if (nome && valorVR > 0) {
        employees.push({
          name: nome,
          cpf: '',
          employeeType: 'CLT',
          valorBruto: 0,
          valorDesconto: 0,
          valorLiquido: 0,
          valorVR,
          valorVT: 0,
          valorFGTS: 0,
          valorGPS: 0,
          valorAjudaCusto: 0,
          valorEmprestimo: 0,
          salarioFamilia: 0,
          valorFaltas: 0,
        });
      }
    }
  }

  // Extrair total geral para validação
  const totalMatch = text.match(/TOTAL\s+GERAL:\s*R\$\s*([\d\s,\.]+)/i);
  const totalGeral = totalMatch ? cleanNum(totalMatch[1]) : 0;

  return { employees, totalGeral };
}

// ─── Parser: VT (Vale Transporte) ─────────────────────────────────────────────

function parseVt(text: string): { employees: ExtractedOutsourcingEmployee[]; totalGeral: number } {
  const lines = text.split('\n');
  const employees: ExtractedOutsourcingEmployee[] = [];

  // O VT tem duas seções: SEG-SEX e SÁBADO.
  // A coluna "TOTAL A PAGAR" só existe na seção SÁBADO (última coluna).
  // Se não houver seção SÁBADO, usa a última coluna da seção SEG-SEX.

  let sabadoStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^S[ÁA]BADO\s*$/i.test(lines[i].trim())) {
      sabadoStartIdx = i;
      break;
    }
  }

  const parseSection = (sectionLines: string[]): Map<string, number> => {
    const result = new Map<string, number>();
    for (const line of sectionLines) {
      const trimmed = line.trim();
      if (!trimmed || /TOTAL\s+GERAL|COLABORADOR:|^S[ÁA]BADO/i.test(trimmed)) continue;

      // Padrão: N Nome 5 R$ valor ... R$ total
      // Ex: '1Andrea Aparecida de Oliveira Ferreira 5 R$ 5,25 2 R$ - R$ - R$ 10,50 R$ 52,50 R$ 273,00'
      const m = trimmed.match(/^\d+(.+?)\s+\d+\s+R\$/);
      if (!m) continue;

      const nome = m[1].trim();
      if (!nome) continue;

      // Extrai todos os valores R$ da linha
      const allVals: string[] = [];
      const rx = /R\$\s*([\d\s,\.]+)/g;
      let match: RegExpExecArray | null;
      while ((match = rx.exec(trimmed)) !== null) {
        allVals.push(match[1].trim());
      }

      // Filtra valores positivos (ignora '-')
      const numericVals = allVals
        .map(v => cleanNum(v))
        .filter(v => v > 0);

      if (numericVals.length > 0) {
        const lastVal = numericVals[numericVals.length - 1];
        result.set(nome, lastVal);
      }
    }
    return result;
  };

  let vtMap: Map<string, number>;

  if (sabadoStartIdx >= 0) {
    // Seção SÁBADO: tem a coluna TOTAL A PAGAR (valor mais à direita)
    vtMap = parseSection(lines.slice(sabadoStartIdx + 1));
  } else {
    // Sem seção SÁBADO: usa seção SEG-SEX (última coluna = TOTAL SEG A SEXTA)
    vtMap = parseSection(lines);
  }

  // Extrair total geral (última ocorrência de TOTAL GERAL)
  let totalGeral = 0;
  const totalMatches = [...text.matchAll(/TOTAL\s+GERAL:\s*(.+)/gi)];
  if (totalMatches.length > 0) {
    const lastTotal = totalMatches[totalMatches.length - 1][1];
    const allTotValores = [...lastTotal.matchAll(/R\$\s*([\d\s,\.]+)/g)];
    if (allTotValores.length > 0) {
      totalGeral = cleanNum(allTotValores[allTotValores.length - 1][1]);
    }
  }

  for (const [nome, valorVT] of vtMap.entries()) {
    employees.push({
      name: nome,
      cpf: '',
      employeeType: 'CLT',
      valorBruto: 0,
      valorDesconto: 0,
      valorLiquido: 0,
      valorVR: 0,
      valorVT,
      valorFGTS: 0,
      valorGPS: 0,
      valorAjudaCusto: 0,
      valorEmprestimo: 0,
      salarioFamilia: 0,
      valorFaltas: 0,
    });
  }

  return { employees, totalGeral };
}

// ─── Parser: Extrato Mensal (holerites CLT) ───────────────────────────────────

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

    // ── VA ─────────────────────────────────────────────────────────────────────
    if (docType === 'va') {
      const { employees, totalGeral } = parseVa(text);
      if (employees.length === 0) {
        return NextResponse.json(
          { error: 'Nenhum colaborador identificado no PDF de VA.' },
          { status: 422 }
        );
      }

      // Extrai empresa (linha antes do mês: "DZM - AGOSTO/2026")
      const empM = text.match(/^(.+?)\s*-\s*(JANEIRO|FEVEREIRO|MAR|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)/im);
      const empresa = empM ? empM[1].trim() : 'DZM';

      return NextResponse.json({
        success: true,
        docType: 'va',
        competencia,
        empresa,
        totalParsed: employees.length,
        totalGeral,
        employees,
      });
    }

    // ── VT ─────────────────────────────────────────────────────────────────────
    if (docType === 'vt') {
      const { employees, totalGeral } = parseVt(text);
      if (employees.length === 0) {
        return NextResponse.json(
          { error: 'Nenhum colaborador identificado no PDF de VT.' },
          { status: 422 }
        );
      }

      const empM = text.match(/^(.+?)\s*-\s*(JANEIRO|FEVEREIRO|MAR|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)/im);
      const empresa = empM ? empM[1].trim() : 'DZM';

      return NextResponse.json({
        success: true,
        docType: 'vt',
        competencia,
        empresa,
        totalParsed: employees.length,
        totalGeral,
        employees,
      });
    }

    // ── Extrato Mensal (holerites) ─────────────────────────────────────────────
    const { employees, empresa } = parseExtratoMensal(text);

    if (employees.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum colaborador ou verba foi identificado no Extrato Mensal PDF.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      docType: 'extrato_mensal',
      competencia,
      empresa,
      totalParsed: employees.length,
      employees,
    });
  } catch (error: any) {
    console.error('Erro ao processar PDF:', error);
    return NextResponse.json(
      { error: `Erro no processamento do PDF: ${error?.message || 'Arquivo corrompido ou formato incompatível.'}` },
      { status: 500 }
    );
  }
}
