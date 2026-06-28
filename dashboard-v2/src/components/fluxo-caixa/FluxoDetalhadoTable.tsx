"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, FileText, Landmark, Tag } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/services/lancamentos.service";

interface FluxoLancamento {
  id_global: string;
  omie_id: string;
  empresa: string;
  tipo: 'RECEBER' | 'PAGAR' | 'MOVIMENTO';
  status: 'PAGO' | 'ABERTO' | 'ATRASADO';
  valor_total: number;
  valor_alocado: number;
  data_emissao: string | null;
  data_registro: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  data_alocacao: string;
  categoria_codigo: string;
  categoria_nome: string;
  projeto_name: string;
  departamento_nome: string;
  cliente_fornecedor: string;
  numero_documento: string | null;
  observacao: string | null;
  selecionado?: boolean;
}

interface FluxoDetalhadoTableProps {
  lancamentos: FluxoLancamento[];
  onToggleSelection: (id: string) => void;
  onToggleAll: (selectAll: boolean) => void;
}

export function FluxoDetalhadoTable({ lancamentos, onToggleSelection, onToggleAll }: FluxoDetalhadoTableProps) {
  // Controle de expansão de Contas DRE e Categorias
  const [expandedDres, setExpandedDres] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const toggleDre = (dreName: string) => {
    const next = new Set(expandedDres);
    if (next.has(dreName)) next.delete(dreName);
    else next.add(dreName);
    setExpandedDres(next);
  };

  const toggleCat = (catKey: string) => {
    const next = new Set(expandedCats);
    if (next.has(catKey)) next.delete(catKey);
    else next.add(catKey);
    setExpandedCats(next);
  };

  // Agrupamento hierárquico
  const hierarchicalData = useMemo(() => {
    const dres: {
      [dreName: string]: {
        nome: string;
        total: number;
        categorias: {
          [catName: string]: {
            nome: string;
            total: number;
            lancamentos: FluxoLancamento[];
          };
        };
      };
    } = {};

    lancamentos.forEach(item => {
      const dreName = item.observacao?.includes('CONTA DRE:') 
        ? item.observacao.split('CONTA DRE:')[1].trim()
        : (item as any).conta_dre || 'Outras Despesas';

      const catName = item.categoria_nome || 'Sem Categoria';

      if (!dres[dreName]) {
        dres[dreName] = {
          nome: dreName,
          total: 0,
          categorias: {}
        };
      }

      if (!dres[dreName].categorias[catName]) {
        dres[dreName].categorias[catName] = {
          nome: catName,
          total: 0,
          lancamentos: []
        };
      }

      dres[dreName].categorias[catName].lancamentos.push(item);
      
      // Somar no total se estiver selecionado para simulação
      const valor = item.valor_alocado || 0;
      if (item.selecionado !== false) {
        dres[dreName].total += valor;
        dres[dreName].categorias[catName].total += valor;
      }
    });

    // Converter para array ordenado por nome do DRE
    return Object.values(dres).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [lancamentos]);

  const allSelected = lancamentos.length > 0 && lancamentos.every(l => l.selecionado !== false);
  const someSelected = lancamentos.some(l => l.selecionado !== false);

  const handleHeaderCheckboxChange = () => {
    onToggleAll(!allSelected);
  };

  // Toggle de seleção para uma categoria inteira
  const handleToggleCategory = (catLancamentos: FluxoLancamento[], isCurrentlyAllSelected: boolean) => {
    catLancamentos.forEach(l => {
      const isSelected = l.selecionado !== false;
      if (isSelected === isCurrentlyAllSelected) {
        onToggleSelection(l.id_global);
      }
    });
  };

  // Toggle de seleção para uma conta DRE inteira
  const handleToggleDre = (dreCategorias: { [key: string]: { lancamentos: FluxoLancamento[] } }, isCurrentlyAllSelected: boolean) => {
    Object.values(dreCategorias).forEach(cat => {
      cat.lancamentos.forEach(l => {
        const isSelected = l.selecionado !== false;
        if (isSelected === isCurrentlyAllSelected) {
          onToggleSelection(l.id_global);
        }
      });
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
            <tr>
              <th className="px-5 py-4 w-12 text-center">
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={handleHeaderCheckboxChange}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </th>
              <th className="px-5 py-4">Estrutura DRE / Categoria / Lançamento</th>
              <th className="px-5 py-4 w-32">Data Venc.</th>
              <th className="px-5 py-4 w-36">Empresa</th>
              <th className="px-5 py-4 text-right w-44">Valor Alocado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {hierarchicalData.map((dre) => {
              const isDreExpanded = expandedDres.has(dre.nome);
              const dreLancamentos = Object.values(dre.categorias).flatMap(c => c.lancamentos);
              const isDreAllSelected = dreLancamentos.every(l => l.selecionado !== false);
              const isDreSomeSelected = dreLancamentos.some(l => l.selecionado !== false);

              return (
                <React.Fragment key={dre.nome}>
                  {/* Nível 1: Conta DRE */}
                  <tr className="bg-slate-50/70 hover:bg-slate-100/50 transition-colors border-b border-slate-200/60">
                    <td className="px-5 py-3.5">
                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          checked={isDreAllSelected}
                          ref={el => {
                            if (el) el.indeterminate = isDreSomeSelected && !isDreAllSelected;
                          }}
                          onChange={() => handleToggleDre(dre.categorias, isDreAllSelected)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-800 text-sm">
                      <button
                        onClick={() => toggleDre(dre.nome)}
                        className="flex items-center gap-2.5 hover:text-emerald-700 transition-colors focus:outline-none"
                      >
                        {isDreExpanded ? (
                          <ChevronDown size={16} className="text-slate-500" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-500" />
                        )}
                        <Landmark size={16} className="text-emerald-600 shrink-0" />
                        <span>{dre.nome}</span>
                        <span className="text-[10px] bg-slate-200/75 text-slate-600 px-2 py-0.5 rounded-full font-medium ml-1">
                          {dreLancamentos.length}
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 font-medium text-xs">---</td>
                    <td className="px-5 py-3.5 text-slate-400 font-medium text-xs">---</td>
                    <td className={`px-5 py-3.5 text-right font-extrabold text-sm ${
                      dre.total > 0 ? 'text-emerald-600' : dre.total < 0 ? 'text-slate-900' : 'text-slate-400'
                    }`}>
                      {dre.total > 0 ? '+' : ''}{formatCurrency(dre.total)}
                    </td>
                  </tr>

                  {/* Nível 2: Categorias */}
                  {isDreExpanded && Object.values(dre.categorias).map((cat) => {
                    const catKey = `${dre.nome}-${cat.nome}`;
                    const isCatExpanded = expandedCats.has(catKey);
                    const isCatAllSelected = cat.lancamentos.every(l => l.selecionado !== false);
                    const isCatSomeSelected = cat.lancamentos.some(l => l.selecionado !== false);

                    return (
                      <React.Fragment key={cat.nome}>
                        <tr className="bg-white hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={isCatAllSelected}
                                ref={el => {
                                  if (el) el.indeterminate = isCatSomeSelected && !isCatAllSelected;
                                }}
                                onChange={() => handleToggleCategory(cat.lancamentos, isCatAllSelected)}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            </div>
                          </td>
                          <td className="px-5 py-3 pl-10 font-semibold text-slate-700 text-xs">
                            <button
                              onClick={() => toggleCat(catKey)}
                              className="flex items-center gap-2 hover:text-emerald-700 transition-colors focus:outline-none"
                            >
                              {isCatExpanded ? (
                                <ChevronDown size={14} className="text-slate-400" />
                              ) : (
                                <ChevronRight size={14} className="text-slate-400" />
                              )}
                              <Tag size={14} className="text-blue-500 shrink-0" />
                              <span>{cat.nome}</span>
                              <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded-full font-medium ml-1">
                                {cat.lancamentos.length}
                              </span>
                            </button>
                          </td>
                          <td className="px-5 py-3 text-slate-400 font-medium text-xs">---</td>
                          <td className="px-5 py-3 text-slate-400 font-medium text-xs">---</td>
                          <td className={`px-5 py-3 text-right font-bold text-xs ${
                            cat.total > 0 ? 'text-emerald-600' : cat.total < 0 ? 'text-slate-800' : 'text-slate-400'
                          }`}>
                            {cat.total > 0 ? '+' : ''}{formatCurrency(cat.total)}
                          </td>
                        </tr>

                        {/* Nível 3: Lançamentos */}
                        {isCatExpanded && cat.lancamentos.map((item) => {
                          const isSelected = item.selecionado !== false;

                          return (
                            <tr
                              key={item.id_global}
                              className={`bg-slate-50/20 hover:bg-slate-50/50 transition-colors border-l-2 border-l-emerald-500/30 ${
                                !isSelected ? 'opacity-40' : ''
                              }`}
                            >
                              <td className="px-5 py-2">
                                <div className="flex justify-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => onToggleSelection(item.id_global)}
                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                  />
                                </div>
                              </td>
                              <td className="px-5 py-2 pl-16">
                                <div className="flex items-start gap-2 max-w-[500px] lg:max-w-[700px]">
                                  <FileText size={13} className="text-slate-400 shrink-0 mt-0.5" />
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800 text-xs truncate" title={item.cliente_fornecedor}>
                                      {item.cliente_fornecedor}
                                    </span>
                                    {item.observacao && (
                                      <span className="text-[10px] text-slate-400 line-clamp-1 italic" title={item.observacao}>
                                        {item.observacao}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-2 text-slate-600 font-medium text-xs whitespace-nowrap">
                                {formatDateBR(item.data_alocacao)}
                              </td>
                              <td className="px-5 py-2">
                                <span className="font-bold text-slate-700 text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {item.empresa}
                                </span>
                              </td>
                              <td className={`px-5 py-2 text-right font-black text-xs ${
                                item.valor_alocado > 0 ? 'text-emerald-600' : 'text-slate-900'
                              }`}>
                                {item.valor_alocado > 0 ? '+' : ''}{formatCurrency(item.valor_alocado)}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {lancamentos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400 italic">
                  Nenhum lançamento detalhado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
