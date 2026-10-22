"use client";

import React from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { RegimeTipo } from '@/types/dre-painel';

interface DrePainelHeaderProps {
  regime: RegimeTipo;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdate: string | null;
  isMeetingMode: boolean;
  onToggleMeetingMode: () => void;
  totalLancamentos: number;
}

export function DrePainelHeader({
  regime,
  onRefresh,
  isLoading,
  lastUpdate,
  isMeetingMode,
  onToggleMeetingMode,
  totalLancamentos
}: DrePainelHeaderProps) {
  const getRegimeBadge = () => {
    switch (regime) {
      case 'COMPETENCIA':
        return {
          title: 'Regime de Competência',
          badge: 'DRE Econômico',
          desc: 'Data de Registro com Provisões Operacionais incluídas',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'CAIXA':
        return {
          title: 'Regime de Caixa',
          badge: 'DRE Financeiro',
          desc: 'Data Efetiva de Liquidação Bancária (Entradas e Saídas)',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
        };
      case 'PREVISAO':
        return {
          title: 'Fluxo & Previsão',
          badge: 'Contas Futuras',
          desc: 'Data de Vencimento de compromissos abertos e a vencer',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
        };
    }
  };

  const badgeInfo = getRegimeBadge();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 sm:px-6 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        
        {/* Esquerda: Voltar ao Início (Mandatório P0) + Título */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 shadow-sm"
          >
            <ChevronLeft size={16} />
            <span>Voltar ao Início</span>
          </Link>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Painel Financeiro Multivisão
              </h1>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeInfo.badgeClass}`}>
                {badgeInfo.badge}
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              {badgeInfo.desc} • {totalLancamentos.toLocaleString('pt-BR')} registros
            </p>
          </div>
        </div>

        {/* Direita: Ações Rápidas (Modo Reunião + Atualizar Omie) */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {lastUpdate && (
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              Atualizado: {lastUpdate}
            </span>
          )}

          <button
            type="button"
            onClick={onToggleMeetingMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isMeetingMode
                ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Ocultar valores para reuniões e apresentações"
          >
            {isMeetingMode ? <EyeOff size={14} /> : <Eye size={14} />}
            <span className="hidden sm:inline">Modo Reunião</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Atualizando...' : 'Atualizar Dados'}</span>
          </button>
        </div>

      </div>
    </header>
  );
}
