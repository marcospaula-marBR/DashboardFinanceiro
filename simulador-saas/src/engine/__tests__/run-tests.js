// Motor de testes em JavaScript puro (compatível com qualquer versão do Node.js)

const mockPmeBase = {
  companyName: 'Empresa Exemplo PME Ltda',
  cnpj: '12.345.678/0001-90',
  currency: 'BRL',
  currentCashBalance: 500000,
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
      accountName: 'Impostos sobre Vendas',
      group: 'deducoes_impostos',
      values: { '2026-01': 100000, '2026-02': 100000, '2026-03': 100000, '2026-04': 100000, '2026-05': 100000, '2026-06': 100000 }
    },
    {
      accountId: 'acc_cpv',
      accountName: 'Custo de Serviços Prestados',
      group: 'custos_variaveis',
      values: { '2026-01': 270000, '2026-02': 270000, '2026-03': 270000, '2026-04': 270000, '2026-05': 270000, '2026-06': 270000 }
    },
    {
      accountId: 'acc_desp_fixas',
      accountName: 'Despesas Fixas',
      group: 'despesas_fixas',
      values: { '2026-01': 150000, '2026-02': 150000, '2026-03': 150000, '2026-04': 150000, '2026-05': 150000, '2026-06': 150000 }
    },
    {
      accountId: 'acc_folha',
      accountName: 'Pessoal + Encargos',
      group: 'pessoal_encargos',
      values: { '2026-01': 300000, '2026-02': 300000, '2026-03': 300000, '2026-04': 300000, '2026-05': 300000, '2026-06': 300000 }
    }
  ]
};

function calculateKPIs(rows, periods, currentCashBalance) {
  let receitaBruta = 0, deducoesImpostos = 0, custosVariaveis = 0, despesasFixas = 0, pessoalEncargos = 0;

  rows.forEach(row => {
    let rowSum = 0;
    periods.forEach(p => rowSum += (row.values[p] || 0));
    if (row.group === 'receita_bruta') receitaBruta += rowSum;
    if (row.group === 'deducoes_impostos') deducoesImpostos += rowSum;
    if (row.group === 'custos_variaveis') custosVariaveis += rowSum;
    if (row.group === 'despesas_fixas') despesasFixas += rowSum;
    if (row.group === 'pessoal_encargos') pessoalEncargos += rowSum;
  });

  const receitaLiquida = receitaBruta - deducoesImpostos;
  const margemContribuicao = receitaLiquida - custosVariaveis;
  const totalDespesasFixas = despesasFixas + pessoalEncargos;
  const ebitda = margemContribuicao - totalDespesasFixas;
  const mcRate = receitaBruta > 0 ? margemContribuicao / receitaBruta : 0;
  const breakEvenReceitaBruta = mcRate > 0 ? totalDespesasFixas / mcRate : 0;
  
  return { receitaBruta, receitaLiquida, margemContribuicao, despesasFixas, pessoalEncargos, ebitda, breakEvenReceitaBruta };
}

function runSimulation(baseData, scenario) {
  const periods = baseData.periods;
  const rows = JSON.parse(JSON.stringify(baseData.rows));

  periods.forEach((periodIso, monthIndex) => {
    scenario.assumptions.forEach(asm => {
      if (!asm.enabled) return;
      rows.forEach(row => {
        if (asm.targetGroup && asm.targetGroup !== 'all' && row.group !== asm.targetGroup) return;
        const currentVal = row.values[periodIso] || 0;
        let delta = 0;
        if (asm.type === 'revenue_increase') {
          delta = currentVal * (asm.value / 100);
        } else if (asm.type === 'hiring_personnel') {
          delta = (asm.hiringCount || 1) * (asm.salaryBase || 0) * (1 + ((asm.taxChargesPct || 70) / 100));
        } else if (asm.type === 'expense_reduction') {
          delta = -Math.abs(currentVal * (asm.value / 100));
        }
        row.values[periodIso] = currentVal + delta;
      });
    });
  });

  const baselineKPIs = calculateKPIs(baseData.rows, periods, baseData.currentCashBalance);
  const simulatedKPIs = calculateKPIs(rows, periods, baseData.currentCashBalance);
  return { baselineKPIs, simulatedKPIs };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('\n=== SUÍTE DE TESTES AUTOMATIZADOS: MOTOR STANDALONE (JS) ===\n');

// Teste 1: Aumento de Receita (+10%)
{
  const sc = { assumptions: [{ enabled: true, type: 'revenue_increase', targetGroup: 'receita_bruta', value: 10 }] };
  const res = runSimulation(mockPmeBase, sc);
  assert(res.simulatedKPIs.receitaBruta === 6600000, 'Teste 1: Receita Bruta simulada deve ser R$ 6.600.000');
}

// Teste 2: Contratação de 2 funcionários CLT (Salário R$ 10k + Encargos 70%)
{
  const sc = { assumptions: [{ enabled: true, type: 'hiring_personnel', targetGroup: 'pessoal_encargos', hiringCount: 2, salaryBase: 10000, taxChargesPct: 70 }] };
  const res = runSimulation(mockPmeBase, sc);
  assert(res.simulatedKPIs.pessoalEncargos === 2004000, 'Teste 2: Pessoal + Encargos simulado deve ser R$ 2.004.000');
}

// Teste 3: Corte de Despesas Fixas em 15%
{
  const sc = { assumptions: [{ enabled: true, type: 'expense_reduction', targetGroup: 'despesas_fixas', value: 15 }] };
  const res = runSimulation(mockPmeBase, sc);
  assert(res.simulatedKPIs.despesasFixas === 765000, 'Teste 3: Despesas Fixas simuladas devem ser R$ 765.000');
}

console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!\n');
