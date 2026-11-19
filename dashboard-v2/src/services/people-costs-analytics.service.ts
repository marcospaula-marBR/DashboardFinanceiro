import type { Employee, MonthlyCost } from '@/types/loans';
import { calculateRowFinancials } from '@/services/people-hr.service';

export type AnalyticsLegalNature = 'CLT' | 'ESTAGIO' | 'PJ';

export interface EnrichedCostRecord {
  id: string;
  employeeId: string;
  competencia: string; // YYYY-MM-01
  competenciaMonth: string; // YYYY-MM
  legalNature: AnalyticsLegalNature;
  displayName: string;
  employeeName: string;
  documentId: string;
  company: string;
  department: string;
  jobRole: string;
  status: string;
  proventosOrHonorarios: number;
  outrosRecebidos: number;
  vt: number;
  vrCesta: number;
  bonus: number;
  comissao: number;
  incentivos: number;
  premiacaoOrConectividade: number;
  descontosOrGlosas: number;
  adiantamento: number;
  liquido: number;
  contractBase: number;
}

export interface AnalyticsFilterParams {
  startCompetencia?: string; // YYYY-MM ou YYYY-MM-01
  endCompetencia?: string;   // YYYY-MM ou YYYY-MM-01
  year?: number | string;
  company?: string;          // 'MarBR' | 'DZM' | 'G2' | 'all'
  regime?: 'CLT' | 'ESTAGIO' | 'PJ' | 'ALL';
  department?: string;
}

