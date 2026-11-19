const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadPdfService() {
  const filePath = path.resolve(__dirname, '../src/services/competencias-costs-pdf.service.ts');
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
    Array,
    Object,
    parseInt,
    Boolean,
  };
  vm.runInNewContext(transpiled.outputText, sandbox, { filename: filePath });
  return mod.exports;
}

const pdfService = loadPdfService();
const {
  normalizeCompetenciaCostRow,
  summarizeCompetenciaPdfRows,
  partitionCompetenciaPdfRows,
  buildScopeDescription,
  buildCompetenciasCostsPdfHtml,
  escapeHtml,
  toSafeNumber,
} = pdfService;

console.log('=== TESTES UNITÁRIOS: RELATÓRIO PDF DE CUSTOS POR COMPETÊNCIA & BLINDAGEM JURÍDICA ===\n');

const cltSampleInput = {
  cost: {
    id: 'c1',
    employee_id: 'emp-1',
    competencia: '2026-10-01',
    valor_holerite: 1984.89,
    valor_fixo: 1849.81,
    outros_ajustes: 0,
    valor_vt: 421.60,
    valor_cesta: 320.00,
    valor_vr: 0,
    valor_bonus: 433.23,
    valor_ajuda_custo: 150.00,
    valor_incentivos: 22.97, // Resíduo legado que NUNCA pode entrar na Premiação CLT
    valor_descontos: 993.07,
    valor_adiantamento: 739.92,
  },
  emp: { id: 'emp-1', company: 'DZM', job_role: 'Oficial de Serviços Gerais', document_id: '456.671.868-96' },
  name: 'BRUNO VIANA DE SOUSA CHAVES',
  financials: { fixo: 1849.81, heNoturno: 135.08, descontosFolha: 993.07 },
  realTotal: 3056.57,
  isCLT: true,
  isPJ: false,
  isEstagio: false,
};

const pjSampleInput = {
  cost: {
    id: 'c-pj',
    employee_id: 'emp-pj',
    competencia: '2026-09-01',
    valor_fixo: 4500.00,
    valor_bonus: 500.00,
    valor_comissao: 200.00,
    valor_incentivos: 100.00,
    valor_ajuda_custo: 150.00,
    valor_deducoes: 250.00,
  },
  emp: {
    company: 'MarBR',
    corporate_name: '29.739.454 BRAIAN CASTRO FURQUIM DA MOTA',
    pj_type: '29.739.454/0001-10',
    job_role: 'Terceirizado Supervisor Operacional',
  },
  name: 'BRAIAN CASTRO FURQUIM',
  financials: { fixo: 4500, bonus: 800, ajudaCusto: 150, descontosFolha: 250 },
  realTotal: 5200.00,
  isCLT: false,
  isPJ: true,
  isEstagio: false,
};

const estagioSampleInput = {
  cost: {
    id: 'c-est',
    employee_id: 'emp-est',
    competencia: '2026-10-01',
    valor_holerite: 1000.00,
    valor_vt: 180.00,
    valor_cesta: 120.00,
    valor_descontos: 50.00,
    valor_adiantamento: 0,
  },
  emp: { company: 'DZM', job_role: 'Estagiário Operacional', document_id: '527.562.338-00' },
  name: 'GUSTAVO DIAS DE OLIVEIRA',
  financials: { fixo: 1000, descontosFolha: 50 },
  realTotal: 1250.00,
  isCLT: true,
  isPJ: false,
  isEstagio: true,
};

// 1. Caso padrão CLT
console.log('1. Testando caso padrão CLT completo com 10 colunas...');
const cltPadrao = normalizeCompetenciaCostRow(cltSampleInput);
assert.strictEqual(cltPadrao.regime, 'CLT');
assert.strictEqual(cltPadrao.proventos, 1984.89);
assert.strictEqual(cltPadrao.outros, 0);
assert.strictEqual(cltPadrao.vt, 421.60);
assert.strictEqual(cltPadrao.vrCesta, 320.00);
assert.strictEqual(cltPadrao.bonus, 433.23);
assert.strictEqual(cltPadrao.premiacao, 150.00);
assert.strictEqual(cltPadrao.subtotal, 3309.72);
assert.strictEqual(cltPadrao.descontos, 993.07);
assert.strictEqual(cltPadrao.adiantamento, 739.92);
assert.strictEqual(cltPadrao.liquido, 3056.57);
console.log('   ✅ Caso padrão CLT normalizado com precisão e blindagem de valor_incentivos.');

