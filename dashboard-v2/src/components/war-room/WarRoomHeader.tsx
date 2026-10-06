"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  Tv, 
  Maximize2, 
  Minimize2, 
  Settings2, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  CalendarDays,
  Radio
} from 'lucide-react';
import { WarRoomSummaryCounters } from '@/types/war-room';

interface WarRoomHeaderProps {
  counters: WarRoomSummaryCounters;
  isTvMode: boolean;
  onToggleTvMode: () => void;
  onOpenManagement: () => void;
  onOpenTodayModal: () => void;
}

export function WarRoomHeader({
  counters,
  isTvMode,
  onToggleTvMode,
  onOpenManagement,
  onOpenTodayModal
}: WarRoomHeaderProps) {
  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      
      const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });
      const day = now.getDate();
      const month = now.toLocaleDateString('pt-BR', { month: 'long' });
      const year = now.getFullYear();
      setDateStr(`${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} de ${month} de ${year}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="w-full bg-slate-950/90 border-b border-slate-800/80 px-4 py-2.5 sm:px-6 backdrop-blur-md sticky top-0 z-40 transition-all select-none">
      <div className="max-w-[1920px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-3">
        
        {/* LADO ESQUERDO: Branding + Frases Operacionais */}
        <div className="flex items-center gap-3.5 w-full lg:w-auto justify-between lg:justify-start">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all group cursor-pointer"
            title="Voltar à tela inicial do Portal"
          >
            <ChevronLeft size={16} className="text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Voltar ao Início</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] flex-shrink-0">
              <Tv size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-wider uppercase text-white leading-none">
                  Lousa Digital Operacional
                </h1>
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 tracking-wider">
                  War Room TV
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-0.5 flex flex-wrap items-center gap-x-2">
                <span className="text-emerald-400 font-semibold tracking-wide">
                  &ldquo;Pessoas, Técnica e Propósito em cada entrega&rdquo;
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-300/90 italic">
                  &ldquo;Pagar certo, faturar certo, fechar certo&rdquo;
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: Badges de Alerta + Relógio + Controles */}
        <div className="flex items-center gap-3 sm:gap-4 w-full lg:w-auto justify-between lg:justify-end">
          
          {/* BADGES EM TEMPO REAL */}
          <div className="flex items-center gap-2">
            {/* Atrasados */}
            {counters.atrasadosCount > 0 ? (
              <button
                onClick={onOpenTodayModal}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-bold animate-pulse hover:bg-rose-900/60 transition-colors shadow-[0_0_12px_rgba(244,63,94,0.3)] cursor-pointer"
                title="Clique para ver obrigações atrasadas"
              >
                <AlertTriangle size={13} className="text-rose-400" />
                <span>{counters.atrasadosCount} Atrasados</span>
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-900 text-slate-500 border border-slate-800">
                0 Atrasos
              </span>
            )}

            {/* Vencendo Hoje */}
            <button
              onClick={onOpenTodayModal}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                counters.vencendoHojeCount > 0
                  ? 'bg-amber-950/80 border border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:bg-amber-900/60'
                  : 'bg-slate-900 border border-slate-800 text-slate-400'
              }`}
              title="Clique para ver contas com vencimento hoje"
            >
              <CalendarDays size={13} className={counters.vencendoHojeCount > 0 ? 'text-amber-400' : 'text-slate-500'} />
              <span>{counters.vencendoHojeCount} Hoje</span>
            </button>

            {/* Seguros em Alerta */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                counters.segurosAlertaCount > 0
                  ? 'bg-blue-950/80 border border-blue-500/50 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                  : 'bg-slate-900 border border-slate-800 text-slate-500'
              }`}
            >
              <ShieldAlert size={13} className={counters.segurosAlertaCount > 0 ? 'text-blue-400' : 'text-slate-500'} />
              <span>{counters.segurosAlertaCount} Seguros &lt;30d</span>
            </div>
          </div>

          {/* STATUS CONEXÃO REALTIME + RELÓGIO */}
          <div className="flex items-center gap-3 pl-2 sm:pl-3 border-l border-slate-800">
            <div className="hidden xl:flex flex-col text-right">
              <span className="text-[11px] font-medium text-slate-400 leading-tight">{dateStr}</span>
              <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Live War Room</span>
              </div>
            </div>

            {/* RELÓGIO DIGITAL ESTILO TERMINAL */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 border border-slate-700/80 rounded-xl font-mono text-sm sm:text-base font-black text-cyan-300 tracking-wider shadow-inner">
              <Clock size={15} className="text-cyan-400 animate-pulse" />
              <span>{time || '--:--:--'}</span>
            </div>

            {/* BOTÕES DE AÇÃO: MODO TV + GESTÃO */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenManagement}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Abrir painel de gestão da equipe para adicionar/dar baixa"
              >
                <Settings2 size={15} className="text-cyan-400" />
                <span className="hidden sm:inline">Gestão</span>
              </button>

              <button
                onClick={onToggleTvMode}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isTvMode
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
                title={isTvMode ? 'Sair do Modo TV (Esc)' : 'Ativar Modo TV Fullscreen (F)'}
              >
                {isTvMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                <span className="hidden sm:inline">{isTvMode ? 'Sair TV' : 'Modo TV'}</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
}
