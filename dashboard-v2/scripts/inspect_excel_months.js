const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "../public/CLT.xlsx");
const workbook = XLSX.readFile(filePath, { cellDates: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

let currentEmp = null;
let currentBlockRows = [];
const monthEmpCount = {};

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;

  const rawName = r[1];
  if (rawName && String(rawName).trim() !== "" && String(rawName).trim().toLowerCase() !== "funcionários") {
    if (currentEmp) {
      countEmpCosts(currentEmp, currentBlockRows, rows);
    }
    currentEmp = { name: String(rawName).trim() };
    currentBlockRows = [r];
  } else if (currentEmp) {
    currentBlockRows.push(r);
  }
}

if (currentEmp) countEmpCosts(currentEmp, currentBlockRows, rows);

function countEmpCosts(emp, blockRows, globalRows) {
  let cicloRow = blockRows.find(r => r && r[8] && String(r[8]).trim().toLowerCase() === "ciclo do mês") || globalRows[0];

  for (let c = 9; c < cicloRow.length; c++) {
    const val = cicloRow[c];
    if (!val) continue;
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
    if (!compStr) continue;

    let hasValue = false;
    for (const r of blockRows) {
      const cellVal = r[c];
      if (cellVal !== null && cellVal !== undefined && cellVal !== 0 && String(cellVal).trim() !== "R$ -" && String(cellVal).trim() !== "") {
        hasValue = true;
        break;
      }
    }

    if (hasValue) {
      monthEmpCount[compStr] = (monthEmpCount[compStr] || 0) + 1;
    }
  }
}

console.log("Quantidade de colaboradores com valores por competência no Excel:");
const sortedKeys = Object.keys(monthEmpCount).sort();
for (const k of sortedKeys) {
  console.log(`${k}: ${monthEmpCount[k]} colaboradores`);
}
