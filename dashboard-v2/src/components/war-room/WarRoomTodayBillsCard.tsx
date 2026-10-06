"use client";

import React from 'react';
import { 
  CalendarClock, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { WarRoomObligation, WarRoomCompany } from '@/types/war-room';

interface WarRoomTodayBillsCardProps {
  obligations: WarRoomObligation[];
  onOpenDetails: () => void;
  onTogglePaid: (id: string) => void;
}

const COMPANY_COLORS: Record<WarRoomCompany, { bg: string; text: string; border: string }> = {
  MarBR: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  DZM: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  G2: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  Conectius: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
};

export function WarRoomTodayBillsCard({
  obligations,
  onOpenDetails,
  onTogglePaid
}: WarRoomTodayBillsCardProps) {
  // Filtra itens de hoje e atrasados
  const hoje = new Date().getDate();
  const contasHoje = obligations.filter(o => o.status === 'hoje');
  const contasAtrasadas = obligations.filter(o => o.status === 'atrasado');

  const totalHoje = contasHoje.reduce((acc, curr) => acc + curr.valor, 0);
  const totalAtrasado = contasAtrasadas.reduce((acc, curr) => acc + curr.valor, 0);

  // Totais por empresa (das 4 empresas no Omie)
  const empresas: WarRoomCompany[] = ['MarBR', 'DZM', 'G2', 'Conectius'];
  const totalPorEmpresa = empresas.map(emp => {
    const itens = contasHoje.filter(o => o.empresa === emp);
    const soma = itens.reduce((acc, curr) => acc + curr.valor, 0);
    return {
      empresa: emp,
      count: itens.length,
      total: soma,
    };
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950 border border-amber-500/30 p-4 sm:p-5 shadow-[0_0_25px_rgba(245,158,11,0.12)] flex flex-col justify-between overflow-hidden group">
      
      {/* GLOW DECORATIVO */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/15 transition-all"></div>

      <div>
        {/* CABEÇALHO DO CARD */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              <CalendarClock size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black uppercase text-white tracking-wide">
                  Contas a Vencer no Dia
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-600/40">
                  {contasHoje.length} Títulos
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Vencimento hoje nas 4 empresas do Grupo
              </p>
            </div>
          </div>

          <button
            onClick={onOpenDetails}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all shadow-xs cursor-pointer group/btn"
          >
            <span>Ver Detalhes</span>
            <ExternalLink size={13} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
          </button>
        </div>

        {/* VALOR CONSOLIDADO DO DIA */}
        <div className="mt-3.5 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Volume Total Hoje
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-300 tracking-tight leading-tight">
              {formatCurrency(totalHoje)}
            </div>
          </div>

          {contasAtrasadas.length > 0 && (
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1 justify-end">
                <AlertCircle size={11} /> + {contasAtrasadas.length} Atrasados
              </span>
              <div className="text-sm font-bold font-mono text-rose-400/90">
                {formatCurrency(totalAtrasado)}
              </div>
            </div>
          )}
        </div>

        {/* DETALHAMENTO DAS 4 EMPRESAS NO OMIE */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3.5">
          {totalPorEmpresa.map(item => {
            const style = COMPANY_COLORS[item.empresa];
            return (
              <div
                key={item.empresa}
                className={`p-2.5 rounded-xl border ${style.border} ${style.bg} flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black tracking-wider uppercase ${style.text}`}>
                    {item.empresa}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    {item.count} tit.
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-black font-mono text-slate-200 mt-1">
                  {formatCurrency(item.total)}
                </div>
              </div>
            );
          })}
        </div>

        {/* PREVIA DAS CONTAS DO DIA */}
        <div className="mt-3.5 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
            <span>Destaques da Pauta de Hoje</span>
            <span>Ação Rápida</span>
          </div>

          {contasHoje.length === 0 ? (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Nenhuma obrigação pendente cadastrada para o dia {hoje}.</span>
            </div>
          ) : (
            contasHoje.slice(0, 3).map(item => {
              const style = COMPANY_COLORS[item.empresa];
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${style.bg} ${style.text} border ${style.border}`}>
                      {item.empresa}
                    </span>
                    <span className="font-semibold text-slate-200 truncate">
                      {item.titulo}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono font-bold text-amber-300">
                      {formatCurrency(item.valor)}
                    </span>
                    <button
                      onClick={() => onTogglePaid(item.id)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 transition-colors cursor-pointer"
                      title="Marcar como Liquidado/Pago"
                    >
                      Pagar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* FOOTER DO CARD */}
      <div className="mt-3.5 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <Building2 size={13} className="text-slate-500" />
          <span>Conciliação Omie 4 CNPJs</span>
        </span>
        <button
          onClick={onOpenDetails}
          className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
        >
          <span>Abrir Painel Completo</span>
          <ArrowRight size={12} />
        </button>
      </div>

    </div>
  );
}
