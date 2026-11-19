const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadOmiePjService() {
  const filePath = path.resolve(__dirname, '../src/services/people-omie-pj-reconciliation.service.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require,
    console,
    Intl,
    Date,
    Math,
    Number,
    String,
    Set,
    Map,
    Array,
    Object,
    parseInt,
    isNaN,
    Boolean,
  };
  vm.runInNewContext(transpiled.outputText, sandbox, { filename: filePath });
  return mod.exports;
}

const svc = loadOmiePjService();
const {
  getOmieDateWindowForCompetencia,
  classifyOmiePjCategory,
  normalizeCompanyKey,
  matchOmieTitleToPjEmployee,
  reconcileOmieTitlesForPj,
} = svc;

console.log('=== TESTES UNITÁRIOS: CONCILIAÇÃO AUTOMÁTICA PJ/MEI VIA OMIE ===\n');

// 1. Janela de datas Omie (mesmo mês, mês seguinte, virada de ano e inválido)
console.log('1. getOmieDateWindowForCompetencia (same_month_due, next_month_due, virada de ano, inválido)...');
const wSame = getOmieDateWindowForCompetencia('2026-10', 'same_month_due');
assert.strictEqual(wSame.competenciaNormalized, '2026-10-01');
assert.strictEqual(wSame.startDate, '2026-10-01');
assert.strictEqual(wSame.endDate, '2026-10-31');

const wNext = getOmieDateWindowForCompetencia('2026-12-01', 'next_month_due');
assert.strictEqual(wNext.competenciaNormalized, '2026-12-01');
assert.strictEqual(wNext.startDate, '2027-01-01');
assert.strictEqual(wNext.endDate, '2027-01-31');

const wFeb = getOmieDateWindowForCompetencia('2026-02', 'same_month_due');
assert.strictEqual(wFeb.endDate, '2026-02-28');

assert.strictEqual(getOmieDateWindowForCompetencia('invalido', 'same_month_due').startDate, '');
console.log('   OK!');

// 2. Classificação de categorias reais do Omie para buckets B2B
console.log('2. classifyOmiePjCategory (categorias reais Omie -> buckets B2B)...');
assert.strictEqual(classifyOmiePjCategory('Credenciado Operacional'), 'honorarios');
assert.strictEqual(classifyOmiePjCategory('Credenciado Administrativo'), 'honorarios');
assert.strictEqual(classifyOmiePjCategory('Credenciado TI'), 'honorarios');
assert.strictEqual(classifyOmiePjCategory('Eventual - PJ'), 'honorarios');
assert.strictEqual(classifyOmiePjCategory('Bônus Contratual - Credenciados'), 'bonus');
assert.strictEqual(classifyOmiePjCategory('Comissões'), 'comissao');
assert.strictEqual(classifyOmiePjCategory('Incentivo Veicular'), 'incentivos');
assert.strictEqual(classifyOmiePjCategory('Conectividade'), 'conectividade');
assert.strictEqual(classifyOmiePjCategory('Glosa Contratual'), 'deducoes');
assert.strictEqual(normalizeCompanyKey('Mar Brasil'), 'MarBR');
assert.strictEqual(normalizeCompanyKey('D.Z.M. LTDA'), 'DZM');
console.log('   OK!');

// 3. Matching hierárquico: CNPJ > Razão Social > Similaridade
console.log('3. matchOmieTitleToPjEmployee (CNPJ exato, Razão Social exata e Similaridade)...');
const pjEmps = [
  {
    id: 'pj-1',
    name: 'Carlos Silva',
    corporate_name: 'SILVA CONSULTORIA TECNOLOGICA LTDA',
    company: 'MarBR',
    linkType: 'PJ',
    pj_type: '12.345.678/0001-90',
    remuneration_fixed: 4000,
    status: 'Ativo',
  },
  {
    id: 'pj-2',
    name: 'Ana Souza',
    corporate_name: 'ANA SOUZA DESIGN CREATIVE MEI',
    company: 'DZM',
    linkType: 'MEI',
    pj_type: '98.765.432/0001-11',
    remuneration_fixed: 3000,
    status: 'Ativo',
  },
  {
    id: 'pj-3',
    name: 'Pedro Alves',
    corporate_name: 'ALVES ENGENHARIA E GESTAO LTDA',
    company: 'MarBR',
    linkType: 'PJ',
    pj_type: '55.444.333/0001-22',
    remuneration_fixed: 5000,
    status: 'Ativo',
  },
  {
    id: 'pj-inactive',
    name: 'Antigo PJ',
    corporate_name: 'ANTIGA PRESTADORA LTDA',
    company: 'MarBR',
    linkType: 'PJ',
    pj_type: '11.111.111/0001-11',
    remuneration_fixed: 2000,
    status: 'Inativo',
  },
  {
    id: 'clt-1',
    name: 'Empregado CLT',
    company: 'DZM',
    linkType: 'CLT',
    remuneration_fixed: 2000,
    status: 'Ativo',
  },
];

