export type BprCycle = 'ciclo_1' | 'ciclo_2' | 'custom';

export type BprCamada = 'E' | 'T' | 'O'; // Estratégico, Tático, Operacional

export type BprSplitMode = 'percentage' | 'amount'; // Rateio por % ou por Valor R$ Fixo

export interface BprTierSplit {
  E: number; // % Estratégico (ex: 30)
  T: number; // % Tático (ex: 40)
  O: number; // % Operacional (ex: 30)
}

export interface BprTierAmounts {
  E: number; // R$ Estratégico (ex: 30000)
  T: number; // R$ Tático (ex: 40000)
  O: number; // R$ Operacional (ex: 30000)
}

export interface BprRuleConfig {
  cycle: BprCycle;
  year: number;
  periodStartDate: string; // YYYY-MM-DD
  periodEndDate: string;   // YYYY-MM-DD
  paymentDate: string;     // YYYY-MM-DD
  totalPoolAmount: number; // R$ Montante total a ratear
  splitMode?: BprSplitMode; // 'percentage' | 'amount'
  tierSplits: BprTierSplit; // Percentuais por camada
  tierAmounts?: BprTierAmounts; // Valores fixos em R$ por camada
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
  camadaLabel: string; // 'Estratégico' | 'Tático' | 'Operacional/CLTs'
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

export interface BprSavedScenario {
  id: string;
  name: string;                // Nome do cenário / estudo (ex: "Simulação C1 2026 - Aumento Fator Operacional")
  studyDate: string;           // Data do estudo (YYYY-MM-DD)
  criteriaDescription: string; // Descrição dos critérios e premissas definidos pelo usuário
  createdAt: string;           // ISO timestamp
  updatedAt?: string;
  config: BprRuleConfig;       // Configurações do simulador
  summary: {
    totalPoolAmount: number;
    totalDistributedAmount: number;
    residualAmount: number;
    totalCandidates: number;
    totalEligible: number;
    totalIneligible: number;
    amountPerE: number;
    amountPerT: number;
    amountPerO: number;
    layers: Record<BprCamada, BprLayerSummary>;
  };
  candidatesSnapshot: BprCandidateResult[]; // Snapshot dos candidatos para impressão fiel histórica
}

// Retrocompatibilidade com BprSavedRun
export type BprSavedRun = BprSavedScenario;
