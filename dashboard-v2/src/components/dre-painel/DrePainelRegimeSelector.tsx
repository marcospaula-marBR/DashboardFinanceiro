"use client";

import React from 'react';
import { RegimeTipo } from '@/types/dre-painel';
import { Calendar, Wallet, TrendingUp, Info, CheckCircle2 } from 'lucide-react';

interface DrePainelRegimeSelectorProps {
  currentRegime: RegimeTipo;
  onSelectRegime: (regime: RegimeTipo) => void;
  isLoading: boolean;
}

export function DrePainelRegimeSelector({
  currentRegime,
  onSelectRegime,
  isLoading
}: DrePainelRegimeSelectorProps) {
  const options: Array<{
    id: RegimeTipo;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    color: string;
    activeClass: string;
  }> = [
    {
      id: 'COMPETENCIA',
      label: 'Regime de Competência',
      sublabel: 'Data de Registro • Com Provisões',
      icon: <Calendar size={16} />,
      color: 'emerald',
      activeClass: 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/20'
    },
    {
      id: 'CAIXA',
      label: 'Regime de Caixa',
      sublabel: 'Data Efetiva de Pagamento / Liquidação',
      icon: <Wallet size={16} />,
      color: 'blue',
      activeClass: 'bg-slate-900 text-white shadow-md ring-2 ring-slate-800/20'
    },
    {
      id: 'PREVISAO',
      label: 'Fluxo & Previsão',
      sublabel: 'Data de Vencimento • Obrigações Abertas',
      icon: <TrendingUp size={16} />,
      color: 'amber',
      activeClass: 'bg-amber-600 text-white shadow-md ring-2 ring-amber-500/20'
    }
  ];

  return (
    <div className="w-full bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {options.map(opt => {
          const isActive = currentRegime === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={isLoading}
              onClick={() => onSelectRegime(opt.id)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                isActive
                  ? opt.activeClass
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60 shadow-xs'
              } disabled:opacity-50`}
            >
              <div
                className={`p-2 rounded-lg ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold truncate">{opt.label}</span>
                  {isActive && <CheckCircle2 size={13} className="shrink-0 text-white/90" />}
                </div>
                <p
                  className={`text-[10px] truncate ${
                    isActive ? 'text-white/80' : 'text-slate-500'
                  }`}
                >
                  {opt.sublabel}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
