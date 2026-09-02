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

// Configuração padrão populada com as credenciais oficiais da Clara
const DEFAULT_CONFIG: ClaraConfig = {
  id: 'default',
  client_id: process.env.CLARA_CLIENT_ID || '6yXY8UZIhWXDeA4BcfgSmnIndyF9Rubt',
  client_secret: process.env.CLARA_CLIENT_SECRET || 'tIjHySePnmoya3rxexAUCwLvvt9lsaz7WsH2Pob5_BrtTE-w0J6Pixpqhao09DvB',
  certificate_pem: process.env.CLARA_CERTIFICATE_PEM || `-----BEGIN CERTIFICATE-----
MIIE3zCCA8egAwIBAgIUZotoA8ZPHmAIib40wniwBFD2Ah0wDQYJKoZIhvcNAQEL
BQAwKjEoMCYGA1UEAxMfQ2xhcmEgQVBJIENlcnRpZmljYXRlIEF1dGhvcml0eTAe
Fw0yNjA5MDIxNjExMjRaFw0yNzA4MjgxNjExNTJaMC4xLDAqBgNVBAMTI01BUiBC
UkFTSUwgU0VSVklDT1MgRSBMT0NBQ09FUyBMVERBMIICIjANBgkqhkiG9w0BAQEF
AAOCAg8AMIICCgKCAgEAtqvgWYKxG9wi0oZsAgNAj+QInGKW/lwg0IPeH0XD/yB0
oksYCXPPq6BSKJyVLL4j2lyNWfjA0XC5oYORaEc+Qg901cuXaf2dGoOVOyRl39xZ
Mdl03rhsnxfLJ8wpADATm1h+nsAPqYEa0XVyX63eK3tH5/LBEVfDyTGrUfrpv8Ko
2JuKz3y8o4D0L7Fxxs8hae4il8CGQNNAaET5F/tQ+/86J1PuEUTtgWDCHXojnHln
DH2UKovaehqXZqyk+XjTof4gEgN+2tjPngbex0VZ2q8x8MKInj9BsIgZ9wzrv5D0
lYYFYNRNe0xYsNIhVB0wytJPPb0UKzgEFhcgVCJIqyOo41t0CCSmthkz+Pf6epIs
Dq09btCdrmHU2SuV6UQE4oIdmNOhoxHiX+0Kv6w1E0rbTQvpXh/syPM2i0C3JMR2
RELvhDJfqHpAAlDuA+yGbPbN5yT2eS02sjLHvFEjIYefivyON3RVetzrUxf516sB
C0pJ2KKyQCtc7BywS39rge2saQVYaXLlazXRhV5sQRyTS6/1nPxP24FG4DS0gTTF
colpq2gzCEPhJtQGN3kXfd31uM6YInshkY6+ymq3ftKcWmJHz6RcvFRJ6fEjLQiF
Hou8ZnUUaocl4ASepfaSBJ7TySTOrKqRQczuoNR+Ew9xxuoUTqTbT53Mkgg3EJ8C
AwEAAaOB+DCB9TAOBgNVHQ8BAf8EBAMCA6gwHQYDVR0lBBYwFAYIKwYBBQUHAwEG
CCsGAQUFBwMCMB0GA1UdDgQWBBToj5s87Bs0k5L1UucZvv/lui9URzAfBgNVHSME
GDAWgBRTCIda2OJ9mTovXyJFgIe+PmHfizA7BggrBgEFBQcBAQQvMC0wKwYIKwYB
BQUHMAKGH2h0dHA6Ly8xMjcuMC4wLjE6ODIwMC92MS9wa2kvY2EwFAYDVR0RBA0w
C4IJbG9jYWxob3N0MDEGA1UdHwQqMCgwJqAkoCKGIGh0dHA6Ly8xMjcuMC4wLjE6
ODIwMC92MS9wa2kvY3JsMA0GCSqGSIb3DQEBCwUAA4IBAQCDmlZFAOaOe232yXD6
RZfZPKQ59o5uLeM6E1vmpElsYhL8WcOT2tRlQGlOojJifyy3SdQzxYBbXO6NzQMM
LkOERhATWNYPMma2w+CDWpbvRzOf1+qL09jSyTPpXUvICr7Cr00sz/iIRflEwUHj
xED4IMft0ZnbkMUfso7LUkN1KThKPyt9VyyAuxTN08/BwNv/ntPEecdLwFpbT+s1
wlb4m05sPu+Qc2zpzEq3LBZgH7sNLPBP4EhPHQ02Y1GFgHsPQxgDlKE1jM+FJoGr
ZApf/sJ/Sb6bc3P0b5/fVYpm9iPw1XP3OKN7ggnCnQWZnOjcEGF4aglpesFwJ2lp
ZpS6
-----END CERTIFICATE-----`,
  private_key_pem: process.env.CLARA_PRIVATE_KEY_PEM || `-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----`,
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
    const decodeHtml = (str: string) => (str || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    const isIgnored = (desc: string) => {
      const d = desc.toLowerCase();
      return (
        d.includes('<disponível>') ||
        d.includes('<disponivel>') ||
        d.includes('disponível') ||
        d.includes('disponivel') ||
        d.includes('não usar') ||
        d.includes('nao usar') ||
        d.includes('inativo') ||
        d.includes('inativa') ||
        d === ''
      );
    };

    try {
      const { data, error } = await supabase
        .from('omie_dim_categorias')
        .select('codigo_categoria, descricao_categoria')
        .order('descricao_categoria', { ascending: true });

      if (!error && data && data.length > 0) {
        // Remove duplicados de categorias e placeholders
        const map = new Map<string, string>();
        data.forEach(c => {
          if (!c.codigo_categoria) return;
          const cleanDesc = decodeHtml(c.descricao_categoria || '');
          if (!isIgnored(cleanDesc) && !map.has(c.codigo_categoria)) {
            map.set(c.codigo_categoria, cleanDesc);
          }
        });
        return Array.from(map.entries())
          .map(([codigo, descricao]) => ({ codigo, descricao }))
          .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
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
      return list
        .map((c: any) => ({
          codigo: String(c.codigo),
          descricao: decodeHtml(c.descricao || String(c.codigo)),
        }))
        .filter((c: any) => !isIgnored(c.descricao))
        .sort((a: any, b: any) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
    } catch {
      return [];
    }
  }
}
