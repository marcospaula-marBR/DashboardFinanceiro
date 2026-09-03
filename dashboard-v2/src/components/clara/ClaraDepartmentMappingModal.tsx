"use client";

import { useState, useEffect } from "react";
import { X, Building2, Plus, Trash2, Loader2, Search } from "lucide-react";
import { ClaraDepartmentMapping, OmieDepartmentOption } from "@/types/clara.types";

interface ClaraDepartmentMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCompanyName?: string;
}

export function ClaraDepartmentMappingModal({ isOpen, onClose, activeCompanyName = 'Mar Brasil' }: ClaraDepartmentMappingModalProps) {
  const [mappings, setMappings] = useState<ClaraDepartmentMapping[]>([]);
  const [departments, setDepartments] = useState<OmieDepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form
  const [mappingType, setMappingType] = useState<'USER' | 'CARD' | 'LABEL'>('USER');
  const [claraKey, setClaraKey] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeCompanyName]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mapRes, omieRes] = await Promise.all([
        fetch('/api/clara/mappings/departments').then(r => r.json()),
        fetch(`/api/clara/omie-resources?company=${encodeURIComponent(activeCompanyName)}`).then(r => r.json()),
      ]);

      if (mapRes.data) setMappings(mapRes.data);
      if (omieRes.data?.departments) setDepartments(omieRes.data.departments);
    } catch (e: any) {
      console.error('Erro ao carregar departamentos:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claraKey.trim() || !selectedDept) return;

    setSaving(true);
    const deptObj = departments.find(d => d.codigo === selectedDept);

    try {
      const res = await fetch('/api/clara/mappings/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapping_type: mappingType,
          clara_key: claraKey.trim(),
          omie_department_code: selectedDept,
          omie_department_desc: deptObj?.descricao || null,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMappings(data.data || []);
        setClaraKey("");
        setSelectedDept("");
      } else {
        alert(data.message || 'Erro ao salvar mapeamento.');
      }
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: string, key: string) => {
    if (!confirm(`Deseja remover o mapeamento para "${key}"?`)) return;

    try {
      await fetch(`/api/clara/mappings/departments?type=${type}&key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      setMappings(mappings.filter(m => !(m.mapping_type === type && m.clara_key === key)));
    } catch (e: any) {
      alert(`Erro ao remover: ${e.message}`);
    }
  };

  if (!isOpen) return null;

  const filteredMappings = mappings.filter(m =>
    m.clara_key.toLowerCase().includes(filterSearch.toLowerCase()) ||
    (m.omie_department_desc || '').toLowerCase().includes(filterSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Mapeamento De-Para: Centros de Custo</h2>
              <p className="text-xs text-slate-500">Direcione portadores e cartões da Clara para os departamentos do Omie</p>
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
          
          {/* Form */}
          <form onSubmit={handleAdd} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Plus size={14} className="text-emerald-600" />
              Adicionar Novo Mapeamento
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Vínculo</label>
                <select
                  value={mappingType}
                  onChange={e => setMappingType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                >
                  <option value="USER">Portador / Usuário</option>
                  <option value="CARD">Final do Cartão (4 dígitos)</option>
                  <option value="LABEL">Label / Tag Clara</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {mappingType === 'USER' ? 'Nome do Portador' : mappingType === 'CARD' ? 'Últimos 4 dígitos' : 'Nome da Label'}
                </label>
                <input
                  type="text"
                  required
                  value={claraKey}
                  onChange={e => setClaraKey(e.target.value)}
                  placeholder={mappingType === 'USER' ? 'Ex: João da Silva' : mappingType === 'CARD' ? 'Ex: 1234' : 'Ex: Comercial'}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento Omie</label>
                <select
                  required
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                >
                  <option value="">Selecione o departamento...</option>
                  {departments.map(d => (
                    <option key={d.codigo} value={d.codigo}>
                      {d.descricao}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving || !claraKey || !selectedDept}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {saving && <Loader2 className="animate-spin" size={14} />}
                <span>Salvar Centro de Custo</span>
              </button>
            </div>
          </form>

          {/* List */}
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
                Carregando departamentos...
              </div>
            ) : filteredMappings.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                Nenhum departamento cadastrado ainda.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {filteredMappings.map(m => (
                  <div key={`${m.mapping_type}_${m.clara_key}`} className="flex items-center justify-between p-3 text-xs hover:bg-slate-50/60 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {m.mapping_type === 'USER' ? 'Portador' : m.mapping_type === 'CARD' ? 'Cartão' : 'Label'}
                        </span>
                        <span className="font-bold text-slate-900">{m.clara_key}</span>
                      </div>
                      <div className="text-slate-500 mt-1 truncate">
                        Departamento Omie: <strong className="text-slate-700">{m.omie_department_desc || m.omie_department_code}</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(m.mapping_type, m.clara_key)}
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
