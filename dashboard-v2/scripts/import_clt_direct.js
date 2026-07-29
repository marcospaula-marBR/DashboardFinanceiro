const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

const supabaseUrl = "https://ngtjhwswbbivqajtpjvg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28";

const supabase = createClient(supabaseUrl, supabaseKey);

function parseNumber(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val).replace(/R\$\s?/gi, "").replace(/\./g, "").replace(",", ".").trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function formatCompetencia(val) {
  if (!val) return null;
  const strVal = String(val).trim();
  if (strVal.toLowerCase() === "total" || strVal.toLowerCase() === "ciclo do mês") return null;

  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }

  const ymdMatch = strVal.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${String(ymdMatch[2]).padStart(2, "0")}-01`;
  }

  const dmyMatch = strVal.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${String(dmyMatch[2]).padStart(2, "0")}-01`;
  }

  return null;
}

function formatDateISO(val) {
  if (!val) return undefined;
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    if (y <= 1900 || d === "00" || m === "00") return undefined;
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (!str || str.toLowerCase() === "none" || str.toLowerCase() === "null" || str.includes("1900-01-00")) return undefined;

  const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10);
    const d = parseInt(ymd[3], 10);
    if (y <= 1900 || m === 0 || d === 0) return undefined;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const d = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10);
    const y = parseInt(dmy[3], 10);
    if (y <= 1900 || m === 0 || d === 0) return undefined;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return undefined;
}

