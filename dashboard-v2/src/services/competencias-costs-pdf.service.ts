import type { Employee, MonthlyCost } from '@/types/loans';
import type { RowFinancials } from '@/services/people-hr.service';

export type CompetenciasPdfReportType = 'sintetico' | 'analitico';
export type LegalRegimeType = 'CLT' | 'ESTAGIO' | 'PJ';

export interface CompetenciaCostPdfInputRow {
  cost: Partial<MonthlyCost>;
  emp?: Partial<Employee>;
  name: string;
  financials: Partial<RowFinancials>;
  realTotal: number;
  isCLT: boolean;
  isPJ: boolean;
  isEstagio: boolean;
}

export interface CompetenciaCostPdfRow {
  competencia: string;
  competenciaShort: string;
  competenciaFull: string;
  employeeId: string;
  name: string;
  corporateName: string;
  displayEntityName: string;
  responsibleName: string;
  company: string;
  roleOrDept: string;
  documentId: string;
  documentLabel: 'CNPJ' | 'CPF';
  regime: LegalRegimeType;
  regimeLabel: string;
  // Quebra analítica base (10 colunas CLT)
  proventos: number;
  outros: number;
  vt: number;
  vrCesta: number;
  bonus: number;
  premiacao: number;
  subtotal: number;
  descontos: number;
  adiantamento: number;
  liquido: number;
  beneficiosAgrupados: number;
  proventosComOutros: number;
  // Quebra específica Estágio (Lei nº 11.788/2008)
  bolsaAuxilio: number;
  auxilioTransporte: number;
  outrosAuxilios: number;
  deducoesEstagio: number;
  antecipacaoEstagio: number;
  // Quebra específica PJ / MEI (Relação B2B / Contratual)
  honorariosBase: number;
  variavelComissoes: number;
  conectividadeReembolso: number;
  valorBrutoNf: number;
  glosasDeducoes: number;
  valorLiquidoNf: number;
}

export interface CompetenciasPdfTotals {
  countRows: number;
  uniqueEmployeesCount: number;
  countClt: number;
  countPj: number;
  countEstagio: number;
  // Totais CLT (10 colunas)
  proventos: number;
  outros: number;
  vt: number;
  vrCesta: number;
  bonus: number;
  premiacao: number;
  subtotal: number;
  descontos: number;
  adiantamento: number;
  liquido: number;
  beneficiosAgrupados: number;
  proventosComOutros: number;
  // Totais Estágio
  bolsaAuxilio: number;
  auxilioTransporte: number;
  outrosAuxilios: number;
  deducoesEstagio: number;
  antecipacaoEstagio: number;
  // Totais PJ / MEI
  honorariosBase: number;
  variavelComissoes: number;
  conectividadeReembolso: number;
  valorBrutoNf: number;
  glosasDeducoes: number;
  valorLiquidoNf: number;
}

export interface PartitionedCompetenciaPdfData {
  allRows: CompetenciaCostPdfRow[];
  cltRows: CompetenciaCostPdfRow[];
  estagioRows: CompetenciaCostPdfRow[];
  pjRows: CompetenciaCostPdfRow[];
  cltTotals: CompetenciasPdfTotals;
  estagioTotals: CompetenciasPdfTotals;
  pjTotals: CompetenciasPdfTotals;
  grandTotals: {
    countRows: number;
    uniqueEmployeesCount: number;
    totalLiquidoGeral: number;
    regimesPresent: LegalRegimeType[];
    isMixed: boolean;
  };
}

export interface CompetenciasPdfFilterContext {
  selectedYears?: string[];
  compFilterMode?: 'single' | 'range' | 'multi';
  selectedCompetencia?: string;
  periodStart?: string;
  periodEnd?: string;
  selectedCompetencias?: string[];
  selectedEmpresa?: string;
  selectedVinculo?: string;
  selectedStatus?: string;
  selectedSetor?: string;
  searchTerm?: string;
  usePageScope?: boolean;
}

export interface BuildCompetenciasPdfParams {
  reportType: CompetenciasPdfReportType;
  rows: CompetenciaCostPdfInputRow[];
  filters?: CompetenciasPdfFilterContext;
  generatedAt?: Date;
}

const MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export function toSafeNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function roundCurrency(value: number): number {
  const safe = toSafeNumber(value);
  return Math.round((safe + Number.EPSILON) * 100) / 100;
}

