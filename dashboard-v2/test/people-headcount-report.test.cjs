const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadHeadcountService() {
  const filePath = path.resolve(__dirname, '../src/services/people-headcount-report.service.ts');
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

const svc = loadHeadcountService();
const {
  classifyEmployeeLegalNature,
  resolveHeadcountDisplayName,
  partitionEmployeesByLegalNature,
  buildHeadcountPrintHtml,
  buildHeadcountGeneralCsv,
  renderHeadcountVectorPdf,
} = svc;

console.log('=== TESTES UNITÁRIOS: RELATÓRIO GERAL DE QUADRO & BLINDAGEM JURÍDICA ===\n');

const sampleClt = {
  id: 'emp-clt-1',
  name: 'BRUNO VIANA DE SOUSA CHAVES',
  corporate_name: 'D.Z.M. LTDA',
  company: 'DZM',
  linkType: 'CLT',
  document_id: '456.671.868-96',
  job_role: 'Oficial de Serviços Gerais',
  department: 'Operações',
  camada: 'Operacional',
  nivel_enquadramento: 'II',
  start_date: '2024-03-10',
  remuneration_fixed: 1849.81,
  status: 'Ativo',
};

const sampleEstagio = {
  id: 'emp-est-1',
  name: 'GUSTAVO DIAS DE OLIVEIRA',
  company: 'DZM',
  linkType: 'Estagiário',
  document_id: '527.562.338-00',
  job_role: 'Estagiário Administrativo',
  department: 'Administrativo',
  start_date: '2026-01-15',
  remuneration_fixed: 1000.0,
  status: 'Ativo',
};

const samplePj = {
  id: 'emp-pj-1',
  name: 'Carlos Silva',
  corporate_name: 'SILVA CONSULTORIA TECNOLOGICA LTDA',
  company: 'MarBR',
  linkType: 'PJ',
  pj_type: '12.345.678/0001-90',
  job_role: 'Consultoria de Engenharia de Software',
  department: 'Tecnologia',
  camada: 'Estratégico',
  nivel_enquadramento: 'I',
  start_date: '2025-05-01',
  remuneration_fixed: 8500.0,
  status: 'Ativo',
};

const sampleMeiInactive = {
  id: 'emp-mei-2',
  name: 'Ana Souza',
  corporate_name: 'ANA SOUZA DESIGN MEI',
  company: 'G2',
  linkType: 'MEI',
  pj_type: '98.765.432/0001-11',
  job_role: 'Serviços de Design Gráfico',
  department: 'Marketing',
  start_date: '2024-02-01',
  resignation_date: '2026-08-31',
  remuneration_fixed: 3200.0,
  status: 'Inativo',
};

const baseMeta = {
  companiesLabel: 'Todas (MarBR / DZM / G2)',
  linksLabel: 'Todos',
  statusLabel: 'Todos',
  dateLabel: 'Geral',
  showResignationColumn: false,
  includeFinancials: true,
  includeSummaryCards: true,
  includeSignatures: true,
  generatedAt: new Date('2026-11-19T12:00:00Z'),
};

// 1. Classificação de natureza jurídica e resolução de nome
console.log('1. Classificação jurídica CLT / Estágio / PJ / MEI e proteção contra razão social empregadora...');
assert.strictEqual(classifyEmployeeLegalNature(sampleClt), 'CLT');
assert.strictEqual(classifyEmployeeLegalNature(sampleEstagio), 'ESTAGIO');
assert.strictEqual(classifyEmployeeLegalNature(samplePj), 'PJ');
assert.strictEqual(classifyEmployeeLegalNature(sampleMeiInactive), 'PJ');
// Colaborador sem linkType mas com corporate_name da própria DZM não deve virar PJ
assert.strictEqual(classifyEmployeeLegalNature({ name: 'Teste', corporate_name: 'D.Z.M. LTDA' }), 'CLT');
// Nome exibido: PJ prioriza Razão Social; CLT/Estágio priorizam nome civil
assert.strictEqual(resolveHeadcountDisplayName(samplePj, 'PJ'), 'SILVA CONSULTORIA TECNOLOGICA LTDA');
assert.strictEqual(resolveHeadcountDisplayName(sampleClt, 'CLT'), 'BRUNO VIANA DE SOUSA CHAVES');
console.log('   OK!');

// 2. Particionamento de lista vazia e valores zerados/negativos
console.log('2. Caso vazio, valores zerados e resumo consolidado...');
const emptyPart = partitionEmployeesByLegalNature([]);
assert.strictEqual(emptyPart.grandSummary.totalCount, 0);
assert.strictEqual(emptyPart.grandSummary.totalValue, 0);
assert.strictEqual(emptyPart.grandSummary.isMixed, false);
assert.deepStrictEqual(Array.from(emptyPart.grandSummary.naturesPresent), []);

const zeroPart = partitionEmployeesByLegalNature([{ id: 'z1', name: 'Zero', linkType: 'CLT', remuneration: 0 }]);
assert.strictEqual(zeroPart.cltSummary.totalValue, 0);
assert.strictEqual(zeroPart.cltSummary.count, 1);

const mixedPart = partitionEmployeesByLegalNature([sampleClt, sampleEstagio, samplePj, sampleMeiInactive]);
assert.strictEqual(mixedPart.cltSummary.count, 1);
assert.strictEqual(mixedPart.estagioSummary.count, 1);
assert.strictEqual(mixedPart.pjSummary.count, 2);
assert.strictEqual(mixedPart.pjSummary.activeCount, 1);
assert.strictEqual(mixedPart.pjSummary.inactiveCount, 1);
assert.strictEqual(mixedPart.grandSummary.totalCount, 4);
assert.strictEqual(mixedPart.grandSummary.isMixed, true);
assert.strictEqual(mixedPart.grandSummary.totalValue, 14549.81);
assert.deepStrictEqual(Array.from(mixedPart.grandSummary.naturesPresent), ['CLT', 'ESTAGIO', 'PJ']);
console.log('   OK!');

// 3. HTML Print PJ-Only: blindagem jurídica total (zero léxico CLT)
console.log('3. HTML Print exclusivo PJ/MEI: zero termos CLT e assinatura B2B...');
const pjHtml = buildHeadcountPrintHtml([samplePj, sampleMeiInactive], {
  ...baseMeta,
  showResignationColumn: true,
});
assert.ok(pjHtml.includes('Relação de Empresas Contratadas (PJ / MEI)'));
assert.ok(pjHtml.includes('Contratada (Razão Social)'));
assert.ok(pjHtml.includes('Honorários / Contrato'));
assert.ok(pjHtml.includes('GESTÃO DE CONTRATOS / COMPRAS'));
assert.ok(pjHtml.includes('colspan="10"'), 'Footer colspan com coluna Encerramento deve ser 10');
const forbiddenCltTerms = [
  'salário',
  'empregado',
  'colaborador',
  'admissão',
  'desligamento',
  'gestão de pessoas / rh',
  'massa salarial',
];
const pjHtmlLower = pjHtml.toLowerCase();
for (const term of forbiddenCltTerms) {
  assert.strictEqual(pjHtmlLower.includes(term), false, `HTML PJ-only não pode conter termo trabalhista "${term}"`);
}
console.log('   OK!');

// 4. HTML Print Estágio-Only: Lei nº 11.788/2008
console.log('4. HTML Print exclusivo Estágio: Lei nº 11.788/2008 e assinatura específica...');
const estagioHtml = buildHeadcountPrintHtml([sampleEstagio], baseMeta);
assert.ok(estagioHtml.includes('Lei nº 11.788/2008'));
assert.ok(estagioHtml.includes('Bolsa-Auxílio'));
assert.ok(estagioHtml.includes('GESTÃO DE ESTÁGIOS / RH'));
assert.ok(estagioHtml.includes('colspan="9"'), 'Footer colspan sem coluna Término deve ser 9');
console.log('   OK!');

// 5. HTML Print Misto: quebra de página destacável antes de PJ e caderno PJ livre de termos CLT
console.log('5. HTML Print misto (CLT + Estágio + PJ): caderno PJ destacável e livre de léxico CLT...');
const mixedHtml = buildHeadcountPrintHtml([sampleClt, sampleEstagio, samplePj], baseMeta);
assert.ok(mixedHtml.includes('class="pj-booklet-break"'), 'Deve incluir quebra destacável antes de PJ');
assert.ok(mixedHtml.includes('SEÇÃO 1 • QUADRO DE EMPREGADOS — REGIME CLT'));
assert.ok(mixedHtml.includes('SEÇÃO 2 • ESTAGIÁRIOS — LEI Nº 11.788/2008'));
assert.ok(mixedHtml.includes('SEÇÃO 3 • PRESTAÇÃO DE SERVIÇOS — EMPRESAS CONTRATADAS (PJ / MEI)'));
const pjBookletSlice = mixedHtml.split('<div class="pj-booklet-break">')[1] || '';
assert.ok(pjBookletSlice.length > 100, 'Caderno PJ destacável deve estar presente');
const pjBookletLower = pjBookletSlice.toLowerCase();
for (const term of forbiddenCltTerms) {
  assert.strictEqual(pjBookletLower.includes(term), false, `Caderno PJ destacável não pode conter termo CLT "${term}"`);
}
console.log('   OK!');

// 6. Sanitização XSS e Purple Ban
console.log('6. Sanitização XSS e Purple Ban...');
const xssHtml = buildHeadcountPrintHtml([
  {
    ...sampleClt,
    name: '<script>alert("xss")</script> João & Co',
  },
], baseMeta);
assert.strictEqual(xssHtml.includes('<script>alert'), false);
assert.ok(xssHtml.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
assert.strictEqual(/#7c3aed|#8b5cf6|#6366f1|#a855f7|purple|violet|indigo/i.test(mixedHtml), false, 'Purple Ban violado no HTML');
console.log('   OK!');

// 7. Exportação CSV com segregação por Natureza Jurídica
console.log('7. Exportação CSV segregada por Natureza Jurídica...');
const csvWithFin = buildHeadcountGeneralCsv([sampleClt, sampleEstagio, samplePj], true, baseMeta.generatedAt);
assert.ok(csvWithFin.includes('Natureza Jurídica;Nome / Razão Social;Tipo Doc;CPF / CNPJ'));
assert.ok(csvWithFin.includes('Valor Base Mensal (Salário / Bolsa / Honorários)'));
assert.ok(csvWithFin.includes('"Vínculo Empregatício (CLT)"'));
assert.ok(csvWithFin.includes('"Estágio (Lei nº 11.788/2008)"'));
assert.ok(csvWithFin.includes('"Prestação de Serviços (PJ / MEI)"'));
assert.ok(csvWithFin.includes('"SILVA CONSULTORIA TECNOLOGICA LTDA"'));
const csvNoFin = buildHeadcountGeneralCsv([samplePj], false, baseMeta.generatedAt);
assert.strictEqual(csvNoFin.includes('Valor Base Mensal'), false);
console.log('   OK!');

// 8. PDF Vetorial (jsPDF + autoTable) — verifica addPage() antes de PJ e headers B2B
console.log('8. PDF Vetorial (jsPDF + autoTable): addPage() antes do caderno PJ e cabeçalhos B2B...');
const textsRendered = [];
let addPageCount = 0;
const mockDoc = {
  setFont: () => {},
  setFontSize: () => {},
  setTextColor: () => {},
  setFillColor: () => {},
  setDrawColor: () => {},
  setLineWidth: () => {},
  roundedRect: () => {},
  line: () => {},
  text: (t) => textsRendered.push(String(t)),
  addPage: () => { addPageCount += 1; },
  internal: { pageSize: { getHeight: () => 210 } },
  lastAutoTable: { finalY: 95 },
};
const autoTableCalls = [];
const mockAutoTable = (doc, opts) => {
  autoTableCalls.push(opts);
  doc.lastAutoTable = { finalY: (opts.startY || 40) + 40 };
};

renderHeadcountVectorPdf(mockDoc, mockAutoTable, [sampleClt, sampleEstagio, samplePj], baseMeta);
assert.strictEqual(autoTableCalls.length, 3, 'Deve renderizar 3 tabelas separadas (CLT, Estágio, PJ)');
assert.ok(addPageCount >= 1, 'Deve chamar doc.addPage() para destacar o caderno PJ');
const cltHeaders = Array.from(autoTableCalls[0].head[0]);
const estHeaders = Array.from(autoTableCalls[1].head[0]);
const pjHeaders = Array.from(autoTableCalls[2].head[0]);
assert.ok(cltHeaders.includes('Salário Base'));
assert.ok(estHeaders.includes('Bolsa-Auxílio'));
assert.ok(pjHeaders.includes('Contratada (Razão Social)'));
assert.ok(pjHeaders.includes('Honorários / Contrato'));
assert.strictEqual(pjHeaders.includes('Salário Base'), false);
assert.strictEqual(pjHeaders.includes('Admissão'), false);
assert.ok(textsRendered.some(t => t.includes('GESTÃO DE CONTRATOS / COMPRAS')));
assert.ok(textsRendered.some(t => t.includes('CADERNO INDEPENDENTE • EMPRESAS CONTRATADAS (PJ / MEI)')));
console.log('   OK!');

console.log('\n✅ TODOS OS 8 BLOCOS DE TESTES DE HEADCOUNT & BLINDAGEM JURÍDICA PASSARAM COM SUCESSO!');
