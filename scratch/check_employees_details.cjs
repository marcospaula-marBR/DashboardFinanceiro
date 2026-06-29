const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const [loansRes, empsRes] = await Promise.all([
    supabase.from('employee_loans').select('id, employee_id, amount'),
    supabase.from('employees').select('id, full_name, employment_type, is_outsourced, corporate_name, pj_type, tax_regime, status')
  ]);

  if (loansRes.error || empsRes.error) {
    console.error('Error fetching data:', loansRes.error || empsRes.error);
    return;
  }

  const empsMap = new Map(empsRes.data.map(e => [e.id, e]));

  console.log(`Total loans in database: ${loansRes.data.length}`);
  console.log('\n--- Employees with loans ---');
  loansRes.data.forEach(loan => {
    const emp = empsMap.get(loan.employee_id);
    if (emp) {
      console.log(`Loan: R$ ${loan.amount} | Employee: ${emp.full_name} | Type: ${emp.employment_type} | Status: ${emp.status}`);
    } else {
      console.log(`Loan: R$ ${loan.amount} | Employee ID: ${loan.employee_id} (not found in employees)`);
    }
  });
}

run();
