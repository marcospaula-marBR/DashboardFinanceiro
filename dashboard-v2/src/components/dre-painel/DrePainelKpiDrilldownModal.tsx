"use client";

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  TrendingUp,
  TrendingDown,
  Layers,
  PieChart,
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Download
} from 'lucide-react';
import { DrePainelLancamento, RegimeTipo } from '@/types/dre-painel';
import { formatCurrencyBRL } from '@/services/dre-painel.service';

export type DrilldownCardType = 'RECEITAS' | 'DESPESAS' | 'RESULTADO' | 'PROVISOES';

interface DrePainelKpiDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardType: DrilldownCardType;
  lancamentos: DrePainelLancamento[];
  regime: RegimeTipo;
  onSelectLancamento?: (lancamento: DrePainelLancamento) => void;
}

export function DrePainelKpiDrilldownModal({
  isOpen,
  onClose,
  cardType,
  lancamentos,
  regime,
  onSelectLancamento
}: DrePainelKpiDrilldownModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'contas' | 'categorias' | 'fornecedores' | 'lancamentos'>('categorias');
  const [selectedConta, setSelectedConta] = useState<string | null>(null);

  // Filtrar lançamentos que pertencem ao card selecionado
  const filteredItems = useMemo(() => {
    let items: DrePainelLancamento[] = [];
    if (cardType === 'RECEITAS') {
      items = lancamentos.filter(l => l.sinal_valor > 0);
    } else if (cardType === 'DESPESAS') {
      items = lancamentos.filter(l => l.sinal_valor < 0);
    } else if (cardType === 'PROVISOES') {
      items = lancamentos.filter(l => l.is_provisao);
    } else {
      // RESULTADO: todos
      items = [...lancamentos];
    }

    if (selectedConta) {
      items = items.filter(l => l.conta_dre === selectedConta);
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      items = items.filter(l =>
        l.fornecedor_cliente.toLowerCase().includes(s) ||
        l.categoria.toLowerCase().includes(s) ||
        l.conta_dre.toLowerCase().includes(s) ||
        l.departamento.toLowerCase().includes(s) ||
        l.projeto.toLowerCase().includes(s) ||
        l.conta_corrente.toLowerCase().includes(s)
      );
    }

    return items;
  }, [lancamentos, cardType, selectedConta, searchTerm]);

  // Totais
  const totalValor = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.valor, 0);
  }, [filteredItems]);

  // Agrupamento por Conta DRE
  const breakdownContas = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    filteredItems.forEach(l => {
      const c = l.conta_dre || 'Outros';
      const prev = map.get(c) || { total: 0, count: 0 };
      map.set(c, { total: prev.total + l.valor, count: prev.count + 1 });
    });
    return Array.from(map.entries())
      .map(([conta, data]) => ({ conta, total: data.total, count: data.count, percent: totalValor > 0 ? (data.total / totalValor) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredItems, totalValor]);

  // Agrupamento por Categoria
  const breakdownCategorias = useMemo(() => {
    const map = new Map<string, { total: number; count: number; conta: string }>();
    filteredItems.forEach(l => {
      const cat = l.categoria || 'Diversos';
      const prev = map.get(cat) || { total: 0, count: 0, conta: l.conta_dre };
      map.set(cat, { total: prev.total + l.valor, count: prev.count + 1, conta: l.conta_dre });
    });
    return Array.from(map.entries())
      .map(([categoria, data]) => ({ categoria, total: data.total, count: data.count, conta: data.conta, percent: totalValor > 0 ? (data.total / totalValor) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredItems, totalValor]);

  // Agrupamento por Fornecedor / Cliente
  const breakdownFornecedores = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    filteredItems.forEach(l => {
      const f = l.fornecedor_cliente || 'Diversos';
      const prev = map.get(f) || { total: 0, count: 0 };
      map.set(f, { total: prev.total + l.valor, count: prev.count + 1 });
    });
    return Array.from(map.entries())
      .map(([fornecedor, data]) => ({ fornecedor, total: data.total, count: data.count, percent: totalValor > 0 ? (data.total / totalValor) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredItems, totalValor]);

  if (!isOpen) return null;

  const cardConfig = {
    RECEITAS: {
      title: 'Detalhamento: Receita Bruta & Entradas',
      desc: 'Composição analítica de todas as receitas e ingressos operacionais',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: <TrendingUp className="text-emerald-600" size={20} />
    },
    DESPESAS: {
      title: 'Detalhamento: Total Despesas & Custos',
      desc: 'Composição analítica de todos os desembolsos, custos operacionais e gastos',
      badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
      icon: <TrendingDown className="text-rose-600" size={20} />
    },
    RESULTADO: {
      title: 'Detalhamento: Resultado Líquido',
      desc: 'Confronto analítico integral entre entradas e saídas do exercício',
      badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
      icon: <PieChart className="text-blue-600" size={20} />
    },
    PROVISOES: {
      title: 'Detalhamento: Provisões Operacionais',
      desc: 'Provisões para encargos trabalhistas (13º, férias), tributárias e contingenciais',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: <Layers className="text-amber-600" size={20} />
    }
  }[cardType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              {cardConfig.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {cardConfig.title}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cardConfig.badgeColor}`}>
                  {regime === 'COMPETENCIA' ? 'Competência' : (regime === 'CAIXA' ? 'Caixa' : 'Previsão')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {cardConfig.desc}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Totalizador & Busca Rápida */}
        <div className="p-4 sm:px-6 border-b border-slate-100 bg-white shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Volume Total do Recorte
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {formatCurrencyBRL(totalValor)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {filteredItems.length} lançamentos contabilizados
              </p>
            </div>

            {/* Barra de Busca */}
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar favorecido, categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Abas Analíticas */}
          <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-100 overflow-x-auto">
            <button
              onClick={() => setActiveTab('categorias')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'categorias'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Por Categoria ({breakdownCategorias.length})
            </button>
            <button
              onClick={() => setActiveTab('contas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'contas'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Por Conta DRE ({breakdownContas.length})
            </button>
            <button
              onClick={() => setActiveTab('fornecedores')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'fornecedores'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Por Favorecido / Cliente ({breakdownFornecedores.length})
            </button>
            <button
              onClick={() => setActiveTab('lancamentos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'lancamentos'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Lançamentos Analíticos ({filteredItems.length})
            </button>
          </div>
        </div>

        {/* Conteúdo Dinâmico */}
        <div className="flex-1 overflow-y-auto p-4 sm:px-6">
          {/* TAB 1: CATEGORIAS */}
          {activeTab === 'categorias' && (
            <div className="space-y-2">
              {breakdownCategorias.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nenhuma categoria encontrada para os filtros ativos.
                </div>
              ) : (
                breakdownCategorias.map((c, i) => (
                  <div
                    key={c.categoria}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-xl transition-all"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-400">
                            #{i + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {c.categoria}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {c.conta} • {c.count} {c.count === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-slate-900">
                          {formatCurrencyBRL(c.total)}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">
                          {c.percent.toFixed(1)}% do total
                        </span>
                      </div>
                    </div>
                    {/* Barra de progresso visual */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, c.percent)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: CONTAS DRE */}
          {activeTab === 'contas' && (
            <div className="space-y-2">
              {breakdownContas.map((c, i) => (
                <div
                  key={c.conta}
                  className="p-3.5 bg-white border border-slate-100 hover:border-slate-200 rounded-xl transition-all"
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="text-xs font-bold text-slate-900">
                      {c.conta}
                    </span>
                    <div className="text-right">
                      <div className="text-xs font-black text-slate-900">
                        {formatCurrencyBRL(c.total)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">
                        {c.percent.toFixed(1)}% • {c.count} lançamentos
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-slate-800 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, c.percent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: FORNECEDORES */}
          {activeTab === 'fornecedores' && (
            <div className="space-y-2">
              {breakdownFornecedores.slice(0, 30).map((f, i) => (
                <div
                  key={f.fornecedor}
                  className="p-3 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400">
                        #{i + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {f.fornecedor}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {f.count} {f.count === 1 ? 'lançamento' : 'lançamentos'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-slate-900">
                      {formatCurrencyBRL(f.total)}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {f.percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: LANÇAMENTOS DETALHADOS */}
          {activeTab === 'lancamentos' && (
            <div className="space-y-1.5">
              {filteredItems.slice(0, 50).map((l) => (
                <div
                  key={l.id}
                  onClick={() => onSelectLancamento && onSelectLancamento(l)}
                  className="p-3 bg-white hover:bg-emerald-50/40 border border-slate-100 hover:border-emerald-200 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-700">
                        {l.empresa}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {l.fornecedor_cliente}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span className="font-semibold text-slate-700">{l.categoria}</span>
                      <span>•</span>
                      <span>{l.periodo}</span>
                      <span>•</span>
                      <span>Banco: {l.conta_corrente}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <div className={`text-xs font-black ${l.sinal_valor > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {formatCurrencyBRL(l.valor)}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {l.tipo_pagamento === 'PARCELADO' ? `Parc. ${l.numero_parcela}` : 'À vista'}
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
                  </div>
                </div>
              ))}
              {filteredItems.length > 50 && (
                <div className="py-2 text-center text-xs text-slate-400">
                  Mostrando os primeiros 50 de {filteredItems.length} lançamentos. Use a busca para filtrar.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            {regime === 'COMPETENCIA' ? 'Dados auditados e calibrados com a base mestre DRE' : 'Dados atualizados em tempo real via Omie ERP'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
