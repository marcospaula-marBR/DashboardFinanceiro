const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadAnomalyService() {
  const filePath = path.resolve(__dirname, '../src/services/people-cost-anomaly.service.ts');
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
    Map,
    Set,
    Array,
    Object,
    parseInt,
    isNaN,
    Boolean,
  };
  vm.runInNewContext(transpiled.outputText, sandbox, { filename: filePath });
  return mod.exports;
}

const anomalySvc = loadAnomalyService();
const {
  getPreviousCompetenciaKey,
  evaluateRowAnomalies,
  buildCompetenciasAnomalyMap,
} = anomalySvc;

console.log('=== TESTES UNITÁRIOS: AUDITORIA AUTOMÁTICA MoM DE CUSTOS (PEOPLE) ===\n');

// 1. Resolução da competência anterior (incluindo virada de ano e entradas inválidas)
console.log('1. getPreviousCompetenciaKey (padrão, virada de ano e inválido)...');
assert.strictEqual(getPreviousCompetenciaKey('2026-10-01'), '2026-09');
assert.strictEqual(getPreviousCompetenciaKey('2026-01-01'), '2025-12');
assert.strictEqual(getPreviousCompetenciaKey('2026-01'), '2025-12');
assert.strictEqual(getPreviousCompetenciaKey(''), '');
assert.strictEqual(getPreviousCompetenciaKey('invalido'), '');
console.log('   OK!');

// 2. Caso padrão estável (sem anomalias)
console.log('2. Caso padrão estável (variação <15%, benefícios preservados, contrato aderente)...');
const prevClt = {
  id: 'c-sep',
  employeeId: 'e1',
  competencia: '2026-09-01',
  isCLT: true,
  isEstagio: false,
  isPJ: false,
  proventosOrBase: 2000,
  vt: 350,
  vrCesta: 320,
  liquido: 2300,
  contractBase: 2000,
};
const currCltStable = {
  ...prevClt,
  id: 'c-oct',
  competencia: '2026-10-01',
  proventosOrBase: 2050,
  liquido: 2380, // +3.48%
};
assert.strictEqual(evaluateRowAnomalies(currCltStable, prevClt).length, 0);
console.log('   OK!');

// 3. Variação MoM positiva e negativa (warning vs alert)
console.log('3. Variação MoM acima de 15% (warning) e acima de 30% (alert)...');
const upWarning = evaluateRowAnomalies({ ...currCltStable, liquido: 2760 }, prevClt); // +20%
assert.strictEqual(upWarning.length, 1);
assert.strictEqual(upWarning[0].code, 'VARIATION_UP');
assert.strictEqual(upWarning[0].severity, 'warning');

const upAlert = evaluateRowAnomalies({ ...currCltStable, liquido: 3220 }, prevClt); // +40%
assert.strictEqual(upAlert[0].code, 'VARIATION_UP');
assert.strictEqual(upAlert[0].severity, 'alert');

const downAlert = evaluateRowAnomalies({ ...currCltStable, liquido: 1400 }, prevClt); // -39.1%
assert.strictEqual(downAlert[0].code, 'VARIATION_DOWN');
assert.strictEqual(downAlert[0].severity, 'alert');
console.log('   OK!');

// 4. Filtro anti-ruído (< R$ 50 de diferença absoluta não dispara alerta mesmo se > 15%)
console.log('4. Filtro anti-ruído para valores baixos (< R$ 50,00)...');
const tinyPrev = { ...prevClt, liquido: 40, vt: 0, vrCesta: 0, contractBase: 0 };
const tinyCurr = { ...currCltStable, liquido: 60, vt: 0, vrCesta: 0, contractBase: 0 }; // +50% mas apenas +R$ 20
assert.strictEqual(evaluateRowAnomalies(tinyCurr, tinyPrev).length, 0);
console.log('   OK!');

// 5. Benefícios zerados: CLT (VT + VR/Cesta), Estágio (Aux. Transp., sem VR), PJ (NUNCA dispara VT/VR)
console.log('5. Benefícios ausentes por natureza jurídica (CLT, Estágio e blindagem PJ)...');
const cltMissingBenefits = evaluateRowAnomalies({ ...currCltStable, vt: 0, vrCesta: 0 }, prevClt);
const cltCodes = Array.from(cltMissingBenefits.map(a => a.code));
assert.ok(cltCodes.includes('MISSING_VT'));
assert.ok(cltCodes.includes('MISSING_VR_CESTA'));

