"use client";

import { useState, useEffect, useMemo } from "react";
import { HeaderDashboard } from "@/components/layout/HeaderDashboard";
import { StatCard } from "@/components/loans/StatCard";
import { ProjectionChart } from "@/components/loans/ProjectionChart";
import { SideDrawer } from "@/components/loans/SideDrawer";
import { ProfileDrawer } from "@/components/people/ProfileDrawer";
import { PaymentProcessingModal } from "@/components/loans/PaymentProcessingModal";
import { NewLoanModal } from "@/components/loans/NewLoanModal";
import { PeopleKpiCard } from "@/components/people/PeopleKpiCard";
import { DeleteConfirmDialog } from "@/components/people/DeleteConfirmDialog";
import { PeopleTable } from "@/components/people/PeopleTable";
import { LoansService, formatCurrency } from "@/services/loans.service";
import { PeopleHRService } from "@/services/people-hr.service";
import { PDFService } from "@/services/pdf.service";
import { Employee, LoanStats, ProjectionData, AuditIssue } from "@/types/loans";
import { useDataMode } from "@/contexts/DataModeContext";
import { APP_VERSION } from "@/version";
import {
  Receipt, PiggyBank, HandCoins, CalendarClock, FileCheck, Files,
  TrendingUp, Timer, Loader2, AlertCircle, CreditCard, Users,
  UserX, Clock, Eye, EyeOff, Search, Filter, X, ChevronDown, UserCog
} from "lucide-react";

