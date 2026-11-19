import { XMLParser } from 'fast-xml-parser';

export interface ParsedRubrica {
  codigo: string;
  descricao: string;
  valor: number;
}

export interface ParsedPayrollRecord {
  matricula?: string;
  name: string;
  cpf: string;
  cargo?: string;
  empresa?: string;
  situation?: string;
  admission_date?: string;
  valor_fixo: number;
  valor_hora_extra: number;
  valor_adicional_not: number;
  salario_familia: number;
  valor_ferias: number;
  valor_decimo_terceiro: number;
  valor_rescisao: number;
  valor_outros_recebidos: number;
  valor_holerite: number;
  inss_empregado: number;
  irrf_empregado: number;
  desconto_vt_6: number;
  desconto_adiantamento_folha: number;
  valor_adiantamento: number;
  valor_faltas: number;
  dias_faltas: number;
  valor_consignado: number;
  valor_pensao_alimenticia: number;
  banco_horas: number;
  valor_descontos: number;
  valor_folha_liquido: number;
  valor_fgts: number;
  valor_vt: number;
  valor_vr: number;
  valor_cesta: number;
  valor_bonus: number;
  valor_premiacao?: number;
  valor_ajuda_custo: number;
  rubricas_proventos?: ParsedRubrica[];
  rubricas_descontos?: ParsedRubrica[];
  observacao?: string;
}

export interface ParsedBenefitRecord {
  matricula?: string;
  name: string;
  cpf: string;
  cargo?: string;
  valor: number;
  valor_vt: number;
  valor_vr: number;
  valor_cesta: number;
  valor_bonus: number;
  valor_premiacao: number;
  valor_ajuda_custo: number;
  observacao?: string;
}

export interface ParsedNfseRecord {
  numeroNf: string;
  dataEmissao: string;
  competencia: string;
  prestadorCnpj: string;
  prestadorRazaoSocial: string;
  tomadorCnpj: string;
  tomadorRazaoSocial: string;
  valorServicos: number;
  valorDeducoes: number;
  valorDesconto: number;
  valorIssRetido: number;
  valorIr: number;
  valorCsll: number;
  valorPis: number;
  valorCofins: number;
  valorInss: number;
  totalRetencoes: number;
  valorLiquidoNfse: number;
  discriminacao: string;
}

export interface DeterministicParseResult<T> {
  matched: boolean;
  reason?: string;
  competencia: string;
  empresa: string;
  records: T[];
  totalCheck?: {
    expected?: number;
    extracted: number;
    consistent: boolean;
  };
}

const MONTHS_MAP: Record<string, string> = {
  JANEIRO: '01',
  FEVEREIRO: '02',
  MARCO: '03',
  ABRIL: '04',
  MAIO: '05',
  JUNHO: '06',
  JULHO: '07',
  AGOSTO: '08',
  SETEMBRO: '09',
  OUTUBRO: '10',
  NOVEMBRO: '11',
  DEZEMBRO: '12',
};

export function round2(val: unknown): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseBrCurrency(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? round2(val) : 0;
  if (!val) return 0;
  let s = String(val).trim().replace(/R\$\s*/gi, '').replace(/\s+/g, '');
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
  return Number.isFinite(n) ? round2(n) : 0;
}

export function normalizeDetectedCompany(raw: string | null | undefined): string {
  const upper = String(raw || '').trim().toUpperCase();
  if (!upper) return '';
  if (upper.includes('D.Z.M') || upper.includes('DZM')) return 'DZM';
  if (upper.includes('MAR BRASIL') || upper.includes('MARBR')) return 'MarBR';
  if (upper.includes('G2')) return 'G2';
  return '';
}

export function extractCompetenciaFromText(text: string): string {
  if (!text) return '';
  const headerMatch =
    text.match(/Compet[êe]ncia:?\s*(\d{2}\/\d{4})/i) ||
    text.match(/EXTRATO\s+MENSAL\s*[\r\n]+\s*(\d{2}\/\d{4})/i) ||
    text.match(/(\d{2}\/\d{4})\s*[\r\n]+\s*Empresa:/i) ||
    text.match(/Refer[êe]ncia:?\s*(\d{2}\/\d{4})/i);
  if (headerMatch) {
    const [m, y] = headerMatch[1].split('/');
    if (Number(m) >= 1 && Number(m) <= 12) return `${y}-${m}-01`;
  }

  const extMatch = text.match(
    /(JANEIRO|FEVEREIRO|MAR[CÇ]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s*(?:DE|[\/\-])\s*(\d{4})/i
  );
  if (extMatch) {
    const key = extMatch[1].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = MONTHS_MAP[key];
    if (month) return `${extMatch[2]}-${month}-01`;
  }

  const numMatch = text.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/);
  if (numMatch) {
    return `${numMatch[2]}-${numMatch[1]}-01`;
  }

  return '';
}

export function isAdiantamentoSalarialRubrica(codigo?: string, descricao?: string): boolean {
  const cod = String(codigo || '').replace(/\D/g, '');
  const desc = String(descricao || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s.\-_]+/g, '');
  if (desc.includes('ferias')) return false;
  return (
    cod === '981' ||
    desc.includes('descadiantsalarial') ||
    desc.includes('descadiantamento') ||
    desc.includes('adiantsalarial') ||
    desc.includes('adiantamentosalarial')
  );
}

