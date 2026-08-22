'use client';
import React from 'react';
import Link from 'next/link';
import { ChevronLeft, BarChart3, ShieldCheck, Sparkles, Building2 } from 'lucide-react';
import { APP_VERSION } from '@/version';

interface HeaderNavProps {
  companyName?: string;
  onOpenAiModal?: () => void;
}

export function HeaderNav({ companyName = 'Empresa PME', onOpenAiModal }: HeaderNavProps) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Lado Esquerdo: Botão Voltar ao Início & Brand */}
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="flex items-center text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg transition-all"
            title="Voltar ao Início"
          >
            <ChevronLeft size={16} className="mr-1 text-emerald-400" />
            <span>Voltar ao Início</span>
          </Link>

          <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <BarChart3 size={18} />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight block">Simulador SaaS</span>
              <span className="text-[10px] text-slate-400 font-mono block">PME Financial Pro • {APP_VERSION}</span>
            </div>
          </div>
        </div>

        {/* Lado Direito: Empresa Contexto & Assistente IA */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="hidden md:flex items-center text-xs bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60 text-slate-300">
            <Building2 size={14} className="mr-1.5 text-emerald-400" />
            <span className="font-medium truncate max-w-[150px]">{companyName}</span>
          </div>

          {onOpenAiModal && (
            <button
              onClick={onOpenAiModal}
              className="flex items-center text-xs sm:text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-3.5 py-2 rounded-lg shadow-sm transition-all transform active:scale-95"
            >
              <Sparkles size={16} className="mr-1.5 text-emerald-100 animate-pulse" />
              <span className="font-semibold">Consultor IA</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
