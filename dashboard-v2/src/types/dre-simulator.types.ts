export type SimulatorScenarioType =
  | 'revenue_increase'
  | 'revenue_reduction'
  | 'contract_loss'
  | 'revenue_replacement'
  | 'expense_increase'
  | 'expense_reduction'
  | 'costs_cut'
  | 'macro_driver'
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
  | 'custom_curve';

export type MacroIndexType =
  | 'IPCA'
  | 'INCC'
  | 'CDI'
  | 'SELIC'
  | 'dissidio'
  | 'inflacao_fornecedores'
  | 'cambio';

export interface ScenarioAssumption {
  id: string;
  type: SimulatorScenarioType;
  targetType: 'department' | 'contract' | 'account_group' | 'account' | 'cost_center' | 'all';
  targetIds: string[]; // e.g., list of departments or accounts affected
  amountType: SimulatorAmountType;
  value: number; // raw value (could be percentage, e.g. -15 for -15%, or absolute currency)
  startDate: string; // 'YYYY-MM' format
  endDate: string; // 'YYYY-MM' format
  recurrence: SimulatorRecurrence;
  customMonthlyValues?: Record<string, number>; // month -> value mapping if custom
  macroIndex?: MacroIndexType;
  notes?: string;
}

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  basePeriod: string[]; // list of columns like "Jan/26", "Fev/26"
  projectionStartDate: string; // 'YYYY-MM' (first month of projection)
  projectionEndDate: string; // 'YYYY-MM' (last month of projection)
  mode: 'historical_what_if' | 'future_projection';
  includeAllocatedExpenses: boolean;
  assumptions: ScenarioAssumption[];
  createdAt: string;
  updatedAt: string;
}

export interface MacroIndexProjection {
  index: MacroIndexType;
  monthlyRates: Record<string, number>; // YYYY-MM -> percentage rate (e.g. 0.005 for 0.5% in that month)
}
