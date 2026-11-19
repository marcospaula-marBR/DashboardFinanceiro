const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadAnalyticsService() {
  const hrPath = path.resolve(__dirname, '../src/services/people-hr.service.ts');
  const hrSource = fs.readFileSync(hrPath, 'utf8');
  // Extrai apenas calculateRowFinancials para não depender de cliente Supabase nos testes puros
  const startIdx = hrSource.indexOf('export function calculateRowFinancials');
  const endIdx = hrSource.indexOf('export const PeopleHRService');
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

  const filePath = path.resolve(__dirname, '../src/services/people-costs-analytics.service.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });

  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require: (id) => {
      if (id === '@/services/people-hr.service') return hrMod.exports;
      return require(id);
    },
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

const svc = loadAnalyticsService();
const {
  enrichHistoricalCosts,
  queryTotalByPeriod,
  queryVerbaBreakdown,
  queryTopMoversMoM,
  queryEmployeeCostHistory,
  queryMonthlyTrend,
  buildCompactExecutiveContext,
} = svc;

console.log('=== TESTES UNITÁRIOS: ANALYTICS DETERMINÍSTICO DO COPILOTO & MIGRAÇÃO SQL (FASE 3) ===\n');

const sampleEmps = [
  { id: 'e-clt', name: 'BRUNO VIANA', company: 'DZM', linkType: 'CLT', department: 'Operações', job_role: 'Oficial', document_id: '456.671.868-96', remuneration_fixed: 1849.81 },
  { id: 'e-est', name: 'GUSTAVO DIAS', company: 'DZM', linkType: 'Estagiário', department: 'Administrativo', job_role: 'Estagiário', document_id: '527.562.338-00', remuneration_fixed: 1000 },
  { id: 'e-pj', name: 'Carlos Silva', corporate_name: 'SILVA CONSULTORIA LTDA', company: 'MarBR', linkType: 'PJ', pj_type: '12.345.678/0001-90', department: 'TI', job_role: 'Engenharia', remuneration_fixed: 8000 },
];

const sampleCosts = [
  // Setembro 2026
  { id: 'c1', employee_id: 'e-clt', competencia: '2026-09-01', vinculo_tipo: 'CLT', valor_holerite: 1850, valor_descontos: 850, valor_adiantamento: 700, valor_vt: 400, valor_cesta: 320, valor_bonus: 200, valor_ajuda_custo: 0 },
  { id: 'c2', employee_id: 'e-est', competencia: '2026-09-01', vinculo_tipo: 'CLT', valor_holerite: 1000, valor_descontos: 0, valor_vt: 220 },
  { id: 'c3', employee_id: 'e-pj', competencia: '2026-09-01', vinculo_tipo: 'MEI', valor_fixo: 8000, valor_bonus: 0, valor_ajuda_custo: 150, valor_deducoes: 0, valor_liquido: 8150 },
  // Outubro 2026
  { id: 'c4', employee_id: 'e-clt', competencia: '2026-10-01', vinculo_tipo: 'CLT', valor_holerite: 1900, valor_descontos: 900, valor_adiantamento: 700, valor_vt: 420, valor_cesta: 320, valor_bonus: 300, valor_ajuda_custo: 100 },
  { id: 'c5', employee_id: 'e-est', competencia: '2026-10-01', vinculo_tipo: 'CLT', valor_holerite: 1000, valor_descontos: 0, valor_vt: 220 },
  { id: 'c6', employee_id: 'e-pj', competencia: '2026-10-01', vinculo_tipo: 'MEI', valor_fixo: 8000, valor_bonus: 1500, valor_comissao: 500, valor_ajuda_custo: 150, valor_deducoes: 100, valor_liquido: 10050 },
];

const enriched = enrichHistoricalCosts(sampleCosts, sampleEmps);

// 1. Enriquecimento e segregação jurídica (CLT / ESTAGIO / PJ)
console.log('1. enrichHistoricalCosts (segregação CLT/Estágio/PJ e Razão Social em PJ)...');
assert.strictEqual(enriched.length, 6);
const pjRow = enriched.find((r) => r.id === 'c6');
assert.strictEqual(pjRow.legalNature, 'PJ');
assert.strictEqual(pjRow.displayName, 'SILVA CONSULTORIA LTDA');
assert.strictEqual(pjRow.liquido, 10050);
const estRow = enriched.find((r) => r.id === 'c2');
assert.strictEqual(estRow.legalNature, 'ESTAGIO');
assert.strictEqual(estRow.liquido, 1220);
console.log('   OK!');

// 2. queryTotalByPeriod com filtros de período, empresa e regime
console.log('2. queryTotalByPeriod (totais por período, empresa e natureza jurídica)...');
const octTot = queryTotalByPeriod(enriched, { startCompetencia: '2026-10', endCompetencia: '2026-10' });
assert.strictEqual(octTot.totalRegistros, 3);
assert.strictEqual(octTot.porNaturezaJuridica.folhaClt.totalLiquido, 2840);
assert.strictEqual(octTot.porNaturezaJuridica.bolsasEstagioLei11788.totalLiquido, 1220);
assert.strictEqual(octTot.porNaturezaJuridica.contratosPjMei.totalLiquido, 10050);
assert.strictEqual(octTot.totalGeralDesembolsado, 14110);
assert.strictEqual(queryTotalByPeriod(enriched, { company: 'DZM', year: 2026 }).porNaturezaJuridica.contratosPjMei.registros, 0);
console.log('   OK!');

// 3. queryVerbaBreakdown (VT, VR/Cesta, Bônus, Comissões, Glosas)
console.log('3. queryVerbaBreakdown (VT DZM, VR/Cesta CLT, Honorários/Comissões/Glosas PJ)...');
const dzmVerbas = queryVerbaBreakdown(enriched, { company: 'DZM', year: 2026 });
assert.strictEqual(dzmVerbas.folhaClt.valeTransporteVt, 820); // 400 + 420
assert.strictEqual(dzmVerbas.folhaClt.vrCestaBasica, 640); // 320 + 320
assert.strictEqual(dzmVerbas.estagioLei11788.auxilioTransporte, 440); // 220 + 220
const pjVerbas = queryVerbaBreakdown(enriched, { regime: 'PJ', year: 2026 });
assert.strictEqual(pjVerbas.contratosPjMei.honorariosBase, 16000);
assert.strictEqual(pjVerbas.contratosPjMei.comissoes, 500);
assert.strictEqual(pjVerbas.contratosPjMei.glosasDeducoes, 100);
assert.strictEqual(pjVerbas.contratosPjMei.valorLiquidoNf, 18200);
console.log('   OK!');

// 4. queryTopMoversMoM (variações MoM > 10% em PJ)
console.log('4. queryTopMoversMoM (maiores variações MoM por regime)...');
const pjMovers = queryTopMoversMoM(enriched, { competencia: '2026-10', regime: 'PJ', minDeltaPercent: 10, direction: 'up' });
assert.strictEqual(pjMovers.competenciaAnterior, '2026-09');
assert.strictEqual(pjMovers.variacoes.length, 1);
assert.strictEqual(pjMovers.variacoes[0].entidade, 'SILVA CONSULTORIA LTDA');
assert.strictEqual(pjMovers.variacoes[0].variacaoAbsoluta, 1900);
assert.strictEqual(pjMovers.variacoes[0].variacaoPercentual, 23.31);
console.log('   OK!');

// 5. queryEmployeeCostHistory & queryMonthlyTrend & buildCompactExecutiveContext
console.log('5. queryEmployeeCostHistory, queryMonthlyTrend e buildCompactExecutiveContext (100% cobertura sem truncamento)...');
const hist = queryEmployeeCostHistory(enriched, { query: 'SILVA CONSULTORIA' });
assert.strictEqual(hist.encontrado, true);
assert.strictEqual(hist.totalMeses, 2);
assert.strictEqual(hist.totalAcumulado, 18200);
assert.strictEqual(hist.mediaMensal, 9100);

const trend = queryMonthlyTrend(enriched, { year: 2026 });
assert.strictEqual(trend.totalMeses, 2);
assert.strictEqual(trend.serieMensal[0].competencia, '2026-09');
assert.strictEqual(trend.serieMensal[1].competencia, '2026-10');
assert.ok(trend.serieMensal[1].variacaoMomAbsoluta > 0);

const compactCtx = buildCompactExecutiveContext(sampleCosts, sampleEmps, true);
assert.strictEqual(compactCtx.totalHistoricalRows, 6);
assert.strictEqual(compactCtx.periodCovered, '2026-09 a 2026-10');
assert.strictEqual(compactCtx.monthlyAggregatedByLegalNature.length, 2);

const maskedCtx = buildCompactExecutiveContext(sampleCosts, sampleEmps, false);
assert.strictEqual(maskedCtx.monthlyAggregatedByLegalNature[0].grandTotal, '••••••');

// Casos vazios
assert.strictEqual(queryTotalByPeriod([]).totalGeralDesembolsado, 0);
assert.strictEqual(queryTopMoversMoM([]).variacoes.length, 0);
assert.strictEqual(queryEmployeeCostHistory([], { query: 'ninguem' }).encontrado, false);
console.log('   OK!');

// 6. Integridade do script de migração SQL da Fase 3
console.log('6. Verificação estrutural do arquivo SQL auditável da Fase 3...');
const sqlPath = path.resolve(__dirname, '../supabase/migrations/20261119_people_monthly_costs_scale.sql');
const sqlText = fs.readFileSync(sqlPath, 'utf8');
assert.ok(sqlText.includes('uq_people_monthly_costs_employee_competencia'), 'SQL deve criar constraint UNIQUE');
assert.ok(sqlText.includes('CREATE OR REPLACE FUNCTION public.upsert_people_monthly_costs_batch'), 'SQL deve criar RPC atômica');
assert.ok(sqlText.includes('CREATE OR REPLACE VIEW public.vw_people_monthly_costs_enriched'), 'SQL deve criar View enriquecida');
assert.ok(sqlText.includes('CREATE OR REPLACE FUNCTION public.get_people_monthly_costs_kpis'), 'SQL deve criar RPC de KPIs');
assert.ok(sqlText.includes('RAISE EXCEPTION'), 'SQL deve conter guarda de segurança contra duplicatas');
assert.ok(sqlText.includes("NOTIFY pgrst, 'reload schema'"), 'SQL deve recarregar cache do PostgREST');
console.log('   OK!');

console.log('\n✅ TODOS OS 6 BLOCOS DE TESTES DE ANALYTICS DETERMINÍSTICO & MIGRAÇÃO SQL PASSARAM COM SUCESSO!');
