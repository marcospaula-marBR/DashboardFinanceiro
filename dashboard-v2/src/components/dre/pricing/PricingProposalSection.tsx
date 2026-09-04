'use client';

import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Percent,
  TrendingUp,
  AlertTriangle,
  Info,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  Layers
} from 'lucide-react';
import {
  ProposalPricingParams,
  ProposalPricingResult
} from '@/types/pricing-simulator.types';
import { PricingSimulatorEngine, BaseContractData } from '@/services/pricing-simulator.engine';

interface PricingProposalSectionProps {
  ftOriginal: number;
  drOriginal: number;
  contratosAtivos: BaseContractData[];
  onApplyProposalToDRE?: (result: ProposalPricingResult) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

const fmtDec = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;

export function PricingProposalSection({
  ftOriginal,
  drOriginal,
  contratosAtivos,
  onApplyProposalToDRE
}: PricingProposalSectionProps) {
  // Entradas
  const [faturamentoNovo, setFaturamentoNovo] = useState<number>(150000);
  const [custoDiretoNovo, setCustoDiretoNovo] = useState<number>(90000);
  const [margemDesejadaPct, setMargemDesejadaPct] = useState<number>(15);
  const [aliquotaImpostosPct, setAliquotaImpostosPct] = useState<number>(0);
  const [nomeProposta, setNomeProposta] = useState<string>('Nova Oportunidade / Licitação');
  const [alertaCapacidadePct, setAlertaCapacidadePct] = useState<number>(20);
  const [showDilutionDetails, setShowDilutionDetails] = useState<boolean>(false);

  // Execução do cálculo marginal
  const result: ProposalPricingResult = useMemo(() => {
    return PricingSimulatorEngine.calculateProposalPricing(
      {
        faturamentoNovo,
        custoDiretoNovo,
        margemDesejadaPct,
        aliquotaImpostosPct,
        alertaCapacidadePct,
        nomeProposta
      },
      ftOriginal,
      drOriginal,
      contratosAtivos
    );
  }, [
    faturamentoNovo,
    custoDiretoNovo,
    margemDesejadaPct,
    aliquotaImpostosPct,
    alertaCapacidadePct,
    nomeProposta,
    ftOriginal,
    drOriginal,
    contratosAtivos
  ]);

  return (
    <div className="space-y-6">
      {/* ── Painel de Parâmetros da Proposta ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6 transition-all hover:shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
              <Calculator size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                Precificação de Nova Proposta & Licitação
              </h2>
              <p className="text-xs text-slate-500">
                Abordagem marginal de CFO: absorção proporcional de despesas rateadas e diluição da base
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              Base DRE: {fmt(ftOriginal)}/mês
            </span>
          </div>
        </div>

        {/* Inputs em Grid Responsivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Identificação / Licitação
            </label>
            <input
              type="text"
              value={nomeProposta}
              onChange={e => setNomeProposta(e.target.value)}
              placeholder="Ex: Licitação Marinha 2026"
              className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-250 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
              <span>Faturamento Estimado (F_novo)</span>
              <span className="text-emerald-600 font-bold">{fmt(faturamentoNovo)}</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">R$</span>
              <input
                type="number"
                min="0"
                step="5000"
                value={faturamentoNovo || ''}
                onChange={e => setFaturamentoNovo(Number(e.target.value))}
                className="w-full text-xs font-bold pl-9 pr-3 py-2.5 rounded-xl border border-slate-250 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
              <span>Custo Direto Estimado (CD)</span>
              <span className="text-amber-600 font-bold">{fmt(custoDiretoNovo)}</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">R$</span>
              <input
                type="number"
                min="0"
                step="5000"
                value={custoDiretoNovo || ''}
                onChange={e => setCustoDiretoNovo(Number(e.target.value))}
                className="w-full text-xs font-bold pl-9 pr-3 py-2.5 rounded-xl border border-slate-250 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
              <span>Margem Mínima Alvo (%)</span>
              <span className="text-indigo-600 font-bold">{margemDesejadaPct}%</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={margemDesejadaPct}
                onChange={e => setMargemDesejadaPct(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <span className="w-12 text-center text-xs font-bold px-2 py-1 bg-slate-100 rounded-lg text-slate-700">
                {margemDesejadaPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Linha Opcional de Tributos e Capacidade */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">Impostos s/ Receita (ISS/PIS/COFINS):</span>
            <input
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={aliquotaImpostosPct}
              onChange={e => setAliquotaImpostosPct(Number(e.target.value))}
              className="w-16 text-center text-xs font-bold py-1 px-1.5 rounded-lg border border-slate-250 bg-white"
            />
            <span className="font-bold">%</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">Gatilho Alerta de Estrutura:</span>
            <input
              type="number"
              min="5"
              max="60"
              step="5"
              value={alertaCapacidadePct}
              onChange={e => setAlertaCapacidadePct(Number(e.target.value))}
              className="w-16 text-center text-xs font-bold py-1 px-1.5 rounded-lg border border-slate-250 bg-white"
            />
            <span className="font-bold">% do faturamento</span>
          </div>
        </div>
      </div>

      {/* ── Alertas Executivos do Sistema ─────────────────────────────────── */}
      {result.mensagensAlerta.length > 0 && (
        <div className="space-y-2">
          {result.mensagensAlerta.map((msg, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs"
            >
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
              <div className="flex-1 leading-relaxed font-medium">{msg}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cards de Precificação e Rentabilidade ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Absorção de Rateio */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Fatia no Faturamento & Rateio
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-800">{fmtPct(result.partNovoPct)}</span>
            <span className="text-xs text-slate-500">da nova base</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Rateio Absorvido:</span>
            <span className="font-bold text-slate-800">{fmt(result.rateioNovo)}/mês</span>
          </div>
        </div>

        {/* Card 2: Custo Total da Proposta */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Custo Total (CD + Rateio)
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-800">{fmt(result.custoTotalNovo)}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">CD: {fmt(custoDiretoNovo)}</span>
            <span className="text-slate-500">+ Rateio: {fmt(result.rateioNovo)}</span>
          </div>
        </div>

        {/* Card 3: Método A (Markup sobre Custo) */}
        <div className="bg-emerald-50/50 rounded-2xl border border-emerald-200/80 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Método A — Markup ({margemDesejadaPct}%)
            </span>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              Sobre Custo
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-700">{fmt(result.precoMinMarkup)}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-100/80 flex items-center justify-between text-xs text-emerald-800">
            <span>Lucro Projetado:</span>
            <span className="font-bold">{fmt(result.precoMinMarkup - result.custoTotalNovo)}/mês</span>
          </div>
        </div>

        {/* Card 4: Método B (Margem sobre Preço de Venda) */}
        <div className="bg-indigo-50/50 rounded-2xl border border-indigo-200/80 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
              Método B — Margem ({margemDesejadaPct}%)
            </span>
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
              Sobre Preço (CFO)
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-indigo-700">{fmt(result.precoMinMargemSobrePreco)}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-indigo-100/80 flex items-center justify-between text-xs text-indigo-800">
            <span>Diferença s/ Markup:</span>
            <span className="font-bold">+{fmtPct(result.diferencaPrecoPct)}</span>
          </div>
        </div>
      </div>

      {/* ── O Efeito Diluição de Rateio (Insight Valioso) ──────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-black text-slate-800 tracking-tight">
                Efeito Diluição no Rateio dos Contratos Existentes
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ao fechar esta proposta, a base de faturamento cresce para {fmt(result.ftNovo)}/mês e todos os contratos reduzem sua cota de rateio em{' '}
              <strong className="text-emerald-700 font-bold">
                {fmtPct((1 - result.fatorDiluicaoContratos) * 100)}
              </strong>.
            </p>
          </div>

          <button
            onClick={() => setShowDilutionDetails(!showDilutionDetails)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-all self-start sm:self-auto"
          >
            <Layers size={14} />
            <span>{showDilutionDetails ? 'Recolher Contratos' : 'Ver Contrato a Contrato'}</span>
            <ChevronDown size={14} className={`transition-transform ${showDilutionDetails ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Tabela detalhada de contratos se expandido */}
        {showDilutionDetails && (
          <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-72 scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3">Contrato / Projeto</th>
                    <th className="p-3 text-right">Faturamento</th>
                    <th className="p-3 text-right">Part. Atual</th>
                    <th className="p-3 text-right">Nova Part.</th>
                    <th className="p-3 text-right">Rateio Atual</th>
                    <th className="p-3 text-right">Novo Rateio</th>
                    <th className="p-3 text-right text-emerald-700">Economia / Mês</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {result.contratosDiluidos.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-semibold text-slate-800">{c.nome}</td>
                      <td className="p-3 text-right">{fmt(c.faturamentoOriginal)}</td>
                      <td className="p-3 text-right">{fmtPct(c.partOriginalPct)}</td>
                      <td className="p-3 text-right font-medium text-emerald-700">{fmtPct(c.partNovaPct)}</td>
                      <td className="p-3 text-right">{fmt(c.rateioOriginal)}</td>
                      <td className="p-3 text-right font-medium text-emerald-700">{fmt(c.rateioNovo)}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">-{fmt(c.economiaRateio)}</td>
                    </tr>
                  ))}
                  {result.contratosDiluidos.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        Nenhum contrato ativo segregado no DRE para a empresa selecionada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
