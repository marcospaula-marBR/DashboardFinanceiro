import React, { useState, useEffect } from 'react';
import styles from './faturamento.module.css';
import { BillingItem, SegmentType, CommissionParticipant } from '@/types/billing.types';
import { Edit3, Users, Check, X, Shield, Plus, Trash2, Tag, Layers } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: BillingItem | null;
  onSave: (itemId: string, updatedFields: Partial<BillingItem>) => void;
}

export const BillingEditModal: React.FC<Props> = ({ isOpen, onClose, item, onSave }) => {
  const [segmentType, setSegmentType] = useState<SegmentType>('B2B');
  const [isOutsourced, setIsOutsourced] = useState<boolean>(false);
  const [valueNonCommissionable, setValueNonCommissionable] = useState<number>(0);
  const [valueDiscount, setValueDiscount] = useState<number>(0);
  const [valueFees, setValueFees] = useState<number>(0);
  const [valueInterestPenalty, setValueInterestPenalty] = useState<number>(0);

  // Comissões
  const [hasCommission, setHasCommission] = useState<boolean>(false);
  const [participants, setParticipants] = useState<CommissionParticipant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState<string>('');
  const [newParticipantSector, setNewParticipantSector] = useState<string>('Comercial');
  const [newParticipantRate, setNewParticipantRate] = useState<number>(5);
  const [newParticipantType, setNewParticipantType] = useState<'percent' | 'fixed'>('percent');

  useEffect(() => {
    if (item) {
      setSegmentType(item.segment_type || 'B2B');
      setIsOutsourced(item.is_outsourced || false);
      setValueDiscount(item.value_discount || 0);
      setValueFees(item.value_fees || 0);
      setValueInterestPenalty(item.value_interest_penalty || 0);

      setHasCommission(item.commission?.has_commission || false);
      setValueNonCommissionable(item.commission?.value_non_commissionable || 0);
      setParticipants(item.commission?.participants || []);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Recálculos ao vivo
  const gross = item.value_gross;
  const retainedTaxes = item.tax_retained_total;
  const netValue = gross - retainedTaxes - valueFees - valueDiscount + valueInterestPenalty;

  const commissionableBase = Math.max(0, netValue - valueNonCommissionable);

  const updatedParticipants = participants.map(p => {
    const val = p.type === 'percent' ? (commissionableBase * (p.rate || 0)) / 100 : (p.rate || 0);
    return { ...p, calculated_value: val };
  });

  const totalCommissionValue = updatedParticipants.reduce((acc, p) => acc + p.calculated_value, 0);
  const totalCommissionPercent = commissionableBase > 0 ? (totalCommissionValue / commissionableBase) * 100 : 0;

  const handleAddParticipant = () => {
    if (!newParticipantName) return;
    const newPart: CommissionParticipant = {
      id: `part-${Date.now()}`,
      name: newParticipantName,
      sector: newParticipantSector,
      type: newParticipantType,
      rate: newParticipantRate,
      calculated_value: 0
    };
    setParticipants([...participants, newPart]);
    setNewParticipantName('');
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const handleSave = () => {
    const segmentAllocations: Array<SegmentType | 'Terceirização'> = [segmentType];
    if (isOutsourced) segmentAllocations.push('Terceirização');

    onSave(item.id, {
      segment_type: segmentType,
      is_outsourced: isOutsourced,
      value_discount: valueDiscount,
      value_fees: valueFees,
      value_interest_penalty: valueInterestPenalty,
      value_net: netValue,
      segment_allocations: segmentAllocations,
      commission: {
        has_commission: hasCommission,
        value_non_commissionable: valueNonCommissionable,
        value_commissionable_base: commissionableBase,
        total_commission_percent: totalCommissionPercent,
        total_commission_value: hasCommission ? totalCommissionValue : 0,
        participants: hasCommission ? updatedParticipants : []
      }
    });
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Edit3 size={20} color="#f59e0b" />
            <div>
              <h3 className={styles.modalTitle}>Ajustar / Preencher Faturamento</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Nota: <strong>{item.invoice_number}</strong> — {item.client_name}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* 1. Classificação do Segmento e Terceirização */}
        <div style={{ background: '#0b1120', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={14} />
            <span>Classificação do Faturamento</span>
          </div>

          <div className={styles.filterGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Tipo de Segmento */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Segmento do Faturamento</label>
              <select
                className={styles.selectInput}
                value={segmentType}
                onChange={e => setSegmentType(e.target.value as SegmentType)}
              >
                <option value="B2G">B2G (Governo / Órgão Público)</option>
                <option value="B2B">B2B (Empresas / Privado)</option>
                <option value="B2C">B2C (Consumidor Final)</option>
              </select>
            </div>

            {/* Terceirização */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Terceirização (Executado por Terceiros?)</label>
              <select
                className={styles.selectInput}
                value={isOutsourced ? 'YES' : 'NO'}
                onChange={e => setIsOutsourced(e.target.value === 'YES')}
              >
                <option value="NO">Não (Serviço Próprio)</option>
                <option value="YES">Sim (Serviço Terceirizado)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. Ajuste de Valores e Deduções */}
        <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Tag size={14} />
            <span>Resumo Financeiro & Deduções</span>
          </div>

          <div className={styles.filterGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div>
              <div className={styles.detailLabel}>Faturado Bruto</div>
              <div className={styles.detailValue} style={{ color: '#ffffff' }}>{formatCurrency(gross)}</div>
            </div>

            <div>
              <div className={styles.detailLabel}>Impostos Retidos</div>
              <div className={styles.detailValue} style={{ color: '#f43f5e' }}>{formatCurrency(retainedTaxes)}</div>
            </div>

            <div>
              <label className={styles.filterLabel}>Tarifas & Taxas (R$)</label>
              <input
                type="number"
                className={styles.textInput}
                value={valueFees}
                onChange={e => setValueFees(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <div className={styles.detailLabel}>Líquido Real Calculado</div>
              <div className={styles.detailValue} style={{ color: '#10b981' }}>{formatCurrency(netValue)}</div>
            </div>
          </div>
        </div>

        {/* 3. Configuração de Comissões */}
        <div style={{ background: '#0b1120', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#8b5cf6' }}>
              <Users size={16} />
              <span>Configuração de Comissões</span>
            </div>

            <select
              className={styles.selectInput}
              value={hasCommission ? 'YES' : 'NO'}
              onChange={e => setHasCommission(e.target.value === 'YES')}
              style={{ width: 'auto', fontWeight: 700, color: hasCommission ? '#10b981' : '#f43f5e' }}
            >
              <option value="NO">NÃO (Sem Comissão)</option>
              <option value="YES">SIM (Com Comissão)</option>
            </select>
          </div>

          {hasCommission && (
            <>
              {/* Valor Não Comissionável */}
              <div className={styles.filterGrid} style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
                <div>
                  <label className={styles.filterLabel}>Valor NÃO Comissionável (R$)</label>
                  <input
                    type="number"
                    className={styles.textInput}
                    value={valueNonCommissionable}
                    onChange={e => setValueNonCommissionable(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                  />
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                    Subtraído do Líquido para apurar a Base Comissionável
                  </div>
                </div>

                <div>
                  <div className={styles.detailLabel}>Base Comissionável Resultante</div>
                  <div className={styles.detailValue} style={{ color: '#f59e0b', fontSize: '1.1rem' }}>
                    {formatCurrency(commissionableBase)}
                  </div>
                </div>
              </div>

              {/* Inclusão de Colaboradores (People) / Setores */}
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '0.5rem' }}>
                  Incluir Colaborador (People Board) ou Setor no Rateio:
                </div>

                <div className={styles.filterGrid} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto', alignItems: 'end' }}>
                  <div>
                    <label className={styles.filterLabel}>Nome do Colaborador / Setor</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="Ex: Gabriel Bellini / Comercial"
                      value={newParticipantName}
                      onChange={e => setNewParticipantName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={styles.filterLabel}>Setor</label>
                    <select
                      className={styles.selectInput}
                      value={newParticipantSector}
                      onChange={e => setNewParticipantSector(e.target.value)}
                    >
                      <option value="Comercial">Comercial</option>
                      <option value="Operações">Operações</option>
                      <option value="Engenharia">Engenharia</option>
                      <option value="Diretoria">Diretoria</option>
                    </select>
                  </div>

                  <div>
                    <label className={styles.filterLabel}>Tipo</label>
                    <select
                      className={styles.selectInput}
                      value={newParticipantType}
                      onChange={e => setNewParticipantType(e.target.value as 'percent' | 'fixed')}
                    >
                      <option value="percent">% Porcentagem</option>
                      <option value="fixed">R$ Fixo</option>
                    </select>
                  </div>

                  <div>
                    <label className={styles.filterLabel}>{newParticipantType === 'percent' ? 'Taxa (%)' : 'Valor (R$)'}</label>
                    <input
                      type="number"
                      className={styles.textInput}
                      value={newParticipantRate}
                      onChange={e => setNewParticipantRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <button className={styles.btnPrimary} onClick={handleAddParticipant} style={{ padding: '0.45rem 0.75rem' }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Lista de Participantes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                {updatedParticipants.map((p, idx) => (
                  <div key={idx} style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.5.rem 0.85rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.8rem' }}>
                      <strong style={{ color: '#ffffff' }}>{p.name}</strong> <span style={{ color: '#94a3b8' }}>({p.sector})</span> • {p.type === 'percent' ? `${p.rate}%` : formatCurrency(p.rate)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontWeight: 800, color: '#8b5cf6', fontSize: '0.85rem' }}>{formatCurrency(p.calculated_value)}</span>
                      <button className={styles.closeBtn} onClick={() => handleRemoveParticipant(p.id)}>
                        <Trash2 size={14} color="#f43f5e" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Comissões */}
              <div style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Total de Comissões no Lançamento:</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#8b5cf6' }}>{formatCurrency(totalCommissionValue)}</span>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSave}>
            <Check size={14} />
            <span>Salvar Ajustes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
