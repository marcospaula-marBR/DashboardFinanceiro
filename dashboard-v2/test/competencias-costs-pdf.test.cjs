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
  buildScopeDescription,
  buildCompetenciasCostsPdfHtml,
  escapeHtml,
  toSafeNumber,
} = pdfService;

console.log('=== TESTES UNITÁRIOS: RELATÓRIO PDF DE CUSTOS POR COMPETÊNCIA (10 COLUNAS) ===\n');

// 1. Caso padrão (CLT com holerite, VT, VR/Cesta, Bônus, Premiação, Desc. Folha e Adiantamento)
console.log('1. Testando caso padrão CLT completo com 10 colunas...');
const cltPadrao = normalizeCompetenciaCostRow({
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
  realTotal: 3056.57, // 1984.89 - 993.07 + 739.92 + 421.60 + 320 + 433.23 + 150 = 3056.57
  isCLT: true,
  isPJ: false,
  isEstagio: false,
});

assert.strictEqual(cltPadrao.proventos, 1984.89);
assert.strictEqual(cltPadrao.outros, 0); // hasHol = true -> não duplica heNoturno
assert.strictEqual(cltPadrao.vt, 421.60);
assert.strictEqual(cltPadrao.vrCesta, 320.00);
assert.strictEqual(cltPadrao.bonus, 433.23);
assert.strictEqual(cltPadrao.premiacao, 150.00); // Ignorou valor_incentivos (22.97)
assert.strictEqual(cltPadrao.subtotal, 3309.72); // 1984.89 + 421.60 + 320 + 433.23 + 150
assert.strictEqual(cltPadrao.descontos, 993.07);
assert.strictEqual(cltPadrao.adiantamento, 739.92);
assert.strictEqual(cltPadrao.liquido, 3056.57);
assert.strictEqual(cltPadrao.beneficiosAgrupados, 1324.83);
assert.strictEqual(cltPadrao.competenciaShort, 'Out/26');
console.log('   ✅ Caso padrão CLT normalizado com precisão centavo a centavo e blindagem de valor_incentivos.');

// 2. Caso vazio
console.log('\n2. Testando caso vazio (0 lançamentos)...');
const emptyTotals = summarizeCompetenciaPdfRows([]);
assert.strictEqual(emptyTotals.countRows, 0);
assert.strictEqual(emptyTotals.uniqueEmployeesCount, 0);
assert.strictEqual(emptyTotals.subtotal, 0);
assert.strictEqual(emptyTotals.liquido, 0);
const emptyHtml = buildCompetenciasCostsPdfHtml({ reportType: 'analitico', rows: [] });
assert.ok(emptyHtml.includes('Nenhum lançamento encontrado para os filtros selecionados.'));
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
assert.strictEqual(zeroRow.premiacao, 0);
console.log('   ✅ Valores zerados preservados sem NaN ou valores fantasmas.');

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
console.log('   ✅ Valores negativos preservados no Subtotal e formatados corretamente.');

