import { AccountCategoryGroup, FinancialKPIs, MonthlyKPIBreakdown } from './financial.types';

export type SimulatorScenarioType =
  | 'revenue_increase'       // Aumento de vendas/clientes
  | 'revenue_reduction'      // Queda de vendas/clientes
  | 'contract_loss'          // Perda de contrato/cliente grande
  | 'revenue_replacement'   // Rampa de reposição de receita
  | 'hiring_personnel'       // Contratação de funcionário(s)
  | 'layoff_personnel'       // Demissão / Redução de equipe
  | 'price_adjustment'       // Reajuste de tabela de preços
  | 'expense_increase'       // Aumento de despesas
  | 'expense_reduction'      // Corte de despesas fixas
  | 'costs_cut'              // Otimização de custos variáveis
  | 'macro_driver'           // Indexadores (IPCA, Dissídio, IGP-M)
  | 'new_loan'               // Novo empréstimo / entrada de caixa + parcelas
  | 'custom';

export type SimulatorAmountType =
  | 'percentage'
  | 'absolute_value'
  | 'monthly_value'
  | 'accumulated_value';

export type SimulatorRecurrence =
  | 'one_time'
  | 'monthly'
  | 'linear_ramp'
  | 's_curve';

export type MacroIndexType =
  | 'IPCA'
  | 'IGP-M'
  | 'CDI'
  | 'SELIC'
  | 'dissidio'
  | 'inflacao_fornecedores';

export interface ScenarioAssumption {
  id: string;
  enabled: boolean;
  name: string;
  type: SimulatorScenarioType;
  targetGroup?: AccountCategoryGroup | 'all';
  targetAccountId?: string; // Se afetar conta específica
  targetDepartment?: string;
  amountType: SimulatorAmountType;
  value: number; // Valor nominal ou percentual
  startDate: string; // 'YYYY-MM'
  endDate: string; // 'YYYY-MM'
  recurrence: SimulatorRecurrence;
  customMonthlyValues?: Record<string, number>;
  macroIndex?: MacroIndexType;
  
  // Atributos específicos de PMEs
  hiringCount?: number;          // Quantidade de contratações
  salaryBase?: number;           // Salário base mensal (R$)
  taxChargesPct?: number;        // Encargos trabalhistas (ex: 70% para CLT)
  loanAmount?: number;           // Valor principal do empréstimo (R$)
  loanTermsMonths?: number;      // Prazo em meses
  loanMonthlyInterestPct?: number; // Taxa de juros mensal (%)
  notes?: string;
}

export interface SimulationScenario {
  id: string;
  name: string;
  description?: string;
  mode: 'historical_what_if' | 'future_projection';
  basePeriod: string[]; // Lista de meses 'YYYY-MM' usados como referência
  projectionStartDate: string; // 'YYYY-MM'
  projectionEndDate: string; // 'YYYY-MM'
  assumptions: ScenarioAssumption[];
  createdAt: string;
  updatedAt: string;
}

export interface SimulationResult {
  scenario: SimulationScenario;
  projectionPeriods: string[];
  baselineKPIs: FinancialKPIs;
  simulatedKPIs: FinancialKPIs;
  monthlyBaseline: MonthlyKPIBreakdown[];
  monthlySimulated: MonthlyKPIBreakdown[];
  variance: {
    receitaBrutaDiff: number;
    receitaBrutaDiffPct: number;
    resultadoLiquidoDiff: number;
    resultadoLiquidoDiffPct: number;
    ebitdaDiff: number;
    ebitdaDiffPct: number;
    runwayDiffMeses: number;
    breakEvenDiff: number;
  };
  executiveSummary: string[];
}
