const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const Papa = require('papaparse');

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
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const MESES_ORDEM = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fixMojibake(str) {
  if (!str) return '';
  let result = str.trim();
  try {
    if (/[\u00C2\u00C3]/.test(result)) {
      const decoded = decodeURIComponent(escape(result));
      if (decoded && !/[\u00C2\u00C3]/.test(decoded)) {
        return decoded.trim();
      }
    }
  } catch (e) {}

  const replacements = {
    'Ã£': 'ã', 'Ã¡': 'á', 'Ã ': 'à', 'Ã¢': 'â', 'Ã¤': 'ä',
    'Ã©': 'é', 'Ã¨': 'è', 'Ãª': 'ê', 'Ã«': 'ë',
    'Ã­': 'í', 'Ã¬': 'ì', 'Ã®': 'î', 'Ã¯': 'ï',
    'Ã³': 'ó', 'Ã²': 'ò', 'Ã´': 'ô', 'Ãµ': 'õ', 'Ã¶': 'ö',
    'Ãº': 'ú', 'Ã¹': 'ù', 'Ã»': 'û', 'Ã¼': 'ü',
    'Ã§': 'ç', 'Ã±': 'ñ',
    'Ãƒ': 'Ã', 'Ã': 'Á', 'Ã€': 'À', 'Ã‚': 'Â',
    'Ã‰': 'É', 'Ãˆ': 'È', 'ÃŠ': 'Ê',
    'Ã': 'Í', 'ÃŒ': 'Ì', 'ÃŽ': 'Î',
    'Ã“': 'Ó', 'Ã’': 'Ò', 'Ã”': 'Ô', 'Ã•': 'Õ',
    'Ãš': 'Ú', 'Ã™': 'Ù', 'Ã›': 'Û',
    'Ã‡': 'Ç',
    'Âº': 'º', 'Âª': 'ª', 'Â§': '§', 'Â°': '°'
  };

  for (const [bad, good] of Object.entries(replacements)) {
    result = result.split(bad).join(good);
  }
  return result.trim();
}

const normalizeEmpresa = (empresa) => {
  const clean = fixMojibake(empresa);
  const norm = clean.trim().toUpperCase();
  if (norm.includes('CONECTIUS')) return 'Conectius';
  if (norm.includes('MAR BRASIL') || norm.includes('MARBR') || norm.includes('MAR BR') || norm === 'MAR_BR') return 'MarBR';
  if (norm.includes('DZM') || norm.includes('D.Z.M') || norm.includes('D Z M')) return 'DZM';
  if (norm.includes('YBOX') || norm.includes('Y BOX')) return 'Ybox';
  if (norm.includes('G2') || norm.includes('G 2')) return 'G2';
  return clean || 'Geral';
};

const toTitleCase = (str) => fixMojibake((str || '').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()));

const DEPARTAMENTOS_MAP = {
  "Capina Eltrica / MAM / Crestani / Zasso": "Capina Elétrica / Mam / Crestani / Zasso",
  "Capina Elétrica / MAM / Crestani / Zasso": "Capina Elétrica / Mam / Crestani / Zasso",
  "DZM - Imveis Guilhermina": "DZM - Imóveis Guilhermina",
  "DZM - Terceirizao": "DZM - Terceirização",
  "So Paulo CMSP CSP 274/2024 03/2025": "São Paulo Cmsp Csp 274/2024 03/2025"
};

const PROJETOS_MAP = {
  "Bertioga Seduc 378/2024 (Inativo)": "Bertioga Seduc 378/2024 54/2024",
  "Bertioga Seduc 378/2024 54/2024 (Inativo)": "Bertioga Seduc 378/2024 54/2024",
  "Bertioga Seduc 378/2024": "Bertioga Seduc 378/2024 54/2024",
  "Bertioga Sesap 1390/2024 71/2024 (Inativo)": "Bertioga Sesap 1390/2024 71/2024",
  "Bertioga Sesap 1390/2024 71/2024": "Bertioga Sesap 1390/2024 71/2024"
};

const CATEGORIAS_MAP = {
  "Cursos e treinamentos (inativo)": "Cursos e treinamentos",
  "Honorários Jurídico": "Honorários advocatícios",
  "Manutenção de Veículos": "Manutenção de veículos",
  "Pedágio": "Pedágio e/ou Cobrança automática (TAG)",
  "Telefonia Móvel e/ou Fixa": "Telefonia móvel e/ou fixa"
};

function normalizeMes(mes) {
  return mes.trim().charAt(0).toUpperCase() + mes.trim().slice(1).toLowerCase();
}

