"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, ExternalLink, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { InsurancePolicy } from '@/types/insurance';

interface WhiteboardInsuranceAlertBannerProps {
  policies: InsurancePolicy[];
}

export function WhiteboardInsuranceAlertBanner({ policies }: WhiteboardInsuranceAlertBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filtra apólices com vencimento crítico em até 30 dias (D <= 30 e D >= -5)
  const expiring = policies.filter(
    p => p.diasParaVencer !== undefined && p.diasParaVencer <= 30 && p.diasParaVencer >= -5
  );

  // Ordena próximas apólices futuras para exibir o horizonte preventivo
  const futurePolicies = policies
    .filter(p => p.diasParaVencer !== undefined && p.diasParaVencer > 0)
    .sort((a, b) => (a.diasParaVencer ?? 999) - (b.diasParaVencer ?? 999));

  const nextPolicy = futurePolicies[0];
  const activeCount = policies.filter(p => p.ativo !== false).length;

  const hasCritical = expiring.length > 0;

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO 1: HÁ APÓLICES EM D < 30 DIAS (ALERTA VERMELHO/ÂMBAR)
  // ─────────────────────────────────────────────────────────────
  if (hasCritical) {
    return (
      <div className="w-full bg-gradient-to-r from-rose-950/70 via-slate-900/90 to-amber-950/70 border border-rose-500/60 rounded-xl p-3 sm:p-3.5 shadow-lg shadow-rose-950/30 transition-all animate-in fade-in">
        {/* CABEÇALHO DO ALERTA */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 flex-shrink-0 animate-pulse">
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-rose-300 font-mono">
                  RADAR DE SEGUROS: {expiring.length} APÓLICE(S) A VENCER EM D &lt; 30 DIAS!
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide bg-rose-600 text-white shadow-sm">
                  Ação Imediata
                </span>
              </div>
              <p className="text-[11px] text-slate-300 hidden sm:block">
                Apólices corporativas com necessidade de renovação ou conferência antes do vencimento
              </p>
            </div>
          </div>

          {/* BOTÕES DE CONTROLE */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/seguros"
              title="Ir para o módulo completo de Seguros"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold transition-all"
            >
              <span className="hidden md:inline">Painel de Seguros</span>
              <ExternalLink size={12} />
            </Link>

            <button
              type="button"
              onClick={() => setIsExpanded(prev => !prev)}
              className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-900/60 border border-slate-700/60"
              title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* LISTA EXPANSÍVEL DE APÓLICES EM RISCO */}
        {isExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 mt-3 pt-2.5 border-t border-rose-500/20">
            {expiring.map(policy => {
              const dias = policy.diasParaVencer ?? 0;
              const isCritical = dias <= 7;
              const isWarning = dias > 7 && dias <= 15;

              return (
                <div
                  key={policy.id}
                  className={`p-2.5 rounded-lg border transition-all flex flex-col justify-between ${
                    isCritical
                      ? 'bg-rose-950/40 border-rose-500/60 ring-1 ring-rose-500/30'
                      : isWarning
                      ? 'bg-amber-950/30 border-amber-500/50'
                      : 'bg-slate-900/80 border-slate-700/60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                        {policy.contratante}
                      </span>

                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase font-mono ${
                          isCritical
                            ? 'bg-rose-600 text-white animate-pulse'
                            : isWarning
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {dias < 0 ? `Vencido há ${Math.abs(dias)}d` : `D - ${dias} dias`}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white leading-tight">
                      {policy.tipo}
                    </h4>

                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {policy.seguradora || 'Seguradora não informada'}
                      {policy.apolice ? ` • ${policy.apolice}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 mt-2 border-t border-slate-800/60">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar size={10} className="text-rose-400" />
                      {policy.vencimento ? new Date(policy.vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                    </span>

                    {policy.premio > 0 && (
                      <span className="font-mono font-bold text-slate-300">
                        R$ {policy.premio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO 2: 0 APÓLICES EM D < 30 (SITUAÇÃO 100% REGULARIZADA)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-cyan-950/30 border border-emerald-500/40 rounded-xl p-3 sm:p-3.5 shadow-lg shadow-emerald-950/20 transition-all">
      {/* CABEÇALHO DO RADAR REGULARIZADO */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex-shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-300 font-mono">
                RADAR DE SEGUROS CORPORATIVOS: 0 APÓLICES EM D &lt; 30 DIAS
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                100% em Dia
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              {nextPolicy ? (
                <>
                  <span className="font-semibold text-slate-200">Próximo vencimento:</span>{' '}
                  <span className="text-cyan-300 font-medium">{nextPolicy.contratante} • {nextPolicy.tipo} ({nextPolicy.seguradora || 'Seguradora'})</span>{' '}
                  em <strong className="text-amber-300">{nextPolicy.diasParaVencer} dias</strong> ({new Date(nextPolicy.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}) •{' '}
                  <span className="text-slate-400">{activeCount} apólices ativas sob monitoramento contínuo</span>
                </>
              ) : (
                <span>{activeCount} apólices ativas sob monitoramento contínuo sem vencimentos imediatos.</span>
              )}
            </p>
          </div>
        </div>

        {/* BOTÕES DE CONTROLE */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/seguros"
            title="Ir para o módulo completo de Seguros"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200 text-xs font-bold transition-all"
          >
            <span className="hidden md:inline">Painel de Seguros</span>
            <ExternalLink size={12} />
          </Link>

          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-900/60 border border-slate-700/60"
            title={isExpanded ? 'Recolher próximas apólices' : 'Ver próximas apólices a vencer'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* HORIZONTE DE PRÓXIMAS APÓLICES (EXPANSÍVEL) */}
      {isExpanded && futurePolicies.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-emerald-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide font-mono">
              Próximos Vencimentos no Horizonte (Monitoramento Preventivo):
            </span>
            <span className="text-[10px] text-slate-400">
              Exibindo as 4 apólices mais próximas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {futurePolicies.slice(0, 4).map(policy => {
              const dias = policy.diasParaVencer ?? 0;
              return (
                <div
                  key={policy.id}
                  className="p-2.5 rounded-lg border bg-slate-900/80 border-slate-700/70 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                        {policy.contratante}
                      </span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded uppercase font-mono bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                        D - {dias} dias
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white leading-tight">
                      {policy.tipo}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {policy.seguradora || 'Seguradora'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 mt-2 border-t border-slate-800/60 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} className="text-cyan-400" />
                      {policy.vencimento ? new Date(policy.vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </span>
                    {policy.premio > 0 && (
                      <span className="font-bold text-slate-300">
                        R$ {policy.premio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