export function formatCurrencyBrl(value: number): string {
  const safe = roundCurrency(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(safe === 0 ? 0 : safe);
}

export function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCompetenciaFull(compStr: string | null | undefined): string {
  if (!compStr) return '—';
  const parts = String(compStr).split('-');
  if (parts.length < 2) return compStr;
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = MONTHS_FULL[monthIdx] || parts[1];
  return `${monthName}/${parts[0]}`;
}

export function formatCompetenciaShort(compStr: string | null | undefined): string {
  if (!compStr) return '—';
  const parts = String(compStr).split('-');
  if (parts.length < 2) return compStr;
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = MONTHS_SHORT[monthIdx] || parts[1];
  const shortYear = parts[0].length === 4 ? parts[0].slice(2) : parts[0];
  return `${monthName}/${shortYear}`;
}

function formatSignedCell(value: number, prefix: '+' | '-', emptyDash = '—'): string {
  const rounded = roundCurrency(value);
  if (rounded === 0) return emptyDash;
  if (rounded < 0) {
    return `-${formatCurrencyBrl(Math.abs(rounded))}`;
  }
  return `${prefix}${formatCurrencyBrl(rounded)}`;
}

export function normalizeCompetenciaCostRow(input: CompetenciaCostPdfInputRow): CompetenciaCostPdfRow {
  const cost = input.cost || {};
  const emp = input.emp || {};
  const financials = input.financials || {};
  const verbasAdicionais = (cost.verbas_adicionais as Record<string, unknown> | undefined) || {};

  const isEstagio = Boolean(input.isEstagio);
  const isCLT = Boolean(input.isCLT);
  const regime: LegalRegimeType = isEstagio ? 'ESTAGIO' : (isCLT ? 'CLT' : 'PJ');
  const regimeLabel = isEstagio ? 'Estágio' : (isCLT ? 'CLT' : 'PJ');

  let proventos = 0;
  let outros = 0;
  let vt = 0;
  let vrCesta = 0;
  let bonus = 0;
  let premiacao = 0;
  let descontos = 0;
  let adiantamento = 0;

  if (regime === 'PJ') {
    const fixoPj = toSafeNumber(financials.fixo)
      || toSafeNumber(cost.valor_fixo)
      || toSafeNumber(cost.valor_liquido)
      || toSafeNumber(input.realTotal);
    const bonusPj = financials.bonus !== undefined
      ? toSafeNumber(financials.bonus)
      : (toSafeNumber(cost.valor_bonus) + toSafeNumber(cost.valor_comissao) + toSafeNumber(cost.valor_incentivos));
    const premiacaoPj = financials.ajudaCusto !== undefined
      ? toSafeNumber(financials.ajudaCusto)
      : toSafeNumber(cost.valor_ajuda_custo);
    const descontosPj = financials.descontosFolha !== undefined
      ? toSafeNumber(financials.descontosFolha)
      : (toSafeNumber(cost.valor_glosa_base) + toSafeNumber(cost.valor_glosa_bonus) + toSafeNumber(cost.valor_deducoes));

    proventos = roundCurrency(fixoPj);
    outros = 0;
    vt = 0;
    vrCesta = 0;
    bonus = roundCurrency(bonusPj);
    premiacao = roundCurrency(premiacaoPj);
    descontos = roundCurrency(descontosPj);
    adiantamento = 0;
  } else {
    // CLT ou Estágio
    const holerite = toSafeNumber(cost.valor_holerite);
    const hasHol = holerite > 0;
    const fixoBase = cost.valor_fixo !== undefined && cost.valor_fixo !== null
      ? toSafeNumber(cost.valor_fixo)
      : toSafeNumber(financials.fixo);
    const heNoturno = toSafeNumber(financials.heNoturno) || (
      toSafeNumber(cost.valor_hora_extra) + toSafeNumber(cost.valor_adicional_not)
    );
    const outrosAjustes = toSafeNumber(cost.outros_ajustes ?? verbasAdicionais.outros_ajustes);

    proventos = roundCurrency(hasHol ? holerite : fixoBase);
    // Isolamento de Proventos: quando há holerite importado, HE/Noturno já compõem os proventos
    outros = roundCurrency(hasHol ? outrosAjustes : (outrosAjustes || heNoturno));
    vt = roundCurrency(toSafeNumber(cost.valor_vt));
    vrCesta = roundCurrency(toSafeNumber(cost.valor_cesta) + toSafeNumber(cost.valor_vr));
    bonus = roundCurrency(toSafeNumber(cost.valor_bonus));
    // Blindagem CLT/Estágio: Premiação/Ajuda lê estritamente valor_ajuda_custo (nunca valor_incentivos)
    premiacao = roundCurrency(toSafeNumber(cost.valor_ajuda_custo));
    descontos = roundCurrency(toSafeNumber(cost.valor_descontos) || toSafeNumber(financials.descontosFolha));
    adiantamento = roundCurrency(toSafeNumber(cost.valor_adiantamento));
  }

  const subtotal = roundCurrency(proventos + outros + vt + vrCesta + bonus + premiacao);
  const liquido = roundCurrency(toSafeNumber(input.realTotal));
  const beneficiosAgrupados = roundCurrency(vt + vrCesta + bonus + premiacao);
  const proventosComOutros = roundCurrency(proventos + outros);

  // Campos Estágio (Lei nº 11.788/2008)
  const bolsaAuxilio = proventos;
  const auxilioTransporte = vt;
  const outrosAuxilios = roundCurrency(outros + vrCesta + bonus + premiacao);
  const deducoesEstagio = descontos;
  const antecipacaoEstagio = adiantamento;

  // Campos PJ / MEI (Contratual B2B)
  const honorariosBase = proventos;
  const variavelComissoes = bonus;
  const conectividadeReembolso = premiacao;
  const valorBrutoNf = roundCurrency(honorariosBase + variavelComissoes + conectividadeReembolso);
  const glosasDeducoes = descontos;
  const valorLiquidoNf = liquido;

  const compStr = String(cost.competencia || '');
  const company = emp.company || 'MarBR';
  const roleOrDept = emp.job_role || emp.department || '—';
  const corporateName = (emp.corporate_name || '').trim();
  const responsibleName = (emp.responsible_name || '').trim();

  const displayEntityName = regime === 'PJ'
    ? (corporateName || input.name || 'Empresa Contratada')
    : (input.name || 'Colaborador');

  const documentId = regime === 'PJ'
    ? ((emp.pj_type || emp.document_id || '').trim())
    : ((emp.document_id || emp.responsible_cpf || '').trim());

  const documentLabel: 'CNPJ' | 'CPF' = regime === 'PJ' ? 'CNPJ' : 'CPF';

  return {
    competencia: compStr,
    competenciaShort: formatCompetenciaShort(compStr),
    competenciaFull: formatCompetenciaFull(compStr),
    employeeId: String(cost.employee_id || displayEntityName || ''),
    name: input.name || displayEntityName,
    corporateName,
    displayEntityName,
    responsibleName,
    company,
    roleOrDept,
    documentId,
    documentLabel,
    regime,
    regimeLabel,
    proventos,
    outros,
    vt,
    vrCesta,
    bonus,
    premiacao,
    subtotal,
    descontos,
    adiantamento,
    liquido,
    beneficiosAgrupados,
    proventosComOutros,
    bolsaAuxilio,
    auxilioTransporte,
    outrosAuxilios,
    deducoesEstagio,
    antecipacaoEstagio,
    honorariosBase,
    variavelComissoes,
    conectividadeReembolso,
    valorBrutoNf,
    glosasDeducoes,
    valorLiquidoNf,
  };
}

export function summarizeCompetenciaPdfRows(rows: CompetenciaCostPdfRow[]): CompetenciasPdfTotals {
  const uniqueIds = new Set<string>();
  let countClt = 0;
  let countPj = 0;
  let countEstagio = 0;

  let proventos = 0;
  let outros = 0;
  let vt = 0;
  let vrCesta = 0;
  let bonus = 0;
  let premiacao = 0;
  let subtotal = 0;
  let descontos = 0;
  let adiantamento = 0;
  let liquido = 0;

  let bolsaAuxilio = 0;
  let auxilioTransporte = 0;
  let outrosAuxilios = 0;
  let deducoesEstagio = 0;
  let antecipacaoEstagio = 0;

  let honorariosBase = 0;
  let variavelComissoes = 0;
  let conectividadeReembolso = 0;
  let valorBrutoNf = 0;
  let glosasDeducoes = 0;
  let valorLiquidoNf = 0;

  for (const r of rows) {
    if (r.employeeId) uniqueIds.add(r.employeeId);
    if (r.regime === 'ESTAGIO') countEstagio += 1;
    else if (r.regime === 'CLT') countClt += 1;
    else countPj += 1;

    proventos += r.proventos;
    outros += r.outros;
    vt += r.vt;
    vrCesta += r.vrCesta;
    bonus += r.bonus;
    premiacao += r.premiacao;
    subtotal += r.subtotal;
    descontos += r.descontos;
    adiantamento += r.adiantamento;
    liquido += r.liquido;

    bolsaAuxilio += r.bolsaAuxilio;
    auxilioTransporte += r.auxilioTransporte;
    outrosAuxilios += r.outrosAuxilios;
    deducoesEstagio += r.deducoesEstagio;
    antecipacaoEstagio += r.antecipacaoEstagio;

    honorariosBase += r.honorariosBase;
    variavelComissoes += r.variavelComissoes;
    conectividadeReembolso += r.conectividadeReembolso;
    valorBrutoNf += r.valorBrutoNf;
    glosasDeducoes += r.glosasDeducoes;
    valorLiquidoNf += r.valorLiquidoNf;
  }

  const roundedProventos = roundCurrency(proventos);
  const roundedOutros = roundCurrency(outros);
  const roundedVt = roundCurrency(vt);
  const roundedVrCesta = roundCurrency(vrCesta);
  const roundedBonus = roundCurrency(bonus);
  const roundedPremiacao = roundCurrency(premiacao);

  return {
    countRows: rows.length,
    uniqueEmployeesCount: uniqueIds.size,
    countClt,
    countPj,
    countEstagio,
    proventos: roundedProventos,
    outros: roundedOutros,
    vt: roundedVt,
    vrCesta: roundedVrCesta,
    bonus: roundedBonus,
    premiacao: roundedPremiacao,
    subtotal: roundCurrency(subtotal),
    descontos: roundCurrency(descontos),
    adiantamento: roundCurrency(adiantamento),
    liquido: roundCurrency(liquido),
    beneficiosAgrupados: roundCurrency(roundedVt + roundedVrCesta + roundedBonus + roundedPremiacao),
    proventosComOutros: roundCurrency(roundedProventos + roundedOutros),
    bolsaAuxilio: roundCurrency(bolsaAuxilio),
    auxilioTransporte: roundCurrency(auxilioTransporte),
    outrosAuxilios: roundCurrency(outrosAuxilios),
    deducoesEstagio: roundCurrency(deducoesEstagio),
    antecipacaoEstagio: roundCurrency(antecipacaoEstagio),
    honorariosBase: roundCurrency(honorariosBase),
    variavelComissoes: roundCurrency(variavelComissoes),
    conectividadeReembolso: roundCurrency(conectividadeReembolso),
    valorBrutoNf: roundCurrency(valorBrutoNf),
    glosasDeducoes: roundCurrency(glosasDeducoes),
    valorLiquidoNf: roundCurrency(valorLiquidoNf),
  };
}

export function partitionCompetenciaPdfRows(
  inputRows: CompetenciaCostPdfInputRow[]
): PartitionedCompetenciaPdfData {
  const allRows = (inputRows || []).map(normalizeCompetenciaCostRow);
  const cltRows: CompetenciaCostPdfRow[] = [];
  const estagioRows: CompetenciaCostPdfRow[] = [];
  const pjRows: CompetenciaCostPdfRow[] = [];
  const uniqueIds = new Set<string>();

  for (const row of allRows) {
    if (row.employeeId) uniqueIds.add(row.employeeId);
    if (row.regime === 'CLT') cltRows.push(row);
    else if (row.regime === 'ESTAGIO') estagioRows.push(row);
    else pjRows.push(row);
  }

  const cltTotals = summarizeCompetenciaPdfRows(cltRows);
  const estagioTotals = summarizeCompetenciaPdfRows(estagioRows);
  const pjTotals = summarizeCompetenciaPdfRows(pjRows);

  const regimesPresent: LegalRegimeType[] = [];
  if (cltRows.length > 0) regimesPresent.push('CLT');
  if (estagioRows.length > 0) regimesPresent.push('ESTAGIO');
  if (pjRows.length > 0) regimesPresent.push('PJ');

  const totalLiquidoGeral = roundCurrency(
    cltTotals.liquido + estagioTotals.liquido + pjTotals.valorLiquidoNf
  );

  return {
    allRows,
    cltRows,
    estagioRows,
    pjRows,
    cltTotals,
    estagioTotals,
    pjTotals,
    grandTotals: {
      countRows: allRows.length,
      uniqueEmployeesCount: uniqueIds.size,
      totalLiquidoGeral,
      regimesPresent,
      isMixed: regimesPresent.length > 1,
    },
  };
}

export function buildScopeDescription(filters?: CompetenciasPdfFilterContext): string {
  if (!filters) return 'Todas as Competências';
  const parts: string[] = [];

  if (filters.selectedCompetencias && filters.selectedCompetencias.length > 0) {
    const labels = filters.selectedCompetencias.slice(0, 4).map(c => formatCompetenciaShort(c));
    const extra = filters.selectedCompetencias.length > 4
      ? ` (+${filters.selectedCompetencias.length - 4})`
      : '';
    parts.push(`Competências: ${labels.join(', ')}${extra}`);
  } else if (filters.compFilterMode === 'range' && (filters.periodStart || filters.periodEnd)) {
    const startLabel = filters.periodStart ? formatCompetenciaShort(filters.periodStart) : 'Início';
    const endLabel = filters.periodEnd ? formatCompetenciaShort(filters.periodEnd) : 'Atual';
    parts.push(`Período: ${startLabel} a ${endLabel}`);
  } else if (filters.selectedCompetencia && filters.selectedCompetencia !== 'all') {
    parts.push(`Competência: ${formatCompetenciaFull(filters.selectedCompetencia)}`);
  } else if (filters.selectedYears && filters.selectedYears.length > 0) {
    parts.push(`Anos: ${filters.selectedYears.join(', ')}`);
  } else {
    parts.push('Todas as Competências');
  }

  if (filters.selectedEmpresa && filters.selectedEmpresa !== 'all') {
    parts.push(`Contratante: ${filters.selectedEmpresa}`);
  }
  if (filters.selectedVinculo && filters.selectedVinculo !== 'all') {
    const vinculoMap: Record<string, string> = {
      CLT: 'CLT',
      PJ: 'PJ / MEI',
      ESTAGIO: 'Estágio',
    };
    parts.push(`Natureza: ${vinculoMap[filters.selectedVinculo] || filters.selectedVinculo}`);
  }
  if (filters.selectedSetor && filters.selectedSetor !== 'all') {
    parts.push(`Área: ${filters.selectedSetor}`);
  }
  if (filters.selectedStatus && filters.selectedStatus !== 'all') {
    parts.push(`Status: ${filters.selectedStatus}`);
  }
  if (filters.searchTerm && filters.searchTerm.trim() !== '') {
    parts.push(`Busca: "${filters.searchTerm.trim()}"`);
  }
  if (filters.usePageScope) {
    parts.push('Escopo: Base Filtrada na Página');
  }

  return parts.join(' • ');
}

function renderRegimeCountsText(data: PartitionedCompetenciaPdfData): string {
  const parts: string[] = [];
  if (data.cltRows.length > 0) parts.push(`${data.cltRows.length} CLT`);
  if (data.estagioRows.length > 0) parts.push(`${data.estagioRows.length} Estágio`);
  if (data.pjRows.length > 0) parts.push(`${data.pjRows.length} PJ/MEI`);
  return parts.length > 0 ? parts.join(' • ') : '0 registros';
}

function buildSignaturesHtml(mode: 'CLT' | 'ESTAGIO' | 'PJ'): string {
  const firstLabel = mode === 'PJ'
    ? 'Gestão de Contratos / Compras'
    : mode === 'ESTAGIO'
      ? 'Gestão de Estágios / RH'
      : 'Departamento Pessoal (DP)';

  return `
    <div class="signatures">
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">${escapeHtml(firstLabel)}</div>
      </div>
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Controladoria / Auditoria</div>
      </div>
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Diretoria Executiva / Financeiro</div>
      </div>
    </div>
  `;
}

// --- BLOCO 0: RESUMO EXECUTIVO CONSOLIDADO (APENAS NO MODO MISTO — TERMOS 100% NEUTROS) ---
function buildMixedExecutiveSummaryHtml(data: PartitionedCompetenciaPdfData): string {
  const cards: string[] = [];

  if (data.cltRows.length > 0) {
    cards.push(`
      <div class="kpi-card kpi-blue">
        <div class="kpi-label">Folha de Pagamento (CLT)</div>
        <div class="kpi-val">${formatCurrencyBrl(data.cltTotals.liquido)}</div>
        <div class="kpi-sub">${data.cltTotals.countRows} ${data.cltTotals.countRows === 1 ? 'lançamento' : 'lançamentos'} • ${data.cltTotals.uniqueEmployeesCount} empregados</div>
      </div>
    `);
  }

  if (data.estagioRows.length > 0) {
    cards.push(`
      <div class="kpi-card kpi-amber">
        <div class="kpi-label">Bolsas de Estágio (Lei 11.788/08)</div>
        <div class="kpi-val">${formatCurrencyBrl(data.estagioTotals.liquido)}</div>
        <div class="kpi-sub">${data.estagioTotals.countRows} ${data.estagioTotals.countRows === 1 ? 'lançamento' : 'lançamentos'} • ${data.estagioTotals.uniqueEmployeesCount} estagiários</div>
      </div>
    `);
  }

  if (data.pjRows.length > 0) {
    cards.push(`
      <div class="kpi-card kpi-teal">
        <div class="kpi-label">Prestação de Serviços (PJ / MEI)</div>
        <div class="kpi-val">${formatCurrencyBrl(data.pjTotals.valorLiquidoNf)}</div>
        <div class="kpi-sub">${data.pjTotals.countRows} ${data.pjTotals.countRows === 1 ? 'faturamento' : 'faturamentos'} • ${data.pjTotals.uniqueEmployeesCount} contratadas</div>
      </div>
    `);
  }

  cards.push(`
    <div class="kpi-card kpi-liquido">
      <div class="kpi-label">Total Geral Desembolsado (Grupo)</div>
      <div class="kpi-val">${formatCurrencyBrl(data.grandTotals.totalLiquidoGeral)}</div>
      <div class="kpi-sub">${data.grandTotals.countRows} registros • ${data.grandTotals.uniqueEmployeesCount} únicos</div>
    </div>
  `);

  const gridCols = cards.length === 4 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)';

  return `
    <div class="summary-consolidado-box">
      <div class="summary-consolidado-title">Resumo Executivo Consolidado por Natureza Jurídica</div>
      <div class="kpi-grid-dynamic" style="grid-template-columns: ${gridCols};">
        ${cards.join('')}
      </div>
      <div class="compliance-banner">
        <strong>Segregação Jurídico-Contábil:</strong> Vínculos empregatícios (CLT), bolsas de estágio (Lei nº 11.788/2008) e prestação de serviços entre pessoas jurídicas (PJ/MEI) são demonstrados em cadernos independentes com nomenclatura específica de cada regime.${data.pjRows.length > 0 ? ' O Caderno B2B (PJ/MEI) inicia em página própria para conferência destacável.' : ''}
      </div>
    </div>
  `;
}

