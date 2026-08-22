/**
 * Estrutura Financeira Simplificada e Universal para PMEs (até R$ 20M/ano)
 */

export type AccountCategoryGroup =
  | 'receita_bruta'
  | 'deducoes_impostos'
  | 'custos_variaveis'
  | 'despesas_fixas'
  | 'pessoal_encargos'
  | 'investimentos_capex'
  | 'emprestimos_dividas';

export interface FinancialAccount {
  id: string;
  name: string;
  group: AccountCategoryGroup;
  code?: string;
  isCustom?: boolean;
}

export interface MonthlyFinancialRow {
  accountId: string;
  accountName: string;
  group: AccountCategoryGroup;
  department?: string;
  values: Record<string, number>; // Format: 'YYYY-MM' -> value
}

export interface CompanyFinancialBase {
  companyName: string;
  cnpj?: string;
  currency: 'BRL';
  currentCashBalance: number; // Saldo de caixa atual (R$)
  periods: string[]; // Lista de meses 'YYYY-MM' (ex: ['2026-01', '2026-02', ...])
  rows: MonthlyFinancialRow[];
}

export interface FinancialKPIs {
  receitaBruta: number;
  deducoesImpostos: number;
  receitaLiquida: number;
  custosVariaveis: number;
  margemContribuicao: number;
  margemContribuicaoPct: number;
  despesasFixas: number;
  pessoalEncargos: number;
  ebitda: number; // Lucro Operacional antes de juros/impostos
  ebitdaMarginPct: number;
  investimentosCapEx: number;
  amortizacaoDividas: number;
  resultadoLiquido: number;
  resultadoLiquidoPct: number;
  caixaAcumuladoFinal: number;
  runwayMeses: number; // Quantos meses o caixa suporta no ritmo atual
  breakEvenReceitaBruta: number; // Faturamento necessário para resultado zerado
}

export interface MonthlyKPIBreakdown {
  periodIso: string; // 'YYYY-MM'
  periodLabel: string; // 'Jan/26'
  kpis: FinancialKPIs;
}
