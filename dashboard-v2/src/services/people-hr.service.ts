import { supabase } from '@/lib/supabase';
import { Employee, EmploymentBond, MonthlyCost, AuditIssue } from '@/types/loans';

export const PeopleHRService = {
  async getEmploymentBonds(employeeId: string): Promise<EmploymentBond[]> {
    const { data, error } = await supabase
      .from('people_employment_bonds')
      .select('*')
      .eq('employee_id', employeeId)
      .order('start_date', { ascending: true });
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
    return data || [];
  },

  async getAllMonthlyCosts(limit = 2000): Promise<MonthlyCost[]> {
    const { data, error } = await supabase
      .from('people_monthly_costs')
      .select('*')
      .order('competencia', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  computeCostStats(costs: MonthlyCost[]) {
    if (!costs.length) return null;
    const values = costs.map(c => c.valor_liquido).filter(v => v > 0);
    if (!values.length) return null;
    return {
      total: values.reduce((a, b) => a + b, 0),
      average: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  },

  async getEmployeesForPeople(filters?: {
    empresa?: string;
    status?: string;
    vinculo?: string;
    setor?: string;
    search?: string;
    mostrarInativos?: boolean;
  }): Promise<Employee[]> {
    let query = supabase
      .from('employees')
      .select('*')
      .order('name', { ascending: true });

    if (!filters?.mostrarInativos) {
      query = query.neq('status', 'Inativo');
    }
    if (filters?.empresa) query = query.eq('company', filters.empresa);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.vinculo) query = query.eq('link_type', filters.vinculo);
    if (filters?.setor) query = query.ilike('department', `%${filters.setor}%`);
    if (filters?.search) query = query.ilike('name', `%${filters.search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Employee[];
  },

  async deleteEmployee(employeeId: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId);
    if (error) throw error;
  },

  computeTenure(bonds: EmploymentBond[], startDate?: string): string {
    const dates = bonds.map(b => new Date(b.start_date));
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

  auditEmployee(employeeId: string, bonds: EmploymentBond[], costs: MonthlyCost[], startDate?: string): AuditIssue[] {
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

    for (const cost of costs) {
      const costVal = new Date(cost.competencia + 'T00:00:00').getTime();
      
      // 1. Date before admission
      if (costVal < startVal) {
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

      // 2. Regime mismatch: Check which EmploymentBond was active during cost.competencia
      const costDate = new Date(cost.competencia + 'T00:00:00');
      const activeBond = bonds.find(bond => {
        const bondStart = new Date(bond.start_date + 'T00:00:00');
        const bondEnd = bond.end_date ? new Date(bond.end_date + 'T00:00:00') : null;
        return bondStart <= costDate && (bondEnd === null || bondEnd >= costDate);
      });

      if (activeBond) {
        const costIsPJ = cost.vinculo_tipo === 'MEI';
        const bondIsPJ = activeBond.vinculo === 'MEI' || activeBond.vinculo === 'PJ';
        
        if (costIsPJ !== bondIsPJ) {
          issues.push({
            id: `${cost.id}-mismatch`,
            employee_id: employeeId,
            type: 'regime_mismatch',
            severity: 'warning',
            message: `Custo lançado como ${cost.vinculo_tipo} em ${formatMonthCompetencia(cost.competencia)}, mas o regime ativo no período era ${activeBond.vinculo}.`,
            details: {
              costId: cost.id,
              competencia: cost.competencia,
              vinculo: cost.vinculo_tipo,
              regimeAtivo: activeBond.vinculo
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

    // 2. Fetch all bonds
    const { data: bonds, error: errBonds } = await supabase
      .from('people_employment_bonds')
      .select('*');
    if (errBonds) throw errBonds;

    // 3. Fetch all monthly costs
    const { data: costs, error: errCosts } = await supabase
      .from('people_monthly_costs')
      .select('*');
    if (errCosts) throw errCosts;

    const result: Record<string, AuditIssue[]> = {};

    // Group bonds and costs by employee_id
    const bondsMap = (bonds || []).reduce((acc: Record<string, EmploymentBond[]>, b: EmploymentBond) => {
      if (!acc[b.employee_id]) acc[b.employee_id] = [];
      acc[b.employee_id].push(b);
      return acc;
    }, {});

    const costsMap = (costs || []).reduce((acc: Record<string, MonthlyCost[]>, c: MonthlyCost) => {
      if (!acc[c.employee_id]) acc[c.employee_id] = [];
      acc[c.employee_id].push(c);
      return acc;
    }, {});

    for (const emp of emps || []) {
      const empBonds = bondsMap[emp.id] || [];
      const empCosts = costsMap[emp.id] || [];
      const issues = this.auditEmployee(emp.id, empBonds, empCosts, emp.start_date || undefined);
      if (issues.length > 0) {
        result[emp.id] = issues;
      }
    }

    return result;
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
