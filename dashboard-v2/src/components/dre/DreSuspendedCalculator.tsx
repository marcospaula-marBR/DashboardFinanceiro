'use client';

import React, { useState } from 'react';
import { SelectedCalcItem } from '@/types/dre';
import { 
  Calculator, 
  X, 
  Trash2, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Minus 
} from 'lucide-react';

interface DreSuspendedCalculatorProps {
  selectedCalcItems: SelectedCalcItem[];
  onToggleCalcItem: (item: SelectedCalcItem) => void;
  onClearCalcItems: () => void;
  isSidebarCollapsed: boolean;
  isPrivacyMode?: boolean;
  isRevenuePrivacyMode?: boolean;
}

export function DreSuspendedCalculator({
  selectedCalcItems,
  onToggleCalcItem,
  onClearCalcItems,
  isSidebarCollapsed,
  isPrivacyMode = false,
  isRevenuePrivacyMode = false,
}: DreSuspendedCalculatorProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  // Não exibe nada se não houver itens selecionados
  if (!selectedCalcItems || selectedCalcItems.length === 0) {
    return null;
  }

  const formatCurrency = (val: number) => {
    if (isPrivacyMode) return 'R$ ****';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Cálculos
  let runningTotal = 0;
  let totalSumAbs = 0;
  let hasEntrada = false;
  let hasSaida = false;

  selectedCalcItems.forEach(item => {
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
  const finalDisplayTotal = !isMixed ? totalSumAbs : runningTotal;

  const handleCopy = () => {
    const textToCopy = formatCurrency(finalDisplayTotal);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Posicionamento dinâmico baseado no estado da sidebar:
  // Desktop: se a sidebar estiver expandida (w-80 = 320px), posiciona em left-[344px].
  // Se estiver recolhida, posiciona em left-6.
  // Mobile (< 768px): ocupa a parte inferior esquerda com margem adaptada.
  const leftPositionClass = isSidebarCollapsed
    ? 'left-3 sm:left-6'
    : 'left-3 md:left-[344px]';

  // --- MODO MINIMIZADO (PÍLULA COMPACTA SUSPENSA) ---
  if (isMinimized) {
    return (
      <div 
        className={`fixed ${leftPositionClass} bottom-5 z-40 animate-in fade-in slide-in-from-bottom-3 duration-200`}
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="group flex items-center gap-2.5 bg-slate-900/95 hover:bg-slate-850 text-white px-3.5 py-2 rounded-full border border-amber-500/40 shadow-2xl backdrop-blur-md ring-2 ring-amber-500/20 transition-all hover:scale-105 active:scale-95"
          title="Expandir Calculadora Express"
        >
          <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Calculator size={13} />
          </div>
          <div className="flex items-center gap-2 text-left">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              {selectedCalcItems.length} {selectedCalcItems.length === 1 ? 'rubrica' : 'rubricas'}
            </span>
            <span className="text-xs font-mono font-extrabold text-white">
              {formatCurrency(finalDisplayTotal)}
            </span>
          </div>
          <ChevronUp size={14} className="text-slate-400 group-hover:text-amber-400 transition-colors ml-1" />
        </button>
      </div>
    );
  }

  // --- MODO EXPANDIDO (PAINEL FLUTUANTE MODERNO) ---
  return (
    <aside 
      className={`fixed ${leftPositionClass} bottom-5 z-40 w-[calc(100vw-24px)] sm:w-[350px] max-w-[360px] bg-slate-900/95 backdrop-blur-xl text-white rounded-2xl border border-amber-500/30 shadow-2xl shadow-black/50 ring-1 ring-amber-500/20 p-4 animate-in fade-in slide-in-from-bottom-4 duration-300 select-none`}
      aria-label="Calculadora Express Suspensa"
    >
      {/* Cabeçalho do Card Suspenso */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-xs">
            <Calculator size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <h3 className="text-xs font-black tracking-wider text-amber-400 uppercase">Calculadora Express</h3>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Painel Dinâmico Suspenso
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Botão Minimizar */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Minimizar para pílula"
          >
            <Minus size={14} />
          </button>
          {/* Botão Limpar Tudo */}
          <button
            onClick={onClearCalcItems}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
            title="Limpar seleção"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Bloco de Valor Acumulado Principal */}
      <div className="mt-3 bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            {isMixed ? 'Líquido DRE (Entradas - Saídas)' : 'Total Acumulado'}
          </span>
          <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30">
            {selectedCalcItems.length} {selectedCalcItems.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className={`text-xl font-black font-mono tracking-tight ${
            !isMixed 
              ? 'text-amber-400' 
              : (runningTotal >= 0 ? 'text-emerald-400' : 'text-rose-400')
          }`}>
            {formatCurrency(finalDisplayTotal)}
          </span>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-amber-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 px-2 py-1 rounded-lg transition-all active:scale-95 shrink-0"
            title="Copiar valor"
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>

        {/* Exibição auxiliar em caso de natureza mista */}
        {isMixed && (
          <div className="mt-2 pt-2 border-t border-slate-850 flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-medium">Soma Absoluta:</span>
            <span className="font-mono font-bold text-slate-200">
              {formatCurrency(totalSumAbs)}
            </span>
          </div>
        )}
      </div>

      {/* Lista de Rubricas Selecionadas */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Rubricas Ativas
          </span>
          <span className="text-[9px] text-slate-500">
            Clique no × para remover
          </span>
        </div>

        <div className="space-y-1 max-h-36 overflow-y-auto pr-1 select-text scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {selectedCalcItems.map(item => (
            <div 
              key={item.id}
              className="flex items-center justify-between gap-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-750/60 hover:border-slate-700 px-2 py-1.5 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-[9px] font-extrabold px-1 rounded ${
                  item.type === 'entrada'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                }`}>
                  {item.type === 'entrada' ? '+' : '–'}
                </span>
                <span className="text-[11px] font-medium text-slate-200 truncate" title={item.title}>
                  {item.title}
                </span>
                {item.source === 'card' && (
                  <span className="text-[8px] bg-slate-700 text-slate-300 font-bold px-1 rounded uppercase">
                    Card
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-mono font-bold text-slate-300">
                  {formatCurrency(item.value)}
                </span>
                <button
                  onClick={() => onToggleCalcItem(item)}
                  className="text-slate-400 hover:text-rose-300 p-0.5 rounded hover:bg-white/10 transition-colors"
                  title="Remover rubrica"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rodapé de Ação Rápida */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
        <button
          onClick={onClearCalcItems}
          className="text-slate-400 hover:text-slate-200 font-medium underline underline-offset-2 hover:no-underline"
        >
          Limpar todas ({selectedCalcItems.length})
        </button>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
        >
          <span>Minimizar</span>
          <ChevronDown size={11} />
        </button>
      </div>
    </aside>
  );
}