const mCnpj = matchOmieTitleToPjEmployee(
  { empresa_nome: 'Mar Brasil', cliente_fornecedor: 'NOME DIVERGENTE', raw_data: { detalhes: { cCPFCNPJCliente: '12.345.678/0001-90' } } },
  pjEmps
);
assert.strictEqual(mCnpj.employee.id, 'pj-1');
assert.strictEqual(mCnpj.method, 'CNPJ');

const mRazao = matchOmieTitleToPjEmployee(
  { empresa_nome: 'DZM', cliente_fornecedor: 'ANA SOUZA DESIGN CREATIVE MEI' },
  pjEmps
);
assert.strictEqual(mRazao.employee.id, 'pj-2');
assert.strictEqual(mRazao.method, 'RAZAO_SOCIAL');

const mSim = matchOmieTitleToPjEmployee(
  { empresa_nome: 'Mar Brasil', cliente_fornecedor: 'SILVA CONSULTORIA TECNOLOGICA EIRELI' },
  pjEmps
);
assert.strictEqual(mSim.employee.id, 'pj-1');
assert.strictEqual(mSim.method, 'SIMILARIDADE');

assert.strictEqual(
  matchOmieTitleToPjEmployee({ empresa_nome: 'Mar Brasil', cliente_fornecedor: 'EMPRESA COMPLETAMENTE DESCONHECIDA LTDA' }, pjEmps),
  null
);
console.log('   OK!');

// 4. Conciliação completa com valores negativos Omie, rateio multi-linha, cancelados, divergência contratual e sem título
console.log('4. reconcileOmieTitlesForPj (valores negativos, rateio, cancelados, paid_only, divergência e unmatchedActivePjs)...');
const sampleOmieRows = [
  // PJ-1: Título rateado em 2 departamentos (mesmo omie_id 1001): -2400 + -1600 = 4000 honorários
  {
    omie_id: 1001,
    empresa_nome: 'Mar Brasil',
    tipo_registro: 'PAGAR',
    status: 'PAGO',
    valor_total: -4000,
    valor_alocado: -2400,
    data_vencimento: '2026-10-05',
    data_pagamento: '2026-10-05',
    categoria_nome: 'Credenciado TI',
    cliente_fornecedor: 'SILVA CONSULTORIA TECNOLOGICA LTDA',
  },
  {
    omie_id: 1001,
    empresa_nome: 'Mar Brasil',
    tipo_registro: 'PAGAR',
    status: 'PAGO',
    valor_total: -4000,
    valor_alocado: -1600,
    data_vencimento: '2026-10-05',
    data_pagamento: '2026-10-05',
    categoria_nome: 'Credenciado TI',
    cliente_fornecedor: 'SILVA CONSULTORIA TECNOLOGICA LTDA',
  },
  // PJ-1: Bônus + Conectividade + Incentivo + Glosa
  {
    omie_id: 1002,
    empresa_nome: 'Mar Brasil',
    tipo_registro: 'PAGAR',
    status: 'PAGO',
    valor_total: -500,
    valor_alocado: -500,
    data_vencimento: '2026-10-05',
    categoria_nome: 'Bônus Contratual - Credenciados',
    cliente_fornecedor: 'SILVA CONSULTORIA TECNOLOGICA LTDA',
  },
  {
    omie_id: 1003,
    empresa_nome: 'Mar Brasil',
    tipo_registro: 'PAGAR',
    status: 'PAGO',
    valor_total: -150,
    valor_alocado: -150,
    data_vencimento: '2026-10-05',
    categoria_nome: 'Conectividade',
    cliente_fornecedor: 'SILVA CONSULTORIA TECNOLOGICA LTDA',
  },
  {
    omie_id: 1004,
    empresa_nome: 'Mar Brasil',
    tipo_registro: 'PAGAR',
    status: 'A VENCER',
    valor_total: -200,
    valor_alocado: -200,
    data_vencimento: '2026-10-20',
    categoria_nome: 'Incentivo Veicular',
    cliente_fornecedor: 'SILVA CONSULTORIA TECNOLOGICA LTDA',
  },
  {
    omie_id: 1005,
    empresa_nome: 'Mar Brasil',
    tipo_registro: 'PAGAR',
    status: 'PAGO',
    valor_total: -100,
    valor_alocado: -100,
    data_vencimento: '2026-10-05',
    categoria_nome: 'Glosa Contratual',
    cliente_fornecedor: 'SILVA CONSULTORIA TECNOLOGICA LTDA',
  },
  // PJ-1: Título CANCELADO (deve ser ignorado!)
  {
    omie_id: 1006,
    empresa_nome: 'Mar Brasil',
    tipo_registro: 'PAGAR',
    status: 'CANCELADO',
    valor_total: -9999,
    valor_alocado: -9999,
    data_vencimento: '2026-10-05',
    categoria_nome: 'Credenciado TI',
    cliente_fornecedor: 'SILVA CONSULTORIA TECNOLOGICA LTDA',
  },
  // PJ-2 (DZM): Divergência contratual (+33.3%: 4000 vs contrato 3000)
  {
    omie_id: 2001,
    empresa_nome: 'DZM',
    tipo_registro: 'PAGAR',
    status: 'PAGO',
    valor_total: -4000,
    valor_alocado: -4000,
    data_vencimento: '2026-10-05',
    categoria_nome: 'Credenciado Administrativo',
    cliente_fornecedor: 'ANA SOUZA DESIGN CREATIVE MEI',
  },
  // Receita (RECEBER) — deve ser ignorada!
  {
    omie_id: 9999,
    empresa_nome: 'Mar Brasil',
    tipo_registro: 'RECEBER',
    status: 'RECEBIDO',
    valor_total: 5000,
    valor_alocado: 5000,
    data_vencimento: '2026-10-05',
    categoria_nome: 'Vendas',
    cliente_fornecedor: 'SILVA CONSULTORIA TECNOLOGICA LTDA',
  },
];

