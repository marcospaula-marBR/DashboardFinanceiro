"use client";

import React, { useState } from 'react';
import { WhiteboardColumn, WhiteboardItem } from '@/types/war-room';
import { calculatePrazoInfo } from '@/services/war-room.service';
import { 
  Check, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  AlertOctagon, 
  GripVertical, 
  User, 
  Archive, 
  Calendar, 
  Clock, 
  Settings2,
  Layers
} from 'lucide-react';

interface WhiteboardColumnsProps {
  colunas: WhiteboardColumn[];
  filterResponsible?: string | null;
  onToggleItem: (columnId: string, itemId: string) => void;
  onAddItem: (columnId: string, text: string, responsavel?: string, dataLimite?: string) => void;
  onEditItem: (columnId: string, itemId: string, novoTexto: string, novoResponsavel?: string, dataLimite?: string) => void;
  onOpenFullEdit?: (columnId: string, item: WhiteboardItem) => void;
  onArchiveItem?: (columnId: string, itemId: string) => void;
  onDeleteItem: (columnId: string, itemId: string) => void;
  onReorderItem?: (columnId: string, startIndex: number, endIndex: number) => void;
  onMoveItemBetweenColumns?: (sourceColId: string, targetColId: string, itemId: string, targetIndex?: number) => void;
  // Gestão de Demandas (Colunas inteiras)
  onArchiveDemand?: (columnId: string) => void;
  onEditDemand?: (column: WhiteboardColumn) => void;
  onDeleteDemand?: (columnId: string) => void;
  onAddDemand?: () => void;
  onOpenArchivedModal?: () => void;
  totalArchivedCount?: number;
  totalArchivedDemandsCount?: number;
}