// --- SEÇÃO CLT (10 COLUNAS ANALÍTICO / 6 COLUNAS SINTÉTICO) ---
function buildCltAnaliticoCardsHtml(totals: CompetenciasPdfTotals): string {
  return `
    <div class="kpi-grid-10">
      <div class="kpi-card kpi-slate">
        <div class="kpi-label">1. Proventos (Folha)</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.proventos)}</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-label">2. + Outros</div>
        <div class="kpi-val">${formatSignedCell(totals.outros, '+', '+R$ 0,00')}</div>
      </div>
      <div class="kpi-card kpi-emerald">
        <div class="kpi-label">3. + VT</div>
        <div class="kpi-val">${formatSignedCell(totals.vt, '+', '+R$ 0,00')}</div>
      </div>
      <div class="kpi-card kpi-amber">
        <div class="kpi-label">4. + VR / Cesta</div>
        <div class="kpi-val">${formatSignedCell(totals.vrCesta, '+', '+R$ 0,00')}</div>
      </div>
      <div class="kpi-card kpi-sky">
        <div class="kpi-label">5. + Bônus</div>
        <div class="kpi-val">${formatSignedCell(totals.bonus, '+', '+R$ 0,00')}</div>
      </div>
      <div class="kpi-card kpi-teal">
        <div class="kpi-label">6. + Premiação</div>
        <div class="kpi-val">${formatSignedCell(totals.premiacao, '+', '+R$ 0,00')}</div>
      </div>
      <div class="kpi-card kpi-subtotal">
        <div class="kpi-label">= Subtotal</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.subtotal)}</div>
      </div>
      <div class="kpi-card kpi-rose">
        <div class="kpi-label">(-) Desc. Folha</div>
        <div class="kpi-val">${formatSignedCell(totals.descontos, '-', '-R$ 0,00')}</div>
      </div>
      <div class="kpi-card kpi-amber-strong">
        <div class="kpi-label">(+) Adiantamento</div>
        <div class="kpi-val">${formatSignedCell(totals.adiantamento, '+', '+R$ 0,00')}</div>
      </div>
      <div class="kpi-card kpi-liquido">
        <div class="kpi-label">= Líquido</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.liquido)}</div>
      </div>
    </div>
  `;
}

