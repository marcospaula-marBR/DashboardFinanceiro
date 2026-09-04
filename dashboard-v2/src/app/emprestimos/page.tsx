"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HeaderDashboard } from "@/components/layout/HeaderDashboard";
import { FilterBar, FilterValues } from "@/components/loans/FilterBar";
import { StatCard } from "@/components/loans/StatCard";
import { DashboardCharts } from "@/components/loans/DashboardCharts";
import { EmployeeTable } from "@/components/loans/EmployeeTable";
import { SideDrawer } from "@/components/loans/SideDrawer";
import { PaymentProcessingModal } from "@/components/loans/PaymentProcessingModal";
import { NewLoanModal } from "@/components/loans/NewLoanModal";
import { AuditPanel } from "@/components/loans/AuditPanel";
import { LoansService, formatCurrency } from "@/services/loans.service";
import { Employee, LoanStats, ProjectionData } from "@/types/loans";
import { useDataMode } from "@/contexts/DataModeContext";
import { APP_VERSION } from "@/version";
import { 
  Receipt, 
  PiggyBank, 
  HandCoins, 
  CalendarClock, 
  FileCheck, 
  Files, 
  TrendingUp, 
  Timer,
  Loader2,
  AlertCircle,
  CreditCard,
  X
} from "lucide-react";

