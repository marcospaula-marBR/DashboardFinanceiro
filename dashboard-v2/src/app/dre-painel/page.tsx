"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RegimeTipo,
  DrePainelLancamento,
  DrePainelFilters
} from '@/types/dre-painel';
import { DrePainelService } from '@/services/dre-painel.service';
import { DrePainelHeader } from '@/components/dre-painel/DrePainelHeader';
import { DrePainelRegimeSelector } from '@/components/dre-painel/DrePainelRegimeSelector';
import { DrePainelFiltersBar } from '@/components/dre-painel/DrePainelFiltersBar';
import { DrePainelKpisCards } from '@/components/dre-painel/DrePainelKpis';
import { DrePainelTable } from '@/components/dre-painel/DrePainelTable';
import { DrePainelDrawer } from '@/components/dre-painel/DrePainelDrawer';
import {
  DrePainelKpiDrilldownModal,
  DrilldownCardType
} from '@/components/dre-painel/DrePainelKpiDrilldownModal';
import { DrePainelLateralCharts } from '@/components/dre-painel/DrePainelLateralCharts';
import {
  Loader2,
  AlertCircle,
  BarChart2,
  PanelRightClose,
  PanelRightOpen,
  LayoutGrid
} from 'lucide-react';

export default function DrePainelPage() {
  const [regime, setRegime] = useState<RegimeTipo>('COMPETENCIA');
  const [allLancamentos, setAllLancamentos] = useState<DrePainelLancamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isMeetingMode, setIsMeetingMode] = useState(false);

  // Gaveta 360°
  const [selectedLancamento, setSelectedLancamento] = useState<DrePainelLancamento | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modal de Drilldown dos Cards de KPI
  const [drilldownCard, setDrilldownCard] = useState<DrilldownCardType | null>(null);

  // Exibição dos Gráficos Laterais no Desktop
  const [showLateralCharts, setShowLateralCharts] = useState(true);

  // Filtros
  const [filters, setFilters] = useState<DrePainelFilters>({
    regime: 'COMPETENCIA',
    empresas: [],
    periodos: [],
    contasDre: [],
    departamentos: [],
    projetos: [],
    categorias: [],
    fornecedores: [],
    contasCorrentes: [],
    ano: 'TODOS',
    filtroParcelamento: 'TODOS',
    filtroStatusVencimento: 'TODOS',
    filtroRecorrencia: 'TODOS',
    search: ''
  });

  // Atualizar filters.regime quando regime muda
  useEffect(() => {
    setFilters(prev => ({ ...prev, regime }));
  }, [regime]);

  // Carregar dados
  const loadData = useCallback(async (currentRegime: RegimeTipo) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { lancamentos, error } = await DrePainelService.fetchLancamentos(currentRegime);
      if (error) {
        setErrorMsg(error);
      } else {
        setAllLancamentos(lancamentos);
        const now = new Date();
        setLastUpdate(
          now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar dados do painel');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(regime);
  }, [regime, loadData]);

  // Opções dinâmicas para filtros
  const options = useMemo(() => {
    const empresasSet = new Set<string>();
    const periodosMap = new Map<string, number>();
    const contasDreSet = new Set<string>();
    const deptosSet = new Set<string>();
    const projetosSet = new Set<string>();
    const categoriasSet = new Set<string>();
    const fornecedoresSet = new Set<string>();
    const contasCorrentesSet = new Set<string>();
    let atrasadosCount = 0;

    allLancamentos.forEach(l => {
      if (l.empresa) empresasSet.add(l.empresa);
      if (l.periodo && l.periodo !== 'N/A') {
        periodosMap.set(l.periodo, l.periodoNum);
      }
      if (l.conta_dre) contasDreSet.add(l.conta_dre);
      if (l.departamento) deptosSet.add(l.departamento);
      if (l.rateios) {
        l.rateios.forEach(r => deptosSet.add(r.departamento));
      }
      if (l.projeto) projetosSet.add(l.projeto);
      if (l.categoria) categoriasSet.add(l.categoria);
      if (l.fornecedor_cliente) fornecedoresSet.add(l.fornecedor_cliente);
      if (l.conta_corrente) contasCorrentesSet.add(l.conta_corrente);
      if (l.is_em_atraso) atrasadosCount++;
    });

    const periodosSorted = Array.from(periodosMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([p]) => p);

    return {
      empresas: Array.from(empresasSet).sort(),
      periodos: periodosSorted,
      contasDre: Array.from(contasDreSet).sort(),
      departamentos: Array.from(deptosSet).sort(),
      projetos: Array.from(projetosSet).sort(),
      categorias: Array.from(categoriasSet).sort(),
      fornecedores: Array.from(fornecedoresSet).sort(),
      contasCorrentes: Array.from(contasCorrentesSet).sort(),
      atrasadosCount
    };
  }, [allLancamentos]);

  // Lançamentos filtrados
  const filteredLancamentos = useMemo(() => {
    return DrePainelService.filterLancamentos(allLancamentos, filters);
  }, [allLancamentos, filters]);

  // KPIs
  const kpis = useMemo(() => {
    return DrePainelService.calculateKpis(filteredLancamentos);
  }, [filteredLancamentos]);

  // Períodos ativos para colunas da tabela
  const activePeriods = useMemo(() => {
    if (filters.periodos.length > 0) {
      return options.periodos.filter(p => filters.periodos.includes(p));
    }
    // Se o subfiltro de ano estiver ativo, mostrar todos os meses daquele ano
    if (filters.ano && filters.ano !== 'TODOS') {
      const shortYear = filters.ano.slice(-2);
      return options.periodos.filter(p => p.endsWith(`/${shortYear}`));
    }
    // Por padrão mostrar os últimos 12 meses disponíveis
    return options.periodos.slice(-12);
  }, [filters.periodos, filters.ano, options.periodos]);

  // Seções da Tabela DRE
  const tableSections = useMemo(() => {
    return DrePainelService.buildTableSections(filteredLancamentos, activePeriods);
  }, [filteredLancamentos, activePeriods]);

  const handleSelectLancamento = (l: DrePainelLancamento) => {
    setSelectedLancamento(l);
    setIsDrawerOpen(true);
  };

  const handleFilterConta = (conta: string) => {
    setFilters(prev => ({
      ...prev,
      contasDre: prev.contasDre.includes(conta) ? [] : [conta]
    }));
  };

  const handleFilterDepto = (depto: string) => {
    setFilters(prev => ({
      ...prev,
      departamentos: prev.departamentos.includes(depto) ? [] : [depto]
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* 1. Header Fixo com Botão "Voltar ao Início" */}
      <DrePainelHeader
        regime={regime}
        onRefresh={() => loadData(regime)}
        isLoading={isLoading}
        lastUpdate={lastUpdate}
        isMeetingMode={isMeetingMode}
        onToggleMeetingMode={() => setIsMeetingMode(!isMeetingMode)}
        totalLancamentos={filteredLancamentos.length}
      />

      <main className="max-w-[1600px] mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-4">
        {/* 2. Seletor Triplo de Regime (Competência, Caixa, Previsão) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <DrePainelRegimeSelector
            currentRegime={regime}
            onSelectRegime={setRegime}
            isLoading={isLoading}
          />

          {/* Toggle de Gráficos Laterais para Desktop */}
          <div className="hidden xl:flex items-center gap-2">
            <button
              onClick={() => setShowLateralCharts(!showLateralCharts)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer ${
                showLateralCharts
                  ? 'bg-white text-emerald-900 border-emerald-300 ring-1 ring-emerald-400/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {showLateralCharts ? (
                <>
                  <PanelRightClose size={14} className="text-emerald-600" />
                  <span>Ocultar Painel Lateral</span>
                </>
              ) : (
                <>
                  <PanelRightOpen size={14} className="text-slate-500" />
                  <span>Exibir Gráficos Laterais</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mensagem de Erro (se houver) */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3. Cards de KPIs Executivos com Ação de Drilldown */}
        <DrePainelKpisCards
          kpis={kpis}
          regime={regime}
          isMeetingMode={isMeetingMode}
          onCardClick={(type) => setDrilldownCard(type)}
        />

        {/* 4. Barra de Filtros Minimalista & Granular com Subfiltro de Ano */}
        <DrePainelFiltersBar
          filters={filters}
          onFilterChange={setFilters}
          empresaOptions={options.empresas}
          periodoOptions={options.periodos}
          contaDreOptions={options.contasDre}
          deptoOptions={options.departamentos}
          projetoOptions={options.projetos}
          categoriaOptions={options.categorias}
          fornecedorOptions={options.fornecedores}
          contaCorrenteOptions={options.contasCorrentes}
          totalAtrasadosCount={options.atrasadosCount}
        />

        {/* 5. Área de Conteúdo: Tabela DRE + Gráficos Laterais em Desktop */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
            <Loader2 size={32} className="mx-auto text-emerald-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-800">Carregando dados do painel...</p>
            <p className="text-xs text-slate-400 mt-1">
              Processando registros do Omie e base histórica calibrada
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Coluna Principal da Tabela Tree */}
            <div className={showLateralCharts ? 'xl:col-span-8 2xl:col-span-9' : 'xl:col-span-12'}>
              <DrePainelTable
                sections={tableSections}
                periodos={activePeriods}
                isMeetingMode={isMeetingMode}
                onSelectLancamento={handleSelectLancamento}
              />
            </div>

            {/* Coluna Lateral de Gráficos Analíticos no Desktop */}
            {showLateralCharts && (
              <div className="xl:col-span-4 2xl:col-span-3">
                <DrePainelLateralCharts
                  lancamentos={filteredLancamentos}
                  sections={tableSections}
                  periodos={activePeriods}
                  isMeetingMode={isMeetingMode}
                  onFilterConta={handleFilterConta}
                  onFilterDepto={handleFilterDepto}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* 6. Gaveta 360° de Detalhes do Lançamento Individual */}
      <DrePainelDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        lancamento={selectedLancamento}
        isMeetingMode={isMeetingMode}
      />

      {/* 7. Modal de Drilldown Analítico dos Cards de KPI */}
      {drilldownCard && (
        <DrePainelKpiDrilldownModal
          isOpen={drilldownCard !== null}
          onClose={() => setDrilldownCard(null)}
          cardType={drilldownCard}
          lancamentos={filteredLancamentos}
          regime={regime}
          onSelectLancamento={(l) => {
            setSelectedLancamento(l);
            setIsDrawerOpen(true);
          }}
        />
      )}
    </div>
  );
}