// 2. Caso vazio
console.log('\n2. Testando caso vazio (0 lançamentos)...');
const emptyPartition = partitionCompetenciaPdfRows([]);
assert.strictEqual(emptyPartition.grandTotals.countRows, 0);
assert.strictEqual(emptyPartition.grandTotals.totalLiquidoGeral, 0);
const emptyHtml = buildCompetenciasCostsPdfHtml({ reportType: 'analitico', rows: [] });
assert.ok(emptyHtml.includes('Nenhum registro encontrado para os filtros selecionados.'));
console.log('   ✅ Caso vazio tratado com estado vazio explícito e totalizadores zerados.');

// 3. Caso com valores zerados
console.log('\n3. Testando caso com valores zerados...');
const zeroRow = normalizeCompetenciaCostRow({
  cost: {
    employee_id: 'emp-zero',
    competencia: '2026-10-01',
    valor_holerite: 0,
    valor_fixo: 0,
    valor_vt: 0,
    valor_cesta: 0,
    valor_vr: 0,
    valor_bonus: 0,
    valor_ajuda_custo: 0,
    valor_descontos: 0,
    valor_adiantamento: 0,
  },
  name: 'COLABORADOR AFASTADO',
  financials: { fixo: 0, heNoturno: 0, descontosFolha: 0 },
  realTotal: 0,
  isCLT: true,
  isPJ: false,
  isEstagio: false,
});
assert.strictEqual(zeroRow.subtotal, 0);
assert.strictEqual(zeroRow.liquido, 0);
console.log('   ✅ Valores zerados preservados sem NaN.');

// 4. Caso com valores negativos (ajuste manual negativo em outros_ajustes)
console.log('\n4. Testando ajuste negativo controlado...');
const negativeRow = normalizeCompetenciaCostRow({
  cost: {
    employee_id: 'emp-neg',
    competencia: '2026-10-01',
    valor_holerite: 2000,
    outros_ajustes: -150.5,
    valor_descontos: 200,
    valor_adiantamento: 0,
  },
  name: 'AJUSTE ESTORNO',
  financials: { fixo: 2000, descontosFolha: 200 },
  realTotal: 1649.5,
  isCLT: true,
  isPJ: false,
  isEstagio: false,
});
assert.strictEqual(negativeRow.outros, -150.5);
assert.strictEqual(negativeRow.subtotal, 1849.5);
assert.strictEqual(negativeRow.liquido, 1649.5);
console.log('   ✅ Valores negativos preservados no Subtotal.');

// 5. Isolamento de Proventos (Deuzelina)
console.log('\n5. Testando isolamento de Horas Extras com holerite importado (Deuzelina)...');
const deuzelinaRow = normalizeCompetenciaCostRow({
  cost: {
    employee_id: 'emp-deuz',
    competencia: '2026-10-01',
    valor_holerite: 5823.98,
    valor_fixo: 1849.81,
    valor_hora_extra: 169.74,
    outros_ajustes: 0,
    valor_ajuda_custo: 0,
    valor_incentivos: 1055.97,
    valor_descontos: 5823.96,
    valor_adiantamento: 0,
  },
  name: 'DEUZELINA ALMEIDA E SILVA',
  financials: { fixo: 1849.81, heNoturno: 169.74, descontosFolha: 5823.96 },
  realTotal: 0.02,
  isCLT: true,
  isPJ: false,
  isEstagio: false,
});
assert.strictEqual(deuzelinaRow.proventos, 5823.98);
assert.strictEqual(deuzelinaRow.outros, 0);
assert.strictEqual(deuzelinaRow.premiacao, 0);
assert.strictEqual(deuzelinaRow.subtotal, 5823.98);
assert.strictEqual(deuzelinaRow.liquido, 0.02);
console.log('   ✅ Isolamento de Proventos/HE e expurgo de incentivos legados validados.');

