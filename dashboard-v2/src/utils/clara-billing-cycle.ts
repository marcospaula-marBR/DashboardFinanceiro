/**
 * Utilitário para cálculo determinístico de ciclo de faturamento e vencimento
 * dos cartões corporativos Clara.
 * 
 * Regra padrão da empresa:
 * - Ciclo de Fatura: do dia 24 do mês anterior ao dia 23 do mês corrente
 * - Vencimento: dia 30 do mês de fechamento do ciclo (ou último dia do mês se fevereiro)
 */

export interface BillingCycleConfig {
  closingDay: number; // Dia de corte/fechamento (padrão 23)
  dueDay: number;     // Dia de vencimento (padrão 30)
}

export const DEFAULT_BILLING_CYCLE: BillingCycleConfig = {
  closingDay: 23,
  dueDay: 30,
};

export interface BillingCycleInfo {
  cycleId: string;       // Identificador único (ex: '2026-10')
  label: string;         // Rótulo completo (ex: 'Fatura Out/2026 (24/09 a 23/10)')
  shortLabel: string;    // Rótulo curto (ex: 'Out/2026')
  startDate: string;     // Início do ciclo (ex: '2026-09-24')
  closingDate: string;   // Corte do ciclo (ex: '2026-10-23')
  dueDate: string;       // Vencimento da fatura (ex: '2026-10-30')
  isCurrent: boolean;    // Se é o ciclo ativo do momento
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

/**
 * Retorna os detalhes de um ciclo de fatura específico a partir do ano e mês de fechamento/vencimento.
 * Exemplo: ano 2026, mês 10 -> Ciclo de 24/09/2026 a 23/10/2026 com vencimento em 30/10/2026.
 */
export function getBillingCycleForMonth(
  closingYear: number,
  closingMonth: number, // 1-12
  closingDay = 23,
  dueDay = 30,
  isCurrent = false
): BillingCycleInfo {
  let prevYear = closingYear;
  let prevMonth = closingMonth - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const startDay = closingDay + 1;
  const startDayStr = String(startDay).padStart(2, '0');
  const closingDayStr = String(closingDay).padStart(2, '0');
  const prevMonthStr = String(prevMonth).padStart(2, '0');
  const closingMonthStr = String(closingMonth).padStart(2, '0');

  const startDate = `${prevYear}-${prevMonthStr}-${startDayStr}`;
  const closingDate = `${closingYear}-${closingMonthStr}-${closingDayStr}`;

  // Calcula dia de vencimento com ajuste para meses curtos
  const lastDayOfMonth = new Date(closingYear, closingMonth, 0).getDate();
  const targetDueDay = Math.min(dueDay, lastDayOfMonth);
  const dueDate = `${closingYear}-${closingMonthStr}-${String(targetDueDay).padStart(2, '0')}`;

  const shortLabel = `${MONTH_NAMES_SHORT[closingMonth - 1]}/${closingYear}`;
  const label = `Fatura ${shortLabel} (${startDayStr}/${prevMonthStr} a ${closingDayStr}/${closingMonthStr})`;
  const cycleId = `${closingYear}-${closingMonthStr}`;

  return {
    cycleId,
    label,
    shortLabel,
    startDate,
    closingDate,
    dueDate,
    isCurrent,
  };
}

/**
 * Retorna o ciclo de fatura vigente com base na data atual ou de referência.
 * Se hoje é 16/10/2026 (dia <= 23), o ciclo vigente é Outubro/2026 (24/09 a 23/10).
 * Se hoje é 24/10/2026 (dia > 23), o ciclo vigente é Novembro/2026 (24/10 a 23/11).
 */
export function getCurrentBillingCycle(
  referenceDate: Date | string = new Date(),
  closingDay = 23,
  dueDay = 30
): BillingCycleInfo {
  let d: Date;
  if (typeof referenceDate === 'string') {
    const parts = referenceDate.split('T')[0].split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = referenceDate;
  }

  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  const day = d.getDate();

  let closingYear = year;
  let closingMonth = month;

  if (day > closingDay) {
    closingMonth += 1;
    if (closingMonth > 12) {
      closingMonth = 1;
      closingYear += 1;
    }
  }

  return getBillingCycleForMonth(closingYear, closingMonth, closingDay, dueDay, true);
}

/**
 * Retorna uma lista dos últimos N ciclos de faturamento para preencher seletores de interface.
 */
export function getRecentBillingCycles(
  count = 6,
  referenceDate: Date | string = new Date(),
  closingDay = 23,
  dueDay = 30
): BillingCycleInfo[] {
  const current = getCurrentBillingCycle(referenceDate, closingDay, dueDay);
  const parts = current.cycleId.split('-').map(Number);
  let curYear = parts[0];
  let curMonth = parts[1];

  const cycles: BillingCycleInfo[] = [];

  for (let i = 0; i < count; i++) {
    const isCur = i === 0;
    cycles.push(getBillingCycleForMonth(curYear, curMonth, closingDay, dueDay, isCur));

    curMonth -= 1;
    if (curMonth < 1) {
      curMonth = 12;
      curYear -= 1;
    }
  }

  return cycles;
}

/**
 * Calcula a data de vencimento da fatura (YYYY-MM-DD) para uma determinada data de operação/compra.
 * 
 * @param operationDate Data da compra (string ISO 'YYYY-MM-DD...' ou objeto Date)
 * @param closingDay Dia do corte da fatura (padrão 23)
 * @param dueDay Dia de vencimento da fatura (padrão 30)
 * @returns Data no formato 'YYYY-MM-DD'
 */
export function calculateCardDueDate(
  operationDate: string | Date | null | undefined,
  closingDay = 23,
  dueDay = 30
): string {
  if (!operationDate) {
    return new Date().toISOString().split('T')[0];
  }

  let year: number;
  let month: number; // 0-11
  let day: number;

  if (typeof operationDate === 'string') {
    const cleanStr = operationDate.trim();
    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('T')[0].split('-').map(p => parseInt(p, 10));
      year = parts[0];
      month = parts[1] - 1;
      day = parts[2];
    } else {
      const parsed = new Date(cleanStr);
      if (isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0];
      year = parsed.getFullYear();
      month = parsed.getMonth();
      day = parsed.getDate();
    }
  } else {
    year = operationDate.getFullYear();
    month = operationDate.getMonth();
    day = operationDate.getDate();
  }

  // Se a compra ocorreu APÓS o dia de corte, o ciclo fecha no mês seguinte
  let dueYear = year;
  let dueMonth = month;

  if (day > closingDay) {
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }

  // Trata meses com menos dias que o dia de vencimento (ex: fevereiro com 28/29 dias)
  const lastDayOfMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
  const targetDay = Math.min(dueDay, lastDayOfMonth);

  const formattedMonth = String(dueMonth + 1).padStart(2, '0');
  const formattedDay = String(targetDay).padStart(2, '0');

  return `${dueYear}-${formattedMonth}-${formattedDay}`;
}
