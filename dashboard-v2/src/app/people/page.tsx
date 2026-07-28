"use client";

import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ProfileDrawer } from "@/components/people/ProfileDrawer";
import { PeopleKpiCard } from "@/components/people/PeopleKpiCard";
import { DeleteConfirmDialog } from "@/components/people/DeleteConfirmDialog";
import { PayrollBatchImportModal } from "@/components/people/PayrollBatchImportModal";
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
  UserCog, Plus, HandCoins, Coins, Landmark, Target,
  ChevronLeft, LayoutGrid, List, HeartPulse, ShieldAlert, Award,
  ChevronDown, TrendingUp, DollarSign, Wallet, Zap, Wifi, BarChart3,
  FileText
} from "lucide-react";
import { 
  isExternalEntity, 
  calculateEmployeeHealth, 
  PeopleClassificationBadge, 
  RelationshipNatureBadge, 
  PeopleHealthBadge 
} from "@/components/people/PeopleBadges";
import { getPBClassification, inferEntityType } from "@/types/loans";
import { PeopleMobileCard } from "@/components/people/PeopleMobileCard";
import { PeopleEcosystemMap } from "@/components/people/PeopleEcosystemMap";

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
  const [isPayrollBatchModalOpen, setIsPayrollBatchModalOpen] = useState(false);
  
  // C-Level Executive Drawer States
  const [activeKpiMode, setActiveKpiMode] = useState<"headcount" | "headcount_clt" | "headcount_pj" | "payroll_clt" | "payroll_pj" | "loans" | "health" | "audit" | "strategic" | "nopbid" | null>(null);
  const [isKpiDrawerOpen, setIsKpiDrawerOpen] = useState(false);
  const [loanStats, setLoanStats] = useState<LoanStats | null>(null);

  // UI states
  const [showValues, setShowValues] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'map'>('grid');
  
  // Pagination for grid mode
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [expandAllCards, setExpandAllCards] = useState(false);

  // Filters state
  const [filterSearch, setFilterSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>(['Ativo']);
  const [filterVinculo, setFilterVinculo] = useState<string[]>([]);
  const [filterSetor, setFilterSetor] = useState<string[]>([]);
  const [filterGrau, setFilterGrau] = useState<string[]>([]);
  const [filterTerceirizado, setFilterTerceirizado] = useState<string[]>([]);
  const [filterLocalPrestacao, setFilterLocalPrestacao] = useState<string[]>([]);
  const [filterRegimeTributario, setFilterRegimeTributario] = useState<string[]>([]);
  const [showInativos, setShowInativos] = useState(false);

  // Novas variáveis de filtros do Cockpit
  const [filterEntityType, setFilterEntityType] = useState<string[]>([]);
  const [filterRelationshipNature, setFilterRelationshipNature] = useState<string[]>([]);
  const [filterLevel, setFilterLevel] = useState<string[]>([]);
  const [filterQuality, setFilterQuality] = useState<string[]>([]);
  const [filterHasPbId, setFilterHasPbId] = useState<string[]>([]);
  
  // Insights & Alerts states
  const [noRaiseMonths, setNoRaiseMonths] = useState(6);
  const [isCostSectionOpen, setIsCostSectionOpen] = useState(false);
  const [costDetailMode, setCostDetailMode] = useState<'fixo'|'bonus'|'comissao'|'incentivos'|'conectividade'|'total'|null>(null);
  const [noPromoMonths, setNoPromoMonths] = useState(6);
  const [noGradeMonths, setNoGradeMonths] = useState(6);
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

  // Reset pagination when filter values change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    filterSearch,
    filterEmpresa,
    filterStatus,
    filterVinculo,
    filterSetor,
    filterGrau,
    filterTerceirizado,
    filterLocalPrestacao,
    filterRegimeTributario,
    filterEntityType,
    filterRelationshipNature,
    filterLevel,
    filterQuality,
    filterHasPbId,
    showInativos,
    filterInsight
  ]);

  // Verificar se há filtros ativos
  const hasActiveFilters = useMemo(() => {
    return (
      filterSearch !== '' ||
      filterEmpresa.length > 0 ||
      filterStatus.length > 0 ||
      filterVinculo.length > 0 ||
      filterSetor.length > 0 ||
      filterGrau.length > 0 ||
      filterTerceirizado.length > 0 ||
      filterLocalPrestacao.length > 0 ||
      filterRegimeTributario.length > 0 ||
      filterEntityType.length > 0 ||
      filterRelationshipNature.length > 0 ||
      filterLevel.length > 0 ||
      filterQuality.length > 0 ||
      filterHasPbId.length > 0 ||
      showInativos ||
      filterInsight !== null
    );
  }, [
    filterSearch, filterEmpresa, filterStatus, filterVinculo, filterSetor, filterGrau,
    filterTerceirizado, filterLocalPrestacao, filterRegimeTributario,
    filterEntityType, filterRelationshipNature, filterLevel, filterQuality, filterHasPbId,
    showInativos, filterInsight
  ]);

  // ----- 10 KPIs Reativos do Cockpit baseados em Runtime -----
  const cockpitKpis = useMemo(() => {
    // Apenas ativos na visão filtrada
    const activeFiltered = filteredEmployees.filter(e => e.status !== 'Inativo');
    
    // CLT/Estágio Físicos
    const cltList = activeFiltered.filter(e => !isExternalEntity(e.entityType) && (e.linkType === 'CLT' || e.linkType === 'Estagiário'));
    const cltCount = cltList.length;
    
    // PJ / Externos
    const pjList = activeFiltered.filter(e => isExternalEntity(e.entityType));
    const pjCount = pjList.length;
    
    // Custo CLT (leitura base remuneração dos CLT/Estágio ativos)
    const cltCostTotal = cltList.reduce((sum, e) => sum + (e.remuneration_fixed || e.remuneration || 0), 0);
    
    // Custo PJ (leitura base do contrato de prestadores ativos)
    const pjCostTotal = pjList.reduce((sum, e) => sum + (e.remuneration_fixed || e.remuneration || 0), 0);
    
    // Saldo Devedor Consignado (leitura runtime segura)
    const totalLoansDebt = activeFiltered.reduce((sum, e) => sum + (e.balance || 0), 0);
    
    // Alertas de Auditoria
    const totalAuditIssues = activeFiltered.reduce((sum, e) => {
      const issues = allAuditIssues[e.id] || [];
      return sum + issues.length;
    }, 0);
    
    // Saúde Cadastral Crítica
    const criticalHealthCount = activeFiltered.filter(e => {
      const health = calculateEmployeeHealth(e);
      return health.status === "Crítico";
    }).length;
    
    // Nível Estratégico (E)
    const strategicCount = activeFiltered.filter(e => {
      const classification = getPBClassification(e.nivel, e.grau);
      return classification.startsWith("E");
    }).length;
    
    // Cadastros sem PB-ID
    const noPbIdCount = activeFiltered.filter(e => !(e.pbId || e.metadata?.pbId)).length;
    
    return {
      totalCount: activeFiltered.length,
      cltCount,
      pjCount,
      cltCostTotal,
      pjCostTotal,
      totalLoansDebt,
      totalAuditIssues,
      criticalHealthCount,
      strategicCount,
      noPbIdCount
    };
  }, [filteredEmployees, allAuditIssues]);

  // 💰 Custos Históricos — agrega monthlyCosts dos colaboradores filtrados
  const historicalCostsSummary = useMemo(() => {
    const filteredIds = new Set(filteredEmployees.map(e => e.id));
    const relevantCosts = monthlyCosts.filter(c => filteredIds.has(c.employee_id));
    const count = filteredEmployees.length || 1;

    const totalFixo = relevantCosts.reduce((s, c) => s + (c.valor_fixo || 0), 0);
    const totalBonus = relevantCosts.reduce((s, c) => s + (c.valor_bonus || 0), 0);
    const totalComissao = relevantCosts.reduce((s, c) => s + (c.valor_comissao || 0), 0);
    const totalIncentivos = relevantCosts.reduce((s, c) => s + (c.valor_incentivos || 0), 0);
    // Conectividade: calculada a partir do campo remuneration_connectivity dos colaboradores filtrados
    const totalConectividade = filteredEmployees.reduce((s, e) => s + (e.remuneration_connectivity || 0), 0);
    const totalGeral = totalFixo + totalBonus + totalComissao + totalIncentivos + totalConectividade;

    return {
      totalFixo,    avgFixo: totalFixo / count,
      totalBonus,   avgBonus: totalBonus / count,
      totalComissao, avgComissao: totalComissao / count,
      totalIncentivos, avgIncentivos: totalIncentivos / count,
      totalConectividade, avgConectividade: totalConectividade / count,
      totalGeral,   avgGeral: totalGeral / count,
      count,
    };
  }, [filteredEmployees, monthlyCosts]);

  // Unique filter options from data
  const setores = useMemo(() => {
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

  // Base filtering logic
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
    
    // Filtro por Tipo de Entidade (PF vs PJ)
    if (filterEntityType.length > 0) {
      result = result.filter(e => {
        const type = inferEntityType(e);
        const isPF = !isExternalEntity(type);
        return (
          (filterEntityType.includes("internal_person") && isPF) ||
          (filterEntityType.includes("legal_entity") && !isPF)
        );
      });
    }

    // Filtro por Natureza da Relação
    if (filterRelationshipNature.length > 0) {
      result = result.filter(e => filterRelationshipNature.includes(e.relationshipNature || ''));
    }

    // Filtro por Nível PB (E, T, O)
    if (filterLevel.length > 0) {
      result = result.filter(e => {
        const classification = getPBClassification(e.nivel, e.grau);
        const lvl = classification.charAt(0);
        return filterLevel.includes(lvl);
      });
    }

    // Filtro por Qualidade Cadastral
    if (filterQuality.length > 0) {
      result = result.filter(e => {
        const health = calculateEmployeeHealth(e);
        return filterQuality.includes(health.status);
      });
    }

    // Filtro por Existência de PB-ID
    if (filterHasPbId.length > 0) {
      result = result.filter(e => {
        const hasId = !!(e.pbId || e.metadata?.pbId);
        return (
          (filterHasPbId.includes("sim") && hasId) ||
          (filterHasPbId.includes("nao") && !hasId)
        );
      });
    }

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
  }, [
    employees, filterSearch, filterEmpresa, filterStatus, filterVinculo, filterSetor, filterGrau,
    filterTerceirizado, filterLocalPrestacao, filterRegimeTributario,
    filterEntityType, filterRelationshipNature, filterLevel, filterQuality, filterHasPbId,
    showInativos
  ]);

  // Apply insight alerts filters
  useEffect(() => {
    let result = [...baseFilteredEmployees];
    
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
        if (filterInsight === 'grau') {
          const d = new Date((e.last_grade_date || e.start_date || '') + 'T00:00:00');
          if (isNaN(d.getTime())) return false;
          const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
          return diffMonths >= noGradeMonths;
        }
        return true;
      });
    }
    
    setFilteredEmployees(result);
  }, [baseFilteredEmployees, filterInsight, noRaiseMonths, noPromoMonths, noGradeMonths]);

  // Booleano para saber se há qualquer filtro ativo no cockpit
  const hasActiveFilters = useMemo(() => {
    return !!(
      filterSearch ||
      filterEmpresa.length > 0 ||
      filterStatus.length > 0 ||
      filterVinculo.length > 0 ||
      filterSetor.length > 0 ||
      filterGrau.length > 0 ||
      filterTerceirizado.length > 0 ||
      filterLocalPrestacao.length > 0 ||
      filterRegimeTributario.length > 0 ||
      filterEntityType.length > 0 ||
      filterRelationshipNature.length > 0 ||
      filterLevel.length > 0 ||
      filterQuality.length > 0 ||
      filterHasPbId.length > 0 ||
      filterInsight ||
      showInativos
    );
  }, [
    filterSearch, filterEmpresa, filterStatus, filterVinculo, filterSetor, filterGrau,
    filterTerceirizado, filterLocalPrestacao, filterRegimeTributario, filterEntityType,
    filterRelationshipNature, filterLevel, filterQuality, filterHasPbId, filterInsight, showInativos
  ]);

  // Pagination slice for grid view
  const paginatedGridEmployees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(start, start + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage) || 1;

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
    setFilterEntityType([]);
    setFilterRelationshipNature([]);
    setFilterLevel([]);
    setFilterQuality([]);
    setFilterHasPbId([]);
    setFilterInsight(null);
    setShowInativos(false);
  };

  const insightCounts = useMemo(() => {
    const now = new Date();
    let glosa = 0;
    let emprestimo = 0;
    let aumento = 0;
    let promocao = 0;
    let grau = 0;

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

      const dGrade = new Date((e.last_grade_date || e.start_date || '') + 'T00:00:00');
      if (!isNaN(dGrade.getTime())) {
        const diffMonths = (now.getFullYear() - dGrade.getFullYear()) * 12 + (now.getMonth() - dGrade.getMonth());
        if (diffMonths >= noGradeMonths) grau++;
      }
    });
    return { glosa, emprestimo, aumento, promocao, grau };
  }, [baseFilteredEmployees, noRaiseMonths, noPromoMonths, noGradeMonths]);

  const handleEmployeeClick = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    setIsProfileDrawerOpen(true);
  };

  const handleFilterSelect = (type: 'company' | 'department' | 'job_role' | 'responsible_name' | 'linkType' | 'nature' | 'name' | 'level' | 'location', value: string) => {
    if (type === 'name' || type === 'responsible_name' || type === 'job_role') {
      setFilterSearch(value);
    } else if (type === 'company') {
      setFilterEmpresa([value]);
    } else if (type === 'location') {
      setFilterLocalPrestacao([value]);
    } else if (type === 'department') {
      setFilterSetor([value]);
    } else if (type === 'nature') {
      setFilterRelationshipNature([value]);
    } else if (type === 'level') {
      setFilterLevel([value]);
    }
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
                placeholder="Nome, cargo, CNPJ..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white placeholder-slate-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Tipo de Entidade</label>
            <MultiSelectDropdown
              value={filterEntityType}
              onChange={setFilterEntityType}
              placeholder="Todos os Perfis"
              options={[
                { label: 'Pessoa Física (PF Interno)', value: 'internal_person' },
                { label: 'Pessoa Jurídica (PJ/Parceiros)', value: 'legal_entity' }
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Natureza PB</label>
            <MultiSelectDropdown
              value={filterRelationshipNature}
              onChange={setFilterRelationshipNature}
              placeholder="Todas as Naturezas"
              options={[
                { label: 'Integrador CLT', value: 'clt_internal' },
                { label: 'Prestador PJ', value: 'pj_specialized' },
                { label: 'Empresa Credenciada', value: 'accredited_company' },
                { label: 'Parceiro Estratégico', value: 'strategic_partner' },
                { label: 'Fornecedor Homologado', value: 'approved_supplier' },
                { label: 'Consultoria Externa', value: 'external_consultancy' },
                { label: 'Membro do Conselho', value: 'council_member' },
                { label: 'Acionista', value: 'shareholder' },
                { label: 'Sócio Fundador', value: 'founder' }
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Nível PB</label>
            <MultiSelectDropdown
              value={filterLevel}
              onChange={setFilterLevel}
              placeholder="Todos os Níveis"
              options={[
                { label: 'Estratégico (E)', value: 'E' },
                { label: 'Tático (T)', value: 'T' },
                { label: 'Operacional (O)', value: 'O' }
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Qualidade Cadastral</label>
            <MultiSelectDropdown
              value={filterQuality}
              onChange={setFilterQuality}
              placeholder="Todas as Qualidades"
              options={[
                { label: 'Completo (100%)', value: 'Completo' },
                { label: 'Atenção (80-99%)', value: 'Atenção' },
                { label: 'Incompleto (50-79%)', value: 'Incompleto' },
                { label: 'Crítico (<50%)', value: 'Crítico' }
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Possui PB-ID</label>
            <MultiSelectDropdown
              value={filterHasPbId}
              onChange={setFilterHasPbId}
              placeholder="Ambos"
              options={[
                { label: 'Sim', value: 'sim' },
                { label: 'Não', value: 'nao' }
              ]}
            />
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
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Vínculo Histórico</label>
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
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Grau de Maturidade</label>
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
                    <h2 className="text-xs font-black uppercase">Filtros Cockpit</h2>
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
                      placeholder="Nome, cargo, CNPJ..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-white placeholder-slate-500 transition-all"
                    />
                  </div>
                </div>

                {/* Entity Type select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Tipo de Entidade</label>
                  <MultiSelectDropdown
                    value={filterEntityType}
                    onChange={setFilterEntityType}
                    placeholder="Todos os Perfis"
                    options={[
                      { label: 'Pessoa Física (PF Interno)', value: 'internal_person' },
                      { label: 'Pessoa Jurídica (PJ/Parceiros)', value: 'legal_entity' }
                    ]}
                  />
                </div>

                {/* Relationship Nature select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Natureza PB</label>
                  <MultiSelectDropdown
                    value={filterRelationshipNature}
                    onChange={setFilterRelationshipNature}
                    placeholder="Todas as Naturezas"
                    options={[
                      { label: 'Integrador CLT', value: 'clt_internal' },
                      { label: 'Prestador PJ', value: 'pj_specialized' },
                      { label: 'Empresa Credenciada', value: 'accredited_company' },
                      { label: 'Parceiro Estratégico', value: 'strategic_partner' },
                      { label: 'Fornecedor Homologado', value: 'approved_supplier' },
                      { label: 'Consultoria Externa', value: 'external_consultancy' },
                      { label: 'Membro do Conselho', value: 'council_member' },
                      { label: 'Acionista', value: 'shareholder' },
                      { label: 'Sócio Fundador', value: 'founder' }
                    ]}
                  />
                </div>

                {/* Level select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Nível PB</label>
                  <MultiSelectDropdown
                    value={filterLevel}
                    onChange={setFilterLevel}
                    placeholder="Todos os Níveis"
                    options={[
                      { label: 'Estratégico (E)', value: 'E' },
                      { label: 'Tático (T)', value: 'T' },
                      { label: 'Operacional (O)', value: 'O' }
                    ]}
                  />
                </div>

                {/* Quality select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Qualidade Cadastral</label>
                  <MultiSelectDropdown
                    value={filterQuality}
                    onChange={setFilterQuality}
                    placeholder="Todas as Qualidades"
                    options={[
                      { label: 'Completo (100%)', value: 'Completo' },
                      { label: 'Atenção (80-99%)', value: 'Atenção' },
                      { label: 'Incompleto (50-79%)', value: 'Incompleto' },
                      { label: 'Crítico (<50%)', value: 'Crítico' }
                    ]}
                  />
                </div>

                {/* Has PB ID select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Possui PB-ID</label>
                  <MultiSelectDropdown
                    value={filterHasPbId}
                    onChange={setFilterHasPbId}
                    placeholder="Ambos"
                    options={[
                      { label: 'Sim', value: 'sim' },
                      { label: 'Não', value: 'nao' }
                    ]}
                  />
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
            <Link
              href="/"
              className="flex items-center gap-1.5 p-2 px-3 rounded-xl border border-slate-200 bg-white hover:border-amber-450 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-all shadow-sm duration-200 active:scale-95 text-xs font-bold"
            >
              <ChevronLeft size={16} />
              <span>Voltar ao Início</span>
            </Link>
            {/* Mobile Sidebar Toggle */}
            <button className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl" onClick={() => setIsMobileSidebarOpen(true)}>
              <Filter size={18} />
            </button>
            <div>
              <h1 className="text-base font-black text-slate-800 tracking-tight uppercase leading-none">Cockpit de Governança</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mt-1">Ecosystem Map & Pessoas</p>
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

            {/* Itens por Página selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-sm text-xs text-slate-500 font-bold shrink-0">
              <span className="text-[9px] text-slate-400 uppercase tracking-tight">Exibir:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setItemsPerPage(val);
                  setCurrentPage(1);
                }}
                className="bg-transparent border-none text-slate-700 font-extrabold focus:ring-0 p-0 text-xs cursor-pointer focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Toggle view mode Cards vs Table vs Map */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0 shadow-inner">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Exibição em Cards"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Exibição em Tabela"
              >
                <List size={15} />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                  viewMode === 'map'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Mapa de Ecossistema (Órbitas & Vínculos)"
              >
                <Target size={15} />
              </button>
            </div>

            {/* Redirect button to the separate Consignado Loans Page */}
            <Link
              href="/emprestimos"
              className="flex items-center gap-1.5 px-4 py-2 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-black transition-all active:scale-95 shrink-0 uppercase"
              title="Ir para a página de Empréstimos Consignados"
            >
              <HandCoins size={14} /> Empréstimos
            </Link>

            {/* Import payroll consolidated PDF button */}
            <button
              onClick={() => setIsPayrollBatchModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black transition-all active:scale-95 shrink-0 uppercase animate-in fade-in"
              title="Importar extrato mensal de folha de pagamento CLT em lote"
            >
              <FileText size={14} /> Importar Folha
            </button>

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

          {/* Banner Indicador de Base Filtrada */}
          {hasActiveFilters && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 px-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Filter size={14} className="animate-pulse" />
                  Visualização Filtrada (Base Filtrada)
                </span>
                <span className="text-[10px] font-medium text-amber-600">
                  Os KPIs abaixo estão refletindo apenas os critérios de filtros ativos.
                </span>
              </div>
              <button 
                onClick={handleClearFilters}
                className="text-[10px] font-black text-amber-700 bg-white border border-amber-200 hover:bg-amber-100 hover:border-amber-300 rounded-xl px-4 py-1.5 uppercase transition-all active:scale-95 shadow-sm"
              >
                Limpar Todos os Filtros
              </button>
            </div>
          )}

          {/* ── 10 HR Cockpit KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <PeopleKpiCard
              title="Integrantes Cockpit"
              value={cockpitKpis.totalCount}
              icon={<Users size={20} />}
              color="slate"
              onClick={() => { setActiveKpiMode('headcount'); setIsKpiDrawerOpen(true); }}
              sub="Total de pessoas e entidades"
            />
            <PeopleKpiCard
              title="Headcount CLT / PF"
              value={cockpitKpis.cltCount}
              icon={<UserCog size={20} />}
              color="blue"
              onClick={() => { setActiveKpiMode('headcount_clt'); setIsKpiDrawerOpen(true); }}
              sub="Integradores internos CLT/Estágio"
            />
            <PeopleKpiCard
              title="Prestadores & PJ"
              value={cockpitKpis.pjCount}
              icon={<Landmark size={20} />}
              color="amber"
              onClick={() => { setActiveKpiMode('headcount_pj'); setIsKpiDrawerOpen(true); }}
              sub="Parceiros, fornecedores e consultores"
            />
            <PeopleKpiCard
              title="Custo CLT (Mensal)"
              value={showValues ? formatCurrency(cockpitKpis.cltCostTotal) : '••••••'}
              icon={<Coins size={20} />}
              color="emerald"
              onClick={() => { setActiveKpiMode('payroll_clt'); setIsKpiDrawerOpen(true); }}
              sub="Soma das remunerações CLT/Estágio"
            />
            <PeopleKpiCard
              title="Custo PJ (Mensal)"
              value={showValues ? formatCurrency(cockpitKpis.pjCostTotal) : '••••••'}
              icon={<Coins size={20} />}
              color="purple"
              onClick={() => { setActiveKpiMode('payroll_pj'); setIsKpiDrawerOpen(true); }}
              sub="Soma dos contratos PJ/MEI ativos"
            />
            <PeopleKpiCard
              title="Saldo Consignado"
              value={showValues ? formatCurrency(cockpitKpis.totalLoansDebt) : '••••••'}
              icon={<HandCoins size={20} />}
              color="slate"
              onClick={() => { setActiveKpiMode('loans'); setIsKpiDrawerOpen(true); }}
              sub="Capital ativo sob risco em empréstimos"
            />
            <PeopleKpiCard
              title="Saúde Crítica"
              value={cockpitKpis.criticalHealthCount}
              icon={<HeartPulse size={20} />}
              color="red"
              onClick={() => { setActiveKpiMode('health'); setIsKpiDrawerOpen(true); }}
              sub="Cadastros com qualidade Crítica (<50%)"
            />
            <PeopleKpiCard
              title="Alertas Auditoria"
              value={cockpitKpis.totalAuditIssues}
              icon={<AlertCircle size={20} />}
              color={cockpitKpis.totalAuditIssues > 0 ? "rose" : "emerald"}
              onClick={() => { setActiveKpiMode('audit'); setIsKpiDrawerOpen(true); }}
              sub="Erros de datas/regime de trabalho"
            />
            <PeopleKpiCard
              title="Níveis"
              value={cockpitKpis.strategicCount}
              icon={<Target size={20} />}
              color="indigo"
              onClick={() => { setActiveKpiMode('strategic'); setIsKpiDrawerOpen(true); }}
              sub="Estrutura de Níveis E, T, O"
            />
            <PeopleKpiCard
              title="Sem PB-ID"
              value={cockpitKpis.noPbIdCount}
              icon={<ShieldAlert size={20} />}
              color="amber"
              onClick={() => { setActiveKpiMode('nopbid'); setIsKpiDrawerOpen(true); }}
              sub="Cadastros sem ID Diana PB associado"
            />
          </div>

          {/* 💰 Custos Históricos — Expansível */}
          <div className="mt-6">
            {/* Banner Toggle */}
            <button
              onClick={() => setIsCostSectionOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all shadow-sm group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 text-emerald-600 shrink-0">
                  <BarChart3 size={18} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Custos Históricos</p>
                  <p className="text-sm font-bold text-slate-700">
                    {historicalCostsSummary.count} colaborador{historicalCostsSummary.count !== 1 ? 'es' : ''} filtrado{historicalCostsSummary.count !== 1 ? 's' : ''}
                  </p>
                </div>
                {!isCostSectionOpen && showValues && (
                  <span className="ml-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                    Total: {formatCurrency(historicalCostsSummary.totalGeral)}
                  </span>
                )}
              </div>
              <ChevronDown
                size={18}
                className={`text-slate-400 transition-transform duration-300 group-hover:text-emerald-600 ${
                  isCostSectionOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isCostSectionOpen && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">

                {/* Card: Fixo */}
                <div
                  onClick={() => setCostDetailMode('fixo')}
                  className="flex flex-col gap-3 p-5 rounded-2xl border border-blue-100 bg-blue-50 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600 shrink-0">
                      <DollarSign size={20} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fixo</p>
                  </div>
                  <p className="text-2xl font-black leading-tight text-blue-700">
                    {showValues ? formatCurrency(historicalCostsSummary.totalFixo) : '••••••'}
                  </p>
                  <p className="text-[11px] text-slate-500">Média: {showValues ? formatCurrency(historicalCostsSummary.avgFixo) : '•••'}</p>
                </div>

                {/* Card: Bônus */}
                <div
                  onClick={() => setCostDetailMode('bonus')}
                  className="flex flex-col gap-3 p-5 rounded-2xl border border-emerald-100 bg-emerald-50 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-100 text-emerald-600 shrink-0">
                      <TrendingUp size={20} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bônus</p>
                  </div>
                  <p className="text-2xl font-black leading-tight text-emerald-700">
                    {showValues ? formatCurrency(historicalCostsSummary.totalBonus) : '••••••'}
                  </p>
                  <p className="text-[11px] text-slate-500">Média: {showValues ? formatCurrency(historicalCostsSummary.avgBonus) : '•••'}</p>
                </div>

                {/* Card: Comissões */}
                <div
                  onClick={() => setCostDetailMode('comissao')}
                  className="flex flex-col gap-3 p-5 rounded-2xl border border-amber-100 bg-amber-50 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600 shrink-0">
                      <Coins size={20} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comissões</p>
                  </div>
                  <p className="text-2xl font-black leading-tight text-amber-700">
                    {showValues ? formatCurrency(historicalCostsSummary.totalComissao) : '••••••'}
                  </p>
                  <p className="text-[11px] text-slate-500">Média: {showValues ? formatCurrency(historicalCostsSummary.avgComissao) : '•••'}</p>
                </div>

                {/* Card: Incentivos */}
                <div
                  onClick={() => setCostDetailMode('incentivos')}
                  className="flex flex-col gap-3 p-5 rounded-2xl border border-indigo-100 bg-indigo-50 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-indigo-100 text-indigo-600 shrink-0">
                      <Zap size={20} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Incentivos</p>
                  </div>
                  <p className="text-2xl font-black leading-tight text-indigo-700">
                    {showValues ? formatCurrency(historicalCostsSummary.totalIncentivos) : '••••••'}
                  </p>
                  <p className="text-[11px] text-slate-500">Média: {showValues ? formatCurrency(historicalCostsSummary.avgIncentivos) : '•••'}</p>
                </div>

                {/* Card: Conectividade */}
                <div
                  onClick={() => setCostDetailMode('conectividade')}
                  className="flex flex-col gap-3 p-5 rounded-2xl border border-cyan-100 bg-cyan-50 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-cyan-100 text-cyan-600 shrink-0">
                      <Wifi size={20} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conectividade</p>
                  </div>
                  <p className="text-2xl font-black leading-tight text-cyan-700">
                    {showValues ? formatCurrency(historicalCostsSummary.totalConectividade) : '••••••'}
                  </p>
                  <p className="text-[11px] text-slate-500">Média: {showValues ? formatCurrency(historicalCostsSummary.avgConectividade) : '•••'}</p>
                </div>

                {/* Card: Total Geral */}
                <div
                  onClick={() => setCostDetailMode('total')}
                  className="flex flex-col gap-3 p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-200 text-emerald-700 shrink-0">
                      <Wallet size={20} />
                    </div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total Geral</p>
                  </div>
                  <p className="text-2xl font-black leading-tight text-emerald-700">
                    {showValues ? formatCurrency(historicalCostsSummary.totalGeral) : '••••••'}
                  </p>
                  <p className="text-[11px] text-slate-500">Média: {showValues ? formatCurrency(historicalCostsSummary.avgGeral) : '•••'}</p>
                </div>
              </div>
            )}
          </div>

          {/* 📄 Modal Auditoria de Custos */}
          {costDetailMode && (
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6"
              onClick={() => setCostDetailMode(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 15 }}
                transition={{ type: 'spring', damping: 30, stiffness: 240 }}
                className="w-full max-w-2xl h-[80vh] bg-slate-900 text-slate-100 flex flex-col border border-slate-800 shadow-2xl rounded-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Modal Header */}
                {(() => {
                  const modeLabels: Record<string, { title: string; icon: ReactNode; color: string }> = {
                    fixo:          { title: 'Custo Fixo por Colaborador',       icon: <DollarSign size={20} />, color: 'text-blue-400' },
                    bonus:         { title: 'Bônus por Colaborador',            icon: <TrendingUp size={20} />, color: 'text-emerald-400' },
                    comissao:      { title: 'Comissões por Colaborador',        icon: <Coins size={20} />,     color: 'text-amber-400' },
                    incentivos:    { title: 'Incentivos por Colaborador',       icon: <Zap size={20} />,       color: 'text-indigo-400' },
                    conectividade: { title: 'Conectividade por Colaborador',   icon: <Wifi size={20} />,      color: 'text-cyan-400' },
                    total:         { title: 'Total de Custos por Colaborador', icon: <Wallet size={20} />,    color: 'text-emerald-400' },
                  };
                  const { title: modalTitle, icon: modalIcon, color: modalColor } = modeLabels[costDetailMode];

                  // Build per-employee data
                  const filteredIds = new Set(filteredEmployees.map(e => e.id));
                  const costsForFiltered = monthlyCosts.filter(c => filteredIds.has(c.employee_id));

                  // Group by employee_id
                  const costByEmployee = filteredEmployees.map(emp => {
                    const empCosts = costsForFiltered.filter(c => c.employee_id === emp.id);
                    const totalFixoEmp   = empCosts.reduce((s, c) => s + (c.valor_fixo || 0), 0);
                    const totalBonusEmp  = empCosts.reduce((s, c) => s + (c.valor_bonus || 0), 0);
                    const totalComEmp    = empCosts.reduce((s, c) => s + (c.valor_comissao || 0), 0);
                    const totalIncEmp    = empCosts.reduce((s, c) => s + (c.valor_incentivos || 0), 0);
                    const totalConEmp    = emp.remuneration_connectivity || 0;
                    const totalGeralEmp  = totalFixoEmp + totalBonusEmp + totalComEmp + totalIncEmp + totalConEmp;
                    const value = costDetailMode === 'fixo'          ? totalFixoEmp
                                : costDetailMode === 'bonus'         ? totalBonusEmp
                                : costDetailMode === 'comissao'      ? totalComEmp
                                : costDetailMode === 'incentivos'    ? totalIncEmp
                                : costDetailMode === 'conectividade' ? totalConEmp
                                : totalGeralEmp;
                    return { emp, value, totalGeralEmp, months: empCosts.length };
                  }).filter(r => r.value > 0).sort((a, b) => b.value - a.value);

                  const grandTotal = costByEmployee.reduce((s, r) => s + r.value, 0);

                  return (
                    <>
                      <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/20 shrink-0">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 ${modalColor}`}>
                            {modalIcon}
                          </div>
                          <div>
                            <h2 className="text-sm font-black tracking-widest uppercase text-slate-100">{modalTitle}</h2>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                              {costByEmployee.length} colaborador{costByEmployee.length !== 1 ? 'es' : ''} com lançamentos &bull; Total: {showValues ? formatCurrency(grandTotal) : '••••••'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setCostDetailMode(null)}
                          className="w-9 h-9 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 hover:bg-slate-800 transition-all"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto">
                        {costByEmployee.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
                            <BarChart3 size={40} className="opacity-30" />
                            <p className="text-sm font-bold uppercase tracking-wider">Nenhum lançamento encontrado</p>
                          </div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-950 z-10">
                              <tr className="text-left border-b border-slate-800">
                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">#</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Colaborador</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total Acumulado</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">% do Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {costByEmployee.map((row, idx) => (
                                <tr key={row.emp.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                  <td className="px-6 py-3 text-slate-500 text-xs font-bold align-top">{idx + 1}</td>
                                  <td className="px-4 py-3 align-top">
                                    <p className="font-bold text-slate-100 text-sm">{row.emp.name}</p>
                                    <p className="text-[10px] text-slate-500">{row.emp.job_role || row.emp.linkType}</p>
                                  </td>
                                  <td className="px-4 py-3 text-right align-top">
                                    <span className={`font-black tabular-nums ${modalColor}`}>
                                      {showValues ? formatCurrency(row.value) : '••••••'}
                                    </span>
                                    {row.months > 0 && (
                                      <p className="text-[10px] text-slate-500 mt-0.5">
                                        Média: {showValues ? formatCurrency(row.value / row.months) : '•••'}/mês
                                        <span className="ml-1 text-slate-600">· {row.months}mês{row.months !== 1 ? 'es' : ''}</span>
                                      </p>
                                    )}
                                    {row.months === 0 && costDetailMode === 'conectividade' && (
                                      <p className="text-[10px] text-slate-500 mt-0.5">Valor mensal fixo</p>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right align-top">
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="text-xs font-bold text-slate-300">
                                        {grandTotal > 0 ? ((row.value / grandTotal) * 100).toFixed(1) : '0.0'}%
                                      </span>
                                      <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${
                                            costDetailMode === 'fixo'          ? 'bg-blue-500'
                                          : costDetailMode === 'bonus'         ? 'bg-emerald-500'
                                          : costDetailMode === 'comissao'      ? 'bg-amber-500'
                                          : costDetailMode === 'incentivos'    ? 'bg-indigo-500'
                                          : costDetailMode === 'conectividade' ? 'bg-cyan-500'
                                          : 'bg-teal-500'
                                          }`}
                                          style={{ width: `${grandTotal > 0 ? (row.value / grandTotal) * 100 : 0}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-slate-700 bg-slate-950/40">
                                <td colSpan={2} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-300">Total Acumulado</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`text-base font-black tabular-nums ${modalColor}`}>
                                    {showValues ? formatCurrency(grandTotal) : '••••••'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right text-xs font-bold text-slate-400">100%</td>
                              </tr>
                              <tr className="bg-slate-950/20">
                                <td colSpan={2} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                  Média por colaborador / mês
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-sm font-bold tabular-nums text-slate-400">
                                    {showValues && costByEmployee.length > 0 ? (() => {
                                      const totalMonths = costByEmployee.reduce((s, r) => s + (r.months || 1), 0);
                                      return formatCurrency(grandTotal / (totalMonths || costByEmployee.length));
                                    })() : '•••'}
                                  </span>
                                  <p className="text-[10px] text-slate-600 mt-0.5">
                                    {costByEmployee.length} colab. · {costByEmployee.reduce((s, r) => s + r.months, 0)} meses no total
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-right text-[10px] text-slate-500">
                                  Média geral
                                </td>
                              </tr>
                            </tfoot>


                          </table>
                        )}
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            </div>
          )}

          {/* 🌟 Alertas & Filtros de Insights 🌟 */}
          <div className="mt-8 flex flex-col gap-4">
             <div className="flex items-center justify-between gap-4">
               <div className="flex items-center gap-2">
                 <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                   <Target size={18} className="text-purple-600"/> Monitoramento de Pessoas
                 </h3>
                 {filterInsight && (
                   <button onClick={() => setFilterInsight(null)} className="ml-2 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full hover:bg-slate-200 hover:text-slate-800 transition-colors uppercase">
                     Limpar Filtro
                   </button>
                 )}
               </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex flex-col">
                     <label className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Janela Base</label>
                     <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 shadow-sm">
                       <input
                         type="number"
                         min={1}
                         value={noRaiseMonths}
                         onChange={e => setNoRaiseMonths(Math.max(1, parseInt(e.target.value) || 1))}
                         className="w-10 bg-transparent text-xs font-black outline-none text-slate-800 dark:text-slate-200"
                       />
                       <span className="text-[9px] font-bold text-slate-400 uppercase">Meses</span>
                     </div>
                  </div>
                  <div className="flex flex-col">
                     <label className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Janela Nível</label>
                     <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 shadow-sm">
                       <input
                         type="number"
                         min={1}
                         value={noPromoMonths}
                         onChange={e => setNoPromoMonths(Math.max(1, parseInt(e.target.value) || 1))}
                         className="w-10 bg-transparent text-xs font-black outline-none text-slate-800 dark:text-slate-200"
                       />
                       <span className="text-[9px] font-bold text-slate-400 uppercase">Meses</span>
                     </div>
                  </div>
                  <div className="flex flex-col">
                     <label className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Janela Grau</label>
                     <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 shadow-sm">
                       <input
                         type="number"
                         min={1}
                         value={noGradeMonths}
                         onChange={e => setNoGradeMonths(Math.max(1, parseInt(e.target.value) || 1))}
                         className="w-10 bg-transparent text-xs font-black outline-none text-slate-800 dark:text-slate-200"
                       />
                       <span className="text-[9px] font-bold text-slate-400 uppercase">Meses</span>
                     </div>
                  </div>
                </div>
             </div>

             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mt-2">
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
                 title="Mesmo Valor Base"
                 value={insightCounts.aumento}
                 icon={<UserCog size={20} />}
                 color="rose"
                 onClick={() => setFilterInsight(filterInsight === 'aumento' ? null : 'aumento')}
                 isActive={filterInsight === 'aumento'}
                 sub={`Há mais de ${noRaiseMonths} meses`}
               />
               <PeopleKpiCard
                 title="Mesmo Nível"
                 value={insightCounts.promocao}
                 icon={<Target size={20} />}
                 color="indigo"
                 onClick={() => setFilterInsight(filterInsight === 'promocao' ? null : 'promocao')}
                 isActive={filterInsight === 'promocao'}
                 sub={`Há mais de ${noPromoMonths} meses`}
               />
               <PeopleKpiCard
                 title="Mesmo Grau"
                 value={insightCounts.grau}
                 icon={<Award size={20} />}
                 color="emerald"
                 onClick={() => setFilterInsight(filterInsight === 'grau' ? null : 'grau')}
                 isActive={filterInsight === 'grau'}
                 sub={`Há mais de ${noGradeMonths} meses`}
               />
             </div>
          </div>

          {/* ── Main List/Grid rendering ── */}
          {isLoadingEmployees ? (
            <div className="p-12 flex items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm mt-6">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : viewMode === 'map' ? (
            <PeopleEcosystemMap
              employees={filteredEmployees}
              onEmployeeClick={handleEmployeeClick}
              showValues={showValues}
            />
          ) : viewMode === 'table' ? (
            <PeopleTable
              employees={filteredEmployees}
              onEdit={handleEmployeeClick}
              onDelete={(emp) => setDeleteTarget(emp)}
              onEmployeeClick={handleEmployeeClick}
              showValues={showValues}
              auditIssues={allAuditIssues}
              noRaiseMonths={noRaiseMonths}
              noPromoMonths={noPromoMonths}
              noGradeMonths={noGradeMonths}
              itemsPerPage={itemsPerPage}
              onFilterSelect={handleFilterSelect}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
            />
          ) : (
            <div>
              {/* Top controls/pagination for Grid View */}
              <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mt-6 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                    Exibição em Cards
                    <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[10px] text-slate-500 font-bold ml-2">
                      {filteredEmployees.length} REGISTROS
                    </span>
                  </h3>
                  
                  {/* Expand All Toggle inside the card view bar */}
                  <button
                    onClick={() => setExpandAllCards(!expandAllCards)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 uppercase shadow-sm ${
                      expandAllCards
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-black'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold'
                    }`}
                    title={expandAllCards ? 'Recolher detalhes de todos os cards' : 'Expandir detalhes de todos os cards'}
                  >
                    <span>{expandAllCards ? 'Recolher Cards' : 'Expandir Cards'}</span>
                  </button>

                  {/* Botão Limpar Filtros na barra superior de Cards */}
                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 uppercase shadow-sm"
                      title="Limpar todos os filtros ativos"
                    >
                      <X size={13} />
                      <span>Limpar Filtros</span>
                    </button>
                  )}
                </div>
                
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 px-4 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      ANTERIOR
                    </button>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Pág {currentPage} de {totalPages}
                    </span>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 px-4 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      PRÓXIMO
                    </button>
                  </div>
                )}
              </div>

              {/* Grid de Cards responsivo */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                {paginatedGridEmployees.length === 0 ? (
                  <p className="py-12 text-center text-slate-400 text-sm italic col-span-full bg-white rounded-2xl border border-slate-200 shadow-sm">
                    Nenhum colaborador encontrado para os filtros selecionados.
                  </p>
                ) : (
                  paginatedGridEmployees.map(emp => {
                    const empIssues = allAuditIssues[emp.id] || [];
                    const now = new Date();
                    const hasGlosa = !!emp.has_invoice_glosa;
                    const hasLoan = (emp.balance || 0) > 0;
                    let hasNoRaise = false;
                    let hasNoPromo = false;
                    let hasNoGrade = false;

                    if (noRaiseMonths) {
                      const dRaise = new Date((emp.last_raise_date || emp.start_date || '') + 'T00:00:00');
                      if (!isNaN(dRaise.getTime())) {
                        const diffMonths = (now.getFullYear() - dRaise.getFullYear()) * 12 + (now.getMonth() - dRaise.getMonth());
                        hasNoRaise = diffMonths >= noRaiseMonths;
                      }
                    }
                    
                    if (noPromoMonths) {
                      const dPromo = new Date((emp.department_start_date || emp.start_date || '') + 'T00:00:00');
                      if (!isNaN(dPromo.getTime())) {
                        const diffMonths = (now.getFullYear() - dPromo.getFullYear()) * 12 + (now.getMonth() - dPromo.getMonth());
                        hasNoPromo = diffMonths >= noPromoMonths;
                      }
                    }

                    if (noGradeMonths) {
                      const dGrade = new Date((emp.last_grade_date || emp.start_date || '') + 'T00:00:00');
                      if (!isNaN(dGrade.getTime())) {
                        const diffMonths = (now.getFullYear() - dGrade.getFullYear()) * 12 + (now.getMonth() - dGrade.getMonth());
                        hasNoGrade = diffMonths >= noGradeMonths;
                      }
                    }

                    const empCosts = monthlyCosts.filter(c => c.employee_id === emp.id);
                    const historicoCustoTotal = empCosts.reduce((sum, c) => sum + (c.valor_liquido || 0), 0);
                    const historicoCustoMedio = empCosts.length > 0 ? historicoCustoTotal / empCosts.length : 0;

                    return (
                      <PeopleMobileCard
                        key={emp.id}
                        employee={emp}
                        onClick={handleEmployeeClick}
                        onEdit={handleEmployeeClick}
                        onDelete={(e) => setDeleteTarget(e)}
                        showValues={showValues}
                        hasAuditIssues={empIssues.length > 0}
                        hasGlosa={hasGlosa}
                        hasLoan={hasLoan}
                        hasNoRaise={hasNoRaise}
                        hasNoPromo={hasNoPromo}
                        hasNoGrade={hasNoGrade}
                        noRaiseMonths={noRaiseMonths}
                        noPromoMonths={noPromoMonths}
                        noGradeMonths={noGradeMonths}
                        historicoCustoTotal={historicoCustoTotal}
                        historicoCustoMedio={historicoCustoMedio}
                        expandAll={expandAllCards}
                        onFilterSelect={handleFilterSelect}
                      />
                    );
                  })
                )}
              </div>

              {/* Controles de Paginação do Grid */}
              <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mt-6 flex-wrap gap-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                  Exibição em Cards
                  <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[10px] text-slate-500 font-bold ml-2">
                    {filteredEmployees.length} REGISTROS
                  </span>
                </h3>
                
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 px-4 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      ANTERIOR
                    </button>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Pág {currentPage} de {totalPages}
                    </span>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 px-4 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      PRÓXIMO
                    </button>
                  </div>
                )}
              </div>
            </div>
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

      <PayrollBatchImportModal
        isOpen={isPayrollBatchModalOpen}
        onClose={() => setIsPayrollBatchModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
        employees={employees}
        isTestMode={isTestMode}
      />
    </div>
  );
}

