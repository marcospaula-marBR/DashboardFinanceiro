"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart
} from "recharts";
import { formatCurrency } from "@/services/lancamentos.service";

interface FluxoLancamento {
  id_global: string;
  omie_id: string;
  empresa: string;
  tipo: 'RECEBER' | 'PAGAR' | 'MOVIMENTO';
  status: 'PAGO' | 'ABERTO' | 'ATRASADO';
  valor_total: number;
  valor_alocado: number;
  data_alocacao: string;
  selecionado?: boolean;
}

interface FluxoChartsProps {
  lancamentos: FluxoLancamento[];
  groupBy: 'diario' | 'semanal' | 'mensal';
}

export function FluxoCharts({ lancamentos, groupBy }: FluxoChartsProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Consolidar dados para o gráfico
  const chartData = useMemo(() => {
    const groups: { [key: string]: { label: string; dateSort: string; Entradas: number; Saídas: number; Resultado: number } } = {};
    const activeItems = lancamentos.filter(item => item.selecionado !== false);

    activeItems.forEach(item => {
      const dateStr = item.data_alocacao;
      if (!dateStr) return;

      let key = "";
      let label = "";
      let dateSort = "";

      if (groupBy === "diario") {
        key = dateStr;
        label = dateStr.split("-").reverse().slice(0, 2).join("/"); // Apenas DD/MM no gráfico para ficar limpo
        dateSort = dateStr;
      } else if (groupBy === "semanal") {
        const dateObj = new Date(dateStr + "T12:00:00");
        const day = dateObj.getDay();
        const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(dateObj.setDate(diff));
        const mondayStr = monday.toISOString().split("T")[0];
        
        key = mondayStr;
        const parts = mondayStr.split("-");
        label = `${parts[2]}/${parts[1]}`; // DD/MM da segunda-feira
        dateSort = mondayStr;
      } else {
        const [year, month] = dateStr.split("-");
        key = `${year}-${month}`;
        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        label = `${months[parseInt(month) - 1]}/${year.slice(2)}`;
        dateSort = `${year}-${month}-01`;
      }

      if (!groups[key]) {
        groups[key] = { label, dateSort, Entradas: 0, Saídas: 0, Resultado: 0 };
      }

      const val = item.valor_alocado || 0;
      if (val > 0) {
        groups[key].Entradas += val;
      } else {
        groups[key].Saídas += Math.abs(val);
      }
    });

    // Calcular resultado e converter para array ordenado
    return Object.values(groups)
      .map(g => ({
        ...g,
        // Arredondar para apresentação limpa
        Entradas: Math.round(g.Entradas * 100) / 100,
        Saídas: Math.round(g.Saídas * 100) / 100,
        Resultado: Math.round((g.Entradas - g.Saídas) * 100) / 100
      }))
      .sort((a, b) => a.dateSort.localeCompare(b.dateSort));
  }, [lancamentos, groupBy]);

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xl text-xs font-semibold space-y-2">
          <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">{label}</p>
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex justify-between gap-6 items-center">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: p.color }} />
                {p.name}:
              </span>
              <strong className={
                p.name === "Entradas" ? "text-emerald-600" :
                p.name === "Saídas" ? "text-slate-700" :
                p.value >= 0 ? "text-blue-600" : "text-rose-600"
              }>
                {formatCurrency(p.value)}
              </strong>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!isMounted || chartData.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-[320px] flex items-center justify-center text-slate-400 font-semibold italic text-sm">
        {chartData.length === 0 ? "Sem dados ativos para exibir gráfico." : "Carregando gráfico..."}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Evolução do Fluxo de Caixa</h3>
        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">
          Visão por {groupBy === "diario" ? "dia" : groupBy === "semanal" ? "semana" : "mês"}
        </span>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="label" 
              stroke="#94a3b8" 
              fontSize={10} 
              fontWeight={700}
              tickLine={false}
              axisLine={false} 
            />
            <YAxis 
              stroke="#94a3b8" 
              fontSize={10} 
              fontWeight={700}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v === 0 ? "0" : `${v / 1000}k`}
            />
            <Tooltip content={customTooltip} />
            <Legend 
              iconType="circle" 
              iconSize={8}
              wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 10 }}
            />
            <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
            
            {/* Barras de Entradas e Saídas agrupadas */}
            <Bar dataKey="Entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Bar dataKey="Saídas" name="Saídas" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={30} />
            
            {/* Linha do Resultado Líquido */}
            <Line 
              type="monotone" 
              dataKey="Resultado" 
              name="Resultado Líquido" 
              stroke="#2563eb" 
              strokeWidth={3} 
              dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
