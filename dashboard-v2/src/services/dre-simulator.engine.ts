import {
  DreRow,
  DreFilters,
  DreMetadata,
  DreStructureItem,
  DreCalculatedResult,
  DreTotal,
  DreMensal,
  DreKpis
} from '@/types/dre';
import {
  Scenario,
  ScenarioAssumption,
  MacroIndexType,
  SimulatorScenarioType
} from '@/types/dre-simulator.types';
import {
  colToIso,
  isoToCol,
  addMonthsIso,
  diffMonthsIso,
  isColInPeriod,
  sortColList
} from '@/lib/date-utils';
import { normalizeForCompare } from './dre.service';

const MESES_ORDEM = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Categorias específicas de rateio administrativo (conforme dre.service.ts)
const CATEGORIAS_RATEIO = [
  'Credenciado Administrativo',
  'Credenciado TI',
  'Despesas Administrativas',
  'Despesas de Vendas e Marketing',
  'Despesas Financeiras',
  'Outros Tributos',
  'Despesas Eventuais',
  'Jurídico',
  'Despesas Variáveis',
  'Intermediação de Negócios',
  'Distribuição de Dividendos',
  'Dividendos',
  'Total Despesas Rateadas'
];

/**
 * Motor de Simulação Avançada de Cenários DRE
 */
export class DreSimulatorEngine {

  /**
   * Executa a simulação completa sobre os dados de DRE com base nas premissas de um cenário
   */
  static runSimulation(
    rawData: DreRow[],
    metadata: DreMetadata,
    estrutura: DreStructureItem[],
    filters: DreFilters,
    scenario: Scenario,
    macroRates: Record<MacroIndexType, Record<string, number>> = {} as any,
    equipamentoCounts?: Record<string, Record<string, number>>
  ): DreCalculatedResult {

    // 1. Filtragem Inicial (Empresa)
    let df = [...rawData];
    if (filters.empresas.length > 0) {
      df = df.filter(row => filters.empresas.includes(row.Empresa));
    }

    // 2. Mapeamento e Ordenação de Colunas
    const originalCols = sortColList(Object.keys(metadata.mapaMeses));
    let validColumns = [...originalCols];

    // Se houver filtros de períodos, limitamos as colunas históricas
    if (filters.periodos.length > 0) {
      validColumns = originalCols.filter(col => {
        const mes = metadata.mapaMeses[col];
        const ano = col.split('/')[1]?.trim();
        return filters.periodos.includes(`${mes}/${ano}`);
      });
    }

    const lastHistCol = validColumns[validColumns.length - 1];
    const lastHistIso = colToIso(lastHistCol);

    // Se for projeção futura e a data fim for posterior ao histórico, expandimos as colunas
    if (scenario.mode === 'future_projection' && scenario.projectionEndDate > lastHistIso) {
      let currentIso = addMonthsIso(lastHistIso, 1);
      while (currentIso <= scenario.projectionEndDate) {
        const colName = isoToCol(currentIso);
        if (colName && !validColumns.includes(colName)) {
          validColumns.push(colName);
        }
        currentIso = addMonthsIso(currentIso, 1);
      }
    }

    // 3. Identificar Categorias e Subcategorias Únicas
    const canonicalSpecialMap: Record<string, string> = {
      'intermediacao de negocios - receita': 'Intermediação de Negócios - Receitas',
      'intermediacao de negocio - receita': 'Intermediação de Negócios - Receitas',
      'intermediacao de negocios - receitas': 'Intermediação de Negócios - Receitas',
      'intermediacao de negocio - receitas': 'Intermediação de Negócios - Receitas',
      
      'mutuo - entrada': 'Mútuo - Entradas',
      'mutuo - entradas': 'Mútuo - Entradas',
      
      'distribuicao de dividendos': 'Distribuição de Dividendos',
      'distribuicao de dividendo': 'Distribuição de Dividendos',
      'dividendos': 'Distribuição de Dividendos',
      'dividendo': 'Distribuição de Dividendos',
      'distribuicao lucro': 'Distribuição de Dividendos',
      'distribuicao de lucro': 'Distribuição de Dividendos',
      'distribuicao de lucros': 'Distribuição de Dividendos',
      'distribuicao lucros': 'Distribuição de Dividendos',
      
      'intermediacao de negocios': 'Intermediação de Negócios',
      'intermediacao de negocio': 'Intermediação de Negócios',
      
      'mutuo - saida': 'Mútuo - Saídas',
      'mutuo - saidas': 'Mútuo - Saídas'
    };

    const subCategoriasEspecificas = [
      'Terceirização de Mão de Obra', 'Credenciado Operacional', 'Adiantamento - Credenciado Operacional',
      'Despesas com Pessoal', 'Custo dos Serviços Prestados', 'Preventiva - B2G', 'Manutenção Preventiva',
      'Corretiva - B2G', 'Manutenção Corretiva', 'Credenciado Administrativo', 'Adiantamento - Credenciado Administrativo',
      'Credenciado TI', 'Adiantamento - Credenciado TI', 'Distribuição de Dividendos', 'Dividendos',
      'Consórcios - a contemplar', 'Ativos', 'Mútuo - Entradas', 'Mútuo - Saídas',
      'Jurídico', 'Intermediação de Negócios', 'Renda Fixa',
      'Intermediação de Negócios - Receita', 'Intermediação de Negócio - Receita', 'Intermediação de Negócio - Receitas',
      'Mútuo - Entrada', 'Mútuo - Saída', 'Distribuição de Dividendo', 'Dividendo',
      'Distribuição Lucro', 'Distribuição de Lucro', 'Distribuição de Lucros', 'Intermediação de Negócio'
    ];

    // Mapeamos a estrutura de DRE por linha
    const catTotals: Record<string, number> = {};
    const catMonthly: Record<string, Record<string, number>> = {};
    const catSourceRows: Record<string, Record<string, DreRow[]>> = {};

    const getCatSourceRowsSafe = (cat: string, col: string) => {
      const normCat = normalizeForCompare(cat);
      const key = Object.keys(catSourceRows).find(k => 
        k.trim().toLowerCase() === cat.trim().toLowerCase() ||
        normalizeForCompare(k) === normCat
      );
      return key && catSourceRows[key] && catSourceRows[key][col] ? catSourceRows[key][col] : [];
    };

    // 4. Calcular o Baseline das Categorias
    // Para meses históricos, o baseline é o valor real filtrado.
    // Para meses futuros, o baseline é a média do período base filtrado (scenario.basePeriod).
    const baseCols = scenario.basePeriod.length > 0 ? scenario.basePeriod : originalCols;
    
    // Agrupar linhas por conta DRE e departamento para facilitar cálculos granulares
    const baselineMensal: Record<string, Record<string, number>> = {}; // groupKey -> month -> value
    const rowDetails: DreRow[] = [];
    const rowMap = new Map<string, DreRow>();

    df.forEach(row => {
      let cat = row.ContaDRE;
      const catNorm = normalizeForCompare(row.Categoria?.toString() || '');
      const canonicalTarget = canonicalSpecialMap[catNorm];
      if (canonicalTarget) {
        cat = canonicalTarget;
        row.Categoria = canonicalTarget; // Atualiza a categoria na própria linha para auditoria correta no modal
      } else {
        const matchedSpecial = row.Categoria
          ? subCategoriasEspecificas.find(sub => normalizeForCompare(sub) === catNorm)
          : undefined;
        if (matchedSpecial) {
          cat = matchedSpecial;
        }
      }
      if (!cat) return;

      const groupKey = `${row.Empresa}|${row.Departamento}|${cat}|${row.Projeto || 'Sem Projeto'}`;
      if (!baselineMensal[groupKey]) {
        baselineMensal[groupKey] = {};
        const normalizedRow = { ...row, Categoria: cat } as any;
        rowDetails.push(normalizedRow);
        rowMap.set(groupKey, normalizedRow);
      }

      validColumns.forEach(col => {
        const isFuture = colToIso(col) > lastHistIso;
        if (!isFuture) {
          const val = parseFloat(row[col]?.toString().replace(',', '.') || '0');
          baselineMensal[groupKey][col] = isNaN(val) ? 0 : val;
        }
      });
    });

    // Calcular médias históricas para as projeções futuras de cada linha
    const groupAverages: Record<string, number> = {};
    Object.keys(baselineMensal).forEach(groupKey => {
      let sum = 0;
      let count = 0;
      baseCols.forEach(col => {
        if (baselineMensal[groupKey][col] !== undefined) {
          sum += baselineMensal[groupKey][col];
          count++;
        }
      });
      groupAverages[groupKey] = count > 0 ? sum / count : 0;
    });

    // Preencher meses futuros com a média base
    Object.keys(baselineMensal).forEach(groupKey => {
      validColumns.forEach(col => {
        const isFuture = colToIso(col) > lastHistIso;
        if (isFuture) {
          baselineMensal[groupKey][col] = groupAverages[groupKey] || 0;
        }
      });
    });

    // 5. Aplicar Premissas do Cenário Mês a Mês, Linha a Linha
    const simulatedMensal: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(baselineMensal));

