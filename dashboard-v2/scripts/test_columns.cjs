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

async function testCols() {
  // Testar inserção ou select com fornecedor e conta_corrente
  const { data, error } = await supabase
    .from('dre_lancamentos')
    .select('id, empresa, departamento, conta_dre, fornecedor, conta_corrente')
    .limit(3);

  if (error) {
    console.log("Erro ao selecionar colunas fornecedor/conta_corrente:", error.message);
  } else {
    console.log("Colunas existem! Dados de amostra:", data);
  }
}
testCols();
