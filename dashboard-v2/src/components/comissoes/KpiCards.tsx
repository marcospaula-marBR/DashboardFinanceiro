"use client";

import { 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  BadgeDollarSign 
} from "lucide-react";
import { formatCurrency } from "@/services/comissoes.service";
import { Recebimento } from "@/types/comissoes";

interface KpiCardsProps {
  historico: Recebimento[];
  onOpenFaturado: () => void;
  onOpenRecebido: () => void;
  onOpenAReceber: () => void;
  onOpenComissoes: () => void;
}

export function KpiCards({ 
  historico, 
  onOpenFaturado, 
  onOpenRecebido, 
  onOpenAReceber, 
  onOpenComissoes 
}: KpiCardsProps) {
  
  // Totais
  const totalFaturado = historico.reduce((sum, r) => sum + r.valor_bruto, 0);
  
  const totalRecebido = historico
    .filter(r => r.status === 'Pago')
    .reduce((sum, r) => sum + r.valor_bruto, 0);
    
  const totalAReceber = historico
    .filter(r => r.status === 'Pendente')
    .reduce((sum, r) => sum + r.valor_bruto, 0);

  const totalComissoes = historico.reduce(
    (sum, r) => sum + r.comissoes.reduce((s, c) => s + c.valor_calculado, 0),
    0
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* CARD 1: TOTAL FATURADO */}
      <div 
        onClick={onOpenFaturado}
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer relative overflow-hidden group"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center transition-colors group-hover:bg-sky-500 group-hover:text-white">
            <TrendingUp size={20} />
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Geral</span>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Total Faturado</p>
        <h3 className="text-2xl font-black text-slate-800 tabular-nums">{formatCurrency(totalFaturado)}</h3>
        <p className="text-[10px] font-bold text-slate-400 mt-2 block">Clique para ver todos os faturamentos</p>
      </div>

      {/* CARD 2: TOTAL RECEBIDO */}
      <div 
        onClick={onOpenRecebido}
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer relative overflow-hidden group"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors group-hover:bg-emerald-500 group-hover:text-white">
            <CheckCircle2 size={20} />
          </div>
          <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Liquidado</span>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Total Recebido</p>
        <h3 className="text-2xl font-black text-emerald-600 tabular-nums">{formatCurrency(totalRecebido)}</h3>
        <p className="text-[10px] font-bold text-emerald-500 mt-2 block">Clique para ver baixas efetivadas</p>
      </div>

      {/* CARD 3: SALDO A RECEBER */}
      <div 
        onClick={onOpenAReceber}
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer relative overflow-hidden group"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center transition-colors group-hover:bg-amber-500 group-hover:text-white">
            <Clock size={20} />
          </div>
          <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Aberto</span>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Saldo A Receber</p>
        <h3 className="text-2xl font-black text-amber-600 tabular-nums">{formatCurrency(totalAReceber)}</h3>
        <p className="text-[10px] font-bold text-amber-500 mt-2 block">Clique para gerenciar lançamentos em aberto</p>
      </div>

      {/* CARD 4: TOTAL COMISSÕES */}
      <div 
        onClick={onOpenComissoes}
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer relative overflow-hidden group"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center transition-colors group-hover:bg-slate-800 group-hover:text-white">
            <BadgeDollarSign size={20} />
          </div>
          <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Equipe</span>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Total em Comissões</p>
        <h3 className="text-2xl font-black text-slate-800 tabular-nums">{formatCurrency(totalComissoes)}</h3>
        <p className="text-[10px] font-bold text-slate-400 mt-2 block">Clique para ver rateio dos colaboradores</p>
      </div>

    </div>
  );
}
