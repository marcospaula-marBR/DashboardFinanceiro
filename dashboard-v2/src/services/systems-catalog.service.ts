import { SystemItem, SystemCategory } from '@/types/loans';
import { supabase } from '@/lib/supabase';

const SYSTEMS_STORAGE_KEY = 'marbrasil_systems_catalog_v2';
const GLOBAL_CONFIG_NAME = '__SYSTEM_GLOBAL_CONFIG__';

export const DEFAULT_SYSTEMS_CATALOG: SystemItem[] = [
  // Bancários
  {
    id: 'sys-bradesco',
    name: 'Bradesco Net Empresa',
    category: 'Bancário',
    origin: 'contrato',
    description: 'Acesso a contas bancárias, autorizações de pagamentos e extratos Bradesco.',
    default_level: 'Tático'
  },
  {
    id: 'sys-itau',
    name: 'Itaú Empresas',
    category: 'Bancário',
    origin: 'contrato',
    description: 'Gestão de contas correntes, transferências e remessas bancárias Itaú.',
    default_level: 'Tático'
  },
  {
    id: 'sys-santander',
    name: 'Santander Negócios',
    category: 'Bancário',
    origin: 'contrato',
    description: 'Portal de internet banking empresarial Santander.',
    default_level: 'Tático'
  },
  {
    id: 'sys-bb',
    name: 'Banco do Brasil (BB PJ)',
    category: 'Bancário',
    origin: 'contrato',
    description: 'Gerenciador financeiro corporativo do Banco do Brasil.',
    default_level: 'Tático'
  },

  // ERPs
  {
    id: 'sys-omie',
    name: 'Omie ERP',
    category: 'ERP',
    origin: 'contrato',
    description: 'Sistema integrado de gestão financeira, faturamento, compras e estoque.',
    default_level: 'Estratégico'
  },
  {
    id: 'sys-sienge',
    name: 'Sienge Plataforma',
    category: 'ERP',
    origin: 'contrato',
    description: 'ERP especializado em gestão de contratos, suprimentos e medições.',
    default_level: 'Tático'
  },

  // RH & Folha
  {
    id: 'sys-senior',
    name: 'Senior RH / Ronda',
    category: 'RH & Folha',
    origin: 'contrato',
    description: 'Gestão de folha de pagamento, ponto eletrônico, benefícios e admissões.',
    default_level: 'Operacional'
  },
  {
    id: 'sys-conectius',
    name: 'Conectius Portal',
    category: 'RH & Folha',
    origin: 'interno',
    description: 'Plataforma interna de comunicação, holerites e solicitações de RH.',
    default_level: 'Operacional'
  },

  // Fiscal & Contábil
  {
    id: 'sys-dianna',
    name: 'Dianna DRE & Finanças',
    category: 'Fiscal & Contábil',
    origin: 'interno',
    description: 'Plataforma analítica executiva de DRE, custos, projeções e orçamentos.',
    default_level: 'Estratégico'
  },
  {
    id: 'sys-ecac',
    name: 'Receita Federal / e-CAC',
    category: 'Fiscal & Contábil',
    origin: 'contrato',
    description: 'Acesso via certificado digital para certidões, DCTF, eSocial e DCTFWeb.',
    default_level: 'Estratégico'
  },

  // CRM & Vendas
  {
    id: 'sys-bitrix',
    name: 'Bitrix24 CRM',
    category: 'CRM & Vendas',
    origin: 'contrato',
    description: 'Funil de prospecção, pipeline de vendas e relacionamento com clientes.',
    default_level: 'Operacional'
  },

  // Infra & TI / Comunicação
  {
    id: 'sys-google',
    name: 'Google Workspace (Email/Drive)',
    category: 'Comunicação & Operações',
    origin: 'contrato',
    description: 'Contas de e-mail corporativo, Google Drive, Meet e calendários.',
    default_level: 'Operacional'
  },
  {
    id: 'sys-github',
    name: 'GitHub Organização',
    category: 'Infra & TI',
    origin: 'contrato',
    description: 'Repositórios de código, deploys e infraestrutura em nuvem.',
    default_level: 'Tático'
  }
];

export class SystemsCatalogService {
  private static cachedSystems: SystemItem[] | null = null;

