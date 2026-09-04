'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Percent,
  DollarSign,
  RotateCcw,
  Zap,
  Scissors,
  BarChart3,
  Gauge,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ConsolidatedSimulationMetrics } from '@/types/pricing-simulator.types';
import { PricingSimulatorEngine } from '@/services/pricing-simulator.engine';

interface QuickSimulationsSectionProps {
  receitaBase: number;
  custosBase: number;
  despesasBase: number;
  onApplyQuickSim?: (metrics: ConsolidatedSimulationMetrics) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${(v || 0).toFixed(1)}%`;

export function QuickSimulationsSection({
  receitaBase,
  custosBase,
  despesasBase
}: QuickSimulationsSectionProps) {
  // Estados de simulação
  const [modoReceita, setModoReceita] = useState<'percent' | 'absolute'>('absolute');
  const [valorReceita, setValorReceita] = useState<number>(-100000); // padrão: perder R$ 100k

  const [modoCustos, setModoCustos] = useState<'percent' | 'absolute'>('percent');
  const [valorCustos, setValorCustos] = useState<number>(0);

  const [modoDespesas, setModoDespesas] = useState<'percent' | 'absolute'>('percent');
  const [valorDespesas, setValorDespesas] = useState<number>(0);

  // Cálculo das variações
  const deltaReceita = useMemo(() => {
    if (modoReceita === 'percent') {
      return (receitaBase * valorReceita) / 100;
    }
    return valorReceita;
  }, [receitaBase, modoReceita, valorReceita]);

  const deltaCustos = useMemo(() => {
    if (modoCustos === 'percent') {
      return (custosBase * valorCustos) / 100;
    }
    return valorCustos;
  }, [custosBase, modoCustos, valorCustos]);

  const deltaDespesas = useMemo(() => {
    if (modoDespesas === 'percent') {
      return (despesasBase * valorDespesas) / 100;
    }
    return valorDespesas;
  }, [despesasBase, modoDespesas, valorDespesas]);

  const metrics: ConsolidatedSimulationMetrics = useMemo(() => {
    return PricingSimulatorEngine.calculateConsolidatedMetrics(
      receitaBase,
      custosBase,
      despesasBase,
      deltaReceita,
      deltaCustos,
      deltaDespesas
    );
  }, [receitaBase, custosBase, despesasBase, deltaReceita, deltaCustos, deltaDespesas]);

  // Presets rápidos (1 clique)
  const aplicarPreset = (
    tipoRec: 'percent' | 'absolute',
    valRec: number,
    tipoCst: 'percent' | 'absolute',
    valCst: number,
    tipoDesp: 'percent' | 'absolute',
    valDesp: number
  ) => {
    setModoReceita(tipoRec);
    setValorReceita(valRec);
    setModoCustos(tipoCst);
    setValorCustos(valCst);
    setModoDespesas(tipoDesp);
    setValorDespesas(valDesp);
  };

  const resetar = () => {
    setModoReceita('absolute');
    setValorReceita(0);
    setModoCustos('percent');
    setValorCustos(0);
    setModoDespesas('percent');
    setValorDespesas(0);
  };

  return (
    <div className="space-y-6">
      {/* ── Barra de Cenários Rápidos em 1 Clique ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Zap className="text-amber-500" size={20} />
            <h2 className="text-base font-black text-slate-800 tracking-tight">
              Cenários Instantâneos em 1 Clique
            </h2>
          </div>
          <button
            onClick={resetar}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all self-start sm:self-auto"
          >
            <RotateCcw size={13} />
            <span>Zerar Simulação</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            onClick={() => aplicarPreset('absolute', -100000, 'percent', 0, 'percent', 0)}
            className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/80 text-rose-800 text-left transition-all active:scale-95"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block text-rose-500">Queda Fixa</span>
            <span className="text-xs font-black block mt-0.5">-R$ 100k Receita</span>
          </button>

          <button
            onClick={() => aplicarPreset('absolute', 100000, 'percent', 0, 'percent', 0)}
            className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/80 text-emerald-800 text-left transition-all active:scale-95"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-500">Ganho Fixo</span>
            <span className="text-xs font-black block mt-0.5">+R$ 100k Receita</span>
          </button>

          <button
            onClick={() => aplicarPreset('percent', -20, 'percent', 0, 'percent', 0)}
            className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/80 text-rose-800 text-left transition-all active:scale-95"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block text-rose-500">Recessão</span>
            <span className="text-xs font-black block mt-0.5">-20% Receita</span>
          </button>

          <button
            onClick={() => aplicarPreset('percent', 15, 'percent', 0, 'percent', 0)}
            className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/80 text-emerald-800 text-left transition-all active:scale-95"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-500">Expansão</span>
            <span className="text-xs font-black block mt-0.5">+15% Receita</span>
          </button>

          <button
            onClick={() => aplicarPreset('percent', 0, 'percent', 0, 'percent', -10)}
            className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/80 text-indigo-800 text-left transition-all active:scale-95"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block text-indigo-500">Corte Geral</span>
            <span className="text-xs font-black block mt-0.5">-10% Despesas</span>
          </button>

          <button
            onClick={() => aplicarPreset('percent', 0, 'percent', -10, 'percent', 0)}
            className="p-3 rounded-xl border border-teal-200 bg-teal-50/50 hover:bg-teal-100/80 text-teal-800 text-left transition-all active:scale-95"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block text-teal-500">Eficiência</span>
            <span className="text-xs font-black block mt-0.5">-10% Custos</span>
          </button>
        </div>
      </div>

      {/* ── Controles Livres por R$ e % ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Bloco 1: Faturamento */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 tracking-tight">Faturamento (Receita)</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
              <button
                onClick={() => { setModoReceita('absolute'); setValorReceita(-100000); }}
                className={`px-2 py-0.5 rounded-md transition-all ${modoReceita === 'absolute' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
              >
                R$
              </button>
              <button
                onClick={() => { setModoReceita('percent'); setValorReceita(-10); }}
                className={`px-2 py-0.5 rounded-md transition-all ${modoReceita === 'percent' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
              >
                %
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Base Real: {fmt(receitaBase)}</span>
            <span className={`font-bold ${deltaReceita >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              Delta: {deltaReceita >= 0 ? '+' : ''}{fmt(deltaReceita)}
            </span>
          </div>

          {modoReceita === 'absolute' ? (
            <div className="space-y-2">
              <input
                type="number"
                step="10000"
                value={valorReceita}
                onChange={e => setValorReceita(Number(e.target.value))}
                className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-250 bg-slate-50/50"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <button onClick={() => setValorReceita(-100000)} className="hover:text-slate-700">-R$ 100k</button>
                <button onClick={() => setValorReceita(-50000)} className="hover:text-slate-700">-R$ 50k</button>
                <button onClick={() => setValorReceita(50000)} className="hover:text-slate-700">+R$ 50k</button>
                <button onClick={() => setValorReceita(100000)} className="hover:text-slate-700">+R$ 100k</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={valorReceita}
                  onChange={e => setValorReceita(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <span className="w-14 text-center text-xs font-bold px-2 py-1 bg-slate-100 rounded-lg text-slate-700">
                  {fmtPct(valorReceita)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bloco 2: Custos Operacionais */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 tracking-tight">Custos Operacionais</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
              <button
                onClick={() => { setModoCustos('absolute'); setValorCustos(0); }}
                className={`px-2 py-0.5 rounded-md transition-all ${modoCustos === 'absolute' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
              >
                R$
              </button>
              <button
                onClick={() => { setModoCustos('percent'); setValorCustos(0); }}
                className={`px-2 py-0.5 rounded-md transition-all ${modoCustos === 'percent' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
              >
                %
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Base Real: {fmt(custosBase)}</span>
            <span className={`font-bold ${deltaCustos <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              Delta: {deltaCustos >= 0 ? '+' : ''}{fmt(deltaCustos)}
            </span>
          </div>

          {modoCustos === 'absolute' ? (
            <input
              type="number"
              step="5000"
              value={valorCustos}
              onChange={e => setValorCustos(Number(e.target.value))}
              className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-250 bg-slate-50/50"
            />
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="-30"
                max="30"
                step="1"
                value={valorCustos}
                onChange={e => setValorCustos(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <span className="w-14 text-center text-xs font-bold px-2 py-1 bg-slate-100 rounded-lg text-slate-700">
                {fmtPct(valorCustos)}
              </span>
            </div>
          )}
        </div>

        {/* Bloco 3: Despesas Administrativas & Rateadas */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 tracking-tight">Despesas Administrativas</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
              <button
                onClick={() => { setModoDespesas('absolute'); setValorDespesas(0); }}
                className={`px-2 py-0.5 rounded-md transition-all ${modoDespesas === 'absolute' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
              >
                R$
              </button>
              <button
                onClick={() => { setModoDespesas('percent'); setValorDespesas(0); }}
                className={`px-2 py-0.5 rounded-md transition-all ${modoDespesas === 'percent' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
              >
                %
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Base Real: {fmt(despesasBase)}</span>
            <span className={`font-bold ${deltaDespesas <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              Delta: {deltaDespesas >= 0 ? '+' : ''}{fmt(deltaDespesas)}
            </span>
          </div>

          {modoDespesas === 'absolute' ? (
            <input
              type="number"
              step="5000"
              value={valorDespesas}
              onChange={e => setValorDespesas(Number(e.target.value))}
              className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-250 bg-slate-50/50"
            />
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="-30"
                max="30"
                step="1"
                value={valorDespesas}
                onChange={e => setValorDespesas(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <span className="w-14 text-center text-xs font-bold px-2 py-1 bg-slate-100 rounded-lg text-slate-700">
                {fmtPct(valorDespesas)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Painel de Resultados Consolidados ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Nova Receita */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nova Receita Mensal</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-800">{fmt(metrics.receitaSimulada)}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Original: {fmt(metrics.receitaOriginal)}</span>
            <span className={`font-bold ${deltaReceita >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {fmtPct(receitaBase > 0 ? (deltaReceita / receitaBase) * 100 : 0)}
            </span>
          </div>
        </div>

        {/* KPI 2: Novo EBITDA */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Novo EBITDA Mensal</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-black ${metrics.ebitdaSimulado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {fmt(metrics.ebitdaSimulado)}
            </span>
            <span className="text-xs text-slate-500">({metrics.ebitdaSimuladoPct.toFixed(1)}%)</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">EBITDA Real: {fmt(metrics.ebitdaOriginal)}</span>
            <span className={`font-bold ${metrics.variacaoResultadoAbsoluta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {metrics.variacaoResultadoAbsoluta >= 0 ? '+' : ''}{fmt(metrics.variacaoResultadoAbsoluta)}
            </span>
          </div>
        </div>

        {/* KPI 3: Margem Bruta */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Margem Bruta</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-800">{metrics.margemBrutaSimuladaPct.toFixed(1)}%</span>
            <span className="text-xs text-slate-500">
              ({metrics.margemBrutaSimuladaPct - metrics.margemBrutaOriginalPct >= 0 ? '+' : ''}
              {(metrics.margemBrutaSimuladaPct - metrics.margemBrutaOriginalPct).toFixed(1)} p.p.)
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Original: {metrics.margemBrutaOriginalPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* KPI 4: Novo Break-Even */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Novo Ponto de Equilíbrio</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-800">{fmt(metrics.breakEvenSimulado)}</span>
            <span className="text-xs text-slate-500">/mês</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Anterior: {fmt(metrics.breakEvenOriginal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
