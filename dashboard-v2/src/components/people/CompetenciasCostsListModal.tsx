import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Calendar, Filter, Search, Trash2, Edit3, Loader2, 
  CheckCircle2, AlertTriangle, ArrowUpDown, DollarSign, Wallet, 
  Users, ChevronRight, FileSpreadsheet, RotateCcw, Building2, Briefcase, Download, Upload,
  Printer, FileText, CheckSquare, Square, Check, SlidersHorizontal
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

  // Estados de Seleção em Lote (Checkboxes para Extra-Folha)
  const [selectedCostIds, setSelectedCostIds] = useState<Set<string>>(new Set());
  const [batchVt, setBatchVt] = useState<string>('');
  const [batchCesta, setBatchCesta] = useState<string>('');
  const [batchBonus, setBatchBonus] = useState<string>('');
  const [batchComplementos, setBatchComplementos] = useState<string>('');
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // Estados do Modal de Relatório PDF (Analítico vs Sintético)
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfReportType, setPdfReportType] = useState<'sintetico' | 'analitico'>('sintetico');

  // Inicialização com valores passados por redirecionamento (da Ficha ou Cockpit)
  useEffect(() => {
    if (isOpen) {
      if (initialSearch !== undefined) {
        setSearchTerm(initialSearch);
      }
      if (initialCompetencia && initialCompetencia !== 'all') {
        setSelectedCompetencia(initialCompetencia);
        setCompFilterMode('single');
      }
    }
  }, [isOpen, initialSearch, initialCompetencia]);

  // Limpa seleção ao alterar filtros principais
  useEffect(() => {
    setSelectedCostIds(new Set());
  }, [selectedYears, compFilterMode, selectedCompetencia, selectedVinculo, selectedEmpresa, selectedSetor, searchTerm]);

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

  const handleDeleteCost = async (costId: string, empName: string, competencia: string) => {
    // REGRA DE SEGURANÇA ABSOLUTA (RISCO ZERO):
    const targetRow = filteredRows.find(r => r.cost.id === costId);
    if (targetRow && targetRow.isCLT && targetRow.cost.competencia < '2026-06-01') {
      alert("BLOQUEIO DE SEGURANÇA (Risco Zero Ativado):\nLançamentos CLT anteriores a Junho/2026 são históricos consolidados e não podem ser excluídos.");
      return;
    }

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
        
        // RISCO ZERO: Bloqueio estrito de CLT < 2026-06-01
        if (row.cost.competencia < '2026-06-01') {
          skippedProtectedCount++;
          continue;
        }

        const newVt = vtNum !== null ? vtNum : (row.cost.valor_vt || 0);
        const newCesta = cestaNum !== null ? cestaNum : (row.cost.valor_cesta || 0);
        const newBonus = bonusNum !== null ? bonusNum : (row.cost.valor_bonus || 0);
        const newAjuda = compNum !== null ? compNum : (row.cost.valor_ajuda_custo || 0);

        // Recalcular Total Real Desembolsado:
        const proventos = row.cost.valor_holerite || ((row.cost.valor_fixo || 0) + (row.cost.valor_hora_extra || 0) + (row.cost.valor_adicional_not || 0));
        const descontos = row.cost.valor_descontos || 0;
        const folhaLiq = Math.max(0, proventos - descontos);
        const extraFolha = (row.cost.valor_adiantamento || 0) + newVt + newCesta + (row.cost.valor_vr || 0) + newBonus + newAjuda;
        const newLiquidoReal = folhaLiq + extraFolha;

        toUpdate.push({
          id: row.cost.id,
          employee_id: row.cost.employee_id,
          competencia: row.cost.competencia,
          vinculo_tipo: 'CLT',
          valor_vt: newVt,
          valor_cesta: newCesta,
          valor_bonus: newBonus,
          valor_ajuda_custo: newAjuda,
          valor_liquido: newLiquidoReal,
        });
      }

      if (toUpdate.length === 0) {
        if (skippedProtectedCount > 0) {
          alert(`Operação cancelada: ${skippedProtectedCount} lançamento(s) selecionado(s) são anteriores a Junho/2026 e protegidos como histórico imutável.`);
        } else {
          alert("Nenhum lançamento elegível para atualização.");
        }
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

  // Geração e Emissão de Relatório PDF (Sintético e Analítico)
  const handleGeneratePdf = (type: 'sintetico' | 'analitico') => {
    if (filteredRows.length === 0) {
      alert("Nenhum lançamento filtrado para emitir relatório.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor, habilite popups no seu navegador para visualizar o relatório PDF.");
      return;
    }

    const todayStr = new Date().toLocaleDateString('pt-BR');
    const todayTimeStr = new Date().toLocaleTimeString('pt-BR');

    let totalSalarioFixo = 0;
    let totalAdiantamento = 0;
    let totalHorasExtras = 0;
    let totalBeneficios = 0;
    let totalDecimoFerias = 0;
    let totalDescontos = 0;
    let totalRealDesembolsado = 0;

    filteredRows.forEach(r => {
      const c = r.cost;
      const fixo = c.valor_fixo !== undefined && c.valor_fixo !== null ? c.valor_fixo : (c.valor_liquido || 0);
      const ben = (c.valor_vr || 0) + (c.valor_vt || 0) + (c.valor_cesta || 0) + (c.valor_ajuda_custo || 0) + (c.valor_bonus || 0);
      const he = (c.valor_hora_extra || 0) + (c.valor_adicional_not || 0);
      const df = (c.valor_decimo_terceiro || 0) + (c.valor_ferias || 0) + (c.valor_rescisao || 0);
      const desc = c.valor_descontos || 0;
      
      totalSalarioFixo += fixo;
      totalAdiantamento += c.valor_adiantamento || 0;
      totalHorasExtras += he;
      totalBeneficios += ben;
      totalDecimoFerias += df;
      totalDescontos += desc;
      totalRealDesembolsado += r.realTotal;
    });

    const isSintetico = type === 'sintetico';

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mar Brasil • Relatório ${isSintetico ? 'Sintético' : 'Analítico'} de Custos por Competência</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 ${isSintetico ? 'portrait' : 'landscape'};
            margin: 10mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 10px;
          }
          .header-box {
            border-bottom: 2px solid #059669;
            padding-bottom: 8px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .company-title {
            font-size: 16px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: -0.5px;
            text-transform: uppercase;
          }
          .report-subtitle {
            font-size: 11px;
            font-weight: 700;
            color: #059669;
            margin-top: 2px;
          }
          .meta-info {
            font-size: 9px;
            color: #64748b;
            text-align: right;
            line-height: 1.4;
          }
          .kpi-cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 14px;
          }
          .kpi-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 10px;
          }
          .kpi-label {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
          }
          .kpi-val {
            font-size: 13px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 2px;
            font-feature-settings: "tnum";
          }
          .kpi-val.highlight {
            color: #059669;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5px;
            margin-top: 6px;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 8px;
            padding: 5px 6px;
            border: 1px solid #cbd5e1;
            text-align: left;
          }
          th.num, td.num {
            text-align: right;
            font-feature-settings: "tnum";
          }
          td {
            padding: 4.5px 6px;
            border: 1px solid #e2e8f0;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .badge-clt {
            background: #dbeafe;
            color: #1e40af;
            font-weight: 800;
            font-size: 7.5px;
            padding: 1px 4px;
            border-radius: 4px;
            text-transform: uppercase;
          }
          .badge-pj {
            background: #d1fae5;
            color: #065f46;
            font-weight: 800;
            font-size: 7.5px;
            padding: 1px 4px;
            border-radius: 4px;
            text-transform: uppercase;
          }
          .total-row {
            background: #e2e8f0 !important;
            font-weight: 900;
            border-top: 2px solid #059669;
          }
          .signatures {
            margin-top: 30px;
            display: flex;
            justify-content: space-around;
            text-align: center;
            page-break-inside: avoid;
          }
          .sig-line {
            width: 180px;
            border-top: 1px solid #94a3b8;
            margin: 0 auto 4px auto;
          }
          .sig-label {
            font-size: 8.5px;
            color: #64748b;
            font-weight: 700;
            text-transform: uppercase;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <div class="company-title">Mar Brasil • Grupo Empresarial</div>
            <div class="report-subtitle">
              ${isSintetico ? 'Demonstrativo Sintético de Custos por Competência (Visão Executiva)' : 'Demonstrativo Analítico e Contábil de Folha & Custos (Auditoria Completa)'}
            </div>
            <div style="font-size: 9px; color: #475569; margin-top: 3px;">
              Escopo: ${selectedCompetencia !== 'all' ? formatCompetenciaLabel(selectedCompetencia) : 'Todas as Competências'} 
              ${selectedVinculo !== 'all' ? `• Regime: ${selectedVinculo}` : ''}
              ${selectedEmpresa !== 'all' ? `• Empresa: ${selectedEmpresa}` : ''}
              • Total de Lançamentos: <strong>${filteredRows.length}</strong>
            </div>
          </div>
          <div class="meta-info">
            Emissão: <strong>${todayStr} às ${todayTimeStr}</strong><br/>
            Responsável: Sistema Integrado People Cockpit<br/>
            Segurança: Auditoria Rastreada
          </div>
        </div>

        <div class="kpi-cards">
          <div class="kpi-card">
            <div class="kpi-label">Lançamentos / Contratados</div>
            <div class="kpi-val">${filteredRows.length} <span style="font-size: 9px; color: #64748b; font-weight: normal;">(${summaryTotals.uniqueEmployeesCount} únicos)</span></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Salários / Base</div>
            <div class="kpi-val">${formatCurrency(totalSalarioFixo)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Benefícios & Extras</div>
            <div class="kpi-val">${formatCurrency(totalBeneficios + totalAdiantamento)}</div>
          </div>
          <div class="kpi-card" style="border-color: #059669; background: #ecfdf5;">
            <div class="kpi-label" style="color: #059669;">Total Real Desembolsado</div>
            <div class="kpi-val highlight">${formatCurrency(totalRealDesembolsado)}</div>
          </div>
        </div>
    `;

    if (isSintetico) {
      html += `
        <table>
          <thead>
            <tr>
              <th style="width: 75px;">Competência</th>
              <th>Colaborador</th>
              <th>Empresa / Setor</th>
              <th style="width: 45px; text-align: center;">Vínculo</th>
              <th class="num">Salário / Base</th>
              <th class="num">Adiantamento</th>
              <th class="num">Benefícios</th>
              <th class="num">Descontos</th>
              <th class="num" style="color: #059669; font-weight: 900;">Total Real</th>
            </tr>
          </thead>
          <tbody>
      `;

      filteredRows.forEach(r => {
        const c = r.cost;
        const fixo = c.valor_fixo !== undefined && c.valor_fixo !== null ? c.valor_fixo : (c.valor_liquido || 0);
        const ben = (c.valor_vr || 0) + (c.valor_vt || 0) + (c.valor_cesta || 0) + (c.valor_ajuda_custo || 0) + (c.valor_bonus || 0);
        const desc = c.valor_descontos || 0;

        html += `
          <tr>
            <td style="font-weight: 700;">${formatCompetenciaLabel(c.competencia)}</td>
            <td style="font-weight: 700;">${r.name}</td>
            <td style="color: #64748b;">${r.emp?.company || 'MarBR'} • ${r.emp?.job_role || r.emp?.department || '—'}</td>
            <td style="text-align: center;"><span class="${r.isCLT ? 'badge-clt' : 'badge-pj'}">${r.isCLT ? 'CLT' : 'PJ'}</span></td>
            <td class="num">${formatCurrency(fixo)}</td>
            <td class="num">${c.valor_adiantamento ? '+' + formatCurrency(c.valor_adiantamento) : '—'}</td>
            <td class="num">${ben > 0 ? '+' + formatCurrency(ben) : '—'}</td>
            <td class="num" style="color: #e11d48;">${desc > 0 ? '-' + formatCurrency(desc) : '—'}</td>
            <td class="num" style="font-weight: 900; color: #047857;">${formatCurrency(r.realTotal)}</td>
          </tr>
        `;
      });

      html += `
          <tr class="total-row">
            <td colspan="4" style="text-transform: uppercase;">Total Consolidado (${filteredRows.length} Lançamentos)</td>
            <td class="num">${formatCurrency(totalSalarioFixo)}</td>
            <td class="num">${formatCurrency(totalAdiantamento)}</td>
            <td class="num">${formatCurrency(totalBeneficios)}</td>
            <td class="num" style="color: #e11d48;">-${formatCurrency(totalDescontos)}</td>
            <td class="num" style="color: #047857;">${formatCurrency(totalRealDesembolsado)}</td>
          </tr>
        </tbody>
        </table>
      `;
    } else {
      html += `
        <table>
          <thead>
            <tr>
              <th style="width: 60px;">Comp.</th>
              <th>Colaborador & CPF</th>
              <th>Cargo / Setor</th>
              <th style="width: 35px; text-align: center;">Reg.</th>
              <th class="num">Salário Fixo</th>
              <th class="num">HE & Not.</th>
              <th class="num">13º & Fér.</th>
              <th class="num" style="background: #e2e8f0; font-weight: 900;">Total Prov.</th>
              <th class="num">INSS / IRRF</th>
              <th class="num">Desc. VT 6%</th>
              <th class="num">Faltas/Consig</th>
              <th class="num" style="color: #e11d48; font-weight: 900;">Total Desc.</th>
              <th class="num" style="background: #f1f5f9; font-weight: 900;">Líq. Folha</th>
              <th class="num" style="color: #2563eb;">Adiant.</th>
              <th class="num" style="color: #059669;">Benefícios</th>
              <th class="num" style="color: #047857; font-weight: 900; background: #ecfdf5;">Total Pago</th>
            </tr>
          </thead>
          <tbody>
      `;

      filteredRows.forEach(r => {
        const c = r.cost;
        const fixo = c.valor_fixo !== undefined && c.valor_fixo !== null ? c.valor_fixo : (c.valor_liquido || 0);
        const heNoturno = (c.valor_hora_extra || 0) + (c.valor_adicional_not || 0);
        const decimoFerias = (c.valor_decimo_terceiro || 0) + (c.valor_ferias || 0) + (c.valor_rescisao || 0);
        const proventos = c.valor_holerite || (fixo + heNoturno + (c.outros_ajustes || 0));
        
        const inssIrrf = (c.inss_empregado || 0) + (c.irrf_empregado || 0);
        const descVt = (c as any).desconto_vt_6 || 0;
        const faltasConsig = (c.valor_faltas || 0) + (c.valor_consignado || 0) + (c.valor_pensao_alimenticia || 0);
        const totalDesc = c.valor_descontos || (inssIrrf + descVt + faltasConsig);
        const liqFolha = Math.max(0, proventos - totalDesc);

        const adiant = c.valor_adiantamento || 0;
        const ben = (c.valor_vt || 0) + (c.valor_vr || 0) + (c.valor_cesta || 0) + (c.valor_bonus || 0) + (c.valor_ajuda_custo || 0);
        const totalPago = r.realTotal;

        html += `
          <tr>
            <td style="font-weight: 700;">${c.competencia.slice(2, 7)}</td>
            <td style="font-weight: 700;">
              ${r.name}
              ${r.emp?.document_id ? `<br/><span style="color: #64748b; font-weight: normal; font-size: 7.5px;">CPF: ${r.emp.document_id}</span>` : ''}
            </td>
            <td style="color: #64748b;">${r.emp?.job_role || r.emp?.department || '—'}</td>
            <td style="text-align: center;"><span class="${r.isCLT ? 'badge-clt' : 'badge-pj'}">${r.isCLT ? 'CLT' : 'PJ'}</span></td>
            <td class="num">${formatCurrency(fixo)}</td>
            <td class="num">${heNoturno > 0 ? '+' + formatCurrency(heNoturno) : '—'}</td>
            <td class="num">${decimoFerias > 0 ? '+' + formatCurrency(decimoFerias) : '—'}</td>
            <td class="num" style="background: #f8fafc; font-weight: 800;">${formatCurrency(proventos)}</td>
            <td class="num" style="color: #e11d48;">${inssIrrf > 0 ? '-' + formatCurrency(inssIrrf) : '—'}</td>
            <td class="num" style="color: #e11d48;">${descVt > 0 ? '-' + formatCurrency(descVt) : '—'}</td>
            <td class="num" style="color: #e11d48;">${faltasConsig > 0 ? '-' + formatCurrency(faltasConsig) : '—'}</td>
            <td class="num" style="color: #e11d48; font-weight: 800;">${totalDesc > 0 ? '-' + formatCurrency(totalDesc) : '—'}</td>
            <td class="num" style="font-weight: 800; background: #f8fafc;">${formatCurrency(liqFolha)}</td>
            <td class="num" style="color: #2563eb;">${adiant > 0 ? '+' + formatCurrency(adiant) : '—'}</td>
            <td class="num" style="color: #059669;">${ben > 0 ? '+' + formatCurrency(ben) : '—'}</td>
            <td class="num" style="color: #047857; font-weight: 900; background: #ecfdf5;">${formatCurrency(totalPago)}</td>
          </tr>
        `;
      });

      html += `
          <tr class="total-row">
            <td colspan="4" style="text-transform: uppercase;">Totais Auditados</td>
            <td class="num">${formatCurrency(totalSalarioFixo)}</td>
            <td class="num">${formatCurrency(totalHorasExtras)}</td>
            <td class="num">${formatCurrency(totalDecimoFerias)}</td>
            <td class="num" style="background: #e2e8f0;">${formatCurrency(totalSalarioFixo + totalHorasExtras + totalDecimoFerias)}</td>
            <td class="num" colspan="3" style="text-align: center; color: #64748b;">Deduções da Folha</td>
            <td class="num" style="color: #e11d48;">-${formatCurrency(totalDescontos)}</td>
            <td class="num" style="background: #e2e8f0;">${formatCurrency((totalSalarioFixo + totalHorasExtras + totalDecimoFerias) - totalDescontos)}</td>
            <td class="num" style="color: #2563eb;">+${formatCurrency(totalAdiantamento)}</td>
            <td class="num" style="color: #059669;">+${formatCurrency(totalBeneficios)}</td>
            <td class="num" style="color: #047857; background: #d1fae5;">${formatCurrency(totalRealDesembolsado)}</td>
          </tr>
        </tbody>
        </table>
      `;
    }

    html += `
        <div class="signatures">
          <div>
            <div class="sig-line"></div>
            <div class="sig-label">Departamento Pessoal (DP)</div>
          </div>
          <div>
            <div class="sig-line"></div>
            <div class="sig-label">Controladoria / Auditoria</div>
          </div>
          <div>
            <div class="sig-line"></div>
            <div class="sig-label">Diretoria Executiva / Financeiro</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

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
                  <th className="px-3 py-3 w-10 text-center select-none">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                      title="Selecionar todos os colaboradores CLT visíveis"
                    />
                  </th>

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

              <tbody 
                key={`tbody-${selectedYears.join('-')}-${compFilterMode}-${selectedCompetencia}-${selectedVinculo}-${selectedEmpresa}-${selectedSetor}-${searchTerm}-${usePageScope}`}
                className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900/60 font-medium"
              >
                {filteredRows.map(({ cost, emp, name, realTotal, isCLT, isEstagio }, idx) => {
                  const beneficios = (cost.valor_vr || 0) + (cost.valor_vt || 0) + (cost.valor_cesta || 0) + (cost.valor_ajuda_custo || 0);
                  const heNoturno = (cost.valor_hora_extra || 0) + (cost.valor_adicional_not || 0);
                  const decimoFerias = (cost.valor_decimo_terceiro || 0) + (cost.valor_ferias || 0) + (cost.valor_rescisao || 0);
                  const fixo = cost.valor_fixo !== undefined && cost.valor_fixo !== null ? cost.valor_fixo : (cost.valor_liquido || 0);
                  const isDeletingThis = deletingId === cost.id;

                  return (
                    <tr 
                      key={`${cost.id || 'cost'}-${cost.competencia || 'comp'}-${idx}`} 
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group ${
                        selectedCostIds.has(cost.id) ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* Checkbox de Seleção (Apenas CLT) */}
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

        {/* MODAL DE ESCOLHA DO RELATÓRIO PDF (SINTÉTICO OU ANALÍTICO) */}
        {isPdfModalOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
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
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Selecione o Modelo de Relatório:
                </label>

                {/* OPÇÃO 1: SINTÉTICO */}
                <div
                  onClick={() => setPdfReportType('sintetico')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    pdfReportType === 'sintetico'
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                      1. Relatório Sintético
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 uppercase">
                      Diretoria / Executivo
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Visão consolidada em retrato (Portrait) com KPIs, totais de salário, adiantamento, benefícios e total real desembolsado por colaborador.
                  </p>
                </div>

                {/* OPÇÃO 2: ANALÍTICO */}
                <div
                  onClick={() => setPdfReportType('analitico')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    pdfReportType === 'analitico'
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                      2. Relatório Analítico
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 uppercase">
                      DP / Contabilidade
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Abertura contábil completa em paisagem (Landscape) com todas as rubricas: horas extras, adicional noturno, férias, 13º, INSS, IRRF, desc. VT 6%, faltas, consignados, líquido de folha, adiantamento e benefícios.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGeneratePdf(pdfReportType)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <Printer size={15} />
                  <span>Gerar e Imprimir PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
