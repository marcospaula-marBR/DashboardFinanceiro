export interface DreFilters {
  empresas: string[];
  periodos: string[];
  departamentos: string[]; // Rebatizado do antigo 'projetos'
  contasDre: string[];     // Rebatizado do antigo 'categorias'
  projetos: string[];      // Novo filtro
  categorias: string[];    // Novo filtro
  excludeSharedExpenses?: boolean;
}

export interface DreSimulationParams {
  revenueMultiplier: number; // 1.0 = normal, 1.05 = +5%
  costsMultiplier: number;
  expensesMultiplier: number;
  taxesMultiplier: number;
  investmentsMultiplier: number;
}

export type SimulatorScenarioType =
  | 'revenue_increase'
  | 'revenue_decrease'
  | 'costs_cut'
  | 'expenses_cut'
  | 'contract_loss'
  | 'goal_seek'
  | 'custom';

export type SimulatorImpactMode = 'percent' | 'absolute';

export interface DreAdvancedSimParams extends DreSimulationParams {
  scenarioType: SimulatorScenarioType;
  impactMode: SimulatorImpactMode;
  impactValue: number; // percentage (e.g. 10 = 10%) or absolute value in BRL
  targetDepartamento?: string;  // For contract loss scenario
  rescisaoDate?: string;        // 'YYYY-MM' for future projection
  includeRateio: boolean;
  granularExpenses?: Record<string, number>; // category -> multiplier
}

export interface RevenueRecoveryPoint {
  mes: string;           // e.g. "Jul/26"
  receitaBase: number;   // average base revenue
  impactoMensal: number; // the monthly loss
  aReconquistar: number; // remaining to recover by this month
  metaMensal: number;    // how much to add per month
  percAcumulado: number; // % recovered
}

export interface SimulatorAiQuestion {
  id: string;
  label: string;
  prompt: string;
  icon: string;
}

export interface DreRow {
  Empresa: string;
  Departamento: string;    // Rebatizado de 'Projeto'
  ContaDRE: string;        // Rebatizado de 'Categoria'
  Projeto: string;         // Novo campo bruto
  Categoria: string;       // Novo campo bruto
  [key: string]: string | number; // dynamic month columns, like "Jan/24"
}

export type DreItemType = 
  | 'linha' 
  | 'card' 
  | 'divisor' 
  | 'linha_calc' 
  | 'hidden' 
  | 'card_percentual';

export interface DreStructureItem {
  titulo: string;
  tipo: DreItemType;
  categorias?: string[];
  var?: string;
  formula?: string;
}

export interface DreTemplateDefinition {
  versao: string;
  nome: string;
  estrutura: DreStructureItem[];
}

export interface DreTotal {
  [key: string]: number;
}

export interface DreMensal {
  [titulo: string]: {
    [mesAno: string]: number;
  };
}

export interface DreKpis {
  receitaOperacional: number;
  receitaIndireta: number;
  totalEntradas: number;
  outrasEntradas: number;
  totalImpostos: number;
  totalCustos: number;
  totalDespesas: number;
  totalInvestimentos: number;
  totalSaidas: number;
  resultado: number;
  fcl: number;
  percLucro: number;
  percFcl: number;
  totalEquipamentos: number;
  averageMachines: number;
}

export interface DreCalculatedResult {
  totais: DreTotal;
  mensal: DreMensal;
  kpis: DreKpis;
  estrutura: DreStructureItem[];
  validColumns: string[]; // e.g., ["Jan/24", "Fev/24"]
  sourceRows?: Record<string, Record<string, DreRow[]>>; // For Data Lineage/Drill-down
}

export interface DreMetadata {
  empresas: string[];
  periodos: string[];
  departamentos: string[];
  contasDre: string[];
  projetos: string[];
  categorias: string[];
  mapaMeses: Record<string, string>;
}
