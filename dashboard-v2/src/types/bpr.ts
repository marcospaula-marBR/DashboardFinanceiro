export type BprCycle = 'ciclo_1' | 'ciclo_2' | 'custom';

export type BprCamada = 'E' | 'T' | 'O'; // Estratégico, Tático, Operacional

export type BprSplitMode = 'percentage' | 'amount'; // Rateio por % ou por Valor R$ Fixo

export type BprAdditionalDeductionSource = 'total_pool' | 'own_layer' | BprCamada | 'extra_bonus';

export type BprDedicatedGroupDistributionMode = 'equal' | 'percentage' | 'amount';

export type BprDedicatedGroupFundingSource = 'total_pool' | BprCamada | 'extra_bonus';

export type BprDedicatedGroupEligibilityPolicy = 'follow_bpr_rules' | 'include_all_as_exception';

export interface BprDedicatedGroupMember {
  employeeId: string;
  percentage?: number;      // % individual sobre poolAmount quando distributionMode === 'percentage'
  amount?: number;          // R$ absoluto individual quando distributionMode === 'amount'
  customFactorPct?: number; // % de fator individual manual (0 a 100) dentro do grupo
}

export interface BprDedicatedGroup {
  id: string;
  name: string;                                          // Ex: "Equipe Projeto X"
  criteriaDescription?: string;                          // Critério / observação do grupo
  enabled: boolean;                                      // Ativo ou pausado
  poolAmount: number;                                    // Montante específico destinado ao grupo (R$)
  distributionMode: BprDedicatedGroupDistributionMode;   // 'equal' | 'percentage' | 'amount'
  fundingSource: BprDedicatedGroupFundingSource;         // 'total_pool' | 'E' | 'T' | 'O' | 'extra_bonus'
  eligibilityPolicy?: BprDedicatedGroupEligibilityPolicy; // 'follow_bpr_rules' | 'include_all_as_exception'
  applyPerformanceFactor?: boolean;                      // Se true, aplica fator de desempenho do BPR
  reducedFactorPct?: number;                             // % padrão aplicado quando meta 90%-99% (ex: 75)
  redistributePerformanceResidual?: boolean;             // Se true, redistribui o saldo retido pelo fator entre elegíveis 100%
  members: BprDedicatedGroupMember[];
}

export interface BprDedicatedGroupSummary {
  groupId: string;
  name: string;
  criteriaDescription?: string;
  fundingSource: BprDedicatedGroupFundingSource;
  distributionMode: BprDedicatedGroupDistributionMode;
  poolAmount: number;
  allocatedTotal: number;
  memberCount: number;
  eligibleMemberCount?: number;
  ineligibleMemberCount?: number;
  amountPerEligible?: number;
  eligibilityPolicy?: BprDedicatedGroupEligibilityPolicy;
  applyPerformanceFactor?: boolean;
  reducedFactorPct?: number;
  redistributePerformanceResidual?: boolean;
  redistributedAmount?: number;
  residualAmount: number;
}

export interface BprDedicatedGroupImpactPreview {
  groupSummary: BprDedicatedGroupSummary | null;
  fundingSource: BprDedicatedGroupFundingSource;
  beforeLayers: Record<BprCamada, { totalLayerAmount: number; eligibleCount: number; amountPerEligible: number }>;
  afterLayers: Record<BprCamada, { totalLayerAmount: number; eligibleCount: number; amountPerEligible: number }>;
  hasFundingOverflow: boolean;
  overflowAmount: number;
  baseTotalPool: number;
  afterTotalPool: number;
}

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
  additionalAmounts?: Record<string, number>; // Mapa employeeId -> valor adicional em R$
  additionalReasons?: Record<string, string>; // Mapa employeeId -> motivo / observação curta do adicional
  additionalDeductionSource?: BprAdditionalDeductionSource; // 'total_pool' (padrão) | 'own_layer' | 'E' | 'T' | 'O' | 'extra_bonus'
  allowDedicatedGroups?: boolean; // Permissão/chave para habilitar grupos de montante específico exclusivo
  dedicatedGroups?: BprDedicatedGroup[]; // Grupos dedicados de montante específico
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
  baseAmount: number;        // R$ valor base cheio da camada
  rateioAmount?: number;     // R$ valor do rateio da camada após fator de desempenho (baseAmount * performanceFactor)
  additionalAmount?: number; // R$ valor adicional individual inserido para o colaborador
  additionalReason?: string; // Motivo / observação curta vinculada ao adicional individual
  allocatedAmount: number;   // R$ valor individual final (rateioAmount + additionalAmount)

  // Histórico Financeiro no Período de Apuração do BPR (Custo Histórico People)
  periodReceivedTotal?: number;   // R$ montante total recebido no período eletivo do BPR
  periodReceivedAverage?: number; // R$ média mensal recebida no período eletivo do BPR
  periodMonthsCount?: number;     // Quantidade de competências encontradas no histórico dentro do período
  bprVsAveragePct?: number;       // % que o BPR final equivale em relação à média mensal recebida
  bprVsTotalPct?: number;         // % que o BPR final equivale em relação ao montante total recebido no período

  // Grupo Dedicado de Montante Específico (Exclusivo — fora do rateio E/T/O)
  dedicatedGroupId?: string;
  dedicatedGroupName?: string;
  dedicatedGroupSharePct?: number;
  dedicatedGroupEffectiveFactorPct?: number;
  dedicatedGroupRedistributedBonus?: number;
}

