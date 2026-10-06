/**
 * Types — Lousa Digital Operacional & War Room (Modo TV)
 * @version v.02.59.22
 */

export type WarRoomCompany = 'MarBR' | 'DZM' | 'G2' | 'Conectius';

export type ObligationStatus = 'atrasado' | 'hoje' | 'pendente' | 'pago';

export interface WarRoomObligation {
  id: string;
  titulo: string;
  diaVencimento: number; // 1 a 31
  mesReferencia?: string; // YYYY-MM
  dataExata?: string; // YYYY-MM-DD
  empresa: WarRoomCompany;
  valor: number;
  categoria: string;
  status: ObligationStatus;
  recorrente: boolean;
  observacoes?: string;
}

export type PillarId = 'contabilidade' | 'gateways' | 'cambio' | 'remessa' | 'lancamentos';

export type DemandPriority = 'critica' | 'alta' | 'normal';

export interface StrategicDemandItem {
  id: string;
  pilarId: PillarId;
  titulo: string;
  descricao?: string;
  concluida: boolean;
  prioridade: DemandPriority;
  prazo?: string; // YYYY-MM-DD
  responsavel?: string;
}

export interface StrategicPillar {
  id: PillarId;
  numero: number;
  nome: string;
  subtitulo: string;
  icone: string;
  itens: StrategicDemandItem[];
}

export interface FollowTheMoneyFlow {
  origemNome: string;
  origemValor: number;
  processadoraNome: string;
  processadoraTaxa: number; // Ex: 3.5 (%)
  intermediariaNome: string;
  intermediariaValor: number;
  contaFinalNome: string;
  contaFinalValor: number;
  taxaPercentualGlobal: number; // Ex: 4.8 (%)
  moedaReferencia: string; // 'USD/BRL'
  cotacaoUSD: number;
  variacaoUSD?: number;
  ultimaAtualizacao: string;
}

export interface InsuranceExpiringAlert {
  id: string;
  segurado: string;
  tipo: string;
  seguradora: string;
  corretor?: string;
  apolice?: string;
  vencimento: string;
  diasRestantes: number;
  premio: number;
  faixaAlerta: 'critico' | 'atencao' | 'planejamento'; // <10d, 11-20d, 21-30d
}

export interface WarRoomSummaryCounters {
  atrasadosCount: number;
  atrasadosTotal: number;
  vencendoHojeCount: number;
  vencendoHojeTotal: number;
  segurosAlertaCount: number;
  demandasCriticasCount: number;
}
