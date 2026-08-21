/**
 * Serviço de Geocodificação & Cálculo de Distâncias
 * Suporta cache local, offline fallback e integração com OpenStreetMap / ViaCEP
 */

export interface LatLng {
  lat: number;
  lng: number;
}

// Coordenadas base de referência de cidades / bairros frequentes para alta performance
const CITY_FALLBACK_COORDS: Record<string, LatLng> = {
  // Baixada Santista
  'santos': { lat: -23.9618, lng: -46.3322 },
  'santos, sp': { lat: -23.9618, lng: -46.3322 },
  'praia grande': { lat: -24.0058, lng: -46.4028 },
  'praia grande, sp': { lat: -24.0058, lng: -46.4028 },
  'sao vicente': { lat: -23.9631, lng: -46.3919 },
  'sao vicente, sp': { lat: -23.9631, lng: -46.3919 },
  'cubatao': { lat: -23.8950, lng: -46.4253 },
  'cubatao, sp': { lat: -23.8950, lng: -46.4253 },
  'guaruja': { lat: -23.9931, lng: -46.2564 },
  'guaruja, sp': { lat: -23.9931, lng: -46.2564 },
  'bertioga': { lat: -23.8544, lng: -46.1389 },
  'mongagua': { lat: -24.0931, lng: -46.6208 },
  'itanhaem': { lat: -24.1839, lng: -46.7889 },

  // Grande São Paulo & ABC
  'sao paulo': { lat: -23.5505, lng: -46.6333 },
  'sao paulo, sp': { lat: -23.5505, lng: -46.6333 },
  'santo andre': { lat: -23.6639, lng: -46.5383 },
  'santo andre, sp': { lat: -23.6639, lng: -46.5383 },
  'sao bernardo do campo': { lat: -23.6944, lng: -46.5653 },
  'sao caetano do sul': { lat: -23.6228, lng: -46.5544 },
  'diadema': { lat: -23.6865, lng: -46.6228 },
  'osasco': { lat: -23.5325, lng: -46.7917 },
  'guarulhos': { lat: -23.4542, lng: -46.5333 },
  'barueri': { lat: -23.5111, lng: -46.8764 }
};

// Bairros específicos com grande precisão
const NEIGHBORHOOD_FALLBACK_COORDS: Record<string, LatLng> = {
  // Santos
  'gonzaga, santos': { lat: -23.9691, lng: -46.3331 },
  'boqueirao, santos': { lat: -23.9678, lng: -46.3242 },
  'ponta da praia, santos': { lat: -23.9856, lng: -46.3025 },
  'embaré, santos': { lat: -23.9744, lng: -46.3156 },
  'centro, santos': { lat: -23.9350, lng: -46.3283 },
  'aparecida, santos': { lat: -23.9789, lng: -46.3089 },
  'campo grande, santos': { lat: -23.9531, lng: -46.3389 },
  'marapé, santos': { lat: -23.9611, lng: -46.3472 },
  'vila matias, santos': { lat: -23.9467, lng: -46.3311 },

  // Praia Grande
  'canto do forte, praia grande': { lat: -24.0089, lng: -46.4039 },
  'boqueirao, praia grande': { lat: -24.0078, lng: -46.4128 },
  'guilhermina, praia grande': { lat: -24.0117, lng: -46.4256 },
  'aviacao, praia grande': { lat: -24.0167, lng: -46.4417 },
  'tupi, praia grande': { lat: -24.0208, lng: -46.4567 },
  'vila tupi, praia grande': { lat: -24.0208, lng: -46.4567 },
  'cidade ocian, praia grande': { lat: -24.0289, lng: -46.4806 },
  'ocian, praia grande': { lat: -24.0289, lng: -46.4806 },
  'mirim, praia grande': { lat: -24.0378, lng: -46.5056 },
  'maracana, praia grande': { lat: -24.0456, lng: -46.5306 },
  'maracanã, praia grande': { lat: -24.0456, lng: -46.5306 },
  'caiçara, praia grande': { lat: -24.0539, lng: -46.5556 },
  'ribeirópolis, praia grande': { lat: -24.0150, lng: -46.4950 },
  'samambaia, praia grande': { lat: -24.0233, lng: -46.5183 }
};

const GEO_CACHE_KEY = 'marbr_geocoding_cache_v1';

export class GeocodingService {
  private static memoryCache: Map<string, LatLng> = new Map();

