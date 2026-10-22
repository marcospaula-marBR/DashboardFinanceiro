"use client";

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  PieChart
} from 'lucide-react';
import { DrePainelKpis, RegimeTipo } from '@/types/dre-painel';
import { formatCurrencyBRL } from '@/services/dre-painel.service';

interface DrePainelKpisProps {
  kpis: DrePainelKpis;
  regime: RegimeTipo;
  isMeetingMode: boolean;
}

export function DrePainelKpisCards({
  kpis,
  regime,
  isMeetingMode
}: DrePainelKpisProps) {
  const mask = (valStr: string) => (isMeetingMode ? 'R$ ••••••' : valStr);

  const isPositivo = kpis.resultadoLiquido >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {/* 1. Receitas */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider">
            {regime === 'PREVISAO' ? 'Receitas Previstas' : 'Receita Bruta'}
          </span>
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <TrendingUp size={15} />
          </div>
        </div>
        <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
          {mask(formatCurrencyBRL(kpis.totalReceitas))}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {regime === 'COMPETENCIA' ? 'Faturamento faturado / apurado' : 'Entradas de caixa registradas'}
        </p>
      </div>

      {/* 2. Despesas & Custos */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider">
            {regime === 'PREVISAO' ? 'Despesas Previstas' : 'Total Despesas & Custos'}
          </span>
          <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
            <TrendingDown size={15} />
          </div>
        </div>
        <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
          {mask(formatCurrencyBRL(kpis.totalDespesas))}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {regime === 'COMPETENCIA' ? 'Custos, despesas e provisões' : 'Saídas liquidadas'}
        </p>
      </div>

      {/* 3. Resultado Líquido & Margem */}
      <div className={`border rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden ${
        isPositivo
          ? 'bg-emerald-50/40 border-emerald-200'
          : 'bg-rose-50/40 border-rose-200'
      }`}>
        <div className="flex items-center justify-between text-slate-600 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider">
            Resultado Líquido
          </span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            isPositivo
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-rose-100 text-rose-800'
          }`}>
            {isMeetingMode ? '••%' : `${kpis.margemLiquida.toFixed(1)}%`}
          </span>
        </div>
        <div className={`text-lg sm:text-2xl font-black tracking-tight ${
          isPositivo ? 'text-emerald-950' : 'text-rose-950'
        }`}>
          {mask(formatCurrencyBRL(kpis.resultadoLiquido))}
        </div>
        <p className={`text-[11px] mt-0.5 ${isPositivo ? 'text-emerald-700' : 'text-rose-700'}`}>
          {isPositivo ? 'Superávit operacional apurado' : 'Déficit no período'}
        </p>
      </div>

      {/* 4. Atrasados / Alerta de Inadimplência ou Provisões */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden">
        {kpis.totalAtrasado > 0 ? (
          <>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle size={13} />
                Em Atraso ({kpis.qtdAtrasados})
              </span>
              <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                <Clock size={15} />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-black text-rose-600 tracking-tight">
              {mask(formatCurrencyBRL(kpis.totalAtrasado))}
            </div>
            <p className="text-[11px] text-rose-500 mt-0.5 font-medium">
              Atenção: títulos vencidos não liquidados
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {regime === 'COMPETENCIA' ? 'Provisões do Exercício' : 'Compromissos Parcelados'}
              </span>
              <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                <PieChart size={15} />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">
              {mask(
                formatCurrencyBRL(
                  regime === 'COMPETENCIA' ? kpis.totalProvisoes : kpis.totalParceladoComprometido
                )
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {regime === 'COMPETENCIA' ? 'Provisões para encargos/13º' : 'Total parcelado em aberto'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
