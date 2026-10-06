"use client";

import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Filter, 
  DollarSign, 
  Plus,
  Repeat
} from 'lucide-react';
import { WarRoomObligation, WarRoomCompany } from '@/types/war-room';

interface WarRoomBillsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  obligations: WarRoomObligation[];
  onTogglePaid: (id: string) => void;
  onOpenAddModal: () => void;
}

const COMPANY_COLORS: Record<WarRoomCompany, { bg: string; text: string; border: string }> = {
  MarBR: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  DZM: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  G2: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  Conectius: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
};

export function WarRoomBillsDetailModal({
  isOpen,
  onClose,
  obligations,
  onTogglePaid,
  onOpenAddModal
}: WarRoomBillsDetailModalProps) {
  const [selectedCompany, setSelectedCompany] = useState<string>('TODAS');
  const [activeTab, setActiveTab] = useState<'hoje' | 'atrasadas' | 'todas'>('hoje');

  if (!isOpen) return null;

  const hoje = new Date().getDate();

  // Filtragem
  let filtered = obligations.filter(ob => {
    if (selectedCompany !== 'TODAS' && ob.empresa !== selectedCompany) return false;
    if (activeTab === 'hoje') return ob.status === 'hoje';
    if (activeTab === 'atrasadas') return ob.status === 'atrasado';
    return true; // 'todas'
  });

  const totalValor = filtered.reduce((acc, curr) => acc + curr.valor, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                Conferência de Contas e Obrigações (4 Empresas)
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Detalhamento dos lançamentos das contas a pagar no Omie
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenAddModal();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Nova Conta</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS E ABAS */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/30 flex flex-wrap items-center justify-between gap-3">
          
          {/* ABAS */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('hoje')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'hoje'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Vence Hoje ({obligations.filter(o => o.status === 'hoje').length})
            </button>
            <button
              onClick={() => setActiveTab('atrasadas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'atrasadas'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Atrasadas ({obligations.filter(o => o.status === 'atrasado').length})
            </button>
            <button
              onClick={() => setActiveTab('todas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'todas'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mês Completo ({obligations.length})
            </button>
          </div>

          {/* FILTRO POR EMPRESA (4 CNPJs) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase text-slate-500 mr-1 flex items-center gap-1">
              <Filter size={12} /> Empresa:
            </span>
            {['TODAS', 'MarBR', 'DZM', 'G2', 'Conectius'].map(emp => (
              <button
                key={emp}
                onClick={() => setSelectedCompany(emp)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                  selectedCompany === emp
                    ? 'bg-slate-200 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {emp}
              </button>
            ))}
          </div>

        </div>

        {/* LISTAGEM DE TÍTULOS */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 size={32} className="text-emerald-400" />
              <p className="text-sm font-semibold">Nenhuma obrigação encontrada para este filtro.</p>
              <p className="text-xs text-slate-500">Tudo liquidado ou sem vencimentos no período selecionado.</p>
            </div>
          ) : (
            filtered.map(ob => {
              const style = COMPANY_COLORS[ob.empresa];
              const isPaid = ob.status === 'pago';
              const isLate = ob.status === 'atrasado';
              const isToday = ob.status === 'hoje';

              return (
                <div
                  key={ob.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isPaid
                      ? 'bg-slate-950/40 border-slate-800/40 opacity-50'
                      : isLate
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : isToday
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => onTogglePaid(ob.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0 cursor-pointer"
                      title={isPaid ? 'Reabrir título' : 'Marcar como quitado'}
                    >
                      <CheckCircle2 size={20} className={isPaid ? 'text-emerald-400' : 'text-slate-600'} />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${style.border} ${style.bg} ${style.text}`}>
                          {ob.empresa}
                        </span>
                        <h4 className={`text-sm font-bold truncate ${isPaid ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {ob.titulo}
                        </h4>
                        {ob.recorrente && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold" title="Despesa Recorrente">
                            <Repeat size={11} /> Recorrente
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                        <span>Categoria: <strong className="text-slate-300">{ob.categoria}</strong></span>
                        <span>•</span>
                        <span>Dia de Vencimento: <strong className="text-slate-200 font-mono">dia {ob.diaVencimento}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-base font-black font-mono text-white">
                        {formatCurrency(ob.valor)}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        isPaid
                          ? 'text-emerald-400'
                          : isLate
                          ? 'text-rose-400'
                          : isToday
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }`}>
                        {isPaid ? 'Liquidado' : isLate ? 'Atrasado' : isToday ? 'Vence Hoje' : 'Pendente'}
                      </span>
                    </div>

                    <button
                      onClick={() => onTogglePaid(ob.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isPaid
                          ? 'bg-slate-800 text-slate-400 hover:text-white'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300'
                      }`}
                    >
                      {isPaid ? 'Desfazer' : 'Baixar'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RODAPÉ DO MODAL COM TOTAL */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Exibindo <strong>{filtered.length}</strong> obrigações financeiras
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-slate-400">Total do Filtro:</span>
            <span className="text-lg font-black font-mono text-cyan-300">
              {formatCurrency(totalValor)}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
