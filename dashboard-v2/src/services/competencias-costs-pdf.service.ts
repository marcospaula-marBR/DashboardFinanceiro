import type { Employee, MonthlyCost } from '@/types/loans';
import type { RowFinancials } from '@/services/people-hr.service';

export type CompetenciasPdfReportType = 'sintetico' | 'analitico';

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
  company: string;
  roleOrDept: string;
  documentId: string;
  regime: 'CLT' | 'PJ' | 'ESTAGIO';
  regimeLabel: string;
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
}

export interface CompetenciasPdfTotals {
  countRows: number;
  uniqueEmployeesCount: number;
  countClt: number;
  countPj: number;
  countEstagio: number;
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
  const regime: 'CLT' | 'PJ' | 'ESTAGIO' = isEstagio ? 'ESTAGIO' : (isCLT ? 'CLT' : 'PJ');
  const regimeLabel = isEstagio ? 'Estágio' : (isCLT ? 'CLT' : 'PJ');

  let proventos = 0;
  let outros = 0;
  let vt = 0;
  let vrCesta = 0;
  let bonus = 0;
  let premiacao = 0;
  let descontos = 0;
  let adiantamento = 0;

  if (isCLT) {
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
    // Blindagem CLT: Premiação lê estritamente valor_ajuda_custo (nunca valor_incentivos)
    premiacao = roundCurrency(toSafeNumber(cost.valor_ajuda_custo));
    descontos = roundCurrency(toSafeNumber(cost.valor_descontos) || toSafeNumber(financials.descontosFolha));
    adiantamento = roundCurrency(toSafeNumber(cost.valor_adiantamento));
  } else {
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
  }

  const subtotal = roundCurrency(proventos + outros + vt + vrCesta + bonus + premiacao);
  const liquido = roundCurrency(toSafeNumber(input.realTotal));
  const beneficiosAgrupados = roundCurrency(vt + vrCesta + bonus + premiacao);
  const proventosComOutros = roundCurrency(proventos + outros);

  const compStr = String(cost.competencia || '');
  const company = emp.company || 'MarBR';
  const roleOrDept = emp.job_role || emp.department || '—';
  const documentId = emp.document_id || emp.responsible_cpf || '';

