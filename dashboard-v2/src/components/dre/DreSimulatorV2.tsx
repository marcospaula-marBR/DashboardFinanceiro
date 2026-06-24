'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  X, TrendingUp, TrendingDown, Scissors, Target, Zap, RotateCcw,
  AlertTriangle, Loader2, Sparkles, Info, ToggleLeft, ToggleRight,
  Building2, Calendar, CheckCircle2, ArrowDownRight, ArrowUpRight,
  DollarSign, Activity, ShieldAlert, Gauge, BarChart3, Save, Copy, Trash2,
  ListFilter, FileSpreadsheet, Percent, Grid, HelpCircle, ChevronRight
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Cell, ReferenceLine
} from 'recharts';
import { DreCalculatedResult, DreRow, DreMetadata } from '@/types/dre';
import {
  Scenario,
  ScenarioAssumption,
  SimulatorScenarioType,
  SimulatorAmountType,
  SimulatorRecurrence,
  MacroIndexType
} from '@/types/dre-simulator.types';
import {
  colToIso,
  isoToCol,
  addMonthsIso,
  diffMonthsIso,
  isColInPeriod,
  sortColList
} from '@/lib/date-utils';
import { DreSimulatorEngine } from '@/services/dre-simulator.engine';

// ── Cores e Paletas Executivas ───────────────────────────────────────────────
const PAL = {
  receita: '#10b981', // Verde esmeralda
  fcl: '#3b82f6',     // Azul
  custos: '#f59e0b',   // Laranja âmbar
  despesas: '#6366f1', // Indigo
  sim: '#f97316',      // Laranja ativo
  danger: '#ef4444',   // Vermelho
  bgDark: '#0f172a',   // Slate escuro
  bgCard: '#ffffff',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtK = (v: number) => `${(v / 1000).toFixed(0)}k`;
const fmtPct = (v: number, showPlus = true) =>
  `${showPlus && v > 0 ? '+' : ''}${v.toFixed(1)}%`;

const tooltipStyle = {
  borderRadius: '12px',
  border: 'none',
  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
  fontSize: '12px',
};

// ── Cenários Rápidos ─────────────────────────────────────────────────────────
interface QuickButton {
  id: SimulatorScenarioType;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
  defaultVal: number;
}

const SCENARIO_BUTTONS: QuickButton[] = [
  { id: 'revenue_increase', label: 'Aumento de Receita', sublabel: 'Projetar novos contratos', icon: <TrendingUp size={18} />, color: 'emerald', defaultVal: 10 },
  { id: 'revenue_reduction', label: 'Redução de Receita', sublabel: 'Simular queda macro', icon: <TrendingDown size={18} />, color: 'rose', defaultVal: -10 },
  { id: 'contract_loss', label: 'Perda de Contrato', sublabel: 'Rescisão de departamento', icon: <AlertTriangle size={18} />, color: 'orange', defaultVal: -100 },
  { id: 'revenue_replacement', label: 'Reposição de Receita', sublabel: 'Meta linear ou curva S', icon: <Target size={18} />, color: 'teal', defaultVal: 50000 },
  { id: 'expense_increase', label: 'Aumento de Despesas', sublabel: 'Crescimento de custos gerais', icon: <TrendingUp size={18} />, color: 'amber', defaultVal: 8 },
  { id: 'expense_reduction', label: 'Redução de Despesas', sublabel: 'Cortes administrativos', icon: <Scissors size={18} />, color: 'indigo', defaultVal: -12 },
  { id: 'costs_cut', label: 'Corte de Custos', sublabel: 'Otimizar pessoal e credenciados', icon: <Scissors size={18} />, color: 'blue', defaultVal: -15 },
  { id: 'macro_driver', label: 'Reajuste por Índice', sublabel: 'Indexadores IPCA/INCC/CDI', icon: <Activity size={18} />, color: 'slate', defaultVal: 4.5 },
];

const BUTTON_COLORS: Record<string, string> = {
  emerald: 'border-emerald-250 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  rose: 'border-rose-250 bg-rose-50 text-rose-800 hover:bg-rose-100',
  orange: 'border-orange-250 bg-orange-50 text-orange-800 hover:bg-orange-100',
  teal: 'border-teal-250 bg-teal-50 text-teal-800 hover:bg-teal-100',
  amber: 'border-amber-250 bg-amber-50 text-amber-800 hover:bg-amber-100',
  indigo: 'border-indigo-250 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
  blue: 'border-blue-250 bg-blue-50 text-blue-800 hover:bg-blue-100',
  slate: 'border-slate-250 bg-slate-50 text-slate-800 hover:bg-slate-100',
};

// ── Mock Macro rates para indexador ─────────────────────────────────────────
const MOCK_MACRO_RATES: Record<MacroIndexType, Record<string, number>> = {
  IPCA: { '2026-07': 0.004, '2026-08': 0.003, '2026-09': 0.004, '2026-10': 0.005, '2026-11': 0.004, '2026-12': 0.004 },
  INCC: { '2026-07': 0.005, '2026-08': 0.004, '2026-09': 0.006, '2026-10': 0.005, '2026-11': 0.005, '2026-12': 0.005 },
  CDI: { '2026-07': 0.008, '2026-08': 0.008, '2026-09': 0.008, '2026-10': 0.008, '2026-11': 0.008, '2026-12': 0.008 },
  SELIC: { '2026-07': 0.0085, '2026-08': 0.0085, '2026-09': 0.0085, '2026-10': 0.0085, '2026-11': 0.0085, '2026-12': 0.0085 },
  dissidio: { '2026-07': 0.05 },
  inflacao_fornecedores: { '2026-07': 0.005 },
  cambio: { '2026-07': 0.01 }
};

interface DreSimulatorV2Props {
  isOpen: boolean;
  onClose: () => void;
  originalResults: DreCalculatedResult | null;
  simulatedResults: DreCalculatedResult | null;
  rawData: DreRow[];
  metadata: DreMetadata | null;
  activeScenario: Scenario | null;
  onScenarioChange: (scenario: Scenario | null) => void;
  onParamsChange?: (params: any) => void;
  empresaContext: string;
  periodoContext: string;
}

type TabId = 'dashboard' | 'premissas' | 'comparador' | 'tabela';

export function DreSimulatorV2({
  isOpen, onClose, originalResults, simulatedResults, rawData, metadata,
  activeScenario, onScenarioChange, onParamsChange, empresaContext, periodoContext
}: DreSimulatorV2Props) {

  // ── States ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [savedScenarios, setSavedScenarios] = useState<Scenario[]>([]);
  const [editingAssumption, setEditingAssumption] = useState<Partial<ScenarioAssumption> | null>(null);

  // IA
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Formulários de premissas temporários
  const [asmType, setAsmType] = useState<SimulatorScenarioType>('revenue_increase');
  const [asmTargetType, setAsmTargetType] = useState<'all' | 'department' | 'account' | 'account_group'>('all');
  const [asmTargetIds, setAsmTargetIds] = useState<string[]>([]);
  const [asmAmountType, setAsmAmountType] = useState<SimulatorAmountType>('percentage');
  const [asmValue, setAsmValue] = useState<number>(10);
  const [asmStartDate, setAsmStartDate] = useState('');
  const [asmEndDate, setAsmEndDate] = useState('');
  const [asmRecurrence, setAsmRecurrence] = useState<SimulatorRecurrence>('monthly');
  const [asmMacroIndex, setAsmMacroIndex] = useState<MacroIndexType>('IPCA');

  const orig = originalResults?.kpis;
  const sim = simulatedResults?.kpis;
  const columns = simulatedResults?.validColumns || [];

  // ── Carregar do LocalStorage no mount ──────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem('marbrasil_dre_saved_scenarios');
      if (local) {
        try {
          setSavedScenarios(JSON.parse(local));
        } catch (e) {
          console.warn('Erro ao ler cenários do localStorage:', e);
        }
      }
    }
  }, []);

  // ── Sincronizar cenários salvos no LocalStorage ────────────────────────────
  const saveToLocal = (scenarios: Scenario[]) => {
    setSavedScenarios(scenarios);
    localStorage.setItem('marbrasil_dre_saved_scenarios', JSON.stringify(scenarios));
  };

  // ── Criar um rascunho de cenário se não houver um ativo ─────────────────────
  const initializeDraft = useCallback(() => {
    if (!originalResults) return;
    const cols = originalResults.validColumns;
    const lastCol = cols[cols.length - 1] || 'Jun/26';
    const lastIso = colToIso(lastCol);
    const nextMonthIso = addMonthsIso(lastIso, 1);
    const endProjIso = addMonthsIso(lastIso, 6); // Projeção padrão de 6 meses

    const newScenario: Scenario = {
      id: `sc_${Date.now()}`,
      name: 'Rascunho Simulação',
      basePeriod: [...cols],
      projectionStartDate: nextMonthIso,
      projectionEndDate: endProjIso,
      mode: 'future_projection',
      includeAllocatedExpenses: true,
      assumptions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onScenarioChange(newScenario);
  }, [originalResults, onScenarioChange]);

  useEffect(() => {
    if (isOpen && !activeScenario) {
      initializeDraft();
    }
  }, [isOpen, activeScenario, initializeDraft]);

  // ── Reset Completo ─────────────────────────────────────────────────────────
  const handleReset = () => {
    setEditingAssumption(null);
    setAsmTargetIds([]);
    setAsmStartDate('');
    setAsmEndDate('');
    setAsmValue(10);
    setAsmType('revenue_increase');
    setAsmAmountType('percentage');
    setAsmRecurrence('monthly');
    setAiResponse('');
    setAiQuestion(null);
    
    if (originalResults) {
      const cols = originalResults.validColumns;
      const lastCol = cols[cols.length - 1] || 'Jun/26';
      const lastIso = colToIso(lastCol);
      const nextMonthIso = addMonthsIso(lastIso, 1);
      const endProjIso = addMonthsIso(lastIso, 6);

      const newScenario: Scenario = {
        id: `sc_${Date.now()}`,
        name: 'Rascunho Simulação',
        basePeriod: [...cols],
        projectionStartDate: nextMonthIso,
        projectionEndDate: endProjIso,
        mode: 'future_projection',
        includeAllocatedExpenses: true,
        assumptions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      onScenarioChange(newScenario);
    } else {
      onScenarioChange(null);
    }
  };

  // ── Salvar o Cenário Atual ────────────────────────────────────────────────
  const handleSaveScenario = () => {
    if (!activeScenario) return;
    const name = prompt('Digite o nome do cenário executivo:', activeScenario.name);
    if (!name) return;

    const updated = {
      ...activeScenario,
      name,
      updatedAt: new Date().toISOString()
    };

    let list = [...savedScenarios];
    const idx = list.findIndex(s => s.id === updated.id);
    if (idx !== -1) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }

    saveToLocal(list);
    onScenarioChange(updated);
    alert('Cenário executivo salvo com sucesso!');
  };

  // ── Duplicar Cenário ───────────────────────────────────────────────────────
  const handleDuplicateScenario = (sc: Scenario) => {
    const dup: Scenario = {
      ...sc,
      id: `sc_${Date.now()}`,
      name: `${sc.name} (Cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const list = [...savedScenarios, dup];
    saveToLocal(list);
    onScenarioChange(dup);
  };

  // ── Excluir Cenário ────────────────────────────────────────────────────────
  const handleDeleteScenario = (id: string) => {
    if (!confirm('Deseja realmente remover este cenário?')) return;
    const list = savedScenarios.filter(s => s.id !== id);
    saveToLocal(list);
    if (activeScenario?.id === id) {
      onScenarioChange(null);
    }
  };

  // ── Adicionar premissa ao cenário ativo ────────────────────────────────────
  const handleAddAssumption = () => {
    if (!activeScenario || !originalResults) return;

    const defaultIsoStart = colToIso(originalResults.validColumns[0]);
    const defaultIsoEnd = colToIso(originalResults.validColumns[originalResults.validColumns.length - 1]);

    const newAsm: ScenarioAssumption = {
      id: `asm_${Date.now()}`,
      type: asmType,
      targetType: asmTargetType,
      targetIds: asmTargetIds.length > 0 ? asmTargetIds : ['all'],
      amountType: asmAmountType,
      value: asmValue,
      startDate: asmStartDate || defaultIsoStart,
      endDate: asmEndDate || defaultIsoEnd,
      recurrence: asmRecurrence,
      macroIndex: asmType === 'macro_driver' ? asmMacroIndex : undefined
    };

    const updated: Scenario = {
      ...activeScenario,
      assumptions: [...activeScenario.assumptions, newAsm],
      updatedAt: new Date().toISOString()
    };

    onScenarioChange(updated);
    setEditingAssumption(null);
    // Limpar formulário temporário
    setAsmTargetIds([]);
    setAsmStartDate('');
    setAsmEndDate('');
  };

  // ── Remover premissa do cenário ativo ──────────────────────────────────────
  const handleRemoveAssumption = (asmId: string) => {
    if (!activeScenario) return;
    const updated: Scenario = {
      ...activeScenario,
      assumptions: activeScenario.assumptions.filter(a => a.id !== asmId),
      updatedAt: new Date().toISOString()
    };
    onScenarioChange(updated);
  };

  // ── Visualizações Computadas ───────────────────────────────────────────────

  // 1. Gráfico de Evolução (Base vs Simulado)
  const evolucaoData = useMemo(() => {
    if (!originalResults || !simulatedResults) return [];
    return simulatedResults.validColumns.map(col => {
      const isProj = colToIso(col) > colToIso(originalResults.validColumns[originalResults.validColumns.length - 1]);
      return {
        name: col,
        'Receita Base': originalResults.mensal['Total Entradas Operacionais']?.[col] || (isProj ? simulatedResults.mensal['Total Entradas Operacionais']?.[col] : 0),
        'Receita Sim.': simulatedResults.mensal['Total Entradas Operacionais']?.[col] || 0,
        'FCL Base': originalResults.mensal['Fluxo de Caixa Livre FCL']?.[col] || (isProj ? simulatedResults.mensal['Fluxo de Caixa Livre FCL']?.[col] : 0),
        'FCL Sim.': simulatedResults.mensal['Fluxo de Caixa Livre FCL']?.[col] || 0,
      };
    });
  }, [originalResults, simulatedResults]);

  // 2. Gráfico Waterfall (EBITDA Ponte)
  const waterfallData = useMemo(() => {
    if (!orig || !sim) return [];
    
    // Desvios
    const dReceita = sim.totalEntradas - orig.totalEntradas;
    const dCustos = -(sim.totalCustos - orig.totalCustos); // sinal invertido
    const dDespesas = -(sim.totalDespesas - orig.totalDespesas); // sinal invertido
    const dInvestimentos = -(sim.totalInvestimentos - orig.totalInvestimentos);
    const dImpostos = -(sim.totalImpostos - orig.totalImpostos);

    const steps = [
      { name: 'EBITDA Base', val: orig.resultado, cumulative: 0 },
      { name: 'Receitas', val: dReceita, cumulative: orig.resultado },
      { name: 'Custos Op.', val: dCustos, cumulative: orig.resultado + dReceita },
      { name: 'Despesas', val: dDespesas, cumulative: orig.resultado + dReceita + dCustos },
      { name: 'Impostos', val: dImpostos, cumulative: orig.resultado + dReceita + dCustos + dDespesas },
      { name: 'Investimentos', val: dInvestimentos, cumulative: orig.resultado + dReceita + dCustos + dDespesas + dImpostos },
      { name: 'EBITDA Simulado', val: sim.resultado, cumulative: 0, isFinal: true },
    ];

    return steps.map(s => ({
      name: s.name,
      base: s.isFinal ? 0 : (s.val >= 0 ? s.cumulative : s.cumulative + s.val),
      bar: Math.abs(s.val),
      positive: s.val >= 0,
      isFinal: !!s.isFinal,
      rawValue: s.val
    }));
  }, [orig, sim]);

  // 3. Tornado Chart (Sensibilidade FCL)
  // Mostra impacto teórico de +-10% em Receita, Custos e Despesas
  const tornadoData = useMemo(() => {
    if (!orig) return [];
    return [
      {
        variable: 'Receita Operacional (±10%)',
        positivo: orig.totalEntradas * 0.1,
        negativo: -orig.totalEntradas * 0.1
      },
      {
        variable: 'Custos Operacionais (±10%)',
        positivo: -orig.totalCustos * 0.1,
        negativo: orig.totalCustos * 0.1
      },
      {
        variable: 'Despesas Rateadas (±10%)',
        positivo: -orig.totalDespesas * 0.1,
        negativo: orig.totalDespesas * 0.1
      },
      {
        variable: 'Impostos Gerais (±10%)',
        positivo: -orig.totalImpostos * 0.1,
        negativo: orig.totalImpostos * 0.1
      }
    ].sort((a, b) => Math.abs(b.negativo) - Math.abs(a.negativo));
  }, [orig]);

  // 4. Heatmap Mensal de Desvios de FCL por Categoria
  const heatmapGrid = useMemo(() => {
    if (!originalResults || !simulatedResults) return { grid: [], cols: [], cats: [] };
    const cols = simulatedResults.validColumns.slice(-6); // Últimos 6 meses
    const cats = ['Total Entradas Operacionais', 'Total de Impostos', 'Total Custos Operacionais', 'Total Despesas Rateadas', 'Fluxo de Caixa Livre FCL'];

    const grid: { cat: string; col: string; val: number; pct: number }[] = [];
    cats.forEach(cat => {
      cols.forEach(col => {
        const oVal = originalResults.mensal[cat]?.[col] || 0;
        const sVal = simulatedResults.mensal[cat]?.[col] || 0;
        const diff = sVal - oVal;
        const pct = oVal !== 0 ? (diff / oVal) * 100 : 0;
        grid.push({ cat, col, val: diff, pct });
      });
    });
    return { grid, cols, cats };
  }, [originalResults, simulatedResults]);

  // 5. Score de Risco do Cenário
  const riskScore = useMemo(() => {
    if (!orig || !sim) return null;
    const fclDrop = orig.fcl > 0 ? ((orig.fcl - sim.fcl) / orig.fcl) * 150 : 0;
    const marginDrop = orig.percLucro - sim.percLucro;
    let score = Math.min(100, Math.max(0, Math.round(fclDrop + marginDrop * 2)));

    let label = 'Baixo';
    let color = 'text-emerald-600 border-emerald-200 bg-emerald-50';
    let gaugeColor = '#10b981';

    if (score > 75) {
      label = 'Crítico';
      color = 'text-red-700 border-red-200 bg-red-50';
      gaugeColor = '#ef4444';
    } else if (score > 40) {
      label = 'Médio';
      color = 'text-orange-700 border-orange-200 bg-orange-50';
      gaugeColor = '#f97316';
    }

    return { score, label, color, gaugeColor };
  }, [orig, sim]);

  // ── IA Question ────────────────────────────────────────────────────────────
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
          scenarioType: activeScenario?.name || 'Cenário Executivo',
          originalKpis: orig, simulatedKpis: sim,
          empresa: empresaContext, periodo: periodoContext,
          assumptions: activeScenario?.assumptions || [],
        }),
      });
      const data = await res.json();
      setAiResponse(data.analysis || 'Não foi possível gerar a análise.');
    } catch { setAiResponse('Erro ao conectar com a BrisinhAI.'); }
    finally { setIsAiLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-stretch animate-in fade-in duration-200">
      
      {/* ── PAINEL FULLSCREEN DO SIMULADOR ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* ── HEADER SUPERIOR EXECUTIVO ── */}
        <div className="flex-shrink-0 bg-slate-900 px-8 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/10">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                Simulador Executivo de Cenários DRE
                {activeScenario && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                    Cenário: {activeScenario.name}
                  </span>
                )}
              </h1>
              <p className="text-slate-400 text-xs mt-0.5 font-medium">
                Conselho de Administração · {empresaContext} · {periodoContext}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveScenario}
              className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white bg-orange-600 hover:bg-orange-700 px-5 py-3 rounded-lg shadow-md transition-colors cursor-pointer"
            >
              <Save size={16} /> Salvar Cenário
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-3 rounded-lg transition-colors shadow-md cursor-pointer"
            >
              <RotateCcw size={16} /> Resetar
            </button>
            <button
              onClick={onClose}
              className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-slate-800 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── CORPO PRINCIPAL: 2 COLUNAS EXPANDIDAS ── */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* ════ COLUNA ESQUERDA — PAINEL DE CONTROLES (440px) ════ */}
          <div className="w-[440px] flex-shrink-0 bg-slate-900 border-r border-slate-850 flex flex-col overflow-hidden">
            
            {/* Abas Esquerda */}
            <div className="flex-shrink-0 flex border-b border-slate-800 bg-slate-950 px-4 pt-3.5 gap-1">
              {[
                { id: 'dashboard' as TabId, label: '📊 Dashboard', icon: <Activity size={14} /> },
                { id: 'premissas' as TabId, label: '🔧 Premissas', icon: <ListFilter size={14} /> },
                { id: 'comparador' as TabId, label: '🏆 Comparar', icon: <Grid size={14} /> },
                { id: 'tabela' as TabId, label: '📄 DRE Simulado', icon: <FileSpreadsheet size={14} /> },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-extrabold rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${activeTab === t.id ? 'bg-slate-900 text-white border-t-2 border-orange-500' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/50'}`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Painel de Rolagem */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">

              {/* ══ ABA DASHBOARD: BOTÕES E ATIVOS ══ */}
              {activeTab === 'dashboard' && (
                <>
                  {/* Cenários Macroeconômicos Rápidos */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Zap size={13} className="text-orange-500" /> Cenários de Simulação Rápida
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {SCENARIO_BUTTONS.map(sc => (
                        <button
                          key={sc.id}
                          onClick={() => {
                            setAsmType(sc.id);
                            setAsmValue(sc.defaultVal);
                            if (sc.id === 'contract_loss') {
                              setAsmTargetType('department');
                              setAsmTargetIds([]);
                            } else if (['revenue_reduction', 'revenue_increase'].includes(sc.id)) {
                              setAsmTargetType('account_group');
                              setAsmTargetIds(['receita']);
                            } else if (sc.id === 'costs_cut') {
                              setAsmTargetType('account_group');
                              setAsmTargetIds(['custos_operacionais']);
                            } else if (['expense_increase', 'expense_reduction'].includes(sc.id)) {
                              setAsmTargetType('account_group');
                              setAsmTargetIds(['despesas_rateadas']);
                            } else {
                              setAsmTargetType('all');
                              setAsmTargetIds(['all']);
                            }

                            if (activeScenario) {
                              setAsmStartDate(activeScenario.projectionStartDate);
                              setAsmEndDate(activeScenario.projectionEndDate);
                            }

                            if (sc.id === 'revenue_replacement') {
                              setAsmAmountType('absolute_value');
                            } else {
                              setAsmAmountType('percentage');
                            }

                            setEditingAssumption({});
                          }}
                          className={`flex flex-col p-4.5 rounded-xl border text-left transition-all shadow-md cursor-pointer ${BUTTON_COLORS[sc.color]}`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="p-1.5 rounded-md bg-white/50">{sc.icon}</span>
                            <ChevronRight size={14} className="opacity-40" />
                          </div>
                          <span className="text-sm font-extrabold text-slate-900 mt-3 leading-snug">{sc.label}</span>
                          <span className="text-xs text-slate-500 font-semibold leading-tight mt-1">{sc.sublabel}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Configurações Globais do Cenário */}
                  {activeScenario && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Configuração do Horizonte</p>
                      
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Início Impacto</label>
                          <input
                            type="month"
                            value={activeScenario.projectionStartDate}
                            onChange={e => onScenarioChange({ ...activeScenario, projectionStartDate: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-semibold outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Fim Impacto</label>
                          <input
                            type="month"
                            value={activeScenario.projectionEndDate}
                            onChange={e => onScenarioChange({ ...activeScenario, projectionEndDate: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-semibold outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm text-slate-300 font-semibold">Incluir Despesas Rateadas</span>
                        <button
                          onClick={() => onScenarioChange({ ...activeScenario, includeAllocatedExpenses: !activeScenario.includeAllocatedExpenses })}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          {activeScenario.includeAllocatedExpenses ? (
                            <ToggleRight size={32} className="text-orange-500" />
                          ) : (
                            <ToggleLeft size={32} className="text-slate-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* IA integrada BrisinhAI */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Sparkles size={13} className="text-orange-400" /> Consultar FP&A IA</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'timeline', label: ' timeline de risco', icon: '📅' },
                        { id: 'breakeven', label: 'Ponto de Equilíbrio', icon: '⚖️' },
                        { id: 'actions', label: 'Plano de Ação', icon: '🎯' },
                        { id: 'summary', label: 'Resumo do Conselho', icon: '📈' },
                      ].map(q => (
                        <button
                          key={q.id}
                          onClick={() => handleAiQuestion(q.id, q.label)}
                          disabled={isAiLoading || !activeScenario?.assumptions.length}
                          className="flex items-center gap-2 p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 text-slate-200 text-left text-sm font-semibold hover:border-orange-500/40 hover:bg-orange-950/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <span>{q.icon}</span>
                          <span className="leading-tight">{q.label}</span>
                          {aiQuestion === q.id && isAiLoading && <Loader2 size={12} className="ml-auto animate-spin text-orange-500 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ══ ABA PREMISSAS: LISTA DE APLICAÇÃO ══ */}
              {activeTab === 'premissas' && activeScenario && (
                <div className="space-y-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Premissas Ativas no Cenário</p>
                  
                  {activeScenario.assumptions.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                      <HelpCircle size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Nenhuma premissa aplicada ainda.</p>
                      <button onClick={() => setActiveTab('dashboard')} className="text-orange-500 text-xs font-bold mt-2 hover:underline cursor-pointer">
                        Adicionar primeiro cenário
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {activeScenario.assumptions.map(asm => (
                        <div key={asm.id} className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex items-start justify-between">
                          <div>
                            <p className="text-sm font-black text-white">
                              {asm.type === 'contract_loss' && 'Perda de Contrato'}
                              {asm.type === 'revenue_increase' && 'Aumento de Receita'}
                              {asm.type === 'revenue_reduction' && 'Redução de Receita'}
                              {asm.type === 'expense_increase' && 'Aumento de Despesa'}
                              {asm.type === 'expense_reduction' && 'Redução de Despesa'}
                              {asm.type === 'costs_cut' && 'Corte de Custos'}
                              {asm.type === 'revenue_replacement' && 'Reposição de Receita'}
                              {asm.type === 'macro_driver' && `Reajuste via ${asm.macroIndex}`}
                            </p>
                            <p className="text-xs text-slate-400 mt-1.5">
                              Foco: {asm.targetType === 'all' ? 'Portfólio Inteiro' : asm.targetIds.join(', ')}
                            </p>
                            <p className="text-xs text-orange-400 font-mono mt-1 font-bold">
                              {asm.amountType === 'percentage' ? `${asm.value > 0 ? '+' : ''}${asm.value}%` : fmt(asm.value)}
                              {asm.recurrence === 'linear_ramp' && ' (Curva Linear)'}
                              {asm.recurrence === 'one_time' && ' (Única)'}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono mt-1">
                              De {isoToCol(asm.startDate)} até {isoToCol(asm.endDate)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveAssumption(asm.id)}
                            className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ ABA COMPARADOR: LISTA DE CENÁRIOS SALVOS ══ */}
              {activeTab === 'comparador' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cenários Executivos Salvos</p>
                    <span className="text-xs font-mono text-slate-400">{savedScenarios.length} cenários</span>
                  </div>

                  {savedScenarios.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                      <Save size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Nenhum cenário salvo ainda no LocalStorage.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {savedScenarios.map(sc => (
                        <div
                          key={sc.id}
                          className={`border rounded-xl p-4 flex items-center justify-between transition-all ${activeScenario?.id === sc.id ? 'border-orange-500 bg-slate-900' : 'border-slate-800 bg-slate-950/40'}`}
                        >
                          <button
                            onClick={() => onScenarioChange(sc)}
                            className="flex-1 text-left cursor-pointer"
                          >
                            <p className="text-sm font-bold text-white leading-tight">{sc.name}</p>
                            <p className="text-xs text-slate-400 mt-1 font-mono">
                              Premissas: {sc.assumptions.length} · Projeção: {isoToCol(sc.projectionStartDate)}...{isoToCol(sc.projectionEndDate)}
                            </p>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleDuplicateScenario(sc)}
                              title="Duplicar Cenário"
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteScenario(sc.id)}
                              title="Deletar Cenário"
                              className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ ABA TABELA: INFO SIMPLES ══ */}
              {activeTab === 'tabela' && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">DRE Projetado Detalhado</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você pode visualizar o detalhamento completo mês a mês na coluna da direita alternando para a aba correspondente.
                  </p>
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => setActiveTab('tabela')}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg py-2.5 text-xs font-bold cursor-pointer"
                    >
                      Exportar Cenário
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* KPI Rápido Inferior */}
            {orig && sim && (
              <div className="flex-shrink-0 bg-slate-950 border-t border-slate-850 p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">Fluxo de Caixa Livre</span>
                  <Delta o={orig.fcl} s={sim.fcl} large />
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-slate-450">Base: {fmt(orig.fcl)}</span>
                  <span className="text-xl font-black text-white font-mono">{fmt(sim.fcl)}</span>
                </div>
              </div>
            )}

          </div>

          {/* ════ COLUNA DIREITA — PAINÉIS ANALÍTICOS GIGANTES (100% PRO) ════ */}
          <div className="flex-1 overflow-y-auto bg-slate-950 p-8 space-y-8 flex flex-col">
            
            {/* Avisos Executivos e KPIs Expandidos */}
            <div className="flex-shrink-0 flex gap-6 items-stretch">
              
              {/* Score de Risco */}
              {orig && sim && riskScore && (
                <div className="w-[300px] border border-slate-800 bg-slate-900/40 rounded-2xl p-5 flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0" style={{ backgroundColor: `${riskScore.gaugeColor}20` }}>
                    <Gauge size={24} style={{ color: riskScore.gaugeColor }} />
                    <span className="text-xs font-black mt-0.5" style={{ color: riskScore.gaugeColor }}>{riskScore.score}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Risco do Cenário</span>
                    <p className={`text-xl font-black ${riskScore.score > 70 ? 'text-rose-500' : riskScore.score > 40 ? 'text-orange-500' : 'text-emerald-500'}`}>
                      {riskScore.label}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                      FCL: {fmtPct(((sim.fcl - orig.fcl) / (orig.fcl || 1)) * 100)}
                    </p>
                  </div>
                </div>
              )}

              {/* KPIs Principais Expandidos */}
              {orig && sim && (
                <div className="flex-1 grid grid-cols-3 gap-4">
                  {[
                    { label: 'Receita Operacional', o: orig.totalEntradas, s: sim.totalEntradas },
                    { label: 'Custos Operacionais', o: orig.totalCustos, s: sim.totalCustos, invert: true },
                    { label: 'EBITDA Operacional', o: orig.resultado, s: sim.resultado },
                  ].map(k => (
                    <div key={k.label} className="border border-slate-800 bg-slate-900/40 rounded-2xl p-4.5 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{k.label}</span>
                        <Delta o={k.o} s={k.s} invert={k.invert} />
                      </div>
                      <div className="mt-3">
                        <p className="text-[10px] text-slate-450 font-mono">Base: {fmt(k.o)}</p>
                        <p className="text-2xl font-black text-white font-mono mt-0.5">{fmt(k.s)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ══ GRÁFICOS E ANÁLISES EXECUTIVAS ══ */}
            <div className="flex-1 flex flex-col gap-6">

              {/* ABA 1: DASHBOARD ANALÍTICO & PREMISSAS (GRÁFICOS EXPANDIDOS) */}
              {(activeTab === 'dashboard' || activeTab === 'premissas') && (
                <div className="grid grid-cols-2 gap-6 items-stretch flex-1">
                  
                  {/* Gráfico 1: Evolução Base vs Simulado (Ampliado para PC) */}
                  <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-6 flex flex-col justify-between min-h-[380px]">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 size={15} className="text-orange-500" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Evolução Mensal: Original vs. Simulado</span>
                    </div>
                    <div className="flex-1 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={evolucaoData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v: any, name: any) => [fmt(Number(v)), name] as any} contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                          <Bar dataKey="Receita Base" fill="#10b981" fillOpacity={0.2} radius={[4, 4, 0, 0]} maxBarSize={16} />
                          <Bar dataKey="Receita Sim." fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={16} />
                          <Line type="monotone" dataKey="FCL Base" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                          <Line type="monotone" dataKey="FCL Sim." stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: '#f97316' }} />
                          <ReferenceLine y={0} stroke="#475569" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Gráfico 2: Ponte de Impacto EBITDA (Waterfall) */}
                  <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-6 flex flex-col justify-between min-h-[380px]">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp size={15} className="text-orange-500" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Ponte de EBITDA: Construção de Impactos</span>
                    </div>
                    <div className="flex-1 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v: any, name: any, prop: any) => [fmt(prop.payload.rawValue), ''] as any} contentStyle={tooltipStyle} />
                          <Bar dataKey="base" stackId="wf" fill="transparent" />
                          <Bar dataKey="bar" stackId="wf" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {waterfallData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.isFinal
                                    ? (entry.rawValue >= 0 ? '#3b82f6' : '#ef4444')
                                    : (entry.positive ? '#10b981' : '#ef4444')
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Tornado Chart (Sensibilidade do FCL) */}
                  <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-6 flex flex-col justify-between min-h-[360px]">
                    <div className="flex items-center gap-2 mb-4">
                      <ListFilter size={15} className="text-orange-500" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Tornado Chart: Sensibilidade do FCL</span>
                    </div>
                    <div className="flex-1 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tornadoData} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                          <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis dataKey="variable" type="category" tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} width={130} />
                          <Tooltip formatter={(v: any) => [fmt(Number(v)), 'Desvio FCL'] as any} contentStyle={tooltipStyle} />
                          <Bar dataKey="positivo" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={14} />
                          <Bar dataKey="negativo" fill="#ef4444" radius={[4, 0, 0, 4]} maxBarSize={14} />
                          <ReferenceLine x={0} stroke="#475569" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Heatmap de Sensibilidade */}
                  <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-6 flex flex-col justify-between min-h-[360px]">
                    <div className="flex items-center gap-2 mb-4">
                      <Percent size={15} className="text-orange-500" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Heatmap de Impactos (Mês x Categoria DRE)</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="grid" style={{ gridTemplateColumns: `140px repeat(${heatmapGrid.cols.length}, 1fr)` }}>
                        {/* Header */}
                        <div className="text-[9px] text-slate-500 font-bold uppercase p-1">Categoria</div>
                        {heatmapGrid.cols.map(c => (
                          <div key={c} className="text-[9px] text-slate-400 font-bold font-mono text-center p-1 border-b border-slate-800">{c}</div>
                        ))}

                        {/* Linhas */}
                        {heatmapGrid.cats.map(cat => {
                          const displayLabel = cat.replace('Total ', '').replace(' Operacionais', '').replace(' Rateadas', '');
                          return (
                            <React.Fragment key={cat}>
                              <div className="text-[10px] text-slate-300 font-semibold py-2 border-b border-slate-850 flex items-center">{displayLabel}</div>
                              {heatmapGrid.cols.map(col => {
                                const cell = heatmapGrid.grid.find(g => g.cat === cat && g.col === col);
                                const val = cell?.pct || 0;
                                
                                // Determinar cor
                                let bg = 'bg-slate-900/40 text-slate-450';
                                if (val > 1) bg = 'bg-emerald-500/20 text-emerald-300';
                                else if (val < -1) bg = 'bg-rose-500/20 text-rose-300';

                                return (
                                  <div
                                    key={col}
                                    className={`text-[9px] font-mono font-bold flex flex-col items-center justify-center p-2 border-b border-slate-850 ${bg}`}
                                  >
                                    <span>{val > 0 ? '+' : ''}{val.toFixed(0)}%</span>
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* ABA 2: FORMULÁRIO DE PREMISSAS ADICIONADAS (REMOVIDO DAQUI E TRANSFORMA EM MODAL GLOBAL) */}

              {/* ABA 3: COMPARAÇÃO DE CENÁRIOS SALVOS */}
              {activeTab === 'comparador' && (
                <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-6 flex flex-col justify-between flex-1">
                  <div className="flex items-center gap-2 mb-6">
                    <Grid size={15} className="text-orange-500" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Comparador de Cenários DRE</span>
                  </div>

                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-450">
                          <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Indicador Executivo</th>
                          <th className="px-4 py-3 text-right font-bold font-mono">DRE Base</th>
                          <th className="px-4 py-3 text-right font-bold font-mono text-orange-400">Ativo ({activeScenario?.name})</th>
                          {savedScenarios.slice(0, 3).map(sc => (
                            <th key={sc.id} className="px-4 py-3 text-right font-bold font-mono">{sc.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {[
                          { label: 'Receitas Operacionais', key: 'Total Entradas Operacionais' },
                          { label: 'Custos Operacionais', key: 'Total Custos Operacionais', invert: true },
                          { label: 'Despesas Rateadas', key: 'Total Despesas Rateadas', invert: true },
                          { label: 'Lucro antes do FCL (EBITDA)', key: 'Lucro antes do FCL' },
                          { label: 'Fluxo de Caixa Livre FCL', key: 'Fluxo de Caixa Livre FCL' }
                        ].map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-900/10">
                            <td className="px-4 py-3.5 font-semibold text-slate-200">{row.label}</td>
                            <td className="px-4 py-3.5 text-right font-mono font-medium">{originalResults ? fmt(originalResults.totais[row.key] || 0) : '—'}</td>
                            <td className="px-4 py-3.5 text-right font-mono font-bold text-orange-400">
                              {simulatedResults ? fmt(simulatedResults.totais[row.key] || 0) : '—'}
                            </td>
                            {savedScenarios.slice(0, 3).map(sc => {
                              // Calcular o cenário na hora para exibição
                              const scRes = DreSimulatorEngine.runSimulation(
                                rawData,
                                metadata!,
                                originalResults!.estrutura,
                                {
                                  empresas: [], periodos: [], departamentos: [], contasDre: [], projetos: [], categorias: [], excludeSharedExpenses: false
                                },
                                sc,
                                {} as any
                              );
                              return (
                                <td key={sc.id} className="px-4 py-3.5 text-right font-mono text-slate-400">
                                  {fmt(scRes.totais[row.key] || 0)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ABA 4: TABELA DRE DETALHADA MÊS A MÊS */}
              {activeTab === 'tabela' && simulatedResults && originalResults && (
                <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-6 flex flex-col justify-between flex-1">
                  <div className="flex items-center gap-2 mb-6">
                    <FileSpreadsheet size={15} className="text-orange-500" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Demonstração Mensal Comparativa (Simulado vs. Base)</span>
                  </div>

                  <div className="flex-1 overflow-auto max-h-[500px]">
                    <table className="w-full text-[11px] text-slate-350">
                      <thead className="bg-slate-950/40 text-slate-450 sticky top-0 z-10">
                        <tr className="border-b border-slate-800">
                          <th className="px-3 py-2.5 text-left font-bold">Mês</th>
                          <th className="px-3 py-2.5 text-right font-bold">Receita (Base)</th>
                          <th className="px-3 py-2.5 text-right font-bold text-orange-400">Receita (Sim.)</th>
                          <th className="px-3 py-2.5 text-right font-bold">Δ Abs.</th>
                          <th className="px-3 py-2.5 text-right font-bold">Δ %</th>
                          <th className="px-3 py-2.5 text-right font-bold">FCL (Base)</th>
                          <th className="px-3 py-2.5 text-right font-bold text-orange-400">FCL (Sim.)</th>
                          <th className="px-3 py-2.5 text-right font-bold">Δ Abs.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 font-mono">
                        {columns.map((col, idx) => {
                          const isProj = colToIso(col) > colToIso(originalResults.validColumns[originalResults.validColumns.length - 1]);
                          const oRev = originalResults.mensal['Total Entradas Operacionais']?.[col] || (isProj ? simulatedResults.mensal['Total Entradas Operacionais']?.[col] : 0);
                          const sRev = simulatedResults.mensal['Total Entradas Operacionais']?.[col] || 0;
                          
                          const oFcl = originalResults.mensal['Fluxo de Caixa Livre FCL']?.[col] || (isProj ? simulatedResults.mensal['Fluxo de Caixa Livre FCL']?.[col] : 0);
                          const sFcl = simulatedResults.mensal['Fluxo de Caixa Livre FCL']?.[col] || 0;

                          const revDiff = sRev - oRev;
                          const revPct = oRev !== 0 ? (revDiff / oRev) * 100 : 0;
                          const fclDiff = sFcl - oFcl;

                          return (
                            <tr key={col} className={`hover:bg-slate-900/10 ${idx % 2 === 0 ? 'bg-slate-900/5' : 'bg-slate-900/20'}`}>
                              <td className="px-3 py-2 font-bold text-slate-200">{col}</td>
                              <td className="px-3 py-2 text-right">{fmt(oRev)}</td>
                              <td className="px-3 py-2 text-right text-orange-400 font-bold">{fmt(sRev)}</td>
                              <td className={`px-3 py-2 text-right font-bold ${revDiff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmt(revDiff)}</td>
                              <td className={`px-3 py-2 text-right font-bold ${revPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{revPct.toFixed(1)}%</td>
                              <td className="px-3 py-2 text-right">{fmt(oFcl)}</td>
                              <td className="px-3 py-2 text-right text-orange-400 font-bold">{fmt(sFcl)}</td>
                              <td className={`px-3 py-2 text-right font-bold ${fclDiff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmt(fclDiff)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Box de Resposta da IA Integrada BrisinhAI (Sempre ao rodar IA) */}
              {(aiResponse || isAiLoading) && (
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Sparkles size={14} className="text-white" />
                    </div>
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">BrisinhAI — FP&A Insight</span>
                  </div>
                  {isAiLoading ? (
                    <div className="flex items-center gap-3 text-slate-400 text-sm">
                      <Loader2 size={16} className="animate-spin text-orange-500" />
                      Calculando desvios e gerando narrativa de recomendação...
                    </div>
                  ) : (
                    <p className="text-slate-350 text-xs md:text-sm leading-relaxed whitespace-pre-wrap font-medium">{aiResponse}</p>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {editingAssumption && (
        <div className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-2xl w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Zap className="text-orange-500" size={18} /> Configure a Premissa de Simulação
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Mapeamento da Premissa</label>
                <select
                  value={asmType}
                  onChange={e => setAsmType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="revenue_increase">Aumento de Receita</option>
                  <option value="revenue_reduction">Redução de Receita</option>
                  <option value="contract_loss">Perda de Contrato</option>
                  <option value="revenue_replacement">Reposição de Receita</option>
                  <option value="expense_increase">Aumento de Despesa</option>
                  <option value="expense_reduction">Redução de Despesa</option>
                  <option value="costs_cut">Corte de Custos</option>
                  <option value="macro_driver">Cenário Macroeconômico</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Tipo de Aplicação</label>
                <select
                  value={asmAmountType}
                  onChange={e => setAsmAmountType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="percentage">Percentual (%)</option>
                  <option value="absolute_value">Valor Absoluto (R$)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Valor do Impacto</label>
                <input
                  type="number"
                  value={asmValue}
                  onChange={e => setAsmValue(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Início (Mês/Ano)</label>
                <input
                  type="month"
                  value={asmStartDate}
                  onChange={e => setAsmStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Fim (Mês/Ano)</label>
                <input
                  type="month"
                  value={asmEndDate}
                  onChange={e => setAsmEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none font-mono"
                />
              </div>
            </div>

            {asmType === 'contract_loss' && metadata && (
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Selecione o Contrato/Departamento</label>
                <select
                  value={asmTargetIds[0] || ''}
                  onChange={e => setAsmTargetIds([e.target.value])}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="">Selecione...</option>
                  {metadata.departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {asmType === 'macro_driver' && (
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Índice Macroeconômico</label>
                <select
                  value={asmMacroIndex}
                  onChange={e => setAsmMacroIndex(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="IPCA">IPCA (Inflação Oficial)</option>
                  <option value="INCC">INCC (Construção Civil)</option>
                  <option value="CDI">CDI (Custos Financeiros)</option>
                  <option value="SELIC">SELIC (Taxa de Juros)</option>
                  <option value="dissidio">Dissídio Anual de Folha</option>
                </select>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <button
                onClick={() => setEditingAssumption(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-5 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddAssumption}
                className="bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-5 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer shadow-md"
              >
                Confirmar Premissa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deltas de Comparação Visual ──────────────────────────────────────────────
const Delta = ({ o, s, invert = false, large = false }: { o: number; s: number; invert?: boolean; large?: boolean }) => {
  const d = s - o;
  if (Math.abs(d) < 0.01) return <span className="text-slate-500 font-mono text-xs">—</span>;
  const good = invert ? d < 0 : d > 0;
  const cls = good ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25' : 'text-rose-500 bg-rose-500/10 border-rose-500/25';
  return (
    <span className={`font-mono font-bold border px-2 py-0.5 rounded-md flex items-center gap-0.5 ${large ? 'text-sm' : 'text-[10px]'} ${cls}`}>
      {good ? <ArrowUpRight size={large ? 14 : 11} /> : <ArrowDownRight size={large ? 14 : 11} />}
      {fmt(d)}
    </span>
  );
};
