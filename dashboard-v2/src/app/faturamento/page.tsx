'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import styles from '@/components/faturamento/faturamento.module.css';

import {
  BillingItem,
  BillingFilterState,
  BillingContractParam,
  BillingAuditEntry,
  DateReferenceType
} from '@/types/billing.types';
import { BillingService } from '@/services/billing.service';

import { BillingKpiCards } from '@/components/faturamento/BillingKpiCards';
import { BillingFilterBar } from '@/components/faturamento/BillingFilterBar';
import { BillingSegmentCharts } from '@/components/faturamento/BillingSegmentCharts';
import { BillingTable } from '@/components/faturamento/BillingTable';
import { BillingQuarterlyTaxModal } from '@/components/faturamento/BillingQuarterlyTaxModal';
import { BillingEditModal } from '@/components/faturamento/BillingEditModal';
import { OmieSyncModal } from '@/components/faturamento/OmieSyncModal';
import { BillingAuditModal } from '@/components/faturamento/BillingAuditModal';
import { BillingContractsModal } from '@/components/faturamento/BillingContractsModal';

import { ChevronLeft, Landmark, Download, RefreshCw, Sparkles, ShieldAlert, FileText, Trash2, Layers } from 'lucide-react';
import { APP_VERSION } from '@/version';

export default function FaturamentoPage() {
  // Aba Ativa
  const [activeTab, setActiveTab] = useState<'main' | 'contracts' | 'audit'>('main');

  // Estado dos Dados
  const [allItems, setAllItems] = useState<BillingItem[]>([]);
  const [contracts, setContracts] = useState<BillingContractParam[]>([]);
  const [auditEntries, setAuditEntries] = useState<BillingAuditEntry[]>([]);

  // Modais
  const [isTaxModalOpen, setIsTaxModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isOmieSyncModalOpen, setIsOmieSyncModalOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isContractsModalOpen, setIsContractsModalOpen] = useState<boolean>(false);

  const [selectedItem, setSelectedItem] = useState<BillingItem | null>(null);

  // Carregar dados na inicialização
  useEffect(() => {
    setAllItems(BillingService.getInvoices());
    setContracts(BillingService.getInitialContracts());
    setAuditEntries(BillingService.getAuditEntries());
  }, []);

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

  // Lista única de clientes para autocomplete
  const clientsList = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach(item => {
      if (item.client_name) set.add(item.client_name);
    });
    return Array.from(set).sort();
  }, [allItems]);

  // Itens filtrados
  const filteredItems = useMemo(() => {
    return BillingService.filterBillingItems(allItems, filter);
  }, [allItems, filter]);

  // Resumo de KPIs
  const kpiSummary = useMemo(() => {
    return BillingService.computeKpiSummary(filteredItems);
  }, [filteredItems]);

  // Apuração Trimestral
  const quarterlyTaxes = useMemo(() => {
    return BillingService.computeQuarterlyTaxes(filteredItems);
  }, [filteredItems]);

  // Contagem de auditorias pendentes
  const pendingAuditCount = useMemo(() => {
    return auditEntries.filter(a => a.audit_status === 'PENDING').length;
  }, [auditEntries]);

  // Handlers de Ações
  const handleOpenEditModal = (item: BillingItem) => {
    setSelectedItem(item);
    setIsEditModalOpen(true);
  };

  const handleSaveItemEdit = (itemId: string, updatedFields: Partial<BillingItem>) => {
    const updated = allItems.map(item => item.id === itemId ? { ...item, ...updatedFields } : item);
    setAllItems(updated);
    BillingService.saveInvoices(updated);
  };

  const handleSaveContractParam = (contract: BillingContractParam) => {
    BillingService.saveContractParam(contract);
    setContracts(BillingService.getInitialContracts());
  };

  const handleApproveAuditEntry = (auditId: string) => {
    BillingService.approveAuditEntry(auditId);
    setAuditEntries(BillingService.getAuditEntries());
    setAllItems(BillingService.getInvoices());
  };

  const handleRejectAuditEntry = (auditId: string) => {
    BillingService.rejectAuditEntry(auditId);
    setAuditEntries(BillingService.getAuditEntries());
  };

  const handleApproveAllAudit = () => {
    BillingService.approveAllPendingAudit();
    setAuditEntries(BillingService.getAuditEntries());
    setAllItems(BillingService.getInvoices());
  };

  const handleClearDatabase = () => {
    if (confirm('Tem certeza que deseja zerar a base de dados de faturamentos?')) {
      BillingService.clearDatabase();
      setAllItems([]);
      setAuditEntries([]);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Empresa', 'Nota_OS', 'Contrato', 'Cliente', 'Segmento', 'Terceirizacao', 'Data_Registro', 'Data_Emissao', 'Vencimento', 'Faturado_Bruto', 'Impostos_Retidos', 'Liquido_Real', 'Comissao_Total'];
    const rows = filteredItems.map(item => [
      item.company_name,
      item.invoice_number,
      item.contract_number || 'N/A',
      `"${item.client_name}"`,
      item.segment_type,
      item.is_outsourced ? 'Sim' : 'Nao',
      item.date_registration,
      item.date_issue,
      item.date_due,
      item.value_gross.toFixed(2),
      item.tax_retained_total.toFixed(2),
      item.value_net.toFixed(2),
      (item.commission && item.commission.has_commission ? item.commission.total_commission_value : 0).toFixed(2)
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
              Gestão Financeira, Auditoria Omie ERP & Parametrização de Contratos • {APP_VERSION}
            </p>
          </div>
        </div>

        <div className={styles.actionsArea}>
          <button className={styles.btnPrimary} onClick={() => setIsOmieSyncModalOpen(true)}>
            <Sparkles size={16} />
            <span>⚡ Sincronizar Omie</span>
          </button>

          <button
            className={styles.btnSecondary}
            onClick={() => setIsAuditModalOpen(true)}
            style={{ position: 'relative', color: pendingAuditCount > 0 ? '#f59e0b' : '#cbd5e1', borderColor: pendingAuditCount > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)' }}
          >
            <ShieldAlert size={14} />
            <span>Auditoria ({pendingAuditCount})</span>
          </button>

          <button className={styles.btnSecondary} onClick={() => setIsContractsModalOpen(true)}>
            <FileText size={14} />
            <span>Parametrizar Contratos</span>
          </button>

          <button className={styles.btnSecondary} onClick={() => setIsTaxModalOpen(true)}>
            <Landmark size={14} />
            <span>Apuração Trimestral</span>
          </button>

          <button className={styles.btnSecondary} onClick={handleExportCSV}>
            <Download size={14} />
            <span>Exportar CSV</span>
          </button>

          <button className={styles.btnSecondary} onClick={handleClearDatabase} title="Zerar base de faturamentos" style={{ color: '#f43f5e' }}>
            <Trash2 size={14} />
          </button>

          <Link href="/" className={styles.btnSecondary}>
            <ChevronLeft size={16} />
            <span>Voltar ao Início</span>
          </Link>
        </div>
      </header>

      {/* ── NAVEGAÇÃO DE ABAS EXECUTIVAS ────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('main')}
          style={{
            background: activeTab === 'main' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
            border: `1px solid ${activeTab === 'main' ? '#f59e0b' : 'transparent'}`,
            color: activeTab === 'main' ? '#f59e0b' : '#94a3b8',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Layers size={15} />
          <span>Visão Geral & Faturamentos ({allItems.length})</span>
        </button>

        <button
          onClick={() => setIsContractsModalOpen(true)}
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            color: '#94a3b8',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <FileText size={15} />
          <span>Parametrização de Contratos ({contracts.length})</span>
        </button>

        <button
          onClick={() => setIsAuditModalOpen(true)}
          style={{
            background: pendingAuditCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
            border: `1px solid ${pendingAuditCount > 0 ? '#f59e0b' : 'transparent'}`,
            color: pendingAuditCount > 0 ? '#f59e0b' : '#94a3b8',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <ShieldAlert size={15} />
          <span>Auditoria & Aprovação Omie ({pendingAuditCount} Pendentes)</span>
        </button>
      </div>

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
        onOpenCommissionModal={handleOpenEditModal}
      />

      {/* ── MODAIS ──────────────────────────────────────────────────── */}
      <OmieSyncModal
        isOpen={isOmieSyncModalOpen}
        onClose={() => setIsOmieSyncModalOpen(false)}
        onSyncSuccess={(newSyncedItems) => {
          // Gerar a auditoria diff das novidades trazidas do Omie
          const auditEntriesUpdated = BillingService.processOmieSyncDiff(newSyncedItems);
          setAuditEntries(auditEntriesUpdated);
          setIsAuditModalOpen(true);
        }}
      />

      <BillingAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        entries={auditEntries}
        onApproveEntry={handleApproveAuditEntry}
        onRejectEntry={handleRejectAuditEntry}
        onApproveAll={handleApproveAllAudit}
      />

      <BillingContractsModal
        isOpen={isContractsModalOpen}
        onClose={() => setIsContractsModalOpen(false)}
        contracts={contracts}
        onSaveContract={handleSaveContractParam}
      />

      <BillingQuarterlyTaxModal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        taxes={quarterlyTaxes}
      />

      <BillingEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        item={selectedItem}
        onSave={handleSaveItemEdit}
      />
    </div>
  );
}