  return {
    competencia: compStr,
    competenciaShort: formatCompetenciaShort(compStr),
    competenciaFull: formatCompetenciaFull(compStr),
    employeeId: String(cost.employee_id || input.name || ''),
    name: input.name || 'Colaborador',
    company,
    roleOrDept,
    documentId,
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
    parts.push(`Empresa: ${filters.selectedEmpresa}`);
  }
  if (filters.selectedVinculo && filters.selectedVinculo !== 'all') {
    const vinculoMap: Record<string, string> = {
      CLT: 'CLT',
      PJ: 'PJ / MEI',
      ESTAGIO: 'Estágio',
    };
    parts.push(`Regime: ${vinculoMap[filters.selectedVinculo] || filters.selectedVinculo}`);
  }
  if (filters.selectedSetor && filters.selectedSetor !== 'all') {
    parts.push(`Setor: ${filters.selectedSetor}`);
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

function getRegimeBadgeClass(regime: 'CLT' | 'PJ' | 'ESTAGIO'): string {
  if (regime === 'ESTAGIO') return 'badge-estagio';
  if (regime === 'CLT') return 'badge-clt';
  return 'badge-pj';
}

function renderRegimeBreakdown(totals: CompetenciasPdfTotals): string {
  const parts: string[] = [];
  if (totals.countClt > 0) parts.push(`${totals.countClt} CLT`);
  if (totals.countPj > 0) parts.push(`${totals.countPj} PJ`);
  if (totals.countEstagio > 0) parts.push(`${totals.countEstagio} Estágio`);
  return parts.length > 0 ? parts.join(' • ') : '0 lançamentos';
}

function buildAnaliticoCardsHtml(totals: CompetenciasPdfTotals): string {
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
      <div class="kpi-card kpi-adiantamento">
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

function buildSinteticoCardsHtml(totals: CompetenciasPdfTotals): string {
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
        <div class="kpi-sub">${totals.uniqueEmployeesCount} únicos • ${renderRegimeBreakdown(totals)}</div>
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
        <div class="kpi-sub">Deduções e descontos da folha</div>
      </div>
      <div class="kpi-card kpi-adiantamento">
        <div class="kpi-label">5. (+) Adiantamento</div>
        <div class="kpi-val">${formatSignedCell(totals.adiantamento, '+', '+R$ 0,00')}</div>
        <div class="kpi-sub">Adiantamento salarial recomposto</div>
      </div>
      <div class="kpi-card kpi-liquido">
        <div class="kpi-label">6. = Líquido Desembolsado</div>
        <div class="kpi-val">${formatCurrencyBrl(totals.liquido)}</div>
        <div class="kpi-sub">Subtotal - Desc. Folha + Adiant.</div>
      </div>
    </div>
  `;
}

function buildAnaliticoTableHtml(rows: CompetenciaCostPdfRow[], totals: CompetenciasPdfTotals): string {
  const bodyRows = rows.length === 0
    ? `<tr><td colspan="13" style="text-align: center; padding: 14px; color: #64748b;">Nenhum lançamento encontrado para os filtros selecionados.</td></tr>`
    : rows.map(r => `
        <tr>
          <td class="col-comp">${escapeHtml(r.competenciaShort)}</td>
          <td class="col-name">
            <div class="emp-name">${escapeHtml(r.name)}</div>
            <div class="emp-meta">${escapeHtml(r.company)} • ${escapeHtml(r.roleOrDept)}${r.documentId ? ` • ${escapeHtml(r.documentId)}` : ''}</div>
          </td>
          <td class="col-regime"><span class="${getRegimeBadgeClass(r.regime)}">${escapeHtml(r.regime === 'ESTAGIO' ? 'EST' : r.regime)}</span></td>
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
      `).join('');

  return `
    <table class="table-analitico">
      <thead>
        <tr>
          <th style="width: 44px;">Comp.</th>
          <th style="min-width: 145px;">Colaborador</th>
          <th style="width: 34px; text-align: center;">Vínc.</th>
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
        ${bodyRows}
        <tr class="total-row">
          <td colspan="3" style="text-transform: uppercase;">Total Consolidado (${totals.countRows} ${totals.countRows === 1 ? 'Lançamento' : 'Lançamentos'})</td>
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
}

function buildSinteticoTableHtml(rows: CompetenciaCostPdfRow[], totals: CompetenciasPdfTotals): string {
  const bodyRows = rows.length === 0
    ? `<tr><td colspan="9" style="text-align: center; padding: 14px; color: #64748b;">Nenhum lançamento encontrado para os filtros selecionados.</td></tr>`
    : rows.map(r => `
        <tr>
          <td class="col-comp">${escapeHtml(r.competenciaShort)}</td>
          <td class="col-name">
            <div class="emp-name">${escapeHtml(r.name)}</div>
            <div class="emp-meta">${escapeHtml(r.company)} • ${escapeHtml(r.roleOrDept)}</div>
          </td>
          <td class="col-regime"><span class="${getRegimeBadgeClass(r.regime)}">${escapeHtml(r.regime === 'ESTAGIO' ? 'EST' : r.regime)}</span></td>
          <td class="num bg-slate-soft fw-bold">${formatCurrencyBrl(r.proventosComOutros)}</td>
          <td class="num bg-emerald-soft ${r.beneficiosAgrupados !== 0 ? 'txt-emerald fw-bold' : 'txt-muted'}">${formatSignedCell(r.beneficiosAgrupados, '+')}</td>
          <td class="num bg-subtotal txt-subtotal fw-black">${formatCurrencyBrl(r.subtotal)}</td>
          <td class="num bg-rose-soft ${r.descontos !== 0 ? 'txt-rose fw-bold' : 'txt-muted'}">${formatSignedCell(r.descontos, '-')}</td>
          <td class="num bg-adiant-soft ${r.adiantamento !== 0 ? 'txt-amber fw-bold' : 'txt-muted'}">${formatSignedCell(r.adiantamento, '+')}</td>
          <td class="num bg-liquido txt-liquido fw-black">${formatCurrencyBrl(r.liquido)}</td>
        </tr>
      `).join('');

  return `
    <table class="table-sintetico">
      <thead>
        <tr>
          <th style="width: 48px;">Comp.</th>
          <th>Colaborador</th>
          <th style="width: 38px; text-align: center;">Vínc.</th>
          <th class="num th-slate">Proventos</th>
          <th class="num th-emerald">+ Benefícios</th>
          <th class="num th-subtotal">= Subtotal</th>
          <th class="num th-rose">(-) Desc. Folha</th>
          <th class="num th-adiant">(+) Adiant.</th>
          <th class="num th-liquido">= Líquido</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
        <tr class="total-row">
          <td colspan="3" style="text-transform: uppercase;">Total Consolidado (${totals.countRows} ${totals.countRows === 1 ? 'Lançamento' : 'Lançamentos'})</td>
          <td class="num">${formatCurrencyBrl(totals.proventosComOutros)}</td>
          <td class="num txt-emerald">${formatSignedCell(totals.beneficiosAgrupados, '+', 'R$ 0,00')}</td>
          <td class="num bg-subtotal-total txt-subtotal">${formatCurrencyBrl(totals.subtotal)}</td>
          <td class="num txt-rose">${formatSignedCell(totals.descontos, '-', 'R$ 0,00')}</td>
          <td class="num txt-amber">${formatSignedCell(totals.adiantamento, '+', 'R$ 0,00')}</td>
          <td class="num bg-liquido-total txt-liquido">${formatCurrencyBrl(totals.liquido)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

export function buildCompetenciasCostsPdfHtml(params: BuildCompetenciasPdfParams): string {
  const isSintetico = params.reportType === 'sintetico';
  const normalizedRows = (params.rows || []).map(normalizeCompetenciaCostRow);
  const totals = summarizeCompetenciaPdfRows(normalizedRows);
  const scopeDesc = buildScopeDescription(params.filters);

  const now = params.generatedAt || new Date();
  const todayStr = now.toLocaleDateString('pt-BR');
  const todayTimeStr = now.toLocaleTimeString('pt-BR');

  const titleLabel = isSintetico
    ? 'Relatório Sintético de Custos por Competência'
    : 'Relatório Analítico de Custos por Competência (10 Colunas)';

  const subtitleLabel = isSintetico
    ? 'Demonstrativo Sintético de Custos por Competência (Visão Executiva Consolidada)'
    : 'Demonstrativo Analítico de Custos por Competência (Quebra Unificada — 10 Colunas)';

  const cardsHtml = isSintetico
    ? buildSinteticoCardsHtml(totals)
    : buildAnaliticoCardsHtml(totals);

  const tableHtml = isSintetico
    ? buildSinteticoTableHtml(normalizedRows, totals)
    : buildAnaliticoTableHtml(normalizedRows, totals);

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
    .kpi-grid-10 {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }
    .kpi-grid-6 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 12px;
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
      font-size: 7.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.35px;
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

    .kpi-adiantamento { background: #fef3c7; border-color: #fcd34d; }
    .kpi-adiantamento .kpi-label { color: #92400e; }
    .kpi-adiantamento .kpi-val { color: #92400e; }

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
      max-width: 185px;
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
      background: #d1fae5;
      color: #065f46;
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
      margin-top: 7px;
      font-size: 7.5px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .signatures {
      margin-top: 24px;
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
  <div class="header-box">
    <div>
      <div class="company-title">Mar Brasil • Grupo Empresarial</div>
      <div class="report-subtitle">${escapeHtml(subtitleLabel)}</div>
      <div class="scope-line">
        ${escapeHtml(scopeDesc)} • <strong>${totals.countRows} ${totals.countRows === 1 ? 'lançamento' : 'lançamentos'}</strong> (${totals.uniqueEmployeesCount} únicos • ${escapeHtml(renderRegimeBreakdown(totals))})
      </div>
    </div>
    <div class="meta-info">
      Emissão: <strong>${escapeHtml(todayStr)} às ${escapeHtml(todayTimeStr)}</strong><br/>
      Sistema Integrado People Cockpit<br/>
      Auditoria Contábil Rastreada
    </div>
  </div>

  ${cardsHtml}
  ${tableHtml}

  <div class="equation-note">
    <span><strong>Equação Contábil Unificada:</strong> Subtotal = Proventos + Outros + VT + VR/Cesta + Bônus + Premiação &nbsp;|&nbsp; Líquido = Subtotal (-) Desc. Folha (+) Adiantamento</span>
    <span>Espelho fiel aos totalizadores da Central de Lançamentos por Competência</span>
  </div>

  <div class="signatures">
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Departamento Pessoal (DP)</div>
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
