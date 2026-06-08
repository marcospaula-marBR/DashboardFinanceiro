const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngtjhwswbbivqajtpjvg.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28';

const supabase = createClient(supabaseUrl, ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('employees_test').select('id, full_name, status, status_end_date').ilike('full_name', '%Carlos%');
  console.log("Carlos:", data);

  const { data: d2 } = await supabase.from('employees_test').select('id, full_name, status, status_end_date').ilike('full_name', '%Fabio%');
  console.log("Fabio:", d2);
  
  const { data: d3 } = await supabase.from('employees_test').select('id, full_name, status, status_end_date').ilike('full_name', '%F%bio%');
  console.log("Fábio (all):", d3);
}

check();
