"use client";

import React, { useState } from "react";
import { X, RefreshCw, Copy, CheckCircle2, AlertTriangle, Calendar, Users, ArrowRight } from "lucide-react";
import { PeopleHRService } from "@/services/people-hr.service";

interface BatchReplicateCostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BatchReplicateCostsModal({
  isOpen,
  onClose,
  onSuccess
}: BatchReplicateCostsModalProps) {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

  const [originComp, setOriginComp] = useState(prevMonthStr);
  const [targetComp, setTargetComp] = useState(currentMonthStr);
  const [vinculoFilter, setVinculoFilter] = useState<'ALL' | 'CLT' | 'MEI'>('ALL');
  
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ count: number; totalFixo: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReplicating, setIsReplicating] = useState(false);

  if (!isOpen) return null;

  const handleFetchPreview = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const originCosts = await PeopleHRService.getMonthlyCostsByCompetencia(originComp, vinculoFilter);
      if (!originCosts || originCosts.length === 0) {
        setError(`Nenhum lançamento de custo encontrado na competência de origem (${originComp}).`);
        setPreviewData(null);
        return;
      }
      const sum = originCosts.reduce((acc, c) => acc + (c.valor_fixo || 0) + (c.valor_liquido || 0), 0);
      setPreviewData({ count: originCosts.length, totalFixo: sum });
    } catch (err: any) {
      setError("Erro ao carregar prévia: " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteReplication = async () => {
    if (!originComp || !targetComp) return;
    if (originComp === targetComp) {
      setError("A competência de destino deve ser diferente da competência de origem.");
      return;
    }

    try {
      setIsReplicating(true);
      setError(null);

      const result = await PeopleHRService.replicateCompetenciaBatch(originComp, targetComp, vinculoFilter);
      if (result.count === 0) {
        throw new Error(`Nenhum lançamento foi encontrado em ${originComp} para ser replicado.`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao replicar competência em lote.");
    } finally {
      setIsReplicating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Replicar Competência em Lote
              </h2>
              <p className="text-xs text-slate-500">
                Insere nova competência com base nos mesmos valores da competência anterior
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Competencia Origem */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Competência de Origem (Copiar de)
              </label>
              <div className="relative">
                <input
                  type="month"
                  value={originComp}
                  onChange={(e) => {
                    setOriginComp(e.target.value);
                    setPreviewData(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Competencia Destino */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Competência de Destino (Criar em)
              </label>
              <div className="relative">
                <input
                  type="month"
                  value={targetComp}
                  onChange={(e) => setTargetComp(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Filtro de Vínculo */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Filtrar por Vínculo
            </label>
            <select
              value={vinculoFilter}
              onChange={(e) => {
                setVinculoFilter(e.target.value as any);
                setPreviewData(null);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">Todos os Vínculos (CLT + PJ/MEI)</option>
              <option value="CLT">Apenas Colaboradores CLT</option>
              <option value="MEI">Apenas Prestadores PJ / MEI</option>
            </select>
          </div>

          {/* Botão de Verificação de Prévia */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div className="text-xs">
              {previewData ? (
                <div>
                  <span className="font-bold text-emerald-700 block">
                    ✓ {previewData.count} colaboradores prontos para replicação
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Sua folha em {targetComp} nascerá com os mesmos valores de {originComp}.
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 font-medium">
                  Clique para conferir os lançamentos da competência {originComp}
                </span>
              )}
            </div>

            <button
              onClick={handleFetchPreview}
              disabled={isLoading}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>Verificar Lançamentos</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            Cancelar
          </button>
          <button
            disabled={!originComp || !targetComp || isReplicating}
            onClick={handleExecuteReplication}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-colors"
          >
            {isReplicating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Replicando Lançamentos...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Replicar em Lote para {targetComp}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
