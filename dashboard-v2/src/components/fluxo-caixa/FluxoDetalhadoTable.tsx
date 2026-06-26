"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Fingerprint, Tags, Calendar, Building2, ExternalLink } from "lucide-react";
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
  projeto_nome: string;
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const getStatusInfo = (item: FluxoLancamento) => {
    if (item.status === 'PAGO') {
      return { label: 'REALIZADO', color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
    }
    if (item.status === 'ATRASADO') {
      return { label: 'ATRASADO', color: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50' };
    }
    return { label: 'PROJETADO', color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' };
  };

  const allSelected = lancamentos.length > 0 && lancamentos.every(l => l.selecionado !== false);
  const someSelected = lancamentos.some(l => l.selecionado !== false);

  const handleHeaderCheckboxChange = () => {
    onToggleAll(!allSelected);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
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
              <th className="px-5 py-4 w-32">Status</th>
              <th className="px-5 py-4">Data Ref.</th>
              <th className="px-5 py-4">Empresa</th>
              <th className="px-5 py-4">Fornecedor / Cliente</th>
              <th className="px-5 py-4 text-right">Valor Alocado</th>
              <th className="px-5 py-4">Categoria</th>
              <th className="px-5 py-4 text-center">Tipo</th>
              <th className="px-5 py-4 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lancamentos.map((item) => {
              const rowId = item.id_global;
              const isExpanded = expandedIds.has(rowId);
              const status = getStatusInfo(item);
              const isSelected = item.selecionado !== false;

              return (
                <React.Fragment key={rowId}>
                  <tr className={`hover:bg-slate-50/50 transition-colors ${isExpanded ? 'bg-slate-50/30' : ''} ${!isSelected ? 'opacity-40 bg-slate-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex justify-center">
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => onToggleSelection(rowId)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${status.bg}`}>
                        <div className={`w-2 h-2 rounded-full ${status.color}`} />
                        <span className={`text-[10px] font-bold ${status.text}`}>{status.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 font-medium whitespace-nowrap">
                      {formatDateBR(item.data_alocacao)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-bold text-slate-700 text-xs">{item.empresa}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900 truncate max-w-[240px]" title={item.cliente_fornecedor}>
                        {item.cliente_fornecedor}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`font-black ${item.valor_alocado > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {item.valor_alocado > 0 ? '+' : ''}{formatCurrency(item.valor_alocado)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-block px-2 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] rounded leading-none truncate max-w-[150px]" title={item.categoria_nome}>
                        {item.categoria_nome}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 text-[9px] font-extrabold rounded uppercase tracking-wider ${
                        item.tipo === 'RECEBER' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                        item.tipo === 'MOVIMENTO' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {item.tipo}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button 
                        onClick={() => toggleExpand(rowId)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                          isExpanded 
                            ? 'bg-slate-100 border-slate-300 text-slate-800' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>Detalhes</span>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-slate-50/80 border-b border-slate-200 shadow-inner">
                      <td colSpan={9} className="p-0">
                        <div className="px-8 py-5 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
                          
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                                <Calendar size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Histórico de Datas</span>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-slate-500 block text-[10px]">Emissão</span>
                                  <strong className="text-slate-800">{formatDateBR(item.data_emissao)}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">Registro (Omie)</span>
                                  <strong className="text-slate-800">{formatDateBR(item.data_registro)}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">Vencimento Original</span>
                                  <strong className="text-rose-600">{formatDateBR(item.data_vencimento)}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">Pagamento Real</span>
                                  <strong className="text-emerald-600">{formatDateBR(item.data_pagamento)}</strong>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                                <Tags size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Classificação Financeira</span>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-2">
                                <div className="flex justify-between items-start">
                                  <span className="text-slate-500">Categoria</span>
                                  <span className="font-semibold text-right text-slate-800 w-2/3">{item.categoria_nome} ({item.categoria_codigo})</span>
                                </div>
                                <div className="flex justify-between items-start pt-2 border-t border-slate-100">
                                  <span className="text-slate-500">Projeto</span>
                                  <span className="font-medium text-right line-clamp-1 w-2/3" title={item.projeto_nome}>{item.projeto_nome}</span>
                                </div>
                                <div className="flex justify-between items-start pt-2 border-t border-slate-100">
                                  <span className="text-slate-500">Departamento / Rateio</span>
                                  <span className="font-semibold text-right text-blue-700 w-2/3">{item.departamento_nome}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex flex-col gap-4">
                              <div>
                                <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                                  <Fingerprint size={14} />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Metadados Omie</span>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-600 flex flex-col gap-1.5">
                                  <div className="flex justify-between">
                                    <span>Código Omie:</span>
                                    <span className="font-bold">{item.omie_id}</span>
                                  </div>
                                  {item.numero_documento && (
                                    <div className="flex justify-between pt-1 border-t border-slate-100">
                                      <span>Nº Documento:</span>
                                      <span className="font-bold">{item.numero_documento}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                                  <FileText size={14} />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Observações / Detalhes</span>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-600 min-h-[60px]">
                                  {item.observacao || <span className="italic text-slate-400">Sem observações registradas no Omie.</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {lancamentos.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-slate-400 italic">
                  Nenhum lançamento detalhado encontrado para os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
