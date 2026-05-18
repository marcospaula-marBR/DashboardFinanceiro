"use client";

import { useState } from "react";
import { X, Calendar, FileText, Download, LayoutDashboard } from "lucide-react";

export interface ExportOptions {
  format: 'csv' | 'pdf';
  startDate?: string;
  endDate?: string;
  includeSummary: boolean;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  defaultFormat?: 'csv' | 'pdf';
}

export function ExportModal({ isOpen, onClose, onExport, defaultFormat = 'pdf' }: ExportModalProps) {
  const [format, setFormat] = useState<'csv' | 'pdf'>(defaultFormat);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [includeSummary, setIncludeSummary] = useState(true);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport({
      format,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      includeSummary
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Exportar Relatório</h2>
              <p className="text-xs text-slate-500">Configure os dados para exportação</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Formato */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Formato do Arquivo
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                  format === 'pdf' 
                    ? 'border-red-500 bg-red-50 text-red-700 font-bold' 
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <FileText size={18} />
                PDF
              </button>
              <button
                onClick={() => setFormat('csv')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                  format === 'csv' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' 
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <FileText size={18} />
                CSV
              </button>
            </div>
          </div>

          {/* Período */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Calendar size={14} />
              Período de Solicitação / Liberação
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-medium">De</span>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-medium">Até</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Se preenchido, o relatório mostrará apenas os empréstimos solicitados/assinados neste período, e os totais serão calculados baseados apenas neles.
            </p>
          </div>

          {/* Opções Extras */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <LayoutDashboard size={14} />
              Conteúdo
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox" 
                checked={includeSummary}
                onChange={(e) => setIncludeSummary(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-700">Incluir Resumo de Totais</span>
                <span className="text-xs text-slate-500">Adiciona os totais gerais (Tomado, Recebido, Qtd, etc) no início do relatório.</span>
              </div>
            </label>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleExport}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all"
          >
            Gerar Relatório
          </button>
        </div>
      </div>
    </div>
  );
}
