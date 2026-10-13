"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  Send, 
  HandHeart, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Smartphone, 
  Clock, 
  ShieldCheck, 
  XCircle, 
  Flame,
  Check,
  MessageSquare,
  Copy,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { CollaborativePortalService } from '@/services/collaborative-portal.service';
import { HelpOffer, RegisteredDevice } from '@/types/collaborative-portal';

interface WhiteboardAdminNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allMembers: string[];
  pendingHelpOffersCount?: number;
  onOfferDecided?: () => void;
}

export function WhiteboardAdminNotificationsModal({
  isOpen,
  onClose,
  allMembers,
  onOfferDecided,
}: WhiteboardAdminNotificationsModalProps) {
  const [activeTab, setActiveTab] = useState<'ajuda' | 'disparo' | 'ciencia' | 'dispositivos'>('ajuda');
  const [helpOffers, setHelpOffers] = useState<HelpOffer[]>([]);
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [loading, setLoading] = useState(false);

  // Estados do formulário de disparo manual
  const [targetType, setTargetType] = useState<'all' | 'member'>('all');
  const [selectedMember, setSelectedMember] = useState<string>(allMembers[0] || 'MARCOS');
  const [broadcastPriority, setBroadcastPriority] = useState<'info' | 'important' | 'urgent'>('important');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMemberName, setCopiedMemberName] = useState<string | null>(null);

  // Carregar dados ao abrir o modal
  const loadData = async () => {
    setLoading(true);
    try {
      const offers = await CollaborativePortalService.getHelpOffers();
      setHelpOffers(offers);
      const devList = await CollaborativePortalService.getAllRegisteredDevices();
      setDevices(devList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Decidir oferta de ajuda (Aceitar ou Recusar)
  const handleDecideOffer = async (offerId: string, decision: 'aceita' | 'recusada') => {
    const notes = prompt(
      decision === 'aceita'
        ? 'Observação administrativa de aceitação (opcional):'
        : 'Motivo da recusa para ciência do colaborador (opcional):'
    );

    await CollaborativePortalService.decideHelpOffer(offerId, decision, notes || undefined);
    await loadData();
    if (onOfferDecided) onOfferDecided();
  };

  // Envio de Atualização à Equipe (Gravando no Supabase e disparando push)
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;

    setSendingBroadcast(true);
    try {
      await CollaborativePortalService.sendBroadcastNotification({
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        priority: broadcastPriority,
        targetType,
        targetMemberName: targetType === 'member' ? selectedMember : undefined,
      });

      setBroadcastSuccess(true);
      setTimeout(() => {
        setBroadcastSuccess(false);
        setBroadcastTitle('');
        setBroadcastBody('');
      }, 2500);
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleCopyActivationLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dashboard-financeiro-eight.vercel.app';
    const text = `🔔 *CENTRAL DE NOTIFICAÇÕES MAR BRASIL*\n\nPara receber os avisos das suas tarefas no seu celular Motorola Android ou no computador Windows 11:\n1. Acesse: ${origin}/minhas-atividades\n2. Selecione o seu nome no topo da tela.\n3. Toque no botão verde "Ativar Alertas neste Aparelho".\n4. Toque em "Permitir" na notificação do Google Chrome.\n\nPronto! Você receberá suas tarefas com som e notificação direta no aparelho.`;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleCopyIndividualMemberLink = (memberName: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dashboard-financeiro-eight.vercel.app';
    const link = `${origin}/minhas-atividades?membro=${encodeURIComponent(memberName)}`;
    const text = `🔔 *CENTRAL MAR BRASIL — ATIVAÇÃO PARA ${memberName}*\n\nPara receber os avisos das suas tarefas no seu celular Motorola Android ou Windows 11:\n1. Acesse seu link exclusivo: ${link}\n2. Toque no botão verde "Ativar Alertas para ${memberName}".\n3. Toque em "Permitir" na notificação do Google Chrome.\n\nPronto! Seu aparelho estará oficialmente conectado ao seu nome.`;
    navigator.clipboard.writeText(text);
    setCopiedMemberName(memberName);
    setTimeout(() => setCopiedMemberName(null), 3000);
  };

  const pendingOffers = helpOffers.filter(o => o.status === 'pendente');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl bg-[#090e1a] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#060a13]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-white font-mono tracking-wide">
                Central de Notificações — Painel do Administrador
              </h2>
              <p className="text-[11px] text-slate-400">
                Gestão exclusiva de ofertas de ajuda, comunicados e ciência
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex items-center gap-1.5 px-4 pt-3 border-b border-slate-800/80 bg-slate-950/40 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ajuda')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === 'ajuda'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HandHeart size={14} />
            <span>🤝 Ofertas de Ajuda</span>
            {pendingOffers.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 font-black animate-pulse">
                {pendingOffers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('disparo')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === 'disparo'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send size={14} />
            <span>📱 Enviar Atualização</span>
          </button>

          <button
            onClick={() => setActiveTab('dispositivos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === 'dispositivos'
                ? 'border-blue-400 text-blue-300 bg-blue-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone size={14} />
            <span>Dispositivos Conectados</span>
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          
          {/* ── ABA 1: OFERTAS DE AJUDA ── */}
          {activeTab === 'ajuda' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Manifestações colaborativas registradas pelos colaboradores:</span>
                <span className="font-bold text-white">{helpOffers.length} total</span>
              </div>

              {helpOffers.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
                  Nenhuma oferta de ajuda registrada no momento.
                </div>
              ) : (
                helpOffers.map(offer => (
                  <div
                    key={offer.id}
                    className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                      offer.status === 'pendente'
                        ? 'bg-emerald-950/20 border-emerald-500/50 shadow-md shadow-emerald-950/30'
                        : offer.status === 'aceita'
                        ? 'bg-slate-900/50 border-emerald-500/30 opacity-80'
                        : 'bg-slate-900/30 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span className="text-xs font-bold text-white">
                          <strong className="text-emerald-300">{offer.offeredByName}</strong> ofereceu ajuda para <strong className="text-cyan-300">{offer.taskOwnerName}</strong>
                        </span>
                      </div>

                      <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${
                        offer.status === 'pendente'
                          ? 'bg-amber-500 text-slate-950 animate-pulse'
                          : offer.status === 'aceita'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-rose-500 text-white'
                      }`}>
                        {offer.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                      <div className="font-semibold text-white mb-0.5">Demanda: {offer.activityTitle}</div>
                      {offer.notes && <div className="text-slate-400 italic">Proposta: "{offer.notes}"</div>}
                    </div>

                    {/* BOTÕES DE AÇÃO ADMINISTRATIVA */}
                    {offer.status === 'pendente' ? (
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                        <button
                          onClick={() => handleDecideOffer(offer.id, 'recusada')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 transition-colors"
                        >
                          <XCircle size={14} />
                          <span>Recusar</span>
                        </button>
                        <button
                          onClick={() => handleDecideOffer(offer.id, 'aceita')}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-md"
                        >
                          <CheckCircle2 size={14} />
                          <span>Aceitar Oferta de Ajuda</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                        <span>Decidido em: {new Date(offer.decidedAt || offer.createdAt).toLocaleDateString('pt-BR')}</span>
                        {offer.adminNotes && <span>Obs Admin: {offer.adminNotes}</span>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── ABA 2: ENVIAR ATUALIZAÇÃO À EQUIPE ── */}
          {activeTab === 'disparo' && (
            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-cyan-200">
                Dispare notificações manuais que serão entregues nos celulares Android e computadores Windows 11 dos colaboradores.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Destinatário:</label>
                  <select
                    value={targetType}
                    onChange={(e: any) => setTargetType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">📢 Toda a Equipe</option>
                    <option value="member">👤 Colaborador Específico</option>
                  </select>
                </div>

                {targetType === 'member' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Selecione o Membro:</label>
                    <select
                      value={selectedMember}
                      onChange={(e) => setSelectedMember(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      {allMembers.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Prioridade:</label>
                  <select
                    value={broadcastPriority}
                    onChange={(e: any) => setBroadcastPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="urgent">🔴 Urgente (Exige Ciência)</option>
                    <option value="important">🟠 Importante</option>
                    <option value="info">🟢 Informativa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Título do Comunicado:</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="Ex: Alinhamento de Prioridades da Semana"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Mensagem:</label>
                <textarea
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Digite o conteúdo da notificação a ser exibida nas telas..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              {broadcastSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Notificação disparada com sucesso para os dispositivos ativos!</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={sendingBroadcast}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs transition-all shadow-lg shadow-cyan-950/50 min-h-[44px]"
                >
                  <Send size={14} />
                  <span>{sendingBroadcast ? 'Enviando...' : '📱 Disparar Atualização à Equipe'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ── ABA 3: DISPOSITIVOS & MEMBROS CONECTADOS ── */}
          {activeTab === 'dispositivos' && (
            <div className="space-y-4">
              {/* BANNER COM BOTÃO DE COPIAR LINK DE ATIVAÇÃO PARA A EQUIPE */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2">
                    <Smartphone size={14} className="text-cyan-400" />
                    <span>Como Conectar os Celulares e PCs da Equipe</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Envie o link de ativação para a equipe no WhatsApp. O colaborador escolhe seu nome e ativa com 1 toque.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyActivationLink}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all shadow-md min-h-[44px]"
                >
                  {copiedLink ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link para Equipe'}</span>
                </button>
              </div>

              {/* STATUS DE DISPOSITIVOS POR MEMBRO */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase font-mono mb-2 flex items-center justify-between">
                  <span>Membros & Status de Conexão:</span>
                  <span className="text-[10px] text-cyan-400 font-normal">
                    {devices.length} dispositivo{devices.length !== 1 ? 's' : ''} ativo{devices.length !== 1 ? 's' : ''}
                  </span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {allMembers.map(m => {
                    const memberDevs = devices.filter(d => d.memberName?.toUpperCase() === m.toUpperCase());
                    const isConnected = memberDevs.length > 0;

                    return (
                      <div
                        key={m}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          isConnected
                            ? 'bg-slate-900/90 border-emerald-500/40'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs ${
                            isConnected ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/50' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {m.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-white uppercase font-mono truncate">{m}</h5>
                            <span className="text-[10px] flex items-center gap-1.5">
                              {isConnected ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span className="text-emerald-300 font-medium truncate">
                                    {memberDevs[0].deviceLabel}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                  <span className="text-slate-400">Aguardando ativação</span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isConnected ? (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/30 flex-shrink-0">
                              🟢 Conectado
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCopyIndividualMemberLink(m)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[10px] text-cyan-300 font-mono font-bold transition-all shadow-sm active:scale-95"
                              title={`Copiar convite com link direto para ${m}`}
                            >
                              {copiedMemberName === m ? <Check size={11} className="text-emerald-300" /> : <Copy size={11} />}
                              <span>{copiedMemberName === m ? 'Copiado!' : 'Copiar Link'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* LISTA DE DISPOSITIVOS DETECTADOS NO SISTEMA */}
              {devices.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase font-mono">Assinaturas Push Registradas:</h5>
                  <div className="space-y-1 text-xs">
                    {devices.map(d => (
                      <div key={d.id} className="text-[11px] text-slate-300 flex items-center justify-between py-1 border-b border-slate-900 last:border-0">
                        <span>• <strong>{d.memberName || 'Geral'}</strong> — {d.deviceLabel}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(d.lastSeenAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
