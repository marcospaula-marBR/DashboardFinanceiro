import type { Employee, MonthlyCost } from '@/types/loans';

export type OmiePjBucket = 'honorarios' | 'bonus' | 'comissao' | 'incentivos' | 'conectividade' | 'deducoes';

export type OmiePjDateMode = 'same_month_due' | 'next_month_due';

export type OmiePjStatusFilter = 'all_valid' | 'paid_only';

export interface OmiePayableRow {
  id?: string;
  omie_id?: number | string | null;
  empresa_nome: string;
  tipo_registro?: string;
  status?: string | null;
  valor_total?: number | null;
  valor_alocado?: number | null;
  data_emissao?: string | null;
  data_registro?: string | null;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  categoria_codigo?: string | null;
  categoria_nome?: string | null;
  cliente_fornecedor?: string | null;
  numero_documento?: string | null;
  raw_data?: Record<string, unknown> | null;
}

export interface OmiePjTitleDetail {
  omieId: string;
  empresa: string;
  status: string;
  dataVencimento: string;
  dataPagamento: string;
  categoria: string;
  bucket: OmiePjBucket;
  numeroDocumento: string;
  valor: number;
}

export interface PjOmieReconciliationItem {
  employeeId: string;
  razaoSocial: string;
  nomeRepresentante: string;
  cnpj: string;
  company: string;
  linkType: 'PJ' | 'MEI';
  escopo: string;
  valor_fixo: number;
  valor_bonus: number;
  valor_comissao: number;
  valor_incentivos: number;
  valor_ajuda_custo: number;
  valor_bruto_nf: number;
  valor_deducoes: number;
  valor_liquido_nf: number;
  contractBase: number;
  contractDelta: number;
  contractDeltaPct: number;
  isContractDivergent: boolean;
  titlesCount: number;
  paidCount: number;
  openCount: number;
  matchMethod: 'CNPJ' | 'RAZAO_SOCIAL' | 'SIMILARIDADE';
  matchConfidence: number;
  alreadyInDb: boolean;
  existingDbLiquido?: number;
  omieTitles: OmiePjTitleDetail[];
}

export interface UnmatchedActivePj {
  employeeId: string;
  razaoSocial: string;
  cnpj: string;
  company: string;
  linkType: 'PJ' | 'MEI';
  contractBase: number;
  alreadyInDb: boolean;
}

export interface PjOmieReconciliationResult {
  competencia: string;
  omieWindowStart: string;
  omieWindowEnd: string;
  dateMode: OmiePjDateMode;
  statusFilter: OmiePjStatusFilter;
  scannedTitlesCount: number;
  matchedTitlesCount: number;
  items: PjOmieReconciliationItem[];
  unmatchedActivePjs: UnmatchedActivePj[];
  totals: {
    countPjs: number;
    honorarios: number;
    bonus: number;
    comissao: number;
    incentivos: number;
    conectividade: number;
    valorBrutoNf: number;
    deducoes: number;
    valorLiquidoNf: number;
    divergentCount: number;
  };
}

const LEGAL_SUFFIX_STOPWORDS = new Set([
  'ltda',
  'me',
  'mei',
  'epp',
  'eireli',
  'sa',
  's',
  'a',
  'ss',
  'sociedade',
  'simples',
  'unipessoal',
  'limitada',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
]);

