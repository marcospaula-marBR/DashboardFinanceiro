"use client";

import React, { useState } from 'react';
import { Workstation, EmployeeGeoItem, WorkstationOptimizationSummary } from '@/types/workstations';
import {
  Sparkles, X, Bot, RefreshCw, Copy, Check, FileText,
  Building2, Car, Users, ArrowRight, Lightbulb, AlertCircle
} from 'lucide-react';

interface GeminiRouteAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  workstations: Workstation[];
  geoItems: EmployeeGeoItem[];
  metrics: WorkstationOptimizationSummary;
}

function formatInline(str: string): React.ReactNode {
  const parts = str.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-black text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function FormattedReport({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-3 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Título H1
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-base font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight mt-4 mb-2 border-b border-indigo-100 dark:border-indigo-900/60 pb-1">
              {formatInline(trimmed.replace('# ', ''))}
            </h1>
          );
        }

        // Título H2
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mt-3 mb-1.5 flex items-center gap-1.5">
              {formatInline(trimmed.replace('## ', ''))}
            </h2>
          );
        }

        // Título H3
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mt-2 mb-1">
              {formatInline(trimmed.replace('### ', ''))}
            </h3>
          );
        }

        // Lista com marcadores
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-indigo-600 font-black mt-0.5">•</span>
              <span className="flex-1">{formatInline(trimmed.substring(2))}</span>
            </div>
          );
        }

        // Lista numerada
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="font-mono font-bold text-indigo-600 shrink-0">{numMatch[1]}.</span>
              <span className="flex-1">{formatInline(numMatch[2])}</span>
            </div>
          );
        }

        // Linha normal
        return (
          <p key={idx} className="text-slate-700 dark:text-slate-300">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export function GeminiRouteAdvisorModal({
  isOpen,
  onClose,
  workstations,
  geoItems,
  metrics
}: GeminiRouteAdvisorModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const misallocated = geoItems.filter(g => !!g.potential_optimization);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/people/route-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workstations,
          misallocatedEmployees: misallocated,
          metrics,
          customPrompt: customPrompt.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao consultar o Gemini AI');
      }

      setReport(data.report);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao gerar relatório com IA.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 via-white to-purple-50/40 dark:from-slate-900 dark:to-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Gemini Route Advisor
                </h2>
                <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  Google AI Studio
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Parecer Executivo & Inteligência de Otimização de Trajetos e Remanejamento
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Mini Cards de Contexto */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Colaboradores Avaliados</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{geoItems.length}</span>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/30 p-3 rounded-2xl border border-rose-200/80 dark:border-rose-900/40">
              <span className="text-[10px] font-black uppercase text-rose-500 block">Oportunidades de Troca</span>
              <span className="text-lg font-black text-rose-600 dark:text-rose-400">{misallocated.length}</span>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40">
              <span className="text-[10px] font-black uppercase text-emerald-600 block">Ganho Potencial de Rota</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">-{metrics.potentialKmSaved} km/dia</span>
            </div>
          </div>

          {/* Campo de Instrução Customizada */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Lightbulb size={14} className="text-amber-500" />
              <span>Diretriz Adicional para o Gemini (Opcional)</span>
            </label>
            <input
              type="text"
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="Ex: Priorizar economia de vale-transporte para CLT, ou manter equipe jurídica em Santos..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-4 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Erro ao processar:</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Área de Visualização do Relatório */}
          {report ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Parecer Executivo Gerado pelo Gemini AI
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6">
                <FormattedReport text={report} />
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Bot size={40} className="mx-auto text-indigo-500 opacity-60" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Clique abaixo para processar a matriz de colaboradores com o Gemini
              </p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                O modelo analisa as distâncias reais de deslocamento, a capacidade das unidades do Grupo Mar Brasil e constrói o plano de remanejamento estratégico.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isLoading}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-500/25 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            <span>{isLoading ? 'Analisando com Gemini...' : report ? 'Regerar Parecer Executivo' : 'Gerar Parecer com Gemini'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
