/**
 * Script: Adiciona as colunas valor_faltas, valor_consignado e banco_horas na tabela people_monthly_costs
 */

const https = require('https');

const SUPABASE_URL = 'ngtjhwswbbivqajtpjvg.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28';

const alterTableSQL = `
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS valor_faltas NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS valor_consignado NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS banco_horas NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS valor_fgts NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS base_fgts NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS base_inss NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS base_irrf NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS inss_empregado NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS irrf_empregado NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS salario_familia NUMERIC DEFAULT 0;
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
  console.log('Sending ALTER TABLE request to Supabase to add payroll columns...');
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
      console.log('SUCCESS: Payroll columns (valor_faltas, valor_consignado, banco_horas) added successfully!');
    } else {
      console.log('FAILED to add columns. Check error response above.');
    }
  } catch (err) {
    console.error('Error executing query:', err.message);
  }
}

main();
