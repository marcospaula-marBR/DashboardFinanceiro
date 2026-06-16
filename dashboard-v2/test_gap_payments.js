const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngtjhwswbbivqajtpjvg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // GAP ID
    const gapId = '09f4635a-5ed6-4d0a-b9b1-f2637e34be1a';

    // 1. Fetch employee details
    const { data: emp } = await supabase.from('employees').select('id, full_name').eq('id', gapId).single();
    console.log('=== Employee ===', emp);

    // 2. Fetch active loans (prod)
    const { data: prodLoans } = await supabase.from('employee_loans').select('*').eq('employee_id', gapId);
    console.log('\n=== Prod Loans ===');
    for (let ln of (prodLoans || [])) {
      console.log(`Loan ID=${ln.id} | Amount=${ln.amount} | Date=${ln.request_date} | start_cycle=${ln.start_cycle}`);
      const { data: pay } = await supabase.from('loan_payments').select('*').eq('contract_id', ln.id);
      console.log(`  Payments (${pay?.length || 0}):`);
      pay?.forEach(p => {
        console.log(`    Pay ID=${p.id} | amount=${p.amount} | due_date=${p.due_date} | status=${p.status}`);
      });
    }

    // 3. Fetch active loans (test)
    const { data: testLoans } = await supabase.from('employee_loans_test').select('*').eq('employee_id', gapId);
    console.log('\n=== Test Loans ===');
    for (let ln of (testLoans || [])) {
      console.log(`Loan ID=${ln.id} | Amount=${ln.amount} | Date=${ln.request_date} | start_cycle=${ln.start_cycle}`);
      const { data: pay } = await supabase.from('loan_payments_test').select('*').eq('contract_id', ln.id);
      console.log(`  Payments (${pay?.length || 0}):`);
      pay?.forEach(p => {
        console.log(`    Pay ID=${p.id} | amount=${p.amount} | due_date=${p.due_date} | status=${p.status}`);
      });
    }
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

testConnection();
