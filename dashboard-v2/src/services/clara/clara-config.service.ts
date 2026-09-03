import axios from 'axios';
import { supabase } from '@/lib/supabase';
import { 
  ClaraConfig, 
  ClaraCategoryMapping, 
  ClaraDepartmentMapping, 
  OmieAccountOption, 
  OmieDepartmentOption, 
  OmieCategoryOption,
  OmieProjectOption 
} from '@/types/clara.types';

import { ClaraStorageService } from './clara-storage.service';

// Configuração padrão populada com as credenciais oficiais da Clara
export const DEFAULT_CLARA_CONFIG: ClaraConfig = {
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
  card_closing_day: 23,
  card_due_day: 30,
  auto_ocr_on_sync: true,
  active_company_id: 'marbrasil',
  active_company_name: 'Mar Brasil',
  active_company_cnpj: '02.233.923/0001-19',
};

export const DEFAULT_CLARA_CONFIG_MARBRASIL: ClaraConfig = {
  ...DEFAULT_CLARA_CONFIG,
  id: 'marbrasil',
  company_name: 'Mar Brasil',
  active_company_id: 'marbrasil',
  active_company_name: 'Mar Brasil',
  active_company_cnpj: '02.233.923/0001-19',
};

// Configuração oficial da D.Z.M LTDA
export const DEFAULT_CLARA_CONFIG_DZM: ClaraConfig = {
  id: 'dzm',
  client_id: process.env.CLARA_CLIENT_ID_DZM || 'xqXggFOFOwK0rNChN3bBNpeBhpgjUvfB',
  client_secret: process.env.CLARA_CLIENT_SECRET_DZM || '9y6uRVPU3VVd7wwPwImaSXOuSxGHIpMkOwhRabX2VyzBa_Ci3pfY1ZIoZ3YfSjCU',
  certificate_pem: process.env.CLARA_CERTIFICATE_PEM_DZM || `-----BEGIN CERTIFICATE-----
MIIExjCCA66gAwIBAgIUV8DuogM1DrOT4V+1589cqw8zBdQwDQYJKoZIhvcNAQEL
BQAwKjEoMCYGA1UEAxMfQ2xhcmEgQVBJIENlcnRpZmljYXRlIEF1dGhvcml0eTAe
Fw0yNjA5MDMxNzE4MjRaFw0yNzA4MjkxNzE4NTNaMBUxEzARBgNVBAMTCkQuWi5N
IExUREEwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQCliqHbZcHqveIG
zA6Tlgwz5CuLFeL5vB4EhQtzqgogUWKXFPVt+gVyaVPoCewD6+w77eZBScG3C3nx
pQ6a6wMIMdNiqOE4xb9KCniDPJQdTaBxFy6eJ2/87E7s0vkyIIPH9pbTI8Qif2aI
QjAT1wCsOHI+wHfq20cYPrkPEi0B797T3ZHkFQQRqhcY/dJ+zSVcYS/mQJROeHJe
FXJUvdNL+YKCity28UxE536l6VMj5KLtFcpyWNnqOA6CO8vATKLWT6nzRKDnNW1/
+reG9y6GYTqoo+DfP+L3f2EXsbEPJRzeh/KuSx3qKqG2H2u5k/BkZ8E9Uh6jcRiq
mu/LJ/xW2pvVxzAtOq0AdufkMbuHOALFEIWB5onaLiISbJ7gu9ez772mYQVtwRF1
ujwPelFaBlLXMO7ip+vRiKTobE8w8Ep3D3AgJu9Rg8rrfhupX+9QIWk1+OpL0JQT
Kyhu9/F7S9NSufRKFNzL/1GPlqvmiInEkoiTL/vpALn0l68xfLcT6kBBTAGnFIGB
cg/w5utQ8msaV9YgI42N/C2nQXK+Al9VTIsIFbvDXt8GW2s+wkF9SWeV0rehThwS
6AwpPZ34IpSa6+HUsoIA6l8a/9C2oT7Xqu1xzrkuXR1n0HOznQvLf5iO9cWtJtjV
+h82WCscxxFTAkGTXeO0EVoeLgAuaQIDAQABo4H4MIH1MA4GA1UdDwEB/wQEAwID
qDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwHQYDVR0OBBYEFLHu5RCF
l2cW8RR6ANKtwvn9E5PSMB8GA1UdIwQYMBaAFFMIh1rY4n2ZOi9fIkWAh74+Yd+L
MDsGCCsGAQUFBwEBBC8wLTArBggrBgEFBQcwAoYfaHR0cDovLzEyNy4wLjAuMTo4
MjAwL3YxL3BraS9jYTAUBgNVHREEDTALgglsb2NhbGhvc3QwMQYDVR0fBCowKDAm
oCSgIoYgaHR0cDovLzEyNy4wLjAuMTo4MjAwL3YxL3BraS9jcmwwDQYJKoZIhvcN
AQELBQADggEBAPE6qS7uRptQ9qUIYaIbQrqTABIP8ug5J1oORUyK33U17JlPQvq6
ysX1Ch3Rkb06D//71hz4SAK/Kde9lSw4sESDa10uD2AO6S6lWPl9lQAUR/DNeYZF
e1IVrLOR3Uqxu6j9sn7d3oz2ncy3WTHPj4Y4RlICFwXL89jLA482chfSTd6S75hr
PEeLvHJMzr7k67G2BtWP8AVLzRdIRxTn4C/RBQWJ8wnT3T3kXR3XbBqWAEABtFO8
FNLZ7cOwChhubHST8cl4mZMCnOUxbi4CSnA0rLTMG5okzEY0fITgbZOjeKBa0ykS
m2mE5QsK7KRiFetOj7jf5Tyfw9AQfndnAu4=
-----END CERTIFICATE-----`,
  private_key_pem: process.env.CLARA_PRIVATE_KEY_PEM_DZM || `-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----`,
  base_url: process.env.CLARA_BASE_URL || 'https://public-api.br.clara.com',
  omie_n_cod_cc: null,
  omie_cc_descricao: null,
  company_name: 'D.Z.M LTDA',
  auto_sync_enabled: false,
  sync_interval_minutes: 30,
  safe_mode: true,
  default_omie_category: null,
  default_omie_department: null,
  block_if_unmapped: true,
  overlap_days: 3,
  card_closing_day: 23,
  card_due_day: 30,
  auto_ocr_on_sync: true,
  active_company_id: 'dzm',
  active_company_name: 'DZM',
  active_company_cnpj: '46.394.311/0001-83',
};

