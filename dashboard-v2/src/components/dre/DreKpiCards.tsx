import React, { useState } from 'react';
import { DreCalculatedResult, SelectedCalcItem } from '@/types/dre';
import { ChevronDown, ChevronUp, Wallet, ArrowDownRight, ArrowUpRight, MonitorSmartphone, Calculator, X } from 'lucide-react';

interface DreKpiCardsProps {
  results: DreCalculatedResult | null;
  isPrivacyMode: boolean;
  isRevenuePrivacyMode?: boolean;
  onCardClick?: (title: string) => void;
  // Custom Card Props
  customCardTitle?: string;
  customCardTotal?: number;
  customCardCategoriesCount?: number;
  onCustomCardClick?: () => void;
  // Shared Calculator Props
  selectedCalcItems?: SelectedCalcItem[];
  onToggleCalcItem?: (item: SelectedCalcItem) => void;
  onClearCalcItems?: () => void;
}

export function DreKpiCards({ 
  results, 
  isPrivacyMode, 
  isRevenuePrivacyMode,
  onCardClick,
  customCardTitle,
  customCardTotal,
  customCardCategoriesCount,
  onCustomCardClick,
  selectedCalcItems,
  onToggleCalcItem,
  onClearCalcItems
}: DreKpiCardsProps) {
  const [showExtra, setShowExtra] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  if (!results) return null;

  const { kpis } = results;

  const displayValue = (val: number, isPercent = false, isRevenueItem = false) => {
    if (isPrivacyMode || (isRevenuePrivacyMode && isRevenueItem)) return 'R$ ****';
    if (isPercent) return `${val.toFixed(2).replace('.', ',')}%`;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const calcPercent = (value: number, isRevenueItem = false) => {
    if (isPrivacyMode || (isRevenuePrivacyMode && isRevenueItem)) return '**,*%';
    if (kpis.totalEntradas === 0) return '0,00%';
    return `${((value / kpis.totalEntradas) * 100).toFixed(1).replace('.', ',')}%`;
  };

  const monthsCount = results.validColumns.length || 1;
  const getAverageVal = (totalVal: number) => totalVal / monthsCount;

  const isExternalMode = selectedCalcItems !== undefined;

  const toggleCardSelection = (key: string) => {
    setSelectedCards(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const isCardSelected = (key: string) => {
    if (isExternalMode) {
      return selectedCalcItems.some(i => i.id === `card-${key}`);
    }
    return selectedCards.includes(key);
  };

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

  const handleCardToggle = (key: string, title: string, value: number, type: 'entrada' | 'saida') => {
    if (isExternalMode && onToggleCalcItem) {
      onToggleCalcItem({
        id: `card-${key}`,
        title,
        value,
        type,
        source: 'card'
      });
    } else {
      toggleCardSelection(key);
    }
  };

  const handleClearAll = () => {
    if (isExternalMode && onClearCalcItems) {
      onClearCalcItems();
    } else {
      clearSelection();
    }
  };

  const handleRemoveItem = (item: SelectedCalcItem) => {
    if (isExternalMode && onToggleCalcItem) {
      onToggleCalcItem(item);
    } else {
      const key = item.id.replace('card-', '');
      toggleCardSelection(key);
    }
  };

  // Itens para a calculadora
  const activeItems: SelectedCalcItem[] = isExternalMode
    ? selectedCalcItems
    : selectedCards.map(key => {
        let val = 0;
        let type: 'entrada' | 'saida' = 'saida';
        switch (key) {
          case 'entradas': val = kpis.totalEntradas; type = 'entrada'; break;
          case 'custos': val = kpis.totalCustos; type = 'saida'; break;
          case 'despesas': val = kpis.totalDespesas; type = 'saida'; break;
          case 'resultado': val = kpis.resultado; type = 'entrada'; break;
          case 'fcl': val = kpis.fcl; type = 'entrada'; break;
          case 'outrasEntradas': val = kpis.outrasEntradas; type = 'entrada'; break;
          case 'impostos': val = kpis.totalImpostos; type = 'saida'; break;
          case 'investimentos': val = kpis.totalInvestimentos; type = 'saida'; break;
          case 'custom': val = (customCardTotal || 0); type = 'saida'; break;
        }
        return {
          id: `card-${key}`,
          title: getCardShortName(key),
          value: val,
          type,
          source: 'card'
        };
      });

  let runningTotal = 0;
  let totalSumAbs = 0;
  let hasEntrada = false;
  let hasSaida = false;

  activeItems.forEach(item => {
    totalSumAbs += Math.abs(item.value);
    if (item.type === 'entrada') {
      runningTotal += item.value;
      hasEntrada = true;
    } else {
      runningTotal -= item.value;
      hasSaida = true;
    }
  });

  const isMixed = hasEntrada && hasSaida;

  return (
    <div className="mb-8">
      {/* Calculadora Express */}
      {activeItems.length > 0 && (
        <div className="mb-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-3.5 sm:p-4 shadow-xl border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-3 animate-in slide-in-from-top-3 duration-200 relative z-30 ring-1 ring-amber-500/20">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400 shrink-0">
              <Calculator size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-black tracking-wider text-amber-400 uppercase">Calculadora Express</h4>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30">
                  {activeItems.length} {activeItems.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {isMixed
                  ? 'Somando receitas (+) e deduzindo custos/saídas (-) selecionados.'
                  : 'Total acumulado das rubricas e cards selecionados.'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex flex-wrap gap-1.5 max-w-full md:max-w-[420px] max-h-[70px] overflow-y-auto justify-start md:justify-end py-1">
              {activeItems.map(item => (
                <span 
                  key={item.id} 
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                    item.type === 'entrada'
                      ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                      : 'bg-rose-950/80 border-rose-700 text-rose-300'
                  }`}
                >
                  <span className="opacity-75">{item.type === 'entrada' ? '(+)' : '(-)'}</span>
                  <span className="truncate max-w-[130px]" title={item.title}>{item.title}</span>
                  <span className="font-mono text-[9px] opacity-90">{displayValue(item.value)}</span>
                  <button
                    onClick={() => handleRemoveItem(item)}
                    className="hover:text-white ml-0.5 p-0.5 rounded hover:bg-white/20 transition-colors"
                    title="Remover item"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl shrink-0">
              {isMixed && (
                <div className="text-right border-r border-slate-800 pr-3">
                  <span className="text-[8.5px] font-bold text-slate-400 block uppercase">Soma Absoluta</span>
                  <span className="text-xs font-mono font-bold text-slate-200">
                    {displayValue(totalSumAbs)}
                  </span>
                </div>
              )}
              <div className="text-right min-w-[110px]">
                <span className="text-[8.5px] font-bold text-slate-400 block uppercase">
                  {isMixed ? 'Líquido DRE' : 'Total Acumulado'}
                </span>
                <span className={`text-lg sm:text-xl font-black tracking-tight font-mono ${
                  !isMixed 
                    ? 'text-amber-400'
                    : (runningTotal >= 0 ? 'text-emerald-400' : 'text-rose-400')
                }`}>
                  {displayValue(!isMixed ? totalSumAbs : runningTotal)}
                </span>
              </div>
            </div>

            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all shrink-0 active:scale-95"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Grid Principal */}
      <div className="flex md:grid overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-3 md:gap-4 snap-x sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 relative z-20">
        
        {/* Total Entradas */}
        <div 
          className={`min-w-[210px] shrink-0 snap-start md:min-w-0 relative bg-white border rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between ${
            isCardSelected('entradas') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
          } ${onCardClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-md' : ''}`}
          onClick={() => onCardClick && onCardClick("Total Entradas Operacionais")}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleCardToggle('entradas', 'Entradas Operacionais', kpis.totalEntradas, 'entrada'); }}
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
            <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {displayValue(kpis.totalEntradas, false, true)}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100/70 w-fit px-2 py-1 rounded">
            <span>Média: {displayValue(getAverageVal(kpis.totalEntradas), false, true)}</span>
          </div>
        </div>

        {/* Custos Operacionais */}
        <div 
          className={`min-w-[210px] shrink-0 snap-start md:min-w-0 relative bg-white border rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between ${
            isCardSelected('custos') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
          } ${onCardClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-md' : ''}`}
          onClick={() => onCardClick && onCardClick("Total Custos Operacionais")}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleCardToggle('custos', 'Custos Operacionais', kpis.totalCustos, 'saida'); }}
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
            <p className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
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
          className={`min-w-[210px] shrink-0 snap-start md:min-w-0 relative bg-white border rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between ${
            isCardSelected('despesas') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
          } ${onCardClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-md' : ''}`}
          onClick={() => onCardClick && onCardClick("Total Despesas Rateadas")}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleCardToggle('despesas', 'Despesas Rateadas', kpis.totalDespesas, 'saida'); }}
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
            <p className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
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
          className={`min-w-[210px] shrink-0 snap-start md:min-w-0 relative bg-white border rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between ${
            isCardSelected('resultado') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
          } ${onCardClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-md' : ''}`}
          onClick={() => onCardClick && onCardClick("Resultado Operacional")}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleCardToggle('resultado', 'Resultado Operacional', kpis.resultado, 'entrada'); }}
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
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pr-6">Resultado Operacional</h3>
            <p className={`text-xl sm:text-2xl font-black tracking-tight ${kpis.resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {displayValue(kpis.resultado)}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100/70 w-fit px-2 py-1 rounded">
            <span>Margem: {displayValue(kpis.percLucro, true)} • Média: {displayValue(getAverageVal(kpis.resultado))}</span>
          </div>
        </div>

        {/* Fluxo de Caixa Livre */}
        <div 
          className={`min-w-[210px] shrink-0 snap-start md:min-w-0 relative bg-slate-900 border rounded-2xl p-4 sm:p-5 shadow-md transition-all flex flex-col justify-between ${
            isCardSelected('fcl') ? 'border-amber-500 ring-2 ring-amber-500/30 bg-slate-800/80' : 'border-slate-800'
          } ${onCardClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg' : ''}`}
          onClick={() => onCardClick && onCardClick("Fluxo de Caixa Livre FCL")}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleCardToggle('fcl', 'Fluxo de Caixa Livre', kpis.fcl, 'entrada'); }}
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
            <p className={`text-xl sm:text-2xl font-black tracking-tight ${kpis.fcl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
          type="button"
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
        <div className="flex md:grid overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-3 md:gap-4 snap-x sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Outras Entradas */}
          <div 
            className={`min-w-[210px] shrink-0 snap-start md:min-w-0 relative bg-slate-50 border border-dashed rounded-2xl p-4 transition-all flex flex-col justify-between ${
              isCardSelected('outrasEntradas') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
            } ${onCardClick ? 'cursor-pointer hover:bg-slate-100 hover:scale-[1.02] hover:shadow-sm' : ''}`}
            onClick={() => onCardClick && onCardClick("Outras Entradas")}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleCardToggle('outrasEntradas', 'Outras Entradas', kpis.outrasEntradas, 'entrada'); }}
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
                {displayValue(kpis.outrasEntradas, false, true)}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-slate-400">
              <ArrowUpRight size={10} className="text-emerald-500" />
              <span>{calcPercent(kpis.outrasEntradas, true)} • Média: {displayValue(getAverageVal(kpis.outrasEntradas), false, true)}</span>
            </div>
          </div>

          {/* Impostos */}
          <div 
            className={`min-w-[210px] shrink-0 snap-start md:min-w-0 relative bg-slate-50 border border-dashed rounded-2xl p-4 transition-all flex flex-col justify-between ${
              isCardSelected('impostos') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
            } ${onCardClick ? 'cursor-pointer hover:bg-slate-100 hover:scale-[1.02] hover:shadow-sm' : ''}`}
            onClick={() => onCardClick && onCardClick("Total de Impostos")}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleCardToggle('impostos', 'Total de Impostos', kpis.totalImpostos, 'saida'); }}
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
            className={`min-w-[210px] shrink-0 snap-start md:min-w-0 relative bg-slate-50 border border-dashed rounded-2xl p-4 transition-all flex flex-col justify-between ${
              isCardSelected('investimentos') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/5' : 'border-slate-200'
            } ${onCardClick ? 'cursor-pointer hover:bg-slate-100 hover:scale-[1.02] hover:shadow-sm' : ''}`}
            onClick={() => onCardClick && onCardClick("Total Investimentos")}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleCardToggle('investimentos', 'Total Investimentos', kpis.totalInvestimentos, 'saida'); }}
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
            className={`min-w-[210px] shrink-0 snap-start md:min-w-0 relative bg-indigo-50 border border-dashed rounded-2xl p-4 transition-all flex flex-col justify-between overflow-hidden cursor-pointer hover:bg-indigo-100/85 ${
              isCardSelected('custom') ? 'border-amber-500 ring-2 ring-amber-500/25 bg-indigo-50/90' : 'border-indigo-200'
            } hover:scale-[1.02] hover:shadow-sm`}
            onClick={() => onCustomCardClick && onCustomCardClick()}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleCardToggle('custom', customCardTitle || 'Personalizado', customCardTotal || 0, 'saida'); }}
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
              <p className="text-xl font-black text-indigo-900 tracking-tight mt-1 flex items-baseline gap-2 flex-wrap">
                <span>
                  {customCardCategoriesCount && customCardCategoriesCount > 0 
                    ? displayValue(customCardTotal || 0) 
                    : 'R$ 0,00'}
                </span>
                {customCardCategoriesCount && customCardCategoriesCount > 0 && (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full border border-indigo-200/50" title="Representação em relação à receita operacional bruta/entradas">
                    {calcPercent(customCardTotal || 0)}
                  </span>
                )}
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
