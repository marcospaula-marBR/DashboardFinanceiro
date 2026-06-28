"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { HeaderFinanceiro } from "@/components/layout/HeaderFinanceiro";
import { StatCard } from "@/components/loans/StatCard";
import { PeriodSelector } from "@/components/fluxo-caixa/PeriodSelector";
import { FluxoConsolidadoTable } from "@/components/fluxo-caixa/FluxoConsolidadoTable";
import { FluxoDetalhadoTable } from "@/components/fluxo-caixa/FluxoDetalhadoTable";
import { FluxoCharts } from "@/components/fluxo-caixa/FluxoCharts";
import { LancamentosService, formatCurrency, formatDateBR } from "@/services/lancamentos.service";
import { APP_VERSION } from "@/version";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  Layers,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock
} from "lucide-react";

// Interface para Filtros Locais
interface FluxoFilters {
  tipo: string;
  contasDre: string[];
  categorias: string[];
  projetos: string[];
  search: string;
}

// Componente MultiSelectDropdown Light Mode para os filtros do Fluxo de Caixa
interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  placeholder?: string;
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  placeholder = "Buscar..."
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => 
    String(o || "").toLowerCase().includes(search.toLowerCase())
  );

  const displayLabel = selected.length === 0
    ? "Nenhum"
    : selected.length === options.length
    ? "Todos"
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selecionados`;

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 text-slate-850 rounded-xl px-3 py-2.5 text-xs font-semibold hover:bg-slate-100/75 transition-all cursor-pointer w-full text-left shadow-sm h-[38px]"
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">{label}:</span>
          <span className={`truncate text-xs ${selected.length > 0 ? "text-emerald-700 font-bold" : "text-slate-400 font-medium"}`}>
            {displayLabel}
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-full min-w-[220px] max-h-[280px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-105 bg-slate-50 flex-shrink-0">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">{label}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSelectAll}
                className="text-[9px] text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
              >
                Marcar Todos
              </button>
              <button
                type="button"
                onClick={onClear}
                className="text-[9px] text-slate-500 hover:text-rose-600 font-bold cursor-pointer"
              >
                Desmarcar Todos
              </button>
            </div>
          </div>
          {/* Search */}
          {options.length > 5 && (
            <div className="px-2 py-1.5 border-b border-slate-100 flex-shrink-0">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={placeholder}
                className="bg-slate-50 border border-slate-150 rounded-lg px-2 py-1 w-full focus:outline-none text-xs placeholder:text-slate-400"
              />
            </div>
          )}
          {/* Options */}
          <div className="overflow-y-auto py-1 flex-1 scrollbar-thin">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 px-3 py-2 italic">Nenhum resultado</p>
            ) : (
              filtered.map(opt => {
                const isSelected = selected.includes(opt);
                return (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => onToggle(opt)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-all
                      ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'}`}
                    >
                      {isSelected && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className={`truncate ${isSelected ? 'text-slate-950 font-bold' : 'text-slate-600 font-medium'}`}>
                      {opt}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FluxoCaixaPage() {
  // Query Params da Busca
  const [searchParams, setSearchParams] = useState<{ startDate: string; endDate: string; company: string } | null>(null);

  // Data States
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Configuração de Visualização
  const [activeTab, setActiveTab] = useState<'consolidado' | 'detalhado'>('consolidado');
  const [groupBy, setGroupBy] = useState<'diario' | 'semanal' | 'mensal'>('semanal');
  
  // Loading & Error
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  // Filtros Locais
  const [filters, setFilters] = useState<FluxoFilters>({
    tipo: "TODOS",
    contasDre: [],
    categorias: [],
    projetos: [],
    search: ""
  });

  // Inicializar filtros locais com todos os itens disponíveis quando os registros mudam
  useEffect(() => {
    if (allRecords.length > 0) {
      const uniqueDREs = Array.from(new Set(allRecords.map(r => r.conta_dre).filter(Boolean))) as string[];
      const uniqueCats = Array.from(new Set(allRecords.map(r => r.categoria_nome).filter(Boolean))) as string[];
      const uniqueProjs = Array.from(new Set(allRecords.map(r => r.projeto_nome).filter(Boolean))) as string[];
      
      setFilters(prev => ({
        ...prev,
        contasDre: uniqueDREs,
        categorias: uniqueCats,
        projetos: uniqueProjs
      }));
    }
  }, [allRecords]);

  // Gatilho de filtro quando as regras mudam
  useEffect(() => {
    applyFilters(allRecords, filters);
  }, [allRecords, filters]);

  // Handlers para os filtros de seleção múltipla
  const handleToggleFilter = (key: 'contasDre' | 'categorias' | 'projetos', val: string) => {
    setFilters(prev => {
      const current = [...prev[key]];
      const idx = current.indexOf(val);
      if (idx > -1) {
        current.splice(idx, 1);
      } else {
        current.push(val);
      }
      return { ...prev, [key]: current };
    });
  };

  const handleSelectAllFilter = (key: 'contasDre' | 'categorias' | 'projetos', options: string[]) => {
    setFilters(prev => ({ ...prev, [key]: [...options] }));
  };

  const handleClearFilter = (key: 'contasDre' | 'categorias' | 'projetos') => {
    setFilters(prev => ({ ...prev, [key]: [] }));
  };

  // Limpar mensagem de sucesso do sync após 5 segundos
  useEffect(() => {
    if (syncSuccessMessage) {
      const timer = setTimeout(() => setSyncSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [syncSuccessMessage]);

  // Executar busca de dados no Supabase
  const handleGenerate = async (params: { startDate: string; endDate: string; company: string }) => {
    setError(null);
    setIsLoading(true);
    setSearchParams(params);
    try {
      const res = await LancamentosService.getFluxoCaixaRealTime(params.startDate, params.endDate, params.company);
      // Inicializar selecionado = true para simulações locais
      const initialized = res.data.map((item: any) => ({ ...item, selecionado: item.selecionado !== false }));
      setAllRecords(initialized);
      setLastSyncAt(res.lastSyncAt);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados do fluxo de caixa do Supabase.");
      setAllRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Disparar sincronização manual com o Omie
  const handleSync = async () => {
    if (!searchParams) return;
    setIsSyncing(true);
    setError(null);
    setSyncSuccessMessage(null);
    try {
      const res = await LancamentosService.syncFluxoCaixa(searchParams.startDate, searchParams.endDate, searchParams.company);
      if (res.status === 'success') {
        const summary = res.summary;
        setSyncSuccessMessage(
          `Sincronização concluída! Retornados: ${summary.returned} | Adicionados: ${summary.inserted} | Atualizados: ${summary.updated} | Removidos: ${summary.deactivated}`
        );
        // Recarregar os dados do Supabase
        await handleGenerate(searchParams);
      } else {
        throw new Error(res.message || 'Falha na sincronização.');
      }
    } catch (err: any) {
      setError(err.message || "Erro ao sincronizar dados com o Omie.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Alternar seleção de um item específico (Simulação local)
  const handleToggleSelection = (id: string) => {
    setAllRecords(prev => prev.map(item => 
      item.id_global === id ? { ...item, selecionado: item.selecionado === false } : item
    ));
  };

  // Marcar ou desmarcar todos os itens filtrados na tela de simulação
  const handleToggleAll = (selectAll: boolean) => {
    const visibleIds = new Set(filteredRecords.map(r => r.id_global));
    setAllRecords(prev => prev.map(item => 
      visibleIds.has(item.id_global) ? { ...item, selecionado: selectAll } : item
    ));
  };

  // Resetar a consulta e voltar para a seleção de período
  const handleReset = () => {
    setSearchParams(null);
    setAllRecords([]);
    setFilteredRecords([]);
    setLastSyncAt(null);
    setError(null);
    setFilters({
      tipo: "TODOS",
      contasDre: [],
      categorias: [],
      projetos: [],
      search: ""
    });
  };

  // Filtragem no Frontend
  const applyFilters = (base: any[], activeFilters: FluxoFilters) => {
    let result = [...base];

    // 1. Tipo (RECEBER / PAGAR)
    if (activeFilters.tipo !== "TODOS") {
      result = result.filter(item => item.tipo === activeFilters.tipo);
    }

    // 2. Contas DRE
    if (activeFilters.contasDre.length > 0) {
      result = result.filter(item => activeFilters.contasDre.includes(item.conta_dre));
    } else {
      result = [];
    }

    // 3. Categorias
    if (activeFilters.categorias.length > 0) {
      result = result.filter(item => activeFilters.categorias.includes(item.categoria_nome));
    } else {
      result = [];
    }

    // 4. Projetos
    if (activeFilters.projetos.length > 0) {
      result = result.filter(item => activeFilters.projetos.includes(item.projeto_nome));
    } else {
      result = [];
    }

    // 5. Busca
    if (activeFilters.search) {
      const term = activeFilters.search.toLowerCase();
      result = result.filter(item => 
        (item.cliente_fornecedor || "").toLowerCase().includes(term) ||
        (item.observacao || "").toLowerCase().includes(term) ||
        (item.categoria_nome || "").toLowerCase().includes(term)
      );
    }

    setFilteredRecords(result);
  };

  // Calcular KPIs baseados apenas nos itens selecionados (simulados)
  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    
    const activeRecords = allRecords.filter(r => r.selecionado !== false);

    activeRecords.forEach(item => {
      const val = item.valor_alocado || 0;
      if (val > 0) {
        totalIn += val;
      } else {
        totalOut += Math.abs(val);
      }
    });

    return {
      totalEntradas: totalIn,
      totalSaidas: totalOut,
      resultadoLiquido: totalIn - totalOut
    };
  }, [allRecords]);

  // Listas exclusivas para os filtros dinâmicos
  const filterOptions = useMemo(() => {
    return {
      contasDre: Array.from(new Set(allRecords.map(r => r.conta_dre).filter(Boolean))).sort() as string[],
      categorias: Array.from(new Set(allRecords.map(r => r.categoria_nome).filter(Boolean))).sort() as string[],
      projetos: Array.from(new Set(allRecords.map(r => r.projeto_nome).filter(Boolean))).sort() as string[]
    };
  }, [allRecords]);

  const formatDateTimeBR = (isoStr: string | null) => {
    if (!isoStr) return '';
    try {
      const date = new Date(isoStr);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="max-w-[1600px] w-full mx-auto px-4 md:px-8 mt-6">
        <HeaderFinanceiro />
      </div>

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-8 flex flex-col">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Fluxo de Caixa
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Análise e Projeção de Contas a Receber e Pagar em Aberto
              <span className="ml-2 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                {APP_VERSION}
              </span>
            </p>
          </div>
          {searchParams && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 shadow-sm transition-all self-start md:self-auto"
            >
              <ArrowLeft size={14} />
              Nova Consulta
            </button>
          )}
        </div>

        {/* Erro */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 animate-in fade-in duration-200">
            <AlertCircle size={20} className="shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Mensagem de Sucesso na Sincronização */}
        {syncSuccessMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-700 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
            <span className="text-sm font-semibold">{syncSuccessMessage}</span>
          </div>
        )}

        {/* Tela Inicial: Sem Busca Realizada */}
        {!searchParams && !isLoading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <PeriodSelector onGenerate={handleGenerate} isLoading={isLoading} />
          </div>
        )}

        {/* Carregamento da Busca Local */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center py-24 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
              <p className="text-sm font-bold text-slate-800">Carregando dados do Supabase...</p>
              <p className="text-xs text-slate-400 font-medium">Buscando lançamentos previstos e em aberto</p>
            </div>
          </div>
        )}

        {/* Tela de Resultados: Dados Carregados */}
        {searchParams && !isLoading && (
          <div className="space-y-6">
            {/* Seletor Compacto no Topo */}
            <PeriodSelector 
              onGenerate={handleGenerate} 
              isLoading={isLoading} 
              compact={true} 
              initialParams={searchParams} 
            />

            {/* Banner de Status de Sincronização */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${lastSyncAt ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                  <Clock size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">
                    {lastSyncAt 
                      ? `Período atualizado com Omie em: ${formatDateTimeBR(lastSyncAt)}` 
                      : "Este período ainda não foi sincronizado com o Omie."}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {lastSyncAt 
                      ? "Os dados são carregados rapidamente do Supabase. Para obter dados em tempo real da Omie, clique ao lado."
                      : "Os dados exibidos podem estar incompletos ou desatualizados."}
                  </span>
                </div>
              </div>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-150 disabled:text-slate-400 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all disabled:shadow-none min-w-[170px]"
              >
                {isSyncing ? (
                  <><Loader2 size={14} className="animate-spin" /> Sincronizando...</>
                ) : (
                  <><RefreshCw size={14} /> Sincronizar com Omie</>
                )}
              </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard 
                title="Total Entradas (Previsto)" 
                value={formatCurrency(stats.totalEntradas)} 
                icon={<TrendingUp size={24} />} 
                color="emerald" 
              />
              <StatCard 
                title="Total Saídas (Previsto)" 
                value={`-${formatCurrency(stats.totalSaidas)}`} 
                icon={<TrendingDown size={24} />} 
                color="slate" 
              />
              <StatCard 
                title="Resultado Projetado do Período" 
                value={stats.resultadoLiquido >= 0 ? `+${formatCurrency(stats.resultadoLiquido)}` : formatCurrency(stats.resultadoLiquido)} 
                icon={<Activity size={24} />} 
                color={stats.resultadoLiquido >= 0 ? "blue" : "red"} 
              />
            </div>

            {/* Gráfico de Evolução */}
            {allRecords.length > 0 && (
              <FluxoCharts lancamentos={allRecords} groupBy={groupBy} />
            )}

            {/* Filtros e Controles das Visualizações */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                
                {/* Abas */}
                <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-start lg:self-auto">
                  <button
                    onClick={() => setActiveTab('consolidado')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                      activeTab === 'consolidado' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Fluxo Consolidado
                  </button>
                  <button
                    onClick={() => setActiveTab('detalhado')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                      activeTab === 'detalhado' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Lançamentos Detalhados (DRE)
                  </button>
                </div>

                {/* Controles de agrupamento / Ações rápidas */}
                <div className="flex items-center gap-3">
                  {activeTab === 'consolidado' && (
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-500 uppercase">Agrupar por:</span>
                      <select
                        value={groupBy}
                        onChange={(e: any) => setGroupBy(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
                      >
                        <option value="diario">Diário</option>
                        <option value="semanal">Semanal</option>
                        <option value="mensal">Mensal</option>
                      </select>
                    </div>
                  )}

                  <div className="h-6 w-px bg-slate-200 hidden lg:block" />

                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-xl border border-blue-100 font-bold max-w-[280px] lg:max-w-none truncate" title="Você pode marcar/desmarcar itens para simular o resultado em tempo real">
                    💡 Simulação em tempo real ativa
                  </span>
                </div>
              </div>

              {/* Filtros Locais (Busca + Filtros Avançados) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Pesquisar fornecedor, obs..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-semibold outline-none focus:border-emerald-500 h-[38px]"
                  />
                </div>

                <div>
                  <select
                    value={filters.tipo}
                    onChange={(e) => setFilters(prev => ({ ...prev, tipo: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500 cursor-pointer h-[38px] shadow-sm"
                  >
                    <option value="TODOS">Todos Lançamentos</option>
                    <option value="RECEBER">Receber (Entradas)</option>
                    <option value="PAGAR">Pagar (Saídas)</option>
                  </select>
                </div>

                <div>
                  <MultiSelectDropdown
                    label="Contas DRE"
                    options={filterOptions.contasDre}
                    selected={filters.contasDre}
                    onToggle={(val) => handleToggleFilter('contasDre', val)}
                    onSelectAll={() => handleSelectAllFilter('contasDre', filterOptions.contasDre)}
                    onClear={() => handleClearFilter('contasDre')}
                  />
                </div>

                <div>
                  <MultiSelectDropdown
                    label="Categorias"
                    options={filterOptions.categorias}
                    selected={filters.categorias}
                    onToggle={(val) => handleToggleFilter('categorias', val)}
                    onSelectAll={() => handleSelectAllFilter('categorias', filterOptions.categorias)}
                    onClear={() => handleClearFilter('categorias')}
                  />
                </div>

                <div>
                  <MultiSelectDropdown
                    label="Projetos"
                    options={filterOptions.projetos}
                    selected={filters.projetos}
                    onToggle={(val) => handleToggleFilter('projetos', val)}
                    onSelectAll={() => handleSelectAllFilter('projetos', filterOptions.projetos)}
                    onClear={() => handleClearFilter('projetos')}
                  />
                </div>
              </div>
            </div>

            {/* Renderização das Tabelas com base na Aba ativa */}
            {allRecords.length > 0 ? (
              activeTab === 'consolidado' ? (
                <FluxoConsolidadoTable 
                  lancamentos={filteredRecords} 
                  groupBy={groupBy} 
                />
              ) : (
                <FluxoDetalhadoTable 
                  lancamentos={filteredRecords} 
                  onToggleSelection={handleToggleSelection}
                  onToggleAll={handleToggleAll}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 p-8 text-center">
                <AlertCircle size={40} className="text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1 font-black">Nenhum lançamento no período</h3>
                <p className="text-sm text-slate-400 mb-6 max-w-sm font-medium">
                  Não existem dados salvos no Supabase para este período. Clique no botão de sincronização acima para carregar da Omie.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Sem Registros na busca */}
        {searchParams && !isLoading && allRecords.length === 0 && !error && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 p-8 text-center">
            <AlertCircle size={40} className="text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-1 font-black">Nenhum lançamento cadastrado</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-sm font-medium">
              Não encontramos contas a pagar ou a receber em aberto no período selecionado de {formatDateBR(searchParams.startDate)} a {formatDateBR(searchParams.endDate)}.
            </p>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSyncing ? (
                  <><Loader2 size={12} className="animate-spin" /> Sincronizando...</>
                ) : (
                  <><RefreshCw size={12} /> Sincronizar Omie agora</>
                )}
              </button>
              <button
                onClick={handleReset}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fazer Nova Consulta
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
