"use client";

import React from 'react';
import { Building2, Server, Landmark, Users, Calculator, Briefcase, Globe, Cpu, KeyRound } from 'lucide-react';

interface SystemAppIconProps {
  systemName: string;
  category?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function SystemAppIcon({
  systemName,
  category = '',
  size = 'md',
  className = ''
}: SystemAppIconProps) {
  const name = (systemName || '').toLowerCase();

  const sizeClasses = {
    sm: 'w-7 h-7 rounded-lg text-xs',
    md: 'w-9 h-9 rounded-xl text-sm',
    lg: 'w-11 h-11 rounded-2xl text-base',
    xl: 'w-14 h-14 rounded-2xl text-xl'
  }[size];

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
    xl: 28
  }[size];

  // 1. BRADESCO
  if (name.includes('bradesco')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center font-black shadow-sm border border-red-500/30 shrink-0 ${className}`}>
        <svg viewBox="0 0 24 24" width={iconSizes} height={iconSizes} fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H8v-2h3v2zm0-4H8v-2h3v2zm0-4H8V6h3v2zm5 8h-3v-2h3v2zm0-4h-3v-2h3v2zm0-4h-3V6h3v2z" opacity="0.9" />
        </svg>
      </div>
    );
  }

  // 2. ITAÚ
  if (name.includes('itau') || name.includes('itaú')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-[#003399] to-[#001f66] text-[#ff7900] flex items-center justify-center font-black shadow-sm border border-blue-800 shrink-0 ${className}`}>
        <span className="font-black tracking-tighter" style={{ fontSize: size === 'sm' ? '10px' : size === 'md' ? '12px' : '15px' }}>
          itaú
        </span>
      </div>
    );
  }

  // 3. SANTANDER
  if (name.includes('santander')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-[#ec0000] to-[#b30000] text-white flex items-center justify-center font-black shadow-sm border border-red-500/40 shrink-0 ${className}`}>
        <span className="font-black text-white" style={{ fontSize: size === 'sm' ? '11px' : size === 'md' ? '14px' : '17px' }}>
          S
        </span>
      </div>
    );
  }

  // 4. BANCO DO BRASIL
  if (name.includes('banco do brasil') || name.includes('bb ')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-[#fff000] to-[#f5e000] text-[#003882] flex items-center justify-center font-black shadow-sm border border-yellow-400 shrink-0 ${className}`}>
        <span className="font-black tracking-tighter" style={{ fontSize: size === 'sm' ? '10px' : size === 'md' ? '13px' : '16px' }}>
          BB
        </span>
      </div>
    );
  }

  // 5. OMIE ERP
  if (name.includes('omie')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-[#00d2ff] to-[#0072ff] text-white flex items-center justify-center font-black shadow-sm border border-cyan-400/30 shrink-0 ${className}`}>
        <span className="font-black tracking-tight" style={{ fontSize: size === 'sm' ? '9px' : size === 'md' ? '11px' : '14px' }}>
          omie
        </span>
      </div>
    );
  }

  // 6. SIENGE
  if (name.includes('sienge')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-[#0f2b48] to-[#00172e] text-[#00c9a7] flex items-center justify-center font-black shadow-sm border border-slate-700 shrink-0 ${className}`}>
        <span className="font-black" style={{ fontSize: size === 'sm' ? '10px' : size === 'md' ? '12px' : '15px' }}>
          Sg
        </span>
      </div>
    );
  }

  // 7. SENIOR RH
  if (name.includes('senior') || name.includes('ronda')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-[#002f6c] to-[#011638] text-[#00a8ff] flex items-center justify-center font-black shadow-sm border border-blue-900 shrink-0 ${className}`}>
        <span className="font-black uppercase" style={{ fontSize: size === 'sm' ? '9px' : size === 'md' ? '11px' : '14px' }}>
          SR
        </span>
      </div>
    );
  }

  // 8. CONECTIUS
  if (name.includes('conectius')) {
    return (
      <div className={`${sizeClasses} bg-white p-1 flex items-center justify-center shadow-sm border border-slate-200 shrink-0 ${className}`}>
        <img src="/Logos/Conectius.png" alt="Conectius" className="max-h-full max-w-full object-contain" />
      </div>
    );
  }

  // 9. DIANNA DRE
  if (name.includes('dianna')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center font-black shadow-sm border border-emerald-500/30 shrink-0 ${className}`}>
        <span className="font-black tracking-tighter text-amber-300" style={{ fontSize: size === 'sm' ? '11px' : size === 'md' ? '13px' : '16px' }}>
          D♦
        </span>
      </div>
    );
  }

  // 10. RECEITA / E-CAC
  if (name.includes('receita') || name.includes('ecac') || name.includes('e-cac')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-emerald-800 to-green-950 text-amber-300 flex items-center justify-center font-black shadow-sm border border-emerald-700 shrink-0 ${className}`}>
        <Landmark size={iconSizes} />
      </div>
    );
  }

  // 11. BITRIX24
  if (name.includes('bitrix')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-[#2fc6f6] to-[#008fe3] text-white flex items-center justify-center font-black shadow-sm border border-sky-400/30 shrink-0 ${className}`}>
        <span className="font-black" style={{ fontSize: size === 'sm' ? '10px' : size === 'md' ? '12px' : '15px' }}>
          B24
        </span>
      </div>
    );
  }

  // 12. GOOGLE WORKSPACE
  if (name.includes('google') || name.includes('workspace') || name.includes('gmail')) {
    return (
      <div className={`${sizeClasses} bg-white text-slate-800 flex items-center justify-center font-black shadow-sm border border-slate-200 shrink-0 ${className}`}>
        <svg viewBox="0 0 24 24" width={iconSizes} height={iconSizes}>
          <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
          <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8 0-1.3.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
          <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
        </svg>
      </div>
    );
  }

  // 13. GITHUB
  if (name.includes('github')) {
    return (
      <div className={`${sizeClasses} bg-[#181717] text-white flex items-center justify-center font-black shadow-sm border border-slate-700 shrink-0 ${className}`}>
        <svg viewBox="0 0 24 24" width={iconSizes} height={iconSizes} fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      </div>
    );
  }

  // 14. FALLBACK POR CATEGORIA COM GRADIENTE ESTILIZADO DE APP
  const cat = category.toLowerCase();
  if (cat.includes('banc')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-sm shrink-0 ${className}`}>
        <Landmark size={iconSizes} />
      </div>
    );
  }
  if (cat.includes('erp')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shadow-sm shrink-0 ${className}`}>
        <Building2 size={iconSizes} />
      </div>
    );
  }
  if (cat.includes('rh') || cat.includes('folha')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center shadow-sm shrink-0 ${className}`}>
        <Users size={iconSizes} />
      </div>
    );
  }
  if (cat.includes('fiscal') || cat.includes('cont')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-amber-600 to-orange-700 text-white flex items-center justify-center shadow-sm shrink-0 ${className}`}>
        <Calculator size={iconSizes} />
      </div>
    );
  }
  if (cat.includes('crm') || cat.includes('venda')) {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-sm shrink-0 ${className}`}>
        <Briefcase size={iconSizes} />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses} bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center shadow-sm shrink-0 ${className}`}>
      <Server size={iconSizes} />
    </div>
  );
}
