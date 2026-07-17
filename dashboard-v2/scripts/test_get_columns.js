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

  // Fazer select de 1 registro para ver as chaves retornadas
  const { data, error } = await supabase
    .from('people_monthly_costs')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Erro ao buscar dados de people_monthly_costs:', error);
    return;
  }

  console.log('\n--- COLUNAS ENCONTRADAS NA TABELA (PEOPLE_MONTHLY_COSTS) ---');
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
  } else {
    console.log('Nenhum registro encontrado para listar chaves. Buscando metadados via RPC ou executando select simples.');
    
    // Tenta inserir um registro vazio ou fazer um select de teste com colunas conhecidas
    const { data: cols, error: colsError } = await supabase
      .from('people_monthly_costs')
      .select('id, competence, banco_horas') // Força o banco_horas para ver se da erro
      .limit(1);
    
    if (colsError) {
      console.error('Erro ao forçar select das novas colunas:', colsError.message);
    } else {
      console.log('Coluna banco_horas existe!');
    }
  }
  console.log('-----------------------------------------------------------');
}

main();
