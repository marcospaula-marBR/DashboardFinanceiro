"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { DreSidebar } from '@/components/dre/DreSidebar';
import { DreHeader } from '@/components/dre/DreHeader';
import { DreKpiCards } from '@/components/dre/DreKpiCards';
import { DreCharts } from '@/components/dre/DreCharts';
import { DreTable } from '@/components/dre/DreTable';
import { DreDetailsModal } from '@/components/dre/DreDetailsModal';
import { SmartAlerts } from '@/components/dre/SmartAlerts';
import { DreSimulator } from '@/components/dre/DreSimulator';
import { DreEquipmentsModal } from '@/components/dre/DreEquipmentsModal';
import { DreService, DEFAULT_DRE_ESTRUTURA } from '@/services/dre.service';
import { DreAlertsService } from '@/services/dre-alerts.service';
import { ExportPdfService } from '@/services/exportPdf.service';
import { BrisinhaiService } from '@/services/brisinhai.service';
import { supabase } from '@/lib/supabase';
import { DreFilters, DreMetadata, DreCalculatedResult, DreRow, DreSimulationParams, DreStructureItem, DreTemplateDefinition } from '@/types/dre';
import { DreExportModal, ExportSelections } from '@/components/dre/DreExportModal';
import { DrePrintCharts } from '@/components/dre/DrePrintCharts';
import { TableIcon, ChevronDown, ChevronUp, Lock, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export default function DrePage() {
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  
  // Security Passcode Shield
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalData, setModalData] = useState<Record<string, number>>({});
  const [modalSourceRows, setModalSourceRows] = useState<Record<string, DreRow[]>>({});

  // Simulator state
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [equipamentoCounts, setEquipamentoCounts] = useState<Record<string, number>>({});
  const [isEquipmentsModalOpen, setIsEquipmentsModalOpen] = useState(false);
  const [simParams, setSimParams] = useState<DreSimulationParams>({
    revenueMultiplier: 1.0,
    costsMultiplier: 1.0,
    expensesMultiplier: 1.0
  });

  const [rawData, setRawData] = useState<DreRow[]>([]);
  const [metadata, setMetadata] = useState<DreMetadata | null>(null);
  const [estrutura, setEstrutura] = useState<DreStructureItem[] | null>(DEFAULT_DRE_ESTRUTURA);
  const [filters, setFilters] = useState<DreFilters>({
    empresas: [],
    periodos: [],
    departamentos: [],
    contasDre: [],
    projetos: [],
    categorias: []
  });

  // 1. Verificação de Sessão (Password Screen Gate)
  useEffect(() => {
    const isAuth = sessionStorage.getItem('marbrasil_dre_auth') === 'true';
    setIsAuthenticated(isAuth);
  }, []);

  // 2. Tenta carregar do Supabase automaticamente ao abrir se autenticado
  useEffect(() => {
    if (isAuthenticated === true) {
      loadLatestSnapshotFromDb();
      loadEquipamentoCounts();
    }
  }, [isAuthenticated]);

  // 3. Tenta carregar template customizado
  useEffect(() => {
    fetch('/templates/dre-padrao.json')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((data: DreTemplateDefinition) => {
        setEstrutura(data.estrutura);
      })
      .catch(err => console.warn("Template remoto indisponível, usando padrão embutido:", err));
  }, []);

  // Função para carregar do banco de dados remoto
  const loadLatestSnapshotFromDb = async () => {
    setIsUploading(true);
    try {
      const { data, error } = await supabase
        .from('dre_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const snapshot = data[0];
        setRawData(snapshot.raw_data);
        setMetadata(snapshot.metadata);
        setFileName(snapshot.filename || 'Banco de Dados Nuvem');
        
        const timestamp = new Date(snapshot.created_at);
        setLastUpdate(timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString());
      }
    } catch (err: any) {
      console.warn("Erro ao buscar dados remotos:", err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const loadEquipamentoCounts = async () => {
    const local = localStorage.getItem('marbrasil_dre_equipamento_counts');
    if (local) {
      try {
        setEquipamentoCounts(JSON.parse(local));
      } catch (e) {
        console.warn("LocalStorage parse error:", e);
      }
    }

    try {
      const { data, error } = await supabase
        .from('dre_equipamento_counts')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        const dbCounts: Record<string, number> = {};
        data.forEach((row: any) => {
          dbCounts[row.periodo] = row.quantidade;
        });
        setEquipamentoCounts(dbCounts);
        localStorage.setItem('marbrasil_dre_equipamento_counts', JSON.stringify(dbCounts));
      }
    } catch (err: any) {
      console.warn("Tabela 'dre_equipamento_counts' nao encontrada ou inacessivel. Usando armazenamento local.", err.message);
    }
  };

  const handleSaveEquipamentoCounts = async (newCounts: Record<string, number>) => {
    setEquipamentoCounts(newCounts);
    localStorage.setItem('marbrasil_dre_equipamento_counts', JSON.stringify(newCounts));

    try {
      const upsertData = Object.entries(newCounts).map(([periodo, quantidade]) => ({
        periodo,
        quantidade
      }));

      const { error } = await supabase
        .from('dre_equipamento_counts')
        .upsert(upsertData, { onConflict: 'periodo' });

      if (error) throw error;
      alert("Quantidade de equipamentos salva com sucesso na nuvem!");
    } catch (err: any) {
      console.warn("Erro ao salvar no Supabase (mantido no armazenamento local):", err.message);
      alert("Quantidade salva com sucesso no navegador! Nota: Salvar na nuvem indisponivel temporariamente.");
    }
  };

  // Enviar a DRE para o Supabase (Cloud Sync)
  const handlePublishSnapshot = async () => {
    if (rawData.length === 0 || !metadata) return;
    setIsPublishing(true);
    try {
      const { error } = await supabase
        .from('dre_snapshots')
        .insert({
          filename: fileName || 'Upload Manual',
          raw_data: rawData,
          metadata: metadata
        });

      if (error) throw error;
      
      const newTimestamp = new Date();
      setLastUpdate(newTimestamp.toLocaleDateString() + ' ' + newTimestamp.toLocaleTimeString());
      alert("Snapshot DRE publicado no Supabase com sucesso! A partir de agora, ao carregar a página ela será carregada automaticamente com essa base.");
    } catch (err: any) {
      alert("Falha ao salvar dados no Supabase: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      setFileName(file.name);

      // Layer 1: Parse
      const parsed = await DreService.parseCSV(file);

      // Layer 2: Normalize
      const { data, metadata: newMetadata } = DreService.normalizeData(parsed);

      if (data.length === 0) {
        alert("Nenhuma linha válida encontrada no CSV.");
        return;
      }

      setRawData(data);
      setMetadata(newMetadata);

      // Reset filters when a new file is uploaded
      setFilters({
        empresas: [],
        periodos: [],
        departamentos: [],
        contasDre: [],
        projetos: [],
        categorias: []
      });

      setLastUpdate(new Date().toLocaleTimeString() + ' (Local)');
    } catch (error: any) {
      alert("Erro ao processar arquivo: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFilterChange = useCallback((newFilters: DreFilters) => {
    setFilters(newFilters);
  }, []);

  // Base Calculation (No Simulation)
  const originalResults: DreCalculatedResult | null = useMemo(() => {
    if (rawData.length === 0 || !metadata || !estrutura) return null;
    return DreService.calculate(rawData, metadata, estrutura, filters, undefined, equipamentoCounts);
  }, [rawData, metadata, estrutura, filters, equipamentoCounts]);

  // Simulated Calculation
  const results: DreCalculatedResult | null = useMemo(() => {
    if (!originalResults || !estrutura) return null;
    if (simParams.revenueMultiplier === 1 && simParams.costsMultiplier === 1 && simParams.expensesMultiplier === 1) {
      return originalResults;
    }
    return DreService.calculate(rawData, metadata!, estrutura, filters, simParams, equipamentoCounts);
  }, [rawData, metadata, estrutura, filters, simParams, originalResults, equipamentoCounts]);

  // Alertas Inteligentes
  const alerts = useMemo(() => {
    if (!results) return [];
    return DreAlertsService.generateAlerts(results);
  }, [results]);

  // Expor resultados e contexto para a BrisinhAI globalmente
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Dados brutos para fallback
    (window as any).DRE_RESULTS = results;

    // Contexto rico lido diretamente do estado React — evita depender de IDs no DOM
    (window as any).getPageContext = () => {
      const empresa =
        filters.empresas.length === 0
          ? 'Todas'
          : filters.empresas.join(', ');
      const periodo =
        filters.periodos.length === 0
          ? 'Todos'
          : filters.periodos.join(', ');

      const indicadores: { indicador: string; valor: string; detalhe: string }[] = [];

      if (results?.kpis) {
        const fmt = (n: number) =>
          n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

        indicadores.push(
          { indicador: 'Receita Operacional', valor: fmt(results.kpis.receitaOperacional ?? 0), detalhe: '' },
          { indicador: 'Total de Entradas', valor: fmt(results.kpis.totalEntradas ?? 0), detalhe: '' },
          { indicador: 'Total de Saídas', valor: fmt(results.kpis.totalSaidas ?? 0), detalhe: `Custos: ${fmt(results.kpis.totalCustos ?? 0)} | Despesas: ${fmt(results.kpis.totalDespesas ?? 0)}` },
          { indicador: 'Resultado (Lucro/Prejuízo)', valor: fmt(results.kpis.resultado ?? 0), detalhe: `Margem: ${(results.kpis.percLucro ?? 0).toFixed(1)}%` },
          { indicador: 'FCL (Fluxo de Caixa Livre)', valor: fmt(results.kpis.fcl ?? 0), detalhe: `${(results.kpis.percFcl ?? 0).toFixed(1)}% da receita` },
          { indicador: 'Total Impostos', valor: fmt(results.kpis.totalImpostos ?? 0), detalhe: '' },
          { indicador: 'Investimentos', valor: fmt(results.kpis.totalInvestimentos ?? 0), detalhe: '' },
        );
      }

      // Resumo da tabela DRE (totais por linha)
      const resumoDre: Record<string, string> = {};
      if (results?.totais) {
        const fmt = (n: number) =>
          n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
        Object.entries(results.totais).forEach(([titulo, valor]) => {
          resumoDre[titulo] = fmt(valor as number);
        });
      }

      return {
        pageType: 'DRE',
        url: window.location.pathname,
        filtros: { empresa, periodo },
        indicadores,
        resumo: { dre: resumoDre },
        dataSummary: results
          ? `DRE calculado com ${(results as any).sourceRowCount ?? '?'} lançamentos. Empresa: ${empresa}. Período: ${periodo}.`
          : 'Nenhum dado carregado ainda.',
        // Dados estruturados completos (sem sourceRows para manter payload leve)
        dreSummary: results
          ? {
              totais: results.totais,
              mensal: results.mensal,
              kpis: results.kpis,
              validColumns: results.validColumns,
            }
          : null,
      };
    };
  }, [results, filters]);


  const handleOpenExportModal = () => {
    setIsExportModalOpen(true);
  };

  const handleConfirmExport = async (selections: ExportSelections) => {
    setIsExportingPdf(true);

    let aiText: string | undefined;

    const empresa = filters.empresas.length === 1 ? filters.empresas[0] : (filters.empresas.length > 1 ? "Varias" : "Global");
    const periodo = filters.periodos.length > 0 ? `${filters.periodos[0]}...` : "Completo";

    // Se marcou IA, gerar análise
    if (selections.includeAiAnalysis && results) {
      setIsAiAnalyzing(true);
      try {
        aiText = await BrisinhaiService.analyzeDre(results, empresa, periodo);
      } catch (err) {
        console.error("Erro na IA:", err);
      } finally {
        setIsAiAnalyzing(false);
      }
    }

    try {
      // Chamada para o NOVO gerador nativo
      await ExportPdfService.buildNativePdf(results!, selections, empresa, periodo, aiText);
      setIsExportModalOpen(false);
    } catch (error: any) {
      alert("Falha ao gerar o PDF. Erro: " + (error?.message || String(error)));
      console.error(error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenDetails = (title: string) => {
    if (!results) return;
    const itemData = results.mensal[title] || {};
    const itemSource = results.sourceRows?.[title] || {};
    setModalTitle(title);
    setModalData(itemData);
    setModalSourceRows(itemSource);
    setIsModalOpen(true);
  };

  // Validação de senha
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === "marbrasildre2026") {
      sessionStorage.setItem('marbrasil_dre_auth', 'true');
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
      setPasscode("");
    }
  };

  // Loading Session State
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
      </div>
    );
  }

  // Password Shield UI
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 select-none relative overflow-hidden">
        {/* Background ambient lighting (No purple gradient - Orange/Amber Theme) */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-550/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-none p-8 md:p-10 shadow-2xl relative z-10">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-500 mb-6 rounded-none">
              <Lock size={28} />
            </div>
            
            <h1 className="text-xl font-black text-white tracking-tight mb-2">Painel DRE Mar Brasil</h1>
            <p className="text-xs text-slate-400 font-medium mb-8 max-w-xs">
              Acesso restrito para conselho e diretoria executiva. Digite o código de acesso para prosseguir.
            </p>

            <form onSubmit={handleAuthSubmit} className="w-full space-y-4">
              <div>
                <input 
                  type="password"
                  placeholder="Código de Acesso"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className={`w-full bg-slate-950 border text-center text-lg tracking-[0.2em] font-semibold text-white px-4 py-3 rounded-none focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all ${
                    authError ? 'border-red-500/50 animate-shake' : 'border-slate-800'
                  }`}
                  autoFocus
                />
                {authError && (
                  <p className="text-[11px] text-red-400 font-semibold mt-2">Código inválido. Tente novamente.</p>
                )}
              </div>

              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-4 rounded-none transition-all duration-200 flex items-center justify-center gap-2 active:scale-98 shadow-lg shadow-orange-500/10"
              >
                <span>Acessar Dashboard</span>
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Fixa */}
      <DreSidebar
        metadata={metadata}
        rawData={rawData}
        filters={filters}
        onFilterChange={handleFilterChange}
        onFileUpload={handleFileUpload}
        isUploading={isUploading}
        fileName={fileName}
      />

      {/* Conteúdo Principal + Painel Direito */}
      <div className="flex-1 flex overflow-hidden">

        {/* Coluna Central: Dashboard */}
        <div id="dre-dashboard-content" className={`flex-1 overflow-y-auto p-6 md:p-8 transition-all duration-300 ${isExportingPdf ? 'opacity-50' : ''}`}>
          <div className="max-w-7xl mx-auto">
            <DreHeader
              lastUpdate={lastUpdate}
              onExportPDF={handleOpenExportModal}
              onTogglePrivacy={() => setIsPrivacyMode(!isPrivacyMode)}
              isPrivacyMode={isPrivacyMode}
              onToggleSimulator={() => setIsSimulatorOpen(!isSimulatorOpen)}
              onOpenEquipmentsManager={() => setIsEquipmentsModalOpen(true)}
              hasData={rawData.length > 0}
              isPublishing={isPublishing}
              onPublish={handlePublishSnapshot}
            />

            <div className="space-y-8 mt-8">
              {/* Alertas Inteligentes */}
              <SmartAlerts alerts={alerts} />

              {/* Leitura Rápida */}
              <DreKpiCards
                results={results}
                isPrivacyMode={isPrivacyMode}
                onCardClick={handleOpenDetails}
              />

              {/* Análise Visual (Gráficos) */}
              {results && (
                <DreCharts
                  results={results}
                  isPrivacyMode={isPrivacyMode}
                />
              )}

              {/* Tabela de Operação - Oculta por padrão */}
              {results && (
                <div>
                  <button
                    onClick={() => setShowTable(!showTable)}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 text-slate-700 font-semibold">
                      <TableIcon size={16} className="text-amber-500" />
                      Detalhamento Completo (Tabela DRE)
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                      {showTable ? <><ChevronUp size={15} /> Ocultar</> : <><ChevronDown size={15} /> Exibir</>}
                    </div>
                  </button>
                  <div className={`transition-all duration-500 ease-in-out overflow-hidden ${showTable ? 'max-h-[9999px] opacity-100 mt-4' : 'max-h-0 opacity-0'
                    }`}>
                    <DreTable
                      results={results}
                      isPrivacyMode={isPrivacyMode}
                      onRowClick={handleOpenDetails}
                    />
                  </div>
                </div>
              )}

              {!results && !isUploading && (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[400px]">
                  <p className="text-slate-500 font-medium mb-2">Aguardando dados</p>
                  <p className="text-sm text-slate-450">Envie um arquivo CSV pelo menu lateral ou aguarde o sincronismo com a nuvem.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Simulador (Side Panel Persistente) */}
        {isSimulatorOpen && (
          <div className="w-full md:w-[450px] flex-shrink-0 border-l border-slate-200 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.03)] h-screen overflow-hidden animate-in slide-in-from-right duration-300 z-40">
            <DreSimulator
              isOpen={isSimulatorOpen}
              onClose={() => setIsSimulatorOpen(false)}
              params={simParams}
              onChange={setSimParams}
              onReset={() => setSimParams({ revenueMultiplier: 1, costsMultiplier: 1, expensesMultiplier: 1 })}
              originalResults={originalResults}
              simulatedFcl={results?.kpis.fcl || 0}
              empresaContext={filters.empresas.length === 1 ? filters.empresas[0] : (filters.empresas.length > 1 ? "Múltiplas" : "Todas as Empresas")}
            />
          </div>
        )}
      </div>

      <DreDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        mensalData={modalData}
        sourceRows={modalSourceRows}
        isPrivacyMode={isPrivacyMode}
      />

      <DreExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleConfirmExport}
        isExporting={isExportingPdf}
        isAiAnalyzing={isAiAnalyzing}
      />

      <DreEquipmentsModal
        isOpen={isEquipmentsModalOpen}
        onClose={() => setIsEquipmentsModalOpen(false)}
        validColumns={results?.validColumns || []}
        initialCounts={equipamentoCounts}
        onSave={handleSaveEquipamentoCounts}
      />

      {/* Off-screen renderer for high-quality PDF charts */}
      {results && (
        <DrePrintCharts
          results={results}
          selections={{
            includeEvolution: true,
            includeWaterfall: true,
            includeDonut: true,
            includeAiAnalysis: false,
            includeKpis: false,
            includeTable: false
          }}
        />
      )}
    </main>
  );
}
