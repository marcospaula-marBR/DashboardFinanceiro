"use client";

import { useState, useMemo } from "react";
import { X, AlertCircle, ArrowRight, Merge } from "lucide-react";
import { ContratoBase } from "@/types/comissoes";

interface UnificacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (origemId: string, destinoId: string) => Promise<void>;
  contratos: ContratoBase[];
}

export function UnificacaoModal({ isOpen, onClose, onConfirm, contratos }: UnificacaoModalProps) {
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtra os contratos de destino para não incluir o de origem
  const destinationOptions = useMemo(() => {
    return contratos.filter(c => c.id !== origemId);
  }, [contratos, origemId]);

  const handleSubmit = async () => {
    if (!origemId) {
      setError("Selecione o contrato duplicado (origem).");
      return;
    }
    if (!destinoId) {
      setError("Selecione o contrato correto (destino).");
      return;
    }
    if (origemId === destinoId) {
      setError("O contrato de origem e destino não podem ser o mesmo.");
      return;
    }

    const origem = contratos.find(c => c.id === origemId);
    const destino = contratos.find(c => c.id === destinoId);

    const conf = confirm(
      `Deseja mesmo unificar os contratos?\n\n` +
      `De: "${origem?.nome_contrato}"\n` +
      `Para: "${destino?.nome_contrato}"\n\n` +
      `Isso irá transferir permanentemente todas as faturas, recebimentos e comissões e desativar o contrato "${origem?.nome_contrato}".`
    );

    if (!conf) return;

    setIsSaving(true);
    setError(null);
    try {
      await onConfirm(origemId, destinoId);
      setOrigemId("");
      setDestinoId("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao realizar unificação.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200/30">
              <Merge size={16} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">
                Unificar Contratos
              </h2>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                Mescle duplicatas transferindo o histórico de faturamento.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Alerta explicativo */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
            <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 font-semibold leading-relaxed">
              Use essa ferramenta para corrigir nomenclaturas repetidas. Todas as comissões e notas fiscais serão migradas para o contrato correto. O contrato duplicado será desativado.
            </div>
          </div>

          {/* Contrato de Origem */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Contrato Duplicado (A ser mesclado/removido) *
            </label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              value={origemId}
              onChange={e => {
                setOrigemId(e.target.value);
                setDestinoId("");
              }}
            >
              <option value="">Selecione o contrato duplicado...</option>
              {contratos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome_contrato} {c.rede ? `(Rede: ${c.rede})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Seta de transição visual */}
          {origemId && (
            <div className="flex justify-center text-slate-300 py-1">
              <ArrowRight size={20} className="rotate-90 md:rotate-0" />
            </div>
          )}

          {/* Contrato de Destino */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Contrato Correto (A ser mantido) *
            </label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              value={destinoId}
              onChange={e => setDestinoId(e.target.value)}
              disabled={!origemId}
            >
              <option value="">Selecione o contrato correto...</option>
              {destinationOptions.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome_contrato} {c.rede ? `(Rede: ${c.rede})` : ""}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="flex-1 py-2.5 text-xs font-black uppercase text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl transition-colors bg-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !origemId || !destinoId}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
          >
            {isSaving ? "Unificando..." : "Unificar"}
          </button>
        </div>
      </div>
    </div>
  );
}
