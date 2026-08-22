'use client';
import React from 'react';
import { ScenarioAssumption } from '@/types/simulator.types';
import { ToggleLeft, ToggleRight, Trash2, Edit3, Zap, Layers } from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/date-utils';

interface PremissasTableProps {
  assumptions: ScenarioAssumption[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenModal: () => void;
}

export function PremissasTable({ assumptions, onToggle, onRemove, onOpenModal }: PremissasTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 my-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center">
            <Layers size={18} className="mr-2 text-emerald-600" />
            Premissas e Eventos Simulado ({assumptions.filter(a => a.enabled).length}/{assumptions.length} ativos)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ligue, desligue ou altere o impacto de cada premissa em tempo real no modelo.
          </p>
        </div>

        <button
          onClick={onOpenModal}
          className="flex items-center justify-center text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
        >
          <Zap size={15} className="mr-1.5 text-emerald-400" />
          + Adicionar Premissa
        </button>
      </div>

      {/* Lista de Premissas */}
      {assumptions.length === 0 ? (
        <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <p className="text-sm font-medium text-slate-600">Nenhuma premissa adicionada neste cenário.</p>
          <p className="text-xs text-slate-400 mt-1">Clique no botão acima ou nos atalhos rápidos para simular o impacto financeiro.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assumptions.map(asm => (
            <div
              key={asm.id}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                asm.enabled
                  ? 'bg-slate-50/80 border-slate-200 hover:border-emerald-300'
                  : 'bg-slate-100/50 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onToggle(asm.id)}
                  className="text-slate-600 hover:text-emerald-600 transition-colors"
                  title={asm.enabled ? 'Desativar premissa' : 'Ativar premissa'}
                >
                  {asm.enabled ? (
                    <ToggleRight size={26} className="text-emerald-600" />
                  ) : (
                    <ToggleLeft size={26} className="text-slate-400" />
                  )}
                </button>

                <div>
                  <span className="font-semibold text-sm text-slate-900 block">{asm.name}</span>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className="bg-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                      {asm.type === 'hiring_personnel' ? `${asm.hiringCount}x Contratação` : asm.type}
                    </span>
                    <span>Período: {asm.startDate} a {asm.endDate}</span>
                    <span className="font-semibold text-emerald-700">
                      {asm.amountType === 'percentage'
                        ? `${asm.value > 0 ? '+' : ''}${asm.value}%`
                        : asm.type === 'hiring_personnel'
                        ? `${formatCurrencyBRL(asm.salaryBase || 0)}/mês`
                        : formatCurrencyBRL(asm.value)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onRemove(asm.id)}
                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors"
                title="Remover premissa"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
