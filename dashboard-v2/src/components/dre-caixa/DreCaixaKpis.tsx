"use client";

import React from 'react';
import {
  TrendingDown,
  TrendingUp,
  Scale,
  Flame,
  PieChart,
  FileCheck2,
  Lock
} from 'lucide-react';
import { DreCaixaKpiSummary } from '@/types/dre-caixa';
import { formatCurrencyBRL } from '@/services/dre-caixa.service';

interface DreCaixaKpisProps {
  summary: DreCaixaKpiSummary;
  isMeetingMode: boolean;
}

export function DreCaixaKpis({ summary, isMeetingMode }: DreCaixaKpisProps) {
  const isPositive = summary.resultadoLiquido >= 0;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-6">
      
      {/* 1. Total Pago (Saídas Realizadas) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Total Pago (Saídas)</span>
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <TrendingDown size={16} />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
          {formatCurrencyBRL(summary.totalPago)}
        </div>
        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
          <span className="text-rose-400 font-semibold">Desembolso Real</span> no período
        </p>
      </div>

      {/* 2. Total Recebido (Entradas Realizadas - Protegido por Modo Reunião) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Total Recebido</span>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp size={16} />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold tracking-tight">
          {isMeetingMode ? (
            <span className="text-amber-400/90 font-mono tracking-widest text-lg flex items-center gap-1.5">
              <Lock size={15} className="text-amber-400" />
              R$ ••••••••
            </span>
          ) : (
            <span className="text-emerald-400">
              {formatCurrencyBRL(summary.totalRecebido)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {isMeetingMode ? (
            <span className="text-amber-400/80 font-medium">Oculto p/ Reunião</span>
          ) : (
            <span className="text-emerald-400 font-semibold">Entradas de Caixa</span>
          )}
        </p>
      </div>

      {/* 3. Resultado Líquido Corrente */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Saldo Líquido</span>
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Scale size={16} />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold tracking-tight">
          {isMeetingMode ? (
            <span className="text-amber-400/90 font-mono tracking-widest text-lg flex items-center gap-1.5">
              <Lock size={15} className="text-amber-400" />
              R$ ••••••••
            </span>
          ) : (
            <span className={isPositive ? 'text-sky-400' : 'text-rose-400'}>
              {formatCurrencyBRL(summary.resultadoLiquido)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {isMeetingMode ? (
            <span className="text-amber-400/80 font-medium">Protegido em Reunião</span>
          ) : (
            <span>Recebido menos Pago</span>
          )}
        </p>
      </div>

      {/* 4. Média Mensal de Despesas (Burn Rate) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Média Mensal Saídas</span>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Flame size={16} />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
          {formatCurrencyBRL(summary.mediaMensalDespesas)}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          <span className="text-amber-400 font-semibold">Burn rate</span> corrente
        </p>
      </div>

      {/* 5. Maior Setor / Projeto */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Setor com Maior Gasto</span>
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <PieChart size={16} />
          </div>
        </div>
        <div className="text-base sm:text-lg font-extrabold text-white truncate tracking-tight" title={summary.maiorSetor.nome}>
          {summary.maiorSetor.nome}
        </div>
        <p className="text-[11px] text-slate-400 mt-1 truncate">
          {formatCurrencyBRL(summary.maiorSetor.valor)}
        </p>
      </div>

      {/* 6. Total de Lançamentos Liquidados */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Lançamentos Pagos</span>
          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <FileCheck2 size={16} />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
          {summary.totalLancamentos.toLocaleString('pt-BR')}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Baixas efetivas Omie
        </p>
      </div>

    </section>
  );
}
