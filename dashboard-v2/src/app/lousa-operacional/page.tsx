"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WarRoomService, DEFAULT_WHITEBOARD_DATA, extractResponsaveisList, getResponsibleColor, getTopTasksPerMember, inferDefaultResponsaveis } from '@/services/war-room.service';
import { WhiteboardDataState, FollowTheMoneyRow, WhiteboardItem, WhiteboardColumn, WeekdayKey, WhiteboardDepartment } from '@/types/war-room';
import { fetchInsurancePolicies } from '@/services/insurance.service';
import { InsurancePolicy } from '@/types/insurance';

import { WhiteboardHeader } from '@/components/war-room/WhiteboardHeader';
import { WhiteboardColumns, DemandLayoutMode } from '@/components/war-room/WhiteboardColumns';
import { WhiteboardFollowTheMoney } from '@/components/war-room/WhiteboardFollowTheMoney';
import { WhiteboardTimeline, TimelineLayoutMode } from '@/components/war-room/WhiteboardTimeline';
import { WhiteboardNewsTicker } from '@/components/war-room/WhiteboardNewsTicker';
import { WhiteboardModal } from '@/components/war-room/WhiteboardModal';
import { WhiteboardInsuranceAlertBanner } from '@/components/war-room/WhiteboardInsuranceAlertBanner';
import { WhiteboardResponsibleBoard } from '@/components/war-room/WhiteboardResponsibleBoard';
import { WhiteboardEditDemandModal } from '@/components/war-room/WhiteboardEditDemandModal';
import { WhiteboardArchivedModal } from '@/components/war-room/WhiteboardArchivedModal';
import { WhiteboardDemandColumnModal } from '@/components/war-room/WhiteboardDemandColumnModal';
import { WhiteboardMemberModal } from '@/components/war-room/WhiteboardMemberModal';
import { WhiteboardAdminNotificationsModal } from '@/components/war-room/WhiteboardAdminNotificationsModal';
import { CollaborativePortalService } from '@/services/collaborative-portal.service';
import { Users, Filter, AlertTriangle, User, CheckCircle2, Archive, Tv, Zap, Palette, Plus, Bell, Edit3, Trophy, Building2 } from 'lucide-react';