    validColumns.forEach(col => {
      const colIso = colToIso(col);
      
      // Aplicar premissas para cada combinação (Empresa/Departamento/Conta)
      Object.keys(simulatedMensal).forEach(groupKey => {
        const [emp, dept, cat, proj] = groupKey.split('|');
        let currentVal = simulatedMensal[groupKey][col] || 0;

        scenario.assumptions.forEach(asm => {
          // Ignora premissas desativadas
          if (asm.enabled === false) return;

          // 1. Verificar se o mês da coluna está dentro do range da premissa
          if (colIso < asm.startDate || colIso > asm.endDate) return;

          // 2. Verificar o escopo (Target)
          let matches = false;
          if (asm.targetType === 'all') {
            matches = true;
          } else if (asm.targetType === 'department' && asm.targetIds.includes(dept)) {
            matches = true;
          } else if (asm.targetType === 'account' && asm.targetIds.includes(cat)) {
            matches = true;
          } else if (asm.targetType === 'account_group') {
            // Se for despesas rateadas, confere com a lista de despesas
            if (asm.targetIds.includes('despesas_rateadas') && CATEGORIAS_RATEIO.includes(cat)) {
              matches = true;
            } else if (asm.targetIds.includes('custos_operacionais') && [
              'Credenciado Operacional', 'Adiantamento - Credenciado Operacional', 'Terceirização de Mão de Obra',
              'Despesas com Pessoal', 'Custo dos Serviços Prestados', 'Preventiva - B2G', 'Manutenção Preventiva',
              'Corretiva - B2G', 'Manutenção Corretiva', 'Outros Custos'
            ].includes(cat)) {
              matches = true;
            } else if (asm.targetIds.includes('receita') && [
              'Receita Bruta de Vendas', 'Receitas Indiretas'
            ].includes(cat)) {
              matches = true;
            }
          }

          // Filtros adicionais baseados no tipo de premissa
          if ((asm.type === 'revenue_replacement' || asm.type === 'contract_loss' || asm.type === 'future_contract_loss') && 
              !['Receita Bruta de Vendas', 'Receitas Indiretas'].includes(cat) && !asm.affectedAccountsRatio?.[cat]) {
            if (asm.type !== 'contract_loss' || asm.targetType !== 'department') {
              matches = false;
            }
          }

          if (!matches) return;

          // Contar quantas chaves no portfólio batem com este mesmo target para ratear valores absolutos
          const matchingKeysCount = Object.keys(simulatedMensal).filter(k => {
            const [kEmp, kDept, kCat, kProj] = k.split('|');
            let kMatches = false;
            if (asm.targetType === 'all') {
              kMatches = true;
            } else if (asm.targetType === 'department' && asm.targetIds.includes(kDept)) {
              kMatches = true;
            } else if (asm.targetType === 'account' && asm.targetIds.includes(kCat)) {
              kMatches = true;
            } else if (asm.targetType === 'account_group') {
              if (asm.targetIds.includes('despesas_rateadas') && CATEGORIAS_RATEIO.includes(kCat)) {
                kMatches = true;
              } else if (asm.targetIds.includes('custos_operacionais') && [
                'Credenciado Operacional', 'Adiantamento - Credenciado Operacional', 'Terceirização de Mão de Obra',
                'Despesas com Pessoal', 'Custo dos Serviços Prestados', 'Preventiva - B2G', 'Manutenção Preventiva',
                'Corretiva - B2G', 'Manutenção Corretiva', 'Outros Custos'
              ].includes(kCat)) {
                kMatches = true;
              } else if (asm.targetIds.includes('receita') && [
                'Receita Bruta de Vendas', 'Receitas Indiretas'
              ].includes(kCat)) {
                kMatches = true;
              }
            }
            return kMatches;
          }).length || 1;

          // 3. Aplicar o impacto com base na premissa
          switch (asm.type) {
            case 'revenue_reduction':
            case 'expense_reduction':
            case 'costs_cut':
              if (asm.amountType === 'percentage') {
                const factor = 1 - (Math.abs(asm.value) / 100);
                currentVal = currentVal * factor;
              } else if (asm.amountType === 'absolute_value' || asm.amountType === 'monthly_value') {
                currentVal = Math.max(0, currentVal - (Math.abs(asm.value) / matchingKeysCount));
              }
              break;

            case 'revenue_increase':
            case 'expense_increase':
              if (asm.amountType === 'percentage') {
                const factor = 1 + (Math.abs(asm.value) / 100);
                currentVal = currentVal * factor;
              } else if (asm.amountType === 'absolute_value' || asm.amountType === 'monthly_value') {
                currentVal = currentVal + (Math.abs(asm.value) / matchingKeysCount);
              }
              break;

            case 'contract_loss': {
              const lossVal = asm.monthlyLoss !== undefined ? asm.monthlyLoss : Math.abs(asm.value);
              const replMonths = asm.replacementMonths || 0;
              const elapsed = diffMonthsIso(asm.startDate, colIso);

              if (elapsed >= 0) {
                let currentLoss = lossVal;
                // Se houver janela de reposição, reduz a perda gradualmente
                if (replMonths > 0 && elapsed > 0) {
                  const recoveryFactor = Math.min(1, elapsed / replMonths);
                  currentLoss = lossVal * (1 - recoveryFactor);
                }

                if (['Receita Bruta de Vendas', 'Receitas Indiretas'].includes(cat)) {
                  currentVal = Math.max(0, currentVal - (currentLoss / matchingKeysCount));
                } else if (asm.affectedAccountsRatio?.[cat]) {
                  // Desdobramento proporcional para outras contas DRE (ex: Impostos, Credenciados)
                  const ratio = asm.affectedAccountsRatio[cat];
                  currentVal = Math.max(0, currentVal + ((currentLoss * ratio) / matchingKeysCount));
                }
              }
              break;
            }

            case 'future_contract_loss': {
              const lossVal = asm.monthlyLoss !== undefined ? asm.monthlyLoss : Math.abs(asm.value);
              const futureStart = asm.futureLossStartDate || asm.startDate;
              const targetGoal = asm.targetSalesGoalPerMonth || 0;
              const elapsedFromNow = diffMonthsIso(asm.startDate, colIso);
              const elapsedFromFuture = diffMonthsIso(futureStart, colIso);

              if (['Receita Bruta de Vendas', 'Receitas Indiretas'].includes(cat)) {
                // Antes do Ponto X: acumula novos fechamentos conforme meta
                if (elapsedFromNow >= 0 && elapsedFromFuture < 0) {
                  const accumulatedGoal = targetGoal * (elapsedFromNow + 1);
                  currentVal = currentVal + (accumulatedGoal / matchingKeysCount);
                } else if (elapsedFromFuture >= 0) {
                  // A partir do Ponto X: aplica o impacto bruto da perda offsetado pela meta acumulada
                  const totalGoalAcquired = targetGoal * diffMonthsIso(asm.startDate, futureStart);
                  const netImpact = lossVal - totalGoalAcquired;
                  if (netImpact > 0) {
                    currentVal = Math.max(0, currentVal - (netImpact / matchingKeysCount));
                  }
                }
              }
              break;
            }

            case 'revenue_replacement':
              if (['Receita Bruta de Vendas', 'Receitas Indiretas'].includes(cat)) {
                const totalMonths = diffMonthsIso(asm.startDate, asm.endDate) + 1;
                const currentMonthIdx = diffMonthsIso(asm.startDate, colIso);
                
                if (totalMonths > 0 && currentMonthIdx >= 0) {
                  let replacementValue = 0;
                  const valorTotalARepor = asm.value;
                  
                  if (asm.recurrence === 'linear_ramp') {
                    const metaMensal = valorTotalARepor / totalMonths;
                    replacementValue = metaMensal * (currentMonthIdx + 1);
                  } else if (asm.recurrence === 'one_time') {
                    replacementValue = valorTotalARepor;
                  } else if (asm.recurrence === 'monthly') {
                    const progress = (currentMonthIdx + 1) / totalMonths;
                    replacementValue = valorTotalARepor * progress;
                  } else {
                    const progress = (currentMonthIdx + 1) / totalMonths;
                    const factor = 3 * progress * progress - 2 * progress * progress * progress;
                    replacementValue = valorTotalARepor * factor;
                  }
                  
                  currentVal = currentVal + (replacementValue / matchingKeysCount);
                }
              }
              break;

            case 'macro_driver':
              // Reajustes baseados em índices (IPCA, CDI, etc.)
              if (asm.macroIndex) {
                const monthlyRates = macroRates[asm.macroIndex] || {};
                const elapsedMonths = diffMonthsIso(asm.startDate, colIso);
                if (elapsedMonths >= 0) {
                  // Compounding rates
                  let compoundFactor = 1;
                  let tempIso = asm.startDate;
                  for (let i = 0; i <= elapsedMonths; i++) {
                    const rate = monthlyRates[tempIso] !== undefined ? monthlyRates[tempIso] : (asm.value / 100);
                    compoundFactor *= (1 + rate);
                    tempIso = addMonthsIso(tempIso, 1);
                  }
                  currentVal = currentVal * compoundFactor;
                }
              }
              break;
          }
        });

        simulatedMensal[groupKey][col] = currentVal;
      });
    });

