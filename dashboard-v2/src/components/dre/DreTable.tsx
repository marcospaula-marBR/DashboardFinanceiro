import React from 'react';
import { DreCalculatedResult } from '@/types/dre';

interface DreTableProps {
  results: DreCalculatedResult | null;
  isPrivacyMode: boolean;
  onRowClick?: (title: string) => void;
}

export function DreTable({ results, isPrivacyMode, onRowClick }: DreTableProps) {
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
  const totalReceita = results.kpis.totalEntradas || 1;

  const displayValue = (val: number, isPercent = false) => {
    if (isPrivacyMode) return '****';
    if (isPercent) return `${val.toFixed(2).replace('.', ',')}%`;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Detalhamento Financeiro</h3>
      </div>
      
      <div className="overflow-auto max-h-[68vh] relative">
        <table className="w-full text-sm text-left whitespace-nowrap border-separate border-spacing-0">
          <thead className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider sticky top-0 z-30">
            <tr>
              <th className="px-4 py-3 sticky top-0 left-0 bg-slate-100 z-30 border-r border-b border-slate-200 min-w-[220px] w-[220px] max-w-[220px]">
                Descrição
              </th>
              <th className="px-4 py-3 text-right sticky top-0 left-[220px] bg-slate-200 font-bold border-r border-b border-slate-300 z-30 min-w-[120px] w-[120px]">
                Total
              </th>
              <th className="px-4 py-3 text-right sticky top-0 left-[340px] bg-slate-100 font-bold border-r border-b border-slate-200 z-30 min-w-[100px] w-[100px]">
                Média
              </th>
              {reversedColumns.map(col => (
                <th key={col} className="px-4 py-3 text-right sticky top-0 bg-slate-100 border-b border-slate-200 z-20">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
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
              const avgVal = reversedColumns.length > 0 ? (totalVal / reversedColumns.length) : 0;
              const pct = totalReceita > 0 ? (totalVal / totalReceita) * 100 : 0;

              return (
                <tr 
                  key={idx} 
                  onClick={() => onRowClick && onRowClick(item.titulo)}
                  className={`transition-colors group ${onRowClick ? 'cursor-pointer' : ''} ${
                    isCard ? 'bg-slate-50 font-bold text-slate-800' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <td className={`px-4 py-2.5 sticky left-0 border-r border-b border-slate-200 min-w-[220px] w-[220px] max-w-[220px] transition-colors group-hover:bg-slate-100 ${
                    isCard ? 'bg-slate-50 z-10' : 'bg-white z-10'
                  }`}>
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{item.titulo}</span>
                      {!isPercent && totalVal !== 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 shrink-0 ${
                          isCard 
                            ? 'text-amber-700 bg-amber-100/80 border border-amber-250/20' 
                            : 'text-slate-500 bg-slate-100 group-hover:bg-slate-200/50'
                        }`}>
                          {pct.toFixed(1).replace('.', ',')}%
                        </span>
                      )}
                    </div>
                  </td>
                  
                  <td className={`px-4 py-2.5 text-right font-mono font-bold text-[13px] sticky left-[220px] border-r border-b border-slate-300 transition-colors group-hover:bg-slate-100 ${
                    isCard ? 'bg-slate-100 z-10' : 'bg-slate-50 z-10'
                  }`}>
                    {displayValue(totalVal, isPercent)}
                  </td>

                  <td className={`px-4 py-2.5 text-right font-mono text-[13px] sticky left-[340px] border-r border-b border-slate-200 transition-colors group-hover:bg-slate-100 ${
                    isCard ? 'bg-slate-50 font-bold z-10' : 'bg-white z-10'
                  }`}>
                    {displayValue(avgVal, isPercent)}
                  </td>

                  {reversedColumns.map(col => {
                    const monthVal = mensal[item.titulo]?.[col] || 0;
                    return (
                      <td key={col} className="px-4 py-2.5 text-right font-mono text-[13px] border-b border-slate-100 transition-colors group-hover:bg-slate-50">
                        {displayValue(monthVal, isPercent)}
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
