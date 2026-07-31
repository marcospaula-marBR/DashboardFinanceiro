'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import styles from '@/components/faturamento/faturamento.module.css';
import { BillingService } from '@/services/billing.service';
import { BillingItem, BillingFilterState } from '@/types/billing.types';
import { BillingKpiCards } from '@/components/faturamento/BillingKpiCards';
import { BillingFilterBar } from '@/components/faturamento/BillingFilterBar';
import { BillingSegmentCharts } from '@/components/faturamento/BillingSegmentCharts';
import { BillingTable } from '@/components/faturamento/BillingTable';
import { BillingQuarterlyTaxModal } from '@/components/faturamento/BillingQuarterlyTaxModal';
import { BillingCommissionModal } from '@/components/faturamento/BillingCommissionModal';
import { ChevronLeft, Landmark, Download, RefreshCw } from 'lucide-react';
import { APP_VERSION } from '@/version';

export default function FaturamentoPage() {
  // Dados brutos
  const [allItems, setAllItems] = useState<BillingItem[]>(() => BillingService.getMockBillingItems());

  // Modais
  const [isTaxModalOpen, setIsTaxModalOpen] = useState<boolean>(false);
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState<boolean>(false);
  const [selectedCommissionItem, setSelectedCommissionItem] = useState<BillingItem | null>(null);

  // Filtros
  const [filter, setFilter] = useState<BillingFilterState>({
    company: 'ALL',
    date_type: 'date_registration',
    start_date: '',
    end_date: '',
    segment: 'ALL',
    is_outsourced: 'ALL',
    client: '',
    has_commission: 'ALL',
    search: ''
  });

  // Lista de clientes para o filtro
  const clientsList = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach(item => set.add(item.client_name));
    return Array.from(set).sort();
  }, [allItems]);

  // Itens Filtrados
  const filteredItems = useMemo(() => {
    return BillingService.filterBillingItems(allItems, filter);
  }, [allItems, filter]);

  // Resumo de KPIs e Percentuais por Segmento
  const kpiSummary = useMemo(() => {
    return BillingService.computeKpiSummary(filteredItems);
  }, [filteredItems]);

  // Apuração Trimestral IRPJ / CSLL
  const quarterlyTaxes = useMemo(() => {
    return BillingService.computeQuarterlyTaxes(filteredItems);
  }, [filteredItems]);

  // Handlers
  const handleOpenCommissionModal = (item: BillingItem) => {
    setSelectedCommissionItem(item);
    setIsCommissionModalOpen(true);
  };

  const handleSaveCommission = (itemId: string, updatedCommission: BillingItem['commission']) => {
    BillingService.saveItemOverride(itemId, { commission: updatedCommission });
    setAllItems(BillingService.getMockBillingItems());
  };

  const handleExportCSV = () => {
    const headers = ['Empresa', 'Nota_OS', 'Contrato', 'Cliente', 'Segmento', 'Terceirizacao', 'Data_Registro', 'Data_Emissao', 'Vencimento', 'Faturado_Bruto', 'Impostos_Retidos', 'Liquido_Real', 'Comissao_Total'];
    const rows = filteredItems.map(item => [
      item.company_name,
      item.invoice_number,
      item.contract_number,
      `"${item.client_name}"`,
      item.segment_type,
      item.is_outsourced ? 'Sim' : 'Nao',
      item.date_registration,
      item.date_issue,
      item.date_due,
      item.value_gross.toFixed(2),
      item.tax_retained_total.toFixed(2),
      item.value_net.toFixed(2),
      (item.commission.has_commission ? item.commission.total_commission_value : 0).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Faturamentos_MarBrasil_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.container}>
      {/* ── HEADER EXECUTIVO ────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <img
            src="/Logos/Mar-Brasil-sem-fundo-preto.png"
            alt="Mar Brasil Logo"
            className={styles.titleLogo}
          />
          <div>
            <h1 className={styles.titleText}>Faturamentos</h1>
            <p className={styles.subtitle}>
              Gestão Financeira & Fiscal Integrada (Omie ERP & People Board) • {APP_VERSION}
            </p>
          </div>
        </div>

        <div className={styles.actionsArea}>
          <button className={styles.btnPrimary} onClick={() => setIsTaxModalOpen(true)}>
            <Landmark size={16} />
            <span>Apuração Trimestral (IRPJ/CSLL)</span>
          </button>

          <button className={styles.btnSecondary} onClick={handleExportCSV}>
            <Download size={14} />
            <span>Exportar CSV</span>
          </button>

          <Link href="/" className={styles.btnSecondary}>
            <ChevronLeft size={16} />
            <span>Voltar ao Início</span>
          </Link>
        </div>
      </header>

      {/* ── KPI CARDS EXECUTIVOS ────────────────────────────────────── */}
      <BillingKpiCards summary={kpiSummary} />

      {/* ── BARRA DE FILTROS ESTRATÉGICOS ────────────────────────────── */}
      <BillingFilterBar
        filter={filter}
        onChange={setFilter}
        clientsList={clientsList}
      />

      {/* ── GRÁFICOS & SHARE POR SEGMENTO (RATEIOS DE DESPESAS) ────────── */}
      <BillingSegmentCharts summary={kpiSummary} />

      {/* ── MATRIZ TABULAR DE FATURAMENTOS ────────────────────────────── */}
      <BillingTable
        items={filteredItems}
        onOpenCommissionModal={handleOpenCommissionModal}
      />

      {/* ── MODAIS ──────────────────────────────────────────────────── */}
      <BillingQuarterlyTaxModal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        taxes={quarterlyTaxes}
      />

      <BillingCommissionModal
        isOpen={isCommissionModalOpen}
        onClose={() => setIsCommissionModalOpen(false)}
        item={selectedCommissionItem}
        onSave={handleSaveCommission}
      />
    </div>
  );
}
