export interface DreFilters {
  empresas: string[];
  periodos: string[];
  departamentos: string[]; // Rebatizado do antigo 'projetos'
  contasDre: string[];     // Rebatizado do antigo 'categorias'
  projetos: string[];      // Novo filtro
  categorias: string[];    // Novo filtro
}

export interface DreSimulationParams {
  revenueMultiplier: number; // 1.0 = normal, 1.05 = +5%
  costsMultiplier: number;
  expensesMultiplier: number;
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
