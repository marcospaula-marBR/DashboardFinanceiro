"use client";

import React, { useState } from 'react';
import {
  X,
  Search,
  Download,
  Calendar,
  CreditCard,
  Building2,
  Tag,
  Layers
} from 'lucide-react';
import { DreCaixaLancamento } from '@/types/dre-caixa';
import { formatCurrencyBRL } from '@/services/dre-caixa.service';

interface DreCaixaDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  lancamentos: DreCaixaLancamento[];
}

export function DreCaixaDrilldownModal({
  isOpen,
  onClose,
  categoryName,
  lancamentos
}: DreCaixaDrilldownModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  // Filtrar lançamentos da categoria selecionada
  const categoryItems = lancamentos.filter(l =>
    categoryName ? l.categoria.toLowerCase() === categoryName.toLowerCase() : true
  );

  const filteredItems = categoryItems.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.fornecedor_cliente.toLowerCase().includes(term) ||
      item.projeto.toLowerCase().includes(term) ||
      item.conta_corrente.toLowerCase().includes(term) ||
      (item.numero_documento && item.numero_documento.toLowerCase().includes(term))
    );
  });

  const totalFiltered = filteredItems.reduce((acc, curr) => acc + curr.valor, 0);

  const handleExport = () => {
    const headers = ['Data Pagamento', 'Empresa', 'Setor (Projeto)', 'Categoria', 'Fornecedor/Cliente', 'Conta Corrente', 'Documento', 'Tipo', 'Valor (R$)'];
    const rows = filteredItems.map(item => [
      item.data_pagamento,
      item.empresa,
      `"${item.projeto}"`,
      `"${item.categoria}"`,
      `"${item.fornecedor_cliente}"`,
      `"${item.conta_corrente}"`,
      item.numero_documento || '',
      item.tipo,
      item.valor.toFixed(2)
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `lancamentos_caixa_${categoryName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
        
        {/* Header do Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Auditoria Analítica
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {filteredItems.length} lançamento{filteredItems.length !== 1 ? 's' : ''}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1 tracking-tight">
              {categoryName || 'Todos os Lançamentos do Caixa'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors shadow-sm"
              title="Exportar estes lançamentos em CSV"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Filtro Local & Resumo */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por fornecedor, projeto, banco ou documento..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <div className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 self-end sm:self-auto flex items-center gap-2 shadow-sm">
            <span>Total dos itens visíveis:</span>
            <strong className="text-slate-900 font-black text-sm">{formatCurrencyBRL(totalFiltered)}</strong>
          </div>
        </div>

        {/* Tabela de Lançamentos com scroll */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Nenhum lançamento encontrado para os critérios informados.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px] z-10">
                <tr>
                  <th className="py-2.5 px-3">Data Pgto</th>
                  <th className="py-2.5 px-3">Empresa</th>
                  <th className="py-2.5 px-3">Setor (Projeto)</th>
                  <th className="py-2.5 px-3">Fornecedor / Cliente</th>
                  <th className="py-2.5 px-3">Conta Bancária</th>
                  <th className="py-2.5 px-3">Documento</th>
                  <th className="py-2.5 px-3 text-right">Valor Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 text-slate-700 transition-colors">
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {item.data_pagamento}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                        {item.empresa}
                      </span>
                    </td>
                    <td className="py-2 px-3 truncate max-w-[160px]" title={item.projeto}>
                      {item.projeto}
                    </td>
                    <td className="py-2 px-3 truncate max-w-[200px] font-bold text-slate-800" title={item.fornecedor_cliente}>
                      {item.fornecedor_cliente}
                    </td>
                    <td className="py-2 px-3 truncate max-w-[140px] text-slate-500" title={item.conta_corrente}>
                      {item.conta_corrente}
                    </td>
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-500">
                      {item.numero_documento || '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                      <span className={item.tipo === 'RECEBER' ? 'text-emerald-700' : 'text-rose-600'}>
                        {item.tipo === 'RECEBER' ? '+' : '-'} {formatCurrencyBRL(item.valor)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Exibindo <strong>{filteredItems.length}</strong> de <strong>{categoryItems.length}</strong> lançamentos
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition-colors shadow-sm"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
