"use client";

import React from 'react';
import {
  X,
  Building2,
  Calendar,
  Layers,
  Tag,
  CreditCard,
  FileText,
  AlertTriangle,
  Clock,
  Briefcase,
  CheckCircle2,
  Percent,
  Sparkles,
  Info
} from 'lucide-react';
import { DrePainelLancamento } from '@/types/dre-painel';
import { formatCurrencyBRL } from '@/services/dre-painel.service';

interface DrePainelDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lancamento: DrePainelLancamento | null;
  isMeetingMode: boolean;
}

export function DrePainelDrawer({
  isOpen,
  onClose,
  lancamento,
  isMeetingMode
}: DrePainelDrawerProps) {
  if (!isOpen || !lancamento) return null;

  const mask = (v: number) => (isMeetingMode ? 'R$ ••••••' : formatCurrencyBRL(v));

  const isReceita = lancamento.sinal_valor > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isReceita
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {lancamento.tipo}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {lancamento.empresa}
                </span>
                {lancamento.origem_base === 'HISTORICO_CONGELADO' && (
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                    Histórico Fixo
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1 truncate">
                {lancamento.fornecedor_cliente}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Valor Principal em Destaque */}
          <div className="p-5 border-b border-slate-100 bg-white">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Valor Alocado
            </span>
            <div className={`text-2xl font-black mt-0.5 ${
              isReceita ? 'text-emerald-600' : 'text-slate-900'
            }`}>
              {mask(lancamento.valor)}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                Parcela: {lancamento.numero_parcela}
              </span>
              {lancamento.is_parcela_anterior && (
                <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                  Parcela de compra anterior
                </span>
              )}
              {lancamento.is_longo_prazo && (
                <span className="text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md">
                  Longo Prazo (&gt; 12m)
                </span>
              )}
              {lancamento.is_recorrente && (
                <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  Recorrente
                </span>
              )}
              {lancamento.is_provisao && (
                <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
                  Provisão Contábil
                </span>
              )}
              {lancamento.is_em_atraso && (
                <span className="text-[11px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {lancamento.dias_atraso} dias de atraso
                </span>
              )}
            </div>
          </div>

          {/* Corpo com Detalhes Granulares */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            {/* Datas */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Linha Temporal
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Competência / Registro:</span>
                  <span className="font-semibold text-slate-800">{lancamento.data_competencia || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Vencimento:</span>
                  <span className="font-semibold text-slate-800">{lancamento.data_vencimento || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Pagamento / Caixa:</span>
                  <span className="font-semibold text-slate-800">{lancamento.data_caixa || 'Pendente'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Período DRE:</span>
                  <span className="font-semibold text-slate-800">{lancamento.periodo}</span>
                </div>
              </div>
            </div>

            {/* Classificação DRE */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Classificação Contábil
              </span>
              <div className="space-y-1.5">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Conta DRE:</span>
                  <span className="font-bold text-slate-900">{lancamento.conta_dre}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Categoria:</span>
                  <span className="font-semibold text-slate-800">{lancamento.categoria}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Projeto / Setor:</span>
                  <span className="font-semibold text-slate-800">{lancamento.projeto}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Conta Bancária / Caixa:</span>
                  <span className="font-semibold text-slate-800">{lancamento.conta_corrente}</span>
                </div>
                {lancamento.numero_documento && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Nº Documento / Doc:</span>
                    <span className="font-mono text-slate-800">{lancamento.numero_documento}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rateios por Departamento */}
            {lancamento.rateios && lancamento.rateios.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Rateio Departamental
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {lancamento.rateios.length} centros de custo
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {lancamento.rateios.map((r, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">{r.departamento}</span>
                        <span className="text-[10px] text-slate-400">{r.percentual.toFixed(1)}% alocado</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {mask(r.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observações */}
            {lancamento.observacoes && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                  Observações / Histórico
                </span>
                <p className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-slate-600 text-xs leading-relaxed break-words">
                  {lancamento.observacoes}
                </p>
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
