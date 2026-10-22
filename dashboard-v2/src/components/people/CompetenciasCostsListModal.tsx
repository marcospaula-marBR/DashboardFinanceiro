import React, { useState, useMemo } from 'react';
import { 
  X, Calendar, Filter, Search, Trash2, Edit3, Loader2, 
  CheckCircle2, AlertTriangle, ArrowUpDown, DollarSign, Wallet, Users, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { Employee, MonthlyCost } from '@/types/loans';
import { PeopleHRService } from '@/services/people-hr.service';
import { formatCurrency } from '@/services/loans.service';

interface CompetenciasCostsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  monthlyCosts: MonthlyCost[];
  onCostDeleted: () => void;
  onEditCost: (cost: MonthlyCost, employee?: Employee) => void;
  showValues?: boolean;
}

export function CompetenciasCostsListModal({
  isOpen,
  onClose,
  employees,
  monthlyCosts,
  onCostDeleted,
  onEditCost,
  showValues = true,
}: CompetenciasCostsListModalProps) {
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('all');
  const [selectedVinculo, setSelectedVinculo] = useState<'all' | 'CLT' | 'PJ'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'competencia' | 'name' | 'total'>('competencia');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Mapeamento rápido de colaboradores por ID
  const employeesMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach(emp => map.set(emp.id, emp));
    return map;
  }, [employees]);

  // Lista de competências disponíveis ordenadas decrescente
  const availableCompetencias = useMemo(() => {
    const comps = Array.from(new Set(monthlyCosts.map(c => c.competencia))).filter(Boolean);
    return comps.sort().reverse();
  }, [monthlyCosts]);

  // Formatação de competência para rótulo legível
  const formatCompetenciaLabel = (compStr: string): string => {
    if (!compStr) return '—';
    const parts = compStr.split('-');
    if (parts.length < 2) return compStr;
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const monthName = months[monthIdx] || parts[1];
    return `${monthName}/${parts[0]}`;
  };

  // Filtragem dos custos
  const filteredRows = useMemo(() => {
    let rows = monthlyCosts.map(cost => {
      const emp = employeesMap.get(cost.employee_id);
      const isCLT = cost.vinculo_tipo === 'CLT' || emp?.linkType === 'CLT';
      const realTotal = (cost.valor_liquido || 0) + (isCLT ? (cost.valor_adiantamento || 0) : 0);
      const name = emp?.name || (cost as any).nome_colaborador || 'Colaborador';
      return {
        cost,
        emp,
        name,
        realTotal,
        isCLT,
      };
    });

    if (selectedCompetencia !== 'all') {
      rows = rows.filter(r => r.cost.competencia === selectedCompetencia);
    }

    if (selectedVinculo !== 'all') {
      if (selectedVinculo === 'CLT') {
        rows = rows.filter(r => r.isCLT);
      } else {
        rows = rows.filter(r => !r.isCLT);
      }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      rows = rows.filter(r => 
        r.name.toLowerCase().includes(term) ||
        (r.emp?.job_role || '').toLowerCase().includes(term) ||
        (r.emp?.department || '').toLowerCase().includes(term)
      );
    }

    // Ordenação
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
  }, [monthlyCosts, employeesMap, selectedCompetencia, selectedVinculo, searchTerm, sortField, sortOrder]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-slate-50 dark:via-slate-900 to-white dark:to-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Lançamentos de Custos por Competência
                </h3>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {filteredRows.length} Lançamento{filteredRows.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Visualização detalhada em lista com ações diretas de edição e exclusão por competência
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
            title="Fechar janela"
          >
            <X size={18} />
          </button>
        </div>

        {/* FEEDBACK TOAST */}
        {successToast && (
          <div className="mx-6 mt-3 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-150">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* FILTROS E PESQUISA */}
        <div className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center shrink-0">
          {/* Seletor de Competência */}
          <div className="sm:col-span-4">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Competência
            </label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={selectedCompetencia}
                onChange={e => setSelectedCompetencia(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              >
                <option value="all">Todas as Competências ({availableCompetencias.length})</option>
                {availableCompetencias.map(comp => (
                  <option key={comp} value={comp}>
                    {formatCompetenciaLabel(comp)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Seletor de Vínculo */}
          <div className="sm:col-span-3">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Regime / Vínculo
            </label>
            <div className="flex bg-slate-200/60 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setSelectedVinculo('all')}
                className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  selectedVinculo === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSelectedVinculo('CLT')}
                className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  selectedVinculo === 'CLT'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                CLT
              </button>
              <button
                onClick={() => setSelectedVinculo('PJ')}
                className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  selectedVinculo === 'PJ'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                PJ / MEI
              </button>
            </div>
          </div>

          {/* Busca por Nome */}
          <div className="sm:col-span-5">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Buscar Colaborador
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar por nome, cargo ou departamento..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* SUMMARY KPI CARDS */}
        <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Contratados</span>
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
              <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Total Desembolsado</span>
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
              <p className="text-xs text-slate-500 mt-1">Tente ajustar a competência, regime ou termo de busca.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xs">
                <tr>
                  <th 
                    onClick={() => toggleSort('competencia')}
                    className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 cursor-pointer hover:text-emerald-600 select-none"
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

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                    Salário / Fixo
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                    Adiantamento
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                    HE & Noturno
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                    Benefícios
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                    13º & Férias
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                    Descontos
                  </th>

                  <th 
                    onClick={() => toggleSort('total')}
                    className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 text-right cursor-pointer select-none"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Total Real
                      <ArrowUpDown size={12} className={sortField === 'total' ? 'text-emerald-600' : 'opacity-40'} />
                    </div>
                  </th>

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center">
                    Origem
                  </th>

                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center sticky right-0 bg-slate-100 dark:bg-slate-900 shadow-2xs">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900/60 font-medium">
                {filteredRows.map(({ cost, emp, name, realTotal, isCLT }) => {
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
                            isCLT 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900' 
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                          }`}>
                            {isCLT ? 'CLT' : 'PJ'}
                          </span>
                          <div>
                            <p className="font-black text-slate-900 dark:text-slate-100 text-xs truncate max-w-[200px] sm:max-w-[260px]">
                              {name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                              {emp?.job_role || emp?.department || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Salário / Fixo */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums text-slate-700 dark:text-slate-300 font-semibold">
                        {showValues ? formatCurrency(fixo) : '••••'}
                      </td>

                      {/* Adiantamento */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums">
                        {cost.valor_adiantamento && cost.valor_adiantamento > 0 ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold">
                            {showValues ? `+${formatCurrency(cost.valor_adiantamento)}` : '••••'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* HE & Noturno */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums">
                        {heNoturno > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            {showValues ? `+${formatCurrency(heNoturno)}` : '••••'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Benefícios */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums">
                        {beneficios > 0 ? (
                          <span className="text-cyan-700 dark:text-cyan-400 font-bold">
                            {showValues ? `+${formatCurrency(beneficios)}` : '••••'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* 13º & Férias */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums">
                        {decimoFerias > 0 ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            {showValues ? `+${formatCurrency(decimoFerias)}` : '••••'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Descontos */}
                      <td className="px-3 py-3 align-middle text-right tabular-nums">
                        {cost.valor_descontos && cost.valor_descontos > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            {showValues ? `-${formatCurrency(cost.valor_descontos)}` : '••••'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Total Real Desembolsado */}
                      <td className="px-4 py-3 align-middle text-right tabular-nums whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-black text-xs">
                          {showValues ? formatCurrency(realTotal) : '••••••'}
                        </span>
                      </td>

                      {/* Origem */}
                      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
                        <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {cost.origem === 'dianna_import' ? 'Dianna' : (cost.origem || 'Manual')}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 align-middle text-center sticky right-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50/80 dark:group-hover:bg-slate-800/40 transition-colors whitespace-nowrap shadow-2xs">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botão Editar */}
                          <button
                            onClick={() => {
                              onEditCost(cost, emp);
                              onClose();
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                            title="Editar lançamento desta competência"
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* Botão Excluir */}
                          <button
                            onClick={() => handleDeleteCost(cost.id, name, cost.competencia)}
                            disabled={isDeletingThis}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors disabled:opacity-40"
                            title="Excluir lançamento permanentemente"
                          >
                            {isDeletingThis ? <Loader2 size={15} className="animate-spin text-rose-600" /> : <Trash2 size={15} />}
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
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-500 font-medium">
            Exibindo <strong className="text-slate-800 dark:text-slate-200">{filteredRows.length}</strong> de <strong className="text-slate-800 dark:text-slate-200">{monthlyCosts.length}</strong> lançamentos no total.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
