/**
 * InsurancePolicyCard — Card expandível de apólice de seguro
 * Estado colapsado: info resumida | Estado expandido: todos os detalhes
 */
"use client";

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Copy,
  Check,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  CreditCard,
  User,
  Hash,
  Lock,
  Headphones,
  ShieldCheck,
} from 'lucide-react';
import { InsurancePolicy } from '@/types/insurance';
import {
  formatInsuranceCurrency,
  formatInsuranceDate,
  getTipoIcon,
} from '@/services/insurance.service';
import styles from './seguros.module.css';

interface InsurancePolicyCardProps {
  policy: InsurancePolicy;
  onEdit: (policy: InsurancePolicy) => void;
  onDelete: (policy: InsurancePolicy) => void;
  onToggleActive: (policy: InsurancePolicy) => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={styles.copyBtn}
      title="Copiar"
      aria-label="Copiar para área de transferência"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function StatusBadge({ policy }: { policy: InsurancePolicy }) {
  if (!policy.ativo) {
    return <span className={`${styles.statusBadge} ${styles.badgeInativo}`}>Inativa</span>;
  }
  if (policy.statusVencimento === 'vencido') {
    return <span className={`${styles.statusBadge} ${styles.badgeVencido}`}>Vencida</span>;
  }
  if (policy.statusVencimento === 'urgente') {
    return (
      <span className={`${styles.statusBadge} ${styles.badgeUrgente}`}>
        ⚠ {policy.diasParaVencer}d
      </span>
    );
  }
  if (policy.statusVencimento === 'atencao') {
    return (
      <span className={`${styles.statusBadge} ${styles.badgeAtencao}`}>
        {policy.diasParaVencer}d
      </span>
    );
  }
  return <span className={`${styles.statusBadge} ${styles.badgeAtiva}`}>Ativa</span>;
}

export function InsurancePolicyCard({ policy, onEdit, onDelete, onToggleActive }: InsurancePolicyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSenha, setShowSenha] = useState(false);

  const tipoIcon = getTipoIcon(policy.tipo);

  // Define cor de borda baseada no status
  const cardBorderClass =
    policy.statusVencimento === 'urgente' || policy.statusVencimento === 'vencido'
      ? styles.cardBorderDanger
      : policy.statusVencimento === 'atencao'
      ? styles.cardBorderWarning
      : !policy.ativo
      ? styles.cardBorderInactive
      : styles.cardBorderDefault;

  return (
    <div className={`${styles.policyCard} ${cardBorderClass}`}>
      {/* ─── CABEÇALHO (sempre visível) ─── */}
      <div
        className={styles.policyCardHeader}
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      >
        {/* Ícone + Segurado + Tipo */}
        <div className={styles.policyCardMain}>
          <span className={styles.policyTipoIcon} aria-hidden="true">{tipoIcon}</span>
          <div className={styles.policyCardInfo}>
            <h3 className={styles.policyTipo}>{policy.segurado || 'Objeto não especificado'}</h3>
            <p className={styles.policyMeta}>
              <span>{policy.tipo}</span>
              {policy.seguradora && <> · <span className={styles.seguradora}>{policy.seguradora}</span></>}
              {policy.apolice && <> · <span style={{ color: '#64748b' }}>#{policy.apolice}</span></>}
            </p>
          </div>
        </div>

        {/* Valores + Badge contratante + Status + Chevron */}
        <div className={styles.policyCardRight}>
          {/* Valores financeiros — visíveis no card colapsado */}
          {policy.premio > 0 && (
            <div style={{ textAlign: 'right', display: 'none' }} className="policy-values">
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.1 }}>
                {formatInsuranceCurrency(policy.premio)}
              </div>
              <div style={{ fontSize: '0.58rem', color: '#64748b' }}>
                {policy.valor_parcela > 0
                  ? `${formatInsuranceCurrency(policy.valor_parcela)}/mês`
                  : 'prêmio anual'
                }
              </div>
            </div>
          )}
          <style>{`.policy-values { display: block !important; }`}</style>
          <span className={styles.contratanteBadge}>{policy.contratante}</span>
          <StatusBadge policy={policy} />
          <div className={styles.policyCardChevron}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>


