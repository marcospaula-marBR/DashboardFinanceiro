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
import { Loader2, AlertCircle } from 'lucide-react';

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
    // Por padrão mostrar os últimos 12 meses disponíveis
    return options.periodos.slice(-12);
  }, [filters.periodos, options.periodos]);

  // Seções da Tabela DRE
  const tableSections = useMemo(() => {
    return DrePainelService.buildTableSections(filteredLancamentos, activePeriods);
  }, [filteredLancamentos, activePeriods]);

  const handleSelectLancamento = (l: DrePainelLancamento) => {
    setSelectedLancamento(l);
    setIsDrawerOpen(true);
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

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-4">
        {/* 2. Seletor Triplo de Regime (Competência, Caixa, Previsão) */}
        <DrePainelRegimeSelector
          currentRegime={regime}
          onSelectRegime={setRegime}
          isLoading={isLoading}
        />

        {/* Mensagem de Erro (se houver) */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3. Cards de KPIs Executivos */}
        <DrePainelKpisCards
          kpis={kpis}
          regime={regime}
          isMeetingMode={isMeetingMode}
        />

        {/* 4. Barra de Filtros Minimalista & Granular */}
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

        {/* 5. Tabela DRE Tree Multivisão */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
            <Loader2 size={32} className="mx-auto text-emerald-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-800">Carregando dados do painel...</p>
            <p className="text-xs text-slate-400 mt-1">
              Processando registros do Omie e base histórica congelada
            </p>
          </div>
        ) : (
          <DrePainelTable
            sections={tableSections}
            periodos={activePeriods}
            isMeetingMode={isMeetingMode}
            onSelectLancamento={handleSelectLancamento}
          />
        )}
      </main>

      {/* 6. Gaveta 360° de Detalhes do Lançamento */}
      <DrePainelDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        lancamento={selectedLancamento}
        isMeetingMode={isMeetingMode}
      />
    </div>
  );
}
