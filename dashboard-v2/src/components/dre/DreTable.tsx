import React from 'react';
import { DreCalculatedResult, SelectedCalcItem } from '@/types/dre';
import { Calculator } from 'lucide-react';

interface DreTableProps {
  results: DreCalculatedResult | null;
  isPrivacyMode: boolean;
  isRevenuePrivacyMode?: boolean;
  onRowClick?: (title: string) => void;
  selectedCalcItems?: SelectedCalcItem[];
  onToggleCalcItem?: (item: SelectedCalcItem) => void;
}

export function DreTable({ 
  results, 
  isPrivacyMode, 
  isRevenuePrivacyMode, 
  onRowClick,
  selectedCalcItems,
  onToggleCalcItem
}: DreTableProps) {
  if (!results) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 shadow-sm">
        Faça o upload do CSV para visualizar o detalhamento financeiro.
      </div>
    );
  }

  const { estrutura, totais, mensal, validColumns } = results;

  // Inverter a ordem das colunas para mostrar o mês mais recente primeiro
  const reversedColumns = [...validColumns].reverse();

  // Total de Entradas (Operacionais + Outras Entradas) para base da Análise Vertical
  const totalReceita = results.kpis.totalEntradas || 0;

  const displayValue = (val: number, isPercent = false, isRevenueItem = false) => {
    if (isPrivacyMode || (isRevenuePrivacyMode && isRevenueItem)) return '****';
    if (isPercent) return `${val.toFixed(2).replace('.', ',')}%`;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const selectedRowsCount = selectedCalcItems?.filter(i => i.source === 'tabela').length || 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-slate-800 text-lg">Detalhamento Financeiro</h3>
          {selectedRowsCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Calculator size={11} /> {selectedRowsCount} {selectedRowsCount === 1 ? 'rubrica na calculadora' : 'rubricas na calculadora'}
            </span>
          )}
        </div>
      </div>
      
      <div className="overflow-auto max-h-[68vh] relative">
        <table className="w-full text-[15px] text-left whitespace-nowrap border-separate border-spacing-0">
          <thead className="bg-slate-105 text-slate-700 font-bold text-sm tracking-wide sticky top-0 z-30">
            <tr>
              <th className="px-4 py-3.5 sticky top-0 left-0 bg-slate-100 z-30 border-r border-b border-slate-200 min-w-[260px] w-[260px] max-w-[260px]">
                Descrição
              </th>
              <th className="px-4 py-3.5 text-right sticky top-0 left-[260px] bg-slate-200 font-extrabold border-r border-b border-slate-300 z-30 min-w-[145px] w-[145px]">
                Total
              </th>
              <th className="px-4 py-3.5 text-right sticky top-0 left-[405px] bg-slate-100 font-extrabold border-r border-b border-slate-200 z-30 min-w-[110px] w-[110px]">
                Média
              </th>
              {reversedColumns.map(col => (
                <th key={col} className="px-4 py-3.5 text-right sticky top-0 bg-slate-100 border-b border-slate-200 z-20">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {estrutura.map((item, idx) => {
              if (item.tipo === 'hidden') return null;
              
              if (item.tipo === 'divisor') {
                return (
                  <tr key={`div-${idx}`} className="bg-slate-50">
                    <td colSpan={reversedColumns.length + 3} className="h-2 border-b border-slate-100"></td>
                  </tr>
                );
              }

              const isCard = item.tipo === 'card' || item.tipo === 'card_percentual';
              const isPercent = item.tipo === 'card_percentual';

              const totalVal = totais[item.titulo] || 0;
              const avgVal = isPercent
                ? (reversedColumns.length > 0
                    ? (reversedColumns.reduce((sum, col) => sum + (mensal[item.titulo]?.[col] || 0), 0) / reversedColumns.length)
                    : 0)
                : (reversedColumns.length > 0 ? (totalVal / reversedColumns.length) : 0);
              const pct = totalReceita > 0 ? (totalVal / totalReceita) * 100 : 0;

              const isSelectedForCalc = selectedCalcItems?.some(i => i.id === `row-${item.titulo}`);

              return (
                <tr 
                  key={idx} 
                  onClick={() => onRowClick && onRowClick(item.titulo)}
                  className={`transition-colors group ${onRowClick ? 'cursor-pointer' : ''} ${
                    isSelectedForCalc ? 'ring-2 ring-inset ring-amber-400/60 bg-amber-50/25' : ''
                  } ${
                    isCard ? 'bg-slate-50/80 font-bold text-slate-900 text-[15px]' : 'text-slate-700 font-medium hover:bg-slate-50'
                  }`}
                >
                  <td className={`px-4 py-3 sticky left-0 border-r border-b border-slate-200 min-w-[260px] w-[260px] max-w-[260px] transition-colors group-hover:bg-slate-100 ${
                    isSelectedForCalc 
                      ? 'bg-amber-50/70 z-10' 
                      : (isCard ? 'bg-slate-50 z-10' : 'bg-white z-10')
                  }`}>
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate text-[14.5px] font-medium">{item.titulo}</span>
                      {!isPercent && totalVal !== 0 && (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ml-2 shrink-0 ${
                          isCard 
                            ? 'text-amber-700 bg-amber-100/80 border border-amber-250/20' 
                            : 'text-slate-600 bg-slate-100 group-hover:bg-slate-200/50'
                        }`}>
                          {pct.toFixed(1).replace('.', ',')}%
                        </span>
                      )}
                    </div>
                  </td>
                  
                  <td className={`px-3 py-2.5 text-right font-mono font-bold text-[14px] sticky left-[260px] min-w-[145px] w-[145px] border-r border-b border-slate-300 transition-colors group-hover:bg-slate-100 ${
                    isSelectedForCalc 
                      ? 'bg-amber-100/90 text-amber-950 z-10' 
                      : (isCard ? 'bg-slate-100 z-10' : 'bg-slate-50 z-10')
                  }`}>
                    <div className="flex items-center justify-end gap-2">
                      {onToggleCalcItem && !isPercent && totalVal !== 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const isRev = item.titulo.toLowerCase().includes('receita') || item.titulo.toLowerCase().includes('entrada');
                            onToggleCalcItem({
                              id: `row-${item.titulo}`,
                              title: item.titulo,
                              value: totalVal,
                              type: isRev ? 'entrada' : 'saida',
                              source: 'tabela'
                            });
                          }}
                          className={`p-1 rounded-md border transition-all duration-150 shrink-0 ${
                            isSelectedForCalc
                              ? 'bg-amber-500 border-amber-600 text-white shadow-xs ring-2 ring-amber-400/40 scale-105'
                              : 'bg-white border-slate-300 text-slate-400 hover:text-amber-600 hover:border-amber-400 hover:bg-amber-50/60 opacity-60 group-hover:opacity-100'
                          }`}
                          title={isSelectedForCalc ? "Remover da calculadora express" : "Somar na calculadora express"}
                        >
                          <Calculator size={11} />
                        </button>
                      )}
                      <span>
                        {displayValue(totalVal, isPercent, item.titulo.toLowerCase().includes('receita') || item.titulo.toLowerCase().includes('entrada'))}
                      </span>
                    </div>
                  </td>

                  <td className={`px-4 py-3 text-right font-mono text-[14px] sticky left-[405px] min-w-[110px] w-[110px] border-r border-b border-slate-200 transition-colors group-hover:bg-slate-100 ${
                    isCard ? 'bg-slate-50 font-bold z-10' : 'bg-white z-10'
                  }`}>
                    {displayValue(avgVal, isPercent, item.titulo.toLowerCase().includes('receita') || item.titulo.toLowerCase().includes('entrada'))}
                  </td>

                  {reversedColumns.map(col => {
                    const monthVal = mensal[item.titulo]?.[col] || 0;
                    return (
                      <td key={col} className="px-4 py-3 text-right font-mono text-[14px] border-b border-slate-100 transition-colors group-hover:bg-slate-50">
                        {displayValue(monthVal, isPercent, item.titulo.toLowerCase().includes('receita') || item.titulo.toLowerCase().includes('entrada'))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
