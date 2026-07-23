"use client";

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  ChevronLeft, X, ExternalLink, Loader2, Zap, Target,
  Activity, Clock, Calculator, Check, Building2,
  RotateCcw, PlayCircle, Sparkles, TrendingDown, TrendingUp,
  Wallet, Percent, FileText, Info
} from 'lucide-react';
import { DreRow, DreMetadata } from '@/types/dre';
import {
  DreSimulatorEngine,
  SimulatorV3Params,
  ContractLossItem,
  calculateV3SimulationEngine
} from '@/services/dre-simulator.engine';
import { DEFAULT_DRE_ESTRUTURA } from '@/services/dre.service';
import { DreLancamentosService } from '@/services/dre-lancamentos.service';

// ─── Helpers ────────────────────────────────────────────
const fmt = (v?: number) =>
  v == null || isNaN(v)
    ? 'R$ 0,00'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtPct = (v?: number) => {
  if (v == null || isNaN(v)) return '0,0%';
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
};

// ─── Tipos ──────────────────────────────────────────────
type AuditModal = 'breakeven' | 'runway' | 'ebitda' | 'replacement' | null;
type Periodicity = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

const DEFAULT_PARAMS: SimulatorV3Params = {
  selectedEmpresas: [],
  enableRevenueAdj: false,
  revenueType: 'percentage',
  revenueValue: 10,
  enableCostsAdj: false,
  costsType: 'percentage',
  costsValue: 10,
  enableExpensesAdj: false,
  expensesType: 'percentage',
  expensesValue: 10,
  enableContractLoss: false,
  selectedContracts: [],
  initialCash: 500000,
};

