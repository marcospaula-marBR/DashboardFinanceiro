"use client";

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart2,
  Briefcase,
  Layers,
  ChevronRight
} from 'lucide-react';
import { DrePainelLancamento, DrePainelTableSection } from '@/types/dre-painel';
import { formatCurrencyBRL } from '@/services/dre-painel.service';

interface DrePainelLateralChartsProps {
  lancamentos: DrePainelLancamento[];
  sections: DrePainelTableSection[];
  periodos: string[];
  isMeetingMode: boolean;
  onFilterConta?: (conta: string) => void;
  onFilterDepto?: (depto: string) => void;
}

export function DrePainelLateralCharts({
  lancamentos,
  sections,
  periodos,
  isMeetingMode,
  onFilterConta,
  onFilterDepto
}: DrePainelLateralChartsProps) {
  const mask = (valStr: string) => (isMeetingMode ? 'R$ ••••••' : valStr);

  // 1. Dados para o gráfico de evolução mensal
  const chartDataMensal = useMemo(() => {
    const map = new Map<string, { receitas: number; despesas: number }>();
    periodos.forEach(p => map.set(p, { receitas: 0, despesas: 0 }));

    lancamentos.forEach(l => {
      if (!map.has(l.periodo)) {
        map.set(l.periodo, { receitas: 0, despesas: 0 });
      }
      const item = map.get(l.periodo)!;
      if (l.sinal_valor > 0) {
        item.receitas += l.valor;
      } else {
        item.despesas += l.valor;
      }
    });

    return Array.from(map.entries()).map(([periodo, data]) => ({
      periodo,
      receitas: data.receitas,
      despesas: data.despesas,
      resultado: data.receitas - data.despesas
    }));
  }, [lancamentos, periodos]);

  // 2. Top 5 Contas DRE por Maior Despesa
  const topContasDespesas = useMemo(() => {
    const despesasSections = sections
      .filter(s => s.tipo !== 'RECEITA' && s.totalGeral > 0)
      .sort((a, b) => b.totalGeral - a.totalGeral)
      .slice(0, 5);

    const totalDespGeral = despesasSections.reduce((acc, curr) => acc + curr.totalGeral, 0);

    return despesasSections.map(s => ({
      conta: s.contaDre,
      total: s.totalGeral,
      percent: totalDespGeral > 0 ? (s.totalGeral / totalDespGeral) * 100 : 0
    }));
  }, [sections]);

  // 3. Top 5 Departamentos por Volume de Gastos
  const topDepartamentos = useMemo(() => {
    const map = new Map<string, number>();
    let totalDeptos = 0;

    lancamentos.forEach(l => {
      if (l.sinal_valor >= 0) return; // apenas saídas
      const d = l.departamento || 'Geral';
      map.set(d, (map.get(d) || 0) + l.valor);
      totalDeptos += l.valor;
    });

    return Array.from(map.entries())
      .map(([depto, total]) => ({
        depto,
        total,
        percent: totalDeptos > 0 ? (total / totalDeptos) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [lancamentos]);

  return (
    <div className="space-y-4">
      {/* Widget 1: Evolução Mensal (Receitas vs Despesas) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <BarChart2 size={15} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 tracking-tight">
                Evolução Mensal
              </h4>
              <p className="text-[10px] text-slate-400">
                Receitas (verde) vs Despesas (rosa)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Entradas
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Saídas
            </span>
          </div>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartDataMensal}
              margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="periodo"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                tickFormatter={(val) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                  return val;
                }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const rec = Number(payload.find(p => p.dataKey === 'receitas')?.value || 0);
                  const desp = Number(payload.find(p => p.dataKey === 'despesas')?.value || 0);
                  const res = rec - desp;
                  return (
                    <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-xl space-y-1">
                      <div className="font-bold border-b border-slate-800 pb-1 text-[11px] text-slate-300">
                        {label}
                      </div>
                      <div className="flex justify-between gap-3 text-emerald-400">
                        <span>Receitas:</span>
                        <span className="font-bold">{mask(formatCurrencyBRL(rec))}</span>
                      </div>
                      <div className="flex justify-between gap-3 text-rose-400">
                        <span>Despesas:</span>
                        <span className="font-bold">{mask(formatCurrencyBRL(desp))}</span>
                      </div>
                      <div className="flex justify-between gap-3 text-slate-200 border-t border-slate-800 pt-1 font-bold">
                        <span>Resultado:</span>
                        <span className={res >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {mask(formatCurrencyBRL(res))}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Widget 2: Maiores Contas DRE (Despesas) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <Layers size={15} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 tracking-tight">
                Top Contas DRE
              </h4>
              <p className="text-[10px] text-slate-400">
                Maiores centros de despesas e custos
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {topContasDespesas.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-400">Sem despesas registradas</div>
          ) : (
            topContasDespesas.map((item, idx) => (
              <div
                key={item.conta}
                onClick={() => onFilterConta && onFilterConta(item.conta)}
                className="group cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700 truncate max-w-[180px] group-hover:text-emerald-700 transition-colors">
                    {item.conta}
                  </span>
                  <span className="font-black text-slate-900 shrink-0">
                    {mask(formatCurrencyBRL(item.total))}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-300 group-hover:bg-rose-600"
                    style={{ width: `${Math.min(100, item.percent)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Widget 3: Top Departamentos / Rateios */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Briefcase size={15} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 tracking-tight">
                Top Departamentos
              </h4>
              <p className="text-[10px] text-slate-400">
                Alocação por centro de custo
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {topDepartamentos.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-400">Sem departamentos registrados</div>
          ) : (
            topDepartamentos.map((item, idx) => (
              <div
                key={item.depto}
                onClick={() => onFilterDepto && onFilterDepto(item.depto)}
                className="group cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-700 truncate max-w-[180px] group-hover:text-emerald-700 transition-colors">
                    {item.depto}
                  </span>
                  <span className="font-black text-slate-900 shrink-0">
                    {mask(formatCurrencyBRL(item.total))}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-700 h-full rounded-full transition-all duration-300 group-hover:bg-slate-900"
                    style={{ width: `${Math.min(100, item.percent)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
