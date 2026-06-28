"use client";

import { useState } from "react";
import { Calendar, Building2, CheckCircle2, ArrowRight, RefreshCw } from "lucide-react";

interface PeriodSelectorProps {
  onGenerate: (params: { startDate: string; endDate: string; company: string }) => void;
  isLoading: boolean;
  compact?: boolean;
  initialParams?: { startDate: string; endDate: string; company: string };
}

export function PeriodSelector({ onGenerate, isLoading, compact = false, initialParams }: PeriodSelectorProps) {
  const [preset, setPreset] = useState<string>(() => {
    if (initialParams) return "custom";
    return "";
  });
  
  const [company, setCompany] = useState<string>(initialParams?.company || "Ambas");
  
  const [startDate, setStartDate] = useState<string>(() => {
    if (initialParams) return initialParams.startDate;
    return "";
  });
  
  const [endDate, setEndDate] = useState<string>(() => {
    if (initialParams) return initialParams.endDate;
    return "";
  });

  const getPresetDates = (selectedPreset: string) => {
    const today = new Date();
    const start = new Date();
    const end = new Date();

    switch (selectedPreset) {
      case "semana":
        const dayOfWeek = today.getDay(); // 0 (Dom) a 6 (Sab)
        // A semana começa no domingo (dia 0). Distância para o domingo é simplesmente -dayOfWeek.
        start.setDate(today.getDate() - dayOfWeek);
        end.setDate(start.getDate() + 6); // Sábado
        break;
      case "15dias":
        // Hoje até hoje + 14 dias
        end.setDate(today.getDate() + 14);
        break;
      case "30dias":
        // Hoje até hoje + 29 dias
        end.setDate(today.getDate() + 29);
        break;
      default:
        break;
    }

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0]
    };
  };

  const handlePresetSelect = (selectedPreset: string) => {
    setPreset(selectedPreset);
    if (selectedPreset !== "custom") {
      const dates = getPresetDates(selectedPreset);
      setStartDate(dates.start);
      setEndDate(dates.end);
      // Auto submit se for compact
      if (compact) {
        onGenerate({ startDate: dates.start, endDate: dates.end, company });
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      alert("Por favor, selecione as datas de início e fim.");
      return;
    }
    onGenerate({ startDate, endDate, company });
  };

  if (compact) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => handlePresetSelect("semana")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                preset === "semana" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => handlePresetSelect("15dias")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                preset === "15dias" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              15 Dias
            </button>
            <button
              onClick={() => handlePresetSelect("30dias")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                preset === "30dias" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              30 Dias
            </button>
            <button
              onClick={() => setPreset("custom")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                preset === "custom" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Personalizado
            </button>
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
              />
              <span className="text-slate-400 text-xs font-bold">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-slate-400" />
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
            >
              <option value="Ambas">Todas Empresas</option>
              <option value="Mar Brasil">Mar Brasil</option>
              <option value="DZM">DZM</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/10 transition-all disabled:opacity-50 min-w-[140px]"
        >
          {isLoading ? (
            <><RefreshCw size={14} className="animate-spin" /> Atualizando...</>
          ) : (
            <><RefreshCw size={14} /> Atualizar Fluxo</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl w-full mx-auto bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-100 p-8 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Calendar className="text-emerald-600" size={32} />
      </div>

      <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Consulta de Fluxo de Caixa</h2>
      <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto">
        Selecione o horizonte de vencimentos das contas a pagar, receber e movimentações em tempo real com o Omie.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 text-left">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
            1. Escolha o Período de Vencimentos
          </label>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => handlePresetSelect("semana")}
              className={`p-4 rounded-2xl border-2 text-center transition-all ${
                preset === "semana"
                  ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold"
                  : "border-slate-100 bg-slate-50 hover:bg-slate-100/70 text-slate-700 font-semibold"
              }`}
            >
              <div className="text-sm">Esta Semana</div>
              <div className="text-[10px] text-slate-400 mt-1">Domingo a Sábado</div>
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("15dias")}
              className={`p-4 rounded-2xl border-2 text-center transition-all ${
                preset === "15dias"
                  ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold"
                  : "border-slate-100 bg-slate-50 hover:bg-slate-100/70 text-slate-700 font-semibold"
              }`}
            >
              <div className="text-sm">Próximos 15 Dias</div>
              <div className="text-[10px] text-slate-400 mt-1">Horizonte curto</div>
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("30dias")}
              className={`p-4 rounded-2xl border-2 text-center transition-all ${
                preset === "30dias"
                  ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold"
                  : "border-slate-100 bg-slate-50 hover:bg-slate-100/70 text-slate-700 font-semibold"
              }`}
            >
              <div className="text-sm">Próximos 30 Dias</div>
              <div className="text-[10px] text-slate-400 mt-1">Mensal consolidado</div>
            </button>
            <button
              type="button"
              onClick={() => setPreset("custom")}
              className={`p-4 rounded-2xl border-2 text-center transition-all ${
                preset === "custom"
                  ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold"
                  : "border-slate-100 bg-slate-50 hover:bg-slate-100/70 text-slate-700 font-semibold"
              }`}
            >
              <div className="text-sm">Personalizado</div>
              <div className="text-[10px] text-slate-400 mt-1">Escolher datas</div>
            </button>
          </div>

          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Data Inicial
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Data Final
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            2. Empresa
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer"
            >
              <option value="Ambas">DZM e Mar Brasil (Consolidado)</option>
              <option value="Mar Brasil">Mar Brasil</option>
              <option value="DZM">DZM</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !preset || (preset === "custom" && (!startDate || !endDate))}
          className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-600/25 disabled:shadow-none transition-all cursor-pointer"
        >
          {isLoading ? (
            "Consolidando dados do Omie..."
          ) : (
            <>
              Gerar Fluxo de Caixa
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
