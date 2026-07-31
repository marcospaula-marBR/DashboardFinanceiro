import React, { useState } from 'react';
import styles from './faturamento.module.css';
import { BillingItem } from '@/types/billing.types';
import { ChevronDown, ChevronUp, Users, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  items: BillingItem[];
  onOpenCommissionModal: (item: BillingItem) => void;
}

export const BillingTable: React.FC<Props> = ({ items, onOpenCommissionModal }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className={styles.tableCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#f8fafc' }}>
          <FileText size={16} color="#f59e0b" />
          <span>Matriz de Lançamentos de Faturamento ({items.length})</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Nota / OS</th>
              <th>Cliente (Omie)</th>
              <th>Segmento</th>
              <th>Terceirização</th>
              <th>Data Registro</th>
              <th>Vencimento</th>
              <th style={{ textAlign: 'right' }}>Faturado Bruto</th>
              <th style={{ textAlign: 'right' }}>Impostos Retidos</th>
              <th style={{ textAlign: 'right' }}>Líquido Real</th>
              <th style={{ textAlign: 'center' }}>Comissão</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  Nenhum faturamento localizado com os filtros selecionados.
                </td>
              </tr>
            ) : (
              items.map(item => {
                const isExpanded = expandedId === item.id;
                return (
                  <React.Fragment key={item.id}>
                    <tr>
                      <td style={{ fontWeight: 700, color: item.company_name === 'Mar Brasil' ? '#f59e0b' : '#3b82f6' }}>
                        {item.company_name}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>{item.invoice_number}</div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{item.contract_number}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.client_name}</div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{item.city_of_service || item.contract_name}</div>
                      </td>
                      <td>
                        <span className={
                          item.segment_type === 'B2G' ? styles.badgeB2G :
                          item.segment_type === 'B2B' ? styles.badgeB2B : styles.badgeB2C
                        }>
                          {item.segment_type}
                        </span>
                      </td>
                      <td>
                        {item.is_outsourced ? (
                          <span className={styles.badgeTerceirizada}>SIM (Terceirizado)</span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>NÃO (Próprio)</span>
                        )}
                      </td>
                      <td>{formatDate(item.date_registration)}</td>
                      <td>
                        <div style={{ color: item.date_payment ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                          {formatDate(item.date_due)}
                        </div>
                        {item.date_payment && (
                          <div style={{ fontSize: '0.65rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <CheckCircle2 size={10} /> Pago: {formatDate(item.date_payment)}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>
                        {formatCurrency(item.value_gross)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#f43f5e' }}>
                        {formatCurrency(item.tax_retained_total)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                        {formatCurrency(item.value_net)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.commission.has_commission ? (
                          <button
                            className={styles.btnSecondary}
                            style={{ padding: '2px 8px', fontSize: '0.7rem', color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.4)' }}
                            onClick={() => onOpenCommissionModal(item)}
                          >
                            <Users size={12} />
                            <span>{formatCurrency(item.commission.total_commission_value)}</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>N/A</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => toggleExpand(item.id)}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                    </tr>

                    {/* Detalhamento Expansível */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={12} style={{ padding: 0, background: '#070b14' }}>
                          <div className={styles.detailBox}>
                            <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <AlertCircle size={14} />
                              <span>Detalhamento Fiscal & Retenções Fiscais</span>
                            </div>

                            <div className={styles.detailGrid}>
                              <div>
                                <div className={styles.detailLabel}>Imposto PIS</div>
                                <div className={styles.detailValue}>{formatCurrency(item.tax_pis)}</div>
                              </div>

                              <div>
                                <div className={styles.detailLabel}>Imposto COFINS</div>
                                <div className={styles.detailValue}>{formatCurrency(item.tax_cofins)}</div>
                              </div>

                              <div>
                                <div className={styles.detailLabel}>Imposto ISS</div>
                                <div className={styles.detailValue}>{formatCurrency(item.tax_iss)}</div>
                              </div>

                              <div>
                                <div className={styles.detailLabel}>Imposto INSS</div>
                                <div className={styles.detailValue}>{formatCurrency(item.tax_inss)}</div>
                              </div>

                              <div>
                                <div className={styles.detailLabel}>IRRF Retido</div>
                                <div className={styles.detailValue}>{formatCurrency(item.tax_irrf)}</div>
                              </div>

                              <div>
                                <div className={styles.detailLabel}>Data Lançamento/Emissão</div>
                                <div className={styles.detailValue}>{formatDate(item.date_issue)}</div>
                              </div>
                            </div>

                            {/* Comissões Detalhadas */}
                            {item.commission.has_commission && item.commission.participants && item.commission.participants.length > 0 && (
                              <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '0.4rem' }}>
                                  Rateio de Comissões Cadastradas (Base: {formatCurrency(item.commission.value_commissionable_base)}):
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  {item.commission.participants.map((p, idx) => (
                                    <div key={idx} style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', color: '#e2e8f0' }}>
                                      <strong>{p.name}</strong> ({p.sector}): {formatCurrency(p.calculated_value)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
