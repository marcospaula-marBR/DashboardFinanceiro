"use client";

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Download,
  Calendar,
  Building2,
  Users,
  TrendingUp,
  FileText,
  ChevronDown,
  ChevronRight,
  Receipt,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  CreditCard
} from 'lucide-react';
import { DreCaixaLancamento } from '@/types/dre-caixa';
import { formatCurrencyBRL } from '@/services/dre-caixa.service';

interface DreCaixaDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  initialMonth?: string;
  availableMonths?: string[];
  empresaLabel?: string;
  lancamentos: DreCaixaLancamento[];
}

interface FavorecidoGroup {
  nome: string;
  totalValor: number;
  qtdPagamentos: number;
  projetos: string[];
  bancos: string[];
  percentual: number;
  itens: DreCaixaLancamento[];
}

export function DreCaixaDrilldownModal({
  isOpen,
  onClose,
  categoryName,
  initialMonth,
  availableMonths = [],
  empresaLabel,
  lancamentos
}: DreCaixaDrilldownModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || 'todos');
  const [selectedModalidade, setSelectedModalidade] = useState<'TODOS' | 'A_VISTA' | 'PARCELADO'>('TODOS');
  const [activeTab, setActiveTab] = useState<'ranking' | 'extrato'>('ranking');
  const [expandedFavorecidos, setExpandedFavorecidos] = useState<Record<string, boolean>>({});

  // Reset month and modalidade when initialMonth or categoryName changes
  React.useEffect(() => {
    setSelectedMonth(initialMonth || 'todos');
    setSelectedModalidade('TODOS');
  }, [initialMonth, categoryName]);

  // 1. Identificar se o filtro é uma sub-rubrica específica ou um macro-grupo
  const categoryLower = (categoryName || '').toLowerCase().trim();
  const isMacroCustos = categoryLower.includes('custos operacionais');
  const isMacroDespesas = categoryLower.includes('despesas administrativas');
  const isMacroEntradas = categoryLower.includes('entradas') || categoryLower.includes('receita');

  // 2. Filtrar lançamentos da categoria
  const baseCategoryItems = lancamentos.filter(l => {
    if (!categoryName) return true;
    const catLower = l.categoria.toLowerCase();
    const isReceita = l.tipo === 'RECEBER' || catLower.includes('receita') || catLower.includes('faturamento') || catLower.includes('venda de');
    const isCusto = !isReceita && (catLower.includes('custo') || catLower.includes('insumo') || catLower.includes('prestador') || catLower.includes('serviço prestado') || catLower.includes('combustível') || catLower.includes('preventiva') || catLower.includes('corretiva'));

    if (isMacroCustos) return isCusto;
    if (isMacroDespesas) return !isReceita && !isCusto;
    if (isMacroEntradas) return isReceita;
    return l.categoria.toLowerCase().trim() === categoryLower;
  });

  // 3. Filtrar por mês e por modalidade (À Vista vs Parcelado)
  const scopedFilteredItems = baseCategoryItems.filter(item => {
    if (selectedMonth && selectedMonth !== 'todos' && item.periodo !== selectedMonth) return false;
    if (selectedModalidade !== 'TODOS' && item.tipo_pagamento !== selectedModalidade) return false;
    return true;
  });

  // 4. Filtrar por termo de busca
  const term = searchTerm.toLowerCase().trim();
  const searchFilteredItems = scopedFilteredItems.filter(item => {
    if (!term) return true;
    return (
      (item.fornecedor_cliente && item.fornecedor_cliente.toLowerCase().includes(term)) ||
      (item.projeto && item.projeto.toLowerCase().includes(term)) ||
      (item.conta_corrente && item.conta_corrente.toLowerCase().includes(term)) ||
      (item.categoria && item.categoria.toLowerCase().includes(term)) ||
      (item.numero_documento && item.numero_documento.toLowerCase().includes(term)) ||
      (item.numero_parcela && item.numero_parcela.toLowerCase().includes(term))
    );
  });

  // 5. Agrupamento e Ranking dos Favorecidos
  const totalGeralRubrica = scopedFilteredItems.reduce((acc, curr) => acc + curr.valor, 0);

  const favorecidosRanking: FavorecidoGroup[] = useMemo(() => {
    const map = new Map<string, {
      totalValor: number;
      qtdPagamentos: number;
      projetos: Set<string>;
      bancos: Set<string>;
      itens: DreCaixaLancamento[];
    }>();

    searchFilteredItems.forEach(item => {
      const fav = (item.fornecedor_cliente || 'Outros / Operacional').trim();
      const existing = map.get(fav) || {
        totalValor: 0,
        qtdPagamentos: 0,
        projetos: new Set<string>(),
        bancos: new Set<string>(),
        itens: []
      };

      existing.totalValor += item.valor;
      existing.qtdPagamentos += 1;
      if (item.projeto) existing.projetos.add(item.projeto);
      if (item.conta_corrente) existing.bancos.add(item.conta_corrente);
      existing.itens.push(item);

      map.set(fav, existing);
    });

    const groups: FavorecidoGroup[] = [];
    map.forEach((val, key) => {
      // Ordenar itens por data decrescente
      val.itens.sort((a, b) => (b.data_pagamento || '').localeCompare(a.data_pagamento || ''));
      const percentual = totalGeralRubrica > 0 ? (val.totalValor / totalGeralRubrica) * 100 : 0;
      groups.push({
        nome: key,
        totalValor: val.totalValor,
        qtdPagamentos: val.qtdPagamentos,
        projetos: Array.from(val.projetos),
        bancos: Array.from(val.bancos),
        percentual,
        itens: val.itens
      });
    });

    // Ordenar do maior para o menor valor
    groups.sort((a, b) => b.totalValor - a.totalValor);
    return groups;
  }, [searchFilteredItems, totalGeralRubrica]);

  // Estatísticas Rápidas
  const totalFiltered = searchFilteredItems.reduce((acc, curr) => acc + curr.valor, 0);
  const mediaPorFavorecido = favorecidosRanking.length > 0 ? totalFiltered / favorecidosRanking.length : 0;
  const topFavorecido = favorecidosRanking[0];

  const toggleFavorecido = (nome: string) => {
    setExpandedFavorecidos(prev => ({
      ...prev,
      [nome]: !prev[nome]
    }));
  };

  const handleExportRanking = () => {
    const headers = ['Posição', 'Favorecido / Fornecedor', 'Setores / Projetos', 'Qtd Pagamentos', 'Total (R$)', '% Participação'];
    const rows = favorecidosRanking.map((fav, index) => [
      `#${index + 1}`,
      `"${fav.nome}"`,
      `"${fav.projetos.join(', ')}"`,
      fav.qtdPagamentos,
      fav.totalValor.toFixed(2),
      `${fav.percentual.toFixed(1)}%`
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ranking_favorecidos_${(categoryName || 'rubrica').replace(/[^a-zA-Z0-9]/g, '_')}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExtrato = () => {
    const headers = ['Data Pagamento', 'Empresa', 'Setor (Projeto)', 'Categoria', 'Favorecido / Fornecedor', 'Conta Corrente', 'Documento', 'Parcela', 'Modalidade', 'Tipo', 'Valor (R$)'];
    const rows = searchFilteredItems.map(item => [
      item.data_pagamento,
      item.empresa,
      `"${item.projeto}"`,
      `"${item.categoria}"`,
      `"${item.fornecedor_cliente}"`,
      `"${item.conta_corrente}"`,
      item.numero_documento || '',
      item.numero_parcela || (item.tipo_pagamento === 'PARCELADO' ? `${item.parcela_atual}/${item.total_parcelas}` : '1/1'),
      item.tipo_pagamento === 'PARCELADO' ? 'Parcelado' : 'À Vista',
      item.tipo,
      item.valor.toFixed(2)
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `extrato_detalhado_${(categoryName || 'rubrica').replace(/[^a-zA-Z0-9]/g, '_')}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isEntrada = isMacroEntradas || baseCategoryItems.some(l => l.tipo === 'RECEBER');
  const entityLabel = isEntrada ? 'Cliente / Pagador' : 'Favorecido / Fornecedor';
  const entityPlural = isEntrada ? 'Clientes' : 'Favorecidos';
  const actionLabel = isEntrada ? 'Total Recebido' : 'Total Desembolsado';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
        
        {/* Header Superior do Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Users size={12} />
                Detalhamento por {entityPlural}
              </span>
              {empresaLabel && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-slate-600 border border-slate-200">
                  {empresaLabel}
                </span>
              )}
              <span className="text-xs text-slate-500 font-medium">
                {searchFilteredItems.length} lançamento{searchFilteredItems.length !== 1 ? 's' : ''}
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-black text-slate-900 mt-1 tracking-tight flex items-center gap-2">
              {categoryName || 'Todos os Lançamentos do Caixa'}
            </h2>
          </div>

          {/* Botões de Ação do Header */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={activeTab === 'ranking' ? handleExportRanking : handleExportExtrato}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors shadow-sm"
              title="Exportar dados visíveis para CSV"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filtros Rápidos de Mês & Modalidade (Pills dentro do Modal) */}
        <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-wrap sm:flex-nowrap">
          {availableMonths.length > 0 && (
            <>
              <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0 mr-1 flex items-center gap-1">
                <Calendar size={12} />
                Mês:
              </span>
              <button
                onClick={() => setSelectedMonth('todos')}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                  selectedMonth === 'todos'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
                }`}
              >
                Acumulado (Todos)
              </button>
              {availableMonths.map(mes => (
                <button
                  key={mes}
                  onClick={() => setSelectedMonth(mes)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    selectedMonth === mes
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  {mes}
                </button>
              ))}
            </>
          )}

          <span className="text-slate-300 mx-1 hidden sm:inline">|</span>

          <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0 mr-1 flex items-center gap-1">
            <CreditCard size={12} />
            Modalidade:
          </span>
          <button
            onClick={() => setSelectedModalidade('TODOS')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              selectedModalidade === 'TODOS'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setSelectedModalidade('A_VISTA')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              selectedModalidade === 'A_VISTA'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            ⚡ À Vista
          </button>
          <button
            onClick={() => setSelectedModalidade('PARCELADO')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              selectedModalidade === 'PARCELADO'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            💳 Parcelado
          </button>
        </div>

        {/* KPI Cards de Resumo Executivo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:p-4 bg-slate-50/50 border-b border-slate-200">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">{actionLabel}</span>
            <strong className="text-sm sm:text-base font-black text-slate-900 mt-0.5 block">
              {formatCurrencyBRL(totalFiltered)}
            </strong>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">{entityPlural} Únicos</span>
            <strong className="text-sm sm:text-base font-black text-emerald-700 mt-0.5 block flex items-center gap-1">
              <Users size={15} />
              {favorecidosRanking.length}
            </strong>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Média por {isEntrada ? 'Cliente' : 'Favorecido'}</span>
            <strong className="text-sm sm:text-base font-black text-slate-700 mt-0.5 block">
              {formatCurrencyBRL(mediaPorFavorecido)}
            </strong>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Maior {isEntrada ? 'Cliente' : 'Favorecido'}</span>
            <strong className="text-xs sm:text-xs font-black text-slate-900 mt-0.5 truncate block" title={topFavorecido?.nome}>
              {topFavorecido ? topFavorecido.nome : '-'}
            </strong>
            {topFavorecido && (
              <span className="text-[10px] text-slate-500 font-mono">
                {formatCurrencyBRL(topFavorecido.totalValor)} ({topFavorecido.percentual.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>

        {/* Barra de Filtro de Busca & Alternância de Abas */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Abas: Ranking vs Extrato */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setActiveTab('ranking')}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'ranking' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award size={14} className={activeTab === 'ranking' ? 'text-emerald-600' : ''} />
              <span>Ranking dos {entityPlural} ({favorecidosRanking.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('extrato')}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'extrato' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={14} className={activeTab === 'extrato' ? 'text-emerald-600' : ''} />
              <span>Extrato Completo ({searchFilteredItems.length})</span>
            </button>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={`Buscar por ${isEntrada ? 'cliente, pagador' : 'colaborador, fornecedor'}, documento ou projeto...`}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Conteúdo Principal com Scroll */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4">
          
          {favorecidosRanking.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Nenhum favorecido ou lançamento encontrado para os critérios informados.
            </div>
          ) : activeTab === 'ranking' ? (
            /* TAB 1: RANKING DOS FAVORECIDOS COM ACCORDION */
            <div className="space-y-2">
              {favorecidosRanking.map((fav, index) => {
                const isExpanded = !!expandedFavorecidos[fav.nome];
                return (
                  <div
                    key={fav.nome}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-all shadow-sm"
                  >
                    {/* Linha Resumo do Favorecido */}
                    <div
                      onClick={() => toggleFavorecido(fav.nome)}
                      className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                        {/* Posição no Ranking */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                          index === 0
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : index === 1
                            ? 'bg-slate-200 text-slate-800 border border-slate-300'
                            : index === 2
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          #{index + 1}
                        </div>

                        {/* Nome do Favorecido e Metadados */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-xs sm:text-sm text-slate-900 truncate" title={fav.nome}>
                              {fav.nome}
                            </h4>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({fav.qtdPagamentos} lançamento{fav.qtdPagamentos !== 1 ? 's' : ''})
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {fav.projetos.slice(0, 3).map(p => (
                              <span key={p} className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[140px]">
                                {p}
                              </span>
                            ))}
                            {fav.projetos.length > 3 && (
                              <span className="text-[9px] font-bold text-slate-400">
                                +{fav.projetos.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Valores e Barra de Progresso */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <div className="w-24 sm:w-32 hidden md:block">
                          <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-0.5">
                            <span>Participação</span>
                            <span className="font-bold">{fav.percentual.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(2, fav.percentual))}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs sm:text-sm font-black text-slate-900 block font-mono">
                            {formatCurrencyBRL(fav.totalValor)}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold md:hidden block">
                            {fav.percentual.toFixed(1)}% do total
                          </span>
                        </div>

                        <div className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Accordion: Tabela de Lançamentos Individuais deste Favorecido */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-3 animate-in slide-in-from-top-1 duration-150">
                        <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                          <Receipt size={13} className="text-slate-400" />
                          <span>Lançamentos {isEntrada ? 'recebidos de' : 'liquidados para'} {fav.nome}:</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                                <th className="py-1.5 px-2">Data Pgto</th>
                                <th className="py-1.5 px-2">Empresa</th>
                                <th className="py-1.5 px-2">Setor (Projeto)</th>
                                <th className="py-1.5 px-2">Conta Bancária</th>
                                <th className="py-1.5 px-2">Documento</th>
                                <th className="py-1.5 px-2 text-center">Parcela</th>
                                <th className="py-1.5 px-2 text-right">Valor Líquido</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60 font-medium">
                              {fav.itens.map(subItem => (
                                <tr key={subItem.id} className="hover:bg-white text-slate-700 transition-colors">
                                  <td className="py-1.5 px-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                                    {subItem.data_pagamento}
                                  </td>
                                  <td className="py-1.5 px-2 text-[11px]">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 font-bold text-[9px]">
                                      {subItem.empresa}
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-2 text-[11px] truncate max-w-[160px]" title={subItem.projeto}>
                                    {subItem.projeto}
                                  </td>
                                  <td className="py-1.5 px-2 text-[10px] text-slate-500 truncate max-w-[120px]" title={subItem.conta_corrente}>
                                    {subItem.conta_corrente}
                                  </td>
                                  <td className="py-1.5 px-2 font-mono text-[10px] text-slate-400">
                                    {subItem.numero_documento || '-'}
                                  </td>
                                  <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                    {subItem.tipo_pagamento === 'PARCELADO' ? (
                                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-[9px]">
                                        💳 {subItem.numero_parcela || `${subItem.parcela_atual}/${subItem.total_parcelas}`}
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[9px]">
                                        À vista
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-mono font-bold text-[11px] text-slate-900 whitespace-nowrap">
                                    {formatCurrencyBRL(subItem.valor)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* TAB 2: EXTRATO COMPLETO DE TODOS OS LANÇAMENTOS */
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px] z-10">
                  <tr>
                    <th className="py-2.5 px-3">Data Pgto</th>
                    <th className="py-2.5 px-3">Empresa</th>
                    <th className="py-2.5 px-3">Setor (Projeto)</th>
                    <th className="py-2.5 px-3">Favorecido / Fornecedor</th>
                    <th className="py-2.5 px-3">Conta Bancária</th>
                    <th className="py-2.5 px-3">Documento</th>
                    <th className="py-2.5 px-3 text-center">Parcela</th>
                    <th className="py-2.5 px-3 text-right">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {searchFilteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 text-slate-700 transition-colors">
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {item.data_pagamento}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                          {item.empresa}
                        </span>
                      </td>
                      <td className="py-2 px-3 truncate max-w-[160px]" title={item.projeto}>
                        {item.projeto}
                      </td>
                      <td className="py-2 px-3 truncate max-w-[220px] font-bold text-slate-900" title={item.fornecedor_cliente}>
                        {item.fornecedor_cliente}
                      </td>
                      <td className="py-2 px-3 truncate max-w-[140px] text-slate-500" title={item.conta_corrente}>
                        {item.conta_corrente}
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] text-slate-500">
                        {item.numero_documento || '-'}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {item.tipo_pagamento === 'PARCELADO' ? (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-[10px]">
                            💳 {item.numero_parcela || `${item.parcela_atual}/${item.total_parcelas}`}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-mono text-[10px]">
                            À vista
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={item.tipo === 'RECEBER' ? 'text-emerald-700' : 'text-slate-900'}>
                          {item.tipo === 'RECEBER' ? '+' : ''} {formatCurrencyBRL(item.valor)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Exibindo <strong>{favorecidosRanking.length}</strong> {entityPlural.toLowerCase()} ({searchFilteredItems.length} lançamentos)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition-colors shadow-sm"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