const res = reconcileOmieTitlesForPj(sampleOmieRows, pjEmps, {
  competencia: '2026-09',
  dateMode: 'next_month_due',
  statusFilter: 'all_valid',
  existingCostsInCompetencia: [{ employee_id: 'pj-1', valor_liquido: 4650 }],
});

assert.strictEqual(res.competencia, '2026-09-01');
assert.strictEqual(res.omieWindowStart, '2026-10-01');
assert.strictEqual(res.items.length, 2);

const pj1 = res.items.find((i) => i.employeeId === 'pj-1');
assert.strictEqual(pj1.valor_fixo, 4000, 'Rateio de 2400 + 1600 deve somar exatamente 4000');
assert.strictEqual(pj1.valor_bonus, 500);
assert.strictEqual(pj1.valor_ajuda_custo, 150);
assert.strictEqual(pj1.valor_incentivos, 200);
assert.strictEqual(pj1.valor_bruto_nf, 4850);
assert.strictEqual(pj1.valor_deducoes, 100);
assert.strictEqual(pj1.valor_liquido_nf, 4750);
assert.strictEqual(pj1.titlesCount, 5, 'Deve contar 5 títulos únicos (sem duplicar rateio 1001 e ignorando cancelado 1006)');
assert.strictEqual(pj1.alreadyInDb, true);
assert.strictEqual(pj1.isContractDivergent, false);

const pj2 = res.items.find((i) => i.employeeId === 'pj-2');
assert.strictEqual(pj2.valor_fixo, 4000);
assert.strictEqual(pj2.isContractDivergent, true, '4000 vs contrato 3000 (+33.3%) deve acionar divergência contratual');
assert.strictEqual(res.totals.divergentCount, 1);
assert.strictEqual(res.totals.valorLiquidoNf, 8750);

// PJ-3 ativo sem título deve aparecer em unmatchedActivePjs; pj-inactive e clt-1 NÃO devem aparecer
assert.strictEqual(res.unmatchedActivePjs.length, 1);
assert.strictEqual(res.unmatchedActivePjs[0].employeeId, 'pj-3');

// Filtro paid_only deve excluir o título A VENCER (200 incentivo)
const paidOnlyRes = reconcileOmieTitlesForPj(sampleOmieRows, pjEmps, {
  competencia: '2026-09',
  dateMode: 'next_month_due',
  statusFilter: 'paid_only',
  companyFilter: 'MarBR',
});
assert.strictEqual(paidOnlyRes.items.length, 1);
assert.strictEqual(paidOnlyRes.items[0].valor_incentivos, 0);
assert.strictEqual(paidOnlyRes.items[0].valor_liquido_nf, 4550);

// Caso vazio
const emptyRes = reconcileOmieTitlesForPj([], [], { competencia: '2026-10' });
assert.strictEqual(emptyRes.items.length, 0);
assert.strictEqual(emptyRes.totals.valorLiquidoNf, 0);
console.log('   OK!');

console.log('\n✅ TODOS OS 4 BLOCOS DE TESTES DE CONCILIAÇÃO PJ VIA OMIE PASSARAM COM SUCESSO!');
