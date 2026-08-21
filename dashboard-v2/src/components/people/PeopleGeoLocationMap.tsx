"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Employee } from '@/types/loans';
import { Workstation, EmployeeGeoItem, WorkstationOptimizationSummary } from '@/types/workstations';
import { WorkstationsService } from '@/services/workstations.service';
import { GeocodingService, LatLng } from '@/services/geocoding.service';
import { WorkstationsManagerModal } from './WorkstationsManagerModal';
import { GeminiRouteAdvisorModal } from './GeminiRouteAdvisorModal';
import { getCompanyLogoUrl } from './PeopleBadges';
import {
  Building2, MapPin, Navigation, Compass, Search, Filter,
  CheckCircle2, AlertTriangle, ArrowRight, ExternalLink,
  Users, Sparkles, SlidersHorizontal, RefreshCw, Car, Clock,
  ChevronRight, Layers, Table, Map as MapIcon, ArrowUpRight, Check, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PeopleGeoLocationMapProps {
  employees: Employee[];
  onEmployeeClick: (id: string, initialTab?: any) => void;
  showValues: boolean;
}

type DisplayMode = 'map' | 'workstations_only' | 'matrix';
type MapTileStyle = 'voyager' | 'streets' | 'satellite';

const MAP_TILE_PROVIDERS: Record<MapTileStyle, { url: string; attribution: string; name: string; icon: string }> = {
  voyager: {
    name: 'Executivo',
    icon: '🏙️',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap'
  },
  streets: {
    name: 'Ruas & Trânsito',
    icon: '🛣️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  satellite: {
    name: 'Satélite HD',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics'
  }
};

export function PeopleGeoLocationMap({
  employees,
  onEmployeeClick,
  showValues
}: PeopleGeoLocationMapProps) {
  const [workstations, setWorkstations] = useState<Workstation[]>(() => WorkstationsService.getWorkstations());
  const [isWsManagerOpen, setIsWsManagerOpen] = useState(false);
  const [isGeminiAdvisorOpen, setIsGeminiAdvisorOpen] = useState(false);
  const [isLoadingGeo, setIsLoadingGeo] = useState(true);
  const [geoItems, setGeoItems] = useState<EmployeeGeoItem[]>([]);

  // Modo de Exibição: Mapa Completo vs. Apenas Postos (Calibração) vs. Matriz
  const [displayMode, setDisplayMode] = useState<DisplayMode>('map');
  const [mapStyle, setMapStyle] = useState<MapTileStyle>('voyager');

  // Estado de Calibração / Drag & Drop de Postos
  const [pendingWsDrag, setPendingWsDrag] = useState<{ wsId: string; wsName: string; lat: number; lng: number } | null>(null);
  const [isSavingDrag, setIsSavingDrag] = useState(false);

  // Filtros
  const [selectedWsId, setSelectedWsId] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(0);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedLinkType, setSelectedLinkType] = useState<string>('all');
  const [addressFilterMode, setAddressFilterMode] = useState<'all' | 'with_address' | 'no_address'>('all');
  const [onlyMisallocated, setOnlyMisallocated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Seleções no mapa
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedWorkstationId, setSelectedWorkstationId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const circlesLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  // 1. Sincronizar postos do Supabase ao montar
  useEffect(() => {
    WorkstationsService.fetchWorkstationsAsync().then(setWorkstations);
  }, []);

  // 2. Geocodificar e calcular distâncias para TODOS os colaboradores
  useEffect(() => {
    let isCancelled = false;

    async function processGeocoding() {
      setIsLoadingGeo(true);
      const items: EmployeeGeoItem[] = [];

      for (const emp of employees) {
        if (isCancelled) return;

        const photo = emp.photo_url || (emp as any).avatar_url || (emp as any).avatar || emp.metadata?.photo_url || emp.metadata?.avatar_url || emp.metadata?.foto || undefined;

        // Fallbacks de Endereço (PF + CNPJ + Metadata de Credenciados/PJ)
        const street = emp.street || emp.cnpj_street || emp.metadata?.street || emp.metadata?.logradouro || emp.metadata?.address || '';
        const number = emp.number || emp.cnpj_number || emp.metadata?.number || emp.metadata?.numero || '';
        const neighborhood = emp.neighborhood || emp.cnpj_neighborhood || emp.metadata?.neighborhood || emp.metadata?.bairro || '';
        const city = emp.city || emp.cnpj_city || emp.metadata?.city || emp.metadata?.cidade || '';
        const state = emp.state || emp.cnpj_state || emp.metadata?.state || emp.metadata?.uf || 'SP';
        const zipCode = emp.zip_code || emp.cnpj_zip_code || emp.metadata?.zip_code || emp.metadata?.cep || '';

        const fullAddr = [street, number, neighborhood, city, state].filter(Boolean).join(', ');
        const cleanZip = zipCode.replace(/\D/g, '');
        const hasAddrInfo = Boolean(cleanZip || street || neighborhood || city);

        let coords: LatLng | null = null;
        if (hasAddrInfo) {
          coords = await GeocodingService.geocodeAddress({
            zip_code: cleanZip,
            street,
            number,
            neighborhood,
            city,
            state
          });
        }

        if (!coords) {
          coords = await GeocodingService.geocodeAddress({
            city: city || 'Santos',
            state: state || 'SP'
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

        // Oportunidade de remanejamento
        let potentialOpt: EmployeeGeoItem['potential_optimization'] = null;
        if (assignedWs && nearestWs && nearestWs.workstation.id !== assignedWs.id) {
          const curDist = distanceToCurrent || GeocodingService.calculateDistanceKm(validCoords, { lat: assignedWs.lat, lng: assignedWs.lng });
          const diff = curDist - nearestWs.distance_km;
          if (diff >= 3) {
            potentialOpt = {
              better_workstation: nearestWs.workstation,
              saved_distance_km: Number(diff.toFixed(1)),
              reason: `Mora a ${nearestWs.distance_km}km de ${nearestWs.workstation.name} vs. ${curDist.toFixed(1)}km de ${assignedWs.name}`
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
          photo_url: photo,
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

  // Lista de Cidades Únicas com contagem
  const availableCities = useMemo(() => {
    const map = new Map<string, number>();
    geoItems.forEach(g => {
      if (g.city) {
        const c = g.city.trim();
        map.set(c, (map.get(c) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [geoItems]);

  // 3. Filtrar itens
  const filteredGeoItems = useMemo(() => {
    return geoItems.filter(item => {
      // Filtro de endereço
      if (addressFilterMode === 'with_address' && !item.has_valid_coords) return false;
      if (addressFilterMode === 'no_address' && item.has_valid_coords) return false;

      // Busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesRole = (item.job_role || '').toLowerCase().includes(q);
        const matchesNeigh = (item.neighborhood || '').toLowerCase().includes(q);
        const matchesCity = (item.city || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesNeigh && !matchesCity) return false;
      }

      // Cidade
      if (selectedCity !== 'all' && item.city?.toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }

      // Empresa
      if (selectedCompany !== 'all' && item.company !== selectedCompany) return false;

      // Regime / Vínculo
      if (selectedLinkType !== 'all') {
        if (selectedLinkType === 'terceirizado' && !item.is_outsourced) return false;
        if (selectedLinkType === 'clt' && (item.is_outsourced || item.linkType !== 'CLT')) return false;
        if (selectedLinkType === 'pj' && (item.is_outsourced || item.linkType === 'CLT')) return false;
      }

      // Apenas com oportunidade de remanejamento
      if (onlyMisallocated && !item.potential_optimization) return false;

      // Posto de trabalho selecionado
      if (selectedWsId !== 'all') {
        const ws = workstations.find(w => w.id === selectedWsId);
        if (ws) {
          const dist = GeocodingService.calculateDistanceKm({ lat: item.lat, lng: item.lng }, { lat: ws.lat, lng: ws.lng });
          if (selectedRadiusKm > 0 && dist > selectedRadiusKm) return false;
        }
      }

      return true;
    });
  }, [geoItems, searchQuery, selectedCity, selectedCompany, selectedLinkType, addressFilterMode, onlyMisallocated, selectedWsId, selectedRadiusKm, workstations]);

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

  const activeEmployeeGeo = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return geoItems.find(g => g.employee_id === selectedEmployeeId) || null;
  }, [selectedEmployeeId, geoItems]);

  const activeWorkstation = useMemo(() => {
    if (!selectedWorkstationId) return null;
    return workstations.find(w => w.id === selectedWorkstationId) || null;
  }, [selectedWorkstationId, workstations]);

  // Forçar redimensionamento do Leaflet ao alternar entre os modos de mapa
  useEffect(() => {
    if ((displayMode === 'map' || displayMode === 'workstations_only') && leafletMapRef.current) {
      setTimeout(() => {
        try {
          leafletMapRef.current.invalidateSize();
        } catch {}
      }, 50);
    }
  }, [displayMode]);

  // 5. Inicializar e Atualizar Mapa Leaflet
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

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

      if (!leafletMapRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [-23.9850, -46.4000],
          zoom: 12,
          zoomControl: false
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        tileLayerRef.current = L.tileLayer(MAP_TILE_PROVIDERS[mapStyle].url, {
          attribution: MAP_TILE_PROVIDERS[mapStyle].attribution,
          maxZoom: 19
        }).addTo(map);

        circlesLayerRef.current = L.layerGroup().addTo(map);
        markersLayerRef.current = L.layerGroup().addTo(map);
        routeLayerRef.current = L.layerGroup().addTo(map);

        leafletMapRef.current = map;
      } else {
        const map = leafletMapRef.current;
        if (tileLayerRef.current) {
          map.removeLayer(tileLayerRef.current);
        }
        tileLayerRef.current = L.tileLayer(MAP_TILE_PROVIDERS[mapStyle].url, {
          attribution: MAP_TILE_PROVIDERS[mapStyle].attribution,
          maxZoom: 19
        }).addTo(map);
      }

      const map = leafletMapRef.current;
      const markersLayer = markersLayerRef.current;
      const circlesLayer = circlesLayerRef.current;
      const routeLayer = routeLayerRef.current;

      markersLayer.clearLayers();
      circlesLayer.clearLayers();
      routeLayer.clearLayers();

      const isWsOnlyMode = displayMode === 'workstations_only';
      const allLatLngs: [number, number][] = [];

      // ── Postos de Trabalho no Mapa (Com Suporte a Drag & Drop em Modo Calibração) ──
      workstations.forEach(ws => {
        const isWsSelected = selectedWorkstationId === ws.id || selectedWsId === ws.id;

        // Círculo de cobertura
        if (ws.coverage_radius_km) {
          L.circle([ws.lat, ws.lng], {
            radius: ws.coverage_radius_km * 1000,
            color: ws.color || '#2563eb',
            fillColor: ws.color || '#2563eb',
            fillOpacity: isWsSelected || isWsOnlyMode ? 0.14 : 0.04,
            weight: isWsSelected || isWsOnlyMode ? 2 : 1,
            dashArray: '4, 4'
          }).addTo(circlesLayer);
        }

        const wsIconHtml = `
          <div style="
            background-color: ${ws.color || '#2563eb'};
            width: ${isWsOnlyMode ? '48px' : '42px'};
            height: ${isWsOnlyMode ? '48px' : '42px'};
            border-radius: 14px;
            border: 3.5px solid white;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            cursor: ${isWsOnlyMode ? 'grab' : 'pointer'};
            position: relative;
            transform: ${isWsSelected ? 'scale(1.15)' : 'scale(1)'};
            transition: transform 0.2s;
            ${isWsOnlyMode ? 'outline: 3px solid rgba(99, 102, 241, 0.6); outline-offset: 2px;' : ''}
          " title="${ws.name}">
            <svg width="${isWsOnlyMode ? '26' : '22'}" height="${isWsOnlyMode ? '26' : '22'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
              padding: 1px 5px;
              border-radius: 6px;
              border: 1px solid white;
            ">${ws.capacity || 0}</div>
          </div>
        `;

        const customWsIcon = L.divIcon({
          html: wsIconHtml,
          className: 'custom-ws-marker',
          iconSize: [isWsOnlyMode ? 48 : 42, isWsOnlyMode ? 48 : 42],
          iconAnchor: [isWsOnlyMode ? 24 : 21, isWsOnlyMode ? 24 : 21]
        });

        // Marcador arrastável no modo Apenas Postos de Trabalho (Calibração)
        const marker = L.marker([ws.lat, ws.lng], {
          icon: customWsIcon,
          draggable: isWsOnlyMode
        });

        marker.on('click', () => {
          setSelectedWorkstationId(ws.id);
          setSelectedEmployeeId(null);
        });

        if (isWsOnlyMode) {
          marker.on('dragend', (e: any) => {
            const pos = e.target.getLatLng();
            setPendingWsDrag({
              wsId: ws.id,
              wsName: ws.name,
              lat: pos.lat,
              lng: pos.lng
            });
          });

          marker.bindTooltip(`<strong>${ws.name}</strong><br/>📍 Arraste para reposicionar no mapa ou clique para editar`, {
            direction: 'bottom',
            offset: [0, 14],
            permanent: false
          });
        } else {
          marker.bindTooltip(`<strong>${ws.name}</strong><br/>${ws.neighborhood}, ${ws.city} (${ws.capacity} vagas)`, {
            direction: 'top',
            offset: [0, -16]
          });
        }

        marker.addTo(markersLayer);
        allLatLngs.push([ws.lat, ws.lng]);
      });

      // ── Ocultar Marcadores de Colaboradores se estiver no Modo Apenas Postos ──
      if (isWsOnlyMode) {
        if (allLatLngs.length > 0 && !selectedWorkstationId) {
          try {
            map.fitBounds(L.latLngBounds(allLatLngs), { padding: [60, 60], maxZoom: 14 });
          } catch {}
        }
        return;
      }

      // ── Colaboradores no Mapa (Iniciais no Pin / Foto no Tooltip e Drawer) ──
      filteredGeoItems.forEach(empItem => {
        const isSelected = selectedEmployeeId === empItem.employee_id;
        const hasOpt = Boolean(empItem.potential_optimization);
        const borderColor = empItem.is_outsourced ? '#f59e0b' : empItem.linkType === 'CLT' ? '#3b82f6' : '#8b5cf6';
        const initials = empItem.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        const size = isSelected ? 38 : 30;

        // Marcador Padrão: Ícone Circular com as Iniciais
        const empIconHtml = `
          <div style="
            background: white;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            border: ${isSelected ? '3.5px solid #0f172a' : `2.5px solid ${borderColor}`};
            box-shadow: 0 3px 10px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            position: relative;
            transition: all 0.2s;
            ${hasOpt ? 'box-shadow: 0 0 0 3.5px rgba(244, 63, 94, 0.45);' : ''}
          " title="${empItem.name}">
            <div style="
              width: 100%;
              height: 100%;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? '12px' : '10px'};
              font-weight: 900;
              color: ${borderColor};
              background: ${borderColor}12;
            ">
              ${initials}
            </div>
            ${hasOpt ? `<div style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:#f43f5e;border:1.5px solid white;z-index:10;"></div>` : ''}
          </div>
        `;

        const customEmpIcon = L.divIcon({
          html: empIconHtml,
          className: 'custom-emp-marker',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        });

        const marker = L.marker([empItem.lat, empItem.lng], { icon: customEmpIcon });

        marker.on('click', () => {
          setSelectedEmployeeId(empItem.employee_id);
          setSelectedWorkstationId(null);
        });

        // Tooltip ao passar o mouse (Hover): Exibe a Foto de Perfil + Dados
        marker.bindTooltip(`
          <div style="display:flex;align-items:center;gap:10px;padding:2px;">
            <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;background:#e2e8f0;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1.5px solid #cbd5e1;">
              ${empItem.photo_url ? `<img src="${empItem.photo_url}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-weight:900;font-size:11px;color:#334155;">${initials}</span>`}
            </div>
            <div>
              <strong style="font-size:12px;color:#0f172a;display:block;">${empItem.name}</strong>
              <span style="color:#64748b;font-size:10px;display:block;">${empItem.neighborhood || empItem.city || 'Residência'} · <strong style="color:${borderColor};">${empItem.linkType}</strong></span>
            </div>
          </div>
        `, {
          direction: 'top',
          offset: [0, -16],
          className: 'custom-hover-tooltip'
        });

        marker.addTo(markersLayer);
        allLatLngs.push([empItem.lat, empItem.lng]);
      });

      // ── Traçado de Rota do Colaborador Ativo ──
      if (activeEmployeeGeo) {
        const empCoords: [number, number] = [activeEmployeeGeo.lat, activeEmployeeGeo.lng];

        if (activeEmployeeGeo.nearest_workstation) {
          const nearestWs = activeEmployeeGeo.nearest_workstation.workstation;
          const nearestCoords: [number, number] = [nearestWs.lat, nearestWs.lng];

          const line = L.polyline([empCoords, nearestCoords], {
            color: '#10b981',
            weight: 4,
            opacity: 0.9,
            smoothFactor: 1
          }).addTo(routeLayer);

          line.bindTooltip(`Posto Mais Próximo: ${nearestWs.name} (${activeEmployeeGeo.nearest_workstation.distance_km} km)`, {
            permanent: true,
            direction: 'center'
          });
        }

        if (activeEmployeeGeo.assigned_workstation && activeEmployeeGeo.nearest_workstation?.workstation.id !== activeEmployeeGeo.assigned_workstation.id) {
          const assignedWs = activeEmployeeGeo.assigned_workstation;
          const assignedCoords: [number, number] = [assignedWs.lat, assignedWs.lng];

          const curLine = L.polyline([empCoords, assignedCoords], {
            color: '#f43f5e',
            weight: 3,
            dashArray: '6, 6',
            opacity: 0.85
          }).addTo(routeLayer);

          curLine.bindTooltip(`Posto Atual: ${assignedWs.name} (${activeEmployeeGeo.distance_to_current_workstation_km || '—'} km)`, {
            permanent: true,
            direction: 'center'
          });
        }
      }

      // Enquadramento automático suave
      if (allLatLngs.length > 0 && !selectedEmployeeId) {
        try {
          map.fitBounds(L.latLngBounds(allLatLngs), { padding: [45, 45], maxZoom: 14 });
        } catch {}
      }
    });

    return () => {
      isMounted = false;
    };
  }, [workstations, filteredGeoItems, activeEmployeeGeo, selectedEmployeeId, selectedWsId, mapStyle, displayMode]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ── Top Executive KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Mapeado</span>
            <Users size={16} className="text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {filteredGeoItems.length}
            </span>
            <span className="text-xs text-slate-400 font-bold">
              de {geoItems.length} ({Math.round((filteredGeoItems.length / (geoItems.length || 1)) * 100)}%)
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{metrics.totalEmployeesWithAddress} com endereço completo</div>
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
            <span className="text-xs text-slate-400 font-bold">Bases Ativas</span>
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
          <div className="text-[10px] text-rose-500 mt-1 font-medium">Moram mais perto de outro posto disponível</div>
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
            <span className="text-xs text-slate-400 font-bold">/trajeto</span>
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">Redução de tempo de trânsito e Vale Transporte</div>
        </div>
      </div>

      {/* ── Toolbar de Filtros & Modos de Visualização ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap">
          
          {/* Seletor de Modo (Mapa Completo vs. Apenas Postos vs. Matriz) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 flex-wrap gap-1">
            <button
              type="button"
              onClick={() => {
                setDisplayMode('map');
                setPendingWsDrag(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                displayMode === 'map'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700 font-black'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <MapIcon size={14} />
              <span>Visualização Cartográfica</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplayMode('workstations_only');
                setSelectedEmployeeId(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                displayMode === 'workstations_only'
                  ? 'bg-amber-500 text-white shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Building2 size={14} />
              <span>🏢 Apenas Postos (Calibração GPS)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplayMode('matrix');
                setPendingWsDrag(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                displayMode === 'matrix'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700 font-black'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Table size={14} />
              <span>Matriz Comparativa</span>
            </button>
          </div>

          {/* Seletor de Estilo do Mapa (apenas no modo mapa) */}
          {displayMode === 'map' && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Estilo:</span>
              {(Object.keys(MAP_TILE_PROVIDERS) as MapTileStyle[]).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setMapStyle(st)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                    mapStyle === st
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{MAP_TILE_PROVIDERS[st].icon}</span>
                  <span>{MAP_TILE_PROVIDERS[st].name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGeminiAdvisorOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
            >
              <Sparkles size={15} className="animate-pulse text-amber-300" />
              <span>Parecer IA (Gemini)</span>
            </button>

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

        {/* Linha de Filtros Secundários */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filtrar colaborador, bairro ou cidade..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Filtro de Cidade de Moradia */}
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
          >
            <option value="all">📍 Todas as Cidades</option>
            {availableCities.map(([city, count]) => (
              <option key={city} value={city}>{city} ({count})</option>
            ))}
          </select>

          {/* Filtro de Posto */}
          <select
            value={selectedWsId}
            onChange={e => setSelectedWsId(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
          >
            <option value="all">🏢 Todos os Postos ({workstations.length})</option>
            {workstations.map(w => (
              <option key={w.id} value={w.id}>🏢 {w.name}</option>
            ))}
          </select>

          {/* Qualidade de Endereço */}
          <select
            value={addressFilterMode}
            onChange={e => setAddressFilterMode(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
          >
            <option value="all">👥 Todos Colaboradores ({geoItems.length})</option>
            <option value="with_address">🏠 Com Endereço Completo ({metrics.totalEmployeesWithAddress})</option>
            <option value="no_address">⚠️ Sem Endereço Completo ({metrics.totalWithoutCoordinates})</option>
          </select>

          {/* Raio de Distância */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 px-2">Raio:</span>
            {[
              { label: 'Todos', val: 0 },
              { label: '≤5km', val: 5 },
              { label: '≤10km', val: 10 },
              { label: '≤20km', val: 20 }
            ].map(r => (
              <button
                key={r.val}
                type="button"
                onClick={() => setSelectedRadiusKm(r.val)}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  selectedRadiusKm === r.val
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs border border-slate-200 dark:border-slate-700'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Toggle Apenas Oportunidades */}
          <button
            type="button"
            onClick={() => setOnlyMisallocated(!onlyMisallocated)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border ${
              onlyMisallocated
                ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={14} className={onlyMisallocated ? 'text-rose-600' : 'text-slate-400'} />
            <span>Oportunidades ({metrics.misallocatedCount})</span>
          </button>
        </div>
      </div>

      {/* ── MODO MAPA CARTOGRÁFICO (Mantido montado para não perder instâncias Leaflet) ── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-5"
        style={{ display: displayMode === 'map' ? 'grid' : 'none' }}
      >
        {/* Viewport do Mapa Leaflet */}
        <div className="lg:col-span-2 relative bg-slate-100 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner h-[620px] flex flex-col">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Legenda Flutuante */}
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

          {/* Banner de Calibração de Postos (Drag & Drop) */}
          {displayMode === 'workstations_only' && (
            <div className="absolute top-4 right-4 z-20 bg-amber-500 text-white rounded-2xl p-3.5 shadow-xl border border-amber-400 text-xs max-w-xs space-y-2 pointer-events-auto animate-in slide-in-from-top">
              <div className="flex items-center gap-2 font-black uppercase text-[11px] tracking-wider">
                <Building2 size={16} />
                <span>Calibração de Postos de Trabalho</span>
              </div>
              <p className="text-[11px] text-amber-50 leading-relaxed font-medium">
                Arraste os marcadores dos postos no mapa para reposicionar a Latitude e Longitude da base, ou clique em um posto para editar seus dados.
              </p>
              
              {pendingWsDrag && (
                <div className="bg-slate-900/95 text-white rounded-xl p-3 space-y-2 border border-slate-700 animate-in zoom-in-95 shadow-lg">
                  <div className="font-bold text-[11px] text-amber-300 flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Confirmar Nova Posição GPS?</span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono bg-slate-800 p-1.5 rounded border border-slate-700">
                    <strong className="text-white block">{pendingWsDrag.wsName}</strong>
                    Lat: {pendingWsDrag.lat.toFixed(6)} | Lng: {pendingWsDrag.lng.toFixed(6)}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSavingDrag}
                      onClick={async () => {
                        setIsSavingDrag(true);
                        const updated = await WorkstationsService.updateWorkstationCoords(
                          pendingWsDrag.wsId,
                          pendingWsDrag.lat,
                          pendingWsDrag.lng
                        );
                        setWorkstations(updated);
                        setPendingWsDrag(null);
                        setIsSavingDrag(false);
                      }}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-[11px] transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      {isSavingDrag ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      <span>Salvar Posição</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSavingDrag}
                      onClick={() => {
                        setPendingWsDrag(null);
                        setWorkstations(WorkstationsService.getWorkstations());
                      }}
                      className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isLoadingGeo && (
            <div className="absolute inset-0 bg-white/75 dark:bg-slate-900/75 backdrop-blur-xs z-30 flex items-center justify-center gap-3 text-xs font-black uppercase text-indigo-700">
              <RefreshCw size={20} className="animate-spin text-indigo-600" />
              <span>Geocodificando e calibrando coordenadas...</span>
            </div>
          )}
        </div>

        {/* Painel Lateral */}
        <div className="space-y-4 flex flex-col h-[620px]">
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

                {/* Moradia */}
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
                            Posto Mais Próximo da Moradia
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

                {activeEmployeeGeo.potential_optimization && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-800 space-y-1.5">
                    <div className="flex items-center gap-2 font-black uppercase tracking-tight text-rose-700">
                      <Sparkles size={16} className="text-rose-600" />
                      <span>Oportunidade de Remanejamento</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-rose-700">
                      Atuando em <strong>{activeEmployeeGeo.potential_optimization.better_workstation.name}</strong>, a distância é reduzida em <strong>{activeEmployeeGeo.potential_optimization.saved_distance_km} km por trajeto</strong>.
                    </p>
                  </div>
                )}
              </div>

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
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-[320px] overflow-y-auto space-y-1">
                    {filteredGeoItems
                      .map(item => ({
                        ...item,
                        distToWs: GeocodingService.calculateDistanceKm({ lat: item.lat, lng: item.lng }, { lat: activeWorkstation.lat, lng: activeWorkstation.lng })
                      }))
                      .sort((a, b) => a.distToWs - b.distToWs)
                      .slice(0, 20)
                      .map(item => (
                        <div
                          key={item.employee_id}
                          onClick={() => setSelectedEmployeeId(item.employee_id)}
                          className="py-2 flex items-center justify-between hover:bg-white dark:hover:bg-slate-700 p-1.5 rounded-xl cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold">
                              {item.photo_url ? (
                                <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                item.name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="truncate">
                              <span className="font-bold text-slate-800 dark:text-white block truncate">{item.name}</span>
                              <span className="text-[10px] text-slate-400">{item.neighborhood || item.city} · {item.linkType}</span>
                            </div>
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
                  <div className="py-20 text-center text-slate-400 space-y-2">
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
                          <div className="flex items-center gap-2 truncate">
                            <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden shrink-0">
                              {item.photo_url ? (
                                <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[9px] font-black flex items-center justify-center h-full text-slate-600">
                                  {item.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md font-mono shrink-0">
                            -{item.potential_optimization?.saved_distance_km} km
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-500 space-y-1 pl-8">
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

      {/* ── MODO MATRIZ EXECUTIVA DE DISTÂNCIAS ── */}
      <div
        style={{ display: displayMode === 'matrix' ? 'block' : 'none' }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
              Matriz Comparativa de Moradias vs. Postos de Trabalho ({filteredGeoItems.length})
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Relação analítica de distâncias em KM entre a moradia e os postos cadastrados
            </p>
          </div>

          <span className="text-xs font-bold text-slate-500">
            {metrics.misallocatedCount} colaboradores com ganho potencial de rota
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-3">Bairro / Cidade</th>
                <th className="py-3 px-3">Posto Atual</th>
                <th className="py-3 px-3 text-right">Distância Atual</th>
                <th className="py-3 px-3">Posto Mais Próximo</th>
                <th className="py-3 px-3 text-right">Distância Mínima</th>
                <th className="py-3 px-3 text-center">Status / Ganho</th>
                <th className="py-3 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredGeoItems.map(item => {
                const hasOpt = Boolean(item.potential_optimization);
                return (
                  <tr key={item.employee_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-slate-700">
                          {item.photo_url ? (
                            <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            item.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">{item.name}</span>
                          <span className="text-[10px] text-slate-400">{item.job_role || item.department} · {item.linkType}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-slate-700 dark:text-slate-300 block">{item.neighborhood || '—'}</span>
                      <span className="text-[10px] text-slate-400">{item.city || '—'} / {item.state || 'SP'}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {item.assigned_workstation?.name || item.current_service_location || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-600 dark:text-slate-400">
                      {item.distance_to_current_workstation_km !== null ? `${item.distance_to_current_workstation_km} km` : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-black text-emerald-700 dark:text-emerald-400">
                        {item.nearest_workstation?.workstation.name || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-400">
                      {item.nearest_workstation?.distance_km !== undefined ? `${item.nearest_workstation.distance_km} km` : '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {hasOpt ? (
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-black font-mono">
                          Economia -{item.potential_optimization?.saved_distance_km} km
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          ✓ Otimizado
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onEmployeeClick(item.employee_id, 'pessoal')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors"
                      >
                        Ficha
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal de Gestão de Postos ── */}
      {isWsManagerOpen && (
        <WorkstationsManagerModal
          isOpen={isWsManagerOpen}
          onClose={() => setIsWsManagerOpen(false)}
          onWorkstationsChange={() => {
            setWorkstations(WorkstationsService.getWorkstations());
          }}
        />
      )}

      {/* ── Modal do Gemini Route Advisor ── */}
      {isGeminiAdvisorOpen && (
        <GeminiRouteAdvisorModal
          isOpen={isGeminiAdvisorOpen}
          onClose={() => setIsGeminiAdvisorOpen(false)}
          workstations={workstations}
          geoItems={geoItems}
          metrics={metrics}
        />
      )}

    </div>
  );
}