  private static normalizeKey(str: string): string {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s,]/g, "")
      .trim();
  }

  /**
   * Inicializa o cache a partir do localStorage
   */
  private static initCache() {
    if (typeof window === 'undefined') return;
    if (this.memoryCache.size > 0) return;

    try {
      const stored = localStorage.getItem(GEO_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([k, v]) => {
          this.memoryCache.set(k, v as LatLng);
        });
      }
    } catch {}
  }

  private static saveCache() {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, LatLng> = {};
      this.memoryCache.forEach((v, k) => {
        obj[k] = v;
      });
      localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(obj));
    } catch {}
  }

  /**
   * Geocodifica um endereço ou CEP
   */
  public static async geocodeAddress(params: {
    zip_code?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    full_address?: string;
  }): Promise<LatLng | null> {
    this.initCache();

    const { zip_code, street, number, neighborhood, city, state, full_address } = params;

    // 1. Chave de busca
    const cleanZip = zip_code?.replace(/\D/g, '') || '';
    const cleanCity = city?.trim() || '';
    const cleanNeighborhood = neighborhood?.trim() || '';
    const cleanStreet = street?.trim() || '';

    const queryKey = this.normalizeKey(
      cleanZip
        ? `cep_${cleanZip}`
        : `${cleanStreet} ${number || ''} ${cleanNeighborhood} ${cleanCity} ${state || 'SP'}`
    );

    // 2. Checar memória / cache
    if (this.memoryCache.has(queryKey)) {
      return this.memoryCache.get(queryKey)!;
    }

    // 3. Checar bairros conhecidos
    if (cleanNeighborhood && cleanCity) {
      const neighKey = this.normalizeKey(`${cleanNeighborhood}, ${cleanCity}`);
      if (NEIGHBORHOOD_FALLBACK_COORDS[neighKey]) {
        // Pequena variação jitter aleatória para não sobrepor exatamente no mesmo pixel
        const base = NEIGHBORHOOD_FALLBACK_COORDS[neighKey];
        const jittered = this.addJitter(base);
        this.memoryCache.set(queryKey, jittered);
        this.saveCache();
        return jittered;
      }
    }

    // 4. Checar cidades conhecidas
    if (cleanCity) {
      const cityKey = this.normalizeKey(cleanCity);
      const cityStateKey = this.normalizeKey(`${cleanCity}, ${state || 'SP'}`);
      const match = CITY_FALLBACK_COORDS[cityStateKey] || CITY_FALLBACK_COORDS[cityKey];
      if (match) {
        const jittered = this.addJitter(match);
        this.memoryCache.set(queryKey, jittered);
        this.saveCache();
        return jittered;
      }
    }

    // 5. Se tiver CEP, tentar consultar ViaCEP para obter cidade e bairro
    if (cleanZip && cleanZip.length === 8) {
      try {
        const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanZip}/json/`, { signal: AbortSignal.timeout(3000) });
        if (viaCepRes.ok) {
          const viaCepData = await viaCepRes.json();
          if (!viaCepData.erro) {
            const cepNeigh = viaCepData.bairro || '';
            const cepCity = viaCepData.localidade || '';
            const neighKey = this.normalizeKey(`${cepNeigh}, ${cepCity}`);
            if (NEIGHBORHOOD_FALLBACK_COORDS[neighKey]) {
              const jittered = this.addJitter(NEIGHBORHOOD_FALLBACK_COORDS[neighKey]);
              this.memoryCache.set(queryKey, jittered);
              this.saveCache();
              return jittered;
            }

            const cityKey = this.normalizeKey(cepCity);
            if (CITY_FALLBACK_COORDS[cityKey]) {
              const jittered = this.addJitter(CITY_FALLBACK_COORDS[cityKey]);
              this.memoryCache.set(queryKey, jittered);
              this.saveCache();
              return jittered;
            }
          }
        }
      } catch {}
    }

    // 6. Consulta pública Nominatim OpenStreetMap (com fallback de tempo limite)
    try {
      const searchQuery = [street, number, neighborhood, city, state, 'Brasil']
        .filter(Boolean)
        .join(', ');

      if (searchQuery.trim().length > 5) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'pt-BR' },
          signal: AbortSignal.timeout(4000)
        });

        if (res.ok) {
          const results = await res.json();
          if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lng = parseFloat(results[0].lon);
            if (!isNaN(lat) && !isNaN(lng)) {
              const coords = { lat, lng };
              this.memoryCache.set(queryKey, coords);
              this.saveCache();
              return coords;
            }
          }
        }
      }
    } catch {}

    // Fallback padrão Santos / Baixada Santista se nada encontrado
    const defaultCoords = this.addJitter({ lat: -23.9618, lng: -46.3322 });
    return defaultCoords;
  }

  /**
   * Adiciona leve variação de milésimos para espalhar pontos na mesma rua/bairro
   */
  private static addJitter(base: LatLng): LatLng {
    const jitterLat = (Math.random() - 0.5) * 0.006;
    const jitterLng = (Math.random() - 0.5) * 0.006;
    return {
      lat: Number((base.lat + jitterLat).toFixed(6)),
      lng: Number((base.lng + jitterLng).toFixed(6))
    };
  }

  /**
   * Cálculo de Distância Geodésica pela Fórmula de Haversine (em Quilômetros)
   */
  public static calculateDistanceKm(from: LatLng, to: LatLng): number {
    const R = 6371; // Raio da Terra em KM
    const dLat = this.deg2rad(to.lat - from.lat);
    const dLng = this.deg2rad(to.lng - from.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(from.lat)) *
        Math.cos(this.deg2rad(to.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    return Number(d.toFixed(1));
  }

  /**
   * Estima tempo de deslocamento urbano médio em minutos baseado na distância
   */
  public static estimateTravelTimeMinutes(distanceKm: number): number {
    // Estimativa urbana média (25 km/h com trânsito e semáforos)
    const minutes = Math.round((distanceKm / 25) * 60);
    return Math.max(5, minutes);
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
