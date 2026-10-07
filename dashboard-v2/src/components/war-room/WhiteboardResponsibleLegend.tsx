"use client";

import React from 'react';
import { getResponsibleColor, RESPONSIBLE_COLOR_MAP } from '@/services/war-room.service';
import { User, AlertTriangle, CheckCircle2, Users, Palette } from 'lucide-react';

interface WhiteboardResponsibleLegendProps {
  responsiblesList: string[]; // Lista de responsáveis presentes na lousa
  countsMap?: Record<string, { total: number; concluidos: number; pendentes: number; atrasados: number }>;
  selectedResponsible: string | null;
  onSelectResponsible: (name: string | null) => void;
  className?: string;
}

export function WhiteboardResponsibleLegend({
  responsiblesList,
  countsMap = {},
  selectedResponsible,
  onSelectResponsible,
  className = '',
}: WhiteboardResponsibleLegendProps) {
  // Garantir que todos os membros principais da equipe sempre constem na legenda se houver na lousa ou por padrão
  const defaultTeam = ['MANUS', 'CLARA', 'MARCO', 'ALDO', 'DAUREN', 'PRISCILLA', 'ADRIANA', 'FINANCEIRO', 'CONTÁBIL', 'JURÍDICO', 'TI'];
  
  // Unir a lista de presentes com os principais
  const allNames = Array.from(new Set([...responsiblesList, ...defaultTeam]))
    .filter(Boolean)
    .sort((a, b) => {
      // Priorizar os que têm pendências ativas
      const countA = countsMap[a]?.pendentes || 0;
      const countB = countsMap[b]?.pendentes || 0;
      if (countB !== countA) return countB - countA;
      return a.localeCompare(b);
    });

  return (
    <div className={`p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 shadow-md backdrop-blur-md ${className}`}>
      {/* CABEÇALHO DA LEGENDA */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/70">
        <div className="flex items-center gap-2">
          <Palette size={13} className="text-cyan-400" />
          <span className="text-[11px] font-black uppercase text-white font-mono tracking-wider flex items-center gap-1.5">
            <span>LEGENDA VISUAL POR MEMBRO & RESPONSÁVEL</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-normal">
              Memorize sua cor
            </span>
          </span>
        </div>

        {selectedResponsible && (
          <button
            type="button"
            onClick={() => onSelectResponsible(null)}
            className="text-[10px] font-mono text-cyan-400 hover:text-white font-bold underline transition-colors"
          >
            Limpar Filtro ({selectedResponsible})
          </button>
        )}
      </div>

      {/* ESTEIRA / GRADE HORIZONTAL DE CORES POR MEMBRO */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {allNames.map((name) => {
          const colorCfg = getResponsibleColor(name);
          const stats = countsMap[name];
          const isSelected = selectedResponsible?.toUpperCase() === name.toUpperCase();
          const hasOverdue = stats ? stats.atrasados > 0 : false;
          const pendentes = stats ? stats.pendentes : 0;

          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelectResponsible(isSelected ? null : name)}
              title={`${name} (${colorCfg.label}): ${pendentes} pendentes, ${stats?.atrasados || 0} atrasadas. Clique para filtrar.`}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                isSelected
                  ? `${colorCfg.pillActiveClass} scale-105 shadow-md`
                  : `${colorCfg.pillInactiveClass} bg-[#0b1120]`
              }`}
            >
              {/* BOLINHA BRILHANTE COM A COR MEMORIZÁVEL */}
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorCfg.dotClass} ${
                  hasOverdue ? 'animate-ping' : ''
                }`}
                style={{ backgroundColor: colorCfg.hex }}
              />

              {/* NOME DO MEMBRO */}
              <span className={`font-black uppercase tracking-wider ${isSelected ? 'text-white' : colorCfg.textClass}`}>
                {name}
              </span>

              {/* CONTADOR DE PENDÊNCIAS / ALERTA DE ATRASO */}
              {hasOverdue ? (
                <span className="px-1 py-0.2 rounded text-[9px] font-black bg-rose-600 text-white animate-pulse">
                  {stats?.atrasados} atr
                </span>
              ) : pendentes > 0 ? (
                <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400'
                }`}>
                  {pendentes}
                </span>
              ) : (
                <span className="text-[9px] text-slate-500">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
