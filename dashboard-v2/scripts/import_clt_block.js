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

  // Buscar colaboradores existentes no banco
  const { data: existingEmps } = await supabase.from("employees").select("id, full_name, employment_type, status, start_date, resignation_date, department, job_role");
  console.log("Colaboradores existentes no banco:", existingEmps ? existingEmps.length : 0);

  const parsedEmployees = [];
  let currentEmp = null;
  let currentBlockRows = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    const rawName = r[1];
    if (rawName && String(rawName).trim() !== "" && String(rawName).trim().toLowerCase() !== "funcionários") {
      if (currentEmp) {
        parsedEmployees.push(processBlock(currentEmp, currentBlockRows, rows));
      }
      currentEmp = {
        rawName: String(rawName).trim(),
        cleanName: String(rawName).trim().replace(/\s+/g, " "),
        status: String(r[2] || "Ativo").toLowerCase().includes("inativ") || String(r[2] || "").toLowerCase().includes("deslig") ? "Inativo" : "Ativo",
        setor: r[3] ? String(r[3]).trim() : undefined,
        cargoInicial: r[4] ? String(r[4]).trim() : undefined,
        ultimoCargo: r[5] ? String(r[5]).trim() : undefined,
        dataInicial: formatDateISO(r[6]),
        desligamento: formatDateISO(r[7])
      };
      currentBlockRows = [r];
    } else if (currentEmp) {
      currentBlockRows.push(r);
    }
  }

  if (currentEmp) {
    parsedEmployees.push(processBlock(currentEmp, currentBlockRows, rows));
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
        remuneration: pEmp.latestSalary || 0,
        remuneration_fixed: pEmp.latestSalary || 0,
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
        valor_liquido: c.valor_liquido,
        origem: "dianna_batch_clt",
        observacao: "Carga direta automatizada da planilha CLT (.xlsx)"
      };

      const { data: existingCost } = await supabase.from("people_monthly_costs").select("id").eq("employee_id", targetId).eq("competencia", comp).maybeSingle();

      if (existingCost?.id) {
        await supabase.from("people_monthly_costs").update(costPayload).eq("id", existingCost.id);
      } else {
        await supabase.from("people_monthly_costs").insert([costPayload]);
      }
      insertedCostCount++;
    }
  }

  console.log("\n==========================================");
  console.log("SUCCESS: CARGA DIRETA DA PLANILHA CLT CONCLUÍDA!");
  console.log("Novos colaboradores criados:", createdEmpCount);
  console.log("Colaboradores vinculados e atualizados:", updatedEmpCount);
  console.log("Lançamentos mensais de custo salvos no Supabase:", insertedCostCount);
  console.log("==========================================\n");
}

function processBlock(emp, blockRows, globalRows) {
  let cicloRow = blockRows.find(r => r && r[8] && String(r[8]).trim().toLowerCase() === "ciclo do mês");
  if (!cicloRow) {
    cicloRow = globalRows[0];
  }

  const compCols = [];
  for (let c = 9; c < cicloRow.length; c++) {
    const val = cicloRow[c];
    if (val) {
      let compStr = null;
      if (val instanceof Date) {
        const y = val.getUTCFullYear();
        const m = String(val.getUTCMonth() + 1).padStart(2, "0");
        compStr = `${y}-${m}-01`;
      } else {
        const str = String(val).trim();
        const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymd) compStr = `${ymd[1]}-${String(ymd[2]).padStart(2, "0")}-01`;
      }
      if (compStr) {
        compCols.push({ colIndex: c, compStr });
      }
    }
  }

  emp.costsByCompetencia = {};
  let latestSalary = 0;

  for (const cc of compCols) {
    let fixo = 0, adiantamento = 0, horaExtra = 0, adnot = 0, vr = 0, vt = 0, ajuda = 0, cesta = 0, bonus = 0, ferias = 0, rescisao = 0, decimo3 = 0, descontos = 0, outros = 0, totalRowVal = 0;

    for (const r of blockRows) {
      const verba = r[8] ? String(r[8]).trim().toLowerCase() : "";
      const val = parseNumber(r[cc.colIndex]);
      if (val === 0) continue;

      if (verba.includes("holerite") && !verba.includes("sem holerite")) fixo = val;
      else if (verba.includes("adiantamento")) adiantamento = val;
      else if (verba.includes("hora extra")) horaExtra = val;
      else if (verba.includes("adicional noturno")) adnot = val;
      else if (verba === "vr" || verba.includes("refeição")) vr = val;
      else if (verba === "vt" || verba.includes("transporte")) vt = val;
      else if (verba.includes("ajuda de custo")) ajuda = val;
      else if (verba.includes("cesta")) cesta = val;
      else if (verba.includes("bonifica") || verba.includes("comiss")) bonus += val;
      else if (verba.includes("férias") || verba.includes("ferias")) ferias = val;
      else if (verba.includes("rescisão") || verba.includes("rescisao")) rescisao = val;
      else if (verba.includes("13º") || verba.includes("13")) decimo3 = val;
      else if (verba.includes("desconto")) descontos = val;
      else if (verba.includes("sem holerite") || verba.includes("pagamento sem")) outros = val;
      else if (verba === "" || !r[8]) totalRowVal = val;
    }

    const proventos = fixo + adiantamento + horaExtra + adnot + vr + vt + ajuda + cesta + bonus + ferias + rescisao + decimo3 + outros;
    const valorLiquido = proventos > 0 ? (proventos - descontos) : totalRowVal;

    if (proventos > 0 || descontos > 0 || totalRowVal > 0) {
      if (fixo > 0) latestSalary = fixo;

      emp.costsByCompetencia[cc.compStr] = {
        valor_fixo: fixo > 0 ? fixo : (proventos === 0 && totalRowVal > 0 ? totalRowVal : 0),
        valor_adiantamento: adiantamento,
        valor_hora_extra: horaExtra,
        valor_adicional_not: adnot,
        valor_vr: vr,
        valor_vt: vt,
        valor_ajuda_custo: ajuda,
        valor_cesta: cesta,
        valor_bonus: bonus,
        valor_ferias: ferias,
        valor_rescisao: rescisao,
        valor_decimo_terceiro: decimo3,
        valor_descontos: descontos,
        outros_ajustes: outros,
        valor_liquido: valorLiquido
      };
    }
  }

  emp.latestSalary = latestSalary;
  return emp;
}

runImport();
