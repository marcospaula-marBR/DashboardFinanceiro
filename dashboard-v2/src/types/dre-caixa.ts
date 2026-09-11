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
  numero_parcela?: string | null; // ex: "1/6", "001/006"
  parcela_atual?: number;
  total_parcelas?: number;
  tipo_pagamento: 'A_VISTA' | 'PARCELADO';

  // Metadados executivos 360° e conciliação bancária
  conciliado?: boolean;
  data_conciliacao?: string | null;
  data_vencimento?: string | null;
  data_emissao?: string | null;
  dias_atraso?: number;
  status_pontualidade?: 'EM_DIA' | 'ATRASO_LEVE' | 'ATRASO_MEDIO' | 'ATRASO_CRITICO';
  impostos_retidos?: {
    ir: number;
    iss: number;
    pis: number;
    cofins: number;
    csll: number;
    inss: number;
    total: number;
  };
  valor_bruto?: number;
  cnpj_cpf?: string | null;
  contrato_omie?: string | null;
  chave_nfe?: string | null;
  observacoes?: string | null;
  uInc?: string | null;
  dInc?: string | null;
  rateios?: Array<{ departamento: string; valor: number; percentual: number }>;
}

export interface DreCaixaFilters {
  empresas: string[];
  periodos: string[];
  projetos: string[]; // Setores
  categorias: string[];
  fornecedores: string[];
  contasCorrentes: string[];
  search: string;
  tipoPagamento?: 'TODOS' | 'A_VISTA' | 'PARCELADO';
  somenteRecorrentes?: boolean;
  somenteAtrasados?: boolean;
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

  // KPIs Executivos de Conciliação e Pontualidade
  taxaPontualidadeRecebimentos?: number; // % recebimentos em dia
  taxaPontualidadePagamentos?: number; // % pagamentos em dia
  mediaDiasAtraso?: number; // Média de dias de atraso
  totalConciliado?: number; // Total de lançamentos conciliados com extrato
  percentualConciliado?: number; // % conciliado
  totalEmDia?: number; // Contagem de lançamentos em dia
  totalAtrasado?: number; // Contagem de lançamentos atrasados
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

export interface PurchasesAuditSummary {
  totalGeralPago: number;
  totalCompras: number;
  totalRecorrente: number;
  percentualCompras: number;
  totalAVista: number; // 1/1
  totalNovasParceladas: number; // 1/N (pago no mês corrente)
  totalAmortizacaoAnterior: number; // > 1/N (parcelas pagas no mês de compras passadas)
  totalComprometimentoFuturo: number;
  porEmpresa: {
    empresa: string;
    totalGeral: number;
    totalCompras: number;
    totalRecorrente: number;
    aVista: number;
    parcelado: number;
    amortizacaoPassada: number;
    count: number;
  }[];
  porCartao: {
    conta: string;
    total: number;
    count: number;
    isCartao: boolean;
    isFlash: boolean;
  }[];
  porCategoriaCompras: {
    categoria: string;
    total: number;
    count: number;
    percentual: number;
  }[];
  topFornecedoresCompras: {
    fornecedor: string;
    total: number;
    count: number;
    modalidade: string;
    parcelasExemplo: string;
    percentual: number;
  }[];
  flashPorProjeto: {
    projeto: string;
    total: number;
    count: number;
    percentual: number;
  }[];
  flashPorCategoria: {
    categoria: string;
    total: number;
    count: number;
    percentual: number;
  }[];
  flashPorFavorecido: {
    favorecido: string;
    total: number;
    count: number;
    percentual: number;
  }[];
  detalheContaSelecionada?: {
    conta: string;
    total: number;
    count: number;
    projetos: { projeto: string; total: number; count: number; percentual: number }[];
    categorias: { categoria: string; total: number; count: number; percentual: number }[];
    fornecedores: { fornecedor: string; total: number; count: number; percentual: number }[];
  };
}

