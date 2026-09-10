"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  X, 
  CheckCircle, 
  Clock, 
  Calendar, 
  CreditCard, 
  Loader2, 
  AlertCircle, 
  CheckSquare, 
  Square, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, formatDate } from "@/services/loans.service";
import { PaymentsService, LoanPayment } from "@/services/payments.service";
import { useDataMode } from "@/contexts/DataModeContext";

interface PaymentProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthCycle?: string;
}

export function PaymentProcessingModal({ isOpen, onClose, monthCycle }: PaymentProcessingModalProps) {
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stats, setStats] = useState({
    total: 0, pending: 0, paid: 0, postponed: 0,
    pendingAmount: 0, paidAmount: 0, postponedAmount: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postponedDate, setPostponedDate] = useState("");
  const [showPostponeInput, setShowPostponeInput] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { isTestMode } = useDataMode();
  
  // Alternador de visão: Por Colaborador (agrupado) vs Por Parcela (detalhado)
  const [viewMode, setViewMode] = useState<'colaboradores' | 'parcelas'>('colaboradores');
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  // Estado para o Mês Selecionado (Ex: '2026-09')
  const [selectedMonth, setSelectedMonth] = useState(monthCycle || new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (isOpen) {
      loadPayments();
    }
  }, [isOpen, selectedMonth, isTestMode]);

  const loadPayments = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const [paymentsData, statsData] = await Promise.all([
        PaymentsService.getPaymentsByMonth(selectedMonth, isTestMode),
        PaymentsService.getMonthStats(selectedMonth, isTestMode)
      ]);
      
      setPayments(paymentsData);
      setStats(statsData);
      setSelectedIds([]);
      // Expande automaticamente colaboradores com mais de 1 parcela para conveniência
      const multi = new Set<string>();
      const counts = new Map<string, number>();
      paymentsData.forEach(p => {
        const empName = (p as any).contracts?.employee_name || 'Desconhecido';
        counts.set(empName, (counts.get(empName) || 0) + 1);
        if ((counts.get(empName) || 0) > 1) multi.add(empName);
      });
      setExpandedEmployees(multi);
    } catch (err) {
      setError('Falha ao carregar parcelas');
    } finally {
      setIsLoading(false);
    }
  };

  interface EmployeePayrollGroup {
    employeeName: string;
    totalAmount: number;
    pendingAmount: number;
    paidAmount: number;
    pendingCount: number;
    paidCount: number;
    payments: LoanPayment[];
  }

  // Agrupamento memoizado por Colaborador
  const groupedEmployees = useMemo(() => {
    const map = new Map<string, EmployeePayrollGroup>();

    payments.forEach(p => {
      const empName = (p as any).contracts?.employee_name || 'Desconhecido';
      const item: EmployeePayrollGroup = map.get(empName) || {
        employeeName: empName,
        totalAmount: 0,
        pendingAmount: 0,
        paidAmount: 0,
        pendingCount: 0,
        paidCount: 0,
        payments: []
      };
      const amount = Number(p.amount) || 0;
      item.totalAmount += amount;
      if (p.status === 'PAGO') {
        item.paidAmount += amount;
        item.paidCount++;
      } else if (p.status === 'PENDENTE') {
        item.pendingAmount += amount;
        item.pendingCount++;
      }
      item.payments.push(p);
      map.set(empName, item);
    });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [payments]);

  const changeMonth = (offset: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleEmployeeAccordion = (empName: string) => {
    setExpandedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(empName)) next.delete(empName);
      else next.add(empName);
      return next;
    });
  };

  const toggleEmployeeSelection = (employeePayments: LoanPayment[]) => {
    const pendingIds = employeePayments.filter(p => p.status === 'PENDENTE').map(p => p.id);
    if (pendingIds.length === 0) return;
    const allSelected = pendingIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !pendingIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pendingIds])));
    }
  };

  const selectAllPending = () => {
    const pendingIds = payments
      .filter(p => p.status === 'PENDENTE')
      .map(p => p.id);
    setSelectedIds(pendingIds);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleMarkAsPaid = async () => {
    if (selectedIds.length === 0) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      await PaymentsService.processBatch({
        payment_ids: selectedIds,
        action: 'PAGO'
      }, isTestMode);
      
      setSuccessMessage(`${selectedIds.length} parcela(s) marcada(s) como PAGO`);
      await loadPayments();
    } catch (err) {
      setError('Falha ao marcar parcelas como pagas');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePostpone = async () => {
    if (selectedIds.length === 0 || !postponedDate) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      await PaymentsService.processBatch({
        payment_ids: selectedIds,
        action: 'POSTERGADO',
        postponed_date: postponedDate
      }, isTestMode);
      
      setSuccessMessage(`${selectedIds.length} parcela(s) postergada(s) para ${postponedDate}`);
      setShowPostponeInput(false);
      setPostponedDate("");
      await loadPayments();
    } catch (err) {
      setError('Falha ao postergar parcelas');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAGO':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white"><CheckCircle size={10} /> PAGO</span>;
      case 'POSTERGADO':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white"><Clock size={10} /> POSTERGADO</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600"><AlertCircle size={10} /> PENDENTE</span>;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-3 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-4xl sm:max-h-[90vh] bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col border border-slate-200"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 via-white to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 shrink-0">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Processar Parcelas</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <button 
                      onClick={() => changeMonth(-1)}
                      className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-emerald-600 cursor-pointer"
                      title="Mês Anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      Mês: {selectedMonth.split('-')[1]}/{selectedMonth.split('-')[0]}
                    </span>
                    <button 
                      onClick={() => changeMonth(1)}
                      className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-emerald-600 cursor-pointer"
                      title="Próximo Mês"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* View Mode Toggle & Close */}
              <div className="flex items-center gap-2">
                <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                  <button
                    onClick={() => setViewMode('colaboradores')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'colaboradores'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users size={13} />
                    <span>Por Colaborador ({groupedEmployees.length})</span>
                  </button>
                  <button
                    onClick={() => setViewMode('parcelas')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'parcelas'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Layers size={13} />
                    <span>Por Parcela ({payments.length})</span>
                  </button>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-red-500 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Stats Cards (4 colunas) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/80 border-b border-slate-100">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Colaboradores</p>
                <p className="text-xl font-black text-slate-900">{groupedEmployees.length}</p>
                <p className="text-xs text-slate-500">com parcelas no mês</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Total Parcelas</p>
                <p className="text-xl font-black text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-500">{formatCurrency(stats.pendingAmount + stats.paidAmount + stats.postponedAmount)}</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-600 uppercase">Pagas</p>
                <p className="text-xl font-black text-emerald-600">{stats.paid}</p>
                <p className="text-xs text-emerald-600/70">{formatCurrency(stats.paidAmount)}</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                <p className="text-[10px] font-bold text-amber-600 uppercase">Pendentes</p>
                <p className="text-xl font-black text-amber-600">{stats.pending}</p>
                <p className="text-xs text-amber-600/70">{formatCurrency(stats.pendingAmount)}</p>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                </div>
              ) : error ? (
                <div className="p-4 text-center text-red-600 bg-red-50 rounded-xl border border-red-200">
                  {error}
                  <button 
                    onClick={loadPayments}
                    className="block mx-auto mt-2 text-sm font-bold underline"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : successMessage ? (
                <div className="p-4 text-center text-emerald-700 bg-emerald-50 rounded-xl mb-4 border border-emerald-200 flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-bold text-sm">{successMessage}</span>
                </div>
              ) : null}

              {/* Selection Actions Bar */}
              {payments.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllPending}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckSquare size={14} />
                      Selecionar Todas Pendentes
                    </button>
                    {selectedIds.length > 0 && (
                      <button
                        onClick={clearSelection}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                      >
                        <Square size={14} />
                        Limpar ({selectedIds.length})
                      </button>
                    )}
                  </div>
                  
                  {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      {!showPostponeInput ? (
                        <>
                          <button
                            onClick={() => setShowPostponeInput(true)}
                            className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-all cursor-pointer"
                          >
                            <Clock size={12} className="inline mr-1" />
                            Postergar ({selectedIds.length})
                          </button>
                          <button
                            onClick={handleMarkAsPaid}
                            disabled={isProcessing}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                          >
                            {isProcessing ? <Loader2 size={12} className="animate-spin inline mr-1" /> : <CheckCircle size={12} className="inline mr-1" />}
                            Marcar Pago ({selectedIds.length})
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={postponedDate}
                            onChange={(e) => setPostponedDate(e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          />
                          <button
                            onClick={handlePostpone}
                            disabled={!postponedDate || isProcessing}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {isProcessing ? <Loader2 size={12} className="animate-spin" /> : 'OK'}
                          </button>
                          <button
                            onClick={() => { setShowPostponeInput(false); setPostponedDate(''); }}
                            className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MODO 1: VISÃO AGRUPADA POR COLABORADOR */}
              {viewMode === 'colaboradores' ? (
                <div className="space-y-3">
                  {groupedEmployees.length === 0 ? (
                    <p className="text-center text-slate-400 py-12">Nenhum colaborador com parcelas para este mês</p>
                  ) : (
                    groupedEmployees.map((emp) => {
                      const isExpanded = expandedEmployees.has(emp.employeeName);
                      const pendingPayments = emp.payments.filter(p => p.status === 'PENDENTE');
                      const hasPending = pendingPayments.length > 0;
                      const allPendingSelected = hasPending && pendingPayments.every(p => selectedIds.includes(p.id));
                      const someSelected = pendingPayments.some(p => selectedIds.includes(p.id));

                      return (
                        <div
                          key={emp.employeeName}
                          className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all hover:border-slate-300 shadow-sm"
                        >
                          {/* Cabeçalho do Colaborador */}
                          <div className="p-3.5 flex items-center gap-3 bg-slate-50/50">
                            {/* Checkbox de seleção do colaborador */}
                            <button
                              onClick={() => toggleEmployeeSelection(emp.payments)}
                              disabled={!hasPending}
                              className={hasPending ? "cursor-pointer" : "cursor-not-allowed opacity-30"}
                              title={hasPending ? "Selecionar todas as pendentes deste colaborador" : "Todas já pagas"}
                            >
                              {allPendingSelected ? (
                                <CheckSquare size={20} className="text-emerald-600" />
                              ) : someSelected ? (
                                <div className="w-5 h-5 rounded border border-emerald-500 bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs leading-none">
                                  -
                                </div>
                              ) : (
                                <Square size={20} className="text-slate-300" />
                              )}
                            </button>

                            {/* Informações do Colaborador */}
                            <div 
                              className="flex-1 min-w-0 cursor-pointer flex flex-wrap items-center justify-between gap-2"
                              onClick={() => toggleEmployeeAccordion(emp.employeeName)}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-black text-slate-900 tracking-tight">
                                    {emp.employeeName}
                                  </h4>
                                  {emp.payments.length > 1 && (
                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                                      {emp.payments.length} contratos
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                  <span>Desconto Total: <strong className="text-slate-900">{formatCurrency(emp.totalAmount)}</strong></span>
                                  {emp.pendingAmount > 0 && (
                                    <span className="text-amber-700 font-semibold">• Pendente: {formatCurrency(emp.pendingAmount)}</span>
                                  )}
                                  {emp.paidAmount > 0 && (
                                    <span className="text-emerald-700 font-semibold">• Pago: {formatCurrency(emp.paidAmount)}</span>
                                  )}
                                </div>
                              </div>

                              {/* Badges de Status Consolidado e Toggle */}
                              <div className="flex items-center gap-3">
                                {emp.pendingCount === 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                                    <CheckCircle size={10} /> 100% PAGO
                                  </span>
                                ) : emp.paidCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                                    <Clock size={10} /> PARCIAL ({emp.paidCount}/{emp.payments.length})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                                    <AlertCircle size={10} /> PENDENTE ({emp.pendingCount})
                                  </span>
                                )}

                                <button
                                  type="button"
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                >
                                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Accordion com as Parcelas Individuais */}
                          {isExpanded && (
                            <div className="p-3 pt-2 bg-white space-y-2 border-t border-slate-100">
                              {emp.payments.map((p) => (
                                <div
                                  key={p.id}
                                  className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 text-xs ${
                                    selectedIds.includes(p.id)
                                      ? 'border-emerald-300 bg-emerald-50/70'
                                      : 'border-slate-100 bg-slate-50/30 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <button
                                      onClick={() => p.status === 'PENDENTE' && toggleSelection(p.id)}
                                      className={p.status === 'PENDENTE' ? 'cursor-pointer' : 'cursor-not-allowed opacity-30'}
                                    >
                                      {selectedIds.includes(p.id) ? (
                                        <CheckSquare size={16} className="text-emerald-600" />
                                      ) : (
                                        <Square size={16} className="text-slate-300" />
                                      )}
                                    </button>

                                    <div>
                                      <span className="font-mono text-[11px] font-bold text-slate-700 mr-2">
                                        OP #{(p as any).contracts?.operation_number || p.contract_id?.slice(0, 8)}
                                      </span>
                                      <span className="text-slate-400 text-[11px]">
                                        Venc: {formatDate(p.due_date)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span className="font-black text-slate-900 text-sm">
                                      {formatCurrency(p.amount)}
                                    </span>
                                    {getStatusBadge(p.status)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* MODO 2: VISÃO POR PARCELA INDIVIDUAL (MODO CORRIDO) */
                <div className="space-y-2">
                  {payments.length === 0 ? (
                    <p className="text-center text-slate-400 py-12">Nenhuma parcela encontrada para este mês</p>
                  ) : (
                    payments.map((payment) => (
                      <div
                        key={payment.id}
                        className={`p-3 rounded-xl border transition-all ${
                          selectedIds.includes(payment.id)
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => payment.status === 'PENDENTE' && toggleSelection(payment.id)}
                            className={payment.status === 'PENDENTE' ? 'cursor-pointer' : 'cursor-not-allowed opacity-30'}
                          >
                            {selectedIds.includes(payment.id) ? (
                              <CheckSquare size={20} className="text-emerald-600" />
                            ) : (
                              <Square size={20} className="text-slate-300" />
                            )}
                          </button>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900">
                                {(payment as any).contracts?.employee_name || 'Funcionário'}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                OP #{(payment as any).contracts?.operation_number || payment.contract_id?.slice(0, 8)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Calendar size={10} />
                                Venc: {formatDate(payment.due_date)}
                              </span>
                              <span className="font-bold text-slate-900">
                                {formatCurrency(payment.amount)}
                              </span>
                              {payment.postponed_to && (
                                <span className="text-amber-600">
                                  → {formatDate(payment.postponed_to)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div>{getStatusBadge(payment.status)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
