/**
 * Serviço de Gestão de Postos de Trabalho & Bases Operacionais
 * Sincronização em Nuvem Supabase + Fallback Local
 */

import { Workstation } from '@/types/workstations';
import { supabase } from '@/lib/supabase';

const WORKSTATIONS_STORAGE_KEY = 'marbr_workstations_list_v1';

export const DEFAULT_WORKSTATIONS: Workstation[] = [
  {
    id: 'ws-matriz-santos',
    name: 'Sede Administrativa Santos',
    code: 'MAT-SAN',
    company: 'MarBR',
    color: '#2563eb', // Azul Royal
    address: 'Rua General Câmara, 50',
    number: '50',
    neighborhood: 'Centro',
    city: 'Santos',
    state: 'SP',
    zip_code: '11010-120',
    lat: -23.9350,
    lng: -46.3283,
    capacity: 35,
    coverage_radius_km: 15,
    notes: 'Sede administrativa, diretoria, financeiro e planejamento',
    active: true
  },
  {
    id: 'ws-galpao-ribeirópolis',
    name: 'Galpão Operacional Ribeirópolis',
    code: 'GAL-RIB',
    company: 'MarBR',
    color: '#059669', // Verde Esmeralda
    address: 'Av. Dr. Roberto de Almeida Vinhas',
    number: '1200',
    neighborhood: 'Ribeirópolis',
    city: 'Praia Grande',
    state: 'SP',
    zip_code: '11705-620',
    lat: -24.0150,
    lng: -46.4950,
    capacity: 25,
    coverage_radius_km: 20,
    notes: 'Base operacional, logística, almoxarifado e equipe de campo',
    active: true
  },
  {
    id: 'ws-nucleo-juridico',
    name: 'Núcleo Jurídico & Compliance',
    code: 'NUC-JUR',
    company: 'MarBR',
    color: '#7c3aed', // Roxo / Indigo
    address: 'Av. Ana Costa, 400',
    number: '400',
    neighborhood: 'Gonzaga',
    city: 'Santos',
    state: 'SP',
    zip_code: '11060-002',
    lat: -23.9691,
    lng: -46.3331,
    capacity: 12,
    coverage_radius_km: 12,
    notes: 'Assessoria jurídica, contratos, certidões e governança',
    active: true
  },
  {
    id: 'ws-base-cubatao',
    name: 'Base Operacional Cubatão',
    code: 'BAS-CUB',
    company: 'DZM',
    color: '#ea580c', // Laranja
    address: 'Av. Nove de Abril, 1500',
    number: '1500',
    neighborhood: 'Centro',
    city: 'Cubatão',
    state: 'SP',
    zip_code: '11510-000',
    lat: -23.8950,
    lng: -46.4253,
    capacity: 20,
    coverage_radius_km: 25,
    notes: 'Pólo industrial e contratos petroquímicos',
    active: true
  },
  {
    id: 'ws-porto-santos',
    name: 'Terminal Portuário Santos',
    code: 'TRM-POR',
    company: 'G2',
    color: '#0891b2', // Ciano
    address: 'Avenida Portuária, S/N',
    neighborhood: 'Ponta da Praia',
    city: 'Santos',
    state: 'SP',
    zip_code: '11030-400',
    lat: -23.9856,
    lng: -46.3025,
    capacity: 30,
    coverage_radius_km: 15,
    notes: 'Operações de atracação, inspeção e carga marítima',
    active: true
  },
  {
    id: 'ws-unidade-sp',
    name: 'Unidade Comercial São Paulo',
    code: 'UNI-SP',
    company: 'Conectius',
    color: '#db2777', // Rosa
    address: 'Av. Paulista, 1000',
    number: '1000',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    zip_code: '01310-100',
    lat: -23.5615,
    lng: -46.6559,
    capacity: 15,
    coverage_radius_km: 30,
    notes: 'Escritório comercial, relações institucionais e novos negócios',
    active: true
  }
];

export class WorkstationsService {
  /**
   * Obtém a lista de postos de trabalho (cache síncrono)
   */
  public static getWorkstations(): Workstation[] {
    if (typeof window === 'undefined') return DEFAULT_WORKSTATIONS;

    try {
      const stored = localStorage.getItem(WORKSTATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}

    return DEFAULT_WORKSTATIONS;
  }

  /**
   * Salva a lista de postos localmente
   */
  public static saveWorkstations(workstations: Workstation[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(WORKSTATIONS_STORAGE_KEY, JSON.stringify(workstations));
    } catch {}
  }

  /**
   * Busca lista de postos da nuvem Supabase
   */
  public static async fetchWorkstationsAsync(): Promise<Workstation[]> {
    try {
      const { data } = await supabase
        .from('employees')
        .select('metadata')
        .eq('full_name', '__SYSTEM_GLOBAL_CONFIG__')
        .maybeSingle();

      if (data?.metadata?.workstations && Array.isArray(data.metadata.workstations) && data.metadata.workstations.length > 0) {
        this.saveWorkstations(data.metadata.workstations);
        return data.metadata.workstations;
      }
    } catch (e) {
      console.warn('Aviso ao carregar postos de trabalho do Supabase:', e);
    }

    const current = this.getWorkstations();
    // Salvar defaults na nuvem se ainda não existir
    this.saveWorkstationsAsync(current).catch(() => {});
    return current;
  }

  /**
   * Salva a lista de postos na nuvem Supabase e no cache local
   */
  public static async saveWorkstationsAsync(workstations: Workstation[]): Promise<boolean> {
    this.saveWorkstations(workstations);

    try {
      const { data: globalRec } = await supabase
        .from('employees')
        .select('id, metadata')
        .eq('full_name', '__SYSTEM_GLOBAL_CONFIG__')
        .maybeSingle();

      const meta = (globalRec?.metadata as Record<string, any>) || {};
      const updatedMeta = {
        ...meta,
        workstations
      };

      if (globalRec?.id) {
        await supabase
          .from('employees')
          .update({ metadata: updatedMeta })
          .eq('id', globalRec.id);
      } else {
        await supabase.from('employees').insert([{
          full_name: '__SYSTEM_GLOBAL_CONFIG__',
          company: 'MarBR',
          employment_type: 'CLT',
          active: false,
          status: 'Inativo',
          metadata: updatedMeta
        }]);
      }
      return true;
    } catch (e) {
      console.error('Erro ao salvar postos de trabalho no Supabase:', e);
      return false;
    }
  }

  /**
   * Atualiza as coordenadas de um posto específico e sincroniza na nuvem e local
   */
  public static async updateWorkstationCoords(id: string, lat: number, lng: number): Promise<Workstation[]> {
    const list = this.getWorkstations();
    const updated = list.map(w => w.id === id ? { ...w, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) } : w);
    await this.saveWorkstationsAsync(updated);
    return updated;
  }

  /**
   * Adiciona ou atualiza um posto de trabalho
   */
  public static async upsertWorkstation(workstation: Workstation): Promise<Workstation[]> {
    const list = this.getWorkstations();
    const idx = list.findIndex(w => w.id === workstation.id);

    let updated: Workstation[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = workstation;
    } else {
      updated = [...list, workstation];
    }

    await this.saveWorkstationsAsync(updated);
    return updated;
  }

  /**
   * Remove um posto de trabalho
   */
  public static async deleteWorkstation(id: string): Promise<Workstation[]> {
    const list = this.getWorkstations();
    const updated = list.filter(w => w.id !== id);
    await this.saveWorkstationsAsync(updated);
    return updated;
  }
}
