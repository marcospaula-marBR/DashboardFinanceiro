"use client";

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  TrendingUp,
  Layers,
  PieChart as PieIcon,
  Users,
  CreditCard,
  Lock
} from 'lucide-react';
import { DreCaixaChartData } from '@/types/dre-caixa';
import { formatCurrencyBRL } from '@/services/dre-caixa.service';

const PALETTE = [
  '#0284c7', // sky-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#dc2626', // red-600
  '#0d9488', // teal-600
  '#475569', // slate-600
  '#2563eb', // blue-600
  '#ca8a04', // yellow-600
  '#64748b', // slate-500
  '#0891b2'  // cyan-600
];

interface DreCaixaChartsProps {
  chartData: DreCaixaChartData;
  isMeetingMode: boolean;
}

export function DreCaixaCharts({ chartData, isMeetingMode }: DreCaixaChartsProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 min-h-[300px] flex items-center justify-center">
        Carregando gráficos...
      </div>
    );
  }

  // Preparar dados para o gráfico de evolução temporal
  const timelineData = chartData.meses.map((mes, idx) => ({
    mes,
    Saidas: chartData.saidasPorMes[idx] || 0,
    Entradas: isMeetingMode ? 0 : (chartData.entradasPorMes[idx] || 0),
    Saldo: isMeetingMode ? 0 : (chartData.saldoPorMes[idx] || 0)
  }));

  // Tooltip customizado clean/white mode
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xl text-xs text-slate-800">
          <p className="font-black text-slate-900 mb-1.5 border-b border-slate-100 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => {
            const isSensitive = isMeetingMode && (entry.name === 'Entradas' || entry.name === 'Saldo');
            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-500 font-medium">{entry.name}:</span>
                </div>
                <span className="font-bold text-slate-900">
                  {isSensitive ? 'R$ •••••••• (Oculto)' : formatCurrencyBRL(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 mb-6">

      {/* LINHA 1: Evolução Temporal + Despesas por Setor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Gráfico 1: Evolução Temporal Mensal */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shadow-sm">
                <TrendingUp size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Evolução Mensal do Caixa</h3>
                <p className="text-[11px] text-slate-500">Desembolsos e entradas realizadas por mês de pagamento</p>
              </div>
            </div>

            {isMeetingMode && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Lock size={10} />
                Receitas Ocultas
              </span>
            )}
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timelineData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="mes" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={val => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 10, fontSize: 11 }}
                  formatter={value => <span className="text-slate-700 font-bold">{value}</span>}
                />
                <Bar dataKey="Saidas" name="Saídas Pagas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                {!isMeetingMode && (
                  <>
                    <Bar dataKey="Entradas" name="Entradas Realizadas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Line type="monotone" dataKey="Saldo" name="Saldo Líquido" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 3 }} />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Despesas por Setor / Projeto (Amostragem Setorial) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
                <Layers size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Despesas por Setor (Projeto)</h3>
                <p className="text-[11px] text-slate-500">Amostragem de custos por centro de atividade</p>
              </div>
            </div>
          </div>

          <div className="h-72 w-full overflow-y-auto custom-scrollbar pr-1">
            <div className="space-y-2.5">
              {chartData.despesasPorSetor.map((item, idx) => (
                <div key={item.setor} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 truncate max-w-[200px]" title={item.setor}>
                      {idx + 1}. {item.setor}
                    </span>
                    <div className="text-right">
                      <span className="font-black text-slate-900">{formatCurrencyBRL(item.valor)}</span>
                      <span className="text-slate-500 ml-1.5 text-[10px] font-semibold">({item.percentual.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, item.percentual)}%`,
                        backgroundColor: PALETTE[idx % PALETTE.length]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* LINHA 2: Top Categorias + Top Fornecedores + Saídas por Conta Corrente */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Gráfico 3: Composição por Categoria (Donut) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
              <PieIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Composição por Categoria</h3>
              <p className="text-[11px] text-slate-500">Top 10 contas de despesas pagas</p>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.despesasPorCategoria}
                  dataKey="valor"
                  nameKey="categoria"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {chartData.despesasPorCategoria.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => formatCurrencyBRL(Number(val))}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '11px', color: '#0f172a', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] text-slate-600 custom-scrollbar pr-1">
            {chartData.despesasPorCategoria.slice(0, 5).map((item, idx) => (
              <div key={item.categoria} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                  <span className="truncate font-medium text-slate-700" title={item.categoria}>{item.categoria}</span>
                </div>
                <span className="font-bold text-slate-900">{item.percentual.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 4: Top 10 Fornecedores / Credores */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm">
              <Users size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Top 10 Fornecedores</h3>
              <p className="text-[11px] text-slate-500">Maiores desembolsos realizados</p>
            </div>
          </div>

          <div className="h-72 overflow-y-auto custom-scrollbar pr-1 space-y-2">
            {chartData.topFornecedores.length === 0 ? (
              <div className="text-slate-400 text-center py-8 text-xs">Nenhum fornecedor encontrado</div>
            ) : (
              chartData.topFornecedores.map((forn, idx) => (
                <div key={forn.fornecedor} className="p-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-800 truncate max-w-[160px]" title={forn.fornecedor}>
                      {idx + 1}. {forn.fornecedor}
                    </span>
                    <span className="font-black text-slate-900">{formatCurrencyBRL(forn.valor)}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${Math.min(100, forn.percentual * 2)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Gráfico 5: Saídas por Conta Corrente / Banco */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
              <CreditCard size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Saídas por Conta Bancária</h3>
              <p className="text-[11px] text-slate-500">Origem financeira dos pagamentos</p>
            </div>
          </div>

          <div className="h-72 overflow-y-auto custom-scrollbar pr-1 space-y-2">
            {chartData.saidasPorContaCorrente.length === 0 ? (
              <div className="text-slate-400 text-center py-8 text-xs">Nenhuma conta corrente encontrada</div>
            ) : (
              chartData.saidasPorContaCorrente.map((conta) => (
                <div key={conta.conta} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-800 truncate max-w-[170px]" title={conta.conta}>
                      {conta.conta}
                    </span>
                    <div className="text-right">
                      <span className="font-black text-emerald-700">{formatCurrencyBRL(conta.valor)}</span>
                      <span className="text-slate-500 ml-1 text-[10px] font-semibold">({conta.percentual.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${Math.min(100, conta.percentual)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
