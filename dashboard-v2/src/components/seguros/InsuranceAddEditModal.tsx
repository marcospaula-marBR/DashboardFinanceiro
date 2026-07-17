/**
 * InsuranceAddEditModal — Modal para cadastrar ou editar apólice de seguro
 */
"use client";

import { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { InsurancePolicy, InsurancePolicyInput } from '@/types/insurance';
import { uploadInsurancePolicyFile } from '@/services/insurance.service';
import styles from './seguros.module.css';

interface InsuranceAddEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InsurancePolicyInput) => Promise<void>;
  policy?: InsurancePolicy | null; // se preenchido, modo edição
}

const EMPTY_FORM: InsurancePolicyInput = {
  contratante: '',
  tipo: '',
  segurado: '',
  seguradora: '',
  apolice: '',
  senha: '',
  assistencia_24h: '',
  inicio: '',
  vencimento: '',
  premio: 0,
  parcelas_total: 1,
  valor_parcela: 0,
  dia_pgto: '',
  formato_parcelas: '',
  corretor: '',
  telefone_corretor: '',
  email_corretor: '',
  indicador: '',
  ativo: true,
  franquia: 0,
  franquia_reduzida: false,
  franquia_reduzida_percentual: 0,
  cobertura_vidros: false,
  cobertura_lanternas: false,
  cobertura_farois: false,
  coberturas_adicionais: '',
  observacoes: '',
  pdf_url: '',
};

const TIPOS_SEGURO = [
  'Automóvel', 'Saúde', 'Responsabilidade Civil', 'Vida',
  'Patrimonial', 'Residencial', 'Transporte', 'Outros',
];

const FORMATOS_PARCELA = [
  'Anual', 'Semestral', 'Trimestral', 'Mensal', 'Recorrente',
];

