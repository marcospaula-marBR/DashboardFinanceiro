const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const targetRel = request.slice(2);
    const tsCandidate = path.resolve(__dirname, '../src', targetRel + '.ts');
    if (fs.existsSync(tsCandidate)) return tsCandidate;
    const dtsCandidate = path.resolve(__dirname, '../src', targetRel + '.d.ts');
    if (fs.existsSync(dtsCandidate)) return dtsCandidate;
    return origResolve.call(this, path.resolve(__dirname, '../src', targetRel), parent, isMain, options);
  }
  return origResolve.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = function (module, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  return module._compile(transpiled.outputText, filename);
};

const {
  DreCaixaService,
  KNOWN_ACCOUNTS,
  CARD_ACCOUNT_IDS,
  isContaCartaoOuBeneficio,
} = require('../src/services/dre-caixa.service.ts');

const { BANK_NAMES_MAP } = require('../src/services/dre-painel.service.ts');

console.log('=== TESTES UNITÁRIOS: CONCILIAÇÃO DE CARTÕES NO DRE CAIXA ===\n');

// 1. Mapeamento completo de contas correntes e cartões across Mar Brasil, DZM, G2 e Conectius
console.log('1. Validando mapeamento completo de KNOWN_ACCOUNTS, CARD_ACCOUNT_IDS e BANK_NAMES_MAP...');
const EXPECTED_13_CARD_IDS = {
  // DZM
  '11376418802': 'Bradesco - Visa 6827 / 1787',
  '11704272090': 'Clara - Prestadores',
  '11672312219': 'Dauren PF - Nubank',
  '11382946596': 'Flash - Prestadores',
  // G2
  '2511653449': 'Bradesco - 6277 / 8112',
  // Mar Brasil
  '7665602672': 'Bradesco - Cartão 8583 / 2192',
  '7669310486': 'Cartão - Sicredi 0137 / 0129',
  '12291364271': 'Clara - Prestadores',
  '7845167362': 'Dauren PF - Nubank',
  '7918604403': 'Diretoria - 1924',
  '7687200485': 'Elo - 9693',
  '7670894051': 'Flash - Prestadores',
  '12340529395': 'Ourocard - 1405',
};

assert.ok(Object.keys(KNOWN_ACCOUNTS).length >= 75, 'KNOWN_ACCOUNTS deve mapear todas as 75 contas das 4 empresas');
for (const [id, expectedName] of Object.entries(EXPECTED_13_CARD_IDS)) {
  assert.strictEqual(KNOWN_ACCOUNTS[id], expectedName, `KNOWN_ACCOUNTS[${id}] incorreto`);
  assert.strictEqual(BANK_NAMES_MAP[id], expectedName, `BANK_NAMES_MAP[${id}] incorreto`);
  assert.ok(CARD_ACCOUNT_IDS.has(id), `CARD_ACCOUNT_IDS deve conter ${id}`);
  assert.strictEqual(isContaCartaoOuBeneficio(expectedName, id), true, `isContaCartaoOuBeneficio(${expectedName}) deve ser true`);
  assert.strictEqual(isContaCartaoOuBeneficio(expectedName), true, `isContaCartaoOuBeneficio pelo nome (${expectedName}) deve ser true`);
}

// 2. Contas que NÃO são cartões de despesa (ex: Recebíveis de Cartão, Omie.CASH, Bradesco CC)
console.log('2. Validando exclusão de falsos positivos (contas correntes e recebíveis de cartão)...');
assert.strictEqual(isContaCartaoOuBeneficio('Omie.CASH'), false);
assert.strictEqual(isContaCartaoOuBeneficio('Omie.CASH (Recebíveis de Cartões)', '11437305971'), false);
assert.strictEqual(isContaCartaoOuBeneficio('Omie.CASH - (Recebíveis de Cartão (Z))', '11758961141'), false);
assert.strictEqual(isContaCartaoOuBeneficio('Bradesco', '7662736722'), false);
assert.strictEqual(isContaCartaoOuBeneficio(''), false);
assert.strictEqual(isContaCartaoOuBeneficio(null), false);

