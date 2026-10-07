"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WarRoomService, DEFAULT_WHITEBOARD_DATA } from '@/services/war-room.service';
import { WhiteboardDataState, FollowTheMoneyRow } from '@/types/war-room';

import { WhiteboardHeader } from '@/components/war-room/WhiteboardHeader';
import { WhiteboardColumns } from '@/components/war-room/WhiteboardColumns';
import { WhiteboardFollowTheMoney } from '@/components/war-room/WhiteboardFollowTheMoney';
import { WhiteboardTimeline } from '@/components/war-room/WhiteboardTimeline';
import { WhiteboardNewsTicker } from '@/components/war-room/WhiteboardNewsTicker';
import { WhiteboardModal } from '@/components/war-room/WhiteboardModal';

export default function LousaOperacionalPage() {
  const [data, setData] = useState<WhiteboardDataState>(DEFAULT_WHITEBOARD_DATA);
  const [isTvMode, setIsTvMode] = useState<boolean>(false);
  const [isCursorHidden, setIsCursorHidden] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'demanda' | 'cambio' | 'cronograma'>('demanda');

  // Carregar dados salvos no localStorage
  useEffect(() => {
    const loaded = WarRoomService.getWhiteboardData();
    setData(loaded);
  }, []);

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

  const handleAddColumnItem = (colId: string, text: string) => {
    const updated = WarRoomService.addColumnItem(data, colId, text);
    setData(updated);
  };

  const handleDeleteColumnItem = (colId: string, itemId: string) => {
    const updated = WarRoomService.deleteColumnItem(data, colId, itemId);
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

  const handleDeleteCambioRow = (id: string) => {
    const updated = WarRoomService.deleteFollowTheMoneyRow(data, id);
    setData(updated);
  };

  // ── HANDLERS DE CRONOGRAMA ──
  const handleToggleTimelineItem = (blockId: string, itemId: string) => {
    const updated = WarRoomService.toggleTimelineItem(data, blockId, itemId);
    setData(updated);
  };

  const handleAddTimelineItem = (blockId: string, dia: number, descricao: string) => {
    const updated = WarRoomService.addTimelineItem(data, blockId, dia, descricao);
    setData(updated);
  };

  const handleDeleteTimelineItem = (blockId: string, itemId: string) => {
    const updated = WarRoomService.deleteTimelineItem(data, blockId, itemId);
    setData(updated);
  };

  // ── RESTAURAR LOUSA ORIGINAL (DA FOTO) ──
  const handleResetDefault = () => {
    if (window.confirm('Deseja restaurar a lousa para o estado original fotografado? Todas as alterações manuais serão resetadas.')) {
      const reset = WarRoomService.resetToDefault();
      setData(reset);
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
      />

      {/* ── CORPO PRINCIPAL DA LOUSA (3 GRANDES SEÇÕES DA FOTO) ── */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto p-3 sm:p-5 space-y-4">
        {/* SEÇÃO 1: AS 5 COLUNAS OPERACIONAIS DA LOUSA */}
        <WhiteboardColumns
          colunas={data.colunas}
          onToggleItem={handleToggleColumnItem}
          onAddItem={handleAddColumnItem}
          onDeleteItem={handleDeleteColumnItem}
        />

        {/* SEÇÃO 2: FOLLOW THE MONEY (ESTEIRA CAMBIAL & COTAÇÃO) */}
        <WhiteboardFollowTheMoney
          followTheMoney={data.followTheMoney}
          onUpdateQuote={handleUpdateQuote}
          onAddRow={handleAddCambioRow}
          onDeleteRow={handleDeleteCambioRow}
        />

        {/* SEÇÃO 3: CRONOGRAMA DE VENCIMENTOS (6 BLOCOS DA LOUSA) */}
        <WhiteboardTimeline
          cronograma={data.cronograma}
          onToggleItem={handleToggleTimelineItem}
          onAddItem={handleAddTimelineItem}
          onDeleteItem={handleDeleteTimelineItem}
        />
      </main>

      {/* ── LETREIRO NOTICIOSO / TICKER CONTÍNUO NO RODAPÉ ── */}
      <WhiteboardNewsTicker cotacaoUsdGs={data.followTheMoney.cotacaoUsdGs} />

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
