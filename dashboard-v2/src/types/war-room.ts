/**
 * Types — Lousa Digital Operacional & War Room (Modo TV)
 * Baseado fielmente na Lousa Operacional Física da Mar Brasil
 * @version v.02.59.23
 */

export interface WhiteboardItem {
  id: string;
  texto: string;
  concluido: boolean;
  destaque?: boolean;
  observacao?: string;
  responsavel?: string; // Nome do responsável (compatibilidade / texto formatado: ex: "MANUS, CLARA")
  responsaveis?: string[]; // Lista de múltiplos responsáveis atribuídos à tarefa
  dataLimite?: string; // Data limite da tarefa (formato YYYY-MM-DD ou DD/MM)
  arquivado?: boolean; // Se a tarefa individual foi arquivada
  arquivadoEm?: string;
  finalizadoPor?: string;
  colunaOrigemId?: string;
  colunaOrigemTitulo?: string;
  prioridade?: 'normal' | 'alta' | 'urgente';
}

export type PrazoStatus = 'atrasado' | 'hoje' | 'em_dia' | 'distante' | 'sem_prazo' | 'concluido';

export interface PrazoVisualInfo {
  status: PrazoStatus;
  rotulo: string; // Ex: "🚨 Atrasado (2d)", "⚠️ Vence Hoje", "⏳ Em dia (3d)", "🗓️ 15/10 (8d)"
  rotuloCurto?: string; // Ex: "🚨 2d", "⚠️ Hoje", "⏳ 3d", "🗓️ 15/10"
  badgeClass: string;
  diasRestantes?: number;
}

export interface WhiteboardColumn {
  id: string;
  titulo: string; // Ex: "CONTABILIDADE PY:", "PAGOPAR CONTA G2:", "DLOCAL G2:", etc.
  subtitulo?: string;
  alertaDestaque?: string; // Ex: "* SUSPENSAS NOVAS CONTAS"
  corMarcador: 'vermelho' | 'azul' | 'ciano' | 'esmeralda' | 'ambar';
  itens: WhiteboardItem[];
  // Propriedades da Demanda:
  dataLimite?: string; // Data limite da demanda inteira (formato YYYY-MM-DD ou DD/MM)
  arquivado?: boolean; // Se a demanda inteira está arquivada/oculta da lousa ativa
  arquivadoEm?: string; // Data ISO em que a demanda foi arquivada
  criadoEm?: string;
}

export interface FollowTheMoneyRow {
  id: string;
  data: string; // "23/09"
  de: string; // "MARBR"
  para: string; // "SAASTKT-DLOCAL"
  formato: string; // "CC", "MOEDA"
  moeda: string; // "USD", "G$"
  valor: string; // "9,99"
  diferenca: string; // "0,35"
  percentual: string; // "3,5%"
  observacao?: string;
}

export interface FollowTheMoneyState {
  cotacaoUsdGs: string; // "5930"
  linhas: FollowTheMoneyRow[];
}

export interface WhiteboardTimelineItem {
  id: string;
  dia: number; // 5, 10, 15, 18, 20, 23, 25, 27, 30
  descricao: string; // "05 - PLANNIGI", "10 - COTAS YBOX"
  concluido: boolean;
  empresa?: string;
  responsavel?: string; // Nome do responsável (compatibilidade / texto formatado: ex: "MANUS, CLARA")
  responsaveis?: string[]; // Lista de múltiplos responsáveis atribuídos à obrigação
}

export interface WhiteboardTimelineBlock {
  id: string;
  intervalo: string; // "01 a 05", "06 a 10", "11 a 15", "16 a 20", "21 a 25", "26 a 30/31"
  diaInicio: number;
  diaFim: number;
  itens: WhiteboardTimelineItem[];
}

export interface WhiteboardDataState {
  mesReferencia?: string; // YYYY-MM para controle de renovação automática mensal
  colunas: WhiteboardColumn[];
  followTheMoney: FollowTheMoneyState;
  cronograma: WhiteboardTimelineBlock[];
}