    // 6. Agrupar em Categoria Totais e Mensais para a Tabela DRE
    validColumns.forEach(col => {
      Object.keys(simulatedMensal).forEach(groupKey => {
        const [emp, dept, cat, proj] = groupKey.split('|');
        const val = simulatedMensal[groupKey][col] || 0;

        if (!catTotals[cat]) {
          catTotals[cat] = 0;
          catMonthly[cat] = {};
          catSourceRows[cat] = {};
          validColumns.forEach(c => {
            catMonthly[cat][c] = 0;
            catSourceRows[cat][c] = [];
          });
        }

        catTotals[cat] += val;
        catMonthly[cat][col] += val;

        if (val !== 0) {
          const baseRow = rowMap.get(groupKey);
          if (baseRow) {
            const rowCopy = {
              ...baseRow,
              [col]: val
            };
            catSourceRows[cat][col].push(rowCopy);
          }
        }
      });
    });

    // ══════════════════════════════════════════════════════════════════════
    // PÓS-COLETA: Extração de categorias especiais que caíram no bucket errado
    // ══════════════════════════════════════════════════════════════════════
    const SPECIAL_EXTRACTIONS: { target: string; norm: string }[] = Object.entries(canonicalSpecialMap).map(([norm, target]) => ({
      target,
      norm
    }));

