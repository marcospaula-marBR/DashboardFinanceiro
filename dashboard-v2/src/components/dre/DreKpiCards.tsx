import React, { useState } from 'react';
import { DreCalculatedResult } from '@/types/dre';
import { ChevronDown, ChevronUp, Wallet, ArrowDownRight, ArrowUpRight, MonitorSmartphone, Activity } from 'lucide-react';
import { formatCurrency } from '@/services/comissoes.service'; // We can reuse formatCurrency from here or create a utils

interface DreKpiCardsProps {
  results: DreCalculatedResult | null;
  isPrivacyMode: boolean;
  onCardClick?: (title: string) => void;
  // Custom Card Props
  customCardTitle?: string;
  customCardTotal?: number;
  customCardCategoriesCount?: number;
  onCustomCardClick?: () => void;
}

export function DreKpiCards({ 
  results, 
  isPrivacyMode, 
  onCardClick,
  customCardTitle,
  customCardTotal,
  customCardCategoriesCount,
  onCustomCardClick
}: DreKpiCardsProps) {
  const [showExtra, setShowExtra] = useState(false);

  if (!results) return null;

  const { kpis } = results;

  const displayValue = (val: number, isPercent = false) => {
    if (isPrivacyMode) return 'R$ ****';
    if (isPercent) return `${val.toFixed(2).replace('.', ',')}%`;
    
    // Simples formatCurrency local para evitar dependência errada se comissoes.service não existir
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const calcPercent = (value: number) => {
    if (kpis.totalEntradas === 0) return '0,00%';
    return `${((value / kpis.totalEntradas) * 100).toFixed(1).replace('.', ',')}%`;
  };

  const monthsCount = results.validColumns.length || 1;
  const getAverageVal = (totalVal: number) => totalVal / monthsCount;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 relative z-20">
      {/* Total Entradas */}
      <div 
        className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-transform flex flex-col justify-between ${onCardClick ? 'cursor-pointer hover:scale-105' : ''}`}
        onClick={() => onCardClick && onCardClick("Total Entradas Operacionais")}
      >
        <div>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Entradas Operacionais</h3>
          <p className="text-3xl font-black text-slate-900 tracking-tight">
            {displayValue(kpis.totalEntradas)}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100/70 w-fit px-2.5 py-1.5 rounded-md">
          <span>Média: {displayValue(getAverageVal(kpis.totalEntradas))}</span>
        </div>
      </div>

      {/* Custos Operacionais */}
      <div 
        className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-transform flex flex-col justify-between ${onCardClick ? 'cursor-pointer hover:scale-105' : ''}`}
        onClick={() => onCardClick && onCardClick("Total Custos Operacionais")}
      >
        <div>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Custos Operacionais</h3>
          <p className="text-3xl font-black text-rose-600 tracking-tight">
            {displayValue(kpis.totalCustos)}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100/70 w-fit px-2.5 py-1.5 rounded-md">
          <Wallet size={12} className="text-emerald-500" />
          <span>{calcPercent(kpis.totalCustos)} da Receita • Média: {displayValue(getAverageVal(kpis.totalCustos))}</span>
        </div>
      </div>

      {/* Despesas Rateadas */}
      <div 
        className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-transform flex flex-col justify-between ${onCardClick ? 'cursor-pointer hover:scale-105' : ''}`}
        onClick={() => onCardClick && onCardClick("Total Despesas Rateadas")}
      >
        <div>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Despesas Rateadas</h3>
          <p className="text-3xl font-black text-rose-600 tracking-tight">
            {displayValue(kpis.totalDespesas)}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100/70 w-fit px-2.5 py-1.5 rounded-md">
          <Wallet size={12} className="text-emerald-500" />
          <span>{calcPercent(kpis.totalDespesas)} da Receita • Média: {displayValue(getAverageVal(kpis.totalDespesas))}</span>
        </div>
      </div>

      {/* Resultado (Lucro) */}
      <div 
        className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-transform flex flex-col justify-between ${onCardClick ? 'cursor-pointer hover:scale-105' : ''}`}
        onClick={() => onCardClick && onCardClick("Lucro antes do FCL")}
      >
        <div>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Lucro antes do FCL</h3>
          <p className={`text-3xl font-black tracking-tight ${kpis.resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {displayValue(kpis.resultado)}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100/70 w-fit px-2.5 py-1.5 rounded-md">
          <span>Margem: {displayValue(kpis.percLucro, true)} • Média: {displayValue(getAverageVal(kpis.resultado))}</span>
        </div>
      </div>

      {/* Fluxo de Caixa Livre */}
      <div 
        className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md transition-transform flex flex-col justify-between ${onCardClick ? 'cursor-pointer hover:scale-105' : ''}`}
        onClick={() => onCardClick && onCardClick("Fluxo de Caixa Livre FCL")}
      >
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Fluxo de Caixa Livre</h3>
          <p className={`text-3xl font-black tracking-tight ${kpis.fcl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {displayValue(kpis.fcl)}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-300 bg-slate-800/90 w-fit px-2.5 py-1.5 rounded-md">
          <span>Margem: {displayValue(kpis.percFcl, true)} • Média: {displayValue(getAverageVal(kpis.fcl))}</span>
        </div>
      </div>
      </div>

      {/* Botão de Toggle Moderno */}
      <div className="flex justify-center -mt-3 relative z-30">
        <button 
          onClick={() => setShowExtra(!showExtra)}
          className="bg-white border border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-full shadow-sm hover:bg-slate-50 transition-all flex items-center gap-1.5 hover:text-slate-700"
        >
          {showExtra ? (
            <><ChevronUp size={14} strokeWidth={2.5} /> Ocultar Secundários</>
          ) : (
            <><ChevronDown size={14} strokeWidth={2.5} /> Indicadores Adicionais</>
          )}
        </button>
      </div>

      {/* Grid Secundário */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${showExtra ? 'opacity-100 max-h-[600px] mt-4' : 'opacity-0 max-h-0 mt-0'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Outras Entradas */}
          <div 
            className={`bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-4 transition-transform flex flex-col justify-between ${onCardClick ? 'cursor-pointer hover:bg-slate-100 hover:scale-[1.02]' : ''}`}
            onClick={() => onCardClick && onCardClick("Outras Entradas")}
          >
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Outras Entradas</h3>
              <p className="text-2xl font-black text-slate-800 tracking-tight">
                {displayValue(kpis.outrasEntradas)}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <ArrowUpRight size={12} className="text-emerald-500" />
              <span>{calcPercent(kpis.outrasEntradas)} vs Operacional • Média: {displayValue(getAverageVal(kpis.outrasEntradas))}</span>
            </div>
          </div>

          {/* Impostos */}
          <div 
            className={`bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-4 transition-transform flex flex-col justify-between ${onCardClick ? 'cursor-pointer hover:bg-slate-100 hover:scale-[1.02]' : ''}`}
            onClick={() => onCardClick && onCardClick("Total de Impostos")}
          >
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total de Impostos</h3>
              <p className="text-2xl font-black text-slate-800 tracking-tight">
                {displayValue(kpis.totalImpostos)}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <ArrowDownRight size={12} className="text-rose-500" />
              <span>{calcPercent(kpis.totalImpostos)} da Receita • Média: {displayValue(getAverageVal(kpis.totalImpostos))}</span>
            </div>
          </div>

          {/* Investimentos */}
          <div 
            className={`bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-4 transition-transform flex flex-col justify-between ${onCardClick ? 'cursor-pointer hover:bg-slate-100 hover:scale-[1.02]' : ''}`}
            onClick={() => onCardClick && onCardClick("Total Investimentos")}
          >
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total de Investimentos</h3>
              <p className="text-2xl font-black text-slate-800 tracking-tight">
                {displayValue(kpis.totalInvestimentos)}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Wallet size={12} className="text-emerald-500" />
              <span>{calcPercent(kpis.totalInvestimentos)} da Receita • Média: {displayValue(getAverageVal(kpis.totalInvestimentos))}</span>
            </div>
          </div>

          {/* Custom Card (Card Livre) */}
          <div 
            className="bg-indigo-50 border border-indigo-200 border-dashed rounded-2xl p-4 transition-transform flex flex-col justify-between relative overflow-hidden cursor-pointer hover:bg-indigo-100/80 hover:scale-[1.02]"
            onClick={() => onCustomCardClick && onCustomCardClick()}
          >
            <MonitorSmartphone className="absolute -right-4 -bottom-4 text-indigo-100 opacity-50" size={80} />
            <div className="relative z-10">
              <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                ⚙️ {customCardTitle || 'Monte seu Card'}
              </h3>
              <p className="text-2xl font-black text-indigo-900 tracking-tight mt-1">
                {customCardCategoriesCount && customCardCategoriesCount > 0 
                  ? displayValue(customCardTotal || 0) 
                  : 'R$ 0,00'}
              </p>
            </div>
            <div className="mt-2 flex flex-col gap-1.5 relative z-10 w-full">
              {customCardCategoriesCount && customCardCategoriesCount > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  <div className="text-xs font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                    Média: {displayValue(getAverageVal(customCardTotal || 0))}
                  </div>
                  <div className="text-xs font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                    {calcPercent(customCardTotal || 0)} da Receita
                  </div>
                </div>
              ) : (
                <div className="text-xs font-semibold text-indigo-650/80 bg-indigo-100/60 px-2.5 py-1 rounded-md border border-indigo-200/20">
                  Nenhuma rubrica ativa
                </div>
              )}
              <div className="text-[9px] font-bold text-indigo-800 bg-indigo-100/70 px-2 py-0.5 rounded animate-pulse w-fit">
                Clique para Personalizar
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
