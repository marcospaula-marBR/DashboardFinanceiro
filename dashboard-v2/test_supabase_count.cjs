const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Ler o arquivo .env
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
      env[key] = val;
    }
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function run() {
  console.log("Conectando ao Supabase...");
  
  // 1. Contar omie_raw por empresa
  const { data: rawCounts, error: err1 } = await supabase
    .from('omie_raw')
    .select('empresa_nome', { count: 'exact', head: false });

  // 1.b Contar omie_cp_titulos
  const { count: cpTitulosCount, error: errCP } = await supabase
    .from('omie_cp_titulos')
    .select('*', { count: 'exact', head: true });

  // 1.b.2 Contar omie_financas_unificado
  const { count: unificadoCount, error: errUnif } = await supabase
    .from('omie_financas_unificado')
    .select('*', { count: 'exact', head: true });

  // 1.c Contar omie_sync_raw
  const { count: syncRawCount, error: errSync } = await supabase
    .from('omie_sync_raw')
    .select('*', { count: 'exact', head: true });

  if (err1) {
    console.error("Erro ao contar omie_raw:", err1);
    return;
  }

  const counts = {};
  (rawCounts || []).forEach(r => {
    const key = `${r.empresa_nome || 'Sem Nome'}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  console.log("Registros na tabela omie_raw por Empresa:");
  console.log(JSON.stringify(counts, null, 2));
  console.log(`Total omie_cp_titulos: ${cpTitulosCount}`);
  console.log(`Total omie_financas_unificado: ${unificadoCount}`);
  console.log(`Total omie_sync_raw: ${syncRawCount}`);

  // 2. Contar fornecedores cadastrados
  const { count: fornCount, error: err2 } = await supabase
    .from('omie_dim_fornecedores')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal de fornecedores/clientes cadastrados na dimensão: ${fornCount}`);
}

run().catch(console.error);
