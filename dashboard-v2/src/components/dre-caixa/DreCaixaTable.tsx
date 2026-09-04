"use client";

import React, { useState } from 'react';
import {
  Table as TableIcon,
  ChevronDown,
  ChevronRight,
  Lock,
  ListFilter,
  FileSpreadsheet
} from 'lucide-react';
import { DreCaixaTableSection } from '@/types/dre-caixa';
import { formatCurrencyBRL } from '@/services/dre-caixa.service';

interface DreCaixaTableProps {
  sections: DreCaixaTableSection[];
  meses: string[];
  isMeetingMode: boolean;
  onOpenDrilldown?: (categoryName: string) => void;
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
    <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm mb-6">
      
      {/* Header da Tabela */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <TableIcon size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Demonstração de Resultados (Regime de Caixa)
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Sintético
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Resultados consolidados por competência de liquidação e desembolso</p>
          </div>
        </div>

        {isMeetingMode && (
          <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
            <Lock size={12} />
            <span>Receitas e Entradas mascaradas para apresentação</span>
          </div>
        )}
      </div>

      {/* Tabela com scroll horizontal suave */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4 min-w-[280px]">Estrutura do Caixa</th>
              {meses.map(mes => (
                <th key={mes} className="py-3 px-3 min-w-[110px] text-right font-mono">
                  {mes}
                </th>
              ))}
              <th className="py-3 px-4 min-w-[130px] text-right bg-slate-950 font-bold text-slate-200">
                Total Período
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 font-medium">
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
                        ? 'bg-sky-500/10 hover:bg-sky-500/15 font-bold'
                        : section.tipo === 'entrada'
                        ? 'bg-emerald-500/5 hover:bg-emerald-500/10 font-bold'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-4 text-white flex items-center gap-2">
                      {section.subItens && section.subItens.length > 0 ? (
                        <button
                          onClick={() => toggleSection(section.grupo)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      ) : (
                        <span className="w-5" />
                      )}
                      <span className={`${section.tipo === 'resultado' ? 'text-sky-300 text-sm font-extrabold' : ''}`}>
                        {section.grupo}
                      </span>
                    </td>

                    {meses.map(mes => {
                      const val = section.valoresPorMes[mes] || 0;
                      return (
                        <td
                          key={mes}
                          className={`py-3 px-3 text-right font-mono text-[11px] ${
                            section.tipo === 'resultado'
                              ? val >= 0 ? 'text-sky-400 font-bold' : 'text-rose-400 font-bold'
                              : section.tipo === 'entrada'
                              ? 'text-emerald-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {isMasked ? (
                            <span className="text-amber-400/80 tracking-widest text-[10px]">••••••</span>
                          ) : (
                            formatCurrencyBRL(val)
                          )}
                        </td>
                      );
                    })}

                    <td
                      className={`py-3 px-4 text-right font-mono font-bold bg-slate-950/60 ${
                        section.tipo === 'resultado'
                          ? section.totalPeriodo >= 0 ? 'text-sky-400 text-sm' : 'text-rose-400 text-sm'
                          : section.tipo === 'entrada'
                          ? 'text-emerald-400'
                          : 'text-white'
                      }`}
                    >
                      {isMasked ? (
                        <span className="text-amber-400/90 tracking-widest text-[11px]">R$ ••••••••</span>
                      ) : (
                        formatCurrencyBRL(section.totalPeriodo)
                      )}
                    </td>
                  </tr>

                  {/* Subitens (quando expandido) */}
                  {isExpanded && section.subItens && section.subItens.map(sub => (
                    <tr
                      key={sub.descricao}
                      className="bg-slate-950/30 hover:bg-slate-800/30 text-slate-300 text-[11px] transition-colors"
                    >
                      <td className="py-2 px-4 pl-11 truncate max-w-[280px]">
                        <div className="flex items-center justify-between">
                          <span className="truncate" title={sub.descricao}>
                            {sub.descricao}
                          </span>
                          {onOpenDrilldown && (
                            <button
                              onClick={() => onOpenDrilldown(sub.descricao)}
                              className="text-[10px] text-slate-500 hover:text-emerald-400 ml-2"
                              title="Ver Lançamentos Detalhados"
                            >
                              <ListFilter size={12} />
                            </button>
                          )}
                        </div>
                      </td>

                      {meses.map(mes => (
                        <td key={mes} className="py-2 px-3 text-right font-mono text-slate-400 text-[11px]">
                          {formatCurrencyBRL(sub.valoresPorMes[mes] || 0)}
                        </td>
                      ))}

                      <td className="py-2 px-4 text-right font-mono font-semibold text-slate-200 bg-slate-950/40">
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