// 6. Particionamento por Natureza Jurídica (CLT + Estágio + PJ em múltiplos períodos)
console.log('\n6. Testando particionamento CLT + Estágio + PJ em múltiplos períodos...');
const partitioned = partitionCompetenciaPdfRows([cltSampleInput, estagioSampleInput, pjSampleInput]);
assert.strictEqual(partitioned.cltRows.length, 1);
assert.strictEqual(partitioned.estagioRows.length, 1);
assert.strictEqual(partitioned.pjRows.length, 1);
assert.strictEqual(partitioned.grandTotals.isMixed, true);
assert.deepStrictEqual(Array.from(partitioned.grandTotals.regimesPresent), ['CLT', 'ESTAGIO', 'PJ']);
assert.strictEqual(partitioned.cltTotals.liquido, 3056.57);
assert.strictEqual(partitioned.estagioTotals.bolsaAuxilio, 1000.00);
assert.strictEqual(partitioned.estagioTotals.auxilioTransporte, 180.00);
assert.strictEqual(partitioned.estagioTotals.outrosAuxilios, 120.00);
assert.strictEqual(partitioned.estagioTotals.deducoesEstagio, 50.00);
assert.strictEqual(partitioned.estagioTotals.liquido, 1250.00);
assert.strictEqual(partitioned.pjTotals.honorariosBase, 4500.00);
assert.strictEqual(partitioned.pjTotals.variavelComissoes, 800.00);
assert.strictEqual(partitioned.pjTotals.conectividadeReembolso, 150.00);
assert.strictEqual(partitioned.pjTotals.valorBrutoNf, 5450.00);
assert.strictEqual(partitioned.pjTotals.glosasDeducoes, 250.00);
assert.strictEqual(partitioned.pjTotals.valorLiquidoNf, 5200.00);
assert.strictEqual(partitioned.pjRows[0].displayEntityName, '29.739.454 BRAIAN CASTRO FURQUIM DA MOTA');
assert.strictEqual(partitioned.pjRows[0].documentId, '29.739.454/0001-10');
assert.strictEqual(partitioned.grandTotals.totalLiquidoGeral, 9506.57); // 3056.57 + 1250 + 5200
console.log('   ✅ Particionamento jurídico fecha centavo a centavo nos 3 regimes e no total geral.');

// 7. Descrição de escopo multi-filtros
console.log('\n7. Testando descrição de escopo com múltiplos filtros...');
const scopeMulti = buildScopeDescription({
  selectedCompetencias: ['2026-10-01', '2026-09-01'],
  selectedEmpresa: 'DZM',
  selectedVinculo: 'PJ',
  selectedSetor: 'Operacional',
  selectedStatus: 'Ativo',
  searchTerm: 'Braian',
  usePageScope: true,
});
assert.ok(scopeMulti.includes('Competências: Out/26, Set/26'));
assert.ok(scopeMulti.includes('Contratante: DZM'));
assert.ok(scopeMulti.includes('Natureza: PJ / MEI'));
assert.ok(scopeMulti.includes('Área: Operacional'));
assert.ok(scopeMulti.includes('Busca: "Braian"'));
console.log('   ✅ Cabeçalho de escopo reflete todos os filtros com nomenclatura neutra.');

// 8. Blindagem Jurídica — Relatório Somente PJ / MEI (ZERO termos CLT)
console.log('\n8. Testando Blindagem Jurídica — Relatório Somente PJ / MEI (Analítico e Sintético)...');
const forbiddenCltTermsForPj = [
  'Proventos',
  'Folha',
  '+ VT',
  'VR/Cesta',
  'VR / Cesta',
  'Adiantamento',
  'Departamento Pessoal',
  'Colaborador',
  'Salário',
];

