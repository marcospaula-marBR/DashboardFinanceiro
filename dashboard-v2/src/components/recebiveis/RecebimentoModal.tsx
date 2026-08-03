import React, { useState, useEffect } from 'react';
import styles from '@/components/faturamento/faturamento.module.css';
import { RecebimentoItem, ContratoParam, CommissionableEmployee, CommissionParticipant } from '@/types/recebiveis';
import { RecebiveisService } from '@/services/recebiveis.service';
import { Plus, Trash2, Check, X, Users, DollarSign, Edit3, ShieldCheck, Tag } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: RecebimentoItem | null;
  contracts: ContratoParam[];
  onSave: (savedItem: RecebimentoItem) => void;
}

export const RecebimentoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  item,
  contracts,
  onSave
}) => {
  const [companyName, setCompanyName] = useState<'Mar Brasil' | 'DZM'>('Mar Brasil');
  const [contractId, setContractId] = useState<string>('');
  const [contractName, setContractName] = useState<string>('');
  const [contractNumber, setContractNumber] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');

  const [dateRegistration, setDateRegistration] = useState<string>('');
  const [dateIssue, setDateIssue] = useState<string>('');
  const [dateDue, setDateDue] = useState<string>('');
  const [datePayment, setDatePayment] = useState<string>('');

  const [segmentType, setSegmentType] = useState<'B2G' | 'B2B' | 'B2C'>('B2B');
  const [isOutsourced, setIsOutsourced] = useState<boolean>(false);

  const [valueGross, setValueGross] = useState<number>(0);
  const [valueDiscount, setValueDiscount] = useState<number>(0);
  const [valueFees, setValueFees] = useState<number>(0);
  const [status, setStatus] = useState<'Pendente' | 'Pago'>('Pendente');

  // Retenções
  const [taxIrrf, setTaxIrrf] = useState<number>(0);
  const [taxIss, setTaxIss] = useState<number>(0);
  const [taxPis, setTaxPis] = useState<number>(0);
  const [taxCofins, setTaxCofins] = useState<number>(0);
  const [taxInss, setTaxInss] = useState<number>(0);

  // Comissões
  const [hasCommission, setHasCommission] = useState<boolean>(false);
  const [commissionMode, setCommissionMode] = useState<'percent' | 'fixed'>('percent');
  const [valueNonCommissionable, setValueNonCommissionable] = useState<number>(0);
  const [totalCommissionPercent, setTotalCommissionPercent] = useState<number>(5);
  const [participants, setParticipants] = useState<CommissionParticipant[]>([]);

  // Busca Inteligente de Colaboradores elegíveis no People Board
  const [eligibleEmployees, setEligibleEmployees] = useState<CommissionableEmployee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [newPartRate, setNewPartRate] = useState<number>(1);
  const [newPartType, setNewPartType] = useState<'percent' | 'fixed'>('percent');

  useEffect(() => {
    // Carregar colaboradores elegíveis (Filtro Inteligente de People Board)
    RecebiveisService.getCommissionableEmployees().then(list => {
      setEligibleEmployees(list);
      if (list.length > 0) setSelectedEmpId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (item) {
      setCompanyName(item.company_name || 'Mar Brasil');
      setContractId(item.contract_id || '');
      setContractName(item.contract_name || '');
      setContractNumber(item.contract_number || '');
      setClientName(item.client_name || '');
      setInvoiceNumber(item.invoice_number || '');

      setDateRegistration(item.date_registration || new Date().toISOString().substring(0, 10));
      setDateIssue(item.date_issue || new Date().toISOString().substring(0, 10));
      setDateDue(item.date_due || new Date().toISOString().substring(0, 10));
      setDatePayment(item.date_payment || '');

      setSegmentType(item.segment_type || 'B2B');
      setIsOutsourced(item.is_outsourced || false);

      setValueGross(item.value_gross || 0);
      setValueDiscount(item.value_discount || 0);
      setValueFees(item.value_fees || 0);
      setStatus(item.status === 'Pago' ? 'Pago' : 'Pendente');

      setTaxIrrf(item.tax_irrf || 0);
      setTaxIss(item.tax_iss || 0);
      setTaxPis(item.tax_pis || 0);
      setTaxCofins(item.tax_cofins || 0);
      setTaxInss(item.tax_inss || 0);

      setHasCommission(item.commission?.has_commission || false);
      setCommissionMode(item.commission?.commission_mode || 'percent');
      setValueNonCommissionable(item.commission?.value_non_commissionable || 0);
      setTotalCommissionPercent(item.commission?.total_commission_percent || 5);
      setParticipants(item.commission?.participants || []);
    } else {
      const today = new Date().toISOString().substring(0, 10);
      setDateRegistration(today);
      setDateIssue(today);
      setDateDue(today);
      setDatePayment('');
      setValueGross(0);
      setValueDiscount(0);
      setValueFees(0);
      setTaxIrrf(0);
      setTaxIss(0);
      setTaxPis(0);
      setTaxCofins(0);
      setTaxInss(0);
      setHasCommission(false);
      setValueNonCommissionable(0);
      setParticipants([]);
    }
  }, [item]);

  if (!isOpen) return null;

  // Recálculo ao vivo de Impostos Retidos e Líquido Real
  const taxRetainedTotal = taxIrrf + taxIss + taxPis + taxCofins + taxInss;
  const valueNet = Math.max(0, valueGross - taxRetainedTotal - valueFees - valueDiscount);

  // Recálculo da Base Comissionável e Comissões
  const commissionableBase = Math.max(0, valueNet - valueNonCommissionable);

  const updatedParticipants = participants.map(p => {
    const val = p.type === 'percent' ? (commissionableBase * (p.rate || 0)) / 100 : (p.rate || 0);
    return { ...p, calculated_value: val };
  });

  const totalCommissionValue = updatedParticipants.reduce((acc, p) => acc + p.calculated_value, 0);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleContractSelect = (cId: string) => {
    setContractId(cId);
    const matched = contracts.find(c => c.id === cId);
    if (matched) {
      setContractName(matched.contract_name);
      setContractNumber(matched.contract_number);
      setClientName(matched.client_name);
      setCompanyName(matched.company_name);
      setSegmentType(matched.segment_type);
      setIsOutsourced(matched.is_outsourced);
      setHasCommission(matched.has_commission);
      setCommissionMode(matched.commission_mode);
      setValueNonCommissionable(matched.value_non_commissionable || 0);
      setTotalCommissionPercent(matched.commission_rate || 5);
      setParticipants(matched.commission_participants || []);
    }
  };

  const handleAddParticipant = () => {
    const emp = eligibleEmployees.find(e => e.id === selectedEmpId);
    if (!emp) return;

    // Evitar duplicidades na mesma lista de comissões
    if (participants.some(p => p.id === emp.id)) return;

    const newPart: CommissionParticipant = {
      id: emp.id,
      name: emp.full_name,
      sector: emp.department || 'Geral',
      type: newPartType,
      rate: newPartRate,
      calculated_value: 0
    };
    setParticipants([...participants, newPart]);
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const handleSave = () => {
    if (!contractName) {
      alert('Informe ou selecione o contrato fonte.');
      return;
    }

    const saved: RecebimentoItem = {
      id: item?.id || `rec-${Date.now()}`,
      source: item?.source || 'MANUAL',
      omie_id: item?.omie_id,
      company_name: companyName,
      invoice_number: invoiceNumber || 'S/N',
      contract_id: contractId,
      contract_number: contractNumber,
      contract_name: contractName,
      client_name: clientName || 'Cliente Direto',

      segment_type: segmentType,
      is_outsourced: isOutsourced,

      date_registration: dateRegistration,
      date_issue: dateIssue,
      date_due: dateDue,
      date_payment: status === 'Pago' ? (datePayment || dateDue) : undefined,

      value_gross: valueGross,
      value_discount: valueDiscount,
      value_interest_penalty: 0,
      value_fees: valueFees,

      tax_pis: taxPis,
      tax_cofins: taxCofins,
      tax_iss: taxIss,
      tax_inss: taxInss,
      tax_irrf: taxIrrf,
      tax_retained_total: taxRetainedTotal,

      value_net: valueNet,
      status: status,

      commission: {
        has_commission: hasCommission,
        commission_mode: commissionMode,
        value_non_commissionable: valueNonCommissionable,
        value_commissionable_base: commissionableBase,
        total_commission_percent: totalCommissionPercent,
        total_commission_value: hasCommission ? totalCommissionValue : 0,
        participants: hasCommission ? updatedParticipants : []
      }
    };

    onSave(saved);
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '780px' }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Edit3 size={22} color="#f59e0b" />
            <div>
              <h3 className={styles.modalTitle}>{item ? 'Editar Recebimento / Faturamento' : 'Novo Lançamento Manual de Recebimento'}</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Lançamento direto com retenções fiscais e cálculo inteligente de comissões People
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* 1. Seleção de Contrato & Dados Principais */}
        <div style={{ background: '#0b1120', padding: '1rem', borderRadius: '10px', marginBottom: '1rem', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div className={styles.filterGrid} style={{ gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem' }}>
            
            <div style={{ gridColumn: 'span 3' }}>
              <label className={styles.filterLabel}>Vincular a Contrato Parametrizado</label>
              <select className={styles.selectInput} value={contractId} onChange={e => handleContractSelect(e.target.value)}>
                <option value="">Selecione um contrato cadastrado (opcional)...</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>
                    [{c.company_name}] {c.contract_number} — {c.contract_name} ({c.client_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={styles.filterLabel}>Empresa</label>
              <select className={styles.selectInput} value={companyName} onChange={e => setCompanyName(e.target.value as any)}>
                <option value="Mar Brasil">Mar Brasil Serviços</option>
                <option value="DZM">DZM Empreendimentos</option>
              </select>
            </div>

            <div>
              <label className={styles.filterLabel}>Nome do Projeto / Contrato</label>
              <input type="text" className={styles.textInput} placeholder="Ex: Climatização Sede" value={contractName} onChange={e => setContractName(e.target.value)} />
            </div>

            <div>
              <label className={styles.filterLabel}>Cliente (Razão Social)</label>
              <input type="text" className={styles.textInput} placeholder="Ex: Prefeitura ou Cliente" value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>

            <div>
              <label className={styles.filterLabel}>Nota Fiscal / OS</label>
              <input type="text" className={styles.textInput} placeholder="Ex: NF 202" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
            </div>

            <div>
              <label className={styles.filterLabel}>Classificação Segmento</label>
              <select className={styles.selectInput} value={segmentType} onChange={e => setSegmentType(e.target.value as any)}>
                <option value="B2G">B2G</option>
                <option value="B2B">B2B</option>
                <option value="B2C">B2C</option>
              </select>
            </div>

            <div>
              <label className={styles.filterLabel}>Terceirizado?</label>
              <select className={styles.selectInput} value={isOutsourced ? 'YES' : 'NO'} onChange={e => setIsOutsourced(e.target.value === 'YES')}>
                <option value="NO">Não (Serviço Próprio)</option>
                <option value="YES">Sim (Terceirizado)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. Datas & Status */}
        <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div className={styles.filterGrid} style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label className={styles.filterLabel}>Data Registro</label>
              <input type="date" className={styles.textInput} value={dateRegistration} onChange={e => setDateRegistration(e.target.value)} />
            </div>
            <div>
              <label className={styles.filterLabel}>Data Emissão</label>
              <input type="date" className={styles.textInput} value={dateIssue} onChange={e => setDateIssue(e.target.value)} />
            </div>
            <div>
              <label className={styles.filterLabel}>Data Vencimento</label>
              <input type="date" className={styles.textInput} value={dateDue} onChange={e => setDateDue(e.target.value)} />
            </div>
            <div>
              <label className={styles.filterLabel}>Status Pagamento</label>
              <select className={styles.selectInput} value={status} onChange={e => setStatus(e.target.value as any)}>
                <option value="Pendente">Pendente (Em Aberto)</option>
                <option value="Pago">Pago (Recebido)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Valores & Impostos Retidos */}
        <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', marginBottom: '0.5rem' }}>
            Valores & Tributos Retidos na Fonte
          </div>

          <div className={styles.filterGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label className={styles.filterLabel}>Valor Bruto (R$)</label>
              <input type="number" className={styles.textInput} value={valueGross} onChange={e => setValueGross(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={styles.filterLabel}>IRRF (R$)</label>
              <input type="number" className={styles.textInput} value={taxIrrf} onChange={e => setTaxIrrf(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={styles.filterLabel}>ISS (R$)</label>
              <input type="number" className={styles.textInput} value={taxIss} onChange={e => setTaxIss(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={styles.filterLabel}>PIS / COFINS (R$)</label>
              <input type="number" className={styles.textInput} value={taxPis + taxCofins} onChange={e => { const val = parseFloat(e.target.value) || 0; setTaxPis(val * 0.178); setTaxCofins(val * 0.822); }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b1120', padding: '0.6rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem' }}>
            <div>Retenção Fiscal Total: <strong style={{ color: '#f43f5e' }}>{formatCurrency(taxRetainedTotal)}</strong></div>
            <div>Líquido Real Resultante: <strong style={{ color: '#10b981', fontSize: '1rem' }}>{formatCurrency(valueNet)}</strong></div>
          </div>
        </div>

        {/* 4. Comissões & Busca Inteligente do People Board */}
        <div style={{ background: '#0b1120', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Users size={15} /> Regra de Comissionamento & People Board
            </span>
            <select className={styles.selectInput} value={hasCommission ? 'YES' : 'NO'} onChange={e => setHasCommission(e.target.value === 'YES')} style={{ width: 'auto', padding: '2px 8px', color: hasCommission ? '#10b981' : '#f43f5e' }}>
              <option value="NO">NÃO (Sem Comissão)</option>
              <option value="YES">SIM (Com Comissão)</option>
            </select>
          </div>

          {hasCommission && (
            <>
              {/* Parcela Não Comissionável / Isenta */}
              <div className={styles.filterGrid} style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className={styles.filterLabel}>Modo de Incidência</label>
                  <select className={styles.selectInput} value={commissionMode} onChange={e => setCommissionMode(e.target.value as any)}>
                    <option value="percent">% por Colaborador</option>
                    <option value="fixed">R$ Fixo por Colaborador</option>
                  </select>
                </div>

                <div>
                  <label className={styles.filterLabel}>Montante NÃO Comissionável (R$)</label>
                  <input type="number" className={styles.textInput} value={valueNonCommissionable} onChange={e => setValueNonCommissionable(parseFloat(e.target.value) || 0)} placeholder="0,00" />
                  <div style={{ fontSize: '0.62rem', color: '#64748b' }}>Deduz do líquido real</div>
                </div>

                <div>
                  <div className={styles.detailLabel}>Base Comissionável</div>
                  <div className={styles.detailValue} style={{ color: '#f59e0b', fontSize: '0.95rem' }}>{formatCurrency(commissionableBase)}</div>
                </div>
              </div>

              {/* Busca Inteligente de Colaboradores de People (Somente Plano de Comissão = SIM) */}
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a78bfa', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <ShieldCheck size={12} color="#10b981" />
                  <span>Busca Inteligente People (Somente Colaboradores com Plano de Comissão Ativado):</span>
                </div>

                <div className={styles.filterGrid} style={{ gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.4rem', alignItems: 'end' }}>
                  <div>
                    <select className={styles.selectInput} value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
                      {eligibleEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.department} - {emp.job_role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select className={styles.selectInput} value={newPartType} onChange={e => setNewPartType(e.target.value as any)}>
                      <option value="percent">% Taxa</option>
                      <option value="fixed">R$ Fixo</option>
                    </select>
                  </div>

                  <div>
                    <input type="number" className={styles.textInput} value={newPartRate} onChange={e => setNewPartRate(parseFloat(e.target.value) || 0)} />
                  </div>

                  <button className={styles.btnPrimary} onClick={handleAddParticipant} style={{ padding: '0.35rem 0.6rem' }}><Plus size={12} /></button>
                </div>
              </div>

              {/* Lista dos Participantes Adicionados */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {updatedParticipants.map((p, idx) => (
                  <div key={idx} style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.4rem 0.75rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <span><strong>{p.name}</strong> ({p.sector}) • {p.type === 'percent' ? `${p.rate}%` : formatCurrency(p.rate)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontWeight: 800, color: '#8b5cf6' }}>{formatCurrency(p.calculated_value)}</span>
                      <button className={styles.closeBtn} onClick={() => handleRemoveParticipant(p.id)}><Trash2 size={12} color="#f43f5e" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSave}>
            <Check size={14} /> Salvar Recebimento
          </button>
        </div>
      </div>
    </div>
  );
};
