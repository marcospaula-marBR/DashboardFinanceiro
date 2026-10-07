"use client";

import React, { useState } from 'react';
import { WhiteboardColumn, WhiteboardItem } from '@/types/war-room';
import { calculatePrazoInfo, extractResponsaveisList } from '@/services/war-room.service';
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
  Layers,
  Users,
  Eye,
  Rows,
  LayoutGrid
} from 'lucide-react';

export type DemandLayoutMode = 'compact' | 'rows' | 'expanded';

interface WhiteboardColumnsProps {
  colunas: WhiteboardColumn[];
  filterResponsible?: string | null;
  layoutMode?: DemandLayoutMode;
  onLayoutModeChange?: (mode: DemandLayoutMode) => void;
  onHoverDemand?: (colId: string | null, colTitulo?: string, corMarcador?: string, itens?: WhiteboardItem[]) => void;
  onToggleItem: (columnId: string, itemId: string) => void;
  onAddItem: (columnId: string, text: string, responsavel?: string, dataLimite?: string, responsaveis?: string[]) => void;
  onEditItem: (columnId: string, itemId: string, novoTexto: string, novoResponsavel?: string, dataLimite?: string, novosResponsaveis?: string[]) => void;
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
  layoutMode: initialLayoutMode = 'compact',
  onLayoutModeChange,
  onHoverDemand,
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
  const [internalLayoutMode, setInternalLayoutMode] = useState<DemandLayoutMode>(initialLayoutMode);
  const activeLayout = onLayoutModeChange ? initialLayoutMode : internalLayoutMode;

  const handleSetLayoutMode = (mode: DemandLayoutMode) => {
    setInternalLayoutMode(mode);
    onLayoutModeChange?.(mode);
  };

  // Estado para qual demanda está sob o cursor (hover) para exibir o popover flutuante
  const [hoveredColId, setHoveredColId] = useState<string | null>(null);

