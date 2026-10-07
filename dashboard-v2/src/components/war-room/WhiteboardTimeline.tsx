"use client";

import React, { useState } from 'react';
import { WhiteboardTimelineBlock, WhiteboardTimelineItem, WhiteboardItem } from '@/types/war-room';
import { extractResponsaveisList } from '@/services/war-room.service';
import { 
  Check, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  GripVertical, 
  RotateCcw, 
  CalendarSync, 
  AlertTriangle, 
  User,
  Rows,
  LayoutGrid,
  Zap
} from 'lucide-react';

export type TimelineLayoutMode = 'rows' | 'grid';

interface WhiteboardTimelineProps {
  cronograma: WhiteboardTimelineBlock[];
  mesReferencia?: string;
  filterResponsible?: string | null;
  onlyOverdue?: boolean;
  layoutMode?: TimelineLayoutMode;
  onLayoutModeChange?: (mode: TimelineLayoutMode) => void;
  hoveredDemand?: {
    colId: string;
    titulo: string;
    corMarcador?: string;
    itens: WhiteboardItem[];
  } | null;
  onToggleDemandItem?: (colId: string, itemId: string) => void;
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
  layoutMode: initialLayoutMode = 'rows',
  onLayoutModeChange,
  hoveredDemand,
  onToggleDemandItem,
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

  const [internalLayoutMode, setInternalLayoutMode] = useState<TimelineLayoutMode>(initialLayoutMode);
  const activeLayout = onLayoutModeChange ? initialLayoutMode : internalLayoutMode;

  const handleSetLayoutMode = (mode: TimelineLayoutMode) => {
    setInternalLayoutMode(mode);
    onLayoutModeChange?.(mode);
  };

