"use client";

import React, { useState } from 'react';
import {
  X, Building2, MapPin, Plus, Trash2, Edit3, Save,
  Search, Loader2, Compass, Navigation, ChevronDown, ChevronRight,
  Tag, Grid3X3, Layers
} from 'lucide-react';
import { Workstation, CostCenter, WorkstationUnit, ServiceRegion } from '@/types/workstations';
import { WorkstationsService, CostCentersService } from '@/services/workstations.service';
import { GeocodingService } from '@/services/geocoding.service';
import { getCompanyLogoUrl } from './PeopleBadges';

interface WorkstationsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkstationsChange: () => void;
}

type ActiveTab = 'postos' | 'centros';

const COMPANIES: ('MarBR' | 'DZM' | 'G2' | 'Ybox' | 'Conectius' | 'Pessoal' | 'Usatell')[] = [
  'MarBR', 'DZM', 'G2', 'Ybox', 'Conectius', 'Pessoal', 'Usatell'
];

const PRESET_COLORS = [
  '#2563eb', '#059669', '#7c3aed', '#ea580c',
  '#0891b2', '#db2777', '#475569', '#d97706', '#16a34a'
];

function emptyUnit(costCenterId: string): WorkstationUnit {
  return {
    id: `cc-unit-${Date.now()}`,
    cost_center_id: costCenterId,
    region_id: undefined,
    name: '',
    code: '',
    address: '',
    number: '',
    neighborhood: '',
    city: 'Santos',
    state: 'SP',
    zip_code: '',
    lat: -23.9618,
    lng: -46.3322,
    capacity: 1,
    active: true,
    notes: ''
  };
}

function UnitForm({
  unit, regions, onSave, onCancel,
}: {
  unit: WorkstationUnit;
  regions: ServiceRegion[];
  onSave: (u: WorkstationUnit) => Promise<void>;
  onCancel: () => void;
}) {
  const [editing, setEditing] = useState<WorkstationUnit>({ ...unit });
  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const handleCepLookup = async () => {
    const cleanCep = editing.zip_code.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    setIsGeocoding(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          const coords = await GeocodingService.geocodeAddress({
            zip_code: cleanCep,
            street: data.logradouro || editing.address,
            neighborhood: data.bairro || editing.neighborhood,
            city: data.localidade || editing.city,
            state: data.uf || editing.state
          });
          setEditing(prev => ({
            ...prev,
            address: data.logradouro || prev.address,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
            lat: coords ? coords.lat : prev.lat,
            lng: coords ? coords.lng : prev.lng
          }));
        }
      }
    } catch {}
    finally { setIsGeocoding(false); }
  };

  const handleRecalcGps = async () => {
    setIsGeocoding(true);
    try {
      const cleanZip = editing.zip_code.replace(/\D/g, '');
      let coords = await GeocodingService.geocodeAddress({
        zip_code: cleanZip, street: editing.address,
        number: editing.number, neighborhood: editing.neighborhood,
        city: editing.city, state: editing.state
      });
      if (!coords) {
        const q = [editing.address, editing.neighborhood, editing.city, editing.state, 'Brasil'].filter(Boolean).join(', ');
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
        if (r.ok) {
          const d = await r.json();
          if (d?.[0]) coords = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
        }
      }
      if (coords) setEditing(prev => ({ ...prev, lat: coords!.lat, lng: coords!.lng }));
    } catch {}
    finally { setIsGeocoding(false); }
  };

  const handleSubmit = async () => {
    if (!editing.name.trim()) { alert('Informe o nome da unidade.'); return; }
    setIsSaving(true);
    try { await onSave(editing); }
    catch (e: any) { alert('Erro ao salvar unidade: ' + e.message); }
    finally { setIsSaving(false); }
  };

  const inp = 'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500';

  return (
    <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-3 animate-in fade-in">
      <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
        <MapPin size={13} /> {!unit.name ? 'Nova Unidade / Escola' : `Editar: ${unit.name}`}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nome da Unidade / Escola *</label>
          <input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
            placeholder="Ex: EMEF João Ramalho, UBS Centro..." className={inp} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Código</label>
          <input type="text" value={editing.code || ''} onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
            placeholder="SEC-001" className={`${inp} uppercase`} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Região de Atendimento</label>
          <select value={editing.region_id || ''} onChange={e => setEditing({ ...editing, region_id: e.target.value || undefined })} className={inp}>
            <option value="">— Sem região —</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">CEP</label>
          <div className="flex gap-1.5">
            <input type="text" value={editing.zip_code} onChange={e => setEditing({ ...editing, zip_code: e.target.value })}
              placeholder="00000-000" className={inp} />
            <button type="button" onClick={handleCepLookup} disabled={isGeocoding}
              className="px-2.5 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 disabled:opacity-50">
              {isGeocoding ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Endereço</label>
          <div className="grid grid-cols-3 gap-1.5">
            <input type="text" value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })}
              placeholder="Logradouro" className={`col-span-2 ${inp}`} />
            <input type="text" value={editing.number || ''} onChange={e => setEditing({ ...editing, number: e.target.value })}
              placeholder="Nº" className={inp} />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Bairro</label>
          <input type="text" value={editing.neighborhood} onChange={e => setEditing({ ...editing, neighborhood: e.target.value })}
            placeholder="Bairro" className={inp} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cidade / UF</label>
          <div className="grid grid-cols-3 gap-1.5">
            <input type="text" value={editing.city} onChange={e => setEditing({ ...editing, city: e.target.value })}
              placeholder="Cidade" className={`col-span-2 ${inp}`} />
            <input type="text" value={editing.state} onChange={e => setEditing({ ...editing, state: e.target.value.toUpperCase() })}
              placeholder="UF" maxLength={2} className={`${inp} uppercase text-center`} />
          </div>
        </div>
        <div className="sm:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-indigo-500 shrink-0" />
            <div className="flex gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400">Lat:</span>
                <input type="number" step="any" value={editing.lat || ''} onChange={e => setEditing({ ...editing, lat: parseFloat(e.target.value) || 0 })}
                  className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-800 dark:text-white outline-none" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400">Lng:</span>
                <input type="number" step="any" value={editing.lng || ''} onChange={e => setEditing({ ...editing, lng: parseFloat(e.target.value) || 0 })}
                  className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-800 dark:text-white outline-none" />
              </div>
            </div>
          </div>
          <button type="button" onClick={handleRecalcGps} disabled={isGeocoding}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shrink-0 disabled:opacity-50">
            {isGeocoding ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
            <span>{isGeocoding ? 'Buscando...' : 'GPS'}</span>
          </button>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-lg">Cancelar</button>
        <button type="button" onClick={handleSubmit} disabled={isSaving}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 disabled:opacity-50">
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Salvar Unidade
        </button>
      </div>
    </div>
  );
}

