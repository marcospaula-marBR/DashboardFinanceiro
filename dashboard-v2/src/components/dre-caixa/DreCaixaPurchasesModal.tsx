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
  ChevronDown,
  Tag,
  Check
} from 'lucide-react';
import { DreCaixaLancamento, PurchasesAuditSummary } from '@/types/dre-caixa';
import { DreCaixaService, formatCurrencyBRL, isDespesaRecorrente, decodeHtmlEntities } from '@/services/dre-caixa.service';

interface DreCaixaPurchasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lancamentos: DreCaixaLancamento[];
  periodoLabel?: string;
  empresaLabel?: string;
  onOpenGamma: (filteredItems?: DreCaixaLancamento[], activeConta?: string, onlyCompras?: boolean) => void;
}

export function DreCaixaPurchasesModal({
  isOpen,
  onClose,
  lancamentos,
  periodoLabel = 'Período Atual',
  empresaLabel = 'Consolidado',
  onOpenGamma
}: DreCaixaPurchasesModalProps) {
  // 1. Estados sempre no topo incondicionalmente
  const [activeTab, setActiveTab] = useState<'sumario' | 'cartoes' | 'parcelas' | 'fornecedores'>('sumario');
  const [onlyCompras, setOnlyCompras] = useState(true);
  const [selectedConta, setSelectedConta] = useState<string>('');
  const [cardSubTab, setCardSubTab] = useState<'projetos' | 'categorias' | 'fornecedores'>('projetos');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtro de Categorias dentro do Modal
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Extração de todas as categorias disponíveis nos pagamentos
  const categoryOptions = useMemo(() => {
    if (!isOpen || !lancamentos) return [];
    const map = new Map<string, { total: number; count: number }>();
    lancamentos
      .filter(l => l.sinal_valor < 0 || l.tipo === 'PAGAR')
      .forEach(l => {
        const cat = (l.categoria || 'Geral').trim();
        const curr = map.get(cat) || { total: 0, count: 0 };
        map.set(cat, {
          total: curr.total + Math.abs(l.valor),
          count: curr.count + 1
        });
      });

    return Array.from(map.entries())
      .map(([nome, data]) => ({
        nome,
        total: data.total,
        count: data.count,
        isRecorrente: isDespesaRecorrente(nome)
      }))
      .sort((a, b) => b.total - a.total);
  }, [isOpen, lancamentos]);

  // Lançamentos filtrados pelas categorias ativas
  const activeLancamentos = useMemo(() => {
    if (excludedCategories.size === 0) return lancamentos;
    return lancamentos.filter(l => !excludedCategories.has((l.categoria || 'Geral').trim()));
  }, [lancamentos, excludedCategories]);

  // Lançamentos efetivos considerando categorias ativas e toggle de despesas recorrentes
  const effectiveLancamentos = useMemo(() => {
    let items = activeLancamentos;
    if (onlyCompras) {
      items = items.filter(l => !isDespesaRecorrente(l.categoria, l.conta_dre, l.fornecedor_cliente));
    }
    return items;
  }, [activeLancamentos, onlyCompras]);

  // Lançamentos de todos os cartões corporativos e Flash combinados
  const cardLancamentos = useMemo(() => {
    return effectiveLancamentos.filter(l => {
      if (l.sinal_valor >= 0 && l.tipo !== 'PAGAR') return false;
      const cc = (l.conta_corrente || '').toLowerCase();
      return cc.includes('cartão') || cc.includes('cartao') || cc.includes('flash') || cc.includes('clara') || cc.includes('elo') || cc.includes('sicredi') || cc.includes('visa');
    });
  }, [effectiveLancamentos]);

  // Computação determinística da Auditoria de Compras
  const audit: PurchasesAuditSummary = useMemo(() => {
    if (!isOpen || !activeLancamentos || activeLancamentos.length === 0) {
      return DreCaixaService.computePurchasesAudit([], selectedConta || undefined, onlyCompras);
    }
    return DreCaixaService.computePurchasesAudit(activeLancamentos, selectedConta || undefined, onlyCompras);
  }, [isOpen, activeLancamentos, selectedConta, onlyCompras]);

  // Lista de cartões filtráveis ordenados
  const cartoesList = useMemo(() => {
    return audit.porCartao.filter(c => c.isCartao || c.isFlash);
  }, [audit.porCartao]);

  // Totais consolidados de todos os cartões corporativos
  const totalCartoesGeral = useMemo(() => {
    return cartoesList.reduce((acc, c) => acc + c.total, 0);
  }, [cartoesList]);

  const totalCartoesCount = useMemo(() => {
    return cartoesList.reduce((acc, c) => acc + c.count, 0);
  }, [cartoesList]);

  // Detalhe reativo: Cartão Selecionado OU Consolidado Geral de Todos os Cartões
  const activeCardDetail = useMemo(() => {
    const isFiltered = !!selectedConta;
    const items = isFiltered
      ? effectiveLancamentos.filter(
          l => (l.conta_corrente || '').trim().toLowerCase() === selectedConta.trim().toLowerCase() &&
            (l.sinal_valor < 0 || l.tipo === 'PAGAR')
        )
      : cardLancamentos;

    const total = items.reduce((acc, l) => acc + Math.abs(l.valor), 0);
    const projMap = new Map<string, number>();
    const catMap = new Map<string, number>();
    const fornMap = new Map<string, { total: number; count: number }>();

    items.forEach(l => {
      const v = Math.abs(l.valor);
      const p = decodeHtmlEntities(l.projeto || 'Operacional / Geral');
      const c = decodeHtmlEntities(l.categoria || 'Geral');
      const f = decodeHtmlEntities(l.fornecedor_cliente || 'Outros / Não Informado');
      projMap.set(p, (projMap.get(p) || 0) + v);
      catMap.set(c, (catMap.get(c) || 0) + v);
      const currF = fornMap.get(f) || { total: 0, count: 0 };
      fornMap.set(f, { total: currF.total + v, count: currF.count + 1 });
    });

    return {
      isConsolidado: !isFiltered,
      conta: isFiltered ? decodeHtmlEntities(selectedConta) : 'Todos os Cartões & Flash (Consolidado)',
      total,
      count: items.length,
      projetos: Array.from(projMap.entries()).map(([projeto, val]) => ({
        projeto,
        total: val,
        count: 1,
        percentual: total > 0 ? (val / total) * 100 : 0
      })).sort((a, b) => b.total - a.total),
      categorias: Array.from(catMap.entries()).map(([categoria, val]) => ({
        categoria,
        total: val,
        count: 1,
        percentual: total > 0 ? (val / total) * 100 : 0
      })).sort((a, b) => b.total - a.total),
      fornecedores: Array.from(fornMap.entries()).map(([fornecedor, d]) => ({
        fornecedor,
        total: d.total,
        count: d.count,
        percentual: total > 0 ? (d.total / total) * 100 : 0
      })).sort((a, b) => b.total - a.total)
    };
  }, [selectedConta, effectiveLancamentos, cardLancamentos]);

  // Lançamentos filtrados para a aba de parcelas (respeitando seletor de cartão, categorias e toggle de compras)
  const parcelasLancamentos = useMemo(() => {
    let items = effectiveLancamentos.filter(l => l.sinal_valor < 0 || l.tipo === 'PAGAR');
    if (selectedConta) {
      const sc = selectedConta.trim().toLowerCase();
      items = items.filter(l => (l.conta_corrente || '').trim().toLowerCase() === sc);
    }
    return items;
  }, [effectiveLancamentos, selectedConta]);

  const amortizacoesPassadasItems = useMemo(() => {
    return parcelasLancamentos.filter(l => (l.parcela_atual || 1) > 1);
  }, [parcelasLancamentos]);

  const comprasAVistaItems = useMemo(() => {
    return parcelasLancamentos.filter(l => (l.parcela_atual || 1) === 1 && (l.total_parcelas || 1) === 1);
  }, [parcelasLancamentos]);

  // Filtragem de fornecedores na busca
  const filteredFornecedores = useMemo(() => {
    if (!searchQuery.trim()) return audit.topFornecedoresCompras;
    const q = searchQuery.toLowerCase();
    return audit.topFornecedoresCompras.filter(f => f.fornecedor.toLowerCase().includes(q));
  }, [audit.topFornecedoresCompras, searchQuery]);

  // Categorias presentes nas compras parceladas (base completa para permitir ligar/desligar sem sumir o botão)
  const parcelasCategories = useMemo(() => {
    const map = new Map<string, number>();
    lancamentos
      .filter(l => (l.sinal_valor < 0 || l.tipo === 'PAGAR') && (l.total_parcelas || 1) > 1)
      .forEach(l => {
        const c = (l.categoria || 'Geral').trim();
        map.set(c, (map.get(c) || 0) + Math.abs(l.valor));
      });
    return Array.from(map.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
  }, [lancamentos]);

  // Handler de exportação CSV
  const handleExportCsv = () => {
    const headers = ['Empresa', 'Data', 'Favorecido', 'Categoria', 'Setor/Projeto', 'Conta/Cartão', 'Parcela', 'Modalidade', 'Tipo Econômico', 'Valor (R$)'];
    const rows = effectiveLancamentos
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
              onClick={() => onOpenGamma(effectiveLancamentos, selectedConta || undefined, onlyCompras)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              title="Gerar apresentação executiva pronta no Gamma"
            >
              <Sparkles size={15} />
              <span>Gerar no Gamma</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              title="Exportar dados para CSV"
            >
              <Download size={18} />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* SUBHEADER: TOGGLE DE DESPESAS RECORRENTES, FILTRO DE CATEGORIAS & TABS */}
        <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Navegação por Abas */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('sumario')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'sumario'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              📊 Sumário Executivo
            </button>
            <button
              onClick={() => setActiveTab('cartoes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'cartoes'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              💳 Cartões & Flash
            </button>
            <button
              onClick={() => setActiveTab('parcelas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'parcelas'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              ⏳ Estrutura de Parcelas
            </button>
            <button
              onClick={() => setActiveTab('fornecedores')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'fornecedores'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              🏢 Top Fornecedores & Itens
            </button>
          </div>

          {/* Filtros em Linha: Toggle Recorrentes e Dropdown de Categorias */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. Toggle Excluir Despesas Recorrentes */}
            <button
              onClick={() => setOnlyCompras(!onlyCompras)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${onlyCompras
                  ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              title="Exclui automaticamente folha de pagamento, pró-labore, aluguéis, contabilidade e tributos"
            >
              {onlyCompras ? <CheckSquare size={15} className="text-amber-600" /> : <Square size={15} className="text-slate-400" />}
              <span>Excluir Recorrentes (Focar Compras)</span>
            </button>

            {/* 2. Filtro Interativo por Categorias (com Popover) */}
            <div className="relative">
              <button
                onClick={() => setIsCategoryFilterOpen(!isCategoryFilterOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${excludedCategories.size > 0
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                title="Filtrar categorias específicas para eliminar despesas recorrentes parceladas"
              >
                <Filter size={13} className={excludedCategories.size > 0 ? 'text-indigo-600' : 'text-slate-500'} />
                <span>
                  {excludedCategories.size === 0
                    ? `Filtrar Categorias (${categoryOptions.length})`
                    : `${categoryOptions.length - excludedCategories.size} de ${categoryOptions.length} Categorias`}
                </span>
                {excludedCategories.size > 0 && (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-bold ml-0.5">
                    {excludedCategories.size}
                  </span>
                )}
                <ChevronDown size={13} className="text-slate-400 ml-0.5" />
              </button>

              {/* Popover Dropdown de Categorias */}
              {isCategoryFilterOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3.5 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                    <div>
                      <span className="font-extrabold text-slate-900 block">Filtro de Categorias</span>
                      <span className="text-[10px] text-slate-500">Desmarque rubricas recorrentes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExcludedCategories(new Set())}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Todas
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        onClick={() => {
                          const recSet = new Set(categoryOptions.filter(c => c.isRecorrente).map(c => c.nome));
                          setExcludedCategories(recSet);
                        }}
                        className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                        title="Desmarca automaticamente todas as categorias recorrentes/overhead"
                      >
                        ⚡ Desmarcar Recorrentes
                      </button>
                    </div>
                  </div>

                  {/* Campo de Busca no Dropdown */}
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar categoria..."
                      value={categorySearchQuery}
                      onChange={e => setCategorySearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  {/* Lista de Categorias com Checkbox */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1 text-xs">
                    {categoryOptions
                      .filter(c => !categorySearchQuery || c.nome.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                      .map(cat => {
                        const isIncluded = !excludedCategories.has(cat.nome);
                        return (
                          <div
                            key={cat.nome}
                            onClick={() => {
                              const next = new Set(excludedCategories);
                              if (isIncluded) next.add(cat.nome);
                              else next.delete(cat.nome);
                              setExcludedCategories(next);
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isIncluded ? 'hover:bg-slate-50' : 'bg-slate-50/70 opacity-60'
                              }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              {isIncluded ? (
                                <CheckSquare size={16} className="text-indigo-600 shrink-0" />
                              ) : (
                                <Square size={16} className="text-slate-400 shrink-0" />
                              )}
                              <span className={`truncate ${isIncluded ? 'font-semibold text-slate-800' : 'text-slate-400 line-through'}`}>
                                {cat.nome}
                              </span>
                              {cat.isRecorrente && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 shrink-0">
                                  Recorrente
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                              {formatCurrencyBRL(cat.total)}
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Rodapé do Dropdown */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      {categoryOptions.length - excludedCategories.size} de {categoryOptions.length} ativas
                    </span>
                    <button
                      onClick={() => setIsCategoryFilterOpen(false)}
                      className="px-3.5 py-1 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 cursor-pointer"
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Seletor Rápido de Cartão / Conta */}
            <div className="relative">
              <select
                value={selectedConta}
                onChange={e => setSelectedConta(e.target.value)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer outline-none ${
                  selectedConta
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-200'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="Filtrar métricas, parcelas e fornecedores por um cartão específico"
              >
                <option value="">💳 Todos os Cartões (Consolidado)</option>
                {cartoesList.map(c => (
                  <option key={c.conta} value={c.conta}>
                    {c.isFlash ? '⚡' : '💳'} {decodeHtmlEntities(c.conta)} ({formatCurrencyBRL(c.total)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* CORPO DO MODAL (SCROLL) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">

          {/* BANNER REATIVO QUANDO HOUVER CARTÃO SELECIONADO */}
          {selectedConta && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200 text-indigo-950 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CreditCard size={15} />
                </div>
                <div>
                  <span className="font-extrabold text-indigo-900 block sm:inline">
                    Cartão Filtrado: {decodeHtmlEntities(selectedConta)}
                  </span>
                  <span className="text-slate-500 sm:ml-1 text-[11px]">
                    ({formatCurrencyBRL(activeCardDetail.total)} • {activeCardDetail.count} transações).
                    Indicadores de compras, parcelas e fornecedores vinculados exclusivamente a este cartão.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedConta('')}
                className="font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 hover:bg-indigo-50 px-2.5 py-1 rounded-xl text-[11px] shrink-0 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5"
                title="Restaurar visão consolidada de todos os cartões"
              >
                <Layers size={13} />
                <span>Ver Consolidado / Todos</span>
              </button>
            </div>
          )}

          {/* AVISO QUANDO HOUVER CATEGORIAS EXCLUÍDAS */}
          {excludedCategories.size > 0 && (
            <div className="px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-indigo-600 shrink-0" />
                <span>
                  <strong>Filtro de Categorias Ativo:</strong> {excludedCategories.size} categoria(s) desmarcada(s). Os valores e parcelas abaixo refletem apenas as rubricas selecionadas.
                </span>
              </div>
              <button
                onClick={() => setExcludedCategories(new Set())}
                className="font-bold text-indigo-700 underline text-[11px] shrink-0 ml-2 cursor-pointer"
              >
                Restaurar Todas
              </button>
            </div>
          )}

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
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <CreditCard size={17} className="text-indigo-600" />
                      Total Comprado por Cartão Corporativo & Flash
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedConta
                        ? `Filtrado por: ${selectedConta}. Clique em 'Ver Consolidado' para ver a soma de todos.`
                        : 'Exibindo visão consolidada de todos os cartões. Clique em um cartão para isolar seus gastos.'}
                    </p>
                  </div>
                  {selectedConta && (
                    <button
                      onClick={() => setSelectedConta('')}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      title="Voltar para a visão consolidada de todos os cartões"
                    >
                      <Layers size={14} />
                      <span>Ver Consolidado (Total)</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Card 1: Consolidado (Todos os Cartões) */}
                  <button
                    onClick={() => setSelectedConta('')}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      !selectedConta
                        ? 'bg-purple-50 border-purple-400 shadow-sm ring-2 ring-purple-300'
                        : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-extrabold text-slate-800 truncate">
                        Todos os Cartões & Flash
                      </span>
                      <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-purple-100 text-purple-800 shrink-0">
                        Consolidado
                      </span>
                    </div>
                    <div className="text-base font-black text-purple-950">
                      {formatCurrencyBRL(totalCartoesGeral)}
                    </div>
                    <div className="text-[11px] mt-1 flex items-center justify-between">
                      <span className="text-slate-400">{totalCartoesCount} transações</span>
                      {!selectedConta ? (
                        <span className="text-purple-700 font-extrabold flex items-center gap-1">
                          <Check size={12} /> Em foco (Total)
                        </span>
                      ) : (
                        <span className="text-slate-400 hover:text-purple-600 font-bold">
                          Ver consolidado →
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Cards Individuais de cada Cartão */}
                  {cartoesList.map(cartao => {
                    const isSelected = selectedConta.toLowerCase() === cartao.conta.toLowerCase();
                    return (
                      <button
                        key={cartao.conta}
                        onClick={() => setSelectedConta(isSelected ? '' : cartao.conta)}
                        className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-400 shadow-sm ring-2 ring-indigo-300'
                            : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-extrabold text-slate-800 truncate" title={cartao.conta}>
                            {cartao.conta}
                          </span>
                          {cartao.isFlash ? (
                            <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-amber-100 text-amber-800 shrink-0">
                              Flash
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-slate-100 text-slate-600 shrink-0">
                              Cartão
                            </span>
                          )}
                        </div>
                        <div className="text-base font-black text-slate-900">
                          {formatCurrencyBRL(cartao.total)}
                        </div>
                        <div className="text-[11px] mt-1 flex items-center justify-between">
                          <span className="text-slate-400">{cartao.count} transações</span>
                          {isSelected ? (
                            <span className="text-indigo-700 font-extrabold flex items-center gap-1">
                              <Check size={12} /> Em foco
                            </span>
                          ) : (
                            <span className="text-slate-400 hover:text-indigo-600 font-bold">
                              Ver raio-x →
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SEÇÃO REATIVA UNIFICADA: RAIO-X DO CARTÃO CLICADO OU TOTAL CONSOLIDADO */}
              {activeCardDetail && (
                <div className={`bg-white border rounded-2xl p-5 shadow-md bg-gradient-to-b from-slate-50/40 to-white animate-fadeIn ${
                  activeCardDetail.isConsolidado ? 'border-purple-200' : 'border-indigo-200'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${
                        activeCardDetail.isConsolidado
                          ? 'bg-purple-100 text-purple-800'
                          : activeCardDetail.conta.toLowerCase().includes('flash')
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {activeCardDetail.isConsolidado ? <Layers size={20} /> : <CreditCard size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900">
                            {activeCardDetail.isConsolidado ? 'Visão Consolidada:' : 'Raio-X de Utilização:'}{' '}
                            <span className={activeCardDetail.isConsolidado ? 'text-purple-700' : 'text-indigo-700'}>
                              {activeCardDetail.conta}
                            </span>
                          </h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            activeCardDetail.isConsolidado ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {formatCurrencyBRL(activeCardDetail.total)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {activeCardDetail.count} transações {activeCardDetail.isConsolidado ? 'em todos os cartões' : 'neste cartão'} no período selecionado
                        </p>
                      </div>
                    </div>

                    {/* Sub-Tabs do Cartão Selecionado ou Consolidado */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                      <button
                        onClick={() => setCardSubTab('projetos')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          cardSubTab === 'projetos'
                            ? 'bg-white text-indigo-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        📁 Por Projeto ({activeCardDetail.projetos.length})
                      </button>
                      <button
                        onClick={() => setCardSubTab('categorias')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          cardSubTab === 'categorias'
                            ? 'bg-white text-indigo-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        🏷️ Por Categoria ({activeCardDetail.categorias.length})
                      </button>
                      <button
                        onClick={() => setCardSubTab('fornecedores')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          cardSubTab === 'fornecedores'
                            ? 'bg-white text-indigo-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        🏢 Por Estabelecimento ({activeCardDetail.fornecedores.length})
                      </button>
                    </div>
                  </div>

                  {/* 1. VISÃO POR PROJETO DO CARTÃO SELECIONADO (COM BARRAS VISUAIS) */}
                  {cardSubTab === 'projetos' && (
                    <div className="space-y-3 animate-fadeIn">
                      {activeCardDetail.projetos.length === 0 ? (
                        <div className="text-xs text-slate-400 text-center py-6">
                          Nenhum projeto associado a este cartão no período filtrado.
                        </div>
                      ) : (
                        activeCardDetail.projetos.map(p => (
                          <div key={p.projeto} className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs hover:border-indigo-200 transition-all">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="font-extrabold text-slate-800 truncate" title={p.projeto}>
                                {p.projeto}
                              </span>
                              <span className="font-black text-slate-900">
                                {formatCurrencyBRL(p.total)} ({p.percentual.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  activeCardDetail.isConsolidado
                                    ? 'bg-purple-600'
                                    : activeCardDetail.conta.toLowerCase().includes('flash')
                                      ? 'bg-amber-500'
                                      : 'bg-indigo-600'
                                }`}
                                style={{ width: `${Math.min(100, p.percentual)}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 2. VISÃO POR CATEGORIA DO CARTÃO SELECIONADO */}
                  {cardSubTab === 'categorias' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 animate-fadeIn">
                      {activeCardDetail.categorias.map(c => (
                        <div key={c.categoria} className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-slate-700 truncate" title={c.categoria}>
                              {c.categoria}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {c.percentual.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-sm font-black text-slate-900">
                            {formatCurrencyBRL(c.total)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. VISÃO POR FORNECEDOR DO CARTÃO SELECIONADO */}
                  {cardSubTab === 'fornecedores' && (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto animate-fadeIn">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                            <th className="pb-2">Fornecedor / Estabelecimento</th>
                            <th className="pb-2 text-center">Transações</th>
                            <th className="pb-2 text-right">Total Pago</th>
                            <th className="pb-2 text-right">% no Cartão</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeCardDetail.fornecedores.map(f => (
                            <tr key={f.fornecedor} className="hover:bg-slate-50">
                              <td className="py-2 font-bold text-slate-800">{f.fornecedor}</td>
                              <td className="py-2 text-center text-slate-400">{f.count}</td>
                              <td className="py-2 text-right font-black text-slate-900">{formatCurrencyBRL(f.total)}</td>
                              <td className="py-2 text-right font-semibold text-indigo-700">{f.percentual.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ABA 3: ESTRUTURA DE PARCELAS */}
          {activeTab === 'parcelas' && (
            <div className="space-y-6 animate-fadeIn">

              {/* BARRA DE ATALHOS RÁPIDOS DE CATEGORIAS NAS PARCELAS */}
              {parcelasCategories.length > 0 && (
                <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                      <Tag size={13} className="text-indigo-600" />
                      Categorias com Parcelamento Detectado:
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Clique em uma categoria para desmarcá-la caso seja despesa recorrente
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {parcelasCategories.slice(0, 8).map(c => {
                      const isExcluded = excludedCategories.has(c.nome);
                      return (
                        <button
                          key={c.nome}
                          onClick={() => {
                            const next = new Set(excludedCategories);
                            if (isExcluded) next.delete(c.nome);
                            else next.add(c.nome);
                            setExcludedCategories(next);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${isExcluded
                              ? 'bg-slate-100 border-slate-300 text-slate-400 line-through'
                              : 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100'
                            }`}
                          title={isExcluded ? `Clique para reativar ${c.nome}` : `Clique para excluir ${c.nome} das compras`}
                        >
                          <span>{c.nome}</span>
                          <span className="text-[10px] font-normal opacity-80">({formatCurrencyBRL(c.total)})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Amortização de Compras Passadas (> 1/N) */}
              <div className="bg-white border border-purple-200 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-purple-950 flex items-center gap-2">
                      <Clock size={16} className="text-purple-600" />
                      Total Pago de Parcelas Compradas Anteriormente ({'>'} 1/N)
                      {selectedConta && (
                        <span className="text-[11px] font-extrabold text-purple-700 bg-purple-100/70 border border-purple-200 px-2 py-0.5 rounded-full">
                          {decodeHtmlEntities(selectedConta)}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedConta
                        ? `Compras no passado vinculadas ao cartão ${decodeHtmlEntities(selectedConta)} quitadas neste mês (${formatCurrencyBRL(audit.totalAmortizacaoAnterior)})`
                        : `Compras realizadas no passado cujas parcelas venceram e foram quitadas neste mês (${formatCurrencyBRL(audit.totalAmortizacaoAnterior)})`}
                    </p>
                  </div>
                  {selectedConta && (
                    <button
                      onClick={() => setSelectedConta('')}
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-xl border border-purple-200 transition-all cursor-pointer flex items-center gap-1"
                      title="Ver todas as parcelas consolidadas"
                    >
                      <Layers size={12} />
                      <span>Ver Consolidado</span>
                    </button>
                  )}
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
                      {amortizacoesPassadasItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                            Nenhuma amortização de compras passadas {selectedConta ? `vinculada ao cartão ${decodeHtmlEntities(selectedConta)}` : ''} encontrada no período.
                          </td>
                        </tr>
                      ) : (
                        amortizacoesPassadasItems
                          .slice(0, 50)
                          .map((item, idx) => (
                            <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50">
                              <td className="py-2 font-bold text-slate-800">{decodeHtmlEntities(item.fornecedor_cliente)}</td>
                              <td className="py-2 text-slate-500">{decodeHtmlEntities(item.empresa)}</td>
                              <td className="py-2 text-slate-600">{decodeHtmlEntities(item.categoria)}</td>
                              <td className="py-2 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                                  💳 {item.numero_parcela || `${item.parcela_atual}/${item.total_parcelas}`}
                                </span>
                              </td>
                              <td className="py-2 text-right font-black text-slate-900">
                                {formatCurrencyBRL(item.valor)}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Compras à Vista (1/1) */}
              <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Fornecedores com Pagamento À Vista (Parcela 1/1)
                      {selectedConta && (
                        <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {decodeHtmlEntities(selectedConta)}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedConta
                        ? `Compras à vista efetuadas através de ${decodeHtmlEntities(selectedConta)} (${formatCurrencyBRL(audit.totalAVista)})`
                        : `Compras à vista efetuadas e liquidadas no mês corrente (${formatCurrencyBRL(audit.totalAVista)})`}
                    </p>
                  </div>
                  {selectedConta && (
                    <button
                      onClick={() => setSelectedConta('')}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-xl border border-emerald-200 transition-all cursor-pointer flex items-center gap-1"
                      title="Ver todos os pagamentos à vista consolidados"
                    >
                      <Layers size={12} />
                      <span>Ver Consolidado</span>
                    </button>
                  )}
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
                      {comprasAVistaItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                            Nenhuma compra à vista {selectedConta ? `vinculada ao cartão ${decodeHtmlEntities(selectedConta)}` : ''} encontrada no período.
                          </td>
                        </tr>
                      ) : (
                        comprasAVistaItems
                          .slice(0, 50)
                          .map((item, idx) => (
                            <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50">
                              <td className="py-2 font-bold text-slate-800">{decodeHtmlEntities(item.fornecedor_cliente)}</td>
                              <td className="py-2 text-slate-500">{decodeHtmlEntities(item.empresa)}</td>
                              <td className="py-2 text-slate-600">{decodeHtmlEntities(item.categoria)}</td>
                              <td className="py-2 text-slate-500">{decodeHtmlEntities(item.projeto)}</td>
                              <td className="py-2 text-right font-black text-emerald-700">
                                {formatCurrencyBRL(item.valor)}
                              </td>
                            </tr>
                          ))
                      )}
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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      Total Comprado por Categoria
                      {selectedConta && (
                        <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded-full">
                          {decodeHtmlEntities(selectedConta)}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedConta
                        ? `Distribuição de compras vinculadas exclusivamente a ${decodeHtmlEntities(selectedConta)}`
                        : 'Distribuição geral das compras por rubrica contábil'}
                    </p>
                  </div>
                  {selectedConta && (
                    <button
                      onClick={() => setSelectedConta('')}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-xl border border-indigo-200 transition-all cursor-pointer flex items-center gap-1"
                      title="Ver categorias consolidadas"
                    >
                      <Layers size={12} />
                      <span>Ver Consolidado</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {audit.porCategoriaCompras.slice(0, 15).map(cat => (
                    <div key={cat.categoria} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-700 truncate" title={decodeHtmlEntities(cat.categoria)}>
                          {decodeHtmlEntities(cat.categoria)}
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
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      Principais Fornecedores do Período
                      {selectedConta && (
                        <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded-full">
                          {decodeHtmlEntities(selectedConta)}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedConta
                        ? `Ranking dos maiores credores com compras vinculadas a ${decodeHtmlEntities(selectedConta)}`
                        : 'Ranking dos maiores credores com modalidade e parcelas'}
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
                      {filteredFornecedores.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                            Nenhum fornecedor {selectedConta ? `vinculado a ${decodeHtmlEntities(selectedConta)}` : ''} encontrado com os filtros ativos.
                          </td>
                        </tr>
                      ) : (
                        filteredFornecedores.map(f => (
                          <tr key={f.fornecedor} className="hover:bg-slate-50">
                            <td className="py-2.5 font-bold text-slate-800">{decodeHtmlEntities(f.fornecedor)}</td>
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
                        ))
                      )}
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
              onClick={() => onOpenGamma(effectiveLancamentos, selectedConta || undefined, onlyCompras)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles size={16} />
              <span>Gerar Apresentação no Gamma (Diretoria)</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