  // Estados de criação inline
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
      if (targetIndex !== undefined && targetIndex !== sourceIndex && onReorderItem) {
        onReorderItem(targetBlockId, sourceIndex, targetIndex);
      }
    } else {
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

  // ── MAPEAR TAREFAS DA DEMANDA EM HOVER PARA CADA BLOCO DO CRONOGRAMA ──
  const getDemandTasksForBlock = (block: WhiteboardTimelineBlock) => {
    if (!hoveredDemand || !hoveredDemand.itens) return [];

    return hoveredDemand.itens.filter(item => {
      if (item.arquivado) return false;

      // 1. Tentar extrair dia de dataLimite (YYYY-MM-DD ou DD/MM)
      if (item.dataLimite) {
        let diaExtraido: number | null = null;
        if (item.dataLimite.includes('-')) {
          const parts = item.dataLimite.split('-');
          if (parts.length === 3) diaExtraido = parseInt(parts[2], 10);
        } else if (item.dataLimite.includes('/')) {
          const parts = item.dataLimite.split('/');
          diaExtraido = parseInt(parts[0], 10);
        }
        if (diaExtraido && !isNaN(diaExtraido)) {
          return diaExtraido >= block.diaInicio && diaExtraido <= block.diaFim;
        }
      }

      // 2. Tentar extrair número de dia do texto (ex: "dia 10", "10 - ...")
      const match = item.texto.match(/\b(0?[1-9]|[12][0-9]|3[01])\b/);
      if (match) {
        const d = parseInt(match[1], 10);
        if (d >= block.diaInicio && d <= block.diaFim) return true;
      }

      // 3. Fallback: Se for o bloco de hoje, exibe tarefas sem data explícita
      const isTodayBlock = todayDay >= block.diaInicio && todayDay <= block.diaFim;
      return isTodayBlock;
    });
  };

  return (
    <section className="w-full bg-[#070c18]/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xl relative">
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
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 mb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white font-mono flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>CRONOGRAMA DE VENCIMENTOS DO MÊS</span>
            </h2>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
              <CalendarSync size={11} className="text-cyan-400" />
              <span>Ciclo: {currentMonthName}</span>
            </span>

            {/* FEEDBACK SE UMA DEMANDA ESTIVER EM HOVER */}
            {hoveredDemand && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black font-mono animate-pulse">
                <Zap size={11} className="text-amber-400" />
                <span>Sincronizando: {hoveredDemand.titulo}</span>
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
            Régua temporal contínua • Linhas horizontais com esteira para TV • Sincronização automática com demandas
          </p>
        </div>

        {/* CONTROLES: ALTERNAR MODO LINHAS/GRADE E RENOVAR CICLO */}
        <div className="flex items-center flex-wrap gap-2">
          {/* SELETOR DE MODO: LINHAS (TV) / GRADE */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => handleSetLayoutMode('rows')}
              title="Modo Linhas: período fixo à esquerda e obrigações correndo na tela em esteira horizontal (ideal para TV sem rolagem)."
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                activeLayout === 'rows'
                  ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Rows size={12} className={activeLayout === 'rows' ? 'text-white' : 'text-cyan-400'} />
              <span>Linhas (TV)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetLayoutMode('grid')}
              title="Modo Grade: visualização em 6 caixas verticais."
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                activeLayout === 'grid'
                  ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={12} className={activeLayout === 'grid' ? 'text-white' : 'text-cyan-400'} />
              <span>Grade (6 Blocos)</span>
            </button>
          </div>

          {onResetCycle && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Deseja desmarcar todos os checks do mês para iniciar um novo ciclo de pagamentos recorrentes? As obrigações e responsáveis permanecerão salvos.')) {
                  onResetCycle();
                }
              }}
              title="Desmarcar todos os checks para o novo ciclo mensal"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-sm"
            >
              <RotateCcw size={11} className="text-cyan-400" />
              <span>Renovar Ciclo</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CASO 1: VISÃO EM LINHAS HORIZONTAIS COM ESTEIRA (PADRÃO PARA TV)     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeLayout === 'rows' && (
        <div className="space-y-2">
          {cronograma.map((block) => {
            const isCurrentBlock = todayDay >= block.diaInicio && todayDay <= block.diaFim;
            const isTargetBlock = dragOverBlockId === block.id;

            let sortedItens = block.itens.slice().sort((a, b) => a.dia - b.dia);

            if (filterResponsible) {
              sortedItens = sortedItens.filter(it =>
                extractResponsaveisList(it).includes(filterResponsible.toUpperCase())
              );
            }

            if (onlyOverdue) {
              sortedItens = sortedItens.filter(it => !it.concluido && it.dia < todayDay);
            }

            const totalItens = block.itens.length;
            const concluidos = block.itens.filter(i => i.concluido).length;
            const atrasadosNoBloco = block.itens.filter(i => !i.concluido && i.dia < todayDay).length;

            // Tarefas da demanda sob hover atribuídas a este bloco
            const injectedDemandTasks = getDemandTasksForBlock(block);
            const hasInjectedTasks = injectedDemandTasks.length > 0;

            return (
              <div
                key={block.id}
                onDragOver={(e) => handleDragOverBlock(e, block.id)}
                onDrop={(e) => handleDrop(e, block.id)}
                className={`flex flex-col sm:flex-row sm:items-center gap-2 p-1.5 sm:p-2 rounded-xl border transition-all ticker-hover-pause relative ${
                  hasInjectedTasks
                    ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400 shadow-lg shadow-cyan-950/60'
                    : isTargetBlock
                    ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400'
                    : atrasadosNoBloco > 0
                    ? 'bg-[#0f1424] border-rose-500/40 hover:border-rose-500/70'
                    : isCurrentBlock
                    ? 'bg-[#0f172a] border-cyan-500/80 shadow-md ring-1 ring-cyan-500/30'
                    : 'bg-[#0b1120]/90 border-slate-800/80 hover:border-slate-700/80'
                }`}
              >
                {/* COLUNA FIXA DO PERÍODO À ESQUERDA */}
                <div className="w-full sm:w-44 md:w-52 flex-shrink-0 flex items-center justify-between gap-1.5 border-b sm:border-b-0 sm:border-r border-slate-800/80 pb-1 sm:pb-0 sm:pr-2.5 font-mono">
                  <div className="flex items-center gap-1.5">
                    {/* INDICADOR SE É BLOCO DE HOJE OU ATRASADO */}
                    {isCurrentBlock ? (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping flex-shrink-0" />
                    ) : atrasadosNoBloco > 0 ? (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-700 flex-shrink-0" />
                    )}

                    <span className={`text-xs sm:text-sm font-black tracking-wide ${
                      isCurrentBlock ? 'text-cyan-300' : 'text-white'
                    }`}>
                      {block.intervalo}
                    </span>

                    {isCurrentBlock && (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 text-[9px] font-black uppercase">
                        HOJE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[10px]">
                    {atrasadosNoBloco > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-600/30 border border-rose-500/50 text-rose-300 font-bold animate-pulse">
                        {atrasadosNoBloco} atr
                      </span>
                    )}

                    {hasInjectedTasks && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black animate-pulse flex items-center gap-0.5">
                        <Zap size={9} />
                        +{injectedDemandTasks.length}
                      </span>
                    )}

                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-bold">
                      {concluidos}/{totalItens}
                    </span>
                  </div>
                </div>

                {/* ESTEIRA HORIZONTAL DE OBRIGAÇÕES À DIREITA (CORRENDO OU EM FILA) */}
                <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-2 py-0.5">
                  {/* ── SE HOUVER TAREFAS DA DEMANDA EM HOVER, ELAS SURGEM AQUI COM DESTAQUE ── */}
                  {injectedDemandTasks.map((demandTask) => (
                    <div
                      key={`injected-${demandTask.id}`}
                      onClick={() => {
                        if (hoveredDemand && onToggleDemandItem) {
                          onToggleDemandItem(hoveredDemand.colId, demandTask.id);
                        }
                      }}
                      className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/80 shadow-md animate-pulse"
                      title={`Tarefa originada da Demanda "${hoveredDemand?.titulo}". Clique para marcar conclusão.`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border ${
                          demandTask.concluido ? 'bg-cyan-400 border-cyan-400 text-slate-950 font-black' : 'border-cyan-300 bg-slate-950'
                        }`}
                      >
                        {demandTask.concluido && <Check size={10} strokeWidth={3} />}
                      </div>

                      <span className="text-[9px] font-black uppercase font-mono px-1 py-0.2 rounded bg-cyan-900 border border-cyan-500/50 text-cyan-300">
                        ⚡ DEMANDA: {hoveredDemand?.titulo.split(':')[0]}
                      </span>

                      {extractResponsaveisList(demandTask).map((resp) => (
                        <span
                          key={resp}
                          className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-slate-900 border border-cyan-500/40 text-white"
                        >
                          {resp}
                        </span>
                      ))}

                      <span className="font-bold truncate max-w-[240px]">
                        {demandTask.texto}
                      </span>
                    </div>
                  ))}

                  {/* ── LISTA DE OBRIGAÇÕES DO BLOCO ── */}
                  {sortedItens.map((item, index) => {
                    const isOverdue = !item.concluido && item.dia < todayDay;
                    const isEditingThis = editingItemId === item.id;

                    if (isEditingThis) {
                      return (
                        <form
                          key={item.id}
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveEdit(block.id, item.id);
                          }}
                          className="flex-shrink-0 flex items-center gap-1.5 p-1 bg-slate-950 border border-cyan-500 rounded-lg shadow-md"
                        >
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={editDia}
                            onChange={(e) => setEditDia(Number(e.target.value))}
                            className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-cyan-300 font-bold text-center"
                          />
                          <input
                            type="text"
                            autoFocus
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="w-36 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white uppercase font-mono"
                            placeholder="Obrigação..."
                          />
                          <button
                            type="submit"
                            className="px-2 py-0.5 rounded bg-cyan-600 text-white text-[10px] font-bold"
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <X size={11} />
                          </button>
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
                        className={`group/item flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-all ${
                          item.concluido
                            ? 'bg-slate-900/40 border-slate-800/60 opacity-60 text-slate-500 line-through'
                            : isOverdue
                            ? 'bg-rose-950/40 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/40 shadow-sm'
                            : isCurrentBlock
                            ? 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/60 text-cyan-200'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-200'
                        }`}
                        title={`Dia ${item.dia}: ${item.descricao}`}
                      >
                        {/* ALÇA DE ARRASTAR */}
                        <div className="text-slate-600 group-hover/item:text-slate-400 cursor-grab active:cursor-grabbing">
                          <GripVertical size={11} />
                        </div>

                        {/* CHECKBOX */}
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                            item.concluido
                              ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                              : isOverdue
                              ? 'border-rose-400 bg-slate-950'
                              : 'border-slate-600 bg-slate-950'
                          }`}
                        >
                          {item.concluido && <Check size={10} strokeWidth={3} className="text-white" />}
                        </div>

                        {/* BADGE DO DIA */}
                        <span className="font-mono font-black text-cyan-400 text-[11px] bg-slate-950/80 px-1 rounded border border-slate-800">
                          {String(item.dia).padStart(2, '0')}
                        </span>

                        {/* BADGES DOS RESPONSÁVEIS */}
                        {extractResponsaveisList(item).map((resp) => (
                          <span
                            key={resp}
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-black uppercase bg-cyan-950 border border-cyan-500/50 text-cyan-300 flex-shrink-0"
                          >
                            <User size={8} />
                            {resp}
                          </span>
                        ))}

                        {/* SINALIZADOR DE ATRASO */}
                        {isOverdue && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-black uppercase bg-rose-600 text-white animate-pulse flex-shrink-0">
                            <AlertTriangle size={8} /> ATRASADO
                          </span>
                        )}

                        <span className="font-semibold truncate max-w-[200px]">
                          {item.descricao}
                        </span>

                        {/* AÇÕES DE EDIÇÃO E EXCLUSÃO NO HOVER */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity ml-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(item);
                            }}
                            className="p-0.5 text-slate-400 hover:text-cyan-300"
                            title="Editar"
                          >
                            <Edit3 size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteItem(block.id, item.id);
                            }}
                            className="p-0.5 text-slate-400 hover:text-rose-400"
                            title="Excluir"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* ADICIONAR NOVA OBRIGAÇÃO NO BLOCO */}
                  {activeInputBlockId === block.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleCreate(block);
                      }}
                      className="flex-shrink-0 flex items-center gap-1.5 p-1 bg-slate-950 border border-cyan-500 rounded-lg shadow-md"
                    >
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={inputDia}
                        onChange={(e) => setInputDia(Number(e.target.value))}
                        className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-cyan-300 font-bold text-center"
                        title="Dia"
                      />
                      <input
                        type="text"
                        autoFocus
                        value={inputDesc}
                        onChange={(e) => setInputDesc(e.target.value)}
                        className="w-36 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white uppercase font-mono"
                        placeholder="Nova obrigação..."
                      />
                      <input
                        type="text"
                        list="responsavel-suggestions"
                        value={inputResp}
                        onChange={(e) => setInputResp(e.target.value)}
                        className="w-24 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-cyan-300 uppercase font-mono"
                        placeholder="Resp..."
                      />
                      <button
                        type="submit"
                        className="px-2 py-0.5 rounded bg-cyan-600 text-white text-[10px] font-bold"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveInputBlockId(null)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <X size={11} />
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveInputBlockId(block.id);
                        setInputDia(todayDay >= block.diaInicio && todayDay <= block.diaFim ? todayDay : block.diaInicio);
                        setInputDesc('');
                        setInputResp('');
                      }}
                      className="flex-shrink-0 px-2 py-1 rounded-lg border border-dashed border-slate-800 hover:border-cyan-500/50 text-[10px] text-slate-400 hover:text-white font-bold flex items-center gap-1"
                      title="Adicionar obrigação recorrente neste período"
                    >
                      <Plus size={10} />
                      <span>Adicionar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CASO 2: VISÃO EM GRADE (6 BLOCOS VERTICAIS CLÁSSICOS)                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeLayout === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {cronograma.map((block) => {
            const isCurrentBlock = todayDay >= block.diaInicio && todayDay <= block.diaFim;
            const isTargetBlock = dragOverBlockId === block.id;

            let sortedItens = block.itens.slice().sort((a, b) => a.dia - b.dia);

            if (filterResponsible) {
              sortedItens = sortedItens.filter(it =>
                extractResponsaveisList(it).includes(filterResponsible.toUpperCase())
              );
            }

            if (onlyOverdue) {
              sortedItens = sortedItens.filter(it => !it.concluido && it.dia < todayDay);
            }

            const totalItens = block.itens.length;
            const concluidos = block.itens.filter(i => i.concluido).length;
            const atrasadosNoBloco = block.itens.filter(i => !i.concluido && i.dia < todayDay).length;

            const injectedDemandTasks = getDemandTasksForBlock(block);
            const hasInjectedTasks = injectedDemandTasks.length > 0;

            return (
              <div
                key={block.id}
                onDragOver={(e) => handleDragOverBlock(e, block.id)}
                onDrop={(e) => handleDrop(e, block.id)}
                className={`flex flex-col rounded-xl p-3 border transition-all relative ${
                  hasInjectedTasks
                    ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400 shadow-xl'
                    : isTargetBlock
                    ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400 shadow-xl'
                    : atrasadosNoBloco > 0
                    ? 'bg-[#0f1424] border-rose-500/40 hover:border-rose-500/70'
                    : isCurrentBlock
                    ? 'bg-[#0f172a] border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                    : 'bg-[#0b1120]/90 border-slate-800/80 hover:border-slate-700/80'
                }`}
              >
                {isCurrentBlock && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                    <span>BLOCO DE HOJE</span>
                  </div>
                )}

                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 pt-1">
                  <span className={`font-mono text-xs sm:text-sm font-black tracking-wide ${
                    isCurrentBlock ? 'text-cyan-400' : 'text-slate-300'
                  }`}>
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

                <div className="flex-1 space-y-1.5 min-h-[120px]">
                  {/* TAREFAS DA DEMANDA INJETADAS */}
                  {injectedDemandTasks.map((demandTask) => (
                    <div
                      key={`grid-injected-${demandTask.id}`}
                      onClick={() => {
                        if (hoveredDemand && onToggleDemandItem) {
                          onToggleDemandItem(hoveredDemand.colId, demandTask.id);
                        }
                      }}
                      className="p-1.5 rounded-lg border border-cyan-400 bg-cyan-950/60 text-cyan-200 text-xs cursor-pointer animate-pulse shadow-md"
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="px-1 py-0.2 rounded bg-cyan-900 text-[8px] font-black uppercase">
                          ⚡ {hoveredDemand?.titulo.split(':')[0]}
                        </span>
                      </div>
                      <p className="font-bold text-[11px] leading-tight">
                        {demandTask.texto}
                      </p>
                    </div>
                  ))}

                  {/* ITENS DO BLOCO */}
                  {sortedItens.map((item, index) => {
                    const isOverdue = !item.concluido && item.dia < todayDay;
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
                          item.concluido
                            ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                            : isOverdue
                            ? 'bg-rose-950/30 border-rose-500/70 ring-1 ring-rose-500/40'
                            : isCurrentBlock
                            ? 'bg-cyan-950/20 border-cyan-900/40 hover:border-cyan-500/40'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-1 min-w-0">
                          <div className="mt-0.5 text-slate-600 group-hover/item:text-slate-400 cursor-grab active:cursor-grabbing p-0.5">
                            <GripVertical size={11} />
                          </div>

                          <div
                            className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                              item.concluido ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'border-slate-600 bg-slate-950'
                            }`}
                          >
                            {item.concluido && <Check size={10} strokeWidth={3} />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center flex-wrap gap-1 leading-tight">
                              {extractResponsaveisList(item).map((resp) => (
                                <span
                                  key={resp}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-cyan-950 border border-cyan-500/60 text-cyan-300"
                                >
                                  <User size={8} />
                                  {resp}
                                </span>
                              ))}

                              {isOverdue && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-black uppercase bg-rose-600 text-white animate-pulse">
                                  <AlertTriangle size={8} /> ATRASADO
                                </span>
                              )}

                              <span className={`text-xs font-semibold leading-tight ${
                                item.concluido ? 'line-through text-slate-500' : 'text-slate-200'
                              }`}>
                                {item.descricao}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(item);
                            }}
                            className="p-1 text-slate-400 hover:text-cyan-300"
                          >
                            <Edit3 size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteItem(block.id, item.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
