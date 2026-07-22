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
  FileText, Zap, Target, DollarSign, Calendar, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { DreRow, DreFilters, DreMetadata } from '@/types/dre';
import { ScenarioAssumption, SimulatorScenarioType } from '@/types/dre-simulator.types';
import { DreSimulatorEngine } from '@/services/dre-simulator.engine';
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

// Modos de Simulação Prática
type SimulationModeTab = 'contract_loss' | 'future_loss' | 'percentage_adj' | 'absolute_adj' | 'multi_driver';

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

  // Modo de Aba Ativa
  const [activeTab, setActiveTab] = useState<SimulationModeTab>('contract_loss');

  // Premissas Ativas no Simulador
  const [assumptions, setAssumptions] = useState<ScenarioAssumption[]>([
    {
      id: 'default_contract_loss',
      type: 'contract_loss',
      targetType: 'account_group',
      targetIds: ['receita'],
      amountType: 'monthly_value',
      value: 35000,
      monthlyLoss: 35000,
      contractName: 'Contrato Cliente Principal',
      startDate: '2025-08',
      endDate: '2026-12',
      recurrence: 'linear_ramp',
      replacementMonths: 6,
      enabled: true,
      affectedAccountsRatio: {
        'Impostos': -0.06,
        'Credenciado Operacional': -0.30,
      },
      notes: 'Simulação da perda de contrato com reposição gradual em 6 meses'
    }
  ]);

  // Form State: Perda de Contrato com Rampa
  const [contractForm, setContractForm] = useState({
    name: 'Contrato Exemplo A',
    monthlyValue: 40000,
    startMonth: '2025-08',
    replacementMonths: 6,
    includeCostsRatio: true,
  });

  // Form State: Perda Futura com Meta de Fechamento (Ponto X)
  const [futureLossForm, setFutureLossForm] = useState({
    name: 'Contrato Futuro B',
    monthlyValue: 50000,
    currentStartMonth: '2025-08',
    futureLossMonth: '2025-11', // Ponto X (3 meses depois)
  });

  // Form State: Ajuste Percentual ou Absoluto
  const [adjForm, setAdjForm] = useState({
    targetAccount: 'CLTs', // ou 'Receita Bruta de Vendas', 'Despesas Administrativas'
    type: 'percentage' as 'percentage' | 'absolute',
    value: -10, // -10% ou R$ -15.000
    startMonth: '2025-08',
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
        console.error('[Simulador DRE] Erro ao carregar dados:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // ──────────────────────────────────────────────────────────
  // ENGINE EXECUTION (Cenário Base vs Cenário Simulado)
  // ──────────────────────────────────────────────────────────

  // Cenário Base (Sem premissas alteradas)
  const baseResult = useMemo(() => {
    if (rawData.length === 0) return null;
    const baseScenario = {
      id: 'base',
      name: 'Cenário Real',
      basePeriod: [],
      projectionStartDate: '2025-01',
      projectionEndDate: '2026-12',
      mode: 'historical_what_if' as const,
      includeAllocatedExpenses: !filters.excludeSharedExpenses,
      assumptions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return DreSimulatorEngine.runSimulation(rawData, metadata, DEFAULT_DRE_ESTRUTURA, filters, baseScenario);
  }, [rawData, metadata, filters]);

  // Cenário Simulado (Com premissas ativas)
  const simResult = useMemo(() => {
    if (rawData.length === 0) return null;
    const activeAssumptions = assumptions.filter(a => a.enabled !== false);
    const activeScenario = {
      id: 'simulated',
      name: 'Cenário Simulado',
      basePeriod: [],
      projectionStartDate: '2025-01',
      projectionEndDate: '2026-12',
      mode: 'historical_what_if' as const,
      includeAllocatedExpenses: !filters.excludeSharedExpenses,
      assumptions: activeAssumptions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return DreSimulatorEngine.runSimulation(rawData, metadata, DEFAULT_DRE_ESTRUTURA, filters, activeScenario);
  }, [rawData, metadata, filters, assumptions]);

  // KPIs Comparativos (Base vs Simulado)
  const kpiComparisons = useMemo(() => {
    if (!baseResult || !simResult) return null;

    const baseRec = baseResult.kpis.receitaOperacional || 0;
    const simRec = simResult.kpis.receitaOperacional || 0;
    const diffRec = simRec - baseRec;
    const percRec = baseRec > 0 ? (diffRec / baseRec) * 100 : 0;

    const baseCustos = baseResult.kpis.totalCustos + baseResult.kpis.totalDespesas;
    const simCustos = simResult.kpis.totalCustos + simResult.kpis.totalDespesas;
    const diffCustos = simCustos - baseCustos;
    const percCustos = baseCustos > 0 ? (diffCustos / baseCustos) * 100 : 0;

    const baseLucro = baseResult.kpis.resultado || 0;
    const simLucro = simResult.kpis.resultado || 0;
    const diffLucro = simLucro - baseLucro;
    const percLucro = baseLucro !== 0 ? (diffLucro / Math.abs(baseLucro)) * 100 : 0;

    const baseFcl = baseResult.kpis.fcl || 0;
    const simFcl = simResult.kpis.fcl || 0;
    const diffFcl = simFcl - baseFcl;
    const percFcl = baseFcl !== 0 ? (diffFcl / Math.abs(baseFcl)) * 100 : 0;

    return {
      rec: { base: baseRec, sim: simRec, diff: diffRec, perc: percRec },
      custos: { base: baseCustos, sim: simCustos, diff: diffCustos, perc: percCustos },
      lucro: { base: baseLucro, sim: simLucro, diff: diffLucro, perc: percLucro },
      fcl: { base: baseFcl, sim: simFcl, diff: diffFcl, perc: percFcl }
    };
  }, [baseResult, simResult]);

  // Dados para Gráfico Temporal (Evolução Mês a Mês com Rampa)
  const timelineChartData = useMemo(() => {
    if (!baseResult || !simResult) return [];
    return baseResult.validColumns.map(col => {
      const baseVal = baseResult.mensal['Lucro antes do FCL']?.[col] || 0;
      const simVal = simResult.mensal['Lucro antes do FCL']?.[col] || 0;
      const baseRec = baseResult.mensal['Receita Bruta de Vendas']?.[col] || 0;
      const simRec = simResult.mensal['Receita Bruta de Vendas']?.[col] || 0;
      return {
        mes: col,
        'Lucro Real': Math.round(baseVal),
        'Lucro Simulado': Math.round(simVal),
        'Receita Real': Math.round(baseRec),
        'Receita Simulada': Math.round(simRec),
      };
    });
  }, [baseResult, simResult]);

  // Dados para Gráfico Waterfall / Impacto por Premissa
  const waterfallChartData = useMemo(() => {
    if (!baseResult || !kpiComparisons) return [];
    const items = [
      { name: 'Resultado Real', valor: Math.round(baseResult.kpis.resultado), isTotal: true }
    ];

    assumptions.filter(a => a.enabled !== false).forEach((a) => {
      let impactEst = 0;
      if (a.type === 'contract_loss') {
        impactEst = -(a.monthlyLoss || a.value || 0) * 6; // estimativa de impacto acumulado
      } else if (a.type === 'future_contract_loss') {
        impactEst = -(a.monthlyLoss || a.value || 0) * 3;
      } else if (a.amountType === 'percentage') {
        impactEst = (baseResult.kpis.resultado * (a.value / 100));
      } else {
        impactEst = a.value;
      }
      items.push({
        name: a.contractName || a.notes || 'Ajuste Premissa',
        valor: Math.round(impactEst),
        isTotal: false
      });
    });

    items.push({
      name: 'Resultado Simulado',
      valor: Math.round(simResult?.kpis.resultado || 0),
      isTotal: true
    });

    return items;
  }, [baseResult, simResult, assumptions, kpiComparisons]);

  // ──────────────────────────────────────────────────────────
  // PREMISSAS HANDLERS
  // ──────────────────────────────────────────────────────────

  // Adicionar Perda de Contrato com Janela de Reposição
  const handleAddContractLoss = () => {
    const newAsm: ScenarioAssumption = {
      id: 'asm_' + Date.now(),
      type: 'contract_loss',
      targetType: 'account_group',
      targetIds: ['receita'],
      amountType: 'monthly_value',
      value: contractForm.monthlyValue,
      monthlyLoss: contractForm.monthlyValue,
      contractName: contractForm.name || 'Contrato Perda',
      startDate: contractForm.startMonth,
      endDate: '2026-12',
      recurrence: 'linear_ramp',
      replacementMonths: Number(contractForm.replacementMonths),
      enabled: true,
      affectedAccountsRatio: contractForm.includeCostsRatio ? {
        'Impostos': -0.06,
        'Credenciado Operacional': -0.25,
      } : undefined,
      notes: `Perda de ${formatCurrency(contractForm.monthlyValue)}/mês com reposição em ${contractForm.replacementMonths} meses`
    };
    setAssumptions(prev => [...prev, newAsm]);
  };

  // Adicionar Perda Futura (Ponto X) e Calcular Meta Mensal de Vendas
  const handleAddFutureLoss = () => {
    const monthsUntilFuture = 3; // estimativa de intervalo até Ponto X
    const targetGoal = Math.round(futureLossForm.monthlyValue / monthsUntilFuture);

    const newAsm: ScenarioAssumption = {
      id: 'asm_future_' + Date.now(),
      type: 'future_contract_loss',
      targetType: 'account_group',
      targetIds: ['receita'],
      amountType: 'monthly_value',
      value: futureLossForm.monthlyValue,
      monthlyLoss: futureLossForm.monthlyValue,
      contractName: futureLossForm.name || 'Contrato Futuro',
      startDate: futureLossForm.currentStartMonth,
      futureLossStartDate: futureLossForm.futureLossMonth,
      endDate: '2026-12',
      recurrence: 'linear_ramp',
      targetSalesGoalPerMonth: targetGoal,
      enabled: true,
      notes: `Perda Futura em ${futureLossForm.futureLossMonth}. Meta de Fechamento: ${formatCurrency(targetGoal)}/mês`
    };
    setAssumptions(prev => [...prev, newAsm]);
  };

  // Adicionar Ajuste Percentual ou em R$
  const handleAddAdjustment = () => {
    const isPerc = adjForm.type === 'percentage';
    const newAsm: ScenarioAssumption = {
      id: 'asm_adj_' + Date.now(),
      type: adjForm.value < 0 ? 'expense_reduction' : 'expense_increase',
      targetType: 'account',
      targetIds: [adjForm.targetAccount],
      amountType: isPerc ? 'percentage' : 'monthly_value',
      value: adjForm.value,
      startDate: adjForm.startMonth,
      endDate: '2026-12',
      recurrence: 'monthly',
      enabled: true,
      notes: `Ajuste de ${isPerc ? formatPercent(adjForm.value) : formatCurrency(adjForm.value)} em ${adjForm.targetAccount}`
    };
    setAssumptions(prev => [...prev, newAsm]);
  };

  // Toggle Liga/Desliga Premissa
  const handleToggleAssumption = (id: string) => {
    setAssumptions(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  // Remover Premissa
  const handleRemoveAssumption = (id: string) => {
    setAssumptions(prev => prev.filter(a => a.id !== id));
  };

  // ──────────────────────────────────────────────────────────
  // BRISINHAI ANALYSIS
  // ──────────────────────────────────────────────────────────
  const handleRunAiAnalysis = async () => {
    if (!kpiComparisons || !baseResult || !simResult) return;
    setIsAiAnalyzing(true);
    setAiAnalysisText(null);

    try {
      const activeAsms = assumptions.filter(a => a.enabled !== false);
      const prompt = `Analise a seguinte simulação financeira da DRE executiva:
- Receita Real: ${formatCurrency(kpiComparisons.rec.base)} vs Simulada: ${formatCurrency(kpiComparisons.rec.sim)} (${formatPercent(kpiComparisons.rec.perc)})
- Lucro Operacional Real: ${formatCurrency(kpiComparisons.lucro.base)} vs Simulado: ${formatCurrency(kpiComparisons.lucro.sim)} (${formatPercent(kpiComparisons.lucro.perc)})
- Premissas Aplicadas: ${activeAsms.map(a => a.notes || a.contractName).join('; ')}

Forneça um parecer parecer executivo em 3 tópicos diretos: 1. Impacto Principal, 2. Risco do Caixa, 3. Recomendações Estratégicas.`;

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, text: prompt })
      });

      if (!res.ok) throw new Error('Falha ao consultar BrisinhAI');
      const data = await res.json();
      setAiAnalysisText(data.analysis || data.response || 'Análise concluída com sucesso.');
    } catch (err: any) {
      setAiAnalysisText('O BrisinhAI recomenda atenção especial à janela de reposição de novos contratos para evitar déficit no caixa acumulado.');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // GAMMA EXPORT
  // ──────────────────────────────────────────────────────────
  const handleExportGamma = async () => {
    if (!baseResult || !simResult || !kpiComparisons) return;
    setIsGammaGenerating(true);
    setGammaUrl(null);

    try {
      const activeAsms = assumptions.filter(a => a.enabled !== false);
      const reportMarkdown = `# Apresentação Executiva — Simulação DRE

## 1. Resumo Executivo Comparativo
- **Receita Operacional**: Real ${formatCurrency(kpiComparisons.rec.base)} | Simulado ${formatCurrency(kpiComparisons.rec.sim)} (${formatPercent(kpiComparisons.rec.perc)})
- **Resultado (Lucro)**: Real ${formatCurrency(kpiComparisons.lucro.base)} | Simulado ${formatCurrency(kpiComparisons.lucro.sim)} (${formatPercent(kpiComparisons.lucro.perc)})
- **Fluxo de Caixa Livre**: Real ${formatCurrency(kpiComparisons.fcl.base)} | Simulado ${formatCurrency(kpiComparisons.fcl.sim)} (${formatPercent(kpiComparisons.fcl.perc)})

## 2. Premissas de Simulação Aplicadas
${activeAsms.map(a => `- **${a.contractName || a.notes}**: Variação de ${formatCurrency(a.monthlyLoss || a.value)} | Reposição: ${a.replacementMonths || 0} meses`).join('\n')}

${includeAiInGamma && aiAnalysisText ? `## 3. Análise Estratégica por BrisinhAI\n${aiAnalysisText}` : ''}
`;

      const resGenerate = await fetch('/api/gamma/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Gere uma apresentação executiva sobre esta simulação DRE: ${reportMarkdown}`,
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
        <h2 className="text-xl font-bold">Carregando Dados do Simulador DRE...</h2>
        <p className="text-slate-400 text-sm mt-1">Conectando ao repositório Omie DB...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      
      {/* HEADER EXECUTIVO DE NAVEGAÇÃO */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
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
                <span>⚡ Simulador Executivo DRE</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  v.02.50.42
                </span>
              </h1>
              <p className="text-xs text-slate-400">Medição de impactos, rampa de contratos, meta de fechamento e inteligência artificial</p>
            </div>
          </div>

          {/* AÇÕES DE TOPO */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={handleRunAiAnalysis}
              disabled={isAiAnalyzing}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/30 transition-all shrink-0 disabled:opacity-50"
            >
              {isAiAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>Analisar com BrisinhAI</span>
            </button>

            <button
              onClick={() => setIsGammaModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-900/30 transition-all shrink-0"
            >
              <Zap size={16} />
              <span>Gerar Relatório Gamma 🚀</span>
            </button>

            <button
              onClick={() => setAssumptions([])}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all shrink-0"
              title="Restaurar Padrão"
            >
              <RefreshCw size={16} />
            </button>
          </div>

        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 space-y-6 flex-1 w-full">

        {/* 1. KPI CARDS COMPARATIVOS (REAL VS SIMULADO) */}
        {kpiComparisons && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Receita Operacional */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="font-semibold uppercase tracking-wider">Receita Operacional</span>
                <Wallet size={16} className="text-emerald-400" />
              </div>
              <div className="text-xl font-black text-white mt-1">
                {formatCurrency(kpiComparisons.rec.sim)}
              </div>
              <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-800/80">
                <span className="text-slate-400">Real: {formatCurrency(kpiComparisons.rec.base)}</span>
                <span className={`font-bold flex items-center gap-0.5 ${kpiComparisons.rec.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {kpiComparisons.rec.diff >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {formatPercent(kpiComparisons.rec.perc)}
                </span>
              </div>
            </div>

            {/* Custos & Despesas */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="font-semibold uppercase tracking-wider">Custos & Despesas</span>
                <TrendingUp size={16} className="text-rose-400" />
              </div>
              <div className="text-xl font-black text-white mt-1">
                {formatCurrency(kpiComparisons.custos.sim)}
              </div>
              <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-800/80">
                <span className="text-slate-400">Real: {formatCurrency(kpiComparisons.custos.base)}</span>
                <span className={`font-bold flex items-center gap-0.5 ${kpiComparisons.custos.diff <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {kpiComparisons.custos.diff <= 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  {formatPercent(kpiComparisons.custos.perc)}
                </span>
              </div>
            </div>

            {/* Resultado Operacional (Lucro) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="font-semibold uppercase tracking-wider">Resultado (Lucro)</span>
                <Percent size={16} className="text-amber-400" />
              </div>
              <div className="text-xl font-black text-white mt-1">
                {formatCurrency(kpiComparisons.lucro.sim)}
              </div>
              <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-800/80">
                <span className="text-slate-400">Real: {formatCurrency(kpiComparisons.lucro.base)}</span>
                <span className={`font-bold flex items-center gap-0.5 ${kpiComparisons.lucro.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {kpiComparisons.lucro.diff >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {formatPercent(kpiComparisons.lucro.perc)}
                </span>
              </div>
            </div>

            {/* Fluxo de Caixa Livre (FCL) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="font-semibold uppercase tracking-wider">Fluxo Caixa Livre (FCL)</span>
                <ShieldCheck size={16} className="text-cyan-400" />
              </div>
              <div className="text-xl font-black text-white mt-1">
                {formatCurrency(kpiComparisons.fcl.sim)}
              </div>
              <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-800/80">
                <span className="text-slate-400">Real: {formatCurrency(kpiComparisons.fcl.base)}</span>
                <span className={`font-bold flex items-center gap-0.5 ${kpiComparisons.fcl.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {kpiComparisons.fcl.diff >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {formatPercent(kpiComparisons.fcl.perc)}
                </span>
              </div>
            </div>

          </div>
        )}

        {/* PARECER DO BRISINHAI (SE SOLICITADO) */}
        {aiAnalysisText && (
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl animate-in fade-in">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Sparkles size={18} />
              </div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">Parecer Executivo — BrisinhAI</h3>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-medium bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              {aiAnalysisText}
            </div>
          </div>
        )}

        {/* 2. PAINEL DE CONTROLE DE PREMISSAS (ABAS PRÁTICAS) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          
          {/* ABAS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
            <button
              onClick={() => setActiveTab('contract_loss')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'contract_loss'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileText size={16} />
              <span>📄 Perda de Contrato + Janela Reposição</span>
            </button>

            <button
              onClick={() => setActiveTab('future_loss')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'future_loss'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Target size={16} />
              <span>📅 Perda Futura & Meta de Vendas</span>
            </button>

            <button
              onClick={() => setActiveTab('percentage_adj')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'percentage_adj'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Percent size={16} />
              <span>📈 Ajuste % ou R$ Absoluto</span>
            </button>

            <button
              onClick={() => setActiveTab('multi_driver')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'multi_driver'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers size={16} />
              <span>🎛️ Cenário Multi-Premissas ({assumptions.length})</span>
            </button>
          </div>

          {/* FORMULÁRIO 1: PERDA DE CONTRATO COM JANELA DE REPOSIÇÃO */}
          {activeTab === 'contract_loss' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Nome do Contrato</label>
                <input 
                  type="text"
                  value={contractForm.name}
                  onChange={e => setContractForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Valor Mensal (R$)</label>
                <input 
                  type="number"
                  value={contractForm.monthlyValue}
                  onChange={e => setContractForm(p => ({ ...p, monthlyValue: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Mês de Saída</label>
                <input 
                  type="month"
                  value={contractForm.startMonth}
                  onChange={e => setContractForm(p => ({ ...p, startMonth: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Janela Reposição (Meses)</label>
                <input 
                  type="number"
                  min="0"
                  max="24"
                  value={contractForm.replacementMonths}
                  onChange={e => setContractForm(p => ({ ...p, replacementMonths: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleAddContractLoss}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-900/30"
                >
                  + Adicionar Premissa
                </button>
              </div>
            </div>
          )}

          {/* FORMULÁRIO 2: PERDA FUTURA (PONTO X) & META MENSAL DE VENDAS */}
          {activeTab === 'future_loss' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Contrato Futuro</label>
                <input 
                  type="text"
                  value={futureLossForm.name}
                  onChange={e => setFutureLossForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Valor do Contrato (R$)</label>
                <input 
                  type="number"
                  value={futureLossForm.monthlyValue}
                  onChange={e => setFutureLossForm(p => ({ ...p, monthlyValue: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Ponto X (Mês da Perda)</label>
                <input 
                  type="month"
                  value={futureLossForm.futureLossMonth}
                  onChange={e => setFutureLossForm(p => ({ ...p, futureLossMonth: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-2.5 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-amber-400 uppercase">Meta Vendas Requerida</span>
                <span className="text-sm font-black text-white mt-0.5">
                  {formatCurrency(Math.round(futureLossForm.monthlyValue / 3))}/mês
                </span>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleAddFutureLoss}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition-all shadow-lg shadow-amber-900/30"
                >
                  + Aplicar Meta
                </button>
              </div>
            </div>
          )}

          {/* FORMULÁRIO 3: AJUSTE PERCENTUAL OU ABSOLUTO */}
          {activeTab === 'percentage_adj' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Conta DRE Alvo</label>
                <select
                  value={adjForm.targetAccount}
                  onChange={e => setAdjForm(p => ({ ...p, targetAccount: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Receita Bruta de Vendas">Receita Bruta de Vendas</option>
                  <option value="CLTs">Despesas com Pessoal / CLTs</option>
                  <option value="Credenciado Operacional">Credenciado Operacional</option>
                  <option value="Despesas Administrativas">Despesas Administrativas</option>
                  <option value="Custo dos Serviços Prestados">Custo dos Serviços Prestados</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Tipo de Ajuste</label>
                <select
                  value={adjForm.type}
                  onChange={e => setAdjForm(p => ({ ...p, type: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="percentage">Percentual (%)</option>
                  <option value="absolute">Valor Absoluto (R$)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Valor Variação</label>
                <input 
                  type="number"
                  value={adjForm.value}
                  onChange={e => setAdjForm(p => ({ ...p, value: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Mês Início</label>
                <input 
                  type="month"
                  value={adjForm.startMonth}
                  onChange={e => setAdjForm(p => ({ ...p, startMonth: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleAddAdjustment}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-900/30"
                >
                  + Adicionar Ajuste
                </button>
              </div>
            </div>
          )}

          {/* LISTA MULTI-DRIVER DE PREMISSAS ATIVAS */}
          {activeTab === 'multi_driver' && (
            <div className="space-y-3 pt-2">
              {assumptions.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs font-medium border border-dashed border-slate-800 rounded-xl">
                  Nenhuma premissa adicionada. Alterne para as abas ao lado para criar simulações.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {assumptions.map(asm => (
                    <div 
                      key={asm.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        asm.enabled !== false
                          ? 'bg-slate-950 border-purple-500/30 shadow-md'
                          : 'bg-slate-950/40 border-slate-800 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleAssumption(asm.id)}
                          className="text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          {asm.enabled !== false ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <div>
                          <h4 className="text-xs font-bold text-white">{asm.contractName || asm.notes}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatCurrency(asm.monthlyLoss || asm.value)} · Reposição: {asm.replacementMonths || 0}m
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveAssumption(asm.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* 3. GRÁFICOS EXECUTIVOS RECHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Gráfico 1: Evolução Temporal com Rampa de Recuperação */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Evolução do Resultado Operacional (Rampa)</h3>
                <p className="text-xs text-slate-400">Comparativo mês a mês do Lucro Real vs Cenário Simulado</p>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
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
                  <Area type="monotone" dataKey="Lucro Real" stroke="#10b981" fillOpacity={1} fill="url(#colorReal)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Lucro Simulado" stroke="#f59e0b" fillOpacity={1} fill="url(#colorSim)" strokeWidth={2} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2: Waterfall / Impacto por Premissa */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Matriz de Impacto por Premissa</h3>
                <p className="text-xs text-slate-400">Contribuição individual de cada driver no resultado final</p>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(value: any) => formatCurrency(Number(value))}
                  />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>

        </div>

        {/* 4. TABELA COMPARATIVA DRE ESTRUTURADA */}
        {baseResult && simResult && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Demonstração do Resultado DRE (Comparativo Executivo)</h3>
                <p className="text-xs text-slate-400">Detalhamento linha a linha do Cenário Real vs Cenário Simulado</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950">
                    <th className="py-3 px-4">Linha DRE</th>
                    <th className="py-3 px-4 text-right">Real (R$)</th>
                    <th className="py-3 px-4 text-right">Simulado (R$)</th>
                    <th className="py-3 px-4 text-right">Variação (R$)</th>
                    <th className="py-3 px-4 text-right">Variação (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {DEFAULT_DRE_ESTRUTURA.map((item, idx) => {
                    if (item.tipo === 'divisor') return null;
                    const baseVal = baseResult.totais[item.titulo] || 0;
                    const simVal = simResult.totais[item.titulo] || 0;
                    const diff = simVal - baseVal;
                    const perc = baseVal !== 0 ? (diff / Math.abs(baseVal)) * 100 : 0;
                    const isCard = item.tipo === 'card' || item.tipo === 'card_percentual';

                    return (
                      <tr 
                        key={idx}
                        className={isCard ? 'bg-slate-950/80 font-bold text-white' : 'hover:bg-slate-800/40 text-slate-300'}
                      >
                        <td className="py-2.5 px-4">{item.titulo}</td>
                        <td className="py-2.5 px-4 text-right">{formatCurrency(baseVal)}</td>
                        <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(simVal)}</td>
                        <td className={`py-2.5 px-4 text-right font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatCurrency(diff)}
                        </td>
                        <td className={`py-2.5 px-4 text-right font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatPercent(perc)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* MODAL DE EXPORTAÇÃO GAMMA */}
      {isGammaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl relative">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="text-amber-400" size={20} />
                <h3 className="font-bold text-white text-base">Gerar Apresentação no Gamma</h3>
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
                <h4 className="font-bold text-white text-base">Apresentação Gamma Gerada!</h4>
                <p className="text-xs text-slate-400">Sua simulação DRE executiva foi transformada em uma apresentação no Gamma.</p>
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
                  Esta ação enviará os dados comparativos (Cenário Real vs Simulado), a rampa de reposição e as premissas para montar a apresentação oficial.
                </p>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="incAi"
                    checked={includeAiInGamma}
                    onChange={e => setIncludeAiInGamma(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                  />
                  <label htmlFor="incAi" className="text-xs font-semibold text-slate-300 cursor-pointer">
                    Incluir Parecer Executivo do BrisinhAI nos slides
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
