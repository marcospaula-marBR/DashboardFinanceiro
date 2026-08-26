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

async function check() {
  const { data: lancs, error: lError } = await supabase.from('dre_lancamentos').select('*').limit(5);
  console.log('--- dre_lancamentos (5 items) ---');
  console.log(lError ? lError : lancs);

  const { count: lancsCount } = await supabase.from('dre_lancamentos').select('*', { count: 'exact', head: true });
  console.log('Total em dre_lancamentos:', lancsCount);

  const { data: snaps, error: sError } = await supabase.from('dre_snapshots').select('*').order('created_at', { ascending: false }).limit(1);
  if (snaps && snaps[0]) {
    console.log('--- dre_snapshots latest ---');
    console.log('metadata:', snaps[0].metadata);
    console.log('raw_data sample item 0:', snaps[0].raw_data?.[0]);
  }
}
check();