// 3. Reconciliação exata dos 13 cartões de DZM, G2 e Mar Brasil com totais Omie (-R$ 1.212.081,65) + abatimento de estornos EXTR
console.log('3. Validando cálculo líquido (compras + estornos EXTR) e consolidação por empresa/cartão...');
function makeCardItem(overrides) {
  return {
    id: overrides.id || `id-${Math.random()}`,
    empresa: overrides.empresa,
    omie_id: overrides.omie_id || 1,
    tipo: 'PAGAR',
    status: 'PAGO',
    valor: overrides.valor,
    sinal_valor: overrides.sinal_valor !== undefined ? overrides.sinal_valor : -overrides.valor,
    data_pagamento: overrides.data_pagamento || '2026-08-15',
    periodo: overrides.periodo || 'Ago/26',
    periodoNum: overrides.periodoNum || (2026 * 12 + 8),
    projeto: overrides.projeto || 'Operacional / Geral',
    categoria: overrides.categoria || 'Tokens',
    fornecedor_cliente: overrides.fornecedor_cliente || 'Fornecedor Teste',
    conta_corrente: overrides.conta_corrente,
    numero_documento: null,
    numero_parcela: '1/1',
    parcela_atual: 1,
    total_parcelas: 1,
    tipo_pagamento: 'A_VISTA',
    ...overrides,
  };
}

const mock13CardsLancamentos = [
  // DZM = 349.977,97
  makeCardItem({ empresa: 'DZM', conta_corrente: 'Bradesco - Visa 6827 / 1787', valor: 87555.09, periodo: 'Nov/25' }),
  makeCardItem({ empresa: 'DZM', conta_corrente: 'Clara - Prestadores', valor: 50604.35, periodo: 'Jul/26' }),
  makeCardItem({ empresa: 'DZM', conta_corrente: 'Clara - Prestadores', valor: -1300.82, sinal_valor: 1300.82, periodo: 'Set/26' }), // EXTR estorno -> líquido 49.303,53
  makeCardItem({ empresa: 'DZM', conta_corrente: 'Dauren PF - Nubank', valor: 96831.97, periodo: 'Mar/26' }),
  makeCardItem({ empresa: 'DZM', conta_corrente: 'Flash - Prestadores', valor: 116287.38, periodo: 'Abr/26' }),
  // G2 = 28.590,06
  makeCardItem({ empresa: 'G2', conta_corrente: 'Bradesco - 6277 / 8112', valor: 28590.06, periodo: 'Jul/26' }),
  // Mar Brasil = 833.513,62
  makeCardItem({ empresa: 'Mar Brasil', conta_corrente: 'Bradesco - Cartão 8583 / 2192', valor: 299391.60, periodo: 'Mai/26' }),
  makeCardItem({ empresa: 'Mar Brasil', conta_corrente: 'Bradesco - Cartão 8583 / 2192', valor: -3230.60, sinal_valor: 3230.60, periodo: 'Mai/26' }), // EXTR estorno -> líquido 296.161,00
  makeCardItem({ empresa: 'Mar Brasil', conta_corrente: 'Cartão - Sicredi 0137 / 0129', valor: 96858.42, periodo: 'Abr/26' }),
  makeCardItem({ empresa: 'Mar Brasil', conta_corrente: 'Cartão - Sicredi 0137 / 0129', valor: -999.00, sinal_valor: 999.00, periodo: 'Abr/26' }), // EXTR estorno -> líquido 95.859,42
  makeCardItem({ empresa: 'Mar Brasil', conta_corrente: 'Clara - Prestadores', valor: 84863.03, periodo: 'Out/26' }),
  makeCardItem({ empresa: 'Mar Brasil', conta_corrente: 'Dauren PF - Nubank', valor: 1843.40, periodo: 'Fev/26' }),
  makeCardItem({ empresa: 'Mar Brasil', conta_corrente: 'Diretoria - 1924', valor: 164141.01, periodo: 'Jun/26' }),
  makeCardItem({ empresa: 'Mar Brasil', conta_corrente: 'Diretoria - 1924', valor: -4599.30, sinal_valor: 4599.30, periodo: 'Jun/26' }), // EXTR estorno -> líquido 159.541,71
  makeCardItem({ empresa: 'Mar Brasil', conta_corrente: 'Elo - 9693', valor: 71672.21, periodo: 'Nov/25' }),
  makeCardItem({ empresa: 'Mar Brasil', conta_corrente: 'Flash - Prestadores', valor: 105035.65, periodo: 'Dez/25' }),
  makeCardItem({ empresa: 'Mar Brasil', conta_corrente: 'Ourocard - 1405', valor: 18537.20, periodo: 'Out/26' }),
];

