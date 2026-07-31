import React from 'react';
import styles from './faturamento.module.css';
import { BillingKpiSummary } from '@/types/billing.types';
import { PieChart, TrendingUp } from 'lucide-react';

interface Props {
  summary: BillingKpiSummary;
}

export const BillingSegmentCharts: React.FC<Props> = ({ summary }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className={styles.shareSection}>
      {/* Representatividade e Rateio de Despesas por Segmento */}
      <div className={styles.chartCard}>
        <div className={styles.chartTitle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={16} color="#f59e0b" />
            <span>Representatividade por Segmento (% Rateio de Despesas)</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>Faturamento Bruto</span>
        </div>

        <div style={{ marginTop: '1rem' }}>
          {/* B2G */}
          <div className={styles.shareBarItem}>
            <div className={styles.shareHeader}>
              <span>🏛️ B2G (Governo / Público)</span>
              <span>{summary.pct_b2g.toFixed(1)}% ({formatCurrency(summary.gross_b2g)})</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressBar} style={{ width: `${summary.pct_b2g}%`, backgroundColor: '#3b82f6' }} />
            </div>
          </div>

          {/* B2B */}
          <div className={styles.shareBarItem}>
            <div className={styles.shareHeader}>
              <span>🏢 B2B (Empresas / Privado)</span>
              <span>{summary.pct_b2b.toFixed(1)}% ({formatCurrency(summary.gross_b2b)})</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressBar} style={{ width: `${summary.pct_b2b}%`, backgroundColor: '#10b981' }} />
            </div>
          </div>

          {/* B2C */}
          <div className={styles.shareBarItem}>
            <div className={styles.shareHeader}>
              <span>👤 B2C (Consumidor Final / Condomínios)</span>
              <span>{summary.pct_b2c.toFixed(1)}% ({formatCurrency(summary.gross_b2c)})</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressBar} style={{ width: `${summary.pct_b2c}%`, backgroundColor: '#f59e0b' }} />
            </div>
          </div>

          {/* Terceirização */}
          <div className={styles.shareBarItem}>
            <div className={styles.shareHeader}>
              <span>⚙️ Terceirização (Execução por Terceiros)</span>
              <span>{summary.pct_outsourced.toFixed(1)}% ({formatCurrency(summary.gross_outsourced)})</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressBar} style={{ width: `${summary.pct_outsourced}%`, backgroundColor: '#f43f5e' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Resumo de Eficiência Operacional */}
      <div className={styles.chartCard} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className={styles.chartTitle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={16} color="#10b981" />
            <span>Resumo de Liquidez</span>
          </div>
        </div>

        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Índice de Retenção Fiscal</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f43f5e' }}>
              {summary.total_gross > 0 ? ((summary.total_retained_taxes / summary.total_gross) * 100).toFixed(1) : 0}%
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Impacto das retenções de PIS/COFINS/ISS/IRRF</div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Margem Líquida Pós-Retenções</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
              {summary.total_gross > 0 ? ((summary.total_net / summary.total_gross) * 100).toFixed(1) : 0}%
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Conversão de Faturado em Líquido</div>
          </div>
        </div>
      </div>
    </div>
  );
};
