export const APP_VERSION = 'v.01.00.00';
export const VERSION_DATE = '2026-08-09';

export interface VersionChangelogEntry {
  version: string;
  date: string;
  title: string;
  description: string;
  changes: string[];
}

export const VERSION_CHANGELOG: VersionChangelogEntry[] = [
  {
    version: 'v.01.00.00',
    date: '2026-08-09',
    title: 'Lançamento do Simulador Financeiro SaaS Standalone',
    description: 'Criação inicial do produto autônomo desacoplado do DRE e Omie para PMEs com faturamento até R$ 20M/ano.',
    changes: [
      'Motor de simulação determinístico standalone sem dependências de DRE contábil.',
      'Estrutura financeira PME simplificada: Receitas, Deduções, Custos Variáveis, Despesas Fixas, Pessoal, Investimentos e Empréstimos.',
      'Indicadores avançados: Runway de caixa, Ponto de Equilíbrio (Break-Even), Margem de Contribuição e EBITDA.',
      'Consultor IA Financeiro integrado.',
      'Suporte a exportação de relatórios e multi-tenant.'
    ]
  }
];
