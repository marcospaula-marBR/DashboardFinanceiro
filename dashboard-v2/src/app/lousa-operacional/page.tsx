"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WarRoomService, DEFAULT_WHITEBOARD_DATA } from '@/services/war-room.service';
import { WhiteboardDataState, FollowTheMoneyRow } from '@/types/war-room';
import { fetchInsurancePolicies } from '@/services/insurance.service';
import { InsurancePolicy } from '@/types/insurance';

import { WhiteboardHeader } from '@/components/war-room/WhiteboardHeader';
import { WhiteboardColumns } from '@/components/war-room/WhiteboardColumns';
import { WhiteboardFollowTheMoney } from '@/components/war-room/WhiteboardFollowTheMoney';
import { WhiteboardTimeline } from '@/components/war-room/WhiteboardTimeline';
import { WhiteboardNewsTicker } from '@/components/war-room/WhiteboardNewsTicker';
import { WhiteboardModal } from '@/components/war-room/WhiteboardModal';
import { WhiteboardInsuranceAlertBanner } from '@/components/war-room/WhiteboardInsuranceAlertBanner';
import { WhiteboardResponsibleBoard } from '@/components/war-room/WhiteboardResponsibleBoard';
import { Users, Filter, AlertTriangle, User, CheckCircle2 } from 'lucide-react';

