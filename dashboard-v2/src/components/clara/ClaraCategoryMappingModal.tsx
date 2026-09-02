"use client";

import { useState, useEffect } from "react";
import { X, Tag, Plus, Trash2, Loader2, Search, CheckCircle2 } from "lucide-react";
import { ClaraCategoryMapping, OmieCategoryOption } from "@/types/clara.types";

interface ClaraCategoryMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClaraCategoryMappingModal({ isOpen, onClose }: ClaraCategoryMappingModalProps) {
  const [mappings, setMappings] = useState<ClaraCategoryMapping[]>([]);
  const [categories, setCategories] = useState<OmieCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulário de inclusão
  const [claraCategory, setClaraCategory] = useState("");
  const [selectedOmieCategory, setSelectedOmieCategory] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mapRes, omieRes] = await Promise.all([
        fetch('/api/clara/mappings/categories').then(r => r.json()),
        fetch('/api/clara/omie-resources').then(r => r.json()),
      ]);

      if (mapRes.data) setMappings(mapRes.data);
      if (omieRes.data?.categories) setCategories(omieRes.data.categories);
    } catch (e: any) {
      console.error('Erro ao carregar mapeamentos de categorias:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claraCategory.trim() || !selectedOmieCategory) return;

    setSaving(true);
    const catObj = categories.find(c => c.codigo === selectedOmieCategory);

    try {
      const res = await fetch('/api/clara/mappings/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clara_category: claraCategory.trim(),
          omie_category_code: selectedOmieCategory,
          omie_category_desc: catObj?.descricao || null,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMappings(data.data || []);
        setClaraCategory("");
        setSelectedOmieCategory("");
        setCatSearch("");
      } else {
        alert(data.message || 'Erro ao salvar mapeamento.');
      }
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: string) => {
    if (!confirm(`Deseja remover o mapeamento para "${category}"?`)) return;

    try {
      await fetch(`/api/clara/mappings/categories?category=${encodeURIComponent(category)}`, {
        method: 'DELETE',
      });
      setMappings(mappings.filter(m => m.clara_category !== category));
    } catch (e: any) {
      alert(`Erro ao remover: ${e.message}`);
    }
  };

  if (!isOpen) return null;

  const filteredCategories = categories.filter(c =>
    c.codigo.toLowerCase().includes(catSearch.toLowerCase()) ||
    c.descricao.toLowerCase().includes(catSearch.toLowerCase())
  );

  const filteredMappings = mappings.filter(m =>
    m.clara_category.toLowerCase().includes(filterSearch.toLowerCase()) ||
    (m.omie_category_desc || '').toLowerCase().includes(filterSearch.toLowerCase()) ||
    m.omie_category_code.includes(filterSearch)
  );

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Tag size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Mapeamento De-Para: Categorias</h2>
              <p className="text-xs text-slate-500">Vincule a categoria/tipo de gasto da Clara à categoria de despesa do Omie</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Formulário de Novo Mapeamento */}
          <form onSubmit={handleAddMapping} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Plus size={14} className="text-blue-600" />
              Adicionar Novo Mapeamento
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoria ou Estabelecimento Clara
                </label>
                <input
                  type="text"
                  required
                  value={claraCategory}
                  onChange={e => setClaraCategory(e.target.value)}
                  placeholder="Ex: Software, Uber, Alimentação, Amazon"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoria Correspondente no Omie
                </label>
                <input
                  type="text"
                  value={catSearch}
                  onChange={e => setCatSearch(e.target.value)}
                  placeholder="Pesquisar categoria Omie..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-t-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                />
                <select
                  required
                  value={selectedOmieCategory}
                  onChange={e => setSelectedOmieCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                >
                  <option value="">Selecione a categoria Omie...</option>
                  {filteredCategories.slice(0, 50).map(c => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.codigo} - {c.descricao}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving || !claraCategory || !selectedOmieCategory}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {saving && <Loader2 className="animate-spin" size={14} />}
                <span>Salvar Mapeamento</span>
              </button>
            </div>
          </form>

          {/* Lista de Mapeamentos Atuais */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Mapeamentos Cadastrados ({mappings.length})
              </h3>
              <div className="relative w-48">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  placeholder="Filtrar..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <Loader2 className="animate-spin inline mr-2" size={16} />
                Carregando categorias...
              </div>
            ) : filteredMappings.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                Nenhum mapeamento de categoria cadastrado ainda.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {filteredMappings.map(m => (
                  <div key={m.clara_category} className="flex items-center justify-between p-3 text-xs hover:bg-slate-50/60 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <span className="font-bold text-slate-900">{m.clara_category}</span>
                      <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                        <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded text-[10px]">
                          {m.omie_category_code}
                        </span>
                        <span className="truncate">{m.omie_category_desc || 'Categoria Omie'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(m.clara_category)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Excluir mapeamento"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
