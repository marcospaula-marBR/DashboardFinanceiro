"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WarRoomService, DEFAULT_WHITEBOARD_DATA, extractResponsaveisList, getResponsibleColor, getTopTasksPerMember } from '@/services/war-room.service';
import { WhiteboardDataState, FollowTheMoneyRow, WhiteboardItem, WhiteboardColumn } from '@/types/war-room';
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
import { Users, Filter, AlertTriangle, User, CheckCircle2, Archive, Tv, Zap, Palette } from 'lucide-react';

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

  // Ao ativar o Modo TV, ajusta automaticamente as demandas em títulos e cronograma em linhas
  useEffect(() => {
    if (isTvMode) {
      setIsZeroScrollMode(true);
      setDemandLayoutMode('compact');
      setTimelineLayoutMode('rows');
    }
  }, [isTvMode]);

  // Carregar dados salvos no localStorage (com detecção automática de virada de mês e hidratação)
  useEffect(() => {
    const loaded = WarRoomService.getWhiteboardData();
    setData(loaded);
  }, []);

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

  // Lista de responsáveis únicos presentes na lousa (suporte a múltiplos por atividade)
  const distinctResponsibles = useMemo(() => {
    const set = new Set<string>();
    data.cronograma.forEach(blk => blk.itens.forEach(it => {
      extractResponsaveisList(it).forEach(r => set.add(r));
    }));
    data.colunas.forEach(col => col.itens.forEach(it => {
      extractResponsaveisList(it).forEach(r => set.add(r));
    }));
    return Array.from(set).sort();
  }, [data]);

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
    const updated = WarRoomService.toggleColumnItem(data, colId, itemId);
    setData(updated);
  };

  const handleAddColumnItem = (colId: string, text: string, responsavel?: string, dataLimite?: string, responsaveis?: string[]) => {
    const updated = WarRoomService.addColumnItem(data, colId, text, responsavel, dataLimite, responsaveis);
    setData(updated);
  };

  const handleEditColumnItem = (colId: string, itemId: string, texto: string, responsavel?: string, dataLimite?: string, novosResponsaveis?: string[]) => {
    const updated = WarRoomService.updateColumnItem(data, colId, itemId, texto, responsavel, dataLimite, novosResponsaveis);
    setData(updated);
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
    const updated = WarRoomService.toggleTimelineItem(data, blockId, itemId);
    setData(updated);
  };

  const handleAddTimelineItem = (blockId: string, dia: number, descricao: string, responsavel?: string, responsaveis?: string[]) => {
    const updated = WarRoomService.addTimelineItem(data, blockId, dia, descricao, responsavel, responsaveis);
    setData(updated);
  };

  const handleEditTimelineItem = (blockId: string, itemId: string, dia: number, descricao: string, responsavel?: string, novosResponsaveis?: string[]) => {
    const updated = WarRoomService.updateTimelineItem(data, blockId, itemId, dia, descricao, responsavel, novosResponsaveis);
    setData(updated);
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

  // ── RESTAURAR LOUSA ORIGINAL (DA FOTO) ──
  const handleResetDefault = () => {
    if (window.confirm('Deseja restaurar a lousa para o estado original fotografado? Todas as alterações manuais serão resetadas.')) {
      const reset = WarRoomService.resetToDefault();
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
      {/* ── CABEÇALHO DA LOUSA OPERACIONAL ── */}
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
      />

      {/* ── CORPO PRINCIPAL DA LOUSA (COM SUPORTE A ZERO-SCROLL PARA TV) ── */}
      <main className={`flex-1 w-full max-w-[1920px] mx-auto p-2 sm:p-3.5 space-y-2.5 sm:space-y-3 transition-all ${
        isZeroScrollMode ? 'lg:max-h-[calc(100vh-105px)] lg:overflow-y-auto no-scrollbar' : ''
      }`}>
        {/* ── SUPER-RADAR SUPERIOR: CADA USUÁRIO E SUAS 5 ATIVIDADES (DA ATRASADA A VENCER) ── */}
        <WhiteboardNewsTicker
          memberTaskGroups={topMemberTaskGroups}
          onToggleItem={(origem, origemId, itemId) => {
            if (origem === 'cronograma') {
              handleToggleTimelineItem(origemId, itemId);
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

        {/* RADAR DE SEGUROS CORPORATIVOS (SEMPRE EM DESTAQUE COM HORIZONTE PREVENTIVO) */}
        <WhiteboardInsuranceAlertBanner policies={insurancePolicies} />

        {/* ── BARRA EXECUTIVA DE FILTROS POR RESPONSÁVEL & ATRASOS ── */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center flex-wrap gap-1.5">
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

            {/* PÍLULAS DE CADA RESPONSÁVEL COM CORES INDIVIDUAIS MEMORIZÁVEIS */}
            {distinctResponsibles.map(resp => {
              const isSelected = selectedResponsible?.toUpperCase() === resp.toUpperCase();
              const respColor = getResponsibleColor(resp);
              const stats = responsibleCountsMap[resp.toUpperCase()];
              const hasOverdue = stats ? stats.atrasados > 0 : false;

              return (
                <button
                  key={resp}
                  type="button"
                  onClick={() => {
                    setOnlyOverdueFilter(false);
                    setSelectedResponsible(isSelected ? null : resp);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all shadow-sm ${
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
              );
            })}
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
          />
        )}

        {/* SEÇÃO 1: AS COLUNAS OPERACIONAIS DA LOUSA COM MODO SÓ TÍTULOS (HOVER) E LINHAS */}
        <WhiteboardColumns
          colunas={data.colunas}
          filterResponsible={selectedResponsible}
          layoutMode={demandLayoutMode}
          onLayoutModeChange={(mode) => setDemandLayoutMode(mode)}
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
          mesReferencia={data.mesReferencia}
          filterResponsible={selectedResponsible}
          onlyOverdue={onlyOverdueFilter}
          layoutMode={timelineLayoutMode}
          onLayoutModeChange={(mode) => setTimelineLayoutMode(mode)}
          hoveredDemand={hoveredDemand}
          onToggleDemandItem={(colId, itemId) => handleToggleColumnItem(colId, itemId)}
          onToggleItem={handleToggleTimelineItem}
          onAddItem={handleAddTimelineItem}
          onEditItem={handleEditTimelineItem}
          onDeleteItem={handleDeleteTimelineItem}
          onReorderItem={handleReorderTimelineItem}
          onMoveItemBetweenBlocks={handleMoveTimelineItem}
          onResetCycle={handleResetCycle}
        />
      </main>

      {/* ── MODAL DE GESTÃO RÁPIDA ── */}
      <WhiteboardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultTab={modalTab}
        colunas={data.colunas}
        cronograma={data.cronograma}
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
    </div>
  );
}