export function WhiteboardColumns({
  colunas,
  filterResponsible,
  onToggleItem,
  onAddItem,
  onEditItem,
  onOpenFullEdit,
  onArchiveItem,
  onDeleteItem,
  onReorderItem,
  onMoveItemBetweenColumns,
  onArchiveDemand,
  onEditDemand,
  onDeleteDemand,
  onAddDemand,
  onOpenArchivedModal,
  totalArchivedCount = 0,
  totalArchivedDemandsCount = 0,
}: WhiteboardColumnsProps) {
  const [activeInputColId, setActiveInputColId] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [inputResp, setInputResp] = useState<string>('');
  const [inputDate, setInputDate] = useState<string>('');

  // Estados de edição inline
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState<string>('');
  const [editResp, setEditResp] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');

  // Estados de Drag & Drop
  const [draggedItem, setDraggedItem] = useState<{ columnId: string; itemId: string; index: number } | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<{ columnId: string; index: number } | null>(null);

  // Filtrar apenas demandas ativas (não arquivadas na lousa)
  const activeColunas = colunas.filter(col => !col.arquivado);

  const handleCreate = (colId: string) => {
    if (!inputText.trim()) {
      setActiveInputColId(null);
      return;
    }
    onAddItem(colId, inputText.trim(), inputResp.trim() || undefined, inputDate.trim() || undefined);
    setInputText('');
    setInputResp('');
    setInputDate('');
    setActiveInputColId(null);
  };

  const handleStartEdit = (item: WhiteboardItem) => {
    setEditingItemId(item.id);
    setEditTexto(item.texto);
    setEditResp(item.responsavel || '');
    setEditDate(item.dataLimite || '');
  };

  const handleSaveEdit = (colId: string, itemId: string) => {
    if (!editTexto.trim()) {
      setEditingItemId(null);
      return;
    }
    onEditItem(colId, itemId, editTexto.trim(), editResp.trim() || undefined, editDate.trim() || undefined);
    setEditingItemId(null);
  };

  // ── HANDLERS DE DRAG & DROP NATIVO ──
  const handleDragStart = (e: React.DragEvent, columnId: string, itemId: string, index: number) => {
    setDraggedItem({ columnId, itemId, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ columnId, itemId, index }));
  };

  const handleDragOverColumn = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== columnId) {
      setDragOverColId(columnId);
    }
  };

  const handleDragOverItem = (e: React.DragEvent, columnId: string, itemIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColId(columnId);
    setDragOverItemIndex({ columnId, index: itemIndex });
  };

  const handleDrop = (e: React.DragEvent, targetColId: string, targetIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) {
      setDragOverColId(null);
      setDragOverItemIndex(null);
      return;
    }

    const { columnId: sourceColId, itemId, index: sourceIndex } = draggedItem;

    if (sourceColId === targetColId) {
      // Reordenação na mesma coluna
      if (targetIndex !== undefined && targetIndex !== sourceIndex && onReorderItem) {
        onReorderItem(targetColId, sourceIndex, targetIndex);
      }
    } else {
      // Movimentação entre colunas diferentes
      if (onMoveItemBetweenColumns) {
        onMoveItemBetweenColumns(sourceColId, targetColId, itemId, targetIndex);
      }
    }

    setDraggedItem(null);
    setDragOverColId(null);
    setDragOverItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverColId(null);
    setDragOverItemIndex(null);
  };

  const getMarkerBarColor = (cor: WhiteboardColumn['corMarcador']) => {
    switch (cor) {
      case 'azul': return 'bg-blue-500';
      case 'ciano': return 'bg-cyan-500';
      case 'esmeralda': return 'bg-emerald-500';
      case 'ambar': return 'bg-amber-500';
      case 'vermelho':
      default: return 'bg-rose-500';
    }
  };

  const getMarkerTextColor = (cor: WhiteboardColumn['corMarcador']) => {
    switch (cor) {
      case 'azul': return 'text-blue-400';
      case 'ciano': return 'text-cyan-400';
      case 'esmeralda': return 'text-emerald-400';
      case 'ambar': return 'text-amber-400';
      case 'vermelho':
      default: return 'text-rose-400';
    }
  };

  return (
    <section className="w-full bg-[#070c18]/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative">
      {/* DATALIST DE SUGESTÕES */}
      <datalist id="col-responsavel-suggestions">
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
        <option value="TI / CONTÁBIL" />
      </datalist>

      {/* CABEÇALHO DA SEÇÃO DE COLUNAS */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 mb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <span>DEMANDAS OPERACIONAIS EM FOCO</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
              {activeColunas.length} Ativas
            </span>
          </h2>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* BOTÃO NOVA DEMANDA */}
          {onAddDemand && (
            <button
              type="button"
              onClick={onAddDemand}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md"
              title="Adicionar uma nova demanda (coluna) na lousa"
            >
              <Plus size={13} strokeWidth={3} />
              <span>Nova Demanda</span>
            </button>
          )}

          {/* BOTÃO CONSULTAR DEMANDAS ARQUIVADAS */}
          {onOpenArchivedModal && (
            <button
              type="button"
              onClick={onOpenArchivedModal}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all border shadow-sm ${
                totalArchivedDemandsCount > 0 || totalArchivedCount > 0
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-900/50 hover:text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
              title="Consultar e restaurar demandas inteiras ou tarefas arquivadas"
            >
              <Archive size={13} className={totalArchivedDemandsCount > 0 ? 'text-amber-400' : 'text-slate-400'} />
              <span>
                🗄️ Arquivadas ({totalArchivedDemandsCount} colunas / {totalArchivedCount} tarefas)
              </span>
            </button>
          )}

          <span className="text-[11px] text-slate-400 font-medium hidden lg:inline">
            • Cores semânticas de prazos • Arraste para mover • Arquivar demanda oculta da lousa
          </span>
        </div>
      </div>

      {/* ── GRID DAS COLUNAS ATIVAS DA LOUSA COM SUPORTE A DRAG & DROP ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {activeColunas.map((col) => {
          let visibleItens = col.itens.filter(it => !it.arquivado);
          if (filterResponsible) {
            visibleItens = visibleItens.filter(
              it => it.responsavel?.toUpperCase() === filterResponsible.toUpperCase()
            );
          }

          const totalItens = col.itens.filter(i => !i.arquivado).length;
          const concluidos = col.itens.filter(i => !i.arquivado && i.concluido).length;
          const isTargetCol = dragOverColId === col.id;

          const markerBar = getMarkerBarColor(col.corMarcador);
          const markerText = getMarkerTextColor(col.corMarcador);
          const colPrazo = calculatePrazoInfo(col.dataLimite);

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOverColumn(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex flex-col rounded-xl p-3.5 shadow-md transition-all relative group ${
                isTargetCol
                  ? 'bg-rose-950/30 border-rose-500 ring-2 ring-rose-500/50'
                  : 'bg-[#0b1120]/90 border border-slate-800/80 hover:border-slate-700/80'
              }`}
            >
              {/* LINHA SUPERIOR ESTILO MARCADOR */}
              <div className={`h-1 w-full rounded-full mb-2.5 ${markerBar}`} />

              {/* CABEÇALHO DA DEMANDA (COLUNA) */}
              <div className="pb-2.5 mb-2.5 border-b border-slate-800/80 space-y-1.5">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-xs sm:text-sm font-black tracking-wide uppercase font-mono ${markerText}`}>
                      {col.titulo}
                    </h3>
                    {col.subtitulo && (
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        {col.subtitulo}
                      </p>
                    )}
                  </div>

                  {/* CONTADOR DE TAREFAS */}
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 flex-shrink-0">
                    {concluidos}/{totalItens}
                  </span>
                </div>

                {/* LINHA DE METADADOS DA DEMANDA: PRAZO + AÇÕES DA DEMANDA */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  {/* BADGE DE PRAZO DA DEMANDA */}
                  {col.dataLimite && colPrazo.status !== 'sem_prazo' ? (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wide ${colPrazo.badgeClass}`}
                      title={`Data Limite da Demanda: ${col.dataLimite}`}
                    >
                      <Clock size={9} />
                      <span>{colPrazo.rotulo}</span>
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-600">Sem prazo limite</span>
                  )}

                  {/* AÇÕES DE GESTÃO DA DEMANDA INTEIRA */}
                  <div className="flex items-center gap-0.5 opacity-90 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity">
                    {/* ARQUIVAR DEMANDA INTEIRA */}
                    {onArchiveDemand && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `Deseja arquivar a demanda "${col.titulo}" e ocultá-la da lousa ativa?\n\nEla poderá ser consultada ou restaurada a qualquer momento no histórico.`
                            )
                          ) {
                            onArchiveDemand(col.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-amber-300 hover:bg-amber-950/50 rounded transition-colors"
                        title="Arquivar demanda inteira (ocultar da lousa ativa)"
                      >
                        <Archive size={12} />
                      </button>
                    )}

                    {/* EDITAR DADOS DA DEMANDA */}
                    {onEditDemand && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditDemand(col);
                        }}
                        className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/50 rounded transition-colors"
                        title="Editar demanda (título, prazo limite, alerta, cor)"
                      >
                        <Settings2 size={12} />
                      </button>
                    )}

                    {/* EXCLUIR DEMANDA INTEIRA */}
                    {onDeleteDemand && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `ATENÇÃO: Deseja realmente excluir a demanda "${col.titulo}" e todas as suas ${col.itens.length} tarefas permanentemente?`
                            )
                          ) {
                            onDeleteDemand(col.id);
                          }
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded transition-colors"
                        title="Excluir demanda permanentemente"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ALERTA EM DESTAQUE (EX: * SUSPENSAS NOVAS CONTAS) */}
              {col.alertaDestaque && (
                <div className="mb-2.5 px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 flex items-center gap-1.5 animate-pulse">
                  <AlertOctagon size={12} className="text-rose-400 flex-shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 font-mono">
                    {col.alertaDestaque}
                  </span>
                </div>
              )}

              {/* LISTA DE ITENS COM ARRASTAR E SOLTAR */}
              <div className="flex-1 space-y-1.5 min-h-[140px]">
                {visibleItens.map((item, index) => {
                  const isEditingThis = editingItemId === item.id;
                  const isDraggingThis = draggedItem?.itemId === item.id;
                  const isDragOverThis =
                    dragOverItemIndex?.columnId === col.id && dragOverItemIndex?.index === index;
                  const itemPrazo = calculatePrazoInfo(item.dataLimite, item.concluido);

                  if (isEditingThis) {
                    return (
                      <form
                        key={item.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveEdit(col.id, item.id);
                        }}
                        className="p-2 rounded-lg bg-slate-950 border border-cyan-500/70 space-y-1.5 shadow-md"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editTexto}
                          onChange={(e) => setEditTexto(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 uppercase font-mono"
                          placeholder="Texto da tarefa..."
                        />
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            type="text"
                            list="col-responsavel-suggestions"
                            value={editResp}
                            onChange={(e) => setEditResp(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-rose-300 focus:outline-none focus:border-cyan-400 uppercase font-mono"
                            placeholder="Responsável..."
                          />
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-cyan-400 font-mono"
                            title="Data limite"
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
                      onDragStart={(e) => handleDragStart(e, col.id, item.id, index)}
                      onDragOver={(e) => handleDragOverItem(e, col.id, index)}
                      onDrop={(e) => handleDrop(e, col.id, index)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onToggleItem(col.id, item.id)}
                      className={`group/item flex items-start justify-between gap-1 p-2 rounded-lg border cursor-pointer transition-all ${
                        isDraggingThis
                          ? 'opacity-30 scale-95 border-dashed border-rose-400'
                          : isDragOverThis
                          ? 'border-t-2 border-t-rose-400 bg-rose-950/20'
                          : item.concluido
                          ? 'bg-slate-900/50 border-slate-800/60 opacity-60'
                          : item.destaque
                          ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-start gap-1.5 min-w-0">
                        {/* ALÇA DE ARRASTAR */}
                        <div
                          className="mt-0.5 text-slate-600 group-hover/item:text-slate-400 cursor-grab active:cursor-grabbing p-0.5"
                          title="Arraste para reposicionar ou mover entre demandas"
                        >
                          <GripVertical size={11} />
                        </div>

                        {/* CHECKBOX / CHECKMARK */}
                        <div
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                            item.concluido
                              ? 'bg-rose-500 border-rose-500 text-white font-black shadow-sm shadow-rose-500/30'
                              : 'border-slate-600 group-hover/item:border-slate-400 bg-slate-950'
                          }`}
                        >
                          {item.concluido && <Check size={12} strokeWidth={3} className="text-white" />}
                        </div>

                        {/* CONTEÚDO DA TAREFA */}
                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-1 leading-snug">
                            {/* BADGE DE RESPONSÁVEL */}
                            {item.responsavel && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-950 border border-rose-500/50 text-rose-300 shadow-sm flex-shrink-0"
                                title={`Responsável: ${item.responsavel}`}
                              >
                                <User size={9} className="text-rose-400" />
                                {item.responsavel}
                              </span>
                            )}

                            {/* BADGE DE PRAZO DA TAREFA (SINALIZAÇÃO POR CORES) */}
                            {item.dataLimite && itemPrazo.status !== 'sem_prazo' && (
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono flex-shrink-0 ${itemPrazo.badgeClass}`}
                                title={`Prazo limite: ${item.dataLimite}`}
                              >
                                <span>{itemPrazo.rotuloCurto || itemPrazo.rotulo}</span>
                              </span>
                            )}

                            {/* TEXTO DA TAREFA */}
                            <span
                              className={`text-xs font-semibold leading-relaxed tracking-tight ${
                                item.concluido
                                  ? 'line-through text-slate-500'
                                  : item.destaque
                                  ? 'text-amber-200 font-bold'
                                  : 'text-slate-200'
                              }`}
                            >
                              {item.texto}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* AÇÕES DA TAREFA (EDITAR COMPLETO E EXCLUIR) */}
                      <div className="flex items-center opacity-90 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity flex-shrink-0 gap-0.5">
                        {/* EDITAR COMPLETO */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenFullEdit) {
                              onOpenFullEdit(col.id, item);
                            } else {
                              handleStartEdit(item);
                            }
                          }}
                          title="Editar tarefa completa (texto, prazo, responsável, notas)"
                          className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/50 rounded transition-colors"
                        >
                          <Edit3 size={12} />
                        </button>

                        {/* EXCLUIR TAREFA */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Excluir a tarefa "${item.texto}"?`)) {
                              onDeleteItem(col.id, item.id);
                            }
                          }}
                          title="Excluir tarefa"
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {visibleItens.length === 0 && (
                  <div className="text-center py-6 text-slate-500 text-[11px] font-mono">
                    Nenhuma tarefa nesta demanda
                  </div>
                )}
              </div>

              {/* INPUT RÁPIDO PARA ADICIONAR NOVA TAREFA */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/60">
                {activeInputColId === col.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleCreate(col.id);
                    }}
                    className="space-y-1.5"
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="Texto da tarefa..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="w-full bg-slate-950 border border-cyan-500/60 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 uppercase font-mono"
                    />
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="text"
                        list="col-responsavel-suggestions"
                        placeholder="Responsável..."
                        value={inputResp}
                        onChange={(e) => setInputResp(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-rose-300 focus:outline-none focus:border-rose-400 uppercase font-mono"
                      />
                      <input
                        type="date"
                        placeholder="Prazo..."
                        value={inputDate}
                        onChange={(e) => setInputDate(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-cyan-400 font-mono"
                        title="Data limite"
                      />
                    </div>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveInputColId(null);
                          setInputText('');
                          setInputResp('');
                          setInputDate('');
                        }}
                        className="px-2 py-0.5 text-xs text-slate-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-2.5 py-0.5 rounded bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-500"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveInputColId(col.id);
                      setInputText('');
                      setInputResp('');
                      setInputDate('');
                    }}
                    className="w-full flex items-center justify-center gap-1 py-1 rounded text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all border border-dashed border-slate-800"
                  >
                    <Plus size={12} />
                    <span>Adicionar Tarefa</span>
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
