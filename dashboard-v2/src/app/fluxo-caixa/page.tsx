"use client";

import { useState, useEffect, useMemo } from "react";
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
  status: string;
  categoria: string;
  projeto: string;
  search: string;
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
    status: "TODOS",
    categoria: "TODAS",
    projeto: "TODOS",
    search: ""
  });

  // Gatilho de filtro quando as regras mudam
  useEffect(() => {
    applyFilters(allRecords, filters);
  }, [allRecords, filters]);

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
      status: "TODOS",
      categoria: "TODAS",
      projeto: "TODOS",
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

    // 2. Status (ABERTO / ATRASADO)
    if (activeFilters.status !== "TODOS") {
      result = result.filter(item => item.status === activeFilters.status);
    }

    // 3. Categoria
    if (activeFilters.categoria !== "TODAS") {
      result = result.filter(item => item.categoria_nome === activeFilters.categoria);
    }

    // 4. Projeto
    if (activeFilters.projeto !== "TODOS") {
      result = result.filter(item => item.projeto_nome === activeFilters.projeto);
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Pesquisar fornecedor, obs..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <select
                    value={filters.tipo}
                    onChange={(e) => setFilters(prev => ({ ...prev, tipo: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="TODOS">Todos Lançamentos</option>
                    <option value="RECEBER">Receber (Entradas)</option>
                    <option value="PAGAR">Pagar (Saídas)</option>
                  </select>
                </div>

                <div>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="TODOS">Todos Status</option>
                    <option value="ABERTO">Projetados (A vencer)</option>
                    <option value="ATRASADO">Atrasados</option>
                  </select>
                </div>

                <div>
                  <select
                    value={filters.categoria}
                    onChange={(e) => setFilters(prev => ({ ...prev, categoria: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="TODAS">Todas Categorias</option>
                    {filterOptions.categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
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
