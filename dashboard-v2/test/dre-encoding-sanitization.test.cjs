const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

/**
 * Carrega e compila dinamicamente src/services/dre.service.ts em memória para
 * validar o código TypeScript real de produção nos testes unitários.
 */
function loadDreServiceModule() {
  const filePath = path.resolve(__dirname, '../src/services/dre.service.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  });

  const mod = new Module(filePath, module);
  mod.filename = filePath;
  mod.paths = Module._nodeModulePaths(path.dirname(filePath));
  mod._compile(transpiled.outputText, filePath);
  return mod.exports;
}

const dreMod = loadDreServiceModule();
const {
  fixMojibake,
  normalizeEmpresa,
  normalizeDepartamento,
  normalizeProjeto,
  normalizeContaDre,
  normalizeCategoria,
  sanitizeDreRow,
  sanitizeDreFilters,
  DreService,
} = dreMod;

const seedHelpers = require('../scripts/seed_clean_snapshot.cjs');

console.log('=== TESTES UNITÁRIOS: SANITIZAÇÃO DE ENCODING & FILTROS DRE ===\n');

// 1. Variantes com Unicode Replacement Character (\uFFFD)
console.log('1. Testando reparo de caracteres \\uFFFD...');
assert.strictEqual(fixMojibake('Alimentação/Refeiç\uFFFD\uFFFDo'), 'Alimentação/Refeição');
assert.strictEqual(fixMojibake('Alimenta\uFFFD\uFFFDão/Refeição'), 'Alimentação/Refeição');
assert.strictEqual(fixMojibake('Alimentação/Refeiç\uFFFDo'), 'Alimentação/Refeição');
assert.strictEqual(fixMojibake('Vale Alimenta\uFFFD\uFFFDão/Refeição'), 'Vale Alimentação/Refeição');
assert.strictEqual(
  fixMojibake('Alimentação/Refeiç\uFFFD\uFFFDo - Com Clientes/Prospects'),
  'Alimentação/Refeição - Com Clientes/Prospects'
);
assert.strictEqual(
  fixMojibake('Licen\uFFFD\uFFFDa de aplicativos e/ou aluguel de softwares - Administrativo'),
  'Licença de aplicativos e/ou aluguel de softwares - Administrativo'
);
assert.strictEqual(
  fixMojibake('Capina El\uFFFD\uFFFDtrica / Mam / Crestani / Zasso'),
  'Capina Elétrica / Mam / Crestani / Zasso'
);
assert.strictEqual(fixMojibake('S\uFFFD\uFFFDo Paulo Crsn Psp 6018/2025'), 'São Paulo Crsn Psp 6018/2025');
console.log('   ✅ Variantes com \\uFFFD reparadas corretamente.');

// 2. Variantes truncadas sem acento (CSVs históricos e snapshots legados)
console.log('\n2. Testando reparo de palavras truncadas sem acento...');
assert.strictEqual(fixMojibake('Custo dos Servios Prestados'), 'Custo dos Serviços Prestados');
assert.strictEqual(fixMojibake('Proviso - IRPJ e CSSL Trimestral'), 'Provisão - IRPJ e CSSL Trimestral');
assert.strictEqual(fixMojibake('Recuperao de Despesas Variveis'), 'Recuperação de Despesas Variáveis');
assert.strictEqual(fixMojibake('Locao Oftalmolgico 14/2021 033/2021'), 'Locação Oftalmológico 14/2021 033/2021');
assert.strictEqual(fixMojibake('Jurdico'), 'Jurídico');
assert.strictEqual(fixMojibake('Juros e devolues'), 'Juros e devoluções');
assert.strictEqual(fixMojibake('Terceirizao de Mo de Obra'), 'Terceirização de Mão de Obra');
assert.strictEqual(fixMojibake('Servios'), 'Serviços');
assert.strictEqual(normalizeDepartamento('DZM - Imveis Guilhermina'), 'Dzm - Imóveis Guilhermina');
assert.strictEqual(normalizeDepartamento('DZM - Terceirizao'), 'Dzm - Terceirização');
assert.strictEqual(normalizeDepartamento('DZM - Ribeirpolis - Galpo 0643'), 'Dzm - Ribeirópolis - Galpão 0643');
assert.strictEqual(normalizeDepartamento('DZM - Terceirizao', false), 'DZM - Terceirização');
console.log('   ✅ Truncamentos históricos reparados em ambos modos de capitalização.');

// 3. Mojibake UTF-8 / Latin-1 / Windows-1252 e proteção contra falsos positivos
console.log('\n3. Testando decodificação mojibake e preservação de palavras válidas...');
assert.strictEqual(fixMojibake('ALUMAX SERVI\u00C3\u0087OS E TRANSPORTE LTDA'), 'ALUMAX SERVIÇOS E TRANSPORTE LTDA');
assert.strictEqual(fixMojibake('ATACAD\u00C3\u0083O'), 'ATACADÃO');
assert.strictEqual(fixMojibake('OXIG\u00C3\u008ANIO LITORAL'), 'OXIGÊNIO LITORAL');
assert.strictEqual(fixMojibake('KOPENHAGEM FOZ DO IGUA\u00C3\u0087U'), 'KOPENHAGEM FOZ DO IGUAÇU');
assert.strictEqual(fixMojibake('Distribuidora de \u00C3\u00A1gua atacado e varejo'), 'Distribuidora de água atacado e varejo');
assert.strictEqual(fixMojibake('J\u00C3\u00BAlio Vieira'), 'Júlio Vieira');
assert.strictEqual(fixMojibake('Verde Mundo Caf\u00C3\u00A9 com Flores'), 'Verde Mundo Café com Flores');
assert.strictEqual(fixMojibake('MINIMERCADO PRIMO\u00C2\u00B4S'), 'MINIMERCADO PRIMO´S');

// Sem alteração indevida em strings limpas
assert.strictEqual(fixMojibake('ATACADÃO'), 'ATACADÃO');
assert.strictEqual(fixMojibake('PÃO DE AÇÚCAR'), 'PÃO DE AÇÚCAR');
assert.strictEqual(fixMojibake('SÃO PAULO'), 'SÃO PAULO');
assert.strictEqual(fixMojibake('Serviços'), 'Serviços');
assert.strictEqual(fixMojibake('Licenciado Operacional'), 'Licenciado Operacional');
assert.strictEqual(fixMojibake(''), '');
assert.strictEqual(fixMojibake(null), '');
assert.strictEqual(fixMojibake(undefined), '');
console.log('   ✅ Mojibake decodificado sem alterar strings acentuadas legítimas.');

// 4. Detecção de corrupção em CSV (hasEncodingCorruption) e parseCSV ISO-8859-1 -> UTF-8 fallback
console.log('\n4. Testando hasEncodingCorruption e fallback ISO-8859-1 em parseCSV...');
assert.strictEqual(
  DreService.hasEncodingCorruption({
    meta: { fields: ['Empresa', 'Departamento', 'Categoria', 'Data', 'Valor'] },
    data: [{ Empresa: 'MarBR', Departamento: 'Rede Alpha', Categoria: 'Alimentação/Refeiç\uFFFD\uFFFDo' }],
  }),
  true,
  'Deve detectar \\uFFFD nas linhas mesmo com cabeçalhos 100% ASCII'
);
assert.strictEqual(
  DreService.hasEncodingCorruption({
    meta: { fields: ['RAZÃO SOCIAL', 'EMPRESA', 'SÃO PAULO'] },
    data: [{ EMPRESA: 'MarBR', 'RAZÃO SOCIAL': 'ATACADÃO', 'SÃO PAULO': 'Alimentação/Refeição' }],
  }),
  false,
  'Não deve gerar falso positivo para Ã maiúsculo válido em UTF-8'
);

// Simula leitura de CSV ISO-8859-1 no Node (onde FileReader não existe por padrão)
async function runParseCsvTests() {
  const isoBytes = Buffer.from(
    'Empresa;Departamento;Categoria;Jan/26\nMarBR;DZM - Terceirização;Alimentação/Refeição;123,45\n',
    'latin1'
  );
  const utfBytes = Buffer.from(
    'Empresa;Departamento;Categoria;Jan/26\nMarBR;DZM - Terceirização;Alimentação/Refeição;123,45\n',
    'utf8'
  );

  // Polyfill mínimo de FileReader para que PapaParse leia File em Node
  const origFileReader = global.FileReader;
  global.FileReader = class MockFileReader {
    readAsText(blob, encoding = 'UTF-8') {
      blob.arrayBuffer().then((ab) => {
        const buf = Buffer.from(ab);
        const enc = String(encoding).toLowerCase().includes('iso') ? 'windows-1252' : 'utf-8';
        this.result = new TextDecoder(enc).decode(buf);
        if (this.onload) this.onload({ target: { result: this.result } });
      });
    }
  };

  try {
    const isoFile = new File([isoBytes], 'iso.csv', { type: 'text/csv' });
    const parsedIso = await DreService.parseCSV(isoFile);
    assert.strictEqual(parsedIso.length, 1);
    assert.strictEqual(parsedIso[0].Departamento, 'DZM - Terceirização');
    assert.strictEqual(parsedIso[0].Categoria, 'Alimentação/Refeição');

    const utfFile = new File([utfBytes], 'utf.csv', { type: 'text/csv' });
    const parsedUtf = await DreService.parseCSV(utfFile);
    assert.strictEqual(parsedUtf.length, 1);
    assert.strictEqual(parsedUtf[0].Categoria, 'Alimentação/Refeição');
    console.log('   ✅ parseCSV realizou fallback ISO-8859-1 e leitura UTF-8 com 100% de precisão.');
  } finally {
    global.FileReader = origFileReader;
  }
}

// 5. sanitizeDreRow, sanitizeDreFilters, mergeWithHistoricalRows e DreService.calculate
console.log('\n5. Testando sanitizeDreRow, sanitizeDreFilters, mergeWithHistoricalRows e calculate...');
const rowCorrupted = sanitizeDreRow({
  Empresa: 'MAR BRASIL',
  Departamento: 'Capina El\uFFFD\uFFFDtrica / MAM / Crestani / Zasso',
  ContaDRE: '02. Despesas Administrativas',
  Projeto: 'S\uFFFD\uFFFDo Paulo Crsn Psp 6018/2025',
  Categoria: 'Alimenta\uFFFD\uFFFDão/Refeição',
  Fornecedor: 'ATACAD\u00C3\u0083O',
  ContaCorrente: 'Ita\u00C3\u00BA Unibanco',
  'Jan/26': 150.5,
});
assert.strictEqual(rowCorrupted.Empresa, 'MarBR');
assert.strictEqual(rowCorrupted.Departamento, 'Capina Elétrica / Mam / Crestani / Zasso');
assert.strictEqual(rowCorrupted.ContaDRE, 'Despesas Administrativas');
assert.strictEqual(rowCorrupted.Projeto, 'São Paulo Crsn Psp 6018/2025');
assert.strictEqual(rowCorrupted.Categoria, 'Alimentação/Refeição');
assert.strictEqual(rowCorrupted.Fornecedor, 'ATACADÃO');
assert.strictEqual(rowCorrupted.ContaCorrente, 'Itaú Unibanco');

const dirtyFilters = sanitizeDreFilters({
  empresas: ['MAR BRASIL', 'MarBR'],
  periodos: ['Jan/26'],
  departamentos: ['DZM - Terceirizao', 'Dzm - Terceirização'],
  contasDre: ['01. Custo dos Servios Prestados'],
  projetos: ['S\uFFFD\uFFFDo Paulo Crsn Psp 6018/2025'],
  categorias: ['Alimentação/Refeiç\uFFFD\uFFFDo', 'Alimenta\uFFFD\uFFFDão/Refeição'],
  fornecedores: ['ALUMAX SERVI\u00C3\u0087OS E TRANSPORTE LTDA'],
  contasCorrentes: ['Ita\u00C3\u00BA'],
  excludeSharedExpenses: false,
});
assert.deepStrictEqual(dirtyFilters.empresas, ['MarBR']);
assert.deepStrictEqual(dirtyFilters.departamentos, ['Dzm - Terceirização']);
assert.deepStrictEqual(dirtyFilters.contasDre, ['Custo dos Serviços Prestados']);
assert.deepStrictEqual(dirtyFilters.projetos, ['São Paulo Crsn Psp 6018/2025']);
assert.deepStrictEqual(dirtyFilters.categorias, ['Alimentação/Refeição']);
assert.deepStrictEqual(dirtyFilters.fornecedores, ['ALUMAX SERVIÇOS E TRANSPORTE LTDA']);
assert.deepStrictEqual(dirtyFilters.contasCorrentes, ['Itaú']);

const merged = DreService.mergeWithHistoricalRows(
  [
    {
      Empresa: 'MarBR',
      Departamento: 'Rede Alpha',
      ContaDRE: 'Despesas Administrativas',
      Projeto: 'Recursos Humanos',
      Categoria: 'Alimentação/Refeiç\uFFFD\uFFFDo',
      Fornecedor: 'NOBRE PAULISTA',
      ContaCorrente: 'Flash',
      'Jun/25': 10,
      'Jan/26': 5,
    },
    {
      Empresa: 'MarBR',
      Departamento: 'Capina El\uFFFD\uFFFDtrica / Mam / Crestani / Zasso',
      ContaDRE: 'Despesas Administrativas',
      Projeto: 'Ti',
      Categoria: 'Licen\uFFFD\uFFFDa de aplicativos e/ou aluguel de softwares - Administrativo',
      Fornecedor: 'MICROSOFT',
      ContaCorrente: 'Cartão',
      // Sem colunas de período (linha fantasma que será descartada)
    },
  ],
  [
    {
      Empresa: 'MarBR',
      Departamento: 'Rede Alpha',
      ContaDRE: 'Despesas Administrativas',
      Projeto: 'Recursos Humanos',
      Categoria: 'Alimentação/Refeição',
      Fornecedor: 'NOBRE PAULISTA',
      ContaCorrente: 'Flash',
      'Jan/26': 7,
    },
  ]
);
assert.strictEqual(merged.length, 1, 'Linha fantasma sem período deve ser descartada e chaves idênticas consolidadas');
assert.strictEqual(merged[0].Categoria, 'Alimentação/Refeição');
assert.strictEqual(merged[0]['Jun/25'], 10);
assert.strictEqual(merged[0]['Jan/26'], 7);

// Cálculo DRE com filtro de categoria, zero e valores negativos
const sampleEstrutura = [
  { titulo: 'Receita Bruta de Vendas', tipo: 'linha', categorias: ['Receita Bruta de Vendas'] },
  { titulo: 'Despesas Administrativas', tipo: 'linha', categorias: ['Despesas Administrativas'] },
];
const sampleRows = [
  {
    Empresa: 'MarBR',
    Departamento: 'Rede Alpha',
    ContaDRE: 'Despesas Administrativas',
    Projeto: 'Recursos Humanos',
    Categoria: 'Alimentação/Refeiç\uFFFD\uFFFDo',
    Fornecedor: 'A',
    ContaCorrente: 'B',
    'Jan/26': 100.5,
  },
  {
    Empresa: 'MarBR',
    Departamento: 'Rede Alpha',
    ContaDRE: 'Despesas Administrativas',
    Projeto: 'Recursos Humanos',
    Categoria: 'Alimenta\uFFFD\uFFFDão/Refeição',
    Fornecedor: 'C',
    ContaCorrente: 'B',
    'Jan/26': 0,
  },
  {
    Empresa: 'MarBR',
    Departamento: 'Rede Alpha',
    ContaDRE: 'Despesas Administrativas',
    Projeto: 'Recursos Humanos',
    Categoria: 'Alimentação/Refeição',
    Fornecedor: 'D',
    ContaCorrente: 'B',
    'Jan/26': -10.5,
  },
];
const sampleMeta = DreService.generateCombinedMetadata(sampleRows);
assert.deepStrictEqual(sampleMeta.categorias, ['Alimentação/Refeição']);
const calcResult = DreService.calculate(sampleRows, sampleMeta, sampleEstrutura, {
  empresas: ['MarBR'],
  periodos: ['Jan/26'],
  departamentos: [],
  contasDre: [],
  projetos: [],
  categorias: ['Alimentação/Refeição'],
  excludeSharedExpenses: false,
});
assert.strictEqual(calcResult.totais['Despesas Administrativas'], 90);
console.log('   ✅ Sanitização de linhas/filtros, merge histórico e calculate com valores positivos/zero/negativos validados.');

// 6. Seed helper (decodeCsvBufferSmart) e integridade dos CSVs históricos em public/
console.log('\n6. Testando decodeCsvBufferSmart e integridade dos CSVs em public/...');
assert.strictEqual(
  seedHelpers.decodeCsvBufferSmart(Buffer.from('DZM - Terceirização', 'utf8')),
  'DZM - Terceirização'
);
assert.strictEqual(
  seedHelpers.decodeCsvBufferSmart(Buffer.from('DZM - Terceirização', 'latin1')),
  'DZM - Terceirização'
);

const publicDir = path.resolve(__dirname, '../public');
let checkedCsvCount = 0;
for (const csvName of ['base_manual_dre.csv', 'dados-ABR26-consolidado.csv', 'dados-foraOmie.csv']) {
  const csvPath = path.join(publicDir, csvName);
  if (!fs.existsSync(csvPath)) {
    console.log(`   ℹ️  ${csvName} ausente (ignorado por .gitignore); validação em disco ignorada neste ambiente.`);
    continue;
  }
  const buf = fs.readFileSync(csvPath);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  assert.ok(!text.includes('\uFFFD'), `${csvName} não deve conter \\uFFFD`);
  assert.ok(
    !/Eltrica|Imveis|Terceirizao|So Paulo|Servios|Proviso|Recuperao|Variveis|Locao|Climatizao|Ribeirpolis|Galpo|Oftalmolgico|Jurdico|devolues|Mo de Obra/.test(text),
    `${csvName} não deve conter palavras truncadas legadas`
  );
  checkedCsvCount++;
}
console.log(`   ✅ CSVs históricos em public/ validados (${checkedCsvCount}/3 presentes em disco em UTF-8 válido).`);

runParseCsvTests()
  .then(() => {
    console.log('\n🎉 TODOS OS TESTES DE SANITIZAÇÃO DE ENCODING PASSARAM COM SUCESSO!');
  })
  .catch((err) => {
    console.error('\n❌ FALHA NO TESTE:', err);
    process.exit(1);
  });
