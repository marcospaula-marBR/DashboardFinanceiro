/**
 * Seguros — Página de Gestão de Apólices
 * @version v.02.48.97
 * Migrada de: public/seguros.html (legado Bootstrap+CSV)
 * Para: Next.js React com Supabase como fonte de dados
 */
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Plus, ShieldCheck, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

import { InsuranceExpiryAlert } from '@/components/seguros/InsuranceExpiryAlert';
import { InsuranceKPICards } from '@/components/seguros/InsuranceKPICards';
import { InsuranceFilterBar } from '@/components/seguros/InsuranceFilterBar';
import { InsurancePolicyCard } from '@/components/seguros/InsurancePolicyCard';
import { InsuranceAddEditModal } from '@/components/seguros/InsuranceAddEditModal';

import {
  fetchInsurancePolicies,
  createInsurancePolicy,
  updateInsurancePolicy,
  deactivateInsurancePolicy,
  computeInsuranceKPIs,
} from '@/services/insurance.service';

import { InsurancePolicy, InsurancePolicyInput, InsuranceFilterValues } from '@/types/insurance';
import { APP_VERSION } from '@/version';
import styles from '@/components/seguros/seguros.module.css';

const EMPTY_FILTERS: InsuranceFilterValues = {
  contratante: '',
  tipo: '',
  seguradora: '',
  mostrarInativos: false,
};