  /**
   * Retorna a lista síncrona do catálogo (cache em memória ou localStorage)
   */
  static getSystems(): SystemItem[] {
    if (this.cachedSystems && this.cachedSystems.length > 0) {
      return this.cachedSystems;
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(SYSTEMS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cachedSystems = parsed;
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar catálogo de sistemas do localStorage:', e);
      }
    }

    this.cachedSystems = DEFAULT_SYSTEMS_CATALOG;
    return DEFAULT_SYSTEMS_CATALOG;
  }

  /**
   * Busca a versão mais atual do catálogo diretamente no Supabase e atualiza o cache
   */
  static async fetchSystemsAsync(): Promise<SystemItem[]> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('metadata')
        .eq('full_name', GLOBAL_CONFIG_NAME)
        .maybeSingle();

      if (data?.metadata?.systems_catalog && Array.isArray(data.metadata.systems_catalog) && data.metadata.systems_catalog.length > 0) {
        const remoteSystems = data.metadata.systems_catalog as SystemItem[];
        this.cachedSystems = remoteSystems;
        this.saveLocalCache(remoteSystems);
        return remoteSystems;
      }
    } catch (e) {
      console.warn('Aviso ao sincronizar catálogo de sistemas com o Supabase:', e);
    }

    // Se não encontrou no Supabase, usa local ou padrão e faz o seed no Supabase
    const current = this.getSystems();
    this.saveSystemsAsync(current).catch(() => {});
    return current;
  }

  /**
   * Salva o catálogo localmente
   */
  private static saveLocalCache(systems: SystemItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SYSTEMS_STORAGE_KEY, JSON.stringify(systems));
    } catch (e) {
      console.error('Erro ao salvar catálogo no localStorage:', e);
    }
  }

  /**
   * Salva a lista de sistemas tanto no Supabase (Nuvem compartilhada) quanto no cache local
   */
  static async saveSystemsAsync(systems: SystemItem[]): Promise<void> {
    this.cachedSystems = systems;
    this.saveLocalCache(systems);

    try {
      // 1. Obter metadata atual do registro de configuração global
      const { data: existing } = await supabase
        .from('employees')
        .select('id, metadata')
        .eq('full_name', GLOBAL_CONFIG_NAME)
        .maybeSingle();

      const existingMeta = (existing?.metadata as Record<string, any>) || {};
      const updatedMeta = {
        ...existingMeta,
        systems_catalog: systems,
        updated_at: new Date().toISOString()
      };

      if (existing?.id) {
        await supabase
          .from('employees')
          .update({ metadata: updatedMeta })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('employees')
          .insert([{
            full_name: GLOBAL_CONFIG_NAME,
            company: 'MarBR',
            employment_type: 'CLT',
            active: false,
            status: 'Inativo',
            metadata: updatedMeta
          }]);
      }
    } catch (e) {
      console.error('Erro ao persistir catálogo de sistemas no Supabase:', e);
    }
  }

  /**
   * Método síncrono legado que agora também dispara a sincronização assíncrona
   */
  static saveSystems(systems: SystemItem[]): void {
    this.cachedSystems = systems;
    this.saveLocalCache(systems);
    this.saveSystemsAsync(systems).catch(err => {
      console.error('Erro ao sincronizar com Supabase:', err);
    });
  }

  /**
   * Adiciona um novo sistema ao catálogo
   */
  static addSystem(item: Omit<SystemItem, 'id' | 'created_at'>): SystemItem {
    const current = this.getSystems();
    const newId = `sys-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    const newSystem: SystemItem = {
      ...item,
      id: newId,
      created_at: new Date().toISOString().split('T')[0]
    };

    const updated = [...current, newSystem];
    this.saveSystems(updated);
    return newSystem;
  }

  /**
   * Atualiza um sistema existente
   */
  static updateSystem(updatedItem: SystemItem): void {
    const current = this.getSystems();
    const index = current.findIndex(s => s.id === updatedItem.id);
    if (index !== -1) {
      current[index] = updatedItem;
      this.saveSystems([...current]);
    }
  }

  /**
   * Remove um sistema do catálogo
   */
  static deleteSystem(id: string): void {
    const current = this.getSystems();
    const updated = current.filter(s => s.id !== id);
    this.saveSystems(updated);
  }

  /**
   * Restaura o catálogo para a lista padrão inicial
   */
  static resetToDefault(): SystemItem[] {
    this.saveSystems(DEFAULT_SYSTEMS_CATALOG);
    return DEFAULT_SYSTEMS_CATALOG;
  }
}
