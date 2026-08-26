export type BprCycle = 'ciclo_1' | 'ciclo_2' | 'custom';

export type BprCamada = 'E' | 'T' | 'O'; // Estratégico, Tático, Operacional

export interface BprTierSplit {
  E: number; // % Estratégico (ex: 35)
  T: number; // % Tático (ex: 40)
  O: number; // % Operacional (ex: 25)
}

export interface BprRuleConfig {
  cycle: BprCycle;
  year: number;
  periodStartDate: string; // YYYY-MM-DD
  periodEndDate: string;   // YYYY-MM-DD
  paymentDate: string;     // YYYY-MM-DD
  totalPoolAmount: number; // R$ Montante total a ratear
  tierSplits: BprTierSplit; // Percentuais por camada
  allowGlosados: boolean;
  selectedGlosadosExceptions: string[]; // IDs de colaboradores glosados que farão jus excepcionalmente
  allowInativos: boolean;
  selectedInativosExceptions: string[]; // IDs de colaboradores inativos na data de pagamento que farão jus
  manuallyExcludedEmployeeIds: string[]; // IDs de colaboradores excluídos manualmente da relação do BPR
  companiesFilter: string[]; // ['MarBR', 'DZM', 'G2'] ou vazia para todas
  linkTypesFilter: string[]; // ['CLT', 'PJ', 'Estagiário', 'Terceirizado'] ou vazia para todos
  minDaysActiveInPeriod?: number; // Opcional: Dias mínimos trabalhados no período (padrão: período integral)
}

export interface BprMonthlyScores {
  [year: string]: {
    [month: string]: number; // Ex: { "2026": { "01": 100, "02": 100, "03": 90, ... } }
  };
}

export interface BprCycleScoreSummary {
  cycle: BprCycle;
  year: number;
  averageScore: number; // Média aritmética dos meses (0 a 100)
  performanceFactor: number; // 1.0 (se 100%), 0.75 (se >= 90% e < 100%), 0.0 (se < 90%)
  factorLabel: string; // "100% do Bônus" | "75% do Bônus" | "0% (Meta não atingida)"
  evaluatedMonthsCount: number;
  missingMonthsCount: number;
}

export interface BprCandidateResult {
  employeeId: string;
  name: string;
  corporateName?: string;
  responsibleName?: string;
  company: string;
  department: string;
  jobRole: string;
  linkType: string;
  isOutsourced: boolean;
  camada: BprCamada;
  camadaLabel: string; // 'Estratégico' | 'Tático' | 'Operacional'
  nivel?: string;
  grau?: string;
  status: string; // 'Ativo' | 'Férias' | 'Inativo' | ...
  startDate?: string;
  resignationDate?: string;
  realResignationDate?: string;
  photoUrl?: string;
  
  // Metas e Desempenho Mensal
  monthlyAverageScore?: number; // Média de atingimento dos meses do ciclo (0-100%)
  performanceFactor: number;   // 1.0 (100%), 0.75 (90-99%), 0.0 (<90%)
  performanceFactorLabel?: string;

  // Condições de Elegibilidade
  admittedBeforeOrAtCycleStart: boolean;
  activeThroughoutCycle: boolean;
  activeAtPaymentDate: boolean;
  hasGlosaInPeriod: boolean;
  glosaDetails?: string;
  isInactiveAtPaymentDate: boolean;
  isManuallyExcluded: boolean;
  
  // Status Final
  isEligible: boolean;
  isExceptionApplied: boolean;
  ineligibilityReasons: string[];
  
  // Valores Financeiros Calculados
  baseAmount: number;      // R$ valor base cheio da camada
  allocatedAmount: number; // R$ valor individual após aplicar fator de desempenho (baseAmount * performanceFactor)
}

export interface BprLayerSummary {
  camada: BprCamada;
  label: string;
  allocatedPercentage: number;
  totalLayerAmount: number;
  eligibleCount: number;
  ineligibleCount: number;
  amountPerEligible: number;
}

export interface BprCalculationSummary {
  totalPoolAmount: number;
  totalDistributedAmount: number;
  residualAmount: number;
  totalCandidates: number;
  totalEligible: number;
  totalIneligible: number;
  layers: Record<BprCamada, BprLayerSummary>;
  candidates: BprCandidateResult[];
  glosadosCandidates: BprCandidateResult[];
  inativosCandidates: BprCandidateResult[];
}

export interface BprSavedRun {
  id: string;
  name: string;
  createdAt: string;
  config: BprRuleConfig;
  summary: {
    totalPoolAmount: number;
    totalDistributedAmount: number;
    totalEligible: number;
    amountPerE: number;
    amountPerT: number;
    amountPerO: number;
  };
}
