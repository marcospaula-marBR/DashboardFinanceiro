"use client";

import { useMemo } from "react";
import { 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ComposedChart,
  Line,
  Legend
} from 'recharts';
import { MonthlyCost } from "@/types/loans";

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface TooltipPayloadEntry {
  color: string;
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-4 text-xs space-y-2">
      <p className="font-black text-slate-800 uppercase tracking-wider">{label}</p>
      {payload.map((entry, i: number) => {
        const color = entry.color;
        const name = entry.name === 'clt' ? 'CLT (Salários)' : entry.name === 'mei' ? 'MEI / PJ (Contratos)' : 'Total Geral';
        return (
          <div key={i} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-slate-500 font-bold">{name}:</span>
            </div>
            <span className="font-black text-slate-800">{formatBRL(Number(entry.value))}</span>
          </div>
        );
      })}
    </div>
  );
};

interface PayrollCostChartProps {
  costs: MonthlyCost[];
}

export function PayrollCostChart({ costs }: PayrollCostChartProps) {
  const chartData = useMemo(() => {
    if (!costs || costs.length === 0) return [];

    // Group costs by competency
    const grouped: Record<string, { clt: number; mei: number; total: number }> = {};

    costs.forEach(c => {
      if (!c.competencia || !c.valor_liquido) return;
      const dateKey = c.competencia; // YYYY-MM-01
      if (!grouped[dateKey]) {
        grouped[dateKey] = { clt: 0, mei: 0, total: 0 };
      }

      if (c.vinculo_tipo === 'CLT') {
        grouped[dateKey].clt += c.valor_liquido;
      } else {
        grouped[dateKey].mei += c.valor_liquido;
      }
      grouped[dateKey].total += c.valor_liquido;
    });

    // Sort competencies chronologically
    const sortedKeys = Object.keys(grouped).sort();

    // Map to Recharts data format (take last 12 months)
    const result = sortedKeys.slice(-12).map(key => {
      const parts = key.split('-');
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const formattedLabel = `${months[monthIdx]}/${parts[0].slice(2)}`;

      return {
        month: formattedLabel,
        clt: Math.round(grouped[key].clt),
        mei: Math.round(grouped[key].mei),
        total: Math.round(grouped[key].total),
      };
    });

    return result;
  }, [costs]);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-[400px] flex flex-col items-center justify-center text-center">
        <p className="text-sm font-bold text-slate-400">Nenhum custo histórico carregado</p>
        <p className="text-xs text-slate-300 mt-1">Carregue dados de competências da planilha Dianna no banco de dados.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-[400px] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-6 shrink-0">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
            Histórico e Evolução da Folha de Pagamento
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
            Evolução de custos consolidados (Planilha Dianna)
          </p>
        </div>
        
        {/* Dynamic Custom Legend */}
        <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-600" />
            <span className="text-slate-500">CLT (Salários)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span className="text-slate-500">MEI / PJ (Contratos)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-slate-900 relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            </div>
            <span className="text-slate-900">Total da Folha</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCLT" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.6}/>
              </linearGradient>
              <linearGradient id="colorMEI" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.6}/>
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
              width={45}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
            {/* Stacked Bars for CLT & MEI/PJ */}
            <Bar 
              dataKey="clt" 
              stackId="a" 
              fill="url(#colorCLT)" 
              radius={[0, 0, 0, 0]} 
              barSize={20}
              name="clt"
            />
            <Bar 
              dataKey="mei" 
              stackId="a" 
              fill="url(#colorMEI)" 
              radius={[4, 4, 0, 0]} 
              barSize={20}
              name="mei"
            />
            {/* Smooth Total Cost Line */}
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="#0f172a" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#0f172a', strokeWidth: 2, stroke: '#FFF' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              name="total"
              animationDuration={2000}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
