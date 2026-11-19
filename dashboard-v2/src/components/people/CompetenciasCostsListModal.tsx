import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  X, Calendar, Filter, Search, Trash2, Edit3, Loader2, 
  CheckCircle2, AlertTriangle, ArrowUpDown, DollarSign, Wallet, 
  Users, ChevronRight, ChevronDown, FileSpreadsheet, RotateCcw, Building2, Briefcase, Download, Upload,
  Printer, FileText, CheckSquare, Square, Check, SlidersHorizontal, Eye, Lock, Layers, Save, Coins, Receipt, Info, Sparkles
} from 'lucide-react';
import { Employee, MonthlyCost } from '@/types/loans';
import { PeopleHRService, calculateRowFinancials, RowFinancials } from '@/services/people-hr.service';
import { formatCurrency } from '@/services/loans.service';
import {
  buildCompetenciasCostsPdfHtml,
  buildMirrorRowDetail,
  buildSummaryCompositionData,
  CompetenciasPdfReportType,
  partitionCompetenciaPdfRows,
} from '@/services/competencias-costs-pdf.service';
import { buildCompetenciasAnomalyMap } from '@/services/people-cost-anomaly.service';
import { CostImportStagingModal } from '@/components/people/CostImportStagingModal';
import { PeopleCostsCopilotModal } from '@/components/people/PeopleCostsCopilotModal';

