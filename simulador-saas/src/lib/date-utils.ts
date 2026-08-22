const MONTH_MAP_PT: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
};

const MONTH_REVERSE_MAP_PT: Record<string, string> = {
  'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
  'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
};

export function isoToLabel(isoPeriod: string): string {
  // isoPeriod: 'YYYY-MM' -> 'Jan/26'
  const [year, month] = isoPeriod.split('-');
  if (!year || !month) return isoPeriod;
  const monthName = MONTH_MAP_PT[month] || month;
  const shortYear = year.slice(2);
  return `${monthName}/${shortYear}`;
}

export function labelToIso(label: string): string {
  // label: 'Jan/26' -> '2026-01'
  const parts = label.split('/');
  if (parts.length !== 2) return label;
  const mStr = parts[0].trim().toLowerCase();
  const yStr = parts[1].trim();
  const fullYear = yStr.length === 2 ? `20${yStr}` : yStr;
  const monthNum = MONTH_REVERSE_MAP_PT[mStr] || '01';
  return `${fullYear}-${monthNum}`;
}

export function addMonthsIso(isoPeriod: string, count: number): string {
  const [year, month] = isoPeriod.split('-').map(Number);
  if (!year || !month) return isoPeriod;
  const d = new Date(year, month - 1 + count, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatCurrencyBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(val);
}

export function formatPct(val: number, showPlus = true): string {
  const prefix = showPlus && val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}%`;
}
