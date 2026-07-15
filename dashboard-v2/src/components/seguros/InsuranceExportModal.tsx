/**
 * InsuranceExportModal — Modal para geração de relatório Gamma e BrisinhAI
 * Específico para o módulo de Seguros.
 */
import React, { useState } from 'react';
import {
  X,
  FileText,
  CheckSquare,
  Square,
  BrainCircuit,
  Download,
  Loader2,
} from 'lucide-react';

export interface InsuranceExportSelections {
  includeGamma: boolean;
  includeAiAnalysis?: boolean;
}

interface InsuranceExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (selections: InsuranceExportSelections, customMarkdown?: string) => void;
  onPreview: (selections: InsuranceExportSelections) => Promise<string>;
  isExporting: boolean;
}

export function InsuranceExportModal({
  isOpen,
  onClose,
  onExport,
  onPreview,
  isExporting,
}: InsuranceExportModalProps) {
  const [selections, setSelections] = useState<InsuranceExportSelections>({
    includeGamma: true,
    includeAiAnalysis: false,
  });

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggle = (key: keyof InsuranceExportSelections) => {
    setSelections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
      const md = await onPreview(selections);
      setPreviewContent(md);
    } catch {
      alert('Erro ao gerar pré-visualização.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExport = () => {
    onExport(selections, previewContent || undefined);
  };

  const handleClose = () => {
    setPreviewContent(null);
    onClose();
  };

  const isLoading = isExporting || isPreviewing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-none border border-slate-200 shadow-2xl w-full ${
          previewContent ? 'max-w-4xl' : 'max-w-lg'
        } overflow-hidden animate-in zoom-in-95 duration-200 relative flex flex-col max-h-[90vh]`}
      >
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center animate-in fade-in">
            <Loader2 size={40} className="animate-spin text-emerald-500 mb-4" />
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
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 leading-tight uppercase text-sm tracking-wider">
                {previewContent ? 'Pré-visualização do Relatório' : 'Gerar Relatório de Seguros'}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {previewContent
                  ? 'Edite os dados antes do envio ao Gamma'
                  : 'Relatório executivo via Gamma IA'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-150 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!previewContent ? (
            <>
              <p className="text-xs text-slate-500 font-medium mb-5">
                Os dados das apólices filtradas serão estruturados e enviados ao Gamma para geração
                da apresentação executiva de gestão de riscos.
              </p>

              <div className="space-y-3">
                {/* Gamma */}
                <div
                  onClick={() => toggle('includeGamma')}
                  className={`flex items-center gap-3 p-4 border cursor-pointer transition-all ${
                    selections.includeGamma
                      ? 'border-emerald-400 bg-emerald-50/50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={selections.includeGamma ? 'text-emerald-600' : 'text-slate-350'}>
                    {selections.includeGamma ? <CheckSquare size={20} /> : <Square size={20} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                      Apresentação Gamma (IA) <BrainCircuit size={16} className="text-emerald-500" />
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-normal">
                      Gera uma apresentação visual automática com resumo executivo, portfólio de
                      apólices, alertas de vencimento e indicadores de risco.
                    </p>
                  </div>
                </div>

                {/* BrisinhAI (sub-opção) */}
                {selections.includeGamma && (
                  <div
                    onClick={() => toggle('includeAiAnalysis')}
                    className={`flex items-center gap-3 p-3 ml-8 border-l-2 cursor-pointer transition-all ${
                      selections.includeAiAnalysis
                        ? 'border-emerald-400 bg-emerald-50/30'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={
                        selections.includeAiAnalysis ? 'text-emerald-600' : 'text-slate-350'
                      }
                    >
                      {selections.includeAiAnalysis ? (
                        <CheckSquare size={16} />
                      ) : (
                        <Square size={16} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-slate-800 flex items-center gap-2 uppercase">
                        Incluir Análise do BrisinhAI
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-normal">
                        Adiciona um slide com a visão executiva de riscos: custo-benefício do
                        portfólio, alertas críticos e recomendações de renovação.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col h-full min-h-[400px]">
              <p className="text-xs text-slate-500 font-medium mb-3">
                Este é o texto exato que será enviado ao Gamma. Você pode editar dados, remover
                linhas irrelevantes ou corrigir a análise antes da geração.
              </p>
              <textarea
                value={previewContent}
                onChange={(e) => setPreviewContent(e.target.value)}
                className="flex-1 w-full p-4 text-xs font-mono border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none rounded-none"
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
                handleClose();
              }
            }}
            disabled={isLoading}
            className="px-4 py-2 text-xs uppercase tracking-wider font-bold text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {previewContent ? 'Voltar' : 'Cancelar'}
          </button>

          {selections.includeGamma && !previewContent && (
            <button
              onClick={handlePreview}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-emerald-500 text-emerald-600 hover:bg-emerald-50 text-xs uppercase tracking-wider font-bold transition-colors disabled:opacity-50"
            >
              Pré-visualizar e Editar
            </button>
          )}

          <button
            onClick={handleExport}
            disabled={!selections.includeGamma || isLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs uppercase tracking-wider font-bold transition-colors shadow-md shadow-emerald-500/10 disabled:opacity-50 justify-center"
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Gerando Gamma...
              </>
            ) : (
              <>
                <Download size={16} />
                {previewContent ? 'Confirmar e Enviar para Gamma' : 'Exportar Direto'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
