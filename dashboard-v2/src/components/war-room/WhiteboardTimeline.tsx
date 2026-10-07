"use client";

import React, { useState } from 'react';
import { WhiteboardTimelineBlock } from '@/types/war-room';
import { Check, Plus, Trash2, Edit3, X } from 'lucide-react';

interface WhiteboardTimelineProps {
  cronograma: WhiteboardTimelineBlock[];
  onToggleItem: (blockId: string, itemId: string) => void;
  onAddItem: (blockId: string, dia: number, descricao: string) => void;
  onEditItem: (blockId: string, itemId: string, dia: number, descricao: string) => void;
  onDeleteItem: (blockId: string, itemId: string) => void;
}

export function WhiteboardTimeline({
  cronograma,
  onToggleItem,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: WhiteboardTimelineProps) {
  // Dia atual do mês (ex: 7)
  const todayDay = new Date().getDate();

  // Estados de criação
  const [activeInputBlockId, setActiveInputBlockId] = useState<string | null>(null);
  const [inputDia, setInputDia] = useState<number>(todayDay);
  const [inputDesc, setInputDesc] = useState<string>('');

  // Estados de edição inline
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDia, setEditDia] = useState<number>(todayDay);
  const [editDesc, setEditDesc] = useState<string>('');

  const handleCreate = (block: WhiteboardTimelineBlock) => {
    if (!inputDesc.trim()) {
      setActiveInputBlockId(null);
      return;
    }
    const diaValido = inputDia >= 1 && inputDia <= 31 ? inputDia : block.diaInicio;
    onAddItem(block.id, diaValido, inputDesc.trim());
    setInputDesc('');
    setActiveInputBlockId(null);
  };

  const handleStartEdit = (item: { id: string; dia: number; descricao: string }) => {
    setEditingItemId(item.id);
    setEditDia(item.dia);

    // Extrai o texto limpo sem o prefixo numérico para facilitar edição
    const match = item.descricao.match(/^(\d{1,2})\s*[-–—:]?\s*(.*)$/);
    setEditDesc(match && match[2] ? match[2] : item.descricao);
  };

  const handleSaveEdit = (blockId: string, itemId: string) => {
    if (!editDesc.trim()) {
      setEditingItemId(null);
      return;
    }
    onEditItem(blockId, itemId, editDia, editDesc.trim());
    setEditingItemId(null);
  };

  return (
    <section className="w-full">
      {/* ── TÍTULO DA SEÇÃO CRONOGRAMA ── */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
          <h2 className="text-xs sm:text-sm font-black tracking-wider text-slate-200 uppercase font-mono">
            CRONOGRAMA DE VENCIMENTOS DO MÊS (6 BLOCOS DA LOUSA)
          </h2>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">
          Ordenação cronológica automática por dia • Clique no lápis para editar
        </span>
      </div>

      {/* ── GRID DOS 6 BLOCOS DA LOUSA ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cronograma.map((block) => {
          const isCurrentBlock = todayDay >= block.diaInicio && todayDay <= block.diaFim;
          const totalItens = block.itens.length;
          const concluidos = block.itens.filter(i => i.concluido).length;

          // Garantir ordenação estrita crescente por dia
          const sortedItens = block.itens.slice().sort((a, b) => a.dia - b.dia);

          return (
            <div
              key={block.id}
              className={`flex flex-col rounded-xl p-3 border transition-all relative ${
                isCurrentBlock
                  ? 'bg-[#0f172a] border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                  : 'bg-[#0b1120]/90 border-slate-800/80 hover:border-slate-700/80'
              }`}
            >
              {/* INDICADOR SE É O BLOCO DE HOJE */}
              {isCurrentBlock && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                  <span>BLOCO DE HOJE</span>
                </div>
              )}

              {/* CABEÇALHO DO BLOCO */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 pt-1">
                <span
                  className={`font-mono text-xs sm:text-sm font-black tracking-wide ${
                    isCurrentBlock ? 'text-cyan-400' : 'text-slate-300'
                  }`}
                >
                  {block.intervalo}
                </span>

                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                  {concluidos}/{totalItens}
                </span>
              </div>

              {/* LISTA DE VENCIMENTOS DO BLOCO */}
              <div className="flex-1 space-y-1.5 min-h-[120px]">
                {sortedItens.map(item => {
                  const isEditingThis = editingItemId === item.id;

                  if (isEditingThis) {
                    return (
                      <form
                        key={item.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveEdit(block.id, item.id);
                        }}
                        className="p-1.5 rounded-lg bg-slate-950 border border-cyan-500/70 space-y-1.5 shadow-md"
                      >
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={editDia}
                            onChange={(e) => setEditDia(Number(e.target.value))}
                            className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-cyan-300 font-bold text-center focus:outline-none focus:border-cyan-400"
                            title="Dia do vencimento"
                          />
                          <input
                            type="text"
                            autoFocus
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-cyan-400 uppercase"
                            placeholder="Obrigação..."
                          />
                        </div>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className="p-1 rounded text-slate-400 hover:text-white"
                            title="Cancelar edição"
                          >
                            <X size={12} />
                          </button>
                          <button
                            type="submit"
                            className="px-2 py-0.5 rounded bg-cyan-600 text-white text-[10px] font-bold"
                            title="Salvar alterações"
                          >
                            Salvar
                          </button>
                        </div>
                      </form>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      onClick={() => onToggleItem(block.id, item.id)}
                      className={`group/item flex items-start justify-between gap-1.5 p-1.5 rounded-lg border cursor-pointer transition-all ${
                        item.concluido
                          ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                          : isCurrentBlock
                          ? 'bg-cyan-950/20 border-cyan-900/40 hover:border-cyan-500/40'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-1.5 min-w-0">
                        {/* CHECKBOX */}
                        <div
                          className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                            item.concluido
                              ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                              : 'border-slate-600 bg-slate-950'
                          }`}
                        >
                          {item.concluido && <Check size={10} strokeWidth={3} className="text-white" />}
                        </div>

                        {/* DESCRIÇÃO DA LOUSA (SEMPRE COM O DIA FORMATADO: EX: 25 - MANUS) */}
                        <span
                          className={`text-xs font-semibold leading-tight tracking-tight ${
                            item.concluido
                              ? 'line-through text-slate-500'
                              : isCurrentBlock
                              ? 'text-cyan-200'
                              : 'text-slate-200'
                          }`}
                        >
                          {item.descricao}
                        </span>
                      </div>

                      {/* AÇÕES (EDITAR E EXCLUIR) */}
                      <div className="flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0">
                        {/* EDITAR */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(item);
                          }}
                          title="Editar dia ou obrigação"
                          className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
                        >
                          <Edit3 size={11} />
                        </button>

                        {/* EXCLUIR */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteItem(block.id, item.id);
                          }}
                          title="Excluir item"
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {sortedItens.length === 0 && (
                  <div className="text-center py-5 text-slate-500 text-[11px]">
                    Sem vencimentos
                  </div>
                )}
              </div>

              {/* INPUT RÁPIDO PARA ADICIONAR NOVO ITEM */}
              <div className="mt-2 pt-2 border-t border-slate-800/60">
                {activeInputBlockId === block.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleCreate(block);
                    }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="Dia"
                        value={inputDia}
                        onChange={(e) => setInputDia(Number(e.target.value))}
                        className="w-12 bg-slate-950 border border-cyan-500/50 rounded px-1.5 py-0.5 text-xs text-white text-center focus:outline-none focus:border-cyan-400"
                        title="Dia do vencimento"
                      />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Ex: MANUS ou CLARA..."
                        value={inputDesc}
                        onChange={(e) => setInputDesc(e.target.value)}
                        className="w-full bg-slate-950 border border-cyan-500/50 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-cyan-400 uppercase"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Data prefixada automaticamente</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveInputBlockId(null)}
                          className="px-2 py-0.5 text-slate-400 hover:text-white"
                        >
                          Canc
                        </button>
                        <button
                          type="submit"
                          className="px-2 py-0.5 rounded bg-cyan-600 text-white font-bold hover:bg-cyan-500"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveInputBlockId(block.id);
                      setInputDia(block.diaInicio);
                      setInputDesc('');
                    }}
                    className="w-full flex items-center justify-center gap-1 py-1 rounded text-[11px] font-semibold text-slate-400 hover:text-cyan-300 hover:bg-slate-800/40 transition-all border border-dashed border-slate-800"
                  >
                    <Plus size={11} />
                    <span>Adicionar</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
