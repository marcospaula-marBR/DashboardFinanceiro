'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  TrendingDown,
  Target,
  Scissors,
  ShieldAlert,
  ArrowRight,
  Info,
  Calendar,
  Layers,
  ChevronDown,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { ContractLossParams, ContractLossResult } from '@/types/pricing-simulator.types';
import { PricingSimulatorEngine, BaseContractData } from '@/services/pricing-simulator.engine';

interface ContractLossSectionProps {
  ftOriginal: number;
  drOriginal: number;
  contratosAtivos: BaseContractData[];
  onSelectContract?: (contractId: string) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;

export function ContractLossSection({
  ftOriginal,
  drOriginal,
  contratosAtivos
}: ContractLossSectionProps) {
  // Estado do formulário
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [horizonteMeses, setHorizonteMeses] = useState<number>(12);
  const [metaReposicaoPct, setMetaReposicaoPct] = useState<number>(100);
  const [bufferSegurancaPct, setBufferSegurancaPct] = useState<number>(0);
  const [showRemainingDetails, setShowRemainingDetails] = useState<boolean>(false);

  // Selecionar primeiro contrato disponível por padrão
  useEffect(() => {
    if (contratosAtivos.length > 0 && !selectedContractId) {
      setSelectedContractId(contratosAtivos[0].id);
    }
  }, [contratosAtivos, selectedContractId]);

  const contratoSelecionado = useMemo(() => {
    return (
      contratosAtivos.find(c => c.id === selectedContractId) || {
        id: 'mock',
        nome: 'Contrato Selecionado',
        faturamentoMensal: 200000,
        custoDiretoMensal: 130000
      }
    );
  }, [contratosAtivos, selectedContractId]);

  // Execução do cálculo de perda e sensibilidade
  const result: ContractLossResult = useMemo(() => {
    return PricingSimulatorEngine.calculateContractLoss(
      {
        contractId: contratoSelecionado.id,
        faturamentoMensal: contratoSelecionado.faturamentoMensal,
        custoDiretoMensal: contratoSelecionado.custoDiretoMensal,
        horizonteMeses,
        metaReposicaoPct,
        bufferSegurancaPct
      },
      ftOriginal,
      drOriginal,
      contratoSelecionado.nome,
      contratosAtivos
    );
  }, [
    contratoSelecionado,
    horizonteMeses,
    metaReposicaoPct,
    bufferSegurancaPct,
    ftOriginal,
    drOriginal,
    contratosAtivos
  ]);

  return (
    <div className="space-y-6">
      {/* ── Seletor de Contrato & Parâmetros de Horizonte ──────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                Simulador de Cenários de Perda de Contrato
              </h2>
              <p className="text-xs text-slate-500">
                Diagnóstico de sensibilidade, sobrecarga de rateio remanescente e metas de neutralização
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Faturamento Base: {fmt(ftOriginal)}/mês
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Seletor de Contrato Ativo */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Selecione o Contrato para Simulação
            </label>
            <select
              value={selectedContractId}
              onChange={e => setSelectedContractId(e.target.value)}
              className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-250 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all cursor-pointer"
            >
              {contratosAtivos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome} — {fmt(c.faturamentoMensal)}/mês (Part: {ftOriginal > 0 ? fmtPct((c.faturamentoMensal / ftOriginal) * 100) : '0%'})
                </option>
              ))}
              {contratosAtivos.length === 0 && (
                <option value="mock">Exemplo: Contrato X (R$ 200.000/mês)</option>
              )}
            </select>
          </div>