    Object.keys(catSourceRows).forEach(catKey => {
      const catKeyNorm = normalizeForCompare(catKey);
      // Pular buckets que já são categorias especiais (já estão no lugar certo)
      if (Object.values(canonicalSpecialMap).map(normalizeForCompare).includes(catKeyNorm)) return;

      validColumns.forEach(col => {
        const rows = catSourceRows[catKey]?.[col] || [];
        if (rows.length === 0) return;

        const toKeep: DreRow[] = [];

        rows.forEach(r => {
          const rowCatNorm = normalizeForCompare(r.Categoria?.toString() || '');
          const matched = SPECIAL_EXTRACTIONS.find(s => s.norm === rowCatNorm);

          if (matched) {
            const val = parseFloat(r[col]?.toString().replace(',', '.') || '0');
            if (!isNaN(val) && val !== 0) {
              const targetCanonical = matched.target;
              r.Categoria = targetCanonical; // Atualiza a categoria na própria linha para exibição no modal

              // Inicializar bucket especial se ainda não existir
              if (!catMonthly[targetCanonical]) {
                catMonthly[targetCanonical] = {};
                catSourceRows[targetCanonical] = {};
                catTotals[targetCanonical] = 0;
                validColumns.forEach(c => {
                  catMonthly[targetCanonical][c] = 0;
                  catSourceRows[targetCanonical][c] = [];
                });
              }
              // Mover valor para o bucket correto
              catMonthly[catKey][col] = (catMonthly[catKey][col] || 0) - val;
              catMonthly[targetCanonical][col] = (catMonthly[targetCanonical][col] || 0) + val;
              catSourceRows[targetCanonical][col].push(r);
              // NÃO adicionar ao toKeep (extraído)
            } else {
              toKeep.push(r);
            }
          } else {
            toKeep.push(r);
          }
        });

        catSourceRows[catKey][col] = toKeep;
      });
    });

    // Reconstruir catTotals a partir de catMonthly após extração
    Object.keys(catMonthly).forEach(cat => {
      catTotals[cat] = validColumns.reduce((sum, col) => sum + (catMonthly[cat][col] || 0), 0);
    });

    // 7. Consolidação Final da Estrutura DRE e KPIs
    const valoresTotal: Record<string, number> = {};
    const valoresMensal: Record<string, Record<string, number>> = {};
    const sourceRows: Record<string, Record<string, DreRow[]>> = {};

    const getCatTotal = (targetCat: string) => catTotals[targetCat] || 0;
    const getCatMonthly = (targetCat: string, col: string) => catMonthly[targetCat]?.[col] || 0;

    const servicosBaseTotal = getCatTotal('Serviços');
    const consorciosTotal = getCatTotal('Consórcios - a contemplar');

    const getMatchingBucketKeys = (catList?: string[]): string[] => {
      if (!catList || catList.length === 0) return [];
      const matched = new Set<string>();
      catList.forEach(targetCat => {
        if (!targetCat) return;
        const normTarget = targetCat.trim().toLowerCase();
        Object.keys(catMonthly).forEach(k => {
          if (k.trim().toLowerCase() === normTarget) {
            matched.add(k);
          }
        });
      });
      return Array.from(matched);
    };

    estrutura.forEach(item => {
      // Toggle de Despesas Rateadas Administrativas
      const isExcludedShared = (!scenario.includeAllocatedExpenses || filters.excludeSharedExpenses) && CATEGORIAS_RATEIO.includes(item.titulo);

      if (item.tipo === 'linha' || item.tipo === 'hidden' || (item.tipo === 'card' && item.categorias)) {
        let total = 0;
        const matchingKeys = getMatchingBucketKeys(item.categorias);
        if (!isExcludedShared) {
          matchingKeys.forEach(key => total += (catTotals[key] || 0));
        }
        valoresTotal[item.titulo] = total;

        valoresMensal[item.titulo] = {};
        sourceRows[item.titulo] = {};
        validColumns.forEach(col => {
          let mesTotal = 0;
          let rowsForMonth: DreRow[] = [];
          if (!isExcludedShared) {
            matchingKeys.forEach(key => {
              mesTotal += (catMonthly[key]?.[col] || 0);
              if (catSourceRows[key]?.[col]) {
                rowsForMonth.push(...catSourceRows[key][col]);
              }
            });
          }
          valoresMensal[item.titulo][col] = mesTotal;
          sourceRows[item.titulo][col] = rowsForMonth;
        });
      }
    });

    const getVal = (key: string) => valoresTotal[key] || 0;
    const getValMensal = (key: string, col: string) => (valoresMensal[key] && valoresMensal[key][col]) ? valoresMensal[key][col] : 0;

    const receitaOperacional = getVal("Receita Bruta de Vendas");
    const receitaIndireta = getVal("Receitas Indiretas");
    const totalEntradas = receitaOperacional + receitaIndireta;

    const outrasEntradas = getVal("Outras Receitas") + getVal("Receitas Financeiras") + getVal("Honorários") + getVal("Juros e Devoluções") + getVal("Recuperação de Despesas Variáveis");
    const totalImpostos = getVal("Impostos") + getVal("Provisão IRPJ e CSSL Trimestral");

    const totalCustos = getCatTotal("Credenciado Operacional") + getCatTotal("Adiantamento - Credenciado Operacional") +
      getVal("Terceirização de Mão de Obra") + getVal("CLTs") + getVal("Custo dos Serviços Prestados") +
      getVal("Preventiva - B2G") + getVal("Corretiva - B2G") + getVal("Outros Custos") + getVal("Deduções de Receita");

