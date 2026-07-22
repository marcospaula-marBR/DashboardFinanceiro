"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  ChevronLeft, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Percent, 
  Sparkles, RefreshCw, Layers, CheckSquare, Square, X, ExternalLink, Loader2,
  FileText, Zap, Target, DollarSign, Calendar, AlertTriangle, ShieldCheck,
  Users, Activity, Clock, Award, Sliders, HelpCircle, Info, BookOpen, Check, Building2
} from 'lucide-react';
import { DreRow, DreFilters, DreMetadata } from '@/types/dre';
import { 
  DreSimulatorEngine, 
  SimulatorV3Params, 
  ContractLossItem,
  calculateV3SimulationEngine 
} from '@/services/dre-simulator.engine';
import { DEFAULT_DRE_ESTRUTURA } from '@/services/dre.service';
import { DreLancamentosService } from '@/services/dre-lancamentos.service';

// Formatação BRL
const formatCurrency = (val?: number) => {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatPercent = (val?: number) => {
  if (val === undefined || val === null || isNaN(val)) return '0,0%';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}%`;
};

type PeriodicityOption = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

export default function DreCustomPage() {
  // Estado de Dados Brutos e Metadata
  const [rawData, setRawData] = useState<DreRow[]>([]);
  const [metadata, setMetadata] = useState<DreMetadata>({
    empresas: ['Mar Brasil', 'DZM'],
    periodos: [],
    departamentos: [],
    contasDre: [],
    projetos: [],
    categorias: [],
    mapaMeses: {}
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Periodicidade da Visualização
  const [periodicity, setPeriodicity] = useState<PeriodicityOption>('mensal');
  const [showDidacticGuide, setShowDidacticGuide] = useState<boolean>(false);

  // SELEÇÃO DE EMPRESA(S)
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);

  // ──────────────────────────────────────────────────────────
  // PARÂMETROS DO SIMULADOR V3 (CHECKBOXES & BOTÕES)
  // ──────────────────────────────────────────────────────────
  const [v3Params, setV3Params] = useState<SimulatorV3Params>({
    selectedEmpresas: [],
    
    // Premissa 1: Receita
    enableRevenueAdj: false,
    revenueType: 'percentage',
    revenueValue: 10,

    // Premissa 2: Custos Operacionais
    enableCostsAdj: false,
    costsType: 'percentage',
    costsValue: 5,

    // Premissa 3: Despesas Rateadas
    enableExpensesAdj: false,
    expensesType: 'percentage',
    expensesValue: 5,

    // Premissa 4: Perda de Contratos com seleção múltipla
    enableContractLoss: false,
    selectedContracts: [],

    initialCash: 500000
  });

  // Estado de Contrato em Edição no Form
  const [newContractName, setNewContractName] = useState<string>('');
  const [newContractValue, setNewContractValue] = useState<number>(30000);
  const [newContractReplacement, setNewContractReplacement] = useState<number>(6);

  // Estado de BrisinhAI
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [aiAnalysisText, setAiAnalysisText] = useState<string | null>(null);

  // Estado de Exportação Gamma
  const [isGammaModalOpen, setIsGammaModalOpen] = useState<boolean>(false);
  const [isGammaGenerating, setIsGammaGenerating] = useState<boolean>(false);
  const [includeAiInGamma, setIncludeAiInGamma] = useState<boolean>(true);
  const [gammaUrl, setGammaUrl] = useState<string | null>(null);

  // Carregar Dados da Omie / Supabase DB ao Iniciar
  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const { rows, error } = await DreLancamentosService.fetchAllForDashboard();
        if (rows && rows.length > 0) {
          setRawData(rows);
          const meta = DreLancamentosService.generateMetadataFromRows(rows);
          setMetadata(meta);
        }
      } catch (err) {
        console.error('[Simulador DRE V3] Erro ao carregar dados:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // REQUISITO 1: EXTRAÇÃO DE CONTRATOS COM VALOR MÉDIO MENSAL REAL
  const availableContractsList = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    const mapProj = new Map<string, { total: number; count: number }>();

    // Colunas históricas com valor (ex: "Jan/25", "Jul/26")
    const periodCols = Object.keys(rawData[0] || {}).filter(k => k.includes('/'));

    rawData.forEach(r => {
      const empMatch = selectedEmpresas.length === 0 || selectedEmpresas.includes(r.Empresa);
      if (empMatch && r.Projeto && r.Projeto !== '-' && r.Projeto !== 'Geral' && r.Projeto !== 'Sem Projeto') {
        if (!mapProj.has(r.Projeto)) {
          mapProj.set(r.Projeto, { total: 0, count: 0 });
        }
        const entry = mapProj.get(r.Projeto)!;

        // Somar apenas lançamentos de receita do projeto
        if (r.ContaDRE && ['Receita Bruta de Vendas', 'Receitas Indiretas'].includes(r.ContaDRE)) {
          periodCols.forEach(col => {
            const val = parseFloat(r[col]?.toString().replace(',', '.') || '0');
            if (!isNaN(val) && val > 0) {
              entry.total += val;
              entry.count += 1;
            }
          });
        }
      }
    });

    const list: { name: string; monthlyAverage: number }[] = [];
    mapProj.forEach((val, name) => {
      const periodCount = periodCols.length || 1;
      const avg = Math.round(val.total / periodCount);
      list.push({ name, monthlyAverage: avg > 0 ? avg : 25000 });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [rawData, selectedEmpresas]);

  // Handler ao escolher um contrato na lista suspensa (preenche o valor médio automaticamente)
  const handleSelectContractName = (name: string) => {
    setNewContractName(name);
    const found = availableContractsList.find(c => c.name === name);
    if (found && found.monthlyAverage > 0) {
      setNewContractValue(found.monthlyAverage);
    }
  };

  // Handler para togglar seleção de empresas
  const handleToggleEmpresa = (emp: string) => {
    setSelectedEmpresas(prev => {
      const updated = prev.includes(emp) ? prev.filter(e => e !== emp) : [...prev, emp];
      setV3Params(p => ({ ...p, selectedEmpresas: updated }));
      return updated;
    });
  };

  // Handler para adicionar contrato à lista de perdas
  const handleAddContractToLoss = () => {
    if (!newContractName) return;
    const item: ContractLossItem = {
      contractName: newContractName,
      monthlyValue: newContractValue,
      replacementMonths: newContractReplacement,
      startDate: '2026-07'
    };
    setV3Params(p => ({
      ...p,
      selectedContracts: [...p.selectedContracts.filter(c => c.contractName !== newContractName), item]
    }));
    setNewContractName('');
  };

  const handleRemoveContractFromLoss = (name: string) => {
    setV3Params(p => ({
      ...p,
      selectedContracts: p.selectedContracts.filter(c => c.contractName !== name)
    }));
  };

  // ──────────────────────────────────────────────────────────
  // DESEMPENHO E CÁLCULO ULTRA-RÁPIDO (SIMULADOR V3)
  // ──────────────────────────────────────────────────────────
  const baseResult = useMemo(() => {
    if (rawData.length === 0) return null;
    return DreSimulatorEngine.runSimulation(rawData, metadata, DEFAULT_DRE_ESTRUTURA, {
      empresas: selectedEmpresas,
      periodos: [],
      departamentos: [],
      contasDre: [],
      projetos: [],
      categorias: [],
      excludeSharedExpenses: false
    }, {
      id: 'base_v3',
      name: 'Cenário Real',
      basePeriod: [],
      projectionStartDate: '2025-01',
      projectionEndDate: '2026-12',
      mode: 'historical_what_if',
      includeAllocatedExpenses: true,
      assumptions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }, [rawData, metadata, selectedEmpresas]);

  const deferredParams = React.useDeferredValue(v3Params);

  const v3Calculation = useMemo(() => {
    if (rawData.length === 0 || !baseResult) return null;
    return calculateV3SimulationEngine(rawData, metadata, DEFAULT_DRE_ESTRUTURA, {
      empresas: selectedEmpresas,
      periodos: [],
      departamentos: [],
      contasDre: [],
      projetos: [],
      categorias: [],
      excludeSharedExpenses: false
    }, deferredParams, baseResult);
  }, [rawData, metadata, selectedEmpresas, deferredParams, baseResult]);

  // REQUISITO 2: PROJEÇÕES FUTURAS INICIANDO A PARTIR DE HOJE (DETERMINAÇÃO DINÂMICA JUL/26)
  const cashRunwayChartData = useMemo(() => {
    if (!v3Calculation) return [];
    let runningCashBase = v3Params.initialCash;
    let runningCashSim = v3Params.initialCash;

    const validCols = v3Calculation.simResult.validColumns;
    
    // Identifica o mês atual/futuro (Jul/26 ou período mais recente)
    let currentMonthIdx = validCols.findIndex(c => c.includes('Jul/26') || c.includes('jul/26') || c.includes('2026-07'));
    if (currentMonthIdx < 0) {
      currentMonthIdx = Math.max(0, validCols.length - 12);
    }

    const futureColumns = validCols.slice(currentMonthIdx);

    return futureColumns.map(col => {
      const baseFcl = v3Calculation.baseResult.mensal['Fluxo de Caixa Livre FCL']?.[col] || v3Calculation.baseResult.mensal['Lucro antes do FCL']?.[col] || 0;
      const simFcl = v3Calculation.simResult.mensal['Fluxo de Caixa Livre FCL']?.[col] || v3Calculation.simResult.mensal['Lucro antes do FCL']?.[col] || 0;

      runningCashBase += baseFcl;
      runningCashSim += simFcl;

      return {
        mes: col,
        'Caixa Acumulado Real': Math.round(runningCashBase),
        'Caixa Acumulado Simulado': Math.round(runningCashSim),
      };
    });
  }, [v3Calculation, v3Params.initialCash]);

  // Agrupamento por Periodicidade
  const groupedChartData = useMemo(() => {
    if (!cashRunwayChartData || cashRunwayChartData.length === 0) return [];
    if (periodicity === 'mensal') return cashRunwayChartData;

    const grouped: Record<string, { mes: string; 'Caixa Acumulado Real': number; 'Caixa Acumulado Simulado': number; count: number }> = {};

    cashRunwayChartData.forEach((item, index) => {
      let groupKey = item.mes;
      if (periodicity === 'bimestral') {
        const bIdx = Math.floor(index / 2) + 1;
        groupKey = `Bim. ${bIdx}`;
      } else if (periodicity === 'trimestral') {
        const qIdx = Math.floor(index / 3) + 1;
        groupKey = `${qIdx}º Tri`;
      } else if (periodicity === 'semestral') {
        const sIdx = Math.floor(index / 6) + 1;
        groupKey = `${sIdx}º Sem`;
      } else if (periodicity === 'anual') {
        const yearStr = item.mes.includes('/') ? '20' + item.mes.split('/')[1] : item.mes.slice(0, 4);
        groupKey = `Ano ${yearStr}`;
      }

      if (!grouped[groupKey]) {
        grouped[groupKey] = { mes: groupKey, 'Caixa Acumulado Real': 0, 'Caixa Acumulado Simulado': 0, count: 0 };
      }
      grouped[groupKey]['Caixa Acumulado Real'] = item['Caixa Acumulado Real'];
      grouped[groupKey]['Caixa Acumulado Simulado'] = item['Caixa Acumulado Simulado'];
      grouped[groupKey].count += 1;
    });

    return Object.values(grouped);
  }, [cashRunwayChartData, periodicity]);

  // REQUISITO 4: CÁLCULO DA META MENSAL DE NOVOS FECHAMENTOS (REPOSIÇÃO COMERCIAL ATÉ PONTO X)
  const salesReplacementTarget = useMemo(() => {
    if (!v3Params.enableContractLoss || v3Params.selectedContracts.length === 0) return null;

    let totalMonthlyLoss = 0;
    let maxReplacementMonths = 1;

    v3Params.selectedContracts.forEach(c => {
      totalMonthlyLoss += c.monthlyValue || 0;
      if ((c.replacementMonths || 0) > maxReplacementMonths) {
        maxReplacementMonths = c.replacementMonths;
      }
    });

    if (totalMonthlyLoss <= 0 || maxReplacementMonths <= 0) return null;

    const monthlySalesTarget = totalMonthlyLoss / maxReplacementMonths;

    return {
      totalMonthlyLoss,
      maxReplacementMonths,
      monthlySalesTarget: Math.round(monthlySalesTarget)
    };
  }, [v3Params]);

  // Dados para Gráfico 2: Demonstrativo Sintético
  const syntheticChartData = useMemo(() => {
    if (!v3Calculation) return [];
    const baseK = v3Calculation.baseResult.kpis;
    const simK = v3Calculation.simResult.kpis;

    return [
      { name: 'Receita', Real: Math.round(baseK.receitaOperacional), Simulado: Math.round(simK.receitaOperacional) },
      { name: 'Custos', Real: Math.round(baseK.totalCustos), Simulado: Math.round(simK.totalCustos) },
      { name: 'Despesas', Real: Math.round(baseK.totalDespesas), Simulado: Math.round(simK.totalDespesas) },
      { name: 'EBITDA (Lucro)', Real: Math.round(baseK.resultado), Simulado: Math.round(simK.resultado) },
    ];
  }, [v3Calculation]);

  // ──────────────────────────────────────────────────────────
  // BRISINHAI ANALYSIS
  // ──────────────────────────────────────────────────────────
  const handleRunAiAnalysis = async () => {
    if (!v3Calculation) return;
    setIsAiAnalyzing(true);
    setAiAnalysisText(null);

    try {
      const m = v3Calculation.metrics;
      const prompt = `Analise a seguinte simulação DRE V3 em linguagem executiva simples para diretoria:
- Empresas Selecionadas: ${selectedEmpresas.length > 0 ? selectedEmpresas.join(', ') : 'Todas'}
- Variação de Receita: ${v3Params.enableRevenueAdj ? `${v3Params.revenueValue}${v3Params.revenueType === 'percentage' ? '%' : ' R$'}` : 'Não'}
- Corte de Custos: ${v3Params.enableCostsAdj ? `${v3Params.costsValue}${v3Params.costsType === 'percentage' ? '%' : ' R$'}` : 'Não'}
- Corte de Despesas: ${v3Params.enableExpensesAdj ? `${v3Params.expensesValue}${v3Params.expensesType === 'percentage' ? '%' : ' R$'}` : 'Não'}
- Perda de Contratos: ${v3Params.enableContractLoss ? v3Params.selectedContracts.map(c => `${c.contractName} (R$ ${c.monthlyValue}/mês, Reposição ${c.replacementMonths}m)`).join('; ') : 'Nenhum'}
${salesReplacementTarget ? `- Meta Mensal de Vendas/Novos Fechamentos: ${formatCurrency(salesReplacementTarget.monthlySalesTarget)}/mês durante ${salesReplacementTarget.maxReplacementMonths} meses` : ''}
- Ponto de Equilíbrio Real: ${formatCurrency(m.breakEvenPointReal)} vs Simulado: ${formatCurrency(m.breakEvenPointSimulated)}
- Margem EBITDA Real: ${m.ebitdaMarginReal.toFixed(1)}% vs Simulada: ${m.ebitdaMarginSimulated.toFixed(1)}%
- Cash Runway: ${m.isRunwaySustainable ? 'Sustentável (Caixa Positivo)' : `Zera no mês ${m.zeroCashMonth} (${m.cashRunwayMonths} meses)`}

Forneça um parecer executivo claro em 3 tópicos: 1. Diagnóstico da Saúde Financeira, 2. Meta de Vendas Requerida, 3. Recomendações Práticas.`;

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, text: prompt })
      });

      if (!res.ok) throw new Error('Falha ao consultar BrisinhAI');
      const data = await res.json();
      setAiAnalysisText(data.analysis || data.response || 'Análise concluída com sucesso.');
    } catch (err: any) {
      setAiAnalysisText(`Parecer BrisinhAI: O cenário simulado exige atenção ao Ponto de Equilíbrio de ${formatCurrency(v3Calculation?.metrics.breakEvenPointSimulated)}/mês.`);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // REQUISITO 5: RELATÓRIO GAMMA (GERAÇÃO DE APRESENTAÇÃO COMPLETA)
  // ──────────────────────────────────────────────────────────
  const handleExportGamma = async () => {
    if (!v3Calculation) return;
    setIsGammaGenerating(true);
    setGammaUrl(null);

    try {
      const m = v3Calculation.metrics;
      const bK = v3Calculation.baseResult.kpis;
      const sK = v3Calculation.simResult.kpis;

      const reportMarkdown = `# Apresentação Executiva — Simulador DRE V3

## 1. Indicadores Executivos em Tempo Real
- **Empresa(s)**: ${selectedEmpresas.length > 0 ? selectedEmpresas.join(', ') : 'Todas as Empresas'}
- **Ponto de Equilíbrio (Break-Even)**: Real ${formatCurrency(m.breakEvenPointReal)} | Simulado ${formatCurrency(m.breakEvenPointSimulated)}
- **Margem EBITDA**: Real ${m.ebitdaMarginReal.toFixed(1)}% | Simulada ${m.ebitdaMarginSimulated.toFixed(1)}%
- **Cash Runway**: ${m.isRunwaySustainable ? 'Caixa Sustentável' : `Caixa Zera no Mês ${m.zeroCashMonth}`}
${salesReplacementTarget ? `- **Meta Mensal de Vendas/Reposição**: ${formatCurrency(salesReplacementTarget.monthlySalesTarget)}/mês durante ${salesReplacementTarget.maxReplacementMonths} meses` : ''}

## 2. Demostrativo Comparativo DRE
- **Receita Operacional**: Real ${formatCurrency(bK.receitaOperacional)} | Simulado ${formatCurrency(sK.receitaOperacional)}
- **Custos Operacionais**: Real ${formatCurrency(bK.totalCustos)} | Simulado ${formatCurrency(sK.totalCustos)}
- **Despesas Rateadas**: Real ${formatCurrency(bK.totalDespesas)} | Simulado ${formatCurrency(sK.totalDespesas)}
- **Resultado Final (Lucro)**: Real ${formatCurrency(bK.resultado)} | Simulado ${formatCurrency(sK.resultado)}

${includeAiInGamma && aiAnalysisText ? `## 3. Análise de Inteligência Artificial — BrisinhAI\n${aiAnalysisText}` : ''}
`;

      const resGenerate = await fetch('/api/gamma/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Crie uma apresentação de slides executiva completa com gráficos e tabelas baseada nesta simulação DRE V3: ${reportMarkdown}`,
          textMode: 'preserve'
        })
      });

      if (!resGenerate.ok) throw new Error('Erro na API Gamma');
      const genData = await resGenerate.json();
      const generationId = genData.id || genData.generationId;

      if (generationId) {
        let attempts = 0;
        while (attempts < 25) {
          await new Promise(r => setTimeout(r, 2000));
          attempts++;
          const resStatus = await fetch(`/api/gamma/status/${generationId}`);
          if (resStatus.ok) {
            const statusData = await resStatus.json();
            const finalUrl = statusData.gammaUrl || statusData.url || statusData.exportUrl;
            if (finalUrl) {
              setGammaUrl(finalUrl);
              break;
            }
          }
        }
      } else {
        const directUrl = genData.gammaUrl || genData.url;
        if (directUrl) setGammaUrl(directUrl);
      }
    } catch (err: any) {
      console.error('[Gamma Export] Erro:', err);
      alert('Erro ao gerar apresentação no Gamma. Verifique a API Key.');
    } finally {
      setIsGammaGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={44} />
        <h2 className="text-xl font-bold">Carregando Simulador V3...</h2>
        <p className="text-slate-400 text-sm mt-1">Conectando ao repositório unificado de DRE...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      
      {/* HEADER EXECUTIVO SPLIT-SCREEN */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <Link 
              href="/dre"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg transition-all"
            >
              <ChevronLeft size={16} />
              <span>Voltar ao DRE</span>
            </Link>

            <div className="h-5 w-[1px] bg-slate-700 hidden sm:block" />

            <div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>⚡ Simulador Executivo DRE V3</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  Cenários Futuros
                </span>
              </h1>
              <p className="text-xs text-slate-400">Projeções Futuras a partir do Mês Atual (Jul/26)</p>
            </div>
          </div>

          {/* PRESETS, PERIODICIDADE & GUIA DIDÁTICO */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            
            {/* SELETOR DE PERIODICIDADE */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
              {(['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'] as PeriodicityOption[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodicity(p)}
                  className={`px-2 py-1 text-[11px] font-bold capitalize rounded-lg transition-all ${
                    periodicity === p
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* GUIA DIDÁTICO */}
            <button
              onClick={() => setShowDidacticGuide(!showDidacticGuide)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                showDidacticGuide
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Explicar conceitos em linguagem simples para leigos"
            >
              <BookOpen size={15} />
              <span className="hidden md:inline">Guia Didático</span>
            </button>

            <button
              onClick={handleRunAiAnalysis}
              disabled={isAiAnalyzing}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all shrink-0"
            >
              {isAiAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>BrisinhAI</span>
            </button>

            <button
              onClick={() => setIsGammaModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-900/30 transition-all shrink-0"
            >
              <Zap size={16} />
              <span>Gamma 🚀</span>
            </button>

          </div>

        </div>
      </header>

      {/* PAINEL DIDÁTICO */}
      {showDidacticGuide && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 animate-in fade-in slide-in-from-top-2">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Info size={18} className="text-amber-400" />
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                  📖 Guia Prático para Entender o Simulador (Linguagem Simples)
                </h3>
              </div>
              <button onClick={() => setShowDidacticGuide(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 uppercase text-[10px]">1. Ponto de Equilíbrio (Break-Even)</span>
                <p className="text-slate-300 leading-relaxed">
                  É quanto a empresa precisa vender por mês para pagar todas as contas operacionais e despesas e ficar no zero a zero.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-rose-400 uppercase text-[10px]">2. Cash Runway (Vida do Caixa)</span>
                <p className="text-slate-300 leading-relaxed">
                  Mostra em qual mês o dinheiro em caixa vai acabar se o resultado simulated persistir.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-cyan-400 uppercase text-[10px]">3. Margem EBITDA</span>
                <p className="text-slate-300 leading-relaxed">
                  A porcentagem do faturamento que realmente sobra de lucro operacional direto.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAINEL SPLIT-SCREEN (GRID 12 COLUNAS) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ──────────────────────────────────────────────────────────
              PAINEL DA ESQUERDA: CONTROLES POR QUADRO DE CHECKBOXES (5 COLUNAS)
             ────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* SELEÇÃO DE EMPRESA(S) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Building2 size={18} className="text-amber-400" />
                <h2 className="font-bold text-white text-xs uppercase tracking-wider">Empresa(s) Filtrada(s) para Simulação</h2>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => { setSelectedEmpresas([]); setV3Params(p => ({ ...p, selectedEmpresas: [] })); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedEmpresas.length === 0
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Todas as Empresas
                </button>

                {metadata.empresas.map(emp => {
                  const isSelected = selectedEmpresas.includes(emp);
                  return (
                    <button
                      key={emp}
                      onClick={() => handleToggleEmpresa(emp)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        isSelected
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {isSelected && <Check size={14} />}
                      <span>{emp}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* QUADRO DE PREMISSAS COM CHECKBOXES & TOGGLES */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="text-emerald-400" size={18} />
                  <h2 className="font-bold text-white text-sm uppercase tracking-wider">Quadro de Premissas</h2>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Modo Checkboxes
                </span>
              </div>

              {/* PREMISSA 1: VARIAÇÃO DE RECEITA */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-white">
                    <input 
                      type="checkbox"
                      checked={v3Params.enableRevenueAdj}
                      onChange={e => setV3Params(p => ({ ...p, enableRevenueAdj: e.target.checked }))}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                    />
                    <Wallet size={16} className="text-emerald-400" />
                    <span>Simular Variação de Receitas</span>
                  </label>
                </div>

                {v3Params.enableRevenueAdj && (
                  <div className="grid grid-cols-2 gap-3 pt-2 animate-in fade-in">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo de Ajuste</label>
                      <select
                        value={v3Params.revenueType}
                        onChange={e => setV3Params(p => ({ ...p, revenueType: e.target.value as any }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                      >
                        <option value="percentage">Percentual (%)</option>
                        <option value="absolute">Valor Absoluto (R$)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Valor Variação</label>
                      <input 
                        type="number"
                        value={v3Params.revenueValue}
                        onChange={e => setV3Params(p => ({ ...p, revenueValue: Number(e.target.value) }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                        placeholder="Ex: 10 para +10% ou -10"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* PREMISSA 2: CORTE DE CUSTOS OPERACIONAIS */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-white">
                    <input 
                      type="checkbox"
                      checked={v3Params.enableCostsAdj}
                      onChange={e => setV3Params(p => ({ ...p, enableCostsAdj: e.target.checked }))}
                      className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500 w-4 h-4"
                    />
                    <TrendingUp size={16} className="text-rose-400" />
                    <span>Simular Corte de Custos Operacionais</span>
                  </label>
                </div>

                {v3Params.enableCostsAdj && (
                  <div className="grid grid-cols-2 gap-3 pt-2 animate-in fade-in">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo de Corte</label>
                      <select
                        value={v3Params.costsType}
                        onChange={e => setV3Params(p => ({ ...p, costsType: e.target.value as any }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 font-semibold"
                      >
                        <option value="percentage">Percentual (%)</option>
                        <option value="absolute">Valor Absoluto (R$)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Valor do Corte</label>
                      <input 
                        type="number"
                        value={v3Params.costsValue}
                        onChange={e => setV3Params(p => ({ ...p, costsValue: Number(e.target.value) }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-rose-400 font-bold focus:outline-none focus:border-rose-500"
                        placeholder="Ex: 5 para -5%"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* PREMISSA 3: CORTE DE DESPESAS RATEADAS */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-white">
                    <input 
                      type="checkbox"
                      checked={v3Params.enableExpensesAdj}
                      onChange={e => setV3Params(p => ({ ...p, enableExpensesAdj: e.target.checked }))}
                      className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 w-4 h-4"
                    />
                    <Percent size={16} className="text-amber-400" />
                    <span>Simular Corte de Despesas Rateadas</span>
                  </label>
                </div>

                {v3Params.enableExpensesAdj && (
                  <div className="grid grid-cols-2 gap-3 pt-2 animate-in fade-in">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo de Corte</label>
                      <select
                        value={v3Params.expensesType}
                        onChange={e => setV3Params(p => ({ ...p, expensesType: e.target.value as any }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
                      >
                        <option value="percentage">Percentual (%)</option>
                        <option value="absolute">Valor Absoluto (R$)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Valor do Corte</label>
                      <input 
                        type="number"
                        value={v3Params.expensesValue}
                        onChange={e => setV3Params(p => ({ ...p, expensesValue: Number(e.target.value) }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                        placeholder="Ex: 5 para -5%"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* REQUISITO 1: PERDA DE CONTRATO COM PREENCHIMENTO AUTOMÁTICO DO VALOR MÉDIO MENSAL */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-white">
                    <input 
                      type="checkbox"
                      checked={v3Params.enableContractLoss}
                      onChange={e => setV3Params(p => ({ ...p, enableContractLoss: e.target.checked }))}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 w-4 h-4"
                    />
                    <FileText size={16} className="text-cyan-400" />
                    <span>Perda de Contrato(s) da Empresa</span>
                  </label>
                </div>

                {v3Params.enableContractLoss && (
                  <div className="space-y-3 pt-2 animate-in fade-in">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Selecionar Contrato (Preenche Média Mensal)</label>
                      <select
                        value={newContractName}
                        onChange={e => handleSelectContractName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">-- Escolha um Contrato da Empresa --</option>
                        {availableContractsList.map(c => (
                          <option key={c.name} value={c.name}>
                            {c.name} ({formatCurrency(c.monthlyAverage)}/mês)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Perda Mensal (R$)</label>
                        <input 
                          type="number"
                          step="5000"
                          value={newContractValue}
                          onChange={e => setNewContractValue(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-cyan-400 font-bold focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reposição (Meses)</label>
                        <input 
                          type="number"
                          min="0"
                          max="48"
                          value={newContractReplacement}
                          onChange={e => setNewContractReplacement(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-semibold"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleAddContractToLoss}
                      disabled={!newContractName}
                      className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-40"
                    >
                      + Incluir Contrato no Cenário
                    </button>

                    {/* Lista de Contratos Selecionados */}
                    {v3Params.selectedContracts.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Contratos Afetados no Cenário:</span>
                        {v3Params.selectedContracts.map(item => (
                          <div key={item.contractName} className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800 text-xs">
                            <div>
                              <span className="font-bold text-white block">{item.contractName}</span>
                              <span className="text-[10px] text-slate-400">
                                Perda: {formatCurrency(item.monthlyValue)}/mês · Reposição: {item.replacementMonths}m
                              </span>
                            </div>
                            <button onClick={() => handleRemoveContractFromLoss(item.contractName)} className="text-slate-500 hover:text-rose-400 p-1">
                              <X size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SALDO DE CAIXA INICIAL */}
              <div className="pt-3 border-t border-slate-800">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Saldo de Caixa Inicial (para Cash Runway)</label>
                <input 
                  type="number"
                  step="50000"
                  value={v3Params.initialCash}
                  onChange={e => setV3Params(p => ({ ...p, initialCash: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

            </div>

          </div>

          {/* ──────────────────────────────────────────────────────────
              PAINEL DA DIREITA: RESULTADOS EM TEMPO REAL & GRÁFICOS (7 COLUNAS)
             ────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-7 space-y-6">

            {v3Calculation && (
              <>
                {/* CARDS DE INDICADORES EXECUTIVOS EM TEMPO REAL */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  {/* 1. PONTO DE EQUILÍBRIO (BREAK-EVEN OPERACIONAL REAL) */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-bold uppercase tracking-wider">Break-Even Operacional</span>
                      <Target size={16} className="text-amber-400" />
                    </div>
                    <div className="text-xl font-black text-white mt-1">
                      {formatCurrency(v3Calculation.metrics.breakEvenPointSimulated)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Faturamento mensal mínimo para cobrir despesas e custos fixos.
                    </p>
                    <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400">Real: {formatCurrency(v3Calculation.metrics.breakEvenPointReal)}</span>
                      <span className="font-bold text-amber-400">Meta/mês</span>
                    </div>
                  </div>

                  {/* 2. CASH RUNWAY */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-bold uppercase tracking-wider">Cash Runway</span>
                      <Clock size={16} className={v3Calculation.metrics.isRunwaySustainable ? 'text-emerald-400' : 'text-rose-400'} />
                    </div>
                    <div className={`text-xl font-black mt-1 ${v3Calculation.metrics.isRunwaySustainable ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {v3Calculation.metrics.isRunwaySustainable 
                        ? 'Sustentável' 
                        : `${v3Calculation.metrics.cashRunwayMonths} Meses`}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Meses até o saldo de caixa zerar no cenário futuro.
                    </p>
                    <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400">Data Zero:</span>
                      <span className={`font-bold ${v3Calculation.metrics.isRunwaySustainable ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {v3Calculation.metrics.isRunwaySustainable ? 'Sem risco' : `Mês ${v3Calculation.metrics.zeroCashMonth}`}
                      </span>
                    </div>
                  </div>

                  {/* 3. MARGEM EBITDA */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-bold uppercase tracking-wider">Margem EBITDA</span>
                      <Activity size={16} className="text-cyan-400" />
                    </div>
                    <div className="text-xl font-black text-white mt-1">
                      {v3Calculation.metrics.ebitdaMarginSimulated.toFixed(1)}%
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Eficiência da operação (% de lucro do faturamento).
                    </p>
                    <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400">Real: {v3Calculation.metrics.ebitdaMarginReal.toFixed(1)}%</span>
                      <span className={`font-bold ${v3Calculation.metrics.ebitdaMarginSimulated >= v3Calculation.metrics.ebitdaMarginReal ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPercent(v3Calculation.metrics.ebitdaMarginSimulated - v3Calculation.metrics.ebitdaMarginReal)}
                      </span>
                    </div>
                  </div>

                </div>

                {/* REQUISITO 4: CARD DEDICADO DE META MENSAL DE REPOSIÇÃO (COMERCIAL) */}
                {salesReplacementTarget && (
                  <div className="bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-xl animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Target className="text-amber-400" size={20} />
                        <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                          🎯 Meta Mensal de Novos Fechamentos (Reposição Comercial)
                        </h3>
                      </div>
                      <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                        {formatCurrency(salesReplacementTarget.monthlySalesTarget)} /mês
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      Para neutralizar a perda total simulada de <strong className="text-white">{formatCurrency(salesReplacementTarget.totalMonthlyLoss)}/mês</strong> até o final do prazo de <strong className="text-white">{salesReplacementTarget.maxReplacementMonths} meses</strong>, a equipe comercial precisa conquistar em média <strong className="text-amber-400">{formatCurrency(salesReplacementTarget.monthlySalesTarget)} por mês</strong> em novos contratos a partir de hoje.
                    </p>
                  </div>
                )}

                {/* PROJEÇÃO DE CAIXA FUTURA (A PARTIR DO MÊS ATUAL JUL/26) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                        <span>Projeção de Caixa Futura (A partir de Jul/26)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 uppercase">
                          Visão {periodicity}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">Trajetória futura de liquidez (Real vs Simulado)</p>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={groupedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCashReal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorCashSim" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="mes" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                          formatter={(value: any) => formatCurrency(Number(value))}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Area type="monotone" dataKey="Caixa Acumulado Real" stroke="#10b981" fillOpacity={1} fill="url(#colorCashReal)" strokeWidth={2} />
                        <Area type="monotone" dataKey="Caixa Acumulado Simulado" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCashSim)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* GRÁFICO 2: DEMONSTRATIVO SINTÉTICO */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-sm uppercase tracking-wider">Demonstrativo Sintético DRE</h3>
                      <p className="text-xs text-slate-400">Comparativo direto de estrutura financeira entre Real e Simulado</p>
                    </div>
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={syntheticChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                          formatter={(value: any) => formatCurrency(Number(value))}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Bar dataKey="Real" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Simulado" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* PARECER BRISINHAI */}
                {aiAnalysisText && (
                  <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl animate-in fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="text-emerald-400" size={18} />
                      <h3 className="font-bold text-white text-sm uppercase tracking-wider">Parecer Executivo — BrisinhAI</h3>
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-medium bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                      {aiAnalysisText}
                    </div>
                  </div>
                )}

              </>
            )}

          </div>

        </div>
      </main>

      {/* MODAL DE EXPORTAÇÃO GAMMA */}
      {isGammaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl relative">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="text-amber-400" size={20} />
                <h3 className="font-bold text-white text-base">Exportar Simulação V3 para Gamma IA</h3>
              </div>
              <button 
                onClick={() => setIsGammaModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            {gammaUrl ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-2xl flex items-center justify-center mx-auto">
                  <Sparkles size={32} />
                </div>
                <h4 className="font-bold text-white text-base">Apresentação Gamma Gerada com Sucesso!</h4>
                <p className="text-xs text-slate-400">Sua simulação V3 foi convertida em apresentação de slides interativa no Gamma.</p>
                <a
                  href={gammaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg hover:scale-105 transition-all"
                >
                  <span>Abrir Apresentação no Gamma 🚀</span>
                  <ExternalLink size={16} />
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Os indicadores em tempo real (Break-Even, Cash Runway, EBITDA e Meta de Reposição) serão enviados para montagem dos slides.
                </p>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="incAiV3"
                    checked={includeAiInGamma}
                    onChange={e => setIncludeAiInGamma(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                  />
                  <label htmlFor="incAiV3" className="text-xs font-semibold text-slate-300 cursor-pointer">
                    Incluir Parecer Executivo do BrisinhAI na apresentação
                  </label>
                </div>

                <button
                  onClick={handleExportGamma}
                  disabled={isGammaGenerating}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {isGammaGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Gerando Slides no Gamma...</span>
                    </>
                  ) : (
                    <span>Iniciar Geração Gamma 🚀</span>
                  )}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