export function InsuranceAddEditModal({ isOpen, onClose, onSave, policy }: InsuranceAddEditModalProps) {
  const [form, setForm] = useState<InsurancePolicyInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isEditMode = !!policy;

  // Preenche form ao abrir em modo edição
  useEffect(() => {
    if (policy) {
      setForm({
        contratante: policy.contratante || '',
        tipo: policy.tipo || '',
        segurado: policy.segurado || '',
        seguradora: policy.seguradora || '',
        apolice: policy.apolice || '',
        senha: policy.senha || '',
        assistencia_24h: policy.assistencia_24h || '',
        inicio: policy.inicio || '',
        vencimento: policy.vencimento || '',
        premio: policy.premio || 0,
        parcelas_total: policy.parcelas_total || 1,
        valor_parcela: policy.valor_parcela || 0,
        dia_pgto: policy.dia_pgto || '',
        formato_parcelas: policy.formato_parcelas || '',
        corretor: policy.corretor || '',
        telefone_corretor: policy.telefone_corretor || '',
        email_corretor: policy.email_corretor || '',
        indicador: policy.indicador || '',
        ativo: policy.ativo ?? true,
        franquia: policy.franquia || 0,
        franquia_reduzida: policy.franquia_reduzida ?? false,
        franquia_reduzida_percentual: policy.franquia_reduzida_percentual || 0,
        cobertura_vidros: policy.cobertura_vidros ?? false,
        cobertura_lanternas: policy.cobertura_lanternas ?? false,
        cobertura_farois: policy.cobertura_farois ?? false,
        coberturas_adicionais: policy.coberturas_adicionais || '',
        observacoes: policy.observacoes || '',
        pdf_url: policy.pdf_url || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setSaveError(null);
    setSelectedFile(null); // Limpa seleção anterior
  }, [policy, isOpen]);

  // ── CAMPO INDIVIDUAL ──
  const setField = <K extends keyof InsurancePolicyInput>(key: K, value: InsurancePolicyInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── SALVAR ──
  const handleSave = async () => {
    if (!form.contratante || !form.tipo) {
      setSaveError('Preencha ao menos Contratante e Tipo de Seguro.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      let finalPdfUrl = form.pdf_url;

      // Se houver um novo arquivo selecionado, fazemos o upload dele para o storage primeiro
      if (selectedFile) {
        const targetId = policy?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'new_' + Date.now());
        console.log('[Insurance upload] Carregando arquivo para o Supabase Storage...');
        finalPdfUrl = await uploadInsurancePolicyFile(targetId, selectedFile);
        console.log('[Insurance upload] Upload de arquivo realizado. URL:', finalPdfUrl);
      }

      await onSave({
        ...form,
        pdf_url: finalPdfUrl,
      });
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao salvar apólice.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEditMode ? 'Editar apólice' : 'Nova apólice'}
      >
        {/* HEADER */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>
              {isEditMode ? '✏️ Editar Apólice' : '🛡️ Nova Apólice'}
            </h2>
            <p className={styles.modalSubtitle}>
              {isEditMode
                ? `Editando: ${policy?.tipo} · ${policy?.segurado || policy?.contratante}`
                : 'Preencha os campos abaixo para cadastrar uma nova apólice de seguro'}
            </p>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>

          {/* ─── FORMULÁRIO MANUAL ─── */}
          <div className={styles.formGrid}>

            {/* Contratante + Tipo */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-contratante">
                Contratante <span className={styles.required}>*</span>
              </label>
              <select
                id="ins-contratante"
                className={styles.formSelect}
                value={form.contratante}
                onChange={(e) => setField('contratante', e.target.value)}
              >
                <option value="">Selecione...</option>
                <option value="Mar Brasil">Mar Brasil</option>
                <option value="DZM">DZM</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-tipo">
                Tipo de Seguro <span className={styles.required}>*</span>
              </label>
              <select
                id="ins-tipo"
                className={styles.formSelect}
                value={form.tipo}
                onChange={(e) => setField('tipo', e.target.value)}
              >
                <option value="">Selecione...</option>
                {TIPOS_SEGURO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Segurado + Seguradora */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-segurado">Segurado / Bem</label>
              <input
                id="ins-segurado"
                type="text"
                className={styles.formInput}
                value={form.segurado || ''}
                onChange={(e) => setField('segurado', e.target.value)}
                placeholder="Nome da pessoa ou bem segurado"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-seguradora">Seguradora</label>
              <input
                id="ins-seguradora"
                type="text"
                className={styles.formInput}
                value={form.seguradora || ''}
                onChange={(e) => setField('seguradora', e.target.value)}
                placeholder="Porto Seguro, Bradesco, Allianz..."
              />
            </div>

            {/* Apólice + Senha */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-apolice">Nº da Apólice</label>
              <input
                id="ins-apolice"
                type="text"
                className={styles.formInput}
                value={form.apolice || ''}
                onChange={(e) => setField('apolice', e.target.value)}
                placeholder="Número da apólice"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-senha">Senha do Portal</label>
              <input
                id="ins-senha"
                type="text"
                className={styles.formInput}
                value={form.senha || ''}
                onChange={(e) => setField('senha', e.target.value)}
                placeholder="Senha de acesso ao portal da seguradora"
              />
            </div>

            {/* Vigência: Início + Vencimento */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-inicio">Início da Vigência</label>
              <input
                id="ins-inicio"
                type="date"
                className={styles.formInput}
                value={form.inicio || ''}
                onChange={(e) => setField('inicio', e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-vencimento">Vencimento</label>
              <input
                id="ins-vencimento"
                type="date"
                className={styles.formInput}
                value={form.vencimento || ''}
                onChange={(e) => setField('vencimento', e.target.value)}
              />
            </div>

            {/* Prêmio Total + Valor Parcela */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-premio">Prêmio Total (R$)</label>
              <input
                id="ins-premio"
                type="number"
                min={0}
                step={0.01}
                className={styles.formInput}
                value={form.premio ?? ''}
                onChange={(e) => setField('premio', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0,00"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-valor-parcela">Valor da Parcela (R$)</label>
              <input
                id="ins-valor-parcela"
                type="number"
                min={0}
                step={0.01}
                className={styles.formInput}
                value={form.valor_parcela ?? ''}
                onChange={(e) => setField('valor_parcela', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0,00"
              />
            </div>

            {/* Qtd Parcelas + Dia Pgto */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-parcelas">Qtd. Parcelas</label>
              <input
                id="ins-parcelas"
                type="number"
                min={1}
                step={1}
                className={styles.formInput}
                value={form.parcelas_total ?? ''}
                onChange={(e) => setField('parcelas_total', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="1"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-formato">Formato das Parcelas</label>
              <select
                id="ins-formato"
                className={styles.formSelect}
                value={form.formato_parcelas || ''}
                onChange={(e) => setField('formato_parcelas', e.target.value)}
              >
                <option value="">Selecione...</option>
                {FORMATOS_PARCELA.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Assistência 24h (campo inteiro) */}
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel} htmlFor="ins-assistencia">Assistência 24h</label>
              <input
                id="ins-assistencia"
                type="text"
                className={styles.formInput}
                value={form.assistencia_24h || ''}
                onChange={(e) => setField('assistencia_24h', e.target.value)}
                placeholder="Telefone de assistência 24 horas"
              />
            </div>

            {/* Corretor */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-corretor">Corretor</label>
              <input
                id="ins-corretor"
                type="text"
                className={styles.formInput}
                value={form.corretor || ''}
                onChange={(e) => setField('corretor', e.target.value)}
                placeholder="Nome completo do corretor"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-tel-corretor">Telefone Corretor</label>
              <input
                id="ins-tel-corretor"
                type="text"
                className={styles.formInput}
                value={form.telefone_corretor || ''}
                onChange={(e) => setField('telefone_corretor', e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-email-corretor">E-mail Corretor</label>
              <input
                id="ins-email-corretor"
                type="email"
                className={styles.formInput}
                value={form.email_corretor || ''}
                onChange={(e) => setField('email_corretor', e.target.value)}
                placeholder="corretor@email.com"
              />
            </div>

            {/* Franquia & Coberturas */}
            <div className={styles.formGroupSectionTitle}>
              Franquia & Coberturas (Automóvel / Bens)
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-franquia">Valor da Franquia (R$)</label>
              <input
                id="ins-franquia"
                type="number"
                min={0}
                step={0.01}
                className={styles.formInput}
                value={form.franquia ?? ''}
                onChange={(e) => setField('franquia', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0,00"
              />
            </div>

            <div className={styles.formGroup} style={{ justifyContent: 'center' }}>
              <label className={styles.formToggleLabel}>
                <input
                  type="checkbox"
                  checked={form.franquia_reduzida ?? false}
                  onChange={(e) => {
                    setField('franquia_reduzida', e.target.checked);
                    if (!e.target.checked) {
                      setField('franquia_reduzida_percentual', 0);
                    }
                  }}
                />
                <span>Franquia Reduzida</span>
              </label>
            </div>

            {form.franquia_reduzida && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="ins-franquia-reduzida-percentual">
                  Porcentagem da Franquia Reduzida (%)
                </label>
                <input
                  id="ins-franquia-reduzida-percentual"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className={styles.formInput}
                  value={form.franquia_reduzida_percentual ?? ''}
                  onChange={(e) => setField('franquia_reduzida_percentual', e.target.value ? parseFloat(e.target.value) : 0)}
                  placeholder="Ex: 50"
                />
              </div>
            )}

            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel}>Coberturas Inclusas</label>
              <div className={styles.checkboxGrid}>
                <label className={styles.formToggleLabel}>
                  <input
                    type="checkbox"
                    checked={form.cobertura_vidros ?? false}
                    onChange={(e) => setField('cobertura_vidros', e.target.checked)}
                  />
                  <span>Vidros</span>
                </label>
                <label className={styles.formToggleLabel}>
                  <input
                    type="checkbox"
                    checked={form.cobertura_lanternas ?? false}
                    onChange={(e) => setField('cobertura_lanternas', e.target.checked)}
                  />
                  <span>Lanternas</span>
                </label>
                <label className={styles.formToggleLabel}>
                  <input
                    type="checkbox"
                    checked={form.cobertura_farois ?? false}
                    onChange={(e) => setField('cobertura_farois', e.target.checked)}
                  />
                  <span>Faróis</span>
                </label>
              </div>
            </div>

            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel} htmlFor="ins-coberturas-adicionais">Outras Coberturas / Detalhes</label>
              <input
                id="ins-coberturas-adicionais"
                type="text"
                className={styles.formInput}
                value={form.coberturas_adicionais || ''}
                onChange={(e) => setField('coberturas_adicionais', e.target.value)}
                placeholder="ex: Cobertura de terceiros R$ 100k, reboque ilimitado..."
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="ins-indicador">Indicação</label>
              <input
                id="ins-indicador"
                type="text"
                className={styles.formInput}
                value={form.indicador || ''}
                onChange={(e) => setField('indicador', e.target.value)}
                placeholder="Quem indicou"
              />
            </div>

            {/* Observações (full width) */}
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel} htmlFor="ins-obs">Observações</label>
              <textarea
                id="ins-obs"
                className={`${styles.formInput} ${styles.formTextarea}`}
                value={form.observacoes || ''}
                onChange={(e) => setField('observacoes', e.target.value)}
                placeholder="Informações adicionais sobre esta apólice..."
                rows={3}
              />
            </div>

            {/* Anexo da Apólice (PDF/Imagem) */}
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel}>Documento da Apólice (PDF ou Imagem)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                {form.pdf_url ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      📄 Arquivo da apólice anexado.
                    </span>
                    <a
                      href={form.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.btnSecondary}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.75rem',
                        background: '#1e293b',
                        color: '#f8fafc',
                        border: '1px solid #334155',
                        borderRadius: '0.375rem',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      Visualizar Apólice
                    </a>
                    <button
                      type="button"
                      onClick={() => setField('pdf_url', '')}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.75rem',
                        background: '#7f1d1d',
                        color: '#fecaca',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer'
                      }}
                    >
                      Remover Anexo
                    </button>
                  </div>
                ) : selectedFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: '500' }}>
                      📎 Novo arquivo selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        background: '#334155',
                        color: '#cbd5e1',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer'
                      }}
                    >
                      Limpar Seleção
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setSelectedFile(file);
                    }}
                    style={{
                      fontSize: '0.85rem',
                      color: '#94a3b8',
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '0.375rem',
                      padding: '0.5rem',
                      width: '100%',
                      cursor: 'pointer'
                    }}
                  />
                )}
              </div>
            </div>

            {/* Status ativo */}
            {isEditMode && (
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.formToggleLabel}>
                  <input
                    type="checkbox"
                    checked={form.ativo ?? true}
                    onChange={(e) => setField('ativo', e.target.checked)}
                  />
                  <span>Apólice ativa</span>
                </label>
              </div>
            )}
          </div>

          {/* Erro de salvamento */}
          {saveError && (
            <div className={styles.saveError}>
              <AlertCircle size={14} />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button className={styles.btnSave} onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 size={16} className={styles.spinIcon} />
                Salvando...
              </>
            ) : (
              <>{isEditMode ? 'Salvar Alterações' : 'Cadastrar Apólice'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
