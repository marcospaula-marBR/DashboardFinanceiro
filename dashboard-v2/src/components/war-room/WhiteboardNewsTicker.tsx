"use client";

import React, { useState } from 'react';
import { MemberActiveTaskGroup, MemberActiveTask, getResponsibleColor } from '@/services/war-room.service';
import { Pause, Zap, Check, AlertTriangle, Clock, Calendar, Users, ChevronRight, Activity, Radio } from 'lucide-react';

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
      className="w-full bg-[#050811] border border-slate-700/80 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 min-h-[48px] sm:min-h-[52px] flex items-center overflow-hidden z-20 group/ticker ticker-container shadow-lg relative transition-all"
    >
      {/* ── BADGE FIXO DO RADAR (MAIOR VISIBILIDADE E FONTE ROBUSTA) ── */}
      <div className="flex items-center gap-2 bg-rose-600/25 border border-rose-500/50 text-rose-300 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-[13px] font-black uppercase tracking-wider flex-shrink-0 mr-3.5 shadow-md font-mono">
        {isHovered ? (
          <>
            <Pause size={15} className="text-amber-400" />
            <span className="text-amber-300">RADAR PAUSADO</span>
          </>
        ) : (
          <>
            <Radio size={15} className="animate-pulse text-cyan-400" />
            <span className="text-cyan-200">RADAR LOUSA</span>
          </>
        )}

        {totalAtrasadas > 0 && (
          <span className="ml-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] sm:text-xs font-black animate-pulse shadow-sm">
            {totalAtrasadas} atr
          </span>
        )}
      </div>

      {/* ── ESTEIRA EM MOVIMENTO CONTÍNUO: 5 ATIVIDADES POR RESPONSÁVEL COM MAIOR VISIBILIDADE ── */}
      <div
        className="flex-1 overflow-hidden relative cursor-default"
        title="Passe o mouse para pausar a leitura e marcar pendências"
      >
        {memberTaskGroups.length === 0 ? (
          <div className="text-sm text-emerald-400 font-mono flex items-center gap-2 font-bold">
            <Check size={16} />
            <span>TODAS AS ATIVIDADES HUMANAS ESTÃO CONCLUÍDAS E EM DIA! PARABÉNS À EQUIPE!</span>
          </div>
        ) : (
          <div
            className="flex whitespace-nowrap animate-marquee items-center gap-10 sm:gap-12 text-xs sm:text-[13px] font-mono"
            style={{ animationPlayState: isHovered ? 'paused' : 'running' }}
          >
            {/* Duplicar lista para efeito contínuo infinito no CSS Marquee sem cortes visuais */}
            {[...memberTaskGroups, ...memberTaskGroups].map((group, groupIdx) => {
              const colorCfg = getResponsibleColor(group.nome);
              const isSelected = selectedMember?.toUpperCase() === group.nome.toUpperCase();

              return (
                <div
                  key={`${group.nome}-${groupIdx}`}
                  className="inline-flex items-center gap-3 flex-shrink-0 py-0.5"
                >
                  {/* TAG ROBUSTA DO RESPONSÁVEL COM SUA COR */}
                  <button
                    type="button"
                    onClick={() => onSelectMember && onSelectMember(isSelected ? null : group.nome)}
                    className={`inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs sm:text-[13px] font-black uppercase tracking-wider border shadow-md transition-all ${
                      isSelected
                        ? `${colorCfg.pillActiveClass} ring-2 ring-white shadow-lg scale-105`
                        : `${colorCfg.badgeClass} hover:opacity-100`
                    }`}
                    title={`Clique para filtrar por ${group.nome}`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${group.atrasadas > 0 ? 'animate-ping' : ''}`}
                      style={{ backgroundColor: colorCfg.hex }}
                    />
                    <span>{group.nome}</span>
                    <span className="text-[11px] opacity-80 font-mono">
                      ({group.tarefas.length})
                    </span>
                  </button>

                  {/* AS ATÉ 5 TAREFAS POR ORDEM CRESCENTE DE DATA COM CAIXAS E FONTES AMPLIADAS */}
                  <div className="inline-flex items-center gap-2.5">
                    {group.tarefas.map((task) => (
                      <span
                        key={task.id}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs sm:text-[13px] shadow-sm transition-all ${
                          task.isOverdue
                            ? 'bg-rose-950/70 border-rose-500/90 text-rose-100 ring-1 ring-rose-500/50 shadow-md'
                            : 'bg-slate-900/95 border-slate-700 text-slate-100 hover:border-slate-500'
                        }`}
                        title={`${task.texto} • ${task.prazoTexto} • Origem: ${task.origemNome}`}
                      >
                        {/* CHECKBOX AMPLIADO PARA LIQUIDAR NA ESTEIRA */}
                        {onToggleItem && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleItem(task.origem, task.origemId, task.itemId);
                            }}
                            className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-all ${
                              task.isOverdue
                                ? 'border-rose-400 bg-slate-950 hover:bg-rose-600 hover:text-white'
                                : 'border-slate-500 bg-slate-950 hover:bg-emerald-600 hover:text-white'
                            }`}
                            title="Marcar como concluída (a próxima da fila assume esta posição)"
                          >
                            <Check size={11} strokeWidth={3} className="text-slate-400 hover:text-white" />
                          </button>
                        )}

                        {/* BADGE DE PRAZO/DATA AMPLIADO */}
                        {task.isOverdue ? (
                          <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-black uppercase bg-rose-600 text-white animate-pulse flex-shrink-0 shadow-sm">
                            🚨 {task.prazoTexto}
                          </span>
                        ) : task.sortWeight === 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-black uppercase bg-amber-500 text-slate-950 flex-shrink-0 shadow-sm">
                            ⭐ {task.prazoTexto}
                          </span>
                        ) : task.dia ? (
                          <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-black font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 flex-shrink-0">
                            {task.prazoTexto}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-black font-mono bg-slate-800 text-slate-300 border border-slate-700 flex-shrink-0">
                            {task.prazoTexto}
                          </span>
                        )}

                        {/* TEXTO DA TAREFA AMPLIADO E NÍTIDO */}
                        <span className="font-bold text-slate-100 max-w-[280px] sm:max-w-[340px] truncate">
                          {task.texto}
                        </span>

                        {/* ORIGEM RESUMIDA */}
                        <span className="text-[10px] text-slate-400 font-mono">
                          [{task.origemNome.slice(0, 12)}]
                        </span>
                      </span>
                    ))}
                  </div>

                  {/* SEPARADOR ENTRE RESPONSÁVEIS */}
                  <span className="text-slate-600 font-black px-2 text-sm sm:text-base">•</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DICA NO CANTO DIREITO ── */}
      <div className="hidden 2xl:flex items-center text-xs text-slate-400 font-mono ml-3.5 flex-shrink-0 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800 shadow-sm">
        {isHovered ? '⚡ Clique no check para liquidar' : 'Hover para pausar e marcar'}
      </div>
    </div>
  );
}