    const totalDespesas = (!scenario.includeAllocatedExpenses || filters.excludeSharedExpenses)
      ? 0
      : (getVal("Credenciado Administrativo") + getVal("Credenciado TI") +
         getVal("Despesas Administrativas") + getVal("Despesas de Vendas e Marketing") + getVal("Despesas Financeiras") +
         getVal("Outros Tributos") + getVal("Despesas Eventuais") + getVal("Despesas Variáveis"));

    const totalInvestimentos = getCatTotal("Consórcios - a contemplar") + getVal("Serviços") + getCatTotal("Ativos") + getVal("Aplicações Financeiras");
    const totalSaidas = totalImpostos + totalCustos + totalDespesas + totalInvestimentos;

    // Categorias especiais FCL: mapear direto do catTotals para valoresTotal
    const totalIntermediReceitas = getCatTotal("Intermediação de Negócios - Receitas");
    const totalMutuoEntradas = getCatTotal("Mútuo - Entradas");
    const totalDividendos = getCatTotal("Distribuição de Dividendos") + getCatTotal("Dividendos");
    const totalIntermedioSaidas = getCatTotal("Intermediação de Negócios");
    const totalMutuoSaidas = getCatTotal("Mútuo - Saídas");
    const totalRetiradas = totalDividendos + totalIntermedioSaidas + totalMutuoSaidas;

    const resultado = totalEntradas - totalImpostos - totalCustos - totalDespesas;
    const fcl = totalEntradas + outrasEntradas - totalSaidas + totalIntermediReceitas + totalMutuoEntradas;

    // Equipamentos
    const totalEquipamentos = getCatTotal("Equipamentos");
    valoresTotal["Equipamentos"] = totalEquipamentos;

    valoresTotal["Total Entradas Operacionais"] = totalEntradas;
    valoresTotal["Outras Entradas"] = outrasEntradas;
    valoresTotal["Total de Impostos"] = totalImpostos;
    valoresTotal["Total Custos Operacionais"] = totalCustos;
    valoresTotal["Total Despesas Rateadas"] = totalDespesas;
    valoresTotal["Total Investimentos"] = totalInvestimentos;
    valoresTotal["Total Saídas"] = totalSaidas;
    valoresTotal["Lucro antes do FCL"] = resultado;
    valoresTotal["Fluxo de Caixa Livre FCL"] = fcl;
    valoresTotal["Resultado Liquido Final"] = resultado;
    valoresTotal["Impostos Gerais"] = totalImpostos;

    // Mapear categorias FCL especiais para valoresTotal (acesso pelo modal)
    valoresTotal["Intermediação de Negócios - Receitas"] = totalIntermediReceitas;
    valoresTotal["Mútuo - Entradas"] = totalMutuoEntradas;
    valoresTotal["Distribuição de Dividendos"] = totalDividendos;
    valoresTotal["Intermediação de Negócios"] = totalIntermedioSaidas;
    valoresTotal["Mútuo - Saídas"] = totalMutuoSaidas;
    valoresTotal["Total Retiradas dos Sócios"] = totalRetiradas;
    valoresTotal["FCL após Retiradas dos Sócios"] = fcl - totalRetiradas;

    const percLucro = totalEntradas !== 0 ? (resultado / totalEntradas * 100) : 0;
    const percFcl = totalEntradas !== 0 ? (fcl / totalEntradas * 100) : 0;

    valoresTotal["Lucro s/ Receita Operacional"] = percLucro;
    valoresTotal["FCL s/ Receita Operacional"] = percFcl;

    valoresMensal["Total Entradas Operacionais"] = {};
    valoresMensal["Outras Entradas"] = {};
    valoresMensal["Total de Impostos"] = {};
    valoresMensal["Total Custos Operacionais"] = {};
    valoresMensal["Total Despesas Rateadas"] = {};
    valoresMensal["Total Investimentos"] = {};
    valoresMensal["Total Saídas"] = {};
    valoresMensal["Lucro antes do FCL"] = {};
    valoresMensal["Fluxo de Caixa Livre FCL"] = {};
    valoresMensal["Lucro s/ Receita Operacional"] = {};
    valoresMensal["FCL s/ Receita Operacional"] = {};
    valoresMensal["Equipamentos"] = {};
    valoresMensal["Intermediação de Negócios - Receitas"] = {};
    valoresMensal["Mútuo - Entradas"] = {};
    valoresMensal["Distribuição de Dividendos"] = {};
    valoresMensal["Intermediação de Negócios"] = {};
    valoresMensal["Mútuo - Saídas"] = {};
    valoresMensal["Total Retiradas dos Sócios"] = {};
    valoresMensal["FCL após Retiradas dos Sócios"] = {};

    sourceRows["Total Entradas Operacionais"] = {};
    sourceRows["Outras Entradas"] = {};
    sourceRows["Total de Impostos"] = {};
    sourceRows["Total Custos Operacionais"] = {};
    sourceRows["Total Despesas Rateadas"] = {};
    sourceRows["Total Investimentos"] = {};
    sourceRows["Total Saídas"] = {};
    sourceRows["Lucro antes do FCL"] = {};
    sourceRows["Fluxo de Caixa Livre FCL"] = {};
    sourceRows["Equipamentos"] = {};
    sourceRows["Intermediação de Negócios - Receitas"] = {};
    sourceRows["Mútuo - Entradas"] = {};
    sourceRows["Distribuição de Dividendos"] = {};
    sourceRows["Intermediação de Negócios"] = {};
    sourceRows["Mútuo - Saídas"] = {};
    sourceRows["Total Retiradas dos Sócios"] = {};

    const getSourceRowsMensal = (key: string, col: string) => {
      return (sourceRows[key] && sourceRows[key][col]) ? sourceRows[key][col] : [];
    };

