"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DreCaixaLancamento,
  DreCaixaFilters,
  DreCaixaKpiSummary,
  DreCaixaChartData,
  DreCaixaTableSection
} from '@/types/dre-caixa';
import { DreCaixaService } from '@/services/dre-caixa.service';
import { DreCaixaHeader } from '@/components/dre-caixa/DreCaixaHeader';
import { DreCaixaFiltersBar } from '@/components/dre-caixa/DreCaixaFilters';
import { DreCaixaKpis } from '@/components/dre-caixa/DreCaixaKpis';
import { DreCaixaCharts } from '@/components/dre-caixa/DreCaixaCharts';
import { DreCaixaTable } from '@/components/dre-caixa/DreCaixaTable';
import { DreCaixaDrilldownModal } from '@/components/dre-caixa/DreCaixaDrilldownModal';
import { DreCaixaPrivacyModal } from '@/components/dre-caixa/DreCaixaPrivacyModal';
import {
  BarChart3,
  Table as TableIcon,
  Layers,
  AlertCircle,
  Loader2,
  Info
} from 'lucide-react';

export default function DreCaixaPage() {
  const [allLancamentos, setAllLancamentos] = useState<DreCaixaLancamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Modo Reunião (Ocultar dados sensíveis como receitas e faturamento)
  const [isMeetingMode, setIsMeetingMode] = useState(false);

  // Modal de Privacidade / Ocultar Dados Sensíveis
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Tab ativa: 'graficos' | 'tabela' | 'ambos'
  const [activeTab, setActiveTab] = useState<'ambos' | 'graficos' | 'tabela'>('ambos');

  // Filtros selecionados
  const [filters, setFilters] = useState<DreCaixaFilters>({
    empresas: [],
    periodos: [],
    projetos: [],
    categorias: [],
    fornecedores: [],
    contasCorrentes: [],
    search: '',
    ocultarCategorias: [],
    ocultarProjetos: [],
    ocultarFornecedores: []
  });

  // Modal de Drilldown
  const [drilldownCategory, setDrilldownCategory] = useState<string>('');
  const [drilldownMonth, setDrilldownMonth] = useState<string | undefined>(undefined);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);

  // 1. Carregamento dos dados
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { lancamentos, error } = await DreCaixaService.fetchLancamentos();
      if (error) {
        setErrorMsg(error);
      } else {
        setAllLancamentos(lancamentos);
        const now = new Date();
        setLastUpdate(now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar lançamentos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Opções disponíveis de filtros (Filtro Inteligente: reativo à empresa selecionada)
  const availableOptions = useMemo(() => {
    return DreCaixaService.extractFilterOptions(allLancamentos, filters.empresas);
  }, [allLancamentos, filters.empresas]);

  // Sanitização de seleções órfãs ao alternar empresa (evita filtros inválidos e tela zerada)
  useEffect(() => {
    if (filters.empresas.length === 0) return;

    const validProjetos = new Set(availableOptions.projetos);
    const validCategorias = new Set(availableOptions.categorias);
    const validFornecedores = new Set(availableOptions.fornecedores);
    const validContas = new Set(availableOptions.contasCorrentes);

    const hasInvalidProjeto = filters.projetos.some(p => !validProjetos.has(p));
    const hasInvalidCategoria = filters.categorias.some(c => !validCategorias.has(c));
    const hasInvalidFornecedor = filters.fornecedores.some(f => !validFornecedores.has(f));
    const hasInvalidConta = filters.contasCorrentes.some(c => !validContas.has(c));

    if (hasInvalidProjeto || hasInvalidCategoria || hasInvalidFornecedor || hasInvalidConta) {
      setFilters(prev => ({
        ...prev,
        projetos: prev.projetos.filter(p => validProjetos.has(p)),
        categorias: prev.categorias.filter(c => validCategorias.has(c)),
        fornecedores: prev.fornecedores.filter(f => validFornecedores.has(f)),
        contasCorrentes: prev.contasCorrentes.filter(c => validContas.has(c))
      }));
    }
  }, [availableOptions, filters.empresas, filters.projetos, filters.categorias, filters.fornecedores, filters.contasCorrentes]);

  // 3. Aplicação dos filtros
  const filteredLancamentos = useMemo(() => {
    return DreCaixaService.applyFilters(allLancamentos, filters);
  }, [allLancamentos, filters]);

  // 4. KPIs
  const summary: DreCaixaKpiSummary = useMemo(() => {
    return DreCaixaService.calculateKpis(filteredLancamentos);
  }, [filteredLancamentos]);

  // 5. Dados dos Gráficos
  const chartData: DreCaixaChartData = useMemo(() => {
    return DreCaixaService.prepareChartsData(filteredLancamentos, availableOptions.periodos);
  }, [filteredLancamentos, availableOptions.periodos]);

  // 6. Estrutura da Tabela DRE-Caixa
  const tableSections: DreCaixaTableSection[] = useMemo(() => {
    const periodosVisiveis = chartData.meses.length > 0 ? chartData.meses : availableOptions.periodos.slice(0, 12);
    return DreCaixaService.buildDreTableSections(filteredLancamentos, periodosVisiveis);
  }, [filteredLancamentos, chartData.meses, availableOptions.periodos]);

  // Limpeza de filtros
  const handleClearFilters = () => {
    setFilters({
      empresas: [],
      periodos: [],
      projetos: [],
      categorias: [],
      fornecedores: [],
      contasCorrentes: [],
      search: '',
      ocultarCategorias: filters.ocultarCategorias,
      ocultarProjetos: filters.ocultarProjetos,
      ocultarFornecedores: filters.ocultarFornecedores
    });
  };

  // Exportação em CSV
  const handleExportCsv = () => {
    if (filteredLancamentos.length === 0) return;
    const headers = ['Data Pagamento', 'Empresa', 'Setor (Projeto)', 'Categoria', 'Fornecedor/Cliente', 'Conta Corrente', 'Documento', 'Tipo', 'Valor'];
    const rows = filteredLancamentos.map(item => [
      item.data_pagamento,
      item.empresa,
      `"${item.projeto}"`,
      `"${item.categoria}"`,
      `"${item.fornecedor_cliente}"`,
      `"${item.conta_corrente}"`,
      item.numero_documento || '',
      item.tipo,
      item.valor.toFixed(2)
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DRE_Caixa_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenDrilldown = (category: string, mes?: string) => {
    setDrilldownCategory(category);
    setDrilldownMonth(mes);
    setIsDrilldownOpen(true);
  };

  const empresaLabel = filters.empresas.length === 0 ? 'Todas as Empresas' : filters.empresas.join(', ');
  const periodoLabel = filters.periodos.length === 0
    ? 'Acumulado (Jun/25 a Set/26)'
    : filters.periodos.join(', ');

  const totalOcultos =
    (filters.ocultarCategorias?.length || 0) +
    (filters.ocultarProjetos?.length || 0) +
    (filters.ocultarFornecedores?.length || 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Header Superior Padrão Clean */}
      <DreCaixaHeader
        lastUpdate={lastUpdate}
        isLoading={isLoading}
        isMeetingMode={isMeetingMode}
        onToggleMeetingMode={() => setIsMeetingMode(!isMeetingMode)}
        onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
        hiddenCount={totalOcultos}
        onRefresh={loadData}
        onExportCsv={handleExportCsv}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6">
        
        {/* Banner de Erro caso ocorra */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-sm shadow-sm">
            <AlertCircle size={20} className="flex-shrink-0 text-rose-600" />
            <div className="flex-1 font-medium">{errorMsg}</div>
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-sm"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Barra de Filtros Multidimensionais com Seletor Rápido de Empresa e Período */}
        <DreCaixaFiltersBar
          availableOptions={availableOptions}
          filters={filters}
          onChangeFilters={setFilters}
          onClearFilters={handleClearFilters}
          onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
        />

        {/* Loading Overlay Clean */}
        {isLoading && allLancamentos.length === 0 ? (
          <div className="py-24 text-center bg-white border border-slate-200 rounded-2xl shadow-sm my-6">
            <Loader2 size={36} className="animate-spin text-emerald-600 mx-auto mb-3" />
            <p className="text-sm text-slate-800 font-bold">Buscando lançamentos liquidados do Omie...</p>
            <p className="text-xs text-slate-500 mt-1">Carregando Contas a Pagar, Receber e Movimentos Bancários</p>
          </div>
        ) : (
          <>
            {/* Aviso Amigável quando Período estiver Acumulado */}
            {filters.periodos.length === 0 && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 flex items-center justify-between text-xs shadow-sm">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-sky-600 shrink-0" />
                  <span>
                    <strong>Visão Acumulada:</strong> Os totais abaixo somam todos os 15 meses de operação desde Junho/2025. Para analisar um único mês (ex: <strong>Ago/26</strong>), clique no botão do mês nos filtros acima.
                  </span>
                </div>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, periodos: ['Ago/26'] }))}
                  className="shrink-0 px-2.5 py-1 bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-lg font-bold text-[11px] shadow-sm ml-2 transition-all"
                >
                  Ver apenas Ago/26
                </button>
              </div>
            )}

            {/* Cards de KPI Executivos Clean */}
            <DreCaixaKpis
              summary={summary}
              isMeetingMode={isMeetingMode}
              periodoLabel={periodoLabel}
              empresaLabel={empresaLabel}
            />

            {/* Seletor de Visão / Abas Executivas */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl shadow-inner">
                <button
                  onClick={() => setActiveTab('ambos')}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'ambos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers size={14} className={activeTab === 'ambos' ? 'text-emerald-600' : ''} />
                  <span>Visão Completa</span>
                </button>
                <button
                  onClick={() => setActiveTab('graficos')}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'graficos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 size={14} className={activeTab === 'graficos' ? 'text-emerald-600' : ''} />
                  <span>Painel de Gráficos</span>
                </button>
                <button
                  onClick={() => setActiveTab('tabela')}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'tabela' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon size={14} className={activeTab === 'tabela' ? 'text-emerald-600' : ''} />
                  <span>DRE Sintética</span>
                </button>
              </div>

              <div className="text-xs text-slate-500 font-medium hidden sm:block">
                Mostrando <strong className="text-slate-900">{filteredLancamentos.length.toLocaleString('pt-BR')}</strong> lançamentos
              </div>
            </div>

            {/* Visualização de Gráficos */}
            {(activeTab === 'ambos' || activeTab === 'graficos') && (
              <DreCaixaCharts
                chartData={chartData}
                isMeetingMode={isMeetingMode}
              />
            )}

            {/* Visualização de Tabela DRE Sintética */}
            {(activeTab === 'ambos' || activeTab === 'tabela') && (
              <DreCaixaTable
                sections={tableSections}
                meses={chartData.meses.length > 0 ? chartData.meses : availableOptions.periodos.slice(0, 12)}
                isMeetingMode={isMeetingMode}
                onOpenDrilldown={handleOpenDrilldown}
              />
            )}
          </>
        )}

      </main>

      {/* Modal de Detalhamento Analítico por Favorecido */}
      <DreCaixaDrilldownModal
        isOpen={isDrilldownOpen}
        onClose={() => setIsDrilldownOpen(false)}
        categoryName={drilldownCategory}
        initialMonth={drilldownMonth}
        availableMonths={chartData.meses.length > 0 ? chartData.meses : availableOptions.periodos.slice(0, 12)}
        empresaLabel={empresaLabel}
        lancamentos={filteredLancamentos}
      />

      {/* Modal de Ocultação de Dados Sensíveis (Categorias, Projetos, Fornecedores) */}
      <DreCaixaPrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        availableOptions={availableOptions}
        filters={filters}
        onChangeFilters={setFilters}
      />

    </div>
  );
}
