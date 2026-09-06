"use client";

import React, { useState, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  EyeOff,
  Eye,
  X,
  Search,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Building2,
  Users,
  FolderTree
} from 'lucide-react';
import { DreCaixaFilters } from '@/types/dre-caixa';

interface DreCaixaPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableOptions: {
    categorias: string[];
    projetos: string[];
    fornecedores: string[];
  };
  filters: DreCaixaFilters;
  onChangeFilters: (newFilters: DreCaixaFilters) => void;
}

export function DreCaixaPrivacyModal({
  isOpen,
  onClose,
  availableOptions,
  filters,
  onChangeFilters
}: DreCaixaPrivacyModalProps) {
  const [activeTab, setActiveTab] = useState<'categorias' | 'projetos' | 'fornecedores'>('categorias');
  const [searchTerm, setSearchTerm] = useState('');

  const ocultarCats = useMemo(() => filters.ocultarCategorias || [], [filters.ocultarCategorias]);
  const ocultarProjs = useMemo(() => filters.ocultarProjetos || [], [filters.ocultarProjetos]);
  const ocultarForns = useMemo(() => filters.ocultarFornecedores || [], [filters.ocultarFornecedores]);

  const totalOcultos = ocultarCats.length + ocultarProjs.length + ocultarForns.length;

  // Toggle handlers
  const toggleCategoria = (cat: string) => {
    const next = ocultarCats.includes(cat)
      ? ocultarCats.filter(c => c !== cat)
      : [...ocultarCats, cat];
    onChangeFilters({ ...filters, ocultarCategorias: next });
  };

  const toggleProjeto = (proj: string) => {
    const next = ocultarProjs.includes(proj)
      ? ocultarProjs.filter(p => p !== proj)
      : [...ocultarProjs, proj];
    onChangeFilters({ ...filters, ocultarProjetos: next });
  };

  const toggleFornecedor = (forn: string) => {
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

  // Preset inteligente para folha de pagamento & sócios
  const applyPayrollPreset = () => {
    const payrollKeywords = ['salário', 'salario', 'pró-labore', 'pro-labore', 'pró labore', 'pro labore', 'ordenado', 'remuneração', 'folha'];
    const matching = availableOptions.categorias.filter(cat => {
      const lower = cat.toLowerCase();
      return payrollKeywords.some(kw => lower.includes(kw));
    });

    const union = Array.from(new Set([...ocultarCats, ...matching]));
    onChangeFilters({ ...filters, ocultarCategorias: union });
  };

  // Itens filtrados pela busca
  const currentList = useMemo(() => {
    let list: string[] = [];
    if (activeTab === 'categorias') list = availableOptions.categorias;
    else if (activeTab === 'projetos') list = availableOptions.projetos;
    else if (activeTab === 'fornecedores') list = availableOptions.fornecedores;

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(item => item.toLowerCase().includes(term));
  }, [activeTab, availableOptions, searchTerm]);

  const currentSelectedList = useMemo(() => {
    if (activeTab === 'categorias') return ocultarCats;
    if (activeTab === 'projetos') return ocultarProjs;
    return ocultarForns;
  }, [activeTab, ocultarCats, ocultarProjs, ocultarForns]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shadow-sm shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Ocultar Dados Sensíveis
                </h3>
                {totalOcultos > 0 ? (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    {totalOcultos} {totalOcultos === 1 ? 'item oculto' : 'itens ocultos'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Nenhum item oculto
                  </span>
                )}
                {filters.empresas && filters.empresas.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ⚡ {filters.empresas.join(', ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {filters.empresas && filters.empresas.length > 0
                  ? `Mostrando opções calibradas para a empresa ${filters.empresas.join(', ')}`
                  : 'Oculte categorias, projetos ou fornecedores da apuração de caixa, gráficos e demonstrativo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-4 pt-2 bg-slate-50/50 gap-2 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => { setActiveTab('categorias'); setSearchTerm(''); }}
            className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold rounded-t-xl border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'categorias'
                ? 'border-amber-600 text-amber-900 bg-white shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Layers size={14} className={activeTab === 'categorias' ? 'text-amber-600' : 'text-slate-400'} />
            <span>Categorias</span>
            {ocultarCats.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                {ocultarCats.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('projetos'); setSearchTerm(''); }}
            className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold rounded-t-xl border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'projetos'
                ? 'border-amber-600 text-amber-900 bg-white shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <FolderTree size={14} className={activeTab === 'projetos' ? 'text-amber-600' : 'text-slate-400'} />
            <span>Projetos / Setores</span>
            {ocultarProjs.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                {ocultarProjs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('fornecedores'); setSearchTerm(''); }}
            className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold rounded-t-xl border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'fornecedores'
                ? 'border-amber-600 text-amber-900 bg-white shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Users size={14} className={activeTab === 'fornecedores' ? 'text-amber-600' : 'text-slate-400'} />
            <span>Fornecedores / Favorecidos</span>
            {ocultarForns.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                {ocultarForns.length}
              </span>
            )}
          </button>
        </div>

        {/* Barra de Busca e Ações Rápidas */}
        <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white">
          <div className="relative w-full sm:flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={`Buscar em ${activeTab}...`}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {activeTab === 'categorias' && (
              <button
                type="button"
                onClick={applyPayrollPreset}
                className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                title="Oculta automaticamente Salários, Pró-Labore e Ordenados"
              >
                <Sparkles size={12} className="text-amber-600" />
                <span>Preset Folha/Salários</span>
              </button>
            )}

            {currentSelectedList.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'categorias') onChangeFilters({ ...filters, ocultarCategorias: [] });
                  else if (activeTab === 'projetos') onChangeFilters({ ...filters, ocultarProjetos: [] });
                  else onChangeFilters({ ...filters, ocultarFornecedores: [] });
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Desmarcar desta aba
              </button>
            )}
          </div>
        </div>

        {/* Lista com Checkboxes */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1 custom-scrollbar min-h-[260px] max-h-[380px]">
          {currentList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhum item encontrado para o termo pesquisado.
            </div>
          ) : (
            currentList.map(item => {
              const isHidden = currentSelectedList.includes(item);
              const toggleItem = () => {
                if (activeTab === 'categorias') toggleCategoria(item);
                else if (activeTab === 'projetos') toggleProjeto(item);
                else toggleFornecedor(item);
              };

              return (
                <label
                  key={item}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs cursor-pointer transition-all border ${
                    isHidden
                      ? 'bg-amber-50/80 border-amber-200 text-amber-950 font-bold shadow-xs'
                      : 'bg-white border-transparent hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <input
                      type="checkbox"
                      checked={isHidden}
                      onChange={toggleItem}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="truncate">{item}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isHidden ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                        <EyeOff size={10} />
                        Oculto
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium group-hover:text-slate-600">
                        Visível
                      </span>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>

        {/* Badges de Itens Ocultos Ativos */}
        {totalOcultos > 0 && (
          <div className="p-3 bg-amber-50/50 border-t border-amber-100 max-h-24 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                <EyeOff size={11} className="text-amber-600" />
                Itens com exibição bloqueada ({totalOcultos}):
              </span>
              <button
                type="button"
                onClick={clearAllHidden}
                className="text-[10px] font-bold text-amber-700 hover:text-amber-900 hover:underline cursor-pointer"
              >
                Limpar Todos
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ocultarCats.map(cat => (
                <span
                  key={`cat-${cat}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-950 shadow-2xs"
                >
                  <span className="text-[9px] uppercase font-bold text-amber-600">Cat:</span>
                  <span className="truncate max-w-[140px]">{cat}</span>
                  <button
                    type="button"
                    onClick={() => toggleCategoria(cat)}
                    className="text-slate-400 hover:text-amber-700 ml-0.5 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}

              {ocultarProjs.map(proj => (
                <span
                  key={`proj-${proj}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-950 shadow-2xs"
                >
                  <span className="text-[9px] uppercase font-bold text-amber-600">Proj:</span>
                  <span className="truncate max-w-[140px]">{proj}</span>
                  <button
                    type="button"
                    onClick={() => toggleProjeto(proj)}
                    className="text-slate-400 hover:text-amber-700 ml-0.5 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}

              {ocultarForns.map(forn => (
                <span
                  key={`forn-${forn}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-950 shadow-2xs"
                >
                  <span className="text-[9px] uppercase font-bold text-amber-600">Forn:</span>
                  <span className="truncate max-w-[140px]">{forn}</span>
                  <button
                    type="button"
                    onClick={() => toggleFornecedor(forn)}
                    className="text-slate-400 hover:text-amber-700 ml-0.5 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-medium">
            {totalOcultos === 0 ? (
              <span>Todos os dados estão visíveis normalmente</span>
            ) : (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <Shield size={13} className="text-amber-600" />
                Proteção ativa: dados sensíveis excluídos dos totais e telas
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            Concluir & Aplicar
          </button>
        </div>

      </div>
    </div>
  );
}
