import { DreRow, DreCalculatedResult } from '@/types/dre';

// ─── Módulo 1: Precificação de Nova Proposta / Licitação ───────────────────
export interface ProposalPricingParams {
  faturamentoNovo: number;          // F_novo: faturamento estimado mensal (R$)
  custoDiretoNovo: number;          // CD_novo: custo direto mensal estimado (R$)
  margemDesejadaPct: number;        // margem mínima desejada em % (ex: 15 para 15%)
  aliquotaImpostosPct?: number;     // impostos diretos sobre receita % (opcional, ex: 10 para 10%)
  alertaCapacidadePct?: number;     // threshold para alertar necessidade de estrutura adicional (padrão: 20%)
  nomeProposta?: string;
  observacoes?: string;
}

export interface DilutionEffectItem {
  id: string;
  nome: string;
  faturamentoOriginal: number;
  partOriginalPct: number;
  partNovaPct: number;
  rateioOriginal: number;
  rateioNovo: number;
  economiaRateio: number;
  reducaoRelativaPct: number;
}

export interface ProposalPricingResult {
  ftOriginal: number;               // FT_p
  drOriginal: number;               // DR_p
  ftNovo: number;                   // FT_novo = FT_p + F_novo
  partNovoPct: number;              // Part_novo = F_novo / FT_novo
  rateioNovo: number;               // Rateio_novo = Part_novo × DR_p
  custoTotalNovo: number;           // Custo_Total_novo = CD_novo + Rateio_novo
  
  // Preços sugeridos
  precoMinMarkup: number;           // Método A: Custo_Total × (1 + margem%)
  precoMinMargemSobrePreco: number; // Método B: Custo_Total / (1 - impostos% - margem%)
  diferencaPrecoPct: number;        // % de diferença entre os dois métodos
  
  // Margens de Contribuição resultantes
  margemContribAbsoluta: number;    // F_novo - CD_novo
  margemContribPct: number;         // (F_novo - CD_novo) / F_novo
  lucroLiquidoEstimado: number;     // Preço sugerido - CD_novo - Rateio_novo
  
  // Efeito Diluição
  fatorDiluicaoContratos: number;   // FT_p / FT_novo (ex: 86.96% -> economia de 13.04%)
  reducaoRelativaRateioPct: number; // (1 - fatorDiluicaoContratos) * 100
  economiaGlobalRateio: number;     // Soma de alívio de rateio nos outros contratos
  contratosDiluidos: DilutionEffectItem[];
  
  // Alertas
  alertaEstruturaNecessaria: boolean;
  alertaMargemBaixa: boolean;
  mensagensAlerta: string[];
}

// ─── Módulo 2: Stress Test de Perda de Contrato ────────────────────────────
export interface ContractLossParams {
  contractId: string;               // ID do contrato selecionado
  faturamentoMensal: number;        // F_X
  custoDiretoMensal: number;        // CD_X
  horizonteMeses: number;           // N meses até reposição
  metaReposicaoPct: number;         // 0% a 100% (padrão 100%)
  bufferSegurancaPct?: number;      // buffer opcional (ex: 10%)
}

export interface SensitivityScenario {
  cenario: 'Otimista' | 'Intermediário' | 'Conservador';
  reposicaoPct: number;
  metaMensalNovoFaturamento: number;
  corteNecessarioDR: number;
  impactoLiquidoResultado: number;
  descricao: string;
}

export interface ContractLossResult {
  contratoNome: string;
  ftOriginal: number;
  drOriginal: number;
  partOriginalPct: number;          // Part_X = F_X / FT_p
  
  // Passo 1: Impacto Bruto
  perdaFaturamentoMensal: number;   // F_X
  reducaoCustoDireto: number;       // CD_X
  margemContribPerdida: number;     // F_X - CD_X
  
  // Passo 2: Redistribuição do Rateio
  ftPosPerda: number;               // FT_p - F_X
  fatorAumentoRateioPct: number;    // ((FT_p / FT_pos_perda) - 1) * 100
  rateioMedioAdicionalPct: number;  // Sobrecarga média nos remanescentes
  
  // Passo 3: Cenário SEM substituição (corte de DR)
  corteNecessarioDR: number;        // Part_X × DR_p
  lucroCessanteExcedente: number;   // Margem_contrib_perdida - Corte_necessario_DR
  temLucroCessanteAlemDoRateio: boolean;
  
  // Passo 4: Cenário COM substituição
  metaMensalReposicao: number;      // (F_X × %meta) / N
  metaMensalComBuffer: number;      // Meta × (1 + buffer%)
  
  // Passo 5: Matriz de Sensibilidade
  sensibilidade: SensitivityScenario[];
  
  // Impacto por contrato remanescente
  contratosSobrecarga: Array<{
    id: string;
    nome: string;
    faturamento: number;
    rateioAtual: number;
    rateioPosPerda: number;
    aumentoRateioAbs: number;
    aumentoRateioPct: number;
  }>;
}

// ─── Módulo 3: Simulações Rápidas por R$ e % ──────────────────────────────
export interface QuickSimParams {
  tipoAjusteReceita: 'percent' | 'absolute';
  valorReceita: number;             // ex: +100000 ou -100000, ou +15 / -20
  tipoAjusteCustos: 'percent' | 'absolute';
  valorCustos: number;              // ex: -50000 ou +10%
  tipoAjusteDespesas: 'percent' | 'absolute';
  valorDespesas: number;            // ex: -20000 ou -10%
}

// ─── Módulo 4: Simulação Livre por Rubricas ────────────────────────────────
export interface RubricAdjustmentItem {
  id: string;
  contaDRE: string;
  categoria?: string;
  tipo: 'percent' | 'absolute';
  valor: number;                    // positivo para aumento, negativo para corte
  modo: 'mensal' | 'total';
  ativo: boolean;
  observacao?: string;
}

// ─── Estado Consolidado do Simulador ───────────────────────────────────────
export interface ConsolidatedSimulationMetrics {
  receitaOriginal: number;
  receitaSimulada: number;
  custosOriginal: number;
  custosSimulada: number;
  despesasOriginal: number;
  despesasSimulada: number;
  margemBrutaOriginalPct: number;
  margemBrutaSimuladaPct: number;
  ebitdaOriginal: number;
  ebitdaSimulado: number;
  ebitdaOriginalPct: number;
  ebitdaSimuladoPct: number;
  fclOriginal: number;
  fclSimulado: number;
  breakEvenOriginal: number;
  breakEvenSimulado: number;
  variacaoResultadoAbsoluta: number;
}
