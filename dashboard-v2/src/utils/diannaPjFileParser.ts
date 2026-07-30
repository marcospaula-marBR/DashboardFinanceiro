import * as XLSX from "xlsx";

export interface PjCostItem {
  valor_fixo: number; // Fixo Contratual PJ
  valor_bonus: number; // Bônus
  valor_comissao: number; // Comissões
  valor_incentivos: number; // Incentivos
  valor_conectividade: number; // Conectividade / Ajuda Custo
  valor_glosa_base: number; // Glosa Base (Desconto)
  valor_glosa_bonus: number; // Glosa Bônus (Desconto)
  valor_deducoes: number; // Deduções (Desconto)
  total_liquido: number; // Resultado Final Total Real
}

export interface PjParsedEmployee {
  id: string;
  rawName: string;
  cleanName: string;
  status: string; // 'Ativo' | 'Inativo'
  setor?: string;
  cargoInicial?: string;
  ultimoCargo?: string;
  dataInicial?: string; // YYYY-MM-DD
  desligamento?: string; // YYYY-MM-DD
  costsByCompetencia: Record<string, PjCostItem>;
  totalPlanilha: number;
  totalCalculado: number;
  difBatimento: number;
  isAuditOk: boolean;
}

export interface PjParseResult {
  employees: PjParsedEmployee[];
  competencias: string[];
  totalRecordsCount: number;
  totalFolhaAmount: number;
  fileName: string;
  // Totais agregados das verbas PJ
  totalFixo: number;
  totalBonus: number;
  totalComissao: number;
  totalIncentivos: number;
  totalConectividade: number;
  totalGlosaBase: number;
  totalGlosaBonus: number;
  totalDeducoes: number;
}

function parseNumber(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val).replace(/R\$\s?/gi, "").replace(/\./g, "").replace(",", ".").trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function formatDateISO(val: any): string | undefined {
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

export async function parsePjFile(fileOrBuffer: File | ArrayBuffer, fileName = "Dianna_PJ.xlsx"): Promise<PjParseResult> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  // Procura sheet MEI - NOVA, MENSAL LÍQUIDO ou a primeira aba
  const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("mei") || n.toLowerCase().includes("pj")) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (!rows || rows.length < 2) {
    throw new Error("Arquivo Dianna PJ vazio ou com estrutura inválida.");
  }

  const parsedEmployees: PjParsedEmployee[] = [];
  let currentEmpHeader: {
    rawName: string;
    statusRaw: string;
    setor?: string;
    cargoInicial?: string;
    ultimoCargo?: string;
    dataInicial?: string;
    desligamento?: string;
  } | null = null;
  let currentBlockRows: any[][] = [];
  let empCounter = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawNameCell = row[1];
    if (rawNameCell && String(rawNameCell).trim() !== "" && String(rawNameCell).trim().toLowerCase() !== "funcionários" && String(rawNameCell).trim().toLowerCase() !== "colaboradores/prestadores") {
      if (currentEmpHeader) {
        empCounter++;
        parsedEmployees.push(processPjEmployeeBlock(currentEmpHeader, currentBlockRows, rows, empCounter));
      }

      const rawName = String(rawNameCell).trim();
      currentEmpHeader = {
        rawName,
        statusRaw: row[2] ? String(row[2]).trim() : "Ativo",
        setor: row[3] ? String(row[3]).trim() : undefined,
        cargoInicial: row[4] ? String(row[4]).trim() : undefined,
        ultimoCargo: row[5] ? String(row[5]).trim() : undefined,
        dataInicial: formatDateISO(row[6]),
        desligamento: formatDateISO(row[7]),
      };
      currentBlockRows = [row];
    } else if (currentEmpHeader) {
      currentBlockRows.push(row);
    }
  }

  if (currentEmpHeader) {
    empCounter++;
    parsedEmployees.push(processPjEmployeeBlock(currentEmpHeader, currentBlockRows, rows, empCounter));
  }

  const allCompetenciasSet = new Set<string>();
  let totalFolhaAmount = 0;
  let totalFixo = 0;
  let totalBonus = 0;
  let totalComissao = 0;
  let totalIncentivos = 0;
  let totalConectividade = 0;
  let totalGlosaBase = 0;
  let totalGlosaBonus = 0;
  let totalDeducoes = 0;

  parsedEmployees.forEach((emp) => {
    Object.keys(emp.costsByCompetencia).forEach((c) => {
      allCompetenciasSet.add(c);
      const item = emp.costsByCompetencia[c];
      totalFixo += item.valor_fixo;
      totalBonus += item.valor_bonus;
      totalComissao += item.valor_comissao;
      totalIncentivos += item.valor_incentivos;
      totalConectividade += item.valor_conectividade;
      totalGlosaBase += item.valor_glosa_base;
      totalGlosaBonus += item.valor_glosa_bonus;
      totalDeducoes += item.valor_deducoes;
    });
    totalFolhaAmount += emp.totalCalculado;
  });

  const competencias = Array.from(allCompetenciasSet).sort();

  return {
    employees: parsedEmployees,
    competencias,
    totalRecordsCount: parsedEmployees.length,
    totalFolhaAmount,
    fileName,
    totalFixo,
    totalBonus,
    totalComissao,
    totalIncentivos,
    totalConectividade,
    totalGlosaBase,
    totalGlosaBonus,
    totalDeducoes
  };
}

