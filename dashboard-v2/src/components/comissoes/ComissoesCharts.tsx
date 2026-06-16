"use client";

import { useState, useMemo } from "react";
import { 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { ProjectionData } from "@/types/comissoes";
import { formatCurrency } from "@/services/comissoes.service";

const COLORS = [
  '#f59e0b', // Amber (Primary for commissions/gold)
  '#10b981', // Emerald
  '#0ea5e9', // Sky Blue
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#64748b', // Slate
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f43f5e', // Rose
  '#84cc16', // Lime
];

// Tooltips customizados (declarados fora do render para evitar recriação e erros de lint)
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  label?: string | number;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 text-xs">
      <p className="font-black text-slate-800 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-500 font-semibold">
            {entry.name === 'total' ? 'Realizado' : 'Previsto'}:
          </span>
          <span className="font-black text-slate-800">{formatCurrency(Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
};

interface CustomPieTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      value: number;
    };
  }>;
  totalSum?: number;
}

const CustomPieTooltip = ({ active, payload, totalSum = 0 }: CustomPieTooltipProps) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const percent = totalSum > 0 ? ((data.value / totalSum) * 100).toFixed(1) : "0";
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 text-xs">
      <p className="font-black text-slate-800 mb-1">{data.name}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-slate-500 font-semibold">Total:</span>
        <span className="font-black text-slate-800">{formatCurrency(data.value)}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-slate-500 font-semibold">Participação:</span>
        <span className="font-black text-amber-600">{percent}%</span>
      </div>
    </div>
  );
};

interface ComissoesChartsProps {
  projectionsData: ProjectionData[];
  historyData: ProjectionData[];
  concentrationData: { name: string; value: number }[];
  concentrationTitle: string;
}

export function ComissoesCharts({ 
  projectionsData = [], 
  historyData = [], 
  concentrationData = [],
  concentrationTitle = "Comissões"
}: ComissoesChartsProps) {
  const [activeTab, setActiveTab] = useState<"projections" | "history" | "concentration">("projections");
  
  // Controles de Período
  const [projectionMonths, setProjectionMonths] = useState<number>(12);

  // Filtragem e Formatação de Projeções
  const formattedProjections = useMemo(() => {
    const data = projectionsData.slice(0, projectionMonths);
    return data.map(d => ({
      month: d.month,
      total: Number(d.total.toFixed(2)),
      previsto: Number(d.previsto.toFixed(2)),
    }));
  }, [projectionsData, projectionMonths]);

  // Filtragem e Formatação de Histórico
  const formattedHistory = useMemo(() => {
    return historyData.map(d => ({
      month: d.month,
      total: Number(d.total.toFixed(2)),
      previsto: Number(d.previsto.toFixed(2)),
    }));
  }, [historyData]);

  const concentrationTotalSum = useMemo(() => {
    return concentrationData.reduce((sum, item) => sum + item.value, 0);
  }, [concentrationData]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col h-[480px]">
      {/* Abas e Títulos */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded uppercase">Indicadores</span>
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Painel Analítico de Faturamento
          </h3>
        </div>

        {/* Seletores de Abas */}
        <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/30">
          <button
            onClick={() => setActiveTab("projections")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "projections"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Projeção Futura
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "history"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Histórico Recebido
          </button>
          <button
            onClick={() => setActiveTab("concentration")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "concentration"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Concentração ({concentrationTitle})
          </button>
        </div>
      </div>

      {/* Controles de Gráfico e Visualização */}
      <div className="flex justify-between items-center mb-4 min-h-[38px] bg-slate-50/60 px-4 py-2 rounded-xl border border-slate-100">
        <div>
          {activeTab === "projections" && (
            <p className="text-[11px] text-slate-400 font-bold">
              Projeção de fluxo de recebimentos futuros dos contratos
            </p>
          )}
          {activeTab === "history" && (
            <p className="text-[11px] text-slate-400 font-bold">
              Histórico de parcelas faturadas vs liquidadas
            </p>
          )}
          {activeTab === "concentration" && (
            <p className="text-[11px] text-slate-400 font-bold">
              Divisão de participação no total de comissões por colaborador
            </p>
          )}
        </div>

        <div>
          {activeTab === "projections" && (
            <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 text-[10px]">
              <button 
                onClick={() => setProjectionMonths(6)}
                className={`px-2 py-0.5 rounded font-black ${projectionMonths === 6 ? 'bg-amber-500 text-white' : 'text-slate-500'}`}
              >
                6M
              </button>
              <button 
                onClick={() => setProjectionMonths(12)}
                className={`px-2 py-0.5 rounded font-black ${projectionMonths === 12 ? 'bg-amber-500 text-white' : 'text-slate-500'}`}
              >
                12M
              </button>
              <button 
                onClick={() => setProjectionMonths(24)}
                className={`px-2 py-0.5 rounded font-black ${projectionMonths === 24 ? 'bg-amber-500 text-white' : 'text-slate-500'}`}
              >
                24M
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Área do Gráfico */}
      <div className="flex-1 w-full min-h-0">
        {activeTab === "projections" && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={formattedProjections} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v).replace('R$', '').trim()} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
              <Bar dataKey="previsto" name="Faturamentos Previstos" fill="#fcd34d" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Line type="monotone" dataKey="total" name="Recebido Realizado" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {activeTab === "history" && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={formattedHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v).replace('R$', '').trim()} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
              <Bar dataKey="previsto" name="Total Faturado" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Line type="monotone" dataKey="total" name="Total Recebido" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {activeTab === "concentration" && (
          <div className="flex h-full items-center justify-center">
            {concentrationData.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhum dado financeiro para exibir a distribuição.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 w-full h-full items-center">
                <div className="h-[250px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={concentrationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {concentrationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip totalSum={concentrationTotalSum} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Centro da Rosca */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Geral</span>
                    <span className="text-base font-black text-slate-800 mt-1 tabular-nums">
                      {formatCurrency(concentrationTotalSum)}
                    </span>
                  </div>
                </div>

                {/* Legendas Customizadas */}
                <div className="max-h-[220px] overflow-y-auto pr-2 space-y-2 text-xs font-semibold text-slate-600">
                  {concentrationData.map((item, idx) => {
                    const percent = concentrationTotalSum > 0 ? ((item.value / concentrationTotalSum) * 100).toFixed(1) : "0";
                    return (
                      <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-1.5 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
                          <span className="truncate uppercase text-[11px] font-black tracking-tight">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 tabular-nums">
                          <span className="text-slate-800 font-bold">{formatCurrency(item.value)}</span>
                          <span className="bg-slate-100 text-[10px] font-bold px-1.5 py-0.5 rounded text-slate-500">{percent}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
