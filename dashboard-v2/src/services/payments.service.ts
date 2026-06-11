import { supabase } from "@/lib/supabase";

export interface LoanPayment {
  id: string;
  contract_id: string;
  employee_id: string;
  month_cycle: string;
  due_date: string;
  paid_date?: string;
  amount: number;
  status: 'PENDENTE' | 'PAGO' | 'POSTERGADO';
  postponed_to?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentBatchRequest {
  payment_ids: string[];
  action: 'PAGO' | 'POSTERGADO';
  postponed_date?: string;
}

function addMonths(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1 + months, day, 12, 0, 0);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export class PaymentsService {
  /**
   * Gera automaticamente as parcelas para um contrato via TypeScript cliente
   */
  static async generateInstallments(contractId: string, isTestMode?: boolean): Promise<void> {
    const table = isTestMode ? 'employee_loans_test' : 'employee_loans';
    const paymentsTable = isTestMode ? 'loan_payments_test' : 'loan_payments';
    
    // Busca os dados do contrato
    const { data: contract, error: fetchErr } = await supabase
      .from(table)
      .select('id, employee_id, amount, installments, start_cycle, first_payment_date')
      .eq('id', contractId)
      .single();
      
    if (fetchErr || !contract) {
      console.error('Erro ao buscar contrato para gerar parcelas:', fetchErr);
      throw new Error(`Falha ao buscar contrato: ${fetchErr?.message}`);
    }
    
    const amount = parseFloat(String(contract.amount)) || 0;
    const installments = parseInt(String(contract.installments)) || 0;
    if (amount <= 0 || installments <= 0) return;
    
    const installmentValue = amount / installments;
    
    // Determina a data do primeiro pagamento
    let firstPaymentDateStr: string;
    if (contract.first_payment_date) {
      firstPaymentDateStr = contract.first_payment_date;
    } else {
      // Fallback: ciclo + 1 mes, no dia 10
      const [y, m] = contract.start_cycle.split('-').map(Number);
      const firstPaymentDate = new Date(y, m, 10); // m ja vira mes seguinte porque o construtor Date e 0-indexed
      firstPaymentDateStr = firstPaymentDate.toISOString().split('T')[0];
    }
    
    const paymentsToInsert = [];
    for (let i = 0; i < installments; i++) {
      const due = addMonths(firstPaymentDateStr, i);
      const cycle = due.substring(0, 7); // YYYY-MM
      
      paymentsToInsert.push({
        contract_id: contractId,
        employee_id: contract.employee_id,
        month_cycle: cycle,
        due_date: due,
        amount: installmentValue,
        status: 'PENDENTE'
      });
    }
    
    const { error: insertErr } = await supabase
      .from(paymentsTable)
      .insert(paymentsToInsert);
      
    if (insertErr) {
      console.error('Erro ao inserir parcelas via TS:', insertErr);
      throw new Error(`Falha ao gerar parcelas no banco: ${insertErr.message}`);
    }
  }

  /**
   * Busca parcelas pendentes de um funcionário
   */
  static async getPendingPayments(employeeId: string, monthCycle?: string, isTestMode?: boolean): Promise<LoanPayment[]> {
    const table = isTestMode ? 'loan_payments_test' : 'loan_payments';
    let query = supabase
      .from(table)
      .select('*')
      .eq('employee_id', employeeId)
      .eq('status', 'PENDENTE');

    if (monthCycle) {
      query = query.eq('month_cycle', monthCycle);
    }

    const { data, error } = await query.order('due_date', { ascending: true });

    if (error) {
      if (isTestMode && error.code === '42P01') return [];
      console.error('Erro ao buscar parcelas:', error);
      throw new Error('Falha ao carregar parcelas');
    }

    return data || [];
  }

  /**
   * Busca todas as parcelas de um contrato
   */
  static async getContractPayments(contractId: string, isTestMode?: boolean): Promise<LoanPayment[]> {
    const table = isTestMode ? 'loan_payments_test' : 'loan_payments';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('contract_id', contractId)
      .order('due_date', { ascending: true });

    if (error) {
      if (isTestMode && error.code === '42P01') return [];
      console.error('Erro ao buscar parcelas do contrato:', error);
      throw new Error('Falha ao carregar parcelas');
    }

    return data || [];
  }

  /**
   * Atualiza status de uma parcela
   */
  static async updatePaymentStatus(
    paymentId: string, 
    status: 'PAGO' | 'POSTERGADO',
    isTestMode?: boolean,
    postponedDate?: string,
    paidDate?: string
  ): Promise<void> {
    const table = isTestMode ? 'loan_payments_test' : 'loan_payments';
    const updates: Partial<LoanPayment> = { status };
    
    if (status === 'PAGO') {
      updates.paid_date = paidDate || new Date().toISOString().split('T')[0];
    } else if (status === 'POSTERGADO' && postponedDate) {
      updates.postponed_to = postponedDate;
    }

    const { error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', paymentId);

    if (error) {
      console.error('Erro ao atualizar parcela:', error);
      throw new Error('Falha ao atualizar parcela');
    }
  }

  /**
   * Processa múltiplas parcelas em lote
   */
  static async processBatch(request: PaymentBatchRequest, isTestMode?: boolean): Promise<void> {
    const { payment_ids, action, postponed_date } = request;
    const table = isTestMode ? 'loan_payments_test' : 'loan_payments';

    if (action === 'POSTERGADO' && !postponed_date) {
      throw new Error('Data de postergação é obrigatória');
    }

    const updates: Partial<LoanPayment> = { status: action };
    
    if (action === 'PAGO') {
      updates.paid_date = new Date().toISOString().split('T')[0];
    } else if (action === 'POSTERGADO' && postponed_date) {
      updates.postponed_to = postponed_date;
    }

    const { error } = await supabase
      .from(table)
      .update(updates)
      .in('id', payment_ids);

    if (error) {
      console.error('Erro no processamento em lote:', error);
      throw new Error('Falha ao processar parcelas');
    }
  }

  /**
   * Busca parcelas por mês (para processamento mensal)
   */
  static async getPaymentsByMonth(monthCycle: string, isTestMode?: boolean): Promise<LoanPayment[]> {
    const table = isTestMode ? 'loan_payments_test' : 'loan_payments';
    const empsTable = isTestMode ? 'employees_test' : 'employees';

    const { data, error } = await supabase
      .from(table)
      .select(`
        *,
        employee: ${empsTable}!employee_id (
          full_name
        )
      `)
      .eq('month_cycle', monthCycle);

    if (error) {
      console.error('Erro ao buscar parcelas do mês:', error);
      throw new Error('Falha ao carregar parcelas do mês');
    }

    // Tradução para o formato esperado pela UI do Modal
    return (data || []).map(item => ({
      ...item,
      contracts: {
        employee_name: (item as any).employee?.full_name || 'Desconhecido',
        operation_number: (item as any).contract_id?.slice(0, 8) || '---'
      }
    })) as LoanPayment[];
  }

  /**
   * Estatísticas de pagamentos do mês
   */
  static async getMonthStats(monthCycle: string, isTestMode?: boolean) {
    const table = isTestMode ? 'loan_payments_test' : 'loan_payments';
    const { data, error } = await supabase
      .from(table)
      .select('status, amount')
      .eq('month_cycle', monthCycle);

    if (error) {
      if (isTestMode && error.code === '42P01') return { total: 0, pending: 0, paid: 0, postponed: 0, pendingAmount: 0, paidAmount: 0, postponedAmount: 0 };
      console.error('Erro ao buscar estatísticas:', error);
      throw new Error('Falha ao carregar estatísticas');
    }

    const stats = {
      total: 0,
      pending: 0,
      paid: 0,
      postponed: 0,
      pendingAmount: 0,
      paidAmount: 0,
      postponedAmount: 0
    };

    data?.forEach(p => {
      stats.total++;
      if (p.status === 'PENDENTE') {
        stats.pending++;
        stats.pendingAmount += Number(p.amount);
      } else if (p.status === 'PAGO') {
        stats.paid++;
        stats.paidAmount += Number(p.amount);
      } else if (p.status === 'POSTERGADO') {
        stats.postponed++;
        stats.postponedAmount += Number(p.amount);
      }
    });

    return stats;
  }
}
