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
  RotateCcw
} from 'lucide-react';
import { DreCaixaFilters } from '@/types/dre-caixa';

interface MultiSelectProps {
  label: string;
  icon: React.ReactNode;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

function SearchableMultiSelect({
  label,
  icon,
  options,
  selected,
  onChange,
  placeholder = "Pesquisar..."
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

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs font-medium transition-all shadow-sm h-10"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="text-slate-400">{icon}</span>
          <span className="text-slate-400 font-semibold">{label}:</span>
          <span className={`truncate font-semibold ${selected.length > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
            {summaryText}
          </span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[240px] max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2.5 backdrop-blur-md">
          {/* Campo de Busca Rápida */}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Ações Rápidas */}
          <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={selectAll}
              className="text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              Marcar Todos
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-slate-400 hover:text-slate-300"
            >
              Limpar
            </button>
          </div>

          {/* Lista de Opções */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
            {filteredOptions.length === 0 ? (
              <div className="text-slate-500 text-center py-3 text-xs">Nenhum item encontrado</div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = selected.includes(opt);
                return (
                  <label
                    key={opt}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-500/15 text-emerald-300 font-medium' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOption(opt)}
                      className="rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="truncate">{opt}</span>
                  </label>
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
}

export function DreCaixaFiltersBar({
  availableOptions,
  filters,
  onChangeFilters,
  onClearFilters
}: DreCaixaFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const activeFiltersCount =
    filters.empresas.length +
    filters.periodos.length +
    filters.projetos.length +
    filters.categorias.length +
    filters.fornecedores.length +
    filters.contasCorrentes.length +
    (filters.search ? 1 : 0);

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 sm:p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
            <Filter size={15} />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase">
            Filtros Multidimensionais de Caixa
          </h2>
          {activeFiltersCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {activeFiltersCount} ativo{activeFiltersCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-medium px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Limpar Todos</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1"
          >
            <span>{isExpanded ? 'Recolher' : 'Expandir'}</span>
            <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-1">
          {/* Grid de Dropdowns Principais */}
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
              placeholder="Ex: Jan/25..."
            />

            {/* 3. Projeto / Setor */}
            <SearchableMultiSelect
              label="Setor (Projeto)"
              icon={<Layers size={13} />}
              options={availableOptions.projetos}
              selected={filters.projetos}
              onChange={selected => onChangeFilters({ ...filters, projetos: selected })}
              placeholder="Setor / Projeto..."
            />

            {/* 4. Categoria */}
            <SearchableMultiSelect
              label="Categoria"
              icon={<Tag size={13} />}
              options={availableOptions.categorias}
              selected={filters.categorias}
              onChange={selected => onChangeFilters({ ...filters, categorias: selected })}
              placeholder="Buscar categoria..."
            />

            {/* 5. Fornecedor / Cliente */}
            <SearchableMultiSelect
              label="Fornecedor/Cliente"
              icon={<UserCheck size={13} />}
              options={availableOptions.fornecedores}
              selected={filters.fornecedores}
              onChange={selected => onChangeFilters({ ...filters, fornecedores: selected })}
              placeholder="Buscar parceiro..."
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
            <Search size={14} className="absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={filters.search}
              onChange={e => onChangeFilters({ ...filters, search: e.target.value })}
              placeholder="Pesquisar por fornecedor, categoria, documento ou palavra-chave..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
            />
            {filters.search && (
              <button
                onClick={() => onChangeFilters({ ...filters, search: '' })}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
