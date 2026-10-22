"use client";

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Layers,
  PieChart,
  ArrowUpRight
} from 'lucide-react';
import { DrePainelKpis, RegimeTipo } from '@/types/dre-painel';
import { formatCurrencyBRL } from '@/services/dre-painel.service';
import { DrilldownCardType } from './DrePainelKpiDrilldownModal';

interface DrePainelKpisProps {
  kpis: DrePainelKpis;
  regime: RegimeTipo;
  isMeetingMode: boolean;
  onCardClick?: (cardType: DrilldownCardType) => void;
}

export function DrePainelKpisCards({
  kpis,
  regime,
  isMeetingMode,
  onCardClick
}: DrePainelKpisProps) {
  const mask = (valStr: string) => (isMeetingMode ? 'R$ ••••••' : valStr);

  const isPositivo = kpis.resultadoLiquido >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {/* 1. Receitas */}
      <div
        onClick={() => onCardClick && onCardClick('RECEITAS')}
        className="bg-white border border-slate-200 hover:border-emerald-400 hover:ring-2 hover:ring-emerald-400/20 rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-emerald-700 transition-colors">
            {regime === 'PREVISAO' ? 'Receitas Previstas' : 'Receita Bruta'}
          </span>
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
            <TrendingUp size={15} />
          </div>
        </div>
        <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
          {mask(formatCurrencyBRL(kpis.totalReceitas))}
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] text-slate-400 truncate">
            {regime === 'COMPETENCIA' ? 'Faturamento faturado / apurado' : 'Entradas registradas'}
          </p>
          <span className="text-[10px] font-semibold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0">
            Detalhes <ArrowUpRight size={11} className="ml-0.5" />
          </span>
        </div>
      </div>

      {/* 2. Despesas & Custos */}
      <div
        onClick={() => onCardClick && onCardClick('DESPESAS')}
        className="bg-white border border-slate-200 hover:border-rose-400 hover:ring-2 hover:ring-rose-400/20 rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-rose-700 transition-colors">
            {regime === 'PREVISAO' ? 'Despesas Previstas' : 'Total Despesas & Custos'}
          </span>
          <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-100 transition-colors">
            <TrendingDown size={15} />
          </div>
        </div>
        <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
          {mask(formatCurrencyBRL(kpis.totalDespesas))}
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] text-slate-400 truncate">
            {regime === 'COMPETENCIA' ? 'Custos, despesas e provisões' : 'Saídas liquidadas'}
          </p>
          <span className="text-[10px] font-semibold text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0">
            Detalhes <ArrowUpRight size={11} className="ml-0.5" />
          </span>
        </div>
      </div>

      {/* 3. Resultado Líquido & Margem */}
      <div
        onClick={() => onCardClick && onCardClick('RESULTADO')}
        className={`border rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden transition-all duration-200 cursor-pointer group ${
          isPositivo
            ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400 hover:ring-2 hover:ring-emerald-400/20'
            : 'bg-rose-50/40 border-rose-200 hover:border-rose-400 hover:ring-2 hover:ring-rose-400/20'
        }`}
      >
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
        <div className="flex items-center justify-between mt-1">
          <p className={`text-[11px] truncate ${isPositivo ? 'text-emerald-700' : 'text-rose-700'}`}>
            {isPositivo ? 'Superávit operacional apurado' : 'Déficit no período'}
          </p>
          <span className={`text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0 ${
            isPositivo ? 'text-emerald-800' : 'text-rose-800'
          }`}>
            Detalhes <ArrowUpRight size={11} className="ml-0.5" />
          </span>
        </div>
      </div>

      {/* 4. Provisões Operacionais do Exercício (Card de Atrasados Ocultado por solicitação executiva) */}
      <div
        onClick={() => onCardClick && onCardClick('PROVISOES')}
        className="bg-white border border-slate-200 hover:border-amber-400 hover:ring-2 hover:ring-amber-400/20 rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-amber-700 transition-colors">
            {regime === 'COMPETENCIA' ? 'Provisões do Exercício' : 'Provisões & Parcelados'}
          </span>
          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-100 transition-colors">
            <Layers size={15} />
          </div>
        </div>
        <div className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">
          {mask(
            formatCurrencyBRL(
              regime === 'COMPETENCIA'
                ? kpis.totalProvisoes
                : (kpis.totalProvisoes > 0 ? kpis.totalProvisoes : kpis.totalParceladoComprometido)
            )
          )}
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] text-slate-400 truncate">
            {regime === 'COMPETENCIA' ? '13º, férias, encargos e tributos' : 'Previsões e parcelas compromissadas'}
          </p>
          <span className="text-[10px] font-semibold text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0">
            Detalhes <ArrowUpRight size={11} className="ml-0.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
