const fs = require('fs');
const path = require('path');

const URL = 'https://ngtjhwswbbivqajtpjvg.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28';

const TABLES = [
  'employees',
  'employee_loans',
  'employees_test',
  'employee_loans_test'
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
