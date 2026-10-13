"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  WhiteboardTimelineBlock, 
  WhiteboardTimelineItem, 
  WhiteboardItem,
  WhiteboardWeekdayBlock,
  WhiteboardWeekdayItem,
  WeekdayKey
} from '@/types/war-room';
import { 
  extractResponsaveisList, 
  getResponsibleColor,
  DEFAULT_WEEKDAY_BLOCKS
} from '@/services/war-room.service';
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
  Zap,
  Target,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  Calendar
} from 'lucide-react';

export type TimelineLayoutMode = 'rows' | 'grid' | 'week';

interface WhiteboardTimelineProps {
  cronograma: WhiteboardTimelineBlock[];
  gradeSemanal?: WhiteboardWeekdayBlock[];
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
  newsTickerSlot?: React.ReactNode;
  onToggleDemandItem?: (colId: string, itemId: string) => void;
  onToggleItem: (blockId: string, itemId: string) => void;
  onAddItem: (blockId: string, dia: number, descricao: string, responsavel?: string, responsaveis?: string[]) => void;
  onEditItem: (blockId: string, itemId: string, dia: number, descricao: string, responsavel?: string, novosResponsaveis?: string[]) => void;
  onDeleteItem: (blockId: string, itemId: string) => void;
  onReorderItem?: (blockId: string, startIndex: number, endIndex: number) => void;
  onMoveItemBetweenBlocks?: (sourceBlockId: string, targetBlockId: string, itemId: string, targetIndex?: number) => void;
  onResetCycle?: () => void;
  onToggleWeekdayItem?: (diaSemana: WeekdayKey, itemId: string) => void;
  onAddWeekdayItem?: (diaSemana: WeekdayKey, descricao: string, responsavel?: string, responsaveis?: string[]) => void;
  onEditWeekdayItem?: (diaSemana: WeekdayKey, itemId: string, descricao: string, responsaveis: string[]) => void;
  onDeleteWeekdayItem?: (diaSemana: WeekdayKey, itemId: string) => void;
  onResetWeekdayCycle?: () => void;
}

