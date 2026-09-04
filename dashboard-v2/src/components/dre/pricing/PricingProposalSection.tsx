'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  Layers,
  Sparkles,
  HelpCircle,
  RotateCcw
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
  razaoCustoDiretoMediaPct?: number;
  aliquotaImpostosMediaPct?: number;
  basePeriodoDescricao?: string;
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
  razaoCustoDiretoMediaPct = 60,
  aliquotaImpostosMediaPct = 8.5,
  basePeriodoDescricao = 'Média do Período Selecionado',
  onApplyProposalToDRE
}: PricingProposalSectionProps) {
  // Entradas
  const [faturamentoNovo, setFaturamentoNovo] = useState<number>(150000);
  const [custoDiretoNovo, setCustoDiretoNovo] = useState<number>(() => Math.round(150000 * (razaoCustoDiretoMediaPct / 100)));
  const [margemDesejadaPct, setMargemDesejadaPct] = useState<number>(15);
  const [aliquotaImpostosPct, setAliquotaImpostosPct] = useState<number>(aliquotaImpostosMediaPct);
  const [nomeProposta, setNomeProposta] = useState<string>('Nova Oportunidade / Licitação');
  const [alertaCapacidadePct, setAlertaCapacidadePct] = useState<number>(20);
  const [showDilutionDetails, setShowDilutionDetails] = useState<boolean>(false);
  const [showGatilhoHelp, setShowGatilhoHelp] = useState<boolean>(false);
  const [showMargemHelp, setShowMargemHelp] = useState<boolean>(false);
  const [showMetodoAHelp, setShowMetodoAHelp] = useState<boolean>(false);
  const [showMetodoBHelp, setShowMetodoBHelp] = useState<boolean>(false);
  const [selectedCardDetail, setSelectedCardDetail] = useState<'metodoB' | 'metodoA' | 'custoTotal' | 'fatia' | null>('metodoB');

  // Sincronizar impostos padrão quando mudar filtro do DRE
  useEffect(() => {
    if (aliquotaImpostosMediaPct > 0) {
      setAliquotaImpostosPct(Number(aliquotaImpostosMediaPct.toFixed(1)));
    }
  }, [aliquotaImpostosMediaPct]);

  // Sincronizar Custo Direto automaticamente com a proporção média real dos Custos Operacionais do DRE
  useEffect(() => {
    if (razaoCustoDiretoMediaPct > 0) {
      setCustoDiretoNovo(Math.round(faturamentoNovo * (razaoCustoDiretoMediaPct / 100)));
    }
  }, [razaoCustoDiretoMediaPct]);

  // Função para recalcular Custo Direto pela Média dos Custos Operacionais do DRE
  const aplicarMediaCustoDireto = () => {
    const sugerido = Math.round(faturamentoNovo * (razaoCustoDiretoMediaPct / 100));
    setCustoDiretoNovo(sugerido);
  };

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
          <div className="flex flex-col sm:items-end gap-0.5">
            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
              Base DRE: {fmt(ftOriginal)}/mês
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {basePeriodoDescricao}
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
                onChange={e => {
                  const val = Number(e.target.value);
                  setFaturamentoNovo(val);
                }}
                className="w-full text-xs font-bold pl-9 pr-3 py-2.5 rounded-xl border border-slate-250 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Custo Direto com Projeção pela Média dos Custos Operacionais do DRE */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Custo Direto Estimado (CD)
              </label>
              <button
                type="button"
                onClick={aplicarMediaCustoDireto}
                className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded transition-colors flex items-center gap-1 border border-amber-200/60"
                title={`Aplicar proporção real dos custos operacionais no DRE (${razaoCustoDiretoMediaPct.toFixed(1)}%)`}
              >
                <span>Média DRE:</span>
                <span className="font-extrabold text-amber-900">{razaoCustoDiretoMediaPct.toFixed(1)}%</span>
              </button>
            </div>
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
            <span className="text-[10px] text-slate-400 block mt-1">
              Custos operacionais: {faturamentoNovo > 0 ? fmtPct((custoDiretoNovo / faturamentoNovo) * 100) : '0%'} do faturamento da proposta
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span>Margem Mínima Alvo (%)</span>
                <button
                  type="button"
                  onClick={() => setShowMargemHelp(!showMargemHelp)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  title="O que é a Margem Mínima Alvo?"
                >
                  <HelpCircle size={13} />
                </button>
              </label>
              <span className="text-indigo-600 font-bold text-xs">{margemDesejadaPct}%</span>
            </div>
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
            {showMargemHelp && (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed shadow-xs animate-in fade-in duration-200">
                <strong className="text-slate-800">O que é a Margem Mínima Alvo:</strong> É a rentabilidade líquida pretendida sobre o faturamento do contrato após quitar todos os custos diretos da operação, os tributos da nota e a cota de rateio das despesas administrativas e fixas (DR_p). Se você definir 15%, o simulador busca assegurar que sobram exatamente 15% limpos do contrato no caixa da empresa.
              </div>
            )}
          </div>
        </div>

        {/* Linha de Impostos (Herdado do DRE) e Gatilho de Alerta de Estrutura */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Alíquota de Impostos s/ Receita */}
          <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
            <div>
              <span className="font-bold text-slate-700 block">Impostos s/ Receita Bruta (ISS/PIS/COFINS)</span>
              <span className="text-[11px] text-slate-400">
                Alíquota média apurada no DRE: <strong>{aliquotaImpostosMediaPct.toFixed(1)}%</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="35"
                step="0.5"
                value={aliquotaImpostosPct}
                onChange={e => setAliquotaImpostosPct(Number(e.target.value))}
                className="w-16 text-center text-xs font-bold py-1 px-1.5 rounded-lg border border-slate-250 bg-white"
              />
              <span className="font-bold text-slate-600">%</span>
              <button
                type="button"
                onClick={() => setAliquotaImpostosPct(Number(aliquotaImpostosMediaPct.toFixed(1)))}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline ml-1"
                title="Restaurar média do DRE"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Gatilho de Alerta de Expansão de Estrutura com Explicação Clara */}
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">Alerta de Estrutura Adicional</span>
                <button
                  type="button"
                  onClick={() => setShowGatilhoHelp(!showGatilhoHelp)}
                  className="text-slate-400 hover:text-slate-600"
                  title="O que é este gatilho?"
                >
                  <HelpCircle size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="60"
                  step="5"
                  value={alertaCapacidadePct}
                  onChange={e => setAlertaCapacidadePct(Number(e.target.value))}
                  className="w-16 text-center text-xs font-bold py-1 px-1.5 rounded-lg border border-slate-250 bg-white"
                />
                <span className="font-bold text-slate-600">% da receita</span>
              </div>
            </div>

            {showGatilhoHelp && (
              <p className="text-[11px] text-slate-500 mt-2 bg-white p-2 rounded-lg border border-slate-200 leading-relaxed">
                <strong>Premissa de CFO:</strong> As despesas rateadas (DR_p) são tratadas como fixas no curto prazo. Contudo, se a nova proposta representar mais de <strong>{alertaCapacidadePct}%</strong> do faturamento total da empresa, a estrutura atual não suportará a carga operacional e exigirá novas contratações administrativas/TI/espaço. O sistema alerta para lançar esses custos extras diretamente como <strong>Custo Direto</strong>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Alertas Executivos do Sistema ─────────────────────────────────── */}
      {result.mensagensAlerta.length > 0 && (
        <div className="space-y-2">
          {result.mensagensAlerta.map((msg, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs shadow-xs"
            >
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
              <div className="flex-1 leading-relaxed font-medium">{msg}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cards de Precificação e Rentabilidade Interativos ─────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Resultados de Precificação Marginal
          </span>
          <span className="text-[11px] text-slate-400">
            Clique em qualquer card para ver o detalhamento executivo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Absorção de Rateio */}
          <div
            onClick={() => setSelectedCardDetail(selectedCardDetail === 'fatia' ? null : 'fatia')}
            className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative ${
              selectedCardDetail === 'fatia'
                ? 'border-slate-400 ring-2 ring-slate-400/50 bg-slate-50/40'
                : 'border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Fatia no Faturamento & Rateio
              </span>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {selectedCardDetail === 'fatia' ? 'Ativo' : 'Ver Detalhe'}
              </span>
            </div>
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
          <div
            onClick={() => setSelectedCardDetail(selectedCardDetail === 'custoTotal' ? null : 'custoTotal')}
            className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative ${
              selectedCardDetail === 'custoTotal'
                ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-50/30'
                : 'border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Custo Total (CD + Rateio)
              </span>
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                {selectedCardDetail === 'custoTotal' ? 'Ativo' : 'Ver Detalhe'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-800">{fmt(result.custoTotalNovo)}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">CD: {fmt(custoDiretoNovo)}</span>
              <span className="text-slate-500">+ Rateio: {fmt(result.rateioNovo)}</span>
            </div>
          </div>

          {/* Card 3: Método A (Markup sobre Custo) */}
          <div
            onClick={() => setSelectedCardDetail(selectedCardDetail === 'metodoA' ? null : 'metodoA')}
            className={`bg-emerald-50/50 rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative ${
              selectedCardDetail === 'metodoA'
                ? 'border-emerald-500 ring-2 ring-emerald-500/50 bg-emerald-50/90'
                : 'border-emerald-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Método A — Markup ({margemDesejadaPct}%)
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMetodoAHelp(!showMetodoAHelp);
                  }}
                  className="text-emerald-700/70 hover:text-emerald-900 transition-colors"
                  title="Entenda o Método A"
                >
                  <HelpCircle size={13} />
                </button>
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Sobre Custo
              </span>
            </div>

            {showMetodoAHelp && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="mt-2 mb-2 p-2 bg-white rounded-lg border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed shadow-xs"
              >
                <strong>Método A (Markup Comercial):</strong> Aplica a margem desejada diretamente em cima dos custos totais da proposta (Custo Direto + Rateio). É rápido e tradicional no comércio, porém a margem líquida real que sobra no faturamento final costuma ficar abaixo da meta nominal.
              </div>
            )}

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-700">{fmt(result.precoMinMarkup)}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-emerald-100/80 flex items-center justify-between text-xs text-emerald-800">
              <span>Lucro Projetado:</span>
              <span className="font-bold">{fmt(result.precoMinMarkup - result.custoTotalNovo)}/mês</span>
            </div>
          </div>

          {/* Card 4: Método B (Margem sobre Preço de Venda) */}
          <div
            onClick={() => setSelectedCardDetail(selectedCardDetail === 'metodoB' ? null : 'metodoB')}
            className={`bg-indigo-50/50 rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative ${
              selectedCardDetail === 'metodoB'
                ? 'border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-50/90'
                : 'border-indigo-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
                  Método B — Margem ({margemDesejadaPct}%)
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMetodoBHelp(!showMetodoBHelp);
                  }}
                  className="text-indigo-700/70 hover:text-indigo-900 transition-colors"
                  title="Entenda o Método B"
                >
                  <HelpCircle size={13} />
                </button>
              </div>
              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                Sobre Preço (CFO)
              </span>
            </div>

            {showMetodoBHelp && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="mt-2 mb-2 p-2 bg-white rounded-lg border border-indigo-200 text-[11px] text-indigo-900 leading-relaxed shadow-xs"
              >
                <strong>Método B (Padrão CFO / Licitações):</strong> Calcula o preço dividindo o custo pelo complemento da margem e tributos. Garante rigorosamente que sobrem exatamente os {margemDesejadaPct}% líquidos sobre a nota fiscal total da proposta, evitando prejuízos com impostos.
              </div>
            )}

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-700">{fmt(result.precoMinMargemSobrePreco)}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-indigo-100/80 flex items-center justify-between text-xs text-indigo-800">
              <span>Impostos: {aliquotaImpostosPct}%</span>
              <span className="font-bold">+{fmtPct(result.diferencaPrecoPct)} s/ Markup</span>
            </div>
          </div>
        </div>

        {/* ── Painel de Detalhamento Executivo Clicável ─────────────────────── */}
        {selectedCardDetail && (
          <div className="mt-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Detalhe do Método B */}
            {selectedCardDetail === 'metodoB' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-indigo-900 flex items-center gap-2">
                      <ShieldCheck size={18} className="text-indigo-600" />
                      <span>Detalhamento Executivo: Método B — Margem sobre Preço de Venda (Recomendado por CFOs)</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Memória de cálculo transparente para defender seu preço com segurança em licitações e contratos públicos
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCardDetail(null)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 self-end sm:self-auto"
                  >
                    Fechar
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100">
                  <strong>Entendimento Simples:</strong> Para este contrato pagar todas as suas despesas e garantir exatamente <strong>{margemDesejadaPct},0%</strong> limpos no bolso da empresa, a proposta mensal deve ser de <strong>{fmtDec(result.precoMinMargemSobrePreco)}</strong>. A cada nota emitida, o dinheiro é distribuído assim:
                </p>

                {/* Cascata / Memória de Cálculo */}
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                  <div className="p-3 bg-slate-50 flex items-center justify-between font-black text-slate-800">
                    <span>(+) Preço Sugerido da Proposta (Faturamento Mensal)</span>
                    <span className="text-indigo-700 text-sm font-black">{fmtDec(result.precoMinMargemSobrePreco)} (100,0%)</span>
                  </div>

                  <div className="p-3 flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span>(-) Custos Operacionais Diretos (mão de obra, materiais, operação)</span>
                    </span>
                    <span className="font-bold text-red-600">
                      -{fmtDec(custoDiretoNovo)} ({fmtPct((custoDiretoNovo / result.precoMinMargemSobrePreco) * 100)})
                    </span>
                  </div>

                  <div className="p-3 flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>(-) Despesas Rateadas Estruturais (DR_p - sede, TI, administrativo)</span>
                    </span>
                    <span className="font-bold text-amber-600">
                      -{fmtDec(result.rateioNovo)} ({fmtPct((result.rateioNovo / result.precoMinMargemSobrePreco) * 100)})
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/60 flex items-center justify-between font-bold text-slate-700">
                    <span>(=) Custo Total Mensal do Contrato (Direto + Rateio)</span>
                    <span>{fmtDec(result.custoTotalNovo)} ({fmtPct((result.custoTotalNovo / result.precoMinMargemSobrePreco) * 100)})</span>
                  </div>

                  <div className="p-3 flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      <span>(-) Impostos sobre a Nota Fiscal ({aliquotaImpostosPct}%)</span>
                    </span>
                    <span className="font-bold text-orange-600">
                      -{fmtDec(result.precoMinMargemSobrePreco * (aliquotaImpostosPct / 100))} ({fmtPct(aliquotaImpostosPct)})
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50 flex items-center justify-between font-black text-emerald-900 text-sm">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>(=) Lucro Líquido Operacional (Sobra Real no Caixa da Empresa)</span>
                    </span>
                    <span className="text-emerald-700 font-black">
                      {fmtDec(result.precoMinMargemSobrePreco - result.custoTotalNovo - (result.precoMinMargemSobrePreco * (aliquotaImpostosPct / 100)))} ({fmtPct(margemDesejadaPct)} na meta!)
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500">
                  <span>
                    💡 <strong>Dica Estratégica:</strong> O Método B protege você contra a mordida dos impostos sobre o lucro e garante <strong>+{fmt(result.precoMinMargemSobrePreco - result.precoMinMarkup)}/mês</strong> a mais que o Método A.
                  </span>
                </div>
              </div>
            )}

            {/* Detalhe do Método A */}
            {selectedCardDetail === 'metodoA' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-emerald-900 flex items-center gap-2">
                      <Calculator size={18} className="text-emerald-600" />
                      <span>Detalhamento Executivo: Método A — Markup sobre Custos (Abordagem Comercial)</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Memória de cálculo da precificação tradicional com margem aplicada sobre os custos
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCardDetail(null)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 self-end sm:self-auto"
                  >
                    Fechar
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">
                  <strong>Entendimento Simples:</strong> Este método pega o custo total acumulado de <strong>{fmt(result.custoTotalNovo)}</strong> e joga {margemDesejadaPct}% em cima dele, embutindo os impostos. O preço sugerido fica em <strong>{fmtDec(result.precoMinMarkup)}</strong>. Veja o resultado na prática:
                </p>

                {/* Cascata / Memória de Cálculo do Método A */}
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                  <div className="p-3 bg-slate-50 flex items-center justify-between font-black text-slate-800">
                    <span>(+) Preço Sugerido da Proposta (Faturamento Mensal)</span>
                    <span className="text-emerald-700 text-sm font-black">{fmtDec(result.precoMinMarkup)} (100,0%)</span>
                  </div>

                  <div className="p-3 flex items-center justify-between text-slate-600">
                    <span>(-) Custos Operacionais Diretos</span>
                    <span className="font-bold text-red-600">-{fmtDec(custoDiretoNovo)}</span>
                  </div>

                  <div className="p-3 flex items-center justify-between text-slate-600">
                    <span>(-) Despesas Rateadas Estruturais (DR_p)</span>
                    <span className="font-bold text-amber-600">-{fmtDec(result.rateioNovo)}</span>
                  </div>

                  <div className="p-3 flex items-center justify-between text-slate-600">
                    <span>(-) Impostos s/ Nota Fiscal ({aliquotaImpostosPct}%)</span>
                    <span className="font-bold text-orange-600">-{fmtDec(result.precoMinMarkup * (aliquotaImpostosPct / 100))}</span>
                  </div>

                  <div className="p-3 bg-amber-50 flex items-center justify-between font-black text-amber-900 text-sm">
                    <span>(=) Sobra Líquida Real do Contrato</span>
                    <span className="text-amber-800 font-black">
                      {fmtDec(result.precoMinMarkup - result.custoTotalNovo - (result.precoMinMarkup * (aliquotaImpostosPct / 100)))} ({fmtPct(((result.precoMinMarkup - result.custoTotalNovo - (result.precoMinMarkup * (aliquotaImpostosPct / 100))) / result.precoMinMarkup) * 100)} do faturamento)
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 leading-relaxed">
                  ⚠️ <strong>Atenção Executiva:</strong> Note que a margem real no Método A ({fmtPct(((result.precoMinMarkup - result.custoTotalNovo - (result.precoMinMarkup * (aliquotaImpostosPct / 100))) / result.precoMinMarkup) * 100)}) ficou <strong>abaixo da meta de {margemDesejadaPct}%</strong>. Isso acontece porque a margem foi calculada sobre o custo, mas os impostos incidem sobre a nota fiscal inteira.
                </p>
              </div>
            )}

            {/* Detalhe do Custo Total */}
            {selectedCardDetail === 'custoTotal' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <DollarSign size={18} className="text-amber-600" />
                      <span>Detalhamento Executivo: Composição do Custo Total da Proposta</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Divisão clara entre os custos diretos da operação e a taxa de manutenção da sede
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCardDetail(null)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 self-end sm:self-auto"
                  >
                    Fechar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-700 block mb-1">Custo Direto Operacional (CD)</span>
                    <span className="text-xl font-black text-slate-900 block">{fmt(custoDiretoNovo)}</span>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                      Representa <strong>{fmtPct((custoDiretoNovo / result.custoTotalNovo) * 100)}</strong> do custo total. É o dinheiro gasto exclusivamente no cliente (técnicos, supervisores, deslocamento, insumos).
                    </p>
                  </div>

                  <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <span className="font-bold text-indigo-900 block mb-1">Despesas Rateadas da Sede (DR_p)</span>
                    <span className="text-xl font-black text-indigo-800 block">{fmt(result.rateioNovo)}</span>
                    <p className="text-[11px] text-indigo-700 mt-1.5 leading-relaxed">
                      Representa <strong>{fmtPct((result.rateioNovo / result.custoTotalNovo) * 100)}</strong> do custo total. É a contribuição deste contrato para bancar a retaguarda da empresa (escritório, contabilidade, jurídico, TI).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Detalhe da Fatia no Faturamento & Rateio */}
            {selectedCardDetail === 'fatia' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <Percent size={18} className="text-emerald-600" />
                      <span>Detalhamento Executivo: Fatia no Faturamento e Alívio da Estrutura</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Como este contrato reduz o peso das despesas fixas para todos os outros projetos da empresa
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCardDetail(null)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 self-end sm:self-auto"
                  >
                    Fechar
                  </button>
                </div>

                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                  Ao conquistar esta proposta de <strong>{fmt(faturamentoNovo)}/mês</strong>, ela passará a representar <strong>{fmtPct(result.partNovoPct)}</strong> de todo o faturamento da empresa. Com isso, ela absorve <strong>{fmt(result.rateioNovo)}/mês</strong> de despesas fixas, reduzindo o rateio de todos os contratos antigos em <strong>{fmtPct((1 - result.fatorDiluicaoContratos) * 100)}</strong>!
                </div>
              </div>
            )}
          </div>
        )}
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
