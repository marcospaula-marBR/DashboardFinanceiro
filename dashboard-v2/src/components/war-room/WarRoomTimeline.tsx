"use client";

import React, { useState } from 'react';
import { 
  Calendar, 
  Repeat, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { WarRoomObligation, WarRoomCompany } from '@/types/war-room';

interface WarRoomTimelineProps {
  obligations: WarRoomObligation[];
  onTogglePaid: (id: string) => void;
  onOpenDetails: () => void;
}

interface BlockDefinition {
  label: string;
  startDay: number;
  endDay: number;
}

const TIMELINE_BLOCKS: BlockDefinition[] = [
  { label: '01 a 05', startDay: 1, endDay: 5 },
  { label: '06 a 10', startDay: 6, endDay: 10 },
  { label: '11 a 15', startDay: 11, endDay: 15 },
  { label: '16 a 20', startDay: 16, endDay: 20 },
  { label: '21 a 25', startDay: 21, endDay: 25 },
  { label: '26 a 31', startDay: 26, endDay: 31 },
];

const COMPANY_BADGES: Record<WarRoomCompany, string> = {
  MarBR: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  DZM: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  G2: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  Conectius: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

export function WarRoomTimeline({
  obligations,
  onTogglePaid,
  onOpenDetails
}: WarRoomTimelineProps) {
  const [selectedBlockIdx, setSelectedBlockIdx] = useState<number | null>(null);

  const today = new Date().getDate();

  // Determina qual bloco contém o dia atual
  const currentBlockIdx = TIMELINE_BLOCKS.findIndex(
    b => today >= b.startDay && today <= b.endDay
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="w-full rounded-2xl bg-slate-900/80 border border-slate-800/80 p-4 sm:p-5 backdrop-blur-sm shadow-xl flex flex-col justify-between">
      
      {/* CABEÇALHO DA TIMELINE */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 flex items-center justify-center flex-shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black uppercase text-white tracking-wide">
              Timeline Linear de Obrigações Financeiras
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Segmentação mensal em blocos fixos com foco no dia corrente (Hoje: Dia {today})
            </p>
          </div>
        </div>

        <button
          onClick={onOpenDetails}
          className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Grade Completa de Títulos</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* BLOCOS DA LINHA DO TEMPO (GRID DE 6 COLUNAS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mt-4">
        {TIMELINE_BLOCKS.map((block, idx) => {
          const isCurrentBlock = idx === currentBlockIdx;
          const isSelected = selectedBlockIdx === idx;
          
          // Obrigações dentro deste bloco
          const blockObligations = obligations.filter(
            o => o.diaVencimento >= block.startDay && o.diaVencimento <= block.endDay
          );

          const totalValor = blockObligations.reduce((acc, curr) => acc + curr.valor, 0);
          const atrasadas = blockObligations.filter(o => o.status === 'atrasado');
          const hojeList = blockObligations.filter(o => o.status === 'hoje');
          const pagas = blockObligations.filter(o => o.status === 'pago');

          return (
            <div
              key={block.label}
              onClick={() => setSelectedBlockIdx(isSelected ? null : idx)}
              className={`relative rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer ${
                isCurrentBlock
                  ? 'bg-slate-900 border-2 border-cyan-500/80 shadow-[0_0_20px_rgba(6,182,212,0.25)] scale-[1.02] z-10'
                  : isSelected
                  ? 'bg-slate-900/90 border border-slate-700 shadow-md'
                  : 'bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/50'
              }`}
            >
              {/* BADGE DE BLOCO ATUAL */}
              {isCurrentBlock && (
                <div className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Sparkles size={10} />
                  <span>Em Foco</span>
                </div>
              )}

              <div>
                {/* CABEÇALHO DO BLOCO */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black font-mono text-slate-200 tracking-wider">
                      {block.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">dias</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {blockObligations.length} ob.
                  </span>
                </div>

                {/* VALOR DO BLOCO */}
                <div className="mt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Previsto</span>
                  <div className={`text-base font-black font-mono leading-tight ${isCurrentBlock ? 'text-cyan-300' : 'text-slate-200'}`}>
                    {formatCurrency(totalValor)}
                  </div>
                </div>

                {/* SINAIS DE STATUS (PILLS) */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {atrasadas.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-950/80 text-rose-300 border border-rose-600/40">
                      {atrasadas.length} atr.
                    </span>
                  )}
                  {hojeList.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-950/80 text-amber-300 border border-amber-600/40">
                      {hojeList.length} hoje
                    </span>
                  )}
                  {pagas.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                      {pagas.length} pagas
                    </span>
                  )}
                </div>

                {/* PREVIEW DOS PRINCIPAIS ITENS */}
                <div className="mt-2.5 space-y-1.5">
                  {blockObligations.slice(0, 2).map(ob => {
                    const badgeClass = COMPANY_BADGES[ob.empresa];
                    const isPaid = ob.status === 'pago';
                    return (
                      <div
                        key={ob.id}
                        className={`p-1.5 rounded-lg border text-[11px] leading-tight flex items-center justify-between gap-1 ${
                          isPaid
                            ? 'bg-slate-950/40 border-slate-800/40 opacity-60 line-through'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-bold text-slate-400 flex-shrink-0">
                            d.{ob.diaVencimento}
                          </span>
                          <span className={`px-1 py-0.2 rounded text-[8px] font-black uppercase border ${badgeClass}`}>
                            {ob.empresa}
                          </span>
                          <span className="font-medium text-slate-300 truncate">
                            {ob.titulo}
                          </span>
                        </div>

                        {ob.recorrente && (
                          <span title="Custo Recorrente Mensal" className="flex-shrink-0 inline-flex items-center">
                            <Repeat size={10} className="text-slate-500" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* INDICAÇÃO EXPANSÍVEL */}
              {blockObligations.length > 2 && (
                <div className="mt-2 text-[10px] text-center text-slate-500 hover:text-cyan-400 font-semibold transition-colors">
                  + {blockObligations.length - 2} obrigações
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
