"use client";

import React from 'react';
import { 
  Landmark, 
  CreditCard, 
  Globe, 
  FileCheck, 
  CalendarClock,
  CheckCircle2, 
  Circle, 
  AlertCircle,
  Plus
} from 'lucide-react';
import { StrategicPillar, StrategicDemandItem, PillarId } from '@/types/war-room';

interface WarRoomStrategicPillarsProps {
  pillars: StrategicPillar[];
  onToggleDemand: (itemId: string) => void;
  onOpenManagement: () => void;
}

const PILLAR_ICONS: Record<PillarId, any> = {
  contabilidade: Landmark,
  gateways: CreditCard,
  cambio: Globe,
  remessa: FileCheck,
  lancamentos: CalendarClock,
};

const PILLAR_COLORS: Record<PillarId, { accent: string; border: string; glow: string }> = {
  contabilidade: { accent: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.12)]' },
  gateways: { accent: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-[0_0_15px_rgba(6,182,212,0.12)]' },
  cambio: { accent: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.12)]' },
  remessa: { accent: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.12)]' },
  lancamentos: { accent: 'text-indigo-400', border: 'border-indigo-500/30', glow: 'shadow-[0_0_15px_rgba(99,102,241,0.12)]' },
};

export function WarRoomStrategicPillars({
  pillars,
  onToggleDemand,
  onOpenManagement
}: WarRoomStrategicPillarsProps) {
  return (
    <div className="w-full">
      {/* CABEÇALHO DA SEÇÃO */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></div>
          <h2 className="text-sm font-black uppercase text-slate-200 tracking-wider">
            Painel Estratégico de Demandas & Projetos (5 Pilares Operacionais)
          </h2>
        </div>
        <button
          onClick={onOpenManagement}
          className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Plus size={14} />
          <span>Nova Demanda</span>
        </button>
      </div>

      {/* GRID DOS 5 PILARES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {pillars.map(pillar => {
          const Icon = PILLAR_ICONS[pillar.id] || Landmark;
          const colors = PILLAR_COLORS[pillar.id] || PILLAR_COLORS.contabilidade;
          
          const totalItens = pillar.itens.length;
          const concluidos = pillar.itens.filter(i => i.concluida).length;
          const percent = totalItens > 0 ? Math.round((concluidos / totalItens) * 100) : 0;
          const temCriticaPendente = pillar.itens.some(i => !i.concluida && i.prioridade === 'critica');

          return (
            <div
              key={pillar.id}
              className={`rounded-2xl bg-slate-900/80 border ${colors.border} p-3.5 flex flex-col justify-between backdrop-blur-sm ${colors.glow} hover:bg-slate-900 transition-all`}
            >
              <div>
                {/* CABEÇALHO DO PILAR */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 ${colors.accent} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block leading-none">
                        Pilar {pillar.numero}
                      </span>
                      <h3 className="text-xs font-black uppercase text-slate-100 truncate mt-0.5" title={pillar.nome}>
                        {pillar.nome}
                      </h3>
                    </div>
                  </div>

                  {temCriticaPendente && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0" title="Demanda Crítica Pendente" />
                  )}
                </div>

                {/* PROGRESSO */}
                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1">
                    <span>{concluidos}/{totalItens} concluídas</span>
                    <span className="font-mono text-cyan-400 font-bold">{percent}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* LISTAGEM DE DEMANDAS / CHECKLIST */}
                <div className="mt-3 space-y-1.5">
                  {pillar.itens.map(item => {
                    const isDone = item.concluida;
                    const isCrit = item.prioridade === 'critica';
                    const isAlta = item.prioridade === 'alta';

                    return (
                      <div
                        key={item.id}
                        onClick={() => onToggleDemand(item.id)}
                        className={`p-2 rounded-xl border text-xs flex items-start gap-2 transition-all cursor-pointer ${
                          isDone
                            ? 'bg-slate-950/40 border-slate-800/40 text-slate-500 line-through'
                            : isCrit
                            ? 'bg-rose-950/20 border-rose-500/40 text-slate-200 shadow-xs'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <button
                          type="button"
                          className="mt-0.5 text-slate-400 hover:text-white flex-shrink-0 cursor-pointer"
                        >
                          {isDone ? (
                            <CheckCircle2 size={14} className="text-emerald-400" />
                          ) : (
                            <Circle size={14} className={isCrit ? 'text-rose-400' : 'text-slate-500'} />
                          )}
                        </button>

                        <div className="min-w-0 flex-1 leading-snug">
                          <p className="font-medium text-[11px] truncate-2-lines">
                            {item.titulo}
                          </p>

                          <div className="flex items-center gap-1.5 mt-1 text-[9px]">
                            {isCrit && !isDone && (
                              <span className="px-1 py-0.2 rounded font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                Crítico
                              </span>
                            )}
                            {isAlta && !isDone && (
                              <span className="px-1 py-0.2 rounded font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Alta
                              </span>
                            )}
                            {item.responsavel && (
                              <span className="text-slate-500">
                                {item.responsavel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FOOTER DO PILAR */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 flex items-center justify-between">
                <span>{pillar.subtitulo}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
