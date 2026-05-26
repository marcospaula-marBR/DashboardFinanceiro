"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import { UploadCloud, Filter, XCircle, Building2, Calendar, FolderTree, Landmark, Target, Tags } from 'lucide-react';
import { DreFilters, DreMetadata, DreRow } from '@/types/dre';

interface DreSidebarProps {
  metadata: DreMetadata | null;
  rawData: DreRow[];
  filters: DreFilters;
  onFilterChange: (filters: DreFilters) => void;
  onFileUpload: (file: File) => void;
  isUploading: boolean;
  fileName: string | null;
}

export function DreSidebar({ 
  metadata, 
  rawData,
  filters, 
  onFilterChange, 
  onFileUpload, 
  isUploading,
  fileName
}: DreSidebarProps) {
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

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
  const toggleFilter = (key: keyof DreFilters, value: string) => {
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
      categorias: []
    });
  };

  const hasActiveFilters = 
    filters.empresas.length > 0 || 
    filters.periodos.length > 0 || 
    filters.departamentos.length > 0 || 
    filters.contasDre.length > 0 || 
    filters.projetos.length > 0 || 
    filters.categorias.length > 0;

  return (
    <aside className="w-80 flex-shrink-0 bg-slate-900 text-slate-100 flex flex-col h-screen border-r border-slate-800 select-none">
      {/* Header / Brand */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-orange-900/20">
          DF
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight text-white tracking-wide">DRE Financeiro</h1>
          <p className="text-xs text-slate-400 font-medium">Painel de Controladoria v3</p>
        </div>
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
              Limpar
            </button>
          )}
        </div>

        {rawData.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-950/20 rounded-xl border border-slate-850">
            <p className="text-xs text-slate-500">Envie um arquivo CSV para habilitar os filtros interativos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. EMPRESAS */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                <Building2 size={13} className="text-slate-400" />
                Empresa ({availableEmpresas.length})
              </label>
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
                {availableEmpresas.map(emp => {
                  const isSelected = filters.empresas.includes(emp);
                  return (
                    <label key={emp} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-800/40 text-xs font-medium cursor-pointer text-slate-300 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleFilter('empresas', emp)}
                        className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                      />
                      <span className="truncate">{emp}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2. PERÍODOS */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                <Calendar size={13} className="text-slate-400" />
                Período ({availablePeriodos.length})
              </label>
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
                {availablePeriodos.map(per => {
                  const isSelected = filters.periodos.includes(per);
                  return (
                    <label key={per} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-800/40 text-xs font-medium cursor-pointer text-slate-300 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleFilter('periodos', per)}
                        className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                      />
                      <span>{per}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3. DEPARTAMENTO */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                <FolderTree size={13} className="text-slate-400" />
                Departamento ({availableDepartamentos.length})
              </label>
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
                {availableDepartamentos.length === 0 ? (
                  <p className="text-[10px] text-slate-500 p-1">Nenhum disponível</p>
                ) : (
                  availableDepartamentos.map(dept => {
                    const isSelected = filters.departamentos.includes(dept);
                    return (
                      <label key={dept} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-800/40 text-xs font-medium cursor-pointer text-slate-300 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleFilter('departamentos', dept)}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                        />
                        <span className="truncate">{dept}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4. CONTA DRE */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                <Landmark size={13} className="text-slate-400" />
                Conta DRE ({availableContasDre.length})
              </label>
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
                {availableContasDre.length === 0 ? (
                  <p className="text-[10px] text-slate-500 p-1">Nenhuma disponível</p>
                ) : (
                  availableContasDre.map(conta => {
                    const isSelected = filters.contasDre.includes(conta);
                    return (
                      <label key={conta} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-800/40 text-xs font-medium cursor-pointer text-slate-300 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleFilter('contasDre', conta)}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                        />
                        <span className="truncate">{conta}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* 5. PROJETO */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                <Target size={13} className="text-slate-400" />
                Projeto ({availableProjetos.length})
              </label>
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
                {availableProjetos.length === 0 ? (
                  <p className="text-[10px] text-slate-500 p-1">Nenhum disponível</p>
                ) : (
                  availableProjetos.map(proj => {
                    const isSelected = filters.projetos.includes(proj);
                    return (
                      <label key={proj} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-800/40 text-xs font-medium cursor-pointer text-slate-300 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleFilter('projetos', proj)}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                        />
                        <span className="truncate">{proj}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* 6. CATEGORIA */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                <Tags size={13} className="text-slate-400" />
                Categoria ({availableCategorias.length})
              </label>
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
                {availableCategorias.length === 0 ? (
                  <p className="text-[10px] text-slate-500 p-1">Nenhuma disponível</p>
                ) : (
                  availableCategorias.map(cat => {
                    const isSelected = filters.categorias.includes(cat);
                    return (
                      <label key={cat} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-800/40 text-xs font-medium cursor-pointer text-slate-300 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleFilter('categorias', cat)}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                        />
                        <span className="truncate">{cat}</span>
                      </label>
                    );
                  })
                )}
              </div>
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
