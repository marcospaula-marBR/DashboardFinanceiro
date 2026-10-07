"use client";

import React, { useState } from 'react';
import { Radio, Pause, ShieldAlert } from 'lucide-react';

interface WhiteboardNewsTickerProps {
  cotacaoUsdGs: string;
  insuranceAlerts?: {
    id: string;
    contratante: string;
    tipo: string;
    seguradora?: string;
    diasParaVencer: number;
  }[];
}

export function WhiteboardNewsTicker({ cotacaoUsdGs, insuranceAlerts = [] }: WhiteboardNewsTickerProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Itens padrão da lousa
  const baseItems = [
    { text: '🚨 PAGOPAR CONTA G2: * SUSPENSAS NOVAS CONTAS', color: 'text-rose-400 font-bold' },
    { text: `💱 FOLLOW THE MONEY: COTAÇÃO USD = G$ ${cotacaoUsdGs} | LIQUIDAÇÃO MARBR → DLOCAL (TAXA 3,5%)`, color: 'text-emerald-400 font-bold' },
    { text: '🇵🇾 CONTABILIDADE PARAGUAI: FLUXO DLOCAL => UENO: COMO JUSTIFICAR? | DOMÍNIOS NIC.PY ✓ | ERP PY', color: 'text-cyan-300' },
    { text: '📦 REMESSA CONFORME: PAGAR CORREIOS DZM ✓ | ABRIR CONTA CORREIOS G2 ✓ | PROCESSO JUNTO À RFB', color: 'text-amber-300' },
    { text: '📅 CRONOGRAMA DO MÊS: BLOCO 06 A 10 ATIVO (COTAS YBOX • DZM 6827 • 9693 • MBR 8583)', color: 'text-blue-300' },
    { text: '💡 MANUAL DE CULTURA: PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA! • PAGAR CERTO, FATURAR CERTO, FECHAR CERTO!', color: 'text-slate-200' },
  ];

  // Injetar alertas de seguros a vencer em D < 30 no letreiro ou confirmação de situação regular
  const insuranceItems = insuranceAlerts.length > 0
    ? insuranceAlerts.map(ins => ({
        text: `🛡️ SEGURO A VENCER (D - ${ins.diasParaVencer}d): ${ins.contratante} • ${ins.tipo}${ins.seguradora ? ` (${ins.seguradora})` : ''} - Regularizar Renovação!`,
        color: ins.diasParaVencer <= 7 ? 'text-rose-400 font-black animate-pulse' : 'text-amber-300 font-bold',
      }))
    : [{
        text: '🛡️ RADAR DE SEGUROS: TODAS AS APÓLICES ATIVAS EM DIA (0 A VENCER EM D < 30) • PRÓXIMO: DZM AUTOMÓVEL HDI EM 52d (28/11)',
        color: 'text-emerald-400 font-bold',
      }];

  const allItems = [...insuranceItems, ...baseItems];

  return (
    <footer
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full bg-[#050811] border-t border-slate-800/80 py-2 px-3 flex items-center overflow-hidden z-20 group/ticker ticker-container transition-all"
    >
      {/* BADGE FIXO DO TICKER COM FEEDBACK DE PAUSA */}
      <div className="flex items-center gap-1.5 bg-rose-600/20 border border-rose-500/40 text-rose-400 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider flex-shrink-0 mr-3 shadow-sm">
        {isHovered ? (
          <>
            <Pause size={12} className="text-amber-400" />
            <span className="text-amber-300">RADAR PAUSADO</span>
          </>
        ) : (
          <>
            <Radio size={12} className="animate-pulse" />
            <span>RADAR LOUSA</span>
          </>
        )}
      </div>

      {/* MARQUEE CONTINUO COM PAUSA NO HOVER E VELOCIDADE REDUZIDA */}
      <div className="flex-1 overflow-hidden relative cursor-default" title="Passe o mouse para pausar a leitura">
        <div
          className="flex whitespace-nowrap animate-marquee items-center gap-8 text-xs font-mono"
          style={{ animationPlayState: isHovered ? 'paused' : 'running' }}
        >
          {allItems.concat(allItems).map((item, idx) => (
            <span key={idx} className={`inline-flex items-center gap-2 ${item.color}`}>
              <span>{item.text}</span>
              <span className="text-slate-600 font-black">•</span>
            </span>
          ))}
        </div>
      </div>

      {/* DICA DE PAUSA NO CANTO DIREITO */}
      <div className="hidden xl:flex items-center text-[10px] text-slate-500 font-medium ml-2 flex-shrink-0">
        {isHovered ? 'Leitura pausada' : 'Hover para pausar'}
      </div>
    </footer>
  );
}
