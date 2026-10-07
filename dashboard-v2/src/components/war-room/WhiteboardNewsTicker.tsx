"use client";

import React from 'react';
import { Radio } from 'lucide-react';

interface WhiteboardNewsTickerProps {
  cotacaoUsdGs: string;
}

export function WhiteboardNewsTicker({ cotacaoUsdGs }: WhiteboardNewsTickerProps) {
  const tickerItems = [
    { text: '🚨 PAGOPAR CONTA G2: * SUSPENSAS NOVAS CONTAS', color: 'text-rose-400 font-bold' },
    { text: `💱 FOLLOW THE MONEY: COTAÇÃO USD = G$ ${cotacaoUsdGs} | LIQUIDAÇÃO MARBR → DLOCAL (TAXA 3,5%)`, color: 'text-emerald-400 font-bold' },
    { text: '🇵🇾 CONTABILIDADE PARAGUAI: FLUXO DLOCAL => UENO: COMO JUSTIFICAR? | DOMÍNIOS NIC.PY ✓ | ERP PY', color: 'text-cyan-300' },
    { text: '📦 REMESSA CONFORME: PAGAR CORREIOS DZM ✓ | ABRIR CONTA CORREIOS G2 ✓ | PROCESSO JUNTO À RFB', color: 'text-amber-300' },
    { text: '📅 CRONOGRAMA DO MÊS: BLOCO 06 A 10 ATIVO (COTAS YBOX • DZM 6827 • 9693 • MBR 8583)', color: 'text-blue-300' },
    { text: '💡 MANUAL DE CULTURA: PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA! • PAGAR CERTO, FATURAR CERTO, FECHAR CERTO!', color: 'text-slate-200' },
  ];

  return (
    <footer className="w-full bg-[#050811] border-t border-slate-800/80 py-2 px-3 flex items-center overflow-hidden z-20">
      {/* BADGE FIXO DO TICKER */}
      <div className="flex items-center gap-1.5 bg-rose-600/20 border border-rose-500/40 text-rose-400 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider flex-shrink-0 mr-3">
        <Radio size={12} className="animate-pulse" />
        <span>RADAR LOUSA</span>
      </div>

      {/* MARQUEE CONTINUO */}
      <div className="flex-1 overflow-hidden relative">
        <div className="flex whitespace-nowrap animate-marquee items-center gap-8 text-xs font-mono">
          {tickerItems.concat(tickerItems).map((item, idx) => (
            <span key={idx} className={`inline-flex items-center gap-2 ${item.color}`}>
              <span>{item.text}</span>
              <span className="text-slate-600 font-black">•</span>
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
