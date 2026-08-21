"use client";

import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Shield, Building2, Server, Save, RefreshCw, CheckCircle2, Search, Tag, KeyRound } from 'lucide-react';
import { SystemItem, SystemCategory, SystemOrigin, SystemAccessLevel } from '@/types/loans';
import { SystemsCatalogService } from '@/services/systems-catalog.service';
import { SystemAppIcon } from './SystemAppIcon';

interface SystemsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCatalogChange?: () => void;
}

const CATEGORIES: SystemCategory[] = [
  'Bancário',
  'ERP',
  'RH & Folha',
  'Fiscal & Contábil',
  'CRM & Vendas',
  'Comunicação & Operações',
  'Infra & TI',
  'Outros'
];

export function SystemsManagerModal({
  isOpen,
  onClose,
  onCatalogChange
}: SystemsManagerModalProps) {
  const [systems, setSystems] = useState<SystemItem[]>(() => SystemsCatalogService.getSystems());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Estado do formulário de Adição/Edição
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    category: SystemCategory;
    origin: SystemOrigin;
    description: string;
    default_level: SystemAccessLevel;
  }>({
    name: '',
    category: 'ERP',
    origin: 'contrato',
    description: '',
    default_level: 'Operacional'
  });

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditId(null);
    setFormData({
      name: '',
      category: 'ERP',
      origin: 'contrato',
      description: '',
      default_level: 'Operacional'
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (sys: SystemItem) => {
    setEditId(sys.id);
    setFormData({
      name: sys.name,
      category: sys.category,
      origin: sys.origin,
      description: sys.description || '',
      default_level: sys.default_level || 'Operacional'
    });
    setIsEditing(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Por favor, informe o nome do sistema.');
      return;
    }

    if (editId) {
      // Atualizar existente
      SystemsCatalogService.updateSystem({
        id: editId,
        name: formData.name.trim(),
        category: formData.category,
        origin: formData.origin,
        description: formData.description.trim(),
        default_level: formData.default_level
      });
    } else {
      // Criar novo
      SystemsCatalogService.addSystem({
        name: formData.name.trim(),
        category: formData.category,
        origin: formData.origin,
        description: formData.description.trim(),
        default_level: formData.default_level
      });
    }

    setSystems(SystemsCatalogService.getSystems());
    setIsEditing(false);
    if (onCatalogChange) onCatalogChange();
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Deseja realmente remover o sistema "${name}" do catálogo corporativo?`)) {
      SystemsCatalogService.deleteSystem(id);
      setSystems(SystemsCatalogService.getSystems());
      if (onCatalogChange) onCatalogChange();
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Deseja restaurar o catálogo padrão de sistemas corporativos e bancários?')) {
      const defs = SystemsCatalogService.resetToDefault();
      setSystems(defs);
      if (onCatalogChange) onCatalogChange();
    }
  };

  const filteredSystems = systems.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <Server size={20} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wide">Catálogo Corporativo de Sistemas</h2>
              <p className="text-xs text-slate-400">Cadastre e configure ERPs, Bancos, RH e plataformas para governança de acessos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Action & Filter Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar sistema, banco ou ERP..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetDefaults}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                title="Restaurar sistemas padrão de fábrica"
              >
                <RefreshCw size={13} />
                <span className="hidden sm:inline">Restaurar Padrões</span>
              </button>

              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus size={16} />
                <span>Novo Sistema</span>
              </button>
            </div>
          </div>

          {/* Categorias Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todos ({systems.length})
            </button>
            {CATEGORIES.map(cat => {
              const count = systems.filter(s => s.category === cat).length;
              if (count === 0 && selectedCategory !== cat) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {isEditing ? (
            /* Formulário de Adição/Edição */
            <form onSubmit={handleSaveForm} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Server size={16} className="text-indigo-600" />
                  {editId ? 'Editar Sistema' : 'Cadastrar Novo Sistema'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Nome do Sistema / Plataforma *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Omie ERP, Bradesco Net Empresa, Senior..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Categoria do Sistema *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(p => ({ ...p, category: e.target.value as SystemCategory }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Origem do Sistema
                  </label>
                  <select
                    value={formData.origin}
                    onChange={(e) => setFormData(p => ({ ...p, origin: e.target.value as SystemOrigin }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="interno">Interno (Desenvolvimento/Sistema Próprio)</option>
                    <option value="contrato">Contrato / Fornecedor Externo</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Nível de Acesso Padrão
                  </label>
                  <select
                    value={formData.default_level}
                    onChange={(e) => setFormData(p => ({ ...p, default_level: e.target.value as SystemAccessLevel }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Operacional">Operacional (Uso Diário / Operador)</option>
                    <option value="Tático">Tático (Gerência / Supervisão)</option>
                    <option value="Estratégico">Estratégico (Admin / Diretoria / Master)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Descrição / Finalidade do Sistema
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                    placeholder="Ex: Emissão de notas fiscais, faturamento e contas a pagar..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                >
                  <Save size={15} />
                  <span>{editId ? 'Salvar Alterações' : 'Cadastrar Sistema'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Lista de Sistemas em Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSystems.map(sys => (
                <div
                  key={sys.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 transition-all shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <SystemAppIcon systemName={sys.name} category={sys.category} size="md" />

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 truncate">
                          {sys.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {sys.category}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {sys.origin === 'interno' ? 'Interno' : 'Contrato'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEdit(sys)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(sys.id, sys.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 font-medium mt-2 line-clamp-2">
                      {sys.description || 'Sem descrição cadastrada.'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-bold uppercase">Nível Sugerido:</span>
                    <span className={`font-black uppercase px-2 py-0.5 rounded ${
                      sys.default_level === 'Estratégico'
                        ? 'text-rose-700 bg-rose-50'
                        : sys.default_level === 'Tático'
                        ? 'text-amber-700 bg-amber-50'
                        : 'text-emerald-700 bg-emerald-50'
                    }`}>
                      {sys.default_level || 'Operacional'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-semibold">
            {filteredSystems.length} {filteredSystems.length === 1 ? 'sistema listado' : 'sistemas listados'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-colors"
          >
            Concluir
          </button>
        </div>

      </div>
    </div>
  );
}
