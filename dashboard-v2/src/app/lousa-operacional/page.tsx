"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WarRoomService } from '@/services/war-room.service';
import { 
  WarRoomObligation, 
  StrategicPillar, 
  FollowTheMoneyFlow, 
  InsuranceExpiringAlert, 
  WarRoomSummaryCounters 
} from '@/types/war-room';

import { WarRoomHeader } from '@/components/war-room/WarRoomHeader';
import { WarRoomTodayBillsCard } from '@/components/war-room/WarRoomTodayBillsCard';
import { WarRoomTimeline } from '@/components/war-room/WarRoomTimeline';
import { WarRoomStrategicPillars } from '@/components/war-room/WarRoomStrategicPillars';
import { WarRoomFollowTheMoney } from '@/components/war-room/WarRoomFollowTheMoney';
import { WarRoomInsuranceRadar } from '@/components/war-room/WarRoomInsuranceRadar';
import { WarRoomNewsTicker } from '@/components/war-room/WarRoomNewsTicker';
import { WarRoomBillsDetailModal } from '@/components/war-room/WarRoomBillsDetailModal';
import { WarRoomManagementModal } from '@/components/war-room/WarRoomManagementModal';

export default function LousaOperacionalPage() {
  // ── ESTADOS PRINCIPAIS ──
  const [obligations, setObligations] = useState<WarRoomObligation[]>([]);
  const [pillars, setPillars] = useState<StrategicPillar[]>([]);
  const [flow, setFlow] = useState<FollowTheMoneyFlow>(WarRoomService.getFlow());
  const [insuranceAlerts, setInsuranceAlerts] = useState<InsuranceExpiringAlert[]>([]);
  const [isLoadingInsurances, setIsLoadingInsurances] = useState<boolean>(true);
  const [isRefreshingRate, setIsRefreshingRate] = useState<boolean>(false);

  // ── CONTROLES DE INTERFACE ──
  const [isTvMode, setIsTvMode] = useState<boolean>(false);
  const [isCursorHidden, setIsCursorHidden] = useState<boolean>(false);
  const [isBillsModalOpen, setIsBillsModalOpen] = useState<boolean>(false);
  const [isManagementModalOpen, setIsManagementModalOpen] = useState<boolean>(false);

  // ── CARREGAMENTO INICIAL ──
  const loadInitialData = useCallback(async () => {
    // 1. Obrigações e Pilares
    const loadedObligations = WarRoomService.getObligations();
    setObligations(loadedObligations);

    const loadedPillars = WarRoomService.getPillars();
    setPillars(loadedPillars);

    const loadedFlow = WarRoomService.getFlow();
    setFlow(loadedFlow);

    // 2. Seguros reais do Supabase
    setIsLoadingInsurances(true);
    const loadedInsurances = await WarRoomService.fetchExpiringInsurances();
    setInsuranceAlerts(loadedInsurances);
    setIsLoadingInsurances(false);

    // 3. Cotação do Dólar
    const rate = await WarRoomService.fetchLiveUSDRate();
    setFlow(prev => ({
      ...prev,
      cotacaoUSD: rate.bid,
      variacaoUSD: rate.pctChange,
    }));
  }, []);

  useEffect(() => {
    loadInitialData();

    // Recalcula a cada 1 minuto (status de data e cotação)
    const intervalMinute = setInterval(async () => {
      const rate = await WarRoomService.fetchLiveUSDRate();
      setFlow(prev => ({
        ...prev,
        cotacaoUSD: rate.bid,
        variacaoUSD: rate.pctChange,
      }));
    }, 60000);

    // Atualiza seguros a cada 5 minutos
    const intervalFiveMinutes = setInterval(async () => {
      const insurances = await WarRoomService.fetchExpiringInsurances();
      setInsuranceAlerts(insurances);
    }, 300000);

    return () => {
      clearInterval(intervalMinute);
      clearInterval(intervalFiveMinutes);
    };
  }, [loadInitialData]);

  // ── CURSOR AUTO-HIDE EM MODO TV (3s de inatividade) ──
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleMouseMove = () => {
      setIsCursorHidden(false);
      clearTimeout(timeoutId);
      if (isTvMode) {
        timeoutId = setTimeout(() => {
          setIsCursorHidden(true);
        }, 3000);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeoutId);
    };
  }, [isTvMode]);

  // ── ATALHOS DE TECLADO (F / T = TV Mode, Esc = Sair) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F' || e.key === 't' || e.key === 'T') {
        // Evita disparar se estiver digitando em input
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
        setIsTvMode(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsTvMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── AÇÕES DE OBRIGAÇÃO ──
  const handleTogglePaid = (id: string) => {
    const updated = WarRoomService.toggleObligationPaid(id);
    setObligations(updated);
  };

  const handleAddObligation = (obData: Omit<WarRoomObligation, 'id' | 'status'>) => {
    const updated = WarRoomService.addObligation(obData);
    setObligations(updated);
  };

  // ── AÇÕES DOS PILARES ──
  const handleToggleDemand = (itemId: string) => {
    const updated = WarRoomService.toggleDemandItem(itemId);
    setPillars(updated);
  };

  const handleAddDemand = (pilarId: string, itemData: { titulo: string; prioridade: 'critica' | 'alta' | 'normal'; responsavel?: string }) => {
    const updated = WarRoomService.addDemandItem(pilarId, itemData);
    setPillars(updated);
  };

  // ── AÇÕES DE FOLLOW THE MONEY ──
  const handleUpdateFlow = (updatedFlow: FollowTheMoneyFlow) => {
    WarRoomService.saveFlow(updatedFlow);
    setFlow(updatedFlow);
  };

  const handleRefreshRate = async () => {
    setIsRefreshingRate(true);
    const rate = await WarRoomService.fetchLiveUSDRate();
    setFlow(prev => ({
      ...prev,
      cotacaoUSD: rate.bid,
      variacaoUSD: rate.pctChange,
    }));
    setIsRefreshingRate(false);
  };

  // ── CONTADORES DE CABEÇALHO ──
  const counters: WarRoomSummaryCounters = useMemo(() => {
    return WarRoomService.computeSummary(obligations, insuranceAlerts, pillars);
  }, [obligations, insuranceAlerts, pillars]);

  return (
    <div className={`min-h-screen flex flex-col justify-between ${isCursorHidden ? 'cursor-none' : ''}`}>
      
      {/* 1. CABEÇALHO INSTITUCIONAL & STATUS */}
      <WarRoomHeader
        counters={counters}
        isTvMode={isTvMode}
        onToggleTvMode={() => setIsTvMode(prev => !prev)}
        onOpenManagement={() => setIsManagementModalOpen(true)}
        onOpenTodayModal={() => setIsBillsModalOpen(true)}
      />

      {/* 2. CORPO PRINCIPAL DO WAR ROOM (GRID ERGONÔMICO 16:9) */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto p-3 sm:p-5 flex flex-col gap-4">
        
        {/* LINHA SUPERIOR: CONTAS DO DIA (4 CNPJs) + RADAR DE SEGUROS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Card Especial Contas a Vencer no Dia (4 empresas do Omie) */}
          <div className="lg:col-span-6 xl:col-span-7">
            <WarRoomTodayBillsCard
              obligations={obligations}
              onOpenDetails={() => setIsBillsModalOpen(true)}
              onTogglePaid={handleTogglePaid}
            />
          </div>

          {/* Radar de Seguros & Apólices (< 30 Dias) */}
          <div className="lg:col-span-6 xl:col-span-5">
            <WarRoomInsuranceRadar
              alerts={insuranceAlerts}
              isLoading={isLoadingInsurances}
            />
          </div>
        </div>

        {/* LINHA INTERMEDIÁRIA: MONITOR DE RASTREIO FINANCEIRO (FOLLOW THE MONEY) */}
        <div className="w-full">
          <WarRoomFollowTheMoney
            flow={flow}
            onEditFlow={() => setIsManagementModalOpen(true)}
            onRefreshRate={handleRefreshRate}
            isRefreshingRate={isRefreshingRate}
          />
        </div>

        {/* LINHA DE TIMELINE: OBRIGAÇÕES MENSAIS LINEARES (01 A 31) */}
        <div className="w-full">
          <WarRoomTimeline
            obligations={obligations}
            onTogglePaid={handleTogglePaid}
            onOpenDetails={() => setIsBillsModalOpen(true)}
          />
        </div>

        {/* LINHA ESTRATÉGICA: OS 5 PILARES OPERACIONAIS */}
        <div className="w-full">
          <WarRoomStrategicPillars
            pillars={pillars}
            onToggleDemand={handleToggleDemand}
            onOpenManagement={() => setIsManagementModalOpen(true)}
          />
        </div>

      </main>

      {/* 3. RODAPÉ FIXO: NEWS TICKER EM ROTAÇÃO CONTÍNUA */}
      <WarRoomNewsTicker
        obligations={obligations}
        insuranceAlerts={insuranceAlerts}
        flow={flow}
      />

      {/* 4. MODAIS DE DETALHES E GESTÃO */}
      <WarRoomBillsDetailModal
        isOpen={isBillsModalOpen}
        onClose={() => setIsBillsModalOpen(false)}
        obligations={obligations}
        onTogglePaid={handleTogglePaid}
        onOpenAddModal={() => setIsManagementModalOpen(true)}
      />

      <WarRoomManagementModal
        isOpen={isManagementModalOpen}
        onClose={() => setIsManagementModalOpen(false)}
        onAddObligation={handleAddObligation}
        onAddDemand={handleAddDemand}
        flow={flow}
        onUpdateFlow={handleUpdateFlow}
      />

    </div>
  );
}
