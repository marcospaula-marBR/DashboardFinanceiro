"use client";

import React from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, 
  ExternalLink, 
  Clock, 
  AlertTriangle, 
  ShieldCheck,
  Building,
  Calendar
} from 'lucide-react';
import { InsuranceExpiringAlert } from '@/types/war-room';

interface WarRoomInsuranceRadarProps {
  alerts: InsuranceExpiringAlert[];
  isLoading: boolean;
}

export function WarRoomInsuranceRadar({
  alerts,
  isLoading
}: WarRoomInsuranceRadarProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const formatDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('T')[0].split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-4 sm:p-5 backdrop-blur-sm shadow-xl flex flex-col justify-between">
      
      <div>
        {/* CABEÇALHO DO RADAR */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/40 text-blue-400 flex items-center justify-center flex-shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black uppercase text-white tracking-wide">
                  Radar de Seguros & Apólices
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-950/80 text-blue-300 border border-blue-600/40">
                  &lt; 30 Dias
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Gestão preventiva de renovação de coberturas corporativas
              </p>
            </div>
          </div>

          <Link
            href="/seguros"
            className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors group cursor-pointer"
            title="Ir para o módulo completo de Seguros"
          >
            <span>Ver Módulo</span>
            <ExternalLink size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>

        {/* LISTAGEM DE APÓLICES EM ALERTA */}
        <div className="mt-3.5 space-y-2">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
              <span>Consultando apólices no banco...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
              <ShieldCheck size={24} className="text-emerald-400" />
              <span className="font-semibold text-slate-300">Todas as apólices com vigência regular</span>
              <p className="text-[11px] text-slate-500">Nenhum seguro vence nos próximos 30 dias.</p>
            </div>
          ) : (
            alerts.slice(0, 4).map(item => {
              const isCritico = item.faixaAlerta === 'critico';
              const isAtencao = item.faixaAlerta === 'atencao';

              return (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                    isCritico
                      ? 'bg-rose-950/20 border-rose-500/40 text-slate-200'
                      : isAtencao
                      ? 'bg-amber-950/20 border-amber-500/40 text-slate-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`px-2 py-1 rounded-lg text-center flex-shrink-0 font-mono ${
                      isCritico
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : isAtencao
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    }`}>
                      <div className="text-xs font-black leading-none">
                        {item.diasRestantes <= 0 ? 'VENCEU' : `${item.diasRestantes}d`}
                      </div>
                      <div className="text-[8px] uppercase tracking-tighter text-slate-400">
                        restantes
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {item.segurado}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          {item.tipo}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.seguradora} {item.corretor ? `• Corretor: ${item.corretor}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-black font-mono text-cyan-300 block">
                      {formatCurrency(item.premio)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Venc: {formatDate(item.vencimento)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* FOOTER DO RADAR */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>&lt;10d Crítico</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>11-20d Cotação</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>21-30d Planejamento</span>
          </span>
        </div>

        <Link
          href="/seguros"
          className="text-blue-400 hover:text-blue-300 font-bold"
        >
          {alerts.length > 4 ? `+ ${alerts.length - 4} apólices` : 'Gerenciar'}
        </Link>
      </div>

    </div>
  );
}
