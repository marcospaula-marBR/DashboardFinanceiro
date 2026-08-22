import { CompanyFinancialBase } from '../../types/financial.types';
import { SimulationScenario } from '../../types/simulator.types';
import { StandaloneSimulatorEngine } from '../simulator.engine';

// Mock Financial Base para PME com faturamento anual ~R$ 12M (R$ 1M/mês)
const mockPmeBase: CompanyFinancialBase = {
  companyName: 'Empresa Exemplo PME Ltda',
  cnpj: '12.345.678/0001-90',
  currency: 'BRL',
  currentCashBalance: 500000, // R$ 500k em caixa
  periods: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'],
  rows: [
    {
      accountId: 'acc_rec_vendas',
      accountName: 'Receita de Vendas e Serviços',
      group: 'receita_bruta',
      values: { '2026-01': 1000000, '2026-02': 1000000, '2026-03': 1000000, '2026-04': 1000000, '2026-05': 1000000, '2026-06': 1000000 }
    },
    {
      accountId: 'acc_imp_simples',
      accountName: 'Impostos sobre Vendas (Simples Nacional 10%)',
      group: 'deducoes_impostos',
      values: { '2026-01': 100000, '2026-02': 100000, '2026-03': 100000, '2026-04': 100000, '2026-05': 100000, '2026-06': 100000 }
    },
    {
      accountId: 'acc_cpv',
      accountName: 'Custo de Produtos e Serviços Prestados (30%)',
      group: 'custos_variaveis',
      values: { '2026-01': 270000, '2026-02': 270000, '2026-03': 270000, '2026-04': 270000, '2026-05': 270000, '2026-06': 270000 }
    },
    {
      accountId: 'acc_desp_fixas',
      accountName: 'Aluguel, Software, Utilidades e Mkt',
      group: 'despesas_fixas',
      values: { '2026-01': 150000, '2026-02': 150000, '2026-03': 150000, '2026-04': 150000, '2026-05': 150000, '2026-06': 150000 }
    },
    {
      accountId: 'acc_folha',
      accountName: 'Folha de Pagamento + Encargos',
      group: 'pessoal_encargos',
      values: { '2026-01': 300000, '2026-02': 300000, '2026-03': 300000, '2026-04': 300000, '2026-05': 300000, '2026-06': 300000 }
    }
  ]
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

function runEngineTests() {
  console.log('\n=== SUÍTE DE TESTES AUTOMATIZADOS: MOTOR STANDALONE ===\n');

  // Teste 1: Aumento de Receita (+10%)
  {
    const scenario: SimulationScenario = {
      id: 'sc_1',
      name: 'Aumento de 10% nas vendas',
      mode: 'future_projection',
      basePeriod: mockPmeBase.periods,
      projectionStartDate: '2026-01',
      projectionEndDate: '2026-06',
      assumptions: [
        {
          id: 'asm_1',
          enabled: true,
          name: 'Crescimento Comercial',
          type: 'revenue_increase',
          targetGroup: 'receita_bruta',
          amountType: 'percentage',
          value: 10,
          startDate: '2026-01',
          endDate: '2026-06',
          recurrence: 'monthly'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const res = StandaloneSimulatorEngine.runSimulation(mockPmeBase, scenario);
    // Base: R$ 6M receita. Simulado (+10%): R$ 6.6M receita.
    assert(res.simulatedKPIs.receitaBruta === 6600000, 'Teste 1: Receita Bruta simulada deve ser R$ 6.600.000');
    assert(res.variance.receitaBrutaDiff === 600000, 'Teste 1: Ganho de Receita Bruta deve ser R$ 600.000');
  }

  // Teste 2: Contratação de 2 funcionários CLT (Salário R$ 10k + Encargos 70%)
  {
    const scenario: SimulationScenario = {
      id: 'sc_2',
      name: 'Novas Contratações TI',
      mode: 'future_projection',
      basePeriod: mockPmeBase.periods,
      projectionStartDate: '2026-01',
      projectionEndDate: '2026-06',
      assumptions: [
        {
          id: 'asm_2',
          enabled: true,
          name: 'Contratação Devs',
          type: 'hiring_personnel',
          targetGroup: 'pessoal_encargos',
          amountType: 'monthly_value',
          value: 10000,
          hiringCount: 2,
          salaryBase: 10000,
          taxChargesPct: 70,
          startDate: '2026-01',
          endDate: '2026-06',
          recurrence: 'monthly'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const res = StandaloneSimulatorEngine.runSimulation(mockPmeBase, scenario);
    // Custo adicional por mês: 2 * 10.000 * 1.70 = R$ 34.000/mês. Em 6 meses: R$ 204.000.
    // Base pessoal: 300k * 6 = 1.8M. Simulado: 1.8M + 204k = 2.004M.
    assert(res.simulatedKPIs.pessoalEncargos === 2004000, 'Teste 2: Pessoal + Encargos simulado deve ser R$ 2.004.000');
  }

  // Teste 3: Corte de Despesas Fixas em 15%
  {
    const scenario: SimulationScenario = {
      id: 'sc_3',
      name: 'Corte de Despesas Fixas',
      mode: 'future_projection',
      basePeriod: mockPmeBase.periods,
      projectionStartDate: '2026-01',
      projectionEndDate: '2026-06',
      assumptions: [
        {
          id: 'asm_3',
          enabled: true,
          name: 'Renegociação de Software e Aluguel',
          type: 'expense_reduction',
          targetGroup: 'despesas_fixas',
          amountType: 'percentage',
          value: 15,
          startDate: '2026-01',
          endDate: '2026-06',
          recurrence: 'monthly'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const res = StandaloneSimulatorEngine.runSimulation(mockPmeBase, scenario);
    // Base Despesas Fixas: 150k * 6 = 900k. Corte de 15%: -135k. Simulado: 765k.
    assert(res.simulatedKPIs.despesasFixas === 765000, 'Teste 3: Despesas Fixas simuladas devem ser R$ 765.000');
  }

  console.log('\n🎉 TODOS OS TESTES DO MOTOR STANDALONE PASSARAM COM SUCESSO!\n');
}

runEngineTests();