async function runImport() {
  console.log("Iniciando leitura de public/CLT.xlsx...");
  const filePath = path.join(__dirname, "../public/CLT.xlsx");
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  console.log("Total de linhas no Excel:", rows.length);
  const headerRow = rows[0];
  const competenciaCols = [];

  for (let c = 8; c < headerRow.length; c++) {
    const compFormatted = formatCompetencia(headerRow[c]);
    if (compFormatted) {
      competenciaCols.push({ colIndex: c, compStr: compFormatted });
    }
  }

  console.log("Total competências mapeadas:", competenciaCols.length);

  // Buscar colaboradores existentes no banco
  const { data: existingEmps } = await supabase.from("employees").select("id, full_name, employment_type, status, start_date, resignation_date, department, job_role");
  console.log("Colaboradores existentes no banco:", existingEmps ? existingEmps.length : 0);

  const parsedEmployees = [];
  let currentEmp = null;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawNameCell = row[1];
    const verbaCell = row[8] ? String(row[8]).trim() : "";

    if (rawNameCell && String(rawNameCell).trim() !== "" && String(rawNameCell).trim().toLowerCase() !== "funcionários") {
      if (currentEmp) {
        parsedEmployees.push(currentEmp);
      }

      const rawName = String(rawNameCell).trim();
      const statusRaw = row[2] ? String(row[2]).trim() : "Ativo";

      currentEmp = {
        rawName,
        cleanName: rawName.replace(/\s+/g, " "),
        status: statusRaw.toLowerCase().includes("inativ") || statusRaw.toLowerCase().includes("deslig") ? "Inativo" : "Ativo",
        setor: row[3] ? String(row[3]).trim() : undefined,
        cargoInicial: row[4] ? String(row[4]).trim() : undefined,
        ultimoCargo: row[5] ? String(row[5]).trim() : undefined,
        dataInicial: formatDateISO(row[6]),
        desligamento: formatDateISO(row[7]),
        costsByCompetencia: {}
      };
    }

    if (!currentEmp) continue;

    if (verbaCell) {
      const verbaNorm = verbaCell.toLowerCase();

      for (const cc of competenciaCols) {
        const comp = cc.compStr;
        const val = parseNumber(row[cc.colIndex]);

        if (!currentEmp.costsByCompetencia[comp]) {
          currentEmp.costsByCompetencia[comp] = {
            valor_fixo: 0,
            valor_adiantamento: 0,
            valor_hora_extra: 0,
            valor_adicional_not: 0,
            valor_vr: 0,
            valor_vt: 0,
            valor_ajuda_custo: 0,
            valor_cesta: 0,
            valor_bonus: 0,
            valor_ferias: 0,
            valor_rescisao: 0,
            valor_decimo_terceiro: 0,
            valor_descontos: 0,
            outros_ajustes: 0
          };
        }

        const cost = currentEmp.costsByCompetencia[comp];

        if (verbaNorm.includes("holerite") && !verbaNorm.includes("sem holerite")) {
          cost.valor_fixo = val;
        } else if (verbaNorm.includes("adiantamento")) {
          cost.valor_adiantamento = val;
        } else if (verbaNorm.includes("hora extra")) {
          cost.valor_hora_extra = val;
        } else if (verbaNorm.includes("adicional noturno")) {
          cost.valor_adicional_not = val;
        } else if (verbaNorm === "vr" || verbaNorm.includes("refeição")) {
          cost.valor_vr = val;
        } else if (verbaNorm === "vt" || verbaNorm.includes("transporte")) {
          cost.valor_vt = val;
        } else if (verbaNorm.includes("ajuda de custo")) {
          cost.valor_ajuda_custo = val;
        } else if (verbaNorm.includes("cesta")) {
          cost.valor_cesta = val;
        } else if (verbaNorm.includes("bonifica") || verbaNorm.includes("comiss")) {
          cost.valor_bonus += val;
        } else if (verbaNorm.includes("férias") || verbaNorm.includes("ferias")) {
          cost.valor_ferias = val;
        } else if (verbaNorm.includes("rescisão") || verbaNorm.includes("rescisao")) {
          cost.valor_rescisao = val;
        } else if (verbaNorm.includes("13º") || verbaNorm.includes("13")) {
          cost.valor_decimo_terceiro = val;
        } else if (verbaNorm.includes("desconto")) {
          cost.valor_descontos = val;
        } else if (verbaNorm.includes("sem holerite") || verbaNorm.includes("pagamento sem")) {
          cost.outros_ajustes = val;
        }
      }
    }
  }

  if (currentEmp) {
    parsedEmployees.push(currentEmp);
  }

  console.log("Total colaboradores parseados:", parsedEmployees.length);

  let updatedEmpCount = 0;
  let createdEmpCount = 0;
  let insertedCostCount = 0;

  for (const pEmp of parsedEmployees) {
    const cleanTarget = pEmp.cleanName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    let existing = (existingEmps || []).find(e => {
      const eClean = (e.full_name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return eClean === cleanTarget || eClean.includes(cleanTarget) || cleanTarget.includes(eClean);
    });

    let targetId = existing ? existing.id : null;

    if (!targetId) {
      const { data: newEmp, error: createErr } = await supabase.from("employees").insert([{
        full_name: pEmp.cleanName,
        company: "MarBR",
        employment_type: "CLT",
        status: pEmp.status,
        department: pEmp.setor || "Geral",
        job_role: pEmp.ultimoCargo || pEmp.cargoInicial || "Colaborador",
        start_date: pEmp.dataInicial || undefined,
        resignation_date: pEmp.desligamento || undefined,
        remuneration: pEmp.costsByCompetencia[Object.keys(pEmp.costsByCompetencia).pop()]?.valor_fixo || 0,
        remuneration_fixed: pEmp.costsByCompetencia[Object.keys(pEmp.costsByCompetencia).pop()]?.valor_fixo || 0,
        active: pEmp.status !== "Inativo",
        created_at: new Date().toISOString()
      }]).select().single();

      if (createErr) {
        console.error("Erro ao criar colaborador", pEmp.cleanName, createErr);
        continue;
      }
      targetId = newEmp.id;
      createdEmpCount++;
    } else {
      updatedEmpCount++;
      if (existing.employment_type === "CLT" && pEmp.status === "Inativo" && existing.status !== "Inativo") {
        await supabase.from("employees").update({ status: "Inativo", resignation_date: pEmp.desligamento }).eq("id", targetId);
      }
    }

    // Salvar custos mensais
    for (const comp in pEmp.costsByCompetencia) {
      const c = pEmp.costsByCompetencia[comp];
      const proventos = c.valor_fixo + c.valor_adiantamento + c.valor_hora_extra + c.valor_adicional_not + c.valor_vr + c.valor_vt + c.valor_ajuda_custo + c.valor_cesta + c.valor_bonus + c.valor_ferias + c.valor_rescisao + c.valor_decimo_terceiro + c.outros_ajustes;
      const valorLiquido = proventos - c.valor_descontos;

      if (proventos > 0 || c.valor_descontos > 0) {
        const { data: existingCost } = await supabase.from("people_monthly_costs").select("id").eq("employee_id", targetId).eq("competencia", comp).maybeSingle();

        const costPayload = {
          employee_id: targetId,
          competencia: comp,
          vinculo_tipo: "CLT",
          valor_fixo: c.valor_fixo,
          valor_adiantamento: c.valor_adiantamento,
          valor_hora_extra: c.valor_hora_extra,
          valor_adicional_not: c.valor_adicional_not,
          valor_vr: c.valor_vr,
          valor_vt: c.valor_vt,
          valor_ajuda_custo: c.valor_ajuda_custo,
          valor_cesta: c.valor_cesta,
          valor_bonus: c.valor_bonus,
          valor_ferias: c.valor_ferias,
          valor_rescisao: c.valor_rescisao,
          valor_decimo_terceiro: c.valor_decimo_terceiro,
          valor_descontos: c.valor_descontos,
          outros_ajustes: c.outros_ajustes,
          valor_liquido: valorLiquido,
          origem: "dianna_batch_clt",
          observacao: "Carga direta automatizada da planilha CLT (.xlsx)"
        };

        if (existingCost?.id) {
          await supabase.from("people_monthly_costs").update(costPayload).eq("id", existingCost.id);
        } else {
          await supabase.from("people_monthly_costs").insert([costPayload]);
        }
        insertedCostCount++;
      }
    }
  }

  console.log("\n==========================================");
  console.log("SUCCESS: CARGA DIRETA CONCLUÍDA COM ÉXITO!");
  console.log("Novos colaboradores criados:", createdEmpCount);
  console.log("Colaboradores vinculados e atualizados:", updatedEmpCount);
  console.log("Lançamentos mensais de custo salvos no Supabase:", insertedCostCount);
  console.log("==========================================\n");
}

runImport();
