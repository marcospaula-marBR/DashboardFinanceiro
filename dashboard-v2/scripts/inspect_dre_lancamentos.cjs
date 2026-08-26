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

async function inspect() {
  const { data, count, error } = await supabase.from('dre_lancamentos').select('*', { count: 'exact' }).limit(5);
  console.log("Total em dre_lancamentos:", count, error);
  if (data && data.length > 0) {
    console.log("Colunas em dre_lancamentos:", Object.keys(data[0]));
    console.log("Amostra 1:", data[0]);
  }
}
inspect();
