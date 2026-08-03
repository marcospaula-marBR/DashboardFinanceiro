'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from '@/components/faturamento/faturamento.module.css';

import {
  RecebimentoItem,
  RecebiveisFilters,
  ContratoParam,
  RecebiveisAuditEntry,
  CommissionableEmployee
} from '@/types/recebiveis';
import { RecebiveisService } from '@/services/recebiveis.service';
import { BillingService } from '@/services/billing.service';

import { RecebiveisKpiCards } from '@/components/recebiveis/RecebiveisKpiCards';
import { RecebiveisTable } from '@/components/recebiveis/RecebiveisTable';
import { RecebiveisCharts } from '@/components/recebiveis/RecebiveisCharts';
import { RecebimentoModal } from '@/components/recebiveis/RecebimentoModal';
import { RecebiveisOmieSyncModal } from '@/components/recebiveis/RecebiveisOmieSyncModal';
import { RecebiveisAuditModal } from '@/components/recebiveis/RecebiveisAuditModal';
import { RecebiveisContratoModal } from '@/components/recebiveis/RecebiveisContratoModal';
import { BillingQuarterlyTaxModal } from '@/components/faturamento/BillingQuarterlyTaxModal';

import { ChevronLeft, Landmark, Download, RefreshCw, Sparkles, ShieldAlert, FileText, Plus, Layers, Filter } from 'lucide-react';
import { APP_VERSION } from '@/version';

