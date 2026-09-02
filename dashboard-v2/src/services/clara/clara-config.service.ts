import axios from 'axios';
import { supabase } from '@/lib/supabase';
import { 
  ClaraConfig, 
  ClaraCategoryMapping, 
  ClaraDepartmentMapping, 
  OmieAccountOption, 
  OmieDepartmentOption, 
  OmieCategoryOption 
} from '@/types/clara.types';

// Configuração padrão caso a tabela ainda não esteja populada
const DEFAULT_CONFIG: ClaraConfig = {
  id: 'default',
  client_id: process.env.CLARA_CLIENT_ID || '',
  client_secret: process.env.CLARA_CLIENT_SECRET || '',
  certificate_pem: process.env.CLARA_CERTIFICATE_PEM || '',
  private_key_pem: process.env.CLARA_PRIVATE_KEY_PEM || '',
  base_url: process.env.CLARA_BASE_URL || 'https://public-api.br.clara.com',
  omie_n_cod_cc: null,
  omie_cc_descricao: null,
  company_name: 'Mar Brasil',
  auto_sync_enabled: false,
  sync_interval_minutes: 30,
  safe_mode: true, // Modo seguro inicial por padrão
  default_omie_category: null,
  default_omie_department: null,
  block_if_unmapped: true,
  overlap_days: 3,
};

// Cache em memória para fallback resiliente
let memoryConfigCache: ClaraConfig = { ...DEFAULT_CONFIG };
let memoryCategoryMappings: ClaraCategoryMapping[] = [];
let memoryDepartmentMappings: ClaraDepartmentMapping[] = [];

export class ClaraConfigService {
  /**
   * Obtém as credenciais ativas do Omie do ambiente
   */
  public static getOmieCredentials(company = 'Mar Brasil'): { appKey: string; appSecret: string } {
    const isDZM = company.toLowerCase().includes('dzm');
    const appKey = isDZM 
      ? (process.env.OMIE_APP_KEY_DZM || '') 
      : (process.env.OMIE_APP_KEY_MARBRASIL || '');
    const appSecret = isDZM 
      ? (process.env.OMIE_APP_SECRET_DZM || '') 
      : (process.env.OMIE_APP_SECRET_MARBRASIL || '');

    if (!appKey || !appSecret) {
      // Tenta o outro se um estiver vazio
      const fallbackKey = process.env.OMIE_APP_KEY_MARBRASIL || process.env.OMIE_APP_KEY_DZM || '';
      const fallbackSecret = process.env.OMIE_APP_SECRET_MARBRASIL || process.env.OMIE_APP_SECRET_DZM || '';
      return { appKey: fallbackKey, appSecret: fallbackSecret };
    }

    return { appKey, appSecret };
  }

  /**
   * Obtém a configuração atual da integração Clara
   */
  public static async getConfig(): Promise<ClaraConfig> {
    try {
      const { data, error } = await supabase
        .from('clara_config')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (error || !data) {
        return memoryConfigCache;
      }

      memoryConfigCache = {
        ...DEFAULT_CONFIG,
        ...data,
      };

      return memoryConfigCache;
    } catch {
      return memoryConfigCache;
    }
  }

  /**
   * Salva ou atualiza a configuração da integração Clara
   */
  public static async saveConfig(partial: Partial<ClaraConfig>): Promise<ClaraConfig> {
    const current = await this.getConfig();
    const updated: ClaraConfig = {
      ...current,
      ...partial,
      updated_at: new Date().toISOString(),
    };

    memoryConfigCache = updated;

    try {
      const { error } = await supabase
        .from('clara_config')
        .upsert(updated);

      if (error) {
        console.warn('[ClaraConfigService] Aviso ao salvar clara_config no Supabase:', error.message);
      }
    } catch (e: any) {
      console.warn('[ClaraConfigService] Erro ao persistir no Supabase, mantido em memória:', e.message);
    }

    return updated;
  }

