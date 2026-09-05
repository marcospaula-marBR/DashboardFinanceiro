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
  Shield
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
            <button
              type="button"
              onClick={selectAll}
              className="text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
            >
              Marcar Todos
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
            >
              Limpar
            </button>
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

  // Lista de empresas prioritárias no ecossistema
  const quickEmpresas = ['Mar Brasil', 'DZM', 'G2', 'Conectius'];

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
    (filters.search ? 1 : 0);

  // Seleção rápida de Empresa (Pill Selector de 1 clique)
  const handleQuickEmpresa = (emp: string | null) => {
    if (!emp) {
      onChangeFilters({ ...filters, empresas: [] });
    } else {
      onChangeFilters({ ...filters, empresas: [emp] });
    }
  };

  // Seleção rápida de Período (Pill Selector de 1 clique)
  const handleQuickPeriodo = (per: string | null) => {
    if (!per) {
      onChangeFilters({ ...filters, periodos: [] });
    } else {
      onChangeFilters({ ...filters, periodos: [per] });
    }
  };

  const isAllEmpresas = filters.empresas.length === 0;
  const isAllPeriodos = filters.periodos.length === 0;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm">
      
      {/* ── BARRA SUPERIOR DE CONTROLE & TOGGLE ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
            <Filter size={15} />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase">
              Filtros Multidimensionais
            </h2>
            <p className="text-[11px] text-slate-500">Selecione a empresa e período para apuração do caixa</p>
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
              className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-bold px-2.5 py-1.5 rounded-xl hover:bg-rose-50 border border-rose-100 transition-colors"
            >
              <RotateCcw size={13} />
              <span>Limpar Filtros</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-slate-600 hover:text-slate-900 font-bold px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>{isExpanded ? 'Recolher' : 'Expandir'}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── SELETORES RÁPIDOS DE 1 CLIQUE (EMPRESA & PERÍODO) ── */}
      <div className="pt-3 pb-1 space-y-3">
        
        {/* 1. SELETOR RÁPIDO DE EMPRESA (TABS EXECUTIVAS) */}
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Building2 size={13} className="text-slate-400" /> Empresa:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => handleQuickEmpresa(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                isAllEmpresas
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              🏢 Todas as Empresas
            </button>
            {quickEmpresas.map(emp => {
              const isActive = filters.empresas.length === 1 && filters.empresas[0].toLowerCase() === emp.toLowerCase();
              return (
                <button
                  key={emp}
                  onClick={() => handleQuickEmpresa(emp)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {emp}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. SELETOR RÁPIDO DE PERÍODO (MESES RECENTES) */}
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Calendar size={13} className="text-slate-400" /> Período:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => handleQuickPeriodo(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                isAllPeriodos
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Exibe a soma acumulada de todos os meses desde Junho/2025"
            >
              🗓️ Acumulado (Todos os Meses)
            </button>
            {availableOptions.periodos.slice(0, 8).map(per => {
              const isActive = filters.periodos.length === 1 && filters.periodos[0] === per;
              return (
                <button
                  key={per}
                  onClick={() => handleQuickPeriodo(per)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {per}
                </button>
              );
            })}
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
