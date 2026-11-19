import type { Employee, MonthlyCost } from '@/types/loans';
import type { RowFinancials } from '@/services/people-hr.service';

export type AnomalyCode =
  | 'VARIATION_UP'
  | 'VARIATION_DOWN'
  | 'MISSING_VT'
  | 'MISSING_VR_CESTA'
  | 'CONTRACT_DIVERGENCE';

export type AnomalySeverity = 'warning' | 'alert';

export interface CostAnomaly {
  code: AnomalyCode;
  severity: AnomalySeverity;
  shortLabel: string;
  detail: string;
  previousCompetencia?: string;
  previousValue?: number;
  currentValue?: number;
  deltaPercent?: number;
}

export interface CostAnomalyInput {
  id: string;
  employeeId: string;
  competencia: string;
  isCLT: boolean;
  isEstagio: boolean;
  isPJ: boolean;
  proventosOrBase: number;
  vt: number;
  vrCesta: number;
  liquido: number;
  contractBase?: number;
}

export interface AnomalyThresholds {
  variationPercentThreshold?: number; // Default 15 (%)
  minAbsoluteDelta?: number; // Default R$ 50,00 (evita ruído de centavos em valores muito baixos)
  contractDivergencePercent?: number; // Default 20 (%)
}

function round2(v: number): number {
  const n = Number.isFinite(v) ? v : 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatBrl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(round2(v));
}

export function getPreviousCompetenciaKey(compStr: string): string {
  if (!compStr || compStr.length < 7) return '';
  const parts = compStr.slice(0, 7).split('-');
  if (parts.length !== 2) return '';
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10) - 1;
  if (isNaN(year) || isNaN(month)) return '';
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function evaluateRowAnomalies(
  current: CostAnomalyInput,
  previous?: CostAnomalyInput,
  thresholds?: AnomalyThresholds
): CostAnomaly[] {
  const anomalies: CostAnomaly[] = [];
  const varThreshold = thresholds?.variationPercentThreshold ?? 15;
  const minDelta = thresholds?.minAbsoluteDelta ?? 50;
  const contractThreshold = thresholds?.contractDivergencePercent ?? 20;

  // 1. Comparação MoM (Líquido atual vs. competência anterior imediatamente precedente)
  if (previous && previous.liquido > 0 && current.liquido > 0) {
    const deltaAbs = round2(current.liquido - previous.liquido);
    const deltaPct = round2((deltaAbs / previous.liquido) * 100);
    if (Math.abs(deltaPct) >= varThreshold && Math.abs(deltaAbs) >= minDelta) {
      if (deltaPct > 0) {
        anomalies.push({
          code: 'VARIATION_UP',
          severity: deltaPct >= 30 ? 'alert' : 'warning',
          shortLabel: `↑ +${Math.round(deltaPct)}% MoM`,
          detail: `Aumento de ${formatBrl(deltaAbs)} (+${deltaPct.toFixed(1)}%) em relação à competência ${previous.competencia.slice(0, 7)} (${formatBrl(previous.liquido)}).`,
          previousCompetencia: previous.competencia,
          previousValue: previous.liquido,
          currentValue: current.liquido,
          deltaPercent: deltaPct,
        });
      } else {
        anomalies.push({
          code: 'VARIATION_DOWN',
          severity: deltaPct <= -30 ? 'alert' : 'warning',
          shortLabel: `↓ ${Math.round(deltaPct)}% MoM`,
          detail: `Queda de ${formatBrl(Math.abs(deltaAbs))} (${deltaPct.toFixed(1)}%) em relação à competência ${previous.competencia.slice(0, 7)} (${formatBrl(previous.liquido)}).`,
          previousCompetencia: previous.competencia,
          previousValue: previous.liquido,
          currentValue: current.liquido,
          deltaPercent: deltaPct,
        });
      }
    }
  }

  // 2. Benefícios ausentes em CLT / Estágio quando existiam no mês anterior
  if (!current.isPJ && previous) {
    if (previous.vt > 0 && current.vt === 0) {
      anomalies.push({
        code: 'MISSING_VT',
        severity: 'warning',
        shortLabel: current.isEstagio ? 'Sem Aux. Transp.' : 'Sem VT',
        detail: `${current.isEstagio ? 'Auxílio-Transporte' : 'VT'} zerado nesta competência (mês anterior ${previous.competencia.slice(0, 7)}: ${formatBrl(previous.vt)}).`,
        previousCompetencia: previous.competencia,
        previousValue: previous.vt,
        currentValue: 0,
      });
    }

    if (current.isCLT && !current.isEstagio && previous.vrCesta > 0 && current.vrCesta === 0) {
      anomalies.push({
        code: 'MISSING_VR_CESTA',
        severity: 'warning',
        shortLabel: 'Sem VR/Cesta',
        detail: `VR/Cesta zerado nesta competência (mês anterior ${previous.competencia.slice(0, 7)}: ${formatBrl(previous.vrCesta)}).`,
        previousCompetencia: previous.competencia,
        previousValue: previous.vrCesta,
        currentValue: 0,
      });
    }
  }

  // 3. Divergência entre Base/Honorários e Contrato Vigente cadastrado
  if (current.contractBase && current.contractBase > 0 && current.proventosOrBase > 0) {
    const diffContract = round2(current.proventosOrBase - current.contractBase);
    const pctContract = round2((Math.abs(diffContract) / current.contractBase) * 100);
    if (pctContract >= contractThreshold && Math.abs(diffContract) >= minDelta) {
      const labelBase = current.isPJ ? 'Honorários' : current.isEstagio ? 'Bolsa' : 'Proventos';
      anomalies.push({
        code: 'CONTRACT_DIVERGENCE',
        severity: pctContract >= 40 ? 'alert' : 'warning',
        shortLabel: `≠ Contrato (${diffContract > 0 ? '+' : '-'}${Math.round(pctContract)}%)`,
        detail: `${labelBase} (${formatBrl(current.proventosOrBase)}) diverge ${diffContract > 0 ? '+' : ''}${formatBrl(diffContract)} do cadastro vigente (${formatBrl(current.contractBase)}).`,
        previousValue: current.contractBase,
        currentValue: current.proventosOrBase,
        deltaPercent: diffContract > 0 ? pctContract : -pctContract,
      });
    }
  }

  return anomalies;
}

