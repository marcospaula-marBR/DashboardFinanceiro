"use client";

import React, { useState } from 'react';
import { 
  ArrowRight, 
  DollarSign, 
  TrendingUp, 
  Percent, 
  RefreshCw, 
  Edit3, 
  ShieldCheck,
  Building,
  Layers
} from 'lucide-react';
import { FollowTheMoneyFlow } from '@/types/war-room';

interface WarRoomFollowTheMoneyProps {
  flow: FollowTheMoneyFlow;
  onEditFlow: () => void;
  onRefreshRate: () => void;
  isRefreshingRate: boolean;
}

export function WarRoomFollowTheMoney({
  flow,
  onEditFlow,
  onRefreshRate,
  isRefreshingRate
}: WarRoomFollowTheMoneyProps) {
  const formatCurrencyUSD = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatCurrencyBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950 border border-cyan-500/40 p-4 sm:p-5 shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between overflow-hidden">
      
      {/* GLOW DECORATIVO */}
      <div className="absolute -top-10 -right-10 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div>
        {/* CABEÇALHO DO MONITOR */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
              <TrendingUp size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black uppercase text-white tracking-wide">
                  Monitor de Rastreio Financeiro (Follow The Money)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-cyan-950/80 text-cyan-300 border border-cyan-600/40">
                  Fluxo Global
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Esteira operacional de liquidação, câmbio e apuração de spread
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* COTAÇÃO USD/BRL LIVE */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <span className="text-slate-400 font-bold">USD/BRL:</span>
              <span className="font-black text-cyan-300">
                R$ {flow.cotacaoUSD.toFixed(2)}
              </span>
              {flow.variacaoUSD !== undefined && (
                <span className={`text-[10px] font-bold ${flow.variacaoUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {flow.variacaoUSD >= 0 ? '+' : ''}{flow.variacaoUSD}%
                </span>
              )}
              <button
                onClick={onRefreshRate}
                disabled={isRefreshingRate}
                className="text-slate-500 hover:text-cyan-400 transition-colors ml-1 cursor-pointer"
                title="Atualizar cotação oficial"
              >
                <RefreshCw size={11} className={isRefreshingRate ? 'animate-spin text-cyan-400' : ''} />
              </button>
            </div>

            <button
              onClick={onEditFlow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 hover:text-cyan-200 text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Ajustar valores operacionais deste teste"
            >
              <Edit3 size={13} />
              <span className="hidden sm:inline">Ajustar Valores</span>
            </button>
          </div>
        </div>

        {/* ESTEIRA VISUAL DA PIPELINE (ESTILO WAR ROOM) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 relative">
          
          {/* ETAPA 1: ORIGEM */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between relative group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-1.5 border-b border-slate-800/60">
              <span>1. Origem</span>
              <Layers size={12} className="text-blue-400" />
            </div>
            <div className="mt-2">
              <span className="text-xs font-bold text-slate-300 block truncate" title={flow.origemNome}>
                {flow.origemNome}
              </span>
              <div className="text-lg font-black font-mono text-white mt-1">
                {formatCurrencyUSD(flow.origemValor)}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Volume Bruto Transacionado</span>
            </div>
          </div>

          {/* ETAPA 2: PROCESSADORA */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between relative group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-1.5 border-b border-slate-800/60">
              <span>2. Processadora</span>
              <Percent size={12} className="text-cyan-400" />
            </div>
            <div className="mt-2">
              <span className="text-xs font-bold text-slate-300 block truncate" title={flow.processadoraNome}>
                {flow.processadoraNome}
              </span>
              <div className="text-lg font-black font-mono text-cyan-300 mt-1">
                {flow.processadoraTaxa}% <span className="text-xs text-slate-400 font-normal">taxa</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Retenção de Adquirente/Gateway</span>
            </div>
          </div>

          {/* ETAPA 3: INTERMEDIÁRIA (CÂMBIO) */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between relative group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-1.5 border-b border-slate-800/60">
              <span>3. Conta Transição</span>
              <DollarSign size={12} className="text-emerald-400" />
            </div>
            <div className="mt-2">
              <span className="text-xs font-bold text-slate-300 block truncate" title={flow.intermediariaNome}>
                {flow.intermediariaNome}
              </span>
              <div className="text-lg font-black font-mono text-emerald-300 mt-1">
                {formatCurrencyUSD(flow.intermediariaValor)}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Saldo em Liquidação Internacional</span>
            </div>
          </div>

          {/* ETAPA 4: CONTA FINAL (OMIE BRL) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-cyan-950/40 to-slate-950 border border-cyan-500/40 flex flex-col justify-between relative group shadow-sm">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-cyan-400 pb-1.5 border-b border-cyan-800/40">
              <span>4. Liquidação Final</span>
              <Building size={12} className="text-cyan-300" />
            </div>
            <div className="mt-2">
              <span className="text-xs font-bold text-slate-200 block truncate" title={flow.contaFinalNome}>
                {flow.contaFinalNome}
              </span>
              <div className="text-lg sm:text-xl font-black font-mono text-cyan-200 mt-1">
                {formatCurrencyBRL(flow.contaFinalValor)}
              </div>
              <span className="text-[10px] text-cyan-400/80 font-mono">Disponível em Caixa Bancário</span>
            </div>
          </div>

        </div>
      </div>

      {/* RODAPÉ DO MONITOR COM CÁLCULO DE SPREAD VISÍVEL */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-300">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="font-semibold">Spread Total Operacional:</span>
            <span className="font-mono font-black text-amber-300 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/40">
              {flow.taxaPercentualGlobal}%
            </span>
          </div>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-slate-500 text-[11px] hidden md:inline">
            Diferencial entre receita bruta e caixa final efetivo
          </span>
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          Última calibração: <strong className="text-slate-400">{flow.ultimaAtualizacao}</strong>
        </div>
      </div>

    </div>
  );
}
