"use client";

import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  X,
  Copy,
  Check,
  BrainCircuit,
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { DreCaixaKpiSummary, DreCaixaChartData, DreCaixaLancamento } from '@/types/dre-caixa';

interface DreCaixaAiInsightsProps {
  summary: DreCaixaKpiSummary;
  chartData: DreCaixaChartData;
  lancamentos: DreCaixaLancamento[];
  empresa: string;
  periodo: string;
}

export function DreCaixaAiInsights({
  summary,
  chartData,
  lancamentos,
  empresa,
  periodo
}: DreCaixaAiInsightsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Limpa a análise automaticamente quando os filtros (empresa, período ou volume de lançamentos) mudarem
  React.useEffect(() => {
    setAnalysisText(null);
    setError(null);
  }, [empresa, periodo, lancamentos.length]);

  const handleClose = () => {
    setIsOpen(false);
    setAnalysisText(null); // Reseta para garantir que ao abrir gere nova análise calibrada com o estado atual
    setError(null);
  };

  const fetchAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Extrair os 5 maiores atrasos
      const maioresAtrasos = [...lancamentos]
        .filter(l => (l.dias_atraso || 0) > 0)
        .sort((a, b) => (b.dias_atraso || 0) - (a.dias_atraso || 0))
        .slice(0, 5)
        .map(l => ({
          favorecido: l.fornecedor_cliente,
          valor: l.valor,
          dias_atraso: l.dias_atraso,
          tipo: l.tipo,
          doc: l.numero_documento
        }));

      const res = await fetch('/api/ai/dre-caixa-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          despesasPorSetor: chartData.despesasPorSetor,
          despesasPorCategoria: chartData.despesasPorCategoria,
          topFornecedores: chartData.topFornecedores,
          maioresAtrasos,
          empresa,
          periodo
        })
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setAnalysisText(data.analysis);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao conectar com o serviço de IA.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    // Sempre gera nova análise fresca ao abrir
    fetchAnalysis();
  };

  const handleCopy = () => {
    if (!analysisText) return;
    navigator.clipboard.writeText(analysisText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Botão Executivo de Abertura */}
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 text-white text-xs font-bold shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all border border-indigo-500/30"
        title="Gerar parecer analítico do CFO Virtual e detecção de desvios via IA"
      >
        <Sparkles size={14} className="text-amber-300 animate-pulse" />
        <span>Parecer CFO & Desvios IA</span>
      </button>

      {/* Modal Executivo de IA */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header com Gradiente Premium */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-inner">
                  <BrainCircuit size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black tracking-tight text-white">
                      Parecer Executivo do CFO Virtual (IA)
                    </h3>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      Gemini 2.5 Flash
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Análise em tempo real de desvios de caixa, pontualidade e preparação para diretoria
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {analysisText && !isLoading && (
                  <button
                    onClick={handleCopy}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Copiar Parecer Completo"
                  >
                    {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                )}
                <button
                  onClick={fetchAnalysis}
                  disabled={isLoading}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                  title="Atualizar Análise"
                >
                  <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Badges de Destaque Rápido */}
            <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700">Foco Analítico:</span>
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-bold">
                  {empresa}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                  {periodo}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Regime de Caixa Efetivo (Liquidação Bancária Real)
              </div>
            </div>

            {/* Conteúdo da Análise */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-slate-800 text-sm leading-relaxed">
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm animate-pulse">
                    <BrainCircuit size={24} className="animate-spin" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">
                      Processando Dados Financeiros e Extratos...
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Avaliando receitas, custos por centro de custo, histórico de pontualidade e antecipando perguntas de diretoria.
                    </p>
                  </div>
                </div>
              ) : error ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <AlertTriangle size={15} />
                    <span>Não foi possível gerar a análise</span>
                  </div>
                  <p>{error}</p>
                </div>
              ) : analysisText ? (
                <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200 whitespace-pre-wrap font-sans text-slate-800 text-xs sm:text-sm leading-relaxed">
                  {analysisText}
                </div>
              ) : null}
            </div>

            {/* Rodapé com Botão de Ação */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                Alimentado deterministicamente pelos lançamentos auditados do Omie ERP
              </span>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
              >
                Concluir Leitura
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
