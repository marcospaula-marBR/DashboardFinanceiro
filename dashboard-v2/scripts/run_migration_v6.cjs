const https = require('https');
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

const sql = `
ALTER TABLE public.dre_lancamentos 
  ADD COLUMN IF NOT EXISTS fornecedor text NOT NULL DEFAULT 'Sem Fornecedor',
  ADD COLUMN IF NOT EXISTS conta_corrente text NOT NULL DEFAULT 'Sem Conta Corrente';

ALTER TABLE public.dre_lancamentos 
  DROP CONSTRAINT IF EXISTS dre_lancamentos_empresa_departamento_conta_dre_projeto_ca_key,
  DROP CONSTRAINT IF EXISTS dre_lancamentos_dim_unique;

ALTER TABLE public.dre_lancamentos 
  ADD CONSTRAINT dre_lancamentos_dim_unique 
  UNIQUE (empresa, departamento, conta_dre, projeto, categoria, fornecedor, conta_corrente, periodo, fonte);

CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_fornecedor ON public.dre_lancamentos(fornecedor);
CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_conta_corrente ON public.dre_lancamentos(conta_corrente);
`;

const hostname = env.NEXT_PUBLIC_SUPABASE_URL ? env.NEXT_PUBLIC_SUPABASE_URL.replace(/^https?:\/\//, '') : (env.SUPABASE_URL ? env.SUPABASE_URL.replace(/^https?:\/\//, '') : '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log('Executando migration em:', hostname);
  try {
    const body = JSON.stringify({ query: sql });
    const result = await makeRequest({
      hostname: hostname,
      path: '/pg/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': 'Bearer ' + serviceKey
      }
    }, body);
    
    console.log('Status Code:', result.status);
    console.log('Response Body:', result.body);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
run();
