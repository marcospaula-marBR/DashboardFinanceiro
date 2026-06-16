"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowUpRight, Clock, CheckCircle, RotateCcw, ChevronDown, ChevronUp, Paperclip, Check, Upload, ExternalLink, Loader2, Trash2, FileText, Calendar, Edit2, XCircle } from "lucide-react";
import { useDataMode } from "@/contexts/DataModeContext";
import { LoansService, formatDate } from "@/services/loans.service";
import { PaymentsService } from "@/services/payments.service";

interface Contract {
  id: string;
  operationNumber: string;
  value: string;
  balance: string;
  installments: string;
  nextPayment: string;
  endDate: string;
  status: "ATIVO" | "LIQUIDADO" | "ATRASADO";
  startDate: string;
  contractUrl?: string;
  requestDate?: string;
  firstPaymentDate?: string;
}

interface ContractCardProps {
  contract: Contract;
  onAntecipar?: () => void;
  onPostergar?: () => void;
  onLiquidar?: () => void;
  onEditar?: () => void;
  onReverter?: () => void;
  onDeletar?: () => void;
  onGerarTermo?: () => void;
  onDataChanged?: () => void;
}

const statusMap = {
  ATIVO: { 
    bg: "bg-emerald-500", 
    text: "text-white", 
    label: "ATIVO",
    shadow: "shadow-emerald-200"
  },
  LIQUIDADO: { 
    bg: "bg-slate-500", 
    text: "text-white", 
    label: "LIQUIDADO",
    shadow: "shadow-slate-200"
  },
  ATRASADO: { 
    bg: "bg-red-500", 
    text: "text-white", 
    label: "ATRASADO",
    shadow: "shadow-red-200"
  },
};

