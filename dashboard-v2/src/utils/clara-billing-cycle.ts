/**
 * Utilitário para cálculo determinístico de ciclo de faturamento e vencimento
 * dos cartões corporativos Clara.
 * 
 * Regra padrão:
 * - Ciclo: de 24 do mês anterior a 23 do mês corrente
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
    // Suporte a 'YYYY-MM-DD...'
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
