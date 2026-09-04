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
import {
  BarChart3,
  Table as TableIcon,
  Layers,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';

export default function DreCaixaPage() {
  const [allLancamentos, setAllLancamentos] = useState<DreCaixaLancamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Modo Reunião (Ocultar dados sensíveis como receitas e faturamento)
  const [isMeetingMode, setIsMeetingMode] = useState(false);

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
    search: ''
  });

  // Modal de Drilldown
  const [drilldownCategory, setDrilldownCategory] = useState<string>('');
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

  // 2. Opções disponíveis de filtros
  const availableOptions = useMemo(() => {
    return DreCaixaService.extractFilterOptions(allLancamentos);
  }, [allLancamentos]);

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
      search: ''
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

  const handleOpenDrilldown = (category: string) => {
    setDrilldownCategory(category);
    setIsDrilldownOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header Superior Padrão */}
      <DreCaixaHeader
        lastUpdate={lastUpdate}
        isLoading={isLoading}
        isMeetingMode={isMeetingMode}
        onToggleMeetingMode={() => setIsMeetingMode(!isMeetingMode)}
        onRefresh={loadData}
        onExportCsv={handleExportCsv}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6">
        
        {/* Banner de Erro caso ocorra */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3 text-sm">
            <AlertCircle size={20} className="flex-shrink-0 text-rose-400" />
            <div className="flex-1">{errorMsg}</div>
            <button
              onClick={loadData}
              className="px-3 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-xs transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Barra de Filtros Multidimensionais */}
        <DreCaixaFiltersBar
          availableOptions={availableOptions}
          filters={filters}
          onChangeFilters={setFilters}
          onClearFilters={handleClearFilters}
        />

        {/* Loading Overlay */}
        {isLoading && allLancamentos.length === 0 ? (
          <div className="py-24 text-center">
            <Loader2 size={36} className="animate-spin text-emerald-400 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-medium">Buscando lançamentos liquidados do Omie...</p>
            <p className="text-xs text-slate-500 mt-1">Carregando Contas a Pagar, Receber e Movimentos Bancários</p>
          </div>
        ) : (
          <>
            {/* Cards de KPI Executivos */}
            <DreCaixaKpis
              summary={summary}
              isMeetingMode={isMeetingMode}
            />

            {/* Seletor de Visão / Abas Executivas */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('ambos')}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'ambos' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers size={14} />
                  <span>Visão Completa</span>
                </button>
                <button
                  onClick={() => setActiveTab('graficos')}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'graficos' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <BarChart3 size={14} />
                  <span>Painel de Gráficos</span>
                </button>
                <button
                  onClick={() => setActiveTab('tabela')}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'tabela' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <TableIcon size={14} />
                  <span>DRE Sintética</span>
                </button>
              </div>

              <div className="text-xs text-slate-400 hidden sm:block">
                Mostrando <strong className="text-white">{filteredLancamentos.length.toLocaleString('pt-BR')}</strong> lançamentos
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

      {/* Modal de Detalhamento Analítico de Lançamentos */}
      <DreCaixaDrilldownModal
        isOpen={isDrilldownOpen}
        onClose={() => setIsDrilldownOpen(false)}
        categoryName={drilldownCategory}
        lancamentos={filteredLancamentos}
      />

    </div>
  );
}
