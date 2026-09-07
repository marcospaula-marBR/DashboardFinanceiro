/**
 * Serviço de Geocodificação Ultra-Calibrado & Cálculo de Distâncias
 * Dicionário Geográfico de Alta Precisão para Baixada Santista, Litoral e Grande SP
 */

export interface LatLng {
  lat: number;
  lng: number;
}

// Coordenadas calibradas de alta precisão por Bairro e Cidade
const CALIBRATED_NEIGHBORHOOD_COORDS: Record<string, LatLng> = {
  // ── PRAIA GRANDE ──
  'canto do forte, praia grande': { lat: -24.0111, lng: -46.3945 },
  'forte, praia grande': { lat: -24.0111, lng: -46.3945 },
  'boqueirao, praia grande': { lat: -24.0078, lng: -46.4128 },
  'boqueirão, praia grande': { lat: -24.0078, lng: -46.4128 },
  'guilhermina, praia grande': { lat: -24.0117, lng: -46.4256 },
  'aviacao, praia grande': { lat: -24.0167, lng: -46.4417 },
  'aviação, praia grande': { lat: -24.0167, lng: -46.4417 },
  'tupi, praia grande': { lat: -24.0208, lng: -46.4567 },
  'vila tupi, praia grande': { lat: -24.0208, lng: -46.4567 },
  'ocian, praia grande': { lat: -24.0263, lng: -46.4728 },
  'cidade ocian, praia grande': { lat: -24.0263, lng: -46.4728 },
  'vila mirim, praia grande': { lat: -24.0378, lng: -46.5056 },
  'mirim, praia grande': { lat: -24.0378, lng: -46.5056 },
  'nova mirim, praia grande': { lat: -24.0320, lng: -46.4980 },
  'maracana, praia grande': { lat: -24.0456, lng: -46.5306 },
  'maracanã, praia grande': { lat: -24.0456, lng: -46.5306 },
  'caicara, praia grande': { lat: -24.0539, lng: -46.5556 },
  'caiçara, praia grande': { lat: -24.0539, lng: -46.5556 },
  'vila caicara, praia grande': { lat: -24.0539, lng: -46.5556 },
  'imperador, praia grande': { lat: -24.0620, lng: -46.5750 },
  'jardim imperador, praia grande': { lat: -24.0620, lng: -46.5750 },
  'real, praia grande': { lat: -24.0680, lng: -46.5920 },
  'jardim real, praia grande': { lat: -24.0680, lng: -46.5920 },
  'florida, praia grande': { lat: -24.0710, lng: -46.5763 },
  'flórida, praia grande': { lat: -24.0710, lng: -46.5763 },
  'solemar, praia grande': { lat: -24.0850, lng: -46.6120 },
  'cidade da crianca, praia grande': { lat: -24.0920, lng: -46.6210 },
  'cidade da criança, praia grande': { lat: -24.0920, lng: -46.6210 },
  'jd sao lourenco, praia grande': { lat: -24.0410, lng: -46.5120 },
  'jardim sao lourenco, praia grande': { lat: -24.0410, lng: -46.5120 },
  'ribeirópolis, praia grande': { lat: -24.0150, lng: -46.4950 },
  'ribeiropolis, praia grande': { lat: -24.0150, lng: -46.4950 },
  'vila sao jorge, praia grande': { lat: -24.0150, lng: -46.4820 },
  'vila são jorge, praia grande': { lat: -24.0150, lng: -46.4820 },
  'samambaia, praia grande': { lat: -24.0233, lng: -46.5183 },
  'esmeralda, praia grande': { lat: -24.0290, lng: -46.5250 },
  'melvi, praia grande': { lat: -24.0380, lng: -46.5180 },
  'anhanguera, praia grande': { lat: -24.0200, lng: -46.4850 },
  'quietude, praia grande': { lat: -24.0130, lng: -46.4680 },
  'sitio do campo, praia grande': { lat: -24.0020, lng: -46.4250 },
  'sítio do campo, praia grande': { lat: -24.0020, lng: -46.4250 },
  'tupiry, praia grande': { lat: -24.0180, lng: -46.4710 },
  'antartica, praia grande': { lat: -24.0060, lng: -46.4430 },
  'antártica, praia grande': { lat: -24.0060, lng: -46.4430 },
  'gloria, praia grande': { lat: -24.0090, lng: -46.4350 },
  'glória, praia grande': { lat: -24.0090, lng: -46.4350 },
  'vila assuncao, praia grande': { lat: -24.0250, lng: -46.4780 },
  'vila assunção, praia grande': { lat: -24.0250, lng: -46.4780 },

  // ── SÃO PAULO & ABC / MAUÁ ──
  'bela vista, sao paulo': { lat: -23.5615, lng: -46.6559 },
  'santa ifigenia, sao paulo': { lat: -23.5390, lng: -46.6380 },
  'santa ifigênia, sao paulo': { lat: -23.5390, lng: -46.6380 },
  'pinheiros, sao paulo': { lat: -23.5681, lng: -46.7011 },
  'jardim oratorio, maua': { lat: -23.6520, lng: -46.4380 },
  'jardim oratório, mauá': { lat: -23.6520, lng: -46.4380 },
  'maua': { lat: -23.6680, lng: -46.4610 },
  'mauá': { lat: -23.6680, lng: -46.4610 },
  'balneario jussara, mongagua': { lat: -24.1020, lng: -46.6450 },
  'morada da praia, bertioga': { lat: -23.7750, lng: -45.9250 },
  'vila cascatinha, sao vicente': { lat: -23.9620, lng: -46.4020 },
  'nova cintra, santos': { lat: -23.9520, lng: -46.3510 },

  // ── SANTOS ──
  'gonzaga, santos': { lat: -23.9691, lng: -46.3331 },
  'boqueirao, santos': { lat: -23.9678, lng: -46.3242 },
  'boqueirão, santos': { lat: -23.9678, lng: -46.3242 },
  'ponta da praia, santos': { lat: -23.9888, lng: -46.2973 },
  'embare, santos': { lat: -23.9744, lng: -46.3156 },
  'embaré, santos': { lat: -23.9744, lng: -46.3156 },
  'aparecida, santos': { lat: -23.9789, lng: -46.3089 },
  'centro, santos': { lat: -23.9350, lng: -46.3283 },
  'valongo, santos': { lat: -23.9310, lng: -46.3340 },
  'paqueta, santos': { lat: -23.9320, lng: -46.3260 },
  'vila matias, santos': { lat: -23.9467, lng: -46.3311 },
  'encruzilhada, santos': { lat: -23.9550, lng: -46.3270 },
  'campo grande, santos': { lat: -23.9531, lng: -46.3389 },
  'marape, santos': { lat: -23.9611, lng: -46.3472 },
  'marapé, santos': { lat: -23.9611, lng: -46.3472 },
  'jose menino, santos': { lat: -23.9690, lng: -46.3530 },
  'josé menino, santos': { lat: -23.9690, lng: -46.3530 },
  'pompeia, santos': { lat: -23.9680, lng: -46.3420 },
  'pompéia, santos': { lat: -23.9680, lng: -46.3420 },
  'areia branca, santos': { lat: -23.9492, lng: -46.3750 },
  'castelo, santos': { lat: -23.9350, lng: -46.3680 },
  'jardim castelo, santos': { lat: -23.9350, lng: -46.3680 },
  'jardim radio clube, santos': { lat: -23.9410, lng: -46.3720 },
  'radio clube, santos': { lat: -23.9410, lng: -46.3720 },
  'vila nova, santos': { lat: -23.9380, lng: -46.3240 },
  'vila belmiro, santos': { lat: -23.9510, lng: -46.3390 },
  'jabaquara, santos': { lat: -23.9470, lng: -46.3440 },
  'macuco, santos': { lat: -23.9620, lng: -46.3150 },
  'estuario, santos': { lat: -23.9710, lng: -46.3020 },
  'estuário, santos': { lat: -23.9710, lng: -46.3020 },
  'vila progresso, santos': { lat: -23.9450, lng: -46.3350 },
  'morro nova cintra, santos': { lat: -23.9520, lng: -46.3510 },
  'marape / campo grande, santos': { lat: -23.9580, lng: -46.3430 },

  // ── SÃO VICENTE ──
  'centro, sao vicente': { lat: -23.9631, lng: -46.3919 },
  'gonzaguinha, sao vicente': { lat: -23.9700, lng: -46.3880 },
  'itatarare, sao vicente': { lat: -23.9710, lng: -46.3750 },
  'itararé, sao vicente': { lat: -23.9710, lng: -46.3750 },
  'ilha porchat, sao vicente': { lat: -23.9790, lng: -46.3720 },
  'biquinha, sao vicente': { lat: -23.9670, lng: -46.3860 },
  'parque sao vicente, sao vicente': { lat: -23.9550, lng: -46.4020 },
  'esplanada dos barreiros, sao vicente': { lat: -23.9532, lng: -46.4143 },
  'cidade nautica, sao vicente': { lat: -23.9480, lng: -46.4230 },
  'cidade náutica, sao vicente': { lat: -23.9480, lng: -46.4230 },
  'jardim recanto sao vicente, sao vicente': { lat: -23.9720, lng: -46.4250 },
  'humaita, sao vicente': { lat: -23.9850, lng: -46.4650 },
  'humaitá, sao vicente': { lat: -23.9850, lng: -46.4650 },
  'japuí, sao vicente': { lat: -23.9810, lng: -46.4050 },

  // ── CUBATÃO ──
  'centro, cubatao': { lat: -23.8950, lng: -46.4253 },
  'jardim casqueiro, cubatao': { lat: -23.9050, lng: -46.4020 },
  'casqueiro, cubatao': { lat: -23.9050, lng: -46.4020 },
  'vila nova, cubatao': { lat: -23.8910, lng: -46.4210 },
  'vila rica, cubatao': { lat: -23.8820, lng: -46.4320 },
  'jardim costa e silva, cubatao': { lat: -23.9080, lng: -46.4110 },
  'parque sao pereira, cubatao': { lat: -23.8980, lng: -46.4180 },

  // ── GUARUJÁ ──
  'pitangueiras, guaruja': { lat: -23.9931, lng: -46.2564 },
  'asturias, guaruja': { lat: -23.9980, lng: -46.2680 },
  'astúrias, guaruja': { lat: -23.9980, lng: -46.2680 },
  'tombo, guaruja': { lat: -24.0040, lng: -46.2730 },
  'enseada, guaruja': { lat: -23.9820, lng: -46.2350 },
  'vicente de carvalho, guaruja': { lat: -23.9650, lng: -46.2850 },
  'sitio paecara (vicente de carvalho), guaruja': { lat: -23.9650, lng: -46.2850 },
  'paecara, guaruja': { lat: -23.9650, lng: -46.2850 },
  'jardim santa maria, guaruja': { lat: -23.9870, lng: -46.2720 },

  // ── BERTIOGA & MONGAGUÁ & ITANHAÉM ──
  'centro, bertioga': { lat: -23.8544, lng: -46.1389 },
  'rio da praia, bertioga': { lat: -23.8350, lng: -46.1250 },
  'riviera de sao lourenco, bertioga': { lat: -23.7950, lng: -46.0150 },
  'centro, mongagua': { lat: -24.0931, lng: -46.6208 },
  'jd. praia grande, mongagua': { lat: -24.0850, lng: -46.6150 },
  'jardim praia grande, mongagua': { lat: -24.0850, lng: -46.6150 },
  'centro, itanhaem': { lat: -24.1839, lng: -46.7889 },

  // ── GRANDE SÃO PAULO & ABC ──
  'vila pires, santo andre': { lat: -23.6730, lng: -46.5123 },
  'vila pires, santo andré': { lat: -23.6730, lng: -46.5123 },
  'centro, santo andre': { lat: -23.6639, lng: -46.5383 },
  'centro, sao bernardo do campo': { lat: -23.6944, lng: -46.5653 },
  'centro, sao caetano do sul': { lat: -23.6228, lng: -46.5544 }
};

