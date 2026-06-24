'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X, TrendingUp, TrendingDown, Scissors, Target, Zap, RotateCcw,
  ChevronRight, AlertTriangle, Loader2, Sparkles, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Building2, Calendar, BarChart2, GitFork, Info,
  CheckCircle2, ArrowDownRight, ArrowUpRight, Clock, DollarSign,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell, BarChart, ReferenceLine,
} from 'recharts';
import {
  DreCalculatedResult, DreSimulationParams, DreAdvancedSimParams,
  RevenueRecoveryPoint, DreRow, DreMetadata,
} from '@/types/dre';

// ─── Paleta & Formatação ──────────────────────────────────────────────────────
const PAL = {
  receita: '#10b981',
  saidas: '#f43f5e',
  fcl: '#3b82f6',
  custos: '#f59e0b',
  despesas: '#6366f1',
  sim: '#f97316',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtK = (v: number) => `${(v / 1000).toFixed(0)}k`;
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

// ─── Tipos de Cenários Rápidos ────────────────────────────────────────────────
type TabId = 'cenarios' | 'granular' | 'reposicao' | 'projecao';

interface ScenarioButton {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  defaultValue: number;
  type: DreAdvancedSimParams['scenarioType'];
}

const SCENARIOS: ScenarioButton[] = [
  {
    id: 'rev_up', label: 'Crescimento de Receita', sublabel: 'Simula novo contrato ou expansão',
    icon: <TrendingUp size={20} />, color: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200 hover:border-emerald-400',
    defaultValue: 10, type: 'revenue_increase',
  },
  {
    id: 'rev_down', label: 'Queda de Receita', sublabel: 'Perda parcial de faturamento',
    icon: <TrendingDown size={20} />, color: 'bg-rose-50 text-rose-700', border: 'border-rose-200 hover:border-rose-400',
    defaultValue: -15, type: 'revenue_decrease',
  },
  {
    id: 'costs_cut', label: 'Corte de Custos Op.', sublabel: 'Redução em credenciados, CLTs, terceiros',
    icon: <Scissors size={20} />, color: 'bg-amber-50 text-amber-700', border: 'border-amber-200 hover:border-amber-400',
    defaultValue: -20, type: 'costs_cut',
  },
  {
    id: 'exp_cut', label: 'Redução de Despesas', sublabel: 'Corte nas despesas rateadas/admin',
    icon: <Scissors size={20} />, color: 'bg-indigo-50 text-indigo-700', border: 'border-indigo-200 hover:border-indigo-400',
    defaultValue: -25, type: 'expenses_cut',
  },
  {
    id: 'contract_loss', label: 'Perda de Contrato', sublabel: 'Rescisão de um departamento/projeto',
    icon: <AlertTriangle size={20} />, color: 'bg-orange-50 text-orange-700', border: 'border-orange-200 hover:border-orange-400',
    defaultValue: -100, type: 'contract_loss',
  },
  {
    id: 'goal_seek', label: 'Meta de FCL', sublabel: 'Quanto preciso para atingir X de FCL?',
    icon: <Target size={20} />, color: 'bg-blue-50 text-blue-700', border: 'border-blue-200 hover:border-blue-400',
    defaultValue: 0, type: 'goal_seek',
  },
];

// ─── AI Questions ─────────────────────────────────────────────────────────────
const AI_QUESTIONS = [
  { id: 'risk', label: 'Qual o risco deste cenário?', icon: '⚠️' },
  { id: 'breakeven', label: 'Qual o ponto de equilíbrio?', icon: '⚖️' },
  { id: 'recovery', label: 'Estratégia de recuperação', icon: '🔄' },
  { id: 'cashflow', label: 'Impacto no fluxo de caixa', icon: '💸' },
  { id: 'actions', label: 'Ações recomendadas', icon: '🎯' },
  { id: 'timeline', label: 'Prazo para normalização', icon: '📅' },
];

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface DreSimulatorV2Props {
  isOpen: boolean;
  onClose: () => void;
  originalResults: DreCalculatedResult | null;
  simulatedResults: DreCalculatedResult | null;
  rawData: DreRow[];
  metadata: DreMetadata | null;
  onParamsChange: (params: DreSimulationParams) => void;
  empresaContext: string;
  periodoContext: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function addMonths(baseYYMM: string, n: number): string {
  // baseYYMM = "Jun/26"
  const [mesStr, anoStr] = baseYYMM.split('/');
  const mesIdx = MESES_PT.findIndex(m => m.toLowerCase() === mesStr.toLowerCase());
  if (mesIdx === -1) return baseYYMM;
  const ano = 2000 + parseInt(anoStr);
  const totalMonths = ano * 12 + mesIdx + n;
  const newAno = Math.floor(totalMonths / 12);
  const newMes = totalMonths % 12;
  return `${MESES_PT[newMes]}/${String(newAno).slice(-2)}`;
}

function computeRecovery(
  avgMonthlyLoss: number,
  lastDataMonth: string,
  rescisaoDateStr: string,
  numMonths: number
): RevenueRecoveryPoint[] {
  const points: RevenueRecoveryPoint[] = [];
  const totalToRecover = avgMonthlyLoss * numMonths;
  const metaMensal = totalToRecover / numMonths;

  for (let i = 1; i <= numMonths; i++) {
    const mes = addMonths(lastDataMonth, i);
    const acumulado = metaMensal * i;
    const aReconquistar = Math.max(0, totalToRecover - acumulado);
    const percAcumulado = Math.min(100, (acumulado / totalToRecover) * 100);
    points.push({
      mes,
      receitaBase: avgMonthlyLoss,
      impactoMensal: avgMonthlyLoss,
      aReconquistar,
      metaMensal,
      percAcumulado,
    });
  }
  return points;
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export function DreSimulatorV2({
  isOpen,
  onClose,
  originalResults,
  simulatedResults,
  rawData,
  metadata,
  onParamsChange,
  empresaContext,
  periodoContext,
}: DreSimulatorV2Props) {
  const [activeTab, setActiveTab] = useState<TabId>('cenarios');

  // Cenário rápido
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [impactMode, setImpactMode] = useState<'percent' | 'absolute'>('percent');
  const [impactValue, setImpactValue] = useState<number>(10);
  const [includeRateio, setIncludeRateio] = useState(true);

  // Granular
  const [granularMode, setGranularMode] = useState(false);
  const [revenueSlider, setRevenueSlider] = useState(1.0);
  const [costsSlider, setCostsSlider] = useState(1.0);
  const [expensesSlider, setExpensesSlider] = useState(1.0);
  const [taxesSlider, setTaxesSlider] = useState(1.0);
  const [investSlider, setInvestSlider] = useState(1.0);

  // Goal Seek
  const [goalFcl, setGoalFcl] = useState('');

  // Contrato perdido
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [rescisaoDate, setRescisaoDate] = useState<string>('');
  const [numMonths, setNumMonths] = useState<number>(6);

  // IA
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Projeção
  const [showOriginal, setShowOriginal] = useState(true);

  const originalKpis = originalResults?.kpis;
  const simulatedKpis = simulatedResults?.kpis;

  // Reset ao abrir/fechar
  useEffect(() => {
    if (!isOpen) return;
    setSelectedScenario(null);
    setImpactValue(10);
    setImpactMode('percent');
    setIncludeRateio(true);
    setGoalFcl('');
    setSelectedDept('');
    setRescisaoDate('');
    setNumMonths(6);
    setAiResponse('');
    setAiQuestion(null);
    setRevenueSlider(1.0);
    setCostsSlider(1.0);
    setExpensesSlider(1.0);
    setTaxesSlider(1.0);
    setInvestSlider(1.0);
    onParamsChange({ revenueMultiplier: 1, costsMultiplier: 1, expensesMultiplier: 1, taxesMultiplier: 1, investmentsMultiplier: 1 });
  }, [isOpen]);

  // Departamentos disponíveis
  const departamentos = useMemo(() => metadata?.departamentos || [], [metadata]);

  // Receita média mensal do departamento selecionado
  const deptAvgMonthlyRevenue = useMemo(() => {
    if (!selectedDept || !originalResults) return 0;
    const receivableCats = ['Receita Bruta de Vendas', 'Receitas Indiretas'];
    const cols = originalResults.validColumns;
    let total = 0;
    rawData.forEach(row => {
      if (row.Departamento !== selectedDept) return;
      if (!receivableCats.some(cat => row.ContaDRE?.includes('Receita') || row.Categoria?.includes('Receita'))) {
        if (!['Receita Bruta de Vendas', 'Receitas Indiretas'].includes(row.ContaDRE as string)) return;
      }
      cols.forEach(col => {
        const v = parseFloat(row[col]?.toString().replace(',', '.') || '0');
        if (!isNaN(v)) total += v;
      });
    });
    return cols.length > 0 ? total / cols.length : 0;
  }, [selectedDept, originalResults, rawData]);

  // Receita mensal perdida (do departamento ou % global)
  const monthlyLoss = useMemo(() => {
    if (!originalKpis) return 0;
    if (selectedScenario === 'contract_loss' && selectedDept) {
      return deptAvgMonthlyRevenue;
    }
    if (impactMode === 'percent') {
      return Math.abs(originalKpis.totalEntradas / (originalResults?.validColumns.length || 1) * (Math.abs(impactValue) / 100));
    }
    return Math.abs(impactValue);
  }, [selectedScenario, selectedDept, deptAvgMonthlyRevenue, originalKpis, impactMode, impactValue, originalResults]);

  // Tabela de reposição
  const recoveryPoints = useMemo((): RevenueRecoveryPoint[] => {
    if (!originalResults || monthlyLoss === 0) return [];
    const lastCol = originalResults.validColumns[originalResults.validColumns.length - 1] || 'Jun/26';
    return computeRecovery(monthlyLoss, lastCol, rescisaoDate, numMonths);
  }, [originalResults, monthlyLoss, rescisaoDate, numMonths]);

  // Aplicar cenário → atualizar params globais
  const applyScenario = useCallback((scenarioId: string, value: number, mode: 'percent' | 'absolute', withRateio: boolean) => {
    if (!originalKpis) return;
    let params: DreSimulationParams = { revenueMultiplier: 1, costsMultiplier: 1, expensesMultiplier: 1, taxesMultiplier: 1, investmentsMultiplier: 1 };

    const pct = mode === 'percent' ? value / 100 : 0;
    const absVal = mode === 'absolute' ? value : 0;

    const totalRev = originalKpis.totalEntradas || 1;
    const totalCosts = originalKpis.totalCustos || 1;
    const totalExpenses = originalKpis.totalDespesas || 1;

    switch (scenarioId) {
      case 'rev_up':
        params.revenueMultiplier = mode === 'percent' ? 1 + pct : 1 + (absVal / totalRev);
        break;
      case 'rev_down':
        params.revenueMultiplier = mode === 'percent' ? 1 + pct : 1 - (Math.abs(absVal) / totalRev);
        break;
      case 'costs_cut':
        params.costsMultiplier = mode === 'percent' ? 1 + pct : 1 - (Math.abs(absVal) / totalCosts);
        break;
      case 'exp_cut':
        params.expensesMultiplier = mode === 'percent' ? 1 + pct : 1 - (Math.abs(absVal) / totalExpenses);
        break;
      case 'contract_loss':
        if (selectedDept && deptAvgMonthlyRevenue > 0 && originalResults) {
          const totalRevenue = originalKpis.totalEntradas || 1;
          const deptTotal = deptAvgMonthlyRevenue * originalResults.validColumns.length;
          params.revenueMultiplier = Math.max(0, 1 - (deptTotal / totalRevenue));
        }
        break;
      case 'goal_seek':
        // Handled separately
        break;
    }

    if (!withRateio) params.expensesMultiplier = 0;
    onParamsChange(params);
    setRevenueSlider(params.revenueMultiplier);
    setCostsSlider(params.costsMultiplier);
    setExpensesSlider(params.expensesMultiplier);
    setTaxesSlider(params.taxesMultiplier);
    setInvestSlider(params.investmentsMultiplier);
  }, [originalKpis, selectedDept, deptAvgMonthlyRevenue, originalResults, onParamsChange]);

  // Aplicar granular
  const applyGranular = useCallback(() => {
    onParamsChange({
      revenueMultiplier: revenueSlider,
      costsMultiplier: costsSlider,
      expensesMultiplier: includeRateio ? expensesSlider : 0,
      taxesMultiplier: taxesSlider,
      investmentsMultiplier: investSlider,
    });
  }, [revenueSlider, costsSlider, expensesSlider, taxesSlider, investSlider, includeRateio, onParamsChange]);

  useEffect(() => {
    if (granularMode) applyGranular();
  }, [revenueSlider, costsSlider, expensesSlider, taxesSlider, investSlider, includeRateio, granularMode]);

  // Goal Seek
  const goalSeekResult = useMemo(() => {
    if (!goalFcl || !originalKpis) return null;
    const meta = parseFloat(goalFcl.replace(/\./g, '').replace(',', '.'));
    if (isNaN(meta)) return null;
    const delta = meta - originalKpis.fcl;
    const baseRev = originalKpis.totalEntradas || 1;
    const baseExp = originalKpis.totalDespesas || 1;
    const baseCosts = originalKpis.totalCustos || 1;
    return {
      meta, delta,
      revPct: (delta / baseRev) * 100,
      expPct: (delta / baseExp) * 100,
      costPct: (delta / baseCosts) * 100,
    };
  }, [goalFcl, originalKpis]);

  // IA Query
  const handleAiQuestion = async (questionId: string, questionLabel: string) => {
    if (!originalKpis || !simulatedKpis) return;
    setAiQuestion(questionId);
    setIsAiLoading(true);
    setAiResponse('');
    try {
      const res = await fetch('/api/ai/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          questionLabel,
          scenarioType: selectedScenario || 'custom',
          originalKpis,
          simulatedKpis,
          empresa: empresaContext,
          periodo: periodoContext,
          targetDepartamento: selectedDept || undefined,
          rescisaoDate: rescisaoDate || undefined,
          impactMode,
          impactValue,
          recoveryData: recoveryPoints.slice(0, 6),
        }),
      });
      const data = await res.json();
      setAiResponse(data.analysis || 'Não foi possível gerar a análise.');
    } catch {
      setAiResponse('Erro ao conectar com a IA. Tente novamente.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Delta KPI Helper
  const DeltaBadge = ({ original, simulated, invert = false }: { original: number; simulated: number; invert?: boolean }) => {
    const delta = simulated - original;
    if (Math.abs(delta) < 0.01) return <span className="text-xs text-slate-400 font-mono">—</span>;
    const isPositive = invert ? delta < 0 : delta > 0;
    return (
      <span className={`text-xs font-bold font-mono flex items-center gap-0.5 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
        {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {fmt(delta)}
      </span>
    );
  };

  // Gráfico de Evolução Comparativo
  const evolucaoData = useMemo(() => {
    if (!originalResults) return [];
    return originalResults.validColumns.map(col => ({
      name: col,
      'Receita (Original)': originalResults.mensal['Total Entradas Operacionais']?.[col] || 0,
      'Receita (Simulado)': simulatedResults?.mensal['Total Entradas Operacionais']?.[col] || 0,
      'FCL (Original)': originalResults.mensal['Fluxo de Caixa Livre FCL']?.[col] || 0,
      'FCL (Simulado)': simulatedResults?.mensal['Fluxo de Caixa Livre FCL']?.[col] || 0,
    }));
  }, [originalResults, simulatedResults]);

  // Gráfico de Reposição
  const recoveryChartData = useMemo(() => recoveryPoints.map(p => ({
    name: p.mes,
    'Meta Mensal': p.metaMensal,
    'Falta Reconquistar': p.aReconquistar,
    '% Acumulado': p.percAcumulado,
  })), [recoveryPoints]);

  const isSimulating = useMemo(() =>
    simulatedKpis && originalKpis && simulatedKpis.fcl !== originalKpis.fcl,
    [simulatedKpis, originalKpis]);

  if (!isOpen) return null;

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'cenarios', label: 'Cenários', icon: <Zap size={14} /> },
    { id: 'granular', label: 'Granular', icon: <BarChart2 size={14} /> },
    { id: 'reposicao', label: 'Reposição', icon: <Clock size={14} /> },
    { id: 'projecao', label: 'Projeção & IA', icon: <Sparkles size={14} /> },
  ];

  const tooltipStyle = { borderRadius: '10px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', fontSize: '12px' };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Overlay clickável */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />

      {/* Painel Principal */}
      <div className="w-full max-w-[780px] bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">Simulador de Cenários DRE</h2>
              <p className="text-slate-400 text-xs">{empresaContext} · {periodoContext}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSimulating && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
                Simulação Ativa
              </span>
            )}
            <button
              onClick={() => {
                onParamsChange({ revenueMultiplier: 1, costsMultiplier: 1, expensesMultiplier: 1, taxesMultiplier: 1, investmentsMultiplier: 1 });
                setSelectedScenario(null);
                setGranularMode(false);
              }}
              className="text-slate-400 hover:text-white text-xs flex items-center gap-1 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RotateCcw size={13} /> Reset
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── KPI Comparativo (sempre visível) ── */}
        {originalKpis && simulatedKpis && (
          <div className="flex-shrink-0 grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/80">
            {[
              { label: 'Receita', orig: originalKpis.totalEntradas, sim: simulatedKpis.totalEntradas },
              { label: 'Custos', orig: originalKpis.totalCustos, sim: simulatedKpis.totalCustos, invert: true },
              { label: 'Despesas', orig: originalKpis.totalDespesas, sim: simulatedKpis.totalDespesas, invert: true },
              { label: 'FCL', orig: originalKpis.fcl, sim: simulatedKpis.fcl },
            ].map(kpi => (
              <div key={kpi.label} className="px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</span>
                <span className="text-sm font-bold text-slate-700 font-mono">{fmt(kpi.sim)}</span>
                <DeltaBadge original={kpi.orig} simulated={kpi.sim} invert={kpi.invert} />
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex-shrink-0 flex border-b border-slate-200 bg-white px-2 pt-2 gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all ${activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── Conteúdo das Abas ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ══ ABA 1: CENÁRIOS RÁPIDOS ══ */}
          {activeTab === 'cenarios' && (
            <div className="p-6 space-y-6">

              {/* Toggles globais */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setIncludeRateio(!includeRateio)}
                  className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border transition-all ${includeRateio ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
                >
                  {includeRateio ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  Despesas Rateadas {includeRateio ? 'Incluídas' : 'Excluídas'}
                </button>
                <button
                  onClick={() => setImpactMode(m => m === 'percent' ? 'absolute' : 'percent')}
                  className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all"
                >
                  <DollarSign size={14} />
                  Modo: {impactMode === 'percent' ? 'Percentual (%)' : 'Valor Absoluto (R$)'}
                </button>
              </div>

              {/* Grid de Cenários */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Selecione um Cenário</p>
                <div className="grid grid-cols-2 gap-3">
                  {SCENARIOS.map(sc => (
                    <button
                      key={sc.id}
                      onClick={() => {
                        setSelectedScenario(sc.id);
                        setGranularMode(false);
                        const val = sc.defaultValue;
                        setImpactValue(val);
                        if (sc.id !== 'goal_seek') {
                          applyScenario(sc.id, val, impactMode, includeRateio);
                        }
                        if (sc.id === 'reposicao' || sc.id === 'contract_loss') setActiveTab('reposicao');
                      }}
                      className={`relative flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all ${selectedScenario === sc.id
                        ? 'border-orange-400 bg-orange-50 shadow-md scale-[1.01]'
                        : `border ${sc.border} bg-white hover:shadow-sm`
                        }`}
                    >
                      {selectedScenario === sc.id && (
                        <CheckCircle2 size={16} className="absolute top-3 right-3 text-orange-500" />
                      )}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sc.color}`}>
                        {sc.icon}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{sc.label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{sc.sublabel}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Painel de configuração do cenário selecionado */}
              {selectedScenario && selectedScenario !== 'contract_loss' && selectedScenario !== 'goal_seek' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Configurar Impacto</p>

                  {impactMode === 'percent' ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Percentual de impacto</span>
                        <span className={`font-mono font-bold text-sm px-2 py-0.5 rounded-lg ${impactValue >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {impactValue >= 0 ? '+' : ''}{impactValue}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={selectedScenario.includes('up') ? 1 : -50}
                        max={selectedScenario.includes('up') ? 50 : -1}
                        step={1}
                        value={impactValue}
                        onChange={e => {
                          const v = parseInt(e.target.value);
                          setImpactValue(v);
                          applyScenario(selectedScenario, v, 'percent', includeRateio);
                        }}
                        className="w-full accent-orange-500 h-2"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600">Valor absoluto (R$)</label>
                      <input
                        type="number"
                        value={Math.abs(impactValue)}
                        onChange={e => {
                          const v = selectedScenario.includes('up') ? Math.abs(Number(e.target.value)) : -Math.abs(Number(e.target.value));
                          setImpactValue(v);
                          applyScenario(selectedScenario, v, 'absolute', includeRateio);
                        }}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm focus:border-orange-400 outline-none"
                        placeholder="Ex: 50000"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Goal Seek Panel */}
              {selectedScenario === 'goal_seek' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Target size={18} />
                    <p className="font-bold text-sm">Definir Meta de FCL</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-bold">R$</span>
                      <input
                        type="text"
                        value={goalFcl}
                        onChange={e => setGoalFcl(e.target.value)}
                        placeholder="150.000"
                        className="w-full pl-9 pr-3 py-2.5 border-2 border-blue-200 focus:border-blue-500 rounded-xl outline-none font-mono font-bold text-slate-700 text-sm"
                      />
                    </div>
                    <div className="text-sm text-slate-500 flex items-center">
                      FCL atual: <span className="font-mono font-bold text-slate-700 ml-1">{fmt(originalKpis?.fcl || 0)}</span>
                    </div>
                  </div>

                  {goalSeekResult && (
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      {[
                        { label: 'Via Receita', pct: goalSeekResult.revPct, type: 'revenue' as const, color: 'emerald' },
                        { label: 'Via Custos', pct: -goalSeekResult.costPct, type: 'costs' as const, color: 'amber' },
                        { label: 'Via Despesas', pct: -goalSeekResult.expPct, type: 'expenses' as const, color: 'indigo' },
                      ].map(opt => (
                        <button
                          key={opt.type}
                          disabled={Math.abs(opt.pct) > 100}
                          onClick={() => {
                            const mult = opt.type === 'revenue' ? 1 + (goalSeekResult.revPct / 100)
                              : opt.type === 'costs' ? 1 - (goalSeekResult.costPct / 100)
                                : 1 - (goalSeekResult.expPct / 100);
                            const p: DreSimulationParams = { revenueMultiplier: 1, costsMultiplier: 1, expensesMultiplier: 1, taxesMultiplier: 1, investmentsMultiplier: 1 };
                            if (opt.type === 'revenue') p.revenueMultiplier = mult;
                            else if (opt.type === 'costs') p.costsMultiplier = Math.max(0, mult);
                            else p.expensesMultiplier = Math.max(0, mult);
                            onParamsChange(p);
                          }}
                          className={`flex flex-col items-center p-3 rounded-xl border text-center transition-all disabled:opacity-40 ${opt.color === 'emerald' ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' : opt.color === 'amber' ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'}`}
                        >
                          <span className="text-xs font-bold text-slate-600 mb-1">{opt.label}</span>
                          <span className={`text-base font-black font-mono ${Math.abs(opt.pct) > 100 ? 'text-slate-400' : opt.pct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {Math.abs(opt.pct) > 100 ? 'Inviável' : `${opt.pct >= 0 ? '+' : ''}${opt.pct.toFixed(1)}%`}
                          </span>
                          {Math.abs(opt.pct) <= 100 && <span className="text-[10px] text-slate-400 mt-1">Aplicar</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Contrato perdido: Ir para Reposição */}
              {selectedScenario === 'contract_loss' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                  <p className="text-sm font-bold text-orange-700 mb-2">Configure a perda do contrato na aba <strong>Reposição</strong></p>
                  <button
                    onClick={() => setActiveTab('reposicao')}
                    className="text-xs font-bold bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1 mx-auto"
                  >
                    Ir para Reposição <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══ ABA 2: GRANULAR ══ */}
          {activeTab === 'granular' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-700">Controle Granular por Categoria</p>
                  <p className="text-xs text-slate-400 mt-0.5">Ajuste cada linha do DRE individualmente</p>
                </div>
                <button
                  onClick={() => setIncludeRateio(!includeRateio)}
                  className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border transition-all ${includeRateio ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
                >
                  {includeRateio ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  Rateio {includeRateio ? 'ON' : 'OFF'}
                </button>
              </div>

              {[
                { label: 'Receitas Operacionais', val: revenueSlider, set: setRevenueSlider, color: 'emerald', min: 0.3, max: 2.0 },
                { label: 'Custos Operacionais', val: costsSlider, set: setCostsSlider, color: 'amber', min: 0.3, max: 1.5 },
                { label: 'Despesas Rateadas', val: expensesSlider, set: setExpensesSlider, color: 'indigo', min: 0, max: 1.5, disabled: !includeRateio },
                { label: 'Impostos e Taxas', val: taxesSlider, set: setTaxesSlider, color: 'rose', min: 0.5, max: 1.5 },
                { label: 'Investimentos', val: investSlider, set: setInvestSlider, color: 'slate', min: 0, max: 2.0 },
              ].map(sl => {
                const pct = Math.round((sl.val - 1) * 100);
                return (
                  <div key={sl.label} className={`bg-white border rounded-xl p-4 space-y-2 transition-opacity ${sl.disabled ? 'opacity-40' : ''}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-700">{sl.label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${pct === 0 ? 'bg-slate-100 text-slate-500' : pct > 0 && sl.label.includes('Receita') ? 'bg-emerald-100 text-emerald-700' : pct < 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {pct >= 0 ? '+' : ''}{pct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={sl.min}
                      max={sl.max}
                      step={0.01}
                      value={sl.val}
                      disabled={sl.disabled}
                      onChange={e => { sl.set(parseFloat(e.target.value)); setGranularMode(true); }}
                      className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-${sl.color}-500`}
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>{Math.round(sl.min * 100)}%</span>
                      <span>100% (Base)</span>
                      <span>{Math.round(sl.max * 100)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ ABA 3: REPOSIÇÃO DE RECEITA ══ */}
          {activeTab === 'reposicao' && (
            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm font-bold text-slate-700">Estudo de Reposição de Receita</p>
                <p className="text-xs text-slate-400 mt-0.5">Simule a perda de um contrato e veja o cronograma de reposição mensal</p>
              </div>

              {/* Configurações */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                    <Building2 size={12} className="inline mr-1" /> Departamento / Contrato Perdido
                  </label>
                  <select
                    value={selectedDept}
                    onChange={e => {
                      setSelectedDept(e.target.value);
                      if (e.target.value) {
                        setSelectedScenario('contract_loss');
                        applyScenario('contract_loss', -100, 'percent', includeRateio);
                      }
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-orange-400 outline-none bg-white"
                  >
                    <option value="">Selecione um departamento...</option>
                    {departamentos.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      <Calendar size={12} className="inline mr-1" /> Data de Rescisão (opcional)
                    </label>
                    <input
                      type="month"
                      value={rescisaoDate}
                      onChange={e => setRescisaoDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-orange-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      Meses para Reposição
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={36}
                      value={numMonths}
                      onChange={e => setNumMonths(Math.max(1, Math.min(36, parseInt(e.target.value) || 6)))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-orange-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* KPIs do departamento */}
              {selectedDept && deptAvgMonthlyRevenue > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Perda Mensal Média</p>
                    <p className="text-base font-black text-rose-700 font-mono mt-1">{fmt(deptAvgMonthlyRevenue)}</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Total a Repor</p>
                    <p className="text-base font-black text-orange-700 font-mono mt-1">{fmt(monthlyLoss * numMonths)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Meta/Mês</p>
                    <p className="text-base font-black text-blue-700 font-mono mt-1">{fmt(recoveryPoints[0]?.metaMensal || 0)}</p>
                  </div>
                </div>
              )}

              {/* Tabela de Reposição */}
              {recoveryPoints.length > 0 && (
                <>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-800 text-white">
                        <tr>
                          <th className="px-3 py-2.5 text-left font-semibold">Mês</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Meta Mensal</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Falta Reconquistar</th>
                          <th className="px-3 py-2.5 text-right font-semibold">% Acumulado</th>
                          <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recoveryPoints.map((p, i) => (
                          <tr key={p.mes} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-orange-50/50 transition-colors`}>
                            <td className="px-3 py-2.5 font-bold text-slate-700">{p.mes}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-emerald-700 font-bold">{fmt(p.metaMensal)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-rose-700">{fmt(p.aReconquistar)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-blue-700 font-bold">{p.percAcumulado.toFixed(0)}%</td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="relative bg-slate-200 rounded-full h-1.5 w-full max-w-[80px] mx-auto">
                                <div
                                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-400 to-emerald-500 rounded-full transition-all"
                                  style={{ width: `${p.percAcumulado}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Gráfico de Reposição */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider">Curva de Reposição Mensal</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={recoveryChartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="left" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v: any, name: any) => [name.includes('%') ? `${Number(v).toFixed(0)}%` : fmt(Number(v)), name] as any} contentStyle={tooltipStyle} />
                          <Bar yAxisId="left" dataKey="Meta Mensal" fill={PAL.receita} radius={[4, 4, 0, 0]} maxBarSize={30} />
                          <Bar yAxisId="left" dataKey="Falta Reconquistar" fill={PAL.saidas} radius={[4, 4, 0, 0]} maxBarSize={30} />
                          <Line yAxisId="right" type="monotone" dataKey="% Acumulado" stroke={PAL.fcl} strokeWidth={2.5} dot={{ r: 3, fill: PAL.fcl }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Aviso retrospectivo */}
                  {!rescisaoDate && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <Info size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700">
                        <strong>Modo Retrospectivo:</strong> Sem data de rescisão, o simulador mostra como os meses passados teriam sido sem este contrato, e o cronograma parte do último mês disponível nos dados.
                      </p>
                    </div>
                  )}
                </>
              )}

              {!selectedDept && (
                <div className="text-center py-10 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                  <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                  Selecione um departamento acima para gerar o estudo de reposição
                </div>
              )}
            </div>
          )}

          {/* ══ ABA 4: PROJEÇÃO & IA ══ */}
          {activeTab === 'projecao' && (
            <div className="p-6 space-y-6">

              {/* Gráfico Comparativo */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Evolução: Original vs. Simulado</p>
                  <button
                    onClick={() => setShowOriginal(!showOriginal)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                  >
                    {showOriginal ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {showOriginal ? 'Ocultar' : 'Exibir'} Original
                  </button>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={evolucaoData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: any, name: any) => [fmt(Number(v)), name] as any} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                      {showOriginal && <Bar dataKey="Receita (Original)" fill={PAL.receita} fillOpacity={0.4} radius={[3, 3, 0, 0]} maxBarSize={20} />}
                      <Bar dataKey="Receita (Simulado)" fill={PAL.sim} radius={[3, 3, 0, 0]} maxBarSize={20} />
                      {showOriginal && <Line type="monotone" dataKey="FCL (Original)" stroke={PAL.fcl} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />}
                      <Line type="monotone" dataKey="FCL (Simulado)" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: '#f97316' }} />
                      {!isSimulating && <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Resumo de Impacto */}
              {originalKpis && simulatedKpis && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Variação de Receita', orig: originalKpis.totalEntradas, sim: simulatedKpis.totalEntradas, positive: true },
                    { label: 'Variação de Custos', orig: originalKpis.totalCustos, sim: simulatedKpis.totalCustos, positive: false },
                    { label: 'Variação de Despesas', orig: originalKpis.totalDespesas, sim: simulatedKpis.totalDespesas, positive: false },
                    { label: 'Variação do FCL', orig: originalKpis.fcl, sim: simulatedKpis.fcl, positive: true },
                  ].map(item => {
                    const delta = item.sim - item.orig;
                    const pct = item.orig !== 0 ? (delta / Math.abs(item.orig)) * 100 : 0;
                    const isGood = item.positive ? delta >= 0 : delta <= 0;
                    return (
                      <div key={item.label} className={`rounded-xl border p-3 ${isGood ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{item.label}</p>
                        <p className={`text-lg font-black font-mono ${isGood ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {delta >= 0 ? '+' : ''}{fmt(delta)}
                        </p>
                        <p className={`text-xs font-bold ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {fmtPct(pct)} sobre base
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* IA — Botões de Análise */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-orange-500" />
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Análise com BrisinhAI</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {AI_QUESTIONS.map(q => (
                    <button
                      key={q.id}
                      onClick={() => handleAiQuestion(q.id, q.label)}
                      disabled={isAiLoading || !isSimulating}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left text-xs font-semibold transition-all ${aiQuestion === q.id && isAiLoading
                        ? 'bg-orange-50 border-orange-300 text-orange-700'
                        : aiQuestion === q.id && !isAiLoading
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                    >
                      <span className="text-base">{q.icon}</span>
                      <span>{q.label}</span>
                      {aiQuestion === q.id && isAiLoading && <Loader2 size={12} className="ml-auto animate-spin text-orange-500" />}
                      {aiQuestion === q.id && !isAiLoading && aiResponse && <CheckCircle2 size={12} className="ml-auto text-emerald-400" />}
                    </button>
                  ))}
                </div>

                {!isSimulating && (
                  <p className="text-xs text-slate-400 text-center py-2">
                    Configure um cenário para habilitar a análise com IA
                  </p>
                )}

                {/* Resposta da IA */}
                {aiResponse && !isAiLoading && (
                  <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center">
                        <Sparkles size={12} className="text-white" />
                      </div>
                      <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">BrisinhAI</span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                  </div>
                )}

                {isAiLoading && (
                  <div className="flex items-center gap-3 bg-slate-900 rounded-xl p-5 border border-slate-800">
                    <Loader2 size={18} className="text-orange-400 animate-spin flex-shrink-0" />
                    <div>
                      <p className="text-white text-sm font-semibold">BrisinhAI analisando o cenário...</p>
                      <p className="text-slate-400 text-xs mt-0.5">Processando impactos financeiros</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Fixo ── */}
        <div className="flex-shrink-0 border-t border-slate-100 bg-white px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Simulação em memória · Dados originais não são alterados
          </div>
          <button
            onClick={() => {
              onParamsChange({ revenueMultiplier: 1, costsMultiplier: 1, expensesMultiplier: 1, taxesMultiplier: 1, investmentsMultiplier: 1 });
              setSelectedScenario(null);
              setGranularMode(false);
              setSelectedDept('');
              setGoalFcl('');
              setAiResponse('');
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors"
          >
            <RotateCcw size={13} /> Limpar Simulação
          </button>
        </div>
      </div>
    </div>
  );
}
