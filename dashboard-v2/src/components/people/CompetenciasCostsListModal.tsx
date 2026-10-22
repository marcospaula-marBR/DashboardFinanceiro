import React, { useState, useMemo } from 'react';
import { 
  X, Calendar, Filter, Search, Trash2, Edit3, Loader2, 
  CheckCircle2, AlertTriangle, ArrowUpDown, DollarSign, Wallet, 
  Users, ChevronRight, FileSpreadsheet, RotateCcw, Building2, Briefcase, Download, Upload
} from 'lucide-react';
import { Employee, MonthlyCost } from '@/types/loans';
import { PeopleHRService } from '@/services/people-hr.service';
import { formatCurrency } from '@/services/loans.service';
import { CostImportStagingModal } from '@/components/people/CostImportStagingModal';

interface CompetenciasCostsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  filteredEmployees?: Employee[];
  monthlyCosts: MonthlyCost[];
  onCostDeleted: () => void;
  onEditCost: (cost: MonthlyCost, employee?: Employee) => void;
  showValues?: boolean;
}

// Normalizador de texto para busca sem diferenciar acentos ou maiúsculas
function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function CompetenciasCostsListModal({
  isOpen,
  onClose,
  employees,
  filteredEmployees,
  monthlyCosts,
  onCostDeleted,
  onEditCost,
  showValues = true,
}: CompetenciasCostsListModalProps) {
  // Filtros
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [compFilterMode, setCompFilterMode] = useState<'single' | 'range' | 'multi'>('single');
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('all');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [selectedCompetencias, setSelectedCompetencias] = useState<string[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>('all');
  const [selectedVinculo, setSelectedVinculo] = useState<'all' | 'CLT' | 'PJ' | 'ESTAGIO'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'Ativo' | 'Inativo'>('all');
  const [selectedSetor, setSelectedSetor] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [usePageScope, setUsePageScope] = useState<boolean>(() => {
    return Boolean(filteredEmployees && filteredEmployees.length > 0 && filteredEmployees.length < employees.length);
  });

  // Ações e ordenação
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'competencia' | 'name' | 'total'>('competencia');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Mapeamento de colaboradores por ID
  const employeesMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach(emp => map.set(emp.id, emp));
    return map;
  }, [employees]);

  // Set de IDs filtrados da página
  const pageFilteredEmpIds = useMemo(() => {
    if (!filteredEmployees || filteredEmployees.length === 0) return null;
    return new Set(filteredEmployees.map(e => e.id));
  }, [filteredEmployees]);

  // Anos disponíveis extraídos de monthlyCosts
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(monthlyCosts.map(c => c.competencia?.split('-')[0]))).filter(Boolean);
    return years.sort().reverse();
  }, [monthlyCosts]);

  // Empresas disponíveis
  const availableCompanies = useMemo(() => {
    const comps = Array.from(new Set(employees.map(e => e.company))).filter(Boolean);
    return comps.sort();
  }, [employees]);

  // Setores disponíveis
  const availableSetores = useMemo(() => {
    const sets = Array.from(new Set(employees.map(e => e.department))).filter(Boolean);
    return sets.sort();
  }, [employees]);

  // Lista de competências disponíveis (filtradas pelos anos selecionados se houver)
  const availableCompetencias = useMemo(() => {
    let comps = Array.from(new Set(monthlyCosts.map(c => c.competencia))).filter(Boolean);
    if (selectedYears.length > 0) {
      comps = comps.filter(c => selectedYears.some(y => c.startsWith(y)));
    }
    return comps.sort().reverse();
  }, [monthlyCosts, selectedYears]);

  // Formatação de competência para rótulo legível (ex: "Setembro/2026")
  const formatCompetenciaLabel = (compStr: string): string => {
    if (!compStr) return '—';
    const parts = compStr.split('-');
    if (parts.length < 2) return compStr;
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const monthName = months[monthIdx] || parts[1];
    return `${monthName}/${parts[0]}`;
  };

  // Filtragem dos custos com todos os critérios
  const filteredRows = useMemo(() => {
    let rows = monthlyCosts.map(cost => {
      const emp = employeesMap.get(cost.employee_id);
      const isCLT = cost.vinculo_tipo === 'CLT' || emp?.linkType === 'CLT';
      const isEstagio = emp?.linkType === 'Estagiário' || (emp?.linkType || '').toLowerCase().includes('estag');
      const isPJ = !isCLT && !isEstagio;
      const realTotal = (cost.valor_liquido || 0) + (isCLT ? (cost.valor_adiantamento || 0) : 0);
      const name = emp?.name || (cost as any).nome_colaborador || 'Colaborador';
      return {
        cost,
        emp,
        name,
        realTotal,
        isCLT,
        isPJ,
        isEstagio,
      };
    });

    // 1. Escopo de página ativa
    if (usePageScope && pageFilteredEmpIds) {
      rows = rows.filter(r => pageFilteredEmpIds.has(r.cost.employee_id));
    }

    // 2. Filtro de Múltiplos Anos
    if (selectedYears.length > 0) {
      rows = rows.filter(r => selectedYears.some(y => r.cost.competencia?.startsWith(y)));
    }

    // 3. Filtro de Competência (Única, Período De/Até ou Múltiplos Meses)
    if (compFilterMode === 'single') {
      if (selectedCompetencia !== 'all') {
        rows = rows.filter(r => r.cost.competencia?.slice(0, 7) === selectedCompetencia.slice(0, 7));
      }
    } else if (compFilterMode === 'range') {
      if (periodStart) {
        rows = rows.filter(r => (r.cost.competencia?.slice(0, 7) || '') >= periodStart.slice(0, 7));
      }
      if (periodEnd) {
        rows = rows.filter(r => (r.cost.competencia?.slice(0, 7) || '') <= periodEnd.slice(0, 7));
      }
    } else if (compFilterMode === 'multi') {
      if (selectedCompetencias.length > 0) {
        rows = rows.filter(r => selectedCompetencias.includes(r.cost.competencia?.slice(0, 7) || ''));
      }
    }

    // 4. Filtro de Empresa
    if (selectedEmpresa !== 'all') {
      rows = rows.filter(r => r.emp?.company === selectedEmpresa);
    }

    // 5. Filtro de Regime / Vínculo
    if (selectedVinculo !== 'all') {
      if (selectedVinculo === 'CLT') {
        rows = rows.filter(r => r.isCLT && !r.isEstagio);
      } else if (selectedVinculo === 'PJ') {
        rows = rows.filter(r => r.isPJ);
      } else if (selectedVinculo === 'ESTAGIO') {
        rows = rows.filter(r => r.isEstagio);
      }
    }

    // 6. Filtro de Status
    if (selectedStatus !== 'all') {
      rows = rows.filter(r => (r.emp?.status || 'Ativo') === selectedStatus);
    }

    // 7. Filtro de Setor / Departamento
    if (selectedSetor !== 'all') {
      rows = rows.filter(r => r.emp?.department === selectedSetor);
    }

    // 8. Busca Inteligente (Sem acento, multi-campos)
    if (searchTerm.trim()) {
      const term = normalizeText(searchTerm);
      rows = rows.filter(r => 
        normalizeText(r.name).includes(term) ||
        normalizeText(r.emp?.corporate_name).includes(term) ||
        normalizeText(r.emp?.job_role).includes(term) ||
        normalizeText(r.emp?.department).includes(term) ||
        normalizeText(r.emp?.document_id).includes(term) ||
        normalizeText(r.emp?.responsible_cpf).includes(term) ||
        normalizeText(r.cost.observacao).includes(term)
      );
    }

    // 9. Ordenação
    rows.sort((a, b) => {
      if (sortField === 'competencia') {
        const diff = a.cost.competencia.localeCompare(b.cost.competencia);
        return sortOrder === 'asc' ? diff : -diff;
      }
      if (sortField === 'name') {
        const diff = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? diff : -diff;
      }
      if (sortField === 'total') {
        const diff = a.realTotal - b.realTotal;
        return sortOrder === 'asc' ? diff : -diff;
      }
      return 0;
    });

    return rows;
  }, [
    monthlyCosts, employeesMap, usePageScope, pageFilteredEmpIds, 
    selectedYears, compFilterMode, selectedCompetencia, periodStart, periodEnd, selectedCompetencias,
    selectedEmpresa, selectedVinculo, 
    selectedStatus, selectedSetor, searchTerm, sortField, sortOrder
  ]);

  // Totais do filtro ativo
  const summaryTotals = useMemo(() => {
    const totalGeral = filteredRows.reduce((sum, r) => sum + r.realTotal, 0);
    const uniqueEmployeesCount = new Set(filteredRows.map(r => r.cost.employee_id)).size;
    const avgPerEmployee = uniqueEmployeesCount > 0 ? totalGeral / uniqueEmployeesCount : 0;
    return {
      totalGeral,
      countRows: filteredRows.length,
      uniqueEmployeesCount,
      avgPerEmployee,
    };
  }, [filteredRows]);

  // Verifica se há qualquer filtro ativo
  const hasActiveModalFilters = (
    selectedYears.length > 0 ||
    selectedCompetencia !== 'all' ||
    periodStart !== '' ||
    periodEnd !== '' ||
    selectedCompetencias.length > 0 ||
    selectedEmpresa !== 'all' ||
    selectedVinculo !== 'all' ||
    selectedStatus !== 'all' ||
    selectedSetor !== 'all' ||
    searchTerm.trim() !== '' ||
    usePageScope
  );

  const handleResetFilters = () => {
    setSelectedYears([]);
    setCompFilterMode('single');
    setSelectedCompetencia('all');
    setPeriodStart('');
    setPeriodEnd('');
    setSelectedCompetencias([]);
    setSelectedEmpresa('all');
    setSelectedVinculo('all');
    setSelectedStatus('all');
    setSelectedSetor('all');
    setSearchTerm('');
    setUsePageScope(false);
  };

  if (!isOpen) return null;

  const handleDeleteCost = async (costId: string, empName: string, competencia: string) => {
    const compLabel = formatCompetenciaLabel(competencia);
    if (!window.confirm(`Deseja realmente excluir o lançamento da competência ${compLabel} para o colaborador ${empName}? Esta ação é permanente.`)) {
      return;
    }

    try {
      setDeletingId(costId);
      await PeopleHRService.deleteMonthlyCost(costId);
      setSuccessToast(`Lançamento de ${compLabel} de ${empName} excluído com sucesso.`);
      onCostDeleted();
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      console.error('Erro ao excluir custo:', err);
      alert('Falha ao excluir custo: ' + (err.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSort = (field: 'competencia' | 'name' | 'total') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'competencia' ? 'desc' : 'asc');
    }
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      alert('Nenhum dado para exportar com os filtros atuais.');
      return;
    }

    const headers = [
      'Competência (ISO)',
      'Competência (Mês/Ano)',
      'Colaborador',
      'Razão Social',
      'Regime',
      'Status Cadastral',
      'Empresa',
      'Departamento / Setor',
      'Cargo',
      'Documento / CPF / CNPJ',
      'Salário Fixo / Base (R$)',
      'Outros Valores Recebidos (R$)',
      'Adiantamento (R$)',
      'Horas Extras (R$)',
      'Adicional Noturno (R$)',
      'Vale Refeição (R$)',
      'Vale Transporte (R$)',
      'VR / Cesta Básica (R$)',
      'Ajuda Custo / Conectividade (R$)',
      'Total Benefícios (R$)',
      '13º Salário (R$)',
      'Férias (R$)',
      'Rescisão (R$)',
      'Descontos Holerite (R$)',
      'Faltas (R$)',
      'Consignado (R$)',
      'Total Real Desembolsado (R$)',
      'Origem',
      'Observação'
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const formatNum = (val: number | null | undefined): string => {
      if (val === null || val === undefined || isNaN(val)) return '0,00';
      return val.toFixed(2).replace('.', ',');
    };

    const csvRows: string[] = [];
    csvRows.push(headers.join(';'));

    filteredRows.forEach(({ cost, emp, name, isCLT, isEstagio, realTotal }) => {
      const fixo = cost.valor_fixo !== undefined && cost.valor_fixo !== null ? cost.valor_fixo : (cost.valor_liquido || 0);
      const vr = cost.valor_vr || 0;
      const vt = cost.valor_vt || 0;
      const cesta = cost.valor_cesta || 0;
      const ajudaCusto = cost.valor_ajuda_custo || 0;
      const totalBeneficios = vr + vt + cesta + ajudaCusto;
      const regime = isEstagio ? 'Estágio' : (isCLT ? 'CLT' : 'PJ');
      const compLabel = formatCompetenciaLabel(cost.competencia);

      const row = [
        escapeCsv(cost.competencia),
        escapeCsv(compLabel),
        escapeCsv(name),
        escapeCsv(emp?.corporate_name || ''),
        escapeCsv(regime),
        escapeCsv(emp?.status || 'Ativo'),
        escapeCsv(emp?.company || ''),
        escapeCsv(emp?.department || ''),
        escapeCsv(emp?.job_role || ''),
        escapeCsv(emp?.document_id || emp?.responsible_cpf || ''),
        formatNum(fixo),
        formatNum(cost.outros_ajustes || 0),
        formatNum(cost.valor_adiantamento),
        formatNum(cost.valor_hora_extra),
        formatNum(cost.valor_adicional_not),
        formatNum(vr),
        formatNum(vt),
        formatNum(cesta),
        formatNum(ajudaCusto),
        formatNum(totalBeneficios),
        formatNum(cost.valor_decimo_terceiro),
        formatNum(cost.valor_ferias),
        formatNum(cost.valor_rescisao),
        formatNum(cost.valor_descontos),
        formatNum(cost.valor_faltas),
        formatNum(cost.valor_consignado),
        formatNum(realTotal),
        escapeCsv(cost.origem || 'manual'),
        escapeCsv(cost.observacao || '')
      ];

      csvRows.push(row.join(';'));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_custos_competencias_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccessToast(`Relatório exportado com sucesso (${filteredRows.length} lançamentos)!`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-slate-50 dark:via-slate-900 to-white dark:to-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Lançamentos de Custos por Competência
                </h3>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {filteredRows.length} Lançamento{filteredRows.length !== 1 ? 's' : ''}
                </span>
                {hasActiveModalFilters && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                    <Filter size={10} /> Filtros Ativos
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Visualização analítica consolidada com filtros multi-critérios, edição ágil e exclusão segura
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Importar Folha Oficial (PDF/IA) ou Planilha Histórica (Excel) com Staging de Benefícios"
            >
              <Upload size={14} />
              <span>Importar Folha / Planilha</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
              title="Exportar dados filtrados para planilha Excel / CSV"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
            {hasActiveModalFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5"
                title="Limpar todos os filtros aplicados"
              >
                <RotateCcw size={13} />
                <span>Limpar Filtros</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
              title="Fechar janela"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* FEEDBACK TOAST */}
        {successToast && (
          <div className="mx-6 mt-3 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-150">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* BARRA DE FILTROS AVANÇADOS */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-2.5 shrink-0">
          
          {/* Linha 1: Pílulas de Ano + Escopo da Página */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Pílulas de Múltiplos Anos */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
                Anos:
              </span>
              <button
                type="button"
                onClick={() => setSelectedYears([])}
                className={`px-2.5 py-1 text-xs font-extrabold rounded-lg transition-all ${
                  selectedYears.length === 0
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                Todos os Anos
              </button>
              {availableYears.map(year => {
                const isYearActive = selectedYears.includes(year);
                return (
                  <button
                    type="button"
                    key={year}
                    onClick={() => {
                      setSelectedYears(prev =>
                        prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
                      );
                    }}
                    className={`px-2.5 py-1 text-xs font-extrabold rounded-lg transition-all ${
                      isYearActive
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>

            {/* Alternador de Escopo da Página */}
            {filteredEmployees && filteredEmployees.length > 0 && filteredEmployees.length < employees.length && (
              <button
                type="button"
                onClick={() => setUsePageScope(v => !v)}
                className={`px-3 py-1 text-xs font-extrabold rounded-lg border transition-all flex items-center gap-1.5 ${
                  usePageScope
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800'
                }`}
                title="Alternar entre ver somente os colaboradores filtrados na página principal ou toda a base"
              >
                <Filter size={12} className={usePageScope ? 'text-amber-600' : 'text-slate-400'} />
                <span>
                  {usePageScope 
                    ? `Base Filtrada na Página (${filteredEmployees.length})` 
                    : `Toda a Base (${employees.length})`}
                </span>
              </button>
            )}
          </div>

          {/* Linha 2: Controles de Filtros em Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2.5 items-center">
            
            {/* Seletor Avançado de Competência (Única, Período De/Até ou Múltiplos) */}
            <div className="lg:col-span-5">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Filtro de Competências
                </label>
                {/* Alternador de Modo de Filtro */}
                <div className="flex items-center gap-1 text-[9px] font-bold">
                  <button
                    type="button"
                    onClick={() => setCompFilterMode('single')}
                    className={`px-1.5 py-0.5 rounded ${
                      compFilterMode === 'single'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    Mês
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setCompFilterMode('range')}
                    className={`px-1.5 py-0.5 rounded ${
                      compFilterMode === 'range'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    Período De/Até
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setCompFilterMode('multi')}
                    className={`px-1.5 py-0.5 rounded ${
                      compFilterMode === 'multi'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    Vários Meses
                  </button>
                </div>
              </div>

              {compFilterMode === 'single' && (
                <div className="relative">
                  <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={selectedCompetencia}
                    onChange={e => setSelectedCompetencia(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  >
                    <option value="all">
                      {selectedYears.length > 0 ? `Todos os meses (${selectedYears.join(', ')})` : 'Todas as Competências'} ({availableCompetencias.length})
                    </option>
                    {availableCompetencias.map(comp => (
                      <option key={comp} value={comp}>
                        {formatCompetenciaLabel(comp)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {compFilterMode === 'range' && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <span className="text-[9px] font-bold text-slate-400 block mb-0.5">De:</span>
                    <select
                      value={periodStart}
                      onChange={e => setPeriodStart(e.target.value)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Início (Todos)</option>
                      {availableCompetencias.slice().reverse().map(comp => (
                        <option key={comp} value={comp}>
                          {formatCompetenciaLabel(comp)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 relative">
                    <span className="text-[9px] font-bold text-slate-400 block mb-0.5">Até:</span>
                    <select
                      value={periodEnd}
                      onChange={e => setPeriodEnd(e.target.value)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Fim (Todos)</option>
                      {availableCompetencias.map(comp => (
                        <option key={comp} value={comp}>
                          {formatCompetenciaLabel(comp)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {compFilterMode === 'multi' && (
                <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
                  {availableCompetencias.map(comp => {
                    const isCompActive = selectedCompetencias.includes(comp.slice(0, 7));
                    const label = formatCompetenciaLabel(comp).split('/')[0].slice(0, 3) + '/' + comp.slice(2, 4);
                    return (
                      <button
                        type="button"
                        key={comp}
                        onClick={() => {
                          const key = comp.slice(0, 7);
                          setSelectedCompetencias(prev =>
                            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                          );
                        }}
                        className={`px-2 py-0.5 text-[10px] font-extrabold rounded whitespace-nowrap transition-all ${
                          isCompActive
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {selectedCompetencias.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCompetencias([])}
                      className="text-[9px] text-rose-500 underline ml-1 shrink-0"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Seletor de Empresa */}
            <div className="lg:col-span-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Empresa
              </label>
              <div className="relative">
                <Building2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedEmpresa}
                  onChange={e => setSelectedEmpresa(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                >
                  <option value="all">Todas as Empresas</option>
                  {availableCompanies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Seletor de Regime / Vínculo */}
            <div className="lg:col-span-3">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Regime / Vínculo
              </label>
              <div className="flex bg-slate-200/60 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedVinculo('all')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                    selectedVinculo === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVinculo('CLT')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                    selectedVinculo === 'CLT'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  CLT
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVinculo('PJ')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                    selectedVinculo === 'PJ'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  PJ / MEI
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVinculo('ESTAGIO')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                    selectedVinculo === 'ESTAGIO'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Estágio
                </button>
              </div>
            </div>

            {/* Seletor de Setor / Departamento */}
            <div className="lg:col-span-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Setor / Área
              </label>
              <div className="relative">
                <Briefcase size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedSetor}
                  onChange={e => setSelectedSetor(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                >
                  <option value="all">Todos os Setores</option>
                  {availableSetores.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Busca por Colaborador */}
            <div className="lg:col-span-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Nome, cargo, CPF..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                />
              </div>
            </div>

          </div>
        </div>

        {/* SUMMARY KPI CARDS */}
        <div className="px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Contratados Únicos</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                {summaryTotals.uniqueEmployeesCount}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Lançamentos</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                {summaryTotals.countRows}
              </span>
            </div>
          </div>

          <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Wallet size={18} />
            </div>
            <div>
              <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Total Real Desembolsado</span>
              <span className="text-sm font-black text-emerald-800 dark:text-emerald-300 tabular-nums">
                {showValues ? formatCurrency(summaryTotals.totalGeral) : '••••••'}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <DollarSign size={18} />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Média / Contratado</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200 tabular-nums">
                {showValues ? formatCurrency(summaryTotals.avgPerEmployee) : '••••••'}
              </span>
            </div>
          </div>
        </div>

        {/* TABELA DE LISTA DE COMPETÊNCIAS */}
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 bg-slate-50/30 dark:bg-slate-950/20">
          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400">
              <Calendar size={48} className="opacity-30 mb-3" />
              <p className="text-sm font-bold uppercase tracking-wider">Nenhum lançamento encontrado</p>
              <p className="text-xs text-slate-500 mt-1">Tente ajustar o ano, a competência, o regime ou termo de busca.</p>
              {hasActiveModalFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  <span>Limpar Filtros</span>
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xs">
                <tr>
                  <th 
                    onClick={() => toggleSort('competencia')}
                    className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 cursor-pointer hover:text-emerald-600 select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      Competência
                      <ArrowUpDown size={12} className={sortField === 'competencia' ? 'text-emerald-600' : 'opacity-40'} />
                    </div>
                  </th>

                  <th 
                    onClick={() => toggleSort('name')}
                    className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 cursor-pointer hover:text-emerald-600 select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      Colaborador / Regime
                      <ArrowUpDown size={12} className={sortField === 'name' ? 'text-emerald-600' : 'opacity-40'} />
                    </div>
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right whitespace-nowrap">
                    Salário / Fixo
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right whitespace-nowrap">
                    Adiantamento
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right whitespace-nowrap">
                    HE & Noturno
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right whitespace-nowrap">
                    Benefícios
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right whitespace-nowrap">
                    13º & Férias
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right whitespace-nowrap">
                    Descontos
                  </th>

                  <th 
                    onClick={() => toggleSort('total')}
                    className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 text-right cursor-pointer select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Total Real
                      <ArrowUpDown size={12} className={sortField === 'total' ? 'text-emerald-600' : 'opacity-40'} />
                    </div>
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center whitespace-nowrap">
                    Origem
                  </th>

                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center sticky right-0 bg-slate-100 dark:bg-slate-900 shadow-2xs whitespace-nowrap">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900/60 font-medium">
                {filteredRows.map(({ cost, emp, name, realTotal, isCLT, isEstagio }) => {
                  const beneficios = (cost.valor_vr || 0) + (cost.valor_vt || 0) + (cost.valor_cesta || 0) + (cost.valor_ajuda_custo || 0);
                  const heNoturno = (cost.valor_hora_extra || 0) + (cost.valor_adicional_not || 0);
                  const decimoFerias = (cost.valor_decimo_terceiro || 0) + (cost.valor_ferias || 0) + (cost.valor_rescisao || 0);
                  const fixo = cost.valor_fixo !== undefined && cost.valor_fixo !== null ? cost.valor_fixo : (cost.valor_liquido || 0);
                  const isDeletingThis = deletingId === cost.id;

                  return (
                    <tr 
                      key={cost.id} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Competência */}
                      <td className="px-4 py-3 align-middle font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {formatCompetenciaLabel(cost.competencia)}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                          {cost.competencia}
                        </span>
                      </td>

                      {/* Colaborador */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                            isEstagio
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900'
                              : isCLT 
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900' 
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                          }`}>
                            {isEstagio ? 'Estágio' : (isCLT ? 'CLT' : 'PJ')}
                          </span>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 dark:text-slate-100 text-xs truncate max-w-[200px] sm:max-w-[260px]">
                              {name}
                            </p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate max-w-[240px]">
                              {emp?.company && (
                                <span className="font-bold text-slate-500 uppercase">{emp.company}</span>
                              )}
                              {emp?.company && <span>&bull;</span>}
                              <span className="truncate">{emp?.job_role || emp?.department || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Salário / Fixo */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {showValues ? formatCurrency(fixo) : '••••••'}
                      </td>

                      {/* Adiantamento */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums whitespace-nowrap">
                        {cost.valor_adiantamento && cost.valor_adiantamento > 0 ? (
                          <span className="font-bold text-blue-600 dark:text-blue-400 block">
                            +{showValues ? formatCurrency(cost.valor_adiantamento) : '••••'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700 block">—</span>
                        )}
                        {cost.outros_ajustes && cost.outros_ajustes > 0 ? (
                          <span className="block text-[9px] text-slate-400 font-normal">
                            Outros: +{showValues ? formatCurrency(cost.outros_ajustes) : '••••'}
                          </span>
                        ) : null}
                      </td>

                      {/* HE & Noturno */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums whitespace-nowrap">
                        {heNoturno > 0 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            +{showValues ? formatCurrency(heNoturno) : '••••'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Benefícios */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums whitespace-nowrap">
                        {beneficios > 0 ? (
                          <span className="font-bold text-cyan-700 dark:text-cyan-400">
                            +{showValues ? formatCurrency(beneficios) : '••••'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* 13º & Férias */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums whitespace-nowrap">
                        {decimoFerias > 0 ? (
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            +{showValues ? formatCurrency(decimoFerias) : '••••'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Descontos */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums whitespace-nowrap">
                        {cost.valor_descontos && cost.valor_descontos > 0 ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            -{showValues ? formatCurrency(cost.valor_descontos) : '••••'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Total Real Desembolsado */}
                      <td className="px-4 py-3 align-middle text-right tabular-nums whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-black text-xs shadow-2xs">
                          {showValues ? formatCurrency(realTotal) : '••••••'}
                        </span>
                      </td>

                      {/* Origem */}
                      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
                        <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-700">
                          {cost.origem === 'dianna_import' 
                            ? 'Dianna' 
                            : (cost.origem === 'dianna_batch_clt' 
                              ? 'Folha CLT' 
                              : (cost.origem || 'Manual'))}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 align-middle text-center sticky right-0 bg-white dark:bg-slate-900 shadow-2xs whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onClose(); // fecha o modal primeiro para não ficar sobreposto
                              onEditCost(cost, emp);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                            title="Editar lançamento desta competência"
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            type="button"
                            disabled={isDeletingThis}
                            onClick={() => handleDeleteCost(cost.id, name, cost.competencia)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors disabled:opacity-50"
                            title="Excluir lançamento permanentemente"
                          >
                            {isDeletingThis ? (
                              <Loader2 size={15} className="animate-spin text-rose-500" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            Exibindo <strong className="text-slate-800 dark:text-slate-200">{filteredRows.length}</strong> de <strong className="text-slate-800 dark:text-slate-200">{monthlyCosts.length}</strong> lançamentos no total.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              Fechar Painel
            </button>
          </div>
        </div>

        {/* MODAL DE INGESTÃO E AUDITORIA DUAL (FOLHA DE PAGAMENTO / PLANILHA EXCEL) */}
        {isImportModalOpen && (
          <CostImportStagingModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onSuccess={() => {
              onCostDeleted(); // Dispara recarregamento no componente pai
              setSuccessToast("Lançamentos de custos sincronizados com sucesso!");
              setTimeout(() => setSuccessToast(null), 3500);
            }}
            existingEmployees={employees}
            defaultCompetencia={selectedCompetencia !== 'all' ? selectedCompetencia : undefined}
          />
        )}

      </div>
    </div>
  );
}
