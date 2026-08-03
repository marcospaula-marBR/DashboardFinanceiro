import React, { useState } from 'react';
import styles from '@/components/faturamento/faturamento.module.css';
import { RecebimentoItem } from '@/types/recebiveis';
import { ChevronDown, ChevronUp, Users, CheckCircle2, Clock, Edit3, Trash2, Sparkles, FileText } from 'lucide-react';

interface Props {
  items: RecebimentoItem[];
  onOpenEditModal: (item: RecebimentoItem) => void;
  onDelete: (id: string) => void;
  onLiquidate: (id: string) => void;
}

export const RecebiveisTable: React.FC<Props> = ({
  items,
  onOpenEditModal,
  onDelete,
  onLiquidate
}) => {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  if (items.length === 0) {
    return (
      <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <FileText size={36} color="#64748b" style={{ marginBottom: '0.5rem' }} />
        <div style={{ fontWeight: 700, color: '#e2e8f0' }}>Nenhum recebimento ou faturamento encontrado.</div>
        <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
          Clique em <strong>"+ Novo Recebimento"</strong> para lançamento manual ou <strong>"⚡ Sincronizar Omie"</strong> para importar do ERP.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableHeaderArea}>
        <div className={styles.tableHeaderTitle}>
          <span>Matriz de Recebimentos & Comissões</span>
          <span className={styles.tableCountBadge}>{items.length} Lançamentos</span>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '85px' }}>Origem</th>
              <th>Empresa</th>
              <th>Nota / OS</th>
              <th>Cliente (Razão Social) / Contrato</th>
              <th style={{ textAlign: 'center' }}>Segmento</th>
              <th style={{ textAlign: 'center' }}>Terceirizado</th>
              <th>Data Reg.</th>
              <th>Vencimento</th>
              <th style={{ textAlign: 'right' }}>Faturado Bruto</th>
              <th style={{ textAlign: 'right' }}>Impostos Retidos</th>
              <th style={{ textAlign: 'right' }}>Líquido Real</th>
              <th style={{ textAlign: 'center' }}>Comissão</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const isExpanded = expandedRows[item.id] || false;
              const hasComm = item.commission && item.commission.has_commission;
              const commVal = hasComm ? item.commission.total_commission_value : 0;

              return (
                <React.Fragment key={item.id}>
                  <tr style={{ background: isExpanded ? 'rgba(30, 41, 59, 0.4)' : undefined }}>
                    
                    {/* Origem: Omie vs Manual */}
                    <td>
                      {item.source === 'OMIE' ? (
                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 700 }}>
                          ⚡ Omie
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 700 }}>
                          ✍️ Manual
                        </span>
                      )}
                    </td>

                    {/* Empresa */}
                    <td>
                      <span className={item.company_name === 'Mar Brasil' ? styles.badgeMarBrasil : styles.badgeDZM}>
                        {item.company_name}
                      </span>
                    </td>

                    {/* Nota / OS */}
                    <td>
                      <strong style={{ color: '#ffffff', fontSize: '0.85rem' }}>{item.invoice_number}</strong>
                    </td>

                    {/* Cliente / Contrato */}
                    <td>
                      <div className={styles.clientName}>{item.client_name}</div>
                      <div className={styles.contractSub}>
                        {item.contract_name} {item.contract_number ? `(${item.contract_number})` : ''}
                      </div>
                    </td>

                    {/* Segmento Limpo: B2G, B2B, B2C */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={
                        item.segment_type === 'B2G' ? styles.badgeB2G :
                        item.segment_type === 'B2B' ? styles.badgeB2B : styles.badgeB2C
                      }>
                        {item.segment_type}
                      </span>
                    </td>

                    {/* Terceirizado */}
                    <td style={{ textAlign: 'center' }}>
                      {item.is_outsourced ? (
                        <span className={styles.badgeTerceirizada}>SIM (Terceirizado)</span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>NÃO (Próprio)</span>
                      )}
                    </td>

                    {/* Datas */}
                    <td>{formatDate(item.date_registration)}</td>
                    <td>
                      <div style={{ color: item.status === 'Pago' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                        {formatDate(item.date_due)}
                      </div>
                      {item.date_payment && (
                        <div style={{ fontSize: '0.65rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <CheckCircle2 size={10} /> Pago: {formatDate(item.date_payment)}
                        </div>
                      )}
                    </td>

                    {/* Valores */}
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>
                      {formatCurrency(item.value_gross)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#f43f5e' }}>
                      {formatCurrency(item.tax_retained_total)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                      {formatCurrency(item.value_net)}
                    </td>

                    {/* Comissão */}
                    <td style={{ textAlign: 'center' }}>
                      {hasComm ? (
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: '2px 8px', fontSize: '0.7rem', color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.4)' }}
                          onClick={() => onOpenEditModal(item)}
                        >
                          <Users size={12} />
                          <span>{formatCurrency(commVal)}</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>N/A</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ textAlign: 'center' }}>
                      {item.status === 'Pago' ? (
                        <span className={styles.statusBadgePago}>PAGO</span>
                      ) : (
                        <button
                          className={styles.statusBadgePendente}
                          onClick={() => onLiquidate(item.id)}
                          title="Clique para Dar Baixa / Liquidar Recebimento"
                        >
                          PENDENTE
                        </button>
                      )}
                    </td>

                    {/* Ações */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                          onClick={() => onOpenEditModal(item)}
                          title="Ajustar Lançamento e Comissões"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#f43f5e' }}
                          onClick={() => onDelete(item.id)}
                          title="Excluir Lançamento"
                        >
                          <Trash2 size={12} />
                        </button>
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => toggleExpand(item.id)}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Painel Expansível Detalhado */}
                  {isExpanded && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={14}>
                        <div className={styles.expandedContent} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                          
                          {/* Detalhamento de Impostos Retidos */}
                          <div style={{ background: '#0b1120', padding: '0.75rem', borderRadius: '6px' }}>
                            <div style={{ fontWeight: 700, color: '#f43f5e', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                              Detalhamento de Impostos Retidos
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div>IRRF (Retido): {formatCurrency(item.tax_irrf)}</div>
                              <div>ISS (Retido): {formatCurrency(item.tax_iss)}</div>
                              <div>PIS (0.65%): {formatCurrency(item.tax_pis)}</div>
                              <div>COFINS (3.00%): {formatCurrency(item.tax_cofins)}</div>
                              <div>INSS (Retido): {formatCurrency(item.tax_inss)}</div>
                              <div style={{ fontWeight: 700, color: '#f43f5e', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2px', marginTop: '2px' }}>
                                Total Retenções: {formatCurrency(item.tax_retained_total)}
                              </div>
                            </div>
                          </div>

                          {/* Rateio de Comissões por Colaborador do People Board */}
                          <div style={{ background: '#0b1120', padding: '0.75rem', borderRadius: '6px' }}>
                            <div style={{ fontWeight: 700, color: '#8b5cf6', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                              Rateio de Comissões (People Board)
                            </div>
                            {hasComm && item.commission.participants.length > 0 ? (
                              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div>Montante Isento: {formatCurrency(item.commission.value_non_commissionable)}</div>
                                <div>Base Comissionável: {formatCurrency(item.commission.value_commissionable_base)}</div>
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '3px', marginTop: '3px' }}>
                                  {item.commission.participants.map((p, pIdx) => (
                                    <div key={pIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span>{p.name} ({p.sector}):</span>
                                      <strong style={{ color: '#a78bfa' }}>{formatCurrency(p.calculated_value)}</strong>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Sem comissão parametrizada neste faturamento.</div>
                            )}
                          </div>

                          {/* Datas & Identificadores */}
                          <div style={{ background: '#0b1120', padding: '0.75rem', borderRadius: '6px' }}>
                            <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                              Datas & Identificação
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div>Data de Registro: {formatDate(item.date_registration)}</div>
                              <div>Data de Emissão: {formatDate(item.date_issue)}</div>
                              <div>Data de Vencimento: {formatDate(item.date_due)}</div>
                              <div>Status de Caixa: {item.status} {item.date_payment ? `(${formatDate(item.date_payment)})` : ''}</div>
                            </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
