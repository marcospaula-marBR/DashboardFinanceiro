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
  console.log("Consultando omie_financas_unificado para Mar Brasil...");
  
  const { data, error, count } = await supabase
    .from('omie_financas_unificado')
    .select('status, data_vencimento, data_pagamento, valor_alocado, tipo_registro', { count: 'exact' })
    .eq('empresa_nome', 'Mar Brasil')
    .gte('data_vencimento', '2026-06-22')
    .lte('data_vencimento', '2026-06-28')
    .order('data_vencimento', { ascending: false });

  if (error) {
    console.error("Erro:", error);
    return;
  }

  console.log(`Total de registros para Mar Brasil: ${count}`);

  let minVenc = '9999-99-99';
  let maxVenc = '0000-00-00';
  let minPagto = '9999-99-99';
  let maxPagto = '0000-00-00';

  data.forEach(r => {
    if (r.data_vencimento) {
      if (r.data_vencimento < minVenc) minVenc = r.data_vencimento;
      if (r.data_vencimento > maxVenc) maxVenc = r.data_vencimento;
    }
    if (r.data_pagamento) {
      if (r.data_pagamento < minPagto) minPagto = r.data_pagamento;
      if (r.data_pagamento > maxPagto) maxPagto = r.data_pagamento;
    }
  });

  console.log(`Faixa Vencimento: ${minVenc} a ${maxVenc}`);
  console.log(`Faixa Pagamento: ${minPagto} a ${maxPagto}`);
}

run().catch(console.error);