/**
 * Sanitizador contábil determinístico aplicado a qualquer extração (determinística ou IA):
 * - Garante valor_vt = 0 na folha mensal (rubrica 48 é estritamente desconto em desconto_vt_6).
 * - Auto-cura adiantamento salarial estritamente a partir da rubrica 981 / desc.adiant.salarial.
 * - Normaliza todos os campos monetários com 2 casas decimais e sem NaN.
 */
export function sanitizeParsedPayrollRecords(
  records: Partial<ParsedPayrollRecord>[],
  mode: 'payroll' | 'advance' | 'benefits' | 'bonus' = 'payroll',
  defaultCompany = ''
): ParsedPayrollRecord[] {
  if (!Array.isArray(records)) return [];

  return records
    .filter((rec) => rec && String(rec.name || '').trim().length > 0)
    .map((rec) => {
      const rubricasProventos = Array.isArray(rec.rubricas_proventos)
        ? rec.rubricas_proventos.map((r) => ({
            codigo: String(r?.codigo || '').trim(),
            descricao: String(r?.descricao || '').trim(),
            valor: round2(r?.valor || 0),
          }))
        : [];
      const rubricasDescontos = Array.isArray(rec.rubricas_descontos)
        ? rec.rubricas_descontos.map((r) => ({
            codigo: String(r?.codigo || '').trim(),
            descricao: String(r?.descricao || '').trim(),
            valor: round2(r?.valor || 0),
          }))
        : [];

      let adiant = round2(rec.valor_adiantamento || rec.desconto_adiantamento_folha || 0);
      if (adiant === 0 && rubricasDescontos.length > 0) {
        const found = rubricasDescontos.find((d) => isAdiantamentoSalarialRubrica(d.codigo, d.descricao));
        if (found && found.valor > 0) {
          adiant = found.valor;
        }
      }

      const valorHolerite = round2(rec.valor_holerite || rec.valor_fixo || 0);
      const valorDescontos = round2(rec.valor_descontos || 0);
      const folhaLiq = round2(
        rec.valor_folha_liquido !== undefined && Number(rec.valor_folha_liquido) > 0
          ? rec.valor_folha_liquido
          : Math.max(0, valorHolerite - valorDescontos)
      );

      const empresaNorm = normalizeDetectedCompany(rec.empresa) || defaultCompany || undefined;

      return {
        matricula: rec.matricula ? String(rec.matricula).trim() : '',
        name: String(rec.name || '').trim(),
        cpf: String(rec.cpf || '').trim(),
        cargo: String(rec.cargo || '').trim(),
        empresa: empresaNorm,
        situation: rec.situation ? String(rec.situation).trim() : 'Trabalhando',
        admission_date: rec.admission_date ? String(rec.admission_date).trim() : '',
        valor_fixo: round2(rec.valor_fixo || valorHolerite),
        valor_hora_extra: round2(rec.valor_hora_extra || 0),
        valor_adicional_not: round2(rec.valor_adicional_not || 0),
        salario_familia: round2(rec.salario_familia || 0),
        valor_ferias: round2(rec.valor_ferias || 0),
        valor_decimo_terceiro: round2(rec.valor_decimo_terceiro || 0),
        valor_rescisao: round2(rec.valor_rescisao || 0),
        valor_outros_recebidos: round2(rec.valor_outros_recebidos || 0),
        valor_holerite: valorHolerite,
        inss_empregado: round2(rec.inss_empregado || 0),
        irrf_empregado: round2(rec.irrf_empregado || 0),
        desconto_vt_6: round2(rec.desconto_vt_6 || 0),
        desconto_adiantamento_folha: adiant,
        valor_adiantamento: adiant,
        valor_faltas: round2(rec.valor_faltas || 0),
        dias_faltas: round2(rec.dias_faltas || 0),
        valor_consignado: round2(rec.valor_consignado || 0),
        valor_pensao_alimenticia: round2(rec.valor_pensao_alimenticia || 0),
        banco_horas: round2(rec.banco_horas || 0),
        valor_descontos: valorDescontos,
        valor_folha_liquido: folhaLiq,
        valor_fgts: round2(rec.valor_fgts || 0),
        // Regra estrita: folha mensal nunca preenche crédito VT (rubrica 48 é desconto)
        valor_vt: mode === 'payroll' ? 0 : round2(rec.valor_vt || 0),
        valor_vr: mode === 'payroll' ? 0 : round2(rec.valor_vr || 0),
        valor_cesta: mode === 'payroll' ? 0 : round2(rec.valor_cesta || 0),
        valor_bonus: round2(rec.valor_bonus || 0),
        valor_premiacao: round2(rec.valor_premiacao || 0),
        valor_ajuda_custo: round2(rec.valor_ajuda_custo || 0),
        rubricas_proventos: rubricasProventos,
        rubricas_descontos: rubricasDescontos,
        observacao: String(rec.observacao || (mode === 'payroll' ? 'Folha Oficial CLT' : '')).trim(),
      };
    });
}

/**
 * Camada 1 Determinística (< 50ms): Parser de Extrato Mensal da Folha (Domínio Sistemas / Realcontábil).
 * Valida integridade contábil (Proventos - Descontos = Líquido) em cada registro;
 * se o layout não for reconhecido ou falhar no check contábil, retorna matched: false para fallback à IA.
 */
