"use client";

import { useState, useEffect } from "react";
import { X, History, Loader2, CheckCircle2, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { ClaraSyncRun } from "@/types/clara.types";

interface ClaraSyncHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClaraSyncHistoryModal({ isOpen, onClose }: ClaraSyncHistoryModalProps) {
  const [runs, setRuns] = useState<ClaraSyncRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clara/sync-runs');
      const data = await res.json();
      if (data.data) setRuns(data.data);
    } catch (e: any) {
      console.error('Erro ao carregar histórico:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Histórico de Sincronizações</h2>
              <p className="text-xs text-slate-500">Registro detalhado de cada execução manual ou automática</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <Loader2 className="animate-spin inline mr-2" size={20} />
              Carregando histórico...
            </div>
          ) : runs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              Nenhuma sincronização registrada ainda.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {runs.map(run => (
                <div key={run.id} className="p-4 text-xs hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                        run.status === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : run.status === 'PARTIAL'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : run.status === 'ERROR'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {run.status === 'SUCCESS' && <CheckCircle2 size={12} />}
                        {run.status === 'ERROR' && <AlertCircle size={12} />}
                        {run.status === 'RUNNING' && <Clock size={12} />}
                        {run.status}
                      </span>

                      <span className="text-slate-400">|</span>

                      <span className="text-[11px] font-semibold text-slate-700">
                        {run.trigger_type === 'MANUAL' ? 'Disparo Manual' : 'Agendado (Cron)'}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      Início: {formatDate(run.started_at)}
                    </span>
                  </div>

                  {/* Badges / contadores */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 text-center">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase block">Recebidas</span>
                      <strong className="text-slate-800 text-sm font-black">{run.transactions_received}</strong>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase block">Novas</span>
                      <strong className="text-slate-800 text-sm font-black">{run.transactions_created}</strong>
                    </div>

                    <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-emerald-700 uppercase block">Omie Lançados</span>
                      <strong className="text-emerald-800 text-sm font-black">{run.transactions_synced}</strong>
                    </div>

                    <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                      <span className="text-[10px] text-blue-700 uppercase block">Anexos Subidos</span>
                      <strong className="text-blue-800 text-sm font-black">{run.attachments_uploaded}</strong>
                    </div>

                    <div className="p-2 bg-red-50 rounded-lg border border-red-100">
                      <span className="text-[10px] text-red-700 uppercase block">Erros</span>
                      <strong className="text-red-800 text-sm font-black">{run.transactions_failed}</strong>
                    </div>
                  </div>

                  {run.error_message && (
                    <div className="mt-2 text-[11px] text-red-600 bg-red-50/70 p-2 rounded border border-red-200">
                      {run.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={loadHistory}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
          >
            <RefreshCw size={14} /> Atualizar Histórico
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
