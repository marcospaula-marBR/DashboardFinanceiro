const fs = require('fs');
const path = require('path');

const dotenv = require('dotenv');

// Load environment variables from the root or local .env file
const envPath = fs.existsSync(path.join(__dirname, '.env')) 
  ? path.join(__dirname, '.env') 
  : path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

const URL = process.env.SUPABASE_URL || 'https://ngtjhwswbbivqajtpjvg.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;

const TABLES = [
  'employees',
  'employee_loans',
  'loan_payments',
  'people_monthly_costs',
  'employment_contracts',
  'employee_history',
  'employees_test',
  'employee_loans_test',
  'loan_payments_test'
];

async function runBackup() {
  const backupDir = path.join(__dirname, 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log(`[Backup] Iniciando backup em ${backupDir}...`);

  for (const table of TABLES) {
    try {
      const response = await fetch(`${URL}/rest/v1/${table}?select=*`, {
        headers: {
          'apikey': KEY,
          'Authorization': `Bearer ${KEY}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const filename = path.join(backupDir, `${table}_backup_${timestamp}.json`);
      fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[Backup] Tabela '${table}' salva com sucesso (${data.length} registros) -> ${path.basename(filename)}`);
    } catch (error) {
      console.error(`[Backup] Erro ao fazer backup de '${table}':`, error.message);
    }
  }
}

runBackup();
