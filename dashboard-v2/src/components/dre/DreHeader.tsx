import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Eye, FileText, SlidersHorizontal, CloudLightning, Loader2, MonitorSmartphone } from 'lucide-react';
import { APP_VERSION } from '@/version';

interface DreHeaderProps {
  lastUpdate: string | null;
  onExportPDF: () => void;
  onTogglePrivacy: () => void;
  isPrivacyMode: boolean;
  onToggleSimulator: () => void;
  onOpenEquipmentsManager: () => void;
  // Supabase publishing properties
  hasData: boolean;
  isPublishing: boolean;
  onPublish: () => void;
}

export function DreHeader({ 
  lastUpdate, 
  onExportPDF, 
  onTogglePrivacy, 
  isPrivacyMode, 
  onToggleSimulator,
  onOpenEquipmentsManager,
  hasData,
  isPublishing,
  onPublish
}: DreHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 select-none">
      <div className="flex items-center gap-4">
        <Link 
          href="/" 
          className="p-2 rounded-xl border border-slate-200 bg-white hover:border-amber-450 hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-all shadow-sm duration-200 active:scale-95"
          title="Voltar ao Início"
        >
          <ChevronLeft size={20} />
        </Link>
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
        <button 
          onClick={onTogglePrivacy}
          className={`p-2.5 rounded-xl border transition-all duration-200 shadow-sm active:scale-95 ${
            isPrivacyMode 
          ? "bg-slate-800 border-slate-800 text-amber-400" 
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-350 hover:bg-slate-50"
          }`}
          title="Ocultar Valores"
        >
          <Eye size={18} />
        </button>
        
        <button
          onClick={onOpenEquipmentsManager}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all duration-200 shadow-sm active:scale-95"
          title="Gerenciar Parque de Máquinas"
        >
          <MonitorSmartphone size={16} className="text-amber-500" />
          <span>Máquinas</span>
        </button>

        <Link 
          href="/indicadores_v2.html" 
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all duration-200 shadow-sm active:scale-95"
        >
          Gestor
        </Link>

        {/* Compliant with the Purple Ban: changed from indigo to high-end amber-50 border/slate-800 accent */}
        <button 
          onClick={onToggleSimulator}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700 hover:bg-slate-200/80 transition-all duration-200 shadow-sm active:scale-95"
        >
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">Simular</span>
        </button>

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

        <button 
          onClick={onExportPDF}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-bold transition-all duration-200 shadow-md shadow-orange-500/10 active:scale-95 min-w-[140px]"
        >
          <FileText size={16} /> <span className="hidden sm:inline">Exportar PDF</span>
        </button>
      </div>
    </header>
  );
}
