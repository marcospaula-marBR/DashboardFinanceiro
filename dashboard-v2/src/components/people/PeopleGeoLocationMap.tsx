"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Employee } from '@/types/loans';
import { Workstation, EmployeeGeoItem, WorkstationOptimizationSummary } from '@/types/workstations';
import { WorkstationsService } from '@/services/workstations.service';
import { GeocodingService, LatLng } from '@/services/geocoding.service';
import { WorkstationsManagerModal } from './WorkstationsManagerModal';
import { getCompanyLogoUrl } from './PeopleBadges';
import {
  Building2, MapPin, Navigation, Compass, Search, Filter,
  CheckCircle2, AlertTriangle, ArrowRight, ExternalLink,
  Users, Sparkles, SlidersHorizontal, RefreshCw, Car, Clock, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PeopleGeoLocationMapProps {
  employees: Employee[];
  onEmployeeClick: (id: string, initialTab?: any) => void;
  showValues: boolean;
}

export function PeopleGeoLocationMap({
  employees,
  onEmployeeClick,
  showValues
}: PeopleGeoLocationMapProps) {
  const [workstations, setWorkstations] = useState<Workstation[]>(() => WorkstationsService.getWorkstations());
  const [isWsManagerOpen, setIsWsManagerOpen] = useState(false);
  const [isLoadingGeo, setIsLoadingGeo] = useState(true);
  const [geoItems, setGeoItems] = useState<EmployeeGeoItem[]>([]);

  // Filtros
  const [selectedWsId, setSelectedWsId] = useState<string>('all');
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(0); // 0 = Sem limite de raio
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedLinkType, setSelectedLinkType] = useState<string>('all');
  const [onlyMisallocated, setOnlyMisallocated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Seleções no mapa
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedWorkstationId, setSelectedWorkstationId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  // 1. Sincronizar postos do Supabase ao montar
  useEffect(() => {
    WorkstationsService.fetchWorkstationsAsync().then(setWorkstations);
  }, []);

  // 2. Geocodificar e calcular distâncias para todos os colaboradores
  useEffect(() => {
    let isCancelled = false;

    async function processGeocoding() {
      setIsLoadingGeo(true);
      const items: EmployeeGeoItem[] = [];

      for (const emp of employees) {
        if (isCancelled) return;

        // Construir endereço completo
        const fullAddr = [
          emp.street,
          emp.number,
          emp.neighborhood,
          emp.city,
          emp.state || 'SP'
        ].filter(Boolean).join(', ');

        const cleanZip = emp.zip_code?.replace(/\D/g, '') || '';
        const hasAddrInfo = Boolean(cleanZip || emp.street || emp.neighborhood || emp.city);

        let coords: LatLng | null = null;
        if (hasAddrInfo) {
          coords = await GeocodingService.geocodeAddress({
            zip_code: cleanZip,
            street: emp.street,
            number: emp.number,
            neighborhood: emp.neighborhood,
            city: emp.city,
            state: emp.state
          });
        }

        // Se ainda não tiver endereço específico, atribuir coordenadas base da cidade ou Santos
        if (!coords) {
          coords = await GeocodingService.geocodeAddress({
            city: emp.city || 'Santos',
            state: emp.state || 'SP'
          });
        }

        const validCoords = coords || { lat: -23.9618, lng: -46.3322 };

        // Identificar posto atual
        const currentLoc = (emp.service_location || '').toLowerCase();
        let assignedWs: Workstation | null = null;
        if (currentLoc) {
          assignedWs = workstations.find(w =>
            currentLoc.includes(w.name.toLowerCase()) ||
            (w.code && currentLoc.includes(w.code.toLowerCase())) ||
            (w.neighborhood && currentLoc.includes(w.neighborhood.toLowerCase())) ||
            (w.city && currentLoc.includes(w.city.toLowerCase()))
          ) || null;
        }

        // Calcular distâncias para todos os postos
        let nearestWs: { workstation: Workstation; distance_km: number } | null = null;
        let distanceToCurrent: number | null = null;

        if (workstations.length > 0) {
          let minDistance = Infinity;
          let closestWs: Workstation | null = null;

          workstations.forEach(ws => {
            const dist = GeocodingService.calculateDistanceKm(validCoords, { lat: ws.lat, lng: ws.lng });
            if (dist < minDistance) {
              minDistance = dist;
              closestWs = ws;
            }
            if (assignedWs && ws.id === assignedWs.id) {
              distanceToCurrent = dist;
            }
          });

          if (closestWs) {
            nearestWs = {
              workstation: closestWs,
              distance_km: minDistance
            };
          }
        }

        // Verificar oportunidade de remanejamento
        let potentialOpt: EmployeeGeoItem['potential_optimization'] = null;
        if (assignedWs && nearestWs && nearestWs.workstation.id !== assignedWs.id) {
          const curDist = distanceToCurrent || GeocodingService.calculateDistanceKm(validCoords, { lat: assignedWs.lat, lng: assignedWs.lng });
          const diff = curDist - nearestWs.distance_km;
          if (diff >= 3) { // Se a diferença for de ao menos 3 km
            potentialOpt = {
              better_workstation: nearestWs.workstation,
              saved_distance_km: Number(diff.toFixed(1)),
              reason: `Mora a ${nearestWs.distance_km}km de ${nearestWs.workstation.name} vs. ${curDist.toFixed(1)}km do local atual (${assignedWs.name})`
            };
          }
        }

        items.push({
          employee_id: emp.id,
          name: emp.name,
          job_role: emp.job_role,
          department: emp.department,
          company: emp.company,
          linkType: emp.linkType || 'CLT',
          is_outsourced: emp.is_outsourced || emp.metadata?.is_outsourced,
          photo_url: emp.photo_url,
          full_address: fullAddr || 'Endereço não informado',
          neighborhood: emp.neighborhood,
          city: emp.city,
          state: emp.state,
          zip_code: emp.zip_code,
          lat: validCoords.lat,
          lng: validCoords.lng,
          has_valid_coords: hasAddrInfo,
          current_service_location: emp.service_location,
          assigned_workstation: assignedWs,
          nearest_workstation: nearestWs,
          distance_to_current_workstation_km: distanceToCurrent,
          potential_optimization: potentialOpt
        });
      }

      if (!isCancelled) {
        setGeoItems(items);
        setIsLoadingGeo(false);
      }
    }

    processGeocoding();

    return () => {
      isCancelled = true;
    };
  }, [employees, workstations]);

  // 3. Filtrar itens para o mapa
  const filteredGeoItems = useMemo(() => {
    return geoItems.filter(item => {
      // Busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesRole = (item.job_role || '').toLowerCase().includes(q);
        const matchesNeigh = (item.neighborhood || '').toLowerCase().includes(q);
        const matchesCity = (item.city || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesNeigh && !matchesCity) return false;
      }

      // Empresa
      if (selectedCompany !== 'all' && item.company !== selectedCompany) return false;

      // Regime / Vínculo
      if (selectedLinkType !== 'all') {
        if (selectedLinkType === 'terceirizado' && !item.is_outsourced) return false;
        if (selectedLinkType === 'clt' && (item.is_outsourced || item.linkType !== 'CLT')) return false;
        if (selectedLinkType === 'pj' && (item.is_outsourced || item.linkType === 'CLT')) return false;
      }

      // Apenas com oportunidade de otimização
      if (onlyMisallocated && !item.potential_optimization) return false;

      // Posto de trabalho selecionado
      if (selectedWsId !== 'all') {
        const ws = workstations.find(w => w.id === selectedWsId);
        if (ws) {
          const dist = GeocodingService.calculateDistanceKm({ lat: item.lat, lng: item.lng }, { lat: ws.lat, lng: ws.lng });
          // Se tiver raio ativo
          if (selectedRadiusKm > 0 && dist > selectedRadiusKm) return false;
          // Se for posto específico sem raio, checar se é o mais próximo ou o atribuído
          if (selectedRadiusKm === 0 && item.assigned_workstation?.id !== ws.id && item.nearest_workstation?.workstation.id !== ws.id) {
            return false;
          }
        }
      }

      return true;
    });
  }, [geoItems, searchQuery, selectedCompany, selectedLinkType, onlyMisallocated, selectedWsId, selectedRadiusKm, workstations]);

  // 4. Métricas executivas
  const metrics: WorkstationOptimizationSummary = useMemo(() => {
    const withAddress = geoItems.filter(g => g.has_valid_coords).length;
    const misallocated = geoItems.filter(g => !!g.potential_optimization);
    const savedKm = misallocated.reduce((sum, item) => sum + (item.potential_optimization?.saved_distance_km || 0), 0);

    return {
      totalEmployeesWithAddress: withAddress,
      totalWithoutCoordinates: geoItems.length - withAddress,
      totalWorkstations: workstations.length,
      optimizedCount: geoItems.length - misallocated.length,
      misallocatedCount: misallocated.length,
      potentialKmSaved: Number(savedKm.toFixed(1))
    };
  }, [geoItems, workstations]);

  // Colaborador ativo selecionado
  const activeEmployeeGeo = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return geoItems.find(g => g.employee_id === selectedEmployeeId) || null;
  }, [selectedEmployeeId, geoItems]);

  // Posto ativo selecionado
  const activeWorkstation = useMemo(() => {
    if (!selectedWorkstationId) return null;
    return workstations.find(w => w.id === selectedWorkstationId) || null;
  }, [selectedWorkstationId, workstations]);

  // 5. Inicializar e Renderizar Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    // Carregar folha de estilos do Leaflet se ainda não existir
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Carregar script do Leaflet se window.L ainda não existir
    const loadLeafletScript = () => {
      return new Promise<void>((resolve) => {
        if ((window as any).L) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => resolve();
        document.body.appendChild(script);
      });
    };

    loadLeafletScript().then(() => {
      if (!isMounted || !mapContainerRef.current) return;
      const L = (window as any).L;
      if (!L) return;

      // Se já existir mapa, apenas limpar camadas ou resetar container
      if (!leafletMapRef.current) {
        // Centro inicial: Santos / Baixada Santista
        const map = L.map(mapContainerRef.current, {
          center: [-23.9618, -46.3322],
          zoom: 12,
          zoomControl: false
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Tile layer suave e moderno (OpenStreetMap CartoDB Positron)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19
        }).addTo(map);

        markersLayerRef.current = L.layerGroup().addTo(map);
        routeLayerRef.current = L.layerGroup().addTo(map);

        leafletMapRef.current = map;
      }

      const map = leafletMapRef.current;
      const markersLayer = markersLayerRef.current;
      const routeLayer = routeLayerRef.current;

      markersLayer.clearLayers();
      routeLayer.clearLayers();

      const allLatLngs: [number, number][] = [];

      // ── Adicionar Postos de Trabalho no Mapa ──
      workstations.forEach(ws => {
        const logoUrl = getCompanyLogoUrl(ws.company);
        const wsIconHtml = `
          <div style="
            background-color: ${ws.color || '#2563eb'};
            width: 38px;
            height: 38px;
            border-radius: 12px;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            cursor: pointer;
            position: relative;
            transition: transform 0.2s;
          " class="ws-marker-hover" title="${ws.name}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
              <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
            </svg>
            <div style="
              position: absolute;
              bottom: -6px;
              right: -6px;
              background: #0f172a;
              color: white;
              font-size: 9px;
              font-weight: 900;
              padding: 1px 4px;
              border-radius: 6px;
              border: 1px solid white;
            ">${ws.capacity || 0}</div>
          </div>
        `;

        const customWsIcon = L.divIcon({
          html: wsIconHtml,
          className: 'custom-ws-marker',
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });

        const marker = L.marker([ws.lat, ws.lng], { icon: customWsIcon });
        
        // Raio de cobertura sugerido
        if (ws.coverage_radius_km && selectedWsId === ws.id) {
          L.circle([ws.lat, ws.lng], {
            radius: ws.coverage_radius_km * 1000,
            color: ws.color || '#2563eb',
            fillColor: ws.color || '#2563eb',
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: '4, 4'
          }).addTo(markersLayer);
        }

        marker.on('click', () => {
          setSelectedWorkstationId(ws.id);
          setSelectedEmployeeId(null);
        });

        marker.bindTooltip(`<strong>${ws.name}</strong><br/>${ws.neighborhood}, ${ws.city} (${ws.capacity} vagas)`, {
          direction: 'top',
          offset: [0, -15]
        });

        marker.addTo(markersLayer);
        allLatLngs.push([ws.lat, ws.lng]);
      });

      // ── Adicionar Colaboradores no Mapa ──
      filteredGeoItems.forEach(empItem => {
        const isSelected = selectedEmployeeId === empItem.employee_id;
        const hasOpt = Boolean(empItem.potential_optimization);
        const borderColor = empItem.is_outsourced ? '#f59e0b' : empItem.linkType === 'CLT' ? '#3b82f6' : '#8b5cf6';
        const initials = empItem.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

        const empIconHtml = `
          <div style="
            background: white;
            width: ${isSelected ? '34px' : '26px'};
            height: ${isSelected ? '34px' : '26px'};
            border-radius: 50%;
            border: ${isSelected ? '3px solid #0f172a' : `2.5px solid ${borderColor}`};
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${isSelected ? '11px' : '9px'};
            font-weight: 900;
            color: #1e293b;
            cursor: pointer;
            position: relative;
            transition: all 0.2s;
            ${hasOpt ? 'box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.4);' : ''}
          ">
            ${empItem.photo_url ? `<img src="${empItem.photo_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />` : initials}
            ${hasOpt ? `<div style="position:absolute;top:-3px;right:-3px;width:8px;height:8px;border-radius:50%;background:#f43f5e;border:1px solid white;"></div>` : ''}
          </div>
        `;

        const customEmpIcon = L.divIcon({
          html: empIconHtml,
          className: 'custom-emp-marker',
          iconSize: [isSelected ? 34 : 26, isSelected ? 34 : 26],
          iconAnchor: [isSelected ? 17 : 13, isSelected ? 17 : 13]
        });

        const marker = L.marker([empItem.lat, empItem.lng], { icon: customEmpIcon });

        marker.on('click', () => {
          setSelectedEmployeeId(empItem.employee_id);
          setSelectedWorkstationId(null);
        });

        marker.bindTooltip(`<strong>${empItem.name}</strong><br/>${empItem.neighborhood || empItem.city || 'Residência'}<br/>${empItem.job_role || empItem.linkType}`, {
          direction: 'top',
          offset: [0, -12]
        });

        marker.addTo(markersLayer);
        allLatLngs.push([empItem.lat, empItem.lng]);
      });

      // ── Desenhar Rota / Linha se houver colaborador selecionado ──
      if (activeEmployeeGeo) {
        const empCoords: [number, number] = [activeEmployeeGeo.lat, activeEmployeeGeo.lng];

        // Linha para o Posto Mais Próximo (Verde)
        if (activeEmployeeGeo.nearest_workstation) {
          const nearestWs = activeEmployeeGeo.nearest_workstation.workstation;
          const nearestCoords: [number, number] = [nearestWs.lat, nearestWs.lng];

          const line = L.polyline([empCoords, nearestCoords], {
            color: '#10b981', // Verde
            weight: 3.5,
            opacity: 0.85,
            smoothFactor: 1
          }).addTo(routeLayer);

          line.bindTooltip(`Mais próximo: ${nearestWs.name} (${activeEmployeeGeo.nearest_workstation.distance_km} km)`, {
            permanent: true,
            direction: 'center',
            className: 'route-tooltip-green'
          });
        }

        // Linha para o Posto Atual Atribuído (Azul ou Laranja se for diferente)
        if (activeEmployeeGeo.assigned_workstation && activeEmployeeGeo.nearest_workstation?.workstation.id !== activeEmployeeGeo.assigned_workstation.id) {
          const assignedWs = activeEmployeeGeo.assigned_workstation;
          const assignedCoords: [number, number] = [assignedWs.lat, assignedWs.lng];

          const curLine = L.polyline([empCoords, assignedCoords], {
            color: '#f43f5e', // Rosa/Vermelho para alertar distância maior
            weight: 2.5,
            dashArray: '6, 6',
            opacity: 0.75
          }).addTo(routeLayer);

          curLine.bindTooltip(`Posto Atual: ${assignedWs.name} (${activeEmployeeGeo.distance_to_current_workstation_km || '—'} km)`, {
            permanent: false,
            direction: 'center'
          });
        }
      }

      // Ajustar visualização para enquadrar os pontos
      if (allLatLngs.length > 0 && (!selectedEmployeeId || allLatLngs.length <= 2)) {
        try {
          map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40], maxZoom: 14 });
        } catch {}
      }
    });

    return () => {
      isMounted = false;
    };
  }, [workstations, filteredGeoItems, activeEmployeeGeo, selectedEmployeeId, selectedWsId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ── Top Metric Banner: Otimização de Atuação & Postos ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Colaboradores Mapeados</span>
            <Users size={16} className="text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {metrics.totalEmployeesWithAddress}
            </span>
            <span className="text-xs text-slate-400 font-bold">
              de {geoItems.length} ({Math.round((metrics.totalEmployeesWithAddress / (geoItems.length || 1)) * 100)}%)
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Endereços e CEPs georreferenciados</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Postos de Trabalho</span>
            <Building2 size={16} className="text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {metrics.totalWorkstations}
            </span>
            <span className="text-xs text-slate-400 font-bold">Bases ativas</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Sedes, galpões e postos operacionais</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Oportunidades de Remanejamento</span>
            <Sparkles size={16} className="text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {metrics.misallocatedCount}
            </span>
            <span className="text-xs text-rose-500 font-bold">Colaboradores</span>
          </div>
          <div className="text-[10px] text-rose-500 mt-1 font-medium">Moram mais perto de outro posto</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Economia Potencial de Rota</span>
            <Car size={16} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {metrics.potentialKmSaved} km
            </span>
            <span className="text-xs text-slate-400 font-bold">/dia</span>
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">Menos tempo de trânsito e VT</div>
        </div>
      </div>

      {/* ── Toolbar de Filtros & Ações Rápidas ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar colaborador, bairro ou cidade..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Seletor de Posto de Trabalho */}
          <select
            value={selectedWsId}
            onChange={e => setSelectedWsId(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
          >
            <option value="all">🏢 Todos os Postos ({workstations.length})</option>
            {workstations.map(w => (
              <option key={w.id} value={w.id}>📍 {w.name} ({w.city})</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Raio de Distância */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 px-2">Raio:</span>
            {[
              { label: 'Todos', val: 0 },
              { label: '≤ 5km', val: 5 },
              { label: '≤ 10km', val: 10 },
              { label: '≤ 20km', val: 20 },
              { label: '≤ 50km', val: 50 }
            ].map(r => (
              <button
                key={r.val}
                type="button"
                onClick={() => setSelectedRadiusKm(r.val)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  selectedRadiusKm === r.val
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs border border-slate-200 dark:border-slate-700'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Toggle Apenas Otimizações */}
          <button
            type="button"
            onClick={() => setOnlyMisallocated(!onlyMisallocated)}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border ${
              onlyMisallocated
                ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={14} className={onlyMisallocated ? 'text-rose-600' : 'text-slate-400'} />
            <span>Oportunidades ({metrics.misallocatedCount})</span>
          </button>

          {/* Botão Gerenciar Postos de Trabalho */}
          <button
            type="button"
            onClick={() => setIsWsManagerOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
          >
            <Building2 size={15} />
            <span>Gerenciar Postos</span>
          </button>
        </div>
      </div>

      {/* ── Viewport do Mapa e Painel Lateral ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Container do Mapa Leaflet */}
        <div className="lg:col-span-2 relative bg-slate-100 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner h-[580px] flex flex-col">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Legenda Flutuante sobre o Mapa */}
          <div className="absolute top-4 left-4 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-md text-xs space-y-2 pointer-events-auto max-w-[240px]">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Legenda do Mapa</span>
            <div className="space-y-1.5 text-[11px] font-bold">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-blue-600 border border-white shadow-xs shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">Posto de Trabalho (Base)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-xs shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">Colaborador CLT</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500 border border-white shadow-xs shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">Colaborador PJ</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 border border-white shadow-xs shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">Terceirizado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-rose-300 shrink-0" />
                <span className="text-rose-600 font-black">Oportunidade de Troca</span>
              </div>
            </div>
          </div>

          {/* Feedback de Carregamento */}
          {isLoadingGeo && (
            <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs z-30 flex items-center justify-center gap-3 text-xs font-black uppercase text-indigo-700">
              <RefreshCw size={20} className="animate-spin text-indigo-600" />
              <span>Calculando geolocalização e rotas de proximidade...</span>
            </div>
          )}
        </div>

        {/* ── Painel Lateral de Otimização & Detalhes ── */}
        <div className="space-y-4 flex flex-col h-[580px]">
          
          {/* Se um colaborador estiver selecionado */}
          {activeEmployeeGeo ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex-1 flex flex-col justify-between overflow-y-auto animate-in fade-in">
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-indigo-700 text-sm overflow-hidden shrink-0 shadow-xs">
                      {activeEmployeeGeo.photo_url ? (
                        <img src={activeEmployeeGeo.photo_url} alt={activeEmployeeGeo.name} className="w-full h-full object-cover" />
                      ) : (
                        activeEmployeeGeo.name.split(' ').map(n => n[0]).slice(0, 2).join('')
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        {activeEmployeeGeo.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {activeEmployeeGeo.job_role || activeEmployeeGeo.department || 'Colaborador'} · <strong className="text-indigo-600 uppercase">{activeEmployeeGeo.linkType}</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeId(null)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-700"
                  >
                    ✕
                  </button>
                </div>

                {/* Endereço Residencial */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 text-xs space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Moradia (Origem)</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <MapPin size={14} className="text-indigo-600 shrink-0" />
                    <span>{activeEmployeeGeo.full_address}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 pl-5">
                    {activeEmployeeGeo.neighborhood ? `${activeEmployeeGeo.neighborhood} · ` : ''}
                    {activeEmployeeGeo.city || 'Cidade'} / {activeEmployeeGeo.state || 'SP'}
                    {activeEmployeeGeo.zip_code ? ` (CEP: ${activeEmployeeGeo.zip_code})` : ''}
                  </div>
                </div>

                {/* Comparativo de Postos */}
                <div className="space-y-2.5">
                  {/* Posto Atual */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-white dark:bg-slate-900 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Posto Atual (Destino)</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-white">
                        {activeEmployeeGeo.assigned_workstation?.name || activeEmployeeGeo.current_service_location || 'Não alocado formalmente'}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono">
                      {activeEmployeeGeo.distance_to_current_workstation_km !== null
                        ? `${activeEmployeeGeo.distance_to_current_workstation_km} km`
                        : '—'}
                    </span>
                  </div>

                  {/* Posto Mais Próximo */}
                  {activeEmployeeGeo.nearest_workstation && (
                    <div className="border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-3 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            Posto Mais Próximo da Residência
                          </span>
                        </div>
                        <span className="text-xs font-black text-emerald-950 dark:text-emerald-200 block mt-0.5">
                          {activeEmployeeGeo.nearest_workstation.workstation.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">
                          {activeEmployeeGeo.nearest_workstation.distance_km} km
                        </span>
                        <span className="text-[9px] text-emerald-600 block">
                          ~{GeocodingService.estimateTravelTimeMinutes(activeEmployeeGeo.nearest_workstation.distance_km)} min
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Alerta de Otimização se houver */}
                {activeEmployeeGeo.potential_optimization && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-800 space-y-1.5">
                    <div className="flex items-center gap-2 font-black uppercase tracking-tight text-rose-700">
                      <Sparkles size={16} className="text-rose-600" />
                      <span>Sugestão de Remanejamento</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-rose-700">
                      Remanejando este colaborador para <strong>{activeEmployeeGeo.potential_optimization.better_workstation.name}</strong>, a distância de trajeto é reduzida em <strong>{activeEmployeeGeo.potential_optimization.saved_distance_km} km por percurso</strong>.
                    </p>
                  </div>
                )}
              </div>

              {/* Ação: Abrir Ficha */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onEmployeeClick(activeEmployeeGeo.employee_id, 'pessoal')}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <ExternalLink size={14} />
                  <span>Abrir Ficha do Integrante</span>
                </button>
              </div>
            </div>
          ) : activeWorkstation ? (
            /* Se um Posto de Trabalho estiver selecionado */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex-1 flex flex-col justify-between overflow-y-auto animate-in fade-in">
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-xs shrink-0"
                      style={{ backgroundColor: activeWorkstation.color || '#2563eb' }}
                    >
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        {activeWorkstation.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {activeWorkstation.neighborhood}, {activeWorkstation.city} · {activeWorkstation.capacity || 0} vagas
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedWorkstationId(null)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Colaboradores Mais Próximos deste Posto</span>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-[300px] overflow-y-auto space-y-1">
                    {filteredGeoItems
                      .map(item => ({
                        ...item,
                        distToWs: GeocodingService.calculateDistanceKm({ lat: item.lat, lng: item.lng }, { lat: activeWorkstation.lat, lng: activeWorkstation.lng })
                      }))
                      .sort((a, b) => a.distToWs - b.distToWs)
                      .slice(0, 15)
                      .map(item => (
                        <div
                          key={item.employee_id}
                          onClick={() => setSelectedEmployeeId(item.employee_id)}
                          className="py-2 flex items-center justify-between hover:bg-white dark:hover:bg-slate-700 p-1.5 rounded-xl cursor-pointer transition-colors"
                        >
                          <div className="truncate pr-2">
                            <span className="font-bold text-slate-800 dark:text-white block truncate">{item.name}</span>
                            <span className="text-[10px] text-slate-400">{item.neighborhood || item.city} · {item.linkType}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-indigo-600 font-mono text-xs block">{item.distToWs} km</span>
                            <span className="text-[9px] text-slate-400">~{GeocodingService.estimateTravelTimeMinutes(item.distToWs)} min</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWsManagerOpen(true)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  Editar Dados Deste Posto
                </button>
              </div>
            </div>
          ) : (
            /* Lista Padrão de Sugestões de Remanejamento */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-rose-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                    Oportunidades de Otimização
                  </h3>
                </div>
                <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                  {metrics.misallocatedCount} Alertas
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {geoItems.filter(g => !!g.potential_optimization).length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 opacity-60" />
                    <p className="text-xs font-bold uppercase text-slate-600">Alocação 100% Otimizada</p>
                    <p className="text-[11px] text-slate-400">Todos os colaboradores com endereço moram no posto mais próximo.</p>
                  </div>
                ) : (
                  geoItems
                    .filter(g => !!g.potential_optimization)
                    .map(item => (
                      <div
                        key={item.employee_id}
                        onClick={() => setSelectedEmployeeId(item.employee_id)}
                        className="bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 cursor-pointer transition-all hover:shadow-xs group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md font-mono shrink-0">
                            -{item.potential_optimization?.saved_distance_km} km
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-500 space-y-1">
                          <div>Mora em: <strong>{item.neighborhood || item.city}</strong></div>
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <span className="text-slate-400 line-through truncate">{item.assigned_workstation?.name || 'Local Atual'}</span>
                            <ArrowRight size={10} className="text-indigo-600 shrink-0" />
                            <strong className="text-emerald-700 dark:text-emerald-400 truncate">{item.potential_optimization?.better_workstation.name}</strong>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Modal de Gestão de Postos de Trabalho ── */}
      {isWsManagerOpen && (
        <WorkstationsManagerModal
          isOpen={isWsManagerOpen}
          onClose={() => setIsWsManagerOpen(false)}
          onWorkstationsChange={() => {
            setWorkstations(WorkstationsService.getWorkstations());
          }}
        />
      )}

    </div>
  );
}
