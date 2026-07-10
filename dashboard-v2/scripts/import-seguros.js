/**
 * Script: Importação de dados-seguros.csv → Supabase (tabela insurance_policies)
 * Executar: node scripts/import-seguros.js
 * @version v.02.48.97
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ngtjhwswbbivqajtpjvg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ───
function parseCurrency(val) {
  if (!val) return 0;
  let s = String(val).replace('R$', '').trim();
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  return parseFloat(s) || 0;
}

function parseDate(val) {
  if (!val) return null;
  const v = String(val).trim();
  // DD/MM/YYYY
  const parts = v.split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2];
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }
  // YYYY-MM-DD (já no formato correto)
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

function parseCSV(content) {
  // Remove BOM se houver
  const bom = '\uFEFF';
  if (content.startsWith(bom)) content = content.slice(1);

  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detecta separador (vírgula ou ponto-e-vírgula)
  const sep = lines[0].includes(';') ? ';' : ',';
  
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length < 2) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function findKey(row, candidates) {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const found = keys.find(k => k.toLowerCase().trim().includes(cand.toLowerCase()));
    if (found && row[found]) return row[found];
  }
  return '';
}

function mapRowToPolicy(row) {
  const parcelasRaw = row['Parcelas'] || row['parcelas'] || findKey(row, ['parcela', 'qtd parcela']);
  const parcelas = parseInt(String(parcelasRaw).replace(/\D/g, '')) || 1;

  const obj = {
    contratante:       row['Contratante'] || findKey(row, ['empresa', 'cliente']) || 'Mar Brasil',
    tipo:              row['Tipo'] || findKey(row, ['categoria', 'ramo']) || 'Outros',
    segurado:          row['Segurado'] || findKey(row, ['beneficiário', 'bem', 'nome']),
    seguradora:        row['Seguradora'] || findKey(row, ['companhia']),
    apolice:           row['Apólice'] || row['Apolice'] || findKey(row, ['proposta', 'numero']),
    senha:             row['Senha'] || findKey(row, ['acesso', 'portal senha']),
    assistencia_24h:   row['Assistência 24h'] || row['Assistencia 24h'] || findKey(row, ['assistencia', '24h']),
    inicio:            parseDate(row['Início'] || row['Inicio'] || findKey(row, ['início', 'inicio', 'data início'])) || null,
    vencimento:        parseDate(row['Vencimento'] || findKey(row, ['vencimento', 'data fim', 'fim'])) || null,
    premio:            parseCurrency(row['Prêmio'] || row['Premio'] || findKey(row, ['premio', 'valor total', 'valor prêmio'])),
    parcelas_total:    parcelas,
    valor_parcela:     parseCurrency(row['Valor das Parcelas'] || row['VR Parcelas'] || findKey(row, ['vr parcelas', 'valor parcela', 'valor mensal'])),
    dia_pgto:          row['Dia Pgto'] || findKey(row, ['dia pgto', 'dia vencimento']),
    formato_parcelas:  row['Formato das Parcelas'] || findKey(row, ['formato', 'forma pagamento']),
    corretor:          row['Corretor'] || findKey(row, ['vendedor', 'angariador']),
    telefone_corretor: row['Telefone'] || findKey(row, ['celular corretor', 'tel corretor']),
    email_corretor:    row['email'] || row['Email'] || findKey(row, ['e-mail', 'email corretor']),
    indicador:         row['Indicador'] || findKey(row, ['indicação', 'indicado']),
    ativo:             true,
  };
  return obj;
}

async function main() {
  const csvPath = path.join(__dirname, '..', 'public', 'dados-seguros.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ Arquivo não encontrado:', csvPath);
    process.exit(1);
  }

  console.log('📂 Lendo CSV:', csvPath);
  
  // Tenta com UTF-8 primeiro, depois latin1
  let content;
  try {
    content = fs.readFileSync(csvPath, 'utf-8');
  } catch {
    content = fs.readFileSync(csvPath, 'latin1');
  }

  const rows = parseCSV(content);
  console.log(`📋 ${rows.length} linhas encontradas no CSV`);

  if (rows.length === 0) {
    console.log('⚠ Nenhum dado para importar.');
    return;
  }

  // Mapeia para o formato do banco
  const policies = rows
    .map(mapRowToPolicy)
    .filter(p => p.contratante && p.tipo);

  console.log(`✅ ${policies.length} apólices válidas para importar`);
  
  // Preview
  policies.forEach((p, i) => {
    console.log(`  [${i+1}] ${p.contratante} | ${p.tipo} | ${p.seguradora || '—'} | Venc: ${p.vencimento || '—'}`);
  });

  // Confirma antes de inserir
  console.log('\n🚀 Inserindo no Supabase...');

  const { data, error } = await supabase
    .from('insurance_policies')
    .insert(policies)
    .select();

  if (error) {
    console.error('❌ Erro ao inserir:', error.message);
    process.exit(1);
  }

  console.log(`✅ ${data.length} apólices importadas com sucesso!`);
  console.log('\n📊 IDs gerados:');
  data.forEach((p, i) => {
    console.log(`  [${i+1}] ${p.id} — ${p.tipo} (${p.contratante})`);
  });
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
