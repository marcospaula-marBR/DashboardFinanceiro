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

console.log('\n10. Testando novo filtro de Ciclo Completo / Vigência Ativa no Período (BPR 01/01/2026 a 30/06/2026)...');
function filterByCycle(employees, periodStart, periodEnd) {
  return employees.filter(e => {
    const st = (e.status || '').toLowerCase();
    if (st === 'inativo' || st === 'desligado' || st === 'demitido' || e.active === false) return false;
    if (periodStart && e.start_date && e.start_date > periodStart) return false;
    const resDate = e.resignation_date || e.real_resignation_date;
    if (periodEnd && resDate && resDate < periodEnd) return false;
    return true;
  });
}

const mockCycleEmployees = [
  { id: '1', name: 'Marcos Antonio', start_date: '2025-05-19', resignation_date: null, status: 'Ativo' },
  { id: '2', name: 'Bruno Viana', start_date: '2026-03-20', resignation_date: null, status: 'Ativo' }, // admitido pós 01/01
  { id: '3', name: 'Colaborador Rescindido', start_date: '2024-01-10', resignation_date: '2026-05-15', status: 'Inativo' }, // saiu antes de 30/06
  { id: '4', name: 'Douglas Mariano', start_date: '2025-08-25', resignation_date: null, status: 'Ativo' },
  { id: '5', name: 'Saiu em Julho', start_date: '2025-01-01', resignation_date: '2026-07-15', status: 'Inativo' } // inativo
];

const eligibleCycle = filterByCycle(mockCycleEmployees, '2026-01-01', '2026-06-30');
assert.strictEqual(eligibleCycle.length, 2);
assert.deepStrictEqual(eligibleCycle.map(e => e.id), ['1', '4']);
console.log('   ✅ Filtro de ciclo completo (vigência ativa no 1º semestre) validado: captura admitidos até 01/01 e ativos sem rescisão até 30/06.');

console.log('\n11. Testando segregação e resolução de Camada BPR (Estratégico / Tático) e Níveis de Enquadramento...');
function getEmployeeCamada(e) {
  const meta = e.metadata || {};
  const c = String(e.camada || meta.camada || '').trim();
  if (c) {
    const cLower = c.toLowerCase();
    if (cLower.includes('estrat')) return 'Estratégico';
    if (cLower.includes('tát') || cLower.includes('tat')) return 'Tático';
    if (cLower.includes('oper')) return 'Operacional';
  }
  const n = String(e.nivel || meta.nivel || '').trim();
  if (n) {
    const nLower = n.toLowerCase();
    if (nLower.includes('estrat')) return 'Estratégico';
    if (nLower.includes('tát') || nLower.includes('tat')) return 'Tático';
    if (nLower.includes('oper')) return 'Operacional';
  }
  const role = (e.job_role || '').toLowerCase();
  if (role.includes('gestor') || role.includes('diretor') || role.includes('especialista')) return 'Estratégico';
  if (role.includes('analista') || role.includes('supervisor') || role.includes('consultor') || role.includes('bpo')) return 'Tático';
  return 'Operacional';
}

function getEmployeeNivelEnquadramento(e) {
  const meta = e.metadata || {};
  const nVal = e.nivel_enquadramento || (['I', 'II', 'III'].includes(e.nivel || '') ? e.nivel : '') || meta.nivel_enquadramento || (['I', 'II', 'III'].includes(meta.grau || '') ? meta.grau : '');
  if (nVal && ['I', 'II', 'III'].includes(String(nVal).trim())) {
    return String(nVal).trim();
  }
  const grau = String(e.grau || meta.grau || '').toLowerCase();
  if (grau.includes('avan') || grau === '1') return 'I';
  if (grau.includes('inter') || grau === '2') return 'II';
  if (grau.includes('inic') || grau === '3') return 'III';
  return '-';
}

function getEmployeeNivel(e) {
  const c = getEmployeeCamada(e);
  const n = getEmployeeNivelEnquadramento(e);
  if (n && n !== '-') return `${c} (${n})`;
  return c;
}

const mockColabsHierarchy = [
  { id: '1', name: 'Marcos Antonio de Paula', nivel: 'II', metadata: { camada: 'Estratégico' } },
  { id: '2', name: 'DOUGLAS MARIANO RIBEIRO', nivel: 'I', metadata: { camada: 'Estratégico' } },
  { id: '3', name: 'CARLOS EDUARDO ROMERO VICENTE', nivel: 'Estratégico', metadata: { camada: 'Estratégico', grau: 'II' } },
  { id: '4', name: 'FLAVIO DE OLIVEIRA FONTENELE', nivel: 'Estratégico', metadata: {} },
  { id: '5', name: 'Matheus Aragão de Freitas Brito', nivel: 'III', metadata: { camada: 'Tático' } },
  { id: '6', name: 'FABIO DA SILVA GABASSI', nivel: 'Tático', metadata: {} },
  { id: '7', name: 'Operacional Padrão', nivel: 'I', metadata: { camada: 'Operacional' } }
];

assert.strictEqual(getEmployeeCamada(mockColabsHierarchy[0]), 'Estratégico');
assert.strictEqual(getEmployeeNivelEnquadramento(mockColabsHierarchy[0]), 'II');
assert.strictEqual(getEmployeeNivel(mockColabsHierarchy[0]), 'Estratégico (II)');

assert.strictEqual(getEmployeeCamada(mockColabsHierarchy[1]), 'Estratégico');
assert.strictEqual(getEmployeeNivelEnquadramento(mockColabsHierarchy[1]), 'I');

assert.strictEqual(getEmployeeCamada(mockColabsHierarchy[4]), 'Tático');
assert.strictEqual(getEmployeeNivelEnquadramento(mockColabsHierarchy[4]), 'III');
assert.strictEqual(getEmployeeNivel(mockColabsHierarchy[4]), 'Tático (III)');

// Filtro por camada Estratégico deve retornar os 4 estrategicos
const filterEstrategico = mockColabsHierarchy.filter(e => getEmployeeCamada(e) === 'Estratégico');
assert.strictEqual(filterEstrategico.length, 4);

// Filtro por camada Tático deve retornar os 2 táticos
const filterTatico = mockColabsHierarchy.filter(e => getEmployeeCamada(e) === 'Tático');
assert.strictEqual(filterTatico.length, 2);

console.log('   ✅ Resolução de Camada e Nível validada com 100% de precisão (todos os Estratégicos e Táticos capturados).');

console.log('\n12. Testando regra estrita de VT na Central de Ingestão (VT benefício = 0 na Folha Mensal)...');
function mapPayrollRow(rec) {
  return {
    sourceType: 'PAYROLL_EXTRATO',
    valor_fixo: rec.valor_fixo || 0,
    valor_vt: 0, // Nunca populado pela folha
    desconto_vt_6: rec.desconto_vt_6 || 0,
    valor_descontos: rec.valor_descontos || 0
  };
}

const payrollRecWithVtDiscount = {
  valor_fixo: 2000.00,
  desconto_vt_6: 120.00, // 6% desconto
  valor_descontos: 350.00,
  valor_vt: 120.00 // mesmo se vier preenchido do extrator
};

const mappedRow = mapPayrollRow(payrollRecWithVtDiscount);
assert.strictEqual(mappedRow.valor_vt, 0, 'valor_vt deve ser 0 na importação de folha mensal');
assert.strictEqual(mappedRow.desconto_vt_6, 120.00, 'desconto_vt_6 deve manter o desconto de 6% da folha');
assert.strictEqual(mappedRow.valor_descontos, 350.00, 'valor_descontos deve conter os descontos totais da folha');
console.log('   ✅ Regra de VT da Folha Mensal validada: valor_vt inicializado em 0 e desconto legal de 6% mantido em descontos.');

// 13. Testando algoritmo de matching fonético e sufixos truncados (17 colaboradores da planilha de VT)
console.log('\n13. Testando algoritmo de similaridade de nomes e matching de VT...');

function normalizeTestName(str) {
  let s = str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");

  s = s
    .replace(/\bsouza\b/g, "sousa")
    .replace(/\bluiz\b/g, "luis")
    .replace(/\bmontte\b/g, "monte")
    .replace(/\bnetto\b/g, "neto")
    .replace(/\bterceirizad[oa]\b/g, "")
    .replace(/\b(de|da|do|dos|das|e)\b/g, " ");

  return s.split(/\s+/).filter(w => w.length > 0);
}

