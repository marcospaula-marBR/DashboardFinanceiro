"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { UploadCloud, Filter, XCircle, Building2, Calendar, FolderTree, Landmark, Target, Tags, ChevronLeft, ChevronDown, Search } from 'lucide-react';
import { DreFilters, DreMetadata, DreRow } from '@/types/dre';

// ── Extrai anos únicos de uma lista de períodos (ex: "Jan/24" → "2024") ───────
function extractYears(periodos: string[]): string[] {
  const years = new Set<string>();
  periodos.forEach(p => {
    const match = p.match(/\/(\d{2})$/);
    if (match) years.add(`20${match[1]}`);
  });
  return Array.from(years).sort();
}

// ── Multi-select dropdown genérico para a Sidebar ──────────────────────────────
interface MultiSelectProps {
  label: string;
  icon?: React.ReactNode;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  onClear: () => void;
  searchable?: boolean;
  placeholder?: string;
  compact?: boolean;
  fullWidth?: boolean;
}

function MultiSelectDropdown({
  label, icon, options, selected, onToggle, onClear,
  searchable = false, placeholder = 'Buscar...', compact = false, fullWidth = false
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = searchable
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const displayLabel = selected.length === 0
    ? 'Todos'
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selecionados`;

  return (
    <div ref={ref} className={`relative ${fullWidth ? 'w-full' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center justify-between gap-1.5 bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 hover:border-slate-600 hover:bg-slate-750 transition-all duration-200 ${compact ? 'text-xs px-2.5 py-1.5' : 'text-sm'} ${fullWidth ? 'w-full' : ''} text-left shadow-sm`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
          <span className="font-bold text-slate-350 text-xs uppercase tracking-wider">{label}:</span>
          <span className={`truncate text-sm font-semibold ${selected.length > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
            {displayLabel}
          </span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform flex-shrink-0 duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl w-full min-w-[240px] max-h-[320px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700 flex-shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            {selected.length > 0 && (
              <button type="button" onClick={onClear} className="text-[10px] text-amber-500 hover:text-amber-400 font-semibold cursor-pointer">
                Limpar ({selected.length})
              </button>
            )}
          </div>
          {/* Search */}
          {searchable && (
            <div className="px-2 py-1.5 border-b border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5">
                <Search size={12} className="text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={placeholder}
                  className="bg-transparent text-white text-xs w-full focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>
          )}
          {/* Options */}
          <div className="overflow-y-auto py-1 flex-1 scrollbar-thin">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-500 px-3 py-2">Nenhum resultado</p>
            ) : (
              filtered.map(opt => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => onToggle(opt)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center
                    ${selected.includes(opt) ? 'bg-amber-500 border-amber-500' : 'border-slate-600 bg-slate-900'}`}
                  >
                    {selected.includes(opt) && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={`truncate ${selected.includes(opt) ? 'text-amber-300 font-semibold' : 'text-slate-350'}`}>
                    {opt}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface DreSidebarProps {
  metadata: DreMetadata | null;
  rawData: DreRow[];
  filters: DreFilters;
  onFilterChange: (filters: DreFilters) => void;
  onFileUpload: (file: File) => void;
  isUploading: boolean;
  fileName: string | null;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function DreSidebar({ 
  metadata, 
  rawData,
  filters, 
  onFilterChange, 
  onFileUpload, 
  isUploading,
  fileName,
  isSidebarCollapsed,
  onToggleSidebar
}: DreSidebarProps) {
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  const [selectedYear, setSelectedYear] = useState<string>(() => {
    if (filters.periodos && filters.periodos.length > 0) {
      const match = filters.periodos[0].match(/\/(\d{2})$/);
      if (match) {
        const year2d = match[1];
        const allSameYear = filters.periodos.every(p => p.endsWith(`/${year2d}`));
        if (allSameYear) return `20${year2d}`;
      }
    }
    return 'Todos';
  });

  useEffect(() => {
    if (!filters.periodos || filters.periodos.length === 0) {
      setSelectedYear('Todos');
    } else {
      const match = filters.periodos[0].match(/\/(\d{2})$/);
      if (match) {
        const year2d = match[1];
        const allSameYear = filters.periodos.every(p => p.endsWith(`/${year2d}`));
        if (allSameYear) {
          setSelectedYear(`20${year2d}`);
        } else {
          setSelectedYear('Todos');
        }
      }
    }
  }, [filters.periodos]);

  // CASCADING FILTERS LOGIC
  
  // 1. Available Empresas (global metadata)
  const availableEmpresas = useMemo(() => {
    return metadata?.empresas || [];
  }, [metadata]);

  // 2. Available Periodos (global metadata)
  const availablePeriodos = useMemo(() => {
    return metadata?.periodos || [];
  }, [metadata]);

  // 3. Filter raw data based on selected Empresa
  const rowsFilteredByEmpresa = useMemo(() => {
    if (!filters.empresas || filters.empresas.length === 0) return rawData;
    return rawData.filter(r => filters.empresas.includes(r.Empresa));
  }, [rawData, filters.empresas]);

  // 4. Available Departamentos from current Empresa subset
  const availableDepartamentos = useMemo(() => {
    const depts = new Set<string>();
    rowsFilteredByEmpresa.forEach(r => {
      if (r.Departamento) depts.add(r.Departamento);
    });
    return Array.from(depts).sort();
  }, [rowsFilteredByEmpresa]);

  // 5. Filter subset further by selected Departamentos
  const rowsFilteredByDept = useMemo(() => {
    if (!filters.departamentos || filters.departamentos.length === 0) return rowsFilteredByEmpresa;
    return rowsFilteredByEmpresa.filter(r => filters.departamentos.includes(r.Departamento));
  }, [rowsFilteredByEmpresa, filters.departamentos]);

  // 6. Available ContaDRE from current Dept subset
  const availableContasDre = useMemo(() => {
    const contas = new Set<string>();
    rowsFilteredByDept.forEach(r => {
      if (r.ContaDRE) contas.add(r.ContaDRE);
    });
    return Array.from(contas).sort();
  }, [rowsFilteredByDept]);

  // 7. Filter subset further by selected ContaDRE
  const rowsFilteredByConta = useMemo(() => {
    if (!filters.contasDre || filters.contasDre.length === 0) return rowsFilteredByDept;
    return rowsFilteredByDept.filter(r => filters.contasDre.includes(r.ContaDRE));
  }, [rowsFilteredByDept, filters.contasDre]);

  // 8. Available Projetos from current ContaDRE subset
  const availableProjetos = useMemo(() => {
    const projs = new Set<string>();
    rowsFilteredByConta.forEach(r => {
      if (r.Projeto) projs.add(r.Projeto);
    });
    return Array.from(projs).sort();
  }, [rowsFilteredByConta]);

  // 9. Filter subset further by selected Projetos
  const rowsFilteredByProjeto = useMemo(() => {
    if (!filters.projetos || filters.projetos.length === 0) return rowsFilteredByConta;
    return rowsFilteredByConta.filter(r => filters.projetos.includes(r.Projeto));
  }, [rowsFilteredByConta, filters.projetos]);

  // 10. Available Categorias from current Projetos subset
  const availableCategorias = useMemo(() => {
    const cats = new Set<string>();
    rowsFilteredByProjeto.forEach(r => {
      if (r.Categoria) cats.add(r.Categoria);
    });
    return Array.from(cats).sort();
  }, [rowsFilteredByProjeto]);

  // Helper to handle filter selection
  const toggleFilter = (key: Exclude<keyof DreFilters, 'excludeSharedExpenses'>, value: string) => {
    const current = [...(filters[key] || [])];
    const index = current.indexOf(value);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(value);
    }
    
    // Cascading reset: when a parent level changes, reset child filters if they are no longer in available list
    const updatedFilters = { ...filters, [key]: current };
    
    if (key === 'empresas') {
      // Re-verify depts, contas, projects, cats are still in valid available lists after this change
      // For simplicity, we can let the parent render resolve them or reset them if they no longer apply
    }
    
    onFilterChange(updatedFilters);
  };

  const clearFilters = () => {
    onFilterChange({
      empresas: [],
      periodos: [],
      departamentos: [],
      contasDre: [],
      projetos: [],
      categorias: [],
      excludeSharedExpenses: false
    });
  };

  const clearGroup = (key: Exclude<keyof DreFilters, 'excludeSharedExpenses'>) => {
    onFilterChange({
      ...filters,
      [key]: []
    });
  };

  const toggleAll = (key: Exclude<keyof DreFilters, 'excludeSharedExpenses'>, availableItems: string[]) => {
    if (availableItems.length === 0) return;
    const isAllSelected = (filters[key] || []).length === availableItems.length;
    onFilterChange({
      ...filters,
      [key]: isAllSelected ? [] : [...availableItems]
    });
  };

  const hasActiveFilters = 
    filters.empresas.length > 0 || 
    filters.periodos.length > 0 || 
    filters.departamentos.length > 0 || 
    filters.contasDre.length > 0 || 
    filters.projetos.length > 0 || 
    filters.categorias.length > 0 ||
    !!filters.excludeSharedExpenses;

  return (
    <aside className="w-80 flex-shrink-0 bg-slate-900 text-slate-100 flex flex-col h-screen border-r border-slate-800 select-none">
      {/* Header / Brand */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-orange-900/20">
            DF
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white tracking-wide">DRE Financeiro</h1>
            <p className="text-xs text-slate-400 font-medium">Painel de Controladoria v3</p>
          </div>
        </div>
        {onToggleSidebar && (
          <button 
            onClick={onToggleSidebar}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all duration-200 active:scale-95 shadow-sm"
            title="Recolher Filtros"
          >
            <ChevronLeft size={14} />
            <span className="text-xs font-bold">Recolher</span>
          </button>
        )}
      </div>

      {/* CSV File Upload Section */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/40">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
          Origem dos Dados
        </label>
        
        <div className="relative">
          <input 
            type="file" 
            accept=".csv"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
            id="csv-upload-input"
          />
          
          <label 
            htmlFor="csv-upload-input"
            className={`flex flex-col items-center justify-center border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
              isUploading 
                ? 'border-amber-500/50 bg-amber-500/5' 
                : fileName 
                  ? 'border-slate-700 bg-slate-800/40 hover:bg-slate-800/60 hover:border-slate-600' 
                  : 'border-slate-800 bg-slate-900/40 hover:bg-slate-900/80 hover:border-slate-700'
            }`}
          >
            <UploadCloud className={`h-6 w-6 mb-2 transition-transform duration-300 ${isUploading ? 'animate-bounce text-amber-500' : 'text-slate-400'}`} />
            
            {isUploading ? (
              <span className="text-xs text-amber-400 font-semibold animate-pulse">Processando CSV...</span>
            ) : fileName ? (
              <div className="w-full px-2">
                <span className="text-xs text-slate-300 font-medium block truncate max-w-full" title={fileName}>
                  {fileName}
                </span>
                <span className="text-[10px] text-amber-500 font-semibold mt-1 block">Clique para alterar</span>
              </div>
            ) : (
              <div className="px-2">
                <span className="text-xs text-slate-300 font-semibold block">Carregar CSV da Omie</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Formatos aceitos: .csv</span>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Filters Form Container */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Filter size={12} className="text-amber-500" />
            Filtros Dinâmicos
          </span>
          {hasActiveFilters && (
            <button 
              onClick={clearFilters}
              className="text-[10px] text-slate-500 hover:text-amber-500 font-bold transition-colors flex items-center gap-1"
            >
              <XCircle size={10} />
              Limpar Todos
            </button>
          )}
        </div>

        {rawData.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-950/20 rounded-xl border border-slate-800">
            <p className="text-xs text-slate-500">Envie um arquivo CSV para habilitar os filtros interativos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* TOGGLE EXCLUDE SHARED EXPENSES */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-sm">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-slate-200">
                  Desconsiderar Despesas Rateadas
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  Zera despesas administrativas e financeiras para fins operacionais
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onFilterChange({
                    ...filters,
                    excludeSharedExpenses: !filters.excludeSharedExpenses
                  });
                }}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  filters.excludeSharedExpenses ? 'bg-amber-500' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={filters.excludeSharedExpenses}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    filters.excludeSharedExpenses ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 1. EMPRESAS */}
            <div className="w-full">
              <MultiSelectDropdown
                label="Empresas"
                icon={<Building2 size={13} />}
                options={availableEmpresas}
                selected={filters.empresas}
                onToggle={(v) => toggleFilter('empresas', v)}
                onClear={() => clearGroup('empresas')}
                searchable={availableEmpresas.length > 5}
                placeholder="Buscar empresa..."
                fullWidth
              />
            </div>

            {/* 2. HIERARQUIA TEMPORAL (Ano/Mês) */}
            <div className="space-y-3">
              {/* Seletor de Ano */}
              <div className="w-full">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 select-none">
                  <Calendar size={12} />
                  Ano de Referência
                </label>
                <select
                  value={selectedYear}
                  onChange={e => {
                    const ano = e.target.value;
                    setSelectedYear(ano);
                    if (ano === 'Todos') {
                      onFilterChange({
                        ...filters,
                        periodos: []
                      });
                    } else {
                      const ano2d = ano.slice(2);
                      const periodsOfYear = availablePeriodos.filter(p => p.endsWith(`/${ano2d}`));
                      onFilterChange({
                        ...filters,
                        periodos: periodsOfYear
                      });
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 hover:border-slate-600 transition-colors cursor-pointer shadow-sm font-semibold"
                >
                  <option value="Todos">Todos os Anos</option>
                  {extractYears(availablePeriodos).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Seletor de Mês (exibido apenas se um Ano específico for selecionado) */}
              {selectedYear !== 'Todos' && (
                <div className="w-full">
                  <MultiSelectDropdown
                    label="Meses"
                    icon={<Calendar size={13} />}
                    options={(() => {
                      const ano2d = selectedYear.slice(2);
                      return availablePeriodos.filter(p => p.endsWith(`/${ano2d}`));
                    })()}
                    selected={filters.periodos}
                    onToggle={(v) => {
                      let current = [...filters.periodos];
                      const ano2d = selectedYear.slice(2);
                      const periodsOfYear = availablePeriodos.filter(p => p.endsWith(`/${ano2d}`));
                      
                      const isAllYearSelected = periodsOfYear.every(p => current.includes(p)) && current.length === periodsOfYear.length;
                      
                      if (isAllYearSelected) {
                        current = [v];
                      } else {
                        const idx = current.indexOf(v);
                        if (idx > -1) {
                          current.splice(idx, 1);
                          if (current.length === 0) {
                            current = periodsOfYear;
                          }
                        } else {
                          current.push(v);
                        }
                      }
                      
                      onFilterChange({
                        ...filters,
                        periodos: current
                      });
                    }}
                    onClear={() => {
                      const ano2d = selectedYear.slice(2);
                      const periodsOfYear = availablePeriodos.filter(p => p.endsWith(`/${ano2d}`));
                      onFilterChange({
                        ...filters,
                        periodos: periodsOfYear
                      });
                    }}
                    fullWidth
                  />
                </div>
              )}
            </div>

            {/* 3. DEPARTAMENTO */}
            <div className="w-full">
              <MultiSelectDropdown
                label="Departamento"
                icon={<FolderTree size={13} />}
                options={availableDepartamentos}
                selected={filters.departamentos}
                onToggle={(v) => toggleFilter('departamentos', v)}
                onClear={() => clearGroup('departamentos')}
                searchable={availableDepartamentos.length > 5}
                placeholder="Buscar departamento..."
                fullWidth
              />
            </div>

            {/* 4. CONTA DRE */}
            <div className="w-full">
              <MultiSelectDropdown
                label="Conta DRE"
                icon={<Landmark size={13} />}
                options={availableContasDre}
                selected={filters.contasDre}
                onToggle={(v) => toggleFilter('contasDre', v)}
                onClear={() => clearGroup('contasDre')}
                searchable={availableContasDre.length > 5}
                placeholder="Buscar conta..."
                fullWidth
              />
            </div>

            {/* 5. PROJETO */}
            <div className="w-full">
              <MultiSelectDropdown
                label="Projeto"
                icon={<Target size={13} />}
                options={availableProjetos}
                selected={filters.projetos}
                onToggle={(v) => toggleFilter('projetos', v)}
                onClear={() => clearGroup('projetos')}
                searchable={availableProjetos.length > 5}
                placeholder="Buscar projeto..."
                fullWidth
              />
            </div>

            {/* 6. CATEGORIA */}
            <div className="w-full">
              <MultiSelectDropdown
                label="Categoria"
                icon={<Tags size={13} />}
                options={availableCategorias}
                selected={filters.categorias}
                onToggle={(v) => toggleFilter('categorias', v)}
                onClear={() => clearGroup('categorias')}
                searchable={availableCategorias.length > 5}
                placeholder="Buscar categoria..."
                fullWidth
              />
            </div>

          </div>
        )}
      </div>

      {/* Footer info / Metadata */}
      <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between bg-slate-950/20">
        <span>Mar Brasil © 2026</span>
        <span>Modo Remoto Ativo</span>
      </div>
    </aside>
  );
}