          {/* Horizonte em Meses */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
              <span>Horizonte de Reposição (N)</span>
              <span className="text-rose-600 font-bold">{horizonteMeses} meses</span>
            </label>
            <input
              type="range"
              min="1"
              max="24"
              value={horizonteMeses}
              onChange={e => setHorizonteMeses(Number(e.target.value))}
              className="w-full accent-rose-600 cursor-pointer mt-2"
            />
          </div>

          {/* Meta de Reposição % */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
              <span>Meta de Reposição (%)</span>
              <span className="text-teal-600 font-bold">{metaReposicaoPct}%</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={metaReposicaoPct}
                onChange={e => setMetaReposicaoPct(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <span className="w-12 text-center text-xs font-bold px-2 py-1 bg-slate-100 rounded-lg text-slate-700">
                {metaReposicaoPct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Painel de Alerta de Lucro Cessante e Rateio ───────────────────── */}
      {result.temLucroCessanteAlemDoRateio && (
        <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 text-xs flex items-start gap-3 shadow-sm">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
          <div className="leading-relaxed">
            <strong className="font-bold text-amber-950 block mb-1">
              Atenção de CFO — Lucro Líquido Além do Rateio:
            </strong>
            O contrato gerava uma Margem de Contribuição de <strong>{fmt(result.margemContribPerdida)}/mês</strong>,
            mas seu rateio absorvido era de apenas <strong>{fmt(result.corteNecessarioDR)}/mês</strong>. Cortar o rateio
            apenas estabiliza a sobrecarga nos outros contratos, mas <strong>{fmt(result.lucroCessanteExcedente)}/mês</strong> de lucro
            líquido deixarão de entrar no caixa da empresa se não houver novos fechamentos comerciais.
          </div>
        </div>
      )}

      {/* ── 4 KPIs Executivos do Impacto ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Perda de Faturamento */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Perda de Faturamento Mensal
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-rose-600">-{fmt(result.perdaFaturamentoMensal)}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Part. no DRE:</span>
            <span className="font-bold text-slate-800">{fmtPct(result.partOriginalPct)}</span>
          </div>
        </div>

        {/* KPI 2: Margem de Contribuição Perdida */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Margem de Contribuição Perdida
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-rose-700">-{fmt(result.margemContribPerdida)}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Custo Direto Eliminado:</span>
            <span className="font-bold text-emerald-600">-{fmt(result.reducaoCustoDireto)}</span>
          </div>
        </div>

        {/* KPI 3: Sobrecarga nos Remanescentes */}
        <div className="bg-rose-50/50 rounded-2xl border border-rose-200/80 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
              Sobrecarga no Rateio
            </span>
            <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
              Se Nada For Feito
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-rose-700">+{fmtPct(result.rateioMedioAdicionalPct)}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-rose-100/80 flex items-center justify-between text-xs text-rose-900">
            <span>Nova Base de Faturamento:</span>
            <span className="font-bold">{fmt(result.ftPosPerda)}</span>
          </div>
        </div>

        {/* KPI 4: Corte Necessário em DR */}
        <div className="bg-amber-50/50 rounded-2xl border border-amber-200/80 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Corte Necessário em DR
            </span>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              Para Equilibrar
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-700">-{fmt(result.corteNecessarioDR)}/mês</span>
          </div>
          <div className="mt-3 pt-3 border-t border-amber-100/80 flex items-center justify-between text-xs text-amber-900">
            <span>Meta Reposição Comercial:</span>
            <span className="font-bold">{fmt(result.metaMensalReposicao)}/mês</span>
          </div>
        </div>
      </div>

      {/* ── Matriz de Sensibilidade dos 3 Cenários (Passo 5 da Spec) ────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6">
        <h3 className="text-sm font-black text-slate-800 tracking-tight mb-1">
          Matriz de Sensibilidade & Planos de Ação
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Comparação dos três caminhos estratégicos para neutralizar a perda do contrato ao longo de {horizonteMeses} meses
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {result.sensibilidade.map(s => {
            const isOtimista = s.cenario === 'Otimista';
            const isIntermediario = s.cenario === 'Intermediário';
            const colorBorder = isOtimista
              ? 'border-emerald-200 bg-emerald-50/30'
              : isIntermediario
              ? 'border-teal-200 bg-teal-50/30'
              : 'border-slate-200 bg-slate-50/50';
            const badgeColor = isOtimista
              ? 'bg-emerald-100 text-emerald-800'
              : isIntermediario
              ? 'bg-teal-100 text-teal-800'
              : 'bg-slate-200 text-slate-800';

            return (
              <div key={s.cenario} className={`rounded-2xl border p-5 transition-all hover:shadow-md ${colorBorder}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-slate-800 tracking-tight">Cenário {s.cenario}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                    {s.reposicaoPct}% Reposição
                  </span>
                </div>

                <div className="space-y-3 text-xs mb-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-slate-500">Meta Mensal de Vendas:</span>
                    <strong className="text-slate-800 font-bold">{fmt(s.metaMensalNovoFaturamento)}/mês</strong>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-slate-500">Corte em Despesas Rateadas:</span>
                    <strong className="text-rose-600 font-bold">{fmt(s.corteNecessarioDR)}/mês</strong>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed bg-white/70 p-3 rounded-xl border border-slate-100">
                  {s.descricao}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sobrecarga por Contrato Remanescente (Tabela com Toggle) ────────── */}
      {result.contratosSobrecarga.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight">
                Impacto nos Contratos Remanescentes
              </h3>
              <p className="text-xs text-slate-500">
                Quanto cada contrato ativo passará a absorver a mais de rateio sem corte de despesas
              </p>
            </div>
            <button
              onClick={() => setShowRemainingDetails(!showRemainingDetails)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-all"
            >
              <Layers size={14} />
              <span>{showRemainingDetails ? 'Ocultar Detalhes' : 'Ver Contratos Remanescentes'}</span>
              <ChevronDown size={14} className={`transition-transform ${showRemainingDetails ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showRemainingDetails && (
            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-64 scrollbar-thin">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-3">Contrato Ativo</th>
                      <th className="p-3 text-right">Faturamento</th>
                      <th className="p-3 text-right">Rateio Atual</th>
                      <th className="p-3 text-right text-rose-600">Rateio Pós-Perda</th>
                      <th className="p-3 text-right text-rose-700">Aumento (+R$/mês)</th>
                      <th className="p-3 text-right text-rose-700">Aumento (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {result.contratosSobrecarga.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-semibold text-slate-800">{c.nome}</td>
                        <td className="p-3 text-right">{fmt(c.faturamento)}</td>
                        <td className="p-3 text-right">{fmt(c.rateioAtual)}</td>
                        <td className="p-3 text-right font-medium text-rose-600">{fmt(c.rateioPosPerda)}</td>
                        <td className="p-3 text-right font-bold text-rose-700">+{fmt(c.aumentoRateioAbs)}</td>
                        <td className="p-3 text-right font-bold text-rose-700">+{fmtPct(c.aumentoRateioPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
