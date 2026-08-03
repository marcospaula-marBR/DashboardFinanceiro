import React from 'react';
import styles from '@/components/faturamento/faturamento.module.css';
import { RecebiveisKpiSummary } from '@/types/recebiveis';
import { PieChart, TrendingUp, Users, Percent } from 'lucide-react';

interface Props {
  summary: RecebiveisKpiSummary;
}

export const RecebiveisCharts: React.FC<Props> = ({ summary }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const totalGross = summary.total_gross || 1;
  const pctB2G = ((summary.gross_b2g / totalGross) * 100).toFixed(1);
  const pctB2B = ((summary.gross_b2b / totalGross) * 100).toFixed(1);
  const pctB2C = ((summary.gross_b2c / totalGross) * 100).toFixed(1);
  const pctOutsourced = ((summary.gross_outsourced / totalGross) * 100).toFixed(1);

  return (
    <div className={styles.chartsGrid}>
      {/* Representatividade por Segmento (% Rateio de Despesas) */}
      <div className={styles.chartCard}>
        <div className={styles.chartTitleArea}>
          <div className={styles.chartTitleGroup}>
            <Percent size={16} color="#f59e0b" />
            <span>Representatividade por Segmento (% Rateio de Despesas)</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Base: Faturamento Bruto</span>
        </div>

        <div className={styles.barList}>
          {/* B2G */}
          <div className={styles.barItem}>
            <div className={styles.barHeader}>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>B2G (Governo / Público)</span>
              <span>{pctB2G}% ({formatCurrency(summary.gross_b2g)})</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${pctB2G}%`, background: '#3b82f6' }} />
            </div>
          </div>

          {/* B2B */}
          <div className={styles.barItem}>
            <div className={styles.barHeader}>
              <span style={{ color: '#34d399', fontWeight: 700 }}>B2B (Empresas / Privado)</span>
              <span>{pctB2B}% ({formatCurrency(summary.gross_b2b)})</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${pctB2B}%`, background: '#10b981' }} />
            </div>
          </div>

          {/* B2C */}
          <div className={styles.barItem}>
            <div className={styles.barHeader}>
              <span style={{ color: '#fbbf24', fontWeight: 700 }}>B2C</span>
              <span>{pctB2C}% ({formatCurrency(summary.gross_b2c)})</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${pctB2C}%`, background: '#f59e0b' }} />
            </div>
          </div>

          {/* Terceirização */}
          <div className={styles.barItem}>
            <div className={styles.barHeader}>
              <span style={{ color: '#f43f5e', fontWeight: 700 }}>Terceirização (Execução por Terceiros)</span>
              <span>{pctOutsourced}% ({formatCurrency(summary.gross_outsourced)})</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${pctOutsourced}%`, background: '#f43f5e' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Resumo de Liquidez & Eficiência Tributária */}
      <div className={styles.chartCard} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className={styles.chartTitleArea}>
          <div className={styles.chartTitleGroup}>
            <TrendingUp size={16} color="#10b981" />
            <span>Resumo de Liquidez & Eficiência Tributária</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
          <div style={{ background: '#0b1120', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Índice de Retenção Fiscal na Fonte</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f43f5e' }}>
              {summary.total_gross > 0 ? ((summary.total_retained_taxes / summary.total_gross) * 100).toFixed(1) : '0.0'}%
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Impacto das retenções de PIS, COFINS, ISS, INSS e IRRF</div>
          </div>

          <div style={{ background: '#0b1120', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Conversão de Faturamento em Líquido Real</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
              {summary.total_gross > 0 ? ((summary.total_net / summary.total_gross) * 100).toFixed(1) : '0.0'}%
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Conversão efetiva de Faturado Bruto em Caixa Líquido</div>
          </div>
        </div>
      </div>
    </div>
  );
};
