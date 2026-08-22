'use client';
import React from 'react';
import { FinancialKPIs } from '@/types/financial.types';
import { formatCurrencyBRL, formatPct } from '@/lib/date-utils';
import { TrendingUp, TrendingDown, DollarSign, Activity, ShieldAlert, Target, Zap, Clock } from 'lucide-react';

interface KpiCardGridProps {
  baseline: FinancialKPIs;
  simulated: FinancialKPIs;
}

export function KpiCardGrid({ baseline, simulated }: KpiCardGridProps) {
  const recDiff = simulated.receitaBruta - baseline.receitaBruta;
  const ebitdaDiff = simulated.ebitda - baseline.ebitda;
  const resDiff = simulated.resultadoLiquido - baseline.resultadoLiquido;
  const runwayDiff = simulated.runwayMeses - baseline.runwayMeses;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 my-4">

      {/* Card 1: Receita Bruta */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
          <span>RECEITA BRUTA</span>
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <DollarSign size={16} />
          </div>
        </div>
        <div className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
          {formatCurrencyBRL(simulated.receitaBruta)}
        </div>
        <div className="flex items-center text-xs mt-1.5 font-medium">
          {recDiff >= 0 ? (
            <span className="flex items-center text-emerald-600">
              <TrendingUp size={14} className="mr-0.5" />
              +{formatCurrencyBRL(recDiff)}
            </span>
          ) : (
            <span className="flex items-center text-rose-600">
              <TrendingDown size={14} className="mr-0.5" />
              {formatCurrencyBRL(recDiff)}
            </span>
          )}
          <span className="text-slate-400 ml-1.5">vs. base</span>
        </div>
      </div>

      {/* Card 2: Margem de Contribuição */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
          <span>MARGEM CONTRIB.</span>
          <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
            <Activity size={16} />
          </div>
        </div>
        <div className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
          {formatCurrencyBRL(simulated.margemContribuicao)}
        </div>
        <div className="text-xs font-semibold text-teal-600 mt-1.5">
          {simulated.margemContribuicaoPct.toFixed(1)}% da receita líq.
        </div>
      </div>

      {/* Card 3: EBITDA (Lucro Operacional) */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
          <span>EBITDA OPERACIONAL</span>
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Zap size={16} />
          </div>
        </div>
        <div className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
          {formatCurrencyBRL(simulated.ebitda)}
        </div>
        <div className="flex items-center text-xs mt-1.5 font-medium">
          {ebitdaDiff >= 0 ? (
            <span className="flex items-center text-blue-600">
              <TrendingUp size={14} className="mr-0.5" />
              +{formatCurrencyBRL(ebitdaDiff)}
            </span>
          ) : (
            <span className="flex items-center text-rose-600">
              <TrendingDown size={14} className="mr-0.5" />
              {formatCurrencyBRL(ebitdaDiff)}
            </span>
          )}
          <span className="text-slate-400 ml-1">({simulated.ebitdaMarginPct.toFixed(1)}%)</span>
        </div>
      </div>

      {/* Card 4: Resultado Líquido */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
          <span>RESULTADO LÍQUIDO</span>
          <div className={`p-1.5 rounded-lg ${simulated.resultadoLiquido >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <DollarSign size={16} />
          </div>
        </div>
        <div className={`text-lg sm:text-xl font-bold tracking-tight ${simulated.resultadoLiquido >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
          {formatCurrencyBRL(simulated.resultadoLiquido)}
        </div>
        <div className="flex items-center text-xs mt-1.5 font-medium">
          {resDiff >= 0 ? (
            <span className="text-emerald-600 font-semibold">+{formatCurrencyBRL(resDiff)} variação</span>
          ) : (
            <span className="text-rose-600 font-semibold">{formatCurrencyBRL(resDiff)} variação</span>
          )}
        </div>
      </div>

      {/* Card 5: Runway de Caixa */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
          <span>RUNWAY DE CAIXA</span>
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <Clock size={16} />
          </div>
        </div>
        <div className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
          {simulated.runwayMeses >= 99 ? 'Imediato (>99m)' : `${simulated.runwayMeses} meses`}
        </div>
        <div className="text-xs font-medium text-slate-500 mt-1.5">
          {runwayDiff !== 0 ? (
            <span className={runwayDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}>
              {runwayDiff > 0 ? `+${runwayDiff}m vs. base` : `${runwayDiff}m vs. base`}
            </span>
          ) : (
            'Estável sob premissas'
          )}
        </div>
      </div>

      {/* Card 6: Break-Even (Ponto de Equilíbrio) */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
          <span>BREAK-EVEN</span>
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Target size={16} />
          </div>
        </div>
        <div className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
          {formatCurrencyBRL(simulated.breakEvenReceitaBruta)}
        </div>
        <div className="text-xs text-slate-500 mt-1.5 font-medium">
          Faturamento mínimo total
        </div>
      </div>

    </div>
  );
}
