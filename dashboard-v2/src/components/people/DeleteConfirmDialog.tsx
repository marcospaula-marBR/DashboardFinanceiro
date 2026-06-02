"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Trash2, Loader2 } from "lucide-react";

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  employeeName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  isOpen,
  employeeName,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches =
    typed.trim().toLowerCase() === employeeName.trim().toLowerCase();

  const handleConfirm = async () => {
    if (!matches) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao excluir";
      setError(message);
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setTyped("");
    setError(null);
    onCancel();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-red-100 overflow-hidden">
              <div className="bg-red-600 p-5 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="text-white font-black text-sm">
                    Excluir Colaborador Permanentemente
                  </h3>
                  <p className="text-red-100 text-xs mt-0.5">
                    Esta ação não pode ser desfeita.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="ml-auto text-white/70 hover:text-white transition-colors"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Todos os dados de{" "}
                  <strong className="text-slate-900">{employeeName}</strong>{" "}
                  serão removidos permanentemente, incluindo histórico de
                  aditivos e vínculos.
                </p>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                    Digite o nome do colaborador para confirmar:
                  </label>
                  <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                    placeholder={employeeName}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-all"
                    autoFocus
                  />
                  {typed && !matches && (
                    <p className="text-[11px] text-red-500 mt-1">
                      O nome não confere. Verifique e tente novamente.
                    </p>
                  )}
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!matches || isDeleting}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    {isDeleting ? "Excluindo..." : "Excluir Definitivamente"}
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