// ─── Componente Principal ────────────────────────────────
export default function DreSimulatorPage() {
  // Dados
  const [rawData, setRawData] = useState<DreRow[]>([]);
  const [metadata, setMetadata] = useState<DreMetadata>({
    empresas: [], periodos: [], departamentos: [],
    contasDre: [], projetos: [], categorias: [], mapaMeses: {}
  });
  const [isLoading, setIsLoading] = useState(true);

  // Empresa
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);

  // Draft (o que o usuário digita) vs Applied (o que o motor usa)
  const [draft, setDraft] = useState<SimulatorV3Params>({ ...DEFAULT_PARAMS });
  const [applied, setApplied] = useState<SimulatorV3Params | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Contrato em edição
  const [contractName, setContractName] = useState('');
  const [contractValue, setContractValue] = useState(30000);
  const [contractMonths, setContractMonths] = useState(12);

  // UI state
  const [auditModal, setAuditModal] = useState<AuditModal>(null);
  const [periodicity, setPeriodicity] = useState<Periodicity>('mensal');
  const [isGammaOpen, setIsGammaOpen] = useState(false);
  const [isGammaLoading, setIsGammaLoading] = useState(false);
  const [gammaUrl, setGammaUrl] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [includeAi, setIncludeAi] = useState(true);

  // ─── Carregar Dados ──────────────────────────────────────
  React.useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const { rows } = await DreLancamentosService.fetchAllForDashboard();
        if (rows?.length) {
          setRawData(rows);
          setMetadata(DreLancamentosService.generateMetadataFromRows(rows));
        }
      } catch (e) {
        console.error('[Simulador V3]', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ─── Contratos disponíveis ───────────────────────────────
  const contracts = useMemo(() => {
    if (!rawData.length) return [];
    const map = new Map<string, { total: number; months: number }>();
    const cols = Object.keys(rawData[0] || {}).filter(k => k.includes('/'));
    rawData.forEach(r => {
      const empOk = !selectedEmpresas.length || selectedEmpresas.includes(r.Empresa);
      if (!empOk || !r.Projeto || ['–', '-', 'Geral', 'Sem Projeto'].includes(r.Projeto)) return;
      if (!['Receita Bruta de Vendas', 'Receitas Indiretas'].includes(r.ContaDRE)) return;
      if (!map.has(r.Projeto)) map.set(r.Projeto, { total: 0, months: 0 });
      const e = map.get(r.Projeto)!;
      cols.forEach(c => {
        const v = parseFloat(r[c]?.toString().replace(',', '.') || '0');
        if (!isNaN(v) && v > 0) { e.total += v; e.months++; }
      });
    });
    return Array.from(map.entries())
      .map(([name, { total, months }]) => ({ name, avg: Math.round(total / Math.max(1, cols.length)) }))
      .filter(c => c.avg > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rawData, selectedEmpresas]);

  // ─── Motor Base (sem premissas) ──────────────────────────
  const baseResult = useMemo(() => {
    if (!rawData.length) return null;
    return DreSimulatorEngine.runSimulation(rawData, metadata, DEFAULT_DRE_ESTRUTURA, {
      empresas: selectedEmpresas, periodos: [], departamentos: [],
      contasDre: [], projetos: [], categorias: [], excludeSharedExpenses: false
    }, {
      id: 'base', name: 'Real', basePeriod: [],
      projectionStartDate: '2025-01', projectionEndDate: '2026-12',
      mode: 'historical_what_if', includeAllocatedExpenses: true,
      assumptions: [], createdAt: '', updatedAt: ''
    });
  }, [rawData, metadata, selectedEmpresas]);

  // ─── Motor Simulado (só roda com applied) ───────────────
  const simulation = useMemo(() => {
    if (!rawData.length || !baseResult || !applied) return null;
    return calculateV3SimulationEngine(rawData, metadata, DEFAULT_DRE_ESTRUTURA, {
      empresas: selectedEmpresas, periodos: [], departamentos: [],
      contasDre: [], projetos: [], categorias: [], excludeSharedExpenses: false
    }, applied, baseResult);
  }, [rawData, metadata, selectedEmpresas, applied, baseResult]);

  // ─── Handlers ────────────────────────────────────────────
  const updateDraft = useCallback(<K extends keyof SimulatorV3Params>(key: K, val: SimulatorV3Params[K]) => {
    setDraft(p => ({ ...p, [key]: val }));
    setHasChanges(true);
  }, []);

  const handleApply = () => {
    setApplied({ ...draft, selectedEmpresas });
    setHasChanges(false);
    setAiText(null);
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_PARAMS });
    setApplied(null);
    setHasChanges(false);
    setAiText(null);
    setGammaUrl(null);
    setContractName('');
    setContractValue(30000);
    setContractMonths(12);
  };

  const toggleEmpresa = (emp: string) => {
    setSelectedEmpresas(p => {
      const next = p.includes(emp) ? p.filter(e => e !== emp) : [...p, emp];
      setHasChanges(true);
      return next;
    });
  };

  const addContract = () => {
    if (!contractName) return;
    const item: ContractLossItem = {
      contractName, monthlyValue: contractValue,
      replacementMonths: contractMonths, startDate: '2026-07'
    };
    updateDraft('selectedContracts', [
      ...draft.selectedContracts.filter(c => c.contractName !== contractName),
      item
    ]);
    setContractName('');
  };

  const removeContract = (name: string) =>
    updateDraft('selectedContracts', draft.selectedContracts.filter(c => c.contractName !== name));

  // ─── Dados Calculados ────────────────────────────────────
  const m = simulation?.metrics;
  const audit = m?.audit;

  const salesTarget = useMemo(() => {
    if (!m || !applied?.enableContractLoss || !applied?.selectedContracts.length) return null;
    let loss = 0, maxMonths = 1;
    applied.selectedContracts.forEach(c => {
      loss += c.monthlyValue;
      if (c.replacementMonths > maxMonths) maxMonths = c.replacementMonths;
    });
    if (loss <= 0) return null;
    return { loss, months: maxMonths, monthly: Math.round(loss / maxMonths) };
  }, [m, applied]);

  // Labels do mês atual em diante (Jul/26)
  const futureLabels = ['Jul/26','Ago/26','Set/26','Out/26','Nov/26','Dez/26','Jan/27','Fev/27','Mar/27','Abr/27','Mai/27','Jun/27'];

  const cashData = useMemo(() => {
    if (!audit) return futureLabels.map(mes => ({ mes, 'Real': 0, 'Simulado': 0 }));
    const netBase = audit.monthlyRevenueReal - audit.monthlyCostsReal - audit.monthlyExpensesReal;
    const netSim  = audit.monthlyRevenueSim  - audit.monthlyCostsSim  - audit.monthlyExpensesSim;
    const cash0 = (applied?.initialCash ?? 500000);
    let rb = cash0, rs = cash0;
    return futureLabels.map(mes => {
      rb += netBase; rs += netSim;
      return { mes, 'Real': Math.round(rb), 'Simulado': Math.round(rs) };
    });
  }, [audit, applied]);

  const groupedCash = useMemo(() => {
    if (periodicity === 'mensal') return cashData;
    const g: Record<string, any> = {};
    cashData.forEach((d, i) => {
      let k = d.mes;
      if (periodicity === 'bimestral')  k = `Bim${Math.floor(i/2)+1}`;
      if (periodicity === 'trimestral') k = `${Math.floor(i/3)+1}ºTri`;
      if (periodicity === 'semestral')  k = `${Math.floor(i/6)+1}ºSem`;
      if (periodicity === 'anual')      k = '12 meses';
      if (!g[k]) g[k] = { mes: k, Real: 0, Simulado: 0 };
      g[k].Real = d['Real']; g[k].Simulado = d['Simulado'];
    });
    return Object.values(g);
  }, [cashData, periodicity]);

  const barData = useMemo(() => {
    if (!audit) return [];
    return [
      { name: 'Receita', Real: Math.round(audit.monthlyRevenueReal), Simulado: Math.round(audit.monthlyRevenueSim) },
      { name: 'Custos',  Real: Math.round(audit.monthlyCostsReal),   Simulado: Math.round(audit.monthlyCostsSim) },
      { name: 'Despesas',Real: Math.round(audit.monthlyExpensesReal),Simulado: Math.round(audit.monthlyExpensesSim) },
      { name: 'Lucro',   Real: Math.round(audit.monthlyRevenueReal - audit.monthlyCostsReal - audit.monthlyExpensesReal),
                         Simulado: Math.round(audit.monthlyRevenueSim - audit.monthlyCostsSim - audit.monthlyExpensesSim) },
    ];
  }, [audit]);

  // ─── BrisinhAI ───────────────────────────────────────────
  const runAi = async () => {
    if (!m) return;
    setIsAiLoading(true);
    setAiText(null);
    try {
      const prompt = `Análise executiva do Simulador DRE V3:
- Break-Even Real: ${fmt(m.breakEvenPointReal)}/mês | Simulado: ${fmt(m.breakEvenPointSimulated)}/mês
- EBITDA Real: ${m.ebitdaMarginReal.toFixed(1)}% | Simulado: ${m.ebitdaMarginSimulated.toFixed(1)}%
- Cash Runway: ${m.isRunwaySustainable ? 'Sustentável' : `Zera no mês ${m.zeroCashMonth}`}
${salesTarget ? `- Meta de Vendas: ${fmt(salesTarget.monthly)}/mês em ${salesTarget.months} meses` : ''}
Forneça 3 tópicos: 1. Diagnóstico; 2. Riscos; 3. Recomendações.`;
      const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, text: prompt }) });
      const data = await res.json();
      setAiText(data.analysis || data.response || '');
    } catch {
      setAiText('BrisinhAI indisponível no momento.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // ─── Gamma ───────────────────────────────────────────────
  const handleGamma = async () => {
    if (!m || !audit) return;
    setIsGammaLoading(true); setGammaUrl(null);
    try {
      const md = `# Simulador Executivo DRE V3\n\n## Indicadores\n- **Faturamento Médio Real**: ${fmt(audit.monthlyRevenueReal)}\n- **Break-Even Real**: ${fmt(m.breakEvenPointReal)}/mês | **Simulado**: ${fmt(m.breakEvenPointSimulated)}/mês\n- **EBITDA**: ${m.ebitdaMarginReal.toFixed(1)}% → ${m.ebitdaMarginSimulated.toFixed(1)}%\n- **Cash Runway**: ${m.isRunwaySustainable ? 'Sustentável' : `Zera em ${m.zeroCashMonth}`}\n${salesTarget ? `- **Meta Comercial**: ${fmt(salesTarget.monthly)}/mês por ${salesTarget.months} meses` : ''}\n\n## Demonstrativo Mensal\n- Receita: ${fmt(audit.monthlyRevenueReal)} → ${fmt(audit.monthlyRevenueSim)}\n- Custos: ${fmt(audit.monthlyCostsReal)} → ${fmt(audit.monthlyCostsSim)}\n- Despesas: ${fmt(audit.monthlyExpensesReal)} → ${fmt(audit.monthlyExpensesSim)}\n\n${includeAi && aiText ? `## Parecer BrisinhAI\n${aiText}` : ''}`;
      const r = await fetch('/api/gamma/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markdownReport: md }) });
      const d = await r.json();
      const gid = d.id || d.generationId;
      if (gid) {
        for (let i = 0; i < 25; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const s = await fetch(`/api/gamma/status/${gid}`);
          if (s.ok) { const sd = await s.json(); const u = sd.gammaUrl || sd.url; if (u) { setGammaUrl(u); break; } }
        }
      } else { const u = d.gammaUrl || d.url; if (u) setGammaUrl(u); }
    } catch (e) { console.error(e); alert('Erro ao gerar apresentação Gamma.'); }
    finally { setIsGammaLoading(false); }
  };

  // ─── Loading ─────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center gap-4 text-white">
      <Loader2 className="animate-spin text-emerald-400" size={36} />
      <div>
        <p className="font-bold">Carregando dados DRE...</p>
        <p className="text-slate-400 text-sm">Conectando ao banco de dados</p>
      </div>
    </div>
  );

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-12">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dre" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all">
              <ChevronLeft size={15} /> Voltar ao DRE
            </Link>
            <div className="hidden sm:block h-4 w-px bg-slate-700" />
            <div>
              <h1 className="text-base font-black text-white flex items-center gap-2">
                ⚡ Simulador DRE V3
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">Cenários Futuros</span>
              </h1>
              <p className="text-[11px] text-slate-400">Configure as premissas e clique em Aplicar</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all">
              <RotateCcw size={14} /> Resetar
            </button>
            {simulation && (
              <button onClick={() => { setIsGammaOpen(true); setGammaUrl(null); }} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs rounded-lg shadow-lg transition-all">
                <Zap size={14} /> Gamma 🚀
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN LAYOUT ─────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-5 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ════════════════════════════════════════════════════
              PAINEL ESQUERDO — CONFIGURAÇÃO (5 COLUNAS)
             ════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-4">

            {/* Empresa */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Building2 size={15} className="text-amber-400" /> Empresa
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setSelectedEmpresas([]); setHasChanges(true); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedEmpresas.length === 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
                >Todas</button>
                {metadata.empresas.map(e => (
                  <button key={e} onClick={() => toggleEmpresa(e)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedEmpresas.includes(e) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}
                  >
                    {selectedEmpresas.includes(e) && <Check size={12} />} {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Premissas */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Premissas do Cenário</span>
                {hasChanges && <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30 font-bold">Não aplicado</span>}
              </div>

              {/* P1: Receita */}
              <PremissaRow
                icon={<Wallet size={15} className="text-emerald-400" />}
                label="Variação de Receita"
                hint="Simule aumento (+) ou queda (–) na receita mensal"
                enabled={draft.enableRevenueAdj}
                onToggle={v => updateDraft('enableRevenueAdj', v)}
                type={draft.revenueType}
                onTypeChange={v => updateDraft('revenueType', v as any)}
                value={draft.revenueValue}
                onValueChange={v => updateDraft('revenueValue', v)}
                color="emerald"
              />

              {/* P2: Custos */}
              <PremissaRow
                icon={<TrendingDown size={15} className="text-rose-400" />}
                label="Corte de Custos Operacionais"
                hint="Reduz custos diretos (terceirizados, CLTs, serviços)"
                enabled={draft.enableCostsAdj}
                onToggle={v => updateDraft('enableCostsAdj', v)}
                type={draft.costsType}
                onTypeChange={v => updateDraft('costsType', v as any)}
                value={draft.costsValue}
                onValueChange={v => updateDraft('costsValue', v)}
                color="rose"
              />

              {/* P3: Despesas */}
              <PremissaRow
                icon={<Percent size={15} className="text-amber-400" />}
                label="Corte de Despesas Rateadas"
                hint="Reduz despesas administrativas e overhead"
                enabled={draft.enableExpensesAdj}
                onToggle={v => updateDraft('enableExpensesAdj', v)}
                type={draft.expensesType}
                onTypeChange={v => updateDraft('expensesType', v as any)}
                value={draft.expensesValue}
                onValueChange={v => updateDraft('expensesValue', v)}
                color="amber"
              />

              {/* P4: Perda de Contrato */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                <label className="flex items-center gap-2 p-3 cursor-pointer">
                  <input type="checkbox" checked={draft.enableContractLoss}
                    onChange={e => updateDraft('enableContractLoss', e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 bg-slate-900 focus:ring-cyan-500 w-4 h-4" />
                  <FileText size={15} className="text-cyan-400" />
                  <span className="text-xs font-bold text-white">Perda de Contrato</span>
                  <span className="ml-auto text-[10px] text-slate-500">Simula encerramento</span>
                </label>

                {draft.enableContractLoss && (
                  <div className="px-3 pb-3 space-y-2 border-t border-slate-800">
                    <select value={contractName} onChange={e => {
                      setContractName(e.target.value);
                      const c = contracts.find(x => x.name === e.target.value);
                      if (c) setContractValue(c.avg);
                    }} className="w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                      <option value="">– Selecione um contrato –</option>
                      {contracts.map(c => (
                        <option key={c.name} value={c.name}>{c.name} ({fmt(c.avg)}/mês)</option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Perda Mensal (R$)</label>
                        <input type="number" value={contractValue || ''}
                          onChange={e => setContractValue(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-cyan-400 font-bold focus:outline-none focus:border-cyan-500" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Meses de Reposição</label>
                        <input type="number" min="1" max="60" value={contractMonths || ''}
                          onChange={e => setContractMonths(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500" />
                      </div>
                    </div>

                    <button onClick={addContract} disabled={!contractName}
                      className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-40">
                      + Adicionar ao Cenário
                    </button>

                    {draft.selectedContracts.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {draft.selectedContracts.map(c => (
                          <div key={c.contractName} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px]">
                            <div>
                              <span className="font-bold text-white">{c.contractName}</span>
                              <span className="text-slate-400 ml-2">{fmt(c.monthlyValue)}/mês · {c.replacementMonths}m</span>
                            </div>
                            <button onClick={() => removeContract(c.contractName)} className="text-slate-500 hover:text-rose-400 ml-2"><X size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Caixa inicial */}
              <div className="flex items-center gap-3 pt-1">
                <label className="text-[11px] text-slate-400 font-bold whitespace-nowrap">Caixa Inicial</label>
                <input type="number" step="50000" value={draft.initialCash || ''}
                  onChange={e => updateDraft('initialCash', Number(e.target.value))}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500" />
              </div>
            </div>

            {/* Botão APLICAR */}
            <button
              onClick={handleApply}
              disabled={!hasChanges && !!applied}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${
                hasChanges
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-emerald-900/30 animate-pulse'
                  : applied
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <PlayCircle size={18} />
              {hasChanges ? 'Aplicar Simulação' : applied ? '✓ Simulação Aplicada' : 'Configure as premissas acima'}
            </button>

          </div>

          {/* ════════════════════════════════════════════════════
              PAINEL DIREITO — RESULTADOS (7 COLUNAS)
             ════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-5">

            {!simulation ? (
              /* Estado vazio */
              <div className="h-80 flex flex-col items-center justify-center text-center p-8 bg-slate-900 border border-slate-800 border-dashed rounded-2xl space-y-3">
                <PlayCircle size={48} className="text-slate-700" />
                <h3 className="font-bold text-slate-400">Nenhuma simulação ativa</h3>
                <p className="text-sm text-slate-500 max-w-xs">Configure as premissas no painel ao lado e clique em <strong className="text-emerald-400">Aplicar Simulação</strong> para ver os resultados.</p>
              </div>
            ) : (
              <>
                {/* ── KPIs ──────────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-3">
                  <KpiCard
                    label="Break-Even /mês"
                    icon={<Calculator size={15} className="text-amber-400" />}
                    value={fmt(m!.breakEvenPointSimulated)}
                    sub={`Real: ${fmt(m!.breakEvenPointReal)}`}
                    onClick={() => setAuditModal('breakeven')}
                    color="amber"
                  />
                  <KpiCard
                    label="Cash Runway"
                    icon={<Clock size={15} className={m!.isRunwaySustainable ? 'text-emerald-400' : 'text-rose-400'} />}
                    value={m!.isRunwaySustainable ? 'Sustentável' : `${m!.cashRunwayMonths} meses`}
                    sub={m!.isRunwaySustainable ? 'Caixa positivo' : `Zera: mês ${m!.zeroCashMonth}`}
                    onClick={() => setAuditModal('runway')}
                    color={m!.isRunwaySustainable ? 'emerald' : 'rose'}
                  />
                  <KpiCard
                    label="EBITDA Simulado"
                    icon={<Activity size={15} className="text-cyan-400" />}
                    value={`${m!.ebitdaMarginSimulated.toFixed(1)}%`}
                    sub={`Real: ${m!.ebitdaMarginReal.toFixed(1)}% (${fmtPct(m!.ebitdaMarginSimulated - m!.ebitdaMarginReal)})`}
                    onClick={() => setAuditModal('ebitda')}
                    color="cyan"
                  />
                </div>

                {/* Meta comercial */}
                {salesTarget && (
                  <div onClick={() => setAuditModal('replacement')} className="flex items-center justify-between bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border border-amber-500/30 hover:border-amber-400/60 rounded-xl p-4 cursor-pointer transition-all group">
                    <div className="flex items-center gap-3">
                      <Target className="text-amber-400" size={20} />
                      <div>
                        <p className="text-xs font-bold text-white group-hover:text-amber-300">🎯 Meta Mensal de Reposição Comercial</p>
                        <p className="text-[11px] text-slate-400">Perda de {fmt(salesTarget.loss)}/mês · {salesTarget.months} meses de janela</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-amber-400">{fmt(salesTarget.monthly)}<span className="text-[10px] text-slate-400">/mês</span></span>
                  </div>
                )}

                {/* ── Gráfico 1: Caixa Futuro ──────────────────── */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Projeção de Caixa (Jul/26 → Jun/27)</h3>
                      <p className="text-[11px] text-slate-400">Saldo acumulado: cenário real vs simulado</p>
                    </div>
                    {/* Periodicidade junto ao gráfico */}
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 gap-0.5">
                      {(['mensal','trimestral','semestral','anual'] as Periodicity[]).map(p => (
                        <button key={p} onClick={() => setPeriodicity(p)}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md capitalize transition-all ${periodicity === p ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
                          {p.slice(0,3)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={groupedCash} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="gSim" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="mes" stroke="#475569" fontSize={10} />
                        <YAxis stroke="#475569" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', fontSize: '11px' }} formatter={(v: any) => fmt(Number(v))} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Area type="monotone" dataKey="Real" stroke="#10b981" fill="url(#gReal)" strokeWidth={2} />
                        <Area type="monotone" dataKey="Simulado" stroke="#3b82f6" fill="url(#gSim)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── Gráfico 2: DRE Sintético ─────────────────── */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Demonstrativo Sintético (Médias Mensais)</h3>
                    <p className="text-[11px] text-slate-400">Comparativo Real × Simulado</p>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#475569" fontSize={10} />
                        <YAxis stroke="#475569" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', fontSize: '11px' }} formatter={(v: any) => fmt(Number(v))} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="Real" fill="#10b981" radius={[3,3,0,0]} />
                        <Bar dataKey="Simulado" fill="#f59e0b" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── BrisinhAI (inline, discreto) ─────────────── */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-emerald-400" />
                      <span className="text-xs font-bold text-white">Análise BrisinhAI</span>
                    </div>
                    <button onClick={runAi} disabled={isAiLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                      {isAiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {isAiLoading ? 'Analisando...' : aiText ? 'Reanalisar' : 'Gerar Análise'}
                    </button>
                  </div>
                  {aiText ? (
                    <div className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                      {aiText}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">Clique em "Gerar Análise" para obter um parecer executivo do BrisinhAI sobre este cenário simulado.</p>
                  )}
                </div>

              </>
            )}
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════
          MODAIS DE AUDITORIA DE CÁLCULO
         ═══════════════════════════════════════════════════ */}
      {auditModal && simulation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  {auditModal === 'breakeven' && 'Break-Even Operacional'}
                  {auditModal === 'runway'    && 'Cash Runway'}
                  {auditModal === 'ebitda'   && 'Margem EBITDA'}
                  {auditModal === 'replacement' && 'Meta de Reposição Comercial'}
                </h3>
              </div>
              <button onClick={() => setAuditModal(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            {auditModal === 'breakeven' && audit && (
              <div className="space-y-3 text-xs">
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <code className="text-slate-400">BreakEven = Despesas Fixas ÷ Margem de Contribuição (%)</code>
                </div>
                <div className="space-y-2">
                  {[
                    ['Faturamento Médio Real', fmt(audit.monthlyRevenueReal), 'text-white'],
                    ['Custos Variáveis (65%)', `–${fmt(audit.variableCostsSim)}`, 'text-rose-400'],
                    ['Margem de Contribuição', `${audit.contributionMarginSimPct.toFixed(1)}%`, 'text-emerald-400'],
                    ['Despesas Fixas Estruturais', fmt(audit.fixedExpensesSim), 'text-amber-400'],
                  ].map(([k, v, c]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">{k}</span>
                      <span className={`font-bold ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs font-semibold">
                  {fmt(audit.fixedExpensesSim)} ÷ {audit.contributionMarginSimPct.toFixed(1)}% = <strong className="text-white">{fmt(m!.breakEvenPointSimulated)}/mês</strong>
                </div>
              </div>
            )}

            {auditModal === 'runway' && audit && (
              <div className="space-y-3 text-xs">
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <code className="text-slate-400">Runway: Caixa Mês N = Caixa₀ + Σ(Resultado Mensal)</code>
                </div>
                <div className="space-y-2">
                  {[
                    ['Caixa Inicial', fmt(applied?.initialCash ?? 500000), 'text-emerald-400'],
                    ['Resultado Líquido/Mês', fmt(audit.monthlyRevenueSim - audit.monthlyCostsSim - audit.monthlyExpensesSim), 'text-white'],
                    ['Status', m!.isRunwaySustainable ? 'Sustentável ✓' : `Zera no mês ${m!.zeroCashMonth}`, m!.isRunwaySustainable ? 'text-emerald-400' : 'text-rose-400'],
                  ].map(([k, v, c]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">{k}</span>
                      <span className={`font-bold ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {auditModal === 'ebitda' && audit && (
              <div className="space-y-3 text-xs">
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <code className="text-slate-400">EBITDA = (Resultado Operacional ÷ Faturamento) × 100</code>
                </div>
                <div className="space-y-2">
                  {[
                    ['Faturamento Simulado', fmt(audit.monthlyRevenueSim), 'text-white'],
                    ['Resultado Operacional', fmt(audit.monthlyRevenueSim - audit.monthlyCostsSim - audit.monthlyExpensesSim), 'text-cyan-400'],
                    ['Margem EBITDA', `${m!.ebitdaMarginSimulated.toFixed(1)}%`, 'text-cyan-400'],
                  ].map(([k, v, c]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">{k}</span>
                      <span className={`font-bold ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {auditModal === 'replacement' && salesTarget && (
              <div className="space-y-3 text-xs">
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <code className="text-slate-400">Meta Mensal = Perda Total ÷ Meses de Janela</code>
                </div>
                <div className="space-y-2">
                  {[
                    ['Perda Mensal de Contratos', fmt(salesTarget.loss), 'text-rose-400'],
                    ['Janela de Reposição', `${salesTarget.months} meses`, 'text-white'],
                    ['Meta Comercial Mensal', fmt(salesTarget.monthly), 'text-amber-400'],
                  ].map(([k, v, c]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">{k}</span>
                      <span className={`font-bold ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-slate-400 leading-relaxed">Atingindo essa meta todo mês, a perda estará 100% compensada ao final do prazo.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          MODAL GAMMA
         ═══════════════════════════════════════════════════ */}
      {isGammaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-amber-400" />
                <h3 className="font-bold text-white text-sm">Exportar para Gamma IA</h3>
              </div>
              <button onClick={() => setIsGammaOpen(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            {gammaUrl ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm font-bold text-white">🎉 Apresentação gerada com sucesso!</p>
                <a href={gammaUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs rounded-xl hover:scale-105 transition-all">
                  Abrir no Gamma <ExternalLink size={14} />
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">Os indicadores simulados (Break-Even, Cash Runway, EBITDA e Meta Comercial) serão convertidos em uma apresentação de slides.</p>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input type="checkbox" checked={includeAi} onChange={e => setIncludeAi(e.target.checked)} className="rounded border-slate-700 text-amber-500" />
                  Incluir parecer do BrisinhAI (se disponível)
                </label>
                <button onClick={handleGamma} disabled={isGammaLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50">
                  {isGammaLoading ? <><Loader2 size={14} className="animate-spin" /> Gerando slides...</> : '🚀 Gerar Apresentação Gamma'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Sub-Componentes ─────────────────────────────────────

function PremissaRow({ icon, label, hint, enabled, onToggle, type, onTypeChange, value, onValueChange, color }: {
  icon: React.ReactNode; label: string; hint: string;
  enabled: boolean; onToggle: (v: boolean) => void;
  type: string; onTypeChange: (v: string) => void;
  value: number; onValueChange: (v: number) => void;
  color: 'emerald' | 'rose' | 'amber';
}) {
  const borderColor = { emerald: 'border-emerald-500/30', rose: 'border-rose-500/30', amber: 'border-amber-500/30' }[color];
  const ringColor   = { emerald: 'text-emerald-500', rose: 'text-rose-500', amber: 'text-amber-500' }[color];

  return (
    <div className={`rounded-xl border bg-slate-950 overflow-hidden ${enabled ? borderColor : 'border-slate-800'} transition-all`}>
      <label className="flex items-center gap-2 p-3 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)}
          className={`rounded border-slate-700 bg-slate-900 ${ringColor} focus:ring-0 w-4 h-4`} />
        {icon}
        <span className="text-xs font-bold text-white flex-1">{label}</span>
        {!enabled && <span className="text-[10px] text-slate-500 hidden sm:block">{hint}</span>}
      </label>

      {enabled && (
        <div className="flex items-center gap-2 px-3 pb-3 border-t border-slate-800 pt-2.5">
          <select value={type} onChange={e => onTypeChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none w-28 shrink-0">
            <option value="percentage">% Percentual</option>
            <option value="absolute">R$ Absoluto</option>
          </select>
          <input type="number" value={value || ''}
            onChange={e => onValueChange(e.target.value === '' ? 0 : Number(e.target.value))}
            className={`flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none min-w-0 ${
              color === 'emerald' ? 'text-emerald-400 focus:border-emerald-500' :
              color === 'rose'    ? 'text-rose-400 focus:border-rose-500' :
                                    'text-amber-400 focus:border-amber-500'
            }`}
            placeholder={type === 'percentage' ? 'Ex: 10 (= 10%)' : 'Ex: 50000'}
          />
          <span className="text-xs text-slate-500 shrink-0">{type === 'percentage' ? '%' : 'R$'}</span>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, icon, value, sub, onClick, color }: {
  label: string; icon: React.ReactNode; value: string;
  sub: string; onClick: () => void;
  color: 'amber' | 'emerald' | 'rose' | 'cyan';
}) {
  const hover = { amber: 'hover:border-amber-500/40', emerald: 'hover:border-emerald-500/40', rose: 'hover:border-rose-500/40', cyan: 'hover:border-cyan-500/40' }[color];
  return (
    <div onClick={onClick} className={`bg-slate-900 border border-slate-800 ${hover} rounded-xl p-3 cursor-pointer transition-all group`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="text-base font-black text-white leading-tight">{value}</div>
      <div className="text-[10px] text-slate-400 mt-1">{sub}</div>
      <div className="text-[10px] text-slate-600 mt-1.5 group-hover:text-slate-400 transition-colors">▸ Ver fórmula</div>
    </div>
  );
}
