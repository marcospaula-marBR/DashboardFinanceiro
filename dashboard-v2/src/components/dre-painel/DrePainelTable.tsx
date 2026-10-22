"use client";

import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Info,
  Clock,
  AlertTriangle,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { DrePainelTableSection, DrePainelLancamento } from '@/types/dre-painel';
import { formatCurrencyBRL } from '@/services/dre-painel.service';

interface DrePainelTableProps {
  sections: DrePainelTableSection[];
  periodos: string[];
  isMeetingMode: boolean;
  onSelectLancamento: (l: DrePainelLancamento) => void;
}

export function DrePainelTable({
  sections,
  periodos,
  isMeetingMode,
  onSelectLancamento
}: DrePainelTableProps) {
  // Controle de colapso de seções (Conta DRE) e categorias
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Receita Bruta de Vendas': true,
    'Despesas Administrativas': true
  });
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleSection = (conta: string) => {
    setExpandedSections(prev => ({ ...prev, [conta]: !prev[conta] }));
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const mask = (val: number) => {
    if (isMeetingMode) return '••••••';
    if (Math.abs(val) < 0.001) return '-';
    return formatCurrencyBRL(val).replace('R$', '').trim();
  };

  if (sections.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <Layers size={32} className="mx-auto text-slate-300 mb-2" />
        <h3 className="text-sm font-bold text-slate-800">Nenhum lançamento encontrado</h3>
        <p className="text-xs text-slate-500 mt-1">
          Ajuste os filtros de período, empresa ou tipo de lançamento para visualizar os dados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Scroll horizontal fluido com estilo limpo */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <th className="py-3 px-4 min-w-[280px] sticky left-0 bg-slate-50 z-10">
                Estrutura de Contas DRE
              </th>
              {periodos.map(p => (
                <th key={p} className="py-3 px-3 text-right font-bold min-w-[105px] whitespace-nowrap">
                  {p}
                </th>
              ))}
              <th className="py-3 px-4 text-right font-black text-slate-900 bg-slate-100/70 min-w-[120px] sticky right-0 z-10">
                Total Geral
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sections.map(section => {
              const isSectionOpen = !!expandedSections[section.contaDre];
              const isReceita = section.tipo === 'RECEITA';

              return (
                <React.Fragment key={section.contaDre}>
                  {/* Linha da Conta DRE Principal */}
                  <tr
                    onClick={() => toggleSection(section.contaDre)}
                    className="bg-slate-50/70 hover:bg-slate-100/70 transition-colors cursor-pointer font-bold select-none"
                  >
                    <td className="py-2.5 px-4 sticky left-0 bg-slate-50/90 z-10 flex items-center gap-2">
                      <span className="text-slate-400">
                        {isSectionOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </span>
                      <span className="text-slate-900 font-bold">{section.contaDre}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({section.categorias.length})
                      </span>
                    </td>
                    {periodos.map(p => {
                      const v = section.valoresPorMes[p] || 0;
                      return (
                        <td
                          key={p}
                          className={`py-2.5 px-3 text-right font-bold font-mono ${
                            isReceita ? 'text-emerald-700' : 'text-slate-800'
                          }`}
                        >
                          {mask(v)}
                        </td>
                      );
                    })}
                    <td
                      className={`py-2.5 px-4 text-right font-black font-mono bg-slate-100/80 sticky right-0 z-10 ${
                        isReceita ? 'text-emerald-800' : 'text-slate-900'
                      }`}
                    >
                      {mask(section.totalGeral)}
                    </td>
                  </tr>

                  {/* Categorias da Conta DRE */}
                  {isSectionOpen &&
                    section.categorias.map(cat => {
                      const catKey = `${section.contaDre}-${cat.categoria}`;
                      const isCatOpen = !!expandedCategories[catKey];
                      const itensCount = cat.detalhes?.length || 0;

                      return (
                        <React.Fragment key={catKey}>
                          <tr
                            onClick={() => toggleCategory(catKey)}
                            className="hover:bg-slate-50/60 transition-colors cursor-pointer select-none text-slate-700"
                          >
                            <td className="py-2 px-4 pl-9 sticky left-0 bg-white z-10 flex items-center gap-1.5">
                              <span className="text-slate-300">
                                {isCatOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </span>
                              <span className="font-semibold text-slate-800 truncate">
                                {cat.categoria}
                              </span>
                              {itensCount > 0 && (
                                <span className="text-[10px] text-slate-400">({itensCount})</span>
                              )}
                            </td>
                            {periodos.map(p => {
                              const v = cat.valoresPorMes[p] || 0;
                              return (
                                <td key={p} className="py-2 px-3 text-right font-mono text-slate-600">
                                  {mask(v)}
                                </td>
                              );
                            })}
                            <td className="py-2 px-4 text-right font-bold font-mono text-slate-800 bg-slate-50/50 sticky right-0 z-10">
                              {mask(cat.totalGeral)}
                            </td>
                          </tr>

                          {/* Detalhes dos lançamentos da Categoria */}
                          {isCatOpen &&
                            cat.detalhes?.map(l => (
                              <tr
                                key={l.id}
                                onClick={() => onSelectLancamento(l)}
                                className="bg-slate-50/30 hover:bg-emerald-50/30 transition-colors cursor-pointer text-[11px] text-slate-500"
                              >
                                <td className="py-1.5 px-4 pl-14 sticky left-0 bg-slate-50/40 z-10 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-medium text-slate-700 truncate">
                                      {l.fornecedor_cliente}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      • {l.projeto}
                                    </span>
                                    {l.is_provisao && (
                                      <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 rounded font-bold">
                                        Provisão
                                      </span>
                                    )}
                                    {l.is_parcela_anterior && (
                                      <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 rounded font-bold">
                                        {l.numero_parcela}
                                      </span>
                                    )}
                                    {l.is_em_atraso && (
                                      <span className="text-[9px] bg-rose-100 text-rose-800 px-1 rounded font-bold flex items-center gap-0.5">
                                        <AlertTriangle size={9} />
                                        Atraso
                                      </span>
                                    )}
                                  </div>
                                  <ArrowUpRight size={12} className="text-slate-400 shrink-0 opacity-60" />
                                </td>
                                {periodos.map(p => {
                                  const isThisMonth = l.periodo === p;
                                  return (
                                    <td key={p} className="py-1.5 px-3 text-right font-mono text-slate-500">
                                      {isThisMonth ? mask(l.valor) : '-'}
                                    </td>
                                  );
                                })}
                                <td className="py-1.5 px-4 text-right font-mono text-slate-600 bg-slate-50/40 sticky right-0 z-10">
                                  {mask(l.valor)}
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
