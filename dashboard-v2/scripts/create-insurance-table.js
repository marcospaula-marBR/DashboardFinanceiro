/**
 * Script: Criação da tabela insurance_policies via Supabase Management API
 */

const https = require('https');

const SUPABASE_URL = 'ngtjhwswbbivqajtpjvg.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28';

const createTableSQL = `
CREATE TABLE IF NOT EXISTS insurance_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contratante TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT '',
  segurado TEXT DEFAULT '',
  seguradora TEXT DEFAULT '',
  apolice TEXT DEFAULT '',
  senha TEXT DEFAULT '',
  assistencia_24h TEXT DEFAULT '',
  inicio DATE,
  vencimento DATE,
  premio NUMERIC(12,2) DEFAULT 0,
  parcelas_total INTEGER DEFAULT 1,
  valor_parcela NUMERIC(12,2) DEFAULT 0,
  dia_pgto TEXT DEFAULT '',
  formato_parcelas TEXT DEFAULT '',
  corretor TEXT DEFAULT '',
  telefone_corretor TEXT DEFAULT '',
  email_corretor TEXT DEFAULT '',
  indicador TEXT DEFAULT '',
  ativo BOOLEAN DEFAULT TRUE,
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insurance_policies' AND policyname = 'Allow all for service role') THEN
    CREATE POLICY "Allow all for service role" ON insurance_policies FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;
`;

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

async function main() {
  console.log('Trying to create table via Supabase pg query endpoint...');
  
  try {
    const body = JSON.stringify({ query: createTableSQL });
    const result = await makeRequest({
      hostname: SUPABASE_URL,
      path: '/pg/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY
      }
    }, body);
    
    console.log('Status:', result.status);
    console.log('Body:', result.body.substring(0, 300));
    
    if (result.status === 200 || result.status === 201) {
      console.log('SUCCESS: Table created!');
    } else {
      console.log('Try the SQL manually in Supabase Studio:');
      console.log('URL: https://supabase.com/dashboard/project/ngtjhwswbbivqajtpjvg/sql/new');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
