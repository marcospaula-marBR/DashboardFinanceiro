/**
 * Script: Adiciona as colunas observacoes e pdf_url na tabela insurance_policies via Supabase Query API
 */

const https = require('https');

const SUPABASE_URL = 'ngtjhwswbbivqajtpjvg.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28';

const alterTableSQL = `
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS observacoes TEXT DEFAULT '';
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS pdf_url TEXT DEFAULT '';
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
  console.log('Sending ALTER TABLE request to Supabase for observacoes and pdf_url...');
  try {
    const body = JSON.stringify({ query: alterTableSQL });
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
    
    console.log('Status Code:', result.status);
    console.log('Response Body:', result.body);
    
    if (result.status === 200 || result.status === 201) {
      console.log('SUCCESS: Columns observacoes and pdf_url added successfully!');
    } else {
      console.log('FAILED to add columns via /pg/query.');
    }
  } catch (err) {
    console.error('Error executing query:', err.message);
  }
}

main();
