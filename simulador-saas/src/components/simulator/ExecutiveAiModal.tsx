'use client';
import React, { useState } from 'react';
import { SimulationResult } from '@/types/simulator.types';
import { X, Sparkles, Send, Bot, Lightbulb, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/date-utils';

interface ExecutiveAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: SimulationResult;
  companyName: string;
}

export function ExecutiveAiModal({ isOpen, onClose, result, companyName }: ExecutiveAiModalProps) {
  const [userPrompt, setUserPrompt] = useState('');
  const [customResponse, setCustomResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          prompt: userPrompt,
          result
        })
      });
      const data = await res.json();
      setCustomResponse(data.reply || 'Análise concluída com sucesso.');
    } catch (err) {
      setCustomResponse('Desculpe, ocorreu um erro ao consultar o assistente de IA.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold">Consultor IA Executivo</h3>
              <p className="text-xs text-slate-300">Análise inteligente de risco, caixa e tomadas de decisão para {companyName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-sm max-h-[70vh] overflow-y-auto">
          
          {/* Executive Summary Card */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4">
            <h4 className="font-bold text-emerald-950 flex items-center text-sm mb-2">
              <Lightbulb size={16} className="mr-1.5 text-emerald-600" />
              Diagnóstico Executivo do Cenário Atual
            </h4>
            <ul className="space-y-2 text-xs text-emerald-900 font-medium">
              {result.executiveSummary.map((item, idx) => (
                <li key={idx} className="flex items-start">
                  <CheckCircle2 size={14} className="mr-1.5 mt-0.5 text-emerald-600 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500 block">Variação no Resultado</span>
              <span className={`text-base font-bold ${result.variance.resultadoLiquidoDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {result.variance.resultadoLiquidoDiff >= 0 ? '+' : ''}{formatCurrencyBRL(result.variance.resultadoLiquidoDiff)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500 block">Runway Projetado</span>
              <span className="text-base font-bold text-slate-900">
                {result.simulatedKPIs.runwayMeses >= 99 ? '>99 meses' : `${result.simulatedKPIs.runwayMeses} meses`}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-slate-500 block">Ponto de Equilíbrio</span>
              <span className="text-base font-bold text-slate-900">
                {formatCurrencyBRL(result.simulatedKPIs.breakEvenReceitaBruta)}
              </span>
            </div>
          </div>

          {/* Custom IA Prompt & Response */}
          {customResponse && (
            <div className="p-4 bg-slate-900 text-slate-100 rounded-xl space-y-2 border border-slate-800">
              <div className="flex items-center text-xs font-semibold text-emerald-400">
                <Bot size={16} className="mr-1.5" />
                Resposta da IA:
              </div>
              <p className="text-xs leading-relaxed text-slate-300">{customResponse}</p>
            </div>
          )}

          {/* Pergunta livre */}
          <form onSubmit={handleAsk} className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Faça uma pergunta específica para o consultor financeiro:
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={userPrompt}
                onChange={e => setUserPrompt(e.target.value)}
                placeholder="Ex: Qual o impacto se reduzirmos 10% nas despesas fixas para contratar 1 Dev?"
                className="flex-1 px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-all active:scale-95 flex items-center disabled:opacity-50"
              >
                {isLoading ? 'Analisando...' : <Send size={15} />}
              </button>
            </div>
          </form>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Fechar Diagnóstico
          </button>
        </div>

      </div>
    </div>
  );
}
