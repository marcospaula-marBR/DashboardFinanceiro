"use client";

import { useState, useEffect } from "react";
import { X, ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, Database, Zap, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LoansService } from "@/services/loans.service";
import { useDataMode } from "@/contexts/DataModeContext";

interface SyncIntegrityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReconciled?: () => void;
}

export function SyncIntegrityModal({ isOpen, onClose, onReconciled }: SyncIntegrityModalProps) {
  const { isTestMode } = useDataMode();
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<{ checked: number; reconciled: number; lastRun?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      handleCheckIntegrity();
    }
  }, [isOpen, isTestMode]);

  const handleCheckIntegrity = async () => {
    setIsRunning(true);
    setError(null);
    setSuccessToast(null);

    try {
      const res = await LoansService.reconcileAllLoanPayments(isTestMode);
      setStats({
        checked: res.checked,
        reconciled: res.reconciled,
        lastRun: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      });
      if (res.reconciled > 0) {
        setSuccessToast(`Paridade restaurada: ${res.reconciled} parcelas foram re-sincronizadas com seus contratos!`);
      } else {
        setSuccessToast(`Integridade perfeita: todas as ${res.checked} parcelas estão 100% alinhadas.`);
      }
      if (onReconciled && res.reconciled > 0) {
        onReconciled();
      }
    } catch (err: any) {
      console.error("[SyncIntegrityModal] Erro ao reconciliar:", err);
      setError("Falha ao auditar banco de dados: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-xl bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col border border-slate-200"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/80 via-white to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Auditoria de Integridade & Sincronização
                  </h3>
                  <p className="text-xs text-slate-500">
                    Garantia de paridade atômica entre contratos e parcelas
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                    <Database size={12} />
                    Auditadas
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {stats?.checked ?? "—"}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">parcelas no banco</span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase text-emerald-700 tracking-wider mb-1">
                    <CheckCircle2 size={12} />
                    Alinhadas
                  </div>
                  <div className="text-2xl font-black text-emerald-700">
                    {stats ? stats.checked - (stats.reconciled || 0) : "—"}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">100% íntegras</span>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase text-amber-700 tracking-wider mb-1">
                    <Zap size={12} />
                    Corrigidas
                  </div>
                  <div className="text-2xl font-black text-amber-700">
                    {stats?.reconciled ?? "0"}
                  </div>
                  <span className="text-[10px] text-amber-600 font-medium">auto-reparadas</span>
                </div>
              </div>

              {/* Status Banner */}
              {successToast && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs leading-relaxed animate-in fade-in duration-200">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Status do Banco de Dados:</span>
                    {successToast}
                    {stats?.lastRun && (
                      <span className="text-[10px] text-emerald-600/80 block mt-0.5 flex items-center gap-1">
                        <Clock size={10} /> Última auditoria às {stats.lastRun}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Explanatory Info Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
                <h4 className="font-black text-slate-800 uppercase tracking-tight text-[11px] flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  Blindagem & Sincronização Contínua
                </h4>
                <p className="leading-relaxed">
                  O sistema monitora ativamente a correspondência entre a tabela mestre (<code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[10px]">employee_loans</code>) e as parcelas (<code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[10px]">loan_payments</code>).
                </p>
                <p className="leading-relaxed text-slate-500">
                  Qualquer reatribuição cadastral ou transferência de tomador é sincronizada automaticamente pelos gatilhos no PostgreSQL e pelo motor de auto-cura do servidor, sem risco de dados órfãos.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 font-medium">
                  {isRunning ? "Verificando base de dados..." : "Auditoria sob demanda"}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCheckIntegrity}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-200 transition-all cursor-pointer"
                  >
                    <RefreshCw size={14} className={isRunning ? "animate-spin" : ""} />
                    {isRunning ? "Auditando..." : "Executar Varredura Agora"}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
