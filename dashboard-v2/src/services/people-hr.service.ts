import { supabase } from '@/lib/supabase';
import { Employee, EmploymentContract, ContractAllocation, EmployeeEvent, MonthlyCost, AuditIssue } from '@/types/loans';
import { LoansService } from './loans.service';

interface RawEmployeeDb {
  id: string;
  full_name: string;
  company?: string;
  employment_type?: string;
  remuneration?: number;
  loan_amount?: number;
  status?: string;
  pj_type?: string;
  corporate_name?: string;
  document_id?: string;
  document_rg?: string;
  phone?: string;
  email?: string;
  phone_professional?: string;
  email_professional?: string;
  pix_key?: string;
  zip_code?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  department?: string;
  job_role?: string;
  metadata?: any;
  start_date?: string;
  status_start_date?: string;
  status_end_date?: string;
  linkedin_url?: string;
  instagram_url?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  photo_url?: string;
  remuneration_fixed?: number;
  remuneration_bonus?: number;
  remuneration_commission?: number;
  contract_expiry_date?: string;
  links_aditivos?: string;
  is_outsourced?: boolean;
  service_location?: string;
  tax_regime?: string;
  cnpj_zip_code?: string;
  cnpj_street?: string;
  cnpj_number?: string;
  cnpj_complement?: string;
  cnpj_neighborhood?: string;
  cnpj_city?: string;
  cnpj_state?: string;
  executive_summary?: string;
  executive_link?: string;
  commission_plan?: string;
  remuneration_connectivity?: number;
  remuneration_incentives?: number;
  nivel?: string;
  responsible_name?: string;
  responsible_cpf?: string;
  responsible_rg?: string;
}