// Cache em memória para fallback resiliente
let memoryConfigCache: ClaraConfig = { ...DEFAULT_CLARA_CONFIG };
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
   * Obtém a configuração atual da integração Clara (com suporte multi-empresa)
   */
  public static async getConfig(company = 'Mar Brasil'): Promise<ClaraConfig> {
    const isDZM = company.toLowerCase().includes('dzm');
    const defaultConf = isDZM ? DEFAULT_CLARA_CONFIG_DZM : DEFAULT_CLARA_CONFIG_MARBRASIL;
    return ClaraStorageService.getConfig(defaultConf, isDZM ? 'dzm' : 'marbrasil');
  }

  /**
   * Salva ou atualiza a configuração da integração Clara (com suporte multi-empresa)
   */
  public static async saveConfig(partial: Partial<ClaraConfig>, company = 'Mar Brasil'): Promise<ClaraConfig> {
    const isDZM = (partial.active_company_id?.toLowerCase().includes('dzm') || company.toLowerCase().includes('dzm'));
    const defaultConf = isDZM ? DEFAULT_CLARA_CONFIG_DZM : DEFAULT_CLARA_CONFIG_MARBRASIL;
    return ClaraStorageService.saveConfig(partial, defaultConf, isDZM ? 'dzm' : 'marbrasil');
  }

  /**
   * Retorna os mapeamentos de categorias salvos
   */
  public static async getCategoryMappings(): Promise<ClaraCategoryMapping[]> {
    return ClaraStorageService.getCategoryMappings(DEFAULT_CLARA_CONFIG);
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
    await ClaraStorageService.saveCategoryMapping(item, DEFAULT_CLARA_CONFIG);
  }

  /**
   * Remove mapeamento de categoria
   */
  public static async deleteCategoryMapping(claraCategory: string): Promise<void> {
    await ClaraStorageService.deleteCategoryMapping(claraCategory, DEFAULT_CLARA_CONFIG);
  }

  /**
   * Retorna os mapeamentos de departamentos salvos
   */
  public static async getDepartmentMappings(): Promise<ClaraDepartmentMapping[]> {
    return ClaraStorageService.getDepartmentMappings(DEFAULT_CLARA_CONFIG);
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
    await ClaraStorageService.saveDepartmentMapping(item, DEFAULT_CLARA_CONFIG);
  }

  /**
   * Remove mapeamento de departamento
   */
  public static async deleteDepartmentMapping(mappingType: string, claraKey: string): Promise<void> {
    await ClaraStorageService.deleteDepartmentMapping(mappingType, claraKey, DEFAULT_CLARA_CONFIG);
  }

  /**
   * Busca contas correntes do Omie (com filtro preferencial para tipo 'CR' - Cartão de Crédito)
   */
  public static async getOmieAccounts(onlyCreditCard = false, company = 'Mar Brasil'): Promise<OmieAccountOption[]> {
    const { appKey, appSecret } = this.getOmieCredentials(company);
    if (!appKey || !appSecret) {
      throw new Error(`Credenciais do Omie para ${company} não configuradas no sistema.`);
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
        descricao: c.descricao || `Conta ${c.nCodCC}`,
        tipo: c.tipo || 'CC',
      }));

      if (onlyCreditCard) {
        return accounts.filter(a => a.tipo === 'CR');
      }

      return accounts;
    } catch (error: any) {
      console.warn(`[ClaraConfigService] Falha ao consultar contas Omie (${company}):`, error.message);
      return [];
    }
  }

  /**
   * Busca departamentos (centros de custo) do Omie
   */
  public static async getOmieDepartments(company = 'Mar Brasil'): Promise<OmieDepartmentOption[]> {
    const { appKey, appSecret } = this.getOmieCredentials(company);
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

  /**
   * Busca os projetos reais do Omie (Supabase omie_dim_projetos / projetos ou API direta)
   */
  public static async getOmieProjects(company = 'Mar Brasil'): Promise<OmieProjectOption[]> {
    const map = new Map<string, string>();

    try {
      // 1. Tenta omie_dim_projetos
      const { data: dimProjs } = await supabase
        .from('omie_dim_projetos')
        .select('codigo_projeto, descricao_projeto')
        .order('descricao_projeto', { ascending: true });

      if (dimProjs && dimProjs.length > 0) {
        dimProjs.forEach(p => {
          if (p.codigo_projeto && !map.has(p.codigo_projeto)) {
            map.set(String(p.codigo_projeto).trim(), (p.descricao_projeto || String(p.codigo_projeto)).trim());
          }
        });
      }

      // 2. Tenta tabela projetos (ativos)
      const { data: projs } = await supabase
        .from('projetos')
        .select('omie_id, nome')
        .order('nome', { ascending: true });

      if (projs && projs.length > 0) {
        projs.forEach(p => {
          if (p.omie_id && !map.has(String(p.omie_id))) {
            map.set(String(p.omie_id).trim(), (p.nome || String(p.omie_id)).trim());
          }
        });
      }

      if (map.size > 0) {
        return Array.from(map.entries())
          .map(([codigo, descricao]) => ({ codigo, descricao }))
          .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
      }
    } catch (e: any) {
      console.warn('[ClaraConfigService] Erro ao consultar projetos no Supabase:', e.message);
    }

    // Fallback: consulta direta à API Omie
    const { appKey, appSecret } = this.getOmieCredentials(company);
    if (!appKey || !appSecret) return [];

    try {
      const response = await axios.post('https://app.omie.com.br/api/v1/geral/projetos/', {
        call: 'ListarProjetos',
        app_key: appKey,
        app_secret: appSecret,
        param: [{ pagina: 1, registros_por_pagina: 200, apenas_importado_api: 'N' }],
      }, { timeout: 15000 });

      const list = response.data?.cadastro || response.data?.projetos || response.data?.projeto_cadastro || [];
      return list
        .map((p: any) => ({
          codigo: String(p.codigo || p.nCodProjeto || p.codigo_projeto),
          descricao: String(p.nome || p.descricao || p.descricao_projeto || p.codigo).trim(),
        }))
        .filter((p: any) => Boolean(p.codigo && p.descricao))
        .sort((a: any, b: any) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
    } catch {
      return [];
    }
  }
}

