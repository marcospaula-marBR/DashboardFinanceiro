"use client";

import React, { useState } from 'react';
import { WhiteboardTimelineBlock, WhiteboardTimelineItem } from '@/types/war-room';
import { extractResponsaveisList } from '@/services/war-room.service';
import { Check, Plus, Trash2, Edit3, X, GripVertical, RotateCcw, CalendarSync, AlertTriangle, User } from 'lucide-react';

interface WhiteboardTimelineProps {
  cronograma: WhiteboardTimelineBlock[];
  mesReferencia?: string;
  filterResponsible?: string | null;
  onlyOverdue?: boolean;
  onToggleItem: (blockId: string, itemId: string) => void;
  onAddItem: (blockId: string, dia: number, descricao: string, responsavel?: string, responsaveis?: string[]) => void;
  onEditItem: (blockId: string, itemId: string, dia: number, descricao: string, responsavel?: string, novosResponsaveis?: string[]) => void;
  onDeleteItem: (blockId: string, itemId: string) => void;
  onReorderItem?: (blockId: string, startIndex: number, endIndex: number) => void;
  onMoveItemBetweenBlocks?: (sourceBlockId: string, targetBlockId: string, itemId: string, targetIndex?: number) => void;
  onResetCycle?: () => void;
}

export function WhiteboardTimeline({
  cronograma,
  mesReferencia,
  filterResponsible,
  onlyOverdue,
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
  const [inputResp, setInputResp] = useState<string>('');

  // Estados de edição inline
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDia, setEditDia] = useState<number>(todayDay);
  const [editDesc, setEditDesc] = useState<string>('');
  const [editResp, setEditResp] = useState<string>('');

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
    const resps = extractResponsaveisList(inputResp);
    onAddItem(block.id, diaValido, inputDesc.trim(), resps.join(', ') || undefined, resps);
    setInputDesc('');
    setInputResp('');
    setActiveInputBlockId(null);
  };

  const handleStartEdit = (item: WhiteboardTimelineItem) => {
    setEditingItemId(item.id);
    setEditDia(item.dia);
    setEditDesc(item.descricao);
    const resps = extractResponsaveisList(item);
    setEditResp(resps.join(', '));
  };

  const handleSaveEdit = (blockId: string, itemId: string) => {
    if (!editDesc.trim()) {
      setEditingItemId(null);
      return;
    }
    const diaValido = editDia >= 1 && editDia <= 31 ? editDia : 1;
    const resps = extractResponsaveisList(editResp);
    onEditItem(blockId, itemId, diaValido, editDesc.trim(), resps.join(', ') || undefined, resps);
    setEditingItemId(null);
  };

  // ── HANDLERS DE DRAG & DROP NATIVO ──
  const handleDragStart = (e: React.DragEvent, blockId: string, itemId: string, index: number) => {
    setDraggedItem({ blockId, itemId, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ blockId, itemId, index }));
  };

  const handleDragOverBlock = (e: React.DragEvent, blockId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverBlockId !== blockId) {
      setDragOverBlockId(blockId);
    }
  };

  const handleDragOverItem = (e: React.DragEvent, blockId: string, itemIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBlockId(blockId);
    setDragOverItemIndex({ blockId, index: itemIndex });
  };

  const handleDrop = (e: React.DragEvent, targetBlockId: string, targetIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) {
      setDragOverBlockId(null);
      setDragOverItemIndex(null);
      return;
    }

    const { blockId: sourceBlockId, itemId, index: sourceIndex } = draggedItem;

    if (sourceBlockId === targetBlockId) {
      // Reordenação dentro do mesmo bloco
      if (targetIndex !== undefined && targetIndex !== sourceIndex && onReorderItem) {
        onReorderItem(targetBlockId, sourceIndex, targetIndex);
      }
    } else {
      // Movimentação entre blocos diferentes
      if (onMoveItemBetweenBlocks) {
        onMoveItemBetweenBlocks(sourceBlockId, targetBlockId, itemId, targetIndex);
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
    <section className="w-full bg-[#070c18]/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative">
      {/* DATALIST DE SUGESTÃO DE RESPONSÁVEIS */}
      <datalist id="responsavel-suggestions">
        <option value="MANUS" />
        <option value="CLARA" />
        <option value="MARCO" />
        <option value="DAUREN" />
        <option value="PRISCILLA" />
        <option value="ALDO" />
        <option value="ADRIANA" />
        <option value="FINANCEIRO" />
        <option value="JURÍDICO" />
        <option value="CONTÁBIL" />
        <option value="TI" />
      </datalist>

      {/* ── CABEÇALHO DO CRONOGRAMA ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white font-mono flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              CRONOGRAMA DE VENCIMENTOS DO MÊS
            </h2>

            {/* BADGE DE CICLO MENSAL */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
              <CalendarSync size={11} className="text-cyan-400" />
              Ciclo: {currentMonthName}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Régua temporal contínua dividida nos 6 blocos operacionais • Responsáveis destacados • Alerta de atrasos
          </p>
        </div>

        {/* CONTROLES DO CICLO E DRAG & DROP */}
        <div className="flex items-center gap-2">
          {onResetCycle && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Deseja desmarcar todos os checks do mês para iniciar um novo ciclo de pagamentos recorrentes? As obrigações e responsáveis permanecerão salvos.')) {
                  onResetCycle();
                }
              }}
              title="Desmarcar todos os checks para o novo ciclo mensal"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white text-[11px] font-bold transition-all shadow-sm"
            >
              <RotateCcw size={11} className="text-cyan-400" />
              <span>Renovar Ciclo Mensal</span>
            </button>
          )}
        </div>
      </div>

      {/* ── GRID DOS 6 BLOCOS DA LOUSA COM SUPORTE A DRAG & DROP ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cronograma.map((block) => {
          const isCurrentBlock = todayDay >= block.diaInicio && todayDay <= block.diaFim;
          const isTargetBlock = dragOverBlockId === block.id;

          // Se estiver arrastando, preserva a ordem visual com reorder temporário se houver
          let sortedItens = block.itens.slice().sort((a, b) => a.dia - b.dia);

          // Filtragem por responsável se houver
          if (filterResponsible) {
            sortedItens = sortedItens.filter(it =>
              extractResponsaveisList(it).includes(filterResponsible.toUpperCase())
            );
          }

          // Filtragem por apenas atrasadas
          if (onlyOverdue) {
            sortedItens = sortedItens.filter(it => !it.concluido && it.dia < todayDay);
          }

          const totalItens = block.itens.length;
          const concluidos = block.itens.filter(i => i.concluido).length;
          const atrasadosNoBloco = block.itens.filter(i => !i.concluido && i.dia < todayDay).length;

          return (
            <div
              key={block.id}
              onDragOver={(e) => handleDragOverBlock(e, block.id)}
              onDrop={(e) => handleDrop(e, block.id)}
              className={`flex flex-col rounded-xl p-3 border transition-all relative ${
                isTargetBlock
                  ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400 shadow-xl'
                  : atrasadosNoBloco > 0
                  ? 'bg-[#0f1424] border-rose-500/40 hover:border-rose-500/70'
                  : isCurrentBlock
                  ? 'bg-[#0f172a] border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                  : 'bg-[#0b1120]/90 border-slate-800/80 hover:border-slate-700/80'
              }`}
            >
              {/* INDICADOR SE É O BLOCO DE HOJE OU SE TEM ATRASO */}
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

                <div className="flex items-center gap-1 font-mono text-[10px]">
                  {atrasadosNoBloco > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-600/30 border border-rose-500/50 text-rose-300 font-bold animate-pulse">
                      {atrasadosNoBloco} atr
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                    {concluidos}/{totalItens}
                  </span>
                </div>
              </div>

              {/* LISTA DE VENCIMENTOS DO BLOCO COM ARRASTAR E SOLTAR */}
              <div className="flex-1 space-y-1.5 min-h-[120px]">
                {sortedItens.map((item, index) => {
                  const isEditingThis = editingItemId === item.id;
                  const isDraggingThis = draggedItem?.itemId === item.id;
                  const isDragOverThis =
                    dragOverItemIndex?.blockId === block.id && dragOverItemIndex?.index === index;
                  const isOverdue = !item.concluido && item.dia < todayDay;

                  if (isEditingThis) {
                    return (
                      <form
                        key={item.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveEdit(block.id, item.id);
                        }}
                        className="p-2 rounded-lg bg-slate-950 border border-cyan-500/70 space-y-1.5 shadow-md"
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
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-cyan-400 uppercase font-mono"
                            placeholder="Obrigação..."
                          />
                        </div>

                        {/* SELETOR/INPUT DE RESPONSÁVEL */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-cyan-400 font-bold">👤</span>
                          <input
                            type="text"
                            list="responsavel-suggestions"
                            value={editResp}
                            onChange={(e) => setEditResp(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-cyan-300 focus:outline-none focus:border-cyan-400 uppercase font-mono"
                            placeholder="Responsáveis (ex: MANUS, CLARA)..."
                          />
                        </div>

                        <div className="flex justify-end gap-1 pt-1">
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
                            className="px-2 py-0.5 rounded bg-cyan-600 text-white text-[10px] font-bold hover:bg-cyan-500"
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
                          : isOverdue
                          ? 'bg-rose-950/30 border-rose-500/70 ring-1 ring-rose-500/40 shadow-sm shadow-rose-950/40'
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
                              : isOverdue
                              ? 'border-rose-400 bg-slate-950'
                              : 'border-slate-600 bg-slate-950'
                          }`}
                        >
                          {item.concluido && <Check size={10} strokeWidth={3} className="text-white" />}
                        </div>

                        {/* CONTEÚDO DA TAREFA: RESPONSÁVEL EM DESTAQUE NA FRENTE + DESCRIÇÃO */}
                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-1 leading-tight">
                            {/* BADGES DOS MÚLTIPLOS RESPONSÁVEIS DESTACADOS NA FRENTE */}
                            {extractResponsaveisList(item).map((resp) => (
                              <span
                                key={resp}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-cyan-950 border border-cyan-500/60 text-cyan-300 shadow-sm flex-shrink-0"
                                title={`Responsável: ${resp}`}
                              >
                                <User size={9} className="text-cyan-400" />
                                {resp}
                              </span>
                            ))}

                            {/* SINALIZADOR PULSANTE DE ATRASO */}
                            {isOverdue && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse shadow-sm flex-shrink-0"
                                title={`Atrasado! Vencimento era dia ${item.dia}`}
                              >
                                <AlertTriangle size={8} /> ATRASADO
                              </span>
                            )}

                            {/* DESCRIÇÃO COM O DIA FORMATADO */}
                            <span
                              className={`text-xs font-semibold leading-tight tracking-tight ${
                                item.concluido
                                  ? 'line-through text-slate-500'
                                  : isOverdue
                                  ? 'text-rose-200 font-bold'
                                  : isCurrentBlock
                                  ? 'text-cyan-200'
                                  : 'text-slate-200'
                              }`}
                            >
                              {item.descricao}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* AÇÕES (EDITAR E EXCLUIR) */}
                      <div className="flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(item);
                          }}
                          title="Editar dia, obrigação ou responsável"
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
                        className="w-12 bg-slate-950 border border-cyan-500/50 rounded px-1.5 py-0.5 text-xs text-white text-center focus:outline-none focus:border-cyan-400 font-bold"
                        title="Dia do vencimento"
                      />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Obrigação (ex: MANUS, CLARA)..."
                        value={inputDesc}
                        onChange={(e) => setInputDesc(e.target.value)}
                        className="w-full bg-slate-950 border border-cyan-500/50 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-cyan-400 uppercase font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        list="responsavel-suggestions"
                        placeholder="Responsáveis (ex: MANUS, CLARA)..."
                        value={inputResp}
                        onChange={(e) => setInputResp(e.target.value)}
                        className="w-full bg-slate-950 border border-cyan-500/50 rounded px-1.5 py-0.5 text-[11px] text-cyan-300 focus:outline-none focus:border-cyan-400 uppercase font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>Data prefixada auto</span>
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
                      setInputResp('');
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
