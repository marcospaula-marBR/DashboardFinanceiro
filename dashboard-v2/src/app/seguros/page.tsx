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
import { ChevronLeft, Plus, ShieldCheck, Loader2, AlertCircle, RefreshCw, FileText } from 'lucide-react';

import { InsuranceExpiryAlert } from '@/components/seguros/InsuranceExpiryAlert';
import { InsuranceKPICards } from '@/components/seguros/InsuranceKPICards';
import { InsuranceFilterBar } from '@/components/seguros/InsuranceFilterBar';
import { InsurancePolicyCard } from '@/components/seguros/InsurancePolicyCard';
import { InsuranceAddEditModal } from '@/components/seguros/InsuranceAddEditModal';
import { InsuranceExportModal, InsuranceExportSelections } from '@/components/seguros/InsuranceExportModal';

import {
  fetchInsurancePolicies,
  createInsurancePolicy,
  updateInsurancePolicy,
  deactivateInsurancePolicy,
  deleteInsurancePolicy,
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

  // ── EXPORT MODAL ──
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
      await deleteInsurancePolicy(deletingPolicy.id);
      setDeletingPolicy(null);
      await loadPolicies();
    } catch (err: any) {
      setError('Erro ao excluir: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (policy: InsurancePolicy) => {
    try {
      await updateInsurancePolicy(policy.id, { ativo: !policy.ativo });
      await loadPolicies();
    } catch (err: any) {
      setError('Erro ao alterar status da apólice: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleOpenNew = () => {
    setEditingPolicy(null);
    setIsModalOpen(true);
  };

  // ──────────────────────────────────────────────────────────
  // GAMMA / BRISINH AI HELPERS
  // ──────────────────────────────────────────────────────────
  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // Mapa de logos por contratante
  const LOGO_MAP: Record<string, string> = {
    'Mar Brasil': '/logos/MarBR.png',
    'Mar BR': '/logos/MarBR.png',
    'DZM': '/logos/DZM.png',
    'Grupo 2': '/logos/G2.png',
    'G2': '/logos/G2.png',
    'Ybox': '/logos/Ybox.png',
    'Conectius': '/logos/Conectius.png',
  };

  const buildInsuranceMarkdown = async (
    selections: InsuranceExportSelections
  ): Promise<string> => {
    // Determina contratantes visíveis nos dados filtrados
    const contratantesAtivos = [...new Set(filteredPolicies.map((p) => p.contratante).filter(Boolean))];
    const logoTags = contratantesAtivos
      .map((c) => LOGO_MAP[c])
      .filter(Boolean)
      .map((src) => `<img src="${src}" width="120" />`)
      .join(' ');

    const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const filtroDesc = [
      filters.contratante ? `Empresa: ${filters.contratante}` : 'Todas as Empresas',
      filters.tipo ? `Tipo: ${filters.tipo}` : '',
      filters.seguradora ? `Seguradora: ${filters.seguradora}` : '',
    ].filter(Boolean).join(' | ');

    let md = '';

    if (logoTags) md += `${logoTags}\n\n`;
    md += `# Relatório de Gestão de Seguros\n`;
    md += `**Grupo Mar Brasil** — Emitido em ${dataHoje}\n\n`;
    md += `---\n\n`;
    md += `## Filtros Aplicados\n`;
    md += `- ${filtroDesc}\n\n`;

    // KPIs gerais
    md += `## Resumo Executivo do Portfólio\n`;
    md += `| Indicador | Valor |\n|---|---|\n`;
    md += `| Total de Apólices (Carteira) | ${kpis.totalApólices} |\n`;
    md += `| Apólices Ativas | ${kpis.apólicesAtivas} |\n`;
    md += `| Custo Mensal Total (Prêmio) | ${formatBRL(kpis.premioMensalTotal)} |\n`;
    md += `| Custo Anual Total (Prêmio) | ${formatBRL(kpis.premioAnualTotal)} |\n`;
    md += `| Vencendo em até 7 dias | **${kpis.vencendoEm7Dias.length}** |\n`;
    md += `| Vencendo em até 30 dias | ${kpis.vencendoEm30Dias.length} |\n\n`;

    // Apólices urgentes
    if (kpis.vencendoEm30Dias.length > 0) {
      md += `## ⚠️ Apólices com Vencimento Próximo (30 dias)\n`;
      md += `| Contratante | Segurado | Tipo | Seguradora | Vencimento | Dias Restantes | Prêmio |\n`;
      md += `|---|---|---|---|---|---|---|\n`;
      kpis.vencendoEm30Dias.forEach((p) => {
        md += `| ${p.contratante} | ${p.segurado || '—'} | ${p.tipo} | ${p.seguradora || '—'} | ${formatDate(p.vencimento)} | **${p.diasParaVencer ?? '?'}** | ${formatBRL(p.premio || 0)} |\n`;
      });
      md += `\n`;
    }

    // Distribuição por tipo
    if (Object.keys(kpis.porTipo).length > 0) {
      md += `## Distribuição por Tipo de Seguro\n`;
      md += `| Tipo | Quantidade |\n|---|---|\n`;
      Object.entries(kpis.porTipo)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .forEach(([tipo, qtd]) => {
          md += `| ${tipo} | ${qtd} |\n`;
        });
      md += `\n`;
    }

    // Distribuição por contratante
    if (Object.keys(kpis.porContratante).length > 0) {
      md += `## Distribuição por Empresa (Contratante)\n`;
      md += `| Empresa | Apólices Ativas |\n|---|---|\n`;
      Object.entries(kpis.porContratante)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .forEach(([empresa, qtd]) => {
          md += `| ${empresa} | ${qtd} |\n`;
        });
      md += `\n`;
    }

    // Listagem completa de apólices filtradas
    if (filteredPolicies.length > 0) {
      md += `## Portfólio Detalhado das Apólices Filtradas\n`;
      md += `| Contratante | Segurado | Tipo | Seguradora | Início | Vencimento | Prêmio Anual | Parcela Mensal | Status |\n`;
      md += `|---|---|---|---|---|---|---|---|---|\n`;
      filteredPolicies.forEach((p) => {
        const status = p.statusVencimento === 'urgente' || p.statusVencimento === 'vencido'
          ? '🔴 Urgente'
          : p.statusVencimento === 'atencao'
          ? '🟡 Atenção'
          : '🟢 Ok';
        md += `| ${p.contratante} | ${p.segurado || '—'} | ${p.tipo} | ${p.seguradora || '—'} | ${formatDate(p.inicio)} | ${formatDate(p.vencimento)} | ${formatBRL(p.premio || 0)} | ${formatBRL(p.valor_parcela || 0)} | ${status} |\n`;
      });
      md += `\n`;
    }

    // Análise BrisinhAI
    if (selections.includeAiAnalysis) {
      try {
        const res = await fetch('/api/ai/analyze_seguros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kpis,
            policies: filteredPolicies,
            filtros: filtroDesc,
          }),
        });
        const data = await res.json();
        if (data?.analysis) {
          md += `## Análise Executiva (Por BrisinhAI)\n\n`;
          md += `${data.analysis}\n\n`;
        }
      } catch {
        md += `## Análise Executiva (Por BrisinhAI)\n\n`;
        md += `*Não foi possível gerar a análise de IA neste momento.*\n\n`;
      }
    }

    return md;
  };

  const handlePreviewInsurance = async (
    selections: InsuranceExportSelections
  ): Promise<string> => {
    return buildInsuranceMarkdown(selections);
  };

  const handleExportInsurance = async (
    selections: InsuranceExportSelections,
    customMarkdown?: string
  ) => {
    setIsExporting(true);
    try {
      const markdownReport = customMarkdown || (await buildInsuranceMarkdown(selections));
      const res = await fetch('/api/gamma/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownReport }),
      });
      const data = await res.json();
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        alert('Não foi possível obter o link da apresentação. Verifique os logs.');
      }
    } catch {
      alert('Erro ao gerar apresentação. Tente novamente.');
    } finally {
      setIsExporting(false);
      setIsExportModalOpen(false);
    }
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
            src="/Logos/Mar-Brasil-sem-fundo-preto.png"
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
          <button
            className={styles.backBtn}
            onClick={() => setIsExportModalOpen(true)}
            id="btn-relatorio-seguros"
            title="Gerar Relatório Gamma"
            style={{ color: '#059669', borderColor: '#059669' }}
          >
            <FileText size={14} />
            <span>Relatório</span>
          </button>
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
                onToggleActive={handleToggleActive}
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

      {/* ── MODAL EXPORT/GAMMA ── */}
      <InsuranceExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onPreview={handlePreviewInsurance}
        onExport={handleExportInsurance}
        isExporting={isExporting}
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
