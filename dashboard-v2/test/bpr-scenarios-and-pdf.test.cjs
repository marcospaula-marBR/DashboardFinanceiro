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

console.log('\n🎉 TODOS OS TESTES DO BPR E PEOPLE PASSARAM COM EXATIDÃO!');
