import React, { useState } from 'react';
import { X, FileText, CheckSquare, Square, BrainCircuit, Download, Loader2, FileSpreadsheet } from 'lucide-react';

export interface ExportSelections {
  includeAiAnalysis: boolean;
  includeKpis: boolean;
  includeEvolution: boolean;
  includeWaterfall: boolean;
  includeDonut: boolean;
  includeTable: boolean;
  includeRawCsv: boolean;
}

interface DreExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (selections: ExportSelections) => void;
  isExporting: boolean;
  isAiAnalyzing: boolean;
}

export function DreExportModal({ isOpen, onClose, onExport, isExporting, isAiAnalyzing }: DreExportModalProps) {
  const [selections, setSelections] = useState<ExportSelections>({
    includeAiAnalysis: true,
    includeKpis: true,
    includeEvolution: true,
    includeWaterfall: true,
    includeDonut: true,
    includeTable: true,
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
      <div className="bg-white rounded-none border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 leading-tight uppercase text-sm tracking-wider">Configurar Relatório</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Selecione os módulos e formatos</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isExporting || isAiAnalyzing}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-150 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-xs text-slate-500 font-medium mb-5">
            O sistema irá compilar os dados do período e da empresa selecionados, aplicando os filtros ativos e gerando o documento customizado.
          </p>

          <div className="space-y-3">
            {/* AI Module */}
            <div 
              onClick={() => toggleSelection('includeAiAnalysis')}
              className={`flex items-center gap-3 p-4 border cursor-pointer transition-all ${
                selections.includeAiAnalysis ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className={selections.includeAiAnalysis ? 'text-amber-600' : 'text-slate-350'}>
                {selections.includeAiAnalysis ? <CheckSquare size={20} /> : <Square size={20} />}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                  Análise Executiva BrisinhAI <BrainCircuit size={16} className="text-amber-500" />
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-normal">Inteligência Artificial redige os principais pontos focais de gestão financeira baseados nos resultados do período.</p>
              </div>
            </div>

            {/* Other Modules */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${selections.includeKpis ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={selections.includeKpis} 
                  onChange={() => toggleSelection('includeKpis')} 
                />
                <div className={selections.includeKpis ? 'text-amber-600' : 'text-slate-350'}>
                  {selections.includeKpis ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Resumo KPIs</span>
              </label>

              <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${selections.includeTable ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={selections.includeTable} 
                  onChange={() => toggleSelection('includeTable')} 
                />
                <div className={selections.includeTable ? 'text-amber-600' : 'text-slate-350'}>
                  {selections.includeTable ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Tabela DRE</span>
              </label>

              <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${selections.includeEvolution ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={selections.includeEvolution} 
                  onChange={() => toggleSelection('includeEvolution')} 
                />
                <div className={selections.includeEvolution ? 'text-amber-600' : 'text-slate-350'}>
                  {selections.includeEvolution ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Evolução Mensal</span>
              </label>

              <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${selections.includeWaterfall ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={selections.includeWaterfall} 
                  onChange={() => toggleSelection('includeWaterfall')} 
                />
                <div className={selections.includeWaterfall ? 'text-amber-600' : 'text-slate-350'}>
                  {selections.includeWaterfall ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Waterfall FCL</span>
              </label>

              <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${selections.includeDonut ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={selections.includeDonut} 
                  onChange={() => toggleSelection('includeDonut')} 
                />
                <div className={selections.includeDonut ? 'text-amber-600' : 'text-slate-350'}>
                  {selections.includeDonut ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Donut Custos</span>
              </label>

              <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${selections.includeRawCsv ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={selections.includeRawCsv} 
                  onChange={() => toggleSelection('includeRawCsv')} 
                />
                <div className={selections.includeRawCsv ? 'text-amber-600' : 'text-slate-350'}>
                  {selections.includeRawCsv ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  Dados Brutos (CSV) <FileSpreadsheet size={14} className="text-emerald-600" />
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 select-none">
          <button
            onClick={onClose}
            disabled={isExporting || isAiAnalyzing}
            className="px-4 py-2 text-xs uppercase tracking-wider font-bold text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleExport}
            disabled={!isAnySelected || isExporting || isAiAnalyzing}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs uppercase tracking-wider font-bold transition-colors shadow-md shadow-orange-500/10 disabled:opacity-50 min-w-[160px] justify-center"
          >
            {isAiAnalyzing ? (
              <><Loader2 size={16} className="animate-spin" /> Analisando IA...</>
            ) : isExporting ? (
              <><Loader2 size={16} className="animate-spin" /> Gerando...</>
            ) : (
              <><Download size={16} /> Gerar Relatório</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
