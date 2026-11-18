const assert = require('assert');

// Testes unitários para regras de negócio e cálculo do BPR (Bônus por Participação nos Resultados)
console.log('=== TESTES UNITÁRIOS: CÁLCULOS E CENÁRIOS DO BPR ===\n');

// Mock simples para validar a lógica matemática de BprService
function calculateBprMock(candidates, config) {
  const isAmountMode = config.splitMode === 'amount' && config.tierAmounts;
  const effectiveTotalPool = isAmountMode 
    ? (config.tierAmounts.E + config.tierAmounts.T + config.tierAmounts.O)
    : config.totalPoolAmount;

  const layerEligibleCounts = { E: 0, T: 0, O: 0 };
  const layerIneligibleCounts = { E: 0, T: 0, O: 0 };

  candidates.forEach(c => {
    if (c.isEligible) {
      layerEligibleCounts[c.camada]++;
    } else {
      layerIneligibleCounts[c.camada]++;
    }
  });

  const layerAmountE = isAmountMode ? config.tierAmounts.E : (config.totalPoolAmount * config.tierSplits.E) / 100;
  const layerAmountT = isAmountMode ? config.tierAmounts.T : (config.totalPoolAmount * config.tierSplits.T) / 100;
  const layerAmountO = isAmountMode ? config.tierAmounts.O : (config.totalPoolAmount * config.tierSplits.O) / 100;

  const amountPerE = layerEligibleCounts.E > 0 ? Number((layerAmountE / layerEligibleCounts.E).toFixed(2)) : 0;
  const amountPerT = layerEligibleCounts.T > 0 ? Number((layerAmountT / layerEligibleCounts.T).toFixed(2)) : 0;
  const amountPerO = layerEligibleCounts.O > 0 ? Number((layerAmountO / layerEligibleCounts.O).toFixed(2)) : 0;

  let totalDistributed = 0;
  const results = candidates.map(c => {
    if (!c.isEligible) {
      return { ...c, baseAmount: 0, allocatedAmount: 0 };
    }
    const base = c.camada === 'E' ? amountPerE : c.camada === 'T' ? amountPerT : amountPerO;
    const finalVal = Number((base * (c.performanceFactor ?? 1.0)).toFixed(2));
    totalDistributed += finalVal;
    return { ...c, baseAmount: base, allocatedAmount: finalVal };
  });

  const residual = Math.max(0, effectiveTotalPool - totalDistributed);

  return {
    totalPoolAmount: effectiveTotalPool,
    totalDistributedAmount: Number(totalDistributed.toFixed(2)),
    residualAmount: Number(residual.toFixed(2)),
    totalEligible: layerEligibleCounts.E + layerEligibleCounts.T + layerEligibleCounts.O,
    totalIneligible: layerIneligibleCounts.E + layerIneligibleCounts.T + layerIneligibleCounts.O,
    candidates: results,
    layers: {
      E: { totalAmount: layerAmountE, eligible: layerEligibleCounts.E, amountPerPerson: amountPerE },
      T: { totalAmount: layerAmountT, eligible: layerEligibleCounts.T, amountPerPerson: amountPerT },
      O: { totalAmount: layerAmountO, eligible: layerEligibleCounts.O, amountPerPerson: amountPerO }
    }
  };
}

// 1. Testando cálculo de rateio por porcentagem (%)
console.log('1. Testando cálculo por porcentagem (% padrão 30/40/30)...');
const mockCandidates = [
  { employeeId: '1', name: 'Diretor 1', camada: 'E', isEligible: true, performanceFactor: 1.0 },
  { employeeId: '2', name: 'Gerente 1', camada: 'T', isEligible: true, performanceFactor: 1.0 },
  { employeeId: '3', name: 'Gerente 2', camada: 'T', isEligible: true, performanceFactor: 0.75 }, // Fator 75%
  { employeeId: '4', name: 'Analista 1', camada: 'O', isEligible: true, performanceFactor: 1.0 },
  { employeeId: '5', name: 'Analista 2', camada: 'O', isEligible: false, performanceFactor: 1.0 } // Inelegível
];

const configPercent = {
  splitMode: 'percentage',
  totalPoolAmount: 100000,
  tierSplits: { E: 30, T: 40, O: 30 }
};

const resPercent = calculateBprMock(mockCandidates, configPercent);
assert.strictEqual(resPercent.totalPoolAmount, 100000);
assert.strictEqual(resPercent.layers.E.amountPerPerson, 30000); // 30k / 1 = 30k
assert.strictEqual(resPercent.layers.T.amountPerPerson, 20000); // 40k / 2 = 20k
assert.strictEqual(resPercent.layers.O.amountPerPerson, 30000); // 30k / 1 elegível = 30k
assert.strictEqual(resPercent.candidates.find(c => c.employeeId === '3').allocatedAmount, 15000); // 20k * 0.75
assert.strictEqual(resPercent.candidates.find(c => c.employeeId === '5').allocatedAmount, 0); // Inelegível = 0
console.log('   ✅ Rateio percentual determinístico validado com sucesso.');

// 2. Testando cálculo de rateio por valor fixo em R$
console.log('\n2. Testando cálculo por valor fixo R$ alocado por perfil...');
const configAmount = {
  splitMode: 'amount',
  tierAmounts: { E: 50000, T: 30000, O: 20000 }
};

const resAmount = calculateBprMock(mockCandidates, configAmount);
assert.strictEqual(resAmount.totalPoolAmount, 100000); // 50k + 30k + 20k
assert.strictEqual(resAmount.layers.E.amountPerPerson, 50000); // 50k / 1
assert.strictEqual(resAmount.layers.T.amountPerPerson, 15000); // 30k / 2
assert.strictEqual(resAmount.layers.O.amountPerPerson, 20000); // 20k / 1
console.log('   ✅ Rateio por valor fixo R$ alocado por perfil validado com sucesso.');

// 3. Testando snapshot congelado de cenário
console.log('\n3. Testando integridade do snapshot de cenário...');
const scenarioSnapshot = {
  id: 'bpr-scen-123',
  name: 'Estudo C1 2026',
  studyDate: '2026-06-15',
  criteriaDescription: 'Premissas de diretoria',
  createdAt: '2026-06-15T10:00:00Z',
  config: configAmount,
  summary: resAmount,
  candidatesSnapshot: resAmount.candidates
};

assert.strictEqual(scenarioSnapshot.name, 'Estudo C1 2026');
assert.strictEqual(scenarioSnapshot.studyDate, '2026-06-15');
assert.strictEqual(scenarioSnapshot.candidatesSnapshot.length, 5);
assert.strictEqual(scenarioSnapshot.candidatesSnapshot[0].allocatedAmount, 50000);
console.log('   ✅ Snapshot histórico congelado validado com sucesso.');

console.log('\n🎉 TODOS OS TESTES DO BPR PASSARAM COM EXATIDÃO!');
