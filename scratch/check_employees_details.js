const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function inferEntityType(employee) {
  if (employee.metadata?.entityType) return employee.metadata.entityType;
  if (employee.entityType) return employee.entityType;

  const isOutsourced = employee.is_outsourced === true;
  const hasCorporateName = typeof employee.corporate_name === 'string' && employee.corporate_name.trim().length > 0;
  const hasPjType = typeof employee.pj_type === 'string' && employee.pj_type.trim().length > 0;
  const hasTaxRegime = typeof employee.tax_regime === 'string' && employee.tax_regime.trim().length > 0;
  const linkType = employee.employment_type || '';

  const isPJ = linkType === 'PJ' || linkType === 'MEI' || hasCorporateName || hasPjType || hasTaxRegime || isOutsourced;

  return isPJ ? "legal_entity" : "internal_person";
}

async function run() {
  const { data: emps, error } = await supabase
    .from('employees')
    .select('id, full_name, employment_type, is_outsourced, corporate_name, pj_type, tax_regime, metadata, status');

  if (error) {
    console.error('Error fetching employees:', error);
    return;
  }

  console.log(`Total employees in database: ${emps.length}`);
  console.log('\n--- Eligible employees ---');
  let eligibleCount = 0;
  emps.forEach(emp => {
    const type = inferEntityType(emp);
    const isEligible = type === 'internal_person';
    if (isEligible) {
      eligibleCount++;
      console.log(`✅ ${emp.full_name} | Type: ${emp.employment_type} | Status: ${emp.status}`);
    }
  });

  console.log(`\nTotal eligible: ${eligibleCount}`);

  console.log('\n--- Non-eligible employees ---');
  emps.forEach(emp => {
    const type = inferEntityType(emp);
    const isEligible = type === 'internal_person';
    if (!isEligible) {
      console.log(`❌ ${emp.full_name} | Type: ${emp.employment_type} | Status: ${emp.status} | Corporate Name: ${emp.corporate_name} | PJ Type: ${emp.pj_type} | Outsourced: ${emp.is_outsourced}`);
    }
  });
}

run();
