import React, { useState, useEffect } from 'react';
import { X, Save, Edit3, MonitorSmartphone, Layers } from 'lucide-react';

interface DreEquipmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  validColumns: string[];
  initialCounts: Record<string, number>;
  onSave: (counts: Record<string, number>) => Promise<void>;
}

export function DreEquipmentsModal({
  isOpen,
  onClose,
  validColumns,
  initialCounts,
  onSave
}: DreEquipmentsModalProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [bulkValue, setBulkValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const defaultCounts: Record<string, number> = {};
    validColumns.forEach(col => {
      defaultCounts[col] = initialCounts[col] || 0;
    });
    setCounts(defaultCounts);
  }, [validColumns, initialCounts, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (col: string, val: string) => {
    const num = parseInt(val) || 0;
    setCounts(prev => ({ ...prev, [col]: num >= 0 ? num : 0 }));
  };

  const applyBulkValue = () => {
    const num = parseInt(bulkValue) || 0;
    if (num < 0) return;
    const updated = { ...counts };
    validColumns.forEach(col => {
      updated[col] = num;
    });
    setCounts(updated);
    setBulkValue("");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(counts);
      onClose();
    } catch (err: any) {
      alert("Falha ao salvar quantidades: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-150 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <MonitorSmartphone size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Parque de Máquinas</h2>
              <p className="text-xs font-semibold text-slate-500">Insira a quantidade de equipamentos ativos por mês</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Bulk Tool */}
        <div className="p-5 bg-indigo-50/50 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-indigo-800">
            <Layers size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Ajuste em Lote</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="number"
              placeholder="Qtd para todos os meses"
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className="bg-white border border-slate-200 text-xs px-3 py-1.5 rounded-xl w-36 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right"
              min="0"
            />
            <button
              type="button"
              onClick={applyBulkValue}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all duration-200"
            >
              Aplicar
            </button>
          </div>
        </div>

        {/* List of Months */}
        <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-3.5">
            {validColumns.map(col => (
              <div key={col} className="flex items-center justify-between bg-slate-50 hover:bg-slate-100/70 p-3 rounded-2xl border border-slate-150 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-700 text-xs">
                    {col}
                  </div>
                  <span className="text-sm font-semibold text-slate-700">Mês de Referência</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <input
                    type="number"
                    value={counts[col] === undefined ? "" : counts[col]}
                    onChange={(e) => handleInputChange(col, e.target.value)}
                    className="w-24 text-right bg-white border border-slate-250 text-slate-800 text-sm font-bold px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    min="0"
                    placeholder="0"
                    required
                  />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-8">Máq.</span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="p-5 border-t border-slate-150 bg-slate-50/50 flex justify-end gap-3 select-none">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-250 text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-sm transition-colors flex items-center gap-1.5"
            >
              {isSaving ? "Salvando..." : (
                <>
                  <Save size={16} />
                  <span>Salvar Parque</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