function buildCltSinteticoCardsHtml(totals: CompetenciasPdfTotals): string {
  const benDetailParts: string[] = [];
  if (totals.vt > 0) benDetailParts.push(`VT ${formatCurrencyBrl(totals.vt)}`);
  if (totals.vrCesta > 0) benDetailParts.push(`VR ${formatCurrencyBrl(totals.vrCesta)}`);
  if (totals.bonus > 0) benDetailParts.push(`Bônus ${formatCurrencyBrl(totals.bonus)}`);
  if (totals.premiacao > 0) benDetailParts.push(`Prem. ${formatCurrencyBrl(totals.premiacao)}`);
  const benSubtitle = benDetailParts.length > 0 ? benDetailParts.join(' • ') : 'VT, VR/Cesta, Bônus e Premiação';

  return `
    <div class="kpi-grid-6">
      <div class="kpi-card kpi-slate">
        <div class="kpi-label">1. Proventos + Outros</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.proventosComOutros)}</div>
        <div class="kpi-sub">${totals.uniqueEmployeesCount} empregados CLT • ${totals.countRows} lançamentos</div>
      </div>
      <div class="kpi-card kpi-emerald">
        <div class="kpi-label">2. + Benefícios</div>
        <div class="kpi-val">${formatSignedCell(totals.beneficiosAgrupados, '+', '+R$ 0,00')}</div>
        <div class="kpi-sub">${escapeHtml(benSubtitle)}</div>
      </div>
      <div class="kpi-card kpi-subtotal">
        <div class="kpi-label">3. = Subtotal Bruto</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.subtotal)}</div>
        <div class="kpi-sub">Proventos + Outros + Benefícios</div>
      </div>
      <div class="kpi-card kpi-rose">
        <div class="kpi-label">4. (-) Desc. Folha</div>
        <div class="kpi-val">${formatSignedCell(totals.descontos, '-', '-R$ 0,00')}</div>
        <div class="kpi-sub">Deduções e descontos em folha</div>
      </div>
      <div class="kpi-card kpi-amber-strong">
        <div class="kpi-label">5. (+) Adiantamento</div>
        <div class="kpi-val">${formatSignedCell(totals.adiantamento, '+', '+R$ 0,00')}</div>
        <div class="kpi-sub">Adiantamento salarial recomposto</div>
      </div>
      <div class="kpi-card kpi-liquido">
        <div class="kpi-label">6. = Líquido Folha CLT</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.liquido)}</div>
        <div class="kpi-sub">Subtotal - Desc. Folha + Adiant.</div>
      </div>
    </div>
  `;
}

function buildCltSectionHtml(
  rows: CompetenciaCostPdfRow[],
  totals: CompetenciasPdfTotals,
  isSintetico: boolean,
  sectionIndex: number | null
): string {
  const sectionBanner = sectionIndex !== null
    ? `<div class="section-banner section-clt">
         <span>SEÇÃO ${sectionIndex} • FOLHA DE PAGAMENTO — REGIME CLT (VÍNCULO EMPREGATÍCIO)</span>
         <span class="section-meta">${totals.countRows} ${totals.countRows === 1 ? 'lançamento' : 'lançamentos'} • ${totals.uniqueEmployeesCount} empregados</span>
       </div>`
    : '';

  const cardsHtml = isSintetico ? buildCltSinteticoCardsHtml(totals) : buildCltAnaliticoCardsHtml(totals);

  const tableHtml = isSintetico
    ? `
      <table class="table-sintetico">
        <thead>
          <tr>
            <th style="width: 48px;">Comp.</th>
            <th>Colaborador</th>
            <th style="width: 36px; text-align: center;">Reg.</th>
            <th class="num th-slate">Proventos</th>
            <th class="num th-emerald">+ Benefícios</th>
            <th class="num th-subtotal">= Subtotal</th>
            <th class="num th-rose">(-) Desc. Folha</th>
            <th class="num th-adiant">(+) Adiant.</th>
            <th class="num th-liquido">= Líquido</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="col-comp">${escapeHtml(r.competenciaShort)}</td>
              <td class="col-name">
                <div class="emp-name">${escapeHtml(r.displayEntityName)}</div>
                <div class="emp-meta">${escapeHtml(r.company)} • ${escapeHtml(r.roleOrDept)}</div>
              </td>
              <td class="col-regime"><span class="badge-clt">CLT</span></td>
              <td class="num bg-slate-soft fw-bold">${formatCurrencyBrl(r.proventosComOutros)}</td>
              <td class="num bg-emerald-soft ${r.beneficiosAgrupados !== 0 ? 'txt-emerald fw-bold' : 'txt-muted'}">${formatSignedCell(r.beneficiosAgrupados, '+')}</td>
              <td class="num bg-subtotal txt-subtotal fw-black">${formatCurrencyBrl(r.subtotal)}</td>
              <td class="num bg-rose-soft ${r.descontos !== 0 ? 'txt-rose fw-bold' : 'txt-muted'}">${formatSignedCell(r.descontos, '-')}</td>
              <td class="num bg-adiant-soft ${r.adiantamento !== 0 ? 'txt-amber fw-bold' : 'txt-muted'}">${formatSignedCell(r.adiantamento, '+')}</td>
              <td class="num bg-liquido txt-liquido fw-black">${formatCurrencyBrl(r.liquido)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3" style="text-transform: uppercase;">Total Folha CLT (${totals.countRows} ${totals.countRows === 1 ? 'Lançamento' : 'Lançamentos'})</td>
            <td class="num">${formatCurrencyBrl(totals.proventosComOutros)}</td>
            <td class="num txt-emerald">${formatSignedCell(totals.beneficiosAgrupados, '+', 'R$ 0,00')}</td>
            <td class="num bg-subtotal-total txt-subtotal">${formatCurrencyBrl(totals.subtotal)}</td>
            <td class="num txt-rose">${formatSignedCell(totals.descontos, '-', 'R$ 0,00')}</td>
            <td class="num txt-amber">${formatSignedCell(totals.adiantamento, '+', 'R$ 0,00')}</td>
            <td class="num bg-liquido-total txt-liquido">${formatCurrencyBrl(totals.liquido)}</td>
          </tr>
        </tbody>
      </table>
    `
    : `
      <table class="table-analitico">
        <thead>
          <tr>
            <th style="width: 44px;">Comp.</th>
            <th style="min-width: 145px;">Colaborador</th>
            <th style="width: 34px; text-align: center;">Reg.</th>
            <th class="num th-slate">Proventos</th>
            <th class="num th-blue">+ Outros</th>
            <th class="num th-emerald">+ VT</th>
            <th class="num th-amber">+ VR/Cesta</th>
            <th class="num th-sky">+ Bônus</th>
            <th class="num th-teal">+ Premiação</th>
            <th class="num th-subtotal">= Subtotal</th>
            <th class="num th-rose">(-) Desc. Folha</th>
            <th class="num th-adiant">(+) Adiant.</th>
            <th class="num th-liquido">= Líquido</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="col-comp">${escapeHtml(r.competenciaShort)}</td>
              <td class="col-name">
                <div class="emp-name">${escapeHtml(r.displayEntityName)}</div>
                <div class="emp-meta">${escapeHtml(r.company)} • ${escapeHtml(r.roleOrDept)}${r.documentId ? ` • CPF: ${escapeHtml(r.documentId)}` : ''}</div>
              </td>
              <td class="col-regime"><span class="badge-clt">CLT</span></td>
              <td class="num bg-slate-soft fw-bold">${formatCurrencyBrl(r.proventos)}</td>
              <td class="num bg-blue-soft ${r.outros !== 0 ? 'txt-blue fw-bold' : 'txt-muted'}">${formatSignedCell(r.outros, '+')}</td>
              <td class="num bg-emerald-soft ${r.vt !== 0 ? 'txt-emerald fw-bold' : 'txt-muted'}">${formatSignedCell(r.vt, '+')}</td>
              <td class="num bg-amber-soft ${r.vrCesta !== 0 ? 'txt-amber fw-bold' : 'txt-muted'}">${formatSignedCell(r.vrCesta, '+')}</td>
              <td class="num bg-sky-soft ${r.bonus !== 0 ? 'txt-sky fw-bold' : 'txt-muted'}">${formatSignedCell(r.bonus, '+')}</td>
              <td class="num bg-teal-soft ${r.premiacao !== 0 ? 'txt-teal fw-bold' : 'txt-muted'}">${formatSignedCell(r.premiacao, '+')}</td>
              <td class="num bg-subtotal txt-subtotal fw-black">${formatCurrencyBrl(r.subtotal)}</td>
              <td class="num bg-rose-soft ${r.descontos !== 0 ? 'txt-rose fw-bold' : 'txt-muted'}">${formatSignedCell(r.descontos, '-')}</td>
              <td class="num bg-adiant-soft ${r.adiantamento !== 0 ? 'txt-amber fw-bold' : 'txt-muted'}">${formatSignedCell(r.adiantamento, '+')}</td>
              <td class="num bg-liquido txt-liquido fw-black">${formatCurrencyBrl(r.liquido)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3" style="text-transform: uppercase;">Total Folha CLT (${totals.countRows} ${totals.countRows === 1 ? 'Lançamento' : 'Lançamentos'})</td>
            <td class="num">${formatCurrencyBrl(totals.proventos)}</td>
            <td class="num txt-blue">${formatSignedCell(totals.outros, '+', 'R$ 0,00')}</td>
            <td class="num txt-emerald">${formatSignedCell(totals.vt, '+', 'R$ 0,00')}</td>
            <td class="num txt-amber">${formatSignedCell(totals.vrCesta, '+', 'R$ 0,00')}</td>
            <td class="num txt-sky">${formatSignedCell(totals.bonus, '+', 'R$ 0,00')}</td>
            <td class="num txt-teal">${formatSignedCell(totals.premiacao, '+', 'R$ 0,00')}</td>
            <td class="num bg-subtotal-total txt-subtotal">${formatCurrencyBrl(totals.subtotal)}</td>
            <td class="num txt-rose">${formatSignedCell(totals.descontos, '-', 'R$ 0,00')}</td>
            <td class="num txt-amber">${formatSignedCell(totals.adiantamento, '+', 'R$ 0,00')}</td>
            <td class="num bg-liquido-total txt-liquido">${formatCurrencyBrl(totals.liquido)}</td>
          </tr>
        </tbody>
      </table>
    `;

  return `
    <div class="regime-section">
      ${sectionBanner}
      ${cardsHtml}
      ${tableHtml}
      <div class="equation-note">
        <span><strong>Equação CLT:</strong> Subtotal = Proventos + Outros + VT + VR/Cesta + Bônus + Premiação &nbsp;|&nbsp; Líquido = Subtotal (-) Desc. Folha (+) Adiantamento</span>
        <span>Regime CLT • Vínculo Empregatício</span>
      </div>
    </div>
  `;
}

