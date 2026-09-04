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
  Layers,
  ArrowUpDown
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header do Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Auditoria Analítica
              </span>
              <span className="text-xs text-slate-400">
                {filteredItems.length} lançamento{filteredItems.length !== 1 ? 's' : ''}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-1">
              {categoryName || 'Todos os Lançamentos do Caixa'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Exportar estes lançamentos em CSV"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Busca e Totalizador */}
        <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filtrar por parceiro, setor, documento ou banco..."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-slate-400">Total Auditado:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {formatCurrencyBRL(totalFiltered)}
            </span>
          </div>
        </div>

        {/* Tabela de Lançamentos */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-950 sticky top-0 z-10 text-[10px] uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Data Pagto</th>
                <th className="py-2.5 px-3">Empresa</th>
                <th className="py-2.5 px-3">Setor (Projeto)</th>
                <th className="py-2.5 px-3">Fornecedor / Cliente</th>
                <th className="py-2.5 px-3">Conta Bancária</th>
                <th className="py-2.5 px-3">Doc</th>
                <th className="py-2.5 px-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    Nenhum lançamento encontrado
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {item.data_pagamento.split('-').reverse().join('/')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-medium">
                      {item.empresa}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 truncate max-w-[150px]" title={item.projeto}>
                      {item.projeto}
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium truncate max-w-[200px]" title={item.fornecedor_cliente}>
                      {item.fornecedor_cliente}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-[150px]" title={item.conta_corrente}>
                      {item.conta_corrente}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {item.numero_documento || '—'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                      item.tipo === 'RECEBER' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {formatCurrencyBRL(item.valor)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
