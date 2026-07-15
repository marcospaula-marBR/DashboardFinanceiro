/**
 * InsuranceAddEditModal — Modal para cadastrar ou editar apólice de seguro
 * Inclui leitura OCR de PDF/Imagem via Gemini API
 */
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Upload,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { InsurancePolicy, InsurancePolicyInput, InsuranceOCRResult } from '@/types/insurance';
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
  premio: undefined,
  parcelas_total: undefined,
  valor_parcela: undefined,
  dia_pgto: '',
  formato_parcelas: '',
  corretor: '',
  telefone_corretor: '',
  email_corretor: '',
  indicador: '',
  ativo: true,
  franquia: undefined,
  franquia_reduzida: false,
  cobertura_vidros: false,
  cobertura_lanternas: false,
  cobertura_farois: false,
  coberturas_adicionais: '',
  observacoes: '',
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

  // OCR state
  const [isDragging, setIsDragging] = useState(false);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<InsuranceOCRResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showOcrSection, setShowOcrSection] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
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
        premio: policy.premio || undefined,
        parcelas_total: policy.parcelas_total || undefined,
        valor_parcela: policy.valor_parcela || undefined,
        dia_pgto: policy.dia_pgto || '',
        formato_parcelas: policy.formato_parcelas || '',
        corretor: policy.corretor || '',
        telefone_corretor: policy.telefone_corretor || '',
        email_corretor: policy.email_corretor || '',
        indicador: policy.indicador || '',
        ativo: policy.ativo ?? true,
        franquia: policy.franquia || undefined,
        franquia_reduzida: policy.franquia_reduzida ?? false,
        cobertura_vidros: policy.cobertura_vidros ?? false,
        cobertura_lanternas: policy.cobertura_lanternas ?? false,
        cobertura_farois: policy.cobertura_farois ?? false,
        coberturas_adicionais: policy.coberturas_adicionais || '',
        observacoes: policy.observacoes || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    // Sempre abre a seção OCR expandida ao abrir o modal
    setShowOcrSection(true);
    setOcrResult(null);
    setOcrError(null);
    setOcrFile(null);
    setSaveError(null);
  }, [policy, isOpen]);

  // ── CAMPO INDIVIDUAL ──
  const setField = <K extends keyof InsurancePolicyInput>(key: K, value: InsurancePolicyInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── OCR: DRAG & DROP ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processOCRFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processOCRFile(file);
  };

  const processOCRFile = async (file: File) => {
    setOcrFile(file);
    setOcrError(null);
    setOcrLoading(true);
    setOcrResult(null);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const resp = await fetch('/api/seguros/ocr', { method: 'POST', body: fd });
      const json = await resp.json();

      if (!resp.ok || !json.success) {
        throw new Error(json.error || 'Erro desconhecido na leitura OCR.');
      }

      const result: InsuranceOCRResult = json.data;
      setOcrResult(result);

      // Auto-preenche os campos com os dados extraídos (prioriza o resultado do OCR)
      setForm((prev) => ({
        contratante: result.contratante || prev.contratante || '',
        tipo: result.tipo || prev.tipo || '',
        segurado: result.segurado || prev.segurado || '',
        seguradora: result.seguradora || prev.seguradora || '',
        apolice: result.apolice || prev.apolice || '',
        senha: result.senha || prev.senha || '',
        assistencia_24h: result.assistencia_24h || prev.assistencia_24h || '',
        inicio: result.inicio || prev.inicio || '',
        vencimento: result.vencimento || prev.vencimento || '',
        premio: result.premio !== undefined ? result.premio : prev.premio,
        parcelas_total: result.parcelas_total !== undefined ? result.parcelas_total : prev.parcelas_total,
        valor_parcela: result.valor_parcela !== undefined ? result.valor_parcela : prev.valor_parcela,
        dia_pgto: result.dia_pgto || prev.dia_pgto || '',
        formato_parcelas: result.formato_parcelas || prev.formato_parcelas || '',
        corretor: result.corretor || prev.corretor || '',
        telefone_corretor: result.telefone_corretor || prev.telefone_corretor || '',
        email_corretor: result.email_corretor || prev.email_corretor || '',
        indicador: result.indicador || prev.indicador || '',
        ativo: prev.ativo,
        franquia: result.franquia !== undefined ? result.franquia : prev.franquia,
        franquia_reduzida: result.franquia_reduzida !== undefined ? result.franquia_reduzida : prev.franquia_reduzida,
        cobertura_vidros: result.cobertura_vidros !== undefined ? result.cobertura_vidros : prev.cobertura_vidros,
        cobertura_lanternas: result.cobertura_lanternas !== undefined ? result.cobertura_lanternas : prev.cobertura_lanternas,
        cobertura_farois: result.cobertura_farois !== undefined ? result.cobertura_farois : prev.cobertura_farois,
        coberturas_adicionais: result.coberturas_adicionais || prev.coberturas_adicionais || '',
        observacoes: result.observacoes || prev.observacoes || '',
      }));
    } catch (err: any) {
      setOcrError(err.message || 'Erro ao processar arquivo.');
    } finally {
      setOcrLoading(false);
    }
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
      await onSave(form);
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
                ? `Editando: ${policy?.tipo} · ${policy?.segurado || policy?.contratante} — Envie o PDF para atualizar os campos automaticamente`
                : 'Cadastre manualmente ou envie o PDF/imagem para preenchimento automático via IA'}
            </p>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>

          {/* ─── SEÇÃO OCR ─── */}
          <div className={styles.ocrSection}>
            <button
              className={styles.ocrSectionToggle}
              onClick={() => setShowOcrSection(!showOcrSection)}
            >
              <Sparkles size={16} className={styles.sparkleIcon} />
              <span>
                {isEditMode
                  ? '✨ Atualizar Campos via IA — Envie o PDF da Apólice'
                  : 'Leitura Automática via IA (Gemini OCR)'}
              </span>
              {showOcrSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showOcrSection && (
              <div className={styles.ocrBody}>
                <p className={styles.ocrHint}>
                  Envie o PDF ou foto da apólice. A IA extrai os dados automaticamente e preenche o formulário abaixo para você revisar e salvar.
                </p>

                {/* Drop Zone */}
                <div
                  className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''} ${ocrFile ? styles.dropZoneHasFile : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Área para upload do arquivo de apólice"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileSelect}
                    className={styles.hiddenInput}
                    aria-hidden="true"
                  />

                  {ocrLoading ? (
                    <div className={styles.ocrLoading}>
                      <Loader2 size={28} className={styles.spinIcon} />
                      <span>Analisando documento com Gemini IA...</span>
                    </div>
                  ) : ocrFile ? (
                    <div className={styles.ocrFileSelected}>
                      <CheckCircle2 size={24} className={styles.ocrCheckIcon} />
                      <div>
                        <p className={styles.ocrFileName}>{ocrFile.name}</p>
                        <p className={styles.ocrFileSize}>
                          {(ocrFile.size / 1024).toFixed(0)} KB · Clique para trocar
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.ocrDropHint}>
                      <Upload size={28} />
                      <p>Arraste o PDF/imagem aqui ou clique para selecionar</p>
                      <span>Suporta: PDF, JPEG, PNG, WebP · Máx. 10MB</span>
                    </div>
                  )}
                </div>

                {/* Erro OCR */}
                {ocrError && (
                  <div className={styles.ocrError}>
                    <AlertCircle size={14} />
                    <span>{ocrError}</span>
                  </div>
                )}

                {/* Resultado OCR */}
                {ocrResult && (
                  <div className={styles.ocrSuccess}>
                    <CheckCircle2 size={14} />
                    <span>
                      Dados extraídos com confiança{' '}
                      <strong>{ocrResult.confianca}</strong>.
                      {ocrResult.camposNaoEncontrados && ocrResult.camposNaoEncontrados.length > 0 && (
                        <> Campos não encontrados: {ocrResult.camposNaoEncontrados.join(', ')}.</>
                      )}
                      {' '}Revise e corrija os campos abaixo antes de salvar.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

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
                  onChange={(e) => setField('franquia_reduzida', e.target.checked)}
                />
                <span>Franquia Reduzida</span>
              </label>
            </div>

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