// --- SEÇÃO ESTÁGIO (LEI Nº 11.788/2008 — SEM VÍNCULO EMPREGATÍCIO) ---
function buildEstagioSectionHtml(
  rows: CompetenciaCostPdfRow[],
  totals: CompetenciasPdfTotals,
  isSintetico: boolean,
  sectionIndex: number | null
): string {
  const hasAntecipacao = totals.antecipacaoEstagio > 0;
  const sectionBanner = sectionIndex !== null
    ? `<div class="section-banner section-estagio">
         <span>SEÇÃO ${sectionIndex} • BOLSAS DE ESTÁGIO — LEI Nº 11.788/2008 (SEM VÍNCULO EMPREGATÍCIO)</span>
         <span class="section-meta">${totals.countRows} ${totals.countRows === 1 ? 'lançamento' : 'lançamentos'} • ${totals.uniqueEmployeesCount} estagiários</span>
       </div>`
    : '';

  const cardsHtml = `
    <div class="kpi-grid-6" style="${hasAntecipacao ? 'grid-template-columns: repeat(7, 1fr);' : ''}">
      <div class="kpi-card kpi-slate">
        <div class="kpi-label">1. Bolsa-Auxílio</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.bolsaAuxilio)}</div>
      </div>
      <div class="kpi-card kpi-emerald">
        <div class="kpi-label">2. + Aux. Transporte</div>
        <div class="kpi-val">${formatSignedCell(totals.auxilioTransporte, '+', '+R$ 0,00')}</div>
      </div>
      <div class="kpi-card kpi-blue">
        <div class="kpi-label">3. + Outros Auxílios</div>
        <div class="kpi-val">${formatSignedCell(totals.outrosAuxilios, '+', '+R$ 0,00')}</div>
      </div>
      <div class="kpi-card kpi-subtotal">
        <div class="kpi-label">= Subtotal</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.subtotal)}</div>
      </div>
      <div class="kpi-card kpi-rose">
        <div class="kpi-label">(-) Deduções</div>
        <div class="kpi-val">${formatSignedCell(totals.deducoesEstagio, '-', '-R$ 0,00')}</div>
      </div>
      ${hasAntecipacao ? `
      <div class="kpi-card kpi-amber-strong">
        <div class="kpi-label">(+) Antecipação</div>
        <div class="kpi-val">${formatSignedCell(totals.antecipacaoEstagio, '+', '+R$ 0,00')}</div>
      </div>` : ''}
      <div class="kpi-card kpi-liquido">
        <div class="kpi-label">= Valor Líquido</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.liquido)}</div>
      </div>
    </div>
  `;

  const tableClass = isSintetico ? 'table-sintetico' : 'table-analitico';

  const tableHtml = `
    <table class="${tableClass}">
      <thead>
        <tr>
          <th style="width: 48px;">Comp.</th>
          <th>Estagiário</th>
          <th style="width: 42px; text-align: center;">Mod.</th>
          <th class="num th-slate">Bolsa-Auxílio</th>
          <th class="num th-emerald">+ Aux. Transporte</th>
          <th class="num th-blue">+ Outros Auxílios</th>
          <th class="num th-subtotal">= Subtotal</th>
          <th class="num th-rose">(-) Deduções</th>
          ${hasAntecipacao ? '<th class="num th-adiant">(+) Antecip.</th>' : ''}
          <th class="num th-liquido">= Valor Líquido</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td class="col-comp">${escapeHtml(r.competenciaShort)}</td>
            <td class="col-name">
              <div class="emp-name">${escapeHtml(r.displayEntityName)}</div>
              <div class="emp-meta">${escapeHtml(r.company)} • ${escapeHtml(r.roleOrDept)}${r.documentId ? ` • CPF: ${escapeHtml(r.documentId)}` : ''}</div>
            </td>
            <td class="col-regime"><span class="badge-estagio">EST</span></td>
            <td class="num bg-slate-soft fw-bold">${formatCurrencyBrl(r.bolsaAuxilio)}</td>
            <td class="num bg-emerald-soft ${r.auxilioTransporte !== 0 ? 'txt-emerald fw-bold' : 'txt-muted'}">${formatSignedCell(r.auxilioTransporte, '+')}</td>
            <td class="num bg-blue-soft ${r.outrosAuxilios !== 0 ? 'txt-blue fw-bold' : 'txt-muted'}">${formatSignedCell(r.outrosAuxilios, '+')}</td>
            <td class="num bg-subtotal txt-subtotal fw-black">${formatCurrencyBrl(r.subtotal)}</td>
            <td class="num bg-rose-soft ${r.deducoesEstagio !== 0 ? 'txt-rose fw-bold' : 'txt-muted'}">${formatSignedCell(r.deducoesEstagio, '-')}</td>
            ${hasAntecipacao ? `<td class="num bg-adiant-soft ${r.antecipacaoEstagio !== 0 ? 'txt-amber fw-bold' : 'txt-muted'}">${formatSignedCell(r.antecipacaoEstagio, '+')}</td>` : ''}
            <td class="num bg-liquido txt-liquido fw-black">${formatCurrencyBrl(r.liquido)}</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="3" style="text-transform: uppercase;">Total Bolsas de Estágio (${totals.countRows} ${totals.countRows === 1 ? 'Lançamento' : 'Lançamentos'})</td>
          <td class="num">${formatCurrencyBrl(totals.bolsaAuxilio)}</td>
          <td class="num txt-emerald">${formatSignedCell(totals.auxilioTransporte, '+', 'R$ 0,00')}</td>
          <td class="num txt-blue">${formatSignedCell(totals.outrosAuxilios, '+', 'R$ 0,00')}</td>
          <td class="num bg-subtotal-total txt-subtotal">${formatCurrencyBrl(totals.subtotal)}</td>
          <td class="num txt-rose">${formatSignedCell(totals.deducoesEstagio, '-', 'R$ 0,00')}</td>
          ${hasAntecipacao ? `<td class="num txt-amber">${formatSignedCell(totals.antecipacaoEstagio, '+', 'R$ 0,00')}</td>` : ''}
          <td class="num bg-liquido-total txt-liquido">${formatCurrencyBrl(totals.liquido)}</td>
        </tr>
      </tbody>
    </table>
  `;

  return `
    <div class="regime-section">
      ${sectionBanner}
      ${cardsHtml}
      ${tableHtml}
      <div class="equation-note">
        <span><strong>Equação Estágio (Lei nº 11.788/2008):</strong> Subtotal = Bolsa-Auxílio + Auxílio-Transporte + Outros Auxílios &nbsp;|&nbsp; Valor Líquido = Subtotal (-) Deduções${hasAntecipacao ? ' (+) Antecipação' : ''}</span>
        <span>Termo de Compromisso de Estágio • Sem Vínculo Empregatício</span>
      </div>
    </div>
  `;
}

