"use client";

import React from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  WalletCards,
  Clock,
  ShieldAlert,
  Shield,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import { APP_VERSION } from '@/version';

interface DreCaixaHeaderProps {
  lastUpdate: string | null;
  isLoading: boolean;
  isMeetingMode: boolean;
  onToggleMeetingMode: () => void;
  onOpenPrivacyModal?: () => void;
  hiddenCount?: number;
  onRefresh: () => void;
  onExportCsv: () => void;
  onOpenGamma?: () => void;
  onOpenPurchasesAudit?: () => void;
}

export function DreCaixaHeader({
  lastUpdate,
  isLoading,
  isMeetingMode,
  onToggleMeetingMode,
  onOpenPrivacyModal,
  hiddenCount = 0,
  onRefresh,
  onExportCsv,
  onOpenGamma,
  onOpenPurchasesAudit
}: DreCaixaHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-40 shadow-sm px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        
        {/* Lado Esquerdo: Identidade & Contexto */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-amber-700 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl px-3 py-2 transition-all shadow-sm active:scale-95 shrink-0"
            title="Voltar ao Início"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Voltar ao Início</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
              <WalletCards size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                  DRE-Caixa
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Regime de Caixa (Omie)
                  </span>
                </h1>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <Clock size={12} className="text-slate-400" />
                <span>Atualizado: {lastUpdate || 'Carregando...'}</span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-slate-500 font-semibold">{APP_VERSION}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Ações & Modo Reunião */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-x-auto pb-1 md:pb-0">
          {/* Botão Modo Reunião / Ocultar Receitas */}
          <button
            onClick={onToggleMeetingMode}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all border shadow-sm cursor-pointer ${
              isMeetingMode
                ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-100'
                : 'bg-white text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
            }`}
            title={isMeetingMode ? "Modo Reunião Ativo: Receitas Ocultas" : "Ativar Modo Reunião (Ocultar Receitas Sensíveis)"}
          >
            {isMeetingMode ? (
              <>
                <EyeOff size={15} className="text-amber-600" />
                <span>Modo Reunião (Ativo)</span>
              </>
            ) : (
              <>
                <Eye size={15} className="text-slate-500" />
                <span>Modo Reunião</span>
              </>
            )}
          </button>

          {/* Botão Ocultar Dados Sensíveis (Categorias, Projetos, Fornecedores) */}
          {onOpenPrivacyModal && (
            <button
              onClick={onOpenPrivacyModal}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all border shadow-sm cursor-pointer ${
                hiddenCount > 0
                  ? 'bg-amber-50 text-amber-900 border-amber-300 ring-2 ring-amber-100 font-black'
                  : 'bg-white text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
              }`}
              title="Ocultar categorias, projetos ou fornecedores da apuração para proteger dados sensíveis"
            >
              <ShieldAlert size={15} className={hiddenCount > 0 ? "text-amber-600" : "text-slate-500"} />
              <span>Ocultar Dados</span>
              {hiddenCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {hiddenCount}
                </span>
              )}
            </button>
          )}

          {/* Botão Raio-X de Compras */}
          {onOpenPurchasesAudit && (
            <button
              onClick={onOpenPurchasesAudit}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Auditoria Executiva de Compras & Desembolsos"
            >
              <ShoppingBag size={15} className="text-indigo-600" />
              <span className="hidden sm:inline">Raio-X Compras</span>
            </button>
          )}

          {/* Botão Gerar Apresentação no Gamma (Diretoria) */}
          {onOpenGamma && (
            <button
              onClick={onOpenGamma}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Gerar slides executivos para reunião com a diretoria no Gamma"
            >
              <Sparkles size={15} className="text-emerald-100" />
              <span>Gerar no Gamma</span>
            </button>
          )}

          {/* Sincronizar / Atualizar */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 shadow-sm transition-all disabled:opacity-50"
            title="Recarregar lançamentos do banco de dados"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin text-emerald-600" : "text-slate-500"} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          {/* Exportar CSV */}
          <button
            onClick={onExportCsv}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm disabled:opacity-50 active:scale-95"
            title="Exportar dados consolidados em CSV"
          >
            <Download size={14} />
            <span>Exportar CSV</span>
          </button>
        </div>

      </div>
    </header>
  );
}
