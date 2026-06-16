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
import { ProjectionData, Employee } from "@/types/loans";
import { formatCurrency } from "@/services/loans.service";

// Cores premium selecionadas de acordo com as regras de design (sem roxo/violeta)
const COLORS = [
  '#0ea5e9', // Sky Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#64748b', // Slate
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f43f5e', // Rose
  '#84cc16', // Lime
];

interface DashboardChartsProps {
  projectionsData: ProjectionData[];
  historyData: ProjectionData[];
  employees: Employee[];
}

export function DashboardCharts({ projectionsData = [], historyData = [], employees = [] }: DashboardChartsProps) {
  const [activeTab, setActiveTab] = useState<"projections" | "history" | "concentration">("projections");
  
  // Controles de Período
  const [projectionMonths, setProjectionMonths] = useState<number>(12);
  const [historyMonths, setHistoryMonths] = useState<number | "all">("all");

  // Controles de Concentração
  const [concentrationGroupBy, setConcentrationGroupBy] = useState<"company" | "linkType">("company");
  const [concentrationMetric, setConcentrationMetric] = useState<"balance" | "totalTaken">("balance");

  // 1. Filtragem e Formatação de Projeções
  const formattedProjections = useMemo(() => {
    const data = projectionsData.slice(0, projectionMonths);
    return data.map(d => ({
      month: d.month,
      total: Number(d.total.toFixed(2)),
      previsto: Number(d.previsto.toFixed(2)),
    }));
  }, [projectionsData, projectionMonths]);

  // 2. Filtragem e Formatação de Histórico
  const formattedHistory = useMemo(() => {
    let data = [...historyData];
    if (historyMonths !== "all") {
      data = data.slice(-historyMonths);
    }
    return data.map(d => ({
      month: d.month,
      total: Number(d.total.toFixed(2)),
      previsto: Number(d.previsto.toFixed(2)),
    }));
  }, [historyData, historyMonths]);

  // 3. Processamento de Concentração (Gráfico de Rosca)
  const concentrationData = useMemo(() => {
    const totalsMap = new Map<string, number>();
    
    employees.forEach(emp => {
      const key = concentrationGroupBy === "company" ? emp.company : emp.linkType;
      if (!key) return;

      const value = concentrationMetric === "balance" ? (emp.balance || 0) : (emp.totalTaken || 0);
      if (value <= 0) return;

      totalsMap.set(key, (totalsMap.get(key) || 0) + value);
    });

    const items = Array.from(totalsMap.entries()).map(([name, value]) => ({
      name: name === "CLT" ? "Regime CLT" : name === "MEI" ? "Vínculo MEI" : name,
      value: Number(value.toFixed(2)),
    })).sort((a, b) => b.value - a.value);

    return items;
  }, [employees, concentrationGroupBy, concentrationMetric]);

  const concentrationTotalSum = useMemo(() => {
    return concentrationData.reduce((sum, item) => sum + item.value, 0);
  }, [concentrationData]);

  // Tooltips customizados
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 text-xs">
        <p className="font-black text-slate-800 mb-2">{label}</p>
        {payload.map((entry: any, i: number) => (
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

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    const percent = concentrationTotalSum > 0 ? ((data.value / concentrationTotalSum) * 100).toFixed(1) : "0";
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 text-xs">
        <p className="font-black text-slate-800 mb-1">{data.name}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-slate-500 font-semibold">Valor:</span>
          <span className="font-black text-slate-800">{formatCurrency(data.value)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-slate-500 font-semibold">Participação:</span>
          <span className="font-black text-emerald-600">{percent}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col h-[480px]">
      {/* Abas e Títulos */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded uppercase">Indicadores</span>
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Painel Analítico de Contratos
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
            Concentração (Rosca)
          </button>
        </div>
      </div>

      {/* Controles de Gráfico e Visualização */}
      <div className="flex justify-between items-center mb-4 min-h-[38px] bg-slate-50/60 px-4 py-2 rounded-xl border border-slate-100">
        <div>
          {activeTab === "projections" && (
            <p className="text-[11px] text-slate-400 font-bold">
              Projeção de fluxo de recebimentos futuros
            </p>
          )}
          {activeTab === "history" && (
            <p className="text-[11px] text-slate-400 font-bold">
              Histórico consolidado de parcelas já amortizadas
            </p>
          )}
          {activeTab === "concentration" && (
            <p className="text-[11px] text-slate-400 font-bold">
              Análise de concentração de crédito ({concentrationMetric === "balance" ? "Saldo Devedor" : "Valor Concedido"})
            </p>
          )}
        </div>

        {/* Controles Reativos baseados na aba ativa */}
        <div className="flex gap-2 items-center">
          {activeTab === "projections" && (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              {[6, 12, 24].map((m) => (
                <button
                  key={m}
                  onClick={() => setProjectionMonths(m)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    projectionMonths === m
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {m} Meses
                </button>
              ))}
            </div>
          )}



          {activeTab === "concentration" && (
            <div className="flex gap-2">
              {/* Group By Selector */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                <button
                  onClick={() => setConcentrationGroupBy("company")}
                  className={`px-2.5 py-0.5 text-[10px] font-bold rounded ${
                    concentrationGroupBy === "company"
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Empresa
                </button>
                <button
                  onClick={() => setConcentrationGroupBy("linkType")}
                  className={`px-2.5 py-0.5 text-[10px] font-bold rounded ${
                    concentrationGroupBy === "linkType"
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Vínculo
                </button>
              </div>

              {/* Metric Selector */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                <button
                  onClick={() => setConcentrationMetric("balance")}
                  className={`px-2.5 py-0.5 text-[10px] font-bold rounded ${
                    concentrationMetric === "balance"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Saldo Devedor
                </button>
                <button
                  onClick={() => setConcentrationMetric("totalTaken")}
                  className={`px-2.5 py-0.5 text-[10px] font-bold rounded ${
                    concentrationMetric === "totalTaken"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Valor Concedido
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Área do Gráfico */}
      <div className="flex-1 w-full min-h-0 relative">
        {activeTab === "projections" && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={formattedProjections} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotalProj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 71, 122, 0.02)' }} />
              <Bar 
                dataKey="total" 
                name="total"
                fill="url(#colorTotalProj)" 
                radius={[4, 4, 0, 0]} 
                barSize={20}
                animationDuration={1000}
              />
              <Line 
                type="monotone" 
                dataKey="previsto" 
                name="previsto"
                stroke="#10b981" 
                strokeWidth={2.5} 
                dot={{ r: 3.5, fill: '#10b981', strokeWidth: 1.5, stroke: '#FFF' }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                animationDuration={1200}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {activeTab === "history" && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={formattedHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotalHist" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.02)' }} />
              <Bar 
                dataKey="total" 
                name="total"
                fill="url(#colorTotalHist)" 
                radius={[4, 4, 0, 0]} 
                barSize={20}
                animationDuration={1000}
              />
              <Line 
                type="monotone" 
                dataKey="previsto" 
                name="previsto"
                stroke="#f59e0b" 
                strokeWidth={2.5} 
                dot={{ r: 3.5, fill: '#f59e0b', strokeWidth: 1.5, stroke: '#FFF' }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                animationDuration={1200}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {activeTab === "concentration" && (
          <div className="w-full h-full flex flex-col md:flex-row items-center justify-center gap-6">
            {concentrationData.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400 font-medium">
                Nenhum saldo ativo para exibir no gráfico de rosca.
              </div>
            ) : (
              <>
                <div className="w-[180px] h-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={concentrationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        animationDuration={1000}
                      >
                        {concentrationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex-1 max-h-[200px] overflow-y-auto pr-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {concentrationData.map((entry, index) => {
                      const percent = concentrationTotalSum > 0 ? ((entry.value / concentrationTotalSum) * 100).toFixed(1) : "0";
                      const color = COLORS[index % COLORS.length];
                      return (
                        <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors shadow-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="font-bold text-slate-700 truncate" title={entry.name}>
                              {entry.name}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black text-slate-800">{formatCurrency(entry.value)}</p>
                            <p className="text-[10px] font-black text-slate-400">{percent}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
