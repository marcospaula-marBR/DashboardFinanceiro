"use client";

import React, { useState } from 'react';
import {
  Table as TableIcon,
  ChevronDown,
  ChevronRight,
  Lock,
  ListFilter,
  Users
} from 'lucide-react';
import { DreCaixaTableSection } from '@/types/dre-caixa';
import { formatCurrencyBRL } from '@/services/dre-caixa.service';

interface DreCaixaTableProps {
  sections: DreCaixaTableSection[];
  meses: string[];
  isMeetingMode: boolean;
  onOpenDrilldown?: (categoryName: string, mes?: string) => void;
}

export function DreCaixaTable({
  sections,
  meses,
  isMeetingMode,
  onOpenDrilldown
}: DreCaixaTableProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    '(-) Custos Operacionais Pagos': true,
    '(-) Despesas Administrativas & Pessoal Pagas': true
  });

  const toggleSection = (grupo: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [grupo]: !prev[grupo]
    }));
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-6">
      
      {/* Header da Tabela */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
            <TableIcon size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 tracking-tight">
              Demonstração de Resultados (Regime de Caixa)
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Sintético
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">Resultados consolidados por competência de liquidação e desembolso</p>
          </div>
        </div>

        {isMeetingMode && (
          <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl font-bold">
            <Lock size={12} className="text-amber-600" />
            <span>Receitas e Entradas mascaradas para apresentação</span>
          </div>
        )}
      </div>

      {/* Tabela com scroll horizontal suave */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3.5 px-4 min-w-[280px]">Estrutura do Caixa</th>
              {meses.map(mes => (
                <th key={mes} className="py-3.5 px-3 min-w-[110px] text-right font-mono text-slate-600">
                  {mes}
                </th>
              ))}
              <th className="py-3.5 px-4 min-w-[130px] text-right bg-slate-100 font-black text-slate-900">
                Total Período
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 font-medium">
            {sections.map(section => {
              const isExpanded = !!expandedSections[section.grupo];
              const isEntradaOrResultado = section.tipo === 'entrada' || section.tipo === 'resultado';
              const isMasked = isMeetingMode && isEntradaOrResultado;

              return (
                <React.Fragment key={section.grupo}>
                  {/* Linha Principal do Grupo */}
                  <tr
                    className={`transition-colors ${
                      section.tipo === 'resultado'
                        ? 'bg-sky-50/70 hover:bg-sky-100/70 font-black text-sky-950 border-y border-sky-200'
                        : section.tipo === 'entrada'
                        ? 'bg-emerald-50/50 hover:bg-emerald-100/60 font-black text-emerald-950 border-y border-emerald-200'
                        : 'bg-slate-50/80 hover:bg-slate-100/80 font-bold text-slate-900 border-t border-slate-200'
                    }`}
                  >
                    <td className="py-3 px-4 flex items-center gap-2">
                      {section.subItens && section.subItens.length > 0 ? (
                        <button
                          onClick={() => toggleSection(section.grupo)}
                          className="p-1 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      ) : (
                        <span className="w-5" />
                      )}
                      <span className={`${section.tipo === 'resultado' ? 'text-sky-900 text-sm font-black' : ''}`}>
                        {section.grupo}
                      </span>
                      {section.tipo !== 'resultado' && onOpenDrilldown && (
                        <button
                          onClick={() => onOpenDrilldown(section.grupo)}
                          className="text-[10px] text-slate-400 hover:text-emerald-700 ml-1.5 p-1 hover:bg-slate-200/60 rounded-md transition-colors"
                          title={`Ver todos os favorecidos de ${section.grupo}`}
                        >
                          <Users size={12} />
                        </button>
                      )}
                    </td>

                    {meses.map(mes => {
                      const val = section.valoresPorMes[mes] || 0;
                      return (
                        <td
                          key={mes}
                          className={`py-3 px-3 text-right font-mono text-[11px] ${
                            section.tipo === 'resultado'
                              ? val >= 0 ? 'text-sky-700 font-black' : 'text-rose-600 font-black'
                              : section.tipo === 'entrada'
                              ? 'text-emerald-700 font-bold'
                              : 'text-slate-700 font-bold'
                          }`}
                        >
                          {isMasked ? (
                            <span className="text-amber-600 tracking-widest text-[10px]">••••••</span>
                          ) : (
                            formatCurrencyBRL(val)
                          )}
                        </td>
                      );
                    })}

                    <td
                      className={`py-3 px-4 text-right font-mono font-black ${
                        section.tipo === 'resultado'
                          ? section.totalPeriodo >= 0 ? 'text-sky-800 text-sm bg-sky-100/60' : 'text-rose-600 text-sm bg-rose-50'
                          : section.tipo === 'entrada'
                          ? 'text-emerald-800 bg-emerald-100/50'
                          : 'text-slate-900 bg-slate-100'
                      }`}
                    >
                      {isMasked ? (
                        <span className="text-amber-700 tracking-widest text-[11px]">R$ ••••••••</span>
                      ) : (
                        formatCurrencyBRL(section.totalPeriodo)
                      )}
                    </td>
                  </tr>

                  {/* Subitens (quando expandido) */}
                  {isExpanded && section.subItens && section.subItens.map(sub => (
                    <tr
                      key={sub.descricao}
                      onClick={() => onOpenDrilldown && onOpenDrilldown(sub.descricao)}
                      className="bg-white hover:bg-emerald-50/70 text-slate-700 text-[11px] transition-colors border-b border-slate-100 cursor-pointer group"
                      title={`Clique para detalhar os favorecidos de "${sub.descricao}"`}
                    >
                      <td className="py-2.5 px-4 pl-11 truncate max-w-[280px]">
                        <div className="flex items-center justify-between">
                          <span className="truncate font-medium text-slate-800 group-hover:text-emerald-900 group-hover:font-semibold transition-colors" title={sub.descricao}>
                            {sub.descricao}
                          </span>
                          <span className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-full ml-2 shrink-0">
                            <Users size={11} />
                            Ver Favorecidos
                          </span>
                        </div>
                      </td>

                      {meses.map(mes => (
                        <td
                          key={mes}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenDrilldown) onOpenDrilldown(sub.descricao, mes);
                          }}
                          className="py-2.5 px-3 text-right font-mono text-slate-600 group-hover:text-slate-900 hover:!text-emerald-700 hover:!font-black hover:!bg-emerald-100/60 rounded transition-all text-[11px]"
                          title={`Clique para filtrar favorecidos de "${sub.descricao}" em ${mes}`}
                        >
                          {formatCurrencyBRL(sub.valoresPorMes[mes] || 0)}
                        </td>
                      ))}

                      <td
                        className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 bg-slate-50 group-hover:bg-emerald-100/40 group-hover:text-emerald-950 transition-colors"
                        title={`Clique para detalhar todos os favorecidos de "${sub.descricao}" no período acumulado`}
                      >
                        {formatCurrencyBRL(sub.totalPeriodo)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

    </section>
  );
}