// Cidades Base
const CALIBRATED_CITY_COORDS: Record<string, LatLng> = {
  'praia grande': { lat: -24.0058, lng: -46.4028 },
  'santos': { lat: -23.9618, lng: -46.3322 },
  'sao vicente': { lat: -23.9631, lng: -46.3919 },
  'são vicente': { lat: -23.9631, lng: -46.3919 },
  'cubatao': { lat: -23.8950, lng: -46.4253 },
  'cubatão': { lat: -23.8950, lng: -46.4253 },
  'guaruja': { lat: -23.9931, lng: -46.2564 },
  'guarujá': { lat: -23.9931, lng: -46.2564 },
  'bertioga': { lat: -23.8544, lng: -46.1389 },
  'mongagua': { lat: -24.0931, lng: -46.6208 },
  'mongaguá': { lat: -24.0931, lng: -46.6208 },
  'itanhaem': { lat: -24.1839, lng: -46.7889 },
  'itanhaém': { lat: -24.1839, lng: -46.7889 },
  'santo andre': { lat: -23.6639, lng: -46.5383 },
  'santo andré': { lat: -23.6639, lng: -46.5383 },
  'sao paulo': { lat: -23.5505, lng: -46.6333 },
  'são paulo': { lat: -23.5505, lng: -46.6333 }
};