for (const reportType of ['analitico', 'sintetico']) {
  const htmlPj = buildCompetenciasCostsPdfHtml({
    reportType,
    rows: [pjSampleInput],
    filters: { selectedCompetencia: '2026-09-01', selectedEmpresa: 'MarBR', selectedVinculo: 'PJ' },
    generatedAt: new Date('2026-11-19T11:30:00-03:00'),
  });
  assert.ok(htmlPj.includes('Prestação de Serviços (PJ / MEI)'));
  assert.ok(htmlPj.includes('Contratada (Razão Social) / CNPJ'));
  assert.ok(htmlPj.includes('29.739.454 BRAIAN CASTRO FURQUIM DA MOTA'));
  assert.ok(htmlPj.includes('CNPJ: 29.739.454/0001-10'));
  assert.ok(htmlPj.includes('1. Honorários / NF Base'));
  assert.ok(htmlPj.includes('2. + Variável / Comissões'));
  assert.ok(htmlPj.includes('3. + Conectividade / Reemb.'));
  assert.ok(htmlPj.includes('4. = Valor Bruto NF'));
  assert.ok(htmlPj.includes('5. (-) Glosas / Deduções'));
  assert.ok(htmlPj.includes('6. = Valor Líquido NF'));
  assert.ok(htmlPj.includes('Gestão de Contratos / Compras'));
  assert.ok(!/purple|violet|indigo/i.test(htmlPj), 'Purple Ban violado no PDF PJ.');

  for (const forbidden of forbiddenCltTermsForPj) {
    assert.ok(
      !htmlPj.toLowerCase().includes(forbidden.toLowerCase()),
      `COMPLIANCE FALHOU (PJ ${reportType}): termo trabalhista "${forbidden}" encontrado no PDF PJ!`
    );
  }
}
console.log('   ✅ Relatório PJ/MEI 100% blindado: ZERO termos trabalhistas CLT e assinatura de Gestão de Contratos.');

// 9. Blindagem Jurídica — Relatório Somente Estágio (Lei nº 11.788/2008)
console.log('\n9. Testando Blindagem Jurídica — Relatório Somente Estágio (Lei nº 11.788/2008)...');
const htmlEstagio = buildCompetenciasCostsPdfHtml({
  reportType: 'analitico',
  rows: [estagioSampleInput],
  filters: { selectedCompetencia: '2026-10-01', selectedVinculo: 'ESTAGIO' },
});
assert.ok(htmlEstagio.includes('Lei nº 11.788/2008'));
assert.ok(htmlEstagio.includes('1. Bolsa-Auxílio'));
assert.ok(htmlEstagio.includes('2. + Aux. Transporte'));
assert.ok(htmlEstagio.includes('3. + Outros Auxílios'));
assert.ok(htmlEstagio.includes('(-) Deduções'));
assert.ok(htmlEstagio.includes('= Valor Líquido'));
assert.ok(htmlEstagio.includes('Gestão de Estágios / RH'));
assert.ok(!htmlEstagio.includes('Proventos (Folha)'));
assert.ok(!htmlEstagio.includes('+ VT'));
assert.ok(!htmlEstagio.includes('VR / Cesta'));
assert.ok(!htmlEstagio.includes('Desc. Folha'));
assert.ok(!/purple|violet|indigo/i.test(htmlEstagio), 'Purple Ban violado no PDF Estágio.');
console.log('   ✅ Relatório de Estágio 100% aderente à Lei nº 11.788/2008.');

