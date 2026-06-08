"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ProfileDrawer } from "@/components/people/ProfileDrawer";
import { PeopleKpiCard } from "@/components/people/PeopleKpiCard";
import { DeleteConfirmDialog } from "@/components/people/DeleteConfirmDialog";
import { PeopleTable } from "@/components/people/PeopleTable";
import { KPIStatsDrawer } from "@/components/people/KPIStatsDrawer";
import { PeopleHRService } from "@/services/people-hr.service";
import { Employee, MonthlyCost, AuditIssue, LoanStats } from "@/types/loans";
import { useDataMode } from "@/contexts/DataModeContext";
import { APP_VERSION } from "@/version";
import { LoansService, formatCurrency } from "@/services/loans.service";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, AlertCircle, Users, Eye, EyeOff, Search, Filter, X, 
  UserCog, Plus, HandCoins, Coins, TrendingUp, Landmark, Target
} from "lucide-react";

// Custom MultiSelect Dropdown Component
const MultiSelectDropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder 
}: { 
  options: { label: string; value: string }[], 
  value: string[], 
  onChange: (val: string[]) => void, 
  placeholder: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <div 
        className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 cursor-pointer text-white flex justify-between items-center transition-all hover:bg-slate-700"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate text-slate-300">
          {value.length === 0 ? placeholder : `${value.length} selecionado(s)`}
        </span>
        <span className="text-[10px] text-slate-500">▼</span>
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-600">
            {options.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 px-2 py-2 hover:bg-slate-700 rounded-lg cursor-pointer text-xs text-slate-200 transition-colors">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20 w-3.5 h-3.5"
                  checked={value.includes(opt.value)}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...value, opt.value]);
                    else onChange(value.filter(v => v !== opt.value));
                  }}
                />
                <span className="truncate">{opt.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default function PeoplePage() {
  const { isTestMode } = useDataMode();
  
  // Drawer / modal states
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // C-Level Executive Drawer States
  const [activeKpiMode, setActiveKpiMode] = useState<"headcount" | "payroll" | "loans" | "audit" | null>(null);
  const [isKpiDrawerOpen, setIsKpiDrawerOpen] = useState(false);
  const [loanStats, setLoanStats] = useState<LoanStats | null>(null);

  // UI states
  const [showValues, setShowValues] = useState(true);
  
  // Filters state
  const [filterSearch, setFilterSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterVinculo, setFilterVinculo] = useState<string[]>([]);
  const [filterSetor, setFilterSetor] = useState<string[]>([]);
  const [filterGrau, setFilterGrau] = useState<string[]>([]);
  const [filterTerceirizado, setFilterTerceirizado] = useState<string[]>([]);
  const [filterLocalPrestacao, setFilterLocalPrestacao] = useState<string[]>([]);
  const [filterRegimeTributario, setFilterRegimeTributario] = useState<string[]>([]);
  const [showInativos, setShowInativos] = useState(false);
  
  // Insights & Alerts states
  const [noRaiseMonths, setNoRaiseMonths] = useState(6);
  const [noPromoMonths, setNoPromoMonths] = useState(6);
  const [filterInsight, setFilterInsight] = useState<string | null>(null);

  // Data states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [monthlyCosts, setMonthlyCosts] = useState<MonthlyCost[]>([]);
  const [allAuditIssues, setAllAuditIssues] = useState<Record<string, AuditIssue[]>>({});

  // Loading / error states
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isLoadingCosts, setIsLoadingCosts] = useState(true);
  const [error, setError] = useState<string | null>(null);



  useEffect(() => { 
    fetchData(); 
  }, [isTestMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const empId = params.get('employeeId');
      if (empId && employees.some(e => e.id === empId)) {
        setSelectedEmployee(empId);
        setIsProfileDrawerOpen(true);
      }
    }
  }, [employees]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).getPageContext = () => {
        return {
          pageType: 'PEOPLE_HR',
          dataSummary: `Informações de Recursos Humanos da Mar Brasil. Total de colaboradores na base: ${employees.length}.`,
          employees: employees.map(e => ({
            id: e.id,
            name: e.name,
            company: e.company,
            linkType: e.linkType,
            status: e.status,
            job_role: e.job_role,
            department: e.department,
            start_date: e.start_date,
            remuneration: showValues ? e.remuneration : '••••••',
            remuneration_fixed: showValues ? e.remuneration_fixed : '••••••',
            remuneration_bonus: showValues ? e.remuneration_bonus : '••••••',
            remuneration_commission: showValues ? e.remuneration_commission : '••••••',
            balance: showValues ? e.balance : '••••••'
          })),
          monthlyCostsSummary: monthlyCosts.slice(0, 100).map(c => ({
            competencia: c.competencia,
            vinculo_tipo: c.vinculo_tipo,
            valor_liquido: showValues ? c.valor_liquido : '••••••',
            valor_fixo: showValues ? c.valor_fixo : '••••••',
            valor_bonus: showValues ? c.valor_bonus : '••••••',
            valor_comissao: showValues ? c.valor_comissao : '••••••'
          }))
        };
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).getPageContext;
      }
    };
  }, [employees, monthlyCosts, showValues]);

  // ----- People KPI computed values -----
  const hrKpis = useMemo(() => {
    const ativos = filteredEmployees.filter(e => e.status === 'Ativo');
    const inativos = filteredEmployees.filter(e => e.status === 'Inativo');
    const ferias = filteredEmployees.filter(e => e.status === 'Férias');
    const marBR = ativos.filter(e => e.company === 'MarBR').length;
    const dzm = ativos.filter(e => e.company === 'DZM').length;
    const g2 = ativos.filter(e => e.company === 'G2').length;
    
    // Average tenure for actives
    const tenures = ativos
      .filter(e => e.start_date)
      .map(e => {
        const d = new Date(e.start_date! + 'T00:00:00');
        const now = new Date();
        return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      });
    const avgMonths = tenures.length > 0 ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length) : 0;
    const avgYears = Math.floor(avgMonths / 12);
    const avgRemMonths = avgMonths % 12;
    const avgTenure = avgYears > 0 ? `${avgYears}a ${avgRemMonths > 0 ? avgRemMonths + 'm' : ''}` : `${avgMonths}m`;

    return {
      headcount: ativos.length,
      inativos: inativos.length,
      ferias: ferias.length,
      marBR,
      dzm,
      g2,
      avgTenure: avgMonths > 0 ? avgTenure : '—',
      clt: ativos.filter(e => e.linkType === 'CLT').length,
      mei: ativos.filter(e => e.linkType === 'MEI' || e.linkType === 'PJ').length,
      est: ativos.filter(e => e.linkType === 'Estagiário').length,
      saldoDevedorTotal: filteredEmployees.reduce((sum, e) => sum + (e.balance || 0), 0)
    };
  }, [filteredEmployees, loanStats]);

  // Sum of total payroll cost for the current active employees (Remuneration total)
  const payrollCosts = useMemo(() => {
    const activeEmps = filteredEmployees.filter(e => e.status === 'Ativo' || e.status === 'Férias' || e.status === 'Provisão');
    const total = activeEmps.reduce((sum, e) => sum + (e.remuneration || 0), 0);
    const base = activeEmps.reduce((sum, e) => sum + (e.remuneration_fixed || 0), 0);
    const bonus = activeEmps.reduce((sum, e) => sum + (e.remuneration_bonus || 0), 0);
    return { total, base, bonus };
  }, [filteredEmployees]);

  // Average active employee remuneration
  const avgRemuneration = useMemo(() => {
    const activeEmps = filteredEmployees.filter(e => e.status === 'Ativo' && e.remuneration > 0);
    if (activeEmps.length === 0) return 0;
    return Math.round(activeEmps.reduce((sum, e) => sum + e.remuneration, 0) / activeEmps.length);
  }, [filteredEmployees]);

  // Count total audit inconsistencies found in the cockpit
  const totalAuditIssuesCount = useMemo(() => {
    return filteredEmployees.reduce((sum, emp) => {
      const issues = allAuditIssues[emp.id];
      return sum + (issues ? issues.length : 0);
    }, 0);
  }, [allAuditIssues, filteredEmployees]);

  // ----- Unique filter options from data -----
  const setores = useMemo(() => {
    // Normalize to proper case and remove duplicates
    const s = new Set(
      employees
        .map(e => e.department)
        .filter(Boolean)
        .map(d => {
           const str = String(d).trim();
           return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        })
    );
    return Array.from(s).sort() as string[];
  }, [employees]);

  const graus = useMemo(() => {
    const defaultGraus = ['I', 'II', 'III'];
    const s = new Set([...defaultGraus, ...employees.map(e => e.grau).filter(Boolean) as string[]]);
    return Array.from(s).sort();
  }, [employees]);

  const baseFilteredEmployees = useMemo(() => {
    let result = [...employees];
    const explicitlyShowingInativos = filterStatus.includes('Inativo');
    if (!showInativos && !explicitlyShowingInativos) {
       result = result.filter(e => e.status !== 'Inativo');
    }

    if (filterSearch) {
      const t = filterSearch.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(t) ||
        (e.corporate_name || '').toLowerCase().includes(t) ||
        (e.document_id || '').toLowerCase().includes(t) ||
        (e.job_role || '').toLowerCase().includes(t)
      );
    }
    if (filterEmpresa.length > 0) result = result.filter(e => filterEmpresa.includes(e.company || ''));
    if (filterStatus.length > 0) result = result.filter(e => filterStatus.includes(e.status || ''));
    if (filterVinculo.length > 0) result = result.filter(e => filterVinculo.includes(e.linkType || ''));
    if (filterSetor.length > 0) {
      const lowerFilterSetor = filterSetor.map(s => s.toLowerCase());
      result = result.filter(e => {
         const dept = (e.department || '').trim().toLowerCase();
         return lowerFilterSetor.includes(dept) || filterSetor.includes(e.department || '');
      });
    }
    if (filterGrau.length > 0) result = result.filter(e => filterGrau.includes(e.grau || ''));
    
    if (filterTerceirizado.length > 0) {
      result = result.filter(e => filterTerceirizado.includes(e.is_outsourced ? 'true' : 'false'));
    }
    if (filterLocalPrestacao.length > 0) {
      result = result.filter(e => filterLocalPrestacao.includes(e.service_location || ''));
    }
    if (filterRegimeTributario.length > 0) {
      result = result.filter(e => filterRegimeTributario.includes(e.tax_regime || ''));
    }
    
    return result;
  }, [employees, filterSearch, filterEmpresa, filterStatus, filterVinculo, filterSetor, filterGrau, filterTerceirizado, filterLocalPrestacao, filterRegimeTributario, showInativos]);

  // ----- Apply people filters -----
  useEffect(() => {
    let result = [...baseFilteredEmployees];
    
    // Filtro de Insights
    if (filterInsight) {
      const now = new Date();
      result = result.filter(e => {
        if (filterInsight === 'glosa') return !!e.has_invoice_glosa;
        if (filterInsight === 'emprestimo') return (e.balance || 0) > 0;
        
        if (filterInsight === 'aumento') {
          const d = new Date((e.last_raise_date || e.start_date || '') + 'T00:00:00');
          if (isNaN(d.getTime())) return false;
          const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
          return diffMonths >= noRaiseMonths;
        }
        if (filterInsight === 'promocao') {
          const d = new Date((e.department_start_date || e.start_date || '') + 'T00:00:00');
          if (isNaN(d.getTime())) return false;
          const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
          return diffMonths >= noPromoMonths;
        }
        return true;
      });
    }
    
    setFilteredEmployees(result);
  }, [baseFilteredEmployees, filterInsight, noRaiseMonths, noPromoMonths]);

  const fetchData = async () => {
    setError(null);
    
    try {
      setIsLoadingEmployees(true);
      const employeesData = await PeopleHRService.getEmployeesForPeople({ mostrarInativos: true, isTestMode });
      setEmployees(employeesData);
    } catch { 
      setError('Falha ao carregar colaboradores'); 
    } finally { 
      setIsLoadingEmployees(false); 
    }

    try {
      setIsLoadingCosts(true);
      const costsData = await PeopleHRService.getAllMonthlyCosts();
      setMonthlyCosts(costsData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingCosts(false);
    }

    try {
      const auditData = await PeopleHRService.getAuditInconsistencies();
      setAllAuditIssues(auditData);
    } catch (err) { 
      console.error('Erro ao auditar base de dados:', err);
    }

    try {
      const statsData = await LoansService.getStats(isTestMode);
      setLoanStats(statsData);
    } catch (err) {
      console.error('Erro ao carregar estatísticas de empréstimos:', err);
    }
  };

  const handleClearFilters = () => {
    setFilterSearch('');
    setFilterEmpresa([]);
    setFilterStatus([]);
    setFilterVinculo([]);
    setFilterSetor([]);
    setFilterGrau([]);
    setFilterTerceirizado([]);
    setFilterLocalPrestacao([]);
    setFilterRegimeTributario([]);
    setShowInativos(false);
  };

  const insightCounts = useMemo(() => {
    const now = new Date();
    let glosa = 0;
    let emprestimo = 0;
    let aumento = 0;
    let promocao = 0;

    baseFilteredEmployees.forEach(e => {
      if (e.has_invoice_glosa) glosa++;
      if ((e.balance || 0) > 0) emprestimo++;
      
      const dRaise = new Date((e.last_raise_date || e.start_date || '') + 'T00:00:00');
      if (!isNaN(dRaise.getTime())) {
        const diffMonths = (now.getFullYear() - dRaise.getFullYear()) * 12 + (now.getMonth() - dRaise.getMonth());
        if (diffMonths >= noRaiseMonths) aumento++;
      }

      const dPromo = new Date((e.department_start_date || e.start_date || '') + 'T00:00:00');
      if (!isNaN(dPromo.getTime())) {
        const diffMonths = (now.getFullYear() - dPromo.getFullYear()) * 12 + (now.getMonth() - dPromo.getMonth());
        if (diffMonths >= noPromoMonths) promocao++;
      }
    });
    return { glosa, emprestimo, aumento, promocao };
  }, [baseFilteredEmployees, noRaiseMonths, noPromoMonths]);

  const handleEmployeeClick = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    setIsProfileDrawerOpen(true);
  };

  const handleCreateEmployeeClick = () => {
    setSelectedEmployee(undefined);
    setIsProfileDrawerOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await PeopleHRService.deleteEmployee(deleteTarget.id);
      setDeleteTarget(null);
      await fetchData();
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Erro ao excluir colaborador');
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* ── LEFT SIDEBAR (Dark Navy) ── */}
      <aside className="w-[280px] bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shrink-0 hidden md:flex">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wider leading-tight">PeopleBoard</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase leading-none">Executive Cockpit</span>
                <span className="text-[9px] font-mono text-slate-400 bg-slate-800/80 px-1 py-0.5 rounded-sm">{APP_VERSION}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Filters */}
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Busca Rápida</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Nome, cargo, CPF..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white placeholder-slate-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Empresa</label>
            <MultiSelectDropdown
              value={filterEmpresa}
              onChange={setFilterEmpresa}
              placeholder="Todas as Empresas"
              options={[
                { label: 'MarBR', value: 'MarBR' },
                { label: 'DZM', value: 'DZM' },
                { label: 'G2', value: 'G2' }
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Status</label>
            <MultiSelectDropdown
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="Todos os Status"
              options={[
                { label: 'Ativo', value: 'Ativo' },
                { label: 'Férias', value: 'Férias' },
                { label: 'Inativo', value: 'Inativo' }
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Vínculo</label>
            <MultiSelectDropdown
              value={filterVinculo}
              onChange={setFilterVinculo}
              placeholder="Todos os Vínculos"
              options={[
                { label: 'CLT', value: 'CLT' },
                { label: 'PJ', value: 'PJ' },
                { label: 'Estagiário', value: 'Estagiário' }
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Terceirização</label>
            <MultiSelectDropdown
              value={filterTerceirizado}
              onChange={setFilterTerceirizado}
              placeholder="Todos (Direto & Terceirizado)"
              options={[
                { label: 'Contratação Direta (Interno)', value: 'false' },
                { label: 'Terceirizado (Prestador)', value: 'true' }
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Local de Prestação</label>
            <MultiSelectDropdown
              value={filterLocalPrestacao}
              onChange={setFilterLocalPrestacao}
              placeholder="Todos os Locais"
              options={[
                { label: 'Escritório', value: 'Escritório' },
                { label: 'Home Office', value: 'Home Office' },
                { label: 'Cliente', value: 'Cliente' },
                { label: 'Híbrido', value: 'Híbrido' }
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Regime Tributário</label>
            <MultiSelectDropdown
              value={filterRegimeTributario}
              onChange={setFilterRegimeTributario}
              placeholder="Todos os Regimes (PJ)"
              options={[
                { label: 'MEI', value: 'MEI' },
                { label: 'Simples Nacional', value: 'Simples Nacional' },
                { label: 'Lucro Presumido', value: 'Lucro Presumido' },
                { label: 'Lucro Real', value: 'Lucro Real' }
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Setor</label>
            <MultiSelectDropdown
              value={filterSetor}
              onChange={setFilterSetor}
              placeholder="Todos os Setores"
              options={setores.map(s => ({ label: s, value: s }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Grau</label>
            <MultiSelectDropdown
              value={filterGrau}
              onChange={setFilterGrau}
              placeholder="Todos os Graus"
              options={graus.map(s => ({ label: s, value: s }))}
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400 hover:text-slate-200">
              <input
                type="checkbox"
                checked={showInativos}
                onChange={e => setShowInativos(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-800 w-4 h-4"
              />
              <span>Incluir Inativos</span>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={handleClearFilters}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 uppercase"
            >
              <X size={13} /> Limpar Filtros
            </button>
          </div>
        </div>

        {/* Sidebar Footer with Branding */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/40 text-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Mar Brasil</p>
          <p className="text-[8px] text-slate-600 font-semibold uppercase leading-none mt-1">HR Intelligence © 2026</p>
        </div>
      </aside>

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-slate-900 text-slate-100 z-50 p-6 flex flex-col gap-5 border-r border-slate-800 md:hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                    <Users size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase">Filtros HR</h2>
                  </div>
                </div>
                <button onClick={() => setIsMobileSidebarOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto pr-1">
                {/* Search */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Busca Rápida</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input
                      value={filterSearch}
                      onChange={e => setFilterSearch(e.target.value)}
                      placeholder="Nome, cargo, CPF..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white placeholder-slate-500 transition-all"
                    />
                  </div>
                </div>

                {/* Company select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Empresa</label>
                  <MultiSelectDropdown
                    value={filterEmpresa}
                    onChange={setFilterEmpresa}
                    placeholder="Todas as Empresas"
                    options={[
                      { label: 'MarBR', value: 'MarBR' },
                      { label: 'DZM', value: 'DZM' },
                      { label: 'G2', value: 'G2' }
                    ]}
                  />
                </div>

                {/* Status select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Status</label>
                  <MultiSelectDropdown
                    value={filterStatus}
                    onChange={setFilterStatus}
                    placeholder="Todos os Status"
                    options={[
                      { label: 'Ativo', value: 'Ativo' },
                      { label: 'Férias', value: 'Férias' },
                      { label: 'Inativo', value: 'Inativo' }
                    ]}
                  />
                </div>

                {/* Vínculo select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Vínculo</label>
                  <MultiSelectDropdown
                    value={filterVinculo}
                    onChange={setFilterVinculo}
                    placeholder="Todos os Vínculos"
                    options={[
                      { label: 'CLT', value: 'CLT' },
                      { label: 'PJ', value: 'PJ' },
                      { label: 'Estagiário', value: 'Estagiário' }
                    ]}
                  />
                </div>

                {/* Sector select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Setor</label>
                  <MultiSelectDropdown
                    value={filterSetor}
                    onChange={setFilterSetor}
                    placeholder="Todos os Setores"
                    options={setores.map(s => ({ label: s, value: s }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Grau</label>
                  <MultiSelectDropdown
                    value={filterGrau}
                    onChange={setFilterGrau}
                    placeholder="Todos os Graus"
                    options={graus.map(s => ({ label: s, value: s }))}
                  />
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={showInativos}
                      onChange={e => setShowInativos(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-800 w-4 h-4"
                    />
                    <span>Incluir Inativos</span>
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <button
                    onClick={() => {
                      handleClearFilters();
                      setIsMobileSidebarOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 uppercase"
                  >
                    <X size={13} /> Limpar Filtros
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT AREA (Scrollable) ── */}
      <main className="flex-1 overflow-y-auto flex flex-col bg-slate-50">
        
        {/* Header bar */}
        <header className="bg-white border-b border-slate-200 py-4 px-6 shrink-0 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Toggle */}
            <button className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl" onClick={() => setIsMobileSidebarOpen(true)}>
              <Filter size={18} />
            </button>
            <div>
              <h1 className="text-base font-black text-slate-800 tracking-tight uppercase leading-none">Dashboard Executivo</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mt-1">Bússola de Decisão de RH</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Privacy toggle */}
            <button
              onClick={() => setShowValues(v => !v)}
              className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all ${
                showValues
                  ? 'border-slate-200 text-slate-400 hover:bg-slate-100'
                  : 'border-amber-300 bg-amber-50 text-amber-600 ring-2 ring-amber-100'
              }`}
              title={showValues ? 'Ocultar valores sensíveis' : 'Exibir valores sensíveis'}
            >
              {showValues ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>

            {/* Redirect button to the separate Consignado Loans Page */}
            <Link
              href="/emprestimos"
              className="flex items-center gap-1.5 px-4 py-2 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-black transition-all active:scale-95 shrink-0 uppercase"
              title="Ir para a página de Empréstimos Consignados"
            >
              <HandCoins size={14} /> Empréstimos
            </Link>

            {/* Create new employee button */}
            <button
              onClick={handleCreateEmployeeClick}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 shrink-0 uppercase"
            >
              <Plus size={14} /> Adicionar
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 max-w-[1400px] w-full mx-auto space-y-6 flex-1">
          
          {/* Error notifications */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 animate-in fade-in duration-200 shadow-sm">
              <AlertCircle size={20} className="shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">{error}</span>
              <button 
                onClick={fetchData}
                className="ml-auto text-[10px] font-black uppercase underline hover:no-underline bg-white border border-red-200 rounded-lg px-3 py-1 text-red-600 hover:bg-red-50"
              >
                Recarregar
              </button>
            </div>
          )}

          {/* ── 5 HR KPI Cards (Dianna Focused) ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <PeopleKpiCard
              title="Headcount Ativo"
              value={hrKpis.headcount}
              icon={<Users size={20} />}
              color="emerald"
              onClick={() => { setActiveKpiMode('headcount'); setIsKpiDrawerOpen(true); }}
              breakdown={[
                { label: 'MarBR', value: hrKpis.marBR.toString() },
                { label: 'DZM', value: hrKpis.dzm.toString() },
                { label: 'G2', value: hrKpis.g2.toString() },
              ]}
            />
            <PeopleKpiCard
                title="Custo da Folha"
                value={showValues ? formatCurrency(payrollCosts.total) : '••••••'}
                icon={<Coins size={20} />}
                color="blue"
                onClick={() => { setActiveKpiMode('payroll'); setIsKpiDrawerOpen(true); }}
                sub="Consolidado (Ativos/Férias/Provisão)"
                breakdown={[
                  { label: 'Valor Base', value: showValues ? formatCurrency(payrollCosts.base) : '•••' },
                  { label: 'Bônus', value: showValues ? formatCurrency(payrollCosts.bonus) : '•••' },
                ]}
              />
            <PeopleKpiCard
              title="Saldo Devedor Ativo"
              value={showValues ? formatCurrency(hrKpis.saldoDevedorTotal) : '••••••'}
              icon={<Landmark size={20} />}
              color="amber"
              onClick={() => { setActiveKpiMode('loans'); setIsKpiDrawerOpen(true); }}
              sub="Capital sob risco em empréstimos"
            />
            <PeopleKpiCard
              title="Alertas Auditoria"
              value={totalAuditIssuesCount}
              icon={<AlertCircle size={20} />}
              color={totalAuditIssuesCount > 0 ? "red" : "emerald"}
              onClick={() => { setActiveKpiMode('audit' as any); setIsKpiDrawerOpen(true); }}
              sub={totalAuditIssuesCount > 0 ? "Incoerências de data/regime" : "Todos os prontuários limpos"}
            />
            <PeopleKpiCard
              title="Vínculos Ativos"
              value={hrKpis.headcount}
              icon={<UserCog size={20} />}
              color="slate"
              breakdown={[
                { label: 'CLT', value: hrKpis.clt.toString() },
                { label: 'MEI/PJ', value: hrKpis.mei.toString() },
                { label: 'EST', value: hrKpis.est.toString() },
              ]}
            />
          </div>

          {/* 🌟 Alertas & Filtros Transformados em Cards 🌟 */}
          <div className="mt-8 flex flex-col gap-4">
             <div className="flex items-center justify-between gap-4">
               <div className="flex items-center gap-2">
                 <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                   <Target size={18} className="text-purple-600"/> Monitoramento & Alertas
                 </h3>
                 {filterInsight && (
                   <button onClick={() => setFilterInsight(null)} className="ml-2 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full hover:bg-slate-200 hover:text-slate-800 transition-colors uppercase">
                     Limpar Filtro
                   </button>
                 )}
               </div>

               <div className="flex items-center gap-4">
                 <div className="flex flex-col">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Janela Base</label>
                    <select value={noRaiseMonths} onChange={e => setNoRaiseMonths(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded text-xs font-bold py-1 px-2 outline-none cursor-pointer">
                       <option value={3}>3 meses</option>
                       <option value={6}>6 meses</option>
                       <option value={12}>12 meses</option>
                       <option value={24}>24 meses</option>
                    </select>
                 </div>
                 <div className="flex flex-col">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Janela Nível</label>
                    <select value={noPromoMonths} onChange={e => setNoPromoMonths(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded text-xs font-bold py-1 px-2 outline-none cursor-pointer">
                       <option value={3}>3 meses</option>
                       <option value={6}>6 meses</option>
                       <option value={12}>12 meses</option>
                       <option value={24}>24 meses</option>
                    </select>
                 </div>
               </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
               <PeopleKpiCard
                 title="Glosa na NF"
                 value={insightCounts.glosa}
                 icon={<AlertCircle size={20} />}
                 color="amber"
                 onClick={() => setFilterInsight(filterInsight === 'glosa' ? null : 'glosa')}
                 isActive={filterInsight === 'glosa'}
                 sub="Divergência ou Punição"
               />
               <PeopleKpiCard
                 title="Com Empréstimo"
                 value={insightCounts.emprestimo}
                 icon={<Coins size={20} />}
                 color="blue"
                 onClick={() => setFilterInsight(filterInsight === 'emprestimo' ? null : 'emprestimo')}
                 isActive={filterInsight === 'emprestimo'}
                 sub="Saldo devedor ativo"
               />
               <PeopleKpiCard
                 title="Sem Revisão (Base)"
                 value={insightCounts.aumento}
                 icon={<UserCog size={20} />}
                 color="rose"
                 onClick={() => setFilterInsight(filterInsight === 'aumento' ? null : 'aumento')}
                 isActive={filterInsight === 'aumento'}
                 sub={`Há mais de ${noRaiseMonths} meses`}
               />
               <PeopleKpiCard
                 title="Sem Nível/Função"
                 value={insightCounts.promocao}
                 icon={<Target size={20} />}
                 color="indigo"
                 onClick={() => setFilterInsight(filterInsight === 'promocao' ? null : 'promocao')}
                 isActive={filterInsight === 'promocao'}
                 sub={`Há mais de ${noPromoMonths} meses`}
               />
             </div>
          </div>

          {/* ── Main HR / Employee Table ── */}
          {isLoadingEmployees ? (
            <div className="p-12 flex items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm mt-6">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : (
            <PeopleTable
              employees={filteredEmployees}
              onEdit={handleEmployeeClick}
              onDelete={(emp) => setDeleteTarget(emp)}
              onEmployeeClick={handleEmployeeClick}
              showValues={showValues}
              auditIssues={allAuditIssues}
              noRaiseMonths={noRaiseMonths}
              noPromoMonths={noPromoMonths}
            />
          )}

        </div>

        <footer className="mt-auto py-6 px-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-white shrink-0">
          <p className="text-xs text-slate-400">
            © 2026 Mar Brasil - People Cockpit
          </p>
        </footer>

      </main>

      {/* ── DRAWERS AND MODALS ── */}
      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        setores={setores}
        onClose={() => {
          setIsProfileDrawerOpen(false);
          setSelectedEmployee(undefined);
        }}
        employeeId={selectedEmployee}
        onDataChanged={(newId) => {
          fetchData();
          if (newId && selectedEmployee !== newId) {
            setSelectedEmployee(newId);
          }
        }}
      />

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        employeeName={deleteTarget?.name || ""}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <KPIStatsDrawer
        isOpen={isKpiDrawerOpen}
        onClose={() => {
          setIsKpiDrawerOpen(false);
          setActiveKpiMode(null);
        }}
        mode={activeKpiMode}
        employees={filteredEmployees}
        monthlyCosts={monthlyCosts}
        loanStats={loanStats}
        auditIssues={Object.fromEntries(Object.entries(allAuditIssues).filter(([id]) => filteredEmployees.some(e => e.id === id)))}
      />
    </div>
  );
}
