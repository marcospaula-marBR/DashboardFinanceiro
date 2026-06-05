"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ProfileDrawer } from "@/components/people/ProfileDrawer";
import { PeopleKpiCard } from "@/components/people/PeopleKpiCard";
import { DeleteConfirmDialog } from "@/components/people/DeleteConfirmDialog";
import { PeopleTable } from "@/components/people/PeopleTable";
import { PayrollCostChart } from "@/components/people/PayrollCostChart";
import { KPIStatsDrawer } from "@/components/people/KPIStatsDrawer";
import { PeopleHRService } from "@/services/people-hr.service";
import { Employee, MonthlyCost, AuditIssue, LoanStats } from "@/types/loans";
import { useDataMode } from "@/contexts/DataModeContext";
import { APP_VERSION } from "@/version";
import { LoansService, formatCurrency } from "@/services/loans.service";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, AlertCircle, Users, Eye, EyeOff, Search, Filter, X, 
  UserCog, Plus, HandCoins, Coins, TrendingUp, Landmark
} from "lucide-react";

export default function PeoplePage() {
  const { isTestMode } = useDataMode();
  
  // Drawer / modal states
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // C-Level Executive Drawer States
  const [activeKpiMode, setActiveKpiMode] = useState<"headcount" | "payroll" | "loans" | null>(null);
  const [isKpiDrawerOpen, setIsKpiDrawerOpen] = useState(false);
  const [loanStats, setLoanStats] = useState<LoanStats | null>(null);

  // UI states
  const [showValues, setShowValues] = useState(true);
  
  // Filters state
  const [filterSearch, setFilterSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterVinculo, setFilterVinculo] = useState('');
  const [filterSetor, setFilterSetor] = useState('');
  const [filterTerceirizado, setFilterTerceirizado] = useState('');
  const [filterLocalPrestacao, setFilterLocalPrestacao] = useState('');
  const [filterRegimeTributario, setFilterRegimeTributario] = useState('');
  const [showInativos, setShowInativos] = useState(false);

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
    const ativos = employees.filter(e => e.status === 'Ativo');
    const inativos = employees.filter(e => e.status === 'Inativo');
    const ferias = employees.filter(e => e.status === 'Férias');
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
    };
  }, [employees]);

  // Sum of total payroll cost for the latest competency month from seeded Dianna data
  const latestPayrollCost = useMemo(() => {
    if (monthlyCosts.length === 0) return 0;
    const sorted = [...monthlyCosts].sort((a, b) => b.competencia.localeCompare(a.competencia));
    const latestMonth = sorted[0].competencia;
    const latestCosts = monthlyCosts.filter(c => c.competencia === latestMonth);
    return latestCosts.reduce((sum, c) => sum + (c.valor_liquido || 0), 0);
  }, [monthlyCosts]);

  // Average active employee remuneration
  const avgRemuneration = useMemo(() => {
    const activeEmps = employees.filter(e => e.status === 'Ativo' && e.remuneration > 0);
    if (activeEmps.length === 0) return 0;
    return Math.round(activeEmps.reduce((sum, e) => sum + e.remuneration, 0) / activeEmps.length);
  }, [employees]);

  // Count total audit inconsistencies found in the cockpit
  const totalAuditIssuesCount = useMemo(() => {
    return Object.values(allAuditIssues).reduce((sum, issues) => sum + issues.length, 0);
  }, [allAuditIssues]);

  // ----- Unique filter options from data -----
  const setores = useMemo(() => {
    const s = new Set(employees.map(e => e.department).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [employees]);

  // ----- Apply people filters -----
  useEffect(() => {
    let result = [...employees];
    if (!showInativos) result = result.filter(e => e.status !== 'Inativo');
    if (filterSearch) {
      const t = filterSearch.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(t) ||
        (e.document_id || '').toLowerCase().includes(t) ||
        (e.job_role || '').toLowerCase().includes(t)
      );
    }
    if (filterEmpresa) result = result.filter(e => e.company === filterEmpresa);
    if (filterStatus) result = result.filter(e => e.status === filterStatus);
    if (filterVinculo) result = result.filter(e => e.linkType === filterVinculo);
    if (filterSetor) result = result.filter(e => (e.department || '') === filterSetor);
    
    if (filterTerceirizado) {
      const isOutsourced = filterTerceirizado === 'true';
      result = result.filter(e => !!e.is_outsourced === isOutsourced);
    }
    if (filterLocalPrestacao) {
      result = result.filter(e => e.service_location === filterLocalPrestacao);
    }
    if (filterRegimeTributario) {
      result = result.filter(e => e.tax_regime === filterRegimeTributario);
    }
    
    setFilteredEmployees(result);
  }, [employees, filterSearch, filterEmpresa, filterStatus, filterVinculo, filterSetor, filterTerceirizado, filterLocalPrestacao, filterRegimeTributario, showInativos]);

  const fetchData = async () => {
    setError(null);
    
    try {
      setIsLoadingEmployees(true);
      const employeesData = await PeopleHRService.getEmployeesForPeople({ mostrarInativos: true });
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
      console.error('Erro ao carregar custos históricos:', err);
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
    setFilterEmpresa('');
    setFilterStatus('');
    setFilterVinculo('');
    setFilterSetor('');
    setFilterTerceirizado('');
    setFilterLocalPrestacao('');
    setFilterRegimeTributario('');
    setShowInativos(false);
  };

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
            <select
              value={filterEmpresa}
              onChange={e => setFilterEmpresa(e.target.value)}
              className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white transition-all"
            >
              <option value="">Todas as Empresas</option>
              <option value="MarBR">MarBR</option>
              <option value="DZM">DZM</option>
              <option value="G2">G2</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white transition-all"
            >
              <option value="">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Férias">Férias</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Vínculo</label>
            <select
              value={filterVinculo}
              onChange={e => setFilterVinculo(e.target.value)}
              className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white transition-all"
            >
              <option value="">Todos os Vínculos</option>
              <option value="CLT">CLT</option>
              <option value="MEI">MEI</option>
              <option value="PJ">PJ</option>
              <option value="Estagiário">Estagiário</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Terceirização</label>
            <select
              value={filterTerceirizado}
              onChange={e => setFilterTerceirizado(e.target.value)}
              className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white transition-all"
            >
              <option value="">Todos (Direto & Terceirizado)</option>
              <option value="false">Contratação Direta (Interno)</option>
              <option value="true">Terceirizado (Prestador)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Local de Prestação</label>
            <select
              value={filterLocalPrestacao}
              onChange={e => setFilterLocalPrestacao(e.target.value)}
              className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white transition-all"
            >
              <option value="">Todos os Locais</option>
              <option value="Escritório">Escritório</option>
              <option value="Home Office">Home Office</option>
              <option value="Cliente">Cliente</option>
              <option value="Híbrido">Híbrido</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Regime Tributário</label>
            <select
              value={filterRegimeTributario}
              onChange={e => setFilterRegimeTributario(e.target.value)}
              className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white transition-all"
            >
              <option value="">Todos os Regimes (PJ)</option>
              <option value="MEI">MEI</option>
              <option value="Simples Nacional">Simples Nacional</option>
              <option value="Lucro Presumido">Lucro Presumido</option>
              <option value="Lucro Real">Lucro Real</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Setor</label>
            <select
              value={filterSetor}
              onChange={e => setFilterSetor(e.target.value)}
              className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white transition-all"
            >
              <option value="">Todos os Setores</option>
              {setores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
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
                  <select
                    value={filterEmpresa}
                    onChange={e => setFilterEmpresa(e.target.value)}
                    className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white transition-all"
                  >
                    <option value="">Todas as Empresas</option>
                    <option value="MarBR">MarBR</option>
                    <option value="DZM">DZM</option>
                    <option value="G2">G2</option>
                  </select>
                </div>

                {/* Status select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Status</label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white transition-all"
                  >
                    <option value="">Todos os Status</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Férias">Férias</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>

                {/* Vínculo select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Vínculo</label>
                  <select
                    value={filterVinculo}
                    onChange={e => setFilterVinculo(e.target.value)}
                    className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white transition-all"
                  >
                    <option value="">Todos os Vínculos</option>
                    <option value="CLT">CLT</option>
                    <option value="MEI">MEI</option>
                    <option value="PJ">PJ</option>
                    <option value="Estagiário">Estagiário</option>
                  </select>
                </div>

                {/* Sector select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Setor</label>
                  <select
                    value={filterSetor}
                    onChange={e => setFilterSetor(e.target.value)}
                    className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white transition-all"
                  >
                    <option value="">Todos os Setores</option>
                    {setores.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
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
              value={showValues ? formatCurrency(latestPayrollCost) : '••••••'}
              icon={<Coins size={20} />}
              color="blue"
              onClick={() => { setActiveKpiMode('payroll'); setIsKpiDrawerOpen(true); }}
              sub="Consolidado do último mês"
            />
            <PeopleKpiCard
              title="Saldo Devedor Ativo"
              value={showValues ? (loanStats ? formatCurrency(loanStats.saldoDevedor) : 'R$ 0') : '••••••'}
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

          {/* ── Real Payroll Cost History Chart ── */}
          {!isLoadingCosts && (
            <PayrollCostChart costs={monthlyCosts} />
          )}

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
        onClose={() => {
          setIsProfileDrawerOpen(false);
          setSelectedEmployee(undefined);
        }}
        employeeId={selectedEmployee}
        onDataChanged={fetchData}
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
        employees={employees}
        monthlyCosts={monthlyCosts}
        loanStats={loanStats}
      />
    </div>
  );
}