  // Estados de criação inline
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
    const resps = extractResponsaveisList(inputResp);
    onAddItem(colId, inputText.trim(), resps.join(', ') || undefined, inputDate.trim() || undefined, resps);
    setInputText('');
    setInputResp('');
    setInputDate('');
    setActiveInputColId(null);
  };

  const handleStartEdit = (item: WhiteboardItem) => {
    setEditingItemId(item.id);
    setEditTexto(item.texto);
    const resps = extractResponsaveisList(item);
    setEditResp(resps.join(', '));
    setEditDate(item.dataLimite || '');
  };

  const handleSaveEdit = (colId: string, itemId: string) => {
    if (!editTexto.trim()) {
      setEditingItemId(null);
      return;
    }
    const resps = extractResponsaveisList(editResp);
    onEditItem(colId, itemId, editTexto.trim(), resps.join(', ') || undefined, editDate.trim() || undefined, resps);
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

  // Helper para acionar hover sincronizado com o cronograma
  const triggerHover = (col: WhiteboardColumn | null, visibleItens?: WhiteboardItem[]) => {
    if (!col) {
      setHoveredColId(null);
      onHoverDemand?.(null, '', undefined, []);
      return;
    }
    setHoveredColId(col.id);
    onHoverDemand?.(col.id, col.titulo, col.corMarcador, visibleItens || col.itens);
  };

  return (
    <section className="w-full bg-[#070c18]/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xl relative">
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
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 mb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <span>DEMANDAS OPERACIONAIS EM FOCO</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
              {activeColunas.length} Ativas
            </span>
          </h2>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* SELETOR DE MODO DE VISUALIZAÇÃO: SÓ TÍTULOS (TV) / LINHAS / EXPANDIDO */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => handleSetLayoutMode('compact')}
              title="Modo TV: apenas títulos das demandas visíveis. Tarefas surgem ao passar o mouse e se projetam no cronograma."
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                activeLayout === 'compact'
                  ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye size={12} className={activeLayout === 'compact' ? 'text-white' : 'text-cyan-400'} />
              <span>Só Títulos (TV)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetLayoutMode('rows')}
              title="Modo Linhas: demandas em linhas horizontais contínuas com esteira."
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                activeLayout === 'rows'
                  ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Rows size={12} className={activeLayout === 'rows' ? 'text-white' : 'text-cyan-400'} />
              <span>Linhas</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetLayoutMode('expanded')}
              title="Modo Expandido: todas as tarefas sempre visíveis dentro das colunas."
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                activeLayout === 'expanded'
                  ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={12} className={activeLayout === 'expanded' ? 'text-white' : 'text-cyan-400'} />
              <span>Expandido</span>
            </button>
          </div>

          {/* BOTÃO NOVA DEMANDA */}
          {onAddDemand && (
            <button
              type="button"
              onClick={onAddDemand}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md"
              title="Adicionar uma nova demanda (coluna) na lousa"
            >
              <Plus size={12} strokeWidth={3} />
              <span>Nova Demanda</span>
            </button>
          )}

          {/* BOTÃO CONSULTAR DEMANDAS ARQUIVADAS */}
          {onOpenArchivedModal && (
            <button
              type="button"
              onClick={onOpenArchivedModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all border shadow-sm ${
                totalArchivedDemandsCount > 0 || totalArchivedCount > 0
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-900/50 hover:text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
              title="Consultar e restaurar demandas inteiras ou tarefas arquivadas"
            >
              <Archive size={12} className={totalArchivedDemandsCount > 0 ? 'text-amber-400' : 'text-slate-400'} />
              <span>
                🗄️ Arquivadas ({totalArchivedDemandsCount})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CASO 1: MODO COMPACTO (SÓ TÍTULOS COM HOVER POPOVER FLUTUANTE NA TV) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeLayout === 'compact' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 relative">
          {activeColunas.map((col, colIndex) => {
            let visibleItens = col.itens.filter(it => !it.arquivado);
            if (filterResponsible) {
              visibleItens = visibleItens.filter(
                it => extractResponsaveisList(it).includes(filterResponsible.toUpperCase())
              );
            }

            const totalItens = col.itens.filter(i => !i.arquivado).length;
            const concluidos = col.itens.filter(i => !i.arquivado && i.concluido).length;
            const markerBar = getMarkerBarColor(col.corMarcador);
            const markerText = getMarkerTextColor(col.corMarcador);
            const colPrazo = calculatePrazoInfo(col.dataLimite);
            const isHovered = hoveredColId === col.id;
            const isTargetCol = dragOverColId === col.id;

            // Se for coluna da direita, alinha o popover à direita para não cortar
            const isRightCol = colIndex >= 3;

            return (
              <div
                key={col.id}
                onMouseEnter={() => triggerHover(col, visibleItens)}
                onMouseLeave={() => triggerHover(null)}
                onDragOver={(e) => handleDragOverColumn(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`flex flex-col justify-between rounded-xl p-2.5 shadow-md transition-all relative cursor-pointer select-none ${
                  isHovered
                    ? 'bg-[#0f172a] border-cyan-400 ring-2 ring-cyan-400/60 shadow-cyan-950/50 scale-[1.01] z-30'
                    : isTargetCol
                    ? 'bg-rose-950/30 border-rose-500 ring-2 ring-rose-500/50'
                    : 'bg-[#0b1120]/95 border border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* LINHA SUPERIOR ESTILO MARCADOR */}
                <div className={`h-1 w-full rounded-full mb-1.5 ${markerBar}`} />

                {/* CABEÇALHO COMPACTO DO TÍTULO DA DEMANDA */}
                <div className="flex items-start justify-between gap-1.5 min-w-0">
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-xs font-black tracking-wide uppercase font-mono truncate ${markerText}`} title={col.titulo}>
                      {col.titulo}
                    </h3>
                    {col.subtitulo && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5" title={col.subtitulo}>
                        {col.subtitulo}
                      </p>
                    )}
                  </div>

                  {/* CONTADOR DE TAREFAS */}
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    concluidos === totalItens && totalItens > 0
                      ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {concluidos}/{totalItens}
                  </span>
                </div>

                {/* METADADOS COMPACTOS: ALERTA + PRAZO + DICA DE HOVER */}
                <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-slate-800/60 text-[9px] font-mono">
                  {col.alertaDestaque ? (
                    <span className="text-rose-400 font-bold flex items-center gap-0.5 truncate" title={col.alertaDestaque}>
                      <AlertOctagon size={10} className="text-rose-400 flex-shrink-0 animate-pulse" />
                      <span className="truncate">{col.alertaDestaque}</span>
                    </span>
                  ) : col.dataLimite && colPrazo.status !== 'sem_prazo' ? (
                    <span className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded ${colPrazo.badgeClass}`}>
                      <Clock size={8} />
                      <span>{colPrazo.rotuloCurto || colPrazo.rotulo}</span>
                    </span>
                  ) : (
                    <span className="text-slate-500">Passe o mouse 👁️</span>
                  )}

                  <span className="text-cyan-400/80 font-bold text-[9px] flex items-center gap-0.5">
                    {visibleItens.length} tarefas
                  </span>
                </div>

                {/* ── POPOVER FLUTUANTE SUSPENSO (ABRE NO HOVER SEM EMPURRAR NADA) ── */}
                {isHovered && (
                  <div
                    onMouseEnter={() => triggerHover(col, visibleItens)}
                    onMouseLeave={() => triggerHover(null)}
                    className={`absolute top-[calc(100%+6px)] ${
                      isRightCol ? 'right-0' : 'left-0'
                    } w-[320px] sm:w-[360px] max-h-[420px] overflow-y-auto no-scrollbar bg-[#080d1a] border border-cyan-400/80 rounded-xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.95)] z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100`}
                  >
                    {/* TOPO DO POPOVER COM TÍTULO E AÇÕES DA DEMANDA */}
                    <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
                      <div>
                        <h4 className={`text-xs font-black uppercase font-mono ${markerText}`}>
                          {col.titulo}
                        </h4>
                        <span className="text-[10px] text-cyan-300/80 font-mono">
                          ⚡ Projetando tarefas no cronograma mensal
                        </span>
                      </div>

                      {/* AÇÕES DA DEMANDA */}
                      <div className="flex items-center gap-1">
                        {onArchiveDemand && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Arquivar a demanda "${col.titulo}" da lousa ativa?`)) {
                                onArchiveDemand(col.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-amber-300 hover:bg-amber-950/50 rounded"
                            title="Arquivar demanda inteira"
                          >
                            <Archive size={12} />
                          </button>
                        )}
                        {onEditDemand && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditDemand(col);
                            }}
                            className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/50 rounded"
                            title="Editar demanda"
                          >
                            <Settings2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* LISTA COMPLETA DE TAREFAS DENTRO DO POPOVER */}
                    <div className="space-y-1.5 max-h-[260px] overflow-y-auto no-scrollbar pr-0.5">
                      {visibleItens.length === 0 ? (
                        <p className="text-center py-4 text-xs text-slate-500 font-mono">
                          Nenhuma tarefa pendente nesta demanda
                        </p>
                      ) : (
                        visibleItens.map((item, idx) => {
                          const itemPrazo = calculatePrazoInfo(item.dataLimite, item.concluido);
                          return (
                            <div
                              key={item.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleItem(col.id, item.id);
                              }}
                              className={`group/task flex items-start justify-between gap-1.5 p-2 rounded-lg border transition-all cursor-pointer ${
                                item.concluido
                                  ? 'bg-slate-900/50 border-slate-800 opacity-60'
                                  : 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/80'
                              }`}
                            >
                              <div className="flex items-start gap-1.5 min-w-0">
                                {/* CHECKBOX */}
                                <div
                                  className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                                    item.concluido
                                      ? 'bg-rose-500 border-rose-500 text-white'
                                      : 'border-slate-600 bg-slate-950'
                                  }`}
                                >
                                  {item.concluido && <Check size={10} strokeWidth={3} className="text-white" />}
                                </div>

                                <div className="min-w-0">
                                  {/* RESPONSÁVEIS */}
                                  <div className="flex items-center flex-wrap gap-1 mb-0.5">
                                    {extractResponsaveisList(item).map((resp) => (
                                      <span
                                        key={resp}
                                        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-rose-950/80 border border-rose-500/50 text-rose-300"
                                      >
                                        <User size={8} />
                                        {resp}
                                      </span>
                                    ))}

                                    {item.dataLimite && itemPrazo.status !== 'sem_prazo' && (
                                      <span className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-mono ${itemPrazo.badgeClass}`}>
                                        <Clock size={8} />
                                        {itemPrazo.rotuloCurto || itemPrazo.rotulo}
                                      </span>
                                    )}
                                  </div>

                                  <p className={`text-xs font-semibold leading-snug ${
                                    item.concluido ? 'line-through text-slate-500' : 'text-slate-200'
                                  }`}>
                                    {item.texto}
                                  </p>
                                </div>
                              </div>

                              {/* AÇÕES NA TAREFA */}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                {onOpenFullEdit && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenFullEdit(col.id, item);
                                    }}
                                    className="p-1 text-slate-400 hover:text-cyan-300"
                                    title="Editar tarefa"
                                  >
                                    <Edit3 size={11} />
                                  </button>
                                )}
                                {onArchiveItem && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onArchiveItem(col.id, item.id);
                                    }}
                                    className="p-1 text-slate-400 hover:text-amber-300"
                                    title="Finalizar e arquivar"
                                  >
                                    <Archive size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* BOTÃO PARA ADICIONAR TAREFA NO POPOVER */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800">
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
                            placeholder="Texto da nova tarefa..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            className="w-full bg-slate-950 border border-cyan-500/70 rounded px-2 py-1 text-xs text-white uppercase font-mono focus:outline-none"
                          />
                          <div className="grid grid-cols-2 gap-1">
                            <input
                              type="text"
                              list="col-responsavel-suggestions"
                              placeholder="Responsáveis..."
                              value={inputResp}
                              onChange={(e) => setInputResp(e.target.value)}
                              className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-rose-300 uppercase font-mono"
                            />
                            <input
                              type="date"
                              value={inputDate}
                              onChange={(e) => setInputDate(e.target.value)}
                              className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white font-mono"
                            />
                          </div>
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setActiveInputColId(null)}
                              className="px-2 py-0.5 text-[10px] text-slate-400"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="px-2 py-0.5 rounded bg-cyan-600 text-white text-[10px] font-bold"
                            >
                              Salvar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveInputColId(col.id);
                            setInputText('');
                            setInputResp('');
                            setInputDate('');
                          }}
                          className="w-full flex items-center justify-center gap-1 py-1 rounded bg-slate-900 border border-dashed border-slate-700 hover:border-cyan-500/50 text-[11px] text-slate-300 font-bold hover:text-white"
                        >
                          <Plus size={11} />
                          <span>Adicionar Tarefa</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CASO 2: MODO LINHAS (CADA DEMANDA EM 1 LINHA HORIZONTAL COM ESTEIRA) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeLayout === 'rows' && (
        <div className="space-y-2">
          {activeColunas.map((col) => {
            let visibleItens = col.itens.filter(it => !it.arquivado);
            if (filterResponsible) {
              visibleItens = visibleItens.filter(
                it => extractResponsaveisList(it).includes(filterResponsible.toUpperCase())
              );
            }

            const totalItens = col.itens.filter(i => !i.arquivado).length;
            const concluidos = col.itens.filter(i => !i.arquivado && i.concluido).length;
            const markerBar = getMarkerBarColor(col.corMarcador);
            const markerText = getMarkerTextColor(col.corMarcador);
            const colPrazo = calculatePrazoInfo(col.dataLimite);
            const isHovered = hoveredColId === col.id;

            return (
              <div
                key={col.id}
                onMouseEnter={() => triggerHover(col, visibleItens)}
                onMouseLeave={() => triggerHover(null)}
                className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-xl border transition-all ticker-hover-pause ${
                  isHovered
                    ? 'bg-[#0f172a] border-cyan-400 ring-1 ring-cyan-400/50'
                    : 'bg-[#0b1120]/90 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* COLUNA FIXA DA DEMANDA À ESQUERDA */}
                <div className="w-full sm:w-56 md:w-64 flex-shrink-0 flex items-center justify-between gap-2 border-b sm:border-b-0 sm:border-r border-slate-800/80 pb-1.5 sm:pb-0 sm:pr-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1.5 h-6 rounded-full flex-shrink-0 ${markerBar}`} />
                    <div className="min-w-0">
                      <h3 className={`text-xs font-black uppercase font-mono truncate ${markerText}`} title={col.titulo}>
                        {col.titulo}
                      </h3>
                      {col.subtitulo && (
                        <p className="text-[9px] text-slate-400 truncate leading-none">
                          {col.subtitulo}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 font-mono text-[10px] flex-shrink-0">
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">
                      {concluidos}/{totalItens}
                    </span>
                    {onEditDemand && (
                      <button
                        type="button"
                        onClick={() => onEditDemand(col)}
                        className="p-1 text-slate-400 hover:text-cyan-300"
                        title="Editar demanda"
                      >
                        <Settings2 size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ESTEIRA HORIZONTAL DE TAREFAS */}
                <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-1.5 py-0.5">
                  {visibleItens.length === 0 ? (
                    <span className="text-xs text-slate-500 font-mono italic px-2">
                      Sem pendências ativas
                    </span>
                  ) : (
                    visibleItens.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onToggleItem(col.id, item.id)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-all ${
                          item.concluido
                            ? 'bg-slate-900/50 border-slate-800 opacity-60 text-slate-400 line-through'
                            : 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800 text-slate-200'
                        }`}
                        title={item.texto}
                      >
                        {/* CHECKBOX */}
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border ${
                            item.concluido ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-600 bg-slate-950'
                          }`}
                        >
                          {item.concluido && <Check size={10} strokeWidth={3} />}
                        </div>

                        {/* BADGES DOS RESPONSÁVEIS */}
                        {extractResponsaveisList(item).map((resp) => (
                          <span
                            key={resp}
                            className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-rose-950 border border-rose-500/40 text-rose-300 flex-shrink-0"
                          >
                            {resp}
                          </span>
                        ))}

                        <span className="font-semibold truncate max-w-[220px]">
                          {item.texto}
                        </span>
                      </div>
                    ))
                  )}

                  {/* ADICIONAR TAREFA RÁPIDA */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveInputColId(col.id);
                      const texto = window.prompt(`Nova tarefa para "${col.titulo}":`);
                      if (texto?.trim()) {
                        onAddItem(col.id, texto.trim());
                      }
                    }}
                    className="flex-shrink-0 px-2 py-1 rounded-lg border border-dashed border-slate-800 hover:border-cyan-500/50 text-[10px] text-slate-400 hover:text-white font-bold flex items-center gap-1"
                  >
                    <Plus size={10} />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CASO 3: MODO EXPANDIDO (VISÃO CLÁSSICA EM GRADE COM TODAS AS TAREFAS) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeLayout === 'expanded' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {activeColunas.map((col) => {
            let visibleItens = col.itens.filter(it => !it.arquivado);
            if (filterResponsible) {
              visibleItens = visibleItens.filter(
                it => extractResponsaveisList(it).includes(filterResponsible.toUpperCase())
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

                {/* CABEÇALHO DA DEMANDA */}
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

                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 flex-shrink-0">
                      {concluidos}/{totalItens}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-1">
                    {col.dataLimite && colPrazo.status !== 'sem_prazo' ? (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wide ${colPrazo.badgeClass}`}>
                        <Clock size={9} />
                        <span>{colPrazo.rotulo}</span>
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-600">Sem prazo limite</span>
                    )}

                    <div className="flex items-center gap-0.5 opacity-90 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity">
                      {onArchiveDemand && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Deseja arquivar a demanda "${col.titulo}" e ocultá-la da lousa ativa?`)) {
                              onArchiveDemand(col.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-amber-300 hover:bg-amber-950/50 rounded transition-colors"
                          title="Arquivar demanda inteira"
                        >
                          <Archive size={12} />
                        </button>
                      )}

                      {onEditDemand && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditDemand(col);
                          }}
                          className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/50 rounded transition-colors"
                          title="Editar demanda"
                        >
                          <Settings2 size={12} />
                        </button>
                      )}

                      {onDeleteDemand && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`ATENÇÃO: Deseja realmente excluir a demanda "${col.titulo}" permanentemente?`)) {
                              onDeleteDemand(col.id);
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded transition-colors"
                          title="Excluir demanda"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ALERTA EM DESTAQUE */}
                {col.alertaDestaque && (
                  <div className="mb-2.5 px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 flex items-center gap-1.5 animate-pulse">
                    <AlertOctagon size={12} className="text-rose-400 flex-shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 font-mono">
                      {col.alertaDestaque}
                    </span>
                  </div>
                )}

                {/* LISTA DE ITENS */}
                <div className="flex-1 space-y-1.5 min-h-[140px]">
                  {visibleItens.map((item, index) => {
                    const isEditingThis = editingItemId === item.id;
                    const isDraggingThis = draggedItem?.itemId === item.id;
                    const isDragOverThis = dragOverItemIndex?.columnId === col.id && dragOverItemIndex?.index === index;
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
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white uppercase font-mono"
                          />
                          <div className="grid grid-cols-2 gap-1">
                            <input
                              type="text"
                              list="col-responsavel-suggestions"
                              value={editResp}
                              onChange={(e) => setEditResp(e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-rose-300 uppercase font-mono"
                            />
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white font-mono"
                            />
                          </div>
                          <div className="flex justify-end gap-1 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingItemId(null)}
                              className="p-1 rounded text-slate-400 hover:text-white"
                            >
                              <X size={12} />
                            </button>
                            <button
                              type="submit"
                              className="px-2 py-0.5 rounded bg-cyan-600 text-white text-[10px] font-bold"
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
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-1.5 min-w-0">
                          <div className="mt-0.5 text-slate-600 group-hover/item:text-slate-400 cursor-grab active:cursor-grabbing p-0.5">
                            <GripVertical size={11} />
                          </div>

                          <div
                            className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                              item.concluido ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'border-slate-600 bg-slate-950'
                            }`}
                          >
                            {item.concluido && <Check size={11} strokeWidth={3} />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center flex-wrap gap-1 mb-0.5">
                              {extractResponsaveisList(item).map((resp) => (
                                <span
                                  key={resp}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-950 border border-rose-500/60 text-rose-300"
                                >
                                  <User size={8} />
                                  {resp}
                                </span>
                              ))}

                              {item.dataLimite && itemPrazo.status !== 'sem_prazo' && (
                                <span className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-mono ${itemPrazo.badgeClass}`}>
                                  <Clock size={8} />
                                  {itemPrazo.rotuloCurto || itemPrazo.rotulo}
                                </span>
                              )}
                            </div>

                            <span className={`text-xs font-semibold leading-snug ${
                              item.concluido ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}>
                              {item.texto}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity">
                          {onOpenFullEdit ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenFullEdit(col.id, item);
                              }}
                              className="p-1 text-slate-400 hover:text-cyan-300"
                              title="Editar tarefa"
                            >
                              <Edit3 size={11} />
                            </button>
                          ) : (
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
                          )}

                          {onArchiveItem && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onArchiveItem(col.id, item.id);
                              }}
                              className="p-1 text-slate-400 hover:text-amber-300"
                              title="Finalizar e arquivar"
                            >
                              <Archive size={11} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteItem(col.id, item.id);
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ADICIONAR NOVA TAREFA NA COLUNA */}
                <div className="pt-2 mt-2 border-t border-slate-800/80">
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
                        className="w-full bg-slate-950 border border-cyan-500/60 rounded px-2 py-1 text-xs text-white uppercase font-mono"
                      />
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          type="text"
                          list="col-responsavel-suggestions"
                          placeholder="Responsáveis..."
                          value={inputResp}
                          onChange={(e) => setInputResp(e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-rose-300 uppercase font-mono"
                        />
                        <input
                          type="date"
                          value={inputDate}
                          onChange={(e) => setInputDate(e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white font-mono"
                        />
                      </div>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveInputColId(null)}
                          className="px-2 py-0.5 text-xs text-slate-400 hover:text-white"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-0.5 rounded bg-cyan-600 text-white text-xs font-bold"
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
      )}
    </section>
  );
}