export default function RecebiveisPage() {
  // Estado dos Dados
  const [items, setItems] = useState<RecebimentoItem[]>([]);
  const [contracts, setContracts] = useState<ContratoParam[]>([]);
  const [auditEntries, setAuditEntries] = useState<RecebiveisAuditEntry[]>([]);
  const [eligibleEmployees, setEligibleEmployees] = useState<CommissionableEmployee[]>([]);

  // Modais
  const [isRecebimentoModalOpen, setIsRecebimentoModalOpen] = useState<boolean>(false);
  const [isOmieSyncModalOpen, setIsOmieSyncModalOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isContractsModalOpen, setIsContractsModalOpen] = useState<boolean>(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState<boolean>(false);

  const [selectedItem, setSelectedItem] = useState<RecebimentoItem | null>(null);

  // Filtros
  const [filter, setFilter] = useState<RecebiveisFilters>({
    company: 'ALL',
    date_type: 'date_registration',
    startDate: '',
    endDate: '',
    ciclo: '',
    contratoId: '',
    membroId: '',
    segment: 'ALL',
    is_outsourced: 'ALL',
    search: ''
  });

  // Carregar dados iniciais
  const loadData = useCallback(() => {
    setItems(RecebiveisService.getRecebimentos());
    setContracts(RecebiveisService.getContratosParams());
    setAuditEntries(RecebiveisService.getAuditEntries());
    RecebiveisService.getCommissionableEmployees().then(setEligibleEmployees);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtragem de dados
  const filteredItems = useMemo(() => {
    return RecebiveisService.filterRecebimentos(items, filter);
  }, [items, filter]);

  // KPIs
  const kpiSummary = useMemo(() => {
    return RecebiveisService.computeKpiSummary(filteredItems);
  }, [filteredItems]);

  // Apuração Trimestral IRPJ/CSLL (LC 224/2025)
  const quarterlyTaxes = useMemo(() => {
    const billingConverted: any[] = filteredItems.map(i => ({
      ...i,
      tax_retained_total: i.tax_retained_total || 0,
      commission: i.commission || { has_commission: false }
    }));
    return BillingService.computeQuarterlyTaxes(billingConverted);
  }, [filteredItems]);

  const pendingAuditCount = useMemo(() => {
    return auditEntries.filter(a => a.audit_status === 'PENDING').length;
  }, [auditEntries]);

  // Handlers
  const handleOpenNewManual = () => {
    setSelectedItem(null);
    setIsRecebimentoModalOpen(true);
  };

  const handleOpenEditItem = (item: RecebimentoItem) => {
    setSelectedItem(item);
    setIsRecebimentoModalOpen(true);
  };

  const handleSaveRecebimento = (saved: RecebimentoItem) => {
    RecebiveisService.saveSingleRecebimento(saved);
    setItems(RecebiveisService.getRecebimentos());
  };

  const handleDeleteRecebimento = (id: string) => {
    if (confirm('Deseja realmente excluir este lançamento de recebimento?')) {
      RecebiveisService.deleteRecebimento(id);
      setItems(RecebiveisService.getRecebimentos());
    }
  };

  const handleLiquidateRecebimento = (id: string) => {
    const today = new Date().toISOString().substring(0, 10);
    const updated = items.map(item => {
      if (item.id === id) {
        return { ...item, status: 'Pago' as const, date_payment: today };
      }
      return item;
    });
    setItems(updated);
    RecebiveisService.saveRecebimentos(updated);
  };

  const handleSaveContractParam = (contract: ContratoParam) => {
    RecebiveisService.saveContratoParam(contract);
    setContracts(RecebiveisService.getContratosParams());
  };

  const handleApproveAuditEntry = (auditId: string) => {
    RecebiveisService.approveAuditEntry(auditId);
    setAuditEntries(RecebiveisService.getAuditEntries());
    setItems(RecebiveisService.getRecebimentos());
  };

  const handleRejectAuditEntry = (auditId: string) => {
    RecebiveisService.rejectAuditEntry(auditId);
    setAuditEntries(RecebiveisService.getAuditEntries());
  };

  const handleApproveAllAudit = () => {
    RecebiveisService.approveAllPendingAudit();
    setAuditEntries(RecebiveisService.getAuditEntries());
    setItems(RecebiveisService.getRecebimentos());
  };

  const handleExportCSV = () => {
    const headers = ['Origem', 'Empresa', 'Nota_OS', 'Contrato', 'Cliente', 'Segmento', 'Terceirizacao', 'Data_Registro', 'Data_Emissao', 'Vencimento', 'Faturado_Bruto', 'Impostos_Retidos', 'Liquido_Real', 'Status', 'Comissao_Total'];
    const rows = filteredItems.map(item => [
      item.source,
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
      item.status,
      (item.commission && item.commission.has_commission ? item.commission.total_commission_value : 0).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Recebiveis_Comissoes_MarBrasil_${new Date().toISOString().split('T')[0]}.csv`);
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
            <h1 className={styles.titleText}>Recebíveis & Comissões</h1>
            <p className={styles.subtitle}>
              Gestão Unificada de Faturamento, Retenções Fiscais, Omie ERP & People Board • {APP_VERSION}
            </p>
          </div>
        </div>

        <div className={styles.actionsArea}>
          <button className={styles.btnPrimary} onClick={handleOpenNewManual} style={{ background: '#10b981', borderColor: '#059669' }}>
            <Plus size={16} />
            <span>+ Novo Recebimento (Manual)</span>
          </button>

          <button className={styles.btnPrimary} onClick={() => setIsOmieSyncModalOpen(true)}>
            <Sparkles size={16} />
            <span>⚡ Sincronizar Omie</span>
          </button>

          <button
            className={styles.btnSecondary}
            onClick={() => setIsAuditModalOpen(true)}
            style={{ color: pendingAuditCount > 0 ? '#f59e0b' : '#cbd5e1', borderColor: pendingAuditCount > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)' }}
          >
            <ShieldAlert size={14} />
            <span>Auditoria ({pendingAuditCount})</span>
          </button>

          <button className={styles.btnSecondary} onClick={() => setIsContractsModalOpen(true)}>
            <FileText size={14} />
            <span>Contratos</span>
          </button>

          <button className={styles.btnSecondary} onClick={() => setIsTaxModalOpen(true)}>
            <Landmark size={14} />
            <span>Apuração Trimestral</span>
          </button>

          <button className={styles.btnSecondary} onClick={handleExportCSV}>
            <Download size={14} />
            <span>CSV</span>
          </button>

          <Link href="/" className={styles.btnSecondary}>
            <ChevronLeft size={16} />
            <span>Voltar ao Início</span>
          </Link>
        </div>
      </header>

      {/* ── KPI CARDS EXECUTIVOS ────────────────────────────────────── */}
      <RecebiveisKpiCards summary={kpiSummary} />

      {/* ── BARRA DE FILTROS AVANÇADOS ────────────────────────────────── */}
      <div className={styles.filterCard} style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={14} />
          <span>Filtros Estratégicos de Recebíveis & Comissões</span>
        </div>

        <div className={styles.filterGrid} style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.65rem' }}>
          <div>
            <label className={styles.filterLabel}>Empresa</label>
            <select className={styles.selectInput} value={filter.company || 'ALL'} onChange={e => setFilter({ ...filter, company: e.target.value as any })}>
              <option value="ALL">Todas as Empresas</option>
              <option value="Mar Brasil">Mar Brasil Serviços</option>
              <option value="DZM">DZM Empreendimentos</option>
            </select>
          </div>

          <div>
            <label className={styles.filterLabel}>Referência Data</label>
            <select className={styles.selectInput} value={filter.date_type || 'date_registration'} onChange={e => setFilter({ ...filter, date_type: e.target.value as any })}>
              <option value="date_registration">📌 Data Registro</option>
              <option value="date_issue">📄 Data Emissão</option>
              <option value="date_due">📅 Data Vencimento</option>
              <option value="date_payment">💳 Data Pagamento</option>
            </select>
          </div>

          <div>
            <label className={styles.filterLabel}>Segmento</label>
            <select className={styles.selectInput} value={filter.segment || 'ALL'} onChange={e => setFilter({ ...filter, segment: e.target.value as any })}>
              <option value="ALL">Todos (B2G, B2B, B2C)</option>
              <option value="B2G">B2G</option>
              <option value="B2B">B2B</option>
              <option value="B2C">B2C</option>
            </select>
          </div>

          <div>
            <label className={styles.filterLabel}>Terceirização</label>
            <select className={styles.selectInput} value={filter.is_outsourced || 'ALL'} onChange={e => setFilter({ ...filter, is_outsourced: e.target.value as any })}>
              <option value="ALL">Todos (Sim & Não)</option>
              <option value="NO">Não (Próprio)</option>
              <option value="YES">Sim (Terceirizado)</option>
            </select>
          </div>

          <div>
            <label className={styles.filterLabel}>Comissionado (People)</label>
            <select className={styles.selectInput} value={filter.membroId || ''} onChange={e => setFilter({ ...filter, membroId: e.target.value })}>
              <option value="">Todos os Comissionados</option>
              {eligibleEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={styles.filterLabel}>Busca por Texto / NF</label>
            <input
              type="text"
              className={styles.textInput}
              placeholder="Digite NF, Cliente..."
              value={filter.search || ''}
              onChange={e => setFilter({ ...filter, search: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* ── GRÁFICOS & REPRESENTATIVIDADE ────────────────────────────── */}
      <RecebiveisCharts summary={kpiSummary} />

      {/* ── MATRIZ HISTÓRICA DE RECEBIMENTOS & COMISSÕES ────────────── */}
      <RecebiveisTable
        items={filteredItems}
        onOpenEditModal={handleOpenEditItem}
        onDelete={handleDeleteRecebimento}
        onLiquidate={handleLiquidateRecebimento}
      />

      {/* ── MODAIS ──────────────────────────────────────────────────── */}
      <RecebimentoModal
        isOpen={isRecebimentoModalOpen}
        onClose={() => setIsRecebimentoModalOpen(false)}
        item={selectedItem}
        contracts={contracts}
        onSave={handleSaveRecebimento}
      />

      <RecebiveisOmieSyncModal
        isOpen={isOmieSyncModalOpen}
        onClose={() => setIsOmieSyncModalOpen(false)}
        onSyncSuccess={(newOmieItems) => {
          const updatedAudit = RecebiveisService.processOmieSyncDiff(newOmieItems);
          setAuditEntries(updatedAudit);
          setIsAuditModalOpen(true);
        }}
      />

      <RecebiveisAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        entries={auditEntries}
        onApproveEntry={handleApproveAuditEntry}
        onRejectEntry={handleRejectAuditEntry}
        onApproveAll={handleApproveAllAudit}
      />

      <RecebiveisContratoModal
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
    </div>
  );
}
