"use client";

import React from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  ShieldAlert,
  WalletCards,
  Clock
} from 'lucide-react';
import { APP_VERSION } from '@/version';

interface DreCaixaHeaderProps {
  lastUpdate: string | null;
  isLoading: boolean;
  isMeetingMode: boolean;
  onToggleMeetingMode: () => void;
  onRefresh: () => void;
  onExportCsv: () => void;
}

export function DreCaixaHeader({
  lastUpdate,
  isLoading,
  isMeetingMode,
  onToggleMeetingMode,
  onRefresh,
  onExportCsv
}: DreCaixaHeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md backdrop-blur px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        
        {/* Lado Esquerdo: Identidade & Contexto */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors"
            title="Voltar ao Início"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Voltar ao Início</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <WalletCards size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  DRE-Caixa
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Regime de Caixa (Omie)
                  </span>
                </h1>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Clock size={12} className="text-slate-500" />
                <span>Atualizado: {lastUpdate || 'Carregando...'}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-slate-400">{APP_VERSION}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Ações & Modo Reunião */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-x-auto pb-1 md:pb-0">
          {/* Botão Modo Reunião / Ocultar Receitas */}
          <button
            onClick={onToggleMeetingMode}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all border ${
              isMeetingMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/10'
                : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-750'
            }`}
            title={isMeetingMode ? "Modo Reunião Ativo: Receitas Ocultas" : "Ativar Modo Reunião (Ocultar Receitas Sensíveis)"}
          >
            {isMeetingMode ? (
              <>
                <EyeOff size={15} className="text-amber-400" />
                <span>Modo Reunião (Ativo)</span>
              </>
            ) : (
              <>
                <Eye size={15} className="text-slate-400" />
                <span>Modo Reunião</span>
              </>
            )}
          </button>

          {/* Sincronizar / Atualizar */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
            title="Recarregar lançamentos do banco de dados"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin text-emerald-400" : "text-slate-400"} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          {/* Exportar CSV */}
          <button
            onClick={onExportCsv}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm disabled:opacity-50"
            title="Exportar dados consolidados em CSV"
          >
            <Download size={14} />
            <span>Exportar</span>
          </button>
        </div>

      </div>
    </header>
  );
}