interface CompetenciasCostsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  filteredEmployees?: Employee[];
  monthlyCosts: MonthlyCost[];
  onCostDeleted: () => void;
  onEditCost: (cost: MonthlyCost, employee?: Employee) => void;
  showValues?: boolean;
  initialSearch?: string;
  initialCompetencia?: string;
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
  initialSearch,
  initialCompetencia,
}: CompetenciasCostsListModalProps) {
  // Estado local sincronizado de custos para atualização instantânea
  const [localCosts, setLocalCosts] = useState<MonthlyCost[]>(monthlyCosts);

  // Sincroniza localCosts sempre que monthlyCosts for carregado ou atualizado pelo componente pai
  useEffect(() => {
    if (monthlyCosts && monthlyCosts.length > 0) {
      setLocalCosts(monthlyCosts);
    }
  }, [monthlyCosts, isOpen]);

  // Garante que, caso localCosts ainda não tenha sincronizado, activeCosts utilize monthlyCosts imediatamente
  const activeCosts = useMemo(() => {
    return (localCosts && localCosts.length > 0) ? localCosts : (monthlyCosts || []);
  }, [localCosts, monthlyCosts]);

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
  const [onlyAnomalies, setOnlyAnomalies] = useState<boolean>(false);
  const [usePageScope, setUsePageScope] = useState<boolean>(() => {
    return Boolean(filteredEmployees && filteredEmployees.length > 0 && filteredEmployees.length < employees.length);
  });
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Ações e ordenação
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'competencia' | 'name' | 'total'>('competencia');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCopilotModalOpen, setIsCopilotModalOpen] = useState(false);

  // Estados de Seleção em Lote (Checkboxes para Extra-Folha)
  const [selectedCostIds, setSelectedCostIds] = useState<Set<string>>(new Set());
  const [batchVt, setBatchVt] = useState<string>('');
  const [batchCesta, setBatchCesta] = useState<string>('');
  const [batchBonus, setBatchBonus] = useState<string>('');
  const [batchComplementos, setBatchComplementos] = useState<string>('');
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // Estados do Modal de Relatório PDF (Analítico 10 Colunas vs Sintético)
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfReportType, setPdfReportType] = useState<CompetenciasPdfReportType>('analitico');

  // Estados para Edição Direta no Modal (Elimina Looping)
  const [editingRowCost, setEditingRowCost] = useState<{ cost: MonthlyCost; emp?: Employee } | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<MonthlyCost>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Estados para Detalhamento de Verbas
  const [verbasDetailRow, setVerbasDetailRow] = useState<{ cost: MonthlyCost; emp?: Employee; name: string } | null>(null);
  const [isSummaryVerbasModalOpen, setIsSummaryVerbasModalOpen] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Inicialização com valores passados por redirecionamento (da Ficha ou Cockpit)
  useEffect(() => {
    if (isOpen) {
      if (initialSearch !== undefined) {
        setSearchTerm(initialSearch);
      }
      if (initialCompetencia && initialCompetencia !== 'all') {
        setSelectedCompetencia(initialCompetencia);
        setSelectedCompetencias([initialCompetencia]);
        setCompFilterMode('single');
      }
    }
  }, [isOpen, initialSearch, initialCompetencia]);

  // Limpa seleção ao alterar filtros principais e volta scroll da tabela virtualizada ao topo
  useEffect(() => {
    setSelectedCostIds(new Set());
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTop = 0;
    }
  }, [selectedYears, compFilterMode, selectedCompetencia, selectedCompetencias, selectedVinculo, selectedEmpresa, selectedSetor, searchTerm, onlyAnomalies]);

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

  // Anos disponíveis extraídos de activeCosts
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(activeCosts.map(c => c.competencia?.split('-')[0]))).filter(Boolean);
    return years.sort().reverse();
  }, [activeCosts]);

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
    let comps = Array.from(new Set(activeCosts.map(c => c.competencia))).filter(Boolean);
    if (selectedYears.length > 0) {
      comps = comps.filter(c => selectedYears.some(y => c.startsWith(y)));
    }
    return comps.sort().reverse();
  }, [activeCosts, selectedYears]);

  // Se o ano filtrado mudar e a competência selecionada não pertencer aos anos ativos, reseta para 'all'
  useEffect(() => {
    if (selectedCompetencia !== 'all' && selectedYears.length > 0) {
      const compYear = selectedCompetencia.split('-')[0];
      if (!selectedYears.includes(compYear)) {
        setSelectedCompetencia('all');
      }
    }
  }, [selectedYears, selectedCompetencia]);

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

  // Enriquecimento único O(N) de todos os lançamentos (evita recalcular calculateRowFinancials a cada filtro)
  const allRowsEnriched = useMemo(() => {
    return activeCosts.map(cost => {
      const emp = employeesMap.get(cost.employee_id);
      const isCLT = cost.vinculo_tipo === 'CLT' || emp?.linkType === 'CLT';
      const isEstagio = emp?.linkType === 'Estagiário' || (emp?.linkType || '').toLowerCase().includes('estag');
      const isPJ = !isCLT && !isEstagio;
      const financials = calculateRowFinancials(cost, isCLT);
      const realTotal = financials.realTotal;
      const name = emp?.name || (cost as any).nome_colaborador || 'Colaborador';
      return {
        cost,
        emp,
        name,
        financials,
        realTotal,
        isCLT,
        isPJ,
        isEstagio,
      };
    });
  }, [activeCosts, employeesMap]);

  // Auditoria automática MoM O(N) sobre todo o histórico disponível (mesmo quando apenas 1 mês está filtrado)
  const anomaliesByCostId = useMemo(
    () => buildCompetenciasAnomalyMap(allRowsEnriched),
    [allRowsEnriched]
  );

  // Filtragem base (antes do toggle de anomalias para preservar o contador de alertas do escopo)
  const baseFilteredRows = useMemo(() => {
    let rows = allRowsEnriched;

    // 1. Escopo de página ativa
    if (usePageScope && pageFilteredEmpIds) {
      rows = rows.filter(r => pageFilteredEmpIds.has(r.cost.employee_id));
    }

    // 2. Filtro de Múltiplos Anos
    if (selectedYears.length > 0) {
      rows = rows.filter(r => selectedYears.some(y => r.cost.competencia?.startsWith(y)));
    }

    // 3. Filtro de Competência (Multiseleção direta ou modos rápidos)
    if (selectedCompetencias.length > 0) {
      rows = rows.filter(r => selectedCompetencias.some(c => r.cost.competencia?.slice(0, 7) === c.slice(0, 7)));
    } else if (compFilterMode === 'single') {
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

    // 9. Ordenação (em cópia rasa para não mutar allRowsEnriched)
    return [...rows].sort((a, b) => {
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
  }, [
    allRowsEnriched, usePageScope, pageFilteredEmpIds,
    selectedYears, compFilterMode, selectedCompetencia, periodStart, periodEnd, selectedCompetencias,
    selectedEmpresa, selectedVinculo,
    selectedStatus, selectedSetor, searchTerm, sortField, sortOrder,
  ]);

  const anomaliesCountInScope = useMemo(
    () => baseFilteredRows.reduce((acc, r) => acc + (anomaliesByCostId.has(r.cost.id) ? 1 : 0), 0),
    [baseFilteredRows, anomaliesByCostId]
  );

  // Linhas finais exibidas na tabela (com filtro opcional de Alertas MoM)
  const filteredRows = useMemo(() => {
    if (!onlyAnomalies) return baseFilteredRows;
    return baseFilteredRows.filter(r => anomaliesByCostId.has(r.cost.id));
  }, [baseFilteredRows, onlyAnomalies, anomaliesByCostId]);

  // Virtualização 60fps da tabela (suporta 2.150+ lançamentos sem congelamento de DOM)
  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: (index) => {
      const row = filteredRows[index];
      if (!row) return 60;
      if (expandedRowIds.has(row.cost.id)) return 290;
      return anomaliesByCostId.has(row.cost.id) ? 76 : 58;
    },
    overscan: 8,
    useFlushSync: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    const rafId = requestAnimationFrame(() => {
      rowVirtualizer.measure();
    });
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, expandedRowIds, filteredRows.length, sortField, sortOrder, rowVirtualizer]);

  // Particionamento por Natureza Jurídica (CLT, Estágio e PJ/MEI) — Fonte única compartilhada com o PDF
  const partitionedView = useMemo(
    () => partitionCompetenciaPdfRows(filteredRows),
    [filteredRows]
  );

  const summaryComposition = useMemo(
    () => buildSummaryCompositionData(filteredRows),
    [filteredRows]
  );

  const isPjOnlyView = selectedVinculo === 'PJ' || (
    filteredRows.length > 0 &&
    partitionedView.grandTotals.regimesPresent.length === 1 &&
    partitionedView.grandTotals.regimesPresent[0] === 'PJ'
  );
  const isEstagioOnlyView = selectedVinculo === 'ESTAGIO' || (
    filteredRows.length > 0 &&
    partitionedView.grandTotals.regimesPresent.length === 1 &&
    partitionedView.grandTotals.regimesPresent[0] === 'ESTAGIO'
  );
  const isMixedRegimeView = partitionedView.grandTotals.isMixed;
  const hasEstagioAntecipacao = partitionedView.estagioTotals.antecipacaoEstagio > 0;

  // Totais analíticos e consolidados de todas as verbas do filtro ativo
  const summaryTotals = useMemo(() => {
    let totalGeral = 0;
    let totalSalarioFixo = 0;
    let totalHorasExtras = 0;
    let totalAdicionalNoturno = 0;
    let totalOutrosProventos = 0;
    let totalDecimoFeriasRescisao = 0;
    let totalProventosBrutos = 0;

    let totalInss = 0;
    let totalIrrf = 0;
    let totalDescontoVt = 0;
    let totalDescontoAdiantamento = 0;
    let totalFaltas = 0;
    let totalConsignado = 0;
    let totalPensaoOutros = 0;
    let totalDescontosFolha = 0;

    let totalAdiantamentoSalarial = 0;
    let totalVtRecarga = 0;
    let totalVrCesta = 0;
    let totalBonus = 0;
    let totalAjudaCusto = 0;
    let totalExtraFolha = 0;

    let totalPjFixo = 0;
    let totalPjBonusComissao = 0;
    let totalPjDeducoesGlosas = 0;
    let totalPjLiquido = 0;

    filteredRows.forEach(r => {
      totalGeral += r.realTotal;

      if (r.isCLT) {
        const f = r.financials;
        totalSalarioFixo += f.fixo;
        totalHorasExtras += f.he;
        totalAdicionalNoturno += f.noturno;
        totalOutrosProventos += f.outrosProv;
        totalDecimoFeriasRescisao += f.decimoFerias;
        totalProventosBrutos += f.proventosFolha;

        totalInss += f.inss;
        totalIrrf += f.irrf;
        totalDescontoVt += f.descVt;
        totalDescontoAdiantamento += f.descAdt;
        totalFaltas += f.faltas;
        totalConsignado += f.consig;
        totalPensaoOutros += f.pensao + Math.max(0, f.descontosFolha - (f.inss + f.irrf + f.descVt + f.descAdt + f.faltas + f.consig + f.pensao));
        totalDescontosFolha += f.descontosFolha;

        totalAdiantamentoSalarial += f.adiantamento;
        totalVtRecarga += f.vt;
        totalVrCesta += (f.cesta + f.vr);
        totalBonus += f.bonus;
        totalAjudaCusto += f.ajudaCusto;
        totalExtraFolha += f.extraFolha;
      } else {
        const f = r.financials;
        totalPjFixo += f.fixo;
        totalPjBonusComissao += f.bonus;
        totalPjDeducoesGlosas += (f.deducoesTotal || 0);
        totalPjLiquido += r.realTotal;
      }
    });

    const uniqueEmployeesCount = new Set(filteredRows.map(r => r.cost.employee_id)).size;
    const countClt = filteredRows.filter(r => r.isCLT).length;
    const countPj = filteredRows.filter(r => r.isPJ).length;
    const avgPerEmployee = uniqueEmployeesCount > 0 ? totalGeral / uniqueEmployeesCount : 0;
    const folhaLiquidaClt = Math.max(0, totalProventosBrutos - totalDescontosFolha);

    return {
      totalGeral,
      countRows: filteredRows.length,
      uniqueEmployeesCount,
      countClt,
      countPj,
      avgPerEmployee,
      // Proventos
      totalSalarioFixo,
      totalHorasExtras,
      totalAdicionalNoturno,
      totalOutrosProventos,
      totalDecimoFeriasRescisao,
      totalProventosBrutos,
      // Descontos
      totalInss,
      totalIrrf,
      totalDescontoVt,
      totalDescontoAdiantamento,
      totalFaltas,
      totalConsignado,
      totalPensaoOutros,
      totalDescontosFolha,
      folhaLiquidaClt,
      // Extra-folha
      totalAdiantamentoSalarial,
      totalVtRecarga,
      totalVrCesta,
      totalBonus,
      totalAjudaCusto,
      totalExtraFolha,
      // PJ
      totalPjFixo,
      totalPjBonusComissao,
      totalPjDeducoesGlosas,
      totalPjLiquido,
      totalSubtotal: totalProventosBrutos + totalOutrosProventos + totalVtRecarga + totalVrCesta + totalBonus + totalAjudaCusto,
      totalOutrosRecebidos: totalOutrosProventos,
      totalVt: totalVtRecarga,
      totalPremiacao: totalAjudaCusto,
      totalAdiantamento: totalAdiantamentoSalarial,
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
    onlyAnomalies ||
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
    setOnlyAnomalies(false);
    setUsePageScope(false);
  };

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

  // Funções de Seleção de Linhas CLT para Edição em Lote
  const selectableRows = useMemo(() => {
    return filteredRows.filter(r => r.isCLT);
  }, [filteredRows]);

  const isAllSelected = selectableRows.length > 0 && selectableRows.every(r => selectedCostIds.has(r.cost.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCostIds(new Set());
    } else {
      setSelectedCostIds(new Set(selectableRows.map(r => r.cost.id)));
    }
  };

  const toggleSelectRow = (costId: string) => {
    setSelectedCostIds(prev => {
      const next = new Set(prev);
      if (next.has(costId)) {
        next.delete(costId);
      } else {
        next.add(costId);
      }
      return next;
    });
  };

  // Aplicação e Gravação de Verbas Extra-Folha em Lote no Supabase
  // Funções de Expansão (Accordion) e Detalhamento de Verbas
  const toggleExpandRow = (costId: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(costId)) {
        next.delete(costId);
      } else {
        next.add(costId);
      }
      return next;
    });
  };

  // Funções de Edição Direta no Modal (Elimina o looping com a Ficha)
  const handleOpenEditModal = (cost: MonthlyCost, emp?: Employee) => {
    setEditingRowCost({ cost, emp });
    setEditFormData({
      ...cost,
      valor_fixo: cost.valor_fixo !== undefined && cost.valor_fixo !== null ? cost.valor_fixo : (cost.valor_liquido || 0),
      valor_hora_extra: cost.valor_hora_extra || 0,
      valor_adicional_not: cost.valor_adicional_not || 0,
      outros_ajustes: cost.outros_ajustes || (cost.verbas_adicionais as any)?.outros_ajustes || 0,
      valor_ferias: cost.valor_ferias || 0,
      valor_decimo_terceiro: cost.valor_decimo_terceiro || 0,
      valor_rescisao: cost.valor_rescisao || 0,
      valor_descontos: cost.valor_descontos || 0,
      valor_faltas: cost.valor_faltas || (cost.verbas_adicionais as any)?.valor_faltas || 0,
      dias_faltas: cost.dias_faltas || 0,
      valor_consignado: cost.valor_consignado || (cost.verbas_adicionais as any)?.valor_consignado || 0,
      valor_pensao_alimenticia: cost.valor_pensao_alimenticia || (cost as any).pensao_alimenticia || (cost.verbas_adicionais as any)?.valor_pensao_alimenticia || 0,
      inss_empregado: cost.inss_empregado || (cost as any).inss || (cost.verbas_adicionais as any)?.inss_empregado || 0,
      irrf_empregado: cost.irrf_empregado || (cost as any).irrf || (cost.verbas_adicionais as any)?.irrf_empregado || 0,
      desconto_vt: (cost as any).desconto_vt || (cost.verbas_adicionais as any)?.desconto_vt || 0,
      desconto_adiantamento: (cost as any).desconto_adiantamento || (cost.verbas_adicionais as any)?.desconto_adiantamento || 0,
      valor_adiantamento: cost.valor_adiantamento || 0,
      valor_vt: cost.valor_vt || 0,
      valor_cesta: cost.valor_cesta || 0,
      valor_vr: cost.valor_vr || 0,
      valor_bonus: cost.valor_bonus || 0,
      valor_comissao: cost.valor_comissao || 0,
      valor_incentivos: cost.valor_incentivos || 0,
      valor_ajuda_custo: cost.valor_ajuda_custo || 0,
      valor_glosa_base: cost.valor_glosa_base || 0,
      valor_glosa_bonus: cost.valor_glosa_bonus || 0,
      valor_deducoes: cost.valor_deducoes || 0,
      observacao: cost.observacao || ''
    } as any);
  };

  const handleSaveEditCost = async () => {
    if (!editingRowCost) return;



    try {
      setIsSavingEdit(true);

      const isCLTType = editingRowCost.cost.vinculo_tipo === 'CLT' || editingRowCost.emp?.linkType === 'CLT';
      let payloadToSave: Partial<MonthlyCost> = {
        ...editFormData,
        id: editingRowCost.cost.id,
        employee_id: editingRowCost.cost.employee_id,
        competencia: editingRowCost.cost.competencia,
        vinculo_tipo: editingRowCost.cost.vinculo_tipo,
      };

      if (isCLTType) {
        const preview = calculateRowFinancials(editFormData as MonthlyCost, true);

        payloadToSave = {
          ...payloadToSave,
          valor_fixo: preview.fixo,
          valor_holerite: preview.proventosFolha,
          valor_hora_extra: preview.he,
          valor_adicional_not: preview.noturno,
          outros_ajustes: preview.outrosProv,
          valor_ferias: preview.ferias,
          valor_decimo_terceiro: preview.decimo,
          valor_rescisao: preview.rescisao,
          valor_descontos: preview.descontosFolha,
          inss_empregado: preview.inss,
          irrf_empregado: preview.irrf,
          valor_faltas: preview.faltas,
          valor_consignado: preview.consig,
          valor_pensao_alimenticia: preview.pensao,
          valor_adiantamento: preview.adiantamento,
          valor_vt: preview.vt,
          valor_cesta: preview.cesta,
          valor_vr: preview.vr,
          valor_bonus: preview.bonus,
          valor_ajuda_custo: preview.ajudaCusto,
          valor_liquido: preview.liquidoFolha,
          verbas_adicionais: {
            ...((editingRowCost.cost.verbas_adicionais as any) || {}),
            desconto_vt: preview.descVt,
            desconto_adiantamento: preview.descAdt,
            inss_empregado: preview.inss,
            irrf_empregado: preview.irrf,
            valor_pensao_alimenticia: preview.pensao,
            outros_ajustes: preview.outrosProv,
          }
        };
      } else {
        const preview = calculateRowFinancials(editFormData as MonthlyCost, false);
        payloadToSave = {
          ...payloadToSave,
          valor_fixo: preview.fixo,
          valor_bonus: preview.bonus,
          valor_ajuda_custo: preview.ajudaCusto,
          valor_glosa_base: preview.glosaBase || 0,
          valor_glosa_bonus: preview.glosaBonus || 0,
          valor_deducoes: preview.deducoes || 0,
          valor_liquido: preview.realTotal,
        };
      }

      await PeopleHRService.upsertMonthlyCost(payloadToSave);

      // Atualiza localmente o registro em localCosts
      setLocalCosts(prev => {
        const base = prev && prev.length > 0 ? prev : monthlyCosts;
        return base.map(item => item.id === editingRowCost.cost.id ? { ...item, ...payloadToSave } as MonthlyCost : item);
      });

      setSuccessToast(`Lançamento de ${editingRowCost.cost.competencia} salvo com sucesso!`);
      setEditingRowCost(null);
      onCostDeleted(); // atualiza base global
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      console.error("Erro ao salvar edição de custo:", err);
      alert("Falha ao salvar lançamento: " + (err.message || err));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleApplyBatchExtraFolha = async () => {
    if (selectedCostIds.size === 0) {
      alert("Selecione pelo menos um colaborador CLT na tabela.");
      return;
    }

    const vtNum = batchVt.trim() !== '' ? parseFloat(batchVt) : null;
    const cestaNum = batchCesta.trim() !== '' ? parseFloat(batchCesta) : null;
    const bonusNum = batchBonus.trim() !== '' ? parseFloat(batchBonus) : null;
    const compNum = batchComplementos.trim() !== '' ? parseFloat(batchComplementos) : null;

    if (vtNum === null && cestaNum === null && bonusNum === null && compNum === null) {
      alert("Informe ao menos um valor em uma das colunas (VT, VR/Cesta, Bônus ou Complementos) para aplicar.");
      return;
    }

    try {
      setIsSavingBatch(true);
      const toUpdate: Partial<MonthlyCost>[] = [];
      let skippedProtectedCount = 0;

      for (const row of filteredRows) {
        if (!selectedCostIds.has(row.cost.id)) continue;
        


        const newVt = vtNum !== null ? vtNum : (row.cost.valor_vt || 0);
        const newCesta = cestaNum !== null ? cestaNum : (row.cost.valor_cesta || 0);
        const newBonus = bonusNum !== null ? bonusNum : (row.cost.valor_bonus || 0);
        const newAjuda = compNum !== null ? compNum : (row.cost.valor_ajuda_custo || 0);

        // Recalcular Total Real Desembolsado:
        const proventos = row.cost.valor_holerite || ((row.cost.valor_fixo || 0) + (row.cost.valor_hora_extra || 0) + (row.cost.valor_adicional_not || 0));
        const descontos = row.cost.valor_descontos || 0;
        const folhaLiq = Math.max(0, proventos - descontos);
        const extraFolha = (row.cost.valor_adiantamento || 0) + newVt + newCesta + (row.cost.valor_vr || 0) + newBonus + newAjuda;
        toUpdate.push({
          id: row.cost.id,
          employee_id: row.cost.employee_id,
          competencia: row.cost.competencia,
          vinculo_tipo: 'CLT',
          valor_vt: newVt,
          valor_cesta: newCesta,
          valor_bonus: newBonus,
          valor_ajuda_custo: newAjuda,
          valor_liquido: folhaLiq,
        });
      }

      if (toUpdate.length === 0) {
        alert("Nenhum lançamento elegível para atualização.");
        return;
      }

      await PeopleHRService.saveMonthlyCostsBatch(toUpdate);
      setSuccessToast(`Sucesso! ${toUpdate.length} lançamentos CLT atualizados em lote.${skippedProtectedCount > 0 ? ` (${skippedProtectedCount} anteriores a Jun/2026 mantidos intactos)` : ''}`);
      setSelectedCostIds(new Set());
      setBatchVt('');
      setBatchCesta('');
      setBatchBonus('');
      setBatchComplementos('');
      onCostDeleted();
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error("Erro na edição em lote de extra-folha:", err);
      alert("Falha ao salvar lote: " + (err.message || err));
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Geração e Emissão de Relatório PDF (Analítico 10 Colunas e Sintético Alinhado)
  const handleGeneratePdf = (type: CompetenciasPdfReportType) => {
    if (filteredRows.length === 0) {
      alert("Nenhum lançamento filtrado para emitir relatório.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor, habilite popups no seu navegador para visualizar o relatório PDF.");
      return;
    }

    const html = buildCompetenciasCostsPdfHtml({
      reportType: type,
      rows: filteredRows,
      filters: {
        selectedYears,
        compFilterMode,
        selectedCompetencia,
        periodStart,
        periodEnd,
        selectedCompetencias,
        selectedEmpresa,
        selectedVinculo,
        selectedStatus,
        selectedSetor,
        searchTerm,
        usePageScope,
      },
      generatedAt: new Date(),
    });

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setIsPdfModalOpen(false);
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

  if (!isOpen) return null;

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

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCopilotModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 hover:bg-teal-100 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
              title="Consultar toda a série histórica de custos via Copiloto Determinístico (Tool Calling)"
            >
              <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Copiloto Custos</span>
            </button>
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
            <button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
              title="Emitir Relatório PDF (Sintético Executivo ou Analítico de Folha)"
            >
              <Printer size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>Relatório PDF</span>
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

          {/* BARRA DE SELEÇÃO MÚLTIPLA DE MESES (COMPETÊNCIAS) */}
          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
              <Calendar size={13} className="text-emerald-600" />
              Meses:
            </span>

            {/* Botão: Todos os Meses */}
            <button
              type="button"
              onClick={() => {
                setSelectedCompetencias([]);
                setSelectedCompetencia('all');
              }}
              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all ${
                selectedCompetencias.length === 0 && selectedCompetencia === 'all'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              Todos os Meses
            </button>

            {/* Atalhos Rápidos de Seleção */}
            {availableCompetencias.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] border-l border-r border-slate-200 dark:border-slate-800 px-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (availableCompetencias[0]) {
                      const latest = availableCompetencias[0].slice(0, 7);
                      setSelectedCompetencias([latest]);
                      setSelectedCompetencia(latest);
                    }
                  }}
                  className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 font-bold"
                  title="Selecionar apenas a competência mais recente"
                >
                  Último
                </button>
                {availableCompetencias.length >= 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      const latest3 = availableCompetencias.slice(0, 3).map(c => c.slice(0, 7));
                      setSelectedCompetencias(latest3);
                      setSelectedCompetencia('all');
                    }}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 font-bold"
                    title="Selecionar as 3 últimas competências"
                  >
                    Últimos 3
                  </button>
                )}
                {availableCompetencias.length >= 6 && (
                  <button
                    type="button"
                    onClick={() => {
                      const latest6 = availableCompetencias.slice(0, 6).map(c => c.slice(0, 7));
                      setSelectedCompetencias(latest6);
                      setSelectedCompetencia('all');
                    }}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 font-bold"
                    title="Selecionar as 6 últimas competências"
                  >
                    Últimos 6
                  </button>
                )}
              </div>
            )}

            {/* Pills de cada mês com seleção múltipla intuitiva */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full">
              {availableCompetencias.map(comp => {
                const compKey = comp.slice(0, 7);
                const isSelected = selectedCompetencias.includes(compKey) || (selectedCompetencias.length === 0 && selectedCompetencia === compKey);
                const parts = comp.split('-');
                const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                const mIdx = parseInt(parts[1], 10) - 1;
                const shortLabel = `${monthsShort[mIdx] || parts[1]}/${parts[0]?.slice(2)}`;

                return (
                  <button
                    type="button"
                    key={comp}
                    onClick={() => {
                      setSelectedCompetencia('all');
                      setSelectedCompetencias(prev => {
                        if (prev.includes(compKey)) {
                          return prev.filter(k => k !== compKey);
                        } else {
                          return [...prev, compKey];
                        }
                      });
                    }}
                    className={`px-2 py-1 text-[11px] font-extrabold rounded-lg whitespace-nowrap transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-2xs ring-2 ring-emerald-500/40'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                    title={`Clique para selecionar ou desmarcar ${formatCompetenciaLabel(comp)}`}
                  >
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    <span>{shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {selectedCompetencias.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCompetencias([]);
                  setSelectedCompetencia('all');
                }}
                className="text-[10px] font-bold text-rose-500 hover:text-rose-700 underline ml-auto shrink-0"
              >
                Limpar ({selectedCompetencias.length} selecionado{selectedCompetencias.length > 1 ? 's' : ''})
              </button>
            )}
          </div>

          {/* Linha 2: Controles de Filtros em Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2.5 items-center">
            
            {/* Seletor Rápido de Competência em Dropdown */}
            <div className="lg:col-span-3">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Filtro de Competência
              </label>
              <div className="relative">
                <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedCompetencias.length === 1 ? selectedCompetencias[0] : (selectedCompetencias.length > 1 ? 'multi' : selectedCompetencia)}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'all') {
                      setSelectedCompetencias([]);
                      setSelectedCompetencia('all');
                    } else if (val === 'multi') {
                      // mantém multi
                    } else {
                      setSelectedCompetencias([val]);
                      setSelectedCompetencia(val);
                    }
                  }}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                >
                  <option value="all">
                    {selectedCompetencias.length === 0 
                      ? `Todos os Meses (${availableCompetencias.length})` 
                      : `Todos os Meses`}
                  </option>
                  {selectedCompetencias.length > 1 && (
                    <option value="multi" disabled>
                      {selectedCompetencias.length} meses selecionados
                    </option>
                  )}
                  {availableCompetencias.map(comp => (
                    <option key={comp} value={comp.slice(0, 7)}>
                      {formatCompetenciaLabel(comp)}
                    </option>
                  ))}
                </select>
              </div>
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

        {/* SUMMARY KPI CARDS & COMPOSIÇÃO DE VERBAS */}
        <div className="px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0 space-y-2">
          {/* Cabeçalho dos Totalizadores com Botão de Composição */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Receipt size={14} className={isPjOnlyView ? 'text-teal-600' : isEstagioOnlyView ? 'text-amber-600' : 'text-emerald-600'} />
                {isPjOnlyView
                  ? 'Totalizadores Contratuais — Prestação de Serviços (PJ / MEI)'
                  : isEstagioOnlyView
                    ? 'Totalizadores — Bolsas de Estágio (Lei nº 11.788/2008)'
                    : 'Totalizadores Consolidados da Seleção'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {filteredRows.length} {isPjOnlyView ? (filteredRows.length === 1 ? 'faturamento' : 'faturamentos') : (filteredRows.length === 1 ? 'lançamento' : 'lançamentos')}
              </span>
              {anomaliesCountInScope > 0 && (
                <button
                  type="button"
                  onClick={() => setOnlyAnomalies(prev => !prev)}
                  className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                    onlyAnomalies
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
                  }`}
                  title="Filtrar lançamentos com variação MoM ≥15%, benefícios zerados ou divergência contratual"
                >
                  <AlertTriangle size={11} />
                  <span>Alertas MoM ({anomaliesCountInScope})</span>
                </button>
              )}
            </div>

            {/* BOTÃO PRINCIPAL DE TRANSPARÊNCIA: COMPOSIÇÃO DAS VERBAS */}
            <button
              type="button"
              onClick={() => setIsSummaryVerbasModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer group"
              title="Clique para ver o relatório executivo completo de cada verba e valor que formam os totalizadores"
            >
              <Layers size={14} className="group-hover:rotate-12 transition-transform" />
              <span>Ver Composição Detalhada dos Totalizadores</span>
            </button>
          </div>

          {/* Faixa Executiva de Segregação por Natureza Jurídica (quando múltiplos regimes estão visíveis) */}
          {isMixedRegimeView && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black uppercase tracking-wider text-slate-500 text-[10px]">Por Natureza Jurídica:</span>
                {partitionedView.cltRows.length > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 font-bold tabular-nums">
                    Folha CLT ({partitionedView.cltTotals.countRows}): {showValues ? formatCurrency(partitionedView.cltTotals.liquido) : '••••'}
                  </span>
                )}
                {partitionedView.estagioRows.length > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 font-bold tabular-nums">
                    Estágio ({partitionedView.estagioTotals.countRows}): {showValues ? formatCurrency(partitionedView.estagioTotals.liquido) : '••••'}
                  </span>
                )}
                {partitionedView.pjRows.length > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 font-bold tabular-nums">
                    Contratos PJ/MEI ({partitionedView.pjTotals.countRows}): {showValues ? formatCurrency(partitionedView.pjTotals.valorLiquidoNf) : '••••'}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                No PDF, CLT, Estágio e PJ são segregados em cadernos independentes.
              </span>
            </div>
          )}

          {/* Cards Dinâmicos por Natureza Jurídica: PJ B2B (6 cards) | Estágio (6/7 cards) | CLT (10 cards) */}
          {isPjOnlyView ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] font-black text-slate-500 uppercase block truncate">1. Honorários / NF Base</span>
                <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 tabular-nums block truncate">
                  {showValues ? formatCurrency(partitionedView.pjTotals.honorariosBase) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-sky-200 dark:border-sky-900/50">
                <span className="text-[9px] font-black text-sky-600 uppercase block truncate">2. + Variável / Comissões</span>
                <span className="text-xs sm:text-sm font-black text-sky-700 dark:text-sky-300 tabular-nums block truncate">
                  +{showValues ? formatCurrency(partitionedView.pjTotals.variavelComissoes) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-teal-200 dark:border-teal-900/50">
                <span className="text-[9px] font-black text-teal-600 uppercase block truncate">3. + Conectividade / Reemb.</span>
                <span className="text-xs sm:text-sm font-black text-teal-700 dark:text-teal-300 tabular-nums block truncate">
                  +{showValues ? formatCurrency(partitionedView.pjTotals.conectividadeReembolso) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl border-2 border-blue-400 dark:border-blue-700 shadow-2xs">
                <span className="text-[9px] font-black text-blue-800 dark:text-blue-300 uppercase block truncate">= Valor Bruto NF</span>
                <span className="text-xs sm:text-sm font-black text-blue-900 dark:text-blue-200 tabular-nums block truncate">
                  {showValues ? formatCurrency(partitionedView.pjTotals.valorBrutoNf) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-300 dark:border-rose-800">
                <span className="text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase block truncate">(-) Glosas / Deduções</span>
                <span className="text-xs sm:text-sm font-black text-rose-700 dark:text-rose-400 tabular-nums block truncate">
                  -{showValues ? formatCurrency(partitionedView.pjTotals.glosasDeducoes) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-emerald-100/80 dark:bg-emerald-950/80 rounded-xl border-2 border-emerald-500 dark:border-emerald-600 shadow-sm">
                <span className="text-[9px] font-black text-emerald-800 dark:text-emerald-300 uppercase block truncate">= Valor Líquido NF</span>
                <span className="text-xs sm:text-sm font-black text-emerald-900 dark:text-emerald-200 tabular-nums block truncate">
                  {showValues ? formatCurrency(partitionedView.pjTotals.valorLiquidoNf) : '••••'}
                </span>
              </div>
            </div>
          ) : isEstagioOnlyView ? (
            <div className={`grid grid-cols-2 sm:grid-cols-3 ${hasEstagioAntecipacao ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} gap-2`}>
              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] font-black text-slate-500 uppercase block truncate">1. Bolsa-Auxílio</span>
                <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 tabular-nums block truncate">
                  {showValues ? formatCurrency(partitionedView.estagioTotals.bolsaAuxilio) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                <span className="text-[9px] font-black text-emerald-600 uppercase block truncate">2. + Aux. Transporte</span>
                <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums block truncate">
                  +{showValues ? formatCurrency(partitionedView.estagioTotals.auxilioTransporte) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900/50">
                <span className="text-[9px] font-black text-blue-600 uppercase block truncate">3. + Outros Auxílios</span>
                <span className="text-xs sm:text-sm font-black text-blue-700 dark:text-blue-300 tabular-nums block truncate">
                  +{showValues ? formatCurrency(partitionedView.estagioTotals.outrosAuxilios) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl border-2 border-blue-400 dark:border-blue-700 shadow-2xs">
                <span className="text-[9px] font-black text-blue-800 dark:text-blue-300 uppercase block truncate">= Subtotal</span>
                <span className="text-xs sm:text-sm font-black text-blue-900 dark:text-blue-200 tabular-nums block truncate">
                  {showValues ? formatCurrency(partitionedView.estagioTotals.subtotal) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-300 dark:border-rose-800">
                <span className="text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase block truncate">(-) Deduções</span>
                <span className="text-xs sm:text-sm font-black text-rose-700 dark:text-rose-400 tabular-nums block truncate">
                  -{showValues ? formatCurrency(partitionedView.estagioTotals.deducoesEstagio) : '••••'}
                </span>
              </div>

              {hasEstagioAntecipacao && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-800">
                  <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase block truncate">(+) Antecipação</span>
                  <span className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-400 tabular-nums block truncate">
                    +{showValues ? formatCurrency(partitionedView.estagioTotals.antecipacaoEstagio) : '••••'}
                  </span>
                </div>
              )}

              <div className="p-2 bg-emerald-100/80 dark:bg-emerald-950/80 rounded-xl border-2 border-emerald-500 dark:border-emerald-600 shadow-sm">
                <span className="text-[9px] font-black text-emerald-800 dark:text-emerald-300 uppercase block truncate">= Valor Líquido</span>
                <span className="text-xs sm:text-sm font-black text-emerald-900 dark:text-emerald-200 tabular-nums block truncate">
                  {showValues ? formatCurrency(partitionedView.estagioTotals.liquido) : '••••'}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] font-black text-slate-500 uppercase block truncate">1. Proventos (Folha)</span>
                <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 tabular-nums block truncate">
                  {showValues ? formatCurrency(summaryTotals.totalProventosBrutos) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900/50">
                <span className="text-[9px] font-black text-blue-600 uppercase block truncate">2. + Outros</span>
                <span className="text-xs sm:text-sm font-black text-blue-700 dark:text-blue-300 tabular-nums block truncate">
                  +{showValues ? formatCurrency(summaryTotals.totalOutrosProventos) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                <span className="text-[9px] font-black text-emerald-600 uppercase block truncate">3. + VT</span>
                <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums block truncate">
                  +{showValues ? formatCurrency(summaryTotals.totalVtRecarga) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/50">
                <span className="text-[9px] font-black text-amber-600 uppercase block truncate">4. + VR / Cesta</span>
                <span className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-300 tabular-nums block truncate">
                  +{showValues ? formatCurrency(summaryTotals.totalVrCesta) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-sky-200 dark:border-sky-900/50">
                <span className="text-[9px] font-black text-sky-600 uppercase block truncate">5. + Bônus</span>
                <span className="text-xs sm:text-sm font-black text-sky-700 dark:text-sky-300 tabular-nums block truncate">
                  +{showValues ? formatCurrency(summaryTotals.totalBonus) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-teal-200 dark:border-teal-900/50">
                <span className="text-[9px] font-black text-teal-600 uppercase block truncate">6. + Premiação</span>
                <span className="text-xs sm:text-sm font-black text-teal-700 dark:text-teal-300 tabular-nums block truncate">
                  +{showValues ? formatCurrency(summaryTotals.totalAjudaCusto) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl border-2 border-blue-400 dark:border-blue-700 shadow-2xs">
                <span className="text-[9px] font-black text-blue-800 dark:text-blue-300 uppercase block truncate">= Subtotal</span>
                <span className="text-xs sm:text-sm font-black text-blue-900 dark:text-blue-200 tabular-nums block truncate">
                  {showValues ? formatCurrency(summaryTotals.totalSubtotal || (summaryTotals.totalProventosBrutos + summaryTotals.totalOutrosProventos + summaryTotals.totalVtRecarga + summaryTotals.totalVrCesta + summaryTotals.totalBonus + summaryTotals.totalAjudaCusto)) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-300 dark:border-rose-800">
                <span className="text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase block truncate">(-) Desc. Folha</span>
                <span className="text-xs sm:text-sm font-black text-rose-700 dark:text-rose-400 tabular-nums block truncate">
                  -{showValues ? formatCurrency(summaryTotals.totalDescontosFolha) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-800">
                <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase block truncate">(+) Adiantamento</span>
                <span className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-400 tabular-nums block truncate">
                  +{showValues ? formatCurrency(summaryTotals.totalAdiantamentoSalarial) : '••••'}
                </span>
              </div>

              <div className="p-2 bg-emerald-100/80 dark:bg-emerald-950/80 rounded-xl border-2 border-emerald-500 dark:border-emerald-600 shadow-sm">
                <span className="text-[9px] font-black text-emerald-800 dark:text-emerald-300 uppercase block truncate">{isMixedRegimeView ? '= Total Grupo' : '= Líquido'}</span>
                <span className="text-xs sm:text-sm font-black text-emerald-900 dark:text-emerald-200 tabular-nums block truncate">
                  {showValues ? formatCurrency(summaryTotals.totalGeral) : '••••'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* BARRA DE AÇÃO EM LOTE PARA VERBAS EXTRA-FOLHA (QUANDO CHECKBOX ATIVO) */}
        {selectedCostIds.size > 0 && (
          <div className="px-6 py-2.5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-slate-50 dark:to-slate-900 border-b border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 shrink-0 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                {selectedCostIds.size} Colaborador{selectedCostIds.size !== 1 ? 'es' : ''} CLT Selecionado{selectedCostIds.size !== 1 ? 's' : ''}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                (Edição em lote de verbas extra-folha)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500">VT:</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="R$ 0,00"
                  value={batchVt}
                  onChange={e => setBatchVt(e.target.value)}
                  className="w-20 text-xs font-bold text-right outline-none bg-transparent text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500">VR/Cesta:</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="R$ 0,00"
                  value={batchCesta}
                  onChange={e => setBatchCesta(e.target.value)}
                  className="w-20 text-xs font-bold text-right outline-none bg-transparent text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500">Bônus:</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="R$ 0,00"
                  value={batchBonus}
                  onChange={e => setBatchBonus(e.target.value)}
                  className="w-20 text-xs font-bold text-right outline-none bg-transparent text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500">Compl.:</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="R$ 0,00"
                  value={batchComplementos}
                  onChange={e => setBatchComplementos(e.target.value)}
                  className="w-20 text-xs font-bold text-right outline-none bg-transparent text-slate-800 dark:text-slate-200"
                />
              </div>

              <button
                type="button"
                onClick={handleApplyBatchExtraFolha}
                disabled={isSavingBatch}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingBatch ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                <span>Aplicar e Gravar</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCostIds(new Set())}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        {/* TABELA DE LISTA DE COMPETÊNCIAS (VIRTUALIZADA 60fps) */}
        <div ref={tableScrollRef} className="flex-1 overflow-y-auto overflow-x-auto min-h-0 bg-slate-50/30 dark:bg-slate-950/20">
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
                  {!isPjOnlyView && (
                    <th className="px-3 py-3 w-10 text-center select-none">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                        title="Selecionar todos os colaboradores CLT visíveis"
                      />
                    </th>
                  )}

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
                      {isPjOnlyView ? 'Contratada (Razão Social) / CNPJ' : isEstagioOnlyView ? 'Estagiário / Modalidade' : 'Colaborador / Regime'}
                      <ArrowUpDown size={12} className={sortField === 'name' ? 'text-emerald-600' : 'opacity-40'} />
                    </div>
                  </th>

                  {isPjOnlyView ? (
                    <>
                      <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 text-right bg-slate-500/10 rounded-t whitespace-nowrap">
                        Honorários / NF Base
                      </th>
                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300 text-right bg-sky-500/10 rounded-t whitespace-nowrap">
                        + Variável / Comissões
                      </th>
                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-300 text-right bg-teal-500/10 rounded-t whitespace-nowrap">
                        + Conectividade / Reemb.
                      </th>
                      <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-200 text-right bg-blue-500/20 whitespace-nowrap">
                        = Valor Bruto NF
                      </th>
                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-rose-600 text-right bg-rose-500/10 rounded-t whitespace-nowrap">
                        (-) Glosas / Deduções
                      </th>
                      <th 
                        onClick={() => toggleSort('total')}
                        className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 text-right bg-emerald-500/20 cursor-pointer select-none whitespace-nowrap"
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          = Valor Líquido NF
                          <ArrowUpDown size={12} className={sortField === 'total' ? 'text-emerald-600' : 'opacity-40'} />
                        </div>
                      </th>
                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center whitespace-nowrap">
                        Modalidade
                      </th>
                    </>
                  ) : isEstagioOnlyView ? (
                    <>
                      <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 text-right bg-slate-500/10 rounded-t whitespace-nowrap">
                        Bolsa-Auxílio
                      </th>
                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 text-right bg-emerald-500/10 rounded-t whitespace-nowrap">
                        + Aux. Transporte
                      </th>
                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 text-right bg-blue-500/10 rounded-t whitespace-nowrap">
                        + Outros Auxílios
                      </th>
                      <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-200 text-right bg-blue-500/20 whitespace-nowrap">
                        = Subtotal
                      </th>
                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-rose-600 text-right bg-rose-500/10 rounded-t whitespace-nowrap">
                        (-) Deduções
                      </th>
                      {hasEstagioAntecipacao && (
                        <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 text-right bg-amber-500/10 rounded-t whitespace-nowrap">
                          (+) Antecipação
                        </th>
                      )}
                      <th 
                        onClick={() => toggleSort('total')}
                        className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 text-right bg-emerald-500/20 cursor-pointer select-none whitespace-nowrap"
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          = Valor Líquido
                          <ArrowUpDown size={12} className={sortField === 'total' ? 'text-emerald-600' : 'opacity-40'} />
                        </div>
                      </th>
                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center whitespace-nowrap">
                        Modalidade
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 text-right bg-slate-500/10 rounded-t whitespace-nowrap">
                        Proventos
                      </th>

                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 text-right bg-blue-500/10 rounded-t whitespace-nowrap">
                        + Outros
                      </th>

                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 text-right bg-emerald-500/10 rounded-t whitespace-nowrap">
                        + VT
                      </th>

                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 text-right bg-amber-500/10 rounded-t whitespace-nowrap">
                        + VR / Cesta
                      </th>

                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300 text-right bg-sky-500/10 rounded-t whitespace-nowrap">
                        + Bônus
                      </th>

                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-300 text-right bg-teal-500/10 rounded-t whitespace-nowrap">
                        + Premiação
                      </th>

                      <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-200 text-right bg-blue-500/20 whitespace-nowrap">
                        = Subtotal
                      </th>

                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-rose-600 text-right bg-rose-500/10 rounded-t whitespace-nowrap">
                        (-) Desc. Folha
                      </th>

                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 text-right bg-amber-500/10 rounded-t whitespace-nowrap">
                        (+) Adiantamento
                      </th>

                      <th 
                        onClick={() => toggleSort('total')}
                        className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 text-right bg-emerald-500/20 cursor-pointer select-none whitespace-nowrap"
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          = Líquido
                          <ArrowUpDown size={12} className={sortField === 'total' ? 'text-emerald-600' : 'opacity-40'} />
                        </div>
                      </th>

                      <th className="px-2 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center whitespace-nowrap">
                        Vínculo
                      </th>
                    </>
                  )}

                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center sticky right-0 bg-slate-100 dark:bg-slate-900 shadow-2xs whitespace-nowrap">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody 
                className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900/60 font-medium"
              >
                {(() => {
                  const virtualItems = rowVirtualizer.getVirtualItems();
                  const totalSize = rowVirtualizer.getTotalSize();
                  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
                  const paddingBottom = virtualItems.length > 0 ? Math.max(0, totalSize - virtualItems[virtualItems.length - 1].end) : 0;
                  const tableColCount = isPjOnlyView ? 10 : isEstagioOnlyView ? (hasEstagioAntecipacao ? 12 : 11) : 15;

                  return (
                    <>
                      {paddingTop > 0 && (
                        <tr aria-hidden="true">
                          <td colSpan={tableColCount} style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} />
                        </tr>
                      )}
                      {virtualItems.map((virtualRow) => {
                        const idx = virtualRow.index;
                        const rowItem = filteredRows[idx];
                        if (!rowItem) return null;
                        const { cost, emp, name, financials, realTotal, isCLT, isEstagio, isPJ } = rowItem;
                        const rowAnomalies = anomaliesByCostId.get(cost.id) || [];
                  const heNoturno = financials.heNoturno;
                  const fixo = financials.fixo;
                  const isDeletingThis = deletingId === cost.id;
                  const pjDisplayName = (emp?.corporate_name || '').trim() || name;
                  const pjCnpj = (emp?.pj_type || emp?.document_id || '').trim();
                  const pjHonorarios = Number(financials.fixo || cost.valor_fixo || cost.valor_liquido || realTotal || 0);
                  const pjVariavel = Number(financials.bonus || 0);
                  const pjConectividade = Number(financials.ajudaCusto || cost.valor_ajuda_custo || 0);
                  const pjBruto = pjHonorarios + pjVariavel + pjConectividade;
                  const pjGlosas = Number(financials.descontosFolha || 0);
                  const hasHol = Number(cost.valor_holerite || 0) > 0;
                  const estBolsa = Number(hasHol ? cost.valor_holerite : (cost.valor_fixo ?? fixo) || 0);
                  const estAuxTransp = Number(cost.valor_vt || 0);
                  const estOutrosVal = (hasHol ? Number(cost.outros_ajustes || 0) : Number(cost.outros_ajustes || heNoturno || 0))
                    + Number((cost.valor_cesta || 0) + (cost.valor_vr || 0))
                    + Number(cost.valor_bonus || 0)
                    + Number(cost.valor_ajuda_custo || 0);
                  const estSubtotal = estBolsa + estAuxTransp + estOutrosVal;
                  const estDeducoes = Number(cost.valor_descontos || financials.descontosFolha || 0);
                  const estAntecipacao = Number(cost.valor_adiantamento || 0);
                  const expandedColSpan = tableColCount;

                  return (
                    <React.Fragment key={`${cost.id || 'cost'}-${cost.competencia || 'comp'}-${idx}`}>
                      <tr 
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group ${
                          selectedCostIds.has(cost.id) ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                      {/* Checkbox de Seleção (Apenas CLT / Estágio quando fora da visão exclusiva PJ) */}
                      {!isPjOnlyView && (
                        <td className="px-3 py-3 text-center align-middle">
                          {isCLT ? (
                            <input
                              type="checkbox"
                              checked={selectedCostIds.has(cost.id)}
                              onChange={() => toggleSelectRow(cost.id)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-300 dark:text-slate-700 font-mono">—</span>
                          )}
                        </td>
                      )}

                      {/* Competência */}
                      <td className="px-4 py-3 align-middle font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {formatCompetenciaLabel(cost.competencia)}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                          {cost.competencia}
                        </span>
                      </td>

                      {/* Identificação: Contratada PJ vs Estagiário vs Colaborador CLT */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandRow(cost.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors shrink-0"
                            title={expandedRowIds.has(cost.id) ? "Recolher composição detalhada" : "Ver composição detalhada desta linha"}
                          >
                            {expandedRowIds.has(cost.id) ? (
                              <ChevronDown size={14} className="text-emerald-600 font-bold" />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                          </button>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                            isEstagio
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                              : isCLT 
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900' 
                                : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-900'
                          }`}>
                            {isEstagio ? 'Estágio' : (isCLT ? 'CLT' : 'PJ')}
                          </span>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 dark:text-slate-100 text-xs truncate max-w-[200px] sm:max-w-[260px]">
                              {isPJ ? pjDisplayName : name}
                            </p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate max-w-[260px]">
                              {emp?.company && (
                                <span className="font-bold text-slate-500 uppercase">{emp.company}</span>
                              )}
                              {emp?.company && <span>&bull;</span>}
                              <span className="truncate">{emp?.job_role || emp?.department || '—'}</span>
                              {isPJ && pjCnpj && (
                                <>
                                  <span>&bull;</span>
                                  <span className="font-mono text-slate-500">CNPJ: {pjCnpj}</span>
                                </>
                              )}
                            </div>
                            {rowAnomalies.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-1">
                                {rowAnomalies.map((anomaly) => (
                                  <span
                                    key={anomaly.code}
                                    title={anomaly.detail}
                                    className={`inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border cursor-help ${
                                      anomaly.severity === 'alert'
                                        ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                        : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                    }`}
                                  >
                                    <AlertTriangle size={9} className="shrink-0" />
                                    {anomaly.shortLabel}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {isPjOnlyView ? (
                        <>
                          {/* Honorários / NF Base */}
                          <td className="px-3 py-3 align-middle text-right tabular-nums font-semibold text-slate-800 dark:text-slate-200 bg-slate-500/5 whitespace-nowrap">
                            {showValues ? formatCurrency(pjHonorarios) : '••••••'}
                          </td>

                          {/* + Variável / Comissões */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-sky-500/5 whitespace-nowrap">
                            {pjVariavel > 0 ? (
                              <span className="font-bold text-sky-700 dark:text-sky-300">
                                +{showValues ? formatCurrency(pjVariavel) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* + Conectividade / Reemb. */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-teal-500/5 whitespace-nowrap">
                            {pjConectividade > 0 ? (
                              <span className="font-bold text-teal-700 dark:text-teal-300">
                                +{showValues ? formatCurrency(pjConectividade) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* = Valor Bruto NF */}
                          <td className="px-3 py-3 align-middle text-right tabular-nums bg-blue-500/10 font-black text-blue-900 dark:text-blue-200 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-blue-100/70 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800">
                              {showValues ? formatCurrency(pjBruto) : '••••••'}
                            </span>
                          </td>

                          {/* (-) Glosas / Deduções */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-rose-500/5 whitespace-nowrap">
                            {pjGlosas > 0 ? (
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                -{showValues ? formatCurrency(pjGlosas) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* = Valor Líquido NF */}
                          <td className="px-3 py-3 align-middle text-right tabular-nums bg-emerald-500/15 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-black text-xs shadow-2xs">
                              {showValues ? formatCurrency(realTotal) : '••••••'}
                            </span>
                          </td>

                          {/* Modalidade PJ */}
                          <td className="px-2 py-3 align-middle text-center whitespace-nowrap">
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md border bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-900">
                              {emp?.linkType === 'MEI' ? 'MEI' : 'PJ'}
                            </span>
                          </td>
                        </>
                      ) : isEstagioOnlyView ? (
                        <>
                          {/* Bolsa-Auxílio */}
                          <td className="px-3 py-3 align-middle text-right tabular-nums font-semibold text-slate-800 dark:text-slate-200 bg-slate-500/5 whitespace-nowrap">
                            {showValues ? formatCurrency(estBolsa) : '••••••'}
                          </td>

                          {/* + Aux. Transporte */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-emerald-500/5 whitespace-nowrap">
                            {estAuxTransp > 0 ? (
                              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                +{showValues ? formatCurrency(estAuxTransp) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* + Outros Auxílios */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-blue-500/5 whitespace-nowrap">
                            {estOutrosVal > 0 ? (
                              <span className="font-bold text-blue-700 dark:text-blue-300">
                                +{showValues ? formatCurrency(estOutrosVal) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* = Subtotal Estágio */}
                          <td className="px-3 py-3 align-middle text-right tabular-nums bg-blue-500/10 font-black text-blue-900 dark:text-blue-200 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-blue-100/70 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800">
                              {showValues ? formatCurrency(estSubtotal) : '••••••'}
                            </span>
                          </td>

                          {/* (-) Deduções Estágio */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-rose-500/5 whitespace-nowrap">
                            {estDeducoes > 0 ? (
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                -{showValues ? formatCurrency(estDeducoes) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {hasEstagioAntecipacao && (
                            <td className="px-2 py-3 align-middle text-right tabular-nums bg-amber-500/5 whitespace-nowrap">
                              {estAntecipacao > 0 ? (
                                <span className="font-bold text-amber-700 dark:text-amber-400">
                                  +{showValues ? formatCurrency(estAntecipacao) : '••••'}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-700">—</span>
                              )}
                            </td>
                          )}

                          {/* = Valor Líquido Estágio */}
                          <td className="px-3 py-3 align-middle text-right tabular-nums bg-emerald-500/15 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-black text-xs shadow-2xs">
                              {showValues ? formatCurrency(realTotal) : '••••••'}
                            </span>
                          </td>

                          {/* Modalidade Estágio */}
                          <td className="px-2 py-3 align-middle text-center whitespace-nowrap">
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md border bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900">
                              Estágio
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Proventos */}
                          <td className="px-3 py-3 align-middle text-right tabular-nums font-semibold text-slate-800 dark:text-slate-200 bg-slate-500/5 whitespace-nowrap">
                            {showValues ? formatCurrency(isPJ ? pjHonorarios : Number(cost.valor_holerite || cost.valor_fixo || fixo || 0)) : '••••••'}
                          </td>

                          {/* + Outros */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-blue-500/5 whitespace-nowrap">
                            {(() => {
                              if (isPJ) return <span className="text-slate-300 dark:text-slate-700">—</span>;
                              const outVal = hasHol ? Number(cost.outros_ajustes || 0) : Number(cost.outros_ajustes || heNoturno || 0);
                              return outVal > 0 ? (
                                <span className="font-bold text-blue-700 dark:text-blue-300">
                                  +{showValues ? formatCurrency(outVal) : '••••'}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-700">—</span>
                              );
                            })()}
                          </td>

                          {/* + VT */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-emerald-500/5 whitespace-nowrap">
                            {!isPJ && Number(cost.valor_vt || 0) > 0 ? (
                              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                +{showValues ? formatCurrency(Number(cost.valor_vt || 0)) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* + VR / Cesta */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-amber-500/5 whitespace-nowrap">
                            {!isPJ && Number((cost.valor_cesta || 0) + (cost.valor_vr || 0)) > 0 ? (
                              <span className="font-bold text-amber-700 dark:text-amber-300">
                                +{showValues ? formatCurrency(Number((cost.valor_cesta || 0) + (cost.valor_vr || 0))) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* + Bônus */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-sky-500/5 whitespace-nowrap">
                            {(isPJ ? pjVariavel : Number(cost.valor_bonus || 0)) > 0 ? (
                              <span className="font-bold text-sky-700 dark:text-sky-300">
                                +{showValues ? formatCurrency(isPJ ? pjVariavel : Number(cost.valor_bonus || 0)) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* + Premiação */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-teal-500/5 whitespace-nowrap">
                            {Number(cost.valor_ajuda_custo || 0) > 0 ? (
                              <span className="font-bold text-teal-700 dark:text-teal-300">
                                +{showValues ? formatCurrency(Number(cost.valor_ajuda_custo || 0)) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* = Subtotal */}
                          <td className="px-3 py-3 align-middle text-right tabular-nums bg-blue-500/10 font-black text-blue-900 dark:text-blue-200 whitespace-nowrap">
                            {(() => {
                              if (isPJ) {
                                return (
                                  <span className="inline-block px-2 py-0.5 rounded-lg bg-blue-100/70 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800">
                                    {showValues ? formatCurrency(pjBruto) : '••••••'}
                                  </span>
                                );
                              }
                              const prov = Number(cost.valor_holerite || cost.valor_fixo || fixo || 0);
                              const out = hasHol ? Number(cost.outros_ajustes || 0) : Number(cost.outros_ajustes || heNoturno || 0);
                              const v = Number(cost.valor_vt || 0);
                              const vrC = Number((cost.valor_cesta || 0) + (cost.valor_vr || 0));
                              const b = Number(cost.valor_bonus || 0);
                              const p = Number(cost.valor_ajuda_custo || 0);
                              const subt = prov + out + v + vrC + b + p;
                              return (
                                <span className="inline-block px-2 py-0.5 rounded-lg bg-blue-100/70 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800">
                                  {showValues ? formatCurrency(subt) : '••••••'}
                                </span>
                              );
                            })()}
                          </td>

                          {/* (-) Desc. Folha */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-rose-500/5 whitespace-nowrap">
                            {(isPJ ? pjGlosas : Number(cost.valor_descontos || financials.descontosFolha || 0)) > 0 ? (
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                -{showValues ? formatCurrency(isPJ ? pjGlosas : Number(cost.valor_descontos || financials.descontosFolha || 0)) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* (+) Adiantamento */}
                          <td className="px-2 py-3 align-middle text-right tabular-nums bg-amber-500/5 whitespace-nowrap">
                            {!isPJ && Number(cost.valor_adiantamento || 0) > 0 ? (
                              <span className="font-bold text-amber-700 dark:text-amber-400">
                                +{showValues ? formatCurrency(Number(cost.valor_adiantamento || 0)) : '••••'}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* = Líquido (Subtotal - Descontos + Adiantamento) */}
                          <td className="px-3 py-3 align-middle text-right tabular-nums bg-emerald-500/15 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-black text-xs shadow-2xs">
                              {showValues ? formatCurrency(realTotal) : '••••••'}
                            </span>
                          </td>

                          {/* Vínculo */}
                          <td className="px-2 py-3 align-middle text-center whitespace-nowrap">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                              isEstagio 
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900' 
                                : isCLT 
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                                  : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-900'
                            }`}>
                              {isEstagio ? 'Estágio' : (isCLT ? 'CLT' : 'PJ')}
                            </span>
                          </td>
                        </>
                      )}

                      {/* Ações */}
                      <td className="px-4 py-3 align-middle text-center sticky right-0 bg-white dark:bg-slate-900 shadow-2xs whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botão Ver Composição Analítica */}
                          <button
                            type="button"
                            onClick={() => setVerbasDetailRow({ cost, emp, name: isPJ ? pjDisplayName : name })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                            title="Ver espelho e composição detalhada desta competência"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Botão Editar Diretamente no Modal (Elimina looping com a Ficha) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(cost, emp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                            title="Editar valores desta competência diretamente"
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* Botão Excluir */}
                          <button
                            type="button"
                            disabled={isDeletingThis}
                            onClick={() => handleDeleteCost(cost.id, isPJ ? pjDisplayName : name, cost.competencia)}
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

                    {/* LINHA ACCORDION: COMPOSIÇÃO DETALHADA EXPANDIDA NA TABELA (SEGREGADA POR NATUREZA JURÍDICA) */}
                    {expandedRowIds.has(cost.id) && (() => {
                      const rowDetail = buildMirrorRowDetail({ cost, emp, name, financials, realTotal, isCLT, isPJ, isEstagio });
                      return (
                      <tr 
                        key={`expanded-${cost.id || 'cost'}-${cost.competencia || 'comp'}-${idx}`}
                        className="bg-slate-50/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 animate-in fade-in"
                      >
                        <td colSpan={expandedColSpan} className="px-4 sm:px-6 py-4">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <Receipt size={14} className={rowDetail.regime === 'PJ' ? 'text-teal-600' : rowDetail.regime === 'ESTAGIO' ? 'text-amber-600' : 'text-emerald-600'} />
                                {rowDetail.regime === 'PJ'
                                  ? `Composição Contratual (${rowDetail.modalidade}) • ${rowDetail.entityName} • ${rowDetail.competenciaFull}`
                                  : rowDetail.regime === 'ESTAGIO'
                                    ? `Composição da Bolsa de Estágio (Lei nº 11.788/2008) • ${rowDetail.entityName} • ${rowDetail.competenciaFull}`
                                    : `Composição Analítica da Folha CLT • ${rowDetail.entityName} • ${rowDetail.competenciaFull}`}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(cost, emp)}
                                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                                >
                                  <Edit3 size={12} />
                                  {rowDetail.regime === 'PJ' ? 'Editar Faturamento' : rowDetail.regime === 'ESTAGIO' ? 'Editar Bolsa' : 'Editar Verbas'}
                                </button>
                                <span>&bull;</span>
                                <button
                                  type="button"
                                  onClick={() => setVerbasDetailRow({ cost, emp, name: rowDetail.entityName })}
                                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                  <Eye size={12} />
                                  {rowDetail.regime === 'PJ' ? 'Abrir Espelho PJ' : 'Abrir Espelho Completo'}
                                </button>
                              </div>
                            </div>

                            {rowAnomalies.length > 0 && (
                              <div className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                  <AlertTriangle size={12} />
                                  Alertas de Auditoria MoM Detectados nesta Competência
                                </span>
                                <ul className="space-y-0.5 text-[11px] text-amber-900 dark:text-amber-200">
                                  {rowAnomalies.map((anomaly) => (
                                    <li key={anomaly.code} className="flex items-start gap-1.5">
                                      <span className="font-black shrink-0">&bull; [{anomaly.shortLabel}]</span>
                                      <span>{anomaly.detail}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {rowDetail.regime === 'CLT' ? (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Coluna 1: Proventos da Folha */}
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-2xs">
                                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">1. Proventos Folha</span>
                                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                                      {showValues ? formatCurrency(rowDetail.proventosTotal) : '••••'}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Salário Base / Fixo:</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{showValues ? formatCurrency(rowDetail.salarioBase) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Horas Extras (50%/100%):</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{showValues ? formatCurrency(rowDetail.horasExtras) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Adicional Noturno:</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{showValues ? formatCurrency(rowDetail.adicionalNoturno) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>13º Salário:</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{showValues ? formatCurrency(rowDetail.decimoTerceiro) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Férias / Rescisão:</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{showValues ? formatCurrency(rowDetail.feriasRescisao) : '••••'}</span>
                                    </div>
                                    {rowDetail.outrosProventos !== 0 && (
                                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Outros Recebidos:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{showValues ? formatCurrency(rowDetail.outrosProventos) : '••••'}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Coluna 2: Descontos de Folha */}
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-2xs">
                                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400">2. Descontos Folha</span>
                                    <span className="text-xs font-black text-rose-700 dark:text-rose-400 tabular-nums">
                                      -{showValues ? formatCurrency(rowDetail.descontosTotal) : '••••'}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>INSS Empregado:</span>
                                      <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">-{showValues ? formatCurrency(rowDetail.inss) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>IRRF Empregado:</span>
                                      <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">-{showValues ? formatCurrency(rowDetail.irrf) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Desc. VT (6%):</span>
                                      <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">-{showValues ? formatCurrency(rowDetail.descontoVt6) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Desc. Adiantamento Folha:</span>
                                      <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">-{showValues ? formatCurrency(rowDetail.descontoAdiantamento) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Faltas / DSR:</span>
                                      <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">-{showValues ? formatCurrency(rowDetail.faltasDsr) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Consignados / Pensão:</span>
                                      <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">-{showValues ? formatCurrency(rowDetail.consignadoPensao) : '••••'}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Coluna 3: Extra-Folha & Benefícios Pagos */}
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-2xs">
                                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400">3. Extra-Folha & Benefícios</span>
                                    <span className="text-xs font-black text-blue-700 dark:text-blue-400 tabular-nums">
                                      +{showValues ? formatCurrency(rowDetail.extraFolhaTotal) : '••••'}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Adiantamento Salarial:</span>
                                      <span className="font-semibold text-amber-700 dark:text-amber-400 tabular-nums">+{showValues ? formatCurrency(rowDetail.adiantamento) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Vale Transporte (VT):</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">+{showValues ? formatCurrency(rowDetail.vt) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>VR / Cesta Básica:</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">+{showValues ? formatCurrency(rowDetail.vrCesta) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Bônus:</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">+{showValues ? formatCurrency(rowDetail.bonus) : '••••'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Premiação:</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">+{showValues ? formatCurrency(rowDetail.premiacao) : '••••'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : rowDetail.regime === 'ESTAGIO' ? (
                              /* Visão Estágio (Lei nº 11.788/2008) */
                              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/50 space-y-2">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs tabular-nums">
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Bolsa-Auxílio:</span>
                                    <span className="font-black text-slate-800 dark:text-slate-200">{showValues ? formatCurrency(rowDetail.bolsaAuxilio) : '••••'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase block">+ Aux. Transporte:</span>
                                    <span className="font-black text-emerald-700 dark:text-emerald-300">+{showValues ? formatCurrency(rowDetail.auxilioTransporte) : '••••'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-blue-600 uppercase block">+ Outros Auxílios:</span>
                                    <span className="font-black text-blue-700 dark:text-blue-300">+{showValues ? formatCurrency(rowDetail.outrosAuxilios) : '••••'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-blue-800 uppercase block">= Subtotal:</span>
                                    <span className="font-black text-blue-900 dark:text-blue-200">{showValues ? formatCurrency(rowDetail.subtotal) : '••••'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-rose-600 uppercase block">(-) Deduções:</span>
                                    <span className="font-black text-rose-600">-{showValues ? formatCurrency(rowDetail.deducoes) : '••••'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">= Valor Líquido:</span>
                                    <span className="font-black text-emerald-700 dark:text-emerald-300">{showValues ? formatCurrency(rowDetail.valorLiquido) : '••••'}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Visão Contratual PJ / MEI (100% B2B) */
                              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-teal-200/80 dark:border-teal-900/50 space-y-2">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">
                                  <span>Contratante: <strong className="text-slate-700 dark:text-slate-300">{rowDetail.company}</strong></span>
                                  {rowDetail.cnpj && <span>CNPJ: <strong className="font-mono text-slate-700 dark:text-slate-300">{rowDetail.cnpj}</strong></span>}
                                  <span>Escopo: <strong className="text-slate-700 dark:text-slate-300">{rowDetail.escopo}</strong></span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs tabular-nums">
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Honorários / NF Base:</span>
                                    <span className="font-black text-slate-800 dark:text-slate-200">{showValues ? formatCurrency(rowDetail.honorariosBase) : '••••'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-sky-600 uppercase block">+ Variável / Comissões:</span>
                                    <span className="font-black text-sky-700 dark:text-sky-300">+{showValues ? formatCurrency(rowDetail.variavelTotal) : '••••'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-teal-600 uppercase block">+ Conectividade / Reemb.:</span>
                                    <span className="font-black text-teal-700 dark:text-teal-300">+{showValues ? formatCurrency(rowDetail.conectividadeReembolso) : '••••'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-blue-800 uppercase block">= Valor Bruto NF:</span>
                                    <span className="font-black text-blue-900 dark:text-blue-200">{showValues ? formatCurrency(rowDetail.valorBrutoNf) : '••••'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-rose-600 uppercase block">(-) Glosas / Deduções:</span>
                                    <span className="font-black text-rose-600">-{showValues ? formatCurrency(rowDetail.glosasTotal) : '••••'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">= Valor Líquido NF:</span>
                                    <span className="font-black text-emerald-700 dark:text-emerald-300">{showValues ? formatCurrency(rowDetail.valorLiquidoNf) : '••••'}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Rubricas / Detalhamentos Adicionais */}
                            {rowDetail.regime === 'CLT' && cost.verbas_adicionais && Object.keys(cost.verbas_adicionais).length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                  Rubricas Personalizadas Registradas na Folha de Pagamento:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(cost.verbas_adicionais).map(([rubricaKey, rubricaVal]: [string, any]) => {
                                    const valNum = typeof rubricaVal === 'number' ? rubricaVal : (rubricaVal?.valor || 0);
                                    const isProv = rubricaVal?.tipo === 'provento' || (!rubricaVal?.tipo && valNum >= 0);
                                    return (
                                      <span 
                                        key={rubricaKey}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                          isProv 
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' 
                                            : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                                        }`}
                                      >
                                        {rubricaKey}: {formatCurrency(Math.abs(valNum))}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })()}
                    </React.Fragment>
                  );
                })}
                      {paddingBottom > 0 && (
                        <tr aria-hidden="true">
                          <td colSpan={tableColCount} style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} />
                        </tr>
                      )}
                    </>
                  );
                })()}
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

        {/* MODAL DE ESCOLHA DO RELATÓRIO PDF (ANALÍTICO 10 COLUNAS OU SINTÉTICO) */}
        {isPdfModalOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                    <Printer size={20} />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white">Emitir Relatório PDF</h4>
                    <p className="text-xs text-slate-500">{filteredRows.length} lançamentos filtrados para impressão</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  aria-label="Fechar modal de emissão de relatório PDF"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                {/* Banner de Conformidade Jurídica (CLT vs Estágio vs PJ/MEI) */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isMixedRegimeView ? (
                    <>
                      <span className="font-black text-emerald-700 dark:text-emerald-400 uppercase block mb-0.5">
                        Segregação Jurídica Automática Ativa
                      </span>
                      Este recorte contém múltiplos regimes. O PDF exibirá um <strong>Resumo Consolidado</strong> neutro no topo e segregará <strong>Folha CLT</strong>, <strong>Estágio</strong> e <strong>Prestação de Serviços (PJ/MEI)</strong> em seções independentes, iniciando o <strong>Caderno B2B (PJ/MEI)</strong> em nova página destacável sem terminologia trabalhista.
                    </>
                  ) : isPjOnlyView ? (
                    <>
                      <span className="font-black text-teal-700 dark:text-teal-400 uppercase block mb-0.5">
                        Modo Contratual B2B (PJ / MEI)
                      </span>
                      Relatório emitido exclusivamente com nomenclatura empresarial (<strong>Razão Social, CNPJ, Honorários/NF Base, Variável/Comissões, Conectividade, Glosas e Valor Líquido NF</strong>) e assinatura de <strong>Gestão de Contratos</strong>.
                    </>
                  ) : isEstagioOnlyView ? (
                    <>
                      <span className="font-black text-amber-700 dark:text-amber-400 uppercase block mb-0.5">
                        Modo Estágio (Lei nº 11.788/2008)
                      </span>
                      Relatório emitido com nomenclatura própria de estágio (<strong>Bolsa-Auxílio, Auxílio-Transporte, Outros Auxílios, Deduções e Valor Líquido</strong>), sem vínculo empregatício CLT.
                    </>
                  ) : (
                    <>
                      <span className="font-black text-blue-700 dark:text-blue-400 uppercase block mb-0.5">
                        Modo Folha de Pagamento (Regime CLT)
                      </span>
                      Relatório emitido com a quebra executiva completa das <strong>10 colunas da folha CLT</strong> e assinatura de Departamento Pessoal.
                    </>
                  )}
                </div>

                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Selecione o Modelo de Relatório:
                </span>

                {/* OPÇÃO 1: ANALÍTICO (RECOMENDADO) */}
                <button
                  type="button"
                  onClick={() => setPdfReportType('analitico')}
                  aria-pressed={pdfReportType === 'analitico'}
                  className={`w-full text-left p-3.5 min-h-[44px] rounded-2xl border-2 cursor-pointer transition-all ${
                    pdfReportType === 'analitico'
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {isPjOnlyView ? '1. Relatório Analítico Contratual (PJ)' : isEstagioOnlyView ? '1. Relatório Analítico de Estágio' : '1. Relatório Analítico (10 Colunas)'}
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 uppercase">
                      Espelho da Tela • Paisagem
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {isPjOnlyView
                      ? 'Quebra completa em A4 Paisagem com Razão Social, CNPJ, Honorários/NF Base, + Variável/Comissões, + Conectividade/Reembolso, = Valor Bruto NF, (-) Glosas/Deduções e = Valor Líquido NF.'
                      : isEstagioOnlyView
                        ? 'Quebra completa em A4 Paisagem com Bolsa-Auxílio, + Auxílio-Transporte, + Outros Auxílios, = Subtotal, (-) Deduções e = Valor Líquido.'
                        : 'Mesma quebra analítica da tela em A4 Paisagem com todas as colunas por natureza jurídica (10 colunas para CLT, seções próprias para Estágio e Caderno B2B destacável para PJ/MEI).'}
                  </p>
                </button>

                {/* OPÇÃO 2: SINTÉTICO */}
                <button
                  type="button"
                  onClick={() => setPdfReportType('sintetico')}
                  aria-pressed={pdfReportType === 'sintetico'}
                  className={`w-full text-left p-3.5 min-h-[44px] rounded-2xl border-2 cursor-pointer transition-all ${
                    pdfReportType === 'sintetico'
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                      2. Relatório Sintético (Resumido)
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 uppercase">
                      Diretoria • Retrato
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Visão executiva consolidada em A4 Retrato mantendo a mesma equação contábil e segregação jurídica entre CLT, Estágio e PJ/MEI.
                  </p>
                </button>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGeneratePdf(pdfReportType)}
                  className="flex-1 min-h-[44px] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <Printer size={15} />
                  <span>Gerar e Imprimir PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="min-h-[44px] px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

      
        {/* MODAL EXECUTIVO: COMPOSIÇÃO CONSOLIDADA DOS TOTALIZADORES (SEGREGADA POR NATUREZA JURÍDICA) */}
        {isSummaryVerbasModalOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 max-w-5xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-5 animate-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                    isPjOnlyView
                      ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                      : isEstagioOnlyView
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    <Layers size={22} />
                  </div>
                  <div>
                    <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {isPjOnlyView
                        ? 'Composição Contratual dos Totalizadores (PJ / MEI)'
                        : isEstagioOnlyView
                          ? 'Composição das Bolsas de Estágio (Lei nº 11.788/2008)'
                          : summaryComposition.isMixed
                            ? 'Composição Analítica Segregada por Natureza Jurídica'
                            : 'Composição Analítica dos Totalizadores (Folha CLT)'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isPjOnlyView
                        ? `Abertura empresarial dos faturamentos e honorários contratuais (${summaryComposition.pj.countRows} faturamentos • ${summaryComposition.pj.uniqueCount} contratadas)`
                        : isEstagioOnlyView
                          ? `Abertura das bolsas-auxílio e auxílios sem vínculo empregatício (${summaryComposition.estagio.countRows} lançamentos • ${summaryComposition.estagio.uniqueCount} estagiários)`
                          : `Abertura consolidada dos valores desembolsados (${summaryComposition.totalRows} registros • ${summaryComposition.totalUnique} únicos)`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSummaryVerbasModalOpen(false)}
                  aria-label="Fechar composição dos totalizadores"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* SEÇÃO 1: FOLHA DE PAGAMENTO CLT (Exibida apenas quando há CLT no recorte e NÃO é visão exclusiva PJ/Estágio) */}
              {!isPjOnlyView && !isEstagioOnlyView && summaryComposition.clt.countRows > 0 && (
                <div className="space-y-3">
                  {summaryComposition.isMixed && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60">
                      <span className="text-[11px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-200">
                        Folha de Pagamento • Regime CLT ({summaryComposition.clt.countRows} lançamentos • {summaryComposition.clt.uniqueCount} empregados)
                      </span>
                      <span className="text-xs font-black text-blue-900 dark:text-blue-200 tabular-nums">
                        Líquido CLT: {showValues ? formatCurrency(summaryComposition.clt.liquidoTotal) : '••••'}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Bloco 1: Proventos da Folha CLT */}
                    <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 dark:border-emerald-800/40">
                        <span className="text-[11px] font-black uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <Coins size={14} className="text-emerald-600" />
                          1. Proventos Folha
                        </span>
                        <span className="text-sm font-black text-emerald-800 dark:text-emerald-300 tabular-nums">
                          {showValues ? formatCurrency(summaryComposition.clt.proventosTotal) : '••••'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs tabular-nums">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Salário Fixo / Base:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{showValues ? formatCurrency(summaryComposition.clt.salarioBase) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Horas Extras (50%/100%):</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{showValues ? formatCurrency(summaryComposition.clt.horasExtras) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Adicional Noturno:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{showValues ? formatCurrency(summaryComposition.clt.adicionalNoturno) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>13º, Férias & Rescisão:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{showValues ? formatCurrency(summaryComposition.clt.decimoFeriasRescisao) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Outros Recebidos:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{showValues ? formatCurrency(summaryComposition.clt.outrosProventos) : '••••'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Descontos da Folha CLT */}
                    <div className="bg-rose-50/40 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-200/80 dark:border-rose-800/60 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-rose-200/60 dark:border-rose-800/40">
                        <span className="text-[11px] font-black uppercase text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                          <Receipt size={14} className="text-rose-600" />
                          2. Descontos Folha
                        </span>
                        <span className="text-sm font-black text-rose-700 dark:text-rose-400 tabular-nums">
                          -{showValues ? formatCurrency(summaryComposition.clt.descontosTotal) : '••••'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs tabular-nums">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>INSS Empregado:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">-{showValues ? formatCurrency(summaryComposition.clt.inss) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>IRRF Empregado:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">-{showValues ? formatCurrency(summaryComposition.clt.irrf) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Desconto VT (6%):</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">-{showValues ? formatCurrency(summaryComposition.clt.descontoVt6) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Desc. Adiantamento Folha:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">-{showValues ? formatCurrency(summaryComposition.clt.descontoAdiantamento) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Faltas e DSR:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">-{showValues ? formatCurrency(summaryComposition.clt.faltasDsr) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Consignados & Outros:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">-{showValues ? formatCurrency(summaryComposition.clt.consignadoPensaoOutros) : '••••'}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-rose-200/60 dark:border-rose-800/40 flex justify-between font-black text-xs text-slate-800 dark:text-slate-200 tabular-nums">
                        <span>= Líquido Folha CLT:</span>
                        <span className="text-emerald-700 dark:text-emerald-400">{showValues ? formatCurrency(summaryComposition.clt.liquidoFolha) : '••••'}</span>
                      </div>
                    </div>

                    {/* Bloco 3: Extra-Folha & Benefícios Pagos CLT */}
                    <div className="bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-200/80 dark:border-blue-800/60 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-800/40">
                        <span className="text-[11px] font-black uppercase text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                          <DollarSign size={14} className="text-blue-600" />
                          3. Extra-Folha & Benefícios
                        </span>
                        <span className="text-sm font-black text-blue-800 dark:text-blue-300 tabular-nums">
                          +{showValues ? formatCurrency(summaryComposition.clt.extraFolhaTotal) : '••••'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs tabular-nums">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Adiantamento Salarial:</span>
                          <span className="font-bold text-amber-700 dark:text-amber-400">+{showValues ? formatCurrency(summaryComposition.clt.adiantamento) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Vale Transporte (VT):</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">+{showValues ? formatCurrency(summaryComposition.clt.vt) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>VR / Cesta Básica:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">+{showValues ? formatCurrency(summaryComposition.clt.vrCesta) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Bônus CLT:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">+{showValues ? formatCurrency(summaryComposition.clt.bonus) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Premiação:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">+{showValues ? formatCurrency(summaryComposition.clt.premiacao) : '••••'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SEÇÃO 2: BOLSAS DE ESTÁGIO — LEI Nº 11.788/2008 */}
              {!isPjOnlyView && summaryComposition.estagio.countRows > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      Bolsas de Estágio • Lei nº 11.788/2008 ({summaryComposition.estagio.countRows} lançamentos • {summaryComposition.estagio.uniqueCount} estagiários)
                    </span>
                    <span className="text-xs font-black text-amber-900 dark:text-amber-200 tabular-nums">
                      Líquido Estágio: {showValues ? formatCurrency(summaryComposition.estagio.liquidoTotal) : '••••'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-amber-50/40 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-amber-800/40">
                        <span className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-300">1. Bolsa-Auxílio & Auxílios</span>
                        <span className="text-sm font-black text-amber-900 dark:text-amber-200 tabular-nums">{showValues ? formatCurrency(summaryComposition.estagio.subtotal) : '••••'}</span>
                      </div>
                      <div className="space-y-1.5 text-xs tabular-nums">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Bolsa-Auxílio:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{showValues ? formatCurrency(summaryComposition.estagio.bolsaAuxilio) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Auxílio-Transporte:</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-300">+{showValues ? formatCurrency(summaryComposition.estagio.auxilioTransporte) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Outros Auxílios:</span>
                          <span className="font-bold text-blue-700 dark:text-blue-300">+{showValues ? formatCurrency(summaryComposition.estagio.outrosAuxilios) : '••••'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">2. Deduções & Fechamento</span>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{showValues ? formatCurrency(summaryComposition.estagio.liquidoTotal) : '••••'}</span>
                      </div>
                      <div className="space-y-1.5 text-xs tabular-nums">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Deduções:</span>
                          <span className="font-bold text-rose-600">-{showValues ? formatCurrency(summaryComposition.estagio.deducoes) : '••••'}</span>
                        </div>
                        {summaryComposition.estagio.antecipacao > 0 && (
                          <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>Antecipação:</span>
                            <span className="font-bold text-amber-700">+{showValues ? formatCurrency(summaryComposition.estagio.antecipacao) : '••••'}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-800 dark:text-slate-200 font-black pt-1 border-t border-slate-200 dark:border-slate-800">
                          <span>= Valor Líquido Estágio:</span>
                          <span className="text-emerald-700 dark:text-emerald-300">{showValues ? formatCurrency(summaryComposition.estagio.liquidoTotal) : '••••'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SEÇÃO 3: PRESTAÇÃO DE SERVIÇOS — EMPRESAS CONTRATADAS PJ / MEI (100% B2B) */}
              {!isEstagioOnlyView && (isPjOnlyView || summaryComposition.pj.countRows > 0) && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60">
                    <span className="text-[11px] font-black uppercase tracking-wider text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                      <Building2 size={14} className="text-teal-600" />
                      Prestação de Serviços • Empresas Contratadas PJ / MEI ({summaryComposition.pj.countRows} faturamentos • {summaryComposition.pj.uniqueCount} contratadas)
                    </span>
                    <span className="text-xs font-black text-teal-900 dark:text-teal-200 tabular-nums">
                      Valor Líquido NF: {showValues ? formatCurrency(summaryComposition.pj.valorLiquidoNf) : '••••'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Bloco B2B 1: Honorários & Variável */}
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">1. Honorários & Variável</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                          {showValues ? formatCurrency(summaryComposition.pj.honorariosBase + summaryComposition.pj.variavelTotal) : '••••'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs tabular-nums">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Honorários / NF Base:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{showValues ? formatCurrency(summaryComposition.pj.honorariosBase) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Bônus Contratual:</span>
                          <span className="font-bold text-sky-700 dark:text-sky-300">+{showValues ? formatCurrency(summaryComposition.pj.bonusContratual) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Comissões:</span>
                          <span className="font-bold text-sky-700 dark:text-sky-300">+{showValues ? formatCurrency(summaryComposition.pj.comissoes) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Incentivos Comerciais:</span>
                          <span className="font-bold text-sky-700 dark:text-sky-300">+{showValues ? formatCurrency(summaryComposition.pj.incentivosComerciais) : '••••'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bloco B2B 2: Conectividade & Valor Bruto NF */}
                    <div className="bg-teal-50/40 dark:bg-teal-950/20 p-4 rounded-2xl border border-teal-200/80 dark:border-teal-800/60 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-teal-200/60 dark:border-teal-800/40">
                        <span className="text-[11px] font-black uppercase text-teal-800 dark:text-teal-300">2. Conectividade & Bruto NF</span>
                        <span className="text-sm font-black text-blue-900 dark:text-blue-200 tabular-nums">
                          {showValues ? formatCurrency(summaryComposition.pj.valorBrutoNf) : '••••'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs tabular-nums">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Conectividade / Reembolso:</span>
                          <span className="font-bold text-teal-700 dark:text-teal-300">+{showValues ? formatCurrency(summaryComposition.pj.conectividadeReembolso) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Total Variável / Comissões:</span>
                          <span className="font-bold text-sky-700 dark:text-sky-300">+{showValues ? formatCurrency(summaryComposition.pj.variavelTotal) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-blue-900 dark:text-blue-200 font-black pt-1 border-t border-teal-200/60 dark:border-teal-800/40">
                          <span>= Valor Bruto NF:</span>
                          <span>{showValues ? formatCurrency(summaryComposition.pj.valorBrutoNf) : '••••'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bloco B2B 3: Glosas & Deduções Contratuais */}
                    <div className="bg-rose-50/40 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-200/80 dark:border-rose-800/60 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-rose-200/60 dark:border-rose-800/40">
                        <span className="text-[11px] font-black uppercase text-rose-800 dark:text-rose-300">3. Glosas & Deduções PJ</span>
                        <span className="text-sm font-black text-rose-700 dark:text-rose-400 tabular-nums">
                          -{showValues ? formatCurrency(summaryComposition.pj.glosasTotal) : '••••'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs tabular-nums">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Glosa sobre Base:</span>
                          <span className="font-bold text-rose-600">-{showValues ? formatCurrency(summaryComposition.pj.glosaBase) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Glosa sobre Variável:</span>
                          <span className="font-bold text-rose-600">-{showValues ? formatCurrency(summaryComposition.pj.glosaBonus) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Outras Deduções / Retenções:</span>
                          <span className="font-bold text-rose-600">-{showValues ? formatCurrency(summaryComposition.pj.outrasDeducoes) : '••••'}</span>
                        </div>
                        <div className="flex justify-between text-emerald-800 dark:text-emerald-300 font-black pt-1 border-t border-rose-200/60 dark:border-rose-800/40">
                          <span>= Valor Líquido NF:</span>
                          <span>{showValues ? formatCurrency(summaryComposition.pj.valorLiquidoNf) : '••••'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Caixa de Fechamento Contábil Executivo */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-slate-100 dark:to-slate-800 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider block">
                    {isPjOnlyView
                      ? 'Equação Contratual de Faturamento (PJ / MEI)'
                      : isEstagioOnlyView
                        ? 'Equação Financeira de Estágios (Lei nº 11.788/2008)'
                        : 'Fechamento Consolidado por Natureza Jurídica'}
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    {isPjOnlyView
                      ? `Valor Bruto NF (${showValues ? formatCurrency(summaryComposition.pj.valorBrutoNf) : '••••'}) (-) Glosas / Deduções (${showValues ? formatCurrency(summaryComposition.pj.glosasTotal) : '••••'})`
                      : isEstagioOnlyView
                        ? `Subtotal Bolsas & Auxílios (${showValues ? formatCurrency(summaryComposition.estagio.subtotal) : '••••'}) (-) Deduções (${showValues ? formatCurrency(summaryComposition.estagio.deducoes) : '••••'})${summaryComposition.estagio.antecipacao > 0 ? ` (+) Antecipação (${showValues ? formatCurrency(summaryComposition.estagio.antecipacao) : '••••'})` : ''}`
                        : [
                            summaryComposition.clt.countRows > 0 ? `Folha CLT (${showValues ? formatCurrency(summaryComposition.clt.liquidoTotal) : '••••'})` : null,
                            summaryComposition.estagio.countRows > 0 ? `Estágio (${showValues ? formatCurrency(summaryComposition.estagio.liquidoTotal) : '••••'})` : null,
                            summaryComposition.pj.countRows > 0 ? `Contratos PJ/MEI (${showValues ? formatCurrency(summaryComposition.pj.valorLiquidoNf) : '••••'})` : null,
                          ].filter(Boolean).join(' + ')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {isPjOnlyView ? 'Total Líquido NF (PJ / MEI)' : isEstagioOnlyView ? 'Total Líquido Estágio' : 'Total Geral Desembolsado'}
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {showValues ? formatCurrency(summaryComposition.grandTotalLiquido) : '••••••'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsSummaryVerbasModalOpen(false)}
                  className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  Fechar Detalhamento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL ESPELHO DA COMPETÊNCIA (SEGREGADO POR NATUREZA JURÍDICA: CLT, ESTÁGIO OU PJ/MEI) */}
        {verbasDetailRow && (() => {
          const dCost = verbasDetailRow.cost;
          const dEmp = verbasDetailRow.emp;
          const dIsCLT = dCost.vinculo_tipo === 'CLT' || dEmp?.linkType === 'CLT';
          const dIsEstagio = dEmp?.linkType === 'Estagiário' || (dEmp?.linkType || '').toLowerCase().includes('estag');
          const dIsPJ = !dIsCLT && !dIsEstagio;
          const dFin = calculateRowFinancials(dCost, dIsCLT);
          const mirror = buildMirrorRowDetail({
            cost: dCost,
            emp: dEmp,
            name: verbasDetailRow.name,
            financials: dFin,
            realTotal: dFin.realTotal,
            isCLT: dIsCLT,
            isPJ: dIsPJ,
            isEstagio: dIsEstagio,
          });

          return (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                    mirror.regime === 'PJ'
                      ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                      : mirror.regime === 'ESTAGIO'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  }`}>
                    {mirror.regime === 'PJ' ? <Building2 size={20} /> : <Receipt size={20} />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                      {mirror.regime === 'PJ'
                        ? `Espelho de Faturamento (${mirror.modalidade}) • ${mirror.entityName}`
                        : mirror.regime === 'ESTAGIO'
                          ? `Espelho da Bolsa de Estágio • ${mirror.entityName}`
                          : `Espelho da Folha CLT • ${mirror.entityName}`}
                    </h4>
                    <p className="text-xs text-slate-500 truncate">
                      {mirror.regime === 'PJ'
                        ? `${mirror.competenciaFull} • ${mirror.modalidade} • Contratante: ${mirror.company}${mirror.cnpj ? ` • CNPJ: ${mirror.cnpj}` : ''}`
                        : mirror.regime === 'ESTAGIO'
                          ? `${mirror.competenciaFull} • Estágio (Lei nº 11.788/2008) • ${mirror.company}${mirror.cpf ? ` • CPF: ${mirror.cpf}` : ''}`
                          : `${mirror.competenciaFull} • CLT • ${mirror.company}${mirror.cpf ? ` • CPF: ${mirror.cpf}` : ''}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVerbasDetailRow(null)}
                  aria-label="Fechar espelho da competência"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Conteúdo do Espelho — Estritamente aderente à Natureza Jurídica */}
              {mirror.regime === 'PJ' ? (
                <div className="space-y-3">
                  {/* Identificação Contratual B2B */}
                  <div className="bg-teal-50/40 dark:bg-teal-950/20 p-3 rounded-2xl border border-teal-200/70 dark:border-teal-900/50 text-xs space-y-1">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300">
                      <span><strong>Contratada:</strong> {mirror.entityName}</span>
                      {mirror.cnpj && <span><strong>CNPJ:</strong> <span className="font-mono">{mirror.cnpj}</span></span>}
                      <span><strong>Escopo:</strong> {mirror.escopo}</span>
                      {mirror.responsibleName && <span><strong>Resp. Legal:</strong> {mirror.responsibleName}</span>}
                    </div>
                  </div>

                  {/* Honorários & Variável Contratual */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs font-black text-teal-800 dark:text-teal-300 border-b pb-1.5 border-slate-200 dark:border-slate-800">
                      <span>HONORÁRIOS, VARIÁVEL & CONECTIVIDADE (BRUTO NF)</span>
                      <span className="tabular-nums">{showValues ? formatCurrency(mirror.valorBrutoNf) : '••••'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs tabular-nums">
                      <div className="flex justify-between"><span className="text-slate-500">Honorários / NF Base:</span><span className="font-semibold">{showValues ? formatCurrency(mirror.honorariosBase) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Bônus Contratual:</span><span className="font-semibold text-sky-700 dark:text-sky-300">+{showValues ? formatCurrency(mirror.bonusContratual) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Comissões:</span><span className="font-semibold text-sky-700 dark:text-sky-300">+{showValues ? formatCurrency(mirror.comissoes) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Incentivos Comerciais:</span><span className="font-semibold text-sky-700 dark:text-sky-300">+{showValues ? formatCurrency(mirror.incentivosComerciais) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Conectividade / Reembolso:</span><span className="font-semibold text-teal-700 dark:text-teal-300">+{showValues ? formatCurrency(mirror.conectividadeReembolso) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-700 dark:text-slate-300 font-bold">= Valor Bruto NF:</span><span className="font-black text-blue-900 dark:text-blue-200">{showValues ? formatCurrency(mirror.valorBrutoNf) : '••••'}</span></div>
                    </div>
                  </div>

                  {/* Glosas & Deduções Contratuais */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs font-black text-rose-700 dark:text-rose-400 border-b pb-1.5 border-slate-200 dark:border-slate-800">
                      <span>GLOSAS & DEDUÇÕES CONTRATUAIS</span>
                      <span className="tabular-nums">-{showValues ? formatCurrency(mirror.glosasTotal) : '••••'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs tabular-nums">
                      <div className="flex justify-between"><span className="text-slate-500">Glosa sobre Base:</span><span className="font-semibold text-rose-600">-{showValues ? formatCurrency(mirror.glosaBase) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Glosa sobre Variável:</span><span className="font-semibold text-rose-600">-{showValues ? formatCurrency(mirror.glosaBonus) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Outras Deduções / Retenções:</span><span className="font-semibold text-rose-600">-{showValues ? formatCurrency(mirror.outrasDeducoes) : '••••'}</span></div>
                    </div>
                  </div>

                  {/* Valor Líquido NF */}
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex justify-between items-center">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase">Valor Líquido NF (Faturado):</span>
                    <span className="text-base font-black text-emerald-800 dark:text-emerald-300 tabular-nums">
                      {showValues ? formatCurrency(mirror.valorLiquidoNf) : '••••••'}
                    </span>
                  </div>
                </div>
              ) : mirror.regime === 'ESTAGIO' ? (
                <div className="space-y-3">
                  {/* Bolsa-Auxílio & Auxílios (Lei nº 11.788/2008) */}
                  <div className="bg-amber-50/40 dark:bg-amber-950/20 p-3.5 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 space-y-2">
                    <div className="flex justify-between items-center text-xs font-black text-amber-800 dark:text-amber-300 border-b pb-1.5 border-amber-200/60 dark:border-amber-900/50">
                      <span>BOLSA-AUXÍLIO & AUXÍLIOS (LEI Nº 11.788/2008)</span>
                      <span className="tabular-nums">{showValues ? formatCurrency(mirror.subtotal) : '••••'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs tabular-nums">
                      <div className="flex justify-between"><span className="text-slate-500">Bolsa-Auxílio:</span><span className="font-semibold">{showValues ? formatCurrency(mirror.bolsaAuxilio) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Auxílio-Transporte:</span><span className="font-semibold text-emerald-700">+{showValues ? formatCurrency(mirror.auxilioTransporte) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Outros Auxílios:</span><span className="font-semibold text-blue-700">+{showValues ? formatCurrency(mirror.outrosAuxilios) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-700 dark:text-slate-300 font-bold">= Subtotal:</span><span className="font-black text-blue-900 dark:text-blue-200">{showValues ? formatCurrency(mirror.subtotal) : '••••'}</span></div>
                    </div>
                  </div>

                  {/* Deduções Estágio */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs font-black text-rose-700 dark:text-rose-400 border-b pb-1.5 border-slate-200 dark:border-slate-800">
                      <span>DEDUÇÕES{mirror.antecipacao > 0 ? ' & ANTECIPAÇÃO' : ''}</span>
                      <span className="tabular-nums">-{showValues ? formatCurrency(mirror.deducoes) : '••••'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs tabular-nums">
                      <div className="flex justify-between"><span className="text-slate-500">Deduções:</span><span className="font-semibold text-rose-600">-{showValues ? formatCurrency(mirror.deducoes) : '••••'}</span></div>
                      {mirror.antecipacao > 0 && (
                        <div className="flex justify-between"><span className="text-slate-500">Antecipação:</span><span className="font-semibold text-amber-700">+{showValues ? formatCurrency(mirror.antecipacao) : '••••'}</span></div>
                      )}
                    </div>
                  </div>

                  {/* Valor Líquido Estágio */}
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex justify-between items-center">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase">Valor Líquido da Bolsa de Estágio:</span>
                    <span className="text-base font-black text-emerald-800 dark:text-emerald-300 tabular-nums">
                      {showValues ? formatCurrency(mirror.valorLiquido) : '••••••'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Proventos CLT */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs font-black text-emerald-700 dark:text-emerald-400 border-b pb-1.5 border-slate-200 dark:border-slate-800">
                      <span>PROVENTOS DA FOLHA (CLT)</span>
                      <span className="tabular-nums">{showValues ? formatCurrency(mirror.proventosTotal) : '••••'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs tabular-nums">
                      <div className="flex justify-between"><span className="text-slate-500">Salário Base:</span><span className="font-semibold">{showValues ? formatCurrency(mirror.salarioBase) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Horas Extras:</span><span className="font-semibold">{showValues ? formatCurrency(mirror.horasExtras) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Adicional Noturno:</span><span className="font-semibold">{showValues ? formatCurrency(mirror.adicionalNoturno) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">13º Salário:</span><span className="font-semibold">{showValues ? formatCurrency(mirror.decimoTerceiro) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Férias / Rescisão:</span><span className="font-semibold">{showValues ? formatCurrency(mirror.feriasRescisao) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Outros Recebidos:</span><span className="font-semibold">{showValues ? formatCurrency(mirror.outrosProventos) : '••••'}</span></div>
                    </div>
                  </div>

                  {/* Descontos CLT */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs font-black text-rose-700 dark:text-rose-400 border-b pb-1.5 border-slate-200 dark:border-slate-800">
                      <span>DESCONTOS DA FOLHA</span>
                      <span className="tabular-nums">-{showValues ? formatCurrency(mirror.descontosTotal) : '••••'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs tabular-nums">
                      <div className="flex justify-between"><span className="text-slate-500">INSS:</span><span className="font-semibold text-rose-600">-{showValues ? formatCurrency(mirror.inss) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">IRRF:</span><span className="font-semibold text-rose-600">-{showValues ? formatCurrency(mirror.irrf) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Desc. VT (6%):</span><span className="font-semibold text-rose-600">-{showValues ? formatCurrency(mirror.descontoVt6) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Desc. Adiantamento:</span><span className="font-semibold text-rose-600">-{showValues ? formatCurrency(mirror.descontoAdiantamento) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Faltas / DSR:</span><span className="font-semibold text-rose-600">-{showValues ? formatCurrency(mirror.faltasDsr) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Consignados / Pensão:</span><span className="font-semibold text-rose-600">-{showValues ? formatCurrency(mirror.consignadoPensao) : '••••'}</span></div>
                    </div>
                  </div>

                  {/* Extra-Folha & Benefícios CLT */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs font-black text-blue-700 dark:text-blue-400 border-b pb-1.5 border-slate-200 dark:border-slate-800">
                      <span>EXTRA-FOLHA & BENEFÍCIOS PAGOS</span>
                      <span className="tabular-nums">+{showValues ? formatCurrency(mirror.extraFolhaTotal) : '••••'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs tabular-nums">
                      <div className="flex justify-between"><span className="text-slate-500">Adiantamento Salarial:</span><span className="font-semibold text-amber-700">+{showValues ? formatCurrency(mirror.adiantamento) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Vale Transporte (VT):</span><span className="font-semibold">+{showValues ? formatCurrency(mirror.vt) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">VR / Cesta Básica:</span><span className="font-semibold">+{showValues ? formatCurrency(mirror.vrCesta) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Bônus:</span><span className="font-semibold">+{showValues ? formatCurrency(mirror.bonus) : '••••'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Premiação:</span><span className="font-semibold">+{showValues ? formatCurrency(mirror.premiacao) : '••••'}</span></div>
                    </div>
                  </div>

                  {/* Total da Competência CLT */}
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex justify-between items-center">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase">Total Líquido Desembolsado (CLT):</span>
                    <span className="text-base font-black text-emerald-800 dark:text-emerald-300 tabular-nums">
                      {showValues ? formatCurrency(mirror.valorLiquido) : '••••••'}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const row = verbasDetailRow;
                    setVerbasDetailRow(null);
                    handleOpenEditModal(row.cost, row.emp);
                  }}
                  className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Edit3 size={14} />
                  {mirror.regime === 'PJ'
                    ? 'Editar Faturamento PJ'
                    : mirror.regime === 'ESTAGIO'
                      ? 'Editar Bolsa de Estágio'
                      : 'Editar Esta Competência'}
                </button>
                <button
                  type="button"
                  onClick={() => setVerbasDetailRow(null)}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
          );
        })()}

        {/* MODAL DE EDIÇÃO DIRETA NO PAINEL (ELIMINA O LOOPING COM A FICHA) */}
        {editingRowCost && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 animate-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                    <Edit3 size={20} />
                  </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900 dark:text-white">
                        {!(editingRowCost.cost.vinculo_tipo === 'CLT' || editingRowCost.emp?.linkType === 'CLT')
                          ? `Editar Faturamento PJ • ${editingRowCost.emp?.corporate_name || editingRowCost.emp?.name || 'Empresa Contratada'}`
                          : `Editar Valores • ${editingRowCost.emp?.name || (editingRowCost.cost as any).nome_colaborador || 'Colaborador'}`}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Competência: <strong>{formatCompetenciaLabel(editingRowCost.cost.competencia)}</strong> ({editingRowCost.cost.competencia}) &bull; Natureza: <strong>{editingRowCost.emp?.linkType || editingRowCost.cost.vinculo_tipo || 'CLT'}</strong>
                        {!(editingRowCost.cost.vinculo_tipo === 'CLT' || editingRowCost.emp?.linkType === 'CLT') && (editingRowCost.emp?.pj_type || editingRowCost.emp?.document_id)
                          ? ` • CNPJ: ${editingRowCost.emp?.pj_type || editingRowCost.emp?.document_id}`
                          : ''}
                      </p>
                    </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRowCost(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Formulário de Edição */}
              <div className="space-y-4">
                {(editingRowCost.cost.competencia < '2026-06-01') && (
                  <div className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 flex items-center gap-2 text-xs">
                    <Info size={14} className="text-blue-600 shrink-0" />
                    <span>Competência histórica consolidada (edição habilitada). As alterações serão salvas com segurança no banco de dados.</span>
                  </div>
                )}
                  {(editingRowCost.cost.vinculo_tipo === 'CLT' || editingRowCost.emp?.linkType === 'CLT') ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Card 1: Proventos de Folha */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block border-b pb-1 border-slate-200 dark:border-slate-800">
                          1. Proventos Folha
                        </span>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Salário Fixo / Base:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_fixo ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_fixo: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Horas Extras:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_hora_extra ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_hora_extra: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Adicional Noturno:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_adicional_not ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_adicional_not: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">13º Salário:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_decimo_terceiro ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_decimo_terceiro: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Férias:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_ferias ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_ferias: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Outros Proventos:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.outros_ajustes ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, outros_ajustes: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      {/* Card 2: Descontos de Folha */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 block border-b pb-1 border-slate-200 dark:border-slate-800">
                          2. Descontos Folha
                        </span>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">INSS Empregado:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.inss_empregado ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, inss_empregado: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">IRRF Empregado:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.irrf_empregado ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, irrf_empregado: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Faltas e DSR:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_faltas ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_faltas: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Consignados:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_consignado ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_consignado: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Pensão Alimentícia:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_pensao_alimenticia ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_pensao_alimenticia: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Desc. Adiantamento Folha:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={(editFormData as any).desconto_adiantamento ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, desconto_adiantamento: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Desc. Vale Transporte (6%):</label>
                          <input
                            type="number"
                            step="0.01"
                            value={(editFormData as any).desconto_vt ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, desconto_vt: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Total de Descontos:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_descontos ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_descontos: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400"
                          />
                        </div>
                      </div>

                      {/* Card 3: Extra-Folha & Benefícios Pagos */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block border-b pb-1 border-slate-200 dark:border-slate-800">
                          3. Extra-Folha & Benefícios
                        </span>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Adiantamento Salarial (dia 20):</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_adiantamento ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_adiantamento: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Recarga Vale Transporte (VT):</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_vt ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_vt: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Vale Refeição (VR):</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_vr ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_vr: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Cesta Básica / Alimentação:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_cesta ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_cesta: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Bônus / Premiação:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_bonus ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_bonus: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Ajuda de Custo / Complementos:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData.valor_ajuda_custo ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, valor_ajuda_custo: parseFloat(e.target.value) || 0 }))}
                            className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Edição PJ / MEI (B2B) */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block">Honorários / NF Base:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.valor_fixo ?? ''}
                          onChange={e => setEditFormData(p => ({ ...p, valor_fixo: parseFloat(e.target.value) || 0 }))}
                          className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block">Variável / Bônus Contratual:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.valor_bonus ?? ''}
                          onChange={e => setEditFormData(p => ({ ...p, valor_bonus: parseFloat(e.target.value) || 0 }))}
                          className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-sky-700 dark:text-sky-300"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block">Conectividade / Reembolso:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.valor_ajuda_custo ?? ''}
                          onChange={e => setEditFormData(p => ({ ...p, valor_ajuda_custo: parseFloat(e.target.value) || 0 }))}
                          className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block">Glosas / Deduções PJ:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.valor_glosa_base ?? ''}
                          onChange={e => setEditFormData(p => ({ ...p, valor_glosa_base: parseFloat(e.target.value) || 0 }))}
                          className="w-full mt-0.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-rose-600"
                        />
                      </div>
                    </div>
                  )}

                  {/* Banner de Conciliação Contábil em Tempo Real */}
                  {(() => {
                    const isCLT = editingRowCost.cost.vinculo_tipo === 'CLT' || editingRowCost.emp?.linkType === 'CLT';
                    const preview = calculateRowFinancials(editFormData as MonthlyCost, isCLT);
                    return (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-slate-100 dark:to-slate-800 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                            {isCLT ? 'Conciliação Contábil em Tempo Real Desta Competência' : 'Conciliação Contratual do Faturamento PJ'}
                          </span>
                          {isCLT ? (
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                              Proventos ({formatCurrency(preview.proventosFolha)}) - Descontos ({formatCurrency(preview.descontosFolha)}) = <strong className="text-emerald-700 dark:text-emerald-400">Líq. Folha ({formatCurrency(preview.liquidoFolha)})</strong> + Adiantamento ({formatCurrency(preview.adiantamento)}) + Benefícios ({formatCurrency(preview.beneficios)})
                            </p>
                          ) : (
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                              Honorários Base ({formatCurrency(preview.fixo)}) + Variável ({formatCurrency(preview.bonus)}) + Conectividade ({formatCurrency(preview.ajudaCusto)}) - Glosas/Deduções ({formatCurrency(preview.descontosFolha)})
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                            {isCLT ? 'Total Real Desembolsado' : 'Valor Líquido NF'}
                          </span>
                          <span className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                            {formatCurrency(preview.realTotal)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Observações */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block">Observações do Lançamento:</label>
                    <input
                      type="text"
                      placeholder="Ex: Folha ajustada, hora extra aprovada, etc."
                      value={editFormData.observacao ?? ''}
                      onChange={e => setEditFormData(p => ({ ...p, observacao: e.target.value }))}
                      className="w-full mt-0.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

              {/* Footer do Editor */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRowCost(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={handleSaveEditCost}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* COPILOTO EXECUTIVO DE CUSTOS (TOOL CALLING DETERMINÍSTICO SOBRE 100% DO HISTÓRICO) */}
        <PeopleCostsCopilotModal
          isOpen={isCopilotModalOpen}
          onClose={() => setIsCopilotModalOpen(false)}
        />

      </div>
    </div>
  );
}
