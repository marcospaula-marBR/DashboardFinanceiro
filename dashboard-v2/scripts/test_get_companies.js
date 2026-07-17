const { createClient } = require('d:/Dashboard/node_modules/@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar .env
const envPath = 'd:/Dashboard/dashboard-v2/.env';
let supabaseUrl = '';
let supabaseServiceKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*(.*)/);
  const keyMatch = envContent.match(/SUPABASE_SERVICE_KEY\s*=\s*(.*)/);
  if (urlMatch && urlMatch[1]) supabaseUrl = urlMatch[1].trim().replace(/['"]/g, '');
  if (keyMatch && keyMatch[1]) supabaseServiceKey = keyMatch[1].trim().replace(/['"]/g, '');
}

async function main() {
  console.log('Supabase URL:', supabaseUrl);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Buscar empresas distintas dos colaboradores atuais
  const { data, error } = await supabase
    .from('employees')
    .select('company');

  if (error) {
    console.error('Erro ao buscar colaboradores:', error);
    return;
  }

  const companies = [...new Set(data.map(item => item.company))];
  console.log('\n--- EMPRESAS CADASTRADAS ---');
  console.log(companies);
  console.log('----------------------------');
}

main();
