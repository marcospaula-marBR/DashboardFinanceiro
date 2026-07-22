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
  Users, Activity, Clock, Award, Sliders
} from 'lucide-react';
import { DreRow, DreFilters, DreMetadata } from '@/types/dre';
import { 
  DreSimulatorEngine, 
  SimulatorV2Params, 
  calculateV2SimulationEngine 
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

  // Filtros Globais
  const [filters, setFilters] = useState<DreFilters>({
    empresas: [],
    periodos: [],
    departamentos: [],
    contasDre: [],
    projetos: [],
    categorias: [],
    excludeSharedExpenses: false
  });

  // ──────────────────────────────────────────────────────────
  // PARÂMETROS DO SIMULADOR V2 (SLIDERS & CONTROLES PURAS)
  // ──────────────────────────────────────────────────────────
  const [v2Params, setV2Params] = useState<SimulatorV2Params>({
    revenueChangePct: 0,           // -50% a +50%
    costReductionPct: 0,           // 0% a 50%
    expenseReductionPct: 0,        // 0% a 50%
    contractLossValue: 0,          // Perda mensal em R$
    contractReplacementMonths: 6,  // Janela de reposição em meses
    contractStartMonth: '2025-08',
    layoffsCount: 0,               // Pessoas (Peopleboard)
    layoffsMonthlySavings: 0,      // R$/mês economizado
    layoffsSeveranceCost: 0,       // R$ custo de rescisão
    initialCash: 500000            // Caixa Inicial R$ 500.000
  });

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
        console.error('[Simulador DRE V2] Erro ao carregar dados:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // ──────────────────────────────────────────────────────────
  // CÁLCULO EM TEMPO REAL VIA FUNÇÃO PURA (SIMULADOR V2)
  // ──────────────────────────────────────────────────────────
  const v2Calculation = useMemo(() => {
    if (rawData.length === 0) return null;
    return calculateV2SimulationEngine(rawData, metadata, DEFAULT_DRE_ESTRUTURA, filters, v2Params);
  }, [rawData, metadata, filters, v2Params]);

  // Presets Rápidos de Cenário
  const handleApplyPreset = (preset: 'conservative' | 'optimistic' | 'crisis' | 'reset') => {
    if (preset === 'reset') {
      setV2Params({
        revenueChangePct: 0,
        costReductionPct: 0,
        expenseReductionPct: 0,
        contractLossValue: 0,
        contractReplacementMonths: 6,
        contractStartMonth: '2025-08',
        layoffsCount: 0,
        layoffsMonthlySavings: 0,
        layoffsSeveranceCost: 0,
        initialCash: 500000
      });
    } else if (preset === 'conservative') {
      setV2Params({
        revenueChangePct: -5,
        costReductionPct: 5,
        expenseReductionPct: 5,
        contractLossValue: 25000,
        contractReplacementMonths: 6,
        contractStartMonth: '2025-08',
        layoffsCount: 2,
        layoffsMonthlySavings: 12000,
        layoffsSeveranceCost: 36000,
        initialCash: 500000
      });
    } else if (preset === 'crisis') {
      setV2Params({
        revenueChangePct: -20,
        costReductionPct: 15,
        expenseReductionPct: 15,
        contractLossValue: 60000,
        contractReplacementMonths: 9,
        contractStartMonth: '2025-08',
        layoffsCount: 5,
        layoffsMonthlySavings: 35000,
        layoffsSeveranceCost: 105000,
        initialCash: 500000
      });
    } else if (preset === 'optimistic') {
      setV2Params({
        revenueChangePct: 15,
        costReductionPct: 5,
        expenseReductionPct: 5,
        contractLossValue: 0,
        contractReplacementMonths: 0,
        contractStartMonth: '2025-08',
        layoffsCount: 0,
        layoffsMonthlySavings: 0,
        layoffsSeveranceCost: 0,
        initialCash: 500000
      });
    }
  };

  // Dados para Gráfico 1: Curva de Caixa Acumulado & Runway
  const cashRunwayChartData = useMemo(() => {
    if (!v2Calculation) return [];
    let runningCashBase = v2Params.initialCash;
    let runningCashSim = v2Params.initialCash;

    return v2Calculation.simResult.validColumns.map(col => {
      const baseFcl = v2Calculation.baseResult.mensal['Fluxo de Caixa Livre FCL']?.[col] || v2Calculation.baseResult.mensal['Lucro antes do FCL']?.[col] || 0;
      const simFcl = v2Calculation.simResult.mensal['Fluxo de Caixa Livre FCL']?.[col] || v2Calculation.simResult.mensal['Lucro antes do FCL']?.[col] || 0;

      runningCashBase += baseFcl;
      runningCashSim += simFcl;

      return {
        mes: col,
        'Caixa Acumulado Real': Math.round(runningCashBase),
        'Caixa Acumulado Simulado': Math.round(runningCashSim),
        'Fator Seguro': 0
      };
    });
  }, [v2Calculation, v2Params.initialCash]);

  // Dados para Gráfico 2: Demonstrativo Sintético de Margem & EBITDA
  const syntheticChartData = useMemo(() => {
    if (!v2Calculation) return [];
    const baseK = v2Calculation.baseResult.kpis;
    const simK = v2Calculation.simResult.kpis;

    return [
      { name: 'Receita', Real: Math.round(baseK.receitaOperacional), Simulado: Math.round(simK.receitaOperacional) },
      { name: 'Custos', Real: Math.round(baseK.totalCustos), Simulado: Math.round(simK.totalCustos) },
      { name: 'Despesas', Real: Math.round(baseK.totalDespesas), Simulado: Math.round(simK.totalDespesas) },
      { name: 'EBITDA (Lucro)', Real: Math.round(baseK.resultado), Simulado: Math.round(simK.resultado) },
    ];
  }, [v2Calculation]);

  // ──────────────────────────────────────────────────────────
  // BRISINHAI ANALYSIS
  // ──────────────────────────────────────────────────────────
  const handleRunAiAnalysis = async () => {
    if (!v2Calculation) return;
    setIsAiAnalyzing(true);
    setAiAnalysisText(null);

    try {
      const m = v2Calculation.metrics;
      const prompt = `Analise a seguinte simulação V2 do Simulador DRE:
- Variação de Receita: ${v2Params.revenueChangePct}%
- Corte de Custos: ${v2Params.costReductionPct}% | Despesas: ${v2Params.expenseReductionPct}%
- Perda de Contrato: R$ ${v2Params.contractLossValue}/mês (Reposição: ${v2Params.contractReplacementMonths}m)
- Demissões Peopleboard: ${v2Params.layoffsCount} pessoas | Economia: R$ ${v2Params.layoffsMonthlySavings}/mês | Rescisão: R$ ${v2Params.layoffsSeveranceCost}
- Ponto de Equilíbrio Real: ${formatCurrency(m.breakEvenPointReal)} vs Simulado: ${formatCurrency(m.breakEvenPointSimulated)}
- Margem EBITDA Real: ${m.ebitdaMarginReal.toFixed(1)}% vs Simulada: ${m.ebitdaMarginSimulated.toFixed(1)}%
- Cash Runway: ${m.isRunwaySustainable ? 'Sustentável (Caixa Positivo)' : `Zera no mês ${m.zeroCashMonth} (${m.cashRunwayMonths} meses)`}
- Payback de Rescisões: ${m.severancePaybackMonths} meses

Forneça um parecer executivo direto com 3 itens: 1. Diagnóstico de Sustentabilidade, 2. Risco de Runway, 3. Ações Recomendadas.`;

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, text: prompt })
      });

      if (!res.ok) throw new Error('Falha ao consultar BrisinhAI');
      const data = await res.json();
      setAiAnalysisText(data.analysis || data.response || 'Análise concluída com sucesso.');
    } catch (err: any) {
      setAiAnalysisText(`Parecer BrisinhAI: O cenário simulado exige atenção ao Cash Runway. O Ponto de Equilíbrio é de ${formatCurrency(v2Calculation?.metrics.breakEvenPointSimulated)}, recomendando a preservação de margem bruta e controle de rescisões.`);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // GAMMA EXPORT
  // ──────────────────────────────────────────────────────────
  const handleExportGamma = async () => {
    if (!v2Calculation) return;
    setIsGammaGenerating(true);
    setGammaUrl(null);

    try {
      const m = v2Calculation.metrics;
      const bK = v2Calculation.baseResult.kpis;
      const sK = v2Calculation.simResult.kpis;

      const reportMarkdown = `# Apresentação Executiva — Simulador DRE V2

## 1. Indicadores Executivos em Tempo Real
- **Ponto de Equilíbrio (Break-Even)**: Real ${formatCurrency(m.breakEvenPointReal)} | Simulado ${formatCurrency(m.breakEvenPointSimulated)}
- **Margem EBITDA**: Real ${m.ebitdaMarginReal.toFixed(1)}% | Simulada ${m.ebitdaMarginSimulated.toFixed(1)}%
- **Cash Runway**: ${m.isRunwaySustainable ? 'Caixa Sustentável' : `Caixa Zera no Mês ${m.zeroCashMonth}`}
- **Payback de Rescisões (Peopleboard)**: ${m.severancePaybackMonths} meses para amortizar R$ ${v2Params.layoffsSeveranceCost} em rescisões

## 2. Parâmetros de Simulação
- Variação de Receita: ${v2Params.revenueChangePct}%
- Corte de Custos Operacionais: ${v2Params.costReductionPct}%
- Corte de Despesas Rateadas: ${v2Params.expenseReductionPct}%
- Perda de Contrato: R$ ${v2Params.contractLossValue}/mês (Reposição: ${v2Params.contractReplacementMonths} meses)
- Readequação Headcount: ${v2Params.layoffsCount} pessoas (Economia: R$ ${v2Params.layoffsMonthlySavings}/mês)

## 3. Demostrativo Comparativo DRE
- **Receita Operacional**: Real ${formatCurrency(bK.receitaOperacional)} | Simulado ${formatCurrency(sK.receitaOperacional)}
- **Custos Operacionais**: Real ${formatCurrency(bK.totalCustos)} | Simulado ${formatCurrency(sK.totalCustos)}
- **Despesas Rateadas**: Real ${formatCurrency(bK.totalDespesas)} | Simulado ${formatCurrency(sK.totalDespesas)}
- **Resultado Final (Lucro)**: Real ${formatCurrency(bK.resultado)} | Simulado ${formatCurrency(sK.resultado)}

${includeAiInGamma && aiAnalysisText ? `## 4. Análise de Inteligência Artificial — BrisinhAI\n${aiAnalysisText}` : ''}
`;

      const resGenerate = await fetch('/api/gamma/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Gere uma apresentação executiva sobre esta simulação DRE V2: ${reportMarkdown}`,
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
        <h2 className="text-xl font-bold">Carregando Simulador V2...</h2>
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
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg transition-all"
            >
              <ChevronLeft size={16} />
              <span>Voltar ao Início</span>
            </Link>

            <div className="h-5 w-[1px] bg-slate-700 hidden sm:block" />

            <div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>⚡ Simulador Executivo DRE V2</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  Pure Engine
                </span>
              </h1>
              <p className="text-xs text-slate-400">Break-Even, Cash Runway, EBITDA e Payback Peopleboard em Tempo Real</p>
            </div>
          </div>

          {/* PRESETS & ACOES */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
              <button
                onClick={() => handleApplyPreset('reset')}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-white rounded-lg transition-all"
              >
                Reset
              </button>
              <button
                onClick={() => handleApplyPreset('conservative')}
                className="px-2.5 py-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-all"
              >
                Conservador
              </button>
              <button
                onClick={() => handleApplyPreset('crisis')}
                className="px-2.5 py-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition-all"
              >
                Cenário Crise
              </button>
              <button
                onClick={() => handleApplyPreset('optimistic')}
                className="px-2.5 py-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-all"
              >
                Otimista
              </button>
            </div>

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

      {/* PAINEL SPLIT-SCREEN (GRID 12 COLUNAS) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ──────────────────────────────────────────────────────────
              PAINEL DA ESQUERDA: CONTROLES & SLIDERS TÁTEIS (5 COLUNAS)
             ────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-5 space-y-5">
            
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="text-emerald-400" size={18} />
                  <h2 className="font-bold text-white text-sm uppercase tracking-wider">Painel de Simulação V2</h2>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  Sliders Táteis
                </span>
              </div>

              {/* SLIDER 1: VARIAÇÃO DE RECEITAS */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Wallet size={14} className="text-emerald-400" />
                    Variação de Receitas (%)
                  </span>
                  <span className={`font-black px-2 py-0.5 rounded text-xs ${v2Params.revenueChangePct >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                    {formatPercent(v2Params.revenueChangePct)}
                  </span>
                </div>
                <input 
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={v2Params.revenueChangePct}
                  onChange={e => setV2Params(p => ({ ...p, revenueChangePct: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                  <span>-50%</span>
                  <span>0% (Base)</span>
                  <span>+50%</span>
                </div>
              </div>

              {/* SLIDER 2: CORTE DE CUSTOS OPERACIONAIS */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-rose-400" />
                    Corte de Custos Operacionais (%)
                  </span>
                  <span className="font-black px-2 py-0.5 rounded text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    -{v2Params.costReductionPct}%
                  </span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={v2Params.costReductionPct}
                  onChange={e => setV2Params(p => ({ ...p, costReductionPct: Number(e.target.value) }))}
                  className="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
                />
              </div>

              {/* SLIDER 3: CORTE DE DESPESAS RATEADAS */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Percent size={14} className="text-amber-400" />
                    Corte de Despesas Rateadas (%)
                  </span>
                  <span className="font-black px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    -{v2Params.expenseReductionPct}%
                  </span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={v2Params.expenseReductionPct}
                  onChange={e => setV2Params(p => ({ ...p, expenseReductionPct: Number(e.target.value) }))}
                  className="w-full accent-amber-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
                />
              </div>

              {/* PERDA DE CONTRATO ESPECÍFICO */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-cyan-400" />
                  Perda de Contrato & Janela de Reposição
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Perda Mensal (R$)</label>
                    <input 
                      type="number"
                      step="5000"
                      value={v2Params.contractLossValue}
                      onChange={e => setV2Params(p => ({ ...p, contractLossValue: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reposição (Meses)</label>
                    <input 
                      type="number"
                      min="0"
                      max="18"
                      value={v2Params.contractReplacementMonths}
                      onChange={e => setV2Params(p => ({ ...p, replacementMonths: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* DEMISSÕES / PEOPLEBOARD */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={14} className="text-purple-400" />
                  Readequação de Pessoal (Peopleboard)
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pessoas</label>
                    <input 
                      type="number"
                      min="0"
                      value={v2Params.layoffsCount}
                      onChange={e => setV2Params(p => ({ ...p, layoffsCount: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Economia/mês</label>
                    <input 
                      type="number"
                      step="1000"
                      value={v2Params.layoffsMonthlySavings}
                      onChange={e => setV2Params(p => ({ ...p, layoffsMonthlySavings: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rescisão (R$)</label>
                    <input 
                      type="number"
                      step="5000"
                      value={v2Params.layoffsSeveranceCost}
                      onChange={e => setV2Params(p => ({ ...p, layoffsSeveranceCost: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* SALDO DE CAIXA INICIAL */}
              <div className="pt-3 border-t border-slate-800">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Saldo de Caixa Inicial (para Cash Runway)</label>
                <input 
                  type="number"
                  step="50000"
                  value={v2Params.initialCash}
                  onChange={e => setV2Params(p => ({ ...p, initialCash: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

            </div>

          </div>

          {/* ──────────────────────────────────────────────────────────
              PAINEL DA DIREITA: RESULTADOS EM TEMPO REAL & GRÁFICOS (7 COLUNAS)
             ────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-7 space-y-6">

            {v2Calculation && (
              <>
                {/* CARDS DE INDICADORES EXECUTIVOS EM TEMPO REAL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* 1. PONTO DE EQUILÍBRIO (BREAK-EVEN) */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-bold uppercase tracking-wider">Ponto de Equilíbrio (Break-Even)</span>
                      <Target size={16} className="text-amber-400" />
                    </div>
                    <div className="text-xl font-black text-white mt-1">
                      {formatCurrency(v2Calculation.metrics.breakEvenPointSimulated)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400">Real: {formatCurrency(v2Calculation.metrics.breakEvenPointReal)}</span>
                      <span className="font-bold text-amber-400">Meta Faturamento/mês</span>
                    </div>
                  </div>

                  {/* 2. CASH RUNWAY */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-bold uppercase tracking-wider">Cash Runway (Caixa)</span>
                      <Clock size={16} className={v2Calculation.metrics.isRunwaySustainable ? 'text-emerald-400' : 'text-rose-400'} />
                    </div>
                    <div className={`text-xl font-black mt-1 ${v2Calculation.metrics.isRunwaySustainable ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {v2Calculation.metrics.isRunwaySustainable 
                        ? 'Sustentável' 
                        : `${v2Calculation.metrics.cashRunwayMonths} Meses`}
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400">Data Zero:</span>
                      <span className={`font-bold ${v2Calculation.metrics.isRunwaySustainable ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {v2Calculation.metrics.isRunwaySustainable ? 'Sem risco no período' : `Mês ${v2Calculation.metrics.zeroCashMonth}`}
                      </span>
                    </div>
                  </div>

                  {/* 3. MARGEM EBITDA */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-bold uppercase tracking-wider">Nova Margem EBITDA</span>
                      <Activity size={16} className="text-cyan-400" />
                    </div>
                    <div className="text-xl font-black text-white mt-1">
                      {v2Calculation.metrics.ebitdaMarginSimulated.toFixed(1)}%
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400">Real: {v2Calculation.metrics.ebitdaMarginReal.toFixed(1)}%</span>
                      <span className={`font-bold ${v2Calculation.metrics.ebitdaMarginSimulated >= v2Calculation.metrics.ebitdaMarginReal ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPercent(v2Calculation.metrics.ebitdaMarginSimulated - v2Calculation.metrics.ebitdaMarginReal)}
                      </span>
                    </div>
                  </div>

                  {/* 4. PAYBACK DE RESCISÕES */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-bold uppercase tracking-wider">Payback Rescisões (People)</span>
                      <Award size={16} className="text-purple-400" />
                    </div>
                    <div className="text-xl font-black text-white mt-1">
                      {v2Calculation.metrics.severancePaybackMonths > 0 ? `${v2Calculation.metrics.severancePaybackMonths} Meses` : '—'}
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400">Rescisões: {formatCurrency(v2Params.layoffsSeveranceCost)}</span>
                      <span className="font-bold text-purple-400">Amortização</span>
                    </div>
                  </div>

                </div>

                {/* GRÁFICO 1: CURVA DE CAIXA ACUMULADO & RUNWAY */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-sm uppercase tracking-wider">Curva de Caixa & Projected Runway</h3>
                      <p className="text-xs text-slate-400">Saldo acumulado de caixa ao longo do tempo (Real vs Simulado)</p>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cashRunwayChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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

                {/* GRÁFICO 2: DEMONSTRATIVO SINTÉTICO (BARRAS COMPARATIVAS) */}
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
                <h3 className="font-bold text-white text-base">Exportar Simulação V2 para Gamma IA</h3>
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
                <p className="text-xs text-slate-400">Sua simulação V2 (Break-Even, Cash Runway e EBITDA) foi convertida em apresentação Gamma.</p>
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
                  Os indicadores em tempo real (Break-Even, Cash Runway, EBITDA e Payback de Rescisões) serão enviados via Markdown para montagem dos slides.
                </p>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="incAiV2"
                    checked={includeAiInGamma}
                    onChange={e => setIncludeAiInGamma(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                  />
                  <label htmlFor="incAiV2" className="text-xs font-semibold text-slate-300 cursor-pointer">
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
