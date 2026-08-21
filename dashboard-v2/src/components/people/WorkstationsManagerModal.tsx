"use client";

import React, { useState } from 'react';
import { X, Building2, MapPin, Plus, Trash2, Edit3, Save, CheckCircle2, Search, Loader2, Compass, Navigation } from 'lucide-react';
import { Workstation } from '@/types/workstations';
import { WorkstationsService } from '@/services/workstations.service';
import { GeocodingService } from '@/services/geocoding.service';
import { getCompanyLogoUrl } from './PeopleBadges';

interface WorkstationsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkstationsChange: () => void;
}

const COMPANIES: ('MarBR' | 'DZM' | 'G2' | 'Ybox' | 'Conectius' | 'Pessoal' | 'Usatell')[] = [
  'MarBR', 'DZM', 'G2', 'Ybox', 'Conectius', 'Pessoal', 'Usatell'
];

const PRESET_COLORS = [
  '#2563eb', // Azul Royal
  '#059669', // Verde Esmeralda
  '#7c3aed', // Roxo
  '#ea580c', // Laranja
  '#0891b2', // Ciano
  '#db2777', // Rosa
  '#475569'  // Grafite
];

export function WorkstationsManagerModal({
  isOpen,
  onClose,
  onWorkstationsChange
}: WorkstationsManagerModalProps) {
  const [workstations, setWorkstations] = useState<Workstation[]>(() => WorkstationsService.getWorkstations());
  const [editingWs, setEditingWs] = useState<Workstation | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const handleStartNew = () => {
    setEditingWs({
      id: `ws-${Date.now()}`,
      name: '',
      code: '',
      company: 'MarBR',
      color: '#2563eb',
      address: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: 'Santos',
      state: 'SP',
      zip_code: '',
      lat: -23.9618,
      lng: -46.3322,
      capacity: 10,
      coverage_radius_km: 15,
      notes: '',
      active: true
    });
    setIsNew(true);
  };

  const handleStartEdit = (ws: Workstation) => {
    setEditingWs({ ...ws });
    setIsNew(false);
  };

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
          const updatedStreet = data.logradouro || editingWs.address;
          const updatedNeigh = data.bairro || editingWs.neighborhood;
          const updatedCity = data.localidade || editingWs.city;
          const updatedState = data.uf || editingWs.state;

          const coords = await GeocodingService.geocodeAddress({
            zip_code: cleanCep,
            street: updatedStreet,
            neighborhood: updatedNeigh,
            city: updatedCity,
            state: updatedState
          });

          setEditingWs(prev => {
            if (!prev) return null;
            return {
              ...prev,
              address: updatedStreet,
              neighborhood: updatedNeigh,
              city: updatedCity,
              state: updatedState,
              lat: coords ? coords.lat : prev.lat,
              lng: coords ? coords.lng : prev.lng
            };
          });
        }
      }
    } catch (e) {
      console.warn('Erro ao consultar CEP:', e);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSaveEditing = async () => {
    if (!editingWs || !editingWs.name.trim() || !editingWs.city.trim()) {
      alert('Por favor, informe ao menos o Nome e a Cidade do Posto de Trabalho.');
      return;
    }

    setIsSaving(true);
    try {
      let finalLat = editingWs.lat;
      let finalLng = editingWs.lng;

      // Se as coordenadas estiverem zeradas ou padrão, tentar obter via GeocodingService
      if (!finalLat || !finalLng || (finalLat === 0 && finalLng === 0)) {
        const coords = await GeocodingService.geocodeAddress({
          zip_code: editingWs.zip_code,
          street: editingWs.address,
          number: editingWs.number,
          neighborhood: editingWs.neighborhood,
          city: editingWs.city,
          state: editingWs.state
        });
        if (coords) {
          finalLat = coords.lat;
          finalLng = coords.lng;
        }
      }

      const toSave: Workstation = {
        ...editingWs,
        lat: finalLat,
        lng: finalLng
      };

      const updated = await WorkstationsService.upsertWorkstation(toSave);
      setWorkstations(updated);
      setEditingWs(null);
      setIsNew(false);
      onWorkstationsChange();
    } catch (e: any) {
      alert('Erro ao salvar posto de trabalho: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente remover o posto de trabalho "${name}"?`)) return;

    try {
      const updated = await WorkstationsService.deleteWorkstation(id);
      setWorkstations(updated);
      if (editingWs?.id === id) {
        setEditingWs(null);
      }
      onWorkstationsChange();
    } catch (e: any) {
      alert('Erro ao excluir posto: ' + e.message);
    }
  };

  const filteredWorkstations = workstations.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.neighborhood.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Building2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white uppercase">
                  Gestão de Postos de Trabalho &amp; Bases
                </h2>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-md uppercase border border-indigo-500/30">
                  {workstations.length} Cadastrados
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Configure os pontos de atendimento, unidades e bases operacionais para cálculo de rotas e proximidade
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Se estiver editando ou criando um posto */}
          {editingWs ? (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <MapPin size={16} className="text-indigo-600" />
                  <span>{isNew ? 'Cadastrar Novo Posto de Trabalho' : `Editar: ${editingWs.name}`}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingWs(null)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancelar Edição
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Nome do Posto */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Nome do Posto / Unidade *
                  </label>
                  <input
                    type="text"
                    value={editingWs.name}
                    onChange={e => setEditingWs({ ...editingWs, name: e.target.value })}
                    placeholder="Ex: Matriz Santos, Galpão Praia Grande, Base Cubatão..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Código / Sigla */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Código / Sigla
                  </label>
                  <input
                    type="text"
                    value={editingWs.code || ''}
                    onChange={e => setEditingWs({ ...editingWs, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: MAT-SAN, GAL-PG..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 uppercase"
                  />
                </div>

                {/* Empresa do Grupo */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Empresa do Grupo
                  </label>
                  <select
                    value={editingWs.company}
                    onChange={e => setEditingWs({ ...editingWs, company: e.target.value as any })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                  >
                    {COMPANIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Cor do Marcador */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Cor do Marcador no Mapa
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingWs.color || '#2563eb'}
                      onChange={e => setEditingWs({ ...editingWs, color: e.target.value })}
                      className="w-9 h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <div className="flex items-center gap-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditingWs({ ...editingWs, color: c })}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${editingWs.color === c ? 'scale-110 border-slate-900 shadow-xs' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Vagas / Lotação */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Capacidade de Vagas (Lotação)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingWs.capacity || 10}
                    onChange={e => setEditingWs({ ...editingWs, capacity: parseInt(e.target.value) || 1 })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {/* CEP com busca automática */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    CEP
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editingWs.zip_code}
                      onChange={e => setEditingWs({ ...editingWs, zip_code: e.target.value })}
                      placeholder="00000-000"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleCepLookup}
                      disabled={isGeocoding}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold shrink-0 transition-colors flex items-center gap-1"
                      title="Buscar endereço e coordenadas pelo CEP"
                    >
                      {isGeocoding ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                      <span>Buscar</span>
                    </button>
                  </div>
                </div>

                {/* Endereço / Logradouro */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Endereço / Logradouro
                  </label>
                  <input
                    type="text"
                    value={editingWs.address}
                    onChange={e => setEditingWs({ ...editingWs, address: e.target.value })}
                    placeholder="Ex: Rua General Câmara"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Número e Complemento */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Número / Compl.
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editingWs.number || ''}
                      onChange={e => setEditingWs({ ...editingWs, number: e.target.value })}
                      placeholder="Nº"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={editingWs.complement || ''}
                      onChange={e => setEditingWs({ ...editingWs, complement: e.target.value })}
                      placeholder="Compl."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Bairro */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={editingWs.neighborhood}
                    onChange={e => setEditingWs({ ...editingWs, neighborhood: e.target.value })}
                    placeholder="Ex: Centro, Gonzaga, Ribeirópolis..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Cidade e UF */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Cidade / UF *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editingWs.city}
                      onChange={e => setEditingWs({ ...editingWs, city: e.target.value })}
                      placeholder="Cidade"
                      className="col-span-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={editingWs.state}
                      onChange={e => setEditingWs({ ...editingWs, state: e.target.value.toUpperCase() })}
                      placeholder="UF"
                      maxLength={2}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 uppercase text-center"
                    />
                  </div>
                </div>

                {/* Coordenadas Lat / Lng */}
                <div className="sm:col-span-2 md:col-span-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Compass size={18} className="text-indigo-600" />
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Coordenadas Geográficas (GPS)</span>
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        Lat: {editingWs.lat ? editingWs.lat.toFixed(5) : 'Auto'} | Lng: {editingWs.lng ? editingWs.lng.toFixed(5) : 'Auto'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      setIsGeocoding(true);
                      const coords = await GeocodingService.geocodeAddress({
                        zip_code: editingWs.zip_code,
                        street: editingWs.address,
                        number: editingWs.number,
                        neighborhood: editingWs.neighborhood,
                        city: editingWs.city,
                        state: editingWs.state
                      });
                      if (coords) {
                        setEditingWs(prev => prev ? ({ ...prev, lat: coords.lat, lng: coords.lng }) : null);
                      }
                      setIsGeocoding(false);
                    }}
                    disabled={isGeocoding}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Navigation size={13} />
                    <span>Recalcular GPS</span>
                  </button>
                </div>
              </div>

              {/* Botões de Ação da Edição */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWs(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditing}
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  <span>Salvar Posto de Trabalho</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filtrar postos por nome, bairro ou cidade..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={handleStartNew}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0"
              >
                <Plus size={16} />
                <span>+ Novo Posto</span>
              </button>
            </div>
          )}

          {/* Lista de Postos Cadastrados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredWorkstations.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <Building2 size={32} className="mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-xs font-bold uppercase">Nenhum posto de trabalho encontrado</p>
                <p className="text-[11px] text-slate-400 mt-1">Clique em "+ Novo Posto" para adicionar</p>
              </div>
            ) : (
              filteredWorkstations.map(ws => {
                const logoUrl = getCompanyLogoUrl(ws.company);
                return (
                  <div
                    key={ws.id}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-xs shrink-0"
                            style={{ backgroundColor: ws.color || '#2563eb' }}
                          >
                            <Building2 size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                {ws.name}
                              </h4>
                              {ws.code && (
                                <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-black px-1.5 py-0.5 rounded font-mono">
                                  {ws.code}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {logoUrl ? (
                                <img src={logoUrl} alt={ws.company} className="h-3 object-contain" />
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500 uppercase">{ws.company}</span>
                              )}
                              <span className="text-slate-300">·</span>
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.2 rounded-full">
                                {ws.capacity || 0} vagas
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(ws)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Editar Posto"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(ws.id, ws.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Excluir Posto"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Endereço */}
                      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-2.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-medium">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">
                            {ws.address ? `${ws.address}${ws.number ? `, ${ws.number}` : ''}` : 'Endereço não especificado'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase pl-5">
                          {ws.neighborhood || 'Bairro'} · {ws.city || 'Cidade'} / {ws.state || 'SP'} {ws.zip_code ? `· CEP ${ws.zip_code}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-mono">
                        GPS: {ws.lat?.toFixed(4)}, {ws.lng?.toFixed(4)}
                      </span>
                      <span className="font-bold text-indigo-600">
                        Raio Sugerido: {ws.coverage_radius_km || 15}km
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Postos e coordenadas são salvos globalmente e sincronizados entre todas as contas.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