export default function LousaOperacionalPage() {
  const [data, setData] = useState<WhiteboardDataState>(DEFAULT_WHITEBOARD_DATA);
  const [insurancePolicies, setInsurancePolicies] = useState<InsurancePolicy[]>([]);
  const [isTvMode, setIsTvMode] = useState<boolean>(false);
  const [isCursorHidden, setIsCursorHidden] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'demanda' | 'cambio' | 'cronograma'>('demanda');

  // Estados de visão e filtro por responsáveis
  const [isResponsibleBoardVisible, setIsResponsibleBoardVisible] = useState<boolean>(false);
  const [selectedResponsible, setSelectedResponsible] = useState<string | null>(null);
  const [onlyOverdueFilter, setOnlyOverdueFilter] = useState<boolean>(false);

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

  // Lista de responsáveis únicos presentes na lousa
  const distinctResponsibles = useMemo(() => {
    const set = new Set<string>();
    data.cronograma.forEach(blk => blk.itens.forEach(it => {
      if (it.responsavel?.trim()) set.add(it.responsavel.trim().toUpperCase());
    }));
    data.colunas.forEach(col => col.itens.forEach(it => {
      if (it.responsavel?.trim()) set.add(it.responsavel.trim().toUpperCase());
    }));
    return Array.from(set).sort();
  }, [data]);

  // ── CONTADOR DE ITENS CONCLUÍDOS ──
  const { totalConcluidos, totalItens } = useMemo(() => {
    let concluidos = 0;
    let total = 0;

    data.colunas.forEach(col => {
      col.itens.forEach(it => {
        total++;
        if (it.concluido) concluidos++;
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

  // ── HANDLERS DE COLUNA ──
  const handleToggleColumnItem = (colId: string, itemId: string) => {
    const updated = WarRoomService.toggleColumnItem(data, colId, itemId);
    setData(updated);
  };

  const handleAddColumnItem = (colId: string, text: string, responsavel?: string) => {
    const updated = WarRoomService.addColumnItem(data, colId, text, responsavel);
    setData(updated);
  };

  const handleEditColumnItem = (colId: string, itemId: string, texto: string, responsavel?: string) => {
    const updated = WarRoomService.updateColumnItem(data, colId, itemId, texto, responsavel);
    setData(updated);
  };

  const handleDeleteColumnItem = (colId: string, itemId: string) => {
    const updated = WarRoomService.deleteColumnItem(data, colId, itemId);
    setData(updated);
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

  const handleAddTimelineItem = (blockId: string, dia: number, descricao: string, responsavel?: string) => {
    const updated = WarRoomService.addTimelineItem(data, blockId, dia, descricao, responsavel);
    setData(updated);
  };

  const handleEditTimelineItem = (blockId: string, itemId: string, dia: number, descricao: string, responsavel?: string) => {
    const updated = WarRoomService.updateTimelineItem(data, blockId, itemId, dia, descricao, responsavel);
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
      />

      {/* ── CORPO PRINCIPAL DA LOUSA ── */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto p-3 sm:p-5 space-y-4">
        {/* RADAR DE SEGUROS CORPORATIVOS (SEMPRE EM DESTAQUE COM HORIZONTE PREVENTIVO) */}
        <WhiteboardInsuranceAlertBanner policies={insurancePolicies} />

        {/* ── BARRA EXECUTIVA DE FILTROS POR RESPONSÁVEL & ATRASOS ── */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
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

            {/* PÍLULAS DE CADA RESPONSÁVEL */}
            {distinctResponsibles.map(resp => {
              const isSelected = selectedResponsible?.toUpperCase() === resp.toUpperCase();
              return (
                <button
                  key={resp}
                  type="button"
                  onClick={() => {
                    setOnlyOverdueFilter(false);
                    setSelectedResponsible(isSelected ? null : resp);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                    isSelected
                      ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <User size={11} className={isSelected ? 'text-white' : 'text-cyan-400'} />
                  <span>{resp}</span>
                </button>
              );
            })}
          </div>

          {/* BOTÃO PARA ALTERNAR EXIBIÇÃO DO QUADRO DE RESPONSÁVEIS */}
          <button
            type="button"
            onClick={() => setIsResponsibleBoardVisible(prev => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
              isResponsibleBoardVisible
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-cyan-500/40 hover:text-white'
            }`}
          >
            <Users size={13} className="text-cyan-400" />
            <span>{isResponsibleBoardVisible ? 'Ocultar Quadro de Responsáveis' : 'Ver Quadro por Responsáveis'}</span>
          </button>
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

        {/* SEÇÃO 1: AS 5 COLUNAS OPERACIONAIS DA LOUSA COM DRAG & DROP E RESPONSÁVEIS */}
        <WhiteboardColumns
          colunas={data.colunas}
          filterResponsible={selectedResponsible}
          onToggleItem={handleToggleColumnItem}
          onAddItem={handleAddColumnItem}
          onEditItem={handleEditColumnItem}
          onDeleteItem={handleDeleteColumnItem}
          onReorderItem={handleReorderColumnItem}
          onMoveItemBetweenColumns={handleMoveColumnItem}
        />

        {/* SEÇÃO 2: FOLLOW THE MONEY (ESTEIRA CAMBIAL & COTAÇÃO) */}
        <WhiteboardFollowTheMoney
          followTheMoney={data.followTheMoney}
          onUpdateQuote={handleUpdateQuote}
          onAddRow={handleAddCambioRow}
          onUpdateRow={handleUpdateCambioRow}
          onDeleteRow={handleDeleteCambioRow}
        />

        {/* SEÇÃO 3: CRONOGRAMA DE VENCIMENTOS COM DRAG & DROP, RESPONSÁVEIS E ALERTA DE ATRASOS */}
        <WhiteboardTimeline
          cronograma={data.cronograma}
          mesReferencia={data.mesReferencia}
          filterResponsible={selectedResponsible}
          onlyOverdue={onlyOverdueFilter}
          onToggleItem={handleToggleTimelineItem}
          onAddItem={handleAddTimelineItem}
          onEditItem={handleEditTimelineItem}
          onDeleteItem={handleDeleteTimelineItem}
          onReorderItem={handleReorderTimelineItem}
          onMoveItemBetweenBlocks={handleMoveTimelineItem}
          onResetCycle={handleResetCycle}
        />
      </main>

      {/* ── LETREIRO NOTICIOSO / TICKER CONTÍNUO NO RODAPÉ (COM PAUSA NO HOVER E SEGUROS D<30) ── */}
      <WhiteboardNewsTicker
        cotacaoUsdGs={data.followTheMoney.cotacaoUsdGs}
        insuranceAlerts={insuranceAlerts}
      />

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
    </div>
  );
}

