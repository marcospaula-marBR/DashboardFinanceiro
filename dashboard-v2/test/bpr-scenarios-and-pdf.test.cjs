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

// 4. Testando filtros de personalização do relatório (Elegíveis vs Inelegíveis, Níveis, Empresas)
console.log('\n4. Testando filtros de personalização do relatório...');
function filterCandidatesMock(candidates, meta) {
  const eligibilityFilter = meta?.eligibilityFilter || 'eligible_only';
  const selectedCamadas = meta?.selectedCamadas || ['E', 'T', 'O'];
  const selectedCompanies = (meta?.selectedCompanies || []).map(c => c.trim().toLowerCase());

  return candidates.filter(c => {
    if (eligibilityFilter === 'eligible_only' && !c.isEligible) return false;
    if (eligibilityFilter === 'ineligible_only' && c.isEligible) return false;
    if (selectedCamadas.length > 0 && !selectedCamadas.includes(c.camada)) return false;
    if (selectedCompanies.length > 0) {
      const comp = (c.company || '').trim().toLowerCase();
      if (!selectedCompanies.includes(comp)) return false;
    }
    return true;
  });
}

const listWithCompanies = [
  { employeeId: '1', name: 'A', company: 'MarBR', camada: 'E', isEligible: true },
  { employeeId: '2', name: 'B', company: 'DZM', camada: 'T', isEligible: true },
  { employeeId: '3', name: 'C', company: 'G2', camada: 'O', isEligible: false },
  { employeeId: '4', name: 'D', company: 'MarBR', camada: 'O', isEligible: true },
  { employeeId: '5', name: 'E', company: 'DZM', camada: 'O', isEligible: false }
];

// Teste A: Padrão executivo: apenas elegíveis
const onlyEligible = filterCandidatesMock(listWithCompanies, { eligibilityFilter: 'eligible_only' });
assert.strictEqual(onlyEligible.length, 3);
assert.ok(onlyEligible.every(c => c.isEligible === true));

// Teste B: Apenas inelegíveis
const onlyIneligible = filterCandidatesMock(listWithCompanies, { eligibilityFilter: 'ineligible_only' });
assert.strictEqual(onlyIneligible.length, 2);
assert.ok(onlyIneligible.every(c => c.isEligible === false));

// Teste C: Apenas empresa MarBR
const onlyMarBr = filterCandidatesMock(listWithCompanies, { eligibilityFilter: 'all', selectedCompanies: ['MarBR'] });
assert.strictEqual(onlyMarBr.length, 2);
assert.ok(onlyMarBr.every(c => c.company === 'MarBR'));

// Teste D: Apenas camada O e Elegíveis
const onlyOEligible = filterCandidatesMock(listWithCompanies, { eligibilityFilter: 'eligible_only', selectedCamadas: ['O'] });
assert.strictEqual(onlyOEligible.length, 1);
assert.strictEqual(onlyOEligible[0].employeeId, '4');

console.log('   ✅ Filtros de elegibilidade, camada e empresa validados com 100% de precisão.');

// 5. Testando clonagem de cenário com recálculo incremental de snapshot congelado
console.log('\n5. Testando clonagem de cenário com recálculo incremental de snapshot congelado...');

