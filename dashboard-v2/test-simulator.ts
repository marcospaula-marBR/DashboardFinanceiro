import { DreRow, DreMetadata, DreFilters, DreStructureItem } from './src/types/dre';
import { Scenario, ScenarioAssumption } from './src/types/dre-simulator.types';
import { DreSimulatorEngine } from './src/services/dre-simulator.engine';
import { DEFAULT_DRE_ESTRUTURA } from './src/services/dre.service';
import { colToIso, isoToCol } from './src/lib/date-utils';

// ── MOCK DATASETUP ──────────────────────────────────────────────────────────
const mockMetadata: DreMetadata = {
  empresas: ['Empresa A'],
  departamentos: ['Seduc', 'Cmsp'],
  contasDre: ['Receita Bruta de Vendas', 'Credenciado Operacional', 'Despesas Administrativas'],
  projetos: ['Sem Projeto'],
  categorias: ['Sem Categoria'],
  periodos: ['Jan/26', 'Fev/26', 'Mar/26', 'Abr/26', 'Mai/26', 'Jun/26'],
  mapaMeses: {
    'Jan/26': 'Jan',
    'Fev/26': 'Fev',
    'Mar/26': 'Mar',
    'Abr/26': 'Abr',
    'Mai/26': 'Mai',
    'Jun/26': 'Jun'
  }
};

const mockRawData: DreRow[] = [
  // Seduc: Receitas = 100k, Custos = 40k, Despesas = 20k
  {
    Empresa: 'Empresa A',
    Departamento: 'Seduc',
    ContaDRE: 'Receita Bruta de Vendas',
    Projeto: 'Sem Projeto',
    Categoria: 'Sem Categoria',
    'Jan/26': 100000, 'Fev/26': 100000, 'Mar/26': 100000, 'Abr/26': 100000, 'Mai/26': 100000, 'Jun/26': 100000
  },
  {
    Empresa: 'Empresa A',
    Departamento: 'Seduc',
    ContaDRE: 'Credenciado Operacional',
    Projeto: 'Sem Projeto',
    Categoria: 'Credenciado Operacional',
    'Jan/26': 40000, 'Fev/26': 40000, 'Mar/26': 40000, 'Abr/26': 40000, 'Mai/26': 40000, 'Jun/26': 40000
  },
  {
    Empresa: 'Empresa A',
    Departamento: 'Seduc',
    ContaDRE: 'Despesas Administrativas',
    Projeto: 'Sem Projeto',
    Categoria: 'Despesas Administrativas',
    'Jan/26': 20000, 'Fev/26': 20000, 'Mar/26': 20000, 'Abr/26': 20000, 'Mai/26': 20000, 'Jun/26': 20000
  },
  // Cmsp: Receitas = 50k, Custos = 10k, Despesas = 5k
  {
    Empresa: 'Empresa A',
    Departamento: 'Cmsp',
    ContaDRE: 'Receita Bruta de Vendas',
    Projeto: 'Sem Projeto',
    Categoria: 'Sem Categoria',
    'Jan/26': 50000, 'Fev/26': 50000, 'Mar/26': 50000, 'Abr/26': 50000, 'Mai/26': 50000, 'Jun/26': 50000
  },
  {
    Empresa: 'Empresa A',
    Departamento: 'Cmsp',
    ContaDRE: 'Credenciado Operacional',
    Projeto: 'Sem Projeto',
    Categoria: 'Credenciado Operacional',
    'Jan/26': 10000, 'Fev/26': 10000, 'Mar/26': 10000, 'Abr/26': 10000, 'Mai/26': 10000, 'Jun/26': 10000
  },
  {
    Empresa: 'Empresa A',
    Departamento: 'Cmsp',
    ContaDRE: 'Despesas Administrativas',
    Projeto: 'Sem Projeto',
    Categoria: 'Despesas Administrativas',
    'Jan/26': 5000, 'Fev/26': 5000, 'Mar/26': 5000, 'Abr/26': 5000, 'Mai/26': 5000, 'Jun/26': 5000
  }
];

