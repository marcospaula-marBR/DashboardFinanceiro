"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/services/lancamentos.service";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

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

interface FluxoConsolidadoTableProps {
  lancamentos: FluxoLancamento[];
  groupBy: 'diario' | 'semanal' | 'mensal';
}

export function FluxoConsolidadoTable({ lancamentos, groupBy }: FluxoConsolidadoTableProps) {
  
  // Computar os agrupamentos
  const data = useMemo(() => {
    const groups: { [key: string]: { label: string; dateSort: string; entradas: number; saidas: number } } = {};

    // Considerar apenas itens marcados (selecionados)
    const activeItems = lancamentos.filter(item => item.selecionado !== false);

    activeItems.forEach(item => {
      const dateStr = item.data_alocacao; // YYYY-MM-DD
      if (!dateStr) return;

      let key = "";
      let label = "";
      let dateSort = "";

      if (groupBy === "diario") {
        key = dateStr;
        // DD/MM/YYYY
        label = dateStr.split("-").reverse().join("/");
        dateSort = dateStr;
      } else if (groupBy === "semanal") {
        // Obter segunda-feira correspondente à data
        const dateObj = new Date(dateStr + "T12:00:00");
        const day = dateObj.getDay();
        const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1); // Segunda-feira
        const monday = new Date(dateObj.setDate(diff));
        const mondayStr = monday.toISOString().split("T")[0];
        
        key = mondayStr;
        label = `Semana de ${mondayStr.split("-").reverse().join("/")}`;
        dateSort = mondayStr;
      } else {
        // Mensal
        const [year, month] = dateStr.split("-");
        key = `${year}-${month}`;
        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        label = `${months[parseInt(month) - 1]}/${year}`;
        dateSort = `${year}-${month}-01`;
      }

      if (!groups[key]) {
        groups[key] = { label, dateSort, entradas: 0, saidas: 0 };
      }

      const val = item.valor_alocado || 0;
      if (val > 0) {
        groups[key].entradas += val;
      } else {
        groups[key].saidas += Math.abs(val); // Acumular saídas como valor absoluto positivo para apresentação
      }
    });

    // Converter para array e ordenar
    return Object.values(groups).sort((a, b) => a.dateSort.localeCompare(b.dateSort));
  }, [lancamentos, groupBy]);

  // Calcular totais gerais do período
  const totals = useMemo(() => {
    let totalEntradas = 0;
    let totalSaidas = 0;
    
    data.forEach(item => {
      totalEntradas += item.entradas;
      totalSaidas += item.saidas;
    });

    return {
      entradas: totalEntradas,
      saidas: totalSaidas,
      resultado: totalEntradas - totalSaidas
    };
  }, [data]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
            <tr>
              <th className="px-6 py-4">Período / Referência</th>
              <th className="px-6 py-4 text-right">(+) Entradas</th>
              <th className="px-6 py-4 text-right">(-) Saídas</th>
              <th className="px-6 py-4 text-right">(=) Resultado Período</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {data.map((row, idx) => {
              const resValue = row.entradas - row.saidas;
              return (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-slate-800 font-bold whitespace-nowrap">
                    {row.label}
                  </td>
                  <td className="px-6 py-4 text-right text-emerald-600 font-semibold">
                    {row.entradas > 0 ? "+" : ""}{formatCurrency(row.entradas)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">
                    {row.saidas > 0 ? "-" : ""}{formatCurrency(row.saidas)}
                  </td>
                  <td className={`px-6 py-4 text-right font-black ${
                    resValue > 0 ? "text-emerald-700 bg-emerald-50/20" : 
                    resValue < 0 ? "text-rose-700 bg-rose-50/20" : "text-slate-700"
                  }`}>
                    {resValue > 0 ? "+" : ""}{formatCurrency(resValue)}
                  </td>
                </tr>
              );
            })}

            {data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                  Nenhum lançamento ativo para consolidar.
                </td>
              </tr>
            )}
          </tbody>
          {data.length > 0 && (
            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
              <tr>
                <td className="px-6 py-4 text-xs uppercase tracking-wider font-extrabold text-slate-500">
                  Consolidado Total
                </td>
                <td className="px-6 py-4 text-right text-emerald-700">
                  {formatCurrency(totals.entradas)}
                </td>
                <td className="px-6 py-4 text-right text-slate-700">
                  -{formatCurrency(totals.saidas)}
                </td>
                <td className={`px-6 py-4 text-right text-base font-black ${
                  totals.resultado >= 0 ? "text-emerald-700 bg-emerald-50/40" : "text-rose-700 bg-rose-50/40"
                }`}>
                  {totals.resultado >= 0 ? "+" : ""}{formatCurrency(totals.resultado)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
