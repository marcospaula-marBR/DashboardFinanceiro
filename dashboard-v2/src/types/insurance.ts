/**
 * Types — Insurance Policies
 * Módulo de Seguros | Mar Brasil
 * @version v.02.48.97
 */

export type InsuranceContratante = 'Mar Brasil' | 'DZM' | string;

export type InsuranceTipo =
  | 'Automóvel'
  | 'Saúde'
  | 'Responsabilidade Civil'
  | 'Vida'
  | 'Patrimonial'
  | 'Residencial'
  | 'Transporte'
  | string;

export type InsuranceStatusVencimento = 'ok' | 'atencao' | 'urgente' | 'vencido' | 'sem_data';

export interface InsurancePolicy {
  id: string;
  contratante: string;
  tipo: string;
  segurado?: string;
  seguradora?: string;
  apolice?: string;
  senha?: string;
  assistencia_24h?: string;
  inicio?: string;         // ISO date string YYYY-MM-DD
  vencimento?: string;     // ISO date string YYYY-MM-DD
  premio: number;
  parcelas_total: number;
  valor_parcela: number;
  dia_pgto?: string;
  formato_parcelas?: string;
  corretor?: string;
  telefone_corretor?: string;
  email_corretor?: string;
  indicador?: string;
  franquia?: number;
  franquia_reduzida?: boolean;
  franquia_reduzida_percentual?: number;
  cobertura_vidros?: boolean;
  cobertura_lanternas?: boolean;
  cobertura_farois?: boolean;
  coberturas_adicionais?: string;
  ativo: boolean;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;

  // Campos calculados (enriched client-side, não persistidos no DB)
  diasParaVencer?: number;
  parcelasPagas?: number;
  parcelasRestantes?: number;
  statusVencimento?: InsuranceStatusVencimento;
}

export interface InsurancePolicyInput {
  contratante: string;
  tipo: string;
  segurado?: string;
  seguradora?: string;
  apolice?: string;
  senha?: string;
  assistencia_24h?: string;
  inicio?: string;
  vencimento?: string;
  premio?: number;
  parcelas_total?: number;
  valor_parcela?: number;
  dia_pgto?: string;
  formato_parcelas?: string;
  corretor?: string;
  telefone_corretor?: string;
  email_corretor?: string;
  indicador?: string;
  ativo?: boolean;
  franquia?: number;
  franquia_reduzida?: boolean;
  franquia_reduzida_percentual?: number;
  cobertura_vidros?: boolean;
  cobertura_lanternas?: boolean;
  cobertura_farois?: boolean;
  coberturas_adicionais?: string;
  observacoes?: string;
}

export interface InsuranceKPIs {
  totalApólices: number;
  apólicesAtivas: number;
  premioMensalTotal: number;
  premioAnualTotal: number;
  proximoVencimento: InsurancePolicy | null;
  vencendoEm30Dias: InsurancePolicy[];
  vencendoEm7Dias: InsurancePolicy[];
  maiorPremio: InsurancePolicy | null;
  porContratante: Record<string, number>;
  porTipo: Record<string, number>;
}

export interface InsuranceFilterValues {
  contratante: string;
  tipo: string;
  seguradora: string;
  mostrarInativos: boolean;
}

/** Resultado bruto do OCR via Gemini API */
export interface InsuranceOCRResult {
  contratante?: string;
  tipo?: string;
  segurado?: string;
  seguradora?: string;
  apolice?: string;
  senha?: string;
  assistencia_24h?: string;
  inicio?: string;
  vencimento?: string;
  premio?: number;
  parcelas_total?: number;
  valor_parcela?: number;
  dia_pgto?: string;
  formato_parcelas?: string;
  corretor?: string;
  telefone_corretor?: string;
  email_corretor?: string;
  indicador?: string;
  franquia?: number;
  franquia_reduzida?: boolean;
  cobertura_vidros?: boolean;
  cobertura_lanternas?: boolean;
  cobertura_farois?: boolean;
  coberturas_adicionais?: string;
  observacoes?: string;
  confianca?: 'alta' | 'media' | 'baixa';
  camposNaoEncontrados?: string[];
}
