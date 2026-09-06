"use client";

import React, { useState, useMemo } from 'react';
import {
  X,
  ShoppingBag,
  CreditCard,
  Building2,
  Layers,
  Sparkles,
  Download,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingDown,
  Filter,
  CheckSquare,
  Square,
  AlertCircle,
  HelpCircle,
  Briefcase,
  UserCheck
} from 'lucide-react';
import { DreCaixaLancamento, PurchasesAuditSummary } from '@/types/dre-caixa';
import { DreCaixaService, formatCurrencyBRL } from '@/services/dre-caixa.service';

interface DreCaixaPurchasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lancamentos: DreCaixaLancamento[];
  periodoLabel?: string;
  empresaLabel?: string;
  onOpenGamma: () => void;
}

export function DreCaixaPurchasesModal({
  isOpen,
  onClose,
  lancamentos,
  periodoLabel = 'Período Atual',
  empresaLabel = 'Consolidado',
  onOpenGamma
}: DreCaixaPurchasesModalProps) {
  // Hooks sempre no topo incondicionalmente
  const [activeTab, setActiveTab] = useState<'sumario' | 'cartoes' | 'parcelas' | 'fornecedores'>('sumario');
  const [onlyCompras, setOnlyCompras] = useState(true);
  const [selectedConta, setSelectedConta] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Computação determinística da Auditoria de Compras
  const audit: PurchasesAuditSummary = useMemo(() => {
    if (!isOpen || !lancamentos || lancamentos.length === 0) {
      return DreCaixaService.computePurchasesAudit([], selectedConta, onlyCompras);
    }
    return DreCaixaService.computePurchasesAudit(lancamentos, selectedConta || undefined, onlyCompras);
  }, [isOpen, lancamentos, selectedConta, onlyCompras]);

  // Lista de cartões filtráveis
  const cartoesList = useMemo(() => {
    return audit.porCartao.filter(c => c.isCartao || c.isFlash);
  }, [audit.porCartao]);

  // Outras contas bancárias
  const outrasContasList = useMemo(() => {
    return audit.porCartao.filter(c => !c.isCartao && !c.isFlash);
  }, [audit.porCartao]);

  // Filtragem de fornecedores
  const filteredFornecedores = useMemo(() => {
    if (!searchQuery.trim()) return audit.topFornecedoresCompras;
    const q = searchQuery.toLowerCase();
    return audit.topFornecedoresCompras.filter(f => f.fornecedor.toLowerCase().includes(q));
  }, [audit.topFornecedoresCompras, searchQuery]);

  // Handler de exportação CSV
  const handleExportCsv = () => {
    const headers = ['Empresa', 'Data', 'Favorecido', 'Categoria', 'Setor/Projeto', 'Conta/Cartão', 'Parcela', 'Modalidade', 'Tipo Econômico', 'Valor (R$)'];
    const rows = lancamentos
      .filter(l => l.sinal_valor < 0 || l.tipo === 'PAGAR')
      .map(item => {
        const pAtual = item.parcela_atual || 1;
        const pTotal = item.total_parcelas || 1;
        let mod = 'À vista';
        if (pAtual === 1 && pTotal > 1) mod = 'Nova Compra Parcelada (1ª Parcela)';
        else if (pAtual > 1) mod = `Amortização de Compra Passada (${pAtual}/${pTotal})`;

        return [
          `"${item.empresa}"`,
          `"${item.data_pagamento}"`,
          `"${(item.fornecedor_cliente || '').replace(/"/g, '""')}"`,
          `"${(item.categoria || '').replace(/"/g, '""')}"`,
          `"${(item.projeto || '').replace(/"/g, '""')}"`,
          `"${(item.conta_corrente || '').replace(/"/g, '""')}"`,
          `"${item.numero_parcela || '1/1'}"`,
          `"${mod}"`,
          `"${item.tipo_pagamento}"`,
          item.valor.toFixed(2).replace('.', ',')
        ];
      });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `auditoria_compras_${empresaLabel.toLowerCase().replace(/\s+/g, '_')}_${periodoLabel.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER MODAL */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <ShoppingBag size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Auditoria Executiva de Compras & Desembolsos
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  C-Level Board
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{empresaLabel}</span>
                <span>•</span>
                <span className="font-semibold text-slate-700">{periodoLabel}</span>
                <span>•</span>
                <span>Dados reais sincronizados do Omie ERP</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenGamma}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
              title="Gerar apresentação executiva pronta no Gamma"
            >
              <Sparkles size={15} />
              <span>Gerar no Gamma</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all"
              title="Exportar dados para CSV"
            >
              <Download size={18} />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* SUBHEADER: TOGGLE DE DESPESAS RECORRENTES & TABS */}
        <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Navegação por Abas */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('sumario')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'sumario'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📊 Sumário Executivo
            </button>
            <button
              onClick={() => setActiveTab('cartoes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'cartoes'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              💳 Cartões & Flash
            </button>
            <button
              onClick={() => setActiveTab('parcelas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'parcelas'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ⏳ Estrutura de Parcelas
            </button>
            <button
              onClick={() => setActiveTab('fornecedores')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'fornecedores'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🏢 Top Fornecedores & Itens
            </button>
          </div>

          {/* Toggle Excluir Despesas Recorrentes */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyCompras(!onlyCompras)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                onlyCompras
                  ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {onlyCompras ? <CheckSquare size={16} className="text-amber-600" /> : <Square size={16} className="text-slate-400" />}
              <span>Excluir Despesas Recorrentes (Focar em Compras)</span>
            </button>
          </div>
        </div>

        {/* CORPO DO MODAL (SCROLL) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* KPI CARDS DE TOP EXECUÇÃO */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Total de Compras Efetivas */}
            <div className="bg-white border border-indigo-100 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">
                Total em Compras
              </span>
              <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                {formatCurrencyBRL(audit.totalCompras)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {audit.percentualCompras.toFixed(1)}% das saídas do mês
              </p>
            </div>

            {/* 2. Despesas Recorrentes (Folha/Aluguel/Impostos) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Despesas Recorrentes
              </span>
              <div className="text-lg sm:text-xl font-black text-slate-700 mt-1">
                {formatCurrencyBRL(audit.totalRecorrente)}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Folha, aluguéis e tributos
              </p>
            </div>

            {/* 3. À Vista (1/1) */}
            <div className="bg-white border border-emerald-100 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                ⚡ Compras À Vista (1/1)
              </span>
              <div className="text-lg sm:text-xl font-black text-emerald-700 mt-1">
                {formatCurrencyBRL(audit.totalAVista)}
              </div>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                Pagamentos integrais
              </p>
            </div>

            {/* 4. Novas Parceladas (1/N) */}
            <div className="bg-white border border-blue-100 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block">
                💳 Novas Compras (1/N)
              </span>
              <div className="text-lg sm:text-xl font-black text-blue-700 mt-1">
                {formatCurrencyBRL(audit.totalNovasParceladas)}
              </div>
              <p className="text-[11px] text-blue-600 mt-0.5">
                1ª parcela paga no mês
              </p>
            </div>

            {/* 5. Amortização de Compras Passadas (> 1/N) */}
            <div className="bg-white border border-purple-100 rounded-2xl p-3.5 shadow-sm col-span-2 sm:col-span-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 block">
                ⏳ Amortização Passada
              </span>
              <div className="text-lg sm:text-xl font-black text-purple-700 mt-1">
                {formatCurrencyBRL(audit.totalAmortizacaoAnterior)}
              </div>
              <p className="text-[11px] text-purple-600 mt-0.5">
                Parcelas {'>'} 1/N quitadas
              </p>
            </div>
          </div>

          {/* ABA 1: SUMÁRIO EXECUTIVO */}
          {activeTab === 'sumario' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Distribuição por Empresa */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Total Comprado por Cada Empresa
                    </h3>
                    <p className="text-xs text-slate-500">
                      Consolidação e segregação de desembolsos por unidade de negócio
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="pb-2.5">Empresa</th>
                        <th className="pb-2.5 text-right">Total Compras</th>
                        <th className="pb-2.5 text-right">Desp. Recorrentes</th>
                        <th className="pb-2.5 text-right">À Vista (1/1)</th>
                        <th className="pb-2.5 text-right">Novas Parc (1/N)</th>
                        <th className="pb-2.5 text-right">Amort. Passada</th>
                        <th className="pb-2.5 text-center">Lançamentos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {audit.porEmpresa.map(emp => (
                        <tr key={emp.empresa} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            {emp.empresa}
                          </td>
                          <td className="py-2.5 text-right font-black text-indigo-950">
                            {formatCurrencyBRL(emp.totalCompras)}
                          </td>
                          <td className="py-2.5 text-right font-medium text-slate-500">
                            {formatCurrencyBRL(emp.totalRecorrente)}
                          </td>
                          <td className="py-2.5 text-right font-semibold text-emerald-700">
                            {formatCurrencyBRL(emp.aVista)}
                          </td>
                          <td className="py-2.5 text-right font-semibold text-blue-700">
                            {formatCurrencyBRL(emp.parcelado)}
                          </td>
                          <td className="py-2.5 text-right font-semibold text-purple-700">
                            {formatCurrencyBRL(emp.amortizacaoPassada)}
                          </td>
                          <td className="py-2.5 text-center text-slate-400">
                            {emp.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Destaques CFO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/70 border border-indigo-100 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 mb-2">
                    <Briefcase size={15} className="text-indigo-600" />
                    Diagnóstico de Liquidez & Caixa do Mês
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Das compras totais realizadas no período,{' '}
                    <strong className="text-slate-900">{formatCurrencyBRL(audit.totalAVista)}</strong> foram
                    liquidadas à vista no momento da contratação. Além disso, o caixa do mês arcou com{' '}
                    <strong className="text-slate-900">{formatCurrencyBRL(audit.totalAmortizacaoAnterior)}</strong> em
                    quitação de parcelas de compras passadas.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50/70 to-pink-50/70 border border-purple-100 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-purple-900 flex items-center gap-1.5 mb-2">
                    <Clock size={15} className="text-purple-600" />
                    Comprometimento Financeiro Futuro
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    As novas compras parceladas contratadas no mês geraram um desembolso inicial de{' '}
                    <strong className="text-slate-900">{formatCurrencyBRL(audit.totalNovasParceladas)}</strong>, com um
                    passivo remanescente estimado de{' '}
                    <strong className="text-slate-900">{formatCurrencyBRL(audit.totalComprometimentoFuturo)}</strong> a
                    vencer nos meses subsequentes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: MEIOS DE PAGAMENTO & CARTÕES */}
          {activeTab === 'cartoes' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Resumo dos Cartões Corporativos */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <CreditCard size={17} className="text-indigo-600" />
                      Total Comprado por Cartão Corporativo & Flash
                    </h3>
                    <p className="text-xs text-slate-500">
                      Clique em qualquer cartão abaixo para abrir o Raio-X por Projeto, Categoria e Fornecedor
                    </p>
                  </div>
                  {selectedConta && (
                    <button
                      onClick={() => setSelectedConta('')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Limpar foco da conta
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cartoesList.map(cartao => {
                    const isSelected = selectedConta.toLowerCase() === cartao.conta.toLowerCase();
                    return (
                      <button
                        key={cartao.conta}
                        onClick={() => setSelectedConta(isSelected ? '' : cartao.conta)}
                        className={`text-left p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-400 shadow-sm ring-2 ring-indigo-200'
                            : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-extrabold text-slate-800 truncate" title={cartao.conta}>
                            {cartao.conta}
                          </span>
                          {cartao.isFlash ? (
                            <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-amber-100 text-amber-800">
                              Flash
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-slate-100 text-slate-600">
                              Cartão
                            </span>
                          )}
                        </div>
                        <div className="text-base font-black text-slate-900">
                          {formatCurrencyBRL(cartao.total)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-between">
                          <span>{cartao.count} transações</span>
                          <span className="text-indigo-600 font-bold flex items-center gap-0.5">
                            {isSelected ? 'Em foco' : 'Ver raio-x'} →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DETALHAMENTO DO CARTÃO FLASH POR PROJETO */}
              <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm bg-gradient-to-b from-amber-50/20 to-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      Utilização do Cartão Flash por Projeto (Contratos Omie)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Mapeamento das despesas pagas via Flash por Setor/Projeto de aplicação
                    </p>
                  </div>
                  <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg">
                    {audit.flashPorProjeto.length} Projetos Ativos
                  </span>
                </div>

                {audit.flashPorProjeto.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-6">
                    Nenhuma despesa do cartão Flash encontrada no período filtrado.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {audit.flashPorProjeto.map(item => (
                      <div key={item.projeto} className="bg-white border border-slate-100 rounded-xl p-3">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-slate-800 truncate" title={item.projeto}>
                            {item.projeto}
                          </span>
                          <span className="font-black text-slate-900">
                            {formatCurrencyBRL(item.total)} ({item.percentual.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, item.percentual)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RAIO-X TRIDIMENSIONAL DA CONTA SELECIONADA */}
              {audit.detalheContaSelecionada && (
                <div className="bg-white border border-indigo-200 rounded-2xl p-5 shadow-md animate-fadeIn">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-indigo-950 flex items-center gap-2">
                        🔍 Raio-X Detalhado: {audit.detalheContaSelecionada.conta}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Total movimentado: {formatCurrencyBRL(audit.detalheContaSelecionada.total)} em {audit.detalheContaSelecionada.count} lançamentos
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Projetos da Conta */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                        Por Projeto / Setor
                      </h4>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {audit.detalheContaSelecionada.projetos.map(p => (
                          <div key={p.projeto} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/50">
                            <span className="truncate text-slate-700 pr-2" title={p.projeto}>{p.projeto}</span>
                            <span className="font-bold text-slate-900 whitespace-nowrap">{formatCurrencyBRL(p.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Categorias da Conta */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                        Por Categoria
                      </h4>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {audit.detalheContaSelecionada.categorias.map(c => (
                          <div key={c.categoria} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/50">
                            <span className="truncate text-slate-700 pr-2" title={c.categoria}>{c.categoria}</span>
                            <span className="font-bold text-slate-900 whitespace-nowrap">{formatCurrencyBRL(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Fornecedores da Conta */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                        Por Fornecedor / Estabelecimento
                      </h4>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {audit.detalheContaSelecionada.fornecedores.map(f => (
                          <div key={f.fornecedor} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/50">
                            <span className="truncate text-slate-700 pr-2" title={f.fornecedor}>{f.fornecedor}</span>
                            <span className="font-bold text-slate-900 whitespace-nowrap">{formatCurrencyBRL(f.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA 3: ESTRUTURA DE PARCELAS */}
          {activeTab === 'parcelas' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Amortização de Compras Passadas (> 1/N) */}
              <div className="bg-white border border-purple-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-purple-950 flex items-center gap-2">
                      <Clock size={16} className="text-purple-600" />
                      Total Pago de Parcelas Compradas Anteriormente ({'>'} 1/N)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Compras realizadas no passado cujas parcelas venceram e foram quitadas neste mês ({formatCurrencyBRL(audit.totalAmortizacaoAnterior)})
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="pb-2">Fornecedor</th>
                        <th className="pb-2">Empresa</th>
                        <th className="pb-2">Categoria</th>
                        <th className="pb-2 text-center">Parcela</th>
                        <th className="pb-2 text-right">Valor Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lancamentos
                        .filter(l => (l.sinal_valor < 0 || l.tipo === 'PAGAR') && (l.parcela_atual || 1) > 1)
                        .slice(0, 30)
                        .map((item, idx) => (
                          <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50">
                            <td className="py-2 font-bold text-slate-800">{item.fornecedor_cliente}</td>
                            <td className="py-2 text-slate-500">{item.empresa}</td>
                            <td className="py-2 text-slate-600">{item.categoria}</td>
                            <td className="py-2 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                                💳 {item.numero_parcela || `${item.parcela_atual}/${item.total_parcelas}`}
                              </span>
                            </td>
                            <td className="py-2 text-right font-black text-slate-900">
                              {formatCurrencyBRL(item.valor)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Compras à Vista (1/1) */}
              <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Fornecedores com Pagamento À Vista (Parcela 1/1)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Compras à vista efetuadas e liquidadas no mês corrente ({formatCurrencyBRL(audit.totalAVista)})
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="pb-2">Fornecedor</th>
                        <th className="pb-2">Empresa</th>
                        <th className="pb-2">Categoria</th>
                        <th className="pb-2">Projeto</th>
                        <th className="pb-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lancamentos
                        .filter(l => (l.sinal_valor < 0 || l.tipo === 'PAGAR') && ((l.parcela_atual || 1) === 1 && (l.total_parcelas || 1) === 1))
                        .slice(0, 30)
                        .map((item, idx) => (
                          <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50">
                            <td className="py-2 font-bold text-slate-800">{item.fornecedor_cliente}</td>
                            <td className="py-2 text-slate-500">{item.empresa}</td>
                            <td className="py-2 text-slate-600">{item.categoria}</td>
                            <td className="py-2 text-slate-500">{item.projeto}</td>
                            <td className="py-2 text-right font-black text-emerald-700">
                              {formatCurrencyBRL(item.valor)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: TOP FORNECEDORES & CATEGORIAS */}
          {activeTab === 'fornecedores' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Categorias de Compras */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900 mb-3">
                  Total Comprado por Categoria
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {audit.porCategoriaCompras.slice(0, 15).map(cat => (
                    <div key={cat.categoria} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-700 truncate" title={cat.categoria}>
                          {cat.categoria}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {cat.percentual.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-sm font-black text-slate-900">
                        {formatCurrencyBRL(cat.total)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Principais Fornecedores */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Principais Fornecedores do Período
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ranking dos maiores credores com modalidade e parcelas
                    </p>
                  </div>

                  <div className="relative w-56">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar fornecedor..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="pb-2">Fornecedor</th>
                        <th className="pb-2 text-center">Modalidade</th>
                        <th className="pb-2 text-center">Exemplo Parcela</th>
                        <th className="pb-2 text-right">Total Pago</th>
                        <th className="pb-2 text-right">% Compras</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredFornecedores.map(f => (
                        <tr key={f.fornecedor} className="hover:bg-slate-50">
                          <td className="py-2.5 font-bold text-slate-800">{f.fornecedor}</td>
                          <td className="py-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {f.modalidade}
                            </span>
                          </td>
                          <td className="py-2.5 text-center text-slate-500 font-mono text-[11px]">
                            {f.parcelasExemplo}
                          </td>
                          <td className="py-2.5 text-right font-black text-slate-900">
                            {formatCurrencyBRL(f.total)}
                          </td>
                          <td className="py-2.5 text-right font-semibold text-indigo-700">
                            {f.percentual.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER MODAL */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <HelpCircle size={14} className="text-slate-400" />
            <span>Valores calculados em regime de caixa efetivo conforme liquidação bancária.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenGamma}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
            >
              <Sparkles size={16} />
              <span>Gerar Apresentação no Gamma (Diretoria)</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