async function consolidateAndUploadCleanSnapshot() {
  console.log("🚀 Consolidando dados com UTF-8 perfeito e fixMojibake...");

  // 1. Base Manual
  const bufManual = fs.readFileSync('public/base_manual_dre.csv');
  const contentManual = iconv.decode(bufManual, 'win1252');
  const parsedManual = Papa.parse(contentManual, { header: true, skipEmptyLines: true, delimiter: ";" });

  // 2. Omie Transacional (Lido como UTF-8 direto)
  const rawBufOmie = fs.readFileSync('public/dados_tratado_jun25_em_diante.csv');
  const contentOmie = rawBufOmie.toString('utf8');
  const parsedOmie = Papa.parse(contentOmie, { header: true, skipEmptyLines: true, delimiter: ";" });

  console.log(`Base Manual: ${parsedManual.data.length} linhas | Omie Transacional: ${parsedOmie.data.length} linhas`);

  const pivotMap = new Map();

  // Processar Base Manual
  const manualHeaders = parsedManual.meta.fields || [];
  const monthHeadersManual = manualHeaders.filter(h => h.includes('/'));

  parsedManual.data.forEach(row => {
    const rawEmp = row['Empresa'] || 'Geral';
    const emp = normalizeEmpresa(rawEmp);
    const dep = toTitleCase(fixMojibake(row['Departamento'] || row['Projeto'] || 'Sem Departamento'));
    const cDre = fixMojibake((row['ContaDRE'] || row['Categoria'] || 'Sem Conta DRE').trim().replace(/^\d+\.\s*/, ''));
    const proj = toTitleCase(fixMojibake(row['Projeto'] || 'Sem Projeto'));
    const cat = fixMojibake(row['Categoria'] || cDre);
    const forn = fixMojibake(row['Fornecedor'] || 'Sem Fornecedor');
    const cCorr = fixMojibake(row['ContaCorrente'] || row['Conta Corrente'] || 'Sem Conta Corrente');

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
    const rawDept = fixMojibake(row['Departamento'] || 'Sem Departamento');
    const dep = toTitleCase(DEPARTAMENTOS_MAP[rawDept] || rawDept);
    const cDre = fixMojibake((row['Conta do DRE'] || 'Sem Conta DRE').trim().replace(/^\d+\.\s*/, ''));
    const rawProj = fixMojibake(row['Projeto'] || 'Sem Projeto');
    const proj = toTitleCase(PROJETOS_MAP[rawProj] || rawProj);
    const rawCat = fixMojibake(row['Categoria'] || cDre);
    let cat = CATEGORIAS_MAP[rawCat] || rawCat;
    if (cat.toUpperCase() === 'N/D' || !cat) cat = cDre;

    const forn = fixMojibake(row['Cliente ou Fornecedor'] || 'Sem Fornecedor');
    const cCorr = fixMojibake(row['Conta Corrente'] || 'Sem Conta Corrente');

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

  console.log(`Total de combinações agregadas: ${pivotMap.size}`);

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
    if (item.Fornecedor && item.Fornecedor !== 'Sem Fornecedor') fornsSet.add(item.Fornecedor);
    if (item.ContaCorrente && item.ContaCorrente !== 'Sem Conta Corrente') ccsSet.add(item.ContaCorrente);

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
    empresas: Array.from(empresasSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    departamentos: Array.from(deptsSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    contasDre: Array.from(contasSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    projetos: Array.from(projsSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    categorias: Array.from(catsSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    fornecedores: Array.from(fornsSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    contasCorrentes: Array.from(ccsSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    periodos: periodosList,
    mapaMeses
  };

  console.log("Amostra de Contas Correntes Limpas:");
  console.log(metadata.contasCorrentes.slice(0, 10));

  console.log("Amostra de Departamentos Limpos:");
  console.log(metadata.departamentos.slice(0, 10));

  // Inserir novo snapshot limpo no Supabase
  const { data: inserted, error: insError } = await supabase
    .from('dre_snapshots')
    .insert({
      filename: 'Consolidado Oficial Omie + Manual (UTF-8 Limpo)',
      metadata: metadata,
      raw_data: rawData,
      created_at: new Date().toISOString()
    })
    .select();

  if (insError) {
    console.error("Erro ao salvar snapshot:", insError);
  } else {
    console.log("✅ Snapshot limpo inserido com sucesso no Supabase! ID:", inserted[0]?.id);
  }
}

consolidateAndUploadCleanSnapshot();
