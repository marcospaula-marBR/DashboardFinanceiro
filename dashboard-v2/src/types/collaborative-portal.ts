/**
 * Types — Portal Colaborativo da Equipe & Central de Notificações Inteligentes
 * Mar Brasil — Modelo Operacional Transparente e RLS
 * @version v.02.59.49
 */

import { PrazoVisualInfo } from '@/types/war-room';

export type ActivityUrgencyGroup = 
  | 'urgentes' 
  | 'atrasadas' 
  | 'hoje' 
  | 'proximas' 
  | 'em_andamento' 
  | 'concluidas';

export interface CollaborativeActivity {
  id: string;
  titulo: string;
  descricao: string;
  origemTipo: 'coluna' | 'cronograma';
  origemId: string;
  origemTitulo: string;
  dia?: number;
  dataLimite?: string;
  prazoInfo: PrazoVisualInfo;
  concluido: boolean;
  destaque?: boolean;
  prioridade: 'normal' | 'alta' | 'urgente';
  responsaveis: string[];
  requiresAck: boolean;
  ackStatus: 'aguardando' | 'confirmada' | 'excedido' | 'nao_requer';
  acknowledgedAt?: string;
  acknowledgedByName?: string;
  helpOffersCount: number;
  userHasPendingHelpOffer?: boolean;
  observacao?: string;
}

export type HelpOfferStatus = 'pendente' | 'aceita' | 'recusada';

export interface HelpOffer {
  id: string;
  activityId: string;
  activityTitle: string;
  taskOwnerName: string;
  offeredByProfileId: string;
  offeredByEmployeeId?: string;
  offeredByName: string;
  notes?: string;
  status: HelpOfferStatus;
  adminNotes?: string;
  decidedAt?: string;
  decidedByName?: string;
  createdAt: string;
}

export type NotificationPriority = 'info' | 'important' | 'urgent';
export type NotificationCategory = 'task_alert' | 'morning_digest' | 'manual_broadcast' | 'help_offer' | 'system';

export interface PortalNotification {
  id: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  category: NotificationCategory;
  activityId?: string;
  activityTitle?: string;
  requiresAck: boolean;
  acknowledged: boolean;
  createdAt: string;
  read?: boolean;
}

export interface RegisteredDevice {
  id: string;
  deviceLabel: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'other';
  active: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export interface MemberLinkInfo {
  id?: string;
  memberName: string;
  employeeId?: string;
  profileId?: string;
  employeeFullName?: string;
  employeeJobRole?: string;
  employeeEmail?: string;
  colorHex?: string;
}
