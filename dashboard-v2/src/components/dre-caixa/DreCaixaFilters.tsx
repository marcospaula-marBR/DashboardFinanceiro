"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Filter,
  X,
  Search,
  ChevronDown,
  Building2,
  Calendar,
  Layers,
  Tag,
  UserCheck,
  CreditCard,
  RotateCcw,
  Check,
  EyeOff,
  ShieldAlert,
  Shield,
  Repeat,
  AlertTriangle
} from 'lucide-react';
import { DreCaixaFilters } from '@/types/dre-caixa';

interface MultiSelectProps {
  label: string;
  icon: React.ReactNode;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  hiddenOptions?: string[];
  onToggleHide?: (option: string) => void;
}

function SearchableMultiSelect({
  label,
  icon,
  options,
  selected,
  onChange,
  placeholder = "Pesquisar...",
  hiddenOptions = [],
  onToggleHide
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(item => item !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const selectAll = () => onChange([...options]);
  const clearAll = () => onChange([]);

  const summaryText = selected.length === 0
    ? 'Todos'
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selecionados`;

  const hiddenCount = hiddenOptions.length;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 bg-white border rounded-xl px-3 py-2 text-xs font-medium transition-all shadow-sm h-10 cursor-pointer ${
          hiddenCount > 0
            ? 'border-amber-400 ring-1 ring-amber-400/30 text-amber-950 bg-amber-50/20'
            : selected.length > 0
            ? 'border-emerald-500 ring-1 ring-emerald-500/20 text-slate-900 bg-emerald-50/20'
            : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <span className={hiddenCount > 0 ? "text-amber-600" : selected.length > 0 ? "text-emerald-600" : "text-slate-400"}>
            {hiddenCount > 0 ? <EyeOff size={13} /> : icon}
          </span>
          <span className="text-slate-500 font-bold">{label}:</span>
          <span className={`truncate font-bold ${hiddenCount > 0 ? 'text-amber-900' : selected.length > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
            {summaryText}
          </span>
          {hiddenCount > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-full border border-amber-300 shrink-0">
              {hiddenCount} oculto{hiddenCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[280px] max-w-sm bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2.5">
          {/* Campo de Busca Rápida */}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>

          {/* Ações Rápidas */}
          <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-100 text-[11px]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
              >
                Marcar Todos
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
              >
                Limpar
              </button>
            </div>
            <span className="text-[10px] text-slate-400 font-bold">
              {filteredOptions.length} de {options.length}
            </span>
          </div>

          {/* Lista de Opções com suporte a Ocultar */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
            {filteredOptions.length === 0 ? (
              <div className="text-slate-400 text-center py-3 text-xs">Nenhum item encontrado</div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = selected.includes(opt);
                const isHidden = hiddenOptions.includes(opt);
                return (
                  <div
                    key={opt}
                    className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      isHidden
                        ? 'bg-amber-50/90 text-amber-950 border border-amber-200'
                        : isSelected
                        ? 'bg-emerald-50 text-emerald-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <label className="flex items-center gap-2 truncate flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOption(opt)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span className={`truncate ${isHidden ? 'line-through text-amber-900' : ''}`}>
                        {opt}
                      </span>
                    </label>

                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && !isHidden && <Check size={13} className="text-emerald-600 shrink-0" />}
                      {onToggleHide && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onToggleHide(opt);
                          }}
                          title={isHidden ? "Item oculto. Clique para tornar visível." : "Ocultar este item (proteger dados sensíveis)"}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            isHidden
                              ? 'bg-amber-200 text-amber-900 hover:bg-amber-300'
                              : 'text-slate-300 hover:text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          <EyeOff size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface DreCaixaFiltersProps {
  availableOptions: {
    empresas: string[];
    periodos: string[];
    projetos: string[];
    categorias: string[];
    fornecedores: string[];
    contasCorrentes: string[];
    counts?: {
      aVista: number;
      parcelado: number;
      recorrentes?: number;
      atrasados?: number;
      total: number;
    };
  };
  filters: DreCaixaFilters;
  onChangeFilters: (newFilters: DreCaixaFilters) => void;
  onClearFilters: () => void;
  onOpenPrivacyModal?: () => void;
}

export function DreCaixaFiltersBar({
  availableOptions,
  filters,
  onChangeFilters,
  onClearFilters,
  onOpenPrivacyModal
}: DreCaixaFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Lista de empresas padrão garantindo a ordem prioritária do ecossistema
  const defaultEmpresas = ['Mar Brasil', 'DZM', 'G2', 'Conectius'];
  // Combina com quaisquer outras empresas presentes nos dados
  const displayedEmpresas = Array.from(
    new Set([...defaultEmpresas, ...(availableOptions.empresas || [])])
  ).filter(Boolean);

  const ocultarCats = filters.ocultarCategorias || [];
  const ocultarProjs = filters.ocultarProjetos || [];
  const ocultarForns = filters.ocultarFornecedores || [];
  const totalOcultos = ocultarCats.length + ocultarProjs.length + ocultarForns.length;

  const toggleHideCategoria = (cat: string) => {
    const next = ocultarCats.includes(cat)
      ? ocultarCats.filter(c => c !== cat)
      : [...ocultarCats, cat];
    onChangeFilters({ ...filters, ocultarCategorias: next });
  };

  const toggleHideProjeto = (proj: string) => {
    const next = ocultarProjs.includes(proj)
      ? ocultarProjs.filter(p => p !== proj)
      : [...ocultarProjs, proj];
    onChangeFilters({ ...filters, ocultarProjetos: next });
  };

  const toggleHideFornecedor = (forn: string) => {
    const next = ocultarForns.includes(forn)
      ? ocultarForns.filter(f => f !== forn)
      : [...ocultarForns, forn];
    onChangeFilters({ ...filters, ocultarFornecedores: next });
  };

  const clearAllHidden = () => {
    onChangeFilters({
      ...filters,
      ocultarCategorias: [],
      ocultarProjetos: [],
      ocultarFornecedores: []
    });
  };

  const activeFiltersCount =
    filters.empresas.length +
    filters.periodos.length +
    filters.projetos.length +
    filters.categorias.length +
    filters.fornecedores.length +
    filters.contasCorrentes.length +
    (filters.search ? 1 : 0) +
    (filters.tipoPagamento && filters.tipoPagamento !== 'TODOS' ? 1 : 0) +
    (filters.somenteRecorrentes ? 1 : 0) +
    (filters.somenteAtrasados ? 1 : 0);

  // Alternância (Toggle) de Empresa com suporte a Múltipla Seleção
  const handleToggleEmpresa = (emp: string | null) => {
    if (!emp) {
      // Clicou em 'Todas as Empresas': limpa o filtro
      onChangeFilters({ ...filters, empresas: [] });
    } else {
      const isSelected = filters.empresas.some(e => e.toLowerCase() === emp.toLowerCase());
      const next = isSelected
        ? filters.empresas.filter(e => e.toLowerCase() !== emp.toLowerCase())
        : [...filters.empresas, emp];
      onChangeFilters({ ...filters, empresas: next });
    }
  };

  // Alternância (Toggle) de Período com suporte a Múltipla Seleção
  const handleTogglePeriodo = (per: string | null) => {
    if (!per) {
      // Clicou em 'Acumulado (Todos)': limpa o filtro de períodos
      onChangeFilters({ ...filters, periodos: [] });
    } else {
      const isSelected = filters.periodos.includes(per);
      const next = isSelected
        ? filters.periodos.filter(p => p !== per)
        : [...filters.periodos, per];
      onChangeFilters({ ...filters, periodos: next });
    }
  };

  // Atalhos rápidos de períodos
  const handleSelectUltimos3Meses = () => {
    const ultimos = availableOptions.periodos.slice(0, 3);
    onChangeFilters({ ...filters, periodos: ultimos });
  };

  const handleSelectAno2026 = () => {
    const meses2026 = availableOptions.periodos.filter(p => p.includes('/26'));
    onChangeFilters({ ...filters, periodos: meses2026 });
  };

  // Seleção rápida de Modalidade (À Vista vs Parcelado)
  const handleQuickTipoPagamento = (tipo: 'TODOS' | 'A_VISTA' | 'PARCELADO') => {
    onChangeFilters({ ...filters, tipoPagamento: tipo });
  };

  const isAllEmpresas = filters.empresas.length === 0;
  const isAllPeriodos = filters.periodos.length === 0;
  const currentTipoPagamento = filters.tipoPagamento || 'TODOS';

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm">
      
      {/* ── BARRA SUPERIOR DE CONTROLE & TOGGLE ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
            <Filter size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase">
                Filtros Multidimensionais
              </h2>
              {filters.empresas.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                  ⚡ {filters.empresas.length === 1 ? `Empresa: ${filters.empresas[0]}` : `${filters.empresas.length} Empresas: ${filters.empresas.join(' + ')}`}
                </span>
              )}
              {filters.periodos.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs">
                  🗓️ {filters.periodos.length === 1 ? `Mês: ${filters.periodos[0]}` : `${filters.periodos.length} Meses: ${filters.periodos.join(', ')}`}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {filters.empresas.length > 0
                ? `Opções de setores, categorias e favorecidos calibradas para ${filters.empresas.join(', ')}`
                : 'Selecione uma ou mais empresas e meses para apuração do caixa'}
            </p>
          </div>
          {activeFiltersCount > 0 && (
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              {activeFiltersCount} ativo{activeFiltersCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {activeFiltersCount > 0 && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-bold px-2.5 py-1.5 rounded-xl hover:bg-rose-50 border border-rose-100 transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Limpar Filtros</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-slate-600 hover:text-slate-900 font-bold px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>{isExpanded ? 'Recolher' : 'Expandir'}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── SELETORES RÁPIDOS MULTI-SELEÇÃO (EMPRESAS & MESES) ── */}
      <div className="pt-3 pb-1 space-y-3">
        
        {/* 1. SELETOR MULTI-SELEÇÃO DE EMPRESAS (Pills com Toggle) */}
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Building2 size={13} className="text-slate-400" /> Empresas:
            </span>
            {filters.empresas.length > 1 && (
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded-full border border-emerald-300">
                {filters.empresas.length} ativas
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => handleToggleEmpresa(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                isAllEmpresas
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              🏢 Todas as Empresas
            </button>
            {displayedEmpresas.map(emp => {
              const isActive = filters.empresas.some(e => e.toLowerCase() === emp.toLowerCase());
              return (
                <button
                  type="button"
                  key={emp}
                  onClick={() => handleToggleEmpresa(emp)}
                  title={isActive ? `Remover ${emp} da seleção` : `Adicionar ${emp} à seleção`}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {isActive && <Check size={12} className="stroke-[3]" />}
                  <span>{emp}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. SELETOR MULTI-SELEÇÃO DE PERÍODOS (Meses com Toggle) */}
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" /> Meses:
            </span>
            {filters.periodos.length > 1 && (
              <span className="text-[9px] bg-sky-100 text-sky-800 font-extrabold px-1.5 py-0.2 rounded-full border border-sky-300">
                {filters.periodos.length} selecionados
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => handleTogglePeriodo(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                isAllPeriodos
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Exibe a soma acumulada de todos os meses desde Junho/2025"
            >
              🗓️ Acumulado (Todos os Meses)
            </button>

            {availableOptions.periodos.slice(0, 10).map(per => {
              const isActive = filters.periodos.includes(per);
              return (
                <button
                  type="button"
                  key={per}
                  onClick={() => handleTogglePeriodo(per)}
                  title={isActive ? `Desmarcar ${per}` : `Selecionar ${per}`}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {isActive && <Check size={12} className="stroke-[3]" />}
                  <span>{per}</span>
                </button>
              );
            })}

            {/* Atalhos rápidos de meses */}
            <div className="flex items-center gap-1 pl-1 border-l border-slate-200 shrink-0">
              <button
                type="button"
                onClick={handleSelectUltimos3Meses}
                className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors shrink-0 cursor-pointer"
                title="Seleciona os 3 meses mais recentes"
              >
                Últimos 3m
              </button>
              <button
                type="button"
                onClick={handleSelectAno2026}
                className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors shrink-0 cursor-pointer"
                title="Seleciona todos os meses de 2026"
              >
                Ano 2026
              </button>
            </div>
          </div>
        </div>

        {/* 3. SELETOR RÁPIDO DE MODALIDADE (À VISTA OU PARCELADO) */}
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <CreditCard size={13} className="text-slate-400" /> Modalidade:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => handleQuickTipoPagamento('TODOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                currentTipoPagamento === 'TODOS'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              🔄 Todos os Pagamentos {availableOptions.counts?.total !== undefined ? `(${availableOptions.counts.total})` : ''}
            </button>
            <button
              type="button"
              onClick={() => handleQuickTipoPagamento('A_VISTA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                currentTipoPagamento === 'A_VISTA'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              ⚡ À Vista (Único) {availableOptions.counts?.aVista !== undefined ? `(${availableOptions.counts.aVista})` : ''}
            </button>
            <button
              type="button"
              onClick={() => handleQuickTipoPagamento('PARCELADO')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                currentTipoPagamento === 'PARCELADO'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              💳 Compras Parceladas {availableOptions.counts?.parcelado !== undefined ? `(${availableOptions.counts.parcelado})` : ''}
            </button>
          </div>
        </div>

        {/* 4. FILTROS RÁPIDOS DE INTELIGÊNCIA: SERVIÇOS RECORRENTES & EM ATRASO */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 pt-1 border-t border-slate-100/80">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            ⚡ Auditoria Rápida:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {/* Botão Somente Recorrentes (Serviços e Estruturais contínuos, separando de parcelados) */}
            <button
              type="button"
              onClick={() => onChangeFilters({ ...filters, somenteRecorrentes: !filters.somenteRecorrentes })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                filters.somenteRecorrentes
                  ? 'bg-purple-700 text-white border-purple-700 shadow-sm ring-2 ring-purple-400/30'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50 hover:text-purple-800 hover:border-purple-300'
              }`}
              title="Exibe somente despesas operacionais e serviços recorrentes (folha, aluguéis, contabilidade, tarifas e concessionárias), separando de compras e aquisições parceladas"
            >
              <Repeat size={13} className={filters.somenteRecorrentes ? 'text-purple-200' : 'text-purple-600'} />
              <span>Somente Serviços Recorrentes</span>
              {availableOptions.counts?.recorrentes !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  filters.somenteRecorrentes ? 'bg-purple-900/60 text-purple-100' : 'bg-purple-100 text-purple-800'
                }`}>
                  {availableOptions.counts.recorrentes}
                </span>
              )}
            </button>

            {/* Botão Somente com Atrasos (Recebimentos e Pagamentos) */}
            <button
              type="button"
              onClick={() => onChangeFilters({ ...filters, somenteAtrasados: !filters.somenteAtrasados })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                filters.somenteAtrasados
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-400/30'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300'
              }`}
              title="Exibe exclusivamente os lançamentos com atraso liquidado (> 0 dias), sejam recebimentos de clientes ou pagamentos a fornecedores"
            >
              <AlertTriangle size={13} className={filters.somenteAtrasados ? 'text-rose-200' : 'text-rose-600'} />
              <span>Somente Lançamentos com Atraso</span>
              {availableOptions.counts?.atrasados !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  filters.somenteAtrasados ? 'bg-rose-900/60 text-rose-100' : 'bg-rose-100 text-rose-800'
                }`}>
                  {availableOptions.counts.atrasados}
                </span>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* ── DROPDOWNS MULTIDIMENSIONAIS AVANÇADOS ── */}
      {isExpanded && (
        <div className="space-y-3 pt-4 border-t border-slate-100 mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {/* 1. Empresa */}
            <SearchableMultiSelect
              label="Empresa"
              icon={<Building2 size={13} />}
              options={availableOptions.empresas}
              selected={filters.empresas}
              onChange={selected => onChangeFilters({ ...filters, empresas: selected })}
              placeholder="Buscar empresa..."
            />

            {/* 2. Período */}
            <SearchableMultiSelect
              label="Período"
              icon={<Calendar size={13} />}
              options={availableOptions.periodos}
              selected={filters.periodos}
              onChange={selected => onChangeFilters({ ...filters, periodos: selected })}
              placeholder="Ex: Ago/26..."
            />

            {/* 3. Projeto / Setor */}
            <SearchableMultiSelect
              label="Setor (Projeto)"
              icon={<Layers size={13} />}
              options={availableOptions.projetos}
              selected={filters.projetos}
              onChange={selected => onChangeFilters({ ...filters, projetos: selected })}
              placeholder="Setor / Projeto..."
              hiddenOptions={filters.ocultarProjetos}
              onToggleHide={toggleHideProjeto}
            />

            {/* 4. Categoria */}
            <SearchableMultiSelect
              label="Categoria"
              icon={<Tag size={13} />}
              options={availableOptions.categorias}
              selected={filters.categorias}
              onChange={selected => onChangeFilters({ ...filters, categorias: selected })}
              placeholder="Buscar categoria..."
              hiddenOptions={filters.ocultarCategorias}
              onToggleHide={toggleHideCategoria}
            />

            {/* 5. Fornecedor / Cliente */}
            <SearchableMultiSelect
              label="Fornecedor/Cliente"
              icon={<UserCheck size={13} />}
              options={availableOptions.fornecedores}
              selected={filters.fornecedores}
              onChange={selected => onChangeFilters({ ...filters, fornecedores: selected })}
              placeholder="Buscar parceiro..."
              hiddenOptions={filters.ocultarFornecedores}
              onToggleHide={toggleHideFornecedor}
            />

            {/* 6. Conta Corrente */}
            <SearchableMultiSelect
              label="Conta Corrente"
              icon={<CreditCard size={13} />}
              options={availableOptions.contasCorrentes}
              selected={filters.contasCorrentes}
              onChange={selected => onChangeFilters({ ...filters, contasCorrentes: selected })}
              placeholder="Banco ou caixa..."
            />
          </div>

          {/* Busca Textual Livre */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={e => onChangeFilters({ ...filters, search: e.target.value })}
              placeholder="Pesquisar por fornecedor, categoria, documento ou palavra-chave..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
            />
            {filters.search && (
              <button
                onClick={() => onChangeFilters({ ...filters, search: '' })}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Banner de Dados Sensíveis Ocultos */}
          {totalOcultos > 0 && (
            <div className="pt-2.5 mt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1 shrink-0">
                  <ShieldAlert size={14} className="text-amber-600" />
                  Dados Sensíveis Ocultos ({totalOcultos}):
                </span>
                {ocultarCats.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 text-[10px] font-medium bg-white border border-amber-200 text-amber-950 px-2 py-0.5 rounded-md shadow-2xs">
                    <span className="font-bold text-amber-600 uppercase text-[9px]">Cat:</span>
                    <span className="max-w-[120px] truncate">{c}</span>
                    <button onClick={() => toggleHideCategoria(c)} className="text-slate-400 hover:text-amber-800 ml-0.5 cursor-pointer"><X size={10} /></button>
                  </span>
                ))}
                {ocultarProjs.map(p => (
                  <span key={p} className="inline-flex items-center gap-1 text-[10px] font-medium bg-white border border-amber-200 text-amber-950 px-2 py-0.5 rounded-md shadow-2xs">
                    <span className="font-bold text-amber-600 uppercase text-[9px]">Proj:</span>
                    <span className="max-w-[120px] truncate">{p}</span>
                    <button onClick={() => toggleHideProjeto(p)} className="text-slate-400 hover:text-amber-800 ml-0.5 cursor-pointer"><X size={10} /></button>
                  </span>
                ))}
                {ocultarForns.map(f => (
                  <span key={f} className="inline-flex items-center gap-1 text-[10px] font-medium bg-white border border-amber-200 text-amber-950 px-2 py-0.5 rounded-md shadow-2xs">
                    <span className="font-bold text-amber-600 uppercase text-[9px]">Forn:</span>
                    <span className="max-w-[120px] truncate">{f}</span>
                    <button onClick={() => toggleHideFornecedor(f)} className="text-slate-400 hover:text-amber-800 ml-0.5 cursor-pointer"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onOpenPrivacyModal && (
                  <button
                    type="button"
                    onClick={onOpenPrivacyModal}
                    className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                  >
                    Gerenciar
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAllHidden}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                >
                  Limpar Ocultações
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
