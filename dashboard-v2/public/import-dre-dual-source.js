/**
 * Importação de Dados DRE de Duas Fontes e Upload para Supabase
 * 
 * - Fonte 1: base_manual_dre.csv (Master/Histórico)
 * - Fonte 2: dados_tratado_jun25_em_diante.csv (Omie export)
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  decodeCsvBufferSmart,
  normalizeEmpresa,
  normalizeDepartamento,
  normalizeProjeto,
  normalizeContaDre,
  normalizeCategoria
} = require('../scripts/seed_clean_snapshot.cjs');

// Supabase REST endpoint e chave (Lido do .env na raiz do projeto)
const ENV_PATH = path.join(process.cwd(), '../../.env');
let SUPABASE_URL = '';
let SUPABASE_KEY = '';

try {
    const envFile = fs.readFileSync(ENV_PATH, 'utf-8');
    envFile.split('\n').forEach(line => {
        if (line.startsWith('SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim();
        if (line.startsWith('SUPABASE_SERVICE_KEY=')) SUPABASE_KEY = line.split('=')[1].trim();
    });
} catch (e) {
    console.warn("⚠️ Não foi possível carregar o arquivo .env da raiz do projeto.");
}

// Configuração
const FILE_MAI25 = 'base_manual_dre.csv';
const FILE_JUN25 = 'dados_tratado_jun25_em_diante.csv';

// Função para ler CSV com detecção automática de encoding (UTF-8 vs Windows-1252)
function readCSVFile(filename) {
    if (!fs.existsSync(filename)) {
        throw new Error(`Arquivo não encontrado: ${filename}`);
    }
    const buffer = fs.readFileSync(filename);
    return decodeCsvBufferSmart(buffer);
}

// Função para parse CSV
function parseCSV(content, delimiter = ';') {
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(delimiter).map(h => h.trim());

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map(v => v.trim());
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        data.push(row);
    }
    return { headers, data };
}

// Para padronizar nomes de meses no metadata
const MESES_ORDEM = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function normalizeMes(mes) {
    return mes.trim().charAt(0).toUpperCase() + mes.trim().slice(1).toLowerCase();
}

function mergeDataSources() {
    console.log('📊 Lendo arquivos DRE...\n');

    const content1 = readCSVFile(FILE_MAI25);
    const { headers: headers1, data: data1 } = parseCSV(content1);
    console.log(`✅ ${FILE_MAI25}: ${data1.length} registros`);

    const content2 = readCSVFile(FILE_JUN25);
    const { headers: headers2, data: data2 } = parseCSV(content2);
    console.log(`✅ ${FILE_JUN25}: ${data2.length} registros\n`);

    const dataMap = new Map(); // key: empresa|departamento|contaDRE|projeto|categoria

    const getNormalizedDimensions = (row) => {
        const emp = normalizeEmpresa(row['Empresa'] || 'Geral');
        const conta = normalizeContaDre(row['ContaDRE'] || row['Conta do DRE'] || 'Sem Conta DRE') || 'Sem Conta DRE';
        const dep = normalizeDepartamento(row['Departamento'] || 'Sem Departamento') || 'Sem Departamento';
        const proj = normalizeProjeto(row['Projeto'] || 'Sem Projeto') || 'Sem Projeto';
        const cat = normalizeCategoria(row['Categoria'] || '', conta) || conta;
        return { Empresa: emp, Departamento: dep, ContaDRE: conta, Projeto: proj, Categoria: cat };
    };

    const getKey = (dims) =>
        `${dims.Empresa}|${dims.Departamento}|${dims.ContaDRE}|${dims.Projeto}|${dims.Categoria}`;

    // Carregar Base Manual (Arquivo 1)
    data1.forEach(row => {
        const dims = getNormalizedDimensions(row);
        const key = getKey(dims);
        if (!dataMap.has(key)) {
            dataMap.set(key, { ...dims });
        }
        const item = dataMap.get(key);
        // Puxar todas as colunas de meses (que contém '/')
        headers1.filter(h => h.includes('/')).forEach(mesHeader => {
            const valor = parseFloat(row[mesHeader]?.replace(/\./g, '').replace(',', '.')) || 0;
            if (valor !== 0) item[mesHeader] = valor;
        });
    });

    // Aplicar Upsert do Omie (Arquivo 2)
    data2.forEach(row => {
        const dims = getNormalizedDimensions(row);
        const key = getKey(dims);
        if (!dataMap.has(key)) {
            dataMap.set(key, { ...dims });
        }
        const item = dataMap.get(key);
        // Sobrescrever com valores do Omie para as competências que vieram
        headers2.filter(h => h.includes('/')).forEach(mesHeader => {
            const valor = parseFloat(row[mesHeader]?.replace(/\./g, '').replace(',', '.')) || 0;
            if (valor !== 0) {
                item[mesHeader] = valor; // Omie PREVALECE
            }
        });
    });

    const finalData = Array.from(dataMap.values());
    console.log(`✅ Total de linhas consolidadas: ${finalData.length}\n`);

    return finalData;
}

function extractMetadata(data) {
    const empresas = Array.from(new Set(data.map(d => d.Empresa))).sort();
    const departamentos = Array.from(new Set(data.map(d => d.Departamento))).sort();
    const contasDre = Array.from(new Set(data.map(d => d.ContaDRE))).sort();
    const projetos = Array.from(new Set(data.map(d => d.Projeto))).sort();
    const categorias = Array.from(new Set(data.map(d => d.Categoria))).sort();

    const allKeysSet = new Set();
    data.forEach(row => {
        Object.keys(row).forEach(key => {
            if (key.includes('/')) allKeysSet.add(key);
        });
    });
    
    const validCols = Array.from(allKeysSet);
    const periodos = [];
    const mapaMeses = {};

    validCols.forEach(col => {
        const partes = col.split('/');
        if (partes.length === 2) {
            const mesNormalizado = normalizeMes(partes[0].trim());
            mapaMeses[col] = mesNormalizado;
            periodos.push({ col, mes: mesNormalizado, ano: partes[1].trim() });
        }
    });

    periodos.sort((a, b) => {
        const yA = parseInt(a.ano) < 100 ? 2000 + parseInt(a.ano) : parseInt(a.ano);
        const yB = parseInt(b.ano) < 100 ? 2000 + parseInt(b.ano) : parseInt(b.ano);
        if (yA !== yB) return yA - yB;
        return MESES_ORDEM.indexOf(a.mes) - MESES_ORDEM.indexOf(b.mes);
    });

    return {
        empresas,
        departamentos,
        contasDre,
        projetos,
        categorias,
        periodos: periodos.map(p => `${p.mes}/${p.ano}`),
        mapaMeses
    };
}

async function uploadToSupabase(rawData, metadata) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error("Credenciais do Supabase não configuradas no .env");
    }

    console.log('🚀 Enviando snapshot consolidado para o Supabase...');
    
    const payload = {
        filename: "Consolidado Híbrido Automático",
        raw_data: rawData,
        metadata: metadata
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/dre_snapshots`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Falha no Supabase [${res.status}]: ${errText}`);
    }
}

async function run() {
    try {
        const rawData = mergeDataSources();
        const metadata = extractMetadata(rawData);
        
        await uploadToSupabase(rawData, metadata);
        
        console.log('\n=========================================');
        console.log('✨ INTEGRAÇÃO HÍBRIDA CONCLUÍDA COM SUCESSO!');
        console.log('   O Dashboard já está atualizado na nuvem.');
        console.log('=========================================\n');
    } catch (error) {
        console.error('\n❌ ERRO DURANTE A INTEGRAÇÃO:');
        console.error(`   ${error.message}`);
        process.exit(1);
    }
}

run();