  /**
   * Retorna os mapeamentos de categorias salvos
   */
  public static async getCategoryMappings(): Promise<ClaraCategoryMapping[]> {
    try {
      const { data, error } = await supabase
        .from('clara_category_mappings')
        .select('*')
        .order('clara_category', { ascending: true });

      if (error || !data) {
        return memoryCategoryMappings;
      }

      memoryCategoryMappings = data;
      return data;
    } catch {
      return memoryCategoryMappings;
    }
  }

  /**
   * Salva mapeamento de categoria
   */
  public static async saveCategoryMapping(mapping: { clara_category: string; omie_category_code: string; omie_category_desc?: string }): Promise<void> {
    const item: ClaraCategoryMapping = {
      clara_category: mapping.clara_category.trim(),
      omie_category_code: mapping.omie_category_code.trim(),
      omie_category_desc: mapping.omie_category_desc?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    // Atualiza memória
    const idx = memoryCategoryMappings.findIndex(m => m.clara_category.toLowerCase() === item.clara_category.toLowerCase());
    if (idx >= 0) memoryCategoryMappings[idx] = item;
    else memoryCategoryMappings.push(item);

    try {
      await supabase.from('clara_category_mappings').upsert(item, { onConflict: 'clara_category' });
    } catch (e: any) {
      console.warn('[ClaraConfigService] Erro ao salvar clara_category_mappings:', e.message);
    }
  }

  /**
   * Remove mapeamento de categoria
   */
  public static async deleteCategoryMapping(claraCategory: string): Promise<void> {
    memoryCategoryMappings = memoryCategoryMappings.filter(m => m.clara_category !== claraCategory);
    try {
      await supabase.from('clara_category_mappings').delete().eq('clara_category', claraCategory);
    } catch (e: any) {
      console.warn('[ClaraConfigService] Erro ao deletar categoria:', e.message);
    }
  }

  /**
   * Retorna os mapeamentos de departamentos salvos
   */
  public static async getDepartmentMappings(): Promise<ClaraDepartmentMapping[]> {
    try {
      const { data, error } = await supabase
        .from('clara_department_mappings')
        .select('*')
        .order('clara_key', { ascending: true });

      if (error || !data) {
        return memoryDepartmentMappings;
      }

      memoryDepartmentMappings = data;
      return data;
    } catch {
      return memoryDepartmentMappings;
    }
  }

  /**
   * Salva mapeamento de departamento
   */
  public static async saveDepartmentMapping(mapping: ClaraDepartmentMapping): Promise<void> {
    const item: ClaraDepartmentMapping = {
      mapping_type: mapping.mapping_type,
      clara_key: mapping.clara_key.trim(),
      omie_department_code: mapping.omie_department_code.trim(),
      omie_department_desc: mapping.omie_department_desc?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const idx = memoryDepartmentMappings.findIndex(m => m.mapping_type === item.mapping_type && m.clara_key.toLowerCase() === item.clara_key.toLowerCase());
    if (idx >= 0) memoryDepartmentMappings[idx] = item;
    else memoryDepartmentMappings.push(item);

    try {
      await supabase.from('clara_department_mappings').upsert(item, { onConflict: 'mapping_type,clara_key' });
    } catch (e: any) {
      console.warn('[ClaraConfigService] Erro ao salvar clara_department_mappings:', e.message);
    }
  }

  /**
   * Remove mapeamento de departamento
   */
  public static async deleteDepartmentMapping(mappingType: string, claraKey: string): Promise<void> {
    memoryDepartmentMappings = memoryDepartmentMappings.filter(m => !(m.mapping_type === mappingType && m.clara_key === claraKey));
    try {
      await supabase.from('clara_department_mappings').delete().match({ mapping_type: mappingType, clara_key: claraKey });
    } catch (e: any) {
      console.warn('[ClaraConfigService] Erro ao deletar departamento:', e.message);
    }
  }

  /**
   * Busca contas correntes do Omie (com filtro preferencial para tipo 'CR' - Cartão de Crédito)
   */
  public static async getOmieAccounts(onlyCreditCard = false): Promise<OmieAccountOption[]> {
    const { appKey, appSecret } = this.getOmieCredentials();
    if (!appKey || !appSecret) {
      throw new Error('Credenciais do Omie não configuradas no sistema.');
    }

    try {
      const response = await axios.post('https://app.omie.com.br/api/v1/geral/contacorrente/', {
        call: 'ListarContasCorrentes',
        app_key: appKey,
        app_secret: appSecret,
        param: [{ pagina: 1, registros_por_pagina: 100, apenas_importado_api: 'N' }],
      }, { timeout: 15000 });

      const list = response.data?.ListarContasCorrentes || [];
      const accounts: OmieAccountOption[] = list.map((c: any) => ({
        nCodCC: Number(c.nCodCC),
        descricao: c.descricao || 'Conta Sem Nome',
        tipo: c.tipo || '',
        tipo_descricao: c.tipo_descricao || c.tipo || '',
      }));

      if (onlyCreditCard) {
        return accounts.filter(a => a.tipo === 'CR');
      }
      return accounts;
    } catch (error: any) {
      const msg = error.response?.data?.faultstring || error.message;
      throw new Error(`Falha ao consultar Contas Correntes no Omie: ${msg}`);
    }
  }

  /**
   * Busca os departamentos do Omie
   */
  public static async getOmieDepartments(): Promise<OmieDepartmentOption[]> {
    const { appKey, appSecret } = this.getOmieCredentials();
    if (!appKey || !appSecret) {
      return [];
    }

    try {
      const response = await axios.post('https://app.omie.com.br/api/v1/geral/departamentos/', {
        call: 'ListarDepartamentos',
        app_key: appKey,
        app_secret: appSecret,
        param: [{ pagina: 1, registros_por_pagina: 100 }],
      }, { timeout: 15000 });

      const list = response.data?.departamentos || [];
      return list.map((d: any) => ({
        codigo: String(d.codigo),
        descricao: d.descricao || String(d.codigo),
      }));
    } catch (error: any) {
      console.warn('[ClaraConfigService] Falha ao consultar departamentos Omie:', error.message);
      return [];
    }
  }

  /**
   * Busca as categorias reais do Omie (primeiro tenta a tabela omie_dim_categorias do Supabase)
   */
  public static async getOmieCategories(): Promise<OmieCategoryOption[]> {
    try {
      const { data, error } = await supabase
        .from('omie_dim_categorias')
        .select('codigo_categoria, descricao_categoria')
        .order('descricao_categoria', { ascending: true });

      if (!error && data && data.length > 0) {
        // Remove duplicados de categorias
        const map = new Map<string, string>();
        data.forEach(c => {
          if (c.codigo_categoria && !map.has(c.codigo_categoria)) {
            map.set(c.codigo_categoria, c.descricao_categoria || c.codigo_categoria);
          }
        });
        return Array.from(map.entries()).map(([codigo, descricao]) => ({ codigo, descricao }));
      }
    } catch (e: any) {
      console.warn('[ClaraConfigService] Erro ao consultar omie_dim_categorias:', e.message);
    }

    // Fallback: consulta direta à API Omie
    const { appKey, appSecret } = this.getOmieCredentials();
    if (!appKey || !appSecret) return [];

    try {
      const response = await axios.post('https://app.omie.com.br/api/v1/geral/categorias/', {
        call: 'ListarCategorias',
        app_key: appKey,
        app_secret: appSecret,
        param: [{ pagina: 1, registros_por_pagina: 100 }],
      }, { timeout: 15000 });

      const list = response.data?.categoria_cadastro || [];
      return list.map((c: any) => ({
        codigo: String(c.codigo),
        descricao: c.descricao || String(c.codigo),
      }));
    } catch {
      return [];
    }
  }
}
