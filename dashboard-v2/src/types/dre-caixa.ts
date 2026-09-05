export interface DreCaixaLancamento {
  id: string;
  empresa: string;
  omie_id: number | null;
  tipo: 'PAGAR' | 'RECEBER' | 'MOVIMENTO';
  status: string;
  valor: number; // valor absoluto para apuração
  sinal_valor: number; // positivo para entrada, negativo para saída
  data_pagamento: string; // YYYY-MM-DD
  periodo: string; // Ex: 'Jan/25'
  periodoNum: number; // YYYY * 12 + MM para ordenação
  projeto: string; // Setor / Centro de Custo
  categoria: string;
  conta_dre?: string;
  fornecedor_cliente: string;
  conta_corrente: string;
  numero_documento?: string | null;
}

export interface DreCaixaFilters {
  empresas: string[];
  periodos: string[];
  projetos: string[]; // Setores
  categorias: string[];
  fornecedores: string[];
  contasCorrentes: string[];
  search: string;
  ocultarCategorias?: string[];
  ocultarProjetos?: string[];
  ocultarFornecedores?: string[];
}

export interface DreCaixaKpiSummary {
  totalPago: number;
  totalRecebido: number;
  resultadoLiquido: number;
  mediaMensalDespesas: number;
  maiorSetor: { nome: string; valor: number };
  totalLancamentos: number;
}

export interface DreCaixaChartData {
  meses: string[];
  entradasPorMes: number[];
  saidasPorMes: number[];
  saldoPorMes: number[];
  despesasPorSetor: { setor: string; valor: number; percentual: number }[];
  despesasPorCategoria: { categoria: string; valor: number; percentual: number }[];
  topFornecedores: { fornecedor: string; valor: number; percentual: number }[];
  saidasPorContaCorrente: { conta: string; valor: number; percentual: number }[];
}

export interface DreCaixaTableSection {
  grupo: string;
  tipo: 'entrada' | 'custo' | 'despesa' | 'resultado';
  valoresPorMes: Record<string, number>;
  totalPeriodo: number;
  subItens?: {
    descricao: string;
    valoresPorMes: Record<string, number>;
    totalPeriodo: number;
  }[];
}