const defaultFilters: DreFilters = {
  empresas: [], periodos: [], departamentos: [], contasDre: [], projetos: [], categorias: [], excludeSharedExpenses: false
};

const baseScenario: Scenario = {
  id: 'base',
  name: 'Cenário Base',
  basePeriod: ['Jan/26', 'Fev/26', 'Mar/26', 'Abr/26', 'Mai/26', 'Jun/26'],
  projectionStartDate: '2026-07',
  projectionEndDate: '2026-12',
  mode: 'future_projection',
  includeAllocatedExpenses: true,
  assumptions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// ── TEST RUNNER ──────────────────────────────────────────────────────────────
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('=== INICIANDO SUÍTE DE TESTES DO SIMULADOR DRE ===\n');

  // Teste 1: Redução de receita percentual
  {
    const scenario: Scenario = {
      ...baseScenario,
      mode: 'historical_what_if',
      assumptions: [
        {
          id: 'asm_1',
          type: 'revenue_reduction',
          targetType: 'account_group',
          targetIds: ['receita'],
          amountType: 'percentage',
          value: -15,
          startDate: '2026-01',
          endDate: '2026-06',
          recurrence: 'monthly'
        }
      ]
    };
    const res = DreSimulatorEngine.runSimulation(mockRawData, mockMetadata, DEFAULT_DRE_ESTRUTURA, defaultFilters, scenario);
    // Base: Receita = 150k/mês * 6 = 900k. Simulado: -15% = 127.5k/mês * 6 = 765k.
    assert(res.kpis.receitaOperacional === 765000, 'Teste 1: Receita total deve ser 765k (-15%)');
  }

  // Teste 2: Redução de receita absoluta
  {
    const scenario: Scenario = {
      ...baseScenario,
      mode: 'historical_what_if',
      assumptions: [
        {
          id: 'asm_2',
          type: 'revenue_reduction',
          targetType: 'account',
          targetIds: ['Receita Bruta de Vendas'],
          amountType: 'absolute_value',
          value: 20000, // Subtrai 20k no total das linhas de Receita Bruta (rateado: 10k cada)
          startDate: '2026-01',
          endDate: '2026-06',
          recurrence: 'monthly'
        }
      ]
    };
    const res = DreSimulatorEngine.runSimulation(mockRawData, mockMetadata, DEFAULT_DRE_ESTRUTURA, defaultFilters, scenario);
    // Para Seduc (100k -> 90k) e Cmsp (50k -> 40k) = 130k/mês. Total = 780k.
    assert(res.kpis.receitaOperacional === 780000, 'Teste 2: Receita total deve ser 780k (redução absoluta de 20k rateada)');
  }

  // Teste 3: Perda de contrato com data futura
  {
    const scenario: Scenario = {
      ...baseScenario,
      mode: 'future_projection',
      projectionEndDate: '2026-12',
      assumptions: [
        {
          id: 'asm_3',
          type: 'contract_loss',
          targetType: 'department',
          targetIds: ['Seduc'],
          amountType: 'percentage',
          value: -100,
          startDate: '2026-09', // Rescisão em Setembro/26
          endDate: '2026-12',
          recurrence: 'monthly'
        }
      ]
    };
    const res = DreSimulatorEngine.runSimulation(mockRawData, mockMetadata, DEFAULT_DRE_ESTRUTURA, defaultFilters, scenario);
    // Em Jul/Ago: Seduc = 100k, Cmsp = 50k (Total = 150k/mês)
    // Em Set/Out/Nov/Dez: Seduc = 0k, Cmsp = 50k (Total = 50k/mês)
    // Histórico Jan-Jun: 150k/mês * 6 = 900k
    // Projeção Jul-Dez: 150k * 2 + 50k * 4 = 500k
    // Receita Total = 900k + 500k = 1.400.000
    assert(res.kpis.receitaOperacional === 1400000, 'Teste 3: Perda do contrato Seduc a partir de Set/26');
  }

  // Teste 4: Reposição linear de receita
  {
    const scenario: Scenario = {
      ...baseScenario,
      mode: 'future_projection',
      projectionEndDate: '2026-12',
      assumptions: [
        {
          id: 'asm_loss',
          type: 'contract_loss',
          targetType: 'department',
          targetIds: ['Seduc'],
          amountType: 'percentage',
          value: -100,
          startDate: '2026-07',
          endDate: '2026-12',
          recurrence: 'monthly'
        },
        {
          id: 'asm_rep',
          type: 'revenue_replacement',
          targetType: 'all',
          targetIds: [],
          amountType: 'absolute_value',
          value: 100000, // Meta de repor 100k/mês até Dez
          startDate: '2026-07',
          endDate: '2026-12',
          recurrence: 'linear_ramp' // 6 meses: meta cresce 16.66k/mês
        }
      ]
    };
    const res = DreSimulatorEngine.runSimulation(mockRawData, mockMetadata, DEFAULT_DRE_ESTRUTURA, defaultFilters, scenario);
    // Histórico: 900k
    // Projeção Jul-Dez: baseline é 150k/mês. Seduc perdido = -100k/mês. Sobra Cmsp = 50k/mês.
    // Reposição linear (100k em 6 meses => 16.66k/mês acumulado):
    // Jul: 50k + 16.66k = 66.66k
    // Ago: 50k + 33.33k = 83.33k
    // Set: 50k + 50.00k = 100.00k
    // Out: 50k + 66.66k = 116.66k
    // Nov: 50k + 83.33k = 133.33k
    // Dez: 50k + 100.00k = 150.00k (Totalmente reposto!)
    // Total proj: 50k * 6 + (16.66k + 33.33k + 50k + 66.66k + 83.33k + 100k) = 300k + 350k = 650k.
    // Receita Total = 900k + 650k = 1.550.000
    const diff = Math.abs(res.kpis.receitaOperacional - 1550000);
    assert(diff < 500, 'Teste 4: Reposição linear de receita deve neutralizar o impacto gradualmente');
  }

  // Teste 5: Aumento de despesa
  {
    const scenario: Scenario = {
      ...baseScenario,
      mode: 'historical_what_if',
      assumptions: [
        {
          id: 'asm_5',
          type: 'expense_increase',
          targetType: 'account_group',
          targetIds: ['despesas_rateadas'],
          amountType: 'percentage',
          value: 10, // +10% nas despesas rateadas
          startDate: '2026-01',
          endDate: '2026-06',
          recurrence: 'monthly'
        }
      ]
    };
    const res = DreSimulatorEngine.runSimulation(mockRawData, mockMetadata, DEFAULT_DRE_ESTRUTURA, defaultFilters, scenario);
    // Base Despesas: Seduc (20k) + Cmsp (5k) = 25k/mês * 6 = 150k. Simulado: +10% = 165k.
    assert(res.kpis.totalDespesas === 165000, 'Teste 5: Despesas rateadas simuladas devem ser 165k (+10%)');
  }

  // Teste 6: Corte de despesa (custos)
  {
    const scenario: Scenario = {
      ...baseScenario,
      mode: 'historical_what_if',
      assumptions: [
        {
          id: 'asm_6',
          type: 'expense_reduction', // ou costs_cut
          targetType: 'account_group',
          targetIds: ['custos_operacionais'],
          amountType: 'percentage',
          value: -20, // -20% nos custos
          startDate: '2026-01',
          endDate: '2026-06',
          recurrence: 'monthly'
        }
      ]
    };
    const res = DreSimulatorEngine.runSimulation(mockRawData, mockMetadata, DEFAULT_DRE_ESTRUTURA, defaultFilters, scenario);
    // Base Custos: Seduc (40k) + Cmsp (10k) = 50k/mês * 6 = 300k. Simulado: -20% = 240k.
    assert(res.kpis.totalCustos === 240000, 'Teste 6: Custos simulados devem ser 240k (-20%)');
  }

  // Teste 7: Excluir despesas rateadas
  {
    const scenario: Scenario = {
      ...baseScenario,
      mode: 'historical_what_if',
      includeAllocatedExpenses: false, // Desliga despesas rateadas administrativamente
      assumptions: []
    };
    const res = DreSimulatorEngine.runSimulation(mockRawData, mockMetadata, DEFAULT_DRE_ESTRUTURA, defaultFilters, scenario);
    assert(res.kpis.totalDespesas === 0, 'Teste 7: Despesas devem ser 0 ao desmarcar includeAllocatedExpenses');
  }

  // Teste 8: Cenário retrospectivo sem data futura
  {
    const scenario: Scenario = {
      ...baseScenario,
      mode: 'historical_what_if',
      assumptions: [
        {
          id: 'asm_8',
          type: 'revenue_increase',
          targetType: 'all',
          targetIds: [],
          amountType: 'percentage',
          value: 10,
          startDate: '2026-01',
          endDate: '2026-06',
          recurrence: 'monthly'
        }
      ]
    };
    const res = DreSimulatorEngine.runSimulation(mockRawData, mockMetadata, DEFAULT_DRE_ESTRUTURA, defaultFilters, scenario);
    // Base: 900k. Proj: 900k * 1.1 = 990k.
    console.log('DEBUG Teste 8 - Receita Operacional:', res.kpis.receitaOperacional);
    console.log('DEBUG Teste 8 - Colunas:', res.validColumns);
    assert(Math.round(res.kpis.receitaOperacional) === 990000, 'Teste 8: Simulação retrospectiva deve alterar apenas meses históricos');
    assert(res.validColumns.length === 6, 'Teste 8: Não deve adicionar novos meses de projeção');
  }

  // Teste 9: Cenário projetado com data futura
  {
    const scenario: Scenario = {
      ...baseScenario,
      mode: 'future_projection',
      projectionStartDate: '2026-07',
      projectionEndDate: '2026-08', // Projeta Julho e Agosto (2 meses)
      assumptions: []
    };
    const res = DreSimulatorEngine.runSimulation(mockRawData, mockMetadata, DEFAULT_DRE_ESTRUTURA, defaultFilters, scenario);
    // Histórico: 6 meses (900k)
    // Projeção: 2 meses com médias históricas (150k/mês * 2 = 300k)
    // Total: 1.200.000
    assert(res.validColumns.length === 8, 'Teste 9: Deve expandir colunas para 8 meses (6 hist + 2 proj)');
    assert(res.kpis.receitaOperacional === 1200000, 'Teste 9: Receita acumulada deve refletir médias projetadas');
  }

  // Teste 10: Comparação entre dois cenários
  {
    const scenarioOpt: Scenario = {
      ...baseScenario,
      mode: 'historical_what_if',
      assumptions: [{ id: 'opt', type: 'revenue_increase', targetType: 'all', targetIds: [], amountType: 'percentage', value: 10, startDate: '2026-01', endDate: '2026-06', recurrence: 'monthly' }]
    };
    const scenarioPes: Scenario = {
      ...baseScenario,
      mode: 'historical_what_if',
      assumptions: [{ id: 'pes', type: 'revenue_reduction', targetType: 'all', targetIds: [], amountType: 'percentage', value: -10, startDate: '2026-01', endDate: '2026-06', recurrence: 'monthly' }]
    };

    const resOpt = DreSimulatorEngine.runSimulation(mockRawData, mockMetadata, DEFAULT_DRE_ESTRUTURA, defaultFilters, scenarioOpt);
    const resPes = DreSimulatorEngine.runSimulation(mockRawData, mockMetadata, DEFAULT_DRE_ESTRUTURA, defaultFilters, scenarioPes);

    assert(Math.round(resOpt.kpis.receitaOperacional) === 990000, 'Teste 10: Receita Otimista deve ser 990k');
    assert(Math.round(resPes.kpis.receitaOperacional) === 810000, 'Teste 10: Receita Pessimista deve ser 810k');
  }

  console.log('\n⭐ TODOS OS 10 TESTES PASSARAM COM SUCESSO! ⭐');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NA SUÍTE DE TESTES:', err);
  process.exit(1);
});
