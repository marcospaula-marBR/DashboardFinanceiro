"use client";

import { useState, useEffect, useCallback } from "react";
import { HeaderFinanceiro } from "@/components/layout/HeaderFinanceiro";
import { StatCard } from "@/components/loans/StatCard";
import { ClaraConfigModal } from "@/components/clara/ClaraConfigModal";
import { ClaraCategoryMappingModal } from "@/components/clara/ClaraCategoryMappingModal";
import { ClaraDepartmentMappingModal } from "@/components/clara/ClaraDepartmentMappingModal";
import { ClaraTransactionDrawer } from "@/components/clara/ClaraTransactionDrawer";
import { ClaraSyncHistoryModal } from "@/components/clara/ClaraSyncHistoryModal";
import { ClaraTransactionRecord, ClaraSyncStatus } from "@/types/clara.types";
import { 
  CreditCard, 
  RefreshCw, 
  Settings, 
  Tag, 
  Building2, 
  History, 
  ShieldCheck, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  Paperclip, 
  ChevronRight, 
  ArrowUpDown,
  Loader2,
  Calendar
} from "lucide-react";

export default function ClaraIntegrationPage() {
  // Dados
  const [transactions, setTransactions] = useState<ClaraTransactionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState({
    totalTransactions: 0,
    syncedCount: 0,
    pendingCount: 0,
    mappingRequiredCount: 0,
    errorCount: 0,
    ignoredCount: 0,
    syncedAmountTotal: 0,
    lastSyncDate: null as string | null,
    safeMode: true,
  });

  // Filtros
  const [search, setSearch] = useState("");
  const [syncStatus, setSyncStatus] = useState("ALL");
  const [claraStatus, setClaraStatus] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Estados de Carregamento e Execução
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);

  // Modais e Drawers
  const [configOpen, setConfigOpen] = useState(false);
  const [categoryMapOpen, setCategoryMapOpen] = useState(false);
  const [departmentMapOpen, setDepartmentMapOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<ClaraTransactionRecord | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.set('search', search);
      if (syncStatus !== 'ALL') params.set('syncStatus', syncStatus);
      if (claraStatus !== 'ALL') params.set('claraStatus', claraStatus);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/clara/transactions?${params.toString()}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setTransactions(json.data.transactions || []);
        setTotal(json.data.total || 0);
        if (json.data.metrics) setMetrics(json.data.metrics);
      }
    } catch (e: any) {
      console.error('Erro ao buscar transações Clara:', e);
    } finally {
      setLoading(false);
    }
  }, [page, search, syncStatus, claraStatus, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/clara/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'MANUAL' }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSyncResult(data.data);
        await fetchTransactions();
      } else {
        alert(`Erro na sincronização: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Falha de rede ao sincronizar: ${e.message}`);
    } finally {
      setSyncing(false);
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
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Header Corporativo Oficial */}
        <HeaderFinanceiro />

        {/* Título & Subtítulo do Módulo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                <CreditCard size={22} />
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Integração Clara Cartões → Omie
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1 ml-0.5">
              Ponte autônoma para lançamento de compras com cartão corporativo e envio de comprovantes ao Omie
            </p>
          </div>

          {/* Botões de Ação Principal */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
            </button>

            <button
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Settings size={15} className="text-slate-500" />
              <span>Configurações</span>
            </button>

            <button
              onClick={() => setCategoryMapOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Tag size={15} className="text-slate-500" />
              <span className="hidden sm:inline">Mapear</span> Categorias
            </button>

            <button
              onClick={() => setDepartmentMapOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Building2 size={15} className="text-slate-500" />
              <span className="hidden sm:inline">Centros de</span> Custo
            </button>

            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title="Histórico de Execuções"
            >
              <History size={15} className="text-slate-500" />
              <span className="hidden sm:inline">Logs</span>
            </button>
          </div>
        </div>

        {/* Banner de Modo Seguro (Safe Mode) */}
        {metrics.safeMode && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-900">
                  Modo de Teste Ativo (Safe Mode)
                </h3>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  As transações da Clara são importadas, classificadas e preparadas, mas <strong>NENHUM</strong> lançamento real é criado no Omie até que a integração seja confirmada em Produção.
                </p>
              </div>
            </div>

            <button
              onClick={() => setConfigOpen(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer self-start sm:self-auto shadow-xs"
            >
              Gerenciar Modo
            </button>
          </div>
        )}

        {/* Feedback da Última Sincronização */}
        {syncResult && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <div className="text-xs text-emerald-900">
                <strong>Sincronização Concluída:</strong> {syncResult.received} transações consultadas |{' '}
                {syncResult.created} novas | {syncResult.synced} lançadas no Omie |{' '}
                {syncResult.attachmentsUploaded} anexos enviados | {syncResult.mappingRequired} pendentes de categoria.
              </div>
            </div>
            <button
              onClick={() => setSyncResult(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-1"
            >
              OK
            </button>
          </div>
        )}

        {/* Cards de KPIs do Topo */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <StatCard
            title="Transações Clara"
            value={String(metrics.totalTransactions)}
            icon={<CreditCard size={20} />}
            color="slate"
            description="Total consultadas no espelho"
          />

          <StatCard
            title="Lançadas no Omie"
            value={String(metrics.syncedCount)}
            icon={<CheckCircle2 size={20} />}
            color="emerald"
            description={metrics.syncedAmountTotal > 0 ? formatCurrency(metrics.syncedAmountTotal) : 'Lançamentos confirmados'}
          />

          <StatCard
            title="Pendentes / Aptas"
            value={String(metrics.pendingCount)}
            icon={<Clock size={20} />}
            color="blue"
            description="Aguardando disparo ou seguras"
          />

          <StatCard
            title="Sem Categoria"
            value={String(metrics.mappingRequiredCount)}
            icon={<Tag size={20} />}
            color="amber"
            description="Exigem mapeamento De-Para"
            onClick={() => setCategoryMapOpen(true)}
          />

          <StatCard
            title="Com Falha"
            value={String(metrics.errorCount)}
            icon={<AlertCircle size={20} />}
            color="red"
            description="Com erro de inclusão"
          />
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Campo de Busca Textual */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar estabelecimento, portador, autorização..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Filtro por Status Omie */}
            <div>
              <select
                value={syncStatus}
                onChange={e => { setSyncStatus(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
              >
                <option value="ALL">Status Integração (Todos)</option>
                <option value="SYNCED">Sincronizado no Omie</option>
                <option value="READY">Pronto para Envio (Ready)</option>
                <option value="MAPPING_REQUIRED">Aguardando Categoria</option>
                <option value="ERROR">Com Erro</option>
                <option value="IGNORED">Ignoradas</option>
              </select>
            </div>

            {/* Filtro por Status Clara */}
            <div>
              <select
                value={claraStatus}
                onChange={e => { setClaraStatus(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
              >
                <option value="ALL">Status Clara (Todos)</option>
                <option value="AUTHORIZED">AUTHORIZED (Autorizada)</option>
                <option value="PRE_AUTHORIZED">PRE_AUTHORIZED</option>
                <option value="REJECTED">REJECTED (Rejeitada)</option>
                <option value="NOTIFICATION">NOTIFICATION</option>
              </select>
            </div>

            {/* Botão de Limpar Filtros */}
            <div className="flex items-center gap-2">
              {(search || syncStatus !== 'ALL' || claraStatus !== 'ALL' || startDate || endDate) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSyncStatus('ALL');
                    setClaraStatus('ALL');
                    setStartDate('');
                    setEndDate('');
                    setPage(1);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer w-full text-center"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabela de Transações (Desktop + Mobile First) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-emerald-600" size={32} />
              <p className="text-xs text-slate-500 font-medium">Carregando transações do cartão Clara...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                <CreditCard size={28} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">Nenhuma transação encontrada no espelho</div>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  A conexão com a Clara está autenticada. Clique abaixo para buscar as transações da Clara para este painel:
                </p>
              </div>
              <button
                onClick={handleSyncNow}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'Buscando transações da Clara...' : 'Sincronizar da Clara Agora'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* VISÃO DESKTOP: Tabela Completa */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Portador & Cartão</th>
                      <th className="py-3 px-4">Estabelecimento</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                      <th className="py-3 px-4 text-center">Status Clara</th>
                      <th className="py-3 px-4">Categoria Omie</th>
                      <th className="py-3 px-4">Centro de Custo</th>
                      <th className="py-3 px-4 text-center">Status Omie</th>
                      <th className="py-3 px-4 text-center">Anexo</th>
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {transactions.map(tx => {
                      const isSynced = tx.sync_status === 'SYNCED' || Boolean(tx.omie_launch_id);
                      return (
                        <tr 
                          key={tx.id || tx.clara_uuid} 
                          onClick={() => setSelectedTx(tx)}
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-900">
                            {formatDate(tx.operation_date)}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block truncate max-w-[160px]">
                              {tx.user_name || 'N/A'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 block">
                              {tx.card_last_digits ? `**** ${tx.card_last_digits}` : 'N/A'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 block truncate max-w-[200px]" title={tx.merchant_name || ''}>
                              {tx.merchant_name || 'Estabelecimento Desconhecido'}
                            </span>
                            {tx.merchant_category && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-[200px]">
                                {tx.merchant_category}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-black text-slate-900 tabular-nums whitespace-nowrap">
                            {formatCurrency(tx.amount)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.transaction_status === 'AUTHORIZED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {tx.transaction_status}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {tx.omie_category_code ? (
                              <span className="font-medium text-slate-800 text-[11px] block truncate max-w-[150px]">
                                {tx.omie_category_code}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                Não definida
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-slate-600 text-[11px] block truncate max-w-[140px]">
                              {tx.omie_department_code || '-'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 ${
                              isSynced
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : tx.sync_status === 'READY'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : tx.sync_status === 'MAPPING_REQUIRED'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : tx.sync_status === 'ERROR'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {isSynced && <CheckCircle2 size={11} />}
                              {tx.sync_status === 'ERROR' && <AlertCircle size={11} />}
                              {isSynced ? `Omie #${tx.omie_launch_id}` : tx.sync_status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {tx.attachments_synced ? (
                              <span className="inline-flex p-1 text-emerald-600 bg-emerald-50 rounded" title="Comprovante enviado ao Omie">
                                <CheckCircle2 size={15} />
                              </span>
                            ) : tx.has_attachments ? (
                              <span className="inline-flex p-1 text-blue-600 bg-blue-50 rounded" title="Possui comprovante pendente">
                                <Paperclip size={15} />
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedTx(tx); }}
                              className="text-xs text-slate-500 hover:text-slate-900 font-semibold p-1 hover:bg-slate-100 rounded"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* VISÃO MOBILE FIRST (< 1024px): Cards Executivos */}
              <div className="block lg:hidden divide-y divide-slate-100">
                {transactions.map(tx => {
                  const isSynced = tx.sync_status === 'SYNCED' || Boolean(tx.omie_launch_id);
                  return (
                    <div
                      key={tx.id || tx.clara_uuid}
                      onClick={() => setSelectedTx(tx)}
                      className="p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">
                            {formatDate(tx.operation_date)}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 truncate max-w-[220px]">
                            {tx.merchant_name || 'Estabelecimento Desconhecido'}
                          </h4>
                          <span className="text-[11px] text-slate-500">
                            {tx.user_name || 'Portador'} {tx.card_last_digits ? `(**** ${tx.card_last_digits})` : ''}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-slate-900 tabular-nums block">
                            {formatCurrency(tx.amount)}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border inline-block mt-0.5 ${
                            isSynced
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : tx.sync_status === 'MAPPING_REQUIRED'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {isSynced ? 'Omie OK' : tx.sync_status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>Cat: {tx.omie_category_code || <em className="text-amber-600">Sem categoria</em>}</span>
                        {tx.attachments_synced && (
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <Paperclip size={11} /> Comprovante OK
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs">
                <span className="text-slate-500 font-medium">
                  Mostrando {transactions.length} de {total} transações
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Anterior
                  </button>
                  <span className="font-bold text-slate-700 px-1">Página {page}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={transactions.length < pageSize}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </>
          )}

        </div>

      </div>

      {/* Modais & Drawer */}
      <ClaraConfigModal
        isOpen={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={fetchTransactions}
      />

      <ClaraCategoryMappingModal
        isOpen={categoryMapOpen}
        onClose={() => setCategoryMapOpen(false)}
      />

      <ClaraDepartmentMappingModal
        isOpen={departmentMapOpen}
        onClose={() => setDepartmentMapOpen(false)}
      />

      <ClaraSyncHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      <ClaraTransactionDrawer
        transaction={selectedTx}
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        onTransactionUpdated={updated => {
          setSelectedTx(updated);
          setTransactions(transactions.map(t => t.clara_uuid === updated.clara_uuid ? updated : t));
        }}
      />

    </div>
  );
}
