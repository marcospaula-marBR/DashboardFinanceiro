import React, { useState } from 'react';
import { DreCalculatedResult } from '@/types/dre';
import { ChevronDown, ChevronUp, Wallet, ArrowDownRight, ArrowUpRight, MonitorSmartphone, Calculator } from 'lucide-react';

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
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  if (!results) return null;

  const { kpis } = results;

  const displayValue = (val: number, isPercent = false) => {
    if (isPrivacyMode) return 'R$ ****';
    if (isPercent) return `${val.toFixed(2).replace('.', ',')}%`;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const calcPercent = (value: number) => {
    if (kpis.totalEntradas === 0) return '0,00%';
    return `${((value / kpis.totalEntradas) * 100).toFixed(1).replace('.', ',')}%`;
  };

  const monthsCount = results.validColumns.length || 1;
  const getAverageVal = (totalVal: number) => totalVal / monthsCount;

  const toggleCardSelection = (key: string) => {
    setSelectedCards(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const isCardSelected = (key: string) => selectedCards.includes(key);
  const clearSelection = () => setSelectedCards([]);

  const getCardShortName = (key: string) => {
    switch (key) {
      case 'entradas': return 'Entradas';
      case 'custos': return 'Custos';
      case 'despesas': return 'Despesas';
      case 'resultado': return 'Lucro antes FCL';
      case 'fcl': return 'FCL';
      case 'outrasEntradas': return 'Outras Entradas';
      case 'impostos': return 'Impostos';
      case 'investimentos': return 'Investimentos';
      case 'custom': return customCardTitle || 'Personalizado';
      default: return key;
    }
  };

  let runningTotal = 0;
  selectedCards.forEach(key => {
    switch (key) {
      case 'entradas': runningTotal += kpis.totalEntradas; break;
      case 'custos': runningTotal -= kpis.totalCustos; break;
      case 'despesas': runningTotal -= kpis.totalDespesas; break;
      case 'resultado': runningTotal += kpis.resultado; break;
      case 'fcl': runningTotal += kpis.fcl; break;
      case 'outrasEntradas': runningTotal += kpis.outrasEntradas; break;
      case 'impostos': runningTotal -= kpis.totalImpostos; break;
      case 'investimentos': runningTotal -= kpis.totalInvestimentos; break;
      case 'custom': runningTotal -= (customCardTotal || 0); break;
    }
  });

  return (
    <div className="mb-8">
      {/* Calculadora Express */}
      {selectedCards.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 shadow-lg border border-slate-700/50 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300 relative z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400">
              <Calculator size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black tracking-wider text-amber-400 uppercase">Calculadora Express</h4>
              <p className="text-[11px] text-slate-400 font-medium">
                Somando receitas e deduzindo custos/saídas dos cards selecionados.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
            <div className="flex flex-wrap gap-1.5 max-w-[300px] justify-end">
              {selectedCards.map(key => (
                <span key={key} className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  {getCardShortName(key)}
                </span>
              ))}
            </div>

            <div className="text-right min-w-[120px]">
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Total Acumulado</span>
              <span className={`text-xl font-black tracking-tight ${runningTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {displayValue(runningTotal)}
              </span>
            </div>

            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 relative z-20">
        
        {/* Total Entradas */}
        <div 
          className={`relative bg-white border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between ${
            isCardSelected('entradas') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
          } ${onCardClick ? 'cursor-pointer hover:scale-105 hover:shadow-md' : ''}`}
          onClick={() => onCardClick && onCardClick("Total Entradas Operacionais")}
        >
          <button
            onClick={(e) => { e.stopPropagation(); toggleCardSelection('entradas'); }}
            className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-all duration-200 ${
              isCardSelected('entradas')
                ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Selecionar para calculadora"
          >
            <Calculator size={12} />
          </button>
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pr-6">Entradas Operacionais</h3>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {displayValue(kpis.totalEntradas)}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100/70 w-fit px-2 py-1 rounded">
            <span>Média: {displayValue(getAverageVal(kpis.totalEntradas))}</span>
          </div>
        </div>

        {/* Custos Operacionais */}
        <div 
          className={`relative bg-white border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between ${
            isCardSelected('custos') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
          } ${onCardClick ? 'cursor-pointer hover:scale-105 hover:shadow-md' : ''}`}
          onClick={() => onCardClick && onCardClick("Total Custos Operacionais")}
        >
          <button
            onClick={(e) => { e.stopPropagation(); toggleCardSelection('custos'); }}
            className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-all duration-200 ${
              isCardSelected('custos')
                ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Selecionar para calculadora"
          >
            <Calculator size={12} />
          </button>
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pr-6">Custos Operacionais</h3>
            <p className="text-2xl font-black text-rose-600 tracking-tight">
              {displayValue(kpis.totalCustos)}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100/70 w-fit px-2 py-1 rounded">
            <Wallet size={10} className="text-emerald-500" />
            <span>{calcPercent(kpis.totalCustos)} • Média: {displayValue(getAverageVal(kpis.totalCustos))}</span>
          </div>
        </div>

        {/* Despesas Rateadas */}
        <div 
          className={`relative bg-white border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between ${
            isCardSelected('despesas') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
          } ${onCardClick ? 'cursor-pointer hover:scale-105 hover:shadow-md' : ''}`}
          onClick={() => onCardClick && onCardClick("Total Despesas Rateadas")}
        >
          <button
            onClick={(e) => { e.stopPropagation(); toggleCardSelection('despesas'); }}
            className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-all duration-200 ${
              isCardSelected('despesas')
                ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Selecionar para calculadora"
          >
            <Calculator size={12} />
          </button>
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pr-6">Despesas Rateadas</h3>
            <p className="text-2xl font-black text-rose-600 tracking-tight">
              {displayValue(kpis.totalDespesas)}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100/70 w-fit px-2 py-1 rounded">
            <Wallet size={10} className="text-emerald-500" />
            <span>{calcPercent(kpis.totalDespesas)} • Média: {displayValue(getAverageVal(kpis.totalDespesas))}</span>
          </div>
        </div>

        {/* Resultado (Lucro) */}
        <div 
          className={`relative bg-white border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between ${
            isCardSelected('resultado') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
          } ${onCardClick ? 'cursor-pointer hover:scale-105 hover:shadow-md' : ''}`}
          onClick={() => onCardClick && onCardClick("Lucro antes do FCL")}
        >
          <button
            onClick={(e) => { e.stopPropagation(); toggleCardSelection('resultado'); }}
            className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-all duration-200 ${
              isCardSelected('resultado')
                ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Selecionar para calculadora"
          >
            <Calculator size={12} />
          </button>
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pr-6">Lucro antes do FCL</h3>
            <p className={`text-2xl font-black tracking-tight ${kpis.resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {displayValue(kpis.resultado)}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100/70 w-fit px-2 py-1 rounded">
            <span>Margem: {displayValue(kpis.percLucro, true)} • Média: {displayValue(getAverageVal(kpis.resultado))}</span>
          </div>
        </div>

        {/* Fluxo de Caixa Livre */}
        <div 
          className={`relative bg-slate-900 border rounded-2xl p-5 shadow-md transition-all flex flex-col justify-between ${
            isCardSelected('fcl') ? 'border-amber-500 ring-2 ring-amber-500/30 bg-slate-800/80' : 'border-slate-800'
          } ${onCardClick ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : ''}`}
          onClick={() => onCardClick && onCardClick("Fluxo de Caixa Livre FCL")}
        >
          <button
            onClick={(e) => { e.stopPropagation(); toggleCardSelection('fcl'); }}
            className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-all duration-200 ${
              isCardSelected('fcl')
                ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300 hover:bg-slate-700'
            }`}
            title="Selecionar para calculadora"
          >
            <Calculator size={12} />
          </button>
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 pr-6">Fluxo de Caixa Livre</h3>
            <p className={`text-2xl font-black tracking-tight ${kpis.fcl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {displayValue(kpis.fcl)}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-slate-800/90 w-fit px-2 py-1 rounded">
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
            className={`relative bg-slate-50 border border-dashed rounded-2xl p-4 transition-all flex flex-col justify-between ${
              isCardSelected('outrasEntradas') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
            } ${onCardClick ? 'cursor-pointer hover:bg-slate-100 hover:scale-[1.02] hover:shadow-sm' : ''}`}
            onClick={() => onCardClick && onCardClick("Outras Entradas")}
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleCardSelection('outrasEntradas'); }}
              className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-all duration-200 ${
                isCardSelected('outrasEntradas')
                  ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-200'
              }`}
              title="Selecionar para calculadora"
            >
              <Calculator size={12} />
            </button>
            <div>
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 pr-6">Outras Entradas</h3>
              <p className="text-xl font-black text-slate-800 tracking-tight">
                {displayValue(kpis.outrasEntradas)}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-slate-400">
              <ArrowUpRight size={10} className="text-emerald-500" />
              <span>{calcPercent(kpis.outrasEntradas)} • Média: {displayValue(getAverageVal(kpis.outrasEntradas))}</span>
            </div>
          </div>

          {/* Impostos */}
          <div 
            className={`relative bg-slate-50 border border-dashed rounded-2xl p-4 transition-all flex flex-col justify-between ${
              isCardSelected('impostos') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
            } ${onCardClick ? 'cursor-pointer hover:bg-slate-100 hover:scale-[1.02] hover:shadow-sm' : ''}`}
            onClick={() => onCardClick && onCardClick("Total de Impostos")}
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleCardSelection('impostos'); }}
              className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-all duration-200 ${
                isCardSelected('impostos')
                  ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-200'
              }`}
              title="Selecionar para calculadora"
            >
              <Calculator size={12} />
            </button>
            <div>
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 pr-6">Total de Impostos</h3>
              <p className="text-xl font-black text-slate-800 tracking-tight">
                {displayValue(kpis.totalImpostos)}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-slate-400">
              <ArrowDownRight size={10} className="text-rose-500" />
              <span>{calcPercent(kpis.totalImpostos)} • Média: {displayValue(getAverageVal(kpis.totalImpostos))}</span>
            </div>
          </div>

          {/* Investimentos */}
          <div 
            className={`relative bg-slate-50 border border-dashed rounded-2xl p-4 transition-all flex flex-col justify-between ${
              isCardSelected('investimentos') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
            } ${onCardClick ? 'cursor-pointer hover:bg-slate-100 hover:scale-[1.02] hover:shadow-sm' : ''}`}
            onClick={() => onCardClick && onCardClick("Total Investimentos")}
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleCardSelection('investimentos'); }}
              className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-all duration-200 ${
                isCardSelected('investimentos')
                  ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-200'
              }`}
              title="Selecionar para calculadora"
            >
              <Calculator size={12} />
            </button>
            <div>
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 pr-6">Total de Investimentos</h3>
              <p className="text-xl font-black text-slate-800 tracking-tight">
                {displayValue(kpis.totalInvestimentos)}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-slate-400">
              <Wallet size={10} className="text-emerald-500" />
              <span>{calcPercent(kpis.totalInvestimentos)} • Média: {displayValue(getAverageVal(kpis.totalInvestimentos))}</span>
            </div>
          </div>

          {/* Custom Card (Card Livre) */}
          <div 
            className={`relative bg-indigo-50 border border-dashed rounded-2xl p-4 transition-all flex flex-col justify-between overflow-hidden cursor-pointer hover:bg-indigo-100/85 ${
              isCardSelected('custom') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-indigo-50/90' : 'border-indigo-200'
            } hover:scale-[1.02] hover:shadow-sm`}
            onClick={() => onCustomCardClick && onCustomCardClick()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleCardSelection('custom'); }}
              className={`absolute top-3 right-3 p-1.5 rounded-lg border transition-all duration-200 z-20 ${
                isCardSelected('custom')
                  ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                  : 'bg-indigo-100 border-indigo-200 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-200'
              }`}
              title="Selecionar para calculadora"
            >
              <Calculator size={12} />
            </button>
            <MonitorSmartphone className="absolute -right-4 -bottom-4 text-indigo-100 opacity-40" size={80} />
            <div className="relative z-10">
              <h3 className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider mb-1 flex items-center gap-1 pr-6">
                ⚙️ {customCardTitle || 'Monte seu Card'}
              </h3>
              <p className="text-xl font-black text-indigo-900 tracking-tight mt-1">
                {customCardCategoriesCount && customCardCategoriesCount > 0 
                  ? displayValue(customCardTotal || 0) 
                  : 'R$ 0,00'}
              </p>
            </div>
            <div className="mt-2 flex flex-col gap-1.5 relative z-10 w-full">
              {customCardCategoriesCount && customCardCategoriesCount > 0 ? (
                <div className="flex flex-wrap gap-1">
                  <div className="text-[8px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                    Média: {displayValue(getAverageVal(customCardTotal || 0))}
                  </div>
                  <div className="text-[8px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                    {calcPercent(customCardTotal || 0)}
                  </div>
                </div>
              ) : (
                <div className="text-[9px] font-semibold text-indigo-650/80 bg-indigo-100/60 px-2 py-0.5 rounded border border-indigo-200/20">
                  Nenhuma rubrica ativa
                </div>
              )}
              <div className="text-[8px] font-bold text-indigo-800 bg-indigo-100/70 px-1.5 py-0.5 rounded animate-pulse w-fit">
                Clique para Personalizar
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