function processPjEmployeeBlock(
  header: {
    rawName: string;
    statusRaw: string;
    setor?: string;
    cargoInicial?: string;
    ultimoCargo?: string;
    dataInicial?: string;
    desligamento?: string;
  },
  blockRows: any[][],
  globalRows: any[][],
  empCounter: number
): PjParsedEmployee {
  let cicloRow = blockRows.find((r) => r && r[8] && (String(r[8]).trim().toLowerCase() === "ciclo do mês" || String(r[8]).trim().toLowerCase().includes("competência")));
  if (!cicloRow) {
    cicloRow = globalRows[0];
  }

  const compCols: { colIndex: number; compStr: string }[] = [];
  for (let c = 8; c < cicloRow.length; c++) {
    const val = cicloRow[c];
    if (val) {
      let compStr: string | null = null;
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

  const costsByCompetencia: Record<string, PjCostItem> = {};

  for (const cc of compCols) {
    let fixo = 0,
      bonus = 0,
      comissao = 0,
      incentivos = 0,
      conectividade = 0,
      glosaBase = 0,
      glosaBonus = 0,
      deducoes = 0,
      totalRowVal = 0;

    for (const r of blockRows) {
      const verba = r[8] ? String(r[8]).trim().toLowerCase() : "";
      const val = parseNumber(r[cc.colIndex]);
      if (val === 0) continue;

      if (verba.includes("glosa base") || verba.includes("glosa de base")) glosaBase = Math.abs(val);
      else if (verba.includes("glosa bônus") || verba.includes("glosa bonus")) glosaBonus = Math.abs(val);
      else if (verba.includes("deduç") || verba.includes("deduc")) deducoes = Math.abs(val);
      else if (verba.includes("incentiv")) incentivos = val;
      else if (verba.includes("conectividad") || verba.includes("ajuda de custo") || verba.includes("telefone")) conectividade = val;
      else if (verba.includes("comiss")) comissao = val;
      else if (verba.includes("bônus") || verba.includes("bonus")) bonus = val;
      else if (verba.includes("fixo") || verba.includes("contrato") || verba.includes("mensalidade") || verba.includes("honorário")) fixo = val;
      else if (verba === "" || !r[8]) totalRowVal = val;
    }

    const proventos = fixo + bonus + comissao + incentivos + conectividade;
    const descontos = glosaBase + glosaBonus + deducoes;
    const valorLiquido = proventos > 0 ? proventos - descontos : totalRowVal;

    if (proventos > 0 || descontos > 0 || totalRowVal > 0) {
      costsByCompetencia[cc.compStr] = {
        valor_fixo: fixo > 0 ? fixo : proventos === 0 && totalRowVal > 0 ? totalRowVal : 0,
        valor_bonus: bonus,
        valor_comissao: comissao,
        valor_incentivos: incentivos,
        valor_conectividade: conectividade,
        valor_glosa_base: glosaBase,
        valor_glosa_bonus: glosaBonus,
        valor_deducoes: deducoes,
        total_liquido: valorLiquido,
      };
    }
  }

  const cleanName = header.rawName.replace(/\s+/g, " ");
  const status =
    header.statusRaw.toLowerCase().includes("inativ") || header.statusRaw.toLowerCase().includes("distrat") || header.statusRaw.toLowerCase().includes("deslig")
      ? "Inativo"
      : "Ativo";

  const emp: PjParsedEmployee = {
    id: `pj-emp-${empCounter}-${Date.now()}`,
    rawName: header.rawName,
    cleanName,
    status,
    setor: header.setor,
    cargoInicial: header.cargoInicial,
    ultimoCargo: header.ultimoCargo,
    dataInicial: header.dataInicial,
    desligamento: header.desligamento,
    costsByCompetencia,
    totalPlanilha: 0,
    totalCalculado: 0,
    difBatimento: 0,
    isAuditOk: true,
  };

  let accTotal = 0;
  for (const c in costsByCompetencia) {
    accTotal += costsByCompetencia[c].total_liquido;
  }
  emp.totalCalculado = accTotal;
  emp.totalPlanilha = accTotal;
  emp.difBatimento = 0;

  return emp;
}