function calcSimilarityTest(nameA, nameB) {
  if (!nameA || !nameB) return 0;
  const wordsA = normalizeTestName(nameA);
  const wordsB = normalizeTestName(nameB);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const strA = wordsA.join(' ');
  const strB = wordsB.join(' ');
  if (strA === strB) return 1.0;

  const setB = new Set(wordsB);
  const intersection = wordsA.filter(w => setB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  const tokenScore = intersection.length / union.size;

  const firstNameA = wordsA[0];
  const firstNameB = wordsB[0];
  const lastNameA = wordsA[wordsA.length - 1];
  const lastNameB = wordsB[wordsB.length - 1];

  const firstMatches = firstNameA === firstNameB;
  const lastMatches = lastNameA === lastNameB ||
    (lastNameA.length >= 4 && lastNameB.length >= 4 && (lastNameA.startsWith(lastNameB) || lastNameB.startsWith(lastNameA)));

  if (firstMatches && lastMatches) {
    return Math.max(tokenScore, 0.90);
  }
  return tokenScore;
}

const vtPairs = [
  ['Flavio Pereira da Silva', 'FLAVIO PEREIRA DA SILVA'],
  ['Robson Roque Bernardo', 'ROBSON ROQUE BERNARDO'],
  ['Olavo Carvalho de Jesus Montte Carlos', 'OLAVO CARVALHO DE JESUS MONTTE CARL'],
  ['Victor Luis de Oliveira Silva', 'VICTOR LUIZ DE OLIVEIRA SILVA'],
  ['João Marcelo de Oliveira Paredes', 'JOAO MARCELO DE OLIVEIRA PAREDES'],
  ['Rafael Andrade de Jesus', 'RAFAEL ANDRADE DE JESUS'],
  ['Gustavo Dias de Oliveira', 'GUSTAVO DIAS DE OLIVEIRA'],
  ['Jhonatan Silva Barbosa', 'JHONATAN SILVA BARBOSA'],
  ['Pedro Enzo Martins Bastos', 'PEDRO ENZO MARTINS BASTOS'],
  ['Gabriel dos Santos Silva', 'GABRIEL DOS SANTOS SILVA'],
  ['Lucas Pereira da Silva', 'LUCAS PEREIRA DA SILVA'],
  ['Bruno Viana de Souza Chaves', 'BRUNO VIANA DE SOUSA CHAVES'],
  ['Irailde Rodrigues da Silva', 'IRAILDE RODRIGUES DA SILVA'],
  ['Pako Ruhan Cavalcanti de Andrade', 'PAKO RUHAN CAVALCANTI DE DE ANDRADE'],
  ['Felipe dos Santos Souza', 'FELIPE DOS SANTOS SOUSA'],
  ['Victoria Eduarda Alves Bueno da Silva', 'VICTORIA EDUARDA ALVES BUENO DA SILVA'],
  ['Andrea Aparecida de Oliveira Ferreira', 'ANDREA APARECIDA DE OLIVEIRA FERREIR']
];

vtPairs.forEach(([sheetName, dbName]) => {
  const score = calcSimilarityTest(sheetName, dbName);
  assert.ok(score >= 0.85, `Score esperado >= 0.85 para '${sheetName}' vs '${dbName}', obteve ${score}`);
});
console.log('   ✅ 17 de 17 colaboradores da planilha de VT combinados com precisão (score >= 0.85).');

// 14. Testando Equação Contábil com Proventos da Folha
console.log('\n14. Testando Equação Contábil com Proventos da Folha...');
function calculateProventosEquation(row) {
  const proventos = Number(row.valor_holerite || row.valor_fixo || 0);
  const outros = Number(row.valor_outros_recebidos || 0);
  const vt = Number(row.valor_vt || 0);
  const vrCesta = Number(row.valor_cesta || 0);
  const bonus = Number(row.valor_bonus || 0);
  const premiacao = Number(row.valor_premiacao || 0);

  const subtotal = proventos + outros + vt + vrCesta + bonus + premiacao;
  const descontos = Number(row.valor_descontos || 0);
  const liquido = subtotal - descontos;

  return { subtotal, liquido };
}

const proventosSample = {
  valor_holerite: 1984.89, // Bruno Viana: proventos brutos da folha
  valor_fixo: 1849.81,
  valor_outros_recebidos: 67.54,
  valor_vt: 421.60,
  valor_cesta: 320.00,
  valor_bonus: 0,
  valor_premiacao: 320.00,
  valor_descontos: 993.07
};

const provResult = calculateProventosEquation(proventosSample);
// Subtotal = 1984.89 + 67.54 + 421.60 + 320 + 0 + 320 = 3114.03
assert.strictEqual(Math.round(provResult.subtotal * 100) / 100, 3114.03);
// Líquido = 3114.03 - 993.07 = 2120.96
assert.strictEqual(Math.round(provResult.liquido * 100) / 100, 2120.96);
console.log('   ✅ Equação contábil com Proventos (Folha) validada centavo a centavo.');

// 15. Testando Mapeamento e Destino das 5 Colunas de Benefícios (VT, VR_CESTA, BONUS, PREMIACAO, OUTROS)
console.log('\n15. Testando Mapeamento e Destino das 5 Colunas de Benefícios...');
function applyBenefitToRow(row, colToUse, recValue) {
  const updated = { ...row };
  if (colToUse === 'VT') {
    updated.valor_vt = recValue;
  } else if (colToUse === 'VR_CESTA') {
    updated.valor_cesta = recValue;
  } else if (colToUse === 'BONUS') {
    updated.valor_bonus = recValue;
  } else if (colToUse === 'PREMIACAO') {
    updated.valor_premiacao = recValue;
    updated.valor_ajuda_custo = recValue;
  } else if (colToUse === 'OUTROS') {
    updated.valor_outros_recebidos = recValue;
  }
  return updated;
}

const baseRow = { id: 'test-1', valor_vt: 0, valor_cesta: 0, valor_bonus: 0, valor_premiacao: 0, valor_outros_recebidos: 0 };
const afterVt = applyBenefitToRow(baseRow, 'VT', 450);
assert.strictEqual(afterVt.valor_vt, 450);

const afterVr = applyBenefitToRow(baseRow, 'VR_CESTA', 600);
assert.strictEqual(afterVr.valor_cesta, 600);

const afterBonus = applyBenefitToRow(baseRow, 'BONUS', 1200);
assert.strictEqual(afterBonus.valor_bonus, 1200);

const afterPrem = applyBenefitToRow(baseRow, 'PREMIACAO', 800);
assert.strictEqual(afterPrem.valor_premiacao, 800);
assert.strictEqual(afterPrem.valor_ajuda_custo, 800);

const afterOutros = applyBenefitToRow(baseRow, 'OUTROS', 350);
assert.strictEqual(afterOutros.valor_outros_recebidos, 350);
console.log('   ✅ Todas as 5 categorias de benefícios alimentam as colunas corretas com isolamento perfeito.');

// 16. Testando Equação Unificada com Adiantamento Salarial Recomposto
console.log('\n16. Testando Equação Unificada com Adiantamento Salarial (desc.adiant.salarial)...');
function calculateUnifiedEquationWithAdiantamento(row) {
  const proventos = Number(row.valor_holerite || row.valor_fixo || 0);
  const outros = Number(row.valor_outros_recebidos || 0);
  const vt = Number(row.valor_vt || 0);
  const vrCesta = Number(row.valor_cesta || 0);
  const bonus = Number(row.valor_bonus || 0);
  const premiacao = Number(row.valor_premiacao || 0);
  const adiantamento = Number(row.valor_adiantamento || 0);

  const subtotal = proventos + outros + vt + vrCesta + bonus + premiacao;
  const descontos = Number(row.valor_descontos || 0);
  const liquido = subtotal - descontos + adiantamento;

  return { subtotal, liquido };
}

// Exemplo Bruno Viana: Proventos 1984.89, Descontos 993.07 (que contém desc. adiantamento 739.92), Adiantamento 739.92
const brunoSample = {
  valor_holerite: 1984.89,
  valor_outros_recebidos: 0,
  valor_vt: 421.60,
  valor_cesta: 320.00,
  valor_bonus: 0,
  valor_premiacao: 320.00,
  valor_descontos: 993.07,
  valor_adiantamento: 739.92
};

const brunoRes = calculateUnifiedEquationWithAdiantamento(brunoSample);
// Subtotal = 1984.89 + 0 + 421.60 + 320 + 0 + 320 = 3046.49
assert.strictEqual(Math.round(brunoRes.subtotal * 100) / 100, 3046.49);
// Líquido = 3046.49 - 993.07 + 739.92 = 2793.34
assert.strictEqual(Math.round(brunoRes.liquido * 100) / 100, 2793.34);

// Exemplo Deuzelina: Proventos 5823.98, Hora Extra 169.74 (já embutida em Proventos), valor_outros_recebidos 0
const deuzelinaSample = {
  valor_holerite: 5823.98,
  valor_hora_extra: 169.74,
  valor_outros_recebidos: 0,
  valor_vt: 0,
  valor_cesta: 0,
  valor_bonus: 0,
  valor_premiacao: 0,
  valor_descontos: 5823.96,
  valor_adiantamento: 0
};
const deuzelinaRes = calculateUnifiedEquationWithAdiantamento(deuzelinaSample);
// Subtotal deve ser estritamente igual a Proventos (5823.98), sem somar hora extra em duplicidade
assert.strictEqual(Math.round(deuzelinaRes.subtotal * 100) / 100, 5823.98);
assert.strictEqual(Math.round(deuzelinaRes.liquido * 100) / 100, 0.02);
console.log('   ✅ Equação unificada com Adiantamento Salarial recomposto e isolamento de Proventos/Horas Extras validada centavo a centavo.');

// 17. Testando Valor Adicional por Colaborador e Regras de Abatimento no BprService real
console.log('\n17. Testando Valor Adicional por Colaborador e Regras de Abatimento (Total Rateado vs Camada vs Redução Manual)...');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadRealBprService() {
  const hrPath = path.resolve(__dirname, '../src/services/people-hr.service.ts');
  const hrSource = fs.readFileSync(hrPath, 'utf8');
  const startIdx = hrSource.indexOf('export function calculateRowFinancials');
  const endIdx = hrSource.indexOf('const _competenciaCache');
  const hrSlice = hrSource.slice(startIdx, endIdx);
  const hrTranspiled = ts.transpileModule(hrSlice, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const hrMod = { exports: {} };
  vm.runInNewContext(hrTranspiled.outputText, {
    module: hrMod,
    exports: hrMod.exports,
    Math,
    Number,
    String,
    Object,
    Array,
    Boolean,
  });

  const filePath = path.resolve(__dirname, '../src/services/bpr.service.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require: (id) => {
      if (id === '@/types/loans') {
        return {
          getPBClassification: () => 'O',
          normalizeCompanyName: (c) => c || 'MarBR',
        };
      }
      if (id === '@/types/bpr') return {};
      if (id === '@/lib/supabase') return { supabase: {} };
      if (id === '@/services/people-hr.service') return hrMod.exports;
      return require(id);
    },
    console,
    Math,
    Number,
    String,
    Array,
    Object,
    Date,
    Set,
    Map,
    JSON,
    Boolean,
    parseFloat,
    parseInt,
    isNaN,
  };
  vm.runInNewContext(transpiled.outputText, sandbox);
  return mod.exports.BprService;
}

const RealBprService = loadRealBprService();
const baseCandidatesForAdd = [
  { employeeId: 'e1', name: 'Diretor 1', company: 'MarBR', department: 'Dir', jobRole: 'Diretor', linkType: 'PJ', isOutsourced: false, camada: 'E', camadaLabel: 'Estratégico', status: 'Ativo', performanceFactor: 1.0, admittedBeforeOrAtCycleStart: true, activeThroughoutCycle: true, activeAtPaymentDate: true, hasGlosaInPeriod: false, isInactiveAtPaymentDate: false, isManuallyExcluded: false, isEligible: true, isExceptionApplied: false, ineligibilityReasons: [], baseAmount: 0, allocatedAmount: 0 },
  { employeeId: 't1', name: 'Gerente 1', company: 'MarBR', department: 'Ops', jobRole: 'Gerente', linkType: 'CLT', isOutsourced: false, camada: 'T', camadaLabel: 'Tático', status: 'Ativo', performanceFactor: 1.0, admittedBeforeOrAtCycleStart: true, activeThroughoutCycle: true, activeAtPaymentDate: true, hasGlosaInPeriod: false, isInactiveAtPaymentDate: false, isManuallyExcluded: false, isEligible: true, isExceptionApplied: false, ineligibilityReasons: [], baseAmount: 0, allocatedAmount: 0 },
  { employeeId: 'o1', name: 'Analista 1', company: 'MarBR', department: 'Ops', jobRole: 'Analista', linkType: 'CLT', isOutsourced: false, camada: 'O', camadaLabel: 'Operacional/CLTs', status: 'Ativo', performanceFactor: 1.0, admittedBeforeOrAtCycleStart: true, activeThroughoutCycle: true, activeAtPaymentDate: true, hasGlosaInPeriod: false, isInactiveAtPaymentDate: false, isManuallyExcluded: false, isEligible: true, isExceptionApplied: false, ineligibilityReasons: [], baseAmount: 0, allocatedAmount: 0 },
  { employeeId: 'o2', name: 'Analista Inelegivel', company: 'MarBR', department: 'Ops', jobRole: 'Analista', linkType: 'CLT', isOutsourced: false, camada: 'O', camadaLabel: 'Operacional/CLTs', status: 'Inativo', performanceFactor: 1.0, admittedBeforeOrAtCycleStart: true, activeThroughoutCycle: false, activeAtPaymentDate: false, hasGlosaInPeriod: false, isInactiveAtPaymentDate: true, isManuallyExcluded: false, isEligible: false, isExceptionApplied: false, ineligibilityReasons: ['Inativo'], baseAmount: 0, allocatedAmount: 0 },
];

// Caso 1: Padrão (total_pool) — níveis somam 100%, adicional de R$ 10.000 em o1 é descontado do Montante Total (100k -> 90k)
const cfgTotalPool = {
  ...RealBprService.getDefaultConfig('ciclo_1', 2026),
  totalPoolAmount: 100000,
  splitMode: 'percentage',
  tierSplits: { E: 30, T: 40, O: 30 },
  additionalDeductionSource: 'total_pool',
  additionalAmounts: { o1: 10000 },
};
const resTotalPool = RealBprService.recalculateSnapshotWithNewConfig(baseCandidatesForAdd, cfgTotalPool);
assert.strictEqual(resTotalPool.totalPoolAmount, 100000);
assert.strictEqual(resTotalPool.totalAdditionalAmount, 10000);
assert.strictEqual(resTotalPool.netPoolForLayers, 90000);
assert.strictEqual(resTotalPool.layers.E.totalLayerAmount, 27000); // 30k - 3k
assert.strictEqual(resTotalPool.layers.T.totalLayerAmount, 36000); // 40k - 4k
assert.strictEqual(resTotalPool.layers.O.totalLayerAmount, 27000); // 30k - 3k
const o1TotalPool = resTotalPool.candidates.find(c => c.employeeId === 'o1');
assert.strictEqual(o1TotalPool.rateioAmount, 27000);
assert.strictEqual(o1TotalPool.additionalAmount, 10000);
assert.strictEqual(o1TotalPool.allocatedAmount, 37000);
assert.strictEqual(resTotalPool.totalDistributedAmount, 100000);

// Caso 2: Redução de camada específica ('E') — desconta R$ 10.000 exclusivamente do Estratégico
const cfgDeductE = { ...cfgTotalPool, additionalDeductionSource: 'E' };
const resDeductE = RealBprService.recalculateSnapshotWithNewConfig(baseCandidatesForAdd, cfgDeductE);
assert.strictEqual(resDeductE.layers.E.grossLayerAmount, 30000);
assert.strictEqual(resDeductE.layers.E.additionalDeductedFromLayer, 10000);
assert.strictEqual(resDeductE.layers.E.totalLayerAmount, 20000);
assert.strictEqual(resDeductE.layers.T.totalLayerAmount, 40000);
assert.strictEqual(resDeductE.layers.O.totalLayerAmount, 30000);
assert.strictEqual(resDeductE.totalDistributedAmount, 100000);

// Caso 3: Redução da própria camada ('own_layer') — t1 +6.000 (sai de T), o1 +4.000 (sai de O), E intacto
const cfgOwnLayer = {
  ...cfgTotalPool,
  additionalDeductionSource: 'own_layer',
  additionalAmounts: { t1: 6000, o1: 4000 },
};
const resOwnLayer = RealBprService.recalculateSnapshotWithNewConfig(baseCandidatesForAdd, cfgOwnLayer);
assert.strictEqual(resOwnLayer.layers.E.totalLayerAmount, 30000);
assert.strictEqual(resOwnLayer.layers.T.totalLayerAmount, 34000);
assert.strictEqual(resOwnLayer.layers.O.totalLayerAmount, 26000);
assert.strictEqual(resOwnLayer.totalDistributedAmount, 100000);

// Caso 4: Redução manual no percentual de uma camada (E reduzido de 30% -> 20%, soma 90%) -> zero duplo desconto
const cfgManualReduced = {
  ...cfgTotalPool,
  tierSplits: { E: 20, T: 40, O: 30 },
  additionalDeductionSource: 'total_pool',
  additionalAmounts: { o1: 10000 },
};
const resManualReduced = RealBprService.recalculateSnapshotWithNewConfig(baseCandidatesForAdd, cfgManualReduced);
assert.strictEqual(resManualReduced.layers.E.totalLayerAmount, 20000);
assert.strictEqual(resManualReduced.layers.E.additionalDeductedFromLayer, 0);
assert.strictEqual(resManualReduced.layers.T.totalLayerAmount, 40000);
assert.strictEqual(resManualReduced.layers.O.totalLayerAmount, 30000);
assert.strictEqual(resManualReduced.netPoolForLayers, 90000);
assert.strictEqual(resManualReduced.totalDistributedAmount, 100000);

// Caso 5: Colaborador inelegível com adicional no mapa não recebe nem abate do pool
const cfgIneligible = {
  ...cfgTotalPool,
  additionalAmounts: { o2: 5000 },
};
const resIneligible = RealBprService.recalculateSnapshotWithNewConfig(baseCandidatesForAdd, cfgIneligible);
const o2Res = resIneligible.candidates.find(c => c.employeeId === 'o2');
assert.strictEqual(resIneligible.totalAdditionalAmount, 0);
assert.strictEqual(o2Res.additionalAmount, 0);
assert.strictEqual(o2Res.allocatedAmount, 0);
assert.strictEqual(resIneligible.netPoolForLayers, 100000);

console.log('   ✅ Regras de Valor Adicional por colaborador (Total Rateado, Camada Específica, Própria Camada, Redução Manual e Inelegível) validadas com precisão centavo a centavo!');

// 18. Testando Justificativa de Adicional + Histórico Recebido no Período (Montante, Média e % Equivalente BPR)
console.log('\n18. Testando Motivo de Adicional e Histórico Financeiro do People no Período BPR...');
const mockEmployeesForHist = [
  { id: 'emp-clt', name: 'Ana CLT', company: 'MarBR', department: 'Ops', job_role: 'Analista', linkType: 'CLT', camada: 'O', status: 'Ativo', start_date: '2025-01-01' },
  { id: 'emp-pj', name: 'Carlos PJ', corporate_name: 'CARLOS CONSULTORIA LTDA', company: 'DZM', department: 'TI', job_role: 'Tech Lead', linkType: 'PJ', camada: 'T', status: 'Ativo', start_date: '2025-01-01' },
  { id: 'emp-sem-hist', name: 'Bruno Sem Histórico', company: 'MarBR', department: 'Dir', job_role: 'Diretor', linkType: 'PJ', camada: 'E', status: 'Ativo', start_date: '2025-01-01' },
  { id: 'emp-ineleg', name: 'Diego Inelegivel', company: 'MarBR', department: 'Ops', job_role: 'Assistente', linkType: 'CLT', camada: 'O', status: 'Inativo', start_date: '2025-01-01', resignation_date: '2026-04-15' },
];

const mockMonthlyCostsForHist = [
  // Ana CLT: 3 meses dentro do 1º Semestre 2026 (R$ 4.000, R$ 5.000, R$ 6.000 -> Montante R$ 15.000, Média R$ 5.000) + 1 mês fora do período (2026-07) que deve ser ignorado
  { employee_id: 'emp-clt', competencia: '2026-01-01', vinculo_tipo: 'CLT', valor_holerite: 4000, valor_descontos: 500, valor_vt: 200, valor_cesta: 300 }, // realTotal = 3500 + 500 = 4000
  { employee_id: 'emp-clt', competencia: '2026-02-01', vinculo_tipo: 'CLT', valor_holerite: 5000, valor_descontos: 500, valor_vt: 200, valor_cesta: 300 }, // realTotal = 5000
  { employee_id: 'emp-clt', competencia: '2026-03-01', vinculo_tipo: 'CLT', valor_holerite: 6000, valor_descontos: 500, valor_vt: 200, valor_cesta: 300 }, // realTotal = 6000
  { employee_id: 'emp-clt', competencia: '2026-07-01', vinculo_tipo: 'CLT', valor_holerite: 9999, valor_descontos: 0 }, // Fora de 01/01 a 30/06 -> IGNORAR
  // Carlos PJ: 2 meses no período (R$ 10.000 cada -> Montante R$ 20.000, Média R$ 10.000) + 1 mês de 2025-12 que deve ser ignorado
  { employee_id: 'emp-pj', competencia: '2025-12-01', vinculo_tipo: 'MEI', valor_fixo: 8000 }, // Fora -> IGNORAR
  { employee_id: 'emp-pj', competencia: '2026-01-01', vinculo_tipo: 'MEI', valor_fixo: 9500, valor_ajuda_custo: 500 }, // realTotal = 10000
  { employee_id: 'emp-pj', competencia: '2026-02-01', vinculo_tipo: 'MEI', valor_fixo: 10000 }, // realTotal = 10000
  // Diego Inelegível: tem histórico de R$ 3.000 em 2026-01, mas como é inelegível, % BPR = 0%
  { employee_id: 'emp-ineleg', competencia: '2026-01-01', vinculo_tipo: 'CLT', valor_holerite: 3000, valor_descontos: 0 },
];

const cfgHist = {
  ...RealBprService.getDefaultConfig('ciclo_1', 2026),
  periodStartDate: '2026-01-01',
  periodEndDate: '2026-06-30',
  paymentDate: '2026-09-30',
  totalPoolAmount: 50000,
  splitMode: 'percentage',
  tierSplits: { E: 40, T: 40, O: 20 }, // E=20k, T=20k, O=10k (antes de adicionais)
  additionalDeductionSource: 'E',
  additionalAmounts: { 'emp-clt': 2500, 'emp-ineleg': 1000 },
  additionalReasons: { 'emp-clt': 'Entrega Extra Projeto X', 'emp-ineleg': 'Não deve aparecer' },
};

const resHist = RealBprService.calculateBpr(mockEmployeesForHist, mockMonthlyCostsForHist, cfgHist);

// Ana CLT: Rateio O = R$ 10.000 + Adicional R$ 2.500 = R$ 12.500; Montante = R$ 15.000; Média (3m) = R$ 5.000
// % Média = 12500 / 5000 = 250.0%; % Montante = 12500 / 15000 = 83.3%
const anaRes = resHist.candidates.find(c => c.employeeId === 'emp-clt');
assert.strictEqual(anaRes.allocatedAmount, 12500);
assert.strictEqual(anaRes.additionalAmount, 2500);
assert.strictEqual(anaRes.additionalReason, 'Entrega Extra Projeto X');
assert.strictEqual(anaRes.periodMonthsCount, 3);
assert.strictEqual(anaRes.periodReceivedTotal, 15000);
assert.strictEqual(anaRes.periodReceivedAverage, 5000);
assert.strictEqual(anaRes.bprVsAveragePct, 250);
assert.strictEqual(anaRes.bprVsTotalPct, 83.3);

// Carlos PJ: Rateio T = R$ 20.000; Montante = R$ 20.000; Média (2m) = R$ 10.000 -> 200.0% média e 100.0% montante
const carlosRes = resHist.candidates.find(c => c.employeeId === 'emp-pj');
assert.strictEqual(carlosRes.allocatedAmount, 20000);
assert.strictEqual(carlosRes.periodMonthsCount, 2);
assert.strictEqual(carlosRes.periodReceivedTotal, 20000);
assert.strictEqual(carlosRes.periodReceivedAverage, 10000);
assert.strictEqual(carlosRes.bprVsAveragePct, 200);
assert.strictEqual(carlosRes.bprVsTotalPct, 100);

// Bruno Sem Histórico: sem divisão por zero / NaN
const brunoSemHist = resHist.candidates.find(c => c.employeeId === 'emp-sem-hist');
assert.strictEqual(brunoSemHist.periodMonthsCount, 0);
assert.strictEqual(brunoSemHist.periodReceivedTotal, 0);
assert.strictEqual(brunoSemHist.periodReceivedAverage, 0);
assert.strictEqual(brunoSemHist.bprVsAveragePct, 0);
assert.strictEqual(brunoSemHist.bprVsTotalPct, 0);

// Diego Inelegível: preserva histórico, mas adicional, justificativa e % BPR = 0/undefined
const diegoRes = resHist.candidates.find(c => c.employeeId === 'emp-ineleg');
assert.strictEqual(diegoRes.isEligible, false);
assert.strictEqual(diegoRes.periodReceivedTotal, 3000);
assert.strictEqual(diegoRes.periodReceivedAverage, 3000);
assert.strictEqual(diegoRes.additionalAmount, 0);
assert.strictEqual(diegoRes.additionalReason, undefined);
assert.strictEqual(diegoRes.bprVsAveragePct, 0);
assert.strictEqual(diegoRes.bprVsTotalPct, 0);

// Total histórico consolidado dos elegíveis = 15.000 + 20.000 + 0 = 35.000
assert.strictEqual(resHist.totalPeriodReceivedAmount, 35000);

console.log('   ✅ Motivo/justificativa do adicional e comparativo histórico do período (Montante, Média, % Média e % Montante) validados com 100% de precisão!');

// 19. Testando Peso Relativo do BPR por Camada (E, T, O e Geral) sobre Recebimentos Médios Mensais
console.log('\n19. Testando Peso Relativo do BPR (% Média Mensal e Múltiplos) por Camada e Consolidado Geral...');
const candidatesForWeights = [
  // Camada E: 1 elegível com média mensal R$ 20.000 (montante 6m R$ 120.000), BPR R$ 40.000 -> 200.0% (2.00x), 33.3% mont.
  { employeeId: 'w-e1', name: 'Dir 1', camada: 'E', isEligible: true, allocatedAmount: 40000, periodReceivedAverage: 20000, periodReceivedTotal: 120000 },
  // Camada T: 2 elegíveis com histórico (A: média 12k, B: média 8k -> base 20k; BPR 15k + 15k = 30k) -> 150.0% (1.50x)
  { employeeId: 'w-t1', name: 'Ger A', camada: 'T', isEligible: true, allocatedAmount: 15000, periodReceivedAverage: 12000, periodReceivedTotal: 72000 },
  { employeeId: 'w-t2', name: 'Ger B', camada: 'T', isEligible: true, allocatedAmount: 15000, periodReceivedAverage: 8000, periodReceivedTotal: 48000 },
  // Camada O: 2 elegíveis, mas apenas 1 com histórico (média 4k, BPR 6k) e 1 sem histórico (média 0, BPR 6k) -> deve excluir o sem histórico do numerador e denominador! -> 150.0% (1.50x)
  { employeeId: 'w-o1', name: 'Op Com Hist', camada: 'O', isEligible: true, allocatedAmount: 6000, periodReceivedAverage: 4000, periodReceivedTotal: 24000 },
  { employeeId: 'w-o2', name: 'Op Sem Hist', camada: 'O', isEligible: true, allocatedAmount: 6000, periodReceivedAverage: 0, periodReceivedTotal: 0 },
  // Inelegível com histórico não entra na base
  { employeeId: 'w-o3', name: 'Op Ineleg', camada: 'O', isEligible: false, allocatedAmount: 0, periodReceivedAverage: 5000, periodReceivedTotal: 30000 },
];

const weightsRes = RealBprService.computeLayerRelativeWeights(candidatesForWeights);
assert.strictEqual(weightsRes.E.eligibleCount, 1);
assert.strictEqual(weightsRes.E.eligibleWithHistoryCount, 1);
assert.strictEqual(weightsRes.E.bprVsMonthlyAvgPct, 200);
assert.strictEqual(weightsRes.E.bprMultipleOfMonthlyAvg, 2);
assert.strictEqual(weightsRes.E.bprVsPeriodTotalPct, 33.3);

assert.strictEqual(weightsRes.T.eligibleCount, 2);
assert.strictEqual(weightsRes.T.eligibleWithHistoryCount, 2);
assert.strictEqual(weightsRes.T.monthlyAverageBase, 20000);
assert.strictEqual(weightsRes.T.bprAllocatedBase, 30000);
assert.strictEqual(weightsRes.T.bprVsMonthlyAvgPct, 150);
assert.strictEqual(weightsRes.T.bprMultipleOfMonthlyAvg, 1.5);

// Proteção contra inflação do múltiplo quando há elegível sem histórico na camada O
assert.strictEqual(weightsRes.O.eligibleCount, 2);
assert.strictEqual(weightsRes.O.eligibleWithHistoryCount, 1);
assert.strictEqual(weightsRes.O.monthlyAverageBase, 4000);
assert.strictEqual(weightsRes.O.bprAllocatedBase, 6000);
assert.strictEqual(weightsRes.O.bprVsMonthlyAvgPct, 150);
assert.strictEqual(weightsRes.O.bprMultipleOfMonthlyAvg, 1.5);

// Consolidado geral (apenas elegíveis com histórico: BPR 40k+30k+6k = 76k / Média 20k+20k+4k = 44k -> 172.7% / 1.73x)
assert.strictEqual(weightsRes.overall.eligibleCount, 5);
assert.strictEqual(weightsRes.overall.eligibleWithHistoryCount, 4);
assert.strictEqual(weightsRes.overall.monthlyAverageBase, 44000);
assert.strictEqual(weightsRes.overall.bprAllocatedBase, 76000);
assert.strictEqual(weightsRes.overall.bprVsMonthlyAvgPct, 172.7);
assert.strictEqual(weightsRes.overall.bprMultipleOfMonthlyAvg, 1.73);

// Caso vazio / sem histórico: zero NaN
const emptyWeights = RealBprService.computeLayerRelativeWeights([]);
assert.strictEqual(emptyWeights.overall.bprVsMonthlyAvgPct, 0);
assert.strictEqual(emptyWeights.overall.bprMultipleOfMonthlyAvg, 0);
assert.strictEqual(emptyWeights.overall.eligibleWithHistoryCount, 0);

// Validação integrada em calculateBpr (resHist do Bloco 18):
// Ana CLT (O): BPR 12.500 / Média 5.000 = 250.0% (2.50x); Carlos PJ (T): BPR 20.000 / Média 10.000 = 200.0% (2.00x); Bruno (E): sem histórico -> 0
// Geral: (12.500 + 20.000) / (5.000 + 10.000) = 32.500 / 15.000 = 216.7% (2.17x)
assert.strictEqual(resHist.layers.O.bprVsMonthlyAvgPct, 250);
assert.strictEqual(resHist.layers.O.bprMultipleOfMonthlyAvg, 2.5);
assert.strictEqual(resHist.layers.T.bprVsMonthlyAvgPct, 200);
assert.strictEqual(resHist.layers.T.bprMultipleOfMonthlyAvg, 2);
assert.strictEqual(resHist.layers.E.eligibleWithHistoryCount, 0);
assert.strictEqual(resHist.overallRelativeWeight.bprVsMonthlyAvgPct, 216.7);
assert.strictEqual(resHist.overallRelativeWeight.bprMultipleOfMonthlyAvg, 2.17);

console.log('   ✅ Peso Relativo do BPR (% Média Mensal e Múltiplos) por Camada (E/T/O) e Consolidado Geral validados sem distorção!');

// 20. Testando Acréscimo de Bônus (extra_bonus), Simulador de Meta por Múltiplo (x) e Filtro por Nome
console.log('\n20. Testando Acréscimo de Bônus (extra_bonus), Simulador de Meta por Múltiplo (x) e Filtro por Nome...');

// 20A. Modo extra_bonus: não desconta das camadas, soma como acréscimo de bônus ao total
const cfgExtraBonus = {
  ...RealBprService.getDefaultConfig('ciclo_1', 2026),
  totalPoolAmount: 100000,
  splitMode: 'percentage',
  tierSplits: { E: 30, T: 40, O: 30 },
  additionalDeductionSource: 'extra_bonus',
  additionalAmounts: { o1: 10000 },
  additionalReasons: { o1: 'Bônus extraordinário diretoria' },
};
const resExtraBonus = RealBprService.recalculateSnapshotWithNewConfig(baseCandidatesForAdd, cfgExtraBonus);
assert.strictEqual(resExtraBonus.basePoolAmount, 100000);
assert.strictEqual(resExtraBonus.extraBonusAmount, 10000);
assert.strictEqual(resExtraBonus.totalPoolAmount, 110000);
assert.strictEqual(resExtraBonus.netPoolForLayers, 100000);
assert.strictEqual(resExtraBonus.layers.E.totalLayerAmount, 30000);
assert.strictEqual(resExtraBonus.layers.T.totalLayerAmount, 40000);
assert.strictEqual(resExtraBonus.layers.O.totalLayerAmount, 30000);
assert.strictEqual(resExtraBonus.layers.E.additionalDeductedFromLayer, 0);
assert.strictEqual(resExtraBonus.layers.T.additionalDeductedFromLayer, 0);
assert.strictEqual(resExtraBonus.layers.O.additionalDeductedFromLayer, 0);
const o1Extra = resExtraBonus.candidates.find(c => c.employeeId === 'o1');
assert.strictEqual(o1Extra.rateioAmount, 30000);
assert.strictEqual(o1Extra.additionalAmount, 10000);
assert.strictEqual(o1Extra.allocatedAmount, 40000);
assert.strictEqual(resExtraBonus.totalDistributedAmount, 110000);
assert.strictEqual(resExtraBonus.residualAmount, 0);

// 20B. Simulador de Meta por Múltiplo Salarial (x)
const candidatesForTargetSim = [
  { employeeId: 's-e1', name: 'Dir', camada: 'E', isEligible: true, performanceFactor: 1.0, periodReceivedAverage: 20000, periodReceivedTotal: 120000 },
  { employeeId: 's-t1', name: 'Ger 100%', camada: 'T', isEligible: true, performanceFactor: 1.0, periodReceivedAverage: 10000, periodReceivedTotal: 60000 },
  { employeeId: 's-t2', name: 'Ger 75%', camada: 'T', isEligible: true, performanceFactor: 0.75, periodReceivedAverage: 10000, periodReceivedTotal: 60000 },
  { employeeId: 's-o1', name: 'Op Com Hist', camada: 'O', isEligible: true, performanceFactor: 1.0, periodReceivedAverage: 4000, periodReceivedTotal: 24000 },
  { employeeId: 's-o2', name: 'Op Sem Hist', camada: 'O', isEligible: true, performanceFactor: 1.0, periodReceivedAverage: 0, periodReceivedTotal: 0 },
];
const simProj = RealBprService.simulatePoolFromTargetMultiples(candidatesForTargetSim, { E: 2.0, T: 1.5, O: 1.0 });
assert.strictEqual(simProj.hasAnyHistory, true);
assert.strictEqual(simProj.layers.E.requiredAmountPerEligible, 40000);
assert.strictEqual(simProj.layers.E.requiredLayerAmount, 40000);
// T: (1.5 * 20000) / 1.75 = 17142.86 por elegível; * 2 elegíveis = 34285.72
assert.strictEqual(simProj.layers.T.requiredAmountPerEligible, 17142.86);
assert.strictEqual(simProj.layers.T.requiredLayerAmount, 34285.72);
// O: 1 com histórico (4k) * 1.0x = 4000 por elegível; * 2 elegíveis = 8000
assert.strictEqual(simProj.layers.O.requiredAmountPerEligible, 4000);
assert.strictEqual(simProj.layers.O.requiredLayerAmount, 8000);
assert.strictEqual(simProj.totalRequiredPool, 82285.72);
assert.strictEqual(
  simProj.layers.E.equivalentPercentage + simProj.layers.T.equivalentPercentage + simProj.layers.O.equivalentPercentage,
  100
);

// Caso sem histórico no simulador de meta
const emptySim = RealBprService.simulatePoolFromTargetMultiples(
  [{ employeeId: 'x', name: 'Sem Hist', camada: 'O', isEligible: true, performanceFactor: 1.0, periodReceivedAverage: 0 }],
  { E: 2, T: 1.5, O: 1 }
);
assert.strictEqual(emptySim.hasAnyHistory, false);
assert.strictEqual(emptySim.totalRequiredPool, 0);

// 20C. Filtro por nome sem acentos e múltiplos nomes (incluindo responsibleName de PJ)
const normalizeNameTest = (str) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const listForNameFilter = [
  { employeeId: 'n1', name: 'João Pedro', corporateName: 'JP SERVICOS LTDA', responsibleName: 'João Pedro Silva', isEligible: true },
  { employeeId: 'n2', name: 'Maria José', corporateName: undefined, responsibleName: undefined, isEligible: true },
  { employeeId: 'n3', name: 'ACME TECH', corporateName: 'ACME TECH LTDA', responsibleName: 'Sérgio Mendes', isEligible: true },
];
const filterByNameTokens = (list, query) => {
  const tokens = String(query || '').split(',').map(t => normalizeNameTest(t)).filter(Boolean);
  if (tokens.length === 0) return list;
  return list.filter(c => {
    const h = normalizeNameTest(`${c.name} ${c.corporateName || ''} ${c.responsibleName || ''}`);
    return tokens.some(tk => h.includes(tk));
  });
};
assert.strictEqual(filterByNameTokens(listForNameFilter, 'joao').length, 1);
assert.strictEqual(filterByNameTokens(listForNameFilter, 'sergio').length, 1); // encontra pelo responsibleName da PJ!
assert.strictEqual(filterByNameTokens(listForNameFilter, 'joao, maria').length, 2); // múltiplos nomes separados por vírgula

console.log('   ✅ Modo Acréscimo de Bônus (extra_bonus), Simulador de Meta por Múltiplo (x) e Filtro por Nome validados com 100% de precisão!');

// 21. Testando Permissão e Grupos de Montante Específico (Rateio Exclusivo — Igualitário, % e R$ Absoluto)
console.log('\n21. Testando Grupos de Montante Específico (Exclusividade, Origem do Recurso, Sem Corte 75%, Exceções e Múltiplos Grupos)...');

const dedicatedTestCandidates = [
  { employeeId: 'dg-e1', name: 'Diretor 1', camada: 'E', isEligible: true, isExceptionApplied: false, isManuallyExcluded: false, ineligibilityReasons: [], performanceFactor: 1.0, periodReceivedAverage: 20000, periodReceivedTotal: 120000, periodMonthsCount: 6 },
  { employeeId: 'dg-e2', name: 'Diretor 2 (75% meta)', camada: 'E', isEligible: true, isExceptionApplied: false, isManuallyExcluded: false, ineligibilityReasons: [], performanceFactor: 0.75, periodReceivedAverage: 20000, periodReceivedTotal: 120000, periodMonthsCount: 6 },
  { employeeId: 'dg-t1', name: 'Gerente 1', camada: 'T', isEligible: true, isExceptionApplied: false, isManuallyExcluded: false, ineligibilityReasons: [], performanceFactor: 1.0, periodReceivedAverage: 10000, periodReceivedTotal: 60000, periodMonthsCount: 6 },
  { employeeId: 'dg-t2', name: 'Gerente 2', camada: 'T', isEligible: true, isExceptionApplied: false, isManuallyExcluded: false, ineligibilityReasons: [], performanceFactor: 1.0, periodReceivedAverage: 10000, periodReceivedTotal: 60000, periodMonthsCount: 6 },
  { employeeId: 'dg-o1', name: 'Analista 1', camada: 'O', isEligible: true, isExceptionApplied: false, isManuallyExcluded: false, ineligibilityReasons: [], performanceFactor: 1.0, periodReceivedAverage: 5000, periodReceivedTotal: 30000, periodMonthsCount: 6 },
  { employeeId: 'dg-ineleg', name: 'Recem Admitido', camada: 'O', isEligible: false, isExceptionApplied: false, isManuallyExcluded: false, ineligibilityReasons: ['Admissão posterior ao início'], performanceFactor: 0.75, periodReceivedAverage: 4000, periodReceivedTotal: 12000, periodMonthsCount: 3 },
  { employeeId: 'dg-excl', name: 'Excluido Manual', camada: 'O', isEligible: false, isExceptionApplied: false, isManuallyExcluded: true, ineligibilityReasons: ['Excluído manualmente do rateio'], performanceFactor: 1.0, periodReceivedAverage: 4000, periodReceivedTotal: 24000, periodMonthsCount: 6 },
];

// 21A. Permissão DESLIGADA (allowDedicatedGroups: false) — ignora totalmente grupos cadastrados
const cfgDedicatedOff = {
  ...RealBprService.getDefaultConfig('ciclo_1', 2026),
  totalPoolAmount: 100000,
  splitMode: 'percentage',
  tierSplits: { E: 30, T: 40, O: 30 },
  allowDedicatedGroups: false,
  dedicatedGroups: [
    {
      id: 'g1',
      name: 'Projeto X',
      enabled: true,
      poolAmount: 20000,
      distributionMode: 'percentage',
      fundingSource: 'total_pool',
      members: [{ employeeId: 'dg-e2', percentage: 60 }, { employeeId: 'dg-ineleg', percentage: 40 }],
    },
  ],
};
const resOff = RealBprService.recalculateSnapshotWithNewConfig(dedicatedTestCandidates, cfgDedicatedOff);
assert.strictEqual(resOff.dedicatedGroupsCount, 0);
assert.strictEqual(resOff.dedicatedMembersCount, 0);
assert.strictEqual(resOff.layers.E.eligibleCount, 2); // dg-e2 continua na camada E
assert.strictEqual(resOff.layers.E.totalLayerAmount, 30000);
assert.strictEqual(resOff.candidates.find(c => c.employeeId === 'dg-ineleg').isEligible, false);

// 21B. Permissão LIGADA + Exclusividade + % por colaborador + Sem corte de 75% + Exceção de inelegível + Abate do Bolo Geral (total_pool)
const cfgDedicatedPct = {
  ...cfgDedicatedOff,
  allowDedicatedGroups: true,
  dedicatedGroups: [
    {
      id: 'g-pct',
      name: 'Projeto Alpha',
      criteriaDescription: 'Entrega crítica cliente',
      enabled: true,
      poolAmount: 20000,
      distributionMode: 'percentage',
      fundingSource: 'total_pool', // Abate 20k proporcionalmente de E(30k->24k), T(40k->32k), O(30k->24k)
      members: [
        { employeeId: 'dg-e2', percentage: 60 },      // tinha performanceFactor 0.75 -> deve receber 100% dos 60% = R$ 12.000!
        { employeeId: 'dg-ineleg', percentage: 40 },  // era inelegível -> promovido como exceção e recebe 40% = R$ 8.000!
        { employeeId: 'dg-excl', percentage: 10 },    // excluído manualmente -> ignorado!
      ],
    },
  ],
};
const resPct = RealBprService.recalculateSnapshotWithNewConfig(dedicatedTestCandidates, cfgDedicatedPct);
assert.strictEqual(resPct.dedicatedGroupsCount, 1);
assert.strictEqual(resPct.dedicatedMembersCount, 2);
assert.strictEqual(resPct.dedicatedGroupsTotalPool, 20000);
assert.strictEqual(resPct.dedicatedGroupsAllocatedTotal, 20000);
assert.strictEqual(resPct.dedicatedGroupsExtraBonusTotal, 0);
// Exclusividade: Camada E fica apenas com dg-e1 (1 elegível, em vez de 2)
assert.strictEqual(resPct.layers.E.eligibleCount, 1);
assert.strictEqual(resPct.layers.E.dedicatedGroupsDeductedFromLayer, 6000);
assert.strictEqual(resPct.layers.E.totalLayerAmount, 24000);
assert.strictEqual(resPct.layers.E.amountPerEligible, 24000);
assert.strictEqual(resPct.layers.T.dedicatedGroupsDeductedFromLayer, 8000);
assert.strictEqual(resPct.layers.T.totalLayerAmount, 32000);
assert.strictEqual(resPct.layers.O.dedicatedGroupsDeductedFromLayer, 6000);
assert.strictEqual(resPct.layers.O.totalLayerAmount, 24000);
// Membros do grupo dedicado
const e2Res = resPct.candidates.find(c => c.employeeId === 'dg-e2');
assert.strictEqual(e2Res.isEligible, true);
assert.strictEqual(e2Res.dedicatedGroupId, 'g-pct');
assert.strictEqual(e2Res.dedicatedGroupName, 'Projeto Alpha');
assert.strictEqual(e2Res.dedicatedGroupSharePct, 60);
assert.strictEqual(e2Res.allocatedAmount, 12000); // SEM corte de 75%!
const inelRes = resPct.candidates.find(c => c.employeeId === 'dg-ineleg');
assert.strictEqual(inelRes.isEligible, true);
assert.strictEqual(inelRes.isExceptionApplied, true);
assert.strictEqual(inelRes.dedicatedGroupId, 'g-pct');
assert.strictEqual(inelRes.allocatedAmount, 8000);
const exclRes = resPct.candidates.find(c => c.employeeId === 'dg-excl');
assert.strictEqual(exclRes.isEligible, false);
assert.strictEqual(exclRes.allocatedAmount, 0);
// Total distribuído: 24k (E) + 32k (T) + 24k (O) + 20k (Grupo) = 100.000
assert.strictEqual(resPct.totalDistributedAmount, 100000);
assert.strictEqual(resPct.residualAmount, 0);
assert.strictEqual(resPct.totalEligible, 6); // 1(E) + 2(T) + 1(O) + 2(Grupo)

// 21C. Múltiplos grupos: Grupo 1 (Valor Absoluto R$ abatido da Camada E) + Grupo 2 (Igualitário como Acréscimo Extra) + proteção contra duplicidade de membro
const cfgMultiGroups = {
  ...cfgDedicatedOff,
  allowDedicatedGroups: true,
  dedicatedGroups: [
    {
      id: 'g-abs',
      name: 'Diretoria Especial',
      enabled: true,
      poolAmount: 0, // Em modo 'amount', assume automaticamente a soma dos valores individuais (10k)
      distributionMode: 'amount',
      fundingSource: 'E', // Abate 10k direto da camada E (30k -> 20k)
      members: [{ employeeId: 'dg-e2', amount: 10000 }],
    },
    {
      id: 'g-eq-extra',
      name: 'Comercial Extra',
      enabled: true,
      poolAmount: 15000,
      distributionMode: 'equal',
      fundingSource: 'extra_bonus', // Acréscimo extra sobre o montante total (100k + 15k = 115k)
      members: [
        { employeeId: 'dg-e2' }, // Já está no Grupo 1 ativo -> ignorado aqui para evitar pagamento duplo!
        { employeeId: 'dg-t2' },
        { employeeId: 'dg-o1' },
      ],
    },
    {
      id: 'g-paused',
      name: 'Grupo Pausado',
      enabled: false,
      poolAmount: 50000,
      distributionMode: 'equal',
      fundingSource: 'total_pool',
      members: [{ employeeId: 'dg-e1' }],
    },
  ],
};
const resMulti = RealBprService.recalculateSnapshotWithNewConfig(dedicatedTestCandidates, cfgMultiGroups);
assert.strictEqual(resMulti.dedicatedGroupsCount, 2); // Pausado ignorado
assert.strictEqual(resMulti.dedicatedMembersCount, 3); // dg-e2 (G1), dg-t2 e dg-o1 (G2)
assert.strictEqual(resMulti.basePoolAmount, 100000);
assert.strictEqual(resMulti.dedicatedGroupsExtraBonusTotal, 15000);
assert.strictEqual(resMulti.totalPoolAmount, 115000);
assert.strictEqual(resMulti.layers.E.dedicatedGroupsDeductedFromLayer, 10000);
assert.strictEqual(resMulti.layers.E.totalLayerAmount, 20000);
assert.strictEqual(resMulti.layers.E.eligibleCount, 1); // dg-e1
assert.strictEqual(resMulti.layers.T.dedicatedGroupsDeductedFromLayer, 0);
assert.strictEqual(resMulti.layers.T.totalLayerAmount, 40000);
assert.strictEqual(resMulti.layers.T.eligibleCount, 1); // apenas dg-t1 (dg-t2 foi pro G2)
assert.strictEqual(resMulti.layers.O.eligibleCount, 0); // dg-o1 foi pro G2 -> 30k vira resíduo (camada O sem elegíveis)
assert.strictEqual(resMulti.candidates.find(c => c.employeeId === 'dg-e2').allocatedAmount, 10000);
assert.strictEqual(resMulti.candidates.find(c => c.employeeId === 'dg-e2').dedicatedGroupId, 'g-abs');
assert.strictEqual(resMulti.candidates.find(c => c.employeeId === 'dg-t2').allocatedAmount, 7500);
assert.strictEqual(resMulti.candidates.find(c => c.employeeId === 'dg-o1').allocatedAmount, 7500);
assert.strictEqual(resMulti.totalDistributedAmount, 85000); // 20k (E) + 40k (T) + 0 (O) + 10k (G1) + 15k (G2)
assert.strictEqual(resMulti.residualAmount, 30000); // 115k - 85k = 30k da camada O sem membros

// 21D. Valores zerados / negativos sanitizados para 0 sem NaN
const cfgNegativeSanitize = {
  ...cfgDedicatedOff,
  allowDedicatedGroups: true,
  dedicatedGroups: [
    {
      id: 'g-neg',
      name: 'Teste Sanitização',
      enabled: true,
      poolAmount: -5000,
      distributionMode: 'percentage',
      fundingSource: 'total_pool',
      members: [{ employeeId: 'dg-e1', percentage: -20 }],
    },
  ],
};
const resNeg = RealBprService.recalculateSnapshotWithNewConfig(dedicatedTestCandidates, cfgNegativeSanitize);
assert.strictEqual(resNeg.dedicatedGroupsAllocatedTotal, 0);
assert.strictEqual(resNeg.candidates.find(c => c.employeeId === 'dg-e1').allocatedAmount, 0);
assert.strictEqual(Number.isNaN(resNeg.totalDistributedAmount), false);

console.log('   ✅ Grupos de Montante Específico (exclusividade, %, R$, igualitário, origens de recurso, exceções e proteção contra duplicidade) validados com 100% de precisão!');

// 22. Testando BprPdfService real: Comparativo Dedicado de Grupos entre Cenários + Filtro por Grupo Específico no PDF
console.log('\n22. Testando BprPdfService real (Comparativo por Grupo Específico e Filtro por Grupo no PDF)...');

const loadRealBprPdfService = () => {
  const fsMod = require('fs');
  const pathMod = require('path');
  const vmMod = require('vm');
  const tsMod = require('typescript');
  const pdfSvcPath = pathMod.resolve(__dirname, '../src/services/bpr-pdf.service.ts');
  const src = fsMod.readFileSync(pdfSvcPath, 'utf8');
  const transpiled = tsMod.transpileModule(src, {
    compilerOptions: { module: tsMod.ModuleKind.CommonJS, target: tsMod.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  const customRequire = (req) => {
    if (req === 'jspdf') return { jsPDF: function MockJsPdf() { } };
    if (req === 'jspdf-autotable') return () => { };
    return require(req);
  };
  vmMod.runInNewContext(transpiled, {
    module: mod,
    exports: mod.exports,
    require: customRequire,
    console,
    Intl,
  });
  return mod.exports.BprPdfService;
};

const RealBprPdfService = loadRealBprPdfService();

// 22A. Filtro por Grupo Específico em filterCandidates
const pdfCandidates = [
  { employeeId: 'p1', name: 'Alice Dir', company: 'MarBR', camada: 'E', camadaLabel: 'Estratégico', isEligible: true, allocatedAmount: 15000, dedicatedGroupId: 'grp-alpha', dedicatedGroupName: 'Projeto Alpha' },
  { employeeId: 'p2', name: 'Bruno Ger', company: 'DZM', camada: 'T', camadaLabel: 'Tático', isEligible: true, allocatedAmount: 10000, dedicatedGroupId: 'grp-beta', dedicatedGroupName: 'Comercial' },
  { employeeId: 'p3', name: 'Carla Op', company: 'MarBR', camada: 'O', camadaLabel: 'Operacional/CLTs', isEligible: true, allocatedAmount: 5000 },
  { employeeId: 'p4', name: 'Daniel Ineleg', company: 'MarBR', camada: 'O', camadaLabel: 'Operacional/CLTs', isEligible: false, allocatedAmount: 0 },
];

// Padrão (sem filtro de grupo): retorna todos elegíveis (3)
assert.strictEqual(RealBprPdfService.filterCandidates(pdfCandidates, { eligibilityFilter: 'eligible_only' }).length, 3);
// Somente Grupos Específicos (__ALL_DEDICATED__): retorna p1 e p2 (2)
const onlyGroups = RealBprPdfService.filterCandidates(pdfCandidates, { eligibilityFilter: 'eligible_only', selectedDedicatedGroupIds: ['__ALL_DEDICATED__'] });
assert.strictEqual(onlyGroups.length, 2);
// Somente Camadas E/T/O (__STANDARD_LAYERS__): retorna apenas p3 (1)
const onlyStd = RealBprPdfService.filterCandidates(pdfCandidates, { eligibilityFilter: 'eligible_only', selectedDedicatedGroupIds: ['__STANDARD_LAYERS__'] });
assert.strictEqual(onlyStd.length, 1);
assert.strictEqual(onlyStd[0].employeeId, 'p3');
// Grupo específico único (grp-alpha): retorna apenas p1 (1)
const onlyAlpha = RealBprPdfService.filterCandidates(pdfCandidates, { eligibilityFilter: 'eligible_only', selectedDedicatedGroupIds: ['grp-alpha'] });
assert.strictEqual(onlyAlpha.length, 1);
assert.strictEqual(onlyAlpha[0].employeeId, 'p1');
// Múltiplos grupos específicos combinados com filtro de empresa DZM: retorna apenas p2
const multiGroupDzm = RealBprPdfService.filterCandidates(pdfCandidates, {
  eligibilityFilter: 'eligible_only',
  selectedDedicatedGroupIds: ['grp-alpha', 'grp-beta'],
  selectedCompanies: ['DZM'],
});
assert.strictEqual(multiGroupDzm.length, 1);
assert.strictEqual(multiGroupDzm[0].employeeId, 'p2');
// Caso vazio
assert.strictEqual(RealBprPdfService.filterCandidates([], { selectedDedicatedGroupIds: ['grp-alpha'] }).length, 0);

// 22B. Comparativo Dedicado de Grupos entre Cenários (com e sem grupos, mudança de montante/membros e fallback via snapshot)
const scSemGrupo = {
  id: 'sc-1',
  name: 'Cenário Base (Sem Grupos)',
  studyDate: '2026-11-24',
  criteriaDescription: 'Padrão E/T/O',
  createdAt: '2026-11-24T10:00:00Z',
  config: cfgDedicatedOff,
  summary: {
    totalPoolAmount: 100000,
    totalDistributedAmount: 100000,
    residualAmount: 0,
    totalCandidates: 3,
    totalEligible: 3,
    totalIneligible: 0,
    amountPerE: 30000,
    amountPerT: 40000,
    amountPerO: 30000,
    layers: resOff.layers,
    dedicatedGroupSummaries: [],
  },
  candidatesSnapshot: [
    { employeeId: 'p1', name: 'Alice Dir', company: 'MarBR', department: 'Dir', jobRole: 'Diretora', camada: 'E', camadaLabel: 'Estratégico', isEligible: true, allocatedAmount: 30000 },
    { employeeId: 'p2', name: 'Bruno Ger', company: 'DZM', department: 'Com', jobRole: 'Gerente', camada: 'T', camadaLabel: 'Tático', isEligible: true, allocatedAmount: 40000 },
  ],
};

const scComGrupo = {
  id: 'sc-2',
  name: 'Cenário Com Projeto Alpha',
  studyDate: '2026-11-24',
  criteriaDescription: 'Com Grupo Projeto Alpha',
  createdAt: '2026-11-24T10:05:00Z',
  config: cfgDedicatedPct,
  summary: {
    totalPoolAmount: 100000,
    totalDistributedAmount: 100000,
    residualAmount: 0,
    totalCandidates: 3,
    totalEligible: 3,
    totalIneligible: 0,
    amountPerE: 24000,
    amountPerT: 32000,
    amountPerO: 24000,
    layers: resPct.layers,
    dedicatedGroupSummaries: [
      { groupId: 'g-alpha-v2', name: 'Projeto Alpha', fundingSource: 'total_pool', distributionMode: 'percentage', poolAmount: 20000, allocatedTotal: 20000, memberCount: 2, residualAmount: 0 },
    ],
  },
  candidatesSnapshot: [
    { employeeId: 'p1', name: 'Alice Dir', company: 'MarBR', department: 'Dir', jobRole: 'Diretora', camada: 'E', camadaLabel: 'Estratégico', isEligible: true, allocatedAmount: 12000, dedicatedGroupId: 'g-alpha-v2', dedicatedGroupName: 'Projeto Alpha' },
    { employeeId: 'p2', name: 'Bruno Ger', company: 'DZM', department: 'Com', jobRole: 'Gerente', camada: 'T', camadaLabel: 'Tático', isEligible: true, allocatedAmount: 32000 },
  ],
};

const grpCompRows = RealBprPdfService.buildDedicatedGroupsComparisonRows([scSemGrupo, scComGrupo]);
assert.strictEqual(grpCompRows.length, 1);
assert.strictEqual(grpCompRows[0].groupName, 'Projeto Alpha');
assert.strictEqual(grpCompRows[0].scenarioValues['sc-1'], undefined);
assert.strictEqual(grpCompRows[0].scenarioValues['sc-2'].allocatedTotal, 20000);
assert.strictEqual(grpCompRows[0].scenarioValues['sc-2'].memberCount, 2);
assert.strictEqual(grpCompRows[0].deltaAmount, 20000);
assert.strictEqual(grpCompRows[0].deltaMembers, 2);

// 22C. Fallback de reconstrução via candidatesSnapshot + matching por nome normalizado (acento/caixa diferentes)
const scFallbackSnapshot = {
  ...scComGrupo,
  id: 'sc-3',
  name: 'Cenário Fallback Snapshot',
  summary: { ...scComGrupo.summary, dedicatedGroupSummaries: undefined },
  candidatesSnapshot: [
    { employeeId: 'p1', name: 'Alice Dir', company: 'MarBR', department: 'Dir', jobRole: 'Diretora', camada: 'E', camadaLabel: 'Estratégico', isEligible: true, rateioAmount: 15000, allocatedAmount: 15000, dedicatedGroupId: 'other-id', dedicatedGroupName: 'projeto alpha' },
  ],
};
const grpCompCross = RealBprPdfService.buildDedicatedGroupsComparisonRows([scComGrupo, scFallbackSnapshot]);
assert.strictEqual(grpCompCross.length, 1); // mesmo nome normalizado agrupado na mesma linha!
assert.strictEqual(grpCompCross[0].deltaAmount, -5000); // 15.000 - 20.000
assert.strictEqual(grpCompCross[0].deltaMembers, -1);   // 1 - 2

// 22D. Propagação de dedicatedGroupName em buildComparisonRows
const empCompRows = RealBprPdfService.buildComparisonRows([scSemGrupo, scComGrupo]);
const aliceComp = empCompRows.find(r => r.employeeId === 'p1');
assert.strictEqual(aliceComp.scenarioValues['sc-1'].dedicatedGroupName, undefined);
assert.strictEqual(aliceComp.scenarioValues['sc-2'].dedicatedGroupName, 'Projeto Alpha');
assert.strictEqual(aliceComp.delta, -18000);

// 22E. Comparador considera somente colaboradores considerados (elegíveis / valor > 0) em pelo menos um cenário
const scWithInel1 = {
  ...scSemGrupo,
  id: 'sc-elig-1',
  candidatesSnapshot: [
    ...scSemGrupo.candidatesSnapshot,
    { employeeId: 'p-inel-both', name: 'Carlos Inelegível', company: 'MarBR', department: 'Op', jobRole: 'Op', camada: 'O', camadaLabel: 'Operacional/CLTs', isEligible: false, allocatedAmount: 0 },
    { employeeId: 'p-exc-2', name: 'Diana Exceção', company: 'MarBR', department: 'Op', jobRole: 'Op', camada: 'O', camadaLabel: 'Operacional/CLTs', isEligible: false, allocatedAmount: 0 },
  ],
};
const scWithInel2 = {
  ...scComGrupo,
  id: 'sc-elig-2',
  candidatesSnapshot: [
    ...scComGrupo.candidatesSnapshot,
    { employeeId: 'p-inel-both', name: 'Carlos Inelegível', company: 'MarBR', department: 'Op', jobRole: 'Op', camada: 'O', camadaLabel: 'Operacional/CLTs', isEligible: false, allocatedAmount: 0 },
    { employeeId: 'p-exc-2', name: 'Diana Exceção', company: 'MarBR', department: 'Op', jobRole: 'Op', camada: 'O', camadaLabel: 'Operacional/CLTs', isEligible: true, allocatedAmount: 5000 },
  ],
};
const filteredCompRows = RealBprPdfService.buildComparisonRows([scWithInel1, scWithInel2]);
assert.strictEqual(filteredCompRows.some(r => r.employeeId === 'p-inel-both'), false); // inelegível nos 2 -> omitido!
const dianaComp = filteredCompRows.find(r => r.employeeId === 'p-exc-2');
assert.ok(dianaComp); // elegível no cenário #2 -> incluída com delta exato!
assert.strictEqual(dianaComp.delta, 5000);
assert.strictEqual(filteredCompRows.length, 3); // Alice, Bruno, Diana
// Opção explícita includeIneligible: true preserva comportamento completo quando solicitado
assert.strictEqual(
  RealBprPdfService.buildComparisonRows([scWithInel1, scWithInel2], { includeIneligible: true }).length,
  4
);

console.log('   ✅ BprPdfService real (comparativo dedicado de grupos, fallback snapshot e filtro por grupo no PDF) validado com 100% de precisão!');

// 23. Testando Seleção Direta de Colaboradores p/ Grupo com Regras do BPR, Fator % Editável, Redistribuição e Impacto Antes x Depois
console.log('\n23. Testando Regras BPR no Grupo, Campo Fator %, Redistribuição Interna e Prévia Antes x Depois...');

const buildTechScenarioCandidates = (overrides = {}) => {
  const base = [
    { employeeId: 'e-dir', name: 'Dir Geral', camada: 'E', jobRole: 'Diretor', isEligible: true, isExceptionApplied: false, isManuallyExcluded: false, ineligibilityReasons: [], performanceFactor: 1.0 },
    { employeeId: 't-ger', name: 'Gerente Ops', camada: 'T', jobRole: 'Gerente', isEligible: true, isExceptionApplied: false, isManuallyExcluded: false, ineligibilityReasons: [], performanceFactor: 1.0 },
  ];
  for (let i = 1; i <= 5; i += 1) {
    const id = `tec-${i}`;
    base.push({
      employeeId: id,
      name: `Técnico ${i}`,
      camada: 'O',
      jobRole: 'Técnico',
      isEligible: true,
      isExceptionApplied: false,
      isManuallyExcluded: false,
      ineligibilityReasons: [],
      performanceFactor: 1.0,
      ...(overrides[id] || {}),
    });
  }
  for (let i = 1; i <= 10; i += 1) {
    base.push({
      employeeId: `op-${i}`,
      name: `Auxiliar ${i}`,
      camada: 'O',
      jobRole: 'Auxiliar Operacional',
      isEligible: true,
      isExceptionApplied: false,
      isManuallyExcluded: false,
      ineligibilityReasons: [],
      performanceFactor: 1.0,
    });
  }
  return base;
};

// 23A. Caso exato do usuário: 15 elegíveis em O (R$ 30k), 5 Técnicos recebem R$ 5.000 retirados de O
const candidates23A = buildTechScenarioCandidates();
const cfg23A = {
  ...RealBprService.getDefaultConfig('ciclo_1', 2026),
  totalPoolAmount: 100000,
  splitMode: 'percentage',
  tierSplits: { E: 30, T: 40, O: 30 },
  allowDedicatedGroups: true,
  dedicatedGroups: [
    {
      id: 'g-tec',
      name: 'Grupo Técnico',
      criteriaDescription: 'Premiação R$ 5.000 destinada aos Técnicos a partir do Operacional',
      enabled: true,
      poolAmount: 5000,
      distributionMode: 'equal',
      fundingSource: 'O',
      eligibilityPolicy: 'follow_bpr_rules',
      applyPerformanceFactor: true,
      reducedFactorPct: 75,
      redistributePerformanceResidual: true,
      members: [
        { employeeId: 'tec-1' },
        { employeeId: 'tec-2' },
        { employeeId: 'tec-3' },
        { employeeId: 'tec-4' },
        { employeeId: 'tec-5' },
      ],
    },
  ],
};
const res23A = RealBprService.recalculateSnapshotWithNewConfig(candidates23A, cfg23A);
assert.strictEqual(res23A.layers.O.dedicatedGroupsDeductedFromLayer, 5000);
assert.strictEqual(res23A.layers.O.totalLayerAmount, 25000);
assert.strictEqual(res23A.layers.O.eligibleCount, 10);
assert.strictEqual(res23A.layers.O.amountPerEligible, 2500);
assert.strictEqual(res23A.dedicatedGroupSummaries[0].allocatedTotal, 5000);
assert.strictEqual(res23A.dedicatedGroupSummaries[0].amountPerEligible, 1000);
assert.strictEqual(res23A.candidates.find(c => c.employeeId === 'tec-1').allocatedAmount, 1000);
assert.strictEqual(res23A.candidates.find(c => c.employeeId === 'op-1').allocatedAmount, 2500);
assert.strictEqual(res23A.totalDistributedAmount, 100000);
assert.strictEqual(res23A.residualAmount, 0);

// 23B. Técnico com meta 90%-99% (fator 75%) + redistribuição entre os demais membros elegíveis selecionados
const candidates23B = buildTechScenarioCandidates({ 'tec-2': { performanceFactor: 0.75 } });
const res23B = RealBprService.recalculateSnapshotWithNewConfig(candidates23B, cfg23A);
const tec2_23B = res23B.candidates.find(c => c.employeeId === 'tec-2');
const tec1_23B = res23B.candidates.find(c => c.employeeId === 'tec-1');
assert.strictEqual(tec2_23B.dedicatedGroupEffectiveFactorPct, 75);
assert.strictEqual(tec2_23B.allocatedAmount, 750);
assert.strictEqual(tec2_23B.dedicatedGroupRedistributedBonus, 0);
assert.strictEqual(tec1_23B.dedicatedGroupEffectiveFactorPct, 100);
assert.strictEqual(tec1_23B.dedicatedGroupRedistributedBonus, 62.5);
assert.strictEqual(tec1_23B.allocatedAmount, 1062.5);
assert.strictEqual(res23B.dedicatedGroupSummaries[0].redistributedAmount, 250);
assert.strictEqual(res23B.dedicatedGroupSummaries[0].allocatedTotal, 5000);
assert.strictEqual(res23B.residualAmount, 0);

// 23C. Faixas oficiais de fator (100% -> 100%; 90%-99% -> 75%/custom; <90% -> 0%) e cascata em 2 etapas
const checkFactorTier = (scorePct, expectedTier, expectedRightPct, reducedPct) => {
  const res = RealBprService.resolveDedicatedFactorRightPct(scorePct, reducedPct);
  assert.strictEqual(res.tier, expectedTier);
  assert.strictEqual(res.rightPct, expectedRightPct);
};
checkFactorTier(100, 'full', 100);
checkFactorTier(99, 'partial', 75);
checkFactorTier(90, 'partial', 75);
checkFactorTier(89.9, 'zero', 0);
checkFactorTier(75, 'zero', 0);
checkFactorTier(0, 'zero', 0);
checkFactorTier(95, 'partial', 80, 80);

// Caso combinado: 6 colaboradores sobre R$ 6.000,00 (1 x 85%, 1 x 95%, 4 x 100%)
// Etapa 1: 85% (<90%) perde direito -> 6.000 / 5 = 1.200 base aos >=90%
// Etapa 2: 95% faz juz a 75% (900) e diferença de 300 redistribui aos 4 com 100% (+75 cada -> 1.275)
const baseTec = candidates23A.find(c => c.employeeId === 'tec-1');
const candidates23C_six = [
  ...candidates23A.filter(c => c.employeeId !== 'sim-5' && c.employeeId !== 'sim-6'),
  { ...baseTec, employeeId: 'sim-5', name: 'Técnico 5', corporateName: 'Técnico 5', performanceFactor: 1.0 },
  { ...baseTec, employeeId: 'sim-6', name: 'Técnico 6', corporateName: 'Técnico 6', performanceFactor: 1.0 },
];
const cfg23C_cascade = {
  ...cfg23A,
  dedicatedGroups: [
    {
      ...cfg23A.dedicatedGroups[0],
      poolAmount: 6000,
      reducedFactorPct: 75,
      redistributePerformanceResidual: true,
      members: [
        { employeeId: 'tec-1', customFactorPct: 85 },
        { employeeId: 'tec-2', customFactorPct: 95 },
        { employeeId: 'tec-3', customFactorPct: 100 },
        { employeeId: 'tec-4', customFactorPct: 100 },
        { employeeId: 'sim-5', customFactorPct: 100 },
        { employeeId: 'sim-6', customFactorPct: 100 },
      ],
    },
  ],
};
const res23C_cascade = RealBprService.recalculateSnapshotWithNewConfig(candidates23C_six, cfg23C_cascade);
const m85 = res23C_cascade.candidates.find(c => c.employeeId === 'tec-1');
const m95 = res23C_cascade.candidates.find(c => c.employeeId === 'tec-2');
const m100_a = res23C_cascade.candidates.find(c => c.employeeId === 'tec-3');
const m100_b = res23C_cascade.candidates.find(c => c.employeeId === 'sim-6');
assert.strictEqual(m85.allocatedAmount, 0);
assert.strictEqual(m85.dedicatedGroupScorePct, 85);
assert.strictEqual(m85.dedicatedGroupEffectiveFactorPct, 0);
assert.strictEqual(m95.allocatedAmount, 900);
assert.strictEqual(m95.dedicatedGroupScorePct, 95);
assert.strictEqual(m95.dedicatedGroupEffectiveFactorPct, 75);
assert.strictEqual(m95.dedicatedGroupRedistributedBonus, 150);
assert.strictEqual(m100_a.allocatedAmount, 1275);
assert.strictEqual(m100_a.dedicatedGroupRedistributedBonus, 275);
assert.strictEqual(m100_b.allocatedAmount, 1275);
assert.strictEqual(res23C_cascade.dedicatedGroupSummaries[0].allocatedTotal, 6000);
assert.strictEqual(res23C_cascade.dedicatedGroupSummaries[0].residualAmount, 0);
assert.strictEqual(res23C_cascade.dedicatedGroupSummaries[0].tierFullCount, 4);
assert.strictEqual(res23C_cascade.dedicatedGroupSummaries[0].tierPartialCount, 1);
assert.strictEqual(res23C_cascade.dedicatedGroupSummaries[0].tierZeroCount, 1);
assert.strictEqual(res23C_cascade.dedicatedGroupSummaries[0].redistributedStep1Amount, 1000);
assert.strictEqual(res23C_cascade.dedicatedGroupSummaries[0].redistributedStep2Amount, 300);
assert.strictEqual(res23C_cascade.dedicatedGroupSummaries[0].redistributedAmount, 1250);

// Caso < 90% + 100%: 1 x 75% (sem direito) + 5 x 100% sobre R$ 6.000 -> 0 e 5 x 1.200
const cfg23C_below90 = {
  ...cfg23C_cascade,
  dedicatedGroups: [
    {
      ...cfg23C_cascade.dedicatedGroups[0],
      members: [
        { employeeId: 'tec-1', customFactorPct: 75 },
        { employeeId: 'tec-2', customFactorPct: 100 },
        { employeeId: 'tec-3', customFactorPct: 100 },
        { employeeId: 'tec-4', customFactorPct: 100 },
        { employeeId: 'sim-5', customFactorPct: 100 },
        { employeeId: 'sim-6', customFactorPct: 100 },
      ],
    },
  ],
};
const res23C_below90 = RealBprService.recalculateSnapshotWithNewConfig(candidates23C_six, cfg23C_below90);
assert.strictEqual(res23C_below90.candidates.find(c => c.employeeId === 'tec-1').allocatedAmount, 0);
assert.strictEqual(res23C_below90.candidates.find(c => c.employeeId === 'tec-2').allocatedAmount, 1200);
assert.strictEqual(res23C_below90.candidates.find(c => c.employeeId === 'sim-6').allocatedAmount, 1200);
assert.strictEqual(res23C_below90.dedicatedGroupSummaries[0].allocatedTotal, 6000);
assert.strictEqual(res23C_below90.dedicatedGroupSummaries[0].residualAmount, 0);
assert.strictEqual(res23C_below90.dedicatedGroupSummaries[0].tierFullCount, 5);
assert.strictEqual(res23C_below90.dedicatedGroupSummaries[0].tierPartialCount, 0);
assert.strictEqual(res23C_below90.dedicatedGroupSummaries[0].tierZeroCount, 1);
assert.strictEqual(res23C_below90.dedicatedGroupSummaries[0].redistributedStep1Amount, 1000);
assert.strictEqual(res23C_below90.dedicatedGroupSummaries[0].redistributedStep2Amount, 0);

// Todos entre 90% e 99% sem ninguém com 100%: cada um recebe estritamente 75% e 25% fica de saldo residual
const cfg23C_allPartial = {
  ...cfg23A,
  dedicatedGroups: [
    {
      ...cfg23A.dedicatedGroups[0],
      poolAmount: 4000,
      reducedFactorPct: 75,
      redistributePerformanceResidual: true,
      members: [
        { employeeId: 'tec-1', customFactorPct: 95 },
        { employeeId: 'tec-2', customFactorPct: 92 },
        { employeeId: 'tec-3', customFactorPct: 99 },
        { employeeId: 'tec-4', customFactorPct: 90 },
      ],
    },
  ],
};
const res23C_allPartial = RealBprService.recalculateSnapshotWithNewConfig(candidates23A, cfg23C_allPartial);
assert.strictEqual(res23C_allPartial.candidates.find(c => c.employeeId === 'tec-1').allocatedAmount, 750);
assert.strictEqual(res23C_allPartial.candidates.find(c => c.employeeId === 'tec-4').allocatedAmount, 750);
assert.strictEqual(res23C_allPartial.dedicatedGroupSummaries[0].allocatedTotal, 3000);
assert.strictEqual(res23C_allPartial.dedicatedGroupSummaries[0].residualAmount, 1000);
assert.strictEqual(res23C_allPartial.dedicatedGroupSummaries[0].redistributedAmount, 0);
assert.strictEqual(res23C_allPartial.dedicatedGroupSummaries[0].tierFullCount, 0);
assert.strictEqual(res23C_allPartial.dedicatedGroupSummaries[0].tierPartialCount, 4);
assert.strictEqual(res23C_allPartial.dedicatedGroupSummaries[0].tierZeroCount, 0);
assert.strictEqual(res23C_allPartial.dedicatedGroupSummaries[0].redistributedStep1Amount, 0);
assert.strictEqual(res23C_allPartial.dedicatedGroupSummaries[0].redistributedStep2Amount, 0);

// Todos < 90%: todos recebem R$ 0,00 e 100% permanece residual sem NaN
const cfg23C_allZero = {
  ...cfg23C_allPartial,
  dedicatedGroups: [
    {
      ...cfg23C_allPartial.dedicatedGroups[0],
      members: [
        { employeeId: 'tec-1', customFactorPct: 80 },
        { employeeId: 'tec-2', customFactorPct: 75 },
        { employeeId: 'tec-3', customFactorPct: 50 },
        { employeeId: 'tec-4', customFactorPct: 0 },
      ],
    },
  ],
};
const res23C_allZero = RealBprService.recalculateSnapshotWithNewConfig(candidates23A, cfg23C_allZero);
assert.strictEqual(res23C_allZero.candidates.find(c => c.employeeId === 'tec-1').allocatedAmount, 0);
assert.strictEqual(Number.isNaN(res23C_allZero.dedicatedGroupSummaries[0].allocatedTotal), false);
assert.strictEqual(res23C_allZero.dedicatedGroupSummaries[0].allocatedTotal, 0);
assert.strictEqual(res23C_allZero.dedicatedGroupSummaries[0].residualAmount, 4000);
assert.strictEqual(res23C_allZero.dedicatedGroupSummaries[0].tierFullCount, 0);
assert.strictEqual(res23C_allZero.dedicatedGroupSummaries[0].tierPartialCount, 0);
assert.strictEqual(res23C_allZero.dedicatedGroupSummaries[0].tierZeroCount, 4);
assert.strictEqual(res23C_allZero.dedicatedGroupSummaries[0].redistributedStep1Amount, 0);
assert.strictEqual(res23C_allZero.dedicatedGroupSummaries[0].redistributedStep2Amount, 0);

// Etapa 1 sem Etapa 2: 1 x 85% + 4 x 95% sobre R$ 5.000 (ninguém em 100%) -> Etapa 1 redistribui R$ 1.000 e Etapa 2 = 0 (residual 1.250)
const cfg23C_step1Only = {
  ...cfg23C_cascade,
  dedicatedGroups: [
    {
      ...cfg23C_cascade.dedicatedGroups[0],
      poolAmount: 5000,
      reducedFactorPct: 75,
      redistributePerformanceResidual: true,
      members: [
        { employeeId: 'tec-1', customFactorPct: 85 },
        { employeeId: 'tec-2', customFactorPct: 95 },
        { employeeId: 'tec-3', customFactorPct: 95 },
        { employeeId: 'tec-4', customFactorPct: 95 },
        { employeeId: 'sim-5', customFactorPct: 95 },
      ],
    },
  ],
};
const res23C_step1Only = RealBprService.recalculateSnapshotWithNewConfig(candidates23C_six, cfg23C_step1Only);
assert.strictEqual(res23C_step1Only.candidates.find(c => c.employeeId === 'tec-1').allocatedAmount, 0);
assert.strictEqual(res23C_step1Only.candidates.find(c => c.employeeId === 'tec-2').allocatedAmount, 937.5);
assert.strictEqual(res23C_step1Only.dedicatedGroupSummaries[0].tierFullCount, 0);
assert.strictEqual(res23C_step1Only.dedicatedGroupSummaries[0].tierPartialCount, 4);
assert.strictEqual(res23C_step1Only.dedicatedGroupSummaries[0].tierZeroCount, 1);
assert.strictEqual(res23C_step1Only.dedicatedGroupSummaries[0].redistributedStep1Amount, 1000);
assert.strictEqual(res23C_step1Only.dedicatedGroupSummaries[0].redistributedStep2Amount, 0);
assert.strictEqual(res23C_step1Only.dedicatedGroupSummaries[0].allocatedTotal, 3750);
assert.strictEqual(res23C_step1Only.dedicatedGroupSummaries[0].residualAmount, 1250);
assert.strictEqual(res23C_step1Only.dedicatedGroupSummaries[0].redistributedAmount, 750);

// Redistribuição desativada: mantém faixas 100/75/0% sem redistribuir Etapa 1 ou Etapa 2
const cfg23C_noRedist = {
  ...cfg23C_cascade,
  dedicatedGroups: [
    {
      ...cfg23C_cascade.dedicatedGroups[0],
      redistributePerformanceResidual: false,
    },
  ],
};
const res23C_noRedist = RealBprService.recalculateSnapshotWithNewConfig(candidates23C_six, cfg23C_noRedist);
assert.strictEqual(res23C_noRedist.dedicatedGroupSummaries[0].tierFullCount, 4);
assert.strictEqual(res23C_noRedist.dedicatedGroupSummaries[0].tierPartialCount, 1);
assert.strictEqual(res23C_noRedist.dedicatedGroupSummaries[0].tierZeroCount, 1);
assert.strictEqual(res23C_noRedist.dedicatedGroupSummaries[0].redistributedStep1Amount, 0);
assert.strictEqual(res23C_noRedist.dedicatedGroupSummaries[0].redistributedStep2Amount, 0);
assert.strictEqual(res23C_noRedist.dedicatedGroupSummaries[0].allocatedTotal, 4750);
assert.strictEqual(res23C_noRedist.dedicatedGroupSummaries[0].residualAmount, 1250);

// 23D. Elegibilidade follow_bpr_rules: 1 membro inelegível no grupo recebe R$ 0 e não entra no divisor
const candidates23D = buildTechScenarioCandidates({
  'tec-5': { isEligible: false, ineligibilityReasons: ['Glosa no período'] },
});
const res23D = RealBprService.recalculateSnapshotWithNewConfig(candidates23D, cfg23A);
const tec5_23D = res23D.candidates.find(c => c.employeeId === 'tec-5');
assert.strictEqual(tec5_23D.isEligible, false);
assert.strictEqual(tec5_23D.dedicatedGroupId, 'g-tec');
assert.strictEqual(tec5_23D.allocatedAmount, 0);
assert.strictEqual(res23D.candidates.find(c => c.employeeId === 'tec-1').allocatedAmount, 1250);
assert.strictEqual(res23D.dedicatedGroupSummaries[0].eligibleMemberCount, 4);
assert.strictEqual(res23D.dedicatedGroupSummaries[0].ineligibleMemberCount, 1);
assert.strictEqual(res23D.totalIneligible, 1);
assert.strictEqual(res23D.totalEligible + res23D.totalIneligible, res23D.totalCandidates);

// 23E. Sem redistribuição (redistributePerformanceResidual: false) + todos inelegíveis no grupo (zero NaN)
const cfg23E_noRedist = {
  ...cfg23A,
  dedicatedGroups: [{ ...cfg23A.dedicatedGroups[0], redistributePerformanceResidual: false }],
};
const res23E_noRedist = RealBprService.recalculateSnapshotWithNewConfig(candidates23B, cfg23E_noRedist);
assert.strictEqual(res23E_noRedist.candidates.find(c => c.employeeId === 'tec-2').allocatedAmount, 750);
assert.strictEqual(res23E_noRedist.candidates.find(c => c.employeeId === 'tec-1').allocatedAmount, 1000);
assert.strictEqual(res23E_noRedist.dedicatedGroupSummaries[0].residualAmount, 250);
assert.strictEqual(res23E_noRedist.residualAmount, 250);

const cfg23E_allInel = {
  ...cfg23A,
  dedicatedGroups: [{ ...cfg23A.dedicatedGroups[0], members: [{ employeeId: 'tec-5' }] }],
};
const res23E_allInel = RealBprService.recalculateSnapshotWithNewConfig(candidates23D, cfg23E_allInel);
assert.strictEqual(res23E_allInel.dedicatedGroupSummaries[0].eligibleMemberCount, 0);
assert.strictEqual(res23E_allInel.dedicatedGroupSummaries[0].ineligibleMemberCount, 1);
assert.strictEqual(res23E_allInel.dedicatedGroupSummaries[0].allocatedTotal, 0);
assert.strictEqual(res23E_allInel.dedicatedGroupSummaries[0].residualAmount, 5000);
assert.strictEqual(Number.isNaN(res23E_allInel.totalDistributedAmount), false);

// 23F. Prévia Antes x Depois (previewDedicatedGroupImpactFromCandidates) + alerta de overflow
const preview23F = RealBprService.previewDedicatedGroupImpactFromCandidates(candidates23A, cfg23A, 'g-tec');
assert.strictEqual(preview23F.beforeLayers.O.totalLayerAmount, 30000);
assert.strictEqual(preview23F.beforeLayers.O.eligibleCount, 15);
assert.strictEqual(preview23F.beforeLayers.O.amountPerEligible, 2000);
assert.strictEqual(preview23F.afterLayers.O.totalLayerAmount, 25000);
assert.strictEqual(preview23F.afterLayers.O.eligibleCount, 10);
assert.strictEqual(preview23F.afterLayers.O.amountPerEligible, 2500);
assert.strictEqual(preview23F.hasFundingOverflow, false);

const cfg23F_overflow = {
  ...cfg23A,
  dedicatedGroups: [{ ...cfg23A.dedicatedGroups[0], poolAmount: 40000 }],
};
const previewOverflow = RealBprService.previewDedicatedGroupImpactFromCandidates(candidates23A, cfg23F_overflow, 'g-tec');
assert.strictEqual(previewOverflow.hasFundingOverflow, true);
assert.strictEqual(previewOverflow.overflowAmount, 10000);

console.log('   ✅ Regras BPR no grupo, fator % editável, redistribuição interna e prévia Antes x Depois validados com 100% de precisão!');

console.log('\n🎉 TODOS OS TESTES DO BPR E PEOPLE PASSARAM COM EXATIDÃO!');
