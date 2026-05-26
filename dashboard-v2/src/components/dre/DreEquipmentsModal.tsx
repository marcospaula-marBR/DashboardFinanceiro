import React, { useState, useEffect } from 'react';
import { X, Save, Layers, MonitorSmartphone, Calendar, Copy } from 'lucide-react';

interface DreEquipmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  validColumns: string[];
  departamentos: string[];
  initialCounts: Record<string, Record<string, number>>; // e.g. { "Jan/24": { "Oftalmo": 10 } }
  onSave: (counts: Record<string, Record<string, number>>) => Promise<void>;
}

export function DreEquipmentsModal({
  isOpen,
  onClose,
  validColumns,
  departamentos,
  initialCounts,
  onSave
}: DreEquipmentsModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [counts, setCounts] = useState<Record<string, Record<string, number>>>({});
  const [bulkValue, setBulkValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (validColumns.length > 0 && !selectedMonth) {
      setSelectedMonth(validColumns[0]);
    }
  }, [validColumns, selectedMonth, isOpen]);

  useEffect(() => {
    const formattedCounts: Record<string, Record<string, number>> = {};
    validColumns.forEach(col => {
      formattedCounts[col] = {};
      departamentos.forEach(dept => {
        formattedCounts[col][dept] = initialCounts[col]?.[dept] || 0;
      });
    });
    setCounts(formattedCounts);
  }, [validColumns, departamentos, initialCounts, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (dept: string, val: string) => {
    const num = parseInt(val) || 0;
    const cleanNum = num >= 0 ? num : 0;
    setCounts(prev => ({
      ...prev,
      [selectedMonth]: {
        ...(prev[selectedMonth] || {}),
        [dept]: cleanNum
      }
    }));
  };

  const applyBulkValue = () => {
    const num = parseInt(bulkValue) || 0;
    if (num < 0) return;
    setCounts(prev => {
      const updatedMonth = { ...(prev[selectedMonth] || {}) };
      departamentos.forEach(dept => {
        updatedMonth[dept] = num;
      });
      return { ...prev, [selectedMonth]: updatedMonth };
    });
    setBulkValue("");
  };

  const copyToAllMonths = () => {
    const currentMonthValues = counts[selectedMonth] || {};
    setCounts(prev => {
      const updated = { ...prev };
      validColumns.forEach(col => {
        if (col !== selectedMonth) {
          updated[col] = { ...currentMonthValues };
        }
      });
      return updated;
    });
    alert(`Valores de ${selectedMonth} copiados com sucesso para todos os demais meses!`);
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

  const currentMonthCounts = counts[selectedMonth] || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-150 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <MonitorSmartphone size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Parque de Máquinas por Departamento</h2>
              <p className="text-xs font-semibold text-slate-500">Insira a quantidade de equipamentos ativos por contrato/dep.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Selection bar & Tools */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/20 flex flex-col gap-4">
          {/* Pick month */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-700">
              <Calendar size={16} className="text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider">Período de Referência</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[120px] text-slate-700"
            >
              {validColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          {/* Bulk actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <input 
                type="number"
                placeholder="Qtd para todos neste mês"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                className="bg-white border border-slate-200 text-xs px-3 py-1.5 rounded-xl w-44 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right"
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

            <button
              type="button"
              onClick={copyToAllMonths}
              className="flex items-center justify-center gap-1.5 border border-amber-200 hover:border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all duration-200"
              title="Copia todos os valores deste mês para os demais meses"
            >
              <Copy size={12} />
              <span>Replicar para todos os meses</span>
            </button>
          </div>
        </div>

        {/* List of Departments */}
        <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            {departamentos.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-xs">Nenhum departamento encontrado.</p>
            ) : (
              departamentos.map(dept => (
                <div key={dept} className="flex items-center justify-between bg-slate-50 hover:bg-slate-100/55 p-3 rounded-2xl border border-slate-150 transition-colors">
                  <span className="text-xs font-bold text-slate-700 max-w-[280px] truncate">{dept}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={currentMonthCounts[dept] === undefined ? "" : currentMonthCounts[dept]}
                      onChange={(e) => handleInputChange(dept, e.target.value)}
                      className="w-20 text-right bg-white border border-slate-250 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      min="0"
                      placeholder="0"
                      required
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-8">Máq.</span>
                  </div>
                </div>
              ))
            )}
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