// --- SEÇÃO PJ / MEI (100% CONTRATUAL B2B — ZERO TERMOS TRABALHISTAS) ---
function buildPjSectionHtml(
  rows: CompetenciaCostPdfRow[],
  totals: CompetenciasPdfTotals,
  isSintetico: boolean,
  sectionIndex: number | null
): string {
  const sectionBanner = sectionIndex !== null
    ? `<div class="section-banner section-pj">
         <span>SEÇÃO ${sectionIndex} • PRESTAÇÃO DE SERVIÇOS — EMPRESAS CONTRATADAS (PJ / MEI)</span>
         <span class="section-meta">${totals.countRows} ${totals.countRows === 1 ? 'faturamento' : 'faturamentos'} • ${totals.uniqueEmployeesCount} contratadas</span>
       </div>`
    : '';

  const cardsHtml = `
    <div class="kpi-grid-6">
      <div class="kpi-card kpi-slate">
        <div class="kpi-label">1. Honorários / NF Base</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.honorariosBase)}</div>
        <div class="kpi-sub">${totals.uniqueEmployeesCount} empresas contratadas</div>
      </div>
      <div class="kpi-card kpi-sky">
        <div class="kpi-label">2. + Variável / Comissões</div>
        <div class="kpi-val">${formatSignedCell(totals.variavelComissoes, '+', '+R$ 0,00')}</div>
        <div class="kpi-sub">Metas contratuais e comissionamento</div>
      </div>
      <div class="kpi-card kpi-teal">
        <div class="kpi-label">3. + Conectividade / Reemb.</div>
        <div class="kpi-val">${formatSignedCell(totals.conectividadeReembolso, '+', '+R$ 0,00')}</div>
        <div class="kpi-sub">Ajuda operacional / reembolso contratual</div>
      </div>
      <div class="kpi-card kpi-subtotal">
        <div class="kpi-label">4. = Valor Bruto NF</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.valorBrutoNf)}</div>
        <div class="kpi-sub">Honorários + Variável + Conectividade</div>
      </div>
      <div class="kpi-card kpi-rose">
        <div class="kpi-label">5. (-) Glosas / Deduções</div>
        <div class="kpi-val">${formatSignedCell(totals.glosasDeducoes, '-', '-R$ 0,00')}</div>
        <div class="kpi-sub">Glosas contratuais e retenções</div>
      </div>
      <div class="kpi-card kpi-liquido">
        <div class="kpi-label">6. = Valor Líquido NF</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.valorLiquidoNf)}</div>
        <div class="kpi-sub">Valor Bruto NF (-) Glosas / Deduções</div>
      </div>
    </div>
  `;

  const tableHtml = isSintetico
    ? `
      <table class="table-sintetico">
        <thead>
          <tr>
            <th style="width: 48px;">Comp.</th>
            <th>Contratada (Razão Social) / CNPJ</th>
            <th style="width: 38px; text-align: center;">Mod.</th>
            <th class="num th-slate">Honorários Base</th>
            <th class="num th-sky">+ Variável / Reemb.</th>
            <th class="num th-subtotal">= Bruto NF</th>
            <th class="num th-rose">(-) Glosas / Ded.</th>
            <th class="num th-liquido">= Líquido NF</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const varReemb = roundCurrency(r.variavelComissoes + r.conectividadeReembolso);
            return `
              <tr>
                <td class="col-comp">${escapeHtml(r.competenciaShort)}</td>
                <td class="col-name">
                  <div class="emp-name">${escapeHtml(r.displayEntityName)}</div>
                  <div class="emp-meta">Contratante: ${escapeHtml(r.company)} • ${escapeHtml(r.roleOrDept)}${r.documentId ? ` • CNPJ: ${escapeHtml(r.documentId)}` : ''}</div>
                </td>
                <td class="col-regime"><span class="badge-pj">PJ</span></td>
                <td class="num bg-slate-soft fw-bold">${formatCurrencyBrl(r.honorariosBase)}</td>
                <td class="num bg-sky-soft ${varReemb !== 0 ? 'txt-sky fw-bold' : 'txt-muted'}">${formatSignedCell(varReemb, '+')}</td>
                <td class="num bg-subtotal txt-subtotal fw-black">${formatCurrencyBrl(r.valorBrutoNf)}</td>
                <td class="num bg-rose-soft ${r.glosasDeducoes !== 0 ? 'txt-rose fw-bold' : 'txt-muted'}">${formatSignedCell(r.glosasDeducoes, '-')}</td>
                <td class="num bg-liquido txt-liquido fw-black">${formatCurrencyBrl(r.valorLiquidoNf)}</td>
              </tr>
            `;
          }).join('')}
          <tr class="total-row">
            <td colspan="3" style="text-transform: uppercase;">Total Prestação de Serviços — PJ/MEI (${totals.countRows} ${totals.countRows === 1 ? 'Registro' : 'Registros'})</td>
            <td class="num">${formatCurrencyBrl(totals.honorariosBase)}</td>
            <td class="num txt-sky">${formatSignedCell(roundCurrency(totals.variavelComissoes + totals.conectividadeReembolso), '+', 'R$ 0,00')}</td>
            <td class="num bg-subtotal-total txt-subtotal">${formatCurrencyBrl(totals.valorBrutoNf)}</td>
            <td class="num txt-rose">${formatSignedCell(totals.glosasDeducoes, '-', 'R$ 0,00')}</td>
            <td class="num bg-liquido-total txt-liquido">${formatCurrencyBrl(totals.valorLiquidoNf)}</td>
          </tr>
        </tbody>
      </table>
    `
    : `
      <table class="table-analitico">
        <thead>
          <tr>
            <th style="width: 48px;">Comp.</th>
            <th style="min-width: 195px;">Contratada (Razão Social) / CNPJ</th>
            <th style="width: 38px; text-align: center;">Mod.</th>
            <th class="num th-slate">Honorários / NF Base</th>
            <th class="num th-sky">+ Variável / Comissões</th>
            <th class="num th-teal">+ Conectividade / Reemb.</th>
            <th class="num th-subtotal">= Valor Bruto NF</th>
            <th class="num th-rose">(-) Glosas / Deduções</th>
            <th class="num th-liquido">= Valor Líquido NF</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="col-comp">${escapeHtml(r.competenciaShort)}</td>
              <td class="col-name">
                <div class="emp-name">${escapeHtml(r.displayEntityName)}</div>
                <div class="emp-meta">Contratante: ${escapeHtml(r.company)} • Escopo: ${escapeHtml(r.roleOrDept)}${r.documentId ? ` • CNPJ: ${escapeHtml(r.documentId)}` : ''}</div>
              </td>
              <td class="col-regime"><span class="badge-pj">PJ</span></td>
              <td class="num bg-slate-soft fw-bold">${formatCurrencyBrl(r.honorariosBase)}</td>
              <td class="num bg-sky-soft ${r.variavelComissoes !== 0 ? 'txt-sky fw-bold' : 'txt-muted'}">${formatSignedCell(r.variavelComissoes, '+')}</td>
              <td class="num bg-teal-soft ${r.conectividadeReembolso !== 0 ? 'txt-teal fw-bold' : 'txt-muted'}">${formatSignedCell(r.conectividadeReembolso, '+')}</td>
              <td class="num bg-subtotal txt-subtotal fw-black">${formatCurrencyBrl(r.valorBrutoNf)}</td>
              <td class="num bg-rose-soft ${r.glosasDeducoes !== 0 ? 'txt-rose fw-bold' : 'txt-muted'}">${formatSignedCell(r.glosasDeducoes, '-')}</td>
              <td class="num bg-liquido txt-liquido fw-black">${formatCurrencyBrl(r.valorLiquidoNf)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3" style="text-transform: uppercase;">Total Prestação de Serviços — PJ/MEI (${totals.countRows} ${totals.countRows === 1 ? 'Registro' : 'Registros'})</td>
            <td class="num">${formatCurrencyBrl(totals.honorariosBase)}</td>
            <td class="num txt-sky">${formatSignedCell(totals.variavelComissoes, '+', 'R$ 0,00')}</td>
            <td class="num txt-teal">${formatSignedCell(totals.conectividadeReembolso, '+', 'R$ 0,00')}</td>
            <td class="num bg-subtotal-total txt-subtotal">${formatCurrencyBrl(totals.valorBrutoNf)}</td>
            <td class="num txt-rose">${formatSignedCell(totals.glosasDeducoes, '-', 'R$ 0,00')}</td>
            <td class="num bg-liquido-total txt-liquido">${formatCurrencyBrl(totals.valorLiquidoNf)}</td>
          </tr>
        </tbody>
      </table>
    `;

  return `
    <div class="regime-section">
      ${sectionBanner}
      ${cardsHtml}
      ${tableHtml}
      <div class="equation-note">
        <span><strong>Equação Contratual (PJ / MEI):</strong> Valor Bruto NF = Honorários Base + Variável/Comissões + Conectividade/Reembolso &nbsp;|&nbsp; Valor Líquido NF = Valor Bruto NF (-) Glosas/Deduções</span>
        <span>Relação Empresarial B2B • Prestação de Serviços</span>
      </div>
    </div>
  `;
}

