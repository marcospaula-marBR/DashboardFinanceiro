"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ChevronLeft, 
  CheckSquare, 
  Users, 
  Bell, 
  User, 
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { getResponsibleColor } from '@/services/war-room.service';

interface PortalNavigationProps {
  activeMember?: string;
  onSelectMember?: (memberName: string) => void;
  availableMembers?: string[];
  unreadNotificationsCount?: number;
}

export function PortalNavigation({
  activeMember = 'MANUS',
  onSelectMember,
  availableMembers = ['MANUS', 'CLARA', 'MARCO', 'ALDO', 'FINANCEIRO', 'JURÍDICO', 'CONTÁBIL', 'TI'],
  unreadNotificationsCount = 2,
}: PortalNavigationProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Minhas Atividades',
      shortLabel: 'Minhas',
      href: '/minhas-atividades',
      icon: CheckSquare,
      badge: null,
    },
    {
      label: 'Lousa da Equipe',
      shortLabel: 'Equipe',
      href: '/equipe/lousa',
      icon: Users,
      badge: 'Ao Vivo',
    },
    {
      label: 'Notificações',
      shortLabel: 'Alertas',
      href: '/equipe/notificacoes',
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : null,
    },
  ];

  const colorConfig = getResponsibleColor(activeMember);

  return (
    <>
      {/* ── HEADER SUPERIOR EXECUTIVO (MOBILE & DESKTOP) ── */}
      <header className="sticky top-0 z-40 w-full bg-[#060a13]/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          
          {/* LADO ESQUERDO: VOLTAR AO INÍCIO & LOGO */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* REGRA P0: BOTÃO VOLTAR AO INÍCIO */}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 transition-all active:scale-95 min-h-[44px] sm:min-h-0"
              title="Voltar ao Portal Principal"
            >
              <ChevronLeft size={16} className="text-cyan-400" />
              <span className="hidden xs:inline">Voltar ao Início</span>
              <span className="xs:hidden">Início</span>
            </Link>

            <div className="h-4 w-px bg-slate-800 hidden sm:block" />

            {/* MARCA DO PORTAL */}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black tracking-wider text-cyan-400 font-mono uppercase">
                  PORTAL DA EQUIPE
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hidden sm:inline-block">
                  MAR BRASIL
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Acompanhamento Operacional Colaborativo & Notificações
              </p>
            </div>
          </div>

          {/* CENTRO: NAVEGAÇÃO DESKTOP / TABLET (Telas > 768px) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800/60">
            {navItems.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* LADO DIREITO: SELETOR DE MEMBRO ATIVO & LINK ADMIN */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Seletor de Membro Ativo (para identificação de responsabilidade) */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1">
              <span className={`w-2.5 h-2.5 rounded-full ${colorConfig.dotClass}`} />
              {onSelectMember ? (
                <select
                  value={activeMember}
                  onChange={(e) => onSelectMember(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1"
                  title="Alterar membro ativo para visualização personalizada"
                >
                  {availableMembers.map(m => (
                    <option key={m} value={m} className="bg-slate-900 text-white">
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-bold text-white uppercase">{activeMember}</span>
              )}
            </div>

            {/* Acesso rápido à Lousa Administrativa TV */}
            <Link
              href="/lousa-operacional"
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-cyan-300 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 transition-colors"
              title="Acessar Lousa Operacional Administrativa (Modo TV)"
            >
              <span>Lousa TV</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>

        </div>
      </header>

      {/* ── BARRA DE NAVEGAÇÃO INFERIOR STICKY (MOBILE ≤ 768px) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#060a13]/95 backdrop-blur-lg border-t border-slate-800/90 px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {navItems.map(item => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all min-h-[48px] min-w-[72px] relative ${
                isActive
                  ? 'text-cyan-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon size={20} className={isActive ? 'text-cyan-400' : 'text-slate-400'} />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 px-1 py-0.2 text-[9px] font-black rounded-full bg-rose-500 text-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">
                {item.shortLabel}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-0.5" />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
