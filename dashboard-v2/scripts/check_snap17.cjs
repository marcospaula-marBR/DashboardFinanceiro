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

async function checkSnap17() {
  const { data: snap17 } = await supabase.from('dre_snapshots').select('*').eq('id', 17).single();
  console.log("Snapshot 17 Metadata:", snap17.metadata);
  console.log("Total de linhas em snap17:", snap17.raw_data.length);
  
  // Pegar amostra de linhas que têm Jun/26 ou Jul/26 > 0
  const withJunJul = snap17.raw_data.filter(r => (r['Jun/26'] && r['Jun/26'] !== 0) || (r['Jul/26'] && r['Jul/26'] !== 0));
  console.log(`Linhas com Jun/26 ou Jul/26 em Snap 17: ${withJunJul.length}`);
  console.log("Amostra 3 itens:", withJunJul.slice(0, 3));
}
checkSnap17();
