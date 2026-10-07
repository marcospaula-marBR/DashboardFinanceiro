"use client";

import React, { useState } from 'react';
import { MemberActiveTaskGroup, MemberActiveTask, getResponsibleColor } from '@/services/war-room.service';
import { Pause, Zap, Check, AlertTriangle, Clock, Calendar, Users, ChevronRight, Activity } from 'lucide-react';

interface WhiteboardNewsTickerProps {
  memberTaskGroups: MemberActiveTaskGroup[];
  onToggleItem?: (origem: 'cronograma' | 'coluna', origemId: string, itemId: string) => void;
  onSelectMember?: (name: string | null) => void;
  selectedMember?: string | null;
  cotacaoUsdGs?: string;
}

export function WhiteboardNewsTicker({
  memberTaskGroups,
  onToggleItem,
  onSelectMember,
  selectedMember,
  cotacaoUsdGs,
}: WhiteboardNewsTickerProps) {
  const [isHovered, setIsHovered] = useState(false);

  const totalAtrasadas = memberTaskGroups.reduce((acc, g) => acc + g.atrasadas, 0);
  const totalTarefasNaFila = memberTaskGroups.reduce((acc, g) => acc + g.tarefas.length, 0);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full bg-[#070c18] border border-cyan-500/30 rounded-xl py-1.5 px-3 flex items-center overflow-hidden z-20 group/ticker ticker-container shadow-lg relative transition-all"
    >
      {/* ── BADGE FIXO DO RADAR SUPERIOR COM FEEDBACK DE PAUSA E CONTADORES ── */}
      <div className="flex items-center gap-1.5 bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex-shrink-0 mr-3 shadow-sm font-mono">
        {isHovered ? (
          <>
            <Pause size={12} className="text-amber-400" />
            <span className="text-amber-300">RADAR PAUSADO</span>
          </>
        ) : (
          <>
            <Activity size={12} className="text-cyan-400 animate-pulse" />
            <span className="text-cyan-200">RADAR 5 ATIVIDADES/MEMBRO</span>
          </>
        )}

        {totalAtrasadas > 0 && (
          <span className="ml-1 px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-black animate-pulse">
            {totalAtrasadas} atr
          </span>
        )}
      </div>

      {/* ── MARQUEE CONTÍNUO DE ATIVIDADES POR USUÁRIO (PAUSA NO HOVER) ── */}
      <div
        className="flex-1 overflow-hidden relative cursor-default"
        title="Passe o mouse para pausar e interagir diretamente com as atividades"
      >
        {memberTaskGroups.length === 0 ? (
          <div className="text-xs text-emerald-400 font-mono flex items-center gap-2">
            <Check size={14} />
            <span>TODAS AS ATIVIDADES HUMANAS ESTÃO CONCLUÍDAS E EM DIA! PARABÉNS À EQUIPE!</span>
          </div>
        ) : (
          <div
            className="flex whitespace-nowrap animate-marquee items-center gap-8 text-xs font-mono"
            style={{ animationPlayState: isHovered ? 'paused' : 'running' }}
          >
            {/* Duplicar lista para efeito contínuo sem corte visual */}
            {[...memberTaskGroups, ...memberTaskGroups].map((group, groupIdx) => {
              const colorCfg = getResponsibleColor(group.nome);
              const isSelected = selectedMember?.toUpperCase() === group.nome.toUpperCase();

              return (
                <div
                  key={`${group.nome}-${groupIdx}`}
                  className="inline-flex items-center gap-2.5 flex-shrink-0 py-0.5"
                >
                  {/* TAG DO MEMBRO (CLICÁVEL PARA FILTRAR) */}
                  <button
                    type="button"
                    onClick={() => onSelectMember && onSelectMember(isSelected ? null : group.nome)}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border transition-all ${
                      isSelected
                        ? `${colorCfg.pillActiveClass} ring-1 ring-white shadow-sm`
                        : `${colorCfg.badgeClass} hover:opacity-100`
                    }`}
                    title={`Clique para filtrar a lousa por ${group.nome}`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${group.atrasadas > 0 ? 'animate-ping' : ''}`}
                      style={{ backgroundColor: colorCfg.hex }}
                    />
                    <span>{group.nome}</span>
                    <span className="text-[9px] opacity-75">
                      ({group.tarefas.length}{group.totalAtivas > group.tarefas.length ? `/${group.totalAtivas}` : ''})
                    </span>
                  </button>

                  {/* AS ATÉ 5 ATIVIDADES DO MEMBRO ORDENADAS DA ATRASADA A VENCER */}
                  <div className="inline-flex items-center gap-1.5">
                    {group.tarefas.map((task) => (
                      <div
                        key={task.id}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] transition-all ${
                          task.isOverdue
                            ? 'bg-rose-950/60 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/40 shadow-sm'
                            : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-slate-500'
                        }`}
                        title={`${task.texto} • ${task.prazoTexto} • Origem: ${task.origemNome}`}
                      >
                        {/* CHECKBOX INTERATIVO NA ESTEIRA */}
                        {onToggleItem && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleItem(task.origem, task.origemId, task.itemId);
                            }}
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                              task.isOverdue
                                ? 'border-rose-400 bg-slate-950 hover:bg-rose-600 hover:text-white'
                                : 'border-slate-600 bg-slate-950 hover:bg-cyan-600 hover:text-white'
                            }`}
                            title="Marcar como concluída (a próxima da fila assumirá esta vaga)"
                          >
                            <Check size={9} strokeWidth={3} className="text-slate-400 hover:text-white" />
                          </button>
                        )}

                        {/* BADGE DE PRAZO/DATA */}
                        {task.isOverdue ? (
                          <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-rose-600 text-white animate-pulse flex-shrink-0">
                            🚨 {task.prazoTexto}
                          </span>
                        ) : task.sortWeight === 0 ? (
                          <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-amber-500 text-slate-950 flex-shrink-0">
                            ⭐ {task.prazoTexto}
                          </span>
                        ) : task.dia ? (
                          <span className="px-1 py-0.2 rounded text-[8px] font-black font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 flex-shrink-0">
                            {task.prazoTexto}
                          </span>
                        ) : null}

                        {/* TEXTO DA TAREFA */}
                        <span className="font-semibold max-w-[200px] truncate">
                          {task.texto}
                        </span>

                        {/* ORIGEM RESUMIDA */}
                        <span className="text-[8px] text-slate-500 font-mono">
                          [{task.origemNome.slice(0, 10)}]
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* SEPARADOR EXECUTIVO ENTRE MEMBROS */}
                  <span className="text-slate-700 font-black px-1.5">•</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DICA NO CANTO DIREITO ── */}
      <div className="hidden 2xl:flex items-center text-[10px] text-slate-400 font-mono ml-3 flex-shrink-0 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
        {isHovered ? '⚡ Clique no check para liquidar' : 'Hover para pausar e marcar'}
      </div>
    </div>
  );
}