export function parseDominioPayrollText(text: string): DeterministicParseResult<ParsedPayrollRecord> {
  if (!text || text.trim().length < 80) {
    return { matched: false, reason: 'PDF sem camada de texto suficiente (possível documento escaneado).', competencia: '', empresa: '', records: [] };
  }

  const upper = text.toUpperCase();
  const hasDominioMarkers =
    upper.includes('EMPR.:') ||
    upper.includes('EMPR:') ||
    /\b\d+\s*[A-ZÀ-Ú\s]{3,}EMPR\.?:/i.test(text);

  if (!hasDominioMarkers) {
    return { matched: false, reason: 'Layout não identificado como Extrato Domínio Sistemas.', competencia: '', empresa: '', records: [] };
  }

  const competencia = extractCompetenciaFromText(text);
  const empHeaderMatch =
    text.match(/(\d+\s*-\s*[A-Z0-9.\s]+(?:LTDA|S\/A|ME|EPP))/i) ||
    text.match(/Empresa:?\s*([^\r\n]+)/i) ||
    text.match(/Filial:?\s*([^\r\n]+)/i);
  const empresa = normalizeDetectedCompany(empHeaderMatch ? empHeaderMatch[1] : text.slice(0, 400)) || '';

  const regexSplit = /(\d+\s*[A-ZÀ-Ú][A-ZÀ-Ú\s]{2,}Empr\.?:)/g;
  const parts = text.split(regexSplit);

  if (parts.length < 3) {
    return { matched: false, reason: 'Nenhum bloco de colaborador Domínio encontrado.', competencia, empresa, records: [] };
  }

  const rawRecords: ParsedPayrollRecord[] = [];
  let accountingValidCount = 0;

  for (let i = 1; i < parts.length; i += 2) {
    const header = parts[i];
    let body = parts[i + 1] || '';
    if (body.includes('Resumo por Rubricas')) body = body.split('Resumo por Rubricas')[0];
    if (body.includes('Total Geral')) body = body.split('Total Geral')[0];
    if (body.includes('Data de pagamento')) body = body.split('Data de pagamento')[0];

    const fullBlock = header + body;
    const matMatch = header.match(/^(\d+)\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)Empr\.?:/);
    const matricula = matMatch ? matMatch[1].trim() : '';
    let rawName = matMatch ? matMatch[2].trim() : '';
    rawName = rawName.replace(/Situa[çc][ãa]o.*$/i, '').replace(/CPF:.*$/i, '').trim();
    if (!rawName || rawName.length < 3) continue;

    const cpfMatch = fullBlock.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
    const cpf = cpfMatch ? cpfMatch[1] : '';

    const cargoMatch = fullBlock.match(/Cargo:?\s*(?:\d+\s*[-–]?\s*)?([A-ZÀ-Úa-zà-ú0-9\s/.-]{3,60}?)(?=\s+(?:C\.?B\.?O|Admiss|Depto|Setor|Situa|CPF|\r|\n))/i);
    const cargo = cargoMatch ? cargoMatch[1].trim() : '';

    const sitMatch = fullBlock.match(/Situa[çc][ãa]o:?\s*([A-ZÀ-Úa-zà-ú\s]{3,25}?)(?=\s+(?:CPF|Cargo|Admiss|\r|\n))/i);
    const situation = sitMatch ? sitMatch[1].trim() : 'Trabalhando';

    const provMatch = fullBlock.match(/Proventos:?\s*([\d.,]+)/i);
    const valorHolerite = provMatch ? parseBrCurrency(provMatch[1]) : 0;

    const descMatch = fullBlock.match(/Descontos:?\s*([\d.,]+)/i);
    const valorDescontos = descMatch ? parseBrCurrency(descMatch[1]) : 0;

    const liqMatch = fullBlock.match(/L[íi]quido:?\s*([\d.,]+)/i);
    const parsedLiquido = liqMatch ? parseBrCurrency(liqMatch[1]) : round2(Math.max(0, valorHolerite - valorDescontos));

    // Verificação contábil estrita: Proventos - Descontos == Líquido (tolerância de R$ 0,05)
    const expectedLiq = round2(valorHolerite - valorDescontos);
    if (valorHolerite > 0 && Math.abs(expectedLiq - parsedLiquido) <= 0.05) {
      accountingValidCount += 1;
    }

    // Rubricas individuais no formato Domínio: CODIGO VALOR (P|D) DESCRICAO ou CODIGO DESCRICAO VALOR (P|D)
    const rubricasProventos: ParsedRubrica[] = [];
    const rubricasDescontos: ParsedRubrica[] = [];
    const rubricaRegexA = /(?:^|[\r\n\s])(\d{1,4})\s+([\d.]+,\d{2})\s*([PD])\s+([A-ZÀ-Ú0-9.%\/\-\s]{2,40}?)(?=\s+\d{1,4}\s+[\d.]+,\d{2}\s*[PD]|\s+Proventos|\s+Descontos|\s+Base|\r|\n|$)/gi;
    for (const m of fullBlock.matchAll(rubricaRegexA)) {
      const rub: ParsedRubrica = {
        codigo: m[1].trim(),
        valor: parseBrCurrency(m[2]),
        descricao: m[4].trim(),
      };
      if (m[3].toUpperCase() === 'P') rubricasProventos.push(rub);
      else rubricasDescontos.push(rub);
    }

    const fgtsMatch = fullBlock.match(/Valor\s+FGTS:?\s*([\d.,]+)/i) || fullBlock.match(/FGTS\s+do\s+M[êe]s:?\s*([\d.,]+)/i);
    const valorFgts = fgtsMatch ? parseBrCurrency(fgtsMatch[1]) : 0;

    const vtMatch =
      fullBlock.match(/(?:^|[^\d])48\s*([\d.,]+)D/i) ||
      fullBlock.match(/VALE\s+TRANSPORTE[^\d\r\n]{0,25}([\d.,]+)D/i);
    const descontoVt6 = vtMatch ? parseBrCurrency(vtMatch[1]) : 0;

    const inssMatch =
      fullBlock.match(/(?:^|[^\d])998\s*([\d.,]+)D/i) ||
      fullBlock.match(/I\.N\.S\.S\.[^\d\r\n]{0,20}([\d.,]+)D/i);
    const inssEmpregado = inssMatch ? parseBrCurrency(inssMatch[1]) : 0;

    const irrfMatch =
      fullBlock.match(/(?:^|[^\d])999\s*([\d.,]+)D/i) ||
      fullBlock.match(/I\.R\.R\.F\.[^\d\r\n]{0,20}([\d.,]+)D/i);
    const irrfEmpregado = irrfMatch ? parseBrCurrency(irrfMatch[1]) : 0;

    const adiantMatch =
      fullBlock.match(/(?:^|[^\d])981\s*([\d.,]+)D/i) ||
      fullBlock.match(/DESC\.?\s*ADIANT\.?\s*SALARIAL[^\d\r\n]{0,15}([\d.,]+)/i);
    const valorAdiantamento = adiantMatch ? parseBrCurrency(adiantMatch[1]) : 0;

    const salBaseMatch =
      fullBlock.match(/(?:^|[^\d])1\s*([\d.,]+)P\s*(?:HORAS\s+NORMAIS|SALARIO)/i) ||
      fullBlock.match(/SAL[ÁA]RIO\s+BASE:?\s*([\d.,]+)/i);
    const valorFixo = salBaseMatch ? parseBrCurrency(salBaseMatch[1]) : valorHolerite;

    let valorHoraExtra = 0;
    for (const m of fullBlock.matchAll(/(?:^|[^\d])(?:150|151|200|8125)\s*([\d.,]+)P/gi)) {
      valorHoraExtra += parseBrCurrency(m[1]);
    }

    let valorAdicionalNot = 0;
    for (const m of fullBlock.matchAll(/(?:^|[^\d])(?:26|160)\s*([\d.,]+)P/gi)) {
      valorAdicionalNot += parseBrCurrency(m[1]);
    }

    const sfMatch = fullBlock.match(/(?:^|[^\d])995\s*([\d.,]+)P/i);
    const salarioFamilia = sfMatch ? parseBrCurrency(sfMatch[1]) : 0;

    let valorConsignado = 0;
    for (const m of fullBlock.matchAll(/(?:^|[^\d])(?:201|203|206|9750)\s*([\d.,]+)D/gi)) {
      valorConsignado += parseBrCurrency(m[1]);
    }

    let valorFaltas = 0;
    for (const m of fullBlock.matchAll(/(?:8792|8794)\s*([\d.,]+)D/gi)) {
      valorFaltas += parseBrCurrency(m[1]);
    }

    rawRecords.push({
      matricula,
      name: rawName,
      cpf,
      cargo,
      empresa: empresa || undefined,
      situation,
      valor_fixo: round2(valorFixo),
      valor_hora_extra: round2(valorHoraExtra),
      valor_adicional_not: round2(valorAdicionalNot),
      salario_familia: round2(salarioFamilia),
      valor_ferias: 0,
      valor_decimo_terceiro: 0,
      valor_rescisao: 0,
      valor_outros_recebidos: 0,
      valor_holerite: valorHolerite,
      inss_empregado: inssEmpregado,
      irrf_empregado: irrfEmpregado,
      desconto_vt_6: descontoVt6,
      desconto_adiantamento_folha: valorAdiantamento,
      valor_adiantamento: valorAdiantamento,
      valor_faltas: round2(valorFaltas),
      dias_faltas: 0,
      valor_consignado: round2(valorConsignado),
      valor_pensao_alimenticia: 0,
      banco_horas: 0,
      valor_descontos: valorDescontos,
      valor_folha_liquido: parsedLiquido,
      valor_fgts: valorFgts,
      valor_vt: 0,
      valor_vr: 0,
      valor_cesta: 0,
      valor_bonus: 0,
      valor_premiacao: 0,
      valor_ajuda_custo: 0,
      rubricas_proventos: rubricasProventos,
      rubricas_descontos: rubricasDescontos,
      observacao: 'Folha Oficial CLT (Extração Determinística)',
    });
  }

  const sanitized = sanitizeParsedPayrollRecords(rawRecords, 'payroll', empresa);
  const validRatio = sanitized.length > 0 ? accountingValidCount / sanitized.length : 0;

  // Só aceita o parser determinístico se extraiu registros e >= 80% fecham matematicamente Proventos - Descontos = Líquido
  if (sanitized.length === 0 || validRatio < 0.8) {
    return {
      matched: false,
      reason: `Check contábil insuficiente (${accountingValidCount}/${sanitized.length} válidos) — delegando para IA estruturada.`,
      competencia,
      empresa,
      records: [],
    };
  }

  const totalExtracted = round2(sanitized.reduce((s, r) => s + r.valor_holerite, 0));
  return {
    matched: true,
    competencia,
    empresa,
    records: sanitized,
    totalCheck: {
      extracted: totalExtracted,
      consistent: true,
    },
  };
}