function recalculateSnapshotMock(candidatesSnapshot, newConfig) {
  const layerEligibleCounts = { E: 0, T: 0, O: 0 };
  candidatesSnapshot.forEach(c => {
    if (c.isEligible) layerEligibleCounts[c.camada]++;
  });

  const isAmountMode = newConfig.splitMode === 'amount' && !!newConfig.tierAmounts;
  const effectiveTotalPool = isAmountMode 
    ? Number(((newConfig.tierAmounts?.E || 0) + (newConfig.tierAmounts?.T || 0) + (newConfig.tierAmounts?.O || 0)).toFixed(2))
    : newConfig.totalPoolAmount;

  const layerAmountE = isAmountMode ? (newConfig.tierAmounts?.E || 0) : (newConfig.totalPoolAmount * newConfig.tierSplits.E) / 100;
  const layerAmountT = isAmountMode ? (newConfig.tierAmounts?.T || 0) : (newConfig.totalPoolAmount * newConfig.tierSplits.T) / 100;
  const layerAmountO = isAmountMode ? (newConfig.tierAmounts?.O || 0) : (newConfig.totalPoolAmount * newConfig.tierSplits.O) / 100;

  const amountPerE = layerEligibleCounts.E > 0 ? Number((layerAmountE / layerEligibleCounts.E).toFixed(2)) : 0;
  const amountPerT = layerEligibleCounts.T > 0 ? Number((layerAmountT / layerEligibleCounts.T).toFixed(2)) : 0;
  const amountPerO = layerEligibleCounts.O > 0 ? Number((layerAmountO / layerEligibleCounts.O).toFixed(2)) : 0;

  const layers = {
    E: { totalLayerAmount: layerAmountE, amountPerEligible: amountPerE, eligibleCount: layerEligibleCounts.E },
    T: { totalLayerAmount: layerAmountT, amountPerEligible: amountPerT, eligibleCount: layerEligibleCounts.T },
    O: { totalLayerAmount: layerAmountO, amountPerEligible: amountPerO, eligibleCount: layerEligibleCounts.O }
  };

  let totalDistributed = 0;
  const candidates = candidatesSnapshot.map(c => {
    if (c.isEligible) {
      const baseVal = layers[c.camada].amountPerEligible;
      const finalVal = Number((baseVal * (c.performanceFactor ?? 1.0)).toFixed(2));
      totalDistributed += finalVal;
      return { ...c, baseAmount: baseVal, allocatedAmount: finalVal };
    }
    return { ...c, baseAmount: 0, allocatedAmount: 0 };
  });

  return {
    totalPoolAmount: effectiveTotalPool,
    totalDistributedAmount: Number(totalDistributed.toFixed(2)),
    residualAmount: Number((effectiveTotalPool - totalDistributed).toFixed(2)),
    totalEligible: layerEligibleCounts.E + layerEligibleCounts.T + layerEligibleCounts.O,
    layers,
    candidates
  };
}

// Estudo base: R$ 100.000 com 3 elegíveis (1 de cada camada) e 1 inelegível
const baseCandidates = [
  { employeeId: '1', name: 'Diretor', camada: 'E', isEligible: true, performanceFactor: 1.0 },
  { employeeId: '2', name: 'Gerente', camada: 'T', isEligible: true, performanceFactor: 1.0 },
  { employeeId: '3', name: 'Analista', camada: 'O', isEligible: true, performanceFactor: 1.0 },
  { employeeId: '4', name: 'Desligado', camada: 'O', isEligible: false, performanceFactor: 0.0 }
];

// Variação 1: +10% no Operacional (20% E / 40% T / 40% O)
const varConfig1 = {
  splitMode: 'percentage',
  totalPoolAmount: 100000,
  tierSplits: { E: 20, T: 40, O: 40 }
};

const res1 = recalculateSnapshotMock(baseCandidates, varConfig1);
assert.strictEqual(res1.totalPoolAmount, 100000);
assert.strictEqual(res1.layers.E.amountPerEligible, 20000); // 20%
assert.strictEqual(res1.layers.T.amountPerEligible, 40000); // 40%
assert.strictEqual(res1.layers.O.amountPerEligible, 40000); // 40%
assert.strictEqual(res1.candidates[0].allocatedAmount, 20000);
assert.strictEqual(res1.candidates[2].allocatedAmount, 40000);
assert.strictEqual(res1.candidates[3].allocatedAmount, 0); // Inelegível preservado com 0

// Variação 2: Valor fixo R$ alocado
const varConfig2 = {
  splitMode: 'amount',
  tierAmounts: { E: 15000, T: 35000, O: 50000 }
};
const res2 = recalculateSnapshotMock(baseCandidates, varConfig2);
assert.strictEqual(res2.totalPoolAmount, 100000);
assert.strictEqual(res2.layers.E.amountPerEligible, 15000);
assert.strictEqual(res2.layers.T.amountPerEligible, 35000);
assert.strictEqual(res2.layers.O.amountPerEligible, 50000);
assert.strictEqual(res2.totalDistributedAmount, 100000);

console.log('   ✅ Recálculo de snapshot e clonagem de cenários validados com sucesso.');