    validColumns.forEach(col => {
      const recOp = getValMensal("Receita Bruta de Vendas", col);
      const recInd = getValMensal("Receitas Indiretas", col);
      const totEnt = recOp + recInd;
      valoresMensal["Total Entradas Operacionais"][col] = totEnt;
      sourceRows["Total Entradas Operacionais"][col] = [...getSourceRowsMensal("Receita Bruta de Vendas", col), ...getSourceRowsMensal("Receitas Indiretas", col)];

      const outrasEnt = getValMensal("Outras Receitas", col) + getValMensal("Receitas Financeiras", col) + getValMensal("Honorários", col) + getValMensal("Juros e Devoluções", col) + getValMensal("Recuperação de Despesas Variáveis", col);
      valoresMensal["Outras Entradas"][col] = outrasEnt;
      sourceRows["Outras Entradas"][col] = [
        ...getSourceRowsMensal("Outras Receitas", col), ...getSourceRowsMensal("Receitas Financeiras", col),
        ...getSourceRowsMensal("Honorários", col), ...getSourceRowsMensal("Juros e Devoluções", col), ...getSourceRowsMensal("Recuperação de Despesas Variáveis", col)
      ];

      const totImp = getValMensal("Impostos", col) + getValMensal("Provisão IRPJ e CSSL Trimestral", col);
      valoresMensal["Total de Impostos"][col] = totImp;
      sourceRows["Total de Impostos"][col] = [...getSourceRowsMensal("Impostos", col), ...getSourceRowsMensal("Provisão IRPJ e CSSL Trimestral", col)];

      const totCust = getCatMonthly("Credenciado Operacional", col) + getCatMonthly("Adiantamento - Credenciado Operacional", col) +
        getValMensal("Terceirização de Mão de Obra", col) + getValMensal("CLTs", col) + getValMensal("Custo dos Serviços Prestados", col) +
        getValMensal("Preventiva - B2G", col) + getValMensal("Corretiva - B2G", col) + getValMensal("Outros Custos", col) + getValMensal("Deduções de Receita", col);
      valoresMensal["Total Custos Operacionais"][col] = totCust;
      sourceRows["Total Custos Operacionais"][col] = [
        ...getCatSourceRowsSafe("Credenciado Operacional", col), ...getCatSourceRowsSafe("Adiantamento - Credenciado Operacional", col),
        ...getSourceRowsMensal("Terceirização de Mão de Obra", col), ...getSourceRowsMensal("CLTs", col), ...getSourceRowsMensal("Custo dos Serviços Prestados", col),
        ...getSourceRowsMensal("Preventiva - B2G", col), ...getSourceRowsMensal("Corretiva - B2G", col), ...getSourceRowsMensal("Outros Custos", col),
        ...getSourceRowsMensal("Deduções de Receita", col)
      ];

      const totDesp = (!scenario.includeAllocatedExpenses || filters.excludeSharedExpenses)
        ? 0
        : (getValMensal("Credenciado Administrativo", col) + getValMensal("Credenciado TI", col) +
           getValMensal("Despesas Administrativas", col) + getValMensal("Despesas de Vendas e Marketing", col) + getValMensal("Despesas Financeiras", col) +
           getValMensal("Outros Tributos", col) + getValMensal("Despesas Eventuais", col) + getValMensal("Despesas Variáveis", col));
      valoresMensal["Total Despesas Rateadas"][col] = totDesp;
      sourceRows["Total Despesas Rateadas"][col] = (!scenario.includeAllocatedExpenses || filters.excludeSharedExpenses)
        ? []
        : [
            ...getSourceRowsMensal("Credenciado Administrativo", col), ...getSourceRowsMensal("Credenciado TI", col),
            ...getSourceRowsMensal("Despesas Administrativas", col), ...getSourceRowsMensal("Despesas de Vendas e Marketing", col), ...getSourceRowsMensal("Despesas Financeiras", col),
            ...getSourceRowsMensal("Outros Tributos", col), ...getSourceRowsMensal("Despesas Eventuais", col), ...getSourceRowsMensal("Despesas Variáveis", col)
          ];

      const totInv = getCatMonthly("Consórcios - a contemplar", col) + getValMensal("Serviços", col) + getCatMonthly("Ativos", col) + getValMensal("Aplicações Financeiras", col);
      valoresMensal["Total Investimentos"][col] = totInv;
      sourceRows["Total Investimentos"][col] = [
        ...getCatSourceRowsSafe("Consórcios - a contemplar", col), ...getSourceRowsMensal("Serviços", col), ...getCatSourceRowsSafe("Ativos", col), ...getSourceRowsMensal("Aplicações Financeiras", col)
      ];

      const totSai = totImp + totCust + totDesp + totInv;
      valoresMensal["Total Saídas"][col] = totSai;
      sourceRows["Total Saídas"][col] = [
        ...sourceRows["Total de Impostos"][col],
        ...sourceRows["Total Custos Operacionais"][col],
        ...sourceRows["Total Despesas Rateadas"][col],
        ...sourceRows["Total Investimentos"][col]
      ];

      const resCol = totEnt - totImp - totCust - totDesp;

      const intermReceitasCol = getCatMonthly("Intermediação de Negócios - Receitas", col);
      const mutuoEntradasCol = getCatMonthly("Mútuo - Entradas", col);
      const dividendosCol = getCatMonthly("Distribuição de Dividendos", col) + getCatMonthly("Dividendos", col);
      const intermedioSaidasCol = getCatMonthly("Intermediação de Negócios", col);
      const mutuoSaidasCol = getCatMonthly("Mútuo - Saídas", col);
      const retiradasCol = dividendosCol + intermedioSaidasCol + mutuoSaidasCol;

      valoresMensal["Intermediação de Negócios - Receitas"][col] = intermReceitasCol;
      sourceRows["Intermediação de Negócios - Receitas"][col] = getCatSourceRowsSafe("Intermediação de Negócios - Receitas", col);
      valoresMensal["Mútuo - Entradas"][col] = mutuoEntradasCol;
      sourceRows["Mútuo - Entradas"][col] = getCatSourceRowsSafe("Mútuo - Entradas", col);
      valoresMensal["Distribuição de Dividendos"][col] = dividendosCol;
      sourceRows["Distribuição de Dividendos"][col] = [...getCatSourceRowsSafe("Distribuição de Dividendos", col), ...getCatSourceRowsSafe("Dividendos", col)];
      valoresMensal["Intermediação de Negócios"][col] = intermedioSaidasCol;
      sourceRows["Intermediação de Negócios"][col] = getCatSourceRowsSafe("Intermediação de Negócios", col);
      valoresMensal["Mútuo - Saídas"][col] = mutuoSaidasCol;
      sourceRows["Mútuo - Saídas"][col] = getCatSourceRowsSafe("Mútuo - Saídas", col);
      valoresMensal["Total Retiradas dos Sócios"][col] = retiradasCol;
      sourceRows["Total Retiradas dos Sócios"][col] = [
        ...sourceRows["Distribuição de Dividendos"][col],
        ...sourceRows["Intermediação de Negócios"][col],
        ...sourceRows["Mútuo - Saídas"][col]
      ];

      const fclCol = totEnt + outrasEnt - totSai + intermReceitasCol + mutuoEntradasCol;

      valoresMensal["Lucro antes do FCL"][col] = resCol;
      sourceRows["Lucro antes do FCL"][col] = [
        ...sourceRows["Total Entradas Operacionais"][col],
        ...sourceRows["Outras Entradas"][col],
        ...sourceRows["Total Saídas"][col]
      ];

      valoresMensal["Fluxo de Caixa Livre FCL"][col] = fclCol;
      sourceRows["Fluxo de Caixa Livre FCL"][col] = [
        ...sourceRows["Total Entradas Operacionais"][col],
        ...sourceRows["Outras Entradas"][col],
        ...sourceRows["Total Saídas"][col]
      ];

      valoresMensal["FCL após Retiradas dos Sócios"][col] = fclCol - retiradasCol;

      valoresMensal["Lucro s/ Receita Operacional"][col] = totEnt !== 0 ? (resCol / totEnt * 100) : 0;
      valoresMensal["FCL s/ Receita Operacional"][col] = totEnt !== 0 ? (fclCol / totEnt * 100) : 0;

      valoresMensal["Equipamentos"][col] = getCatMonthly("Equipamentos", col);
      sourceRows["Equipamentos"][col] = getCatSourceRowsSafe("Equipamentos", col);
    });

