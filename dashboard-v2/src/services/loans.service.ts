import { supabase } from '@/lib/supabase';
import { Employee, Contract, LoanStats, ProjectionData, shouldDisplayExistingLoan, inferEntityType, isEligibleForNewLoan } from '@/types/loans';
import { PaymentsService } from './payments.service';

// ─── Raw types from Supabase tables ─────────────────────────────────────────

interface RawEmployee {
  id: string;
  full_name: string;
  company: string;
  employment_type: string;
  remuneration: number | string;
  status: string;
  start_date?: string;
  contract_expiry_date?: string;
  job_role?: string;
  links_aditivos?: string;
  metadata?: any;
  is_outsourced?: boolean;
  corporate_name?: string;
  pj_type?: string;
  tax_regime?: string;
  photo_url?: string;
  avatar_url?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  service_location?: string;
  cnpj_street?: string;
  cnpj_number?: string;
  cnpj_neighborhood?: string;
  cnpj_city?: string;
  cnpj_state?: string;
  cnpj_zip_code?: string;
}

interface RawLoan {
  id: string;
  employee_id: string;
  amount: number | string;
  installments: number;
  start_cycle: string; // YYYY-MM
  amount_paid_extra?: number | string;
  notes?: string;
  request_date?: string;
  paid_installments?: number;
  postponed_months?: number;
  contract_url?: string;
  first_payment_date?: string; // NOVO: Vencimento da 1ª parcela
}

function addMonths(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1 + months, day, 12, 0, 0);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function overrideLoans<T extends { id?: string; start_cycle?: string }>(loans: T[]): T[] {
  return loans.map(ln => {
    if (ln.id === '8e685570-a96a-4c16-8515-9dde086f1659') {
      return { ...ln, start_cycle: '2026-05' };
    }
    return ln;
  });
}

function overrideLoan<T extends { id?: string; start_cycle?: string }>(ln: T): T {
  if (ln && ln.id === '8e685570-a96a-4c16-8515-9dde086f1659') {
    return { ...ln, start_cycle: '2026-05' };
  }
  return ln;
}

// ─── Calculation helpers (fixed mathematical engine) ─────────────

function getElapsedMonths(ln: RawLoan): number {
  const amount = parseFloat(String(ln.amount)) || 0;
  const inst = parseInt(String(ln.installments)) || 0;
  const sc = ln.start_cycle;
  if (!amount || !inst || !sc) return 0;

  const now = new Date();
  const [y, m] = sc.split('-').map(Number);
  
  // A primeira parcela é sempre devida no mês seguinte ao ciclo de referência.
  const startAbs = y * 12 + m;
  const nowAbs = now.getFullYear() * 12 + (now.getMonth() + 1);
  
  let elapsed = nowAbs - startAbs;
  
  // O pagamento só vira válido no sistema dia 10!
  if (now.getDate() < 10) elapsed--;
  
  // Deduzimos o tempo em que o contrato ficou congelado.
  const postponed = parseInt(String(ln.postponed_months)) || 0;
  elapsed -= postponed;
  
  return Math.max(0, Math.min(elapsed, inst));
}

function calcDebtForLoan(ln: RawLoan, contractPayments?: { status: string, amount: number }[]): number {
  const amount = parseFloat(String(ln.amount)) || 0;
  const inst = parseInt(String(ln.installments)) || 0;
  if (!amount || !inst) return 0;
  const extraPaid = parseFloat(String(ln.amount_paid_extra)) || 0;

  if (contractPayments && contractPayments.length > 0) {
    const paidAmount = contractPayments
      .filter(p => p.status === 'PAGO')
      .reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, amount - paidAmount - extraPaid);
  }

  // Fallback para calculo automatico por tempo decorrido
  const elapsed = getElapsedMonths(ln);
  const standardPaid = elapsed * (amount / inst);
  return Math.max(0, amount - (standardPaid + extraPaid));
}

function calcReceivedForLoan(ln: RawLoan, contractPayments?: { status: string, amount: number }[]): number {
  const amount = parseFloat(String(ln.amount)) || 0;
  const debt = calcDebtForLoan(ln, contractPayments);
  return Math.max(0, amount - debt);
}

export function calcInstallmentForMonth(ln: RawLoan, monthStr: string, contractPayments?: { status: string, amount: number, due_date: string, paid_date?: string }[]): number {
  if (contractPayments && contractPayments.length > 0) {
    const monthExpected = contractPayments
      .filter(p => {
        if (p.status === 'PAGO') {
          const dateStr = p.paid_date || p.due_date;
          return dateStr && dateStr.substring(0, 7) === monthStr;
        } else if (p.status === 'PENDENTE') {
          return p.due_date && p.due_date.substring(0, 7) === monthStr;
        }
        return false;
      })
      .reduce((sum, p) => sum + p.amount, 0);
    return monthExpected;
  }

  // Fallback se não existirem parcelas no banco
  const [ty, tm] = monthStr.split('-').map(Number);
  const targetAbs = ty * 12 + tm;
  const amount = parseFloat(String(ln.amount)) || 0;
  const inst = parseInt(String(ln.installments)) || 0;
  if (!amount || !inst || !ln.start_cycle) return 0;

  if (calcDebtForLoan(ln) <= 0) return 0;

  const [sy, sm] = ln.start_cycle.split('-').map(Number);
  const startAbs = sy * 12 + sm;
  const startPaymentAbs = startAbs + 1;
  const postponed = parseInt(String(ln.postponed_months)) || 0;

  const endAbs = startPaymentAbs + inst - 1 + postponed;

  if (targetAbs < startPaymentAbs || targetAbs > endAbs) return 0;

  if (postponed > 0) {
    const elapsed = getElapsedMonths(ln);
    const posFromStart = targetAbs - startPaymentAbs + 1;
    if (posFromStart >= elapsed + 1 && posFromStart <= elapsed + postponed) return 0;
  }

  // Considera tanto parcelas passadas quanto a do mês atual
  const now = new Date();
  const nowAbs = now.getFullYear() * 12 + (now.getMonth() + 1);
  if (targetAbs <= nowAbs) {
    return amount / inst;
  }
  return 0;
}

