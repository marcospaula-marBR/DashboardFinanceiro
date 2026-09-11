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
  tipoPagamentoLabel?: string;
  onOpenPurchasesAudit?: () => void;
  onOpenRevenuesAudit?: () => void;
  onOpenLiquidBalanceAudit?: () => void;
  onOpenMonthlyAverageAudit?: () => void;
  onOpenLargestSectorAudit?: () => void;
  onOpenTransactionsAudit?: () => void;
}

export function DreCaixaKpis({
  summary,
  isMeetingMode,
  periodoLabel = 'Acumulado',
  empresaLabel = 'Todas as Empresas',
  tipoPagamentoLabel,
  onOpenPurchasesAudit,
  onOpenRevenuesAudit,
  onOpenLiquidBalanceAudit,
  onOpenMonthlyAverageAudit,
  onOpenLargestSectorAudit,
  onOpenTransactionsAudit
}: DreCaixaKpisProps) {
  const isPositive = summary.resultadoLiquido >= 0;

  return (
    <section className="mb-6 space-y-3">
      
      {/* Mini Banner de Contexto dos Números */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-700">Base de Cálculo:</span>
          <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-bold">
            {empresaLabel}
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
            <Calendar size={12} className="text-emerald-600" />
            {periodoLabel}
          </span>
          {tipoPagamentoLabel && (
            <>
              <span className="text-slate-300">•</span>
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold">
                💳 {tipoPagamentoLabel}
              </span>
            </>
          )}
        </div>
        <div className="text-[11px] text-slate-400">
          Regime de Caixa Efetivo (Compensação Bancária Real do Omie)
        </div>
      </div>

      {/* Grid de Cards de KPI Interativos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        
        {/* 1. Total Pago (Saídas Realizadas) */}
        <div
          onClick={onOpenPurchasesAudit}
          role={onOpenPurchasesAudit ? "button" : undefined}
          tabIndex={onOpenPurchasesAudit ? 0 : undefined}
          className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all ${
            onOpenPurchasesAudit
              ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md hover:bg-slate-50/50 group active:scale-[0.98]'
              : ''
          }`}
          title={onOpenPurchasesAudit ? "Clique para abrir o Raio-X de Compras & Despesas" : undefined}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 group-hover:text-indigo-700 transition-colors">
              Total Pago (Saídas)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm group-hover:bg-indigo-50 group-hover:border-indigo-200 group-hover:text-indigo-600 transition-colors">
              <TrendingDown size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrencyBRL(summary.totalPago)}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <p className="text-slate-500 flex items-center gap-1">
              <span className="text-rose-600 font-bold">Desembolso Real</span>
            </p>
            {onOpenPurchasesAudit && (
              <span className="text-[10px] font-extrabold text-indigo-600 group-hover:underline flex items-center gap-0.5">
                Ver Raio-X →
              </span>
            )}
          </div>
        </div>

        {/* 2. Total Recebido (Entradas Realizadas) */}
        <div
          onClick={onOpenRevenuesAudit}
          role={onOpenRevenuesAudit ? "button" : undefined}
          tabIndex={onOpenRevenuesAudit ? 0 : undefined}
          className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all ${
            onOpenRevenuesAudit
              ? 'cursor-pointer hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/30 group active:scale-[0.98]'
              : ''
          }`}
          title={onOpenRevenuesAudit ? "Clique para auditar os recebimentos e notas liquidadas" : undefined}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 group-hover:text-emerald-700 transition-colors">
              Total Recebido
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-100 transition-colors">
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
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <p className="text-slate-500">
              {isMeetingMode ? (
                <span className="text-amber-700 font-semibold">Oculto p/ Reunião</span>
              ) : (
                <span className="text-emerald-600 font-bold">Entradas de Caixa</span>
              )}
            </p>
            {onOpenRevenuesAudit && (
              <span className="text-[10px] font-extrabold text-emerald-700 group-hover:underline flex items-center gap-0.5">
                Extrato →
              </span>
            )}
          </div>
        </div>

        {/* 3. Resultado Líquido Corrente */}
        <div
          onClick={onOpenLiquidBalanceAudit}
          role={onOpenLiquidBalanceAudit ? "button" : undefined}
          tabIndex={onOpenLiquidBalanceAudit ? 0 : undefined}
          className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all ${
            onOpenLiquidBalanceAudit
              ? 'cursor-pointer hover:border-sky-300 hover:shadow-md hover:bg-sky-50/30 group active:scale-[0.98]'
              : ''
          }`}
          title={onOpenLiquidBalanceAudit ? "Clique para auditar a liquidez e resultado líquido" : undefined}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 group-hover:text-sky-700 transition-colors">
              Saldo Líquido
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shadow-sm group-hover:bg-sky-100 transition-colors">
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
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <p className="text-slate-500">
              {isMeetingMode ? (
                <span className="text-amber-700 font-semibold">Protegido em Reunião</span>
              ) : (
                <span>Recebido menos Pago</span>
              )}
            </p>
            {onOpenLiquidBalanceAudit && (
              <span className="text-[10px] font-extrabold text-sky-700 group-hover:underline flex items-center gap-0.5">
                Auditar →
              </span>
            )}
          </div>
        </div>

        {/* 4. Média Mensal de Despesas (Burn Rate) */}
        <div
          onClick={onOpenMonthlyAverageAudit}
          role={onOpenMonthlyAverageAudit ? "button" : undefined}
          tabIndex={onOpenMonthlyAverageAudit ? 0 : undefined}
          className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all ${
            onOpenMonthlyAverageAudit
              ? 'cursor-pointer hover:border-amber-300 hover:shadow-md hover:bg-amber-50/30 group active:scale-[0.98]'
              : ''
          }`}
          title={onOpenMonthlyAverageAudit ? "Clique para analisar o burn rate e evolução mensal" : undefined}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 group-hover:text-amber-700 transition-colors">
              Média Mensal Saídas
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm group-hover:bg-amber-100 transition-colors">
              <Flame size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrencyBRL(summary.mediaMensalDespesas)}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <p className="text-slate-500">
              <span className="text-amber-700 font-bold">Burn rate</span> mensal
            </p>
            {onOpenMonthlyAverageAudit && (
              <span className="text-[10px] font-extrabold text-amber-700 group-hover:underline flex items-center gap-0.5">
                Histórico →
              </span>
            )}
          </div>
        </div>

        {/* 5. Maior Setor / Projeto */}
        <div
          onClick={onOpenLargestSectorAudit}
          role={onOpenLargestSectorAudit ? "button" : undefined}
          tabIndex={onOpenLargestSectorAudit ? 0 : undefined}
          className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all ${
            onOpenLargestSectorAudit
              ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/30 group active:scale-[0.98]'
              : ''
          }`}
          title={onOpenLargestSectorAudit ? `Clique para detalhar o setor: ${summary.maiorSetor.nome}` : undefined}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 group-hover:text-indigo-700 transition-colors">
              Maior Centro de Custo
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm group-hover:bg-indigo-100 transition-colors">
              <PieChart size={16} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 truncate tracking-tight" title={summary.maiorSetor.nome}>
            {summary.maiorSetor.nome}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <p className="text-slate-500 truncate font-semibold">
              {formatCurrencyBRL(summary.maiorSetor.valor)}
            </p>
            {onOpenLargestSectorAudit && (
              <span className="text-[10px] font-extrabold text-indigo-700 group-hover:underline flex items-center gap-0.5">
                Setor →
              </span>
            )}
          </div>
        </div>

        {/* 6. Total de Lançamentos Liquidados */}
        <div
          onClick={onOpenTransactionsAudit}
          role={onOpenTransactionsAudit ? "button" : undefined}
          tabIndex={onOpenTransactionsAudit ? 0 : undefined}
          className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all ${
            onOpenTransactionsAudit
              ? 'cursor-pointer hover:border-slate-400 hover:shadow-md hover:bg-slate-50 group active:scale-[0.98]'
              : ''
          }`}
          title={onOpenTransactionsAudit ? "Clique para listar todos os lançamentos do período" : undefined}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 group-hover:text-slate-900 transition-colors">
              Lançamentos Pagos
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm group-hover:bg-slate-200 transition-colors">
              <FileCheck2 size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {summary.totalLancamentos.toLocaleString('pt-BR')}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <p className="text-slate-500">
              Títulos e baixas
            </p>
            {onOpenTransactionsAudit && (
              <span className="text-[10px] font-extrabold text-slate-700 group-hover:underline flex items-center gap-0.5">
                Ver Todos →
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Faixa Executiva de Pontualidade & Conciliação Bancária */}
      <div className="p-3 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Cockpit de Pontualidade & Conciliação:
          </span>

          {/* Taxa de Recebimentos em Dia */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">
            <span className="text-slate-300 text-[11px]">Recebimentos em Dia:</span>
            <span className={`font-black ${
              (summary.taxaPontualidadeRecebimentos || 100) >= 90 ? 'text-emerald-300' : 'text-amber-300'
            }`}>
              {(summary.taxaPontualidadeRecebimentos || 100).toFixed(1)}%
            </span>
          </div>

          {/* Taxa de Pagamentos em Dia */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">
            <span className="text-slate-300 text-[11px]">Pagamentos em Dia:</span>
            <span className={`font-black ${
              (summary.taxaPontualidadePagamentos || 100) >= 90 ? 'text-emerald-300' : 'text-amber-300'
            }`}>
              {(summary.taxaPontualidadePagamentos || 100).toFixed(1)}%
            </span>
          </div>

          {/* Atraso Médio */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">
            <span className="text-slate-300 text-[11px]">Atraso Médio:</span>
            <span className={`font-black ${
              (summary.mediaDiasAtraso || 0) <= 3 ? 'text-emerald-300' : 'text-rose-300'
            }`}>
              {summary.mediaDiasAtraso || 0} {summary.mediaDiasAtraso === 1 ? 'dia' : 'dias'}
            </span>
          </div>
        </div>

        {/* Conciliação Bancária */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-300 font-medium">Conciliação com Extrato Omie:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black text-[11px] flex items-center gap-1">
            ✓ {summary.percentualConciliado || 100}% Conciliado
          </span>
        </div>
      </div>

    </section>
  );
}
