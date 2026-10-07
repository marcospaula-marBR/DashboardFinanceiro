"use client";

import React, { useMemo, useState } from 'react';
import { WhiteboardColumn, WhiteboardTimelineBlock } from '@/types/war-room';
import { extractResponsaveisList, getResponsibleColor } from '@/services/war-room.service';
import { User, Check, AlertTriangle, Clock, Calendar, CheckCircle2, ChevronRight, Filter, X, ArrowRight, Users } from 'lucide-react';

interface ResponsibleTask {
  id: string;
  itemId: string; // ID real da tarefa
  origem: 'cronograma' | 'coluna';
  origemId: string; // blockId ou columnId
  origemNome: string;
  dia?: number;
  texto: string;
  concluido: boolean;
  isOverdue: boolean;
  responsavel: string;
}

interface ResponsibleGroup {
  nome: string;
  tarefas: ResponsibleTask[];
  total: number;
  concluidos: number;
  pendentes: number;
  atrasados: number;
  hasOverdue: boolean;
}

interface WhiteboardResponsibleBoardProps {
  colunas: WhiteboardColumn[];
  cronograma: WhiteboardTimelineBlock[];
  onToggleColumnItem: (colId: string, itemId: string) => void;
  onToggleTimelineItem: (blockId: string, itemId: string) => void;
  onSelectResponsible?: (name: string | null) => void;
  selectedResponsible?: string | null;
  onClose?: () => void;
}