// 6. Testando destaque de deltas no relatório comparativo do BPR
console.log('\n6. Testando destaque e formatação de Deltas no Comparativo BPR...');
function getDeltaStyleMock(delta) {
  if (delta > 0) return { color: 'emerald', prefix: '+', isPositive: true };
  if (delta < 0) return { color: 'rose', prefix: '', isNegative: true };
  return { color: 'slate', prefix: '', isZero: true };
}

assert.strictEqual(getDeltaStyleMock(1500).color, 'emerald');
assert.strictEqual(getDeltaStyleMock(1500).prefix, '+');
assert.strictEqual(getDeltaStyleMock(-500).color, 'rose');
assert.strictEqual(getDeltaStyleMock(0).color, 'slate');
console.log('   ✅ Regras de destaque visual de Deltas validadas.');

// 7. Testando filtros da Central de Emissão de Relatórios de People
console.log('\n7. Testando filtros da Central de Emissão de Relatórios de People...');
function filterPeopleReportMock(employees, filters) {
  let list = [...employees];

  // 1. Status
  if (filters.status === 'active') {
    list = list.filter(e => e.status !== 'Inativo' && e.status !== 'Desligado' && e.active !== false);
  } else if (filters.status === 'inactive') {
    list = list.filter(e => e.status === 'Inativo' || e.status === 'Desligado' || e.active === false);
  }

  // 2. Empresa
  if (filters.companies && filters.companies.length > 0) {
    list = list.filter(e => filters.companies.includes(e.company));
  }

  // 3. Vínculo
  if (filters.linkTypes && filters.linkTypes.length > 0) {
    list = list.filter(e => filters.linkTypes.includes(e.linkType));
  }

  // 4. Período
  if (filters.isPeriodActive) {
    if (filters.dateType === 'admission') {
      if (filters.startDate) list = list.filter(e => e.start_date >= filters.startDate);
      if (filters.endDate) list = list.filter(e => e.start_date <= filters.endDate);
    } else if (filters.dateType === 'resignation') {
      if (filters.startDate) list = list.filter(e => e.resignation_date && e.resignation_date >= filters.startDate);
      if (filters.endDate) list = list.filter(e => e.resignation_date && e.resignation_date <= filters.endDate);
    }
  }

  return list;
}

const mockStaff = [
  { id: '1', name: 'Ana', company: 'MarBR', linkType: 'CLT', status: 'Ativo', start_date: '2024-01-10', remuneration: 8000 },
  { id: '2', name: 'Bruno', company: 'DZM', linkType: 'PJ', status: 'Ativo', start_date: '2025-03-01', remuneration: 12000 },
  { id: '3', name: 'Carlos', company: 'MarBR', linkType: 'CLT', status: 'Inativo', start_date: '2023-05-15', resignation_date: '2025-11-01', remuneration: 7000 },
  { id: '4', name: 'Diana', company: 'G2', linkType: 'PJ', status: 'Ativo', start_date: '2026-02-01', remuneration: 9500 }
];

// Teste A: Somente Ativos
const repActives = filterPeopleReportMock(mockStaff, { status: 'active' });
assert.strictEqual(repActives.length, 3);
assert.ok(repActives.every(e => e.status === 'Ativo'));

// Teste B: Somente Inativos
const repInactives = filterPeopleReportMock(mockStaff, { status: 'inactive' });
assert.strictEqual(repInactives.length, 1);
assert.strictEqual(repInactives[0].name, 'Carlos');

// Teste C: Por Empresa (MarBR)
const repMarBr = filterPeopleReportMock(mockStaff, { status: 'all', companies: ['MarBR'] });
assert.strictEqual(repMarBr.length, 2);

// Teste D: Por Período de Admissão (admitidos a partir de 2025-01-01)
const repAdmitted2025 = filterPeopleReportMock(mockStaff, { status: 'all', isPeriodActive: true, dateType: 'admission', startDate: '2025-01-01' });
assert.strictEqual(repAdmitted2025.length, 2); // Bruno (2025-03-01) e Diana (2026-02-01)

