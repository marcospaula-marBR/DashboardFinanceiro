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
  Filter,
  RefreshCw,
  PlusCircle
} from "lucide-react";

// Interface para Filtros Locais
interface FluxoFilters {
  tipo: string;
  status: string;
  categoria: string;
  projeto: string;
  departamento: string;
  search: string;
}

export default function FluxoCaixaPage() {
  // Query Params da Busca Omie
  const [searchParams, setSearchParams] = useState<{ startDate: string; endDate: string; company: string } | null>(null);

  // Data States
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);

  // Configuração de Visualização
  const [activeTab, setActiveTab] = useState<'consolidado' | 'detalhado'>('consolidado');
  const [groupBy, setGroupBy] = useState<'diario' | 'semanal' | 'mensal'>('semanal');
  
  // Loading & Error
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros Locais
  const [filters, setFilters] = useState<FluxoFilters>({
    tipo: "TODOS",
    status: "TODOS",
    categoria: "TODAS",
    projeto: "TODOS",
    departamento: "TODOS",
    search: ""
  });

  // Gatilho de filtro quando as regras mudam
  useEffect(() => {
    applyFilters(allRecords, filters);
  }, [allRecords, filters]);

  // Executar busca de dados na API Omie
  const handleGenerate = async (params: { startDate: string; endDate: string; company: string }) => {
    setError(null);
    setIsLoading(true);
    setSearchParams(params);
    try {
      const data = await LancamentosService.getFluxoCaixaRealTime(params.startDate, params.endDate, params.company);
      // Inicializar selecionado = true para simulações locais
      const initialized = data.map((item: any) => ({ ...item, selecionado: true }));
      setAllRecords(initialized);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados do fluxo de caixa do Omie.");
      setAllRecords([]);
    } finally {
      setIsLoading(false);
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
    // Obter o conjunto de IDs atualmente visíveis após os filtros
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
    setError(null);
    setFilters({
      tipo: "TODOS",
      status: "TODOS",
      categoria: "TODAS",
      projeto: "TODOS",
      departamento: "TODOS",
      search: ""
    });
  };

  // Filtragem no Frontend
  const applyFilters = (base: any[], activeFilters: FluxoFilters) => {
    let result = [...base];

    // 1. Tipo
    if (activeFilters.tipo !== "TODOS") {
      result = result.filter(item => item.tipo === activeFilters.tipo);
    }

    // 2. Status
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

    // 5. Departamento
    if (activeFilters.departamento !== "TODOS") {
      result = result.filter(item => item.departamento_nome === activeFilters.departamento);
    }

    // 6. Busca
    if (activeFilters.search) {
      const term = activeFilters.search.toLowerCase();
      result = result.filter(item => 
        (item.cliente_fornecedor || "").toLowerCase().includes(term) ||
        (item.observacao || "").toLowerCase().includes(term) ||
        (item.categoria_nome || "").toLowerCase().includes(term) ||
        (item.numero_documento || "").toLowerCase().includes(term)
      );
    }

    setFilteredRecords(result);
  };

  // Calcular KPIs baseados apenas nos itens selecionados (simulados)
  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    
    // Consideramos apenas os itens que estão com selecionado = true (ou undefined/não falso)
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
      projetos: Array.from(new Set(allRecords.map(r => r.projeto_nome).filter(Boolean))).sort() as string[],
      departamentos: Array.from(new Set(allRecords.map(r => r.departamento_nome).filter(Boolean))).sort() as string[]
    };
  }, [allRecords]);

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
              Análise e Projeção de Recursos em Tempo Real (Omie API)
              <span className="ml-2 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                {APP_VERSION}
              </span>
            </p>
          </div>
          {searchParams && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 shadow-sm transition-all"
            >
              <ArrowLeft size={14} />
              Nova Consulta
            </button>
          )}
        </div>

        {/* Erro */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
            <AlertCircle size={20} className="shrink-0" />
            <span className="text-sm font-medium">{error}</span>
            {searchParams && (
              <button 
                onClick={() => handleGenerate(searchParams)} 
                className="ml-auto text-xs font-bold bg-white px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw size={12} /> Tentar novamente
              </button>
            )}
          </div>
        )}

        {/* Tela Inicial: Sem Busca Realizada */}
        {!searchParams && !isLoading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <PeriodSelector onGenerate={handleGenerate} isLoading={isLoading} />
          </div>
        )}

        {/* Carregamento */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center py-24 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
              <p className="text-sm font-bold text-slate-800">Sincronizando em tempo real com Omie...</p>
              <p className="text-xs text-slate-400 font-medium">Buscando contas a pagar, receber e extratos de conta</p>
            </div>
          </div>
        )}

        {/* Tela de Resultados: Dados Carregados */}
        {searchParams && !isLoading && allRecords.length > 0 && (
          <div className="space-y-6">
            {/* Seletor Compacto no Topo */}
            <PeriodSelector 
              onGenerate={handleGenerate} 
              isLoading={isLoading} 
              compact={true} 
              initialParams={searchParams} 
            />

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard 
                title="Total Entradas (Recebido/Previsto)" 
                value={formatCurrency(stats.totalEntradas)} 
                icon={<TrendingUp size={24} />} 
                color="emerald" 
              />
              <StatCard 
                title="Total Saídas (Pago/Previsto)" 
                value={`-${formatCurrency(stats.totalSaidas)}`} 
                icon={<TrendingDown size={24} />} 
                color="slate" 
              />
              <StatCard 
                title="Resultado Líquido do Período" 
                value={stats.resultadoLiquido >= 0 ? `+${formatCurrency(stats.resultadoLiquido)}` : formatCurrency(stats.resultadoLiquido)} 
                icon={<Activity size={24} />} 
                color={stats.resultadoLiquido >= 0 ? "blue" : "red"} 
              />
            </div>

            {/* Gráfico de Evolução */}
            <FluxoCharts lancamentos={allRecords} groupBy={groupBy} />

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
                    Lançamentos Detalhados
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
                    <option value="MOVIMENTO">Movimentos Extrato</option>
                  </select>
                </div>

                <div>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="TODOS">Todos Status</option>
                    <option value="PAGO">Realizados (Pagos)</option>
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

                <div>
                  <select
                    value={filters.projeto}
                    onChange={(e) => setFilters(prev => ({ ...prev, projeto: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="TODOS">Todos Projetos</option>
                    {filterOptions.projetos.map(proj => (
                      <option key={proj} value={proj}>{proj}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Renderização das Tabelas com base na Aba ativa */}
            {activeTab === 'consolidado' ? (
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
            )}
          </div>
        )}

        {/* Sem Registros na busca */}
        {searchParams && !isLoading && allRecords.length === 0 && !error && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 p-8 text-center">
            <AlertCircle size={40} className="text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-1">Nenhum lançamento encontrado</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-sm">
              Não encontramos contas a pagar, contas a receber ou movimentos no período selecionado de {formatDateBR(searchParams.startDate)} a {formatDateBR(searchParams.endDate)}.
            </p>
            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              Fazer Nova Consulta
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
