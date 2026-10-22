export type RegimeTipo = 'COMPETENCIA' | 'CAIXA' | 'PREVISAO';

export interface DrePainelRateio {
  departamento: string;
  valor: number;
  percentual: number;
}

export interface DrePainelLancamento {
  id: string;
  empresa: string;
  omie_id: number | null;
  tipo: 'PAGAR' | 'RECEBER' | 'MOVIMENTO';
  status: string;
  valor: number; // valor absoluto
  sinal_valor: number; // positivo para entrada/receita, negativo para despesa/custo
  
  // Datas fundamentais para a tripla visão
  data_competencia: string; // YYYY-MM-DD (data_registro ou data_emissao)
  data_caixa: string | null; // YYYY-MM-DD (data_pagamento efetiva)
  data_vencimento: string | null; // YYYY-MM-DD (data_vencimento)
  data_previsao: string | null; // YYYY-MM-DD (data_previsao)
  
  periodo: string; // Ex: 'Set/26'
  periodoNum: number; // YYYY * 12 + MM
  
  conta_dre: string;
  categoria: string;
  projeto: string;
  departamento: string;
  fornecedor_cliente: string;
  conta_corrente: string;
  numero_documento?: string | null;
  
  // Detalhamento e Granularidade de Parcelas
  numero_parcela?: string | null; // ex: "1/6", "003/005"
  parcela_atual?: number;
  total_parcelas?: number;
  tipo_pagamento: 'A_VISTA' | 'PARCELADO';
  is_parcela_anterior: boolean; // se parcela > 1 (gerada em competência anterior)
  is_longo_prazo: boolean; // se total de parcelas > 12
  is_recorrente: boolean; // despesas fixas contínuas (aluguel, sistemas, folha)
  is_provisao: boolean; // se lançamento de provisão
  
  // Status de Vencimento e Atraso
  is_em_atraso: boolean;
  dias_atraso: number;
  
  // Rateios por Departamento/Centro de Custo
  rateios?: DrePainelRateio[];
  
  // Metadados adicionais
  observacoes?: string | null;
  origem_base: 'OMIE_LIVE' | 'HISTORICO_CONGELADO';
}

export interface DrePainelFilters {
  regime: RegimeTipo;
  empresas: string[];
  periodos: string[];
  contasDre: string[];
  departamentos: string[];
  projetos: string[];
  categorias: string[];
  fornecedores: string[];
  contasCorrentes: string[];
  
  ano: string; // 'TODOS' | '2024' | '2025' | '2026'
  
  // Filtros granulares executivos
  filtroParcelamento: 'TODOS' | 'A_VISTA' | 'PARCELADO_GERAL' | 'PARCELA_ANTERIOR' | 'LONGO_PRAZO';
  filtroStatusVencimento: 'TODOS' | 'EM_ATRASO' | 'A_VENCER' | 'PAGO';
  filtroRecorrencia: 'TODOS' | 'SOMENTE_RECORRENTES' | 'SOMENTE_PONTUAIS';
  
  search: string;
  ocultarCategorias?: string[];
  ocultarProjetos?: string[];
}

export interface DrePainelKpis {
  totalReceitas: number;
  totalDespesas: number;
  resultadoLiquido: number;
  margemLiquida: number;
  totalAtrasado: number;
  qtdAtrasados: number;
  totalParceladoComprometido: number;
  totalProvisoes: number;
  totalLancamentos: number;
}

export interface DrePainelTableSection {
  contaDre: string;
  tipo: 'RECEITA' | 'CUSTO' | 'DESPESA' | 'RESULTADO';
  valoresPorMes: Record<string, number>;
  totalGeral: number;
  categorias: {
    categoria: string;
    valoresPorMes: Record<string, number>;
    totalGeral: number;
    detalhes?: DrePainelLancamento[];
  }[];
}
