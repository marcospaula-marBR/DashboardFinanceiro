import { SystemItem, SystemCategory } from '@/types/loans';

const SYSTEMS_STORAGE_KEY = 'marbrasil_systems_catalog_v1';

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
  /**
   * Retorna a lista completa de sistemas do catálogo
   */
  static getSystems(): SystemItem[] {
    if (typeof window === 'undefined') return DEFAULT_SYSTEMS_CATALOG;
    try {
      const stored = localStorage.getItem(SYSTEMS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar catálogo de sistemas do localStorage:', e);
    }
    // Inicializa com padrão se vazio
    this.saveSystems(DEFAULT_SYSTEMS_CATALOG);
    return DEFAULT_SYSTEMS_CATALOG;
  }

  /**
   * Salva a lista de sistemas no storage local
   */
  static saveSystems(systems: SystemItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SYSTEMS_STORAGE_KEY, JSON.stringify(systems));
    } catch (e) {
      console.error('Erro ao salvar catálogo de sistemas:', e);
    }
  }

  /**
   * Adiciona um novo sistema ao catálogo
   */
  static addSystem(item: Omit<SystemItem, 'id' | 'created_at'>): SystemItem {
    const systems = this.getSystems();
    const newSystem: SystemItem = {
      ...item,
      id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      created_at: new Date().toISOString()
    };
    systems.push(newSystem);
    this.saveSystems(systems);
    return newSystem;
  }

  /**
   * Atualiza um sistema existente
   */
  static updateSystem(updated: SystemItem): void {
    const systems = this.getSystems();
    const idx = systems.findIndex(s => s.id === updated.id);
    if (idx !== -1) {
      systems[idx] = updated;
      this.saveSystems(systems);
    }
  }

  /**
   * Remove um sistema do catálogo
   */
  static deleteSystem(id: string): void {
    const systems = this.getSystems().filter(s => s.id !== id);
    this.saveSystems(systems);
  }

  /**
   * Restaura o catálogo para o padrão de fábrica
   */
  static resetToDefault(): SystemItem[] {
    this.saveSystems(DEFAULT_SYSTEMS_CATALOG);
    return DEFAULT_SYSTEMS_CATALOG;
  }
}