export function WhiteboardTimeline({
  cronograma,
  gradeSemanal,
  mesReferencia,
  filterResponsible,
  onlyOverdue,
  layoutMode: initialLayoutMode = 'rows',
  onLayoutModeChange,
  hoveredDemand,
  newsTickerSlot,
  onToggleDemandItem,
  onToggleItem,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onReorderItem,
  onMoveItemBetweenBlocks,
  onResetCycle,
  onToggleWeekdayItem,
  onAddWeekdayItem,
  onEditWeekdayItem,
  onDeleteWeekdayItem,
  onResetWeekdayCycle,
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

  // Estados da Grade Semanal Recorrente
  const CANONICAL_MEMBERS = ['MARCOS', 'MATHEUS', 'MELISSA', 'GUILHERME', 'FINANCEIRO', 'JURÍDICO', 'CONTÁBIL', 'TI'] as const;
  const weekdayBlocks = (gradeSemanal && gradeSemanal.length === 5) ? gradeSemanal : DEFAULT_WEEKDAY_BLOCKS;

  const [activeInputWeekday, setActiveInputWeekday] = useState<WeekdayKey | null>(null);
  const [inputWeekdayDesc, setInputWeekdayDesc] = useState<string>('');
  const [inputWeekdayResps, setInputWeekdayResps] = useState<string[]>(['MARCOS']);

  const [editingWeekdayState, setEditingWeekdayState] = useState<{
    diaSemana: WeekdayKey;
    diaNome: string;
    item: WhiteboardWeekdayItem;
  } | null>(null);
  const [editWeekdayDesc, setEditWeekdayDesc] = useState<string>('');
  const [editWeekdayResps, setEditWeekdayResps] = useState<string[]>([]);

  // Estados de edição da tarefa do calendário (Modal executivo completo)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockIntervalo, setEditingBlockIntervalo] = useState<string>('');
  const [editingItem, setEditingItem] = useState<WhiteboardTimelineItem | null>(null);
  const [editDia, setEditDia] = useState<number>(todayDay);
  const [editDesc, setEditDesc] = useState<string>('');
  const [editResponsaveis, setEditResponsaveis] = useState<string[]>([]);
  const [customRespInput, setCustomRespInput] = useState<string>('');

  // Estados de Drag & Drop
  const [draggedItem, setDraggedItem] = useState<{ blockId: string; itemId: string; index: number } | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<{ blockId: string; index: number } | null>(null);

  // Estados e controle de Rolagem Vertical (esconder superiores ao rolar na vertical)
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolledDown, setHasScrolledDown] = useState(false);
  const [hasMoreBelow, setHasMoreBelow] = useState(true);
  const [isHeightExpanded, setIsHeightExpanded] = useState(false);

  const checkScrollState = () => {
    const el = rowsContainerRef.current;
    if (!el) return;
    setHasScrolledDown(el.scrollTop > 20);
    setHasMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 20);
  };

  useEffect(() => {
    checkScrollState();
  }, [cronograma, activeLayout, isHeightExpanded]);

  const scrollToTop = () => {
    if (rowsContainerRef.current) {
      rowsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    if (rowsContainerRef.current) {
      rowsContainerRef.current.scrollTo({
        top: rowsContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const scrollToToday = () => {
    if (rowsContainerRef.current) {
      if (todayDay >= 16) {
        scrollToBottom();
      } else {
        scrollToTop();
      }
    }
  };

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

  const handleStartEdit = (block: WhiteboardTimelineBlock, item: WhiteboardTimelineItem) => {
    setEditingBlockId(block.id);
    setEditingBlockIntervalo(block.intervalo);
    setEditingItem(item);
    setEditDia(item.dia);
    setEditDesc(item.descricao);
    setEditResponsaveis(extractResponsaveisList(item));
    setCustomRespInput('');
  };

  const handleChangeEditDia = (novoDia: number) => {
    const diaLimitado = Math.max(1, Math.min(31, Math.floor(novoDia)));
    setEditDia(diaLimitado);
    setEditDesc(prev => {
      const match = prev.trim().match(/^(\d{1,2})\s*[-–—:]?\s*(.*)$/);
      const textoBase = match ? (match[2].trim() || 'OBRIGAÇÃO') : prev.trim();
      return `${String(diaLimitado).padStart(2, '0')} - ${textoBase}`;
    });
  };

  const handleToggleEditResp = (respName: string) => {
    const upper = respName.trim().toUpperCase();
    if (!upper) return;
    setEditResponsaveis(prev => 
      prev.includes(upper) ? prev.filter(r => r !== upper) : [...prev, upper]
    );
  };

  const handleSaveModalEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingItem || !editingBlockId || !editDesc.trim()) {
      setEditingItem(null);
      return;
    }
    const diaValido = editDia >= 1 && editDia <= 31 ? editDia : editingItem.dia;
    const resps = Array.from(new Set(editResponsaveis.filter(Boolean)));
    onEditItem(
      editingBlockId,
      editingItem.id,
      diaValido,
      editDesc.trim(),
      resps.join(', ') || undefined,
      resps
    );
    setEditingItem(null);
  };

  const handleDeleteEditingItem = () => {
    if (!editingItem || !editingBlockId) return;
    if (window.confirm(`Deseja realmente excluir a obrigação "${editingItem.descricao}" do calendário?`)) {
      onDeleteItem(editingBlockId, editingItem.id);
      setEditingItem(null);
    }
  };

  // ── HANDLERS DA GRADE SEMANAL RECORRENTE ──
  const handleStartEditWeekday = (diaSemana: WeekdayKey, item: WhiteboardWeekdayItem) => {
    const block = weekdayBlocks.find(b => b.diaSemana === diaSemana);
    setEditingWeekdayState({
      diaSemana,
      diaNome: block ? block.nome : diaSemana.toUpperCase(),
      item,
    });
    setEditWeekdayDesc(item.descricao);
    setEditWeekdayResps(extractResponsaveisList(item.responsaveis || item.responsavel));
  };

  const handleSaveNewWeekdayItem = (diaSemana: WeekdayKey) => {
    if (!inputWeekdayDesc.trim()) {
      setActiveInputWeekday(null);
      return;
    }
    const resps = inputWeekdayResps.length > 0 ? inputWeekdayResps : ['MARCOS'];
    onAddWeekdayItem?.(diaSemana, inputWeekdayDesc.trim().toUpperCase(), resps[0], resps);
    setInputWeekdayDesc('');
    setInputWeekdayResps(['MARCOS']);
    setActiveInputWeekday(null);
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
        <option value="MARCOS" />
        <option value="MATHEUS" />
        <option value="MELISSA" />
        <option value="GUILHERME" />
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

        {/* CONTROLES: NAVEGAÇÃO VERTICAL, ALTERNAR MODO LINHAS/GRADE E RENOVAR CICLO */}
        <div className="flex items-center flex-wrap gap-2">
          {/* ATALHOS DE NAVEGAÇÃO VERTICAL (OCULTAR SUPERIORES / FOCAR) */}
          {activeLayout === 'rows' && !isHeightExpanded && (
            <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono">
              <button
                type="button"
                onClick={scrollToToday}
                title="Rolar verticalmente diretamente para o período de hoje"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-cyan-300 hover:text-white hover:bg-cyan-950 font-bold transition-all"
              >
                <Target size={11} className="text-cyan-400" />
                <span>Hoje</span>
              </button>

              <button
                type="button"
                onClick={scrollToTop}
                title="Rolar para a 1ª Quinzena (01 a 15) no topo"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 font-bold transition-all"
              >
                <ChevronUp size={11} />
                <span>01-15</span>
              </button>

              <button
                type="button"
                onClick={scrollToBottom}
                title="Rolar para a 2ª Quinzena (16 a 31), ocultando as superiores"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 font-bold transition-all"
              >
                <ChevronDown size={11} />
                <span>16-31</span>
              </button>
            </div>
          )}

          {/* TOGGLE EXPANDIR / COMPACTAR ALTURA DA TIMELINE */}
          {activeLayout === 'rows' && (
            <button
              type="button"
              onClick={() => setIsHeightExpanded(prev => !prev)}
              title={isHeightExpanded ? 'Compactar com rolagem vertical' : 'Expandir todos os 6 períodos'}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-mono transition-all"
            >
              {isHeightExpanded ? <Minimize2 size={11} className="text-amber-400" /> : <Maximize2 size={11} className="text-cyan-400" />}
              <span>{isHeightExpanded ? 'Rolagem TV' : 'Expandir'}</span>
            </button>
          )}

          {/* SELETOR DE MODO: LINHAS (TV) / GRADE (6 BLOCOS) / GRADE SEMANAL */}
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
              title="Modo Grade: visualização em 6 caixas verticais por período do mês."
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                activeLayout === 'grid'
                  ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={12} className={activeLayout === 'grid' ? 'text-white' : 'text-cyan-400'} />
              <span>Grade (6 Blocos)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetLayoutMode('week')}
              title="Modo Grade Semanal: visualização em 5 colunas (Segunda a Sexta) para rotinas e atividades específicas recorrentes."
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                activeLayout === 'week'
                  ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarSync size={12} className={activeLayout === 'week' ? 'text-white' : 'text-cyan-400'} />
              <span>Grade Semanal (5 Dias)</span>
            </button>
          </div>

          {activeLayout === 'week' ? (
            onResetWeekdayCycle && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Deseja desmarcar todas as rotinas semanais para iniciar um novo ciclo da semana? As atividades e responsáveis permanecerão salvos.')) {
                    onResetWeekdayCycle();
                  }
                }}
                title="Desmarcar todos os checks para o novo ciclo semanal"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-sm"
              >
                <RotateCcw size={11} className="text-cyan-400" />
                <span>Renovar Semana</span>
              </button>
            )
          ) : (
            onResetCycle && (
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
            )
          )}
        </div>
      </div>

      {/* ── RADAR LOUSA: TAREFAS POR MEMBROS DA EQUIPE (LOGO ACIMA DOS CARDS DAS GRADES DO CALENDÁRIO) ── */}
      {newsTickerSlot && (
        <div className="mb-3">
          {newsTickerSlot}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CASO 1: VISÃO EM LINHAS HORIZONTAIS COM ESTEIRA (PADRÃO PARA TV)     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeLayout === 'rows' && (
        <div className="relative group/timeline-scroll">
          {/* SINALIZADOR SUPERIOR SE HOUVER LINHAS OCULTAS ACIMA */}
          {hasScrolledDown && !isHeightExpanded && (
            <button
              type="button"
              onClick={scrollToTop}
              className="w-full mb-1.5 py-0.5 px-2 bg-gradient-to-r from-cyan-950/80 via-[#0b1426] to-cyan-950/80 border border-cyan-500/40 rounded-lg text-[10px] text-cyan-300 font-mono font-bold flex items-center justify-center gap-1.5 hover:bg-cyan-900/60 transition-all shadow-sm animate-pulse"
              title="Clique para rolar de volta para as linhas do topo"
            >
              <ChevronUp size={11} />
              <span>▲ Linhas superiores ocultas (01 a 15) • Clique ou role para cima</span>
            </button>
          )}

          <div
            ref={rowsContainerRef}
            onScroll={checkScrollState}
            className={`space-y-2 transition-all scroll-smooth ${
              isHeightExpanded
                ? ''
                : 'max-h-[220px] sm:max-h-[260px] overflow-y-auto no-scrollbar pr-1'
            }`}
          >
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

                      {extractResponsaveisList(demandTask).map((resp) => {
                        const respColor = getResponsibleColor(resp);
                        return (
                          <span
                            key={resp}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border flex-shrink-0 ${respColor.badgeClass}`}
                            title={`Responsável: ${resp} (${respColor.label})`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: respColor.hex }} />
                            <span>{resp}</span>
                          </span>
                        );
                      })}

                      <span className="font-bold truncate max-w-[240px]">
                        {demandTask.texto}
                      </span>
                    </div>
                  ))}

                  {/* ── LISTA DE OBRIGAÇÕES DO BLOCO ── */}
                  {sortedItens.map((item, index) => {
                    const isOverdue = !item.concluido && item.dia < todayDay;

                    return (
                      <div
                        key={item.id}
                        draggable={!editingItem}
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
                        {extractResponsaveisList(item).map((resp) => {
                          const respColor = getResponsibleColor(resp);
                          return (
                            <span
                              key={resp}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border flex-shrink-0 ${respColor.badgeClass}`}
                              title={`Responsável: ${resp} (${respColor.label})`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: respColor.hex }} />
                              <span>{resp}</span>
                            </span>
                          );
                        })}

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
                              handleStartEdit(block, item);
                            }}
                            className="p-0.5 text-slate-400 hover:text-cyan-300"
                            title="Editar Obrigação"
                          >
                            <Edit3 size={11} />
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

          {/* SINALIZADOR INFERIOR SE HOUVER MAIS PERÍODOS ABAIXO */}
          {hasMoreBelow && !isHeightExpanded && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="w-full mt-1.5 py-0.5 px-2 bg-gradient-to-r from-slate-900 via-[#0b1426] to-slate-900 border border-slate-700/80 hover:border-cyan-500/50 rounded-lg text-[10px] text-slate-300 font-mono font-bold flex items-center justify-center gap-1.5 hover:text-white transition-all shadow-sm"
              title="Clique para rolar para a 2ª Quinzena (16 a 31), ocultando as superiores"
            >
              <ChevronDown size={11} />
              <span>▼ Mais períodos abaixo (16 a 31) • Role para baixo para ocultar as superiores</span>
            </button>
          )}
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
                      <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                        <span className="px-1 py-0.2 rounded bg-cyan-900 text-[8px] font-black uppercase">
                          ⚡ {hoveredDemand?.titulo.split(':')[0]}
                        </span>
                        {extractResponsaveisList(demandTask).map((resp) => {
                          const respColor = getResponsibleColor(resp);
                          return (
                            <span
                              key={resp}
                              className={`inline-flex items-center gap-1 px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border flex-shrink-0 ${respColor.badgeClass}`}
                              title={`Responsável: ${resp} (${respColor.label})`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: respColor.hex }} />
                              <span>{resp}</span>
                            </span>
                          );
                        })}
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
                        draggable={!editingItem}
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
                              {extractResponsaveisList(item).map((resp) => {
                                const respColor = getResponsibleColor(resp);
                                return (
                                  <span
                                    key={resp}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border flex-shrink-0 ${respColor.badgeClass}`}
                                    title={`Responsável: ${resp} (${respColor.label})`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: respColor.hex }} />
                                    <span>{resp}</span>
                                  </span>
                                );
                              })}

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
                              handleStartEdit(block, item);
                            }}
                            className="p-1 text-slate-400 hover:text-cyan-300"
                            title="Editar Obrigação"
                          >
                            <Edit3 size={12} />
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

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CASO 3: VISÃO EM GRADE SEMANAL (5 DIAS: SEGUNDA A SEXTA)             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeLayout === 'week' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-xs text-slate-400">
            <span className="font-mono text-[11px] text-cyan-400 flex items-center gap-1.5 font-bold">
              <CalendarSync size={13} />
              Rotinas recorrentes da semana • Execução contínua de Segunda a Sexta
            </span>
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
              Hoje é {['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][today.getDay()]}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {weekdayBlocks.map((block) => {
              const jsDay = today.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
              const weekdayKeyMap: Record<WeekdayKey, number> = {
                seg: 1,
                ter: 2,
                qua: 3,
                qui: 4,
                sex: 5,
              };
              const isCurrentWeekday = jsDay === weekdayKeyMap[block.diaSemana];
              const isPastWeekday = jsDay > weekdayKeyMap[block.diaSemana] && jsDay <= 5;

              let sortedItens = block.itens.slice();
              if (filterResponsible) {
                sortedItens = sortedItens.filter(it =>
                  extractResponsaveisList(it.responsaveis || it.responsavel).includes(filterResponsible.toUpperCase())
                );
              }
              if (onlyOverdue) {
                sortedItens = sortedItens.filter(it => !it.concluido && isPastWeekday);
              }

              const totalItens = block.itens.length;
              const concluidos = block.itens.filter(i => i.concluido).length;
              const pendentesAtrasados = block.itens.filter(i => !i.concluido && isPastWeekday).length;

              return (
                <div
                  key={block.diaSemana}
                  className={`flex flex-col rounded-xl p-3 border transition-all relative ${
                    isCurrentWeekday
                      ? 'bg-[#0f172a] border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                      : pendentesAtrasados > 0
                      ? 'bg-[#0f1424] border-rose-500/40 hover:border-rose-500/70'
                      : 'bg-[#0b1120]/90 border-slate-800/80 hover:border-slate-700/80'
                  }`}
                >
                  {isCurrentWeekday && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                      <span>⭐ DIA DE HOJE</span>
                    </div>
                  )}

                  {/* CABEÇALHO DO DIA */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 pt-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`font-mono text-xs sm:text-sm font-black tracking-wide ${
                        isCurrentWeekday ? 'text-cyan-400' : 'text-slate-200'
                      }`}>
                        {block.sigla}
                      </span>
                      <span className="text-[10px] sm:text-xs text-slate-400 font-semibold truncate">
                        • {block.nome.split('-')[0]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[10px] flex-shrink-0">
                      {pendentesAtrasados > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-600/30 border border-rose-500/50 text-rose-300 font-bold animate-pulse">
                          {pendentesAtrasados} pend
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                        {concluidos}/{totalItens}
                      </span>
                    </div>
                  </div>

                  {/* ITENS DA ROTINA DO DIA */}
                  <div className="flex-1 space-y-1.5 min-h-[140px]">
                    {sortedItens.length === 0 ? (
                      <div className="p-3 rounded-lg border border-dashed border-slate-800 text-center text-[11px] text-slate-400 italic">
                        Nenhuma rotina cadastrada
                      </div>
                    ) : (
                      sortedItens.map((item) => {
                        const resps = extractResponsaveisList(item.responsaveis || item.responsavel);
                        return (
                          <div
                            key={item.id}
                            onClick={() => onToggleWeekdayItem?.(block.diaSemana, item.id)}
                            className={`group/witem flex items-start justify-between gap-1.5 p-2 rounded-lg border cursor-pointer transition-all ${
                              item.concluido
                                ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                                : isCurrentWeekday
                                ? 'bg-cyan-950/20 border-cyan-900/40 hover:border-cyan-500/40'
                                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start gap-1.5 min-w-0 flex-1">
                              <div
                                className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                                  item.concluido ? 'bg-cyan-500 border-cyan-500 text-slate-950 shadow-sm' : 'border-slate-600 bg-slate-950'
                                }`}
                              >
                                {item.concluido && <Check size={10} strokeWidth={3} />}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center flex-wrap gap-1 leading-tight mb-1">
                                  {resps.map((resp) => {
                                    const respColor = getResponsibleColor(resp);
                                    return (
                                      <span
                                        key={resp}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border flex-shrink-0 ${respColor.badgeClass}`}
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: respColor.hex }} />
                                        <span>{resp}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                                <p className={`text-xs font-semibold leading-tight break-words ${
                                  item.concluido ? 'line-through text-slate-400' : 'text-slate-200'
                                }`}>
                                  {item.descricao}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center opacity-0 group-hover/witem:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditWeekday(block.diaSemana, item);
                                }}
                                className="p-1 text-slate-400 hover:text-cyan-300"
                                title="Editar Rotina"
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Excluir a rotina "${item.descricao}"?`)) {
                                    onDeleteWeekdayItem?.(block.diaSemana, item.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-400"
                                title="Excluir Rotina"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* ADICIONAR NOVA ROTINA NESTE DIA */}
                  <div className="pt-2 mt-2 border-t border-slate-800/80">
                    {activeInputWeekday === block.diaSemana ? (
                      <div className="p-2 rounded-lg bg-slate-950 border border-cyan-500/50 space-y-2">
                        <input
                          type="text"
                          value={inputWeekdayDesc}
                          onChange={(e) => setInputWeekdayDesc(e.target.value)}
                          placeholder="Descrição da rotina..."
                          autoFocus
                          className="w-full px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-cyan-400 font-mono"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNewWeekdayItem(block.diaSemana);
                            if (e.key === 'Escape') setActiveInputWeekday(null);
                          }}
                        />

                        {/* SELETOR DE RESPONSÁVEIS */}
                        <div className="flex flex-wrap gap-1">
                          {CANONICAL_MEMBERS.map(m => {
                            const isSelected = inputWeekdayResps.includes(m);
                            const c = getResponsibleColor(m);
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  setInputWeekdayResps(prev =>
                                    prev.includes(m) ? prev.filter(r => r !== m) : [...prev, m]
                                  );
                                }}
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border transition-all ${
                                  isSelected ? c.pillActiveClass : 'bg-slate-900 border-slate-800 text-slate-400'
                                }`}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setActiveInputWeekday(null)}
                            className="px-2 py-1 text-[10px] text-slate-400 hover:text-white rounded"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveNewWeekdayItem(block.diaSemana)}
                            disabled={!inputWeekdayDesc.trim()}
                            className="px-2.5 py-1 text-[10px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded disabled:opacity-50"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveInputWeekday(block.diaSemana);
                          setInputWeekdayDesc('');
                          setInputWeekdayResps(['MARCOS']);
                        }}
                        className="w-full py-1.5 px-2 rounded-lg border border-dashed border-slate-800 hover:border-cyan-500/50 text-[10px] text-slate-400 hover:text-cyan-300 font-bold flex items-center justify-center gap-1 transition-all"
                      >
                        <Plus size={11} />
                        <span>Adicionar Rotina</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL EXECUTIVO DE EDIÇÃO DA TAREFA DO CALENDÁRIO ── */}
      {editingItem && editingBlockId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setEditingItem(null)}
        >
          <div 
            className="w-full max-w-lg bg-[#090e1a] border border-cyan-500/50 rounded-2xl shadow-2xl shadow-cyan-950/50 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* CABEÇALHO DO MODAL */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#060a13]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/90 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase text-white font-mono tracking-wide">
                    EDITAR OBRIGAÇÃO DO CALENDÁRIO
                  </h3>
                  <span className="text-[11px] text-cyan-400 font-mono">
                    Período: {editingBlockIntervalo}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* FORMULÁRIO */}
            <form onSubmit={handleSaveModalEdit} className="p-4 sm:p-5 space-y-4">
              {/* CAMPO DIA DO MÊS */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase font-mono mb-1.5">
                  Dia de Vencimento no Mês (1 a 31):
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleChangeEditDia(editDia - 1)}
                    className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold flex items-center justify-center hover:bg-slate-800 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={editDia}
                    onChange={(e) => handleChangeEditDia(parseInt(e.target.value, 10) || 1)}
                    className="w-20 px-3 py-2 rounded-xl bg-slate-950 border border-cyan-500/50 text-cyan-300 font-mono font-black text-center text-base focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleChangeEditDia(editDia + 1)}
                    className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold flex items-center justify-center hover:bg-slate-800 transition-colors"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-400 font-mono">
                    {`Dia ${String(editDia).padStart(2, '0')} do mês`}
                  </span>
                </div>
              </div>

              {/* CAMPO DESCRIÇÃO DA OBRIGAÇÃO */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase font-mono mb-1.5">
                  Descrição da Obrigação:
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Ex: 25 - RECORRENTES DZM"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  required
                />
              </div>

              {/* SELETOR DE RESPONSÁVEIS OFICIAIS */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase font-mono mb-1.5 flex items-center justify-between">
                  <span>Responsáveis Atribuídos (Apenas Cadastrados):</span>
                  <span className="text-[10px] text-cyan-400 font-normal">
                    {editResponsaveis.length} selecionado{editResponsaveis.length !== 1 ? 's' : ''}
                  </span>
                </label>

                {/* BOTÕES DE CLIQUE RÁPIDO PARA MEMBROS REAIS CADASTRADOS */}
                <div className="flex flex-wrap gap-1.5">
                  {['MARCOS', 'MATHEUS', 'MELISSA', 'GUILHERME', 'FINANCEIRO', 'JURÍDICO', 'CONTÁBIL', 'TI'].map(memberName => {
                    const isSelected = editResponsaveis.includes(memberName);
                    const colorConfig = getResponsibleColor(memberName);

                    return (
                      <button
                        key={memberName}
                        type="button"
                        onClick={() => handleToggleEditResp(memberName)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all border ${
                          isSelected
                            ? colorConfig.pillActiveClass
                            : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-500'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${colorConfig.dotClass}`} />
                        <span>{memberName}</span>
                        {isSelected && <Check size={11} className="stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RODAPÉ DO MODAL COM AÇÕES */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2">
                <button
                  type="button"
                  onClick={handleDeleteEditingItem}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all"
                >
                  <Trash2 size={13} />
                  <span>Excluir</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs font-mono shadow-lg shadow-cyan-950/50 transition-all min-h-[38px]"
                  >
                    <Check size={14} className="stroke-[3]" />
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── MODAL EXECUTIVO DE EDIÇÃO DA ROTINA SEMANAL ── */}
      {editingWeekdayState && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setEditingWeekdayState(null)}
        >
          <div 
            className="w-full max-w-lg bg-[#090e1a] border border-cyan-500/50 rounded-2xl shadow-2xl shadow-cyan-950/50 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* CABEÇALHO DO MODAL */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#060a13]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/90 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <CalendarSync size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase text-white font-mono tracking-wide">
                    EDITAR ROTINA SEMANAL
                  </h3>
                  <span className="text-[11px] text-cyan-400 font-mono">
                    Dia: {editingWeekdayState.diaNome}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingWeekdayState(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* FORMULÁRIO */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!editWeekdayDesc.trim()) return;
                onEditWeekdayItem?.(
                  editingWeekdayState.diaSemana,
                  editingWeekdayState.item.id,
                  editWeekdayDesc.trim().toUpperCase(),
                  editWeekdayResps
                );
                setEditingWeekdayState(null);
              }} 
              className="p-4 sm:p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase font-mono mb-1.5">
                  Descrição da Rotina:
                </label>
                <input
                  type="text"
                  value={editWeekdayDesc}
                  onChange={(e) => setEditWeekdayDesc(e.target.value)}
                  placeholder="Ex: FECHAMENTO OPERACIONAL & PREVISÃO DE CAIXA"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase font-mono mb-1.5 flex items-center justify-between">
                  <span>Responsáveis Atribuídos (Apenas Cadastrados):</span>
                  <span className="text-[10px] text-cyan-400 font-normal">
                    {editWeekdayResps.length} selecionado{editWeekdayResps.length !== 1 ? 's' : ''}
                  </span>
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {CANONICAL_MEMBERS.map(memberName => {
                    const isSelected = editWeekdayResps.includes(memberName);
                    const colorConfig = getResponsibleColor(memberName);

                    return (
                      <button
                        key={memberName}
                        type="button"
                        onClick={() => {
                          setEditWeekdayResps(prev =>
                            prev.includes(memberName) 
                              ? prev.filter(r => r !== memberName) 
                              : [...prev, memberName]
                          );
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all border ${
                          isSelected
                            ? colorConfig.pillActiveClass
                            : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-500'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${colorConfig.dotClass}`} />
                        <span>{memberName}</span>
                        {isSelected && <Check size={11} className="stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Deseja excluir a rotina "${editingWeekdayState.item.descricao}"?`)) {
                      onDeleteWeekdayItem?.(editingWeekdayState.diaSemana, editingWeekdayState.item.id);
                      setEditingWeekdayState(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-bold transition-all"
                >
                  <Trash2 size={13} />
                  <span>Excluir Rotina</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingWeekdayState(null)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!editWeekdayDesc.trim()}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs font-mono shadow-lg shadow-cyan-950/50 transition-all min-h-[38px] disabled:opacity-50"
                  >
                    <Check size={14} className="stroke-[3]" />
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