function CostCentersTab({ onWorkstationsChange }: { onWorkstationsChange: () => void }) {
  const [costCenters, setCostCenters] = useState<CostCenter[]>(() => CostCentersService.getCostCenters());
  const [expandedCcId, setExpandedCcId] = useState<string | null>(null);
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null);
  const [editingCc, setEditingCc] = useState<CostCenter | null>(null);
  const [isSavingCc, setIsSavingCc] = useState(false);
  const [editingRegion, setEditingRegion] = useState<{ ccId: string; region: ServiceRegion } | null>(null);
  const [isSavingRegion, setIsSavingRegion] = useState(false);
  const [editingUnit, setEditingUnit] = useState<{ ccId: string; unit: WorkstationUnit } | null>(null);

  const handleStartNewCc = () => {
    setEditingCc({ id: `cc-${Date.now()}`, name: '', company: 'MarBR', color: '#2563eb', notes: '', active: true, units: [], regions: [] });
  };

  const handleSaveCc = async () => {
    if (!editingCc?.name.trim()) { alert('Informe o nome do Centro de Custo.'); return; }
    setIsSavingCc(true);
    try {
      const updated = await CostCentersService.upsertCostCenter(editingCc);
      setCostCenters(updated); setEditingCc(null); onWorkstationsChange();
    } catch (e: any) { alert('Erro ao salvar: ' + e.message); }
    finally { setIsSavingCc(false); }
  };

  const handleDeleteCc = async (cc: CostCenter) => {
    if (!confirm(`Remover "${cc.name}" e todas as suas unidades e regiões?`)) return;
    const updated = await CostCentersService.deleteCostCenter(cc.id);
    setCostCenters(updated); onWorkstationsChange();
  };

  const handleSaveRegion = async () => {
    if (!editingRegion?.region.name.trim()) { alert('Informe o nome da região.'); return; }
    setIsSavingRegion(true);
    try {
      const updated = await CostCentersService.upsertRegion(editingRegion.ccId, editingRegion.region);
      setCostCenters(updated); setEditingRegion(null); onWorkstationsChange();
    } catch (e: any) { alert('Erro ao salvar região: ' + e.message); }
    finally { setIsSavingRegion(false); }
  };

  const handleDeleteRegion = async (ccId: string, region: ServiceRegion) => {
    if (!confirm(`Remover a região "${region.name}"? As unidades serão desvinculadas mas não excluídas.`)) return;
    const updated = await CostCentersService.deleteRegion(ccId, region.id);
    setCostCenters(updated); onWorkstationsChange();
  };

  const handleSaveUnit = async (ccId: string, unit: WorkstationUnit) => {
    const updated = await CostCentersService.upsertUnit(ccId, unit);
    setCostCenters(updated); setEditingUnit(null); onWorkstationsChange();
  };

  const handleDeleteUnit = async (ccId: string, unit: WorkstationUnit) => {
    if (!confirm(`Remover a unidade "${unit.name}"?`)) return;
    const updated = await CostCentersService.deleteUnit(ccId, unit.id);
    setCostCenters(updated); onWorkstationsChange();
  };

  const inp = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500';

  return (
    <div className="space-y-4">
      {!editingCc && (
        <div className="flex justify-end">
          <button type="button" onClick={handleStartNewCc}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95">
            <Plus size={16} /> Novo Centro de Custo
          </button>
        </div>
      )}

      {editingCc && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Building2 size={13} /> {editingCc.name ? `Editar: ${editingCc.name}` : 'Novo Centro de Custo'}
            </p>
            <button onClick={() => setEditingCc(null)} className="text-xs font-bold text-slate-500 hover:text-slate-800">Cancelar</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nome do Centro de Custo / Contratante *</label>
              <input type="text" value={editingCc.name} onChange={e => setEditingCc({ ...editingCc, name: e.target.value })}
                placeholder="Ex: Secretaria de Educação de Santos, Hospital Regional..." className={`w-full ${inp}`} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Empresa do Grupo</label>
              <select value={editingCc.company} onChange={e => setEditingCc({ ...editingCc, company: e.target.value })} className={`w-full ${inp}`}>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cor Base no Mapa</label>
              <div className="flex items-center gap-2">
                <input type="color" value={editingCc.color} onChange={e => setEditingCc({ ...editingCc, color: e.target.value })}
                  className="w-9 h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer" />
                <div className="flex gap-1">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditingCc({ ...editingCc, color: c })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${editingCc.color === c ? 'scale-110 border-slate-900' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Observações</label>
              <input type="text" value={editingCc.notes || ''} onChange={e => setEditingCc({ ...editingCc, notes: e.target.value })}
                placeholder="Notas opcionais..." className={`w-full ${inp}`} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={handleSaveCc} disabled={isSavingCc}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 disabled:opacity-50">
              {isSavingCc ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Salvar Centro de Custo
            </button>
          </div>
        </div>
      )}

      {costCenters.length === 0 && !editingCc ? (
        <div className="py-14 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <Layers size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs font-bold uppercase">Nenhum centro de custo cadastrado</p>
          <p className="text-[11px] mt-1">Clique em "Novo Centro de Custo" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {costCenters.map(cc => {
            const isExpanded = expandedCcId === cc.id;
            return (
              <div key={cc.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  onClick={() => setExpandedCcId(isExpanded ? null : cc.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-xs shrink-0"
                      style={{ backgroundColor: cc.color }}>
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{cc.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-500">{cc.company}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{(cc.units || []).length} unid.</span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{(cc.regions || []).length} regiões</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => setEditingCc({ ...cc })}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit3 size={15} /></button>
                    <button type="button" onClick={() => handleDeleteCc(cc)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                    <div className="ml-1 text-slate-400">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-4 animate-in fade-in">
                    {/* Regiões */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <Tag size={12} /> Regiões de Atendimento
                        </span>
                        <button type="button"
                          onClick={() => setEditingRegion({ ccId: cc.id, region: { id: `cc-region-${Date.now()}`, cost_center_id: cc.id, name: '', color: cc.color, notes: '' } })}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                          <Plus size={11} /> Nova Região
                        </button>
                      </div>

                      {editingRegion?.ccId === cc.id && (
                        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 mb-2 space-y-2 animate-in fade-in">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nome da Região *</label>
                              <input type="text" value={editingRegion.region.name}
                                onChange={e => setEditingRegion({ ...editingRegion, region: { ...editingRegion.region, name: e.target.value } })}
                                placeholder="Ex: Zona Noroeste, Região Centro..." className={`w-full ${inp}`} />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cor</label>
                              <div className="flex items-center gap-1.5">
                                <input type="color" value={editingRegion.region.color}
                                  onChange={e => setEditingRegion({ ...editingRegion, region: { ...editingRegion.region, color: e.target.value } })}
                                  className="w-8 h-8 p-0.5 rounded-lg border border-slate-300 cursor-pointer" />
                                <div className="flex gap-1 flex-wrap">
                                  {PRESET_COLORS.slice(0, 6).map(c => (
                                    <button key={c} type="button" onClick={() => setEditingRegion({ ...editingRegion, region: { ...editingRegion.region, color: c } })}
                                      className={`w-5 h-5 rounded-full border-2 transition-transform ${editingRegion.region.color === c ? 'scale-110 border-slate-900' : 'border-transparent'}`}
                                      style={{ backgroundColor: c }} />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Obs.</label>
                              <input type="text" value={editingRegion.region.notes || ''}
                                onChange={e => setEditingRegion({ ...editingRegion, region: { ...editingRegion.region, notes: e.target.value } })}
                                placeholder="Opcional..." className={`w-full ${inp}`} />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingRegion(null)} className="text-xs font-bold text-slate-500">Cancelar</button>
                            <button type="button" onClick={handleSaveRegion} disabled={isSavingRegion}
                              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl flex items-center gap-1 disabled:opacity-50">
                              {isSavingRegion ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                              Salvar
                            </button>
                          </div>
                        </div>
                      )}

                      {(cc.regions || []).length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic px-1">Nenhuma região cadastrada ainda</p>
                      ) : (
                        <div className="space-y-2">
                          {(cc.regions || []).map(region => {
                            const regionUnits = (cc.units || []).filter(u => u.region_id === region.id);
                            const isRegionExpanded = expandedRegionId === region.id;
                            return (
                              <div key={region.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                                  onClick={() => setExpandedRegionId(isRegionExpanded ? null : region.id)}>
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: region.color }} />
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{region.name}</span>
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{regionUnits.length} unid.</span>
                                  </div>
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <button type="button" onClick={() => setEditingRegion({ ccId: cc.id, region: { ...region } })}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit3 size={12} /></button>
                                    <button type="button" onClick={() => handleDeleteRegion(cc.id, region)}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={12} /></button>
                                    <div className="ml-0.5 text-slate-400">{isRegionExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</div>
                                  </div>
                                </div>

                                {isRegionExpanded && (
                                  <div className="border-t border-slate-100 dark:border-slate-700 px-3 py-2 space-y-2 bg-slate-50/50 dark:bg-slate-800/30 animate-in fade-in">
                                    {regionUnits.map(unit => (
                                      <div key={unit.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                                        {editingUnit?.ccId === cc.id && editingUnit?.unit.id === unit.id ? (
                                          <div className="w-full">
                                            <UnitForm unit={editingUnit.unit} regions={cc.regions || []}
                                              onSave={(u) => handleSaveUnit(cc.id, u)} onCancel={() => setEditingUnit(null)} />
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex items-start gap-2">
                                              <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                                              <div>
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{unit.name}</p>
                                                {unit.code && <span className="text-[9px] font-mono text-slate-400">{unit.code}</span>}
                                                <p className="text-[10px] text-slate-500 leading-tight">
                                                  {unit.address}{unit.number ? `, ${unit.number}` : ''} — {unit.neighborhood}, {unit.city}/{unit.state}
                                                </p>
                                                <p className="text-[9px] font-mono text-slate-400 mt-0.5">GPS: {unit.lat.toFixed(4)}, {unit.lng.toFixed(4)}</p>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                              <button type="button" onClick={() => setEditingUnit({ ccId: cc.id, unit: { ...unit } })}
                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit3 size={12} /></button>
                                              <button type="button" onClick={() => handleDeleteUnit(cc.id, unit)}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={12} /></button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                    {editingUnit?.ccId === cc.id && editingUnit?.unit.region_id === region.id && !editingUnit.unit.name ? (
                                      <UnitForm unit={editingUnit.unit} regions={cc.regions || []}
                                        onSave={(u) => handleSaveUnit(cc.id, u)} onCancel={() => setEditingUnit(null)} />
                                    ) : (
                                      <button type="button"
                                        onClick={() => setEditingUnit({ ccId: cc.id, unit: { ...emptyUnit(cc.id), region_id: region.id } })}
                                        className="w-full py-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center gap-1">
                                        <Plus size={11} /> Adicionar Unidade nesta Região
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Unidades sem região */}
                    {(() => {
                      const orphans = (cc.units || []).filter(u => !u.region_id);
                      return orphans.length > 0 ? (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                            <MapPin size={12} /> Unidades sem região ({orphans.length})
                          </p>
                          <div className="space-y-1">
                            {orphans.map(unit => (
                              <div key={unit.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-700/60 last:border-0 px-1">
                                {editingUnit?.ccId === cc.id && editingUnit?.unit.id === unit.id ? (
                                  <div className="w-full">
                                    <UnitForm unit={editingUnit.unit} regions={cc.regions || []}
                                      onSave={(u) => handleSaveUnit(cc.id, u)} onCancel={() => setEditingUnit(null)} />
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-start gap-2">
                                      <MapPin size={13} className="text-slate-300 mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{unit.name}</p>
                                        <p className="text-[10px] text-slate-400">{unit.city}/{unit.state}</p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <button type="button" onClick={() => setEditingUnit({ ccId: cc.id, unit: { ...unit } })}
                                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit3 size={12} /></button>
                                      <button type="button" onClick={() => handleDeleteUnit(cc.id, unit)}
                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={12} /></button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    <button type="button" onClick={() => setEditingUnit({ ccId: cc.id, unit: emptyUnit(cc.id) })}
                      className="w-full py-2 text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-1.5">
                      <Plus size={12} /> Adicionar Unidade (sem região)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WorkstationsManagerModal({ isOpen, onClose, onWorkstationsChange }: WorkstationsManagerModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('postos');
  const [workstations, setWorkstations] = useState<Workstation[]>(() => WorkstationsService.getWorkstations());
  const [editingWs, setEditingWs] = useState<Workstation | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const handleStartNew = () => {
    setEditingWs({ id: `ws-${Date.now()}`, name: '', code: '', company: 'MarBR', color: '#2563eb', address: '', number: '', complement: '', neighborhood: '', city: 'Santos', state: 'SP', zip_code: '', lat: -23.9618, lng: -46.3322, capacity: 10, coverage_radius_km: 15, notes: '', active: true });
    setIsNew(true);
  };
  const handleStartEdit = (ws: Workstation) => { setEditingWs({ ...ws }); setIsNew(false); };
  const handleCepLookup = async () => {
    if (!editingWs?.zip_code) return;
    const cleanCep = editingWs.zip_code.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    setIsGeocoding(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          const coords = await GeocodingService.geocodeAddress({ zip_code: cleanCep, street: data.logradouro || editingWs.address, neighborhood: data.bairro || editingWs.neighborhood, city: data.localidade || editingWs.city, state: data.uf || editingWs.state });
          setEditingWs(prev => prev ? ({ ...prev, address: data.logradouro || prev.address, neighborhood: data.bairro || prev.neighborhood, city: data.localidade || prev.city, state: data.uf || prev.state, lat: coords ? coords.lat : prev.lat, lng: coords ? coords.lng : prev.lng }) : null);
        }
      }
    } catch {} finally { setIsGeocoding(false); }
  };
  const handleSaveEditing = async () => {
    if (!editingWs || !editingWs.name.trim() || !editingWs.city.trim()) { alert('Informe ao menos Nome e Cidade.'); return; }
    setIsSaving(true);
    try {
      let finalLat = editingWs.lat, finalLng = editingWs.lng;
      if (!finalLat || !finalLng) { const c = await GeocodingService.geocodeAddress({ zip_code: editingWs.zip_code, street: editingWs.address, number: editingWs.number, neighborhood: editingWs.neighborhood, city: editingWs.city, state: editingWs.state }); if (c) { finalLat = c.lat; finalLng = c.lng; } }
      const updated = await WorkstationsService.upsertWorkstation({ ...editingWs, lat: finalLat, lng: finalLng });
      setWorkstations(updated); setEditingWs(null); setIsNew(false); onWorkstationsChange();
    } catch (e: any) { alert('Erro ao salvar posto: ' + e.message); } finally { setIsSaving(false); }
  };
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover o posto "${name}"?`)) return;
    try { const updated = await WorkstationsService.deleteWorkstation(id); setWorkstations(updated); if (editingWs?.id === id) setEditingWs(null); onWorkstationsChange(); }
    catch (e: any) { alert('Erro ao excluir: ' + e.message); }
  };

  const filteredWs = workstations.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.neighborhood.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const inp = 'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500';

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400"><Building2 size={22} /></div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white uppercase">Gestão de Postos & Centros de Custo</h2>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-md uppercase border border-indigo-500/30">{workstations.length} postos</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">Postos de trabalho, centros de custo, regiões de atendimento e unidades</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('postos')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'postos' ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
            <Grid3X3 size={14} /> Postos de Trabalho
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('centros')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'centros' ? 'border-emerald-600 text-emerald-600 bg-white dark:bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
            <Layers size={14} /> Centros de Custo & Unidades
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'postos' && (
            <>
              {editingWs ? (
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <MapPin size={16} className="text-indigo-600" />
                      {isNew ? 'Cadastrar Novo Posto de Trabalho' : `Editar: ${editingWs.name}`}
                    </h3>
                    <button type="button" onClick={() => setEditingWs(null)} className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white">Cancelar Edição</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nome do Posto / Unidade *</label>
                      <input type="text" value={editingWs.name} onChange={e => setEditingWs({ ...editingWs, name: e.target.value })} placeholder="Ex: Matriz Santos..." className={inp} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Código / Sigla</label>
                      <input type="text" value={editingWs.code || ''} onChange={e => setEditingWs({ ...editingWs, code: e.target.value.toUpperCase() })} placeholder="MAT-SAN" className={`${inp} uppercase`} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Empresa do Grupo</label>
                      <select value={editingWs.company} onChange={e => setEditingWs({ ...editingWs, company: e.target.value as any })} className={inp}>
                        {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cor do Marcador</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={editingWs.color || '#2563eb'} onChange={e => setEditingWs({ ...editingWs, color: e.target.value })} className="w-9 h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer" />
                        <div className="flex gap-1">{PRESET_COLORS.map(c => <button key={c} type="button" onClick={() => setEditingWs({ ...editingWs, color: c })} className={`w-6 h-6 rounded-full border-2 transition-transform ${editingWs.color === c ? 'scale-110 border-slate-900' : 'border-transparent'}`} style={{ backgroundColor: c }} />)}</div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Capacidade</label>
                      <input type="number" min={1} value={editingWs.capacity || 10} onChange={e => setEditingWs({ ...editingWs, capacity: parseInt(e.target.value) || 1 })} className={inp} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">CEP</label>
                      <div className="flex gap-1.5">
                        <input type="text" value={editingWs.zip_code} onChange={e => setEditingWs({ ...editingWs, zip_code: e.target.value })} placeholder="00000-000" className={inp} />
                        <button type="button" onClick={handleCepLookup} disabled={isGeocoding} className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1">
                          {isGeocoding ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Buscar
                        </button>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Endereço</label>
                      <input type="text" value={editingWs.address} onChange={e => setEditingWs({ ...editingWs, address: e.target.value })} placeholder="Logradouro" className={inp} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Número / Compl.</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={editingWs.number || ''} onChange={e => setEditingWs({ ...editingWs, number: e.target.value })} placeholder="Nº" className={inp} />
                        <input type="text" value={editingWs.complement || ''} onChange={e => setEditingWs({ ...editingWs, complement: e.target.value })} placeholder="Compl." className={inp} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Bairro</label>
                      <input type="text" value={editingWs.neighborhood} onChange={e => setEditingWs({ ...editingWs, neighborhood: e.target.value })} placeholder="Bairro" className={inp} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cidade / UF *</label>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="text" value={editingWs.city} onChange={e => setEditingWs({ ...editingWs, city: e.target.value })} placeholder="Cidade" className={`col-span-2 ${inp}`} />
                        <input type="text" value={editingWs.state} onChange={e => setEditingWs({ ...editingWs, state: e.target.value.toUpperCase() })} placeholder="UF" maxLength={2} className={`${inp} uppercase text-center`} />
                      </div>
                    </div>
                    <div className="sm:col-span-2 md:col-span-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 shrink-0"><Compass size={18} /></div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-500 block">Coordenadas GPS</span>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-400">Lat:</span>
                              <input type="number" step="any" value={editingWs.lat || ''} onChange={e => setEditingWs({ ...editingWs, lat: parseFloat(e.target.value) || 0 })} className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-400">Lng:</span>
                              <input type="number" step="any" value={editingWs.lng || ''} onChange={e => setEditingWs({ ...editingWs, lng: parseFloat(e.target.value) || 0 })} className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <button type="button" disabled={isGeocoding} onClick={async () => {
                        setIsGeocoding(true);
                        try {
                          const cleanZip = editingWs.zip_code ? editingWs.zip_code.replace(/\D/g, '') : '';
                          let coords = await GeocodingService.geocodeAddress({ zip_code: cleanZip, street: editingWs.address, number: editingWs.number, neighborhood: editingWs.neighborhood, city: editingWs.city, state: editingWs.state });
                          if (!coords || (coords.lat === -23.9618 && coords.lng === -46.3322)) {
                            const q = [editingWs.address, editingWs.neighborhood, editingWs.city, editingWs.state || 'SP', 'Brasil'].filter(Boolean).join(', ');
                            const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
                            if (r.ok) { const d = await r.json(); if (d?.[0]) coords = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) }; }
                          }
                          if (coords) setEditingWs(prev => prev ? ({ ...prev, lat: coords!.lat, lng: coords!.lng }) : null);
                          else alert('Não foi possível calcular GPS. Informe Lat/Lng manualmente.');
                        } catch (err: any) { alert('Erro: ' + err.message); } finally { setIsGeocoding(false); }
                      }} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-xs shrink-0 disabled:opacity-50">
                        {isGeocoding ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                        {isGeocoding ? 'Buscando GPS...' : 'Recalcular GPS'}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setEditingWs(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                    <button type="button" onClick={handleSaveEditing} disabled={isSaving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50">
                      {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar Posto de Trabalho
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Filtrar postos..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500" />
                  </div>
                  <button type="button" onClick={handleStartNew} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0">
                    <Plus size={16} /> + Novo Posto
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredWs.length === 0 ? (
                  <div className="col-span-2 py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Building2 size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-bold uppercase">Nenhum posto encontrado</p>
                    <p className="text-[11px] mt-1">Clique em "+ Novo Posto" para adicionar</p>
                  </div>
                ) : filteredWs.map(ws => {
                  const logoUrl = getCompanyLogoUrl(ws.company);
                  return (
                    <div key={ws.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-xs shrink-0" style={{ backgroundColor: ws.color || '#2563eb' }}><Building2 size={20} /></div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{ws.name}</h4>
                                {ws.code && <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-black px-1.5 py-0.5 rounded font-mono">{ws.code}</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {logoUrl ? <img src={logoUrl} alt={ws.company} className="h-3 object-contain" /> : <span className="text-[10px] font-bold text-slate-500 uppercase">{ws.company}</span>}
                                <span className="text-slate-300">·</span>
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{ws.capacity || 0} vagas</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => handleStartEdit(ws)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar"><Edit3 size={15} /></button>
                            <button type="button" onClick={() => handleDelete(ws.id, ws.name)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Excluir"><Trash2 size={15} /></button>
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-2.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                          <div className="flex items-center gap-1.5 font-medium"><MapPin size={13} className="text-slate-400 shrink-0" /><span className="truncate">{ws.address ? `${ws.address}${ws.number ? `, ${ws.number}` : ''}` : 'Endereço não especificado'}</span></div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase pl-5">{ws.neighborhood || 'Bairro'} · {ws.city || 'Cidade'} / {ws.state || 'SP'} {ws.zip_code ? `· CEP ${ws.zip_code}` : ''}</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-mono">GPS: {ws.lat?.toFixed(4)}, {ws.lng?.toFixed(4)}</span>
                        <span className="font-bold text-indigo-600">Raio: {ws.coverage_radius_km || 15}km</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {activeTab === 'centros' && <CostCentersTab onWorkstationsChange={onWorkstationsChange} />}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">Dados sincronizados globalmente via Supabase.</span>
          <button type="button" onClick={onClose} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition-all">Fechar</button>
        </div>
      </div>
    </div>
  );
}