export interface HistoricalCostRowForAudit {
  cost: Partial<MonthlyCost>;
  emp?: Partial<Employee>;
  financials: Partial<RowFinancials>;
  realTotal: number;
  isCLT: boolean;
  isPJ: boolean;
  isEstagio: boolean;
}

/**
 * Calcula mapa O(N) de anomalias MoM para uma lista de custos mensais,
 * usando todo o histórico disponível como referência do mês imediatamente anterior.
 */
export function buildCompetenciasAnomalyMap(
  allHistoricalRows: HistoricalCostRowForAudit[],
  thresholds?: AnomalyThresholds
): Map<string, CostAnomaly[]> {
  const byEmpMonth = new Map<string, CostAnomalyInput>();
  const inputs: CostAnomalyInput[] = [];

  for (const r of allHistoricalRows || []) {
    const cost = r.cost || {};
    const empId = String(cost.employee_id || '');
    const comp = String(cost.competencia || '');
    const id = String(cost.id || `${empId}__${comp}`);
    if (!empId || !comp) continue;

    const proventosOrBase = r.isPJ
      ? Number(r.financials.fixo || cost.valor_fixo || cost.valor_liquido || r.realTotal || 0)
      : Number(cost.valor_holerite || cost.valor_fixo || r.financials.fixo || 0);

    const item: CostAnomalyInput = {
      id,
      employeeId: empId,
      competencia: comp,
      isCLT: r.isCLT,
      isEstagio: r.isEstagio,
      isPJ: r.isPJ,
      proventosOrBase: round2(proventosOrBase),
      vt: round2(Number(cost.valor_vt || 0)),
      vrCesta: round2(Number(cost.valor_cesta || 0) + Number(cost.valor_vr || 0)),
      liquido: round2(Number(r.realTotal || 0)),
      contractBase: round2(Number(r.emp?.remuneration_fixed || r.emp?.remuneration || 0)),
    };

    inputs.push(item);
    byEmpMonth.set(`${empId}__${comp.slice(0, 7)}`, item);
  }

  const result = new Map<string, CostAnomaly[]>();
  for (const item of inputs) {
    const prevKey = getPreviousCompetenciaKey(item.competencia);
    const prevItem = prevKey ? byEmpMonth.get(`${item.employeeId}__${prevKey}`) : undefined;
    const issues = evaluateRowAnomalies(item, prevItem, thresholds);
    if (issues.length > 0) {
      result.set(item.id, issues);
    }
  }

  return result;
}