// 5. Isolamento de Proventos (caso Deuzelina com hora extra já inclusa em valor_holerite) e sem valor_incentivos
console.log('\n5. Testando isolamento de Horas Extras com holerite importado (Deuzelina) e zero premiação...');
const deuzelinaRow = normalizeCompetenciaCostRow({
  cost: {
    employee_id: 'emp-deuz',
    competencia: '2026-10-01',
    valor_holerite: 5823.98,
    valor_fixo: 1849.81,
    valor_hora_extra: 169.74,
    outros_ajustes: 0,
    valor_ajuda_custo: 0,
    valor_incentivos: 1055.97, // Não deve vazar para CLT
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

// 6. Caso PJ/MEI + Estágio + Múltiplos Períodos (Fechamento integral dos 10 totalizadores)
console.log('\n6. Testando mistura CLT + PJ + Estágio em múltiplos períodos...');
const pjRow = normalizeCompetenciaCostRow({
  cost: {
    employee_id: 'emp-pj',
    competencia: '2026-09-01',
    valor_fixo: 4500.00,
    valor_bonus: 500.00,
    valor_comissao: 200.00,
    valor_incentivos: 100.00,
    valor_ajuda_custo: 150.00,
    valor_deducoes: 250.00,
  },
  emp: { company: 'MarBR', job_role: 'Supervisor Operacional' },
  name: 'BRAIAN CASTRO FURQUIM',
  financials: { fixo: 4500, bonus: 800, ajudaCusto: 150, descontosFolha: 250 },
  realTotal: 5200.00,
  isCLT: false,
  isPJ: true,
  isEstagio: false,
});
const estagioRow = normalizeCompetenciaCostRow({
  cost: {
    employee_id: 'emp-est',
    competencia: '2026-10-01',
    valor_holerite: 1000.00,
    valor_vt: 180.00,
    valor_descontos: 0,
  },
  emp: { company: 'DZM', job_role: 'Estagiário' },
  name: 'GUSTAVO DIAS DE OLIVEIRA',
  financials: { fixo: 1000, descontosFolha: 0 },
  realTotal: 1180.00,
  isCLT: true,
  isPJ: false,
  isEstagio: true,
});

const mixedTotals = summarizeCompetenciaPdfRows([cltPadrao, pjRow, estagioRow]);
assert.strictEqual(mixedTotals.countRows, 3);
assert.strictEqual(mixedTotals.uniqueEmployeesCount, 3);
assert.strictEqual(mixedTotals.countClt, 1);
assert.strictEqual(mixedTotals.countPj, 1);
assert.strictEqual(mixedTotals.countEstagio, 1);
assert.strictEqual(mixedTotals.proventos, 7484.89); // 1984.89 + 4500 + 1000
assert.strictEqual(mixedTotals.vt, 601.60); // 421.60 + 0 + 180
assert.strictEqual(mixedTotals.vrCesta, 320.00);
assert.strictEqual(mixedTotals.bonus, 1233.23); // 433.23 + 800 + 0
assert.strictEqual(mixedTotals.premiacao, 300.00); // 150 + 150 + 0
assert.strictEqual(mixedTotals.subtotal, 9939.72); // 3309.72 + 5450 + 1180
assert.strictEqual(mixedTotals.descontos, 1243.07); // 993.07 + 250 + 0
assert.strictEqual(mixedTotals.adiantamento, 739.92);
assert.strictEqual(mixedTotals.liquido, 9436.57); // 3056.57 + 5200 + 1180
assert.strictEqual(
  Math.round((mixedTotals.subtotal - mixedTotals.descontos + mixedTotals.adiantamento) * 100) / 100,
  mixedTotals.liquido
);
console.log('   ✅ Totalizadores fecham centavo a centavo para CLT + PJ + Estágio em múltiplos períodos.');

// 7. Descrição de escopo com múltiplos filtros aplicados
console.log('\n7. Testando descrição de escopo com filtros múltiplos...');
const scopeMulti = buildScopeDescription({
  selectedCompetencias: ['2026-10-01', '2026-09-01'],
  selectedEmpresa: 'DZM',
  selectedVinculo: 'CLT',
  selectedSetor: 'Operacional',
  selectedStatus: 'Ativo',
  searchTerm: 'Bruno',
  usePageScope: true,
});
assert.ok(scopeMulti.includes('Competências: Out/26, Set/26'));
assert.ok(scopeMulti.includes('Empresa: DZM'));
assert.ok(scopeMulti.includes('Regime: CLT'));
assert.ok(scopeMulti.includes('Setor: Operacional'));
assert.ok(scopeMulti.includes('Status: Ativo'));
assert.ok(scopeMulti.includes('Busca: "Bruno"'));
assert.ok(scopeMulti.includes('Base Filtrada na Página'));

const scopeRange = buildScopeDescription({
  compFilterMode: 'range',
  periodStart: '2026-01-01',
  periodEnd: '2026-06-01',
});
assert.strictEqual(scopeRange, 'Período: Jan/26 a Jun/26');
console.log('   ✅ Cabeçalho de escopo reflete todos os filtros (múltiplos meses, período, empresa, vínculo, setor e busca).');

// 8. Geração HTML Analítico (10 cards + 10 colunas + A4 Landscape) e Sintético (6 cards + A4 Portrait)
console.log('\n8. Testando geração de HTML Analítico (10 Colunas) e Sintético (Alinhado)...');
const sampleInputRows = [
  {
    cost: {
      employee_id: 'emp-1',
      competencia: '2026-10-01',
      valor_holerite: 1984.89,
      valor_vt: 421.60,
      valor_cesta: 320.00,
      valor_bonus: 433.23,
      valor_ajuda_custo: 150.00,
      valor_descontos: 993.07,
      valor_adiantamento: 739.92,
    },
    emp: { company: 'DZM', job_role: 'Oficial' },
    name: 'BRUNO VIANA',
    financials: { fixo: 1849.81, descontosFolha: 993.07 },
    realTotal: 3056.57,
    isCLT: true,
    isPJ: false,
    isEstagio: false,
  },
];

const htmlAnalitico = buildCompetenciasCostsPdfHtml({
  reportType: 'analitico',
  rows: sampleInputRows,
  filters: { selectedCompetencia: '2026-10-01', selectedEmpresa: 'DZM', selectedVinculo: 'CLT' },
  generatedAt: new Date('2026-11-19T11:00:00-03:00'),
});

assert.ok(htmlAnalitico.includes('size: A4 landscape;'));
assert.ok(htmlAnalitico.includes('1. Proventos (Folha)'));
assert.ok(htmlAnalitico.includes('2. + Outros'));
assert.ok(htmlAnalitico.includes('3. + VT'));
assert.ok(htmlAnalitico.includes('4. + VR / Cesta'));
assert.ok(htmlAnalitico.includes('5. + Bônus'));
assert.ok(htmlAnalitico.includes('6. + Premiação'));
assert.ok(htmlAnalitico.includes('= Subtotal'));
assert.ok(htmlAnalitico.includes('(-) Desc. Folha'));
assert.ok(htmlAnalitico.includes('(+) Adiantamento'));
assert.ok(htmlAnalitico.includes('= Líquido'));
assert.ok(htmlAnalitico.includes('Competência: Outubro/2026 • Empresa: DZM • Regime: CLT'));
assert.ok(!/purple|violet|indigo/i.test(htmlAnalitico), 'Purple Ban: nenhuma cor roxa/violeta/indigo permitida no HTML.');

const htmlSintetico = buildCompetenciasCostsPdfHtml({
  reportType: 'sintetico',
  rows: sampleInputRows,
  filters: { selectedCompetencia: '2026-10-01', selectedEmpresa: 'DZM', selectedVinculo: 'CLT' },
  generatedAt: new Date('2026-11-19T11:00:00-03:00'),
});
assert.ok(htmlSintetico.includes('size: A4 portrait;'));
assert.ok(htmlSintetico.includes('1. Proventos + Outros'));
assert.ok(htmlSintetico.includes('2. + Benefícios'));
assert.ok(htmlSintetico.includes('3. = Subtotal Bruto'));
assert.ok(htmlSintetico.includes('4. (-) Desc. Folha'));
assert.ok(htmlSintetico.includes('5. (+) Adiantamento'));
assert.ok(htmlSintetico.includes('6. = Líquido Desembolsado'));
assert.ok(!/purple|violet|indigo/i.test(htmlSintetico), 'Purple Ban: nenhuma cor roxa/violeta/indigo permitida no HTML.');
console.log('   ✅ Templates Analítico (10 Colunas Landscape) e Sintético (Portrait) validados integralmente.');

// 9. Segurança (XSS escaping) e entradas inválidas (NaN / Infinity / null)
console.log('\n9. Testando proteção XSS e sanitização de entradas inválidas...');
assert.strictEqual(toSafeNumber(NaN), 0);
assert.strictEqual(toSafeNumber(Infinity), 0);
assert.strictEqual(toSafeNumber('abc'), 0);
assert.strictEqual(toSafeNumber(undefined), 0);
assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');

const xssHtml = buildCompetenciasCostsPdfHtml({
  reportType: 'analitico',
  rows: [{
    cost: { employee_id: 'x1', competencia: '2026-10-01', valor_holerite: Number.NaN },
    emp: { company: '<img src=x onerror=alert(1)>' },
    name: '<script>evil()</script>',
    financials: {},
    realTotal: Number.NaN,
    isCLT: true,
    isPJ: false,
    isEstagio: false,
  }],
  filters: { searchTerm: '<b>teste</b>' },
});
assert.ok(!xssHtml.includes('<script>evil()</script>'));
assert.ok(!xssHtml.includes('<img src=x'));
assert.ok(xssHtml.includes('&lt;script&gt;evil()&lt;/script&gt;'));
assert.ok(xssHtml.includes('&lt;b&gt;teste&lt;/b&gt;'));
console.log('   ✅ Proteção XSS e tolerância a NaN/entradas inválidas validadas com sucesso.');

console.log('\n🎉 TODOS OS 9 CENÁRIOS DO RELATÓRIO PDF (10 COLUNAS) PASSARAM COM EXATIDÃO!');