    const activeMachinesList = validColumns.map(col => {
      const monthCounts = equipamentoCounts?.[col] || {};
      const activeDepts = filters.departamentos.length > 0 
        ? filters.departamentos 
        : Object.keys(monthCounts);

      let sum = 0;
      activeDepts.forEach(dept => {
        sum += monthCounts[dept] || 0;
      });
      return sum;
    });
    const machinesSum = activeMachinesList.reduce((a, b) => a + b, 0);
    const averageMachines = validColumns.length > 0 ? (machinesSum / validColumns.length) : 0;

    return {
      totais: valoresTotal,
      mensal: valoresMensal,
      estrutura: estrutura,
      validColumns,
      sourceRows,
      kpis: {
        receitaOperacional,
        receitaIndireta,
        totalEntradas,
        outrasEntradas,
        totalImpostos,
        totalCustos,
        totalDespesas,
        totalInvestimentos,
        totalSaidas,
        resultado,
        fcl,
        percLucro,
        percFcl,
        totalEquipamentos,
        averageMachines
      }
    };
  }
}

/**
 * ──────────────────────────────────────────────────────────
 * SIMULADOR V2 — FUNÇÕES PURAS EM TYPESCRIPT
 * Totalmente desvinculado de mutações de banco de dados
 * ──────────────────────────────────────────────────────────
 */

export interface SimulatorV2Params {
  revenueChangePct: number;       // -50% a +50%
  costReductionPct: number;       // 0% a 50%
  expenseReductionPct: number;    // 0% a 50%
  contractLossValue: number;      // Perda mensal em R$
  contractReplacementMonths: number; // Janela de reposição (meses)
  contractStartMonth?: string;     // '2025-08'
  layoffsCount: number;           // Headcount reduzido (Peopleboard)
  layoffsMonthlySavings: number;  // Economia mensal em R$
  layoffsSeveranceCost: number;   // Custo total de rescisões (R$)
  initialCash: number;            // Saldo de caixa inicial para Runway
}

export interface SimulatorV2Metrics {
  breakEvenPointReal: number;
  breakEvenPointSimulated: number;
  cashRunwayMonths: number;
  zeroCashMonth: string | null;
  isRunwaySustainable: boolean;
  ebitdaMarginReal: number;
  ebitdaMarginSimulated: number;
  severancePaybackMonths: number;
}

/** 1. Ponto de Equilíbrio (Break-Even Point) em R$/mês */
export function calculateBreakEvenPoint(fixedCosts: number, variableCostRatio: number): number {
  const contributionMarginRatio = 1 - Math.min(0.99, Math.max(0, variableCostRatio));
  if (contributionMarginRatio <= 0) return 0;
  return Math.round(fixedCosts / contributionMarginRatio);
}

/** 2. Cash Runway (Quantos meses o caixa suporta e data em que zera) */
export function calculateCashRunway(
  initialCash: number,
  monthlyResults: Record<string, number>,
  validColumns: string[]
): { runwayMonths: number; zeroCashMonth: string | null; isSustainable: boolean } {
  let runningCash = initialCash;
  let zeroMonth: string | null = null;
  let monthsCount = 0;

  for (const col of validColumns) {
    const netCashFlow = monthlyResults[col] || 0;
    runningCash += netCashFlow;
    monthsCount++;
    if (runningCash <= 0 && !zeroMonth) {
      zeroMonth = col;
    }
  }

  if (!zeroMonth) {
    return { runwayMonths: validColumns.length, zeroCashMonth: null, isSustainable: true };
  }

  return { runwayMonths: monthsCount, zeroCashMonth: zeroMonth, isSustainable: false };
}

/** 3. Margem EBITDA (%) */
export function calculateEbitdaMargin(ebitda: number, revenue: number): number {
  if (!revenue || revenue === 0) return 0;
  return (ebitda / Math.abs(revenue)) * 100;
}

/** 4. Payback de Rescisões (Meses para recuperar investimento em rescisões) */
export function calculateSeverancePayback(severanceCost: number, monthlyPayrollSavings: number): number {
  if (!monthlyPayrollSavings || monthlyPayrollSavings <= 0) return 0;
  if (!severanceCost || severanceCost <= 0) return 0;
  return Math.round((severanceCost / monthlyPayrollSavings) * 10) / 10;
}

