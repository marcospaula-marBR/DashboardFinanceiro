"use client";

import { useState } from "react";
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
import { ClaraTransactionRecord } from "@/types/clara.types";

interface ClaraTransactionDrawerProps {
  transaction: ClaraTransactionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onTransactionUpdated: (updated: ClaraTransactionRecord) => void;
}

export function ClaraTransactionDrawer({
  transaction,
  isOpen,
  onClose,
  onTransactionUpdated,
}: ClaraTransactionDrawerProps) {
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  if (!isOpen || !transaction) return null;

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

  const docs = transaction.raw_payload?.documents || transaction.raw_payload?.receipts || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
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

              <div>
                <span className="text-slate-500 text-[11px] block">Categoria Omie:</span>
                <span className="font-medium text-slate-900">
                  {transaction.omie_category_code || <em className="text-amber-600">Não mapeada</em>}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[11px] block">Departamento Omie:</span>
                <span className="font-medium text-slate-900">
                  {transaction.omie_department_code || 'Sem departamento'}
                </span>
              </div>
            </div>

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
                Comprovantes / Anexos ({docs.length})
              </h3>
              {transaction.attachments_synced && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={10} /> Anexado ao Omie
                </span>
              )}
            </div>

            {docs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Nenhum comprovante ou recibo foi anexado pelo portador na Clara.
              </p>
            ) : (
              <div className="space-y-1.5">
                {docs.map((d: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <FileText size={16} className="text-slate-400 shrink-0" />
                      <span className="truncate font-medium text-slate-800">
                        {d.name || d.fileName || `Comprovante #${idx + 1}`}
                      </span>
                    </div>
                    {d.url && (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                        title="Visualizar anexo"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
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
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleIgnore}
            disabled={retrying || transaction.sync_status === 'SYNCED'}
            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition-all disabled:opacity-40"
          >
            Ignorar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {retrying ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              <span>{transaction.sync_status === 'SYNCED' ? 'Reenviar Anexos' : 'Processar p/ Omie'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
