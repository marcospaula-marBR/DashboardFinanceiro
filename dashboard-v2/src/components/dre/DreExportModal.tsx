import React, { useState } from 'react';
import { X, FileText, CheckSquare, Square, BrainCircuit, Download, Loader2, FileSpreadsheet, Layers, ExternalLink } from 'lucide-react';

export interface ExportSelections {
  includeGamma: boolean;
  includeRawCsv: boolean;
  includeAiAnalysis?: boolean;
  includeSegregated?: boolean;
  includeKpis?: boolean;
  includeEvolution?: boolean;
  includeWaterfall?: boolean;
  includeDonut?: boolean;
  includeTable?: boolean;
}

interface DreExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (selections: ExportSelections, customMarkdown?: string) => void;
  onPreview: (selections: ExportSelections) => Promise<string>;
  isExporting: boolean;
  empresasSelecionadas?: string[];
  todasEmpresas?: string[];
  gammaResultUrl?: string | null;
}

export function DreExportModal({ isOpen, onClose, onExport, onPreview, isExporting, empresasSelecionadas = [], todasEmpresas = [], gammaResultUrl = null }: DreExportModalProps) {
  // Se nenhuma empresa está filtrada = todas as empresas estão ativas
  const empresasEfetivas = empresasSelecionadas.length > 0 ? empresasSelecionadas : todasEmpresas;
  const isMultiEmpresa = empresasEfetivas.length > 1;
  const [selections, setSelections] = useState<ExportSelections>({
    includeGamma: true,
    includeRawCsv: false,
  });

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleSelection = (key: keyof ExportSelections) => {
    setSelections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
      const markdown = await onPreview(selections);
      setPreviewContent(markdown);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar pré-visualização.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExport = () => {
    onExport(selections, previewContent || undefined);
    // Limpar ao exportar (se desejar, ou apenas ao fechar o modal)
  };

  const handleClose = () => {
    setPreviewContent(null);
    onClose();
  };

  const isAnySelected = Object.values(selections).some(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-white rounded-none border border-slate-200 shadow-2xl w-full ${previewContent ? 'max-w-4xl' : 'max-w-lg'} overflow-hidden animate-in zoom-in-95 duration-200 relative flex flex-col max-h-[90vh]`}>
        
        {/* Overlay de Loading bloqueante */}
        {(isExporting || isPreviewing) && (
          <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center animate-in fade-in">
            <Loader2 size={40} className="animate-spin text-amber-500 mb-4" />
            <h3 className="text-slate-900 font-bold text-lg mb-1">
              {isPreviewing ? 'Gerando Pré-relatório...' : 'Gerando Apresentação IA...'}
            </h3>
            <p className="text-sm text-slate-500 max-w-[280px] text-center">
              {isPreviewing 
                ? 'Coletando dados e consultando o BrisinhAI (se selecionado).' 
                : 'A inteligência artificial do Gamma está montando os slides. Isso pode levar alguns segundos.'}
            </p>
          </div>
        )}

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 leading-tight uppercase text-sm tracking-wider">
                {previewContent ? 'Pré-visualização do Relatório' : 'Gerar Relatório'}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {previewContent ? 'Edite os dados antes do envio ao Gamma' : 'Selecione o formato de saída'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            disabled={isExporting || isPreviewing}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-150 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {gammaResultUrl ? (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center animate-in zoom-in-95 my-auto">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center rounded-2xl mb-4 shadow-sm">
                <BrainCircuit size={32} />
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1 uppercase tracking-wide">
                Apresentação Gamma Gerada!
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mb-6 font-medium">
                Sua apresentação executiva da DRE no Gamma foi montada com sucesso. Clique no botão abaixo para visualizá-la:
              </p>

              <a
                href={gammaResultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95"
              >
                <span>Abrir Apresentação no Gamma</span>
                <ExternalLink size={16} />
              </a>
            </div>
          ) : !previewContent ? (
            <>
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
                      Gera uma apresentação visual automática contendo o resumo executivo, tabelas e indicadores financeiros da DRE.
                    </p>
                  </div>
                </div>

                {/* BrisinhAI Option */}
                {selections.includeGamma && (
                  <div 
                    onClick={() => toggleSelection('includeAiAnalysis')}
                    className={`flex items-center gap-3 p-3 ml-8 border-l-2 cursor-pointer transition-all ${
                      selections.includeAiAnalysis ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={selections.includeAiAnalysis ? 'text-amber-600' : 'text-slate-350'}>
                      {selections.includeAiAnalysis ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-slate-800 flex items-center gap-2 uppercase">
                        Incluir Análise do BrisinhAI
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-normal">
                        Adiciona um slide com a visão executiva e comentários da nossa inteligência artificial sobre os resultados.
                      </p>
                    </div>
                  </div>
                )}

                {/* Segregated per-company option — only visible when 2+ companies selected */}
                {isMultiEmpresa && (
                  <div
                    onClick={() => toggleSelection('includeSegregated')}
                    className={`flex items-start gap-3 p-4 border cursor-pointer transition-all ${
                      selections.includeSegregated ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`mt-0.5 ${selections.includeSegregated ? 'text-amber-600' : 'text-slate-350'}`}>
                      {selections.includeSegregated ? <CheckSquare size={20} /> : <Square size={20} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                        Relatório por Empresa (Segregado) <Layers size={16} className="text-sky-500" />
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-normal">
                        Além do consolidado, gera uma seção separada para cada empresa selecionada.
                      </p>
                      {selections.includeSegregated && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {empresasEfetivas.map(emp => (
                            <span key={emp} className="text-[10px] font-semibold px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full border border-sky-200">
                              {emp}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
            </>
          ) : (
            <div className="flex flex-col h-full min-h-[400px]">
              <p className="text-xs text-slate-500 font-medium mb-3">
                Este é o texto exato que será enviado ao Gamma. Você pode editar os dados, remover linhas irrelevantes ou corrigir a análise antes da geração.
              </p>
              <textarea 
                value={previewContent}
                onChange={(e) => setPreviewContent(e.target.value)}
                className="flex-1 w-full p-4 text-xs font-mono border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none rounded-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 select-none shrink-0">
          <button
            onClick={() => {
              if (previewContent) {
                setPreviewContent(null);
              } else {
                onClose();
              }
            }}
            disabled={isExporting || isPreviewing}
            className="px-4 py-2 text-xs uppercase tracking-wider font-bold text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {gammaResultUrl ? 'Fechar' : (previewContent ? 'Voltar' : 'Cancelar')}
          </button>
          
          {!gammaResultUrl && selections.includeGamma && !previewContent && (
            <button
              onClick={handlePreview}
              disabled={!isAnySelected || isExporting || isPreviewing}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-amber-500 text-amber-600 hover:bg-amber-50 text-xs uppercase tracking-wider font-bold transition-colors disabled:opacity-50"
            >
              Pré-visualizar e Editar
            </button>
          )}

          {!gammaResultUrl && (
            <button
              onClick={handleExport}
              disabled={!isAnySelected || isExporting || isPreviewing}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs uppercase tracking-wider font-bold transition-colors shadow-md shadow-orange-500/10 disabled:opacity-50 justify-center"
            >
              {isExporting ? (
                <><Loader2 size={16} className="animate-spin" /> Gerando Gamma...</>
              ) : (
                <><Download size={16} /> {previewContent ? 'Confirmar e Enviar para Gamma' : 'Exportar Direto'}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
