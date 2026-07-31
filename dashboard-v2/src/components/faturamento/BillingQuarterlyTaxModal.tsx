import React from 'react';
import styles from './faturamento.module.css';
import { BillingQuarterlyTaxes } from '@/types/billing.types';
import { Landmark, Calendar, ShieldCheck, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  taxes: BillingQuarterlyTaxes[];
}

export const BillingQuarterlyTaxModal: React.FC<Props> = ({ isOpen, onClose, taxes }) => {
  if (!isOpen) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const totalTrimestralYear = taxes.reduce((acc, t) => acc + t.total_quarterly_tax, 0);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '750px' }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Landmark size={20} color="#f59e0b" />
            <div>
              <h3 className={styles.modalTitle}>Apuração Trimestral IRPJ & CSLL</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Previsão de impostos federais com adicional de IRPJ (Reforma LC 224/2025)
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Informação sobre os Trimestres e Vencimentos */}
        <div style={{ background: '#0b1120', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.78rem', color: '#cbd5e1' }}>
          <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={14} />
            <span>Cronograma de Apuração & Vencimentos Oficiais</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: '1.5' }}>
            <li><strong>1º Trimestre (Jan a Mar):</strong> Vencimento em <strong>30 de Abril</strong></li>
            <li><strong>2º Trimestre (Abr a Jun):</strong> Vencimento em <strong>31 de Julho</strong></li>
            <li><strong>3º Trimestre (Jul a Set):</strong> Vencimento em <strong>31 de Outubro</strong></li>
            <li><strong>4º Trimestre (Out a Dez):</strong> Vencimento em <strong>31 de Janeiro</strong> (ano seguinte)</li>
          </ul>
        </div>

        {/* Quadro dos 4 Trimestres */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          {taxes.map((t, idx) => (
            <div key={idx} style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.9rem' }}>
                  {t.quarter} ({t.due_month_label}/{t.year})
                </span>
                <span style={{ fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px', border: '1px solid #3b82f6' }}>
                  Venc: {t.due_date.split('-').reverse().join('/')}
                </span>
              </div>

              <div style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Faturamento Bruto:</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{formatCurrency(t.gross_revenue_quarter)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Base Lucro Presumido (32%):</span>
                  <span style={{ color: '#cbd5e1' }}>{formatCurrency(t.irpj_base)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>IRPJ Regular (15%):</span>
                  <span style={{ color: '#cbd5e1' }}>{formatCurrency(t.irpj_regular)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>CSLL Regular (9%):</span>
                  <span style={{ color: '#cbd5e1' }}>{formatCurrency(t.csll_regular)}</span>
                </div>
                {t.irpj_excedente > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fb7185', fontWeight: 600 }}>
                    <span>IRPJ Excedente (LC 224 +10%):</span>
                    <span>{formatCurrency(t.irpj_excedente)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed rgba(255,255,255,0.1)', fontWeight: 800, fontSize: '0.85rem' }}>
                  <span style={{ color: '#ffffff' }}>Total Imposto Trimestral:</span>
                  <span style={{ color: '#f59e0b' }}>{formatCurrency(t.total_quarterly_tax)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Resumo Consolidado do Ano */}
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={20} color="#10b981" />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff' }}>Total Apurado de IRPJ & CSLL</div>
              <div style={{ fontSize: '0.72rem', color: '#a7f3d0' }}>Soma consolidada dos 4 trimestres de apuração</div>
            </div>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981' }}>
            {formatCurrency(totalTrimestralYear)}
          </div>
        </div>
      </div>
    </div>
  );
};