const estPrev = {
  id: 'est-sep',
  employeeId: 'e2',
  competencia: '2026-09-01',
  isCLT: true,
  isEstagio: true,
  isPJ: false,
  proventosOrBase: 1000,
  vt: 220,
  vrCesta: 100,
  liquido: 1220,
  contractBase: 1000,
};
const estCurr = { ...estPrev, id: 'est-oct', competencia: '2026-10-01', vt: 0, vrCesta: 0 };
const estAlerts = evaluateRowAnomalies(estCurr, estPrev);
assert.strictEqual(estAlerts.length, 1);
assert.strictEqual(estAlerts[0].code, 'MISSING_VT');
assert.strictEqual(estAlerts[0].shortLabel, 'Sem Aux. Transp.');

const pjPrev = {
  id: 'pj-sep',
  employeeId: 'e3',
  competencia: '2026-09-01',
  isCLT: false,
  isEstagio: false,
  isPJ: true,
  proventosOrBase: 5000,
  vt: 200, // mesmo se legado tiver valor, PJ nunca recebe alerta trabalhista de VT/VR
  vrCesta: 300,
  liquido: 5000,
  contractBase: 5000,
};
const pjCurr = { ...pjPrev, id: 'pj-oct', competencia: '2026-10-01', vt: 0, vrCesta: 0 };
assert.strictEqual(evaluateRowAnomalies(pjCurr, pjPrev).length, 0, 'PJ nunca deve receber alerta de VT/VR');
console.log('   OK!');

// 6. Divergência contratual (>= 20% vs cadastro vigente) com léxico por regime
console.log('6. Divergência contratual (CLT Proventos vs Estágio Bolsa vs PJ Honorários)...');
const pjDivergence = evaluateRowAnomalies({ ...pjCurr, proventosOrBase: 7000, liquido: 5000 }, pjPrev);
assert.strictEqual(pjDivergence.length, 1);
assert.strictEqual(pjDivergence[0].code, 'CONTRACT_DIVERGENCE');
assert.strictEqual(pjDivergence[0].severity, 'alert'); // +40%
assert.ok(pjDivergence[0].detail.startsWith('Honorários'));

const estDivergence = evaluateRowAnomalies({ ...estPrev, proventosOrBase: 1300, liquido: 1220 }, estPrev);
assert.strictEqual(estDivergence[0].code, 'CONTRACT_DIVERGENCE');
assert.ok(estDivergence[0].detail.startsWith('Bolsa'));
console.log('   OK!');

// 7. Valores zerados, negativos e entrada sem mês anterior
console.log('7. Casos de borda: zerados, negativos e sem competência anterior...');
const zeroCurr = { ...currCltStable, proventosOrBase: 0, vt: 0, vrCesta: 0, liquido: 0 };
assert.strictEqual(evaluateRowAnomalies(zeroCurr, undefined).length, 0);
const negCurr = { ...currCltStable, proventosOrBase: -500, liquido: -100, vt: 350, vrCesta: 320 };
assert.strictEqual(evaluateRowAnomalies(negCurr, prevClt).length, 0);
console.log('   OK!');

// 8. buildCompetenciasAnomalyMap O(N) em histórico multi-período com virada de ano
console.log('8. buildCompetenciasAnomalyMap multi-período e virada de ano (2025-12 -> 2026-01)...');
assert.strictEqual(buildCompetenciasAnomalyMap([]).size, 0);

const historyMap = buildCompetenciasAnomalyMap([
  {
    cost: { id: 'h1', employee_id: 'e1', competencia: '2025-12-01', valor_holerite: 2000, valor_vt: 300, valor_cesta: 320 },
    emp: { id: 'e1', remuneration_fixed: 2000 },
    financials: { fixo: 2000 },
    realTotal: 2200,
    isCLT: true,
    isPJ: false,
    isEstagio: false,
  },
  {
    cost: { id: 'h2', employee_id: 'e1', competencia: '2026-01-01', valor_holerite: 2000, valor_vt: 0, valor_cesta: 320 },
    emp: { id: 'e1', remuneration_fixed: 2000 },
    financials: { fixo: 2000 },
    realTotal: 2750, // +25% MoM + Sem VT
    isCLT: true,
    isPJ: false,
    isEstagio: false,
  },
  {
    cost: { id: 'invalid-no-emp', competencia: '2026-01-01' },
    financials: {},
    realTotal: 1000,
    isCLT: true,
    isPJ: false,
    isEstagio: false,
  },
]);

assert.strictEqual(historyMap.has('h1'), false, 'Primeiro mês sem histórico anterior e aderente ao contrato não gera alerta');
assert.strictEqual(historyMap.has('h2'), true, 'Janeiro/2026 deve cruzar com Dezembro/2025 e detectar anomalias');
const h2Codes = Array.from(historyMap.get('h2').map(a => a.code));
assert.ok(h2Codes.includes('VARIATION_UP'));
assert.ok(h2Codes.includes('MISSING_VT'));
console.log('   OK!');

console.log('\n✅ TODOS OS 8 BLOCOS DE TESTES DE AUDITORIA MoM PASSARAM COM SUCESSO!');
