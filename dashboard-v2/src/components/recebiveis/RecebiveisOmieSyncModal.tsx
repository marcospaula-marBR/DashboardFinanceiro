import React, { useState } from 'react';
import styles from '@/components/faturamento/faturamento.module.css';
import { DateReferenceType, RecebimentoItem } from '@/types/recebiveis';
import { RefreshCw, Check, X, Sparkles, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSyncSuccess: (newItems: RecebimentoItem[]) => void;
}

export const RecebiveisOmieSyncModal: React.FC<Props> = ({ isOpen, onClose, onSyncSuccess }) => {
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2026-12-31');
  const [filterBy, setFilterBy] = useState<DateReferenceType>('date_registration');
  const [company, setCompany] = useState<'ALL' | 'Mar Brasil' | 'DZM'>('ALL');
  const [avoidDuplicates, setAvoidDuplicates] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleRunSync = async () => {
    setIsLoading(true);
    setLogs(['Conectando às APIs oficiais do Omie ERP...']);
    setSyncedCount(null);

    try {
      const resp = await fetch('/api/faturamento/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          filterBy,
          company,
          avoidDuplicates
        })
      });

      const data = await resp.json();
      if (resp.ok && data.status === 'success') {
        setLogs(data.logs || []);
        setSyncedCount(data.synced_count);

        if (data.items && data.items.length > 0) {
          const itemsFormatted: RecebimentoItem[] = data.items.map((i: any) => ({
            id: i.id,
            omie_id: i.omie_id,
            source: 'OMIE',
            company_name: i.company_name,
            invoice_number: i.invoice_number,
            contract_number: i.contract_number,
            contract_name: i.contract_name,
            client_name: i.client_name,
            segment_type: i.segment_type || 'B2B',
            is_outsourced: i.is_outsourced || false,
            date_registration: i.date_registration,
            date_issue: i.date_issue,
            date_due: i.date_due,
            date_payment: i.date_payment,
            value_gross: i.value_gross,
            value_discount: i.value_discount,
            value_interest_penalty: i.value_interest_penalty,
            value_fees: i.value_fees,
            tax_pis: i.tax_pis,
            tax_cofins: i.tax_cofins,
            tax_iss: i.tax_iss,
            tax_inss: i.tax_inss,
            tax_irrf: i.tax_irrf,
            tax_retained_total: i.tax_retained_total,
            value_net: i.value_net,
            status: i.date_payment ? 'Pago' : 'Pendente',
            commission: i.commission || {
              has_commission: false,
              commission_mode: 'percent',
              value_non_commissionable: 0,
              value_commissionable_base: i.value_net,
              total_commission_percent: 0,
              total_commission_value: 0,
              participants: []
            }
          }));

          onSyncSuccess(itemsFormatted);
        }
      } else {
        setLogs([`❌ Erro no Omie: ${data.message || 'Falha desconhecida'}`]);
      }
    } catch (err: any) {
      setLogs([`❌ Exceção ao consultar Omie: ${err.message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <RefreshCw size={20} color="#f59e0b" className={isLoading ? styles.spinning : ''} />
            <div>
              <h3 className={styles.modalTitle}>Busca Automática no Omie ERP</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Importação direta dos dados oficiais do Omie com auditoria e aceite linha a linha
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Parâmetros */}
        <div style={{ background: '#0b1120', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div className={styles.filterGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className={styles.filterGroup} style={{ gridColumn: 'span 2' }}>
              <label className={styles.filterLabel}>Empresa Alvo no Omie</label>
              <select className={styles.selectInput} value={company} onChange={e => setCompany(e.target.value as any)}>
                <option value="ALL">Todas as Empresas (Mar Brasil Serviços + DZM)</option>
                <option value="Mar Brasil">Mar Brasil Serviços</option>
                <option value="DZM">DZM Empreendimentos</option>
              </select>
            </div>

            <div className={styles.filterGroup} style={{ gridColumn: 'span 2' }}>
              <label className={styles.filterLabel} style={{ color: '#f59e0b' }}>
                📌 Critério de Busca do Período no Omie
              </label>
              <select className={styles.selectInput} value={filterBy} onChange={e => setFilterBy(e.target.value as DateReferenceType)} style={{ fontWeight: 700, borderColor: '#f59e0b' }}>
                <option value="date_registration">📌 Filtrar no Omie por Data de Registro (Contábil / Referência)</option>
                <option value="date_issue">📄 Filtrar no Omie por Data de Lançamento / Inclusão (Sistema)</option>
                <option value="date_due">📅 Filtrar no Omie por Data de Vencimento</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Data Inicial</label>
              <input type="date" className={styles.textInput} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Data Final</label>
              <input type="date" className={styles.textInput} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>

            <div className={styles.filterGroup} style={{ gridColumn: 'span 2', marginTop: '0.4rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                <input type="checkbox" checked={avoidDuplicates} onChange={e => setAvoidDuplicates(e.target.checked)} style={{ accentColor: '#10b981', width: '16px', height: '16px' }} />
                <ShieldCheck size={16} />
                <span>Prevenção de Duplicidades (Evitar importar faturamentos repetidos por ID Omie)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div style={{ background: '#070b14', border: '1px solid rgba(255,255,255,0.08)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>
            <div style={{ color: '#94a3b8', fontWeight: 700, marginBottom: '0.3rem' }}>Histórico de Comunicação Omie:</div>
            {logs.map((log, idx) => (
              <div key={idx} style={{ color: log.includes('❌') ? '#f43f5e' : '#a7f3d0' }}>
                {log}
              </div>
            ))}
          </div>
        )}

        {syncedCount !== null && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.85rem', fontWeight: 700 }}>
            <Check size={18} />
            <span>Busca no Omie Concluída! {syncedCount} lançamentos encaminhados para a Auditoria.</span>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={isLoading}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleRunSync} disabled={isLoading}>
            <Sparkles size={14} />
            <span>{isLoading ? 'Buscando no Omie...' : 'Executar Busca Omie'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
