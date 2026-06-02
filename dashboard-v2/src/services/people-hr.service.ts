import { supabase } from '@/lib/supabase';
import { Employee, EmploymentBond, MonthlyCost } from '@/types/loans';

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
};