export default function LousaOperacionalPage() {
  const [data, setData] = useState<WhiteboardDataState>(DEFAULT_WHITEBOARD_DATA);
  const [insurancePolicies, setInsurancePolicies] = useState<InsurancePolicy[]>([]);
  const [isTvMode, setIsTvMode] = useState<boolean>(false);
  const [isCursorHidden, setIsCursorHidden] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'demanda' | 'cambio' | 'cronograma'>('demanda');

  // Modos de visualização de TV Zero-Scroll (Fit-to-Screen)
  const [demandLayoutMode, setDemandLayoutMode] = useState<DemandLayoutMode>('compact');
  const [timelineLayoutMode, setTimelineLayoutMode] = useState<TimelineLayoutMode>('rows');
  const [isZeroScrollMode, setIsZeroScrollMode] = useState<boolean>(true);

  // Sincronização automática entre hover da Demanda e Projeção no Cronograma
  const [hoveredDemand, setHoveredDemand] = useState<{
    colId: string;
    titulo: string;
    corMarcador?: string;
    itens: WhiteboardItem[];
  } | null>(null);

  // Estados de visão e filtro por responsáveis
  const [isResponsibleBoardVisible, setIsResponsibleBoardVisible] = useState<boolean>(false);
  const [selectedResponsible, setSelectedResponsible] = useState<string | null>(null);
  const [onlyOverdueFilter, setOnlyOverdueFilter] = useState<boolean>(false);

  // Estados de gestão de demanda inteira (coluna)
  const [isDemandColumnModalOpen, setIsDemandColumnModalOpen] = useState<boolean>(false);
  const [editingColumn, setEditingColumn] = useState<WhiteboardColumn | null>(null);

  // Estados de edição completa de tarefa e histórico de arquivadas
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState<boolean>(false);
  const [editingDemand, setEditingDemand] = useState<{ colId: string; item: WhiteboardItem } | null>(null);

  // Estados de gestão de membros (editar, excluir e adicionar)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState<boolean>(false);
  const [editingMemberName, setEditingMemberName] = useState<string | null>(null);
  const [memberModalInitialTab, setMemberModalInitialTab] = useState<'list' | 'ranking' | 'form'>('list');

  // Estados Multissetores e Departamentos da Lousa
  const [departments, setDepartments] = useState<WhiteboardDepartment[]>([]);
  const [activeDepartment, setActiveDepartment] = useState<string>('financeiro');
  const [departmentMembers, setDepartmentMembers] = useState<string[]>([]);

  // Estados da Central de Notificações Administrativa e Ofertas de Ajuda
  const [isAdminNotificationsModalOpen, setIsAdminNotificationsModalOpen] = useState<boolean>(false);
  const [pendingHelpOffersCount, setPendingHelpOffersCount] = useState<number>(0);

  const refreshHelpOffers = useCallback(() => {
    CollaborativePortalService.getHelpOffers().then(offers => {
      const count = offers.filter(o => o.status === 'pendente').length;
      setPendingHelpOffersCount(count);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshHelpOffers();
  }, [refreshHelpOffers]);

  // Registro automático do Service Worker para suporte a Web Push e alertas em segundo plano
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[LousaOperacional] Service Worker ativo:', reg.scope);
        })
        .catch(err => {
          console.warn('[LousaOperacional] Falha ao registrar Service Worker:', err);
        });
    }
  }, []);

  // Ao ativar o Modo TV, ajusta automaticamente as demandas em títulos e cronograma em linhas
  useEffect(() => {
    if (isTvMode) {
      setIsZeroScrollMode(true);
      setDemandLayoutMode('compact');
      setTimelineLayoutMode('rows');
    }
  }, [isTvMode]);

  // Carregar dados salvos no localStorage e Supabase (com detecção de setor, virada de mês e hidratação)
  useEffect(() => {
    let initialDept = 'financeiro';
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlDept = params.get('setor');
      if (urlDept) {
        initialDept = urlDept.toLowerCase();
      } else {
        initialDept = WarRoomService.getActiveDepartmentSlug();
      }
    }
    setActiveDepartment(initialDept);
    WarRoomService.setActiveDepartmentSlug(initialDept);

    // Carregar departamentos disponíveis
    CollaborativePortalService.getDepartments().then(depts => {
      if (depts && depts.length > 0) setDepartments(depts);
    });

    // Carregar estado do setor ativo
    const loaded = WarRoomService.getWhiteboardData(initialDept);
    setData(loaded);

    // Sincronizar com versão remota do Supabase
    WarRoomService.loadWhiteboardDataFromSupabase(initialDept).then(remote => {
      if (remote) setData(remote);
    });

    // Carregar membros oficiais vinculados ao setor
    CollaborativePortalService.getDepartmentMembers(initialDept).then(members => {
      if (members && members.length > 0) {
        setDepartmentMembers(members);
      } else if (initialDept === 'financeiro') {
        setDepartmentMembers(['MARCOS', 'MATHEUS', 'MELISSA', 'GUILHERME', 'FINANCEIRO', 'JURÍDICO', 'CONTÁBIL', 'TI']);
      }
    });
  }, []);

  const handleDepartmentChange = async (newDept: string) => {
    setActiveDepartment(newDept);
    WarRoomService.setActiveDepartmentSlug(newDept);
    setSelectedResponsible(null);
    setOnlyOverdueFilter(false);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('setor', newDept);
      window.history.replaceState({}, '', url.toString());
    }

    const localState = WarRoomService.getWhiteboardData(newDept);
    setData(localState);

    const members = await CollaborativePortalService.getDepartmentMembers(newDept);
    setDepartmentMembers(members);

    const remoteState = await WarRoomService.loadWhiteboardDataFromSupabase(newDept);
    if (remoteState) {
      setData(remoteState);
    }
  };

  const activeDepartmentObj = useMemo(() => {
    return departments.find(d => d.slug === activeDepartment) || {
      slug: activeDepartment,
      name: activeDepartment === 'financeiro' ? 'Financeiro & Controladoria' : activeDepartment.toUpperCase(),
      badge_label: activeDepartment === 'financeiro' ? 'FINANCEIRO' : activeDepartment.toUpperCase(),
      color_hex: '#10b981',
      is_active: true
    };
  }, [departments, activeDepartment]);

  // Carregar apólices de seguro do banco para o Radar de Seguros
  useEffect(() => {
    fetchInsurancePolicies()
      .then(policies => {
        if (policies) setInsurancePolicies(policies);
      })
      .catch(err => {
        console.warn('[LousaOperacional] Não foi possível carregar seguros no radar:', err);
      });
  }, []);

  // Alertas de seguros formatados para o letreiro contínuo
  const insuranceAlerts = useMemo(() => {
    return insurancePolicies
      .filter(p => p.diasParaVencer !== undefined && p.diasParaVencer <= 30 && p.diasParaVencer >= -5)
      .map(p => ({
        id: p.id,
        contratante: p.contratante,
        tipo: p.tipo,
        seguradora: p.seguradora,
        diasParaVencer: p.diasParaVencer ?? 0,
      }));
  }, [insurancePolicies]);

  // ── APURAÇÃO DE DIAS E ATIVIDADES ATRASADAS ──
  const todayDay = new Date().getDate();

  const totalAtrasados = useMemo(() => {
    let count = 0;
    data.cronograma.forEach(blk => {
      blk.itens.forEach(it => {
        if (!it.concluido && it.dia < todayDay) count++;
      });
    });
    return count;
  }, [data, todayDay]);

  // Lista de responsáveis únicos presentes na lousa (estritamente vinculados ao setor ativo)
  const distinctResponsibles = useMemo(() => {
    const set = new Set<string>(departmentMembers);
    data.cronograma?.forEach(blk => blk.itens?.forEach(it => {
      extractResponsaveisList(it).forEach(r => set.add(r));
    }));
    data.colunas?.forEach(col => col.itens?.forEach(it => {
      extractResponsaveisList(it).forEach(r => set.add(r));
    }));
    data.gradeSemanal?.forEach(blk => blk.itens?.forEach(it => {
      extractResponsaveisList(it.responsaveis || it.responsavel).forEach(r => set.add(r));
    }));
    return Array.from(set).sort();
  }, [data, departmentMembers]);

  // Mapa de contadores por responsável para a legenda visual memorizável
  const responsibleCountsMap = useMemo(() => {
    const map: Record<string, { total: number; concluidos: number; pendentes: number; atrasados: number }> = {};

    const registerTask = (resp: string, concluido: boolean, isOverdue: boolean) => {
      const upper = resp.trim().toUpperCase();
      if (!upper) return;
      if (!map[upper]) {
        map[upper] = { total: 0, concluidos: 0, pendentes: 0, atrasados: 0 };
      }
      map[upper].total++;
      if (concluido) {
        map[upper].concluidos++;
      } else {
        map[upper].pendentes++;
        if (isOverdue) map[upper].atrasados++;
      }
    };

    data.cronograma.forEach(blk => {
      blk.itens.forEach(it => {
        const isOverdue = !it.concluido && it.dia < todayDay;
        extractResponsaveisList(it).forEach(r => registerTask(r, it.concluido, isOverdue));
      });
    });

    data.colunas.forEach(col => {
      col.itens.forEach(it => {
        if (!it.arquivado) {
          extractResponsaveisList(it).forEach(r => registerTask(r, it.concluido, false));
        }
      });
    });

    data.gradeSemanal?.forEach(blk => {
      blk.itens.forEach(it => {
        extractResponsaveisList(it.responsaveis || it.responsavel).forEach(r => registerTask(r, it.concluido, false));
      });
    });

    return map;
  }, [data, todayDay]);

  // ── TOP 5 ATIVIDADES ATIVAS POR MEMBRO (ORDEM CRONOLÓGICA DA ATRASADA A VENCER) ──
  const topMemberTaskGroups = useMemo(() => {
    return getTopTasksPerMember(data, 5);
  }, [data]);

  // ── DEMANDAS ARQUIVADAS E HISTÓRICO ──
  const archivedDemandsList = useMemo(() => {
    return WarRoomService.getArchivedDemandsList(data);
  }, [data]);

  const totalArchivedDemandsCount = archivedDemandsList.length;

  const archivedDemands = useMemo(() => {
    return WarRoomService.getAllArchivedDemands(data);
  }, [data]);

  const totalArchivedCount = archivedDemands.length;

  // ── CONTADOR DE ITENS CONCLUÍDOS (APENAS ATIVOS NA LOUSA) ──
  const { totalConcluidos, totalItens } = useMemo(() => {
    let concluidos = 0;
    let total = 0;

    data.colunas.forEach(col => {
      col.itens.forEach(it => {
        if (!it.arquivado) {
          total++;
          if (it.concluido) concluidos++;
        }
      });
    });

    data.cronograma.forEach(blk => {
      blk.itens.forEach(it => {
        total++;
        if (it.concluido) concluidos++;
      });
    });

    data.gradeSemanal?.forEach(blk => {
      blk.itens.forEach(it => {
        total++;
        if (it.concluido) concluidos++;
      });
    });

    return { totalConcluidos: concluidos, totalItens: total };
  }, [data]);

  // ── ATALHOS DE TECLADO (F ou T = MODO TV) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'f' || e.key === 'F' || e.key === 't' || e.key === 'T') {
        setIsTvMode(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsTvMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── AUTO-HIDE DO CURSOR EM MODO TV (3s sem movimento) ──
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleMouseMove = () => {
      setIsCursorHidden(false);
      clearTimeout(timeout);
      if (isTvMode) {
        timeout = setTimeout(() => {
          setIsCursorHidden(true);
        }, 3000);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, [isTvMode]);

  // ── FULLSCREEN TOGGLE NA API DO BROWSER ──
  const toggleTvMode = () => {
    if (!isTvMode) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setIsTvMode(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsTvMode(false);
      setIsCursorHidden(false);
    }
  };

  // ── HANDLERS DE DEMANDA INTEIRA (COLUNA DA LOUSA) ──
  const handleArchiveDemand = (columnId: string) => {
    const updated = WarRoomService.archiveDemand(data, columnId);
    setData(updated);
  };

  const handleRestoreDemand = (columnId: string) => {
    const updated = WarRoomService.restoreDemand(data, columnId);
    setData(updated);
  };

  const handleDeleteDemand = (columnId: string) => {
    const updated = WarRoomService.deleteDemand(data, columnId);
    setData(updated);
    setIsDemandColumnModalOpen(false);
    setEditingColumn(null);
  };

  const handleSaveDemand = (payload: {
    columnId?: string;
    titulo: string;
    subtitulo?: string;
    alertaDestaque?: string;
    dataLimite?: string;
    corMarcador: 'vermelho' | 'azul' | 'ciano' | 'esmeralda' | 'ambar';
  }) => {
    if (payload.columnId) {
      const updated = WarRoomService.updateDemand(data, payload.columnId, payload);
      setData(updated);
    } else {
      const updated = WarRoomService.addDemand(data, payload);
      setData(updated);
    }
    setIsDemandColumnModalOpen(false);
    setEditingColumn(null);
  };

  const handleOpenAddDemand = () => {
    setEditingColumn(null);
    setIsDemandColumnModalOpen(true);
  };

  const handleOpenEditDemand = (column: WhiteboardColumn) => {
    setEditingColumn(column);
    setIsDemandColumnModalOpen(true);
  };

  // ── HANDLERS DE TAREFAS DE COLUNA ──
  const handleToggleColumnItem = (colId: string, itemId: string) => {
    const col = data.colunas.find(c => c.id === colId);
    const item = col?.itens.find(i => i.id === itemId);
    const willBeCompleted = item ? !item.concluido : false;

    const updated = WarRoomService.toggleColumnItem(data, colId, itemId);
    setData(updated);

    if (willBeCompleted && item) {
      CollaborativePortalService.notifyGestorOnTaskCompleted({
        taskTitle: item.texto,
        origin: col ? `Coluna "${col.titulo.replace(':', '')}"` : 'Demandas Operacionais',
        responsaveis: extractResponsaveisList(item),
        activityId: itemId,
      }).catch(err => console.warn('Erro ao notificar gestor sobre conclusão:', err));
    }
  };

  const handleAddColumnItem = (colId: string, text: string, responsavel?: string, dataLimite?: string, responsaveis?: string[]) => {
    const updated = WarRoomService.addColumnItem(data, colId, text, responsavel, dataLimite, responsaveis);
    setData(updated);

    // DISPARO AUTOMÁTICO DE NOTIFICAÇÃO PARA OS RESPONSÁVEIS DESIGNADOS OU EQUIPE
    let targetResps = extractResponsaveisList({ responsavel, responsaveis });
    if (targetResps.length === 0) {
      targetResps = inferDefaultResponsaveis(text);
    }
    const colObj = data.colunas.find(c => c.id === colId);
    CollaborativePortalService.createAutomaticTaskNotification({
      taskTitle: text,
      origin: colObj ? `Coluna "${colObj.titulo}"` : 'Demandas Operacionais',
      responsaveis: targetResps.length > 0 ? targetResps : ['EQUIPE'],
      prazo: dataLimite,
      isUrgent: colObj?.corMarcador === 'vermelho' || Boolean(dataLimite && new Date(dataLimite) <= new Date()),
    }).catch(err => console.warn('Erro ao disparar notificação automática:', err));
  };

  const handleEditColumnItem = (colId: string, itemId: string, texto: string, responsavel?: string, dataLimite?: string, novosResponsaveis?: string[]) => {
    const updated = WarRoomService.updateColumnItem(data, colId, itemId, texto, responsavel, dataLimite, novosResponsaveis);
    setData(updated);

    // DISPARO AUTOMÁTICO DE NOTIFICAÇÃO AO ATUALIZAR DEMANDA
    let targetResps = extractResponsaveisList({ responsavel, responsaveis: novosResponsaveis });
    if (targetResps.length === 0) {
      targetResps = inferDefaultResponsaveis(texto);
    }
    const colObj = data.colunas.find(c => c.id === colId);
    CollaborativePortalService.createAutomaticTaskNotification({
      taskTitle: `[Atualização] ${texto}`,
      origin: colObj ? `Coluna "${colObj.titulo}"` : 'Demandas Operacionais',
      responsaveis: targetResps.length > 0 ? targetResps : ['EQUIPE'],
      prazo: dataLimite,
      activityId: itemId,
    }).catch(err => console.warn('Erro ao disparar notificação automática:', err));
  };

  const handleDeleteColumnItem = (colId: string, itemId: string) => {
    const updated = WarRoomService.deleteColumnItem(data, colId, itemId);
    setData(updated);
  };

  const handleArchiveColumnItem = (colId: string, itemId: string) => {
    const updated = WarRoomService.archiveColumnItem(data, colId, itemId);
    setData(updated);
  };

  const handleRestoreArchivedDemand = (colId: string, itemId: string) => {
    const updated = WarRoomService.restoreArchivedItem(data, colId, itemId);
    setData(updated);
  };

  const handleDeleteArchivedPermanent = (colId: string, itemId: string) => {
    const updated = WarRoomService.deleteColumnItem(data, colId, itemId);
    setData(updated);
  };

  const handleSaveFullDemand = (
    currentColId: string,
    itemId: string,
    updates: {
      texto: string;
      responsavel?: string;
      responsaveis?: string[];
      dataLimite?: string;
      destaque?: boolean;
      observacao?: string;
      prioridade?: 'normal' | 'alta' | 'urgente';
      novaColunaId?: string;
    }
  ) => {
    const updated = WarRoomService.updateFullDemand(data, currentColId, itemId, updates);
    setData(updated);
    setEditingDemand(null);

    // DISPARO AUTOMÁTICO DE NOTIFICAÇÃO SE FORAM ATRIBUÍDOS RESPONSÁVEIS OU EQUIPE
    let targetResps = extractResponsaveisList({ responsavel: updates.responsavel, responsaveis: updates.responsaveis });
    if (targetResps.length === 0) {
      targetResps = inferDefaultResponsaveis(updates.texto);
    }
    CollaborativePortalService.createAutomaticTaskNotification({
      taskTitle: updates.texto,
      origin: 'Demandas Operacionais (Atualizada)',
      responsaveis: targetResps.length > 0 ? targetResps : ['EQUIPE'],
      prazo: updates.dataLimite,
      isUrgent: updates.prioridade === 'urgente',
      activityId: itemId,
    }).catch(err => console.warn('Erro ao disparar notificação automática:', err));
  };

  const handleReorderColumnItem = (colId: string, startIndex: number, endIndex: number) => {
    const updated = WarRoomService.reorderColumnItems(data, colId, startIndex, endIndex);
    setData(updated);
  };

  const handleMoveColumnItem = (sourceColId: string, targetColId: string, itemId: string, targetIndex?: number) => {
    const updated = WarRoomService.moveColumnItem(data, sourceColId, targetColId, itemId, targetIndex);
    setData(updated);
  };

  // ── HANDLERS DE CÂMBIO ──
  const handleUpdateQuote = (novaCotacao: string) => {
    const updated = WarRoomService.updateQuote(data, novaCotacao);
    setData(updated);
  };

  const handleAddCambioRow = (row: Omit<FollowTheMoneyRow, 'id'>) => {
    const updated = WarRoomService.addFollowTheMoneyRow(data, row);
    setData(updated);
  };

  const handleUpdateCambioRow = (row: FollowTheMoneyRow) => {
    const updated = WarRoomService.updateFollowTheMoneyRow(data, row);
    setData(updated);
  };

  const handleDeleteCambioRow = (id: string) => {
    const updated = WarRoomService.deleteFollowTheMoneyRow(data, id);
    setData(updated);
  };

  // ── HANDLERS DE CRONOGRAMA ──
  const handleToggleTimelineItem = (blockId: string, itemId: string) => {
    const block = data.cronograma.find(b => b.id === blockId);
    const item = block?.itens.find(i => i.id === itemId);
    const willBeCompleted = item ? !item.concluido : false;

    const updated = WarRoomService.toggleTimelineItem(data, blockId, itemId);
    setData(updated);

    if (willBeCompleted && item) {
      CollaborativePortalService.notifyGestorOnTaskCompleted({
        taskTitle: item.descricao,
        origin: `Cronograma (Dia ${item.dia})`,
        responsaveis: extractResponsaveisList(item),
        activityId: itemId,
      }).catch(err => console.warn('Erro ao notificar gestor sobre conclusão:', err));
    }
  };

  const handleAddTimelineItem = (blockId: string, dia: number, descricao: string, responsavel?: string, responsaveis?: string[]) => {
    const updated = WarRoomService.addTimelineItem(data, blockId, dia, descricao, responsavel, responsaveis);
    setData(updated);

    // DISPARO AUTOMÁTICO DE NOTIFICAÇÃO PARA OS RESPONSÁVEIS DESIGNADOS OU EQUIPE
    let targetResps = extractResponsaveisList({ responsavel, responsaveis });
    if (targetResps.length === 0) {
      targetResps = inferDefaultResponsaveis(descricao);
    }
    const isUrgent = dia <= todayDay;
    CollaborativePortalService.createAutomaticTaskNotification({
      taskTitle: descricao,
      origin: `Cronograma de Vencimentos (Dia ${dia})`,
      responsaveis: targetResps.length > 0 ? targetResps : ['EQUIPE'],
      prazo: `Dia ${dia}`,
      isUrgent,
    }).catch(err => console.warn('Erro ao disparar notificação automática:', err));
  };

  const handleEditTimelineItem = (blockId: string, itemId: string, dia: number, descricao: string, responsavel?: string, novosResponsaveis?: string[]) => {
    const updated = WarRoomService.updateTimelineItem(data, blockId, itemId, dia, descricao, responsavel, novosResponsaveis);
    setData(updated);

    // DISPARO AUTOMÁTICO DE NOTIFICAÇÃO AO ATUALIZAR ITEM DE CRONOGRAMA
    let targetResps = extractResponsaveisList({ responsavel, responsaveis: novosResponsaveis });
    if (targetResps.length === 0) {
      targetResps = inferDefaultResponsaveis(descricao);
    }
    CollaborativePortalService.createAutomaticTaskNotification({
      taskTitle: `[Vencimento Dia ${dia}] ${descricao}`,
      origin: `Cronograma Atualizado`,
      responsaveis: targetResps.length > 0 ? targetResps : ['EQUIPE'],
      prazo: `Dia ${dia}`,
      activityId: itemId,
    }).catch(err => console.warn('Erro ao disparar notificação automática:', err));
  };

  const handleDeleteTimelineItem = (blockId: string, itemId: string) => {
    const updated = WarRoomService.deleteTimelineItem(data, blockId, itemId);
    setData(updated);
  };

  const handleReorderTimelineItem = (blockId: string, startIndex: number, endIndex: number) => {
    const updated = WarRoomService.reorderTimelineItems(data, blockId, startIndex, endIndex);
    setData(updated);
  };

  const handleMoveTimelineItem = (sourceBlockId: string, targetBlockId: string, itemId: string, targetIndex?: number) => {
    const updated = WarRoomService.moveTimelineItem(data, sourceBlockId, targetBlockId, itemId, targetIndex);
    setData(updated);
  };

  const handleResetCycle = () => {
    const updated = WarRoomService.resetMonthlyRecurringChecks(data);
    setData(updated);
  };

  // ── HANDLERS DA GRADE SEMANAL RECORRENTE (SEGUNDA A SEXTA) ──
  const handleToggleWeekdayItem = (diaSemana: WeekdayKey, itemId: string) => {
    const block = data.gradeSemanal?.find(b => b.diaSemana === diaSemana);
    const item = block?.itens.find(i => i.id === itemId);
    const willBeCompleted = item ? !item.concluido : false;

    const updated = WarRoomService.toggleWeekdayItem(data, diaSemana, itemId);
    setData(updated);

    if (willBeCompleted && item) {
      CollaborativePortalService.notifyGestorOnTaskCompleted({
        taskTitle: item.descricao,
        origin: `Grade Semanal (${block?.nome || diaSemana})`,
        responsaveis: extractResponsaveisList(item),
        activityId: itemId,
      }).catch(err => console.warn('Erro ao notificar gestor sobre conclusão:', err));
    }
  };

  const handleAddWeekdayItem = (diaSemana: WeekdayKey, descricao: string, responsavel?: string, responsaveis?: string[]) => {
    const updated = WarRoomService.addWeekdayItem(data, diaSemana, descricao, responsavel, responsaveis);
    setData(updated);

    let targetResps = extractResponsaveisList({ responsavel, responsaveis });
    if (targetResps.length === 0) {
      targetResps = inferDefaultResponsaveis(descricao);
    }
    CollaborativePortalService.createAutomaticTaskNotification({
      taskTitle: descricao,
      origin: `Grade Semanal Recorrente (${diaSemana.toUpperCase()})`,
      responsaveis: targetResps.length > 0 ? targetResps : ['EQUIPE'],
      prazo: `Toda ${diaSemana.toUpperCase()}`,
      isUrgent: false,
    }).catch(err => console.warn('Erro ao disparar notificação de rotina semanal:', err));
  };

  const handleEditWeekdayItem = (diaSemana: WeekdayKey, itemId: string, descricao: string, responsaveis: string[]) => {
    const updated = WarRoomService.editWeekdayItem(data, diaSemana, itemId, descricao, responsaveis);
    setData(updated);

    let targetResps = extractResponsaveisList(responsaveis);
    if (targetResps.length === 0) {
      targetResps = inferDefaultResponsaveis(descricao);
    }
    CollaborativePortalService.createAutomaticTaskNotification({
      taskTitle: `[Rotina ${diaSemana.toUpperCase()}] ${descricao}`,
      origin: `Rotina Semanal Atualizada`,
      responsaveis: targetResps.length > 0 ? targetResps : ['EQUIPE'],
      prazo: `Toda ${diaSemana.toUpperCase()}`,
      activityId: itemId,
    }).catch(err => console.warn('Erro ao disparar notificação de rotina semanal:', err));
  };

  const handleDeleteWeekdayItem = (diaSemana: WeekdayKey, itemId: string) => {
    const updated = WarRoomService.deleteWeekdayItem(data, diaSemana, itemId);
    setData(updated);
  };

  const handleResetWeekdayCycle = () => {
    const updated = WarRoomService.resetWeekdayCycle(data);
    setData(updated);
  };

  // ── HANDLERS DE GESTÃO DE MEMBROS (EDITAR / EXCLUIR / NOVO / RANKING) ──
  const handleOpenMemberModal = (memberName: string | null, tab: 'list' | 'ranking' | 'form' = 'list') => {
    setEditingMemberName(memberName);
    setMemberModalInitialTab(memberName ? 'form' : tab);
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = async (
    oldName: string | null,
    newName: string,
    selectedColorHex?: string,
    linkedEmployeeId?: string,
    departmentSlug?: string
  ) => {
    const targetDept = departmentSlug || activeDepartment;
    if (oldName && oldName.toUpperCase() !== newName.toUpperCase()) {
      const updated = WarRoomService.renameMember(data, oldName, newName);
      setData(updated);
      if (selectedResponsible?.toUpperCase() === oldName.toUpperCase()) {
        setSelectedResponsible(newName);
      }
    }

    // Salvar vínculo com departamento no Supabase
    await CollaborativePortalService.saveMemberLink(newName, targetDept, selectedColorHex, linkedEmployeeId);
    const members = await CollaborativePortalService.getDepartmentMembers(activeDepartment);
    setDepartmentMembers(members);

    setIsMemberModalOpen(false);
    setEditingMemberName(null);
  };

  const handleDeleteMember = async (memberName: string, reassignedTo?: string | null) => {
    const updated = WarRoomService.deleteMember(data, memberName, reassignedTo);
    setData(updated);
    if (selectedResponsible?.toUpperCase() === memberName.toUpperCase()) {
      setSelectedResponsible(reassignedTo ? reassignedTo.toUpperCase() : null);
    }
    // Remove do Supabase (whiteboard_member_links)
    await CollaborativePortalService.deleteMemberFromDatabase(memberName);
    const members = await CollaborativePortalService.getDepartmentMembers(activeDepartment);
    setDepartmentMembers(members);
    setIsMemberModalOpen(false);
    setEditingMemberName(null);
  };

  // ── RESTAURAR LOUSA ORIGINAL (DO DEPARTAMENTO ATIVO) ──
  const handleResetDefault = () => {
    if (window.confirm(`Deseja restaurar a lousa do setor ${activeDepartmentObj.name} para o estado original? Todas as alterações manuais serão resetadas.`)) {
      const reset = WarRoomService.resetToDefault(activeDepartment);
      setData(reset);
      setSelectedResponsible(null);
      setOnlyOverdueFilter(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans transition-all duration-300 ${
        isCursorHidden ? 'cursor-none select-none' : ''
      }`}
    >
      {/* ── CABEÇALHO DA LOUSA OPERACIONAL COM SELETOR DE SETOR ── */}
      <WhiteboardHeader
        isTvMode={isTvMode}
        onToggleTvMode={toggleTvMode}
        onResetDefault={handleResetDefault}
        onOpenAddModal={(tab = 'demanda') => {
          setModalTab(tab);
          setIsModalOpen(true);
        }}
        totalConcluidos={totalConcluidos}
        totalItens={totalItens}
        isResponsibleViewActive={isResponsibleBoardVisible}
        onToggleResponsibleView={() => setIsResponsibleBoardVisible(prev => !prev)}
        totalAtrasados={totalAtrasados}
        isZeroScrollMode={isZeroScrollMode}
        onToggleZeroScrollMode={() => setIsZeroScrollMode(prev => !prev)}
        departments={departments}
        activeDepartment={activeDepartment}
        onDepartmentChange={handleDepartmentChange}
      />

      {/* ── CORPO PRINCIPAL DA LOUSA (COM SUPORTE A ZERO-SCROLL PARA TV) ── */}
      <main className={`flex-1 w-full max-w-[1920px] mx-auto p-2 sm:p-3.5 space-y-2.5 sm:space-y-3 transition-all ${
        isZeroScrollMode ? 'lg:max-h-[calc(100vh-105px)] lg:overflow-y-auto no-scrollbar' : ''
      }`}>
        {/* RADAR DE SEGUROS CORPORATIVOS (SEMPRE EM DESTAQUE COM HORIZONTE PREVENTIVO) */}
        <WhiteboardInsuranceAlertBanner policies={insurancePolicies} />

        {/* ── BARRA EXECUTIVA DE FILTROS POR RESPONSÁVEL & ATRASOS ── */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center flex-wrap gap-1.5">
            {/* BADGE DO SETOR ATIVO */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-black shadow-sm mr-1">
              <Building2 size={12} className="text-emerald-400" />
              <span>SETOR: {activeDepartmentObj.badge_label || activeDepartment.toUpperCase()}</span>
            </div>

            <span className="text-[11px] font-black uppercase text-slate-400 font-mono flex items-center gap-1.5 mr-1">
              <Filter size={12} className="text-cyan-400" />
              Filtrar por Responsável:
            </span>

            {/* BOTÃO TODOS */}
            <button
              type="button"
              onClick={() => {
                setSelectedResponsible(null);
                setOnlyOverdueFilter(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedResponsible === null && !onlyOverdueFilter
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Todos ({totalItens})
            </button>

            {/* PÍLULA SÓ ATRASADAS COM PULSAR */}
            {totalAtrasados > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOnlyOverdueFilter(prev => !prev);
                  setSelectedResponsible(null);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  onlyOverdueFilter
                    ? 'bg-rose-600 text-white ring-2 ring-rose-400 shadow-md animate-pulse'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-500/50 hover:bg-rose-900/40'
                }`}
              >
                <AlertTriangle size={12} className="animate-pulse" />
                <span>🚨 Só Atrasadas ({totalAtrasados})</span>
              </button>
            )}

            {/* PÍLULAS DE CADA RESPONSÁVEL COM CORES INDIVIDUAIS MEMORIZÁVEIS E AÇÃO DE GESTÃO */}
            {distinctResponsibles.map(resp => {
              const isSelected = selectedResponsible?.toUpperCase() === resp.toUpperCase();
              const respColor = getResponsibleColor(resp);
              const stats = responsibleCountsMap[resp.toUpperCase()];
              const hasOverdue = stats ? stats.atrasados > 0 : false;

              return (
                <div
                  key={resp}
                  className="inline-flex items-center rounded-lg shadow-sm border border-transparent hover:border-slate-700/60 transition-all"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOnlyOverdueFilter(false);
                      setSelectedResponsible(isSelected ? null : resp);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase transition-all rounded-l-lg ${
                      isSelected
                        ? `${respColor.pillActiveClass} ring-1 ring-white/50`
                        : `${respColor.pillInactiveClass} hover:opacity-100`
                    }`}
                    title={`${resp} (${respColor.label}): ${stats?.pendentes || 0} pendentes. Clique para filtrar.`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${hasOverdue ? 'animate-ping' : ''}`}
                      style={{ backgroundColor: respColor.hex }}
                    />
                    <span>{resp}</span>
                    {stats && stats.pendentes > 0 && (
                      <span className="text-[10px] opacity-80 font-mono">
                        ({stats.pendentes})
                      </span>
                    )}
                  </button>

                  {/* BOTÃO RÁPIDO PARA EDITAR OU EXCLUIR ESTE MEMBRO ESPECÍFICO */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenMemberModal(resp);
                    }}
                    className={`px-1.5 py-1 text-xs transition-all border-l border-slate-700/60 rounded-r-lg ${
                      isSelected
                        ? `${respColor.pillActiveClass} opacity-90 hover:opacity-100`
                        : `${respColor.pillInactiveClass} opacity-60 hover:opacity-100 hover:bg-slate-800`
                    }`}
                    title={`Gerenciar, editar ou excluir ${resp}`}
                  >
                    <Edit3 size={11} className="text-slate-300 hover:text-cyan-300" />
                  </button>
                </div>
              );
            })}

            {/* BOTÃO PROEMINENTE: GESTÃO DE MEMBROS (VER TODOS, EDITAR, EXCLUIR) */}
            <button
              type="button"
              onClick={() => handleOpenMemberModal(null, 'list')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-mono text-cyan-300 hover:text-white bg-cyan-950/50 hover:bg-cyan-900/70 border border-cyan-500/50 transition-all shadow-sm min-h-[34px]"
              title="Abrir painel completo de gestão de membros (excluir, editar ou renomear)"
            >
              <Users size={12} className="text-cyan-400" />
              <span>👥 Gestão de Membros</span>
            </button>

            {/* BOTÃO EXECUTIVO: RANKING DE PRODUTIVIDADE DA EQUIPE */}
            <button
              type="button"
              onClick={() => handleOpenMemberModal(null, 'ranking')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-mono text-amber-300 hover:text-white bg-amber-950/50 hover:bg-amber-900/70 border border-amber-500/50 transition-all shadow-sm min-h-[34px]"
              title="Visualizar Ranking Executivo de Produtividade e Entregas Concluídas por Membro"
            >
              <Trophy size={12} className="text-amber-400" />
              <span>🏆 Produtividade</span>
            </button>

            {/* ATALHO RÁPIDO PARA ADICIONAR NOVO MEMBRO */}
            <button
              type="button"
              onClick={() => {
                setEditingMemberName(null);
                setMemberModalInitialTab('form');
                setIsMemberModalOpen(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 border border-dashed border-slate-700 hover:border-cyan-500/50 transition-all shadow-sm min-h-[34px]"
              title="Cadastrar um novo membro na lousa"
            >
              <Plus size={11} className="text-cyan-400" />
              <span>+ Membro</span>
            </button>
          </div>

          {/* AÇÕES DA BARRA DE FILTROS: ZERO-SCROLL TV, HISTÓRICO E QUADRO DE RESPONSÁVEIS */}
          <div className="flex items-center gap-2">
            {/* TOGGLE RÁPIDO DO ZERO SCROLL */}
            <button
              type="button"
              onClick={() => setIsZeroScrollMode(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all border ${
                isZeroScrollMode
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-sm ring-1 ring-cyan-400/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="Ajusta o layout para caber perfeitamente na TV sem rolagem"
            >
              <Tv size={12} className={isZeroScrollMode ? 'text-cyan-400 animate-pulse' : 'text-slate-400'} />
              <span>{isZeroScrollMode ? '📺 TV Fit: ON' : '📺 TV Fit: OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsArchivedModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all border ${
                totalArchivedCount > 0
                  ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60 hover:text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
              title="Consultar histórico de demandas finalizadas e arquivadas"
            >
              <Archive size={12} className={totalArchivedCount > 0 ? 'text-emerald-400' : 'text-slate-400'} />
              <span>🗄️ Histórico ({totalArchivedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsResponsibleBoardVisible(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                isResponsibleBoardVisible
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-cyan-500/40 hover:text-white'
              }`}
            >
              <Users size={12} className="text-cyan-400" />
              <span>{isResponsibleBoardVisible ? 'Ocultar Quadro' : 'Quadro por Responsáveis'}</span>
            </button>

            {/* BOTÃO DA CENTRAL DE NOTIFICAÇÕES & OFERTAS DE AJUDA */}
            <button
              type="button"
              onClick={() => setIsAdminNotificationsModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                pendingHelpOffersCount > 0
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/60 shadow-md shadow-emerald-950/50 animate-pulse'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-cyan-500/40 hover:text-white'
              }`}
              title="Central de Notificações, Disparos e Gestão de Ofertas de Ajuda"
            >
              <Bell size={12} className={pendingHelpOffersCount > 0 ? 'text-emerald-400' : 'text-slate-400'} />
              <span>🔔 Central Notificações</span>
              {pendingHelpOffersCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 font-black">
                  🤝 {pendingHelpOffersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── QUADRO OPERACIONAL POR RESPONSÁVEIS (EXPANSÍVEL / DEDICADO) ── */}
        {isResponsibleBoardVisible && (
          <WhiteboardResponsibleBoard
            colunas={data.colunas}
            cronograma={data.cronograma}
            onToggleColumnItem={handleToggleColumnItem}
            onToggleTimelineItem={handleToggleTimelineItem}
            onSelectResponsible={(resp) => setSelectedResponsible(resp)}
            selectedResponsible={selectedResponsible}
            onClose={() => setIsResponsibleBoardVisible(false)}
            onOpenMemberModal={handleOpenMemberModal}
          />
        )}

        {/* SEÇÃO 1: AS COLUNAS DA LOUSA (DEMANDAS EM FOCO DO SETOR ATIVO) */}
        <WhiteboardColumns
          colunas={data.colunas}
          filterResponsible={selectedResponsible}
          layoutMode={demandLayoutMode}
          onLayoutModeChange={(mode) => setDemandLayoutMode(mode)}
          departmentLabel={activeDepartmentObj.name || activeDepartmentObj.badge_label}
          availableMembers={departmentMembers}
          onHoverDemand={(colId, colTitulo, corMarcador, itens) => {
            if (!colId) {
              setHoveredDemand(null);
            } else {
              setHoveredDemand({ colId, titulo: colTitulo || '', corMarcador, itens: itens || [] });
            }
          }}
          onToggleItem={handleToggleColumnItem}
          onAddItem={handleAddColumnItem}
          onEditItem={handleEditColumnItem}
          onOpenFullEdit={(colId, item) => setEditingDemand({ colId, item })}
          onArchiveItem={handleArchiveColumnItem}
          onDeleteItem={handleDeleteColumnItem}
          onReorderItem={handleReorderColumnItem}
          onMoveItemBetweenColumns={handleMoveColumnItem}
          onArchiveDemand={handleArchiveDemand}
          onEditDemand={handleOpenEditDemand}
          onDeleteDemand={handleDeleteDemand}
          onAddDemand={handleOpenAddDemand}
          onOpenArchivedModal={() => setIsArchivedModalOpen(true)}
          totalArchivedCount={totalArchivedCount}
          totalArchivedDemandsCount={totalArchivedDemandsCount}
        />

        {/* SEÇÃO 2: FOLLOW THE MONEY (ESTEIRA CAMBIAL & COTAÇÃO COM SUPORTE A FITA COMPACTA) */}
        <WhiteboardFollowTheMoney
          followTheMoney={data.followTheMoney}
          isTvMode={isTvMode || isZeroScrollMode}
          onUpdateQuote={handleUpdateQuote}
          onAddRow={handleAddCambioRow}
          onUpdateRow={handleUpdateCambioRow}
          onDeleteRow={handleDeleteCambioRow}
        />

        {/* SEÇÃO 3: CRONOGRAMA DE VENCIMENTOS DO MÊS EM LINHAS OU GRADE COM PROJEÇÃO SINCRONIZADA */}
        <WhiteboardTimeline
          cronograma={data.cronograma}
          gradeSemanal={data.gradeSemanal}
          mesReferencia={data.mesReferencia}
          filterResponsible={selectedResponsible}
          onlyOverdue={onlyOverdueFilter}
          layoutMode={timelineLayoutMode}
          onLayoutModeChange={(mode) => setTimelineLayoutMode(mode)}
          availableMembers={departmentMembers}
          hoveredDemand={hoveredDemand}
          newsTickerSlot={
            <WhiteboardNewsTicker
              memberTaskGroups={topMemberTaskGroups}
              onToggleItem={(origem, origemId, itemId) => {
                if (origem === 'cronograma') {
                  handleToggleTimelineItem(origemId, itemId);
                } else if (origem === 'semanal') {
                  handleToggleWeekdayItem(origemId as WeekdayKey, itemId);
                } else {
                  handleToggleColumnItem(origemId, itemId);
                }
              }}
              onSelectMember={(nome) => {
                setOnlyOverdueFilter(false);
                setSelectedResponsible(nome);
              }}
              selectedMember={selectedResponsible}
              cotacaoUsdGs={data.followTheMoney.cotacaoUsdGs}
            />
          }
          onToggleDemandItem={(colId, itemId) => handleToggleColumnItem(colId, itemId)}
          onToggleItem={handleToggleTimelineItem}
          onAddItem={handleAddTimelineItem}
          onEditItem={handleEditTimelineItem}
          onDeleteItem={handleDeleteTimelineItem}
          onReorderItem={handleReorderTimelineItem}
          onMoveItemBetweenBlocks={handleMoveTimelineItem}
          onResetCycle={handleResetCycle}
          onToggleWeekdayItem={handleToggleWeekdayItem}
          onAddWeekdayItem={handleAddWeekdayItem}
          onEditWeekdayItem={handleEditWeekdayItem}
          onDeleteWeekdayItem={handleDeleteWeekdayItem}
          onResetWeekdayCycle={handleResetWeekdayCycle}
        />
      </main>

      {/* ── MODAL DE GESTÃO RÁPIDA ── */}
      <WhiteboardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultTab={modalTab}
        colunas={data.colunas}
        cronograma={data.cronograma}
        availableMembers={departmentMembers}
        onAddDemanda={handleAddColumnItem}
        onAddCambio={handleAddCambioRow}
        onAddCronograma={handleAddTimelineItem}
      />

      {/* ── MODAL DE EDIÇÃO COMPLETA DE TAREFA ── */}
      <WhiteboardEditDemandModal
        isOpen={!!editingDemand}
        onClose={() => setEditingDemand(null)}
        columnId={editingDemand?.colId || ''}
        item={editingDemand?.item || null}
        colunas={data.colunas}
        availableMembers={departmentMembers}
        onSave={handleSaveFullDemand}
        onDelete={(colId, itemId) => {
          handleDeleteColumnItem(colId, itemId);
          setEditingDemand(null);
        }}
        onArchive={(colId, itemId) => {
          handleArchiveColumnItem(colId, itemId);
          setEditingDemand(null);
        }}
      />

      {/* ── MODAL DE GESTÃO DE DEMANDA INTEIRA (COLUNA DA LOUSA) ── */}
      <WhiteboardDemandColumnModal
        isOpen={isDemandColumnModalOpen}
        onClose={() => {
          setIsDemandColumnModalOpen(false);
          setEditingColumn(null);
        }}
        column={editingColumn}
        onSave={handleSaveDemand}
        onArchive={handleArchiveDemand}
        onDelete={handleDeleteDemand}
      />

      {/* ── MODAL DE HISTÓRICO DE DEMANDAS ARQUIVADAS E TAREFAS ── */}
      <WhiteboardArchivedModal
        isOpen={isArchivedModalOpen}
        onClose={() => setIsArchivedModalOpen(false)}
        archivedDemands={archivedDemandsList}
        onRestoreDemand={handleRestoreDemand}
        onDeleteDemand={handleDeleteDemand}
        onEditDemand={(col) => {
          setIsArchivedModalOpen(false);
          handleOpenEditDemand(col);
        }}
        archivedItems={archivedDemands}
        onRestore={handleRestoreArchivedDemand}
        onDeletePermanent={handleDeleteArchivedPermanent}
      />

      {/* ── MODAL DE GESTÃO DE MEMBROS (EDITAR / EXCLUIR / NOVO / RANKING) ── */}
      <WhiteboardMemberModal
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setEditingMemberName(null);
          setMemberModalInitialTab('list');
        }}
        memberName={editingMemberName}
        allMembers={distinctResponsibles}
        totalTasksCount={editingMemberName ? responsibleCountsMap[editingMemberName.toUpperCase()]?.total || 0 : 0}
        initialTab={memberModalInitialTab}
        responsibleCountsMap={responsibleCountsMap}
        activeDepartment={activeDepartment}
        departments={departments}
        onSaveMember={handleSaveMember}
        onDeleteMember={handleDeleteMember}
      />

      {/* ── MODAL ADMINISTRATIVO DE NOTIFICAÇÕES & OFERTAS DE AJUDA ── */}
      <WhiteboardAdminNotificationsModal
        isOpen={isAdminNotificationsModalOpen}
        onClose={() => setIsAdminNotificationsModalOpen(false)}
        allMembers={distinctResponsibles}
        pendingHelpOffersCount={pendingHelpOffersCount}
        onOfferDecided={refreshHelpOffers}
      />
    </div>
  );
}