export default function PeoplePage() {
  const { isTestMode } = useDataMode();
  
  // Drawer / modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  // UI states
  const [showValues, setShowValues] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  // Filters state
  const [filterSearch, setFilterSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterVinculo, setFilterVinculo] = useState('');
  const [filterSetor, setFilterSetor] = useState('');
  const [showInativos, setShowInativos] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Data states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<LoanStats | null>(null);
  const [projections, setProjections] = useState<ProjectionData[]>([]);
  const [expiringEmployees, setExpiringEmployees] = useState<Employee[]>([]);
  const [allAuditIssues, setAllAuditIssues] = useState<Record<string, AuditIssue[]>>({});

  // Loading / error states
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingProjections, setIsLoadingProjections] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { 
    fetchData(); 
  }, [isTestMode]);

  // ----- People KPI computed values -----
  const hrKpis = useMemo(() => {
    const ativos = employees.filter(e => e.status === 'Ativo');
    const inativos = employees.filter(e => e.status === 'Inativo');
    const ferias = employees.filter(e => e.status === 'Férias');
    const marBR = ativos.filter(e => e.company === 'MarBR').length;
    const dzm = ativos.filter(e => e.company === 'DZM').length;
    
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
      avgTenure: avgMonths > 0 ? avgTenure : '—',
      clt: ativos.filter(e => e.linkType === 'CLT').length,
      mei: ativos.filter(e => e.linkType === 'MEI' || e.linkType === 'PJ').length,
      est: ativos.filter(e => e.linkType === 'Estagiário').length,
    };
  }, [employees]);

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
    setFilteredEmployees(result);
  }, [employees, filterSearch, filterEmpresa, filterStatus, filterVinculo, filterSetor, showInativos]);

  const computeStats = (list: Employee[], base: LoanStats | null): LoanStats | null => {
    if (!base) return null;
    if (list.length === 0) return { ...base, totalEmprestado: 0, saldoDevedor: 0, totalRecebido: 0, recebivelMes: 0, contratosAtivos: 0, contratosLiquidados: 0 };
    return {
      ...base,
      totalEmprestado: list.reduce((s, e) => s + (e.totalTaken || 0), 0),
      saldoDevedor: list.reduce((s, e) => s + (e.balance || 0), 0),
      totalRecebido: list.reduce((s, e) => s + (e.totalReceived || 0), 0),
      recebivelMes: list.reduce((s, e) => s + (e.monthInstallment || 0), 0),
      contratosAtivos: list.filter(e => e.loanStatus === 'Ativo').length,
      contratosLiquidados: list.filter(e => e.loanStatus === 'Quitado').length,
    };
  };

  const filteredStats = computeStats(filteredEmployees, stats);

  const fetchData = async () => {
    setError(null);
    try {
      setIsLoadingStats(true);
      const statsData = await LoansService.getStats(isTestMode);
      setStats(statsData);
    } catch (err) { 
      setError('Falha ao carregar estatísticas'); 
    } finally { 
      setIsLoadingStats(false); 
    }

    try {
      setIsLoadingEmployees(true);
      const employeesData = await LoansService.getEmployees({ mostrarTodos: true }, isTestMode);
      setEmployees(employeesData);
    } catch (err) { 
      setError('Falha ao carregar colaboradores'); 
    } finally { 
      setIsLoadingEmployees(false); 
    }

    try {
      const allEmps = await LoansService.getEmployees({ mostrarTodos: true }, isTestMode);
      const now = new Date();
      const threshold = new Date();
      threshold.setDate(now.getDate() + 10);
      setExpiringEmployees(
        allEmps.filter(e => {
          if (!e.contract_expiry_date) return false;
          const exp = new Date(e.contract_expiry_date + 'T12:00:00');
          return exp >= now && exp <= threshold;
        })
      );
    } catch (err) { /* non-critical */ }

    try {
      setIsLoadingProjections(true);
      const proj = await LoansService.getProjections(isTestMode);
      setProjections(proj);
    } catch (err) { /* non-critical */ }
    finally { 
      setIsLoadingProjections(false); 
    }

    try {
      const auditData = await PeopleHRService.getAuditInconsistencies();
      setAllAuditIssues(auditData);
    } catch (err) { /* non-critical */ }
  };

  const handleEmployeeClick = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    setIsDrawerOpen(true);
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

  const clearFilters = () => {
    setFilterSearch('');
    setFilterEmpresa('');
    setFilterStatus('');
    setFilterVinculo('');
    setFilterSetor('');
    setShowInativos(false);
  };

  const hasActiveFilters = filterSearch || filterEmpresa || filterStatus || filterVinculo || filterSetor || showInativos;

  const StatCardSkeleton = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-200 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-200 rounded w-24" />
          <div className="h-6 bg-slate-200 rounded w-32" />
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

        <HeaderDashboard
          activeFilters={undefined}
          isTestMode={isTestMode}
          onCreateEmployee={handleCreateEmployeeClick}
          onOpenNewLoan={() => setIsNewLoanOpen(true)}
        />

        {/* ── People Filter Bar ── */}
        <div className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Buscar por nome, cargo, CPF..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              />
            </div>

            <select
              value={filterEmpresa}
              onChange={e => setFilterEmpresa(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
            >
              <option value="">Todas as Empresas</option>
              <option value="MarBR">MarBR</option>
              <option value="DZM">DZM</option>
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
            >
              <option value="">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Férias">Férias</option>
              <option value="Inativo">Inativo</option>
            </select>

            <select
              value={filterVinculo}
              onChange={e => setFilterVinculo(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
            >
              <option value="">Todos os Vínculos</option>
              <option value="CLT">CLT</option>
              <option value="MEI">MEI</option>
              <option value="PJ">PJ</option>
              <option value="Estagiário">Estagiário</option>
            </select>

            <button
              onClick={() => setShowValues(v => !v)}
              title={showValues ? 'Ocultar valores' : 'Mostrar valores'}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                showValues
                  ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  : 'border-amber-300 bg-amber-50 text-amber-700'
              }`}
            >
              {showValues ? <Eye size={15} /> : <EyeOff size={15} />}
              <span className="hidden sm:inline">{showValues ? 'Ocultar' : 'Visível'}</span>
            </button>

            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-all"
            >
              <Filter size={14} />
              <span className="hidden sm:inline">Mais Filtros</span>
              <ChevronDown size={13} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-all"
              >
                <X size={14} /> Limpar
              </button>
            )}
          </div>

          {showAdvanced && (
            <div className="flex flex-wrap items-center gap-3 px-4 pb-4 pt-0 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
              <select
                value={filterSetor}
                onChange={e => setFilterSetor(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
              >
                <option value="">Todos os Setores</option>
                {setores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showInativos}
                  onChange={e => setShowInativos(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-600">Incluir inativos (histórico)</span>
              </label>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={fetchData} className="ml-auto text-xs font-semibold underline hover:no-underline">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Expiring Alert */}
        {expiringEmployees.length > 0 && (
          <div className="mb-6 p-1 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl border border-amber-200/50 shadow-sm">
            <div className="bg-white/80 backdrop-blur-sm p-4 rounded-[14px] flex items-start gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0 shadow-inner">
                  <CalendarClock className="text-amber-600" size={24} />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Alerta de Vencimento</h4>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase">Prazo Curto</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Contratos ou aditivos com vencimento nos próximos 10 dias:
                </p>
                <div className="flex flex-wrap gap-2">
                  {expiringEmployees.map(e => {
                    const expiry = new Date(e.contract_expiry_date! + 'T12:00:00');
                    const diffDays = Math.ceil((expiry.getTime() - new Date().getTime()) / 86400000);
                    return (
                      <button
                        key={e.id}
                        onClick={() => handleEmployeeClick(e.id)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl hover:border-amber-400 hover:shadow-md transition-all flex items-center gap-3"
                      >
                        <div className="w-1.5 h-8 bg-amber-500 rounded-full" />
                        <div className="text-left">
                          <div className="text-[11px] font-bold text-slate-900 uppercase leading-none mb-1">{e.name}</div>
                          <div className="text-[9px] font-medium text-slate-500 flex items-center gap-1">
                            <Timer size={10} />
                            Vence em {diffDays} {diffDays === 1 ? 'dia' : 'dias'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── HR KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <PeopleKpiCard
            title="Headcount Ativo"
            value={hrKpis.headcount}
            icon={<Users size={20} />}
            color="emerald"
            breakdown={[
              { label: 'MarBR', value: hrKpis.marBR.toString() },
              { label: 'DZM', value: hrKpis.dzm.toString() },
            ]}
          />
          <PeopleKpiCard
            title="Em Férias"
            value={hrKpis.ferias}
            icon={<CalendarClock size={20} />}
            color="amber"
          />
          <PeopleKpiCard
            title="Inativos (Histórico)"
            value={hrKpis.inativos}
            icon={<UserX size={20} />}
            color="red"
            onClick={() => setShowInativos(true)}
          />
          <PeopleKpiCard
            title="Tempo Médio"
            value={hrKpis.avgTenure}
            icon={<Clock size={20} />}
            color="blue"
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

        {/* ── Finance / Loans Actions and KPIs ── */}
        <div className="mt-8 pt-8 border-t border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Painel Financeiro & Empréstimos
            </h3>
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md text-xs active:scale-95"
            >
              <CreditCard size={15} />
              Processar Parcelas
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {isLoadingStats ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : filteredStats && (
              <>
                <StatCard
                  title="Total Emprestado"
                  value={showValues ? formatCurrency(filteredStats.totalEmprestado) : '••••••'}
                  icon={<Receipt size={22} />}
                  color="blue"
                />
                <StatCard
                  title="Saldo Devedor"
                  value={showValues ? formatCurrency(filteredStats.saldoDevedor) : '••••••'}
                  icon={<PiggyBank size={22} />}
                  color="red"
                />
                <StatCard
                  title="Total Recebido"
                  value={showValues ? formatCurrency(filteredStats.totalRecebido) : '••••••'}
                  icon={<HandCoins size={22} />}
                  color="green"
                />
                <StatCard
                  title="Recebível Mês"
                  value={showValues ? formatCurrency(filteredStats.recebivelMes) : '••••••'}
                  icon={<CalendarClock size={22} />}
                  color="emerald"
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {isLoadingStats ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : filteredStats && (
              <>
                <StatCard
                  title="Contratos Ativos"
                  value={filteredStats.contratosAtivos.toString()}
                  icon={<FileCheck size={22} />}
                  color="purple"
                />
                <StatCard
                  title="Totalmente Quitados"
                  value={filteredStats.contratosLiquidados.toString()}
                  icon={<Files size={22} />}
                  color="amber"
                />
                <StatCard
                  title="Maior Empréstimo"
                  value={showValues ? formatCurrency(stats?.maiorEmprestimo ?? 0) : '••••••'}
                  icon={<TrendingUp size={22} />}
                  color="sky"
                  description={stats?.maiorEmprestimoRef ? `Ref: ${stats.maiorEmprestimoRef}` : undefined}
                />
                <StatCard
                  title="Próximo a Encerrar"
                  value={stats?.proximoEncerrar ?? '—'}
                  icon={<Timer size={22} />}
                  color="slate"
                  description={stats?.parcelasRestantes ? `${stats.parcelasRestantes} parcelas restantes` : undefined}
                />
              </>
            )}
          </div>

          {/* Projections Chart */}
          <div className="mb-6">
            {isLoadingProjections ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 h-[350px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              </div>
            ) : (
              <ProjectionChart data={projections} />
            )}
          </div>
        </div>

        {/* ── Main HR / Employee Table ── */}
        {isLoadingEmployees ? (
          <div className="p-12 flex items-center justify-center">
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

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-400">
            © 2026 Mar Brasil - People Cockpit
          </p>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full text-slate-500">
            Versão {APP_VERSION}
          </span>
        </footer>

      </div>

      {/* Side drawers & modals */}
      <SideDrawer
        isOpen={isDrawerOpen && !isProfileDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedEmployee(undefined);
        }}
        employeeId={selectedEmployee}
        onDataChanged={fetchData}
        onAddNewLoan={() => setIsNewLoanOpen(true)}
      />

      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setIsProfileDrawerOpen(false);
          setSelectedEmployee(undefined);
        }}
        employeeId={selectedEmployee}
        onDataChanged={fetchData}
      />

      <PaymentProcessingModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      />

      <NewLoanModal
        isOpen={isNewLoanOpen}
        onClose={() => setIsNewLoanOpen(false)}
        onSuccess={fetchData}
        onGenerateTerm={(loanData) => {
          PDFService.generateDebtTermPDF(loanData, {}, isTestMode);
        }}
      />

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        employeeName={deleteTarget?.name || ""}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
