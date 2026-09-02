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
  Clock
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
}

export function ClaraTransactionDrawer({
  transaction,
  isOpen,
  onClose,
  onTransactionUpdated,
  categories = [],
  departments = [],
  projects = [],
}: ClaraTransactionDrawerProps) {
  const [retrying, setRetrying] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  // Estados locais dos campos editáveis
  const [selectedCat, setSelectedCat] = useState(transaction?.omie_category_code || '');
  const [selectedDepto, setSelectedDepto] = useState(transaction?.omie_department_code || '');
  const [selectedProj, setSelectedProj] = useState(transaction?.omie_project_code || '');
  
  // Estado para documentos frescos consultados da Clara API
  const [fetchedDocs, setFetchedDocs] = useState<any[] | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    if (transaction) {
      setSelectedCat(transaction.omie_category_code || '');
      setSelectedDepto(transaction.omie_department_code || '');
      setSelectedProj(transaction.omie_project_code || '');
      setFetchedDocs(null);

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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'success' && data.data) {
        onTransactionUpdated(data.data);
        alert('Classificação contábil salva com sucesso!');
      } else {
        alert(`Erro ao salvar campos: ${data.message || `Status HTTP ${res.status}`}`);
      }
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setSavingFields(false);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(transaction.raw_payload || transaction, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/clara/transactions/${transaction.clara_uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        onTransactionUpdated(data.data);
      } else {
        alert(`Erro: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setRetrying(false);
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
            </div>

            {/* Edição / Vinculação Omie */}
            <div className="pt-2 border-t border-emerald-200/60 space-y-2.5">
              <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider block">
                Classificação Contábil Omie:
              </span>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Categoria Omie:</label>
                {transaction.sync_status === 'SYNCED' ? (
                  <span className="font-bold text-slate-900 text-xs">{transaction.omie_category_code}</span>
                ) : (
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
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Centro de Custo (Depto):</label>
                  {transaction.sync_status === 'SYNCED' ? (
                    <span className="text-slate-900 text-xs">{transaction.omie_department_code || '-'}</span>
                  ) : (
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
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Projeto Omie:</label>
                  {transaction.sync_status === 'SYNCED' ? (
                    <span className="text-slate-900 text-xs">{transaction.omie_project_code || '-'}</span>
                  ) : (
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
                  )}
                </div>
              </div>

              {transaction.sync_status !== 'SYNCED' && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleSaveFields}
                    disabled={savingFields}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingFields ? 'Salvando...' : 'Salvar Classificação'}
                  </button>
                </div>
              )}
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
