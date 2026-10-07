"use client";

import React, { useState } from 'react';
import { FollowTheMoneyState, FollowTheMoneyRow } from '@/types/war-room';
import { Plus, Trash2, Edit3, ArrowRight, DollarSign, TrendingUp, Check, X } from 'lucide-react';

interface WhiteboardFollowTheMoneyProps {
  followTheMoney: FollowTheMoneyState;
  onUpdateQuote: (novaCotacao: string) => void;
  onAddRow: (row: Omit<FollowTheMoneyRow, 'id'>) => void;
  onUpdateRow: (row: FollowTheMoneyRow) => void;
  onDeleteRow: (id: string) => void;
}

export function WhiteboardFollowTheMoney({
  followTheMoney,
  onUpdateQuote,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
}: WhiteboardFollowTheMoneyProps) {
  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [quoteInput, setQuoteInput] = useState(followTheMoney.cotacaoUsdGs);
  const [isAddingRow, setIsAddingRow] = useState(false);

  // Estados de edição de linha
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editRowForm, setEditRowForm] = useState<FollowTheMoneyRow | null>(null);

  // Formulário de nova linha
  const [formData, setFormData] = useState({
    data: '',
    de: '',
    para: '',
    formato: 'MOEDA',
    moeda: 'USD',
    valor: '',
    diferenca: '—',
    percentual: '—',
    observacao: '',
  });

  const handleSaveQuote = () => {
    if (quoteInput.trim()) {
      onUpdateQuote(quoteInput.trim());
    }
    setIsEditingQuote(false);
  };

  const handleSaveRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.de || !formData.para) return;

    onAddRow({
      data: formData.data || '—',
      de: formData.de.toUpperCase(),
      para: formData.para.toUpperCase(),
      formato: formData.formato.toUpperCase(),
      moeda: formData.moeda.toUpperCase(),
      valor: formData.valor || '—',
      diferenca: formData.diferenca || '—',
      percentual: formData.percentual || '—',
      observacao: formData.observacao || '',
    });

    setFormData({
      data: '',
      de: '',
      para: '',
      formato: 'MOEDA',
      moeda: 'USD',
      valor: '',
      diferenca: '—',
      percentual: '—',
      observacao: '',
    });
    setIsAddingRow(false);
  };

  const handleStartEditRow = (row: FollowTheMoneyRow) => {
    setEditingRowId(row.id);
    setEditRowForm({ ...row });
  };

  const handleSaveEditRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRowForm) return;
    onUpdateRow(editRowForm);
    setEditingRowId(null);
    setEditRowForm(null);
  };

  return (
    <section className="w-full bg-[#0b1120]/90 border border-slate-800/80 rounded-xl p-4 shadow-md">
      {/* ── CABEÇALHO DO FOLLOW THE MONEY (ESTILO LOUSA) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-6 bg-emerald-500 rounded-sm" />
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wider text-emerald-400 uppercase font-mono drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
              FOLLOW THE MONEY
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Esteira de Liquidação Internacional: MarBR → DLocal → Ueno (Paraguai)
            </p>
          </div>
        </div>

        {/* COTAÇÃO USD = G$ (DESTAQUE DA LOUSA) */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 shadow-sm">
            <span className="text-[11px] font-mono font-bold text-slate-300">
              COTAÇÃO USD = G$:
            </span>

            {isEditingQuote ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={quoteInput}
                  onChange={(e) => setQuoteInput(e.target.value)}
                  className="w-16 bg-slate-900 border border-emerald-400 rounded px-1.5 py-0.5 text-xs text-white font-mono font-bold focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveQuote}
                  className="p-1 bg-emerald-600 rounded text-white hover:bg-emerald-500"
                >
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <span
                onClick={() => {
                  setQuoteInput(followTheMoney.cotacaoUsdGs);
                  setIsEditingQuote(true);
                }}
                title="Clique para editar a cotação"
                className="font-mono text-sm font-black text-emerald-400 cursor-pointer hover:underline flex items-center gap-1"
              >
                {followTheMoney.cotacaoUsdGs}
                <Edit3 size={11} className="text-emerald-500/70" />
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsAddingRow(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold transition-all"
          >
            <Plus size={13} />
            <span>Adicionar Etapa</span>
          </button>
        </div>
      </div>

      {/* ── FORMULÁRIO DE ADIÇÃO RÁPIDA DE ETAPA ── */}
      {isAddingRow && (
        <form onSubmit={handleSaveRow} className="mb-4 p-3 bg-slate-900/90 border border-emerald-500/30 rounded-lg">
          <div className="text-xs font-bold text-emerald-400 uppercase mb-2">
            Nova Etapa do Fluxo Financeiro
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <input
              type="text"
              placeholder="Data (ex: 23/09)"
              value={formData.data}
              onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="De (Origem)"
              required
              value={formData.de}
              onChange={(e) => setFormData({ ...formData, de: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
            />
            <input
              type="text"
              placeholder="Para (Destino)"
              required
              value={formData.para}
              onChange={(e) => setFormData({ ...formData, para: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
            />
            <input
              type="text"
              placeholder="Formato (CC/MOEDA)"
              value={formData.formato}
              onChange={(e) => setFormData({ ...formData, formato: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
            />
            <input
              type="text"
              placeholder="Moeda (USD/G$)"
              value={formData.moeda}
              onChange={(e) => setFormData({ ...formData, moeda: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
            />
            <input
              type="text"
              placeholder="Valor"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Diferença (≠)"
              value={formData.diferenca}
              onChange={(e) => setFormData({ ...formData, diferenca: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Taxa (%)"
              value={formData.percentual}
              onChange={(e) => setFormData({ ...formData, percentual: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setIsAddingRow(false)}
              className="px-3 py-1 rounded text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Salvar Etapa
            </button>
          </div>
        </form>
      )}

      {/* ── TABELA EXATA DA LOUSA COM SCROLL RESPONSIVO ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-mono font-black uppercase text-rose-400 bg-slate-950/40">
              <th className="py-2.5 px-3">DATA</th>
              <th className="py-2.5 px-3">DE</th>
              <th className="py-2.5 px-3">PARA</th>
              <th className="py-2.5 px-3 text-center">FORMATO</th>
              <th className="py-2.5 px-3 text-center">MOEDA</th>
              <th className="py-2.5 px-3 text-right">VALOR</th>
              <th className="py-2.5 px-3 text-center">≠</th>
              <th className="py-2.5 px-3 text-center">%</th>
              <th className="py-2.5 px-3 text-right">AÇÕES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
            {followTheMoney.linhas.map((row) => {
              const isEditingThis = editingRowId === row.id && editRowForm;

              if (isEditingThis) {
                return (
                  <tr key={row.id} className="bg-slate-900 border border-cyan-500/40">
                    <td className="py-2 px-1">
                      <input
                        type="text"
                        value={editRowForm.data}
                        onChange={(e) => setEditRowForm({ ...editRowForm, data: e.target.value })}
                        className="w-16 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs text-white"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <input
                        type="text"
                        value={editRowForm.de}
                        onChange={(e) => setEditRowForm({ ...editRowForm, de: e.target.value.toUpperCase() })}
                        className="w-20 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs text-cyan-300 font-bold uppercase"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <input
                        type="text"
                        value={editRowForm.para}
                        onChange={(e) => setEditRowForm({ ...editRowForm, para: e.target.value.toUpperCase() })}
                        className="w-28 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs text-white uppercase"
                      />
                    </td>
                    <td className="py-2 px-1 text-center">
                      <input
                        type="text"
                        value={editRowForm.formato}
                        onChange={(e) => setEditRowForm({ ...editRowForm, formato: e.target.value.toUpperCase() })}
                        className="w-14 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs text-white text-center uppercase"
                      />
                    </td>
                    <td className="py-2 px-1 text-center">
                      <input
                        type="text"
                        value={editRowForm.moeda}
                        onChange={(e) => setEditRowForm({ ...editRowForm, moeda: e.target.value.toUpperCase() })}
                        className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs text-emerald-300 text-center uppercase font-bold"
                      />
                    </td>
                    <td className="py-2 px-1 text-right">
                      <input
                        type="text"
                        value={editRowForm.valor}
                        onChange={(e) => setEditRowForm({ ...editRowForm, valor: e.target.value })}
                        className="w-20 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs text-white text-right font-bold"
                      />
                    </td>
                    <td className="py-2 px-1 text-center">
                      <input
                        type="text"
                        value={editRowForm.diferenca}
                        onChange={(e) => setEditRowForm({ ...editRowForm, diferenca: e.target.value })}
                        className="w-14 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs text-amber-300 text-center"
                      />
                    </td>
                    <td className="py-2 px-1 text-center">
                      <input
                        type="text"
                        value={editRowForm.percentual}
                        onChange={(e) => setEditRowForm({ ...editRowForm, percentual: e.target.value })}
                        className="w-14 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs text-rose-300 text-center"
                      />
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRowId(null);
                          setEditRowForm(null);
                        }}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Cancelar"
                      >
                        <X size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditRow}
                        className="p-1 bg-cyan-600 rounded text-white hover:bg-cyan-500 ml-1"
                        title="Salvar alterações"
                      >
                        <Check size={13} />
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={row.id}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  {/* DATA */}
                  <td className="py-2.5 px-3 text-slate-300 font-bold whitespace-nowrap">
                    {row.data}
                  </td>

                  {/* DE (ORIGEM) */}
                  <td className="py-2.5 px-3 text-cyan-300 font-black whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                      {row.de}
                    </span>
                  </td>

                  {/* PARA (DESTINO) */}
                  <td className="py-2.5 px-3 text-slate-200 font-black whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <ArrowRight size={12} className="text-slate-500" />
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200">
                        {row.para}
                      </span>
                    </div>
                  </td>

                  {/* FORMATO */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        row.formato === 'CC'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {row.formato}
                    </span>
                  </td>

                  {/* MOEDA */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                      {row.moeda}
                    </span>
                  </td>

                  {/* VALOR */}
                  <td className="py-2.5 px-3 text-right font-black text-white whitespace-nowrap text-sm">
                    {row.valor !== '—' ? `${row.moeda === 'USD' ? '$' : 'G$'} ${row.valor}` : '—'}
                  </td>

                  {/* DIFERENÇA (≠) */}
                  <td className="py-2.5 px-3 text-center font-bold text-amber-400 whitespace-nowrap">
                    {row.diferenca}
                  </td>

                  {/* PERCENTUAL (%) */}
                  <td className="py-2.5 px-3 text-center font-bold text-rose-400 whitespace-nowrap">
                    {row.percentual}
                  </td>

                  {/* AÇÕES */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleStartEditRow(row)}
                      title="Editar etapa"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-cyan-300 transition-opacity mr-1"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRow(row.id)}
                      title="Excluir etapa"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