function round2(v: number): number {
  const n = Number.isFinite(v) ? v : 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function cleanDigits(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeCompanyKey(name: string | null | undefined): string {
  const upper = String(name || '').trim().toUpperCase();
  if (!upper) return '';
  if (upper.includes('MAR BRASIL') || upper.includes('MARBR')) return 'MarBR';
  if (upper.includes('D.Z.M') || upper.includes('DZM')) return 'DZM';
  if (upper.includes('G2')) return 'G2';
  return String(name || '').trim();
}

export function normalizeEntityName(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeEntityCore(value: string | null | undefined): string[] {
  return normalizeEntityName(value)
    .split(' ')
    .filter((t) => t.length >= 2 && !LEGAL_SUFFIX_STOPWORDS.has(t));
}

function computeTokenDiceSimilarity(a: string, b: string): number {
  const tokensA = tokenizeEntityCore(a);
  const tokensB = tokenizeEntityCore(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersect = 0;
  for (const t of setA) {
    if (setB.has(t)) intersect += 1;
  }
  return (2 * intersect) / (setA.size + setB.size);
}

/**
 * Calcula janela de datas no Omie (início e fim YYYY-MM-DD) para uma competência YYYY-MM(-01).
 * - same_month_due: títulos com vencimento no mesmo mês da competência.
 * - next_month_due: títulos com vencimento no mês imediatamente seguinte (ex.: serviço em Outubro pago no início de Novembro).
 */
export function getOmieDateWindowForCompetencia(
  competencia: string,
  dateMode: OmiePjDateMode = 'same_month_due'
): { competenciaNormalized: string; startDate: string; endDate: string } {
  const clean = String(competencia || '').slice(0, 7);
  const parts = clean.split('-');
  if (parts.length !== 2) {
    return { competenciaNormalized: '', startDate: '', endDate: '' };
  }
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return { competenciaNormalized: '', startDate: '', endDate: '' };
  }

  const competenciaNormalized = `${year}-${String(month).padStart(2, '0')}-01`;

  if (dateMode === 'next_month_due') {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  return {
    competenciaNormalized,
    startDate: `${ym}-01`,
    endDate: `${ym}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * Mapeia categorias reais do Omie (ex.: 'Credenciado Operacional', 'Bônus Contratual - Credenciados',
 * 'Comissões', 'Incentivo Veicular', 'Conectividade') para o bucket B2B de people_monthly_costs.
 */
export function classifyOmiePjCategory(categoriaNome: string | null | undefined): OmiePjBucket {
  const norm = normalizeEntityName(categoriaNome);
  if (!norm) return 'honorarios';

  if (norm.includes('glosa') || norm.includes('estorno') || norm.includes('devoluc')) {
    return 'deducoes';
  }
  if (norm.includes('bonus') || norm.includes('bonificac')) {
    return 'bonus';
  }
  if (norm.includes('comiss')) {
    return 'comissao';
  }
  if (norm.includes('incentiv') || norm.includes('premiac')) {
    return 'incentivos';
  }
  if (
    norm.includes('conectiv') ||
    norm.includes('reembols') ||
    norm.includes('ajuda de custo') ||
    norm.includes('internet') ||
    norm.includes('telefone')
  ) {
    return 'conectividade';
  }
  return 'honorarios';
}

export function extractCnpjFromOmieRow(row: OmiePayableRow): string {
  const raw = row.raw_data as Record<string, unknown> | null | undefined;
  const detalhes = (raw?.detalhes as Record<string, unknown> | undefined) || undefined;
  const candidate =
    detalhes?.cCPFCNPJCliente ||
    raw?.cnpj_cpf ||
    raw?.cCPFCNPJCliente ||
    '';
  const digits = cleanDigits(String(candidate || ''));
  return digits.length === 14 ? digits : '';
}

export function isValidOmiePayableStatus(
  status: string | null | undefined,
  statusFilter: OmiePjStatusFilter
): boolean {
  const st = String(status || '').trim().toUpperCase();
  if (st.includes('CANCEL') || st.includes('EXCLU')) return false;
  if (statusFilter === 'paid_only') {
    return st === 'PAGO' || st === 'LIQUIDADO' || st === 'RECEBIDO';
  }
  return true;
}

export function isPjOrMeiEmployee(emp: Partial<Employee>): boolean {
  const link = String(emp.linkType || emp.employment_type || '').trim().toUpperCase();
  return link.includes('PJ') || link.includes('MEI');
}

export interface PjMatchResult {
  employee: Partial<Employee>;
  method: 'CNPJ' | 'RAZAO_SOCIAL' | 'SIMILARIDADE';
  confidence: number;
}

export function matchOmieTitleToPjEmployee(
  row: OmiePayableRow,
  pjEmployees: Partial<Employee>[]
): PjMatchResult | null {
  if (!pjEmployees || pjEmployees.length === 0) return null;

  // 1. Match exato por CNPJ (14 dígitos)
  const titleCnpj = extractCnpjFromOmieRow(row);
  if (titleCnpj.length === 14) {
    const byCnpj = pjEmployees.find((emp) => {
      const empPjCnpj = cleanDigits(emp.pj_type);
      const empDoc = cleanDigits(emp.document_id);
      return (empPjCnpj.length === 14 && empPjCnpj === titleCnpj) || (empDoc.length === 14 && empDoc === titleCnpj);
    });
    if (byCnpj) {
      return { employee: byCnpj, method: 'CNPJ', confidence: 1.0 };
    }
  }

  // 2. Match exato por Razão Social ou Nome normalizado
  const supplierNorm = normalizeEntityName(row.cliente_fornecedor);
  if (!supplierNorm) return null;

  for (const emp of pjEmployees) {
    const corpNorm = normalizeEntityName(emp.corporate_name);
    const nameNorm = normalizeEntityName(emp.name);
    if ((corpNorm && corpNorm === supplierNorm) || (nameNorm && nameNorm === supplierNorm)) {
      return { employee: emp, method: 'RAZAO_SOCIAL', confidence: 0.98 };
    }
  }

  // 3. Match por similaridade de tokens jurídicos (threshold >= 0.82)
  let bestEmp: Partial<Employee> | null = null;
  let bestScore = 0;
  for (const emp of pjEmployees) {
    const sCorp = emp.corporate_name ? computeTokenDiceSimilarity(supplierNorm, emp.corporate_name) : 0;
    const sName = emp.name ? computeTokenDiceSimilarity(supplierNorm, emp.name) : 0;
    const score = Math.max(sCorp, sName);
    if (score > bestScore) {
      bestScore = score;
      bestEmp = emp;
    }
  }

  if (bestEmp && bestScore >= 0.82) {
    return { employee: bestEmp, method: 'SIMILARIDADE', confidence: round2(bestScore) };
  }

  return null;
}

export interface ReconcileOmieOptions {
  competencia: string;
  dateMode?: OmiePjDateMode;
  statusFilter?: OmiePjStatusFilter;
  companyFilter?: string;
  existingCostsInCompetencia?: Partial<MonthlyCost>[];
}

/**
 * Motor puro de conciliação PJ/MEI via Omie:
 * Cruza títulos PAGAR de omie_financas_unificado contra o cadastro de empresas contratadas (PJ/MEI),
 * agrega rateios sem duplicidade, classifica cada categoria no bucket B2B correspondente,
 * detecta divergências >= 20% contra o valor contratual e aponta contratadas ativas sem título no período.
 */
export function reconcileOmieTitlesForPj(
  omieRows: OmiePayableRow[],
  employees: Partial<Employee>[],
  options: ReconcileOmieOptions
): PjOmieReconciliationResult {
  const dateMode = options.dateMode || 'same_month_due';
  const statusFilter = options.statusFilter || 'all_valid';
  const companyFilterNorm = options.companyFilter && options.companyFilter !== 'all'
    ? normalizeCompanyKey(options.companyFilter)
    : '';

  const { competenciaNormalized, startDate, endDate } = getOmieDateWindowForCompetencia(
    options.competencia,
    dateMode
  );

  const allPjs = (employees || []).filter(isPjOrMeiEmployee);
  const filteredPjs = companyFilterNorm
    ? allPjs.filter((e) => normalizeCompanyKey(e.company) === companyFilterNorm)
    : allPjs;

  const existingByEmp = new Map<string, Partial<MonthlyCost>>();
  for (const c of options.existingCostsInCompetencia || []) {
    if (c.employee_id) existingByEmp.set(c.employee_id, c);
  }

  const accMap = new Map<
    string,
    {
      emp: Partial<Employee>;
      matchMethod: 'CNPJ' | 'RAZAO_SOCIAL' | 'SIMILARIDADE';
      matchConfidence: number;
      honorarios: number;
      bonus: number;
      comissao: number;
      incentivos: number;
      conectividade: number;
      deducoes: number;
      paidCount: number;
      openCount: number;
      seenOmieIds: Set<string>;
      titles: OmiePjTitleDetail[];
    }
  >();

  let scannedTitlesCount = 0;
  let matchedTitlesCount = 0;

  for (const row of omieRows || []) {
    if (row.tipo_registro && String(row.tipo_registro).toUpperCase() !== 'PAGAR') continue;
    if (!isValidOmiePayableStatus(row.status, statusFilter)) continue;

    const rowCompany = normalizeCompanyKey(row.empresa_nome);
    if (companyFilterNorm && rowCompany && rowCompany !== companyFilterNorm) continue;

    scannedTitlesCount += 1;
    const match = matchOmieTitleToPjEmployee(row, filteredPjs);
    if (!match || !match.employee.id) continue;

    // Omie armazena PAGAR como valor negativo; usamos valor_alocado (rateio exato por linha) ou fallback valor_total
    const rawAmount = row.valor_alocado !== undefined && row.valor_alocado !== null
      ? Number(row.valor_alocado)
      : Number(row.valor_total || 0);
    const absAmount = round2(Math.abs(rawAmount));
    if (absAmount <= 0) continue;

    matchedTitlesCount += 1;
    const emp = match.employee;
    const empId = String(emp.id);
    const bucket = classifyOmiePjCategory(row.categoria_nome);
    const statusUpper = String(row.status || '').trim().toUpperCase();
    const isPaid = statusUpper === 'PAGO' || statusUpper === 'LIQUIDADO';

    let acc = accMap.get(empId);
    if (!acc) {
      acc = {
        emp,
        matchMethod: match.method,
        matchConfidence: match.confidence,
        honorarios: 0,
        bonus: 0,
        comissao: 0,
        incentivos: 0,
        conectividade: 0,
        deducoes: 0,
        paidCount: 0,
        openCount: 0,
        seenOmieIds: new Set<string>(),
        titles: [],
      };
      accMap.set(empId, acc);
    } else if (match.confidence > acc.matchConfidence) {
      acc.matchMethod = match.method;
      acc.matchConfidence = match.confidence;
    }

    if (bucket === 'honorarios') acc.honorarios = round2(acc.honorarios + absAmount);
    else if (bucket === 'bonus') acc.bonus = round2(acc.bonus + absAmount);
    else if (bucket === 'comissao') acc.comissao = round2(acc.comissao + absAmount);
    else if (bucket === 'incentivos') acc.incentivos = round2(acc.incentivos + absAmount);
    else if (bucket === 'conectividade') acc.conectividade = round2(acc.conectividade + absAmount);
    else if (bucket === 'deducoes') acc.deducoes = round2(acc.deducoes + absAmount);

    const omieKey = String(row.omie_id || row.id || `${row.data_vencimento}_${absAmount}_${acc.titles.length}`);
    if (!acc.seenOmieIds.has(omieKey)) {
      acc.seenOmieIds.add(omieKey);
      if (isPaid) acc.paidCount += 1;
      else acc.openCount += 1;
    }

    acc.titles.push({
      omieId: String(row.omie_id || ''),
      empresa: rowCompany || row.empresa_nome || '',
      status: statusUpper || 'EM ABERTO',
      dataVencimento: String(row.data_vencimento || '').slice(0, 10),
      dataPagamento: String(row.data_pagamento || '').slice(0, 10),
      categoria: String(row.categoria_nome || 'Serviços PJ'),
      bucket,
      numeroDocumento: String(row.numero_documento || ''),
      valor: absAmount,
    });
  }

  const items: PjOmieReconciliationItem[] = [];
  for (const [empId, acc] of accMap.entries()) {
    const emp = acc.emp;
    const valorBrutoNf = round2(acc.honorarios + acc.bonus + acc.comissao + acc.incentivos + acc.conectividade);
    const valorLiquidoNf = round2(Math.max(0, valorBrutoNf - acc.deducoes));
    const contractBase = round2(Number(emp.remuneration_fixed || emp.remuneration || 0));
    const contractDelta = contractBase > 0 ? round2(acc.honorarios - contractBase) : 0;
    const contractDeltaPct = contractBase > 0 ? round2((contractDelta / contractBase) * 100) : 0;
    const isContractDivergent =
      contractBase > 0 && Math.abs(contractDeltaPct) >= 20 && Math.abs(contractDelta) >= 50;

    const existingDb = existingByEmp.get(empId);
    const razaoSocial = String(emp.corporate_name || emp.name || 'Empresa Contratada').trim();
    const cnpj = String(emp.pj_type || emp.document_id || '').trim();
    const linkUpper = String(emp.linkType || emp.employment_type || 'PJ').toUpperCase();

    items.push({
      employeeId: empId,
      razaoSocial,
      nomeRepresentante: String(emp.name || '').trim(),
      cnpj,
      company: normalizeCompanyKey(emp.company) || 'MarBR',
      linkType: linkUpper.includes('MEI') ? 'MEI' : 'PJ',
      escopo: String(emp.job_role || emp.department || 'Prestação de Serviços').trim(),
      valor_fixo: acc.honorarios,
      valor_bonus: acc.bonus,
      valor_comissao: acc.comissao,
      valor_incentivos: acc.incentivos,
      valor_ajuda_custo: acc.conectividade,
      valor_bruto_nf: valorBrutoNf,
      valor_deducoes: acc.deducoes,
      valor_liquido_nf: valorLiquidoNf,
      contractBase,
      contractDelta,
      contractDeltaPct,
      isContractDivergent,
      titlesCount: acc.seenOmieIds.size,
      paidCount: acc.paidCount,
      openCount: acc.openCount,
      matchMethod: acc.matchMethod,
      matchConfidence: acc.matchConfidence,
      alreadyInDb: Boolean(existingDb),
      existingDbLiquido: existingDb ? round2(Number(existingDb.valor_liquido || 0)) : undefined,
      omieTitles: acc.titles,
    });
  }

  items.sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));

  const unmatchedActivePjs: UnmatchedActivePj[] = filteredPjs
    .filter((emp) => {
      const st = String(emp.status || 'Ativo').toLowerCase();
      const isActive = !['inativo', 'desligado', 'demitido'].includes(st);
      return isActive && emp.id && !accMap.has(emp.id);
    })
    .map((emp) => {
      const linkUpper = String(emp.linkType || emp.employment_type || 'PJ').toUpperCase();
      const linkType: 'PJ' | 'MEI' = linkUpper.includes('MEI') ? 'MEI' : 'PJ';
      return {
        employeeId: String(emp.id),
        razaoSocial: String(emp.corporate_name || emp.name || 'Empresa Contratada').trim(),
        cnpj: String(emp.pj_type || emp.document_id || '').trim(),
        company: normalizeCompanyKey(emp.company) || 'MarBR',
        linkType,
        contractBase: round2(Number(emp.remuneration_fixed || emp.remuneration || 0)),
        alreadyInDb: existingByEmp.has(String(emp.id)),
      };
    })
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));

  const totals = {
    countPjs: items.length,
    honorarios: round2(items.reduce((s, r) => s + r.valor_fixo, 0)),
    bonus: round2(items.reduce((s, r) => s + r.valor_bonus, 0)),
    comissao: round2(items.reduce((s, r) => s + r.valor_comissao, 0)),
    incentivos: round2(items.reduce((s, r) => s + r.valor_incentivos, 0)),
    conectividade: round2(items.reduce((s, r) => s + r.valor_ajuda_custo, 0)),
    valorBrutoNf: round2(items.reduce((s, r) => s + r.valor_bruto_nf, 0)),
    deducoes: round2(items.reduce((s, r) => s + r.valor_deducoes, 0)),
    valorLiquidoNf: round2(items.reduce((s, r) => s + r.valor_liquido_nf, 0)),
    divergentCount: items.filter((r) => r.isContractDivergent).length,
  };

  return {
    competencia: competenciaNormalized,
    omieWindowStart: startDate,
    omieWindowEnd: endDate,
    dateMode,
    statusFilter,
    scannedTitlesCount,
    matchedTitlesCount,
    items,
    unmatchedActivePjs,
    totals,
  };
}
