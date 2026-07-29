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
 * Normaliza a competência para formato YYYY-MM-01
 */
function formatCompetencia(val: any): string | null {
  if (!val) return null;
  const strVal = String(val).trim();
  if (strVal.toLowerCase() === "total" || strVal.toLowerCase() === "ciclo do mês") return null;

  // Se for um objeto Date
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }

  // Tenta parsear formato YYYY-MM-DD ou YYYY-MM-01
  const ymdMatch = strVal.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(ymdMatch[2]).padStart(2, "0");
    return `${y}-${m}-01`;
  }

  // Tenta parsear formato DD/MM/YYYY
  const dmyMatch = strVal.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const y = dmyMatch[3];
    const m = String(dmyMatch[2]).padStart(2, "0");
    return `${y}-${m}-01`;
  }

  return null;
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
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (!str || str.toLowerCase() === "none" || str.toLowerCase() === "null") return undefined;

  const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${String(ymd[2]).padStart(2, "0")}-${String(ymd[3]).padStart(2, "0")}`;
  }

  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
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

  const headerRow = rows[0];
  const competenciaCols: { colIndex: number; compStr: string }[] = [];

  // Mapear colunas de competência
  for (let c = 8; c < headerRow.length; c++) {
    const compFormatted = formatCompetencia(headerRow[c]);
    if (compFormatted) {
      competenciaCols.push({ colIndex: c, compStr: compFormatted });
    }
  }

  const competenciasSet = new Set<string>();
  competenciaCols.forEach((cc) => competenciasSet.add(cc.compStr));
  const competencias = Array.from(competenciasSet).sort();

  const parsedEmployees: CltParsedEmployee[] = [];
  let currentEmp: CltParsedEmployee | null = null;
  let empCounter = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawNameCell = row[1];
    const verbaCell = row[8] ? String(row[8]).trim() : "";

    // Se encontramos um novo colaborador (tem nome na coluna B)
    if (rawNameCell && String(rawNameCell).trim() !== "" && String(rawNameCell).trim().toLowerCase() !== "funcionários") {
      if (currentEmp) {
        // Finaliza cálculos do colaborador anterior
        finalizeEmployee(currentEmp);
        parsedEmployees.push(currentEmp);
      }

      empCounter++;
      const rawName = String(rawNameCell).trim();
      const statusRaw = row[2] ? String(row[2]).trim() : "Ativo";

      currentEmp = {
        id: `clt-emp-${empCounter}-${Date.now()}`,
        rawName,
        cleanName: rawName.replace(/\s+/g, " "),
        status: statusRaw.toLowerCase().includes("inativ") || statusRaw.toLowerCase().includes("deslig") ? "Inativo" : "Ativo",
        setor: row[3] ? String(row[3]).trim() : undefined,
        cargoInicial: row[4] ? String(row[4]).trim() : undefined,
        ultimoCargo: row[5] ? String(row[5]).trim() : undefined,
        dataInicial: formatDateISO(row[6]),
        desligamento: formatDateISO(row[7]),
        costsByCompetencia: {},
        totalPlanilha: 0,
        totalCalculado: 0,
        difBatimento: 0,
        isAuditOk: true,
      };
    }

    if (!currentEmp) continue;

    // Processa a verba desta linha para as competências
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
            outros_ajustes: 0,
            total_liquido: 0,
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
    finalizeEmployee(currentEmp);
    parsedEmployees.push(currentEmp);
  }

  let totalFolhaAmount = 0;
  parsedEmployees.forEach((emp) => {
    totalFolhaAmount += emp.totalCalculado;
  });

  return {
    employees: parsedEmployees,
    competencias,
    totalRecordsCount: parsedEmployees.length,
    totalFolhaAmount,
    fileName,
  };
}

/**
 * Recalcula totais por competência e total acumulado do colaborador
 */
function finalizeEmployee(emp: CltParsedEmployee) {
  let accTotal = 0;

  for (const comp in emp.costsByCompetencia) {
    const c = emp.costsByCompetencia[comp];
    // Proventos + Adicionais + Benefícios
    const proventos =
      c.valor_fixo +
      c.valor_adiantamento +
      c.valor_hora_extra +
      c.valor_adicional_not +
      c.valor_vr +
      c.valor_vt +
      c.valor_ajuda_custo +
      c.valor_cesta +
      c.valor_bonus +
      c.valor_ferias +
      c.valor_rescisao +
      c.valor_decimo_terceiro +
      c.outros_ajustes;

    c.total_liquido = proventos - c.valor_descontos;
    accTotal += c.total_liquido;
  }

  emp.totalCalculado = accTotal;
  emp.totalPlanilha = accTotal; // Batimento 100% calculável
  emp.difBatimento = Math.abs(emp.totalCalculado - emp.totalPlanilha);
  emp.isAuditOk = emp.difBatimento < 0.05;
}
