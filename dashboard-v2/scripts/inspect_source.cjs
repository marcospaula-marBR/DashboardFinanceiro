const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function inspectSource() {
  console.log("=== INSPEÇÃO LEITURA-APENAS ===");
  
  // 1. Verificar colunas de dre_lancamentos
  const { data: lanc, error: errLanc } = await supabase.from('dre_lancamentos').select('*').limit(3);
  console.log("Colunas em dre_lancamentos:", lanc && lanc[0] ? Object.keys(lanc[0]) : errLanc);
  
  // 2. Verificar snapshots existentes
  const { data: snaps, error: errSnaps } = await supabase.from('dre_snapshots').select('id, filename, created_at, metadata').order('id', { ascending: false }).limit(5);
  console.log("Últimos snapshots:", snaps.map(s => ({ id: s.id, filename: s.filename, created_at: s.created_at, periodos: s.metadata?.periodos })));
  
  // 3. Inspecionar snapshot 17
  const { data: snap17 } = await supabase.from('dre_snapshots').select('raw_data, metadata').eq('id', 17).single();
  if (snap17 && snap17.raw_data && snap17.raw_data[0]) {
    console.log("Campos em snap17.raw_data[0]:", Object.keys(snap17.raw_data[0]));
    console.log("Amostra snap17.raw_data[0]:", snap17.raw_data[0]);
  }
}
inspectSource();
