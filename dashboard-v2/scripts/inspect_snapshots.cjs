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

async function inspectSnapshots() {
  const { data, error } = await supabase
    .from('dre_snapshots')
    .select('id, filename, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log("Últimos 10 snapshots em dre_snapshots:");
  data.forEach(s => {
    console.log(`ID: ${s.id} | Data: ${s.created_at} | Arquivo: ${s.filename}`);
    console.log(`  Periodos:`, s.metadata?.periodos);
  });

  // Pegar snapshot id anterior (ex: antes do 18/19)
  const { data: snap17 } = await supabase.from('dre_snapshots').select('*').eq('id', 17).single();
  if (snap17) {
    console.log("--- Snapshot 17 Sample ---");
    console.log("Periodos:", snap17.metadata?.periodos);
    console.log("RawData count:", snap17.raw_data?.length);
    console.log("Item 0:", snap17.raw_data?.[0]);
  }
}
inspectSnapshots();
