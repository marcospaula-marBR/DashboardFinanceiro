'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  FileText,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface PricingSimulatorGammaModalProps {
  isOpen: boolean;
  onClose: () => void;
  markdownContent: string;
  empresaNome?: string;
}

export function PricingSimulatorGammaModal({
  isOpen,
  onClose,
  markdownContent,
  empresaNome = 'Mar Brasil'
}: PricingSimulatorGammaModalProps) {
  const [editedMarkdown, setEditedMarkdown] = useState<string>(markdownContent);
  const [includeAi, setIncludeAi] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [gammaUrl, setGammaUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sincronizar markdown se abrir
  React.useEffect(() => {
    setEditedMarkdown(markdownContent);
    setGammaUrl(null);
    setErrorMsg(null);
  }, [markdownContent, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(editedMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateGamma = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/gamma/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown: editedMarkdown,
          includeAi
        })
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Não foi possível gerar a apresentação no Gamma.');
      }

      setGammaUrl(data.url);
      window.open(data.url, '_blank');
    } catch (e: any) {
      console.error('[Gamma Modal]', e);
      setErrorMsg(e.message || 'Erro ao conectar à API do Gamma.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
                Gerador de Apresentações Executivas (Gamma)
              </h3>
              <p className="text-xs text-slate-500">
                Transforme os cenários simulados em slides executivos C-Level instantaneamente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo com Markdown Editor/Preview */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {gammaUrl && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-900 block">Apresentação Criada com Sucesso!</span>
                <span className="text-[11px] text-emerald-700">Seu deck de slides foi montado no Gamma.</span>
              </div>
              <a
                href={gammaUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xs"
              >
                <span>Abrir Apresentação</span>
                <ExternalLink size={14} />
              </a>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">
                Conteúdo do Relatório (Markdown)
              </label>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
            <textarea
              rows={12}
              value={editedMarkdown}
              onChange={e => setEditedMarkdown(e.target.value)}
              className="w-full text-xs font-mono p-3.5 rounded-xl border border-slate-250 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <input
              type="checkbox"
              id="includeAi"
              checked={includeAi}
              onChange={e => setIncludeAi(e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500/20 w-4 h-4"
            />
            <label htmlFor="includeAi" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
              Incluir Parecer Executivo do <strong>BrisinhAI</strong> no slide de conclusões
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            Empresa: {empresaNome} • Gamma Presentation API
          </span>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGenerateGamma}
              disabled={isLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Gerando Apresentação...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Gerar Slides no Gamma</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
