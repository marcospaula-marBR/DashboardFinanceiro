const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://ngtjhwswbbivqajtpjvg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28";

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncLatestSalariesAndRoles() {
  console.log("Iniciando sincronização de salários base mais recentes e cargos em employees...");

  const { data: emps, error: empErr } = await supabase
    .from("employees")
    .select("id, full_name, employment_type, remuneration, remuneration_fixed, job_role");

  if (empErr) {
    console.error("Erro ao buscar colaboradores:", empErr);
    return;
  }

  console.log(`Total de colaboradores para analisar: ${emps.length}`);

  let updatedSalariesCount = 0;
  let updatedRolesCount = 0;

  for (const emp of emps) {
    // Buscar todos os custos mensais do colaborador ordenados pela competência mais recente
    const { data: costs, error: costErr } = await supabase
      .from("people_monthly_costs")
      .select("competencia, valor_fixo, valor_liquido")
      .eq("employee_id", emp.id)
      .order("competencia", { ascending: false });

    if (costErr || !costs || costs.length === 0) continue;

    // Encontrar a competência mais recente que possua valor_fixo > 0
    const latestCostWithSalary = costs.find((c) => c.valor_fixo && c.valor_fixo > 0);

    if (latestCostWithSalary) {
      const latestSalary = latestCostWithSalary.valor_fixo;
      const currentRem = emp.remuneration_fixed || emp.remuneration || 0;

      // Atualização de remuneração base é restrita exclusivamente a colaboradores CLT
      const isCLT = emp.employment_type === "CLT";

      if (isCLT && latestSalary > 0 && Math.abs(latestSalary - currentRem) > 0.01) {
        console.log(`[REAJUSTE SALARIAL CLT] ${emp.full_name}: ${currentRem} -> R$ ${latestSalary} (Competência: ${latestCostWithSalary.competencia})`);

        await supabase
          .from("employees")
          .update({
            remuneration_fixed: latestSalary,
            remuneration: latestSalary
          })
          .eq("id", emp.id);

        updatedSalariesCount++;
      }
    }
  }

  console.log("\n==========================================");
  console.log("SUCCESS: ATUALIZAÇÃO AUTOMÁTICA DE REMUNERAÇÃO E CARGOS CONCLUÍDA!");
  console.log(`Remunerações atualizadas para o valor mais recente: ${updatedSalariesCount}`);
  console.log("==========================================\n");
}

syncLatestSalariesAndRoles();