export function WhiteboardResponsibleBoard({
  colunas,
  cronograma,
  onToggleColumnItem,
  onToggleTimelineItem,
  onSelectResponsible,
  selectedResponsible,
  onClose,
}: WhiteboardResponsibleBoardProps) {
  const today = new Date();
  const todayDay = today.getDate();

  // Compilar todas as tarefas e agrupar por responsável (com suporte a múltiplos responsáveis)
  const { groups, totalAtrasadosGeral, totalTarefasGeral } = useMemo(() => {
    const allTasks: ResponsibleTask[] = [];

    // 1. Tarefas do Cronograma
    cronograma.forEach(block => {
      block.itens.forEach(item => {
        const isOverdue = !item.concluido && item.dia < todayDay;
        const resps = extractResponsaveisList(item);
        if (resps.length === 0) {
          allTasks.push({
            id: item.id,
            itemId: item.id,
            origem: 'cronograma',
            origemId: block.id,
            origemNome: `Bloco ${block.intervalo}`,
            dia: item.dia,
            texto: item.descricao,
            concluido: item.concluido,
            isOverdue,
            responsavel: 'SEM RESPONSÁVEL',
          });
        } else {
          resps.forEach(resp => {
            allTasks.push({
              id: `${item.id}-${resp}`,
              itemId: item.id,
              origem: 'cronograma',
              origemId: block.id,
              origemNome: `Bloco ${block.intervalo}`,
              dia: item.dia,
              texto: item.descricao,
              concluido: item.concluido,
              isOverdue,
              responsavel: resp,
            });
          });
        }
      });
    });

    // 2. Tarefas das Colunas (apenas ativas, não arquivadas)
    colunas.forEach(col => {
      col.itens.forEach(item => {
        if (item.arquivado) return;
        const resps = extractResponsaveisList(item);
        if (resps.length === 0) {
          allTasks.push({
            id: item.id,
            itemId: item.id,
            origem: 'coluna',
            origemId: col.id,
            origemNome: col.titulo.replace(':', ''),
            texto: item.texto,
            concluido: item.concluido,
            isOverdue: false,
            responsavel: 'SEM RESPONSÁVEL',
          });
        } else {
          resps.forEach(resp => {
            allTasks.push({
              id: `${item.id}-${resp}`,
              itemId: item.id,
              origem: 'coluna',
              origemId: col.id,
              origemNome: col.titulo.replace(':', ''),
              texto: item.texto,
              concluido: item.concluido,
              isOverdue: false,
              responsavel: resp,
            });
          });
        }
      });
    });

    // Agrupar por responsável
    const map = new Map<string, ResponsibleTask[]>();
    allTasks.forEach(task => {
      if (!map.has(task.responsavel)) {
        map.set(task.responsavel, []);
      }
      map.get(task.responsavel)!.push(task);
    });

    let totalAtrasados = 0;
    const groupList: ResponsibleGroup[] = [];

    map.forEach((tarefas, nome) => {
      const total = tarefas.length;
      const concluidos = tarefas.filter(t => t.concluido).length;
      const pendentes = total - concluidos;
      const atrasados = tarefas.filter(t => t.isOverdue).length;
      totalAtrasados += atrasados;

      // Ordenar: primeiro as atrasadas, depois pendentes, depois concluídas
      const sorted = [...tarefas].sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (!a.concluido && b.concluido) return -1;
        if (a.concluido && !b.concluido) return 1;
        return 0;
      });

      groupList.push({
        nome,
        tarefas: sorted,
        total,
        concluidos,
        pendentes,
        atrasados,
        hasOverdue: atrasados > 0,
      });
    });

    // Ordenar grupos: primeiro quem tem atrasadas (hasOverdue DESC), depois quem tem mais tarefas pendentes
    groupList.sort((a, b) => {
      if (a.hasOverdue && !b.hasOverdue) return -1;
      if (!a.hasOverdue && b.hasOverdue) return 1;
      if (b.atrasados !== a.atrasados) return b.atrasados - a.atrasados;
      return b.pendentes - a.pendentes;
    });

    return {
      groups: groupList,
      totalAtrasadosGeral: totalAtrasados,
      totalTarefasGeral: allTasks.length,
    };
  }, [cronograma, colunas, todayDay]);

  return (
    <section className="w-full bg-[#070c18] border border-cyan-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl relative animate-in fade-in">
      {/* ── CABEÇALHO DO QUADRO DE RESPONSÁVEIS ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white font-mono flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              QUADRO OPERACIONAL POR RESPONSÁVEIS
            </h2>

            {/* SINALIZADOR GERAL PULSANTE DE ATRASO */}
            {totalAtrasadosGeral > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md animate-pulse">
                <AlertTriangle size={11} />
                {totalAtrasadosGeral} Atividade(s) Atrasada(s)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                <CheckCircle2 size={11} />
                100% Em Dia
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Distribuição de obrigações por executor humano • Sinalização visual com pulsar quando houver atraso na agenda
          </p>
        </div>

        {/* CONTROLES / FECHAR */}
        <div className="flex items-center gap-2">
          {selectedResponsible && onSelectResponsible && (
            <button
              type="button"
              onClick={() => onSelectResponsible(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold hover:text-white"
            >
              <Filter size={11} />
              <span>Limpar Filtro ({selectedResponsible})</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
              title="Fechar visão por responsáveis"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── GRID DOS CARDS DE CADA RESPONSÁVEL ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {groups.map(group => {
          const respColor = getResponsibleColor(group.nome);
          const isSelected = selectedResponsible?.toUpperCase() === group.nome.toUpperCase();

          return (
            <div
              key={group.nome}
              className={`flex flex-col rounded-xl p-3.5 border transition-all relative ${
                group.hasOverdue
                  ? 'bg-gradient-to-b from-rose-950/30 via-[#0b1120] to-[#070c18] border-rose-500/70 ring-1 ring-rose-500/40 shadow-lg shadow-rose-950/40'
                  : isSelected
                  ? `bg-slate-900/95 ${respColor.borderClass} ring-2 ${respColor.ringClass}`
                  : 'bg-[#0b1120]/90 border-slate-800/80 hover:border-slate-700'
              }`}
              style={{
                borderTopColor: group.hasOverdue ? undefined : respColor.hex,
                borderTopWidth: '3px',
              }}
            >
              {/* CABEÇALHO DO RESPONSÁVEL COM PULSAR SE ATRASADO */}
              <div className="flex items-start justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800/80">
                <div className="flex items-center gap-2 min-w-0">
                  {/* AVATAR / ÍCONE COM PING SE HOUVER ATRASO OU COR PERSONALIZADA */}
                  <div
                    className={`relative w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs uppercase flex-shrink-0 border transition-all ${
                      group.hasOverdue
                        ? 'bg-rose-600/30 border-rose-500/70 text-rose-300 ring-2 ring-rose-500/40'
                        : `${respColor.bgClass} ${respColor.borderClass} ${respColor.textClass}`
                    }`}
                  >
                    {group.hasOverdue ? (
                      <>
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        <AlertTriangle size={14} className="text-rose-400 animate-pulse" />
                      </>
                    ) : (
                      group.nome.slice(0, 2)
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: respColor.hex }} />
                      <h3 className="text-xs sm:text-sm font-black uppercase text-white truncate font-mono">
                        {group.nome}
                      </h3>
                      <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded border ${respColor.badgeClass}`}>
                        {respColor.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {group.concluidos}/{group.total} Concluídas ({group.pendentes} pendentes)
                    </p>
                  </div>
                </div>

                {/* SINALIZADOR PULSANTE DE ATRASO */}
                {group.hasOverdue ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse shadow-sm flex items-center gap-1 flex-shrink-0">
                    <AlertTriangle size={10} />
                    {group.atrasados} Atrasada{group.atrasados > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 flex-shrink-0">
                    {group.pendentes === 0 ? 'Concluído' : 'Em Dia'}
                  </span>
                )}
              </div>

              {/* LISTA DE TAREFAS DESTE RESPONSÁVEL */}
              <div className="flex-1 space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {group.tarefas.map(task => (
                  <div
                    key={`${task.origem}-${task.id}`}
                    onClick={() => {
                      if (task.origem === 'cronograma') {
                        onToggleTimelineItem(task.origemId, task.itemId);
                      } else {
                        onToggleColumnItem(task.origemId, task.itemId);
                      }
                    }}
                    className={`flex items-start justify-between gap-1.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                      task.isOverdue
                        ? 'bg-rose-950/40 border-rose-500/70 text-rose-200 ring-1 ring-rose-500/30'
                        : task.concluido
                        ? 'bg-slate-900/40 border-slate-800/60 text-slate-500 line-through opacity-60'
                        : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-1.5 min-w-0">
                      {/* CHECKBOX */}
                      <div
                        className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                          task.concluido
                            ? 'bg-rose-500 border-rose-500 text-white'
                            : task.isOverdue
                            ? 'border-rose-400 bg-slate-950'
                            : 'border-slate-600 bg-slate-950'
                        }`}
                      >
                        {task.concluido && <Check size={10} strokeWidth={3} className="text-white" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-1 mb-0.5">
                          {/* BADGE DE ORIGEM */}
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-slate-950 border border-slate-800 text-slate-400 uppercase">
                            {task.origemNome}
                          </span>

                          {/* BADGE PULSANTE DE ATRASO */}
                          {task.isOverdue && (
                            <span className="text-[8px] font-black px-1 py-0.2 rounded bg-rose-600 text-white uppercase animate-pulse">
                              ATRASO (Dia {task.dia})
                            </span>
                          )}
                        </div>

                        <p className={`text-[11px] font-semibold leading-tight ${task.isOverdue ? 'text-rose-100 font-bold' : ''}`}>
                          {task.texto}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* BOTÃO PARA FILTRAR A LOUSA POR ESTE RESPONSÁVEL */}
              {onSelectResponsible && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    {group.pendentes} pendente{group.pendentes !== 1 ? 's' : ''}
                  </span>

                  <button
                    type="button"
                    onClick={() => onSelectResponsible(isSelected ? null : group.nome)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-all shadow-sm ${
                      isSelected
                        ? `${respColor.pillActiveClass}`
                        : `${respColor.pillInactiveClass} hover:opacity-100`
                    }`}
                  >
                    <span>{isSelected ? 'Filtrado' : 'Filtrar Lousa'}</span>
                    <ArrowRight size={10} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