// 10. Blindagem Jurídica — Relatório Misto (CLT + Estágio + PJ com Caderno PJ Destacável em Nova Página)
console.log('\n10. Testando Relatório Misto (CLT + Estágio + PJ) com Caderno B2B destacável...');
for (const reportType of ['analitico', 'sintetico']) {
  const htmlMixed = buildCompetenciasCostsPdfHtml({
    reportType,
    rows: [cltSampleInput, estagioSampleInput, pjSampleInput],
    filters: { selectedEmpresa: 'all', selectedVinculo: 'all' },
    generatedAt: new Date('2026-11-19T11:30:00-03:00'),
  });

  // Bloco 0 consolidado neutro
  assert.ok(htmlMixed.includes('Resumo Executivo Consolidado por Natureza Jurídica'));
  assert.ok(htmlMixed.includes('Folha de Pagamento (CLT)'));
  assert.ok(htmlMixed.includes('Bolsas de Estágio (Lei 11.788/08)'));
  assert.ok(htmlMixed.includes('Prestação de Serviços (PJ / MEI)'));
  assert.ok(htmlMixed.includes('Total Geral Desembolsado (Grupo)'));

  // 3 seções segregadas
  assert.ok(htmlMixed.includes('SEÇÃO 1 • FOLHA DE PAGAMENTO — REGIME CLT'));
  assert.ok(htmlMixed.includes('SEÇÃO 2 • BOLSAS DE ESTÁGIO — LEI Nº 11.788/2008'));
  assert.ok(htmlMixed.includes('SEÇÃO 3 • PRESTAÇÃO DE SERVIÇOS — EMPRESAS CONTRATADAS (PJ / MEI)'));

  // Quebra de página destacável antes do Caderno PJ
  assert.ok(htmlMixed.includes('class="pj-booklet-break"'));
  assert.ok(htmlMixed.includes('page-break-before: always;'));

  // Auditoria cirúrgica do Caderno PJ isolado (tudo após <div class="pj-booklet-break">)
  const pjBookletStart = htmlMixed.indexOf('<div class="pj-booklet-break">');
  assert.ok(pjBookletStart > 0, 'Caderno PJ destacável não encontrado!');
  const pjBookletHtml = htmlMixed.slice(pjBookletStart);
  assert.ok(pjBookletHtml.includes('Caderno Independente • Prestação de Serviços'));
  assert.ok(pjBookletHtml.includes('Gestão de Contratos / Compras'));
  assert.ok(pjBookletHtml.includes('29.739.454 BRAIAN CASTRO FURQUIM DA MOTA'));

  for (const forbidden of forbiddenCltTermsForPj) {
    assert.ok(
      !pjBookletHtml.toLowerCase().includes(forbidden.toLowerCase()),
      `COMPLIANCE FALHOU (Caderno PJ no Misto ${reportType}): termo trabalhista "${forbidden}" vazou para o Caderno PJ!`
    );
  }
  assert.ok(!/purple|violet|indigo/i.test(htmlMixed), 'Purple Ban violado no PDF Misto.');
}
console.log('   ✅ Relatório Misto segregado com Resumo Neutro + 3 Seções + Caderno PJ destacável 100% isento de termos CLT.');

// 11. Segurança XSS e entradas inválidas
console.log('\n11. Testando proteção XSS e sanitização de entradas inválidas...');
assert.strictEqual(toSafeNumber(NaN), 0);
assert.strictEqual(toSafeNumber(Infinity), 0);
assert.strictEqual(toSafeNumber('abc'), 0);
assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');

const xssHtml = buildCompetenciasCostsPdfHtml({
  reportType: 'analitico',
  rows: [{
    cost: { employee_id: 'x1', competencia: '2026-10-01', valor_fixo: Number.NaN },
    emp: { company: '<img src=x onerror=alert(1)>', corporate_name: '<script>evilPj()</script>' },
    name: '<script>evil()</script>',
    financials: {},
    realTotal: Number.NaN,
    isCLT: false,
    isPJ: true,
    isEstagio: false,
  }],
  filters: { searchTerm: '<b>teste</b>' },
});
assert.ok(!xssHtml.includes('<script>evilPj()</script>'));
assert.ok(!xssHtml.includes('<img src=x'));
assert.ok(xssHtml.includes('&lt;script&gt;evilPj()&lt;/script&gt;'));
assert.ok(xssHtml.includes('&lt;b&gt;teste&lt;/b&gt;'));
console.log('   ✅ Proteção XSS e tolerância a NaN/entradas inválidas validadas.');

console.log('\n🎉 TODOS OS 11 CENÁRIOS DE RELATÓRIO PDF E BLINDAGEM JURÍDICA PASSARAM COM EXATIDÃO!');