export default function SegurosPage() {
  // ── DATA STATE ──
  const [allPolicies, setAllPolicies] = useState<InsurancePolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── FILTERS ──
  const [filters, setFilters] = useState<InsuranceFilterValues>(EMPTY_FILTERS);

  // ── MODAL STATE ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null);

  // ── DELETE CONFIRM ──
  const [deletingPolicy, setDeletingPolicy] = useState<InsurancePolicy | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ──────────────────────────────────────────────────────────
  // FETCH
  // ──────────────────────────────────────────────────────────
  const loadPolicies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Busca todas (ativas e inativas) para ter o total correto nos KPIs
      const data = await fetchInsurancePolicies({ mostrarInativos: true });
      setAllPolicies(data);
    } catch (err: any) {
      setError('Erro ao carregar apólices: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  // ──────────────────────────────────────────────────────────
  // FILTERS LOGIC (client-side)
  // ──────────────────────────────────────────────────────────
  const filteredPolicies = useMemo(() => {
    return allPolicies.filter((p) => {
      if (!filters.mostrarInativos && !p.ativo) return false;
      if (filters.contratante && p.contratante !== filters.contratante) return false;
      if (filters.tipo && p.tipo !== filters.tipo) return false;
      if (filters.seguradora && p.seguradora !== filters.seguradora) return false;
      return true;
    });
  }, [allPolicies, filters]);

  // Opções únicas para os selects de filtro
  const ativas = useMemo(() => allPolicies.filter((p) => p.ativo), [allPolicies]);
  const contratantes = useMemo(() => [...new Set(ativas.map((p) => p.contratante).filter((x): x is string => !!x))].sort(), [ativas]);
  const tipos = useMemo(() => [...new Set(ativas.map((p) => p.tipo).filter((x): x is string => !!x))].sort(), [ativas]);
  const seguradoras = useMemo(() => [...new Set(ativas.map((p) => p.seguradora).filter((x): x is string => !!x))].sort(), [ativas]);

  // KPIs calculados com base em todas as apólices (sem filtro de UI)
  const kpis = useMemo(() => computeInsuranceKPIs(allPolicies), [allPolicies]);

  // Alertas de vencimento
  const urgentes = useMemo(() => kpis.vencendoEm7Dias, [kpis]);
  const atencao = useMemo(
    () => kpis.vencendoEm30Dias.filter((p) => (p.diasParaVencer ?? 999) > 7),
    [kpis]
  );

  // ──────────────────────────────────────────────────────────
  // CRUD HANDLERS
  // ──────────────────────────────────────────────────────────
  const handleSave = async (data: InsurancePolicyInput) => {
    if (editingPolicy) {
      await updateInsurancePolicy(editingPolicy.id, data);
    } else {
      await createInsurancePolicy(data);
    }
    setIsModalOpen(false);
    setEditingPolicy(null);
    await loadPolicies();
  };

  const handleEdit = (policy: InsurancePolicy) => {
    setEditingPolicy(policy);
    setIsModalOpen(true);
  };

  const handleDeleteRequest = (policy: InsurancePolicy) => {
    setDeletingPolicy(policy);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPolicy) return;
    setIsDeleting(true);
    try {
      await deactivateInsurancePolicy(deletingPolicy.id);
      setDeletingPolicy(null);
      await loadPolicies();
    } catch (err: any) {
      setError('Erro ao excluir: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenNew = () => {
    setEditingPolicy(null);
    setIsModalOpen(true);
  };

  // ──────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────
  return (
    <div className={styles.pageWrapper}>

      {/* ── HEADER ── */}
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <Image
            src="/mar-brasil-logo.png"
            alt="Logo Mar Brasil"
            width={120}
            height={36}
            className={styles.headerLogo}
            priority
          />
          <div className={styles.headerTitleGroup}>
            <span className={styles.headerTitle}>Gestão de Seguros</span>
            <span className={styles.headerSub}>Apólices do Grupo Mar Brasil</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <Link href="/" className={styles.backBtn}>
            <ChevronLeft size={14} />
            <span>Voltar ao Início</span>
          </Link>
          <button className={styles.addBtn} onClick={handleOpenNew} id="btn-nova-apolice">
            <Plus size={14} />
            <span>Nova Apólice</span>
          </button>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main className={styles.pageContent}>

        {/* Alertas de vencimento breve */}
        {!isLoading && (urgentes.length > 0 || atencao.length > 0) && (
          <InsuranceExpiryAlert urgentes={urgentes} atencao={atencao} />
        )}

        {/* KPIs */}
        <InsuranceKPICards kpis={kpis} isLoading={isLoading} />

        {/* Filtros */}
        {!isLoading && allPolicies.length > 0 && (
          <InsuranceFilterBar
            filters={filters}
            onChange={setFilters}
            contratantes={contratantes}
            tipos={tipos}
            seguradoras={seguradoras}
            totalVisible={filteredPolicies.length}
            totalAll={allPolicies.length}
          />
        )}

        {/* Estados: Loading / Error / Empty / Lista */}
        {isLoading ? (
          <div className={styles.loadingState}>
            <Loader2 size={32} className={styles.loadingSpinner} />
            <p>Carregando apólices...</p>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <AlertCircle size={28} />
            <p>{error}</p>
            <button
              onClick={loadPolicies}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', padding: '0.4rem 0.85rem', borderRadius: '7px',
                fontSize: '0.75rem', cursor: 'pointer' }}
            >
              <RefreshCw size={14} />
              Tentar novamente
            </button>
          </div>
        ) : filteredPolicies.length === 0 ? (
          <div className={styles.emptyState}>
            <ShieldCheck size={48} style={{ color: '#1e293b' }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569' }}>
              {allPolicies.length === 0
                ? 'Nenhuma apólice cadastrada ainda'
                : 'Nenhuma apólice encontrada com esses filtros'}
            </p>
            {allPolicies.length === 0 && (
              <button
                onClick={handleOpenNew}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff',
                  border: 'none', padding: '0.55rem 1.1rem', borderRadius: '8px',
                  fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={14} />
                Cadastrar Primeira Apólice
              </button>
            )}
          </div>
        ) : (
          <div className={styles.policiesGrid}>
            {filteredPolicies.map((policy) => (
              <InsurancePolicyCard
                key={policy.id}
                policy={policy}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
              />
            ))}
          </div>
        )}

      </main>

      {/* ── MODAL ADD/EDIT ── */}
      <InsuranceAddEditModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingPolicy(null); }}
        onSave={handleSave}
        policy={editingPolicy}
      />

      {/* ── MODAL CONFIRM DELETE ── */}
      {deletingPolicy && (
        <div className={styles.modalOverlay} onClick={() => setDeletingPolicy(null)}>
          <div className={styles.deleteModalContent} onClick={(e) => e.stopPropagation()}>
            <p className={styles.deleteModalTitle}>⚠ Confirmar Exclusão</p>
            <p className={styles.deleteModalText}>
              Deseja desativar a apólice de{' '}
              <strong>{deletingPolicy.tipo}</strong>{' '}
              ({deletingPolicy.segurado || deletingPolicy.contratante})?
              <br />
              <span style={{ fontSize: '0.7rem', color: '#475569' }}>
                A apólice será marcada como inativa. Você pode reativá-la a qualquer momento.
              </span>
            </p>
            <div className={styles.deleteModalActions}>
              <button className={styles.btnCancel} onClick={() => setDeletingPolicy(null)}>
                Cancelar
              </button>
              <button
                className={styles.btnDeleteConfirm}
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Desativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HUD footer */}
      <footer className={styles.hudFooter}>
        Mar Brasil · Portal de Gestão Inteligente
      </footer>
      <div className={styles.hudVersion}>v{APP_VERSION.replace('v', '')}</div>
    </div>
  );
}