export function buildCompetenciasCostsPdfHtml(params: BuildCompetenciasPdfParams): string {
  const isSintetico = params.reportType === 'sintetico';
  const data = partitionCompetenciaPdfRows(params.rows || []);
  const scopeDesc = buildScopeDescription(params.filters);

  const now = params.generatedAt || new Date();
  const todayStr = now.toLocaleDateString('pt-BR');
  const todayTimeStr = now.toLocaleTimeString('pt-BR');

  const isOnlyPj = data.grandTotals.regimesPresent.length === 1 && data.grandTotals.regimesPresent[0] === 'PJ';
  const isOnlyEstagio = data.grandTotals.regimesPresent.length === 1 && data.grandTotals.regimesPresent[0] === 'ESTAGIO';
  const isOnlyClt = data.grandTotals.regimesPresent.length === 1 && data.grandTotals.regimesPresent[0] === 'CLT';
  const isMixed = data.grandTotals.isMixed;

  let titleLabel = isSintetico
    ? 'Relatório Sintético de Custos por Competência'
    : 'Relatório Analítico de Custos por Competência';
  let subtitleLabel = isSintetico
    ? 'Demonstrativo Sintético de Custos por Competência'
    : 'Demonstrativo Analítico de Custos por Competência';

  if (isOnlyClt) {
    titleLabel = isSintetico
      ? 'Relatório Sintético de Folha de Pagamento (CLT)'
      : 'Relatório Analítico de Folha de Pagamento — CLT (10 Colunas)';
    subtitleLabel = isSintetico
      ? 'Demonstrativo Sintético de Folha de Pagamento • Regime CLT'
      : 'Demonstrativo Analítico de Folha de Pagamento • Regime CLT (Quebra Unificada — 10 Colunas)';
  } else if (isOnlyEstagio) {
    titleLabel = isSintetico
      ? 'Relatório Sintético de Bolsas de Estágio (Lei nº 11.788/2008)'
      : 'Relatório Analítico de Bolsas de Estágio (Lei nº 11.788/2008)';
    subtitleLabel = isSintetico
      ? 'Demonstrativo Sintético de Bolsas e Auxílios de Estágio • Lei nº 11.788/2008'
      : 'Demonstrativo Analítico de Bolsas e Auxílios de Estágio • Lei nº 11.788/2008';
  } else if (isOnlyPj) {
    titleLabel = isSintetico
      ? 'Relatório Sintético de Prestação de Serviços (PJ / MEI)'
      : 'Relatório Analítico de Prestação de Serviços (PJ / MEI)';
    subtitleLabel = isSintetico
      ? 'Demonstrativo Sintético de Faturamento e Honorários Contratuais • Empresas Contratadas (PJ / MEI)'
      : 'Demonstrativo Analítico de Faturamento e Honorários Contratuais • Empresas Contratadas (PJ / MEI)';
  } else if (isMixed) {
    titleLabel = isSintetico
      ? 'Relatório Sintético Consolidado por Natureza Jurídica'
      : 'Relatório Analítico Consolidado por Natureza Jurídica';
    subtitleLabel = isSintetico
      ? 'Demonstrativo Sintético Segregado por Natureza Jurídica (Cadernos Independentes)'
      : 'Demonstrativo Analítico Segregado por Natureza Jurídica (Cadernos Independentes)';
  }

  let bodyContentHtml = '';

  if (data.grandTotals.countRows === 0) {
    bodyContentHtml = `
      <div class="empty-state-box">
        Nenhum registro encontrado para os filtros selecionados.
      </div>
    `;
  } else if (isOnlyClt) {
    bodyContentHtml = `
      ${buildCltSectionHtml(data.cltRows, data.cltTotals, isSintetico, null)}
      ${buildSignaturesHtml('CLT')}
    `;
  } else if (isOnlyEstagio) {
    bodyContentHtml = `
      ${buildEstagioSectionHtml(data.estagioRows, data.estagioTotals, isSintetico, null)}
      ${buildSignaturesHtml('ESTAGIO')}
    `;
  } else if (isOnlyPj) {
    bodyContentHtml = `
      ${buildPjSectionHtml(data.pjRows, data.pjTotals, isSintetico, null)}
      ${buildSignaturesHtml('PJ')}
    `;
  } else {
    // MODO MISTO: Resumo Consolidado + Cadernos Segregados + Quebra de Página Obrigatória antes de PJ/MEI
    const blocks: string[] = [];
    blocks.push(buildMixedExecutiveSummaryHtml(data));

    let sectionCounter = 1;
    const hasInternalSections = data.cltRows.length > 0 || data.estagioRows.length > 0;

    if (data.cltRows.length > 0) {
      blocks.push(buildCltSectionHtml(data.cltRows, data.cltTotals, isSintetico, sectionCounter));
      sectionCounter += 1;
    }

    if (data.estagioRows.length > 0) {
      blocks.push(buildEstagioSectionHtml(data.estagioRows, data.estagioTotals, isSintetico, sectionCounter));
      sectionCounter += 1;
    }

    if (hasInternalSections) {
      blocks.push(buildSignaturesHtml(data.cltRows.length > 0 ? 'CLT' : 'ESTAGIO'));
    }

    if (data.pjRows.length > 0) {
      // Caderno Independente B2B em nova página (destacável para auditoria/contabilidade)
      const pjBookletHeader = `
        <div class="pj-booklet-break">
          <div class="header-box header-box-pj">
            <div>
              <div class="company-title">Mar Brasil • Grupo Empresarial</div>
              <div class="report-subtitle" style="color: #0f766e;">
                Caderno Independente • Prestação de Serviços — Empresas Contratadas (PJ / MEI)
              </div>
              <div class="scope-line">
                ${escapeHtml(scopeDesc)} • <strong>${data.pjTotals.countRows} ${data.pjTotals.countRows === 1 ? 'faturamento' : 'faturamentos'}</strong> (${data.pjTotals.uniqueEmployeesCount} contratadas PJ/MEI)
              </div>
            </div>
            <div class="meta-info">
              Emissão: <strong>${escapeHtml(todayStr)} às ${escapeHtml(todayTimeStr)}</strong><br/>
              Governança de Contratos B2B<br/>
              Documento Destacável
            </div>
          </div>
          ${buildPjSectionHtml(data.pjRows, data.pjTotals, isSintetico, sectionCounter)}
          ${buildSignaturesHtml('PJ')}
        </div>
      `;
      blocks.push(pjBookletHeader);
    }

    bodyContentHtml = blocks.join('\n');
  }

  const originMetaLine = isOnlyPj
    ? 'Governança de Contratos B2B'
    : 'Sistema Integrado People Cockpit';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>Mar Brasil • ${escapeHtml(titleLabel)}</title>
  <meta charset="utf-8" />
  <style>
    @page {
      size: A4 ${isSintetico ? 'portrait' : 'landscape'};
      margin: ${isSintetico ? '10mm' : '8mm'};
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 9.5px;
      line-height: 1.3;
    }
    .header-box {
      border-bottom: 2px solid #059669;
      padding-bottom: 7px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .header-box-pj {
      border-bottom-color: #0f766e;
    }
    .company-title {
      font-size: 15px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.4px;
      text-transform: uppercase;
    }
    .report-subtitle {
      font-size: 10.5px;
      font-weight: 700;
      color: #059669;
      margin-top: 2px;
    }
    .scope-line {
      font-size: 8.5px;
      color: #475569;
      margin-top: 3px;
    }
    .meta-info {
      font-size: 8.5px;
      color: #64748b;
      text-align: right;
      line-height: 1.4;
      white-space: nowrap;
    }
    .summary-consolidado-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 9px;
      padding: 8px 10px;
      margin-bottom: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .summary-consolidado-title {
      font-size: 8.5px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #334155;
      margin-bottom: 6px;
    }
    .compliance-banner {
      margin-top: 6px;
      font-size: 7.4px;
      color: #475569;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #059669;
      border-radius: 5px;
      padding: 4.5px 7px;
    }
    .section-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5.5px 9px;
      border-radius: 6px;
      font-size: 8.5px;
      font-weight: 900;
      letter-spacing: 0.35px;
      text-transform: uppercase;
      margin: 10px 0 7px 0;
      page-break-after: avoid;
      break-after: avoid;
    }
    .section-clt {
      background: #eff6ff;
      color: #1e3a8a;
      border: 1px solid #bfdbfe;
      border-left: 4px solid #2563eb;
    }
    .section-estagio {
      background: #fffbeb;
      color: #92400e;
      border: 1px solid #fde68a;
      border-left: 4px solid #d97706;
    }
    .section-pj {
      background: #f0fdfa;
      color: #134e4a;
      border: 1px solid #99f6e4;
      border-left: 4px solid #0f766e;
    }
    .section-meta {
      font-size: 7.6px;
      font-weight: 700;
      opacity: 0.85;
      text-transform: none;
    }
    .regime-section {
      margin-bottom: 12px;
    }
    .pj-booklet-break {
      page-break-before: always;
      break-before: page;
    }
    .empty-state-box {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      color: #64748b;
      font-weight: 700;
      margin: 16px 0;
    }
    .kpi-grid-dynamic {
      display: grid;
      gap: 6px;
    }
    .kpi-grid-10 {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      margin-bottom: 8px;
    }
    .kpi-grid-6 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 8px;
    }
    .kpi-card {
      border-radius: 7px;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .kpi-label {
      font-size: 7.4px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #475569;
    }
    .kpi-val {
      font-size: 11.5px;
      font-weight: 900;
      margin-top: 2px;
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
      white-space: nowrap;
    }
    .kpi-sub {
      font-size: 7px;
      color: #64748b;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kpi-slate { background: #f8fafc; border-color: #cbd5e1; }
    .kpi-slate .kpi-label { color: #475569; }
    .kpi-slate .kpi-val { color: #0f172a; }

    .kpi-blue { background: #eff6ff; border-color: #bfdbfe; }
    .kpi-blue .kpi-label { color: #1d4ed8; }
    .kpi-blue .kpi-val { color: #1e40af; }

    .kpi-emerald { background: #ecfdf5; border-color: #a7f3d0; }
    .kpi-emerald .kpi-label { color: #047857; }
    .kpi-emerald .kpi-val { color: #065f46; }

    .kpi-amber { background: #fffbeb; border-color: #fde68a; }
    .kpi-amber .kpi-label { color: #b45309; }
    .kpi-amber .kpi-val { color: #92400e; }

    .kpi-sky { background: #f0f9ff; border-color: #bae6fd; }
    .kpi-sky .kpi-label { color: #0369a1; }
    .kpi-sky .kpi-val { color: #0c4a6e; }

    .kpi-teal { background: #f0fdfa; border-color: #99f6e4; }
    .kpi-teal .kpi-label { color: #0f766e; }
    .kpi-teal .kpi-val { color: #134e4a; }

    .kpi-subtotal { background: #dbeafe; border: 1.5px solid #60a5fa; }
    .kpi-subtotal .kpi-label { color: #1e3a8a; }
    .kpi-subtotal .kpi-val { color: #1e3a8a; }

    .kpi-rose { background: #fff1f2; border-color: #fecdd3; }
    .kpi-rose .kpi-label { color: #be123c; }
    .kpi-rose .kpi-val { color: #be123c; }

    .kpi-amber-strong { background: #fef3c7; border-color: #fcd34d; }
    .kpi-amber-strong .kpi-label { color: #92400e; }
    .kpi-amber-strong .kpi-val { color: #92400e; }

    .kpi-liquido { background: #d1fae5; border: 1.5px solid #10b981; }
    .kpi-liquido .kpi-label { color: #064e3b; }
    .kpi-liquido .kpi-val { color: #064e3b; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    .table-analitico {
      font-size: 7.6px;
    }
    .table-sintetico {
      font-size: 8.3px;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 7.2px;
      padding: 4.5px 4px;
      border: 1px solid #cbd5e1;
      text-align: left;
      white-space: nowrap;
    }
    td {
      padding: 4px 4px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    th.num, td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
      white-space: nowrap;
    }
    .col-comp {
      font-weight: 700;
      color: #1e293b;
      white-space: nowrap;
    }
    .col-name {
      max-width: 215px;
    }
    .emp-name {
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }
    .emp-meta {
      font-size: 6.8px;
      color: #64748b;
      margin-top: 1px;
      line-height: 1.15;
    }
    .col-regime {
      text-align: center;
      white-space: nowrap;
    }
    .fw-bold { font-weight: 700; }
    .fw-black { font-weight: 900; }

    .th-slate { background: #e2e8f0; color: #1e293b; }
    .th-blue { background: #dbeafe; color: #1d4ed8; }
    .th-emerald { background: #d1fae5; color: #047857; }
    .th-amber { background: #fef3c7; color: #b45309; }
    .th-sky { background: #e0f2fe; color: #0369a1; }
    .th-teal { background: #ccfbf1; color: #0f766e; }
    .th-subtotal { background: #bfdbfe; color: #1e3a8a; }
    .th-rose { background: #ffe4e6; color: #be123c; }
    .th-adiant { background: #fde68a; color: #92400e; }
    .th-liquido { background: #a7f3d0; color: #064e3b; }

    .bg-slate-soft { background: #f8fafc; }
    .bg-blue-soft { background: #f8fbff; }
    .bg-emerald-soft { background: #f6fef9; }
    .bg-amber-soft { background: #fffdf5; }
    .bg-sky-soft { background: #f5fbff; }
    .bg-teal-soft { background: #f5fdfa; }
    .bg-subtotal { background: #eff6ff; }
    .bg-rose-soft { background: #fff7f8; }
    .bg-adiant-soft { background: #fffbeb; }
    .bg-liquido { background: #ecfdf5; }

    .bg-subtotal-total { background: #dbeafe !important; }
    .bg-liquido-total { background: #d1fae5 !important; }

    .txt-muted { color: #94a3b8; }
    .txt-blue { color: #1d4ed8; }
    .txt-emerald { color: #047857; }
    .txt-amber { color: #b45309; }
    .txt-sky { color: #0369a1; }
    .txt-teal { color: #0f766e; }
    .txt-subtotal { color: #1e3a8a; }
    .txt-rose { color: #be123c; }
    .txt-liquido { color: #065f46; }

    .badge-clt {
      background: #dbeafe;
      color: #1e40af;
      font-weight: 800;
      font-size: 6.8px;
      padding: 1.5px 4px;
      border-radius: 4px;
      text-transform: uppercase;
      display: inline-block;
    }
    .badge-pj {
      background: #ccfbf1;
      color: #134e4a;
      font-weight: 800;
      font-size: 6.8px;
      padding: 1.5px 4px;
      border-radius: 4px;
      text-transform: uppercase;
      display: inline-block;
    }
    .badge-estagio {
      background: #fef3c7;
      color: #92400e;
      font-weight: 800;
      font-size: 6.8px;
      padding: 1.5px 4px;
      border-radius: 4px;
      text-transform: uppercase;
      display: inline-block;
    }
    .total-row td {
      background: #e2e8f0;
      font-weight: 900;
      border-top: 2px solid #059669;
      padding: 5.5px 4px;
      font-size: ${isSintetico ? '8.5px' : '7.9px'};
    }
    .equation-note {
      margin-top: 6px;
      font-size: 7.3px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .signatures {
      margin-top: 22px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-around;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-line {
      width: 170px;
      border-top: 1px solid #94a3b8;
      margin: 0 auto 4px auto;
    }
    .sig-label {
      font-size: 8px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header-box ${isOnlyPj ? 'header-box-pj' : ''}">
    <div>
      <div class="company-title">Mar Brasil • Grupo Empresarial</div>
      <div class="report-subtitle" style="${isOnlyPj ? 'color: #0f766e;' : ''}">${escapeHtml(subtitleLabel)}</div>
      <div class="scope-line">
        ${escapeHtml(scopeDesc)} • <strong>${data.grandTotals.countRows} ${data.grandTotals.countRows === 1 ? 'registro' : 'registros'}</strong> (${data.grandTotals.uniqueEmployeesCount} únicos • ${escapeHtml(renderRegimeCountsText(data))})
      </div>
    </div>
    <div class="meta-info">
      Emissão: <strong>${escapeHtml(todayStr)} às ${escapeHtml(todayTimeStr)}</strong><br/>
      ${escapeHtml(originMetaLine)}<br/>
      Auditoria Contábil Rastreada
    </div>
  </div>

  ${bodyContentHtml}

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;
}
