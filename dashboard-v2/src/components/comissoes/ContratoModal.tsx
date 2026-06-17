"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { ContratoBase } from "@/types/comissoes";

interface ContratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: { 
    nome_contrato: string; 
    numero_contrato?: string; 
    observacoes?: string;
    rede?: string | null;
  }) => Promise<void>;
  editData?: ContratoBase | null;
}

export function ContratoModal({ isOpen, onClose, onSave, editData }: ContratoModalProps) {
  const [nome, setNome] = useState("");
  const [numero, setNumero] = useState("");
  const [obs, setObs] = useState("");
  const [redeOption, setRedeOption] = useState(""); // "", "Rede Alpha", "Capina Elétrica", "Bertioga", "custom"
  const [customRede, setCustomRede] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (editData) {
      setNome(editData.nome_contrato);
      setNumero(editData.numero_contrato ?? "");
      setObs(editData.observacoes ?? "");
      
      const r = editData.rede ?? "";
      if (r === "" || r === "Rede Alpha" || r === "Capina Elétrica" || r === "Bertioga") {
        setRedeOption(r);
        setCustomRede("");
      } else {
        setRedeOption("custom");
        setCustomRede(r);
      }
    } else {
      setNome("");
      setNumero("");
      setObs("");
      setRedeOption("");
      setCustomRede("");
    }
    setError(null);
  }, [isOpen, editData]);

  const handleSubmit = async () => {
    if (!nome.trim()) { 
      setError("Nome do contrato é obrigatório."); 
      return; 
    }
    
    const finalRede = redeOption === "custom" ? customRede.trim() : redeOption;

    setIsSaving(true);
    setError(null);
    try {
      await onSave({ 
        nome_contrato: nome.trim(), 
        numero_contrato: numero || undefined, 
        observacoes: obs || undefined,
        rede: finalRede || null
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar contrato.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900">
            {editData ? "Editar Contrato" : "Novo Contrato"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Nome *</label>
            <input
              type="text"
              placeholder="Ex: Prefeitura de Fortaleza"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-700"
              value={nome}
              onChange={e => setNome(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Número (opcional)</label>
            <input
              type="text"
              placeholder="Ex: CT-2024-001"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-700"
              value={numero}
              onChange={e => setNumero(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Rede / Chapéu (opcional)</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-slate-700"
              value={redeOption}
              onChange={e => setRedeOption(e.target.value)}
            >
              <option value="">Sem Rede (Contrato Independente)</option>
              <option value="Rede Alpha">Rede Alpha</option>
              <option value="Capina Elétrica">Capina Elétrica</option>
              <option value="Bertioga">Bertioga</option>
              <option value="custom">Nova Rede / Personalizada...</option>
            </select>
          </div>

          {redeOption === "custom" && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Nome da Nova Rede *</label>
              <input
                type="text"
                placeholder="Ex: Rede Beta"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-700"
                value={customRede}
                onChange={e => setCustomRede(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Observações (opcional)</label>
            <textarea
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none text-slate-700"
              value={obs}
              onChange={e => setObs(e.target.value)}
            />
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl transition-colors bg-white">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
