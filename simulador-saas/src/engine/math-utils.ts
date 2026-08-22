import { FinancialKPIs, MonthlyFinancialRow } from '../types/financial.types';

/**
 * Utilitários Matemáticos e Financeiros Executivos para PMEs
 */

export function calculateKPIsFromRows(
  rows: MonthlyFinancialRow[],
  periodCols: string[],
  currentCashBalance: number = 0
): FinancialKPIs {
  let receitaBruta = 0;
  let deducoesImpostos = 0;
  let custosVariaveis = 0;
  let despesasFixas = 0;
  let pessoalEncargos = 0;
  let investimentosCapEx = 0;
  let amortizacaoDividas = 0;

  rows.forEach(row => {
    let rowSum = 0;
    periodCols.forEach(col => {
      rowSum += row.values[col] || 0;
    });

    switch (row.group) {
      case 'receita_bruta':
        receitaBruta += rowSum;
        break;
      case 'deducoes_impostos':
        deducoesImpostos += rowSum;
        break;
      case 'custos_variaveis':
        custosVariaveis += rowSum;
        break;
      case 'despesas_fixas':
        despesasFixas += rowSum;
        break;
      case 'pessoal_encargos':
        pessoalEncargos += rowSum;
        break;
      case 'investimentos_capex':
        investimentosCapEx += rowSum;
        break;
      case 'emprestimos_dividas':
        amortizacaoDividas += rowSum;
        break;
    }
  });

  const receitaLiquida = receitaBruta - deducoesImpostos;
  const margemContribuicao = receitaLiquida - custosVariaveis;
  const margemContribuicaoPct = receitaLiquida > 0 ? (margemContribuicao / receitaLiquida) * 100 : 0;
  
  const totalDespesasOperacionais = despesasFixas + pessoalEncargos;
  const ebitda = margemContribuicao - totalDespesasOperacionais;
  const ebitdaMarginPct = receitaLiquida > 0 ? (ebitda / receitaLiquida) * 100 : 0;

  const resultadoLiquido = ebitda - investimentosCapEx - amortizacaoDividas;
  const resultadoLiquidoPct = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;

  // Cálculo de Ponto de Equilíbrio (Break-Even)
  // Break-even = Despesas Fixas Totais / % Margem de Contribuição
  const mcRate = receitaBruta > 0 ? margemContribuicao / receitaBruta : 0;
  const breakEvenReceitaBruta = mcRate > 0 ? totalDespesasOperacionais / mcRate : 0;

  // Cálculo de Runway de Caixa
  // Gasto mensal médio = (Despesas Fixas + Custos + Pessoal + Dívidas) / meses
  const totalBurnRate = (custosVariaveis + totalDespesasOperacionais + amortizacaoDividas) / Math.max(1, periodCols.length);
  const receitaMensalMedia = receitaLiquida / Math.max(1, periodCols.length);
  const netBurnRateMensal = totalBurnRate - receitaMensalMedia;

  let runwayMeses = 999;
  if (netBurnRateMensal > 0 && currentCashBalance > 0) {
    runwayMeses = Number((currentCashBalance / netBurnRateMensal).toFixed(1));
  } else if (netBurnRateMensal > 0 && currentCashBalance <= 0) {
    runwayMeses = 0;
  }

  return {
    receitaBruta,
    deducoesImpostos,
    receitaLiquida,
    custosVariaveis,
    margemContribuicao,
    margemContribuicaoPct,
    despesasFixas,
    pessoalEncargos,
    ebitda,
    ebitdaMarginPct,
    investimentosCapEx,
    amortizacaoDividas,
    resultadoLiquido,
    resultadoLiquidoPct,
    caixaAcumuladoFinal: currentCashBalance + resultadoLiquido,
    runwayMeses,
    breakEvenReceitaBruta
  };
}

/**
 * Calcula a parcela fixa mensal de um empréstimo (Tabela Price)
 */
export function calculatePMT(principal: number, monthlyRatePct: number, months: number): number {
  if (months <= 0) return 0;
  const i = monthlyRatePct / 100;
  if (i === 0) return principal / months;
  return principal * ((i * Math.pow(1 + i, months)) / (Math.pow(1 + i, months) - 1));
}
