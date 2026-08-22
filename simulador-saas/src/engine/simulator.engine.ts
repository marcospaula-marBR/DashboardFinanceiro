import { CompanyFinancialBase, MonthlyFinancialRow, MonthlyKPIBreakdown } from '../types/financial.types';
import { SimulationScenario, SimulationResult, ScenarioAssumption } from '../types/simulator.types';
import { calculateKPIsFromRows, calculatePMT } from './math-utils';

export class StandaloneSimulatorEngine {
  /**
   * Executa a simulação determinística completa a partir do cenário e dados base da empresa
   */
  static runSimulation(
    baseData: CompanyFinancialBase,
    scenario: SimulationScenario
  ): SimulationResult {
    const { periods, rows, currentCashBalance } = baseData;

    // 1. Definir período de projeção
    const projPeriods = periods.filter(
      p => p >= scenario.projectionStartDate && p <= scenario.projectionEndDate
    );

    const activePeriods = projPeriods.length > 0 ? projPeriods : periods;

    // 2. Clone profundo das linhas financeiras base
    const simulatedRows: MonthlyFinancialRow[] = JSON.parse(JSON.stringify(rows));

    // 3. Aplicar premissas ativas mês a mês
    activePeriods.forEach((periodIso, monthIndex) => {
      scenario.assumptions.forEach(asm => {
        if (!asm.enabled) return;
        if (periodIso < asm.startDate || periodIso > asm.endDate) return;

        simulatedRows.forEach(row => {
          // Filtrar escopo de atuação da premissa
          if (asm.targetGroup && asm.targetGroup !== 'all' && row.group !== asm.targetGroup) {
            return;
          }
          if (asm.targetAccountId && row.accountId !== asm.targetAccountId) {
            return;
          }
          if (asm.targetDepartment && row.department && row.department !== asm.targetDepartment) {
            return;
          }

          const currentVal = row.values[periodIso] || 0;
          let delta = 0;

          // Tipos de simulação
          switch (asm.type) {
            case 'revenue_increase':
            case 'price_adjustment':
              if (row.group === 'receita_bruta') {
                if (asm.amountType === 'percentage') {
                  delta = currentVal * (asm.value / 100);
                } else {
                  delta = asm.value / activePeriods.length;
                }
              }
              break;

            case 'revenue_reduction':
            case 'contract_loss':
              if (row.group === 'receita_bruta') {
                if (asm.amountType === 'percentage') {
                  delta = -Math.abs(currentVal * (asm.value / 100));
                } else {
                  delta = -Math.abs(asm.value / activePeriods.length);
                }
              }
              break;

            case 'revenue_replacement':
              if (row.group === 'receita_bruta') {
                // Rampa linear de reposição ao longo dos meses
                const stepRatio = (monthIndex + 1) / activePeriods.length;
                delta = asm.value * stepRatio;
              }
              break;

            case 'hiring_personnel':
              if (row.group === 'pessoal_encargos') {
                const count = asm.hiringCount || 1;
                const base = asm.salaryBase || asm.value || 0;
                const charges = 1 + ((asm.taxChargesPct || 70) / 100);
                delta = count * base * charges;
              }
              break;

            case 'layoff_personnel':
              if (row.group === 'pessoal_encargos') {
                if (asm.amountType === 'percentage') {
                  delta = -Math.abs(currentVal * (asm.value / 100));
                } else {
                  delta = -Math.abs(asm.value);
                }
              }
              break;

            case 'expense_increase':
              if (row.group === 'despesas_fixas') {
                if (asm.amountType === 'percentage') {
                  delta = currentVal * (asm.value / 100);
                } else {
                  delta = asm.value;
                }
              }
              break;

            case 'expense_reduction':
              if (row.group === 'despesas_fixas') {
                if (asm.amountType === 'percentage') {
                  delta = -Math.abs(currentVal * (asm.value / 100));
                } else {
                  delta = -Math.abs(asm.value);
                }
              }
              break;

            case 'costs_cut':
              if (row.group === 'custos_variaveis') {
                if (asm.amountType === 'percentage') {
                  delta = -Math.abs(currentVal * (asm.value / 100));
                } else {
                  delta = -Math.abs(asm.value);
                }
              }
              break;

            case 'new_loan':
              if (row.group === 'emprestimos_dividas') {
                const pmt = calculatePMT(
                  asm.loanAmount || asm.value || 0,
                  asm.loanMonthlyInterestPct || 1.5,
                  asm.loanTermsMonths || 12
                );
                delta = pmt;
              }
              break;

            case 'macro_driver':
              if (asm.amountType === 'percentage') {
                delta = currentVal * (asm.value / 100);
              }
              break;

            case 'custom':
              delta = asm.value;
              break;
          }

          row.values[periodIso] = currentVal + delta;
        });
      });
    });

    // 4. Calcular KPIs Globais Baseline e Simulado
    const baselineKPIs = calculateKPIsFromRows(rows, activePeriods, currentCashBalance);
    const simulatedKPIs = calculateKPIsFromRows(simulatedRows, activePeriods, currentCashBalance);

    // 5. Breakdown Mensal
    const monthlyBaseline: MonthlyKPIBreakdown[] = activePeriods.map(periodIso => ({
      periodIso,
      periodLabel: periodIso,
      kpis: calculateKPIsFromRows(rows, [periodIso], currentCashBalance)
    }));

    const monthlySimulated: MonthlyKPIBreakdown[] = activePeriods.map(periodIso => ({
      periodIso,
      periodLabel: periodIso,
      kpis: calculateKPIsFromRows(simulatedRows, [periodIso], currentCashBalance)
    }));

    // 6. Variâncias
    const receitaBrutaDiff = simulatedKPIs.receitaBruta - baselineKPIs.receitaBruta;
    const receitaBrutaDiffPct = baselineKPIs.receitaBruta > 0 ? (receitaBrutaDiff / baselineKPIs.receitaBruta) * 100 : 0;
    
    const resultadoLiquidoDiff = simulatedKPIs.resultadoLiquido - baselineKPIs.resultadoLiquido;
    const resultadoLiquidoDiffPct = baselineKPIs.resultadoLiquido !== 0 ? (resultadoLiquidoDiff / Math.abs(baselineKPIs.resultadoLiquido)) * 100 : 0;

    const ebitdaDiff = simulatedKPIs.ebitda - baselineKPIs.ebitda;
    const ebitdaDiffPct = baselineKPIs.ebitda !== 0 ? (ebitdaDiff / Math.abs(baselineKPIs.ebitda)) * 100 : 0;

    const runwayDiffMeses = simulatedKPIs.runwayMeses - baselineKPIs.runwayMeses;
    const breakEvenDiff = simulatedKPIs.breakEvenReceitaBruta - baselineKPIs.breakEvenReceitaBruta;

    // 7. Síntese Executiva Automática
    const executiveSummary: string[] = [];

    if (resultadoLiquidoDiff > 0) {
      executiveSummary.push(
        `O cenário projetado gera um ganho líquido adicional de R$ ${resultadoLiquidoDiff.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} em relação à base.`
      );
    } else if (resultadoLiquidoDiff < 0) {
      executiveSummary.push(
        `Atenção: A simulação indica uma redução de R$ ${Math.abs(resultadoLiquidoDiff).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} no resultado acumulado.`
      );
    }

    if (simulatedKPIs.runwayMeses < 6 && simulatedKPIs.runwayMeses < baselineKPIs.runwayMeses) {
      executiveSummary.push(
        `Alerta de Caixa: O runway diminuiu para ${simulatedKPIs.runwayMeses} meses. Recomenda-se prever aporte ou antecipação de cortes.`
      );
    }

    if (simulatedKPIs.breakEvenReceitaBruta > baselineKPIs.breakEvenReceitaBruta) {
      executiveSummary.push(
        `Seu Ponto de Equilíbrio mensal subiu para R$ ${(simulatedKPIs.breakEvenReceitaBruta / activePeriods.length).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês.`
      );
    }

    return {
      scenario,
      projectionPeriods: activePeriods,
      baselineKPIs,
      simulatedKPIs,
      monthlyBaseline,
      monthlySimulated,
      variance: {
        receitaBrutaDiff,
        receitaBrutaDiffPct,
        resultadoLiquidoDiff,
        resultadoLiquidoDiffPct,
        ebitdaDiff,
        ebitdaDiffPct,
        runwayDiffMeses,
        breakEvenDiff
      },
      executiveSummary
    };
  }
}
