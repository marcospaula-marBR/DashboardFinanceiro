const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngtjhwswbbivqajtpjvg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJuly() {
  try {
    const { data: payments, error } = await supabase
      .from('loan_payments')
      .select('*, employee_loans(employee_id, amount, start_cycle)')
      .gte('due_date', '2026-07-01')
      .lte('due_date', '2026-07-31');
      
    if (error) {
      console.error(error);
      return;
    }
    
    // Get employee names
    const { data: emps } = await supabase.from('employees').select('id, full_name');
    const empMap = new Map(emps.map(e => [e.id, e.full_name]));
    
    console.log(`=== Payments in July 2026 (${payments.length}) ===`);
    let totalPago = 0;
    let totalPendente = 0;
    
    payments.forEach(p => {
      const loan = p.employee_loans;
      const empName = loan ? empMap.get(loan.employee_id) : 'Desconhecido';
      console.log(`Emp: ${empName} | Amt: ${p.amount} | Due: ${p.due_date} | Status: ${p.status} | LoanID: ${p.contract_id}`);
      if (p.status === 'PAGO') {
        totalPago += parseFloat(p.amount) || 0;
      } else {
        totalPendente += parseFloat(p.amount) || 0;
      }
    });
    
    console.log(`\nTotal PAGO em Julho 2026: R$ ${totalPago}`);
    console.log(`Total PENDENTE em Julho 2026: R$ ${totalPendente}`);
    console.log(`Total Geral: R$ ${totalPago + totalPendente}`);
    
  } catch (err) {
    console.error(err);
  }
}

checkJuly();