export function ContractCard({ 
  contract, 
  onAntecipar, 
  onPostergar, 
  onLiquidar, 
  onEditar, 
  onReverter,
  onDeletar,
  onGerarTermo,
  onDataChanged,
}: ContractCardProps) {
  const status = statusMap[contract.status];
  const { isTestMode } = useDataMode();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States para edicao de datas
  const [isEditing, setIsEditing] = useState(false);
  const [editRequestDate, setEditRequestDate] = useState("");
  const [editFirstPaymentDate, setEditFirstPaymentDate] = useState("");
  const [isSavingDates, setIsSavingDates] = useState(false);
  const [isExtractingDates, setIsExtractingDates] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingDueDate, setEditingDueDate] = useState<string>("");

  const ddmmyyyyToYyyymmdd = (dateStr: string) => {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return "";
  };

  const handleSuggestDates = async () => {
    if (!contract.contractUrl) return;
    setIsExtractingDates(true);
    try {
      const response = await fetch('/api/loans/extract-contract-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractUrl: contract.contractUrl })
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.first_payment_date) {
        setEditFirstPaymentDate(data.first_payment_date);
      }
      if (data.request_date) {
        setEditRequestDate(data.request_date);
      }
      
      let msg = "Sugestão carregada com sucesso!";
      if (data.confidence !== undefined) {
        msg += ` (Confiança da IA: ${Math.round(data.confidence * 100)}%)`;
      }
      alert(msg);
    } catch (err: any) {
      alert(`Erro ao sugerir datas via IA: ${err.message}`);
    } finally {
      setIsExtractingDates(false);
    }
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditRequestDate(contract.requestDate?.split('T')[0] || "");
    setEditFirstPaymentDate(contract.firstPaymentDate?.split('T')[0] || "");
    setIsEditing(true);
  };
  
  const fetchTimeline = async () => {
    setIsLoadingTimeline(true);
    try {
      const data = await LoansService.getContractTimeline(contract.id, isTestMode);
      setTimeline(data);
    } catch (err) {
      console.error("Erro ao buscar extrato do contrato", err);
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      fetchTimeline();
    }
  }, [isExpanded, contract.balance, contract.status, contract.firstPaymentDate, contract.requestDate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`Arquivo muito grande. Limite: ${MAX_MB}MB.`);
      return;
    }

    setIsUploading(true);
    try {
      await LoansService.uploadContractFile(contract.id, file, isTestMode);
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      alert(`Erro ao enviar arquivo: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenFile = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contract.contractUrl) return;
    setIsOpeningFile(true);
    try {
      const signedUrl = await LoansService.getContractSignedUrl(contract.contractUrl);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(`Falha ao abrir o arquivo: ${err.message}`);
    } finally {
      setIsOpeningFile(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm relative transition-all hover:border-emerald-200 hover:shadow-md overflow-hidden">
      
      {/* Header Interativo (Toggle Expand) */}
      <div 
        className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
              #{contract.operationNumber}
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">OP. #{contract.id}</p>
              {contract.firstPaymentDate && (
                <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                  Início do débito: {formatDate(contract.firstPaymentDate)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase ${status.bg} ${status.text} shadow-sm ${status.shadow}`}>
              {status.label}
            </span>
            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-3">
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Valor do Empréstimo</p>
          <p className="text-sm font-black text-slate-800 tabular-nums">{contract.value}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Saldo Devedor</p>
          <p className="text-sm font-black text-red-600 tabular-nums">{contract.balance}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Parcelas</p>
          <p className="text-sm font-black text-slate-800 tabular-nums">{contract.installments}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Última Parcela</p>
          <p className="text-sm font-black text-emerald-600 tabular-nums">{contract.endDate}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Assinatura</p>
          <p className="text-xs font-bold text-slate-700">{contract.requestDate ? formatDate(contract.requestDate) : '-'}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">1ª Parcela</p>
          <p className="text-xs font-bold text-slate-700">{contract.firstPaymentDate ? formatDate(contract.firstPaymentDate) : '-'}</p>
        </div>
      </div>

      </div>
      
      {/* Expanded Area */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-5">
          {/* Ações (Movidas pra cá) */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <button 
              onClick={(e) => { e.stopPropagation(); onAntecipar?.(); }}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white hover:bg-sky-50 text-slate-600 hover:text-sky-600 transition-all border border-slate-200 hover:border-sky-200"
            >
              <ArrowUpRight size={16} />
              <span className="text-[9px] font-bold uppercase">Antecipar</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onPostergar?.(); }}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-600 transition-all border border-slate-200 hover:border-amber-200"
            >
              <Clock size={16} />
              <span className="text-[9px] font-bold uppercase">Postergar</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onLiquidar?.(); }}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-all border border-slate-200 hover:border-emerald-200"
            >
              <CheckCircle size={16} />
              <span className="text-[9px] font-bold uppercase">Liquidar</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDeletar?.(); }}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-red-700 transition-all border border-slate-200 hover:border-red-200 col-span-1 shadow-sm"
              title="Apagar contrato permanentemente"
            >
              <Trash2 size={16} />
              <span className="text-[9px] font-bold uppercase transition-colors">Zerar/Excluir</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onReverter?.(); }}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-amber-600 transition-all border border-slate-200 hover:border-amber-200 col-span-1 shadow-sm"
            >
              <RotateCcw size={16} />
              <span className="text-[9px] font-bold uppercase transition-colors">Reverter</span>
            </button>

            <button 
              onClick={handleStartEdit}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-600 transition-all border border-slate-200 hover:border-amber-200 col-span-1 shadow-sm"
            >
              <Calendar size={16} className="text-amber-600" />
              <span className="text-[9px] font-bold uppercase transition-colors">Editar Datas</span>
            </button>
          </div>

          {/* Formulario de Edicao de Datas */}
          {isEditing && (
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 mb-6 space-y-4 shadow-sm">
              <h5 className="text-xs font-black text-amber-800 uppercase flex items-center gap-1">
                <Calendar size={14} /> Editar Datas do Contrato
              </h5>
              
              {timeline.some(t => t.status === 'PAGO') && (
                <div className="bg-amber-100 text-amber-900 border-l-4 border-amber-500 p-2.5 rounded-r-lg text-[10px] font-semibold leading-relaxed">
                  ⚠️ <strong>Atenção:</strong> Este contrato possui parcelas já pagas. Alterar as datas irá recalcular o cronograma, mas preservará o status de PAGO das parcelas.
                </div>
              )}

              {contract.contractUrl && (
                <button
                  type="button"
                  disabled={isExtractingDates}
                  onClick={handleSuggestDates}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm text-center"
                >
                  {isExtractingDates ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Lendo contrato com IA...
                    </>
                  ) : (
                    <>
                      <span>🤖 Sugerir Datas via IA</span>
                    </>
                  )}
                </button>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Assinatura</label>
                  <input
                    type="date"
                    value={editRequestDate}
                    onChange={(e) => setEditRequestDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vencimento 1ª Parc.</label>
                  <input
                    type="date"
                    value={editFirstPaymentDate}
                    onChange={(e) => setEditFirstPaymentDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 opacity-60">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Valor (Contratual)</label>
                  <input
                    type="text"
                    readOnly
                    value={contract.value}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs cursor-not-allowed outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qtd. Parcelas</label>
                  <input
                    type="text"
                    readOnly
                    value={contract.installments}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs cursor-not-allowed outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  disabled={isSavingDates}
                  onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  disabled={isSavingDates}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!editRequestDate || !editFirstPaymentDate) {
                      alert("Por favor, preencha ambas as datas.");
                      return;
                    }
                    setIsSavingDates(true);
                    try {
                      await LoansService.updateContractDates(
                        contract.id,
                        editRequestDate,
                        editFirstPaymentDate,
                        isTestMode
                      );
                      setIsEditing(false);
                      await fetchTimeline();
                      if (onDataChanged) onDataChanged();
                    } catch (err: any) {
                      alert(`Erro ao salvar datas: ${err.message}`);
                    } finally {
                      setIsSavingDates(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                >
                  {isSavingDates && <Loader2 size={12} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            </div>
          )}

          {/* Anexo de Contrato */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFileUpload}
          />
          <div className="mb-6 bg-white p-3 rounded-xl border border-dashed border-slate-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${contract.contractUrl ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Termo do Contrato</p>
                  {isUploading ? (
                    <p className="text-[10px] text-sky-600 font-semibold">Enviando arquivo...</p>
                  ) : contract.contractUrl ? (
                    <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <Check size={10} /> Arquivo salvo com segurança
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-semibold">Nenhum arquivo anexado</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {contract.contractUrl && (
                  <button
                    onClick={handleOpenFile}
                    disabled={isOpeningFile}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 transition flex items-center gap-1 disabled:opacity-50"
                  >
                    {isOpeningFile ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                    Abrir
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  disabled={isUploading}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                >
                  <Upload size={12} /> {contract.contractUrl ? 'Substituir' : 'Enviar Arquivo'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (onGerarTermo) onGerarTermo(); }}
                  title="Gerar PDF Pró-forma no formato original"
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <FileText size={12} /> 
                  {contract.contractUrl ? 'Baixar 2ª Via' : 'Gerar Termo'}
                </button>
              </div>
            </div>
          </div>

          {/* Timeline de Parcelas */}
          <div>
            <h4 className="text-xs font-black text-slate-800 mb-3 ml-2 flex items-center gap-2">
              EXTRATO DE PARCELAS
              {isLoadingTimeline && <span className="text-[10px] text-slate-400 font-normal">Carregando...</span>}
            </h4>
            <div className="space-y-0.5 relative before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {timeline.map((item, idx) => {
                let dotColor = "bg-slate-300 border-white";
                let textColor = "text-slate-500";
                
                if (item.status === 'PAGO') {
                  dotColor = "bg-emerald-500 border-emerald-100";
                  textColor = "text-emerald-700 font-bold";
                } else if (item.status === 'ANTECIPADO') {
                  dotColor = "bg-sky-500 border-sky-100";
                  textColor = "text-sky-700 font-bold";
                } else if (item.status === 'POSTERGADO') {
                  dotColor = "bg-amber-400 border-amber-100";
                  textColor = "text-amber-600 font-bold";
                } else if (item.status === 'PENDENTE' && contract.status === 'LIQUIDADO') {
                  dotColor = "bg-slate-200 border-slate-100";
                  textColor = "text-slate-400 italic font-normal";
                } else {
                  dotColor = "bg-slate-300 border-white";
                  textColor = "text-slate-500";
                }

                return (
                  <div key={idx} className="flex flex-row items-center gap-4 relative pl-8 py-2 hover:bg-slate-100/50 rounded-lg transition-colors group">
                    {/* Dot */}
                    <div className={`absolute left-2 w-[11px] h-[11px] rounded-full border-2 ${dotColor} z-10 transition-transform group-hover:scale-125`} />
                    
                    <div className="flex-1 flex justify-between items-center">
                      <div className="flex flex-col">
                        {editingPaymentId === item.id ? (
                          <div className="flex items-center gap-1.5 py-0.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="date"
                              value={editingDueDate}
                              onChange={(e) => setEditingDueDate(e.target.value)}
                              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                            />
                            <button
                              onClick={async () => {
                                if (!editingDueDate) return;
                                try {
                                  await PaymentsService.updateDueDate(item.id, editingDueDate, isTestMode);
                                  setEditingPaymentId(null);
                                  await fetchTimeline();
                                  if (onDataChanged) onDataChanged();
                                } catch (err: any) {
                                  alert(`Erro ao atualizar data: ${err.message}`);
                                }
                              }}
                              className="p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded transition"
                              title="Salvar"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => setEditingPaymentId(null)}
                              className="p-1 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded transition"
                              title="Cancelar"
                            >
                              <XCircle size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 group/edit">
                            {item.label}
                            {item.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPaymentId(item.id);
                                  setEditingDueDate(ddmmyyyyToYyyymmdd(item.label));
                                }}
                                className="opacity-0 group-hover/edit:opacity-100 p-0.5 text-slate-400 hover:text-slate-700 transition"
                                title="Editar data de vencimento desta parcela"
                              >
                                <Edit2 size={11} className="inline" />
                              </button>
                            )}
                          </span>
                        )}
                        <span className={`text-[10px] ${textColor}`}>
                          {item.index > 0 ? `Parcela ${item.index}` : 'Suspensão'} • {item.status === 'PENDENTE' && contract.status === 'LIQUIDADO' ? 'DESCONTÍNUO (LIQUIDADO)' : item.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {item.amount > 0 && (
                          <span className="text-xs font-bold text-slate-800 font-mono">
                            R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                        {/* Baixar: PENDENTE → PAGO */}
                        {item.status === 'PENDENTE' && item.id && contract.status !== 'LIQUIDADO' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const todayBR = new Date().toLocaleDateString('pt-BR');
                              const userDate = window.prompt(
                                "Confirmar pagamento desta parcela?\n\n" +
                                "Digite a data do pagamento no formato DD/MM/AAAA\n(ou deixe em branco para usar a data de hoje):",
                                todayBR
                              );
                              
                              if (userDate === null) return; // cancelou
                              
                              let paidDate: string | undefined = undefined;
                              if (userDate.trim() !== '') {
                                const parts = userDate.split('/');
                                if (parts.length === 3) {
                                  paidDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                                } else {
                                  alert("Formato de data inválido. Usando data atual.");
                                }
                              }
                              
                              try {
                                await PaymentsService.updatePaymentStatus(item.id, 'PAGO', isTestMode, undefined, paidDate);
                                await fetchTimeline();
                                if (onDataChanged) onDataChanged();
                              } catch (err: any) {
                                alert(`Falha ao dar baixa: ${err.message}`);
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black transition border border-emerald-200"
                          >
                            Baixar
                          </button>
                        )}
                        {/* Estornar: PAGO → PENDENTE (correção de auditoria) */}
                        {item.status === 'PAGO' && item.id && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const confirmed = window.confirm(
                                `⚠️ ESTORNAR PARCELA ${item.index}?\n\n` +
                                `Vencimento: ${item.label}\n` +
                                `Valor: R$ ${item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
                                `Esta ação reverte o status para PENDENTE e limpa a data de pagamento.\n` +
                                `Confirmar estorno?`
                              );
                              if (!confirmed) return;
                              try {
                                await PaymentsService.updatePaymentStatus(item.id, 'PENDENTE', isTestMode);
                                await fetchTimeline();
                                if (onDataChanged) onDataChanged();
                              } catch (err: any) {
                                alert(`Falha ao estornar parcela: ${err.message}`);
                              }
                            }}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-black transition border border-red-200"
                            title="Estornar pagamento (reverter para Pendente)"
                          >
                            Estornar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
