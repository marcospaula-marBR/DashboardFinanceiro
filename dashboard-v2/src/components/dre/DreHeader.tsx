import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Eye, FileText, SlidersHorizontal, CloudLightning, Loader2, MonitorSmartphone, Filter, Gauge, Sparkles } from 'lucide-react';
import { APP_VERSION } from '@/version';

interface DreHeaderProps {
  lastUpdate: string | null;
  onExportPDF: () => void;
  onTogglePrivacy: () => void;
  isPrivacyMode: boolean;
  onToggleRevenuePrivacy: () => void;
  isRevenuePrivacyMode: boolean;
  onToggleSimulator: () => void;
  onOpenEquipmentsManager: () => void;
  // Supabase publishing properties
  hasData: boolean;
  isPublishing: boolean;
  onPublish: () => void;
  // Sidebar toggle
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenIndicators: () => void;
  onOpenReportBuilder?: () => void;
}

export function DreHeader({ 
  lastUpdate, 
  onExportPDF, 
  onTogglePrivacy, 
  isPrivacyMode, 
  onToggleRevenuePrivacy,
  isRevenuePrivacyMode,
  onToggleSimulator,
  onOpenEquipmentsManager,
  hasData,
  isPublishing,
  onPublish,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenIndicators,
  onOpenReportBuilder
}: DreHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 select-none">
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <Link 
            href="/" 
            className="flex items-center gap-1.5 p-2 px-3 rounded-xl border border-slate-200 bg-white hover:border-amber-450 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-all shadow-sm duration-200 active:scale-95 text-xs font-bold"
          >
            <ChevronLeft size={16} />
            <span>Voltar ao Início</span>
          </Link>
          <button 
            onClick={onToggleSidebar}
            className={`p-2 rounded-xl border transition-all shadow-sm duration-200 active:scale-95 flex items-center justify-center ${
              isSidebarCollapsed 
                ? "bg-slate-100 border-slate-350 text-slate-500" 
                : "bg-white border-slate-200 text-amber-500 hover:border-amber-450 hover:bg-amber-50"
            }`}
            title={isSidebarCollapsed ? "Expandir Filtros" : "Recolher Filtros"}
          >
            <Filter size={20} />
          </button>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Demonstração do Resultado (DRE)</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full text-slate-500">
              {APP_VERSION}
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            {lastUpdate ? `Atualizado em: ${lastUpdate}` : 'Aguardando dados...'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full md:w-auto">
        <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm p-0.5">
          <button 
            onClick={onToggleRevenuePrivacy}
            className={`p-2 rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
              isRevenuePrivacyMode && !isPrivacyMode
                ? "bg-amber-50 text-amber-600 font-bold" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
            title="Ocultar Apenas Receitas"
          >
            <Eye size={16} />
            <span className="text-[10px] hidden sm:inline uppercase tracking-wider font-bold">Receitas</span>
          </button>
          <div className="w-[1px] h-4 bg-slate-200 mx-0.5"></div>
          <button 
            onClick={onTogglePrivacy}
            className={`p-2 rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
              isPrivacyMode 
                ? "bg-slate-800 text-amber-400 font-bold" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
            title="Ocultar Todos os Valores"
          >
            <Eye size={16} />
            <span className="text-[10px] hidden sm:inline uppercase tracking-wider font-bold">Tudo</span>
          </button>
        </div>

        <button 
          onClick={onOpenIndicators}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all duration-200 shadow-sm active:scale-95"
          title="Indicadores Estratégicos"
        >
          <Gauge size={16} className="text-amber-500" />
          <span>Indicadores</span>
        </button>

        {/* Link para o Simulador DRE */}
        <Link 
          href="/dre-custom"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700 hover:bg-slate-200/80 transition-all duration-200 shadow-sm active:scale-95"
          title="Abrir Simulador Executivo DRE V3 em Nova Aba"
        >
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">Simular</span>
        </Link>

        {/* Publish Snapshot (Supabase DB) */}
        {hasData && (
          <button 
            onClick={onPublish}
            disabled={isPublishing}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all duration-200 shadow-sm active:scale-95 ${
              isPublishing 
                ? "bg-emerald-50 border-emerald-200 text-emerald-600 cursor-not-allowed"
                : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            {isPublishing ? (
              <>
                <Loader2 size={16} className="animate-spin text-emerald-500" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <CloudLightning size={16} className="text-emerald-500" />
                <span>Salvar na Nuvem</span>
              </>
            )}
          </button>
        )}

        {/* Botão Único de Gerar Relatório Executivo Gamma (Construtor de Módulos) */}
        <button 
          onClick={onOpenReportBuilder || onExportPDF}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-bold transition-all duration-200 shadow-md shadow-orange-500/10 active:scale-95 min-w-[170px] cursor-pointer"
          title="Gerar Apresentação Executiva Customizada com IA no Gamma"
        >
          <Sparkles size={16} /> <span className="hidden sm:inline">Gerar Relatório Gamma</span>
        </button>
      </div>
    </header>
  );
}
