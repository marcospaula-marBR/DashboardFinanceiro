"use client";

import React from 'react';
import {
  TrendingDown,
  TrendingUp,
  Scale,
  Flame,
  PieChart,
  FileCheck2,
  Lock,
  Calendar
} from 'lucide-react';
import { DreCaixaKpiSummary } from '@/types/dre-caixa';
import { formatCurrencyBRL } from '@/services/dre-caixa.service';

interface DreCaixaKpisProps {
  summary: DreCaixaKpiSummary;
  isMeetingMode: boolean;
  periodoLabel?: string;
  empresaLabel?: string;
}

export function DreCaixaKpis({
  summary,
  isMeetingMode,
  periodoLabel = 'Acumulado',
  empresaLabel = 'Todas as Empresas'
}: DreCaixaKpisProps) {
  const isPositive = summary.resultadoLiquido >= 0;

  return (
    <section className="mb-6 space-y-2.5">
      
      {/* Mini Banner de Contexto dos Números */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700">Base de Cálculo:</span>
          <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-bold">
            {empresaLabel}
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
            <Calendar size={12} className="text-emerald-600" />
            {periodoLabel}
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Regime de Caixa Efetivo (Valores Liquidados no Período)
        </div>
      </div>

      {/* Grid de Cards de KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        
        {/* 1. Total Pago (Saídas Realizadas) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">
              Total Pago (Saídas)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm">
              <TrendingDown size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrencyBRL(summary.totalPago)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-rose-600 font-bold">Desembolso Real</span> no caixa
          </p>
        </div>

        {/* 2. Total Recebido (Entradas Realizadas - Protegido por Modo Reunião) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">
              Total Recebido
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black tracking-tight">
            {isMeetingMode ? (
              <span className="text-amber-700 font-mono tracking-widest text-lg flex items-center gap-1.5">
                <Lock size={15} className="text-amber-600" />
                R$ ••••••••
              </span>
            ) : (
              <span className="text-emerald-700">
                {formatCurrencyBRL(summary.totalRecebido)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isMeetingMode ? (
              <span className="text-amber-700 font-semibold">Oculto p/ Reunião</span>
            ) : (
              <span className="text-emerald-600 font-bold">Entradas de Caixa</span>
            )}
          </p>
        </div>

        {/* 3. Resultado Líquido Corrente */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">
              Saldo Líquido
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shadow-sm">
              <Scale size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black tracking-tight">
            {isMeetingMode ? (
              <span className="text-amber-700 font-mono tracking-widest text-lg flex items-center gap-1.5">
                <Lock size={15} className="text-amber-600" />
                R$ ••••••••
              </span>
            ) : (
              <span className={isPositive ? 'text-sky-700' : 'text-rose-600'}>
                {formatCurrencyBRL(summary.resultadoLiquido)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isMeetingMode ? (
              <span className="text-amber-700 font-semibold">Protegido em Reunião</span>
            ) : (
              <span>Recebido menos Pago</span>
            )}
          </p>
        </div>

        {/* 4. Média Mensal de Despesas (Burn Rate) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">
              Média Mensal Saídas
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
              <Flame size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrencyBRL(summary.mediaMensalDespesas)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            <span className="text-amber-700 font-bold">Burn rate</span> mensal médio
          </p>
        </div>

        {/* 5. Maior Setor / Projeto */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">
              Maior Centro de Custo
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
              <PieChart size={16} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 truncate tracking-tight" title={summary.maiorSetor.nome}>
            {summary.maiorSetor.nome}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate font-semibold">
            {formatCurrencyBRL(summary.maiorSetor.valor)}
          </p>
        </div>

        {/* 6. Total de Lançamentos Liquidados */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">
              Lançamentos Pagos
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
              <FileCheck2 size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {summary.totalLancamentos.toLocaleString('pt-BR')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Títulos e baixas liquidadas
          </p>
        </div>

      </div>
    </section>
  );
}