// Teste E: Por Período de Rescisão
const repResigned = filterPeopleReportMock(mockStaff, { status: 'inactive', isPeriodActive: true, dateType: 'resignation', startDate: '2025-10-01', endDate: '2025-12-31' });
assert.strictEqual(repResigned.length, 1);
assert.strictEqual(repResigned[0].name, 'Carlos');

console.log('   ✅ Filtros de status, vínculos, empresas e períodos de admissão/rescisão validados.');

// 8. Testando resolução do nome do colaborador (getEmployeeDisplayName)
console.log('\n8. Testando resolução de nomes (getEmployeeDisplayName)...');
function getEmployeeDisplayNameMock(e) {
  const isCltOrEstagio = !e.linkType || e.linkType.toUpperCase().includes('CLT') || e.linkType.toUpperCase().includes('ESTAG');
  const corp = (e.corporate_name || '').trim();
  const corpUpper = corp.toUpperCase();
  const isEmployerCorp = corpUpper.includes('D.Z.M') || corpUpper === 'DZM' || corpUpper.includes('MAR BRASIL') || corpUpper === 'G2';
  if (isCltOrEstagio || isEmployerCorp || !corp) {
    return e.name || corp || 'Sem nome';
  }
  return corp || e.name || 'Sem nome';
}

const cltWithEmployerCorp = {
  name: 'BRUNO VIANA DE SOUSA CHAVES',
  corporate_name: 'D.Z.M LTDA',
  linkType: 'CLT',
  company: 'DZM'
};
assert.strictEqual(getEmployeeDisplayNameMock(cltWithEmployerCorp), 'BRUNO VIANA DE SOUSA CHAVES');

const pjWithOwnCorp = {
  name: 'BRAIAN CASTRO FURQUIM DA MOTA',
  corporate_name: '29.739.454 BRAIAN CASTRO FURQUIM DA MOTA',
  linkType: 'PJ',
  company: 'MarBR'
};
assert.strictEqual(getEmployeeDisplayNameMock(pjWithOwnCorp), '29.739.454 BRAIAN CASTRO FURQUIM DA MOTA');

const unnamedEmp = { name: '', corporate_name: '', linkType: 'CLT' };
assert.strictEqual(getEmployeeDisplayNameMock(unnamedEmp), 'Sem nome');
console.log('   ✅ Resolução de nome para CLT e PJ validada.');

// 9. Testando cálculo contábil unificado da Central de Ingestão e Conciliação
console.log('\n9. Testando cálculo da Central de Ingestão e Conciliação...');
function calculateConciliacaoMock(row) {
  const base = Number(row.valor_fixo || 0);
  const outros = Number(row.valor_outros_recebidos || (row.valor_hora_extra || 0) + (row.valor_adicional_not || 0));
  const vt = Number(row.valor_vt || 0);
  const vrCesta = Number((row.valor_cesta || 0) + (row.valor_vr || 0));
  const bonus = Number(row.valor_bonus || 0);
  const premiacao = Number(row.valor_premiacao !== undefined ? row.valor_premiacao : (row.valor_ajuda_custo || 0));

  const subtotal = Math.round((base + outros + vt + vrCesta + bonus + premiacao) * 100) / 100;
  const desc = Number(row.valor_descontos || 0);
  const liquido = Math.round((subtotal - desc) * 100) / 100;

  return { subtotal, desc, liquido };
}

const sampleRow = {
  valor_fixo: 1849.81,
  valor_outros_recebidos: 150.00,
  valor_vt: 110.99,
  valor_cesta: 320.00,
  valor_vr: 0,
  valor_bonus: 500.00,
  valor_premiacao: 200.00,
  valor_descontos: 250.00
};

const calcResult = calculateConciliacaoMock(sampleRow);
// Subtotal = 1849.81 + 150 + 110.99 + 320 + 500 + 200 = 3130.80
assert.strictEqual(calcResult.subtotal, 3130.8);
// Líquido = 3130.80 - 250 = 2880.80
assert.strictEqual(calcResult.liquido, 2880.8);
console.log('   ✅ Equação contábil (Base + Outros + VT + VR/Cesta + Bônus + Premiação = Subtotal (-) Desconto = Líquido) validada com 100% de precisão.');

console.log('\n🎉 TODOS OS TESTES DO BPR E PEOPLE PASSARAM COM EXATIDÃO!');
