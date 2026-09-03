"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  ExternalLink, 
  Paperclip, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Loader2, 
  CreditCard, 
  User, 
  Calendar, 
  Building2, 
  Tag, 
  FileText,
  Clock,
  Send,
  ShieldCheck,
  XCircle,
  Sparkles,
  AlertTriangle,
  Layers,
  CalendarDays
} from "lucide-react";
import { ClaraTransactionRecord, OmieCategoryOption, OmieDepartmentOption, OmieProjectOption } from "@/types/clara.types";

interface ClaraTransactionDrawerProps {
  transaction: ClaraTransactionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onTransactionUpdated: (updated: ClaraTransactionRecord) => void;
  categories?: OmieCategoryOption[];
  departments?: OmieDepartmentOption[];
  projects?: OmieProjectOption[];
  activeCompanyCnpj?: string;
  activeCompanyName?: string;
}

export function ClaraTransactionDrawer({
  transaction,
  isOpen,
  onClose,
  onTransactionUpdated,
  categories = [],
  departments = [],
  projects = [],
  activeCompanyCnpj = '02.233.923/0001-19',
  activeCompanyName = 'Mar Brasil',
}: ClaraTransactionDrawerProps) {
  const [retrying, setRetrying] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  // Feedback de envio ao Omie
  const [syncResult, setSyncResult] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    omieId?: number;
    omieValidated?: boolean;
  } | null>(null);
  const [syncStep, setSyncStep] = useState<string | null>(null); // passo atual

  // Estados locais dos campos editáveis
  const [selectedCat, setSelectedCat] = useState(transaction?.omie_category_code || '');
  const [selectedDepto, setSelectedDepto] = useState(transaction?.omie_department_code || '');
  const [selectedProj, setSelectedProj] = useState(transaction?.omie_project_code || '');
  const [selectedIssueDate, setSelectedIssueDate] = useState(transaction?.invoice_issue_date || '');
  const [selectedRegDate, setSelectedRegDate] = useState(transaction?.registration_date || '');
  const [selectedDueDate, setSelectedDueDate] = useState(transaction?.due_date || '');

  // Estado para OCR
  const [runningOcr, setRunningOcr] = useState(false);
  const [ocrFeedback, setOcrFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  
  // Estado para documentos frescos consultados da Clara API
  const [fetchedDocs, setFetchedDocs] = useState<any[] | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    if (transaction) {
      setSelectedCat(transaction.omie_category_code || '');
      setSelectedDepto(transaction.omie_department_code || '');
      setSelectedProj(transaction.omie_project_code || '');
      setSelectedIssueDate(transaction.invoice_issue_date || '');
      setSelectedRegDate(transaction.registration_date || '');
      setSelectedDueDate(transaction.due_date || '');
      setFetchedDocs(null);
      setSyncResult(null);
      setSyncStep(null);
      setOcrFeedback(null);

      // Se a transação tem anexos sinalizados ou se a lista local estiver vazia, busca sob demanda na API Clara
      const existingDocs = transaction.raw_payload?.documents || transaction.raw_payload?.receipts || [];
      if (existingDocs.length > 0) {
        setFetchedDocs(existingDocs);
      } else if (transaction.has_attachments || (transaction.attachments_count && transaction.attachments_count > 0) || transaction.raw_payload?.hasAttachments?.value) {
        setLoadingDocs(true);
        fetch(`/api/clara/transactions/${transaction.clara_uuid}/attachments`)
          .then(res => res.json())
          .then(data => {
            if (data.status === 'success' && Array.isArray(data.data) && data.data.length > 0) {
              setFetchedDocs(data.data);
            }
          })
          .catch(() => {})
          .finally(() => setLoadingDocs(false));
      }
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSaveFields = async () => {
    setSavingFields(true);
    try {
      const res = await fetch(`/api/clara/transactions/${transaction.clara_uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          omie_category_code: selectedCat || null,
          omie_department_code: selectedDepto || null,
          omie_project_code: selectedProj || null,
          invoice_issue_date: selectedIssueDate || null,
          registration_date: selectedRegDate || null,
          due_date: selectedDueDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'success' && data.data) {
        onTransactionUpdated(data.data);
        alert('Classificação contábil e datas salvas com sucesso!');
      } else {
        alert(`Erro ao salvar campos: ${data.message || `Status HTTP ${res.status}`}`);
      }
    } catch (e: any) {
      alert(`Erro de conexão: ${e.message}`);
    } finally {
      setSavingFields(false);
    }
  };

  const handleRunOcr = async () => {
    setRunningOcr(true);
    setOcrFeedback(null);
    try {
      const res = await fetch('/api/clara/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transaction.clara_uuid,
          companyCnpj: activeCompanyCnpj,
          companyName: activeCompanyName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'success' && data.data) {
        onTransactionUpdated(data.data);
        if (data.data.invoice_issue_date) setSelectedIssueDate(data.data.invoice_issue_date);
        if (data.data.registration_date) setSelectedRegDate(data.data.registration_date);
        setOcrFeedback({ type: 'success', message: data.message });
      } else {
        setOcrFeedback({ type: 'error', message: data.message || 'Falha na leitura OCR do comprovante.' });
      }
    } catch (e: any) {
      setOcrFeedback({ type: 'error', message: `Erro ao conectar com serviço OCR: ${e.message}` });
    } finally {
      setRunningOcr(false);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(transaction.raw_payload || transaction, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = async () => {
    setSyncResult(null);
    setRetrying(true);
    setSyncStep('⏳ Preparando payload do lançamento...');

    try {
      setSyncStep('📤 Enviando para Omie — Contas a Pagar...');

      const res = await fetch(`/api/clara/transactions/${transaction.clara_uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });

      const data = await res.json().catch(() => ({ status: 'error', message: 'Resposta inválida do servidor.' }));

      if (!res.ok || data.status === 'error') {
        setSyncResult({
          type: 'error',
          title: 'Falha no envio ao Omie',
          message: data.message || `Erro HTTP ${res.status}`,
        });
        setSyncStep(null);
        return;
      }

      const updated = data.data as (typeof transaction);
      onTransactionUpdated(updated);

      if (updated?.omie_launch_id) {
        // ✅ PASSO 2: Verificação reversa — busca o lançamento no Omie
        setSyncStep('🔍 Verificando lançamento no Omie (consulta reversa)...');
        try {
          const verRes = await fetch('/api/clara/verify-omie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ omieId: updated.omie_launch_id }),
          });
          const verData = await verRes.json().catch(() => null);
          const verified = verRes.ok && verData?.status === 'success';
          const descStatus = verData?.data?.descricao_status || verData?.data?.status_titulo || '';

          setSyncResult({
            type: 'success',
            title: `✅ Lançamento ${verified ? 'confirmado' : 'enviado'} no Omie`,
            message: verified
              ? `Contas a Pagar #${updated.omie_launch_id}${descStatus ? ' — ' + descStatus : ''} (verificado na base Omie)`
              : `ID Omie #${updated.omie_launch_id} retornado pelo servidor. Confirme em Finanças → Contas a Pagar.`,
            omieId: updated.omie_launch_id,
            omieValidated: verified,
          });
        } catch {
          setSyncResult({
            type: 'success',
            title: '✅ Enviado ao Omie com sucesso',
            message: `ID Omie #${updated.omie_launch_id} — verificação reversa não disponível.`,
            omieId: updated.omie_launch_id,
            omieValidated: false,
          });
        }
      } else {
        setSyncResult({
          type: 'warning',
          title: 'Processado sem ID Omie',
          message: data.message || 'O servidor processou mas não retornou um ID Omie. Verifique o modo Teste (Safe Mode).',
        });
      }
    } catch (e: any) {
      setSyncResult({
        type: 'error',
        title: 'Erro de conexão',
        message: e.message || 'Falha ao comunicar com o servidor.',
      });
    } finally {
      setRetrying(false);
      setSyncStep(null);
    }
  };

  const handleIgnore = async () => {
    if (!confirm('Deseja marcar esta transação para não ser enviada ao Omie?')) return;
    try {
      const res = await fetch(`/api/clara/transactions/${transaction.clara_uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ignore' }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        onTransactionUpdated({ ...transaction, sync_status: 'IGNORED' });
      }
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    }
  };

  const handleForceResync = async () => {
    if (!confirm('Isso irá apagar o ID Omie antigo (Conta Corrente) e reenviar esta transação ao módulo Contas a Pagar. Continuar?')) return;
    setSyncResult(null);
    setRetrying(true);
    setSyncStep('🔄 Limpando lançamento antigo (Conta Corrente)...');

    try {
      setSyncStep('📤 Reenviando para Omie — Contas a Pagar...');

      const res = await fetch(`/api/clara/transactions/${transaction.clara_uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force_resync' }),
      });

      const data = await res.json().catch(() => ({ status: 'error', message: 'Resposta inválida do servidor.' }));

      if (!res.ok || data.status === 'error') {
        setSyncResult({
          type: 'error',
          title: 'Falha na migração para Contas a Pagar',
          message: data.message || `Erro HTTP ${res.status}`,
        });
        setSyncStep(null);
        return;
      }

      const updated = data.data as (typeof transaction);
      onTransactionUpdated(updated);

      if (updated?.omie_launch_id) {
        setSyncStep('🔍 Verificando no Omie (Contas a Pagar)...');
        try {
          const verRes = await fetch('/api/clara/verify-omie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ omieId: updated.omie_launch_id }),
          });
          const verData = await verRes.json().catch(() => null);
          const verified = verRes.ok && verData?.status === 'success';
          const descStatus = verData?.data?.descricao_status || '';

          setSyncResult({
            type: 'success',
            title: `✅ Migrado para Contas a Pagar${verified ? ' e verificado' : ''}`,
            message: verified
              ? `Contas a Pagar #${updated.omie_launch_id}${descStatus ? ' — ' + descStatus : ''} (confirmado na base Omie)`
              : `ID Omie #${updated.omie_launch_id}. Confirme em Finanças → Contas a Pagar.`,
            omieId: updated.omie_launch_id,
            omieValidated: verified,
          });
        } catch {
          setSyncResult({
            type: 'success',
            title: '✅ Migrado para Contas a Pagar',
            message: `ID Omie #${updated.omie_launch_id} registrado com sucesso.`,
            omieId: updated.omie_launch_id,
            omieValidated: false,
          });
        }
      } else {
        setSyncResult({
          type: 'warning',
          title: 'Processado sem ID Omie',
          message: data.message || 'Verifique o modo Teste (Safe Mode).',
        });
      }
    } catch (e: any) {
      setSyncResult({
        type: 'error',
        title: 'Erro de conexão',
        message: e.message || 'Falha ao comunicar com o servidor.',
      });
    } finally {
      setRetrying(false);
      setSyncStep(null);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const docs = fetchedDocs !== null 
    ? fetchedDocs 
    : (transaction.raw_payload?.documents || transaction.raw_payload?.receipts || []);

  return (
    <div className="fixed inset-0 z-[20000] flex justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity">
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Detalhes da Transação Clara
            </span>
            <h2 className="text-base font-bold text-slate-900 truncate max-w-[320px]">
              {transaction.merchant_name || 'Estabelecimento Desconhecido'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          
          {/* Valor Principal & Status */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Valor da Compra</span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatCurrency(transaction.amount)}
              </div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <Calendar size={12} /> {formatDate(transaction.operation_date)}
              </span>
            </div>

            <div className="text-right flex flex-col items-end gap-1.5">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 ${
                transaction.sync_status === 'SYNCED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : transaction.sync_status === 'READY'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : transaction.sync_status === 'MAPPING_REQUIRED'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : transaction.sync_status === 'ERROR'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {transaction.sync_status === 'SYNCED' && <CheckCircle2 size={13} />}
                {transaction.sync_status === 'ERROR' && <AlertCircle size={13} />}
                {transaction.sync_status === 'READY' && <Clock size={13} />}
                {transaction.sync_status === 'SYNCED' ? 'Sincronizado no Omie' : transaction.sync_status}
              </span>

              <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                Status Clara: {transaction.transaction_status}
              </span>
            </div>
          </div>

          {/* Dados Omie */}
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-2.5">
            <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={14} className="text-emerald-700" />
              Integração Omie ERP
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 text-[11px] block">Lançamento ID (nCodLanc):</span>
                <span className="font-mono font-bold text-slate-900">
                  {transaction.omie_launch_id ? `#${transaction.omie_launch_id}` : 'Não criado'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[11px] block">Código Integração (cCodIntLanc):</span>
                <span className="font-mono text-slate-900 truncate block text-[11px]" title={transaction.omie_integration_id || ''}>
                  {transaction.omie_integration_id || '-'}
                </span>
              </div>

              <div className="col-span-2 pt-1 border-t border-emerald-200/40 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Módulo Omie:</span>
                <span className="font-bold text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded">
                  Finanças → Contas a Pagar (Clara Cartões)
                </span>
              </div>
            </div>

            {/* Edição / Vinculação Omie */}
            <div className="pt-2 border-t border-emerald-200/60 space-y-2.5">
              <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider block">
                Classificação Contábil Omie:
              </span>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Categoria Omie:</label>
                <select
                  value={selectedCat}
                  onChange={e => setSelectedCat(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                >
                  <option value="">Selecione a categoria Omie...</option>
                  {categories.map(c => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.codigo} - {c.descricao}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Centro de Custo (Depto):</label>
                  <select
                    value={selectedDepto}
                    onChange={e => setSelectedDepto(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                  >
                    <option value="">Sem departamento</option>
                    {departments.map(d => (
                      <option key={d.codigo} value={d.codigo}>
                        {d.descricao}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Projeto Omie:</label>
                  <select
                    value={selectedProj}
                    onChange={e => setSelectedProj(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                  >
                    <option value="">Sem projeto</option>
                    {projects.map(p => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.descricao}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Datas Fiscais e Financeiras (Emissão, Competência/Registro e Vencimento) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-100">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    Data Emissão (NF):
                  </label>
                  <input
                    type="date"
                    value={selectedIssueDate}
                    onChange={e => setSelectedIssueDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    Data Registro (Competência):
                  </label>
                  <input
                    type="date"
                    value={selectedRegDate}
                    onChange={e => setSelectedRegDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    Data Vencimento:
                  </label>
                  <input
                    type="date"
                    value={selectedDueDate}
                    onChange={e => setSelectedDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveFields}
                  disabled={savingFields}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingFields ? 'Salvando...' : 'Salvar Classificação'}
                </button>
              </div>
            </div>

            {transaction.sync_status === 'MAPPING_REQUIRED' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 mt-2 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle size={14} className="text-amber-600" />
                  Mapeamento Obrigatório Pendente
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  A categoria <strong>&quot;{transaction.merchant_category || 'Geral'}&quot;</strong> ainda não possui uma Categoria Omie correspondente. Use o botão <strong>Mapear Categorias</strong> na tela principal para associá-la, ou configure uma Categoria Padrão nas Configurações.
                </p>
              </div>
            )}

            {transaction.last_sync_error && (
              <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs mt-2">
                <strong className="block font-bold">Mensagem de Erro:</strong>
                <span className="text-[11px]">{transaction.last_sync_error}</span>
              </div>
            )}
          </div>

          {/* Seção de Comprovantes / Anexos */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip size={14} className="text-slate-500" />
                Comprovantes / Anexos ({loadingDocs ? '...' : docs.length})
              </h3>
              {transaction.attachments_synced && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={10} /> Anexado ao Omie
                </span>
              )}
            </div>

            {loadingDocs ? (
              <div className="flex items-center gap-2 py-2 text-xs text-slate-500 italic">
                <Loader2 size={14} className="animate-spin text-emerald-600" />
                Consultando comprovantes na API Clara...
              </div>
            ) : docs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Nenhum comprovante ou recibo foi anexado pelo portador na Clara.
              </p>
            ) : (
              <div className="space-y-1.5">
                {docs.map((d: any, idx: number) => {
                  const targetUrl = d.url || d.downloadUrl || d.link || (d.id ? `https://app.clara.com/documents/${d.id}` : null);
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText size={16} className="text-slate-400 shrink-0" />
                        <span className="truncate font-medium text-slate-800">
                          {d.name || d.fileName || d.filename || `Comprovante #${idx + 1}`}
                        </span>
                      </div>
                      {targetUrl ? (
                        <a
                          href={targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                          title="Visualizar ou baixar anexo"
                        >
                          <span>Ver</span>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Registrado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Auditoria Fiscal OCR & Compliance Tomador vs Titular */}
            <div className="mt-3 p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-indigo-600" />
                  <span>Auditoria Fiscal (OCR)</span>
                </span>
                <button
                  type="button"
                  onClick={handleRunOcr}
                  disabled={runningOcr || docs.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg transition-all disabled:opacity-40 cursor-pointer border border-indigo-200"
                  title="Executar leitura por IA do PDF/comprovante para extrair CNPJ tomador, emissão e parcelas"
                >
                  {runningOcr ? (
                    <Loader2 size={12} className="animate-spin text-indigo-600" />
                  ) : (
                    <Sparkles size={12} className="text-indigo-600" />
                  )}
                  <span>{runningOcr ? 'Lendo com IA...' : 'Ler com IA (OCR)'}</span>
                </button>
              </div>

              {/* Status de Confronto CNPJ */}
              {transaction.cnpj_match_status === 'MATCH' ? (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[11px] text-emerald-900">Tomador Compatível:</strong>
                    <span className="text-[10px] text-emerald-700">
                      NF emitida para <strong>{transaction.invoice_cnpj_tomador}</strong> ({activeCompanyName}), conferindo com o CNPJ do titular do cartão.
                    </span>
                  </div>
                </div>
              ) : transaction.cnpj_match_status === 'DIVERGENT' ? (
                <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2 text-xs">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[11px] text-amber-900">⚠️ CNPJ do Tomador Divergente:</strong>
                    <p className="text-[10px] text-amber-800 mt-0.5 leading-tight">
                      {transaction.cnpj_divergence_reason || `NF emitida para o CNPJ ${transaction.invoice_cnpj_tomador}, divergindo de ${activeCompanyName} (${activeCompanyCnpj}).`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 italic flex items-center justify-between pt-0.5">
                  <span>
                    {docs.length > 0 
                      ? 'Comprovante disponível. Clique em "Ler com IA" para auditar o CNPJ do tomador.'
                      : 'Sem comprovante anexado para validação de CNPJ.'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium shrink-0 ml-2">Alvo: {activeCompanyName}</span>
                </div>
              )}

              {/* Feedback de execução OCR */}
              {ocrFeedback && (
                <div className={`p-2 text-[10px] rounded-lg border ${
                  ocrFeedback.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {ocrFeedback.message}
                </div>
              )}

              {/* Informações de Parcelamento */}
              {transaction.installments_info && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium text-[11px] flex items-center gap-1">
                    <Layers size={13} className="text-indigo-500" />
                    Parcelamento Detectado:
                  </span>
                  <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[10px]">
                    Parcela {transaction.installments_info.current} de {transaction.installments_info.total}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Dados Clara */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Identificação & Portador Clara
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 text-[11px] block flex items-center gap-1">
                  <User size={12} /> Portador
                </span>
                <span className="font-semibold text-slate-800">{transaction.user_name || 'N/A'}</span>
                {transaction.user_email && (
                  <span className="text-[10px] text-slate-500 block truncate">{transaction.user_email}</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block flex items-center gap-1">
                  <CreditCard size={12} /> Cartão
                </span>
                <span className="font-mono font-semibold text-slate-800">
                  {transaction.card_last_digits ? `**** ${transaction.card_last_digits}` : 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block">Código de Autorização:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {transaction.authorization_number || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block">Categoria Estabelecimento:</span>
                <span className="font-medium text-slate-800">
                  {transaction.merchant_category || 'Geral'}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-slate-400 text-[11px] block">UUID Clara:</span>
                <span className="font-mono text-[10px] text-slate-600 break-all select-all">
                  {transaction.clara_uuid}
                </span>
              </div>
            </div>
          </div>

          {/* Raw JSON Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowRaw(!showRaw)}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
            >
              {showRaw ? 'Ocultar JSON Bruto' : 'Inspecionar Payload JSON Bruto'}
            </button>

            {showRaw && (
              <div className="relative mt-2 p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] max-h-48 overflow-y-auto">
                <button
                  onClick={handleCopyJson}
                  className="absolute top-2 right-2 p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 flex items-center gap-1 text-[10px]"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
                <pre>{JSON.stringify(transaction.raw_payload || transaction, null, 2)}</pre>
              </div>
            )}
          </div>

        </div>

        {/* Banner de Progresso e Resultado do Envio ao Omie */}
        {(syncStep || syncResult) && (
          <div className="px-6 pb-2 shrink-0">
            {syncStep && !syncResult && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-medium">
                <Loader2 size={13} className="animate-spin text-blue-600 shrink-0" />
                <span>{syncStep}</span>
              </div>
            )}
            {syncResult && (
              <div className={`px-3 py-2.5 rounded-xl border text-xs space-y-1 ${
                syncResult.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : syncResult.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {syncResult.type === 'success' && <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />}
                  {syncResult.type === 'error' && <XCircle size={14} className="text-red-600 shrink-0" />}
                  {syncResult.type === 'warning' && <AlertCircle size={14} className="text-amber-600 shrink-0" />}
                  <span>{syncResult.title}</span>
                </div>
                <p className="pl-5 text-[11px] leading-relaxed opacity-90">{syncResult.message}</p>
                {syncResult.omieId && (
                  <div className="pl-5 flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      syncResult.omieValidated
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}>
                      {syncResult.omieValidated ? <ShieldCheck size={10} /> : <Clock size={10} />}
                      {syncResult.omieValidated ? 'Verificado na base Omie' : 'Pendente verificação'}
                    </span>
                    <span className="font-mono text-[10px] opacity-70">ID #{syncResult.omieId}</span>
                  </div>
                )}
                <button
                  onClick={() => setSyncResult(null)}
                  className="pl-5 text-[10px] underline opacity-60 hover:opacity-100 mt-0.5 block"
                >
                  Fechar aviso
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0 pb-6">
          <button
            type="button"
            onClick={handleIgnore}
            disabled={retrying || transaction.sync_status === 'SYNCED'}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
          >
            Ignorar
          </button>

          <div className="flex items-center gap-2">
            {transaction.sync_status === 'SYNCED' && (
              <button
                type="button"
                onClick={handleForceResync}
                disabled={retrying}
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                title="Limpa o ID anterior e recria o título no módulo Contas a Pagar"
              >
                <RefreshCw size={13} className={retrying ? 'animate-spin' : ''} />
                <span>Forçar Reenvio (Contas a Pagar)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer ${
                transaction.sync_status === 'SYNCED'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-slate-900 hover:bg-black'
              }`}
            >
              {retrying ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
              <span>{transaction.sync_status === 'SYNCED' ? 'Reenviar Anexos' : 'Enviar Lançamento ao Omie'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
