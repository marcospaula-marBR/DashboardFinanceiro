"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Briefcase,
  Clock,
  AlertTriangle,
  Repeat
} from 'lucide-react';
import { DrePainelFilters } from '@/types/dre-painel';

interface MultiSelectProps {
  label: string;
  icon: React.ReactNode;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

function DropdownMultiSelect({
  label,
  icon,
  options,
  selected,
  onChange,
  placeholder = "Buscar..."
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

  const filteredOptions = useMemo(() => {
    return options.filter(opt =>
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(item => item !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const selectAll = () => onChange([...options]);
  const clearAll = () => onChange([]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-xs cursor-pointer ${
          selected.length > 0
            ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-400/20'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <span className={selected.length > 0 ? "text-emerald-600" : "text-slate-400"}>
          {icon}
        </span>
        <span className="font-bold">{label}</span>
        {selected.length > 0 && (
          <span className="bg-emerald-600 text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold">
            {selected.length}
          </span>
        )}
        <ChevronDown size={12} className="text-slate-400 ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs">
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-between items-center px-1 mb-2 text-[10px] text-slate-500 border-b border-slate-100 pb-1">
            <button type="button" onClick={selectAll} className="text-emerald-600 hover:underline font-bold cursor-pointer">
              Marcar todos ({options.length})
            </button>
            <button type="button" onClick={clearAll} className="text-slate-500 hover:underline cursor-pointer">
              Limpar
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs">Nenhum resultado</div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleOption(opt)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                  >
                    <span className={`truncate mr-2 ${isChecked ? 'font-bold text-emerald-950' : 'text-slate-700'}`}>
                      {opt}
                    </span>
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                      isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'
                    }`}>
                      {isChecked && <Check size={10} />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface DrePainelFiltersBarProps {
  filters: DrePainelFilters;
  onFilterChange: (newFilters: DrePainelFilters) => void;
  empresaOptions: string[];
  periodoOptions: string[];
  contaDreOptions: string[];
  deptoOptions: string[];
  projetoOptions: string[];
  categoriaOptions: string[];
  fornecedorOptions: string[];
  contaCorrenteOptions: string[];
  totalAtrasadosCount?: number;
}

export function DrePainelFiltersBar({
  filters,
  onFilterChange,
  empresaOptions,
  periodoOptions,
  contaDreOptions,
  deptoOptions,
  projetoOptions,
  categoriaOptions,
  fornecedorOptions,
  contaCorrenteOptions,
  totalAtrasadosCount = 0
}: DrePainelFiltersBarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Filtrar as opções de período de acordo com o subfiltro de ano ativo
  const filteredPeriodoOptions = useMemo(() => {
    if (!filters.ano || filters.ano === 'TODOS') return periodoOptions;
    const shortYear = filters.ano.slice(-2);
    return periodoOptions.filter(p => p.endsWith(`/${shortYear}`));
  }, [periodoOptions, filters.ano]);

  const activeFiltersCount =
    filters.empresas.length +
    filters.periodos.length +
    filters.contasDre.length +
    filters.departamentos.length +
    filters.projetos.length +
    filters.categorias.length +
    filters.fornecedores.length +
    filters.contasCorrentes.length +
    (filters.ano && filters.ano !== 'TODOS' ? 1 : 0) +
    (filters.filtroParcelamento !== 'TODOS' ? 1 : 0) +
    (filters.filtroStatusVencimento !== 'TODOS' ? 1 : 0) +
    (filters.filtroRecorrencia !== 'TODOS' ? 1 : 0) +
    (filters.search ? 1 : 0);

  const handleReset = () => {
    onFilterChange({
      ...filters,
      empresas: [],
      periodos: [],
      contasDre: [],
      departamentos: [],
      projetos: [],
      categorias: [],
      fornecedores: [],
      contasCorrentes: [],
      ano: 'TODOS',
      filtroParcelamento: 'TODOS',
      filtroStatusVencimento: 'TODOS',
      filtroRecorrencia: 'TODOS',
      search: ''
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-3">
      {/* Linha Superior: Busca Rápida + Subfiltro de Ano + MultiSelects + Ações */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Campo de Busca Rápida */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar fornecedor, doc..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, search: '' })}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* 1. Subfiltro Obrigatório no Período para Seleção do Ano */}
        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          <span className="text-[10px] font-bold text-slate-500 px-1.5 uppercase">Ano:</span>
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: '2024', label: '2024' },
            { id: '2025', label: '2025' },
            { id: '2026', label: '2026' }
          ].map(anoOption => {
            const isSelected = (filters.ano || 'TODOS') === anoOption.id;
            return (
              <button
                key={anoOption.id}
                type="button"
                onClick={() => onFilterChange({ ...filters, ano: anoOption.id })}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {anoOption.label}
              </button>
            );
          })}
        </div>

        {/* MultiSelects Principais */}
        <DropdownMultiSelect
          label="Empresa"
          icon={<Building2 size={13} />}
          options={empresaOptions}
          selected={filters.empresas}
          onChange={(empresas) => onFilterChange({ ...filters, empresas })}
        />

        <DropdownMultiSelect
          label={filters.ano && filters.ano !== 'TODOS' ? `Período (${filters.ano})` : "Período"}
          icon={<Calendar size={13} />}
          options={filteredPeriodoOptions}
          selected={filters.periodos}
          onChange={(periodos) => onFilterChange({ ...filters, periodos })}
        />

        <DropdownMultiSelect
          label="Conta DRE"
          icon={<Layers size={13} />}
          options={contaDreOptions}
          selected={filters.contasDre}
          onChange={(contasDre) => onFilterChange({ ...filters, contasDre })}
        />

        <DropdownMultiSelect
          label="Conta Bancária"
          icon={<CreditCard size={13} />}
          options={contaCorrenteOptions}
          selected={filters.contasCorrentes}
          onChange={(contasCorrentes) => onFilterChange({ ...filters, contasCorrentes })}
        />

        {/* Botão de Toggle Filtros Avançados */}
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            isAdvancedOpen
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Filter size={12} />
          <span>Mais Filtros</span>
          {activeFiltersCount > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] px-1.5 rounded-full font-bold">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Limpar</span>
          </button>
        )}
      </div>

      {/* Painel de Filtros Avançados / Granulares */}
      {isAdvancedOpen && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          {/* Departamento (com Rateio) */}
          <DropdownMultiSelect
            label="Depto / Rateio"
            icon={<Briefcase size={13} />}
            options={deptoOptions}
            selected={filters.departamentos}
            onChange={(departamentos) => onFilterChange({ ...filters, departamentos })}
          />

          {/* Projeto */}
          <DropdownMultiSelect
            label="Projeto"
            icon={<Layers size={13} />}
            options={projetoOptions}
            selected={filters.projetos}
            onChange={(projetos) => onFilterChange({ ...filters, projetos })}
          />

          {/* Categoria */}
          <DropdownMultiSelect
            label="Categoria"
            icon={<Tag size={13} />}
            options={categoriaOptions}
            selected={filters.categorias}
            onChange={(categorias) => onFilterChange({ ...filters, categorias })}
          />

          {/* Fornecedor / Cliente */}
          <DropdownMultiSelect
            label="Fornecedor / Cliente"
            icon={<UserCheck size={13} />}
            options={fornecedorOptions}
            selected={filters.fornecedores}
            onChange={(fornecedores) => onFilterChange({ ...filters, fornecedores })}
          />

          {/* Seletor Granular de Parcelamento */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-xs">
            <span className="text-[10px] font-bold text-slate-400 px-1.5 uppercase">Parcelas:</span>
            {[
              { id: 'TODOS', label: 'Todas' },
              { id: 'A_VISTA', label: 'À Vista' },
              { id: 'PARCELADO_GERAL', label: 'Parcelado (1/x)' },
              { id: 'PARCELA_ANTERIOR', label: 'Anterior (>1/x)' },
              { id: 'LONGO_PRAZO', label: '> 12 Meses' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilterChange({ ...filters, filtroParcelamento: item.id as any })}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  filters.filtroParcelamento === item.id
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Seletor de Status / Atrasos */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-xs">
            <span className="text-[10px] font-bold text-slate-400 px-1.5 uppercase">Vencimento:</span>
            {[
              { id: 'TODOS', label: 'Todos' },
              {
                id: 'EM_ATRASO',
                label: `Atrasados ${totalAtrasadosCount > 0 ? `(${totalAtrasadosCount})` : ''}`,
                isAlert: totalAtrasadosCount > 0
              },
              { id: 'A_VENCER', label: 'A Vencer' },
              { id: 'PAGO', label: 'Pagos' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilterChange({ ...filters, filtroStatusVencimento: item.id as any })}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  filters.filtroStatusVencimento === item.id
                    ? item.isAlert
                      ? 'bg-rose-600 text-white font-bold shadow-xs'
                      : 'bg-emerald-600 text-white font-bold shadow-xs'
                    : item.isAlert
                    ? 'text-rose-600 font-bold hover:bg-rose-50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Seletor de Recorrência */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-xs">
            <span className="text-[10px] font-bold text-slate-400 px-1.5 uppercase">Tipo:</span>
            {[
              { id: 'TODOS', label: 'Todos' },
              { id: 'SOMENTE_RECORRENTES', label: 'Recorrentes' },
              { id: 'SOMENTE_PONTUAIS', label: 'Compras Pontuais' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilterChange({ ...filters, filtroRecorrencia: item.id as any })}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  filters.filtroRecorrencia === item.id
                    ? 'bg-slate-900 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
