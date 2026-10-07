"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Tv, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Users
} from 'lucide-react';

interface WhiteboardHeaderProps {
  isTvMode: boolean;
  onToggleTvMode: () => void;
  onResetDefault: () => void;
  onOpenAddModal: (tab?: 'demanda' | 'cambio' | 'cronograma') => void;
  totalConcluidos: number;
  totalItens: number;
  isResponsibleViewActive?: boolean;
  onToggleResponsibleView?: () => void;
  totalAtrasados?: number;
}

export function WhiteboardHeader({
  isTvMode,
  onToggleTvMode,
  onResetDefault,
  onOpenAddModal,
  totalConcluidos,
  totalItens,
  isResponsibleViewActive = false,
  onToggleResponsibleView,
  totalAtrasados = 0,
}: WhiteboardHeaderProps) {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setCurrentDate(
        now.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      );
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="w-full bg-[#070c18]/95 border-b border-slate-800/80 backdrop-blur-md px-3 sm:px-6 py-3 transition-all duration-300">
      {/* ── TOP SLOGANS INSTITUCIONAIS (FIÉIS À LOUSA) ── */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
        {/* SLOGAN ESQUERDO: MANUAL DE CULTURA MAR BRASIL */}
        <div className="flex items-center gap-2.5 text-center lg:text-left">
          <div className="w-2 h-8 bg-cyan-500 rounded-full hidden sm:block flex-shrink-0" />
          <div>
            <h1 className="text-xs sm:text-sm md:text-base font-black tracking-wide text-white uppercase flex flex-wrap items-center gap-2 justify-center lg:justify-start">
              <span>PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                MANUAL CULTURA MAR BRASIL
              </span>
            </h1>
          </div>
        </div>

        {/* RELÓGIO & STATUS AO VIVO */}
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-xl shadow-inner">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 font-mono">
              LOUSA AO VIVO
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2 text-slate-200">
            <Clock size={14} className="text-cyan-400" />
            <span className="font-mono text-xs sm:text-sm font-black tracking-wider text-white">
              {currentTime || '--:--:--'}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden md:block" />

          <span className="text-[11px] text-slate-400 font-medium capitalize hidden md:inline">
            {currentDate}
          </span>
        </div>

        {/* SLOGAN DIREITO: MANUAL DE CULTURA FINANCEIRA */}
        <div className="flex items-center gap-2.5 text-center lg:text-right">
          <div>
            <h2 className="text-xs sm:text-sm md:text-base font-black tracking-wide text-white uppercase flex flex-wrap items-center gap-2 justify-center lg:justify-end">
              <span>PAGAR CERTO, FATURAR CERTO, FECHAR CERTO!</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                MANUAL DE CULTURA FINANCEIRA
              </span>
            </h2>
          </div>
          <div className="w-2 h-8 bg-amber-500 rounded-full hidden sm:block flex-shrink-0" />
        </div>
      </div>

      {/* ── BARRA DE CONTROLE, NAVEGAÇÃO E AÇÕES RÁPIDAS ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5">
        {/* BOTÃO OBRIGATÓRIO (P0): VOLTAR AO INÍCIO */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            title="Voltar ao Início"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/60 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-sm group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform text-cyan-400" />
            <span>Voltar ao Início</span>
          </Link>

          {/* PROGRESSO DE TAREFAS DA LOUSA */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span className="text-slate-400 font-medium">Itens Concluídos:</span>
            <span className="font-mono font-bold text-white">
              {totalConcluidos} / {totalItens}
            </span>
          </div>
        </div>

        {/* AÇÕES DA LOUSA */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ADICIONAR NOVA DEMANDA */}
          <button
            onClick={() => onOpenAddModal('demanda')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/40 hover:bg-cyan-600/30 text-cyan-300 text-xs font-bold transition-all"
          >
            <Plus size={13} />
            <span>Nova Demanda</span>
          </button>

          {/* ADICIONAR LINHA AO FOLLOW THE MONEY */}
          <button
            onClick={() => onOpenAddModal('cambio')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold transition-all"
          >
            <Plus size={13} />
            <span>Linha Câmbio</span>
          </button>

          {/* QUADRO DE RESPONSÁVEIS */}
          {onToggleResponsibleView && (
            <button
              onClick={onToggleResponsibleView}
              title="Alternar exibição do Quadro por Responsáveis"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                isResponsibleViewActive
                  ? 'bg-cyan-600/30 text-cyan-200 border-cyan-400 ring-1 ring-cyan-400 shadow-md shadow-cyan-950/40'
                  : totalAtrasados > 0
                  ? 'bg-rose-950/40 text-rose-300 border-rose-500/70 hover:bg-rose-900/40 shadow-sm'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white'
              }`}
            >
              <Users size={13} className={totalAtrasados > 0 ? 'text-rose-400' : 'text-cyan-400'} />
              <span>Responsáveis</span>
              {totalAtrasados > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse">
                  {totalAtrasados} atr 🚨
                </span>
              )}
            </button>
          )}

          {/* RESTAURAR ORIGINAL DA LOUSA */}
          <button
            onClick={onResetDefault}
            title="Restaura os dados originais fotografados da lousa"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-xs font-medium transition-all"
          >
            <RotateCcw size={13} />
            <span className="hidden md:inline">Restaurar Lousa</span>
          </button>

          {/* TOGGLE MODO TV (FULLSCREEN) */}
          <button
            onClick={onToggleTvMode}
            title="Alternar Modo TV / Tela Cheia (Atalho: F ou T)"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              isTvMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
            }`}
          >
            <Tv size={14} className={isTvMode ? 'text-amber-400 animate-pulse' : 'text-slate-400'} />
            <span>{isTvMode ? 'TV Ativo' : 'Modo TV'}</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono hidden lg:inline">
              F / T
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
