"use client";

import React from 'react';
import { 
  AlertTriangle, 
  CalendarClock, 
  ShieldAlert, 
  Radio, 
  TrendingUp, 
  CheckCircle2 
} from 'lucide-react';
import { WarRoomObligation, InsuranceExpiringAlert, FollowTheMoneyFlow } from '@/types/war-room';

interface WarRoomNewsTickerProps {
  obligations: WarRoomObligation[];
  insuranceAlerts: InsuranceExpiringAlert[];
  flow: FollowTheMoneyFlow;
}

export function WarRoomNewsTicker({
  obligations,
  insuranceAlerts,
  flow
}: WarRoomNewsTickerProps) {
  const atrasadas = obligations.filter(o => o.status === 'atrasado');
  const hoje = obligations.filter(o => o.status === 'hoje');
  const segurosCriticos = insuranceAlerts.filter(i => i.diasRestantes <= 10);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="w-full bg-slate-950 border-t border-slate-800 py-2 px-4 select-none relative z-30 overflow-hidden flex items-center shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
      
      {/* BADGE FIXO DO LETREIRO */}
      <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-sm flex-shrink-0 z-20 mr-3 animate-pulse">
        <Radio size={13} />
        <span>Radar Operacional</span>
      </div>

      {/* LINHA DE TICKER HORIZONTAL EM MARQUEE */}
      <div className="relative overflow-hidden w-full flex items-center">
        <div className="flex items-center gap-8 whitespace-nowrap animate-marquee hover:[animation-play-state:paused]">
          
          {/* URGÊNCIA 1: ATRASADAS */}
          {atrasadas.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-rose-400 bg-rose-950/40 px-3 py-1 rounded-full border border-rose-600/50">
              <AlertTriangle size={14} className="text-rose-500 animate-bounce flex-shrink-0" />
              <span>
                🚨 ATENÇÃO ({atrasadas.length} ATRASADOS):{' '}
                {atrasadas.map(a => `[${a.empresa}] ${a.titulo} (${formatCurrency(a.valor)})`).join(' • ')}
              </span>
            </div>
          )}

          {/* URGÊNCIA 2: VENCENDO HOJE */}
          {hoje.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 bg-amber-950/40 px-3 py-1 rounded-full border border-amber-600/50">
              <CalendarClock size={14} className="text-amber-400 flex-shrink-0" />
              <span>
                ⚠️ VENCE HOJE ({hoje.length} TÍTULOS):{' '}
                {hoje.map(h => `[${h.empresa}] ${h.titulo} (${formatCurrency(h.valor)})`).join(' • ')}
              </span>
            </div>
          )}

          {/* URGÊNCIA 3: SEGUROS < 10 DIAS */}
          {segurosCriticos.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-orange-300 bg-orange-950/40 px-3 py-1 rounded-full border border-orange-600/50">
              <ShieldAlert size={14} className="text-orange-400 flex-shrink-0" />
              <span>
                🛡️ SEGURO CRÍTICO (&lt;10 DIAS):{' '}
                {segurosCriticos.map(s => `${s.segurado} (${s.tipo} - expira em ${s.diasRestantes}d)`).join(' • ')}
              </span>
            </div>
          )}

          {/* URGÊNCIA 4: COTAÇÃO E FLOW */}
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-600/50">
            <TrendingUp size={14} className="text-cyan-400 flex-shrink-0" />
            <span>
              ℹ️ CÂMBIO LIVE: USD/BRL a R$ {flow.cotacaoUSD.toFixed(2)} • Spread Operacional em {flow.taxaPercentualGlobal}%
            </span>
          </div>

          {/* CULTURA OPERACIONAL */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>•</span>
            <span className="text-emerald-400 font-bold">&ldquo;Pessoas, Técnica e Propósito em cada entrega&rdquo;</span>
            <span>•</span>
            <span className="text-amber-400 font-bold">&ldquo;Pagar certo, faturar certo, fechar certo&rdquo;</span>
          </div>

        </div>
      </div>

    </div>
  );
}