export interface BprLayerRelativeWeight {
  eligibleWithHistoryCount: number;
  eligibleCount: number;
  monthlyAverageBase: number;      // Soma das médias mensais recebidas dos elegíveis com histórico
  periodTotalBase: number;         // Soma dos montantes recebidos no período dos elegíveis com histórico
  bprAllocatedBase: number;        // Soma do BPR final desses mesmos elegíveis com histórico
  bprVsMonthlyAvgPct: number;      // % que o BPR representa sobre a média mensal da camada (ex: 150.0)
  bprMultipleOfMonthlyAvg: number; // Múltiplo de remuneração/honorários mensais (ex: 1.50)
  bprVsPeriodTotalPct: number;     // % que o BPR representa sobre o montante total do período (ex: 25.0)
}

export interface BprLayerSummary {
  camada: BprCamada;
  label: string;
  allocatedPercentage: number;
  totalLayerAmount: number;
  grossLayerAmount?: number;                 // R$ montante bruto da camada antes de abatimento de adicionais/grupos
  dedicatedGroupsDeductedFromLayer?: number; // R$ valor de grupos dedicados descontado desta camada
  additionalDeductedFromLayer?: number;      // R$ valor de adicionais individuais descontado desta camada
  eligibleCount: number;
  ineligibleCount: number;
  amountPerEligible: number;
  eligibleWithHistoryCount?: number;
  monthlyAverageBase?: number;
  bprVsMonthlyAvgPct?: number;
  bprMultipleOfMonthlyAvg?: number;
  bprVsPeriodTotalPct?: number;
}

export interface BprTargetMultipleLayerProjection {
  camada: BprCamada;
  label: string;
  targetMultiple: number;
  eligibleCount: number;
  eligibleWithHistoryCount: number;
  monthlyAverageBase: number;
  requiredAmountPerEligible: number;
  requiredLayerAmount: number;
  equivalentPercentage: number;
}

export interface BprTargetMultipleSimulation {
  totalRequiredPool: number;
  layers: Record<BprCamada, BprTargetMultipleLayerProjection>;
  hasAnyHistory: boolean;
}

export interface BprCalculationSummary {
  totalPoolAmount: number;
  basePoolAmount?: number;            // R$ montante base dos níveis antes de eventual acréscimo de bônus extra
  extraBonusAmount?: number;          // R$ soma de adicionais tratados como acréscimo de bônus (sem abatimento)
  totalAdditionalAmount?: number;     // R$ soma de todos os valores adicionais dos elegíveis
  netPoolForLayers?: number;          // R$ saldo líquido efetivamente rateado entre as camadas E, T e O
  totalPeriodReceivedAmount?: number; // R$ soma dos montantes históricos recebidos pelos elegíveis no período
  overallRelativeWeight?: BprLayerRelativeWeight; // Peso relativo consolidado do BPR sobre recebimentos médios
  dedicatedGroupsTotalPool?: number;       // R$ soma dos montantes dos grupos dedicados ativos
  dedicatedGroupsAllocatedTotal?: number;  // R$ soma distribuída nos grupos dedicados ativos
  dedicatedGroupsExtraBonusTotal?: number; // R$ parcela dos grupos dedicados como acréscimo extra ao total
  dedicatedGroupsCount?: number;           // Quantidade de grupos dedicados ativos
  dedicatedMembersCount?: number;          // Quantidade total de colaboradores alocados em grupos dedicados
  dedicatedGroupSummaries?: BprDedicatedGroupSummary[];
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
    basePoolAmount?: number;
    extraBonusAmount?: number;
    totalAdditionalAmount?: number;
    netPoolForLayers?: number;
    totalPeriodReceivedAmount?: number;
    overallRelativeWeight?: BprLayerRelativeWeight;
    dedicatedGroupsTotalPool?: number;
    dedicatedGroupsAllocatedTotal?: number;
    dedicatedGroupsExtraBonusTotal?: number;
    dedicatedGroupsCount?: number;
    dedicatedMembersCount?: number;
    dedicatedGroupSummaries?: BprDedicatedGroupSummary[];
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
