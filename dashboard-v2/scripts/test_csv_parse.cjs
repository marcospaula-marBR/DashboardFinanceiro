const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const Papa = require('papaparse');

// Ler dados_tratado_jun25_em_diante.csv
const buffer = fs.readFileSync('public/dados_tratado_jun25_em_diante.csv');
const content = iconv.decode(buffer, 'win1252');

const parsed = Papa.parse(content, {
  header: true,
  skipEmptyLines: true,
  delimiter: ";"
});

console.log('Linhas brutas no CSV:', parsed.data.length);
console.log('Headers:', parsed.meta.fields);

const forns = new Set();
const ccs = new Set();
const emps = new Set();

parsed.data.forEach(r => {
  const f = r['Cliente ou Fornecedor'] || r['Cliente/Fornecedor'] || r['Fornecedor'];
  const c = r['Conta Corrente'];
  const e = r['Nome do Meu Aplicativo'] || r['Minha Empresa (Nome Fantasia)'] || r['Empresa'];
  if (f) forns.add(f.trim());
  if (c) ccs.add(c.trim());
  if (e) emps.add(e.trim());
});

console.log('Empresas no CSV:', Array.from(emps));
console.log('Total de Fornecedores únicos:', forns.size);
console.log('Total de Contas Correntes únicas:', ccs.size);
console.log('Exemplos de Fornecedores:', Array.from(forns).slice(0, 15));
console.log('Exemplos de Contas Correntes:', Array.from(ccs).slice(0, 15));
