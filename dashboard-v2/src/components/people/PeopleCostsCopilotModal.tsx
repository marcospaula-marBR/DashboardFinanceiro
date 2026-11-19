"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Database,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";

interface CopilotToolExecution {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "gemini_tool_calling" | "deterministic_fallback";
  coverage?: {
    totalRowsAnalyzed: number;
    totalEmployees: number;
    minCompetencia: string;
    maxCompetencia: string;
  };
  toolExecutions?: CopilotToolExecution[];
}

interface PeopleCostsCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUGGESTED_QUESTIONS = [
  "Quanto gastamos com VT e VR/Cesta na DZM em 2026?",
  "Quais contratadas PJ tiveram variação acima de 10% no último mês?",
  "Mostre a evolução mensal de 2026 segregando CLT, Estágio e PJ/MEI",
  "Qual foi o total desembolsado em Outubro/2026 por empresa e natureza jurídica?",
];

export function PeopleCostsCopilotModal({ isOpen, onClose }: PeopleCostsCopilotModalProps) {
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedAuditIds, setExpandedAuditIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const resetConversation = () => {
    setMessages([]);
    setErrorMessage(null);
    setQuestion("");
    setExpandedAuditIds(new Set());
  };

  const toggleAudit = (msgId: string) => {
    setExpandedAuditIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const askQuestion = async (promptText: string, forceDeterministic = false) => {
    const clean = promptText.trim();
    if (!clean || isLoading) return;

    setLastQuestion(clean);
    const userMsg: CopilotMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: clean,
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/people/costs-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: clean, forceDeterministic }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Falha no Copiloto (${res.status})`);
      }

      const assistantMsg: CopilotMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: String(json.answer || "Sem resposta."),
        mode: json.mode,
        coverage: json.coverage,
        toolExecutions: Array.isArray(json.toolExecutions) ? json.toolExecutions : [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao consultar o Copiloto.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles size={19} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>Copiloto Executivo de Custos</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  Tool Calling Determinístico • 100% da Base
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Consultas auditadas sobre toda a série histórica segregando Folha CLT, Estágio e Contratos PJ/MEI.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={resetConversation}
                className="min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title="Nova Consulta / Limpar Histórico"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Nova Consulta</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white shrink-0"
              title="Fechar Copiloto"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MENSAGENS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/40 dark:bg-slate-950/20">
          {messages.length === 0 ? (
            <div className="space-y-4 py-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Perguntas Executivas Rápidas (Zero Alucinação)
                </p>
                <p className="text-xs text-slate-400">
                  Cada resposta executa funções matemáticas determinísticas sobre 100% de <code className="font-mono">people_monthly_costs</code>.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => askQuestion(q)}
                    className="min-h-[48px] p-3 text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-2xs ${
                    msg.role === "user"
                      ? "bg-emerald-600 text-white font-bold"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 space-y-2.5"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {msg.role === "assistant" && msg.coverage && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                        <Database size={11} />
                        Base auditada: {msg.coverage.totalRowsAnalyzed} lançamentos ({msg.coverage.minCompetencia} a {msg.coverage.maxCompetencia})
                      </span>

                      {msg.toolExecutions && msg.toolExecutions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleAudit(msg.id)}
                          className="font-black text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1"
                        >
                          {expandedAuditIds.has(msg.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span>Dados Auditados ({msg.toolExecutions.length})</span>
                        </button>
                      )}
                    </div>
                  )}

                  {msg.role === "assistant" &&
                    msg.toolExecutions &&
                    expandedAuditIds.has(msg.id) && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 max-h-60 overflow-auto">
                        {msg.toolExecutions.map((exec, idx) => (
                          <div key={`${exec.tool}-${idx}`} className="space-y-1">
                            <div className="text-[10px] font-black font-mono text-teal-700 dark:text-teal-400">
                              {exec.tool}({JSON.stringify(exec.args)})
                            </div>
                            <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-300 overflow-x-auto">
                              {JSON.stringify(exec.result, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <Loader2 size={15} className="animate-spin" />
              <span>Consultando base determinística e consolidando números...</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-3">
              <div className="flex items-start gap-2.5 text-rose-700 dark:text-rose-300">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold">Ocorreu um erro no processamento:</div>
                  <div className="font-mono text-[11px] bg-rose-100/70 dark:bg-rose-900/40 p-2 rounded-lg break-words">
                    {errorMessage}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {lastQuestion && (
                  <button
                    type="button"
                    onClick={() => askQuestion(lastQuestion, true)}
                    className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Database size={14} />
                    <span>Calcular via motor determinístico direto</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetConversation}
                  className="min-h-[44px] px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCcw size={14} />
                  <span>Limpar conversa</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* INPUT */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            askQuestion(question);
          }}
          className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pergunte sobre custos CLT, Estágio ou PJ/MEI (ex: Quanto gastamos com VT na DZM no 1º sem/2026?)"
            className="flex-1 min-h-[44px] px-3.5 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm disabled:opacity-50 shrink-0"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            <span className="hidden sm:inline">Consultar</span>
          </button>
        </form>
      </div>
    </div>
  );
}