function round2(val: number): number {
  const n = Number.isFinite(val) ? val : 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function normText(val: string | null | undefined): string {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normCompany(val: string | null | undefined): string {
  const u = String(val || '').trim().toUpperCase();
  if (!u || u === 'ALL' || u === 'TODAS') return 'ALL';
  if (u.includes('MAR BRASIL') || u.includes('MARBR')) return 'MarBR';
  if (u.includes('D.Z.M') || u.includes('DZM')) return 'DZM';
  if (u.includes('G2')) return 'G2';
  return String(val || '').trim();
}

function getPreviousMonthKey(ym: string): string {
  const parts = String(ym || '').slice(0, 7).split('-');
  if (parts.length !== 2) return '';
  let y = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10) - 1;
  if (isNaN(y) || isNaN(m)) return '';
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Enriquece 100% do histórico de custos em O(N), preservando rigorosamente a segregação jurídica
 * (CLT vs Estágio Lei nº 11.788/2008 vs Prestação de Serviços PJ/MEI) e a equação contábil oficial.
 */
export function enrichHistoricalCosts(
  costs: Partial<MonthlyCost>[],
  employees: Partial<Employee>[]
): EnrichedCostRecord[] {
  const empMap = new Map<string, Partial<Employee>>();
  for (const e of employees || []) {
    if (e.id) empMap.set(e.id, e);
  }

  const out: EnrichedCostRecord[] = [];
  for (const cost of costs || []) {
    if (!cost.employee_id || !cost.competencia) continue;
    const emp = empMap.get(cost.employee_id);
    const linkUpper = String(emp?.linkType || emp?.employment_type || '').toUpperCase();
    const isEstagio = linkUpper.includes('ESTAG') || linkUpper.includes('ESTÁG');
    const isCLT = !isEstagio && (cost.vinculo_tipo === 'CLT' || linkUpper.includes('CLT'));
    const legalNature: AnalyticsLegalNature = isEstagio ? 'ESTAGIO' : isCLT ? 'CLT' : 'PJ';

    const fin = calculateRowFinancials(cost, legalNature !== 'PJ');
    const corp = String(emp?.corporate_name || '').trim();
    const corpUpper = corp.toUpperCase();
    const isEmployerCorp = corpUpper.includes('D.Z.M') || corpUpper === 'DZM' || corpUpper.includes('MAR BRASIL') || corpUpper === 'G2';
    const displayName =
      legalNature === 'PJ' && corp && !isEmployerCorp
        ? corp
        : String(emp?.name || corp || 'Sem nome').trim();

    const hasHol = Number(cost.valor_holerite || 0) > 0;
    const proventosOrHonorarios =
      legalNature === 'PJ'
        ? round2(Number(fin.fixo || cost.valor_fixo || cost.valor_liquido || fin.realTotal || 0))
        : round2(Number(cost.valor_holerite || cost.valor_fixo || fin.fixo || 0));

    const outrosRecebidos =
      legalNature === 'PJ'
        ? 0
        : round2(hasHol ? Number(cost.outros_ajustes || 0) : Number(cost.outros_ajustes || fin.heNoturno || 0));

    const descontosOrGlosas =
      legalNature === 'PJ'
        ? round2(Number(fin.deducoesTotal || 0))
        : round2(Number(cost.valor_descontos || fin.descontosFolha || 0));

    const company = normCompany(emp?.company) === 'ALL' ? 'MarBR' : normCompany(emp?.company);
    const compStr = String(cost.competencia).slice(0, 10);

    out.push({
      id: String(cost.id || `${cost.employee_id}__${compStr}`),
      employeeId: String(cost.employee_id),
      competencia: compStr,
      competenciaMonth: compStr.slice(0, 7),
      legalNature,
      displayName,
      employeeName: String(emp?.name || displayName).trim(),
      documentId: legalNature === 'PJ' ? String(emp?.pj_type || emp?.document_id || '') : String(emp?.document_id || ''),
      company,
      department: String(emp?.department || 'Geral').trim(),
      jobRole: String(emp?.job_role || '').trim(),
      status: String(emp?.status || 'Ativo').trim(),
      proventosOrHonorarios,
      outrosRecebidos,
      vt: legalNature === 'PJ' ? 0 : round2(Number(cost.valor_vt || 0)),
      vrCesta: legalNature === 'CLT' ? round2(Number(cost.valor_cesta || 0) + Number(cost.valor_vr || 0)) : 0,
      bonus: round2(Number(cost.valor_bonus || 0)),
      comissao: legalNature === 'PJ' ? round2(Number(cost.valor_comissao || 0)) : 0,
      incentivos: legalNature === 'PJ' ? round2(Number(cost.valor_incentivos || 0)) : 0,
      premiacaoOrConectividade: round2(Number(cost.valor_ajuda_custo || 0)),
      descontosOrGlosas,
      adiantamento: legalNature === 'PJ' ? 0 : round2(Number(cost.valor_adiantamento || 0)),
      liquido: round2(fin.realTotal),
      contractBase: round2(Number(emp?.remuneration_fixed || emp?.remuneration || 0)),
    });
  }

  return out;
}

function applyAnalyticsFilters(
  rows: EnrichedCostRecord[],
  params: AnalyticsFilterParams
): EnrichedCostRecord[] {
  const yearStr = params.year ? String(params.year).slice(0, 4) : '';
  const startYm = params.startCompetencia ? String(params.startCompetencia).slice(0, 7) : '';
  const endYm = params.endCompetencia ? String(params.endCompetencia).slice(0, 7) : '';
  const companyFilter = normCompany(params.company);
  const regimeFilter = String(params.regime || 'ALL').toUpperCase();
  const deptFilter = normText(params.department);

  return rows.filter((r) => {
    if (yearStr && !r.competenciaMonth.startsWith(yearStr)) return false;
    if (startYm && r.competenciaMonth < startYm) return false;
    if (endYm && r.competenciaMonth > endYm) return false;
    if (companyFilter !== 'ALL' && normCompany(r.company) !== companyFilter) return false;
    if (regimeFilter !== 'ALL' && r.legalNature !== regimeFilter) return false;
    if (deptFilter && !normText(r.department).includes(deptFilter)) return false;
    return true;
  });
}

/** Tool 1: Totalizadores consolidados por período, empresa e natureza jurídica. */
export function queryTotalByPeriod(
  enriched: EnrichedCostRecord[],
  params: AnalyticsFilterParams = {}
) {
  const rows = applyAnalyticsFilters(enriched, params);
  const uniqueEntities = new Set(rows.map((r) => r.employeeId));
  const uniqueMonths = Array.from(new Set(rows.map((r) => r.competenciaMonth))).sort();

  const byNature: Record<AnalyticsLegalNature, { registros: number; entidadesUnicas: number; totalLiquido: number }> = {
    CLT: { registros: 0, entidadesUnicas: 0, totalLiquido: 0 },
    ESTAGIO: { registros: 0, entidadesUnicas: 0, totalLiquido: 0 },
    PJ: { registros: 0, entidadesUnicas: 0, totalLiquido: 0 },
  };
  const natureEntities: Record<AnalyticsLegalNature, Set<string>> = {
    CLT: new Set(),
    ESTAGIO: new Set(),
    PJ: new Set(),
  };

  const byCompany = new Map<string, { registros: number; totalLiquido: number; clt: number; estagio: number; pj: number }>();

  let grandTotal = 0;
  for (const r of rows) {
    grandTotal += r.liquido;
    byNature[r.legalNature].registros += 1;
    byNature[r.legalNature].totalLiquido = round2(byNature[r.legalNature].totalLiquido + r.liquido);
    natureEntities[r.legalNature].add(r.employeeId);

    const c = byCompany.get(r.company) || { registros: 0, totalLiquido: 0, clt: 0, estagio: 0, pj: 0 };
    c.registros += 1;
    c.totalLiquido = round2(c.totalLiquido + r.liquido);
    if (r.legalNature === 'CLT') c.clt = round2(c.clt + r.liquido);
    else if (r.legalNature === 'ESTAGIO') c.estagio = round2(c.estagio + r.liquido);
    else c.pj = round2(c.pj + r.liquido);
    byCompany.set(r.company, c);
  }

  byNature.CLT.entidadesUnicas = natureEntities.CLT.size;
  byNature.ESTAGIO.entidadesUnicas = natureEntities.ESTAGIO.size;
  byNature.PJ.entidadesUnicas = natureEntities.PJ.size;

  return {
    filtrosAplicados: params,
    competenciasCobertas: uniqueMonths,
    totalRegistros: rows.length,
    entidadesUnicas: uniqueEntities.size,
    totalGeralDesembolsado: round2(grandTotal),
    porNaturezaJuridica: {
      folhaClt: byNature.CLT,
      bolsasEstagioLei11788: byNature.ESTAGIO,
      contratosPjMei: byNature.PJ,
    },
    porEmpresa: Array.from(byCompany.entries())
      .map(([empresa, v]) => ({ empresa, ...v }))
      .sort((a, b) => b.totalLiquido - a.totalLiquido),
  };
}

/** Tool 2: Decomposição exata por verba contábil (VT, VR/Cesta, Bônus, Premiação, Adiantamento, Honorários PJ, etc.). */
export function queryVerbaBreakdown(
  enriched: EnrichedCostRecord[],
  params: AnalyticsFilterParams = {}
) {
  const rows = applyAnalyticsFilters(enriched, params);
  const cltRows = rows.filter((r) => r.legalNature === 'CLT');
  const estRows = rows.filter((r) => r.legalNature === 'ESTAGIO');
  const pjRows = rows.filter((r) => r.legalNature === 'PJ');

  const sum = (list: EnrichedCostRecord[], fn: (r: EnrichedCostRecord) => number) =>
    round2(list.reduce((s, r) => s + fn(r), 0));

  return {
    filtrosAplicados: params,
    totalRegistros: rows.length,
    folhaClt: {
      registros: cltRows.length,
      proventosFolha: sum(cltRows, (r) => r.proventosOrHonorarios),
      outrosRecebidos: sum(cltRows, (r) => r.outrosRecebidos),
      valeTransporteVt: sum(cltRows, (r) => r.vt),
      vrCestaBasica: sum(cltRows, (r) => r.vrCesta),
      bonus: sum(cltRows, (r) => r.bonus),
      premiacao: sum(cltRows, (r) => r.premiacaoOrConectividade),
      descontosFolha: sum(cltRows, (r) => r.descontosOrGlosas),
      adiantamentoSalarial: sum(cltRows, (r) => r.adiantamento),
      liquidoClt: sum(cltRows, (r) => r.liquido),
    },
    estagioLei11788: {
      registros: estRows.length,
      bolsaAuxilio: sum(estRows, (r) => r.proventosOrHonorarios),
      auxilioTransporte: sum(estRows, (r) => r.vt),
      outrosAuxilios: sum(estRows, (r) => r.outrosRecebidos + r.bonus + r.premiacaoOrConectividade),
      deducoes: sum(estRows, (r) => r.descontosOrGlosas),
      liquidoEstagio: sum(estRows, (r) => r.liquido),
    },
    contratosPjMei: {
      registros: pjRows.length,
      honorariosBase: sum(pjRows, (r) => r.proventosOrHonorarios),
      bonusContratual: sum(pjRows, (r) => r.bonus),
      comissoes: sum(pjRows, (r) => r.comissao),
      incentivos: sum(pjRows, (r) => r.incentivos),
      conectividadeReembolso: sum(pjRows, (r) => r.premiacaoOrConectividade),
      glosasDeducoes: sum(pjRows, (r) => r.descontosOrGlosas),
      valorLiquidoNf: sum(pjRows, (r) => r.liquido),
    },
    totalGeralDesembolsado: sum(rows, (r) => r.liquido),
  };
}

export interface TopMoversParams {
  competencia?: string; // YYYY-MM (se omitido, usa a competência mais recente da base)
  company?: string;
  regime?: 'CLT' | 'ESTAGIO' | 'PJ' | 'ALL';
  minDeltaPercent?: number;
  direction?: 'up' | 'down' | 'both';
  limit?: number;
}

/** Tool 3: Maiores variações Mês contra Mês (MoM) por colaborador ou contratada PJ. */
export function queryTopMoversMoM(
  enriched: EnrichedCostRecord[],
  params: TopMoversParams = {}
) {
  const allMonths = Array.from(new Set(enriched.map((r) => r.competenciaMonth))).sort();
  if (allMonths.length === 0) {
    return { competencia: '', competenciaAnterior: '', totalComparados: 0, variacoes: [] };
  }

  const targetMonth = params.competencia ? String(params.competencia).slice(0, 7) : allMonths[allMonths.length - 1];
  const prevMonth = getPreviousMonthKey(targetMonth);
  const companyFilter = normCompany(params.company);
  const regimeFilter = String(params.regime || 'ALL').toUpperCase();
  const minPct = Number(params.minDeltaPercent ?? 0);
  const direction = params.direction || 'both';
  const limit = Math.min(30, Math.max(1, Number(params.limit || 10)));

  const prevByEmp = new Map<string, EnrichedCostRecord>();
  for (const r of enriched) {
    if (r.competenciaMonth === prevMonth) {
      prevByEmp.set(r.employeeId, r);
    }
  }

  const movers: Array<{
    entidade: string;
    naturezaJuridica: AnalyticsLegalNature;
    empresa: string;
    valorMesAnterior: number;
    valorMesAtual: number;
    variacaoAbsoluta: number;
    variacaoPercentual: number;
  }> = [];

  let totalCompared = 0;
  for (const r of enriched) {
    if (r.competenciaMonth !== targetMonth) continue;
    if (companyFilter !== 'ALL' && normCompany(r.company) !== companyFilter) continue;
    if (regimeFilter !== 'ALL' && r.legalNature !== regimeFilter) continue;

    const prev = prevByEmp.get(r.employeeId);
    if (!prev || prev.liquido <= 0) continue;
    totalCompared += 1;

    const deltaAbs = round2(r.liquido - prev.liquido);
    const deltaPct = round2((deltaAbs / prev.liquido) * 100);

    if (direction === 'up' && deltaAbs <= 0) continue;
    if (direction === 'down' && deltaAbs >= 0) continue;
    if (Math.abs(deltaPct) < minPct) continue;

    movers.push({
      entidade: r.displayName,
      naturezaJuridica: r.legalNature,
      empresa: r.company,
      valorMesAnterior: prev.liquido,
      valorMesAtual: r.liquido,
      variacaoAbsoluta: deltaAbs,
      variacaoPercentual: deltaPct,
    });
  }

  movers.sort((a, b) => Math.abs(b.variacaoAbsoluta) - Math.abs(a.variacaoAbsoluta));

  return {
    competencia: targetMonth,
    competenciaAnterior: prevMonth,
    totalComparados: totalCompared,
    totalFiltrados: movers.length,
    variacoes: movers.slice(0, limit),
  };
}

/** Tool 4: Histórico completo de custos de um colaborador CLT, estagiário ou contratada PJ. */
export function queryEmployeeCostHistory(
  enriched: EnrichedCostRecord[],
  params: { query: string; startCompetencia?: string; endCompetencia?: string }
) {
  const q = normText(params.query);
  const qDigits = String(params.query || '').replace(/\D/g, '');
  if (!q) {
    return { encontrado: false, registros: [], totalAcumulado: 0, mediaMensal: 0 };
  }

  const startYm = params.startCompetencia ? String(params.startCompetencia).slice(0, 7) : '';
  const endYm = params.endCompetencia ? String(params.endCompetencia).slice(0, 7) : '';

  const matched = enriched
    .filter((r) => {
      if (startYm && r.competenciaMonth < startYm) return false;
      if (endYm && r.competenciaMonth > endYm) return false;
      if (normText(r.displayName).includes(q) || normText(r.employeeName).includes(q)) return true;
      if (qDigits.length >= 4 && r.documentId.replace(/\D/g, '').includes(qDigits)) return true;
      return false;
    })
    .sort((a, b) => b.competenciaMonth.localeCompare(a.competenciaMonth));

  const totalAcumulado = round2(matched.reduce((s, r) => s + r.liquido, 0));
  const mediaMensal = matched.length > 0 ? round2(totalAcumulado / matched.length) : 0;

  return {
    encontrado: matched.length > 0,
    entidadesEncontradas: Array.from(new Set(matched.map((m) => `${m.displayName} (${m.legalNature} • ${m.company})`))),
    totalMeses: matched.length,
    totalAcumulado,
    mediaMensal,
    historico: matched.slice(0, 24).map((m) => ({
      competencia: m.competenciaMonth,
      entidade: m.displayName,
      naturezaJuridica: m.legalNature,
      empresa: m.company,
      baseOuHonorarios: m.proventosOrHonorarios,
      vt: m.vt,
      vrCesta: m.vrCesta,
      bonus: m.bonus,
      premiacaoOuConectividade: m.premiacaoOrConectividade,
      descontosOuGlosas: m.descontosOrGlosas,
      adiantamento: m.adiantamento,
      liquido: m.liquido,
    })),
  };
}

/** Tool 5: Evolução mensal (série temporal) segregada por natureza jurídica com delta MoM %. */
export function queryMonthlyTrend(
  enriched: EnrichedCostRecord[],
  params: AnalyticsFilterParams = {}
) {
  const rows = applyAnalyticsFilters(enriched, params);
  const byMonth = new Map<
    string,
    {
      competencia: string;
      clt: number;
      cltCount: number;
      estagio: number;
      estagioCount: number;
      pj: number;
      pjCount: number;
      totalGeral: number;
    }
  >();

  for (const r of rows) {
    const cur = byMonth.get(r.competenciaMonth) || {
      competencia: r.competenciaMonth,
      clt: 0,
      cltCount: 0,
      estagio: 0,
      estagioCount: 0,
      pj: 0,
      pjCount: 0,
      totalGeral: 0,
    };
    if (r.legalNature === 'CLT') {
      cur.clt = round2(cur.clt + r.liquido);
      cur.cltCount += 1;
    } else if (r.legalNature === 'ESTAGIO') {
      cur.estagio = round2(cur.estagio + r.liquido);
      cur.estagioCount += 1;
    } else {
      cur.pj = round2(cur.pj + r.liquido);
      cur.pjCount += 1;
    }
    cur.totalGeral = round2(cur.totalGeral + r.liquido);
    byMonth.set(r.competenciaMonth, cur);
  }

  const ordered = Array.from(byMonth.values()).sort((a, b) => a.competencia.localeCompare(b.competencia));
  const series = ordered.map((item, idx) => {
    const prev = idx > 0 ? ordered[idx - 1] : null;
    const momDelta = prev ? round2(item.totalGeral - prev.totalGeral) : null;
    const momDeltaPct = prev && prev.totalGeral > 0 ? round2(((item.totalGeral - prev.totalGeral) / prev.totalGeral) * 100) : null;
    return {
      ...item,
      variacaoMomAbsoluta: momDelta,
      variacaoMomPercentual: momDeltaPct,
    };
  });

  return {
    filtrosAplicados: params,
    totalMeses: series.length,
    acumuladoPeriodo: round2(series.reduce((s, i) => s + i.totalGeral, 0)),
    serieMensal: series,
  };
}

/**
 * Constrói resumo compacto cobrindo 100% do histórico (substitui o antigo monthlyCosts.slice(0, 100) em people/page.tsx).
 */
export function buildCompactExecutiveContext(
  costs: Partial<MonthlyCost>[],
  employees: Partial<Employee>[],
  showValues = true
) {
  const enriched = enrichHistoricalCosts(costs, employees);
  const trend = queryMonthlyTrend(enriched);
  const months = trend.serieMensal;

  return {
    totalHistoricalRows: enriched.length,
    periodCovered: months.length > 0 ? `${months[0].competencia} a ${months[months.length - 1].competencia}` : 'Sem dados',
    monthlyAggregatedByLegalNature: months.map((m) => ({
      competencia: m.competencia,
      cltCount: m.cltCount,
      estagioCount: m.estagioCount,
      pjCount: m.pjCount,
      cltTotal: showValues ? m.clt : '••••••',
      estagioTotal: showValues ? m.estagio : '••••••',
      pjTotal: showValues ? m.pj : '••••••',
      grandTotal: showValues ? m.totalGeral : '••••••',
    })),
  };
}