/** 5. Execução Completa da Simulação V2 via Funções Puras */
export function calculateV2SimulationEngine(
  rawData: DreRow[],
  metadata: DreMetadata,
  estrutura: DreStructureItem[],
  filters: DreFilters,
  params: SimulatorV2Params
): {
  baseResult: DreCalculatedResult;
  simResult: DreCalculatedResult;
  metrics: SimulatorV2Metrics;
  assumptions: ScenarioAssumption[];
} {
  // 1. Gerar Premissas em Memória
  const assumptions: ScenarioAssumption[] = [];

  // Variação de Receitas (%)
  if (params.revenueChangePct !== 0) {
    assumptions.push({
      id: 'v2_rev_pct',
      type: params.revenueChangePct > 0 ? 'revenue_increase' : 'revenue_reduction',
      targetType: 'account_group',
      targetIds: ['receita'],
      amountType: 'percentage',
      value: Math.abs(params.revenueChangePct),
      startDate: '2025-01',
      endDate: '2026-12',
      recurrence: 'monthly',
      enabled: true,
      notes: `Variação de Receita: ${params.revenueChangePct > 0 ? '+' : ''}${params.revenueChangePct}%`
    });
  }

  // Corte de Custos (%)
  if (params.costReductionPct > 0) {
    assumptions.push({
      id: 'v2_costs_pct',
      type: 'costs_cut',
      targetType: 'account_group',
      targetIds: ['custos_operacionais'],
      amountType: 'percentage',
      value: params.costReductionPct,
      startDate: '2025-01',
      endDate: '2026-12',
      recurrence: 'monthly',
      enabled: true,
      notes: `Corte de Custos: -${params.costReductionPct}%`
    });
  }

  // Corte de Despesas Rateadas (%)
  if (params.expenseReductionPct > 0) {
    assumptions.push({
      id: 'v2_exp_pct',
      type: 'expense_reduction',
      targetType: 'account_group',
      targetIds: ['despesas_rateadas'],
      amountType: 'percentage',
      value: params.expenseReductionPct,
      startDate: '2025-01',
      endDate: '2026-12',
      recurrence: 'monthly',
      enabled: true,
      notes: `Corte de Despesas Rateadas: -${params.expenseReductionPct}%`
    });
  }

  // Perda de Contrato
  if (params.contractLossValue > 0) {
    assumptions.push({
      id: 'v2_contract_loss',
      type: 'contract_loss',
      targetType: 'account_group',
      targetIds: ['receita'],
      amountType: 'monthly_value',
      value: params.contractLossValue,
      monthlyLoss: params.contractLossValue,
      contractName: 'Contrato Simulado',
      startDate: params.contractStartMonth || '2025-08',
      endDate: '2026-12',
      recurrence: 'linear_ramp',
      replacementMonths: params.contractReplacementMonths || 0,
      enabled: true,
      notes: `Perda de Contrato: R$ ${params.contractLossValue}/mês (Reposição: ${params.contractReplacementMonths || 0}m)`
    });
  }

  // Layoffs / Readequação de Pessoal (Peopleboard)
  if (params.layoffsMonthlySavings > 0) {
    assumptions.push({
      id: 'v2_layoffs_savings',
      type: 'expense_reduction',
      targetType: 'account',
      targetIds: ['CLTs', 'Despesas com Pessoal', 'Credenciado Operacional'],
      amountType: 'monthly_value',
      value: params.layoffsMonthlySavings,
      startDate: '2025-08',
      endDate: '2026-12',
      recurrence: 'monthly',
      enabled: true,
      notes: `Readequação de Pessoal (${params.layoffsCount} pessoas): Economia de R$ ${params.layoffsMonthlySavings}/mês`
    });
  }

  // 2. Executar Motor Base e Simulado em Memória
  const baseScenario: Scenario = {
    id: 'base_v2',
    name: 'Cenário Real',
    basePeriod: [],
    projectionStartDate: '2025-01',
    projectionEndDate: '2026-12',
    mode: 'historical_what_if',
    includeAllocatedExpenses: !filters.excludeSharedExpenses,
    assumptions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const simScenario: Scenario = {
    id: 'sim_v2',
    name: 'Cenário Simulado V2',
    basePeriod: [],
    projectionStartDate: '2025-01',
    projectionEndDate: '2026-12',
    mode: 'historical_what_if',
    includeAllocatedExpenses: !filters.excludeSharedExpenses,
    assumptions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const baseResult = DreSimulatorEngine.runSimulation(rawData, metadata, estrutura, filters, baseScenario);
  const simResult = DreSimulatorEngine.runSimulation(rawData, metadata, estrutura, filters, simScenario);

  // 3. Calcular Indicadores Puramente em Memória
  const fixedCostsReal = (baseResult.kpis.totalDespesas || 0) + (baseResult.kpis.totalCustos * 0.4);
  const varRatioReal = baseResult.kpis.receitaOperacional > 0 ? (baseResult.kpis.totalCustos * 0.6) / baseResult.kpis.receitaOperacional : 0.4;
  const breakEvenPointReal = calculateBreakEvenPoint(fixedCostsReal, varRatioReal);

  const fixedCostsSim = (simResult.kpis.totalDespesas || 0) + (simResult.kpis.totalCustos * 0.4);
  const varRatioSim = simResult.kpis.receitaOperacional > 0 ? (simResult.kpis.totalCustos * 0.6) / simResult.kpis.receitaOperacional : 0.4;
  const breakEvenPointSimulated = calculateBreakEvenPoint(fixedCostsSim, varRatioSim);

  // Runway
  const monthlyFcl: Record<string, number> = {};
  simResult.validColumns.forEach(col => {
    monthlyFcl[col] = simResult.mensal['Fluxo de Caixa Livre FCL']?.[col] || simResult.mensal['Lucro antes do FCL']?.[col] || 0;
  });
  const runway = calculateCashRunway(params.initialCash || 500000, monthlyFcl, simResult.validColumns);

  // EBITDA Margins
  const ebitdaMarginReal = calculateEbitdaMargin(baseResult.kpis.resultado, baseResult.kpis.receitaOperacional);
  const ebitdaMarginSimulated = calculateEbitdaMargin(simResult.kpis.resultado, simResult.kpis.receitaOperacional);

  // Payback
  const severancePaybackMonths = calculateSeverancePayback(params.layoffsSeveranceCost, params.layoffsMonthlySavings);

  return {
    baseResult,
    simResult,
    assumptions,
    metrics: {
      breakEvenPointReal,
      breakEvenPointSimulated,
      cashRunwayMonths: runway.runwayMonths,
      zeroCashMonth: runway.zeroCashMonth,
      isRunwaySustainable: runway.isSustainable,
      ebitdaMarginReal,
      ebitdaMarginSimulated,
      severancePaybackMonths
    }
  };
}
