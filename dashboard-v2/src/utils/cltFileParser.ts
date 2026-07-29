import * as XLSX from "xlsx";

export interface CltCostItem {
  valor_fixo: number; // Holerite (Salário Base)
  valor_adiantamento: number;
  valor_hora_extra: number;
  valor_adicional_not: number;
  valor_vr: number;
  valor_vt: number;
  valor_ajuda_custo: number;
  valor_cesta: number;
  valor_bonus: number; // Bonificação + Comissões
  valor_ferias: number;
  valor_rescisao: number;
  valor_decimo_terceiro: number;
  valor_descontos: number;
  outros_ajustes: number; // Pagamento sem holerite
  total_liquido: number;
}

export interface CltParsedEmployee {
  id: string;
  rawName: string;
  cleanName: string;
  status: string; // 'Ativo' | 'Inativo'
  setor?: string;
  cargoInicial?: string;
  ultimoCargo?: string;
  dataInicial?: string; // YYYY-MM-DD
  desligamento?: string; // YYYY-MM-DD
  costsByCompetencia: Record<string, CltCostItem>;
  totalPlanilha: number;
  totalCalculado: number;
  difBatimento: number;
  isAuditOk: boolean;
}

export interface CltParseResult {
  employees: CltParsedEmployee[];
  competencias: string[];
  totalRecordsCount: number;
  totalFolhaAmount: number;
  fileName: string;
}

/**
 * Normaliza o valor da célula em formato numérico
 */
function parseNumber(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val).replace(/R\$\s?/gi, "").replace(/\./g, "").replace(",", ".").trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Normaliza data para YYYY-MM-DD
 */
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

/**
 * Função principal de parsing de arquivo CLT (.xlsx ou .csv)
 */
export async function parseCltFile(fileOrBuffer: File | ArrayBuffer, fileName = "CLT.xlsx"): Promise<CltParseResult> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (!rows || rows.length < 2) {
    throw new Error("Arquivo vazio ou com estrutura inválida.");
  }

  const parsedEmployees: CltParsedEmployee[] = [];
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
    if (rawNameCell && String(rawNameCell).trim() !== "" && String(rawNameCell).trim().toLowerCase() !== "funcionários") {
      if (currentEmpHeader) {
        empCounter++;
        parsedEmployees.push(processEmployeeBlock(currentEmpHeader, currentBlockRows, rows, empCounter));
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
    parsedEmployees.push(processEmployeeBlock(currentEmpHeader, currentBlockRows, rows, empCounter));
  }

  const allCompetenciasSet = new Set<string>();
  let totalFolhaAmount = 0;

  parsedEmployees.forEach((emp) => {
    Object.keys(emp.costsByCompetencia).forEach((c) => allCompetenciasSet.add(c));
    totalFolhaAmount += emp.totalCalculado;
  });

  const competencias = Array.from(allCompetenciasSet).sort();

  return {
    employees: parsedEmployees,
    competencias,
    totalRecordsCount: parsedEmployees.length,
    totalFolhaAmount,
    fileName,
  };
}

function processEmployeeBlock(
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
): CltParsedEmployee {
  // Procura a linha 'Ciclo do mês' que contém as datas das colunas neste bloco
  let cicloRow = blockRows.find((r) => r && r[8] && String(r[8]).trim().toLowerCase() === "ciclo do mês");
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

  const costsByCompetencia: Record<string, CltCostItem> = {};

  for (const cc of compCols) {
    let fixo = 0,
      adiantamento = 0,
      horaExtra = 0,
      adnot = 0,
      vr = 0,
      vt = 0,
      ajuda = 0,
      cesta = 0,
      bonus = 0,
      ferias = 0,
      rescisao = 0,
      decimo3 = 0,
      descontos = 0,
      outros = 0,
      totalRowVal = 0;

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

    const proventos =
      fixo + adiantamento + horaExtra + adnot + vr + vt + ajuda + cesta + bonus + ferias + rescisao + decimo3 + outros;
    const valorLiquido = proventos > 0 ? proventos - descontos : totalRowVal;

    if (proventos > 0 || descontos > 0 || totalRowVal > 0) {
      costsByCompetencia[cc.compStr] = {
        valor_fixo: fixo > 0 ? fixo : proventos === 0 && totalRowVal > 0 ? totalRowVal : 0,
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
        total_liquido: valorLiquido,
      };
    }
  }

  const cleanName = header.rawName.replace(/\s+/g, " ");
  const status =
    header.statusRaw.toLowerCase().includes("inativ") || header.statusRaw.toLowerCase().includes("deslig")
      ? "Inativo"
      : "Ativo";

  const emp: CltParsedEmployee = {
    id: `clt-emp-${empCounter}-${Date.now()}`,
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
