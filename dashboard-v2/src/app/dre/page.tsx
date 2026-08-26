"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { DreSidebar } from '@/components/dre/DreSidebar';
import { DreHeader } from '@/components/dre/DreHeader';
import { DreKpiCards } from '@/components/dre/DreKpiCards';
import { DreCharts } from '@/components/dre/DreCharts';
import { DreTable } from '@/components/dre/DreTable';
import { DreDetailsModal } from '@/components/dre/DreDetailsModal';
import { SmartAlerts } from '@/components/dre/SmartAlerts';
import { DreSimulatorV2 } from '@/components/dre/DreSimulatorV2';
import { DreEquipmentsModal } from '@/components/dre/DreEquipmentsModal';
import { DreManualEntryModal } from '@/components/dre/DreManualEntryModal';
import { DreIndicatorsModal } from '@/components/dre/DreIndicatorsModal';
import { DreReportBuilderModal } from '@/components/dre/DreReportBuilderModal';
import { DreLancamentosService } from '@/services/dre-lancamentos.service';
import { DreService, DEFAULT_DRE_ESTRUTURA, normalizeEmpresa } from '@/services/dre.service';
import { DreAlertsService } from '@/services/dre-alerts.service';
import { ExportPdfService } from '@/services/exportPdf.service';
import { supabase } from '@/lib/supabase';
import { DreFilters, DreMetadata, DreCalculatedResult, DreRow, DreSimulationParams, DreStructureItem, DreTemplateDefinition } from '@/types/dre';
import { Scenario, ScenarioAssumption } from '@/types/dre-simulator.types';
import { DreSimulatorEngine } from '@/services/dre-simulator.engine';
import { DreExportModal, ExportSelections } from '@/components/dre/DreExportModal';
import { DrePrintCharts } from '@/components/dre/DrePrintCharts';
import { DreCustomCardModal } from '@/components/dre/DreCustomCardModal';
import { TableIcon, ChevronDown, ChevronUp, Lock, ArrowRight, Loader2, Sparkles, Filter, ChevronLeft, ClipboardEdit } from 'lucide-react';

function parseMonthValue(str: string): { original: string; val: number } {
  const monthsMap: Record<string, number> = {
    jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
    jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12
  };
  const parts = str.trim().split(/[\/-]/);
  if (parts.length !== 2) return { original: str, val: NaN };

  let m = 0;
  const p0 = parts[0].toLowerCase();
  if (monthsMap[p0] !== undefined) {
    m = monthsMap[p0];
  } else {
    m = parseInt(p0, 10);
  }

  let y = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return { original: str, val: NaN };
  if (y < 100) y += 2000;

  return { original: str, val: y * 12 + m };
}

function formatPeriodoInteligente(selectedPeriodos: string[], validColumns: string[]): string {
  const list = selectedPeriodos && selectedPeriodos.length > 0 ? selectedPeriodos : validColumns;
  if (!list || list.length === 0) return 'Período Completo';

  if (list.length === 1) {
    return list[0];
  }

  const parsed = list.map(parseMonthValue);
  if (parsed.some(p => isNaN(p.val))) {
    return list.join(', ');
  }

  parsed.sort((a, b) => a.val - b.val);

  let isSequential = true;
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].val !== parsed[i - 1].val + 1) {
      isSequential = false;
      break;
    }
  }

  if (isSequential) {
    return `${parsed[0].original} até ${parsed[parsed.length - 1].original}`;
  } else {
    return parsed.map(p => p.original).join(', ');
  }
}