function loanStatus(ln: RawLoan, contractPayments?: { status: string, amount: number }[]): 'ATIVO' | 'LIQUIDADO' | 'ATRASADO' {
  return calcDebtForLoan(ln, contractPayments) <= 0 ? 'LIQUIDADO' : 'ATIVO';
}

function loanEndDate(ln: RawLoan, contractPayments?: { due_date: string }[]): string {
  if (contractPayments && contractPayments.length > 0) {
    const sorted = [...contractPayments].sort((a, b) => a.due_date.localeCompare(b.due_date));
    return sorted[sorted.length - 1]?.due_date || '-';
  }

  if (!ln.start_cycle || !ln.installments) return '-';
  const postponed = parseInt(String(ln.postponed_months)) || 0;
  const [y, m] = ln.start_cycle.split('-').map(Number);
  
  const endAbs = y * 12 + m + ln.installments + postponed;
  const ey = Math.floor((endAbs - 1) / 12);
  const em = ((endAbs - 1) % 12) + 1;
  return `${ey}-${String(em).padStart(2, '0')}-10`;
}

function loanNextPayment(ln: RawLoan, contractPayments?: { due_date: string, status: string }[]): string {
  if (contractPayments && contractPayments.length > 0) {
    const nextPending = contractPayments
      .filter(p => p.status === 'PENDENTE')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
    return nextPending?.due_date || '-';
  }

  if (!ln.start_cycle || !ln.installments) return '-';
  const status = loanStatus(ln);
  if (status === 'LIQUIDADO') return '-';

  const [sy, sm] = ln.start_cycle.split('-').map(Number);
  const startAbs = sy * 12 + sm;
  
  const elapsed = getElapsedMonths(ln);
  const postponed = parseInt(String(ln.postponed_months)) || 0;
  
  const nextAbs = startAbs + 1 + elapsed + postponed;
  
  const ny = Math.floor((nextAbs - 1) / 12);
  const nm = ((nextAbs - 1) % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-10`;
}

function getMonthNameAndYear(dateStr: string): string {
  if (!dateStr || dateStr === '-') return '-';
  const parts = dateStr.split('-');
  if (parts.length < 2) return '-';
  const y = parts[0];
  const m = parseInt(parts[1], 10) - 1;
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  if (m < 0 || m > 11) return '-';
  return `${monthNames[m]}/${y}`;
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchLoans(isTestMode: boolean): Promise<RawLoan[]> {
  const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
  const { data, error } = await supabase
    .from(table)
    .select('id,employee_id,amount,installments,start_cycle,amount_paid_extra,notes,request_date,postponed_months,contract_url,first_payment_date');

  if (error) {
    // Caso a tabela teste ainda não exista, retorna vazio sem quebrar
    if (isTestMode && error.code === '42P01') return [];
    throw new Error(`Falha ao buscar empréstimos: ${error.message}`);
  }
  const list = (data || []) as RawLoan[];
  return overrideLoans(list);
}

export async function fetchEmployees(isTestMode: boolean): Promise<RawEmployee[]> {
  const table = isTestMode ? 'employees_test' : 'employees';
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .neq('full_name', '__SYSTEM_GLOBAL_CONFIG__')
    .order('full_name');

  if (error) {
    // Caso a tabela teste ainda não exista, retorna vazio sem quebrar
    if (isTestMode && error.code === '42P01') return [];
    throw new Error(`Falha ao buscar colaboradores: ${error.message}`);
  }
  return ((data || []) as RawEmployee[]).filter(e => 
    e.full_name !== '__SYSTEM_GLOBAL_CONFIG__' && 
    !e.full_name?.toUpperCase().includes('SYSTEM_GLOBAL') &&
    !e.corporate_name?.toUpperCase().includes('SYSTEM_GLOBAL')
  );
}

// ─── LoansService ────────────────────────────────────────────────────────────

/**
 * Retorna o mês de cobrança ativo:
 * - Antes do dia 10: mês corrente (parcela ainda não venceu)
 * - A partir do dia 10: próximo mês (ciclo corrente já fechou)
 */
export function getBillingMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export class LoansService {

  /** Lista colaboradores que possuem empréstimo */
  static async getEmployees(_filters?: unknown, isTestMode?: boolean): Promise<Employee[]> {
    console.log(`[LoansService] Buscando colaboradores (Modo Teste: ${isTestMode})...`);

    const safeTestMode = Boolean(isTestMode);
    const paymentsTable = safeTestMode ? 'loan_payments_test' : 'loan_payments';
    const [emps, loans, paymentsRes] = await Promise.all([
      fetchEmployees(safeTestMode),
      fetchLoans(safeTestMode),
      supabase.from(paymentsTable).select('contract_id, status, amount, due_date, paid_date')
    ]);

    const payments = paymentsRes.data || [];
    const paymentsByContract = new Map<string, { status: string, amount: number, due_date: string, paid_date?: string }[]>();
    payments.forEach(p => {
      const arr = paymentsByContract.get(p.contract_id) || [];
      arr.push({
        status: p.status,
        amount: parseFloat(String(p.amount)) || 0,
        due_date: p.due_date,
        paid_date: p.paid_date
      });
      paymentsByContract.set(p.contract_id, arr);
    });

    const loansByEmp = new Map<string, RawLoan[]>();
    loans.forEach(ln => {
      const arr = loansByEmp.get(ln.employee_id) || [];
      arr.push(ln);
      loansByEmp.set(ln.employee_id, arr);
    });

    const billingMonthStr = getBillingMonthStr();
    
    // Busca contagem de aditivos via Histórico (Deduplicação)
    const historyTable = safeTestMode ? 'employee_history_test' : 'employee_history';
    const { data: histAditivos } = await supabase
      .from(historyTable)
      .select('employee_id, observations')
      .ilike('event_type', '%aditivo%');

    const historyAditivosByEmp = new Map<string, string[]>();
    histAditivos?.forEach(h => {
      const arr = historyAditivosByEmp.get(h.employee_id) || [];
      arr.push(h.observations || '');
      historyAditivosByEmp.set(h.employee_id, arr);
    });

    const result: Employee[] = [];
    emps.forEach(emp => {
      const empLoans = loansByEmp.get(emp.id) || [];
      const filters = _filters as any;
      const showAll = filters?.mostrarTodos;
      
      // Filtro de data
      let filteredEmpLoans = empLoans;
      if (filters?.dateStart || filters?.dateEnd) {
        filteredEmpLoans = empLoans.filter(ln => {
          if (!ln.request_date) return false; // Se tiver filtro de data, e não tiver data, descarta
          const reqDate = new Date(ln.request_date);
          if (filters.dateStart) {
            const start = new Date(filters.dateStart + 'T00:00:00');
            if (reqDate < start) return false;
          }
          if (filters.dateEnd) {
            const end = new Date(filters.dateEnd + 'T23:59:59');
            if (reqDate > end) return false;
          }
          return true;
        });
      }

      const hasExistingLoan = filteredEmpLoans.length > 0;
      // Regra de elegibilidade conservadora
      if (!shouldDisplayExistingLoan(emp as any, hasExistingLoan)) {
        return;
      }
      
      // Se não for "mostrar todos" e não tiver empréstimo, pula
      if (!showAll && !hasExistingLoan) return;

      const totalTaken = filteredEmpLoans.reduce((a, ln) => a + (parseFloat(String(ln.amount)) || 0), 0);
      const balance = filteredEmpLoans.reduce((a, ln) => a + calcDebtForLoan(ln, paymentsByContract.get(ln.id)), 0);
      const totalReceived = filteredEmpLoans.reduce((a, ln) => a + calcReceivedForLoan(ln, paymentsByContract.get(ln.id)), 0);
      const monthInstallment = filteredEmpLoans.reduce((a, ln) => a + calcInstallmentForMonth(ln, billingMonthStr, paymentsByContract.get(ln.id)), 0);

      // --- Parcelas Restantes e Vencimento Mais Longevo ---
      const remainingInstallments = filteredEmpLoans.reduce((sum, ln) => {
        const cPayments = paymentsByContract.get(ln.id) || [];
        if (calcDebtForLoan(ln, cPayments) <= 0) return sum;
        if (cPayments.length > 0) {
          const pendingCount = cPayments.filter(p => p.status === 'PENDENTE').length;
          return sum + pendingCount;
        }
        const inst = parseInt(String(ln.installments)) || 0;
        const elapsed = getElapsedMonths(ln);
        return sum + Math.max(0, inst - elapsed);
      }, 0);

      let lastInstallmentDate = '';
      filteredEmpLoans.forEach(ln => {
        const endDate = loanEndDate(ln, paymentsByContract.get(ln.id));
        if (endDate && endDate !== '-' && endDate > lastInstallmentDate) {
          lastInstallmentDate = endDate;
        }
      });

      // --- Lógica de Deduplicação de Aditivos ---
      const aditivoUrls = new Set<string>();
      let textOnlyCount = 0;

      const extractUrls = (text: string) => {
        const matches = text.match(/\((https?:\/\/.*?)\)/g);
        if (matches) {
          matches.forEach(m => aditivoUrls.add(m.slice(1, -1)));
          return true;
        }
        return false;
      };

      // 1. Processa links_aditivos da ficha
      const lines = (emp.links_aditivos || '').split('\n').filter(l => l.trim() !== '');
      lines.forEach(line => {
        if (!extractUrls(line)) textOnlyCount++;
      });

      // 2. Processa histórico
      const histObs = historyAditivosByEmp.get(emp.id) || [];
      histObs.forEach(obs => {
        if (!extractUrls(obs)) textOnlyCount++;
      });
      
      const aditivoCount = aditivoUrls.size + textOnlyCount;

      // --- Cálculo da próxima parcela pendente a ser paga ---
      const allPendingInstallments: { due_date: string; amount: number }[] = [];
      filteredEmpLoans.forEach(ln => {
        const cPayments = paymentsByContract.get(ln.id) || [];
        if (calcDebtForLoan(ln, cPayments) <= 0) return;
        cPayments.forEach(p => {
          if (p.status === 'PENDENTE' && p.due_date) {
            allPendingInstallments.push({
              due_date: p.due_date,
              amount: p.amount
            });
          }
        });
      });

      let nextInstallmentValue = 0;
      let nextInstallmentDate: string | null = null;
      if (allPendingInstallments.length > 0) {
        allPendingInstallments.sort((a, b) => a.due_date.localeCompare(b.due_date));
        nextInstallmentDate = allPendingInstallments[0].due_date;
        nextInstallmentValue = allPendingInstallments
          .filter(p => p.due_date === nextInstallmentDate)
          .reduce((sum, p) => sum + p.amount, 0);
      }

      const rawEmpType = (emp.employment_type || '').trim();
      const normLinkType = (rawEmpType.toLowerCase().includes('estag') || rawEmpType.toLowerCase().includes('estág')) ? 'Estagiário' : (emp.employment_type || 'CLT');

      result.push({
        id: emp.id,
        name: emp.full_name,
        company: emp.company || 'MarBR',
        linkType: normLinkType,
        remuneration: parseFloat(String(emp.remuneration)) || 0,
        totalTaken,
        totalReceived,
        balance,
        monthInstallment,
        contractsCount: filteredEmpLoans.length,
        status: (emp.status || 'Ativo') as any, // Status de RH (Ativo/Inativo/Férias)
        loanStatus: balance > 0 ? 'Ativo' : (totalTaken > 0 ? 'Quitado' : 'Sem Empréstimo'),
        contract_expiry_date: emp.contract_expiry_date,
        job_role: emp.job_role,
        links_aditivos: emp.links_aditivos,
        aditivoCount,
        remainingInstallments,
        lastInstallmentDate: lastInstallmentDate || null,
        photo_url: emp.photo_url || emp.avatar_url || emp.metadata?.photo_url || emp.metadata?.avatar_url || emp.metadata?.foto,
        street: emp.street,
        number: emp.number,
        neighborhood: emp.neighborhood,
        city: emp.city,
        state: emp.state,
        zip_code: emp.zip_code,
        service_location: emp.service_location,
        cnpj_street: emp.cnpj_street,
        cnpj_number: emp.cnpj_number,
        cnpj_neighborhood: emp.cnpj_neighborhood,
        cnpj_city: emp.cnpj_city,
        cnpj_state: emp.cnpj_state,
        cnpj_zip_code: emp.cnpj_zip_code,
        metadata: emp.metadata || {},
        entityType: inferEntityType(emp as any),
        nextInstallmentValue,
        nextInstallmentDate
      });
    });

    console.log('[LoansService] Colaboradores com empréstimos:', result.length);
    return result;
  }

  /** Estatísticas gerais calculadas dos dados reais */
  static async getStats(isTestMode?: boolean, dateFilters?: { dateStart?: string, dateEnd?: string }): Promise<LoanStats> {
    const safeTestMode = Boolean(isTestMode);
    const paymentsTable = safeTestMode ? 'loan_payments_test' : 'loan_payments';
    const [emps, loans, paymentsRes] = await Promise.all([
      fetchEmployees(safeTestMode),
      fetchLoans(safeTestMode),
      supabase.from(paymentsTable).select('contract_id, status, amount, due_date, paid_date')
    ]);

    const payments = paymentsRes.data || [];
    const paymentsByContract = new Map<string, { status: string, amount: number, due_date: string, paid_date?: string }[]>();
    payments.forEach(p => {
      const arr = paymentsByContract.get(p.contract_id) || [];
      arr.push({
        status: p.status,
        amount: parseFloat(String(p.amount)) || 0,
        due_date: p.due_date,
        paid_date: p.paid_date
      });
      paymentsByContract.set(p.contract_id, arr);
    });

    const empMap = new Map(emps.map(e => [e.id, e]));
    const billingMonthStr = getBillingMonthStr();

    let totalEmprestado = 0, saldoDevedor = 0, totalRecebido = 0, recebivelMes = 0;
    let contratosAtivos = 0, contratosLiquidados = 0;
    let maiorEmprestimo = 0, maiorEmprestimoRef = '-';
    let menorEndAbs = Infinity;
    let proximoEncerrarLoan: RawLoan | null = null;
    let ultimaParcelaLoan: RawLoan | null = null;
    let ultimaParcelaDate = '';

    loans.forEach(ln => {
      const emp = empMap.get(ln.employee_id);
      if (!emp) return; // Pula empréstimos de funcionários que não existem (fantasmas)

      // Filtro de data
      if (dateFilters?.dateStart || dateFilters?.dateEnd) {
        if (!ln.request_date) return;
        const reqDate = new Date(ln.request_date);
        if (dateFilters.dateStart) {
          const start = new Date(dateFilters.dateStart + 'T00:00:00');
          if (reqDate < start) return;
        }
        if (dateFilters.dateEnd) {
          const end = new Date(dateFilters.dateEnd + 'T23:59:59');
          if (reqDate > end) return;
        }
      }

      const amount = parseFloat(String(ln.amount)) || 0;
      const contractPayments = paymentsByContract.get(ln.id);
      const debt = calcDebtForLoan(ln, contractPayments);
      const status = loanStatus(ln, contractPayments);

      totalEmprestado += amount;
      saldoDevedor += debt;
      totalRecebido += calcReceivedForLoan(ln, contractPayments);
      recebivelMes += calcInstallmentForMonth(ln, billingMonthStr, contractPayments);

      if (status === 'ATIVO') {
        contratosAtivos++;
        const [sy, sm] = (ln.start_cycle || "").split("-").map(Number);
        if (!isNaN(sy) && !isNaN(sm)) {
          const postponed = parseInt(String(ln.postponed_months)) || 0;
          const endAbs = sy * 12 + sm + (parseInt(String(ln.installments)) || 0) + postponed;
          if (endAbs < menorEndAbs) {
            menorEndAbs = endAbs;
            proximoEncerrarLoan = ln;
          }
        }

        // Última Parcela (Mais Longeva)
        const endDate = loanEndDate(ln, contractPayments);
        if (endDate && endDate !== '-' && endDate > ultimaParcelaDate) {
          ultimaParcelaDate = endDate;
          ultimaParcelaLoan = ln;
        }
      } else {
        contratosLiquidados++;
      }

      if (amount > maiorEmprestimo) {
        maiorEmprestimo = amount;
        const emp = empMap.get(ln.employee_id);
        maiorEmprestimoRef = emp?.full_name?.split(' ')[0] || '-';
      }
    });

    let proximoEncerrar = '-', parcelasRestantes = 0, proximoEncerrarValor = 0;
    if (proximoEncerrarLoan) {
      const pl = proximoEncerrarLoan as RawLoan;
      const endD = loanEndDate(pl, paymentsByContract.get(pl.id));
      proximoEncerrar = getMonthNameAndYear(endD);
      
      const installments = parseInt(String(pl.installments)) || 0;
      const elapsed = getElapsedMonths(pl);
      parcelasRestantes = Math.max(0, installments - elapsed);
      proximoEncerrarValor = (parseFloat(String(pl.amount)) || 0) / (installments || 1);
    }

    let ultimaParcelaMes = '-';
    let ultimaParcelaValor = 0;
    if (ultimaParcelaLoan) {
      const ul = ultimaParcelaLoan as RawLoan;
      const endD = loanEndDate(ul, paymentsByContract.get(ul.id));
      ultimaParcelaMes = getMonthNameAndYear(endD);
      
      const installments = parseInt(String(ul.installments)) || 1;
      const amount = parseFloat(String(ul.amount)) || 0;
      ultimaParcelaValor = amount / installments;
    }

    return {
      totalEmprestado, saldoDevedor, totalRecebido, recebivelMes,
      contratosAtivos, contratosLiquidados,
      maiorEmprestimo, maiorEmprestimoRef,
      proximoEncerrar, parcelasRestantes,
      proximoEncerrarValor,
      ultimaParcelaMes,
      ultimaParcelaValor,
    };
  }

  /** Histórico real dos recebidos no passado agrupados por mês */
  static async getPastPayments(isTestMode?: boolean): Promise<{ month: string; total: number; previsto: number }[]> {
    const safeTestMode = Boolean(isTestMode);
    const paymentsTable = safeTestMode ? 'loan_payments_test' : 'loan_payments';
    
    const { data, error } = await supabase
      .from(paymentsTable)
      .select('amount, due_date, status, paid_date');
      
    if (error || !data) {
      console.error('[LoansService] Erro ao carregar histórico de pagamentos:', error);
      return [];
    }
    
    const currentBillingMonth = getBillingMonthStr();
    const monthlyMap = new Map<string, { total: number; previsto: number }>();
    
    data.forEach(p => {
      if (!p.due_date) return;
      const parts = p.due_date.split('-');
      if (parts.length < 2) return;
      const dueMonthKey = `${parts[0]}-${parts[1]}`;
      const amount = parseFloat(String(p.amount)) || 0;
      
      // Previsto goes to the due_date month
      if (dueMonthKey <= currentBillingMonth) {
        const current = monthlyMap.get(dueMonthKey) || { total: 0, previsto: 0 };
        current.previsto += amount;
        monthlyMap.set(dueMonthKey, current);
      }
      
      // Realizado goes to the paid_date month (if PAGO)
      if (p.status === 'PAGO') {
        const paidDateStr = p.paid_date || p.due_date;
        const paidParts = paidDateStr.split('-');
        if (paidParts.length >= 2) {
          const paidMonthKey = `${paidParts[0]}-${paidParts[1]}`;
          if (paidMonthKey <= currentBillingMonth) {
            const current = monthlyMap.get(paidMonthKey) || { total: 0, previsto: 0 };
            current.total += amount;
            monthlyMap.set(paidMonthKey, current);
          }
        }
      }
    });
    
    const sortedKeys = Array.from(monthlyMap.keys()).sort();
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    return sortedKeys.map(key => {
      const [y, m] = key.split('-');
      const label = `${monthNames[parseInt(m, 10) - 1]}/${y.substring(2)}`;
      const val = monthlyMap.get(key)!;
      return {
        month: label,
        total: Number(val.total.toFixed(2)),
        previsto: Number(val.previsto.toFixed(2))
      };
    });
  }

  /** Projeção mensal dos recebíveis */
  static async getProjections(isTestMode?: boolean): Promise<ProjectionData[]> {
    const safeTestMode = Boolean(isTestMode);
    const paymentsTable = safeTestMode ? 'loan_payments_test' : 'loan_payments';
    const loansTable = safeTestMode ? 'employee_loans_test' : 'employee_loans';
    
    const [paymentsRes, loansRes] = await Promise.all([
      supabase.from(paymentsTable).select('amount, due_date, status, contract_id, paid_date'),
      supabase.from(loansTable).select('id, amount, amount_paid_extra')
    ]);
      
    if (paymentsRes.error || !paymentsRes.data) {
      console.error('[LoansService] Erro ao carregar projeções:', paymentsRes.error);
      return [];
    }
    
    const allPayments = paymentsRes.data || [];
    const allLoans = loansRes.data || [];

    // Mapear empréstimos por id
    const loanMap = new Map<string, { amount: number; extra: number; paid: number }>();
    allLoans.forEach(l => {
      loanMap.set(l.id, {
        amount: parseFloat(String(l.amount)) || 0,
        extra: parseFloat(String(l.amount_paid_extra)) || 0,
        paid: 0
      });
    });

    // Somar parcelas pagas no banco
    allPayments.forEach(p => {
      if (p.status === 'PAGO') {
        const l = loanMap.get(p.contract_id);
        if (l) {
          l.paid += parseFloat(String(p.amount)) || 0;
        }
      }
    });

    const isLoanLiquidated = (contractId: string) => {
      const l = loanMap.get(contractId);
      if (!l) return false;
      const debt = Math.max(0, l.amount - l.paid - l.extra);
      return debt <= 0;
    };
    
    const currentBillingMonth = getBillingMonthStr();
    const monthlyMap = new Map<string, { total: number; previsto: number }>();
    
    allPayments.forEach(p => {
      if (!p.due_date) return;
      const parts = p.due_date.split('-');
      if (parts.length < 2) return;
      const monthKey = `${parts[0]}-${parts[1]}`;
      
      // 1. Desconsiderar parcelas (de qualquer status) de contratos já liquidados se o vencimento for futuro/presente
      if (isLoanLiquidated(p.contract_id) && monthKey >= currentBillingMonth) {
        return;
      }
      
      const amount = parseFloat(String(p.amount)) || 0;
      
      // Previsto: vai para o mês do due_date (vencimento esperado) se for do presente/futuro
      if (monthKey >= currentBillingMonth) {
        const current = monthlyMap.get(monthKey) || { total: 0, previsto: 0 };
        current.previsto += amount;
        monthlyMap.set(monthKey, current);
      }
      
      // Realizado: vai para o mês do paid_date (realmente recebido)
      if (p.status === 'PAGO') {
        const paidDateStr = p.paid_date || p.due_date;
        const paidParts = paidDateStr.split('-');
        if (paidParts.length >= 2) {
          const paidMonthKey = `${paidParts[0]}-${paidParts[1]}`;
          if (paidMonthKey >= currentBillingMonth) {
            const current = monthlyMap.get(paidMonthKey) || { total: 0, previsto: 0 };
            current.total += amount;
            monthlyMap.set(paidMonthKey, current);
          }
        }
      }
    });
    
    const sortedKeys = Array.from(monthlyMap.keys()).sort();
    
    // Fallback se estiver vazio
    if (sortedKeys.length === 0) {
      const now = new Date();
      let currentAbs = now.getFullYear() * 12 + now.getMonth() + 1;
      for (let i = 0; i < 24; i++) {
        const y = Math.floor((currentAbs - 1) / 12);
        const m = ((currentAbs - 1) % 12) + 1;
        const key = `${y}-${String(m).padStart(2, '0')}`;
        monthlyMap.set(key, { total: 0, previsto: 0 });
        currentAbs++;
      }
      sortedKeys.push(...Array.from(monthlyMap.keys()).sort());
    }
    
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    return sortedKeys.map(key => {
      const [y, m] = key.split('-');
      const label = `${monthNames[parseInt(m, 10) - 1]}/${y.substring(2)}`;
      const val = monthlyMap.get(key)!;
      return {
        month: label,
        total: Number(val.total.toFixed(2)),
        previsto: Number(val.previsto.toFixed(2))
      };
    });
  }

  /** Empréstimos de um colaborador específico */
  static async getEmployeeContracts(employeeId: string, isTestMode?: boolean): Promise<Contract[]> {
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    const paymentsTable = isTestMode ? 'loan_payments_test' : 'loan_payments';
    
    const [loansRes, paymentsRes] = await Promise.all([
      supabase.from(table)
        .select('id,employee_id,amount,installments,start_cycle,amount_paid_extra,notes,request_date,paid_installments,postponed_months,contract_url,first_payment_date')
        .eq('employee_id', employeeId)
        .order('request_date', { ascending: false }),
      supabase.from(paymentsTable)
        .select('contract_id, status, amount, due_date, paid_date')
        .eq('employee_id', employeeId)
    ]);

    if (loansRes.error) {
      console.error('[LoansService] Erro ao buscar empréstimos:', loansRes.error);
      throw new Error('Falha ao carregar empréstimos');
    }

    const loans = overrideLoans((loansRes.data || []) as RawLoan[]);
    const payments = paymentsRes.data || [];
    
    const paymentsByContract = new Map<string, { status: string, amount: number, due_date: string, paid_date?: string }[]>();
    payments.forEach(p => {
      const arr = paymentsByContract.get(p.contract_id) || [];
      arr.push({
        status: p.status,
        amount: parseFloat(String(p.amount)) || 0,
        due_date: p.due_date,
        paid_date: p.paid_date
      });
      paymentsByContract.set(p.contract_id, arr);
    });

    return loans.map((ln, idx) => {
      const amount = parseFloat(String(ln.amount)) || 0;
      const installmentValue = ln.installments > 0 ? amount / ln.installments : 0;
      const contractPayments = paymentsByContract.get(ln.id) || [];
      const balance = calcDebtForLoan(ln, contractPayments);
      const installmentsPaid = contractPayments.filter(p => p.status === 'PAGO').length;

      return {
        id: ln.id,
        employee_id: ln.employee_id,
        operationNumber: `OP-${String(idx + 1).padStart(2, '0')}`,
        value: amount,
        balance,
        installments: ln.installments || 0,
        installmentValue,
        installmentsPaid,
        nextPaymentDate: loanNextPayment(ln, contractPayments),
        endDate: loanEndDate(ln, contractPayments),
        status: loanStatus(ln, contractPayments),
        startDate: ln.start_cycle ? `${ln.start_cycle}-01` : '-',
        requestDate: ln.request_date,
        description: ln.notes || '',
        contractUrl: ln.contract_url || '',
        firstPaymentDate: ln.first_payment_date,
      };
    });
  }

  /** Detalhes financeiros de um colaborador */
  static async getEmployeeDetails(employeeId: string, isTestMode?: boolean): Promise<Employee | null> {
    const empsTable = isTestMode ? 'employees_test' : 'employees';
    const loansTable = isTestMode ? 'employee_loans_test' : 'employee_loans';
    const paymentsTable = isTestMode ? 'loan_payments_test' : 'loan_payments';
    
    const [empRes, loansRes, paymentsRes] = await Promise.all([
      supabase.from(empsTable)
        .select('id,full_name,company,employment_type,remuneration,status,start_date')
        .eq('id', employeeId)
        .single(),
      supabase.from(loansTable)
        .select('id,employee_id,amount,installments,start_cycle,amount_paid_extra,paid_installments,postponed_months,first_payment_date')
        .eq('employee_id', employeeId),
      supabase.from(paymentsTable)
        .select('contract_id, status, amount, due_date, paid_date')
        .eq('employee_id', employeeId)
    ]);

    if (empRes.error || !empRes.data) {
      console.error('[LoansService] Colaborador não encontrado:', empRes.error);
      return null;
    }

    const emp = empRes.data as RawEmployee;
    const loans = overrideLoans((loansRes.data || []) as RawLoan[]);
    const payments = paymentsRes.data || [];
    
    const paymentsByContract = new Map<string, { status: string, amount: number, due_date: string, paid_date?: string }[]>();
    payments.forEach(p => {
      const arr = paymentsByContract.get(p.contract_id) || [];
      arr.push({
        status: p.status,
        amount: parseFloat(String(p.amount)) || 0,
        due_date: p.due_date,
        paid_date: p.paid_date
      });
      paymentsByContract.set(p.contract_id, arr);
    });

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalTaken = loans.reduce((a, ln) => a + (parseFloat(String(ln.amount)) || 0), 0);
    const balance = loans.reduce((a, ln) => a + calcDebtForLoan(ln, paymentsByContract.get(ln.id)), 0);
    const totalReceived = loans.reduce((a, ln) => a + calcReceivedForLoan(ln, paymentsByContract.get(ln.id)), 0);
    const monthInstallment = loans.reduce((a, ln) => a + calcInstallmentForMonth(ln, currentMonthStr, paymentsByContract.get(ln.id)), 0);

    const rawEmpType = (emp.employment_type || '').trim();
    const normLinkType = (rawEmpType.toLowerCase().includes('estag') || rawEmpType.toLowerCase().includes('estág')) ? 'Estagiário' : (emp.employment_type || 'CLT');

    return {
      id: emp.id,
      name: emp.full_name,
      company: emp.company || 'MarBR',
      linkType: normLinkType,
      remuneration: parseFloat(String(emp.remuneration)) || 0,
      totalTaken,
      totalReceived,
      balance,
      monthInstallment,
      contractsCount: loans.length,
      status: balance > 0 ? 'Ativo' : 'Quitado',
    };
  }
  // ─── Ações de Painel Lateral & Criação ───────────────────────────────────────

  static async createLoan(data: {
    employee_id: string;
    amount: number;
    installments: number;
    start_cycle: string;
    request_date?: string;
    first_payment_date?: string;
    notes?: string;
  }, isTestMode?: boolean): Promise<{id: string, [key: string]: any}> {
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    
    const payload = {
      employee_id: data.employee_id,
      amount: data.amount,
      installments: data.installments,
      start_cycle: data.start_cycle,
      notes: data.notes || '',
      request_date: data.request_date || new Date().toISOString(),
      first_payment_date: data.first_payment_date || null,
      paid_installments: 0,
      postponed_months: 0,
      amount_paid_extra: 0
    };

    const { data: result, error } = await supabase
      .from(table)
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error(`[LoansService] Erro ao criar formulário (${table}):`, error);
      throw new Error(`Falha ao registrar empréstimo: ${error.message}`);
    }

    if (result && result.id) {
      await PaymentsService.generateInstallments(result.id, isTestMode);
    }

    return result;
  }

  static async deleteContract(contractId: string, isTestMode?: boolean): Promise<void> {
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    const { error } = await supabase.from(table).delete().eq('id', contractId);
    if (error) throw new Error(`Falha ao excluir contrato: ${error.message}`);
  }

  static async liquidateContract(contractId: string, isTestMode?: boolean): Promise<void> {
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    const paymentsTable = isTestMode ? 'loan_payments_test' : 'loan_payments';
    
    // Buscar o contrato para saber as notas atuais
    const { data: loan, error: fetchErr } = await supabase
      .from(table)
      .select('notes')
      .eq('id', contractId)
      .single();
    if (fetchErr) throw new Error('Não foi possível buscar o contrato.');

    // 1. Atualizar todas as parcelas PENDENTES para PAGO no banco
    const todayStr = new Date().toISOString().split('T')[0];
    const { error: payErr } = await supabase
      .from(paymentsTable)
      .update({
        status: 'PAGO',
        paid_date: todayStr
      })
      .eq('contract_id', contractId)
      .eq('status', 'PENDENTE');

    if (payErr) throw new Error(`Falha ao atualizar parcelas para liquidação: ${payErr.message}`);

    // 2. Adicionar uma nota informativa ao contrato
    const currentNotes = loan.notes || '';
    const newNote = `\n[LIQUIDADO TOTALMENTE em ${new Date().toLocaleDateString('pt-BR')}]`;
    await supabase
      .from(table)
      .update({
        notes: currentNotes + newNote
      })
      .eq('id', contractId);
  }

  static async postponeContract(contractId: string, isTestMode?: boolean): Promise<void> {
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    
    const { data: loan, error: fetchErr } = await supabase
      .from(table)
      .select('postponed_months')
      .eq('id', contractId)
      .single();
    if (fetchErr) throw new Error('Não foi possível buscar o contrato.');

    const currentPsp = parseInt(String(loan.postponed_months)) || 0;
    const { error: updErr } = await supabase.from(table).update({
      postponed_months: currentPsp + 1
    }).eq('id', contractId);

    if (updErr) throw new Error(`Falha ao postergar contrato: ${updErr.message}`);
  }

  static async anticipateInstallment(contractId: string, multiplier: number, isTestMode?: boolean): Promise<void> {
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    
    const { data: loan, error: fetchErr } = await supabase
      .from(table)
      .select('amount, installments, amount_paid_extra')
      .eq('id', contractId)
      .single();
    if (fetchErr) throw new Error('Não foi possível buscar o contrato.');

    const amount = parseFloat(String(loan.amount)) || 0;
    const inst = parseInt(String(loan.installments)) || 1;
    const installmentValue = amount / inst;
    const currentExt = parseFloat(String(loan.amount_paid_extra)) || 0;
    
    const { error: updErr } = await supabase.from(table).update({
      amount_paid_extra: currentExt + (installmentValue * multiplier)
    }).eq('id', contractId);

    if (updErr) throw new Error(`Falha ao antecipar parcelas: ${updErr.message}`);
  }

  static async revertContractOffsets(contractId: string, isTestMode?: boolean): Promise<void> {
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    const { error } = await supabase.from(table).update({
      amount_paid_extra: 0,
      postponed_months: 0
    }).eq('id', contractId);

    if (error) throw new Error(`Falha ao reverter parcelas: ${error.message}`);
  }

  static async updateContractUrl(contractId: string, url: string, isTestMode?: boolean): Promise<void> {
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    const { error } = await supabase.from(table).update({ contract_url: url }).eq('id', contractId);
    if (error) throw new Error(`Falha ao salvar URL do contrato: ${error.message}`);
  }

  static async uploadContractFile(
    contractId: string,
    file: File,
    isTestMode?: boolean
  ): Promise<string> {
    const folder = isTestMode ? 'test' : 'production';
    const ext = file.name.split('.').pop() || 'pdf';
    const storagePath = `${folder}/${contractId}.${ext}`;

    // Remove versão anterior (se existir) sem travar por erro de 404
    await supabase.storage.from('contracts').remove([storagePath]);

    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(storagePath, file, { upsert: true, contentType: file.type });

    if (uploadError) throw new Error(`Falha no upload: ${uploadError.message}`);

    // Salva o caminho interno (não a URL pública) na tabela
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    const { error: dbError } = await supabase.from(table).update({ contract_url: storagePath }).eq('id', contractId);
    if (dbError) throw new Error(`Arquivo enviado, mas falha ao salvar referência: ${dbError.message}`);

    return storagePath;
  }

  static async getContractSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('contracts')
      .createSignedUrl(storagePath, 60); // 60 segundos de validade

    if (error || !data?.signedUrl) throw new Error(`Falha ao gerar link de acesso: ${error?.message}`);
    return data.signedUrl;
  }

  static async getContractTimeline(contractId: string, isTestMode?: boolean) {
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    const paymentsTable = isTestMode ? 'loan_payments_test' : 'loan_payments';

    const [{ data: rawLoan, error: loanErr }, { data: dbPayments, error: payErr }] = await Promise.all([
      supabase.from(table).select('*').eq('id', contractId).single(),
      supabase.from(paymentsTable).select('*').eq('contract_id', contractId).order('due_date', { ascending: true })
    ]);

    if (loanErr || !rawLoan) throw new Error('Contrato não encontrado');
    
    if (dbPayments && dbPayments.length > 0) {
      let physicalIndex = 1;
      const timeline = dbPayments.map(p => {
        let label = '-';
        if (p.due_date) {
          const [y, m, d] = p.due_date.split('-');
          label = `${d}/${m}/${y}`;
        }
        return {
          id: p.id,
          index: p.status === 'POSTERGADO' ? 0 : physicalIndex++,
          label,
          status: p.status,
          amount: parseFloat(String(p.amount)) || 0
        };
      });
      return timeline;
    }

    // Fallback legada se nao existirem parcelas no banco
    const loan = overrideLoan(rawLoan);
    const amount = parseFloat(String(loan.amount)) || 0;
    const inst = parseInt(String(loan.installments)) || 1;
    const installmentValue = amount / inst;
    const elapsed = getElapsedMonths(loan as unknown as RawLoan); 
    const extraPaid = parseFloat(String(loan.amount_paid_extra)) || 0;
    const anticipatedCount = Math.floor(extraPaid / installmentValue);
    const postponed = parseInt(String(loan.postponed_months)) || 0;
    
    const [y, m] = loan.start_cycle.split('-').map(Number);
    let currentAbs = (y * 12) + m + 1;
    
    const timeline = [];
    let physicalIndex = 1;
    let paidViaElapsed = 0;
    let postponedUsed = 0;
    
    for (let i = 0; i < inst + postponed; i++) {
      const curY = Math.floor((currentAbs - 1) / 12);
      const curM = ((currentAbs - 1) % 12) + 1;
      const label = `${String(curM).padStart(2, '0')}/${curY}`;
      
      let statusStr = '';
      if (paidViaElapsed < elapsed) {
        statusStr = 'PAGO';
        timeline.push({ index: physicalIndex++, label, status: statusStr, amount: installmentValue });
        paidViaElapsed++;
      } else if (postponedUsed < postponed) {
        statusStr = 'POSTERGADO';
        timeline.push({ index: 0, label, status: statusStr, amount: 0 });
        postponedUsed++;
      } else if ((physicalIndex - 1) < (elapsed + anticipatedCount)) {
        statusStr = 'ANTECIPADO';
        timeline.push({ index: physicalIndex++, label, status: statusStr, amount: installmentValue });
      } else {
        statusStr = 'A PAGAR';
        timeline.push({ index: physicalIndex++, label, status: statusStr, amount: installmentValue });
      }
      currentAbs++;
    }
    return timeline;
  }

  static async updateContractDates(
    contractId: string,
    requestDate: string,
    firstPaymentDate: string,
    isTestMode?: boolean
  ): Promise<void> {
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    const paymentsTable = isTestMode ? 'loan_payments_test' : 'loan_payments';
    
    // 1. Atualiza o contrato
    const { error: updErr } = await supabase
      .from(table)
      .update({
        request_date: requestDate,
        first_payment_date: firstPaymentDate
      })
      .eq('id', contractId);
      
    if (updErr) {
      console.error('Erro ao atualizar datas do contrato:', updErr);
      throw new Error(`Falha ao atualizar datas do contrato: ${updErr.message}`);
    }
    
    // 2. Busca parcelas para atualizar os vencimentos se nenhuma estiver paga
    const { data: payments, error: fetchErr } = await supabase
      .from(paymentsTable)
      .select('id, status')
      .eq('contract_id', contractId)
      .order('due_date', { ascending: true });
      
    if (fetchErr) {
      console.error('Erro ao carregar parcelas para recalculo:', fetchErr);
      throw new Error(`Falha ao carregar parcelas para recalculo: ${fetchErr.message}`);
    }
    
    if (!payments || payments.length === 0) return;
    
    // Atualiza o vencimento de cada parcela em lote - mesmo com parcelas pagas, recalculamos as datas
    // de vencimento de todas as parcelas mantendo os status de pagamento originais.
    
    // Atualiza o vencimento de cada parcela em lote
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      const due = addMonths(firstPaymentDate, i);
      const cycle = due.substring(0, 7);
      
      const { error: payUpdErr } = await supabase
        .from(paymentsTable)
        .update({
          due_date: due,
          month_cycle: cycle
        })
        .eq('id', p.id);
        
      if (payUpdErr) {
        console.error(`Erro ao atualizar parcela ${i}:`, payUpdErr);
        throw new Error(`Falha ao atualizar parcela ${i}: ${payUpdErr.message}`);
      }
    }
  }

  /** Relatorio de auditoria: saude de todos os contratos */
  static async getAuditReport(isTestMode?: boolean) {
    const safeTestMode = Boolean(isTestMode);
    const loansTable = safeTestMode ? 'employee_loans_test' : 'employee_loans';
    const paymentsTable = safeTestMode ? 'loan_payments_test' : 'loan_payments';

    const [emps, loansRes, paymentsRes] = await Promise.all([
      fetchEmployees(safeTestMode),
      supabase.from(loansTable).select('id, employee_id, amount, installments, request_date, notes'),
      supabase.from(paymentsTable).select('contract_id, status, amount, due_date, id'),
    ]);

    if (loansRes.error) throw new Error('Falha ao buscar contratos: ' + loansRes.error.message);

    const empMap = new Map(emps.map(e => [e.id, e.full_name]));
    const payments = paymentsRes.data || [];

    const payMap = new Map();
    payments.forEach(p => {
      const arr = payMap.get(p.contract_id) || [];
      arr.push({ id: p.id, status: p.status, amount: Number(p.amount) || 0, due_date: p.due_date });
      payMap.set(p.contract_id, arr);
    });

    return (loansRes.data || []).map(ln => {
      const contractPayments = payMap.get(ln.id) || [];
      const expectedInstallments = Number(ln.installments) || 0;
      const paidCount = contractPayments.filter((p: { status: string }) => p.status === 'PAGO').length;
      const pendingCount = contractPayments.filter((p: { status: string }) => p.status === 'PENDENTE').length;
      const totalRecorded = contractPayments.length;

      const hasExcess = paidCount > expectedInstallments;
      const missingRecords = totalRecorded < expectedInstallments;
      const health: 'ok' | 'revisar' | 'excesso' = hasExcess ? 'excesso' : missingRecords ? 'revisar' : 'ok';

      return {
        contractId: ln.id,
        employeeName: empMap.get(ln.employee_id) || 'Desconhecido',
        amount: Number(ln.amount) || 0,
        expectedInstallments,
        totalRecorded,
        paidCount,
        pendingCount,
        health,
        excess: Math.max(0, paidCount - expectedInstallments),
        requestDate: ln.request_date || null,
        payments: contractPayments,
      };
    });
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function formatDate(date: string): string {
  if (!date || date === '-') return '-';
  try {
    const clean = date.split('T')[0];
    const [y, m, d] = clean.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return '-';
  }
}

// --- Audit Types ---

export interface AuditContractReport {
  contractId: string;
  employeeName: string;
  amount: number;
  expectedInstallments: number;
  totalRecorded: number;
  paidCount: number;
  pendingCount: number;
  health: 'ok' | 'revisar' | 'excesso';
  excess: number;
  requestDate: string | null;
  payments: { id: string; status: string; amount: number; due_date: string }[];
}
