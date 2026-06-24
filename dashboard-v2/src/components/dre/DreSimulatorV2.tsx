'use client';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  X, TrendingUp, TrendingDown, Scissors, Target, Zap, RotateCcw,
  ChevronRight, AlertTriangle, Loader2, Sparkles, Info,
  ToggleLeft, ToggleRight, Building2, Calendar,
  CheckCircle2, ArrowDownRight, ArrowUpRight, DollarSign, Activity,
  ShieldAlert, Gauge, BarChart3,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  DreCalculatedResult, DreSimulationParams, DreRow, DreMetadata,
} from '@/types/dre';

// ─── Paleta & Formatação ──────────────────────────────────────────────────────
const PAL = {
  receita: '#10b981',
  fcl: '#3b82f6',
  custos: '#f59e0b',
  despesas: '#6366f1',
  sim: '#f97316',
  danger: '#f43f5e',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtK = (v: number) => `${(v / 1000).toFixed(0)}k`;
const fmtPct = (v: number, showPlus = true) =>
  `${showPlus && v > 0 ? '+' : ''}${v.toFixed(1)}%`;

// ─── Cenários Rápidos ─────────────────────────────────────────────────────────
type ScenarioId = 'rev_up' | 'rev_down' | 'costs_cut' | 'exp_cut' | 'contract_loss' | 'goal_seek' | 'custom';
type TabId = 'cenarios' | 'granular' | 'reposicao' | 'sensibilidade';

const SCENARIOS = [
  { id: 'rev_up' as ScenarioId, label: 'Crescimento', sublabel: 'Novo contrato ou expansão', icon: <TrendingUp size={16} />, color: 'emerald', defVal: 10 },
  { id: 'rev_down' as ScenarioId, label: 'Queda de Receita', sublabel: 'Perda parcial de faturamento', icon: <TrendingDown size={16} />, color: 'rose', defVal: -15 },
  { id: 'costs_cut' as ScenarioId, label: 'Corte de Custos', sublabel: 'Credenciados, CLTs, terceiros', icon: <Scissors size={16} />, color: 'amber', defVal: -20 },
  { id: 'exp_cut' as ScenarioId, label: 'Redução Despesas', sublabel: 'Despesas rateadas / admin', icon: <Scissors size={16} />, color: 'indigo', defVal: -25 },
  { id: 'contract_loss' as ScenarioId, label: 'Perda de Contrato', sublabel: 'Rescisão de departamento', icon: <AlertTriangle size={16} />, color: 'orange', defVal: -100 },
  { id: 'goal_seek' as ScenarioId, label: 'Meta de FCL', sublabel: 'Quanto preciso para atingir X?', icon: <Target size={16} />, color: 'blue', defVal: 0 },
] as const;

const SCENARIO_COLORS: Record<string, string> = {
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-300 bg-rose-50 text-rose-700',
  amber: 'border-amber-300 bg-amber-50 text-amber-700',
  indigo: 'border-indigo-300 bg-indigo-50 text-indigo-700',
  orange: 'border-orange-300 bg-orange-50 text-orange-700',
  blue: 'border-blue-300 bg-blue-50 text-blue-700',
};

// ─── IA Questions ─────────────────────────────────────────────────────────────
const AI_QUESTIONS = [
  { id: 'risk', label: 'Qual o risco principal?', icon: '⚠️' },
  { id: 'breakeven', label: 'Ponto de equilíbrio', icon: '⚖️' },
  { id: 'recovery', label: 'Estratégia de recuperação', icon: '🔄' },
  { id: 'actions', label: 'Ações recomendadas', icon: '🎯' },
  { id: 'cashflow', label: 'Impacto no caixa', icon: '💸' },
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

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function addMonths(col: string, n: number): string {
  const [mesStr, anoStr] = col.split('/');
  const mesIdx = MESES_PT.findIndex(m => m.toLowerCase() === mesStr.toLowerCase());
  if (mesIdx === -1) return col;
  const ano = 2000 + parseInt(anoStr);
  const total = ano * 12 + mesIdx + n;
  return `${MESES_PT[total % 12]}/${String(Math.floor(total / 12)).slice(-2)}`;
}

const DEFAULT_PARAMS: DreSimulationParams = {
  revenueMultiplier: 1, costsMultiplier: 1, expensesMultiplier: 1,
  taxesMultiplier: 1, investmentsMultiplier: 1,
};

const tooltipStyle = {
  borderRadius: '10px', border: 'none',
  boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontSize: '12px',
};

// ─── Componente Principal ─────────────────────────────────────────────────────
export function DreSimulatorV2({
  isOpen, onClose, originalResults, simulatedResults, rawData, metadata,
  onParamsChange, empresaContext, periodoContext,
}: DreSimulatorV2Props) {

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('cenarios');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId | null>(null);
  const [impactMode, setImpactMode] = useState<'percent' | 'absolute'>('percent');
  const [impactValue, setImpactValue] = useState<number>(10);
  const [includeRateio, setIncludeRateio] = useState(true);

  // Granular sliders
  const [revSlider, setRevSlider] = useState(1.0);
  const [costSlider, setCostSlider] = useState(1.0);
  const [expSlider, setExpSlider] = useState(1.0);
  const [taxSlider, setTaxSlider] = useState(1.0);
  const [invSlider, setInvSlider] = useState(1.0);
  const granularRef = useRef(false);

  // Goal Seek
  const [goalFcl, setGoalFcl] = useState('');

  // Reposição
  const [selectedDept, setSelectedDept] = useState('');
  const [numMonths, setNumMonths] = useState(12);

  // IA
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const orig = originalResults?.kpis;
  const sim = simulatedResults?.kpis;
  const isSimulating = useMemo(() => orig && sim && sim.fcl !== orig.fcl, [orig, sim]);

  // ── Full reset ─────────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    setSelectedScenario(null);
    setImpactValue(10);
    setImpactMode('percent');
    setIncludeRateio(true);
    setRevSlider(1.0);
    setCostSlider(1.0);
    setExpSlider(1.0);
    setTaxSlider(1.0);
    setInvSlider(1.0);
    setGoalFcl('');
    setSelectedDept('');
    setNumMonths(12);
    setAiResponse('');
    setAiQuestion(null);
    granularRef.current = false;
    onParamsChange({ ...DEFAULT_PARAMS });
  }, [onParamsChange]);

  useEffect(() => { if (isOpen) resetAll(); }, [isOpen]);

  // ── Departamentos disponíveis ───────────────────────────────────────────────
  const departamentos = useMemo(() => metadata?.departamentos || [], [metadata]);

  // ── Receita mensal média do departamento ───────────────────────────────────
  const deptMonthlyRevenue = useMemo(() => {
    if (!selectedDept || !originalResults) return 0;
    const cols = originalResults.validColumns;
    if (cols.length === 0) return 0;
    let total = 0;
    rawData.forEach(row => {
      if (row.Departamento !== selectedDept) return;
      const contaDRE = (row.ContaDRE || '').toString();
      const isRevenue = contaDRE.toLowerCase().includes('receita');
      if (!isRevenue) return;
      cols.forEach(col => {
        const v = parseFloat(row[col]?.toString().replace(',', '.') || '0');
        if (!isNaN(v) && v > 0) total += v;
      });
    });
    return cols.length > 0 ? total / cols.length : 0;
  }, [selectedDept, originalResults, rawData]);

  // ── Tabela de Reposição (lógica corrigida) ─────────────────────────────────
  // Raciocínio: tenho N meses para substituir o contrato de R$ X/mês.
  // Preciso trazer, progressivamente, novos contratos que somem X/mês até o vencimento.
  // Meta mensal de novos contratos = X / N (ritmo linear)
  // A cada mês i, já tenho acumulado (X/N)*i em receita recorrente nova.
  // Falta reconquistar = X - (X/N)*i = X*(N-i)/N
  const recoveryPoints = useMemo(() => {
    if (!originalResults || deptMonthlyRevenue <= 0 || numMonths <= 0) return [];
    const valorContrato = deptMonthlyRevenue; // receita mensal do contrato perdido
    const metaMensal = valorContrato / numMonths; // novos contratos/mês necessários
    const lastCol = originalResults.validColumns[originalResults.validColumns.length - 1] || 'Jun/26';

    return Array.from({ length: numMonths }, (_, i) => {
      const mes = addMonths(lastCol, i + 1);
      const receitaNovaAcumulada = metaMensal * (i + 1); // receita nova já conquistada
      const aReconquistar = Math.max(0, valorContrato - receitaNovaAcumulada);
      const percReposto = Math.min(100, (receitaNovaAcumulada / valorContrato) * 100);
      return { mes, metaMensal, receitaNovaAcumulada, aReconquistar, percReposto };
    });
  }, [originalResults, deptMonthlyRevenue, numMonths]);

  // ── Aplicar cenário rápido ─────────────────────────────────────────────────
  const applyScenario = useCallback((id: ScenarioId, val: number) => {
    if (!orig) return;
    let p = { ...DEFAULT_PARAMS };
    const pct = val / 100;
    switch (id) {
      case 'rev_up': p.revenueMultiplier = 1 + pct; break;
      case 'rev_down': p.revenueMultiplier = Math.max(0, 1 + pct); break;
      case 'costs_cut': p.costsMultiplier = Math.max(0, 1 + pct); break;
      case 'exp_cut': p.expensesMultiplier = Math.max(0, 1 + pct); break;
      case 'contract_loss':
        if (selectedDept && deptMonthlyRevenue > 0 && originalResults) {
          const deptTotal = deptMonthlyRevenue * originalResults.validColumns.length;
          const totalRev = orig.totalEntradas || 1;
          p.revenueMultiplier = Math.max(0, 1 - (deptTotal / totalRev));
        } else {
          p.revenueMultiplier = Math.max(0, 1 + pct);
        }
        break;
    }
    if (!includeRateio) p.expensesMultiplier = 0;
    onParamsChange(p);
    setRevSlider(p.revenueMultiplier);
    setCostSlider(p.costsMultiplier);
    setExpSlider(p.expensesMultiplier);
    setTaxSlider(p.taxesMultiplier);
    setInvSlider(p.investmentsMultiplier);
  }, [orig, originalResults, selectedDept, deptMonthlyRevenue, includeRateio, onParamsChange]);

  // ── Aplicar granular (live) ────────────────────────────────────────────────
  useEffect(() => {
    if (!granularRef.current) return;
    onParamsChange({
      revenueMultiplier: revSlider,
      costsMultiplier: costSlider,
      expensesMultiplier: includeRateio ? expSlider : 0,
      taxesMultiplier: taxSlider,
      investmentsMultiplier: invSlider,
    });
  }, [revSlider, costSlider, expSlider, taxSlider, invSlider, includeRateio]);

  // ── Goal Seek ──────────────────────────────────────────────────────────────
  const goalSeek = useMemo(() => {
    if (!goalFcl || !orig) return null;
    const meta = parseFloat(goalFcl.replace(/\./g, '').replace(',', '.'));
    if (isNaN(meta)) return null;
    const delta = meta - orig.fcl;
    return {
      meta, delta,
      revPct: (delta / (orig.totalEntradas || 1)) * 100,
      costPct: (delta / (orig.totalCustos || 1)) * 100,
      expPct: (delta / (orig.totalDespesas || 1)) * 100,
    };
  }, [goalFcl, orig]);

  // ── Análise de Sensibilidade ───────────────────────────────────────────────
  const sensitivityData = useMemo(() => {
    if (!orig) return [];
    const steps = [-20, -15, -10, -5, 5, 10, 15, 20];
    return steps.map(pct => {
      const revFcl = orig.fcl + (orig.totalEntradas * pct / 100);
      const costFcl = orig.fcl - (orig.totalCustos * Math.abs(pct) / 100) * (pct < 0 ? -1 : 1);
      const expFcl = orig.fcl - (orig.totalDespesas * Math.abs(pct) / 100) * (pct < 0 ? -1 : 1);
      return { pct: `${pct > 0 ? '+' : ''}${pct}%`, revFcl, costFcl, expFcl };
    });
  }, [orig]);

  // ── Score de Risco ─────────────────────────────────────────────────────────
  const riskScore = useMemo(() => {
    if (!orig || !sim) return null;
    const fclDrop = orig.fcl > 0 ? ((orig.fcl - sim.fcl) / orig.fcl) * 100 : 0;
    const revDrop = orig.totalEntradas > 0 ? ((orig.totalEntradas - sim.totalEntradas) / orig.totalEntradas) * 100 : 0;
    let score = 0;
    let label = 'Baixo';
    let color = 'emerald';
    if (fclDrop > 50 || sim.fcl < 0) { score = 90; label = 'Crítico'; color = 'red'; }
    else if (fclDrop > 30 || revDrop > 20) { score = 70; label = 'Alto'; color = 'rose'; }
    else if (fclDrop > 15 || revDrop > 10) { score = 45; label = 'Médio'; color = 'amber'; }
    else if (fclDrop > 5) { score = 20; label = 'Baixo'; color = 'emerald'; }
    return { score, label, color, fclDrop, revDrop };
  }, [orig, sim]);

  // ── IA Query ───────────────────────────────────────────────────────────────
  const handleAiQuestion = async (qId: string, qLabel: string) => {
    if (!orig || !sim) return;
    setAiQuestion(qId);
    setIsAiLoading(true);
    setAiResponse('');
    try {
      const res = await fetch('/api/ai/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: qId, questionLabel: qLabel,
          scenarioType: selectedScenario || 'custom',
          originalKpis: orig, simulatedKpis: sim,
          empresa: empresaContext, periodo: periodoContext,
          targetDepartamento: selectedDept || undefined,
          impactMode, impactValue,
          recoveryData: recoveryPoints.slice(0, 6),
        }),
      });
      const data = await res.json();
      setAiResponse(data.analysis || 'Não foi possível gerar a análise.');
    } catch { setAiResponse('Erro ao conectar com a IA. Tente novamente.'); }
    finally { setIsAiLoading(false); }
  };

  // ── Dados dos Gráficos ─────────────────────────────────────────────────────
  const evolucaoData = useMemo(() => {
    if (!originalResults) return [];
    return originalResults.validColumns.map(col => ({
      name: col,
      Receita: originalResults.mensal['Total Entradas Operacionais']?.[col] || 0,
      ReceitaSim: simulatedResults?.mensal['Total Entradas Operacionais']?.[col] || 0,
      FCL: originalResults.mensal['Fluxo de Caixa Livre FCL']?.[col] || 0,
      FCLSim: simulatedResults?.mensal['Fluxo de Caixa Livre FCL']?.[col] || 0,
    }));
  }, [originalResults, simulatedResults]);

  const recoveryChartData = useMemo(() => recoveryPoints.map(p => ({
    name: p.mes,
    'Novo/Mês': p.metaMensal,
    'Reposto': p.receitaNovaAcumulada,
    'Restante': p.aReconquistar,
  })), [recoveryPoints]);

  if (!isOpen) return null;

  // ── Delta Helper ───────────────────────────────────────────────────────────
  const Delta = ({ o, s, invert = false, large = false }: { o: number; s: number; invert?: boolean; large?: boolean }) => {
    const d = s - o;
    if (Math.abs(d) < 0.01) return <span className="text-slate-400 font-mono text-xs">—</span>;
    const good = invert ? d < 0 : d > 0;
    const cls = good ? 'text-emerald-600' : 'text-rose-600';
    return (
      <span className={`font-mono font-bold flex items-center gap-0.5 ${large ? 'text-sm' : 'text-xs'} ${cls}`}>
        {good ? <ArrowUpRight size={large ? 14 : 11} /> : <ArrowDownRight size={large ? 14 : 11} />}
        {fmt(d)}
      </span>
    );
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: 'cenarios', label: '⚡ Cenários' },
    { id: 'granular', label: '🎛️ Granular' },
    { id: 'reposicao', label: '📅 Reposição' },
    { id: 'sensibilidade', label: '📈 Sensibilidade' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-stretch animate-in fade-in duration-200">

      {/* ── PAINEL COMPLETO (2 colunas) ── */}
      <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">

        {/* ── HEADER GLOBAL ── */}
        <div className="flex-shrink-0 bg-slate-900 px-6 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-sm">Simulador de Cenários DRE</span>
              <span className="text-slate-400 text-xs ml-3">· {empresaContext} · {periodoContext}</span>
            </div>
            {isSimulating && (
              <span className="ml-2 flex items-center gap-1.5 text-[11px] font-bold text-orange-400 bg-orange-500/15 border border-orange-500/30 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
                Simulação Ativa
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetAll}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RotateCcw size={13} /> Resetar
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── BODY: 2 COLUNAS ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ════ COLUNA ESQUERDA — CONTROLES (420px) ════ */}
          <div className="w-[420px] flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col overflow-hidden">

            {/* KPI Strip */}
            {orig && sim && (
              <div className="flex-shrink-0 grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 bg-white">
                {[
                  { label: 'FCL Simulado', o: orig.fcl, s: sim.fcl },
                  { label: 'Receita', o: orig.totalEntradas, s: sim.totalEntradas },
                ].map(k => (
                  <div key={k.label} className="px-4 py-2.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
                    <p className={`text-base font-black font-mono mt-0.5 ${k.s >= k.o ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(k.s)}</p>
                    <Delta o={k.o} s={k.s} />
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex-shrink-0 flex border-b border-slate-200 bg-white px-2 pt-1.5 gap-0.5 overflow-x-auto">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-shrink-0 px-3 py-2 text-[11px] font-bold rounded-t-lg transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* ══ ABA CENÁRIOS ══ */}
              {activeTab === 'cenarios' && (
                <>
                  {/* Toggles */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setIncludeRateio(v => !v)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${includeRateio ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-100 border-slate-300 text-slate-500'}`}
                    >
                      {includeRateio ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      Rateio {includeRateio ? 'Incluído' : 'Excluído'}
                    </button>
                    <button
                      onClick={() => setImpactMode(m => m === 'percent' ? 'absolute' : 'percent')}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    >
                      <DollarSign size={13} />
                      {impactMode === 'percent' ? 'Modo: %' : 'Modo: R$'}
                    </button>
                  </div>

                  {/* Grade de Cenários */}
                  <div className="grid grid-cols-2 gap-2">
                    {SCENARIOS.map(sc => {
                      const active = selectedScenario === sc.id;
                      return (
                        <button
                          key={sc.id}
                          onClick={() => {
                            setSelectedScenario(sc.id);
                            granularRef.current = false;
                            if (sc.id !== 'goal_seek' && sc.id !== 'contract_loss') {
                              setImpactValue(sc.defVal);
                              applyScenario(sc.id, sc.defVal);
                            }
                            if (sc.id === 'contract_loss') setActiveTab('reposicao');
                          }}
                          className={`relative flex flex-col gap-1.5 p-3 rounded-xl border-2 text-left transition-all ${active ? 'border-orange-400 bg-orange-50 shadow-sm' : `border ${SCENARIO_COLORS[sc.color]} hover:shadow-sm`}`}
                        >
                          {active && <CheckCircle2 size={13} className="absolute top-2 right-2 text-orange-500" />}
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${SCENARIO_COLORS[sc.color]}`}>
                            {sc.icon}
                          </div>
                          <p className="text-xs font-bold text-slate-800 leading-tight">{sc.label}</p>
                          <p className="text-[10px] text-slate-400 leading-tight">{sc.sublabel}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Configuração de impacto */}
                  {selectedScenario && !['contract_loss', 'goal_seek'].includes(selectedScenario) && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ajustar Impacto</p>
                      {impactMode === 'percent' ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Percentual</span>
                            <span className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-lg ${impactValue >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {impactValue > 0 ? '+' : ''}{impactValue}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={selectedScenario === 'rev_up' ? 1 : -50}
                            max={selectedScenario === 'rev_up' ? 50 : -1}
                            step={1}
                            value={impactValue}
                            onChange={e => { const v = parseInt(e.target.value); setImpactValue(v); applyScenario(selectedScenario, v); }}
                            className="w-full accent-orange-500 h-1.5"
                          />
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>{selectedScenario === 'rev_up' ? '+1%' : '-50%'}</span>
                            <span>{selectedScenario === 'rev_up' ? '+50%' : '-1%'}</span>
                          </div>
                        </>
                      ) : (
                        <input
                          type="number"
                          value={Math.abs(impactValue)}
                          onChange={e => {
                            const v = selectedScenario === 'rev_up' ? Number(e.target.value) : -Number(e.target.value);
                            setImpactValue(v);
                            applyScenario(selectedScenario, v);
                          }}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm focus:border-orange-400 outline-none"
                          placeholder="Ex: 50000"
                        />
                      )}
                    </div>
                  )}

                  {/* Goal Seek */}
                  {selectedScenario === 'goal_seek' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5"><Target size={13} /> Meta de FCL</p>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-bold">R$</span>
                        <input
                          type="text"
                          value={goalFcl}
                          onChange={e => setGoalFcl(e.target.value)}
                          placeholder="150.000"
                          className="w-full pl-9 pr-3 py-2 border-2 border-blue-200 focus:border-blue-500 rounded-xl outline-none font-mono font-bold text-slate-700 text-sm"
                        />
                      </div>
                      <p className="text-xs text-slate-500">FCL atual: <strong className="font-mono">{fmt(orig?.fcl || 0)}</strong></p>
                      {goalSeek && (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Via Receita', pct: goalSeek.revPct, type: 'rev' },
                            { label: 'Via Custos', pct: -goalSeek.costPct, type: 'cost' },
                            { label: 'Via Despesas', pct: -goalSeek.expPct, type: 'exp' },
                          ].map(opt => (
                            <button
                              key={opt.type}
                              disabled={Math.abs(opt.pct) > 100}
                              onClick={() => {
                                let p = { ...DEFAULT_PARAMS };
                                if (opt.type === 'rev') p.revenueMultiplier = 1 + goalSeek.revPct / 100;
                                else if (opt.type === 'cost') p.costsMultiplier = Math.max(0, 1 - goalSeek.costPct / 100);
                                else p.expensesMultiplier = Math.max(0, 1 - goalSeek.expPct / 100);
                                onParamsChange(p);
                              }}
                              className="flex flex-col items-center p-2 rounded-lg border bg-white hover:bg-blue-50 text-center disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                              <span className="text-[10px] text-slate-500 font-semibold">{opt.label}</span>
                              <span className={`text-sm font-black font-mono ${Math.abs(opt.pct) > 100 ? 'text-slate-400' : opt.pct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {Math.abs(opt.pct) > 100 ? 'N/A' : fmtPct(opt.pct)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* IA Buttons */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Sparkles size={11} className="text-orange-400" /> Análise BrisinhAI</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {AI_QUESTIONS.map(q => (
                        <button
                          key={q.id}
                          onClick={() => handleAiQuestion(q.id, q.label)}
                          disabled={isAiLoading || !isSimulating}
                          className={`flex items-center gap-1.5 p-2.5 rounded-lg border text-left text-[11px] font-semibold transition-all ${aiQuestion === q.id && !isAiLoading ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-40 disabled:cursor-not-allowed'}`}
                        >
                          <span>{q.icon}</span>
                          <span className="leading-tight">{q.label}</span>
                          {aiQuestion === q.id && isAiLoading && <Loader2 size={11} className="ml-auto animate-spin text-orange-500 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                    {!isSimulating && <p className="text-[11px] text-slate-400 text-center">Configure um cenário para habilitar a IA</p>}
                  </div>
                </>
              )}

              {/* ══ ABA GRANULAR ══ */}
              {activeTab === 'granular' && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Controle por Linha</p>
                    <button
                      onClick={() => setIncludeRateio(v => !v)}
                      className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${includeRateio ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
                    >
                      {includeRateio ? <ToggleRight size={13} /> : <ToggleLeft size={13} />} Rateio
                    </button>
                  </div>
                  {[
                    { label: 'Receitas Operacionais', val: revSlider, set: setRevSlider, min: 0.3, max: 2.0, color: 'emerald' },
                    { label: 'Custos Operacionais', val: costSlider, set: setCostSlider, min: 0.3, max: 1.5, color: 'amber' },
                    { label: 'Despesas Rateadas', val: expSlider, set: setExpSlider, min: 0, max: 1.5, color: 'indigo', disabled: !includeRateio },
                    { label: 'Impostos e Taxas', val: taxSlider, set: setTaxSlider, min: 0.5, max: 1.5, color: 'rose' },
                    { label: 'Investimentos', val: invSlider, set: setInvSlider, min: 0, max: 2.0, color: 'slate' },
                  ].map(sl => {
                    const pct = Math.round((sl.val - 1) * 100);
                    return (
                      <div key={sl.label} className={`bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 ${sl.disabled ? 'opacity-40' : ''}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-700">{sl.label}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono ${pct === 0 ? 'bg-slate-100 text-slate-500' : pct > 0 && sl.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : pct < 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                            {pct >= 0 ? '+' : ''}{pct}%
                          </span>
                        </div>
                        <input
                          type="range" min={sl.min} max={sl.max} step={0.01}
                          value={sl.val} disabled={sl.disabled}
                          onChange={e => { granularRef.current = true; sl.set(parseFloat(e.target.value)); setSelectedScenario('custom'); }}
                          className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-${sl.color}-500`}
                        />
                      </div>
                    );
                  })}
                </>
              )}

              {/* ══ ABA REPOSIÇÃO ══ */}
              {activeTab === 'reposicao' && (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Estudo de Reposição</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Calcule quantos novos contratos você precisa fechar por mês para substituir a receita perdida antes do vencimento.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Building2 size={11} /> Departamento / Contrato
                    </label>
                    <select
                      value={selectedDept}
                      onChange={e => {
                        setSelectedDept(e.target.value);
                        if (e.target.value) { setSelectedScenario('contract_loss'); applyScenario('contract_loss', -100); }
                      }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-orange-400 outline-none bg-white"
                    >
                      <option value="">Selecione o contrato perdido...</option>
                      {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Calendar size={11} /> Meses até a rescisão
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={1} max={36} step={1} value={numMonths}
                        onChange={e => setNumMonths(parseInt(e.target.value))}
                        className="flex-1 accent-orange-500 h-1.5"
                      />
                      <span className="text-sm font-black text-orange-600 w-12 text-right font-mono">{numMonths}m</span>
                    </div>
                  </div>

                  {selectedDept && deptMonthlyRevenue > 0 && (
                    <>
                      {/* KPIs da reposição */}
                      <div className="grid grid-cols-1 gap-2">
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Receita mensal a repor</p>
                            <p className="text-base font-black text-rose-700 font-mono">{fmt(deptMonthlyRevenue)}</p>
                          </div>
                          <ArrowDownRight size={20} className="text-rose-400" />
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                              Meta: novos contratos/mês
                            </p>
                            <p className="text-base font-black text-orange-700 font-mono">{fmt(deptMonthlyRevenue / numMonths)}</p>
                            <p className="text-[10px] text-orange-500 mt-0.5">{fmt(deptMonthlyRevenue)} ÷ {numMonths} meses</p>
                          </div>
                          <Target size={20} className="text-orange-400" />
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Receita acumulada no vencimento</p>
                            <p className="text-base font-black text-blue-700 font-mono">{fmt(deptMonthlyRevenue)}/mês</p>
                            <p className="text-[10px] text-blue-500 mt-0.5">100% reposto ao final de {numMonths} meses</p>
                          </div>
                          <CheckCircle2 size={20} className="text-blue-400" />
                        </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                        <Info size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          <strong>Lógica:</strong> Você tem {numMonths} meses para construir gradualmente novos contratos. Trazendo {fmt(deptMonthlyRevenue / numMonths)}/mês em novos contratos, ao final terá {fmt(deptMonthlyRevenue)}/mês de receita recorrente nova — exatamente o que o contrato perdido gerava.
                        </p>
                      </div>
                    </>
                  )}

                  {!selectedDept && (
                    <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                      <Building2 size={28} className="mx-auto mb-2 opacity-25" />
                      <p className="text-xs">Selecione um departamento acima</p>
                    </div>
                  )}
                </>
              )}

              {/* ══ ABA SENSIBILIDADE ══ */}
              {activeTab === 'sensibilidade' && (
                <>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Análise de Sensibilidade — FCL</p>
                  <p className="text-[11px] text-slate-400">Impacto no FCL (Fluxo de Caixa Livre) em diferentes cenários de variação</p>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-800 text-white">
                        <tr>
                          <th className="px-2 py-2 text-left font-semibold">Δ%</th>
                          <th className="px-2 py-2 text-right font-semibold">Via Receita</th>
                          <th className="px-2 py-2 text-right font-semibold">Via Custos</th>
                          <th className="px-2 py-2 text-right font-semibold">Via Despesas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sensitivityData.map((row, i) => {
                          const isPos = parseFloat(row.pct) > 0;
                          return (
                            <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                              <td className={`px-2 py-1.5 font-bold font-mono ${isPos ? 'text-emerald-700' : 'text-rose-700'}`}>{row.pct}</td>
                              <td className={`px-2 py-1.5 text-right font-mono ${row.revFcl >= (orig?.fcl || 0) ? 'text-emerald-700' : 'text-rose-700'}`}>{fmt(row.revFcl)}</td>
                              <td className={`px-2 py-1.5 text-right font-mono ${row.costFcl >= (orig?.fcl || 0) ? 'text-emerald-700' : 'text-rose-700'}`}>{fmt(row.costFcl)}</td>
                              <td className={`px-2 py-1.5 text-right font-mono ${row.expFcl >= (orig?.fcl || 0) ? 'text-emerald-700' : 'text-rose-700'}`}>{fmt(row.expFcl)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {orig && (
                    <div className="bg-slate-100 rounded-xl p-3 text-[11px] text-slate-500 text-center">
                      FCL Base: <strong className="font-mono text-slate-700">{fmt(orig.fcl)}</strong>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>

          {/* ════ COLUNA DIREITA — PAINÉIS ANALÍTICOS ════ */}
          <div className="flex-1 overflow-y-auto bg-slate-100 p-5 space-y-4">

            {/* ── Score de Risco ── */}
            {isSimulating && riskScore && (
              <div className={`bg-white rounded-2xl border p-4 flex items-center gap-5 ${riskScore.color === 'red' ? 'border-red-200' : riskScore.color === 'rose' ? 'border-rose-200' : riskScore.color === 'amber' ? 'border-amber-200' : 'border-emerald-200'}`}>
                <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${riskScore.color === 'red' ? 'bg-red-100' : riskScore.color === 'rose' ? 'bg-rose-100' : riskScore.color === 'amber' ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                  <Gauge size={20} className={riskScore.color === 'red' ? 'text-red-600' : riskScore.color === 'rose' ? 'text-rose-600' : riskScore.color === 'amber' ? 'text-amber-600' : 'text-emerald-600'} />
                  <span className={`text-[10px] font-black mt-0.5 ${riskScore.color === 'red' ? 'text-red-700' : riskScore.color === 'rose' ? 'text-rose-700' : riskScore.color === 'amber' ? 'text-amber-700' : 'text-emerald-700'}`}>{riskScore.score}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert size={14} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Score de Risco do Cenário</span>
                  </div>
                  <p className={`text-lg font-black ${riskScore.color === 'red' ? 'text-red-700' : riskScore.color === 'rose' ? 'text-rose-700' : riskScore.color === 'amber' ? 'text-amber-700' : 'text-emerald-700'}`}>
                    Risco {riskScore.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    FCL reduz {fmtPct(-riskScore.fclDrop, false)} · Receita {fmtPct(-riskScore.revDrop, false)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {orig && sim && [
                    { label: 'Receita', o: orig.totalEntradas, s: sim.totalEntradas },
                    { label: 'Custos', o: orig.totalCustos, s: sim.totalCustos, inv: true },
                    { label: 'Desp.', o: orig.totalDespesas, s: sim.totalDespesas, inv: true },
                    { label: 'FCL', o: orig.fcl, s: sim.fcl },
                  ].map(k => (
                    <div key={k.label} className="text-right">
                      <p className="text-[10px] text-slate-400">{k.label}</p>
                      <Delta o={k.o} s={k.s} invert={k.inv} large />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Gráfico de Evolução Original vs. Simulado ── */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={14} className="text-slate-400" />
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Evolução: Original vs. Simulado</p>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evolucaoData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: any, name: any) => [fmt(Number(v)), name] as any}
                      contentStyle={tooltipStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="Receita" fill={PAL.receita} fillOpacity={0.35} radius={[3, 3, 0, 0]} maxBarSize={18} name="Receita (Base)" />
                    <Bar dataKey="ReceitaSim" fill={PAL.sim} radius={[3, 3, 0, 0]} maxBarSize={18} name="Receita (Sim.)" />
                    <Line type="monotone" dataKey="FCL" stroke={PAL.fcl} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="FCL (Base)" />
                    <Line type="monotone" dataKey="FCLSim" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: '#f97316' }} name="FCL (Sim.)" />
                    <ReferenceLine y={0} stroke="#e2e8f0" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Tabela de Reposição ── (apenas quando ativa) */}
            {activeTab === 'reposicao' && recoveryPoints.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={14} className="text-slate-400" />
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Cronograma de Reposição — Meta: {fmt(deptMonthlyRevenue / numMonths)}/mês
                  </p>
                </div>

                {/* Gráfico de área */}
                <div className="h-44 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={recoveryChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="repGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PAL.receita} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={PAL.receita} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="faltaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PAL.danger} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={PAL.danger} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={Math.floor(numMonths / 6)} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: any, name: any) => [fmt(Number(v)), name] as any} contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="Reposto" stroke={PAL.receita} strokeWidth={2} fill="url(#repGrad)" name="Receita Nova Acumulada" />
                      <Area type="monotone" dataKey="Restante" stroke={PAL.danger} strokeWidth={2} fill="url(#faltaGrad)" name="Ainda Falta Repor" />
                      <ReferenceLine y={deptMonthlyRevenue} stroke="#10b981" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: 'Meta Total', fill: '#10b981', fontSize: 10, position: 'insideRight' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Tabela resumida */}
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-slate-600">Mês</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-600">Trazer/Mês</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-600">Acumulado</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-600">Falta</th>
                        <th className="px-3 py-2 text-right font-bold text-slate-600">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recoveryPoints.map((p, i) => (
                        <tr key={p.mes} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-orange-50/40 transition-colors`}>
                          <td className="px-3 py-1.5 font-bold text-slate-700">{p.mes}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-emerald-700 font-bold">{fmt(p.metaMensal)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-blue-700">{fmt(p.receitaNovaAcumulada)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-rose-600">{fmt(p.aReconquistar)}</td>
                          <td className="px-3 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-gradient-to-r from-orange-400 to-emerald-500 transition-all" style={{ width: `${p.percReposto}%` }} />
                              </div>
                              <span className="font-mono text-slate-600 font-bold w-8 text-right">{p.percReposto.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Resposta IA ── */}
            {(aiResponse || isAiLoading) && (
              <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles size={12} className="text-white" />
                  </div>
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">BrisinhAI — {AI_QUESTIONS.find(q => q.id === aiQuestion)?.label}</span>
                </div>
                {isAiLoading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Loader2 size={15} className="animate-spin text-orange-400" />
                    Analisando cenário...
                  </div>
                ) : (
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                )}
              </div>
            )}

            {/* ── Placeholder quando não há simulação ── */}
            {!isSimulating && !isAiLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-white border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center mb-4">
                  <Activity size={24} className="text-slate-300" />
                </div>
                <p className="text-slate-500 font-semibold text-sm">Nenhum cenário ativo</p>
                <p className="text-slate-400 text-xs mt-1 max-w-xs">
                  Selecione um cenário na aba Cenários ou ajuste os sliders em Granular para visualizar os impactos aqui.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