export default function EmprestimosPage() {
  const { isTestMode } = useDataMode();
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string | undefined>(undefined);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isChartsOpen, setIsChartsOpen] = useState(false);

  interface CardDetailItem {
    id: string;
    initials: string;
    company: string;
    value1: string | number;
    value2?: string | number;
    value3?: string | number;
    status?: string;
  }

  const [detailsModal, setDetailsModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    headers: string[];
    items: CardDetailItem[];
  }>({
    isOpen: false,
    title: "",
    subtitle: "",
    headers: [],
    items: [],
  });

  const getInitials = (fullName: string) => {
    if (!fullName) return "-";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const openTotalEmprestadoDetails = () => {
    const items = filteredEmployees
      .filter(e => e.totalTaken > 0)
      .map(e => ({
        id: e.id,
        initials: getInitials(e.name),
        company: e.company,
        value1: formatCurrency(e.totalTaken),
        value2: e.loanStatus || "-",
        status: e.loanStatus
      }));

    setDetailsModal({
      isOpen: true,
      title: "Detalhamento de Empréstimos Concedidos",
      subtitle: "Histórico geral de todos os empréstimos registrados para a seleção atual",
      headers: ["Colaborador (Iniciais)", "Empresa", "Valor Emprestado", "Status"],
      items
    });
  };

  const openSaldoDevedorDetails = () => {
    const items = filteredEmployees
      .filter(e => e.balance > 0)
      .map(e => ({
        id: e.id,
        initials: getInitials(e.name),
        company: e.company,
        value1: formatCurrency(e.balance),
        value2: `${e.remainingInstallments ?? 0} parcelas`,
        status: e.loanStatus
      }));

    setDetailsModal({
      isOpen: true,
      title: "Detalhamento do Saldo Devedor",
      subtitle: "Contratos ativos com valores em aberto a receber",
      headers: ["Colaborador (Iniciais)", "Empresa", "Saldo Devedor", "Restantes", "Status"],
      items
    });
  };

  const openTotalRecebidoDetails = () => {
    const items = filteredEmployees
      .filter(e => e.totalTaken > 0)
      .map(e => ({
        id: e.id,
        initials: getInitials(e.name),
        company: e.company,
        value1: formatCurrency(e.totalTaken),
        value2: formatCurrency(e.totalReceived),
        status: e.loanStatus
      }));

    setDetailsModal({
      isOpen: true,
      title: "Detalhamento de Valores Amortizados",
      subtitle: "Total amortizado e liquidado dos empréstimos",
      headers: ["Colaborador (Iniciais)", "Empresa", "Valor Concedido", "Total Já Pago", "Status"],
      items
    });
  };

  const openTotalMesDetails = () => {
    const items = filteredEmployees
      .filter(e => e.monthInstallment > 0)
      .map(e => ({
        id: e.id,
        initials: getInitials(e.name),
        company: e.company,
        value1: formatCurrency(e.monthInstallment),
        value2: e.loanStatus || "-",
        status: e.loanStatus
      }));

    setDetailsModal({
      isOpen: true,
      title: "Recebíveis Realizados no Ciclo",
      subtitle: "Parcelas e descontos em folha realizados (pagos) no mês de faturamento",
      headers: ["Colaborador (Iniciais)", "Empresa", "Valor Pago", "Status"],
      items
    });
  };

  const openColaboradoresAtivosDetails = () => {
    const items = filteredEmployees
      .filter(e => e.loanStatus === 'Ativo')
      .map(e => ({
        id: e.id,
        initials: getInitials(e.name),
        company: e.company,
        value1: e.job_role || "-",
        value2: formatCurrency(e.balance),
        status: e.loanStatus
      }));

    setDetailsModal({
      isOpen: true,
      title: "Colaboradores com Contratos Ativos",
      subtitle: "Empréstimos com parcelas pendentes de desconto",
      headers: ["Colaborador (Iniciais)", "Empresa", "Cargo", "Saldo Devedor", "Status"],
      items
    });
  };

  const openTotalmenteQuitadosDetails = () => {
    const items = filteredEmployees
      .filter(e => e.totalTaken > 0 && e.balance <= 0)
      .map(e => ({
        id: e.id,
        initials: getInitials(e.name),
        company: e.company,
        value1: formatCurrency(e.totalTaken),
        value2: "Quitado",
        status: "Quitado"
      }));

    setDetailsModal({
      isOpen: true,
      title: "Contratos Totalmente Quitados",
      subtitle: "Empréstimos que foram quitados integralmente",
      headers: ["Colaborador (Iniciais)", "Empresa", "Total Emprestado", "Status"],
      items
    });
  };

  const openUltimaParcelaDetails = () => {
    const items = filteredEmployees
      .filter(e => e.lastInstallmentDate && e.lastInstallmentDate !== '-')
      .sort((a, b) => (b.lastInstallmentDate || '').localeCompare(a.lastInstallmentDate || ''))
      .map(e => ({
        id: e.id,
        initials: getInitials(e.name),
        company: e.company,
        value1: e.lastInstallmentDate ? new Date(e.lastInstallmentDate + 'T12:00:00').toLocaleDateString('pt-BR') : "-",
        value2: formatCurrency(e.monthInstallment || 0),
        status: e.loanStatus
      }));

    setDetailsModal({
      isOpen: true,
      title: "Cronograma de Término de Contratos (Última Parcela)",
      subtitle: "Datas da última parcela dos empréstimos ordenadas das mais distantes para as mais próximas",
      headers: ["Colaborador (Iniciais)", "Empresa", "Data da Última Parcela", "Valor Parcela", "Status"],
      items
    });
  };

  const openProximoEncerrarDetails = () => {
    const items = filteredEmployees
      .filter(e => e.loanStatus === 'Ativo' && e.lastInstallmentDate && e.lastInstallmentDate !== '-')
      .sort((a, b) => (a.lastInstallmentDate || '').localeCompare(b.lastInstallmentDate || ''))
      .map(e => ({
        id: e.id,
        initials: getInitials(e.name),
        company: e.company,
        value1: e.lastInstallmentDate ? new Date(e.lastInstallmentDate + 'T12:00:00').toLocaleDateString('pt-BR') : "-",
        value2: `${e.remainingInstallments ?? 0} restantes`,
        status: e.loanStatus
      }));

    setDetailsModal({
      isOpen: true,
      title: "Contratos Próximos de Encerrar",
      subtitle: "Empréstimos ativos ordenados por proximidade de encerramento",
      headers: ["Colaborador (Iniciais)", "Empresa", "Mês de Encerramento", "Parcelas Restantes", "Status"],
      items
    });
  };
  
  // Data states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<LoanStats | null>(null);
  const [projections, setProjections] = useState<ProjectionData[]>([]);
  const [historyData, setHistoryData] = useState<ProjectionData[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterValues>({
    search: "",
    empresa: "",
    vinculo: "",
    status: "",
    cargo: "",
    remuneracaoRange: "",
    temAditivo: "",
    incluirQuitados: false,
    mostrarTodos: false,
  });
  
  // Lista de colaboradores com contrato vencendo (<= 10 dias)
  const [expiringEmployees, setExpiringEmployees] = useState<Employee[]>([]);

  // Calcula os totais dos cards dinamicamente a partir do array filtrado
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
  
  // ─── Integração com BrisinhAI (Widget Flutuante) ──────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    (window as any).getPageContext = () => ({
      pageType: 'EMPRESTIMOS_PARCELAMENTOS',
      filtros: activeFilters,
      indicadores: [
        { indicador: 'Saldo Devedor Total', valor: formatCurrency(filteredStats?.saldoDevedor || 0), detalhe: 'Valores em aberto a receber' },
        { indicador: 'Total Já Recebido/Amortizado', valor: formatCurrency(filteredStats?.totalRecebido || 0), detalhe: 'Amortizações realizadas' },
        { indicador: 'Recebível Previsto no Mês', valor: formatCurrency(filteredStats?.recebivelMes || 0), detalhe: 'Desconto em folha previsto' },
        { indicador: 'Contratos Ativos', valor: String(filteredStats?.contratosAtivos || 0), detalhe: 'Empréstimos vigentes' },
        { indicador: 'Contratos Liquidados/Quitados', valor: String(filteredStats?.contratosLiquidados || 0), detalhe: '100% amortizados' },
        { indicador: 'Contratos Vencendo em Breve', valor: String(expiringEmployees.length), detalhe: '<= 10 dias de vigência' }
      ],
      resumo: {
        totalColaboradoresComEmprestimo: filteredEmployees.length,
        totalEmprestadoConcedido: formatCurrency(filteredStats?.totalEmprestado || 0),
        saldoDevedor: formatCurrency(filteredStats?.saldoDevedor || 0),
        recebivelMes: formatCurrency(filteredStats?.recebivelMes || 0),
        amostraContratos: filteredEmployees.slice(0, 8).map(e => ({
          colaborador: e.name,
          empresa: e.company,
          saldo: formatCurrency(e.balance),
          parcela: formatCurrency(e.monthInstallment),
          status: e.loanStatus
        }))
      },
      dataSummary: `Módulo Empréstimos & Parcelamentos Mar Brasil: Saldo devedor total: ${formatCurrency(filteredStats?.saldoDevedor || 0)}. Recebível no mês: ${formatCurrency(filteredStats?.recebivelMes || 0)}. Contratos ativos: ${filteredStats?.contratosAtivos || 0}.`
    });

    return () => {
      delete (window as any).getPageContext;
    };
  }, [filteredStats, filteredEmployees, activeFilters, expiringEmployees]);

  // Loading states
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingProjections, setIsLoadingProjections] = useState(true);
  
  // Error states
  const [error, setError] = useState<string | null>(null);

  // Fetch data on mount and when test mode or active filters change
  useEffect(() => {
    fetchData(activeFilters);
  }, [isTestMode, activeFilters?.mostrarTodos]);

  const fetchData = async (filters?: FilterValues) => {
    setError(null);
    
    try {
      // Fetch stats
      setIsLoadingStats(true);
      const statsData = await LoansService.getStats(isTestMode);
      setStats(statsData);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
      setError('Falha ao carregar estatísticas');
    } finally {
      setIsLoadingStats(false);
    }

    try {
      // Fetch employees
      setIsLoadingEmployees(true);
      const currentFilters = filters || activeFilters;
      const employeesData = await LoansService.getEmployees(currentFilters, isTestMode);
      setEmployees(employeesData);
      applyLocalFilters(employeesData, currentFilters);
    } catch (err) {
      console.error('Erro ao carregar colaboradores:', err);
      setError('Falha ao carregar colaboradores');
    } finally {
      setIsLoadingEmployees(false);
    }

    // Check for expiring contracts
    try {
      const allEmps = await LoansService.getEmployees({ mostrarTodos: true }, isTestMode);
      const now = new Date();
      const warningThreshold = new Date();
      warningThreshold.setDate(now.getDate() + 10);

      const expiring = allEmps.filter(e => {
        if (!e.contract_expiry_date) return false;
        const expiry = new Date(e.contract_expiry_date + 'T12:00:00');
        return expiry >= now && expiry <= warningThreshold;
      });
      setExpiringEmployees(expiring);
    } catch (err) {
      console.error('Erro ao verificar vencimentos:', err);
    }

    try {
      // Fetch projections and history
      setIsLoadingProjections(true);
      const [projectionsData, historyDataRes] = await Promise.all([
        LoansService.getProjections(isTestMode),
        LoansService.getPastPayments(isTestMode),
      ]);
      setProjections(projectionsData);
      setHistoryData(historyDataRes);
    } catch (err) {
      console.error('Erro ao carregar gráficos:', err);
    } finally {
      setIsLoadingProjections(false);
    }
  };

  const handleEmployeeClick = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    setIsDrawerOpen(true);
  };

  const handleCreateEmployeeClick = () => {
    router.push('/people');
  };

  const handleFilterChange = (filters: FilterValues) => {
    setActiveFilters(filters);
    applyLocalFilters(employees, filters);
  };

  const applyLocalFilters = (baseList: Employee[], filters: FilterValues) => {
    let result = [...baseList];

    if (!filters.incluirQuitados) {
      result = result.filter(e => {
        // Threshold de R$0,01 para cobrir imprecisões de floating-point
        // (ex: balance = 0.005 exibido como R$ 0,00 mas tecnicamente positivo)
        if (e.totalTaken > 0 && e.balance < 0.01) return false;
        return true;
      });
    }

    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(e => e.name.toLowerCase().includes(term));
    }
    if (filters.empresa) {
      result = result.filter(e => e.company === filters.empresa);
    }
    if (filters.vinculo) {
      result = result.filter(e => e.linkType === filters.vinculo);
    }
    
    // Novos Filtros
    if (filters.status) {
      result = result.filter(e => e.status === filters.status);
    }
    
    if (filters.cargo) {
      const cargoTerm = filters.cargo.toLowerCase();
      result = result.filter(e => (e.job_role || '').toLowerCase().includes(cargoTerm));
    }
    
    if (filters.remuneracaoRange) {
      result = result.filter(e => {
        const salary = e.remuneration || 0;
        switch (filters.remuneracaoRange) {
          case 'ate2k': return salary < 2000;
          case '2k-3.5k': return salary >= 2000 && salary < 3500;
          case '3.5k-5k': return salary >= 3500 && salary <= 5000;
          case 'acima5k': return salary > 5000;
          default: return true;
        }
      });
    }
    
    if (filters.temAditivo !== '') {
      const wantAditive = filters.temAditivo === 'sim';
      result = result.filter(e => {
        const count = e.aditivoCount || 0;
        return wantAditive ? count > 0 : count === 0;
      });
    }

    setFilteredEmployees(result);
  };

  const StatCardSkeleton = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-pulse">
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
          activeFilters={activeFilters} 
          isTestMode={isTestMode} 
          onCreateEmployee={handleCreateEmployeeClick}
          onOpenNewLoan={() => setIsNewLoanOpen(true)}
        />
        
        <FilterBar onFilterChange={handleFilterChange} />

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            <span className="text-sm font-medium">{error}</span>
            <button 
              onClick={() => fetchData(activeFilters)}
              className="ml-auto text-xs font-semibold underline hover:no-underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {expiringEmployees.length > 0 && (
          <div className="mb-6 p-1 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl border border-amber-200/50 shadow-sm animate-in fade-in slide-in-from-top-4 duration-700">
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
                  Identificamos contratos ou aditivos com vencimento nos próximos 10 dias. Recomenda-se a renovação ou baixa:
                </p>
                <div className="flex flex-wrap gap-2">
                  {expiringEmployees.map(e => {
                    const expiry = new Date(e.contract_expiry_date! + 'T12:00:00');
                    const diffTime = expiry.getTime() - new Date().getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    return (
                      <button 
                        key={e.id}
                        onClick={() => handleEmployeeClick(e.id)}
                        className="group relative px-3 py-2 bg-white border border-slate-200 rounded-xl hover:border-amber-400 hover:shadow-md transition-all flex items-center gap-3 overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/0 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-1.5 h-8 bg-amber-500 rounded-full" />
                        <div className="text-left">
                          <div className="text-[11px] font-bold text-slate-900 group-hover:text-amber-700 transition-colors uppercase leading-none mb-1">
                            {e.name}
                          </div>
                          <div className="text-[9px] font-medium text-slate-500 flex items-center gap-1">
                            <Timer size={10} />
                            Vence em {diffDays} {diffDays === 1 ? 'dia' : 'dias'} ({new Date(e.contract_expiry_date!).toLocaleDateString('pt-BR')})
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

        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md"
          >
            <CreditCard size={18} />
            Processar Parcelas
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
                value={formatCurrency(filteredStats.totalEmprestado)}
                icon={<Receipt size={22} />}
                color="blue"
                onClick={openTotalEmprestadoDetails}
              />
              <StatCard 
                title="Saldo Devedor"
                value={formatCurrency(filteredStats.saldoDevedor)}
                icon={<PiggyBank size={22} />}
                color="red"
                onClick={openSaldoDevedorDetails}
              />
              <StatCard 
                title="Total Já Recebido"
                value={formatCurrency(filteredStats.totalRecebido)}
                icon={<HandCoins size={22} />}
                color="green"
                onClick={openTotalRecebidoDetails}
              />
              <StatCard 
                title="Total Mês"
                value={formatCurrency(filteredStats.recebivelMes)}
                icon={<CalendarClock size={22} />}
                color="emerald"
                onClick={openTotalMesDetails}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                title="Colaboradores Ativos"
                value={filteredStats.contratosAtivos.toString()}
                icon={<FileCheck size={22} />}
                color="purple"
                description="Com dívida ativa"
                onClick={openColaboradoresAtivosDetails}
              />
              <StatCard 
                title="Totalmente Quitados"
                value={filteredStats.contratosLiquidados.toString()}
                icon={<Files size={22} />}
                color="amber"
                description="Sem dívida pendente"
                onClick={openTotalmenteQuitadosDetails}
              />
              <StatCard 
                title="Última Parcela"
                value={stats?.ultimaParcelaMes ?? '-'}
                icon={<CalendarClock size={22} />}
                color="sky"
                description={stats?.ultimaParcelaValor ? `Valor: ${formatCurrency(stats.ultimaParcelaValor)}` : 'Nenhuma'}
                onClick={openUltimaParcelaDetails}
              />
              <StatCard 
                title="Próximo a Encerrar"
                value={stats?.proximoEncerrar ?? '-'}
                icon={<Timer size={22} />}
                color="slate"
                description={stats?.proximoEncerrarValor ? `Valor: ${formatCurrency(stats.proximoEncerrarValor)} (${stats.parcelasRestantes} rest.)` : 'Nenhum'}
                onClick={openProximoEncerrarDetails}
              />
            </>
          )}
        </div>

        <div className="mb-6">
          <button
            onClick={() => setIsChartsOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-sm transition-all text-sm font-bold text-slate-700 group"
          >
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs">📊</span>
              Painel Analítico de Contratos
            </span>
            <span className="text-xs font-medium text-slate-400 group-hover:text-emerald-600 transition-colors">
              {isChartsOpen ? "Fechar ▲" : "Abrir ▼"}
            </span>
          </button>
          {isChartsOpen && (
            <div className="mt-3">
              {isLoadingProjections ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 h-[480px] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                </div>
              ) : (
                <DashboardCharts 
                  projectionsData={projections} 
                  historyData={historyData}
                  employees={filteredEmployees}
                />
              )}
            </div>
          )}
        </div>

        {/* Painel de Auditoria (colapsavel) */}
        <div className="mb-6">
          <button
            onClick={() => setIsAuditOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-sm transition-all text-sm font-bold text-slate-700 group"
          >
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs">🔍</span>
              Painel de Auditoria de Contratos
            </span>
            <span className="text-xs font-medium text-slate-400 group-hover:text-emerald-600 transition-colors">
              {isAuditOpen ? "Fechar ▲" : "Abrir ▼"}
            </span>
          </button>
          {isAuditOpen && (
            <div className="mt-3">
              <AuditPanel />
            </div>
          )}
        </div>

        {isLoadingEmployees ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
        ) : (
          <EmployeeTable 
            employees={filteredEmployees}
            onEmployeeClick={handleEmployeeClick} 
          />
        )}

        <footer className="mt-12 pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-400">
            © 2026 Mar Brasil - Empréstimos Cockpit
          </p>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full text-slate-500">
            Versão {APP_VERSION}
          </span>
        </footer>
      </div>

      <SideDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedEmployee(undefined);
        }} 
        employeeId={selectedEmployee}
        onDataChanged={fetchData}
        onAddNewLoan={() => setIsNewLoanOpen(true)}
      />

      <PaymentProcessingModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      />

      <NewLoanModal 
        isOpen={isNewLoanOpen} 
        onClose={() => setIsNewLoanOpen(false)} 
        onSuccess={() => fetchData(activeFilters)}
        onGenerateTerm={async (loanData) => {
          const { PDFService } = await import('@/services/pdf.service');
          PDFService.generateDebtTermPDF(loanData, {}, isTestMode);
        }}
      />

      {/* Modal de Detalhes dos Cards */}
      {detailsModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {detailsModal.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {detailsModal.subtitle}
                </p>
              </div>
              <button
                onClick={() => setDetailsModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {detailsModal.items.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">
                  Nenhum registro encontrado.
                </div>
              ) : (
                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full border-collapse text-left text-xs text-slate-500">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                      <tr>
                        {detailsModal.headers.map((h, idx) => (
                          <th key={idx} className="px-4 py-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailsModal.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {item.initials}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.company}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {item.value1}
                          </td>
                          {detailsModal.headers.length >= 4 && (
                            <td className="px-4 py-3 text-slate-600">
                              {item.value2}
                            </td>
                          )}
                          {detailsModal.headers.length >= 5 && (
                            <td className="px-4 py-3">
                              {item.status ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.status === 'Ativo' 
                                    ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                                    : item.status === 'Quitado' 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    : 'bg-slate-50 text-slate-500 border border-slate-100'
                                }`}>
                                  {item.status}
                                </span>
                              ) : (
                                item.value3
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setDetailsModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
