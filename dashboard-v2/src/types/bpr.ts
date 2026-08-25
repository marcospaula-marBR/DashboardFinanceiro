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
  linkTypesFilter: string[]; // ['CLT', 'PJ', 'Terceirizado'] ou vazia para todos
  minDaysActiveInPeriod?: number; // Opcional: Dias mínimos trabalhados no período (padrão: período integral)
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
  allocatedAmount: number; // R$ valor individual do bônus
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