      {/* ─── DETALHES (expansível) ─── */}
      {expanded && (
        <div className={styles.policyCardDetails}>
          <div className={styles.detailsGrid}>

            {/* BLOCO: Vigência */}
            <div className={styles.detailSection}>
              <h4 className={styles.detailSectionTitle}>
                <Calendar size={14} /> Vigência
              </h4>
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Início</span>
                <span className={styles.detailValue}>{formatInsuranceDate(policy.inicio)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Vencimento</span>
                <span className={`${styles.detailValue} ${
                  policy.statusVencimento === 'urgente' || policy.statusVencimento === 'vencido'
                    ? styles.textDanger
                    : policy.statusVencimento === 'atencao'
                    ? styles.textWarning
                    : ''
                }`}>
                  {formatInsuranceDate(policy.vencimento)}
                  {policy.diasParaVencer !== undefined && (
                    <span className={styles.diasRestantes}>
                      {policy.diasParaVencer < 0
                        ? ` (${Math.abs(policy.diasParaVencer)}d vencida)`
                        : policy.diasParaVencer === 0
                        ? ' (vence HOJE)'
                        : ` (${policy.diasParaVencer}d restantes)`}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* BLOCO: Financeiro */}
            <div className={styles.detailSection}>
              <h4 className={styles.detailSectionTitle}>
                <CreditCard size={14} /> Financeiro
              </h4>
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Prêmio Total</span>
                <span className={styles.detailValue}>{formatInsuranceCurrency(policy.premio)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Parcela</span>
                <span className={styles.detailValue}>
                  {formatInsuranceCurrency(policy.valor_parcela)}
                  {policy.formato_parcelas && (
                    <span className={styles.formato}> · {policy.formato_parcelas}</span>
                  )}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Parcelas</span>
                <span className={styles.detailValue}>
                  {policy.parcelasPagas ?? '—'} pagas / {policy.parcelas_total ?? '—'} total
                  {policy.parcelasRestantes !== undefined && policy.parcelasRestantes > 0 && (
                    <span className={styles.formato}> · {policy.parcelasRestantes} restantes</span>
                  )}
                </span>
              </div>
              {policy.dia_pgto && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Vencimento dia</span>
                  <span className={styles.detailValue}>{policy.dia_pgto}</span>
                </div>
              )}
            </div>

            {/* BLOCO: Franquia & Coberturas */}
            {(policy.franquia !== undefined || policy.cobertura_vidros || policy.cobertura_lanternas || policy.cobertura_farois || policy.coberturas_adicionais) && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>
                  <ShieldCheck size={14} /> Coberturas & Franquia
                </h4>
                {policy.franquia !== undefined && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>Franquia</span>
                    <span className={styles.detailValue}>
                      {formatInsuranceCurrency(policy.franquia)}
                      {policy.franquia_reduzida && (
                        <span className={styles.formato}>
                          {' '}· Reduzida{policy.franquia_reduzida_percentual ? ` (${policy.franquia_reduzida_percentual}%)` : ''}
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {(policy.cobertura_vidros || policy.cobertura_lanternas || policy.cobertura_farois) && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>Itens Inclusos</span>
                    <span className={styles.detailValue} style={{ fontSize: '0.72rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                      {policy.cobertura_vidros && <span className={styles.coberturaBadge}>Vidros</span>}
                      {policy.cobertura_lanternas && <span className={styles.coberturaBadge}>Lanternas</span>}
                      {policy.cobertura_farois && <span className={styles.coberturaBadge}>Faróis</span>}
                    </span>
                  </div>
                )}
                {policy.coberturas_adicionais && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>Adicionais</span>
                    <span className={styles.detailValue} style={{ fontSize: '0.72rem', lineHeight: '1.3' }}>{policy.coberturas_adicionais}</span>
                  </div>
                )}
              </div>
            )}

            {/* BLOCO: Apólice */}
            <div className={styles.detailSection}>
              <h4 className={styles.detailSectionTitle}>
                <Hash size={14} /> Apólice
              </h4>
              {policy.apolice && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Nº Apólice</span>
                  <span className={styles.detailValueCopy}>
                    <span>{policy.apolice}</span>
                    <CopyButton value={policy.apolice} />
                  </span>
                </div>
              )}
              {policy.senha && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Senha Portal</span>
                  <span className={styles.detailValueCopy}>
                    <span>{policy.senha}</span>
                    <CopyButton value={policy.senha} />
                  </span>
                </div>
              )}
              {policy.assistencia_24h && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Assistência 24h</span>
                  <span className={styles.detailValueCopy}>
                    <a
                      href={`tel:${policy.assistencia_24h.replace(/\D/g, '')}`}
                      className={styles.phoneLink}
                    >
                      {policy.assistencia_24h}
                    </a>
                    <CopyButton value={policy.assistencia_24h} />
                  </span>
                </div>
              )}
            </div>

            {/* BLOCO: Corretor */}
            {(policy.corretor || policy.telefone_corretor || policy.email_corretor) && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>
                  <User size={14} /> Corretor
                </h4>
                {policy.corretor && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>Nome</span>
                    <span className={styles.detailValue}>{policy.corretor}</span>
                  </div>
                )}
                {policy.indicador && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>Indicação</span>
                    <span className={styles.detailValue}>{policy.indicador}</span>
                  </div>
                )}
                <div className={styles.corretorActions}>
                  {policy.telefone_corretor && (
                    <a
                      href={`https://wa.me/55${policy.telefone_corretor.replace(/\D/g, '')}?text=Olá ${policy.corretor || ''}, gostaria de tratar sobre a apólice ${policy.apolice || policy.tipo}.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.corretorWhatsApp}
                    >
                      <Phone size={12} />
                      WhatsApp
                    </a>
                  )}
                  {policy.email_corretor && (
                    <a
                      href={`mailto:${policy.email_corretor}?subject=Apólice ${policy.apolice || policy.tipo} - ${policy.contratante}`}
                      className={styles.corretorEmail}
                    >
                      <Mail size={12} />
                      E-mail
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Observações */}
          {policy.observacoes && (
            <div className={styles.observacoes}>
              <span className={styles.observacoesLabel}>Obs.:</span>
              <span>{policy.observacoes}</span>
            </div>
          )}

          {/* Ações */}
          <div className={styles.policyCardActions}>
            <button
              className={styles.btnEdit}
              onClick={(e) => { e.stopPropagation(); onEdit(policy); }}
            >
              <Pencil size={14} />
              Editar
            </button>
            {policy.ativo ? (
              <button
                className={styles.btnDeactivate}
                onClick={(e) => { e.stopPropagation(); onToggleActive(policy); }}
              >
                <EyeOff size={14} />
                Inativar
              </button>
            ) : (
              <button
                className={styles.btnActivate}
                onClick={(e) => { e.stopPropagation(); onToggleActive(policy); }}
              >
                <Eye size={14} />
                Reativar
              </button>
            )}
            <button
              className={styles.btnDelete}
              onClick={(e) => { e.stopPropagation(); onDelete(policy); }}
            >
              <Trash2 size={14} />
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
