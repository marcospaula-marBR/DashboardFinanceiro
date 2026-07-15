import React, { useState } from 'react';
import { X, FileText, CheckSquare, Square, BrainCircuit, Download, Loader2, FileSpreadsheet } from 'lucide-react';

export interface ExportSelections {
  includeGamma: boolean;
  includeRawCsv: boolean;
  // Legacy PDF options (optional to avoid TS errors in legacy code)
  includeAiAnalysis?: boolean;
  includeKpis?: boolean;
  includeEvolution?: boolean;
  includeWaterfall?: boolean;
  includeDonut?: boolean;
  includeTable?: boolean;
}

interface DreExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (selections: ExportSelections) => void;
  isExporting: boolean; // Utilizado para travar a tela enquanto o Gamma gera
}

export function DreExportModal({ isOpen, onClose, onExport, isExporting }: DreExportModalProps) {
  const [selections, setSelections] = useState<ExportSelections>({
    includeGamma: true,
    includeRawCsv: false,
  });

  if (!isOpen) return null;

  const toggleSelection = (key: keyof ExportSelections) => {
    setSelections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = () => {
    onExport(selections);
  };

  const isAnySelected = Object.values(selections).some(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-none border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 relative">
        
        {/* Overlay de Loading bloqueante */}
        {isExporting && (
          <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center animate-in fade-in">
            <Loader2 size={40} className="animate-spin text-amber-500 mb-4" />
            <h3 className="text-slate-900 font-bold text-lg mb-1">Gerando Apresentação IA...</h3>
            <p className="text-sm text-slate-500 max-w-[280px] text-center">
              A inteligência artificial do Gamma está montando os slides. Isso pode levar alguns segundos.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 leading-tight uppercase text-sm tracking-wider">Gerar Relatório</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Selecione o formato de saída</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isExporting}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-150 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-xs text-slate-500 font-medium mb-5">
            Os dados da DRE com os filtros atuais serão enviados para a API. Selecione os formatos desejados:
          </p>

          <div className="space-y-3">
            {/* Gamma Module */}
            <div 
              onClick={() => toggleSelection('includeGamma')}
              className={`flex items-center gap-3 p-4 border cursor-pointer transition-all ${
                selections.includeGamma ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className={selections.includeGamma ? 'text-amber-600' : 'text-slate-350'}>
                {selections.includeGamma ? <CheckSquare size={20} /> : <Square size={20} />}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                  Apresentação Gamma (IA) <BrainCircuit size={16} className="text-amber-500" />
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-normal">
                  Gera uma apresentação visual automática usando a Inteligência Artificial do Gamma contendo o resumo executivo, tabelas e indicadores financeiros da DRE.
                </p>
              </div>
            </div>

            {/* CSV Module */}
            <div 
              onClick={() => toggleSelection('includeRawCsv')}
              className={`flex items-center gap-3 p-4 border cursor-pointer transition-all ${
                selections.includeRawCsv ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className={selections.includeRawCsv ? 'text-amber-600' : 'text-slate-350'}>
                {selections.includeRawCsv ? <CheckSquare size={20} /> : <Square size={20} />}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                  Dados Brutos Consolidado (CSV) <FileSpreadsheet size={16} className="text-emerald-600" />
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-normal">
                  Exporta uma planilha Excel estruturada com todas as linhas, subcategorias e totalizadores do período selecionado.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 select-none">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-xs uppercase tracking-wider font-bold text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleExport}
            disabled={!isAnySelected || isExporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs uppercase tracking-wider font-bold transition-colors shadow-md shadow-orange-500/10 disabled:opacity-50 min-w-[160px] justify-center"
          >
            {isExporting ? (
              <><Loader2 size={16} className="animate-spin" /> Gerando...</>
            ) : (
              <><Download size={16} /> Exportar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