export default function DrePage() {
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isRevenuePrivacyMode, setIsRevenuePrivacyMode] = useState(false);
  
  // Security Passcode Shield
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [gammaResultUrl, setGammaResultUrl] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalData, setModalData] = useState<Record<string, number>>({});
  const [modalSourceRows, setModalSourceRows] = useState<Record<string, DreRow[]>>({});

  // Simulator state
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [equipamentoCounts, setEquipamentoCounts] = useState<Record<string, Record<string, number>>>({});
  const [isEquipmentsModalOpen, setIsEquipmentsModalOpen] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [isReportBuilderOpen, setIsReportBuilderOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [simParams, setSimParams] = useState<DreSimulationParams>({
    revenueMultiplier: 1.0,
    costsMultiplier: 1.0,
    expensesMultiplier: 1.0,
    taxesMultiplier: 1.0,
    investmentsMultiplier: 1.0
  });
  const [customCardCategories, setCustomCardCategories] = useState<string[]>([]);
  const [isCustomCardModalOpen, setIsCustomCardModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [rawData, setRawData] = useState<DreRow[]>([]);
  const [metadata, setMetadata] = useState<DreMetadata | null>(null);
  const [estrutura, setEstrutura] = useState<DreStructureItem[] | null>(DEFAULT_DRE_ESTRUTURA);
  const [filters, setFilters] = useState<DreFilters>({
    empresas: [],
    periodos: [],
    departamentos: [],
    contasDre: [],
    projetos: [],
    categorias: [],
    fornecedores: [],
    contasCorrentes: [],
    excludeSharedExpenses: false
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

  // 4. Sincroniza dados filtrados e filtros no localStorage para que a página estática de Indicadores os utilize
  useEffect(() => {
    if (typeof window !== 'undefined' && rawData.length > 0) {
      // Pré-filtra as linhas de acordo com os filtros ativos na tela da DRE
      let filteredRows = rawData;
      if (filters.empresas && filters.empresas.length > 0) {
        filteredRows = filteredRows.filter(row => filters.empresas.includes(row.Empresa));
      }
      if (filters.departamentos && filters.departamentos.length > 0) {
        filteredRows = filteredRows.filter(row => filters.departamentos.includes(row.Departamento));
      }
      if (filters.contasDre && filters.contasDre.length > 0) {
        filteredRows = filteredRows.filter(row => filters.contasDre.includes(row.ContaDRE));
      }
      if (filters.projetos && filters.projetos.length > 0) {
        filteredRows = filteredRows.filter(row => filters.projetos.includes(row.Projeto));
      }
      if (filters.categorias && filters.categorias.length > 0) {
        filteredRows = filteredRows.filter(row => filters.categorias.includes(row.Categoria));
      }

      localStorage.setItem('dre_raw_data', JSON.stringify(filteredRows));
      localStorage.setItem('dre_filters', JSON.stringify(filters));
    }
  }, [rawData, filters]);

  const loadFallbackSnapshot = async () => {
    try {
      const { data, error } = await supabase
        .from('dre_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const snapshot = data[0];
        setRawData(snapshot.raw_data);
        setMetadata(snapshot.metadata);
        setFileName(snapshot.filename || 'Banco de Dados Nuvem (Legacy Snapshot)');
        
        const timestamp = new Date(snapshot.created_at);
        setLastUpdate(timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString());
      }
    } catch (err: any) {
      console.warn("Erro no fallback de snapshots:", err.message);
    }
  };

  // Função para carregar do banco de dados remoto (nova tabela dre_lancamentos)
  const loadLatestSnapshotFromDb = async () => {
    setIsUploading(true);
    // Resetar cenário simulado ao recarregar dados — evita que premissas antigas
    // do simulador sejam aplicadas sobre novos dados, causando valores duplicados.
    setActiveScenario(null);
    try {
      const { rows, error } = await DreLancamentosService.fetchAllForDashboard();

      if (error) {
        throw new Error(error);
      }

      if (rows && rows.length > 0) {
        setRawData(rows);
        
        // Gerar metadados de forma dinâmica a partir das colunas e valores atuais
        const generatedMetadata = DreLancamentosService.generateMetadataFromRows(rows);
        setMetadata(generatedMetadata);
        setFileName('Banco de Dados Nuvem (dre_lancamentos)');
        
        const timestamp = new Date();
        setLastUpdate(timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString());
      } else {
        console.warn("Tabela dre_lancamentos vazia. Tentando fallback para dre_snapshots...");
        await loadFallbackSnapshot();
      }
    } catch (err: any) {
      console.warn("Erro ao buscar dados de dre_lancamentos, tentando fallback:", err.message);
      await loadFallbackSnapshot();
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
        const dbCounts: Record<string, Record<string, number>> = {};
        data.forEach((row: any) => {
          if (!dbCounts[row.periodo]) dbCounts[row.periodo] = {};
          dbCounts[row.periodo][row.departamento] = row.quantidade;
        });
        setEquipamentoCounts(dbCounts);
        localStorage.setItem('marbrasil_dre_equipamento_counts', JSON.stringify(dbCounts));
      }
    } catch (err: any) {
      console.warn("Tabela 'dre_equipamento_counts' nao encontrada ou inacessivel. Usando armazenamento local.", err.message);
    }
  };

  const handleSaveEquipamentoCounts = async (newCounts: Record<string, Record<string, number>>) => {
    setEquipamentoCounts(newCounts);
    localStorage.setItem('marbrasil_dre_equipamento_counts', JSON.stringify(newCounts));

    try {
      const upsertData: any[] = [];
      Object.entries(newCounts).forEach(([periodo, depts]) => {
        Object.entries(depts).forEach(([departamento, quantidade]) => {
          upsertData.push({
            periodo,
            departamento,
            quantidade
          });
        });
      });

      const { error } = await supabase
        .from('dre_equipamento_counts')
        .upsert(upsertData, { onConflict: 'periodo,departamento' });

      if (error) throw error;
      alert("Quantidade de equipamentos salva com sucesso na nuvem!");
    } catch (err: any) {
      console.warn("Erro ao salvar no Supabase (mantido no armazenamento local):", err.message);
      alert("Quantidade salva com sucesso no navegador! Nota: Salvar na nuvem indisponivel temporariamente.");
    }
  };

  // Enviar a DRE para o Supabase (Cloud Sync via upsert na tabela dre_lancamentos)
  const handlePublishSnapshot = async () => {
    if (rawData.length === 0 || !metadata) return;
    setIsPublishing(true);
    try {
      const { total, errors } = await DreLancamentosService.upsertOmieRows(rawData);

      if (errors.length > 0) {
        throw new Error(`Erros nos lotes: ${errors.join(', ')}`);
      }

      // Além de salvar na tabela principal dre_lancamentos, também salvamos um snapshot legado em dre_snapshots como backup
      try {
        await supabase
          .from('dre_snapshots')
          .insert({
            filename: fileName || 'Upload Manual',
            raw_data: rawData,
            metadata: metadata
          });
      } catch (errSnap) {
        console.warn("Erro ao salvar backup legado em dre_snapshots:", errSnap);
      }
      
      const newTimestamp = new Date();
      setLastUpdate(newTimestamp.toLocaleDateString() + ' ' + newTimestamp.toLocaleTimeString());
      alert(`Dados da DRE salvos com sucesso! (${total} registros importados/atualizados). A base de dados unificada foi atualizada.`);
      
      // Recarrega os dados unificados (Omie + Manuais) do banco
      await loadLatestSnapshotFromDb();
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
        categorias: [],
        fornecedores: [],
        contasCorrentes: [],
        excludeSharedExpenses: false
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

  const allowedDeptsForEquipments = useMemo(() => {
    return [
      "Santos Sts Seduc 36693/2022 12/2024",
      "São Paulo Cmsp Csp 274/2024 03/2025",
      "São Paulo Cref4 Psp 2325/2025 93/2025",
      "São Paulo Crsn Psp 6018/2025",
      "São Paulo Smartsampa Smsu Psp 6029/2025 055/2025",
      "Bertioga Seduc 3151/2025 135/2025",
      "Bertioga Seduc 378/2024 54/2024",
      "Bertioga Sesap 1390/2024 71/2024"
    ].map(d => {
      return d.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    });
  }, []);

  // Base Calculation (No Simulation)
  const originalResults: DreCalculatedResult | null = useMemo(() => {
    if (rawData.length === 0 || !metadata || !estrutura) return null;
    return DreService.calculate(rawData, metadata, estrutura, filters, undefined, equipamentoCounts);
  }, [rawData, metadata, estrutura, filters, equipamentoCounts]);

  // Simulated Calculation
  const results: DreCalculatedResult | null = useMemo(() => {
    if (!originalResults || !estrutura || !metadata) return null;
    if (!activeScenario || activeScenario.assumptions.length === 0) {
      return originalResults;
    }
    return DreSimulatorEngine.runSimulation(
      rawData,
      metadata,
      estrutura,
      filters,
      activeScenario,
      {} as any,
      equipamentoCounts
    );
  }, [rawData, metadata, estrutura, filters, activeScenario, originalResults, equipamentoCounts]);

  // Alertas Inteligentes
  const alerts = useMemo(() => {
    if (!results) return [];
    return DreAlertsService.generateAlerts(results);
  }, [results]);

  // Categoria Customizada Livre (Soma dinâmica com base nos filtros)
  const customCardTotal = useMemo(() => {
    if (rawData.length === 0 || customCardCategories.length === 0 || !results) return 0;
    
    let df = rawData;
    if (filters.empresas.length > 0) df = df.filter(row => filters.empresas.includes(normalizeEmpresa(row.Empresa)) || filters.empresas.includes(row.Empresa));
    if (filters.departamentos.length > 0) df = df.filter(row => filters.departamentos.includes(row.Departamento));
    if (filters.contasDre.length > 0) df = df.filter(row => filters.contasDre.includes(row.ContaDRE));
    if (filters.projetos.length > 0) df = df.filter(row => filters.projetos.includes(row.Projeto));
    if (filters.categorias.length > 0) df = df.filter(row => filters.categorias.includes(row.Categoria));
    if (filters.fornecedores && filters.fornecedores.length > 0) {
      df = df.filter(row => filters.fornecedores!.includes(row.Fornecedor || 'Sem Fornecedor'));
    }
    if (filters.contasCorrentes && filters.contasCorrentes.length > 0) {
      df = df.filter(row => filters.contasCorrentes!.includes(row.ContaCorrente || 'Sem Conta Corrente'));
    }
    
    // Filtra apenas pelas categorias selecionadas pelo usuário no Card Livre
    df = df.filter(row => customCardCategories.includes(row.Categoria) || customCardCategories.includes(row.ContaDRE));

    let total = 0;
    df.forEach(row => {
      results.validColumns.forEach(col => {
        const val = parseFloat(row[col]?.toString().replace(',', '.') || '0');
        if (!isNaN(val)) {
          total += val;
        }
      });
    });
    return total;
  }, [rawData, customCardCategories, filters, results]);

  const customCardTitle = useMemo(() => {
    if (customCardCategories.length === 0) return "Card Personalizado";
    if (customCardCategories.length === 1) {
      return customCardCategories[0].replace(/^\d+[\d.]*\s*-\s*/, '');
    }
    return `Personalizado (${customCardCategories.length} cats)`;
  }, [customCardCategories]);

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
      const periodo = formatPeriodoInteligente(filters.periodos, results?.validColumns || []);

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

      // Consolidação de dados detalhados (projetos/empresas/categorias) para cada linha do DRE
      const detalhamentoConsolidado: Record<string, { projeto: string; empresa: string; total: number }[]> = {};
      if (results?.sourceRows) {
        Object.entries(results.sourceRows).forEach(([tituloLinha, mesesData]) => {
          const agrupado: Record<string, { projeto: string; empresa: string; total: number }> = {};
          
          Object.entries(mesesData).forEach(([mesNome, rows]) => {
            if (!Array.isArray(rows)) return;
            rows.forEach((r) => {
              const val = parseFloat(r[mesNome]?.toString().replace(',', '.') || '0');
              if (isNaN(val) || val === 0) return;

              const proj = r.Projeto || '-';
              const emp = r.Empresa || '-';
              const cat = r.Categoria || 'Sem Categoria';
              const label = proj !== '-' && proj !== '' ? `${cat} (${proj})` : cat;

              const key = `${label}|${emp}`;
              if (!agrupado[key]) {
                agrupado[key] = { projeto: label, empresa: emp, total: 0 };
              }
              agrupado[key].total += val;
            });
          });

          const itens = Object.values(agrupado)
            .filter(item => Math.abs(item.total) > 0.01)
            .sort((a, b) => b.total - a.total);

          if (itens.length > 0) {
            detalhamentoConsolidado[tituloLinha] = itens;
          }
        });
      }

      return {
        pageType: 'DRE',
        url: window.location.pathname,
        filtros: { empresa, periodo },
        indicadores,
        resumo: { dre: resumoDre },
        detalhamentoConsolidado,
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
              detalhamentoConsolidado,
            }
          : null,
      };
    };
  }, [results, filters]);


  const handleOpenExportModal = () => {
    setGammaResultUrl(null);
    setIsExportModalOpen(true);
  };

  const generateMarkdownReport = async (selections: ExportSelections): Promise<string> => {
    if (!results) throw new Error("Resultados não carregados.");

    const empresa = filters.empresas.length === 1 ? filters.empresas[0] : (filters.empresas.length > 1 ? "Varias" : "Global");
    const periodo = formatPeriodoInteligente(filters.periodos, results.validColumns);

    // Helper functions
    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatPCT = (val: number) => `${(val).toFixed(1).replace('.', ',')}%`;
    const formatDEC = (val: number) => `${val.toFixed(2).replace('.', ',')}x`;
    const getTot = (key: string) => {
      if (results.totais[key] !== undefined) {
        return results.totais[key];
      }
      const cleanKey = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '').replace('ss', 's').replace('ll', 'l');
      const normalizedKey = cleanKey(key);
      for (const tKey of Object.keys(results.totais)) {
        if (cleanKey(tKey) === normalizedKey) {
          return results.totais[tKey] || 0;
        }
      }
      return 0;
    };

    // Cálculos dos Indicadores
    const val_receita_bruta = getTot('Receita Bruta de Vendas');
    const val_receitas_indiretas = getTot('Receitas Indiretas');
    const val_impostos_vendas = getTot('Impostos') || getTot('Impostos sobre a Receita');
    const val_irpj_csll = getTot('Provisão - IRPJ e CSSL Trimestral') || getTot('Provisão IRPJ e CSSL Trimestral');
    
    const receita_liquida = (val_receita_bruta + val_receitas_indiretas) - val_impostos_vendas;
    const RL = receita_liquida !== 0 ? receita_liquida : 1;

    const val_despesas_variaveis = getTot('Despesas Variáveis');
    const val_intermediacao = getTot('Intermediação de Negócios');
    const custos_despesas_variaveis = results.kpis.totalCustos + val_despesas_variaveis + val_intermediacao;

    const lucro_bruto = receita_liquida - results.kpis.totalCustos;

    const val_despesas_financeiras = getTot('Despesas Financeiras');
    const val_dividendos = getTot('Distribuição de Dividendos') + getTot('Dividendos');
    const despesas_operacionais = results.kpis.totalDespesas - val_despesas_financeiras - val_dividendos - val_despesas_variaveis - val_intermediacao;

    const ebit = lucro_bruto - despesas_operacionais;
    const ebitda = ebit;

    const val_receitas_financeiras = getTot('Receitas Financeiras');
    const resultado_financeiro = val_receitas_financeiras - val_despesas_financeiras;

    const val_outras_receitas = getTot('Outras Receitas') + getTot('Honorários') + getTot('Juros e devoluções') + getTot('Recuperação de Despesas Variáveis');
    const lair = ebit + resultado_financeiro + val_outras_receitas;

    const lucro_liquido = lair - val_irpj_csll;
    const margem_contribuicao_valor = receita_liquida - custos_despesas_variaveis;
    const gao = ebit !== 0 ? margem_contribuicao_valor / ebit : 0;
    
    // Indicadores extra de fluxo e operação
    const receitas_totais = val_receita_bruta + val_receitas_indiretas;
    const total_saidas = results.kpis.totalSaidas || (results.kpis.totalCustos + results.kpis.totalDespesas + val_impostos_vendas + val_irpj_csll);
    const gastos_pessoal = getTot('Pessoal');
    const manut_preventiva = getTot('Preventiva');
    const manut_corretiva = getTot('Corretiva');
    
    // --- LÓGICA DO LOGO DINÂMICO MULTIPLO ---
    const getLogoUrl = (nomeEmpresa: string) => {
      const baseUrl = 'https://dashboard-financeiro-mar-brasil.vercel.app/Logos';
      if (nomeEmpresa.includes('Mar Brasil')) return `${baseUrl}/Mar%20BR%20-%20Chap%C3%A9u.png`;
      if (nomeEmpresa.includes('DZM')) return `${baseUrl}/DZM.png`;
      if (nomeEmpresa.includes('Grupo 2') || nomeEmpresa.includes('G2')) return `${baseUrl}/Grupo%202.jpeg`;
      if (nomeEmpresa.includes('Ybox')) return `${baseUrl}/Ybox.png`;
      if (nomeEmpresa.includes('Conectius')) return `${baseUrl}/Conectius.png`;
      if (nomeEmpresa.includes('Solucione')) return `${baseUrl}/Solucione.png`;
      // Fallback
      return `${baseUrl}/Mar-Brasil-sem-fundo-preto.png`;
    };

    let logosHtml = '';
    const empresasParaLogos = (empresa === 'Varias' || empresa === 'Global') ? filters.empresas : [empresa];
    if (empresasParaLogos.length === 0) {
        logosHtml += `<img align="right" src="${getLogoUrl('Global')}" height="80" style="margin-left: 10px;" />\n`;
    } else {
        empresasParaLogos.forEach(emp => {
          const url = getLogoUrl(emp);
          logosHtml += `<img align="right" src="${url}" height="80" style="margin-left: 10px;" />\n`;
        });
    }

    // --- CONSTRUÇÃO DO NOME DO RELATÓRIO ---
    const empresaFormatada = filters.empresas.length > 0 ? filters.empresas.join(', ') : 'Global (Todas as Empresas)';
    const periodoFormatado = formatPeriodoInteligente(filters.periodos, results.validColumns);
    let tituloRelatorio = `Relatório Financeiro: ${empresaFormatada}`;
    if (filters.departamentos.length > 0) {
      tituloRelatorio += ` | Departamentos: ${filters.departamentos.join(', ')}`;
    }

    // --- CONSTRUÇÃO DO RELATÓRIO MARKDOWN ---
    let markdownReport = `${logosHtml}\n`;
    markdownReport += `# ${tituloRelatorio}\n\n`;
    
    markdownReport += `## Filtros Aplicados\n`;
    markdownReport += `- **Empresas:** ${empresaFormatada}\n`;
    markdownReport += `- **Períodos:** ${periodoFormatado}\n`;
    if (filters.projetos.length > 0) markdownReport += `- **Projetos:** ${filters.projetos.join(', ')}\n`;
    if (filters.departamentos.length > 0) markdownReport += `- **Centros de Custo:** ${filters.departamentos.join(', ')}\n`;
    markdownReport += `\n`;

    markdownReport += `## 1. Indicadores Estratégicos Financeiros (KPIs Avançados)\n`;
    markdownReport += `*Nota: Abaixo estão os principais indicadores de performance e risco do negócio, acompanhados de uma breve explicação técnica para facilitar a leitura de não-especialistas.*\n\n`;
    
    markdownReport += `- **1. Margem Bruta:** ${formatPCT((lucro_bruto / RL) * 100)}\n`;
    markdownReport += `  *O quanto sobra da receita após pagar os custos diretos. Valores acima de 35% são bons.*\n`;
    
    markdownReport += `- **2. Margem de Contribuição:** ${formatPCT((margem_contribuicao_valor / RL) * 100)}\n`;
    markdownReport += `  *Lucro antes de pagar as despesas fixas. Indica se a operação principal é saudável. Acima de 25% é bom.*\n`;
    
    markdownReport += `- **3. Margem Operacional:** ${formatPCT((ebit / RL) * 100)}\n`;
    markdownReport += `  *O verdadeiro lucro da operação antes de juros e impostos. Mede a eficiência real. Acima de 15% é bom.*\n`;
    
    markdownReport += `- **4. EBITDA:** ${formatBRL(ebitda)}\n`;
    markdownReport += `  *A geração de caixa operacional do negócio (Lucro antes de juros, impostos, depreciação e amortização).*\n`;
    
    markdownReport += `- **5. Margem EBITDA:** ${formatPCT((ebitda / RL) * 100)}\n`;
    markdownReport += `  *A capacidade da empresa de transformar receita em caixa. Acima de 20% é considerado bom.*\n`;
    
    markdownReport += `- **6. Índice de Custos Operacionais:** ${formatPCT((results.kpis.totalCustos / RL) * 100)}\n`;
    markdownReport += `  *Mostra quanto da receita é consumido pelos custos diretos e de intermediação. Quanto menor, melhor.*\n`;
    
    markdownReport += `- **7. Margem Antes do IR/CSLL:** ${formatPCT((lair / RL) * 100)}\n`;
    markdownReport += `  *Margem de lucro total antes dos tributos corporativos diretos.*\n`;
    
    markdownReport += `- **8. Margem Líquida:** ${formatPCT((lucro_liquido / RL) * 100)}\n`;
    markdownReport += `  *O que de fato "sobra no bolso" da empresa após tudo pago. Acima de 10% é bom.*\n`;
    
    markdownReport += `- **9. Índ. Despesas Operacionais:** ${formatPCT((despesas_operacionais / RL) * 100)}\n`;
    markdownReport += `  *Quanto a estrutura corporativa/fixa consome da receita. O ideal é ficar abaixo de 15%.*\n`;
    
    markdownReport += `- **10. Índice de Despesas Rateadas:** ${formatPCT((results.kpis.totalDespesas / RL) * 100)}\n`;
    markdownReport += `  *Impacto percentual de todos os rateios e custos fixos estruturais sobre a receita líquida do negócio.*\n`;
    markdownReport += `\n`;

    const numMeses = results.validColumns.length || 1;
    const formatAvg = (val: number) => ` *(Média: ${formatBRL(val / numMeses)})*`;

    markdownReport += `## 2. Fluxo de Caixa e Eficiência Operacional\n`;
    markdownReport += `- **Receitas Totais:** ${formatBRL(receitas_totais)}${formatAvg(receitas_totais)}\n`;
    markdownReport += `- **Total Saídas:** ${formatBRL(total_saidas)}${formatAvg(total_saidas)}\n`;
    markdownReport += `- **Fluxo de Caixa Livre (FCL):** ${formatBRL(results.kpis.fcl)} (Margem: ${formatPCT((results.kpis.fcl / RL) * 100)})${formatAvg(results.kpis.fcl)}\n`;
    markdownReport += `- **Gastos com Pessoal:** ${formatBRL(gastos_pessoal)}${formatAvg(gastos_pessoal)}\n`;
    markdownReport += `- **Manutenção Preventiva:** ${formatBRL(manut_preventiva)}${formatAvg(manut_preventiva)}\n`;
    markdownReport += `- **Manutenção Corretiva:** ${formatBRL(manut_corretiva)}${formatAvg(manut_corretiva)}\n`;
    markdownReport += `\n`;

    markdownReport += `## 3. DRE Resumida (Acumulado do Período)\n`;
    markdownReport += `| Categoria | Valor Acumulado |\n`;
    markdownReport += `| :--- | :--- |\n`;
    results.estrutura.forEach(item => {
      if (item.tipo === 'linha' || item.tipo === 'linha_calc') {
        const valorTotal = results.totais[item.titulo] || 0;
        if (valorTotal !== 0) {
          markdownReport += `| ${item.titulo} | ${formatBRL(valorTotal)} |\n`;
        }
      }
    });
    markdownReport += `\n`;

    // Se o usuário solicitou análise do BrisinhAI
    if (selections.includeAiAnalysis) {
      try {
        const aiRes = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empresa,
            periodo,
            kpis: {
              receitaBruta: val_receita_bruta,
              custos: results.kpis.totalCustos,
              despesas: results.kpis.totalDespesas,
              pontoEquilibrio: 0,
              lucroLiquido: lucro_liquido,
              fcl: results.kpis.fcl,
              margemOperacional: (ebit / RL) * 100
            },
            maioresDespesas: []
          })
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.analysis) {
            markdownReport += `## 4. Análise Executiva (Por BrisinhAI)\n`;
            markdownReport += `${aiData.analysis}\n\n`;
          }
        }
      } catch (e) {
        console.error("Erro ao chamar BrisinhAI", e);
      }
    }

    // ── Seções Segregadas por Empresa ──────────────────────────────────────────
    if (selections.includeSegregated && metadata && estrutura) {
      // Quando nenhuma empresa está no filtro = todas estão ativas
      const empresasParaSegregacao = filters.empresas.length > 0
        ? filters.empresas
        : (metadata.empresas ?? []);

      if (empresasParaSegregacao.length > 1) {
        for (const empresaSeg of empresasParaSegregacao) {
        const filtrosSeg = { ...filters, empresas: [empresaSeg] };
        const resultsSeg = DreService.calculate(rawData, metadata, estrutura, filtrosSeg, undefined, equipamentoCounts);

        const getTotSeg = (key: string) => resultsSeg.totais[key] || 0;
        const rlSeg_bruta = getTotSeg('Receita Bruta de Vendas') + getTotSeg('Receitas Indiretas');
        const rlSeg_imp = getTotSeg('Impostos') || getTotSeg('Impostos sobre a Receita');
        const rlSeg = (rlSeg_bruta - rlSeg_imp) || 1;
        const ebitSeg = rlSeg_bruta - rlSeg_imp - resultsSeg.kpis.totalCustos -
          (resultsSeg.kpis.totalDespesas - getTotSeg('Despesas Financeiras') -
           getTotSeg('Distribuição de Dividendos') - getTotSeg('Dividendos') -
           getTotSeg('Despesas Variáveis') - getTotSeg('Intermediação de Negócios'));

        markdownReport += `\n---\n\n`;
        markdownReport += `# 📊 Relatório Segregado: ${empresaSeg}\n\n`;
        markdownReport += `> *Seção gerada automaticamente com os dados filtrados exclusivamente para esta empresa.*\n\n`;

        markdownReport += `## Indicadores Estratégicos — ${empresaSeg}\n`;
        markdownReport += `- **Receita Bruta:** ${formatBRL(rlSeg_bruta)}\n`;
        markdownReport += `- **Total Custos:** ${formatBRL(resultsSeg.kpis.totalCustos)}\n`;
        markdownReport += `- **Total Despesas:** ${formatBRL(resultsSeg.kpis.totalDespesas)}\n`;
        markdownReport += `- **EBITDA:** ${formatBRL(ebitSeg)}\n`;
        markdownReport += `- **Margem Operacional:** ${formatPCT((ebitSeg / rlSeg) * 100)}\n`;
        markdownReport += `- **Resultado (FCL):** ${formatBRL(resultsSeg.kpis.fcl)}\n`;
        markdownReport += `\n`;

        markdownReport += `## DRE Resumida — ${empresaSeg}\n`;
        markdownReport += `| Categoria | Valor Acumulado |\n`;
        markdownReport += `| :--- | :--- |\n`;
        resultsSeg.estrutura.forEach(item => {
          if (item.tipo === 'linha' || item.tipo === 'linha_calc') {
            const valorTotal = resultsSeg.totais[item.titulo] || 0;
            if (valorTotal !== 0) {
              markdownReport += `| ${item.titulo} | ${formatBRL(valorTotal)} |\n`;
            }
          }
        });
        markdownReport += `\n`;
        }
      }
    }

    return markdownReport;
  };

  const handlePreviewExport = async (selections: ExportSelections): Promise<string> => {
    return await generateMarkdownReport(selections);
  };

  const handleConfirmExport = async (selections: ExportSelections, customMarkdown?: string) => {
    setIsExportingPdf(true); // Usado agora para travar a tela tanto no CSV quanto no Gamma

    const empresa = filters.empresas.length === 1 ? filters.empresas[0] : (filters.empresas.length > 1 ? "Varias" : "Global");
    const periodo = formatPeriodoInteligente(filters.periodos, results?.validColumns || []);

    try {
      if (selections.includeRawCsv && results) {
        ExportPdfService.exportToCsv(results, filters, empresa, periodo);
      }
      
      if (selections.includeGamma && results) {
        const markdownReport = customMarkdown || await generateMarkdownReport(selections);
        
        // 1. Iniciar geração na API do Gamma
        const resGenerate = await fetch('/api/gamma/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            markdownReport
          })
        });

        if (!resGenerate.ok) {
          const errData = await resGenerate.json().catch(() => ({}));
          throw new Error(errData.error || 'Falha ao iniciar geração no Gamma');
        }

        const genData = await resGenerate.json();
        const generationId = genData.generationId || genData.id;

        if (generationId) {
          // 2. Polling para aguardar o status
          let isComplete = false;
          let attempts = 0;
          const MAX_ATTEMPTS = 30; // 30 * 3s = 90 segundos
          
          while (!isComplete && attempts < MAX_ATTEMPTS) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 3000)); // Espera 3 segundos

            const resStatus = await fetch(`/api/gamma/status/${generationId}`);
            if (resStatus.ok) {
              const statusData = await resStatus.json();
              console.log("Gamma status response:", statusData);
              const statusStr = (statusData.status || statusData.state || '').toLowerCase();
              const finalUrl = statusData.gammaUrl || statusData.url || statusData.exportUrl || statusData.link;

              if (statusStr === 'completed' || statusStr === 'complete' || statusStr === 'done' || (finalUrl && statusStr !== 'pending' && statusStr !== 'generating')) {
                isComplete = true;
                if (finalUrl) {
                  setGammaResultUrl(finalUrl);
                  try {
                    window.open(finalUrl, '_blank');
                  } catch (e) {
                    console.warn("window.open bloqueado pelo navegador:", e);
                  }
                } else {
                  alert('Apresentação gerada, mas a URL não foi retornada pela API do Gamma.');
                }
              } else if (statusStr === 'failed' || statusStr === 'error') {
                throw new Error('A geração falhou no servidor do Gamma: ' + (statusData.error || 'Erro interno'));
              }
            }
          }

          if (!isComplete) {
            alert('A geração está demorando mais que o esperado. Verifique o seu painel no site do Gamma.');
          }
        } else {
          throw new Error('API do Gamma não retornou o ID de geração. Resposta: ' + JSON.stringify(genData));
        }
      }

      if (!selections.includeGamma) {
        setIsExportModalOpen(false);
      }
    } catch (error: any) {
      alert("Falha ao exportar os dados. Erro: " + (error?.message || String(error)));
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
    if (passcode === "grupo2ltda") {
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

            <Link
              href="/"
              className="mt-6 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 hover:text-amber-500 transition-colors uppercase tracking-wider"
            >
              <ChevronLeft size={14} />
              Voltar ao Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex overflow-hidden relative">
      {/* Aba Flutuante Premium para Reabrir Filtros quando recolhido */}
      {isSidebarCollapsed && (
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className="fixed left-0 top-1/2 -translate-y-1/2 bg-slate-900 border border-l-0 border-slate-800 text-amber-500 hover:text-amber-400 p-3.5 rounded-r-2xl shadow-2xl hover:bg-slate-855 transition-all z-50 flex items-center justify-center gap-2 group animate-in slide-in-from-left duration-300 active:scale-95 border-y border-r"
          title="Abrir Filtros"
        >
          <Filter size={18} className="group-hover:rotate-12 transition-transform duration-200" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-100 max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
            Abrir Filtros
          </span>
        </button>
      )}

      {/* Sidebar colapsável com transição suave */}
      <div className={`transition-all duration-300 ease-in-out border-r border-slate-800 ${
        isSidebarCollapsed ? 'w-0 opacity-0 -translate-x-full overflow-hidden' : 'w-80 opacity-100 translate-x-0'
      }`}>
        <DreSidebar
          metadata={metadata}
          rawData={rawData}
          filters={filters}
          onFilterChange={handleFilterChange}
          onFileUpload={handleFileUpload}
          isUploading={isUploading}
          fileName={fileName}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {/* Conteúdo Principal + Painel Direito */}
      <div className="flex-1 flex overflow-hidden">

        {/* Coluna Central: Dashboard */}
        <div id="dre-dashboard-content" className={`flex-1 overflow-y-auto p-6 md:p-8 transition-all duration-305 ${isExportingPdf ? 'opacity-50' : ''}`}>
          <div className="w-full max-w-[1600px] mx-auto">
            <DreHeader
              lastUpdate={lastUpdate}
              onExportPDF={handleOpenExportModal}
              onTogglePrivacy={() => { setIsPrivacyMode(!isPrivacyMode); if(!isPrivacyMode) setIsRevenuePrivacyMode(false); }}
              isPrivacyMode={isPrivacyMode}
              onToggleRevenuePrivacy={() => { setIsRevenuePrivacyMode(!isRevenuePrivacyMode); if(!isRevenuePrivacyMode) setIsPrivacyMode(false); }}
              isRevenuePrivacyMode={isRevenuePrivacyMode}
              onToggleSimulator={() => { window.location.href = '/dre-custom'; }}
              onOpenEquipmentsManager={() => setIsEquipmentsModalOpen(true)}
              hasData={rawData.length > 0 && !(fileName ?? '').includes('Banco de Dados Nuvem')}
              isPublishing={isPublishing}
              onPublish={handlePublishSnapshot}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              onOpenIndicators={() => setIsIndicatorsOpen(true)}
              onOpenReportBuilder={() => setIsReportBuilderOpen(true)}
            />

            {/* Botão de entrada manual — Conectius / Ybox / Histórico */}
            <div className="flex justify-end mt-3 mb-1">
              <button
                id="btn-manual-entry-dre"
                onClick={() => setIsManualEntryOpen(true)}
                className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 border border-slate-700 hover:border-amber-500/50 bg-slate-800/50 hover:bg-slate-800 px-3 py-2 rounded-lg transition-all duration-200"
                title="Inserir dados manuais de Conectius, Ybox ou histórico fora do Omie"
              >
                <ClipboardEdit size={13} />
                Dados Manuais
              </button>
            </div>

            <div className="space-y-8 mt-8">
              {/* Alertas Inteligentes */}
              <SmartAlerts alerts={alerts} />

              {/* Leitura Rápida */}
              <DreKpiCards
                results={results}
                isPrivacyMode={isPrivacyMode}
                isRevenuePrivacyMode={isRevenuePrivacyMode}
                onCardClick={handleOpenDetails}
                customCardTitle={customCardTitle}
                customCardTotal={customCardTotal}
                customCardCategoriesCount={customCardCategories.length}
                onCustomCardClick={() => setIsCustomCardModalOpen(true)}
              />

              {/* Análise Visual (Gráficos) */}
              {results && (
                <DreCharts
                  results={results}
                  isPrivacyMode={isPrivacyMode}
                  isRevenuePrivacyMode={isRevenuePrivacyMode}
                  filters={filters}
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
                      isRevenuePrivacyMode={isRevenuePrivacyMode}
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

        {/* Simulador V2 — Painel Lateral Fullscreen */}
        <DreSimulatorV2
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
          originalResults={originalResults}
          simulatedResults={results}
          rawData={rawData}
          metadata={metadata}
          activeScenario={activeScenario}
          onScenarioChange={setActiveScenario}
          onParamsChange={setSimParams}
          empresaContext={filters.empresas.length === 1 ? filters.empresas[0] : (filters.empresas.length > 1 ? 'Múltiplas' : 'Todas as Empresas')}
          periodoContext={formatPeriodoInteligente(filters.periodos, results?.validColumns || [])}
        />
      </div>

      <DreDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        mensalData={modalData}
        sourceRows={modalSourceRows}
        isPrivacyMode={isPrivacyMode}
        isRevenuePrivacyMode={isRevenuePrivacyMode}
        allResults={results}
        filters={filters}
      />

      <DreExportModal
        isOpen={isExportModalOpen}
        onClose={() => { setGammaResultUrl(null); setIsExportModalOpen(false); }}
        onExport={handleConfirmExport}
        onPreview={handlePreviewExport}
        isExporting={isExportingPdf}
        empresasSelecionadas={filters.empresas}
        todasEmpresas={metadata?.empresas ?? []}
        gammaResultUrl={gammaResultUrl}
      />

      <DreEquipmentsModal
        isOpen={isEquipmentsModalOpen}
        onClose={() => setIsEquipmentsModalOpen(false)}
        validColumns={results?.validColumns || []}
        departamentos={allowedDeptsForEquipments}
        initialCounts={equipamentoCounts}
        onSave={handleSaveEquipamentoCounts}
      />

      <DreCustomCardModal
        isOpen={isCustomCardModalOpen}
        onClose={() => setIsCustomCardModalOpen(false)}
        availableCategories={metadata?.categorias || []}
        selectedCategories={customCardCategories}
        onSave={setCustomCardCategories}
      />

      <DreManualEntryModal
        isOpen={isManualEntryOpen}
        onClose={() => setIsManualEntryOpen(false)}
        onSaved={loadLatestSnapshotFromDb}
        dbContasDre={metadata?.contasDre}
        dbCategorias={metadata?.categorias}
        dbDepartamentos={metadata?.departamentos}
        dbProjetos={metadata?.projetos}
        rawData={rawData}
      />

      <DreIndicatorsModal
        isOpen={isIndicatorsOpen}
        onClose={() => setIsIndicatorsOpen(false)}
        results={results}
        filters={filters}
      />

      <DreReportBuilderModal
        isOpen={isReportBuilderOpen}
        onClose={() => setIsReportBuilderOpen(false)}
        results={results}
        filters={filters}
        simulationParams={simParams}
        simulatedResult={results}
      />


    </main>
  );
}