const GEO_CACHE_KEY = 'marbr_geocoding_cache_calibrated_v2';

export class GeocodingService {
  private static memoryCache: Map<string, LatLng> = new Map();

  private static normalizeKey(str: string): string {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s,]/g, "")
      .replace(/\s+/g, ' ')
      .trim();
  }

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
   * Extrai apenas o número predial limpo (ex: "432, casa 01" -> "432")
   */
  public static extractCleanNumber(rawNumber?: string): string {
    if (!rawNumber) return '';
    const firstPart = rawNumber.split(/[,/]/)[0] || '';
    const match = firstPart.match(/\d+/);
    return match ? match[0] : '';
  }

  /**
   * Extrai o nome limpo do logradouro removendo complementos
   */
  public static extractCleanStreet(rawStreet?: string): string {
    if (!rawStreet) return '';
    return rawStreet
      .replace(/\b(apto|apartamento|casa|bloco|cj|conjunto|sala|fundos|sobrado|nº|numero)\b.*$/i, '')
      .replace(/,\s*\d+.*$/, '')
      .trim();
  }

  /**
   * Geocodifica com precisão calibrada por Rua, Número, CEP ou Bairro
   */
  public static async geocodeAddress(params: {
    zip_code?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    lat?: number;
    lng?: number;
  }): Promise<LatLng | null> {
    // 1. Se já possui coordenadas calibradas explícitas
    if (typeof params.lat === 'number' && typeof params.lng === 'number' && !isNaN(params.lat) && !isNaN(params.lng)) {
      if (params.lat !== 0 && params.lng !== 0) {
        return { lat: params.lat, lng: params.lng };
      }
    }

    this.initCache();

    const { zip_code, street, number, neighborhood, city, state } = params;

    const cleanZip = zip_code?.replace(/\D/g, '') || '';
    const cleanCity = city?.trim() || '';
    const cleanState = state?.trim() || 'SP';
    const cleanNeighborhood = neighborhood?.trim() || '';
    const cleanStreet = this.extractCleanStreet(street);
    const cleanNum = this.extractCleanNumber(number);

    // Se não há nenhuma informação geográfica, não inventar coordenadas
    if (!cleanZip && !cleanStreet && !cleanNeighborhood && !cleanCity) {
      return null;
    }

    const queryKey = this.normalizeKey(
      `${cleanStreet}_${cleanNum}_${cleanZip}_${cleanNeighborhood}_${cleanCity}`
    );

    // 2. Checar memória/cache local
    if (this.memoryCache.has(queryKey)) {
      return this.memoryCache.get(queryKey)!;
    }

    // 3. Geocodificação de Alta Precisão por Rua + Número + Cidade (Nominatim OpenStreetMap)
    if (cleanStreet && cleanCity) {
      // 3.1 Tentativa com número exato
      if (cleanNum) {
        try {
          const q = `${cleanStreet}, ${cleanNum}, ${cleanCity}, ${cleanState}, Brasil`;
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'DashboardFinanceiro/2.0' },
            signal: AbortSignal.timeout(3500)
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data[0] && data[0].lat && data[0].lon) {
              const exactCoords: LatLng = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
              };
              this.memoryCache.set(queryKey, exactCoords);
              this.saveCache();
              return exactCoords;
            }
          }
        } catch {}
      }

      // 3.2 Tentativa por segmento da rua (sem número)
      try {
        const url = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(cleanStreet)}&city=${encodeURIComponent(cleanCity)}&state=${encodeURIComponent(cleanState)}&country=Brazil&format=json&limit=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'DashboardFinanceiro/2.0' },
          signal: AbortSignal.timeout(3500)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data[0] && data[0].lat && data[0].lon) {
            const baseStreetCoords: LatLng = {
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon)
            };
            const finalCoords = cleanNum ? this.addMicroJitter(baseStreetCoords) : baseStreetCoords;
            this.memoryCache.set(queryKey, finalCoords);
            this.saveCache();
            return finalCoords;
          }
        }
      } catch {}
    }

    // 4. Consulta por CEP via ViaCEP (Normalização de Logradouro Oficial)
    if (cleanZip && cleanZip.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanZip}/json/`, {
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const vData = await res.json();
          if (!vData.erro) {
            const vLogradouro = this.extractCleanStreet(vData.logradouro);
            const vBairro = vData.bairro || cleanNeighborhood;
            const vCidade = vData.localidade || cleanCity;

            // Tentar geocodificar com o logradouro oficial retornado pelo Correios/ViaCEP
            if (vLogradouro && vCidade) {
              try {
                const qVia = cleanNum 
                  ? `${vLogradouro}, ${cleanNum}, ${vCidade}, ${cleanState}, Brasil`
                  : `${vLogradouro}, ${vCidade}, ${cleanState}, Brasil`;
                const qRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(qVia)}&format=json&limit=1`, {
                  headers: { 'User-Agent': 'DashboardFinanceiro/2.0' },
                  signal: AbortSignal.timeout(3500)
                });
                if (qRes.ok) {
                  const qData = await qRes.json();
                  if (qData && qData[0] && qData[0].lat && qData[0].lon) {
                    const exactViaCoords: LatLng = {
                      lat: parseFloat(qData[0].lat),
                      lng: parseFloat(qData[0].lon)
                    };
                    this.memoryCache.set(queryKey, exactViaCoords);
                    this.saveCache();
                    return exactViaCoords;
                  }
                }
              } catch {}
            }

            // Fallback de bairro retornado pelo ViaCEP
            if (vBairro && vCidade) {
              const vKey = this.normalizeKey(`${vBairro}, ${vCidade}`);
              if (CALIBRATED_NEIGHBORHOOD_COORDS[vKey]) {
                const exact = CALIBRATED_NEIGHBORHOOD_COORDS[vKey];
                const finalCoords = cleanNum ? this.addMicroJitter(exact) : exact;
                this.memoryCache.set(queryKey, finalCoords);
                this.saveCache();
                return finalCoords;
              }
            }
          }
        }
      } catch {}
    }

    // 5. Fallback no Dicionário Calibrado de Bairros (apenas se a rua não foi localizada)
    if (cleanNeighborhood && cleanCity) {
      const neighKey = this.normalizeKey(`${cleanNeighborhood}, ${cleanCity}`);
      if (CALIBRATED_NEIGHBORHOOD_COORDS[neighKey]) {
        const exact = CALIBRATED_NEIGHBORHOOD_COORDS[neighKey];
        const finalCoords = cleanNum ? this.addMicroJitter(exact) : exact;
        this.memoryCache.set(queryKey, finalCoords);
        this.saveCache();
        return finalCoords;
      }
    }

    // 6. Fallback no Dicionário Calibrado de Cidades
    if (cleanCity) {
      const cityKey = this.normalizeKey(cleanCity);
      if (CALIBRATED_CITY_COORDS[cityKey]) {
        const base = CALIBRATED_CITY_COORDS[cityKey];
        const finalCoords = this.addMicroJitter(base);
        this.memoryCache.set(queryKey, finalCoords);
        this.saveCache();
        return finalCoords;
      }
    }

    return null;
  }

  private static addMicroJitter(base: LatLng): LatLng {
    const jitterLat = (Math.random() - 0.5) * 0.0035;
    const jitterLng = (Math.random() - 0.5) * 0.0035;
    return {
      lat: Number((base.lat + jitterLat).toFixed(6)),
      lng: Number((base.lng + jitterLng).toFixed(6))
    };
  }

  /**
   * Cálculo de Distância Geodésica pela Fórmula de Haversine (em KM)
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
   * Estima tempo de trânsito em minutos
   */
  public static estimateTravelTimeMinutes(distanceKm: number): number {
    const minutes = Math.round((distanceKm / 28) * 60);
    return Math.max(5, minutes);
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