/**
 * Camada 1 Determinística (< 50ms): Parser de relatórios PDF padronizados de VT e VA/Cesta.
 * Confere a soma extraída contra o "TOTAL GERAL" do PDF quando presente; se divergir > R$ 1,00, cai no fallback IA.
 */
export function parseBenefitsPdfText(text: string): DeterministicParseResult<ParsedBenefitRecord> {
  if (!text || text.trim().length < 50) {
    return { matched: false, reason: 'PDF sem texto extraível.', competencia: '', empresa: '', records: [] };
  }

  const upper = text.toUpperCase();
  const competencia = extractCompetenciaFromText(text);
  const empresa = normalizeDetectedCompany(text.slice(0, 400) + ' ' + text.slice(-400));

  const isVt =
    upper.includes('COLABORADOR:ITINER') ||
    upper.includes('QTD SABADO') ||
    upper.includes('ITINERARIO') ||
    upper.includes('ITINERÁRIO') ||
    (upper.includes('SEGUNDA A SEXTA') && upper.includes('VALE TRANSPORTE'));

  const isVa =
    !isVt &&
    (upper.includes('COLABORADOR:VA') ||
      upper.includes('CESTA BASICA') ||
      upper.includes('CESTA BÁSICA') ||
      upper.includes('VALE ALIMENTA') ||
      upper.includes('VALE REFEIC'));

  if (!isVt && !isVa) {
    return { matched: false, reason: 'Layout de benefício não reconhecido como tabela padrão VT/VA.', competencia, empresa, records: [] };
  }

  const lines = text.split('\n');
  const records: ParsedBenefitRecord[] = [];
  let expectedTotal = 0;

  if (isVa) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^(COLABORADOR:|TOTAL\s+GERAL|SEGUNDA|SÁBADO|SABADO|VALE\s+ALIMENTA|VALE\s+REFEIC|CESTA|DZM|MAR\s*BRASIL)/i.test(trimmed)) {
        continue;
      }
      const m = trimmed.match(/^(\d+)\s*(.+?)\s*((?:\d{1,3}\.?)?\d+,\d{2})R\$/);
      if (m) {
        const nome = m[2].trim();
        const valor = parseBrCurrency(m[3]);
        if (nome.length >= 3 && valor > 0) {
          records.push({
            matricula: m[1],
            name: nome,
            cpf: '',
            valor,
            valor_vt: 0,
            valor_vr: valor,
            valor_cesta: valor,
            valor_bonus: 0,
            valor_premiacao: 0,
            valor_ajuda_custo: 0,
            observacao: 'Planilha VA / Cesta (Extração Determinística)',
          });
        }
      }
    }
    const totalMatch = text.match(/TOTAL\s+GERAL:\s*([\d.]+,\d{2})R?\$?/i);
    expectedTotal = totalMatch ? parseBrCurrency(totalMatch[1]) : 0;
  } else {
    let sabadoHeaderIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const u = lines[i].toUpperCase();
      if ((u.includes('SABADO') || u.includes('SÁBADO')) && u.includes('TOTAL')) {
        sabadoHeaderIdx = i;
        break;
      }
    }
    const startLine = sabadoHeaderIdx >= 0 ? sabadoHeaderIdx + 1 : 2;
    const totalLines = lines.filter((l) => /TOTAL\s+GERAL/i.test(l) && /R\$/.test(l));
    if (totalLines.length > 0) {
      const lastTotal = totalLines[totalLines.length - 1];
      const allVals = [...lastTotal.matchAll(/([\d.]+,\d{2})R\$/g)];
      if (allVals.length > 0) {
        expectedTotal = parseBrCurrency(allVals[allVals.length - 1][1]);
      }
    }

    for (let i = startLine; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      if (/^(TOTAL\s+GERAL|DZM|MAR|VALE\s+TRANSPORTE|SEGUNDA|COLABORADOR:|QTD\s+SAB|SÁBADO|SABADO)/i.test(trimmed)) {
        continue;
      }
      const allVals = [...trimmed.matchAll(/((?:\d{1,3}\.?)?\d+,\d{2})R\$/g)]
        .map((v) => parseBrCurrency(v[1]))
        .filter((v) => v > 0);
      if (allVals.length === 0) continue;

      const valorVt = allVals[allVals.length - 1];
      const firstRsIdx = trimmed.search(/(?:(?:\d{1,3}\.?)?\d+,\d{2}|\d+-?)R\$/);
      if (firstRsIdx <= 0) continue;

      let nome = trimmed.slice(0, firstRsIdx).replace(/^\d+\s*/, '').trim();
      nome = nome.replace(/\s+\d+\s*$/, '').replace(/[-\s]+$/, '').trim();
      if (nome.length >= 3 && valorVt > 0) {
        records.push({
          name: nome,
          cpf: '',
          valor: valorVt,
          valor_vt: valorVt,
          valor_vr: 0,
          valor_cesta: 0,
          valor_bonus: 0,
          valor_premiacao: 0,
          valor_ajuda_custo: 0,
          observacao: 'Planilha VT (Extração Determinística)',
        });
      }
    }
  }

  const extractedTotal = round2(records.reduce((s, r) => s + r.valor, 0));
  const consistent = expectedTotal === 0 || Math.abs(extractedTotal - expectedTotal) <= 1.0;

  if (records.length === 0 || !consistent) {
    return {
      matched: false,
      reason: `Soma extraída (${extractedTotal}) diverge do total do PDF (${expectedTotal}) — delegando para IA.`,
      competencia,
      empresa,
      records: [],
      totalCheck: { expected: expectedTotal, extracted: extractedTotal, consistent: false },
    };
  }

  return {
    matched: true,
    competencia,
    empresa,
    records,
    totalCheck: {
      expected: expectedTotal || undefined,
      extracted: extractedTotal,
      consistent: true,
    },
  };
}

function createXmlParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });
}

function findDeepKey(obj: unknown, targetKeys: string[], scalarOnly = false): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const record = obj as Record<string, unknown>;
  for (const key of targetKeys) {
    const candidate = record[key];
    if (candidate !== undefined && candidate !== null) {
      if (!scalarOnly || typeof candidate !== 'object') {
        return candidate;
      }
      // Se o nó encontrado for um wrapper (ex: <CpfCnpj><Cnpj>123</Cnpj></CpfCnpj>), desce nele
      const nested = findDeepKey(candidate, targetKeys, scalarOnly);
      if (nested !== undefined) return nested;
    }
  }
  for (const val of Object.values(record)) {
    if (val && typeof val === 'object') {
      const found = findDeepKey(val, targetKeys, scalarOnly);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function findAllDeepKeys(obj: unknown, targetKey: string, out: unknown[] = []): unknown[] {
  if (!obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    for (const item of obj) findAllDeepKeys(item, targetKey, out);
    return out;
  }
  const record = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(record)) {
    if (k === targetKey) {
      if (Array.isArray(v)) out.push(...v);
      else out.push(v);
    } else if (v && typeof v === 'object') {
      findAllDeepKeys(v, targetKey, out);
    }
  }
  return out;
}

function formatCnpjDigits(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return String(raw || '').trim();
}

function formatCpfDigits(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return String(raw || '').trim();
}

export function detectXmlDocumentType(xmlString: string): 'nfse' | 'esocial_s1200' | 'unknown' {
  const sample = String(xmlString || '').slice(0, 1500).toLowerCase();
  if (sample.includes('esocial') && (sample.includes('evtremun') || sample.includes('s-1200') || sample.includes('itensremun'))) {
    return 'esocial_s1200';
  }
  if (
    sample.includes('nfse') ||
    sample.includes('compnfse') ||
    sample.includes('infnfse') ||
    sample.includes('declaracaoprestacaoservico') ||
    sample.includes('nfe') && sample.includes('prestador')
  ) {
    return 'nfse';
  }
  return 'unknown';
}

/**
 * Parser Determinístico de XML NFS-e (Padrão Nacional DPS/NFSe + ABRASF v1/v2 + Prefeitura SP).
 * Extrai estritamente dados B2B (CNPJ, Razão Social, Valor Bruto NF, Retenções/Glosas e Valor Líquido NF).
 */
export function parseNfseXml(xmlString: string): DeterministicParseResult<ParsedNfseRecord> {
  if (!xmlString || !xmlString.trim().startsWith('<')) {
    return { matched: false, reason: 'Conteúdo XML inválido.', competencia: '', empresa: '', records: [] };
  }

  try {
    const parser = createXmlParser();
    const parsed = parser.parse(xmlString);

    const nodes = findAllDeepKeys(parsed, 'InfNfse');
    const dpsNodes = nodes.length === 0 ? findAllDeepKeys(parsed, 'infNFSe') : [];
    const nfeSpNodes = nodes.length === 0 && dpsNodes.length === 0 ? findAllDeepKeys(parsed, 'NFe') : [];
    const targetNodes = nodes.length > 0 ? nodes : dpsNodes.length > 0 ? dpsNodes : nfeSpNodes;

    if (targetNodes.length === 0) {
      return { matched: false, reason: 'Nenhuma estrutura InfNfse / infNFSe encontrada no XML.', competencia: '', empresa: '', records: [] };
    }

    const records: ParsedNfseRecord[] = [];
    let detectedCompetencia = '';
    let detectedEmpresa = '';

    for (const node of targetNodes) {
      const numeroNf = String(findDeepKey(node, ['Numero', 'nNFSe', 'NumeroNFe', 'nDFSe']) || '').trim();
      const rawDataEmissao = String(findDeepKey(node, ['DataEmissao', 'dhEmi', 'DataEmissaoNFe', 'Competencia', 'dCompet']) || '').trim();
      const rawComp = String(findDeepKey(node, ['Competencia', 'dCompet']) || rawDataEmissao).trim();
      const compMatch = rawComp.match(/(\d{4})-(\d{2})/);
      const competencia = compMatch ? `${compMatch[1]}-${compMatch[2]}-01` : '';
      if (competencia && !detectedCompetencia) detectedCompetencia = competencia;

      const prestadorBlock = findDeepKey(node, ['PrestadorServico', 'emit', 'CPFCNPJPrestador', 'Prestador']);
      const prestadorCnpj = formatCnpjDigits(
        findDeepKey(prestadorBlock || node, ['Cnpj', 'CNPJ', 'CpfCnpj', 'Cpf', 'CPF'], true)
      );
      const prestadorRazaoSocial = String(
        findDeepKey(prestadorBlock || node, ['RazaoSocial', 'xNome', 'RazaoSocialPrestador', 'NomeFantasia'], true) || ''
      ).trim();

      const tomadorBlock = findDeepKey(node, ['TomadorServico', 'Tomador', 'toma', 'CPFCNPJTomador']);
      const tomadorCnpj = formatCnpjDigits(
        findDeepKey(tomadorBlock, ['Cnpj', 'CNPJ', 'CpfCnpj', 'Cpf', 'CPF'], true)
      );
      const tomadorRazaoSocial = String(
        findDeepKey(tomadorBlock, ['RazaoSocial', 'xNome', 'RazaoSocialTomador'], true) || ''
      ).trim();
      const empCandidate = normalizeDetectedCompany(tomadorRazaoSocial);
      if (empCandidate && !detectedEmpresa) detectedEmpresa = empCandidate;

      const valoresBlock = findDeepKey(node, ['ValoresNfse', 'Valores', 'valores']) || node;
      const valorServicos = parseBrCurrency(findDeepKey(valoresBlock, ['ValorServicos', 'vServ', 'ValorServicosPrestados', 'vBC']));
      const valorDeducoes = parseBrCurrency(findDeepKey(valoresBlock, ['ValorDeducoes', 'vDed', 'ValorDeducoesLegais']));
      const valorDesconto = round2(
        parseBrCurrency(findDeepKey(valoresBlock, ['DescontoIncondicionado', 'vDescIncond'])) +
          parseBrCurrency(findDeepKey(valoresBlock, ['DescontoCondicionado', 'vDescCond']))
      );
      const issRetidoFlag = String(findDeepKey(node, ['IssRetido', 'tpRetISSQN']) || '');
      const rawIss = parseBrCurrency(findDeepKey(valoresBlock, ['ValorIssRetido', 'ValorIss', 'vISSQN']));
      const valorIssRetido = issRetidoFlag === '1' || findDeepKey(valoresBlock, ['ValorIssRetido']) !== undefined ? rawIss : 0;
      const valorIr = parseBrCurrency(findDeepKey(valoresBlock, ['ValorIr', 'vRetIRRF', 'ValorIR']));
      const valorCsll = parseBrCurrency(findDeepKey(valoresBlock, ['ValorCsll', 'vRetCSLL', 'ValorCSLL']));
      const valorPis = parseBrCurrency(findDeepKey(valoresBlock, ['ValorPis', 'vPIS', 'ValorPIS']));
      const valorCofins = parseBrCurrency(findDeepKey(valoresBlock, ['ValorCofins', 'vCOFINS', 'ValorCOFINS']));
      const valorInss = parseBrCurrency(findDeepKey(valoresBlock, ['ValorInss', 'vRetCP', 'ValorINSS']));
      const totalRetencoes = round2(valorDeducoes + valorDesconto + valorIssRetido + valorIr + valorCsll + valorPis + valorCofins + valorInss);

      const explicitLiq = parseBrCurrency(findDeepKey(valoresBlock, ['ValorLiquidoNfse', 'vLiq']));
      const valorLiquidoNfse = explicitLiq > 0 ? explicitLiq : round2(Math.max(0, valorServicos - totalRetencoes));

      const discriminacao = String(findDeepKey(node, ['Discriminacao', 'xDescServ']) || '').trim();

      if (valorServicos > 0 || valorLiquidoNfse > 0) {
        records.push({
          numeroNf,
          dataEmissao: rawDataEmissao.slice(0, 10),
          competencia,
          prestadorCnpj,
          prestadorRazaoSocial,
          tomadorCnpj,
          tomadorRazaoSocial,
          valorServicos: valorServicos || valorLiquidoNfse,
          valorDeducoes,
          valorDesconto,
          valorIssRetido,
          valorIr,
          valorCsll,
          valorPis,
          valorCofins,
          valorInss,
          totalRetencoes,
          valorLiquidoNfse,
          discriminacao,
        });
      }
    }

    if (records.length === 0) {
      return { matched: false, reason: 'XML de NFS-e não continha valores financeiros válidos.', competencia: detectedCompetencia, empresa: detectedEmpresa, records: [] };
    }

    return {
      matched: true,
      competencia: detectedCompetencia,
      empresa: detectedEmpresa,
      records,
      totalCheck: {
        extracted: round2(records.reduce((s, r) => s + r.valorLiquidoNfse, 0)),
        consistent: true,
      },
    };
  } catch (err) {
    return {
      matched: false,
      reason: `Erro ao interpretar XML NFS-e: ${err instanceof Error ? err.message : String(err)}`,
      competencia: '',
      empresa: '',
      records: [],
    };
  }
}

/**
 * Parser Determinístico de XML do eSocial S-1200 (Remuneração de Trabalhador vinculado ao RGPS).
 */
export function parseEsocialS1200Xml(xmlString: string): DeterministicParseResult<ParsedPayrollRecord> {
  if (!xmlString || !xmlString.trim().startsWith('<')) {
    return { matched: false, reason: 'Conteúdo XML inválido.', competencia: '', empresa: '', records: [] };
  }

  try {
    const parser = createXmlParser();
    const parsed = parser.parse(xmlString);
    const events = findAllDeepKeys(parsed, 'evtRemun');
    if (events.length === 0) {
      return { matched: false, reason: 'Nenhum evento evtRemun (eSocial S-1200) encontrado.', competencia: '', empresa: '', records: [] };
    }

    const rawRecords: ParsedPayrollRecord[] = [];
    let detectedCompetencia = '';

    for (const evt of events) {
      const perApur = String(findDeepKey(evt, ['perApur']) || '').trim();
      const compMatch = perApur.match(/^(\d{4})-(\d{2})/);
      const competencia = compMatch ? `${compMatch[1]}-${compMatch[2]}-01` : '';
      if (competencia && !detectedCompetencia) detectedCompetencia = competencia;

      const cpfRaw = findDeepKey(evt, ['cpfTrab']);
      const cpf = formatCpfDigits(cpfRaw);
      const nome = String(findDeepKey(evt, ['nmTrab', 'nome']) || `CPF ${cpf}`).trim();
      const matricula = String(findDeepKey(evt, ['matricula']) || '').trim();

      const itens = findAllDeepKeys(evt, 'itensRemun');
      let valorHolerite = 0;
      let valorFixo = 0;
      let valorHoraExtra = 0;
      let valorAdicionalNot = 0;
      let valorDescontos = 0;
      let inss = 0;
      let irrf = 0;
      let descVt6 = 0;
      let adiantamento = 0;
      const rubricasProventos: ParsedRubrica[] = [];
      const rubricasDescontos: ParsedRubrica[] = [];

      for (const item of itens) {
        const obj = item as Record<string, unknown>;
        const codRubr = String(obj.codRubr || '').trim();
        const descRubr = String(obj.dscRubr || obj.descRubr || codRubr).trim();
        const vrRubr = parseBrCurrency(obj.vrRubr);
        if (vrRubr <= 0) continue;

        const descNorm = descRubr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const tpRubr = String(obj.tpRubr || '').trim(); // 1=Provento, 2=Desconto, 3=Informativa
        const isDiscount =
          tpRubr === '2' ||
          descNorm.includes('inss') ||
          descNorm.includes('irrf') ||
          descNorm.includes('desc') ||
          codRubr === '998' ||
          codRubr === '999' ||
          codRubr === '981' ||
          codRubr === '48';

        if (tpRubr === '3') continue; // Ignora informativas / bases

        if (isDiscount) {
          valorDescontos += vrRubr;
          rubricasDescontos.push({ codigo: codRubr, descricao: descRubr, valor: vrRubr });
          if (descNorm.includes('inss') || codRubr === '998') inss += vrRubr;
          else if (descNorm.includes('irrf') || codRubr === '999') irrf += vrRubr;
          else if (codRubr === '48' || descNorm.includes('vale transporte')) descVt6 += vrRubr;
          else if (isAdiantamentoSalarialRubrica(codRubr, descRubr)) adiantamento += vrRubr;
        } else {
          valorHolerite += vrRubr;
          rubricasProventos.push({ codigo: codRubr, descricao: descRubr, valor: vrRubr });
          if (descNorm.includes('salario') || codRubr === '1') valorFixo += vrRubr;
          else if (descNorm.includes('hora extra') || descNorm.includes('horas extras')) valorHoraExtra += vrRubr;
          else if (descNorm.includes('noturn')) valorAdicionalNot += vrRubr;
        }
      }

      if (valorHolerite > 0 || valorDescontos > 0) {
        rawRecords.push({
          matricula,
          name: nome,
          cpf,
          valor_fixo: round2(valorFixo || valorHolerite),
          valor_hora_extra: round2(valorHoraExtra),
          valor_adicional_not: round2(valorAdicionalNot),
          salario_familia: 0,
          valor_ferias: 0,
          valor_decimo_terceiro: 0,
          valor_rescisao: 0,
          valor_outros_recebidos: 0,
          valor_holerite: round2(valorHolerite),
          inss_empregado: round2(inss),
          irrf_empregado: round2(irrf),
          desconto_vt_6: round2(descVt6),
          desconto_adiantamento_folha: round2(adiantamento),
          valor_adiantamento: round2(adiantamento),
          valor_faltas: 0,
          dias_faltas: 0,
          valor_consignado: 0,
          valor_pensao_alimenticia: 0,
          banco_horas: 0,
          valor_descontos: round2(valorDescontos),
          valor_folha_liquido: round2(Math.max(0, valorHolerite - valorDescontos)),
          valor_fgts: 0,
          valor_vt: 0,
          valor_vr: 0,
          valor_cesta: 0,
          valor_bonus: 0,
          valor_premiacao: 0,
          valor_ajuda_custo: 0,
          rubricas_proventos: rubricasProventos,
          rubricas_descontos: rubricasDescontos,
          observacao: 'eSocial S-1200 XML (Extração Determinística)',
        });
      }
    }

    const sanitized = sanitizeParsedPayrollRecords(rawRecords, 'payroll');
    if (sanitized.length === 0) {
      return { matched: false, reason: 'Nenhum item de remuneração encontrado no XML eSocial S-1200.', competencia: detectedCompetencia, empresa: '', records: [] };
    }

    return {
      matched: true,
      competencia: detectedCompetencia,
      empresa: '',
      records: sanitized,
      totalCheck: {
        extracted: round2(sanitized.reduce((s, r) => s + r.valor_holerite, 0)),
        consistent: true,
      },
    };
  } catch (err) {
    return {
      matched: false,
      reason: `Erro ao interpretar XML eSocial S-1200: ${err instanceof Error ? err.message : String(err)}`,
      competencia: '',
      empresa: '',
      records: [],
    };
  }
}
