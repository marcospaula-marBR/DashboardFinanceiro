"use client";

import React, { useState } from 'react';
import { WhiteboardTimelineBlock } from '@/types/war-room';
import { Check, Plus, Trash2, Edit3, X, GripVertical, RotateCcw, CalendarSync } from 'lucide-react';

interface WhiteboardTimelineProps {
  cronograma: WhiteboardTimelineBlock[];
  mesReferencia?: string;
  onToggleItem: (blockId: string, itemId: string) => void;
  onAddItem: (blockId: string, dia: number, descricao: string) => void;
  onEditItem: (blockId: string, itemId: string, dia: number, descricao: string) => void;
  onDeleteItem: (blockId: string, itemId: string) => void;
  onReorderItem?: (blockId: string, startIndex: number, endIndex: number) => void;
  onMoveItemBetweenBlocks?: (sourceBlockId: string, targetBlockId: string, itemId: string, targetIndex?: number) => void;
  onResetCycle?: () => void;
}

export function WhiteboardTimeline({
  cronograma,
  mesReferencia,
  onToggleItem,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onReorderItem,
  onMoveItemBetweenBlocks,
  onResetCycle,
}: WhiteboardTimelineProps) {
  const today = new Date();
  const todayDay = today.getDate();
  const currentMonthName = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Estados de criação
  const [activeInputBlockId, setActiveInputBlockId] = useState<string | null>(null);
  const [inputDia, setInputDia] = useState<number>(todayDay);
  const [inputDesc, setInputDesc] = useState<string>('');

  // Estados de edição inline
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDia, setEditDia] = useState<number>(todayDay);
  const [editDesc, setEditDesc] = useState<string>('');

  // Estados de Drag & Drop
  const [draggedItem, setDraggedItem] = useState<{ blockId: string; itemId: string; index: number } | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<{ blockId: string; index: number } | null>(null);

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

  // ── DRAG & DROP HANDLERS ──
  const handleDragStart = (e: React.DragEvent, blockId: string, itemId: string, index: number) => {
    setDraggedItem({ blockId, itemId, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ blockId, itemId, index }));
  };

  const handleDragOverItem = (e: React.DragEvent, blockId: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBlockId(blockId);
    setDragOverItemIndex({ blockId, index });
  };

  const handleDragOverBlock = (e: React.DragEvent, blockId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBlockId(blockId);
  };

  const handleDrop = (e: React.DragEvent, targetBlockId: string, targetIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) return;

    if (draggedItem.blockId === targetBlockId) {
      // Reordenação dentro do mesmo bloco
      if (onReorderItem && targetIndex !== undefined && targetIndex !== draggedItem.index) {
        onReorderItem(targetBlockId, draggedItem.index, targetIndex);
      }
    } else {
      // Movimentação entre blocos diferentes
      if (onMoveItemBetweenBlocks) {
        onMoveItemBetweenBlocks(draggedItem.blockId, targetBlockId, draggedItem.itemId, targetIndex);
      }
    }

    setDraggedItem(null);
    setDragOverBlockId(null);
    setDragOverItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverBlockId(null);
    setDragOverItemIndex(null);
  };

  return (
    <section className="w-full">
      {/* ── TÍTULO DA SEÇÃO CRONOGRAMA & STATUS DE RENOVAÇÃO AUTOMÁTICA ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
          <h2 className="text-xs sm:text-sm font-black tracking-wider text-slate-200 uppercase font-mono">
            CRONOGRAMA DE VENCIMENTOS DO MÊS (6 BLOCOS DA LOUSA)
          </h2>
        </div>

        {/* CONTROLE DE CICLO MENSAL RECORRENTE */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-[11px] font-mono font-bold shadow-sm">
            <CalendarSync size={13} className="text-cyan-400" />
            <span className="capitalize">{currentMonthName}</span>
            <span className="text-cyan-500 font-normal">| Auto-renovação ativa</span>
          </div>

          {onResetCycle && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Deseja desmarcar todos os checks do mês para iniciar um novo ciclo de pagamentos recorrentes?')) {
                  onResetCycle();
                }
              }}
              title="Desmarcar todos os checks para o novo ciclo mensal"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-400 hover:text-white text-[11px] font-semibold transition-all"
            >
              <RotateCcw size={11} />
              <span className="hidden md:inline">Resetar Mês</span>
            </button>
          )}
        </div>
      </div>

      {/* ── GRID DOS 6 BLOCOS DA LOUSA COM SUPORTE A DRAG & DROP ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cronograma.map((block) => {
          const isCurrentBlock = todayDay >= block.diaInicio && todayDay <= block.diaFim;
          const totalItens = block.itens.length;
          const concluidos = block.itens.filter(i => i.concluido).length;
          const isTargetBlock = dragOverBlockId === block.id;

          // Se estiver arrastando, preserva a ordem visual com reorder temporário se houver
          const sortedItens = block.itens.slice().sort((a, b) => a.dia - b.dia);

          return (
            <div
              key={block.id}
              onDragOver={(e) => handleDragOverBlock(e, block.id)}
              onDrop={(e) => handleDrop(e, block.id)}
              className={`flex flex-col rounded-xl p-3 border transition-all relative ${
                isTargetBlock
                  ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400 shadow-xl'
                  : isCurrentBlock
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

              {/* LISTA DE VENCIMENTOS DO BLOCO COM ARRASTAR E SOLTAR */}
              <div className="flex-1 space-y-1.5 min-h-[120px]">
                {sortedItens.map((item, index) => {
                  const isEditingThis = editingItemId === item.id;
                  const isDraggingThis = draggedItem?.itemId === item.id;
                  const isDragOverThis =
                    dragOverItemIndex?.blockId === block.id && dragOverItemIndex?.index === index;

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
                      draggable={!editingItemId}
                      onDragStart={(e) => handleDragStart(e, block.id, item.id, index)}
                      onDragOver={(e) => handleDragOverItem(e, block.id, index)}
                      onDrop={(e) => handleDrop(e, block.id, index)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onToggleItem(block.id, item.id)}
                      className={`group/item flex items-start justify-between gap-1 p-1.5 rounded-lg border cursor-pointer transition-all ${
                        isDraggingThis
                          ? 'opacity-30 scale-95 border-dashed border-cyan-500'
                          : isDragOverThis
                          ? 'border-t-2 border-t-cyan-400 bg-cyan-950/30'
                          : item.concluido
                          ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                          : isCurrentBlock
                          ? 'bg-cyan-950/20 border-cyan-900/40 hover:border-cyan-500/40'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-1 min-w-0">
                        {/* ALÇA DE ARRASTAR (GRIP) */}
                        <div
                          className="mt-0.5 text-slate-600 group-hover/item:text-slate-400 cursor-grab active:cursor-grabbing p-0.5"
                          title="Arraste para reposicionar ou mover entre blocos"
                        >
                          <GripVertical size={11} />
                        </div>

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