const kpis = DreCaixaService.calculateKpis(mock13CardsLancamentos);
assert.strictEqual(Math.round(kpis.totalPago * 100) / 100, 1212081.65);
assert.strictEqual(Math.round(kpis.totalRecebido * 100) / 100, 0);
assert.strictEqual(Math.round(kpis.resultadoLiquido * 100) / 100, -1212081.65);

const audit = DreCaixaService.computePurchasesAudit(mock13CardsLancamentos, undefined, false);
assert.strictEqual(Math.round(audit.totalGeralPago * 100) / 100, 1212081.65);

const byEmp = Object.fromEntries(audit.porEmpresa.map(e => [e.empresa, Math.round(e.totalGeral * 100) / 100]));
assert.strictEqual(byEmp['DZM'], 349977.97, 'Total DZM deve bater centavo a centavo com o Omie');
assert.strictEqual(byEmp['G2'], 28590.06, 'Total G2 deve bater centavo a centavo com o Omie');
assert.strictEqual(byEmp['Mar Brasil'], 833513.62, 'Total Mar Brasil deve bater centavo a centavo com o Omie');

const cardsSummary = audit.porCartao.filter(c => c.isCartao || c.isFlash);
assert.strictEqual(cardsSummary.length, 10, 'Todos os 10 nomes únicos de cartões das 3 empresas devem aparecer na auditoria');
const totalCardsAudit = cardsSummary.reduce((acc, c) => acc + c.total, 0);
assert.strictEqual(Math.round(totalCardsAudit * 100) / 100, 1212081.65);

// 4. Casos de borda (vazio, valor zerado, filtro aplicado)
console.log('4. Validando casos vazios, zerados e filtros aplicados...');
const emptyAudit = DreCaixaService.computePurchasesAudit([], undefined, false);
assert.strictEqual(emptyAudit.totalGeralPago, 0);
assert.strictEqual(emptyAudit.porCartao.length, 0);

const zeroAudit = DreCaixaService.computePurchasesAudit([
  makeCardItem({ empresa: 'G2', conta_corrente: 'Bradesco - 6277 / 8112', valor: 0, sinal_valor: 0 }),
], undefined, false);
assert.strictEqual(zeroAudit.totalGeralPago, 0);

const filteredG2 = DreCaixaService.applyFilters(mock13CardsLancamentos, {
  empresas: ['G2'],
  periodos: [],
  projetos: [],
  categorias: [],
  fornecedores: [],
  contasCorrentes: ['Bradesco - 6277 / 8112'],
  search: '',
});
assert.strictEqual(filteredG2.length, 1);
assert.strictEqual(DreCaixaService.calculateKpis(filteredG2).totalPago, 28590.06);

console.log('\n✅ TODOS OS TESTES DE CONCILIAÇÃO DE CARTÕES DO DRE CAIXA PASSARAM COM EXATIDÃO!');