export const PeopleHRService = {
  async getEmploymentContracts(employeeId: string): Promise<EmploymentContract[]> {
    const { data, error } = await supabase
      .from('employment_contracts')
      .select('*')
      .eq('employee_id', employeeId)
      .order('start_date', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async insertEmploymentContract(contract: any): Promise<any> {
    const { data, error } = await supabase
      .from('employment_contracts')
      .insert([contract])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateEmploymentContract(id: string, updates: any): Promise<void> {
    const { error } = await supabase
      .from('employment_contracts')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  async deleteEmploymentContract(id: string): Promise<void> {
    const { error } = await supabase
      .from('employment_contracts')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getContractAllocations(contractId: string): Promise<ContractAllocation[]> {
    const { data, error } = await supabase
      .from('contract_allocations')
      .select('*')
      .eq('contract_id', contractId)
      .order('start_date', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getEmployeeEvents(employeeId: string): Promise<EmployeeEvent[]> {
    const { data, error } = await supabase
      .from('employee_events')
      .select('*')
      .eq('employee_id', employeeId)
      .order('event_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getMonthlyCosts(employeeId: string, limit = 24): Promise<MonthlyCost[]> {
    const { data, error } = await supabase
      .from('people_monthly_costs')
      .select('*')
      .eq('employee_id', employeeId)
      .order('competencia', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(row => ({
      ...row,
      ...(row.verbas_adicionais || {})
    }));
  },

  async getAllMonthlyCosts(limit = 2000): Promise<MonthlyCost[]> {
    const { data, error } = await supabase
      .from('people_monthly_costs')
      .select('*')
      .order('competencia', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(row => ({
      ...row,
      ...(row.verbas_adicionais || {})
    }));
  },

  computeCostStats(costs: MonthlyCost[]) {
    if (!costs.length) return null;
    const values = costs.map(c => c.valor_liquido).filter(v => v > 0);
    if (!values.length) return null;
    
    const fixedTotal = costs.reduce((sum, c) => {
      const fixed = (c.valor_fixo !== undefined && c.valor_fixo !== null) 
        ? c.valor_fixo 
        : (c.valor_liquido - ((c.valor_bonus || 0) + (c.valor_comissao || 0)));
      return sum + fixed;
    }, 0);
    const bonusTotal = costs.reduce((sum, c) => sum + (c.valor_bonus || 0), 0);
    const commissionTotal = costs.reduce((sum, c) => sum + (c.valor_comissao || 0), 0);
    const incentivosTotal = costs.reduce((sum, c) => sum + (c.valor_incentivos || 0), 0);
    const conectividadeTotal = costs.reduce((sum, c) => sum + (c.valor_ajuda_custo || 0), 0);
    const glosaBaseTotal = costs.reduce((sum, c) => sum + (c.valor_glosa_base || 0), 0);
    const glosaBonusTotal = costs.reduce((sum, c) => sum + (c.valor_glosa_bonus || 0), 0);
    const deducoesTotal = costs.reduce((sum, c) => sum + (c.valor_deducoes || 0), 0);

    // Campos CLT
    const horaExtraTotal = costs.reduce((sum, c) => sum + (c.valor_hora_extra || 0), 0);
    const adicionalNotTotal = costs.reduce((sum, c) => sum + (c.valor_adicional_not || 0), 0);
    const adiantamentoTotal = costs.reduce((sum, c) => sum + (c.valor_adiantamento || 0), 0);
    const vrTotal = costs.reduce((sum, c) => sum + (c.valor_vr || 0), 0);
    const vtTotal = costs.reduce((sum, c) => sum + (c.valor_vt || 0), 0);
    const cestaTotal = costs.reduce((sum, c) => sum + (c.valor_cesta || 0), 0);
    const ajudaCustoTotal = costs.reduce((sum, c) => sum + (c.valor_ajuda_custo || 0), 0);
    const beneficiosTotal = costs.reduce((sum, c) => sum + (c.valor_vr || 0) + (c.valor_vt || 0) + (c.valor_cesta || 0) + (c.valor_ajuda_custo || 0), 0);
    const decimoTerceiroTotal = costs.reduce((sum, c) => sum + (c.valor_decimo_terceiro || 0), 0);
    const feriasTotal = costs.reduce((sum, c) => sum + (c.valor_ferias || 0), 0);
    const rescisaoTotal = costs.reduce((sum, c) => sum + (c.valor_rescisao || 0), 0);
    const descontosTotal = costs.reduce((sum, c) => sum + (c.valor_descontos || 0), 0);
    const faltasTotal = costs.reduce((sum, c) => sum + (c.valor_faltas || 0), 0);
    const diasFaltasTotal = costs.reduce((sum, c) => sum + (c.dias_faltas || 0), 0);
    const consignadoTotal = costs.reduce((sum, c) => sum + (c.valor_consignado || 0), 0);
    const bancoHorasTotal = costs.reduce((sum, c) => sum + (c.banco_horas || 0), 0);

    const count = costs.length;

    // Se for CLT, somamos o líquido ao adiantamento para computar o custo real total gasto com o funcionário
    const totalDesembolsado = costs.reduce((sum, c) => {
      const isCLT = c.vinculo_tipo === 'CLT';
      const liquidoReal = c.valor_liquido + (isCLT ? (c.valor_adiantamento || 0) : 0);
      return sum + liquidoReal;
    }, 0);

    return {
      total: totalDesembolsado,
      average: totalDesembolsado / count,
      min: Math.min(...costs.map(c => c.valor_liquido + (c.vinculo_tipo === 'CLT' ? (c.valor_adiantamento || 0) : 0))),
      max: Math.max(...costs.map(c => c.valor_liquido + (c.vinculo_tipo === 'CLT' ? (c.valor_adiantamento || 0) : 0))),
      count,
      fixedTotal,
      bonusTotal,
      commissionTotal,
      incentivosTotal,
      conectividadeTotal,
      glosaBaseTotal,
      glosaBonusTotal,
      deducoesTotal,
      // CLT fields
      horaExtraTotal,
      adicionalNotTotal,
      adiantamentoTotal,
      vrTotal,
      vtTotal,
      cestaTotal,
      ajudaCustoTotal,
      beneficiosTotal,
      decimoTerceiroTotal,
      feriasTotal,
      rescisaoTotal,
      descontosTotal,
      faltasTotal,
      diasFaltasTotal,
      consignadoTotal,
      bancoHorasTotal,
      // averages:
      fixedAverage: fixedTotal / count,
      bonusAverage: bonusTotal / count,
      commissionAverage: commissionTotal / count,
      incentivosAverage: incentivosTotal / count,
      conectividadeAverage: conectividadeTotal / count,
      horaExtraAverage: horaExtraTotal / count,
      adicionalNotAverage: adicionalNotTotal / count,
      adiantamentoAverage: adiantamentoTotal / count,
      beneficiosAverage: beneficiosTotal / count,
      faltasAverage: faltasTotal / count,
      diasFaltasAverage: diasFaltasTotal / count,
      consignadoAverage: consignadoTotal / count,
      bancoHorasAverage: bancoHorasTotal / count,
      totalAverage: totalDesembolsado / count,
      history: costs.map(c => c.valor_liquido + (c.vinculo_tipo === 'CLT' ? (c.valor_adiantamento || 0) : 0))
    };
  },

  async getEmployeesForPeople(filters?: {
    empresa?: string;
    status?: string;
    vinculo?: string;
    setor?: string;
    search?: string;
    mostrarInativos?: boolean;
    isTestMode?: boolean;
  }): Promise<Employee[]> {
    const table = filters?.isTestMode ? 'employees_test' : 'employees';
    let query = supabase
      .from(table)
      .select('*')
      .order('full_name', { ascending: true });

    if (!filters?.mostrarInativos) {
      query = query.neq('status', 'Inativo');
    }
    if (filters?.empresa) query = query.eq('company', filters.empresa);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.vinculo) query = query.eq('employment_type', filters.vinculo);
    if (filters?.setor) query = query.ilike('department', `%${filters.setor}%`);
    if (filters?.search) query = query.ilike('full_name', `%${filters.search}%`);

    const { data, error } = await query;
    if (error) throw error;

    const loansData = await LoansService.getEmployees({ showAll: true }, filters?.isTestMode);
    const loansMap = new Map(loansData.map(e => [e.id, e]));

    return (data || []).map((emp: RawEmployeeDb) => {
      const aditivos = emp.links_aditivos ? emp.links_aditivos.split('\n').filter(Boolean) : [];
      const l = loansMap.get(emp.id);
      
      const employee = {
        id: emp.id,
        name: emp.full_name,
        company: emp.company || 'MarBR',
        linkType: emp.employment_type || undefined,
        remuneration: parseFloat(String(emp.remuneration)) || 0,
        totalTaken: l ? l.totalTaken : (parseFloat(String(emp.loan_amount)) || 0),
        totalReceived: l ? l.totalReceived : 0,
        balance: l ? l.balance : (parseFloat(String(emp.loan_amount)) || 0),
        monthInstallment: l ? l.monthInstallment : 0,
        contractsCount: l ? l.contractsCount : 0,
        status: emp.status || 'Ativo',
        pj_type: emp.pj_type,
        corporate_name: emp.corporate_name,
        document_id: emp.document_id,
        document_rg: emp.document_rg,
        phone: emp.phone,
        email: emp.email,
        phone_professional: emp.phone_professional,
        email_professional: emp.email_professional,
        pix_key: emp.pix_key,
        zip_code: emp.zip_code,
        street: emp.street,
        number: emp.number,
        complement: emp.complement,
        neighborhood: emp.neighborhood,
        city: emp.city,
        state: emp.state,
        department: emp.department,
        job_role: emp.job_role,
        start_date: emp.start_date,
        status_start_date: emp.status_start_date,
        status_end_date: emp.status_end_date,
        linkedin_url: emp.linkedin_url,
        instagram_url: emp.instagram_url,
        emergency_contact_name: emp.emergency_contact_name,
        emergency_contact_phone: emp.emergency_contact_phone,
        emergency_contact_relation: emp.emergency_contact_relation,
        avatar: emp.photo_url,
        responsible_name: emp.responsible_name,
        responsible_cpf: emp.responsible_cpf,
        responsible_rg: emp.responsible_rg,
        remuneration_fixed: emp.remuneration_fixed ? parseFloat(String(emp.remuneration_fixed)) : 0,
        remuneration_bonus: emp.remuneration_bonus ? parseFloat(String(emp.remuneration_bonus)) : 0,
        remuneration_commission: emp.remuneration_commission ? parseFloat(String(emp.remuneration_commission)) : 0,
        remuneration_connectivity: emp.remuneration_connectivity ? parseFloat(String(emp.remuneration_connectivity)) : (emp.metadata?.remuneration_connectivity ? parseFloat(String(emp.metadata.remuneration_connectivity)) : 0),
        remuneration_incentives: emp.remuneration_incentives ? parseFloat(String(emp.remuneration_incentives)) : (emp.metadata?.remuneration_incentives ? parseFloat(String(emp.metadata.remuneration_incentives)) : 0),
        contract_expiry_date: emp.contract_expiry_date,
        aditivoCount: aditivos.length,
        is_outsourced: emp.is_outsourced,
        service_location: emp.service_location,
        tax_regime: emp.tax_regime,
        cnpj_zip_code: emp.cnpj_zip_code,
        cnpj_street: emp.cnpj_street,
        cnpj_number: emp.cnpj_number,
        cnpj_complement: emp.cnpj_complement,
        cnpj_neighborhood: emp.cnpj_neighborhood,
        cnpj_city: emp.cnpj_city,
        cnpj_state: emp.cnpj_state,
        executive_summary: emp.executive_summary,
        executive_link: emp.executive_link,
        commission_plan: emp.commission_plan,
        has_invoice_glosa: emp.metadata?.has_invoice_glosa || false,
        last_raise_date: emp.metadata?.last_raise_date || null,
        grau: emp.metadata?.grau || '',
        nivel: emp.nivel,
        pbId: emp.metadata?.pbId || emp.metadata?.pb_id || '',
        entityType: emp.metadata?.entityType || emp.metadata?.entity_type || undefined,
        relationshipNature: emp.metadata?.relationshipNature || emp.metadata?.relationship_nature || 
          (emp.employment_type === 'PJ' || emp.employment_type === 'MEI' ? 'pj_specialized' : (emp.employment_type ? 'clt_internal' : undefined)),
        relationships: Array.isArray(emp.metadata?.relationships) ? emp.metadata.relationships : [],
        aiAgents: Array.isArray(emp.metadata?.aiAgents || emp.metadata?.ai_agents) ? (emp.metadata.aiAgents || emp.metadata.ai_agents) : [],
        permissions: Array.isArray(emp.metadata?.permissions) ? emp.metadata.permissions : [],
        temporaryDelegations: Array.isArray(emp.metadata?.temporaryDelegations || emp.metadata?.temporary_delegations) ? (emp.metadata.temporaryDelegations || emp.metadata.temporary_delegations) : [],
        metadata: emp.metadata || {}
      };
      
      if (employee.status === 'Ativo' && employee.status_end_date) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (employee.status_end_date <= todayStr) {
          employee.status = 'Inativo';
        }
      }
      
      return employee;
    }) as Employee[];
  },

  async deleteEmployee(employeeId: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId);
    if (error) throw error;
  },

  computeTenure(contracts: EmploymentContract[], startDate?: string): string {
    const dates = contracts.map(c => new Date(c.start_date));
    if (startDate) dates.push(new Date(startDate));
    if (!dates.length) return '—';
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const now = new Date();
    const months =
      (now.getFullYear() - earliest.getFullYear()) * 12 +
      (now.getMonth() - earliest.getMonth());
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) return `${remainingMonths}m`;
    if (remainingMonths === 0) return `${years}a`;
    return `${years}a ${remainingMonths}m`;
  },

  auditEmployee(employeeId: string, contracts: EmploymentContract[], costs: MonthlyCost[], startDate?: string): AuditIssue[] {
    const issues: AuditIssue[] = [];
    
    if (costs.length > 0 && !startDate) {
      issues.push({
        id: `${employeeId}-missing-start`,
        employee_id: employeeId,
        type: 'missing_start_date',
        severity: 'error',
        message: 'Data de admissão original não informada.',
      });
      return issues;
    }

    if (!startDate) return issues;

    // Helper functions for date formatting
    const formatMonthCompetencia = (dateStr: string) => {
      const parts = dateStr.split('-');
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      return `${months[monthIdx]}/${parts[0]}`;
    };

    const formatDateBR = (dateStr: string) => {
      const parts = dateStr.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const startVal = new Date(startDate + 'T00:00:00').getTime();
    const startDateObj = new Date(startDate + 'T00:00:00');

    for (const cost of costs) {
      const costVal = new Date(cost.competencia + 'T00:00:00').getTime();
      const costDateObj = new Date(cost.competencia + 'T00:00:00');
      
      const isSameMonth = startDateObj.getFullYear() === costDateObj.getFullYear() && startDateObj.getMonth() === costDateObj.getMonth();
      
      // 1. Date before admission (only if not in the same month)
      if (costVal < startVal && !isSameMonth) {
        issues.push({
          id: cost.id,
          employee_id: employeeId,
          type: 'date_before_admission',
          severity: 'error',
          message: `Custo em ${formatMonthCompetencia(cost.competencia)} é anterior à data de admissão (${formatDateBR(startDate)}).`,
          details: {
            costId: cost.id,
            competencia: cost.competencia,
            admissionDate: startDate,
            vinculo: cost.vinculo_tipo
          }
        });
      }

      // 2. Regime mismatch: Check which EmploymentContract was active during cost.competencia
      const costDate = new Date(cost.competencia + 'T00:00:00');
      const activeContract = contracts.find(contract => {
        const contractStart = new Date(contract.start_date + 'T00:00:00');
        const contractEnd = contract.end_date ? new Date(contract.end_date + 'T00:00:00') : null;
        return contractStart <= costDate && (contractEnd === null || contractEnd >= costDate);
      });

      if (activeContract) {
        const costIsPJ = cost.vinculo_tipo === 'MEI';
        const contractIsPJ = activeContract.regime === 'MEI' || activeContract.regime === 'PJ';
        
        if (costIsPJ !== contractIsPJ) {
          issues.push({
            id: `${cost.id}-mismatch`,
            employee_id: employeeId,
            type: 'regime_mismatch',
            severity: 'warning',
            message: `Custo lançado como ${cost.vinculo_tipo} em ${formatMonthCompetencia(cost.competencia)}, mas o regime ativo no período era ${activeContract.regime}.`,
            details: {
              costId: cost.id,
              competencia: cost.competencia,
              vinculo: cost.vinculo_tipo,
              regimeAtivo: activeContract.regime
            }
          });
        }
      }
    }

    return issues;
  },

  async getAuditInconsistencies(): Promise<Record<string, AuditIssue[]>> {
    // 1. Fetch all employees
    const { data: emps, error: errEmps } = await supabase
      .from('employees')
      .select('id, start_date');
    if (errEmps) throw errEmps;

    // 2. Fetch all contracts
    const { data: contracts, error: errContracts } = await supabase
      .from('employment_contracts')
      .select('*');
    if (errContracts) throw errContracts;

    // 3. Fetch all monthly costs
    const { data: costs, error: errCosts } = await supabase
      .from('people_monthly_costs')
      .select('*');
    if (errCosts) throw errCosts;

    const result: Record<string, AuditIssue[]> = {};

    // Group contracts and costs by employee_id
    const contractsMap = (contracts || []).reduce((acc: Record<string, EmploymentContract[]>, c: EmploymentContract) => {
      if (!acc[c.employee_id]) acc[c.employee_id] = [];
      acc[c.employee_id].push(c);
      return acc;
    }, {});

    const costsMap = (costs || []).reduce((acc: Record<string, MonthlyCost[]>, c: MonthlyCost) => {
      if (!acc[c.employee_id]) acc[c.employee_id] = [];
      acc[c.employee_id].push(c);
      return acc;
    }, {});

    for (const emp of emps || []) {
      const empContracts = contractsMap[emp.id] || [];
      const empCosts = costsMap[emp.id] || [];
      const issues = this.auditEmployee(emp.id, empContracts, empCosts, emp.start_date || undefined);
      if (issues.length > 0) {
        result[emp.id] = issues;
      }
    }

    return result;
  },

  sanitizeMonthlyCostPayload(payload: Partial<MonthlyCost>): Record<string, any> {
    const knownColumns = new Set([
      'id', 'employee_id', 'competencia', 'vinculo_tipo',
      'valor_holerite', 'valor_adiantamento', 'valor_hora_extra', 'valor_adicional_not',
      'valor_vr', 'valor_vt', 'valor_ajuda_custo', 'valor_cesta',
      'valor_ferias', 'valor_rescisao', 'valor_decimo_terceiro', 'valor_descontos',
      'valor_liquido', 'origem', 'observacao', 'created_at',
      'valor_fixo', 'valor_bonus', 'valor_comissao', 'valor_incentivos',
      'valor_glosa_base', 'valor_glosa_bonus', 'valor_deducoes', 'valor_faltas',
      'valor_consignado', 'banco_horas', 'dias_faltas', 'verbas_adicionais'
    ]);

    const sanitized: Record<string, any> = {};
    const verbasAdicionaisObj: Record<string, any> = { ...(payload.verbas_adicionais || {}) };

    Object.entries(payload).forEach(([key, val]) => {
      if (val === undefined) return;
      if (knownColumns.has(key)) {
        sanitized[key] = val;
      } else {
        // Campos estendidos (valor_fgts, inss_empregado, irrf_empregado, salario_familia)
        verbasAdicionaisObj[key] = val;
      }
    });

    if (Object.keys(verbasAdicionaisObj).length > 0) {
      sanitized.verbas_adicionais = verbasAdicionaisObj;
    }

    return sanitized;
  },

  async insertMonthlyCost(payload: Partial<MonthlyCost>): Promise<MonthlyCost> {
    const cleanPayload = this.sanitizeMonthlyCostPayload(payload);
    const { data, error } = await supabase
      .from('people_monthly_costs')
      .insert([cleanPayload])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async upsertMonthlyCost(payload: Partial<MonthlyCost>): Promise<MonthlyCost> {
    const cleanPayload = this.sanitizeMonthlyCostPayload(payload);

    if (cleanPayload.employee_id && cleanPayload.competencia) {
      const { data: existing } = await supabase
        .from('people_monthly_costs')
        .select('id')
        .eq('employee_id', cleanPayload.employee_id)
        .eq('competencia', cleanPayload.competencia)
        .maybeSingle();

      if (existing?.id) {
        const { data, error } = await supabase
          .from('people_monthly_costs')
          .update(cleanPayload)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    }

    return this.insertMonthlyCost(payload);
  },

  async updateMonthlyCost(costId: string, payload: Partial<MonthlyCost>): Promise<void> {
    const { error } = await supabase
      .from('people_monthly_costs')
      .update(payload)
      .eq('id', costId);
    if (error) throw error;
  },

  async deleteMonthlyCost(costId: string): Promise<void> {
    const { error } = await supabase
      .from('people_monthly_costs')
      .delete()
      .eq('id', costId);
    if (error) throw error;
  },
};
