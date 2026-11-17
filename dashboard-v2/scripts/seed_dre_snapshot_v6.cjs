const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const {
  decodeCsvBufferSmart,
  fixMojibake,
  normalizeEmpresa,
  normalizeDepartamento,
  normalizeProjeto,
  normalizeContaDre,
  normalizeCategoria
} = require('./seed_clean_snapshot.cjs');

function getSupabaseClient() {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
      }
    }
  });
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

const MESES_ORDEM = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function normalizeMes(mes) {
  return mes.trim().charAt(0).toUpperCase() + mes.trim().slice(1).toLowerCase();
}

async function consolidateAndUploadSnapshot() {
  const supabase = getSupabaseClient();
  console.log("🚀 Iniciando consolidação com Fornecedores, Contas Correntes e Conectius unificado...");

  // 1. Ler Base Manual (detecção automática UTF-8 vs Windows-1252)
  const bufManual = fs.readFileSync('public/base_manual_dre.csv');
  const contentManual = decodeCsvBufferSmart(bufManual);
  const parsedManual = Papa.parse(contentManual, { header: true, skipEmptyLines: true, delimiter: ";" });

  // 2. Ler Omie Transacional (detecção automática UTF-8 vs Windows-1252)
  const bufOmie = fs.readFileSync('public/dados_tratado_jun25_em_diante.csv');
  const contentOmie = decodeCsvBufferSmart(bufOmie);
  const parsedOmie = Papa.parse(contentOmie, { header: true, skipEmptyLines: true, delimiter: ";" });

  console.log(`Base Manual: ${parsedManual.data.length} linhas | Omie Transacional: ${parsedOmie.data.length} linhas`);

  // Pivot Map: key -> { Empresa, Departamento, ContaDRE, Projeto, Categoria, Fornecedor, ContaCorrente, valores }
  const pivotMap = new Map();

  // Processar Base Manual (Arquivo tabular pré-jun/25)
  const manualHeaders = parsedManual.meta.fields || [];
  const monthHeadersManual = manualHeaders.filter(h => h.includes('/'));

  parsedManual.data.forEach(row => {
    const rawEmp = row['Empresa'] || 'Geral';
    const emp = normalizeEmpresa(rawEmp);
    const dep = normalizeDepartamento(row['Departamento'] || row['Projeto'] || 'Sem Departamento') || 'Sem Departamento';
    const cDre = normalizeContaDre(row['ContaDRE'] || row['Categoria'] || 'Sem Conta DRE') || 'Sem Conta DRE';
    const proj = normalizeProjeto(row['Projeto'] || 'Sem Projeto') || 'Sem Projeto';
    const cat = normalizeCategoria(row['Categoria'] || cDre, cDre) || cDre;
    const forn = fixMojibake(row['Fornecedor'] || 'Sem Fornecedor') || 'Sem Fornecedor';
    const cCorr = fixMojibake(row['ContaCorrente'] || row['Conta Corrente'] || 'Sem Conta Corrente') || 'Sem Conta Corrente';

    const key = `${emp}|${dep}|${cDre}|${proj}|${cat}|${forn}|${cCorr}`;

    if (!pivotMap.has(key)) {
      pivotMap.set(key, {
        Empresa: emp,
        Departamento: dep,
        ContaDRE: cDre,
        Projeto: proj,
        Categoria: cat,
        Fornecedor: forn,
        ContaCorrente: cCorr,
        valores: {}
      });
    }

    const item = pivotMap.get(key);
    monthHeadersManual.forEach(mHeader => {
      const valStr = row[mHeader];
      if (valStr) {
        const val = parseFloat(valStr.toString().replace(/\./g, '').replace(',', '.')) || 0;
        if (val !== 0) {
          const partes = mHeader.split('/');
          const mesNorm = normalizeMes(partes[0]);
          const anoCurto = partes[1].trim();
          const colLabel = `${mesNorm}/${anoCurto}`;
          item.valores[colLabel] = (item.valores[colLabel] || 0) + val;
        }
      }
    });
  });

  // Processar Omie Transacional
  parsedOmie.data.forEach(row => {
    const dataStr = row['Data (completa)'] || row['Data'] || '';
    const valorStr = row['Valor'] || '0';
    if (!dataStr) return;

    const valor = Math.abs(parseFloat(valorStr.toString().replace(/\./g, '').replace(',', '.')));
    if (isNaN(valor) || valor === 0) return;

    let mesLabel = '';
    const partes = dataStr.split('/');
    if (partes.length === 3) {
      let mes = parseInt(partes[0]);
      let dia = parseInt(partes[1]);
      let anoCompleto = partes[2].trim().split(' ')[0];
      if (mes > 12) {
        const temp = mes; mes = dia; dia = temp;
      }
      if (mes >= 1 && mes <= 12) {
        const mesNome = MESES_ORDEM[mes - 1];
        const anoCurto = anoCompleto.length === 4 ? anoCompleto.slice(-2) : anoCompleto;
        mesLabel = `${mesNome}/${anoCurto}`;
      }
    }

    if (!mesLabel) return;

    const rawEmp = row['Nome do Meu Aplicativo'] || row['Minha Empresa (Nome Fantasia)'] || 'Geral';
    const emp = normalizeEmpresa(rawEmp);
    const dep = normalizeDepartamento(row['Departamento'] || 'Sem Departamento') || 'Sem Departamento';
    const cDre = normalizeContaDre(row['Conta do DRE'] || 'Sem Conta DRE') || 'Sem Conta DRE';
    const proj = normalizeProjeto(row['Projeto'] || 'Sem Projeto') || 'Sem Projeto';
    const cat = normalizeCategoria(row['Categoria'] || cDre, cDre) || cDre;

    const forn = fixMojibake(row['Cliente ou Fornecedor'] || 'Sem Fornecedor') || 'Sem Fornecedor';
    const cCorr = fixMojibake(row['Conta Corrente'] || 'Sem Conta Corrente') || 'Sem Conta Corrente';

    const key = `${emp}|${dep}|${cDre}|${proj}|${cat}|${forn}|${cCorr}`;

    if (!pivotMap.has(key)) {
      pivotMap.set(key, {
        Empresa: emp,
        Departamento: dep,
        ContaDRE: cDre,
        Projeto: proj,
        Categoria: cat,
        Fornecedor: forn,
        ContaCorrente: cCorr,
        valores: {}
      });
    }

    const item = pivotMap.get(key);
    item.valores[mesLabel] = (item.valores[mesLabel] || 0) + valor;
  });

  console.log(`Total de combinações dimensionais agregadas: ${pivotMap.size}`);

  // Converter para DreRow[]
  const rawData = [];
  const allMonthsSet = new Set();
  const empresasSet = new Set();
  const deptsSet = new Set();
  const contasSet = new Set();
  const projsSet = new Set();
  const catsSet = new Set();
  const fornsSet = new Set();
  const ccsSet = new Set();

  for (const item of pivotMap.values()) {
    const rowObj = {
      Empresa: item.Empresa,
      Departamento: item.Departamento,
      ContaDRE: item.ContaDRE,
      Projeto: item.Projeto,
      Categoria: item.Categoria,
      Fornecedor: item.Fornecedor,
      ContaCorrente: item.ContaCorrente
    };

    empresasSet.add(item.Empresa);
    if (item.Departamento) deptsSet.add(item.Departamento);
    if (item.ContaDRE) contasSet.add(item.ContaDRE);
    if (item.Projeto) projsSet.add(item.Projeto);
    if (item.Categoria) catsSet.add(item.Categoria);
    if (item.Fornecedor) fornsSet.add(item.Fornecedor);
    if (item.ContaCorrente) ccsSet.add(item.ContaCorrente);

    for (const [mes, val] of Object.entries(item.valores)) {
      rowObj[mes] = Math.round(val * 100) / 100;
      allMonthsSet.add(mes);
    }
    rawData.push(rowObj);
  }

  const periodosList = Array.from(allMonthsSet).sort((a, b) => {
    const [mesA, anoA] = a.split('/');
    const [mesB, anoB] = b.split('/');
    const yA = parseInt(anoA) < 100 ? 2000 + parseInt(anoA) : parseInt(anoA);
    const yB = parseInt(anoB) < 100 ? 2000 + parseInt(anoB) : parseInt(anoB);
    if (yA !== yB) return yA - yB;
    return MESES_ORDEM.indexOf(mesA) - MESES_ORDEM.indexOf(mesB);
  });

  const mapaMeses = {};
  for (const p of periodosList) {
    const [mes] = p.split('/');
    mapaMeses[p] = mes;
  }

  const metadata = {
    empresas: Array.from(empresasSet).sort(),
    departamentos: Array.from(deptsSet).sort(),
    contasDre: Array.from(contasSet).sort(),
    projetos: Array.from(projsSet).sort(),
    categorias: Array.from(catsSet).sort(),
    fornecedores: Array.from(fornsSet).sort(),
    contasCorrentes: Array.from(ccsSet).sort(),
    periodos: periodosList,
    mapaMeses
  };

  console.log("Metadados gerados:");
  console.log("- Empresas:", metadata.empresas);
  console.log("- Total de Fornecedores:", metadata.fornecedores.length);
  console.log("- Total de Contas Correntes:", metadata.contasCorrentes.length);
  console.log("- Total de Períodos:", metadata.periodos.length);

  // Inserir novo snapshot no Supabase
  const { data: inserted, error: insError } = await supabase
    .from('dre_snapshots')
    .insert({
      filename: 'Consolidado Oficial Omie + Manual (com Fornecedores e Contas)',
      metadata: metadata,
      raw_data: rawData,
      created_at: new Date().toISOString()
    })
    .select();

  if (insError) {
    console.error("Erro ao salvar snapshot:", insError);
  } else {
    console.log("✅ Snapshot inserido com sucesso no Supabase! ID:", inserted[0]?.id);
  }
}

consolidateAndUploadSnapshot();
