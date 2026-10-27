/**
 * War Room Service — Lousa Digital Operacional (Modo TV)
 * Gerencia os dados da Lousa Digital com persistência e paridade com a lousa física
 * @version v.02.59.23
 */

import {
  WhiteboardDataState,
  WhiteboardColumn,
  WhiteboardItem,
  FollowTheMoneyState,
  FollowTheMoneyRow,
  WhiteboardTimelineBlock,
  WhiteboardTimelineItem,
  PrazoVisualInfo,
  PrazoStatus,
  WhiteboardWeekdayBlock,
  WhiteboardWeekdayItem,
  WeekdayKey,
  WhiteboardCultureMessages,
  WhiteboardCultureSlogan,
} from '@/types/war-room';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'marbrasil_whiteboard_v2';

/**
 * Extrai e normaliza a lista de múltiplos responsáveis atribuídos a uma atividade ou obrigação
 * Suporta array de nomes, string com vírgula, barra ou sinal de mais (ex: "MANUS, CLARA", "MANUS / CLARA", "CONTÁBIL + ALDO")
 */
export function extractResponsaveisList(
  target?: { responsavel?: string; responsaveis?: string[] } | string | string[] | null
): string[] {
  if (!target) return [];
  const cleanItem = (r: string) => r.replace(/^[@#]/, '').replace(/[:;,]$/, '').trim().toUpperCase();

  if (Array.isArray(target)) {
    return Array.from(new Set(target.map(r => (typeof r === 'string' ? cleanItem(r) : '')).filter(Boolean)));
  }
  if (typeof target === 'string') {
    const parts = target
      .split(/[,/+]|\s+e\s+|\s+E\s+|&/)
      .map(p => cleanItem(p))
      .filter(p => p.length > 0);
    return Array.from(new Set(parts));
  }
  if (target.responsaveis && Array.isArray(target.responsaveis) && target.responsaveis.length > 0) {
    return Array.from(new Set(target.responsaveis.map(r => (typeof r === 'string' ? cleanItem(r) : '')).filter(Boolean)));
  }
  if (target.responsavel && typeof target.responsavel === 'string') {
    const parts = target.responsavel
      .split(/[,/+]|\s+e\s+|\s+E\s+|&/)
      .map(p => cleanItem(p))
      .filter(p => p.length > 0);
    return Array.from(new Set(parts));
  }
  return [];
}

export interface ResponsibleColorConfig {
  nome: string;
  badgeClass: string;
  pillActiveClass: string;
  pillInactiveClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
  ringClass: string;
  hex: string;
  label: string;
}

/**
 * Paleta de Cores Estrita e Memorizável por Membro/Responsável (Purple Ban respeitado: sem roxo/violeta)
 */
export const RESPONSIBLE_COLOR_MAP: Record<string, ResponsibleColorConfig> = {
  'MARCOS': {
    nome: 'MARCOS',
    label: 'Azul Royal',
    badgeClass: 'bg-blue-950/90 border-blue-500/70 text-blue-300 shadow-sm shadow-blue-950/50',
    pillActiveClass: 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-md',
    pillInactiveClass: 'bg-slate-950 text-blue-300 border-blue-500/40 hover:border-blue-400',
    borderClass: 'border-blue-500/70',
    bgClass: 'bg-blue-950/40',
    textClass: 'text-blue-400',
    dotClass: 'bg-blue-400 shadow-[0_0_8px_#60a5fa]',
    ringClass: 'ring-blue-400',
    hex: '#2563eb',
  },
  'MELISSA': {
    nome: 'MELISSA',
    label: 'Rosa Coral',
    badgeClass: 'bg-rose-950/90 border-rose-500/70 text-rose-300 shadow-sm shadow-rose-950/50',
    pillActiveClass: 'bg-rose-600 text-white ring-2 ring-rose-400 shadow-md',
    pillInactiveClass: 'bg-slate-950 text-rose-300 border-rose-500/40 hover:border-rose-400',
    borderClass: 'border-rose-500/70',
    bgClass: 'bg-rose-950/40',
    textClass: 'text-rose-400',
    dotClass: 'bg-rose-400 shadow-[0_0_8px_#fb7185]',
    ringClass: 'ring-rose-400',
    hex: '#f43f5e',
  },
  'MATHEUS': {
    nome: 'MATHEUS',
    label: 'Âmbar Ouro',
    badgeClass: 'bg-amber-950/90 border-amber-500/70 text-amber-300 shadow-sm shadow-amber-950/50',
    pillActiveClass: 'bg-amber-600 text-white ring-2 ring-amber-400 shadow-md',
    pillInactiveClass: 'bg-slate-950 text-amber-300 border-amber-500/40 hover:border-amber-400',
    borderClass: 'border-amber-500/70',
    bgClass: 'bg-amber-950/40',
    textClass: 'text-amber-400',
    dotClass: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
    ringClass: 'ring-amber-400',
    hex: '#f59e0b',
  },
  'GUILHERME': {
    nome: 'GUILHERME',
    label: 'Verde Esmeralda',
    badgeClass: 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300 shadow-sm shadow-emerald-950/50',
    pillActiveClass: 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-md',
    pillInactiveClass: 'bg-slate-950 text-emerald-300 border-emerald-500/40 hover:border-emerald-400',
    borderClass: 'border-emerald-500/70',
    bgClass: 'bg-emerald-950/40',
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
    ringClass: 'ring-emerald-400',
    hex: '#10b981',
  },
  'FINANCEIRO': {
    nome: 'FINANCEIRO',
    label: 'Verde Menta / Teal',
    badgeClass: 'bg-teal-950/90 border-teal-500/70 text-teal-300 shadow-sm shadow-teal-950/50',
    pillActiveClass: 'bg-teal-600 text-white ring-2 ring-teal-400 shadow-md',
    pillInactiveClass: 'bg-slate-950 text-teal-300 border-teal-500/40 hover:border-teal-400',
    borderClass: 'border-teal-500/70',
    bgClass: 'bg-teal-950/40',
    textClass: 'text-teal-400',
    dotClass: 'bg-teal-400 shadow-[0_0_8px_#2dd4bf]',
    ringClass: 'ring-teal-400',
    hex: '#14b8a6',
  },
  'CONTABTI': {
    nome: 'CONTABTI',
    label: 'Azul Céu',
    badgeClass: 'bg-sky-950/90 border-sky-500/70 text-sky-300 shadow-sm shadow-sky-950/50',
    pillActiveClass: 'bg-sky-600 text-white ring-2 ring-sky-400 shadow-md',
    pillInactiveClass: 'bg-slate-950 text-sky-300 border-sky-500/40 hover:border-sky-400',
    borderClass: 'border-sky-500/70',
    bgClass: 'bg-sky-950/40',
    textClass: 'text-sky-400',
    dotClass: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
    ringClass: 'ring-sky-400',
    hex: '#0ea5e9',
  },
  'CONTÁBIL': {
    nome: 'CONTÁBIL',
    label: 'Azul Céu',
    badgeClass: 'bg-sky-950/90 border-sky-500/70 text-sky-300 shadow-sm shadow-sky-950/50',
    pillActiveClass: 'bg-sky-600 text-white ring-2 ring-sky-400 shadow-md',
    pillInactiveClass: 'bg-slate-950 text-sky-300 border-sky-500/40 hover:border-sky-400',
    borderClass: 'border-sky-500/70',
    bgClass: 'bg-sky-950/40',
    textClass: 'text-sky-400',
    dotClass: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
    ringClass: 'ring-sky-400',
    hex: '#0ea5e9',
  },
  'CONTABIL': {
    nome: 'CONTABIL',
    label: 'Azul Céu',
    badgeClass: 'bg-sky-950/90 border-sky-500/70 text-sky-300 shadow-sm shadow-sky-950/50',
    pillActiveClass: 'bg-sky-600 text-white ring-2 ring-sky-400 shadow-md',
    pillInactiveClass: 'bg-slate-950 text-sky-300 border-sky-500/40 hover:border-sky-400',
    borderClass: 'border-sky-500/70',
    bgClass: 'bg-sky-950/40',
    textClass: 'text-sky-400',
    dotClass: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
    ringClass: 'ring-sky-400',
    hex: '#0ea5e9',
  },
  'JURIDICO': {
    nome: 'JURIDICO',
    label: 'Vermelho Carmim',
    badgeClass: 'bg-red-950/90 border-red-500/70 text-red-300 shadow-sm shadow-red-950/50',
    pillActiveClass: 'bg-red-600 text-white ring-2 ring-red-400 shadow-md',
    pillInactiveClass: 'bg-slate-950 text-red-300 border-red-500/40 hover:border-red-400',
    borderClass: 'border-red-500/70',
    bgClass: 'bg-red-950/40',
    textClass: 'text-red-400',
    dotClass: 'bg-red-400 shadow-[0_0_8px_#f87171]',
    ringClass: 'ring-red-400',
    hex: '#ef4444',
  },
  'JURÍDICO': {
    nome: 'JURÍDICO',
    label: 'Vermelho Carmim',
    badgeClass: 'bg-red-950/90 border-red-500/70 text-red-300 shadow-sm shadow-red-950/50',
    pillActiveClass: 'bg-red-600 text-white ring-2 ring-red-400 shadow-md',
    pillInactiveClass: 'bg-slate-950 text-red-300 border-red-500/40 hover:border-red-400',
    borderClass: 'border-red-500/70',
    bgClass: 'bg-red-950/40',
    textClass: 'text-red-400',
    dotClass: 'bg-red-400 shadow-[0_0_8px_#f87171]',
    ringClass: 'ring-red-400',
    hex: '#ef4444',
  },
  'TI': {
    nome: 'TI',
    label: 'Verde Lima',
    badgeClass: 'bg-lime-950/90 border-lime-500/70 text-lime-300 shadow-sm shadow-lime-950/50',
    pillActiveClass: 'bg-lime-500 text-slate-950 ring-2 ring-lime-400 font-black shadow-md',
    pillInactiveClass: 'bg-slate-950 text-lime-300 border-lime-500/40 hover:border-lime-400',
    borderClass: 'border-lime-500/70',
    bgClass: 'bg-lime-950/40',
    textClass: 'text-lime-400',
    dotClass: 'bg-lime-400 shadow-[0_0_8px_#a3e635]',
    ringClass: 'ring-lime-400',
    hex: '#84cc16',
  },
};

/**
 * Paleta circular de fallback para novos nomes cadastrados pela equipe (garante que não haja roxo/violeta)
 */
const FALLBACK_PALETTE: Omit<ResponsibleColorConfig, 'nome' | 'label'>[] = [
  {
    badgeClass: 'bg-cyan-950/90 border-cyan-500/70 text-cyan-300',
    pillActiveClass: 'bg-cyan-600 text-white ring-2 ring-cyan-400',
    pillInactiveClass: 'bg-slate-950 text-cyan-300 border-cyan-500/40',
    borderClass: 'border-cyan-500/70',
    bgClass: 'bg-cyan-950/40',
    textClass: 'text-cyan-400',
    dotClass: 'bg-cyan-400',
    ringClass: 'ring-cyan-400',
    hex: '#06b6d4',
  },
  {
    badgeClass: 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300',
    pillActiveClass: 'bg-emerald-600 text-white ring-2 ring-emerald-400',
    pillInactiveClass: 'bg-slate-950 text-emerald-300 border-emerald-500/40',
    borderClass: 'border-emerald-500/70',
    bgClass: 'bg-emerald-950/40',
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400',
    ringClass: 'ring-emerald-400',
    hex: '#10b981',
  },
  {
    badgeClass: 'bg-amber-950/90 border-amber-500/70 text-amber-300',
    pillActiveClass: 'bg-amber-600 text-white ring-2 ring-amber-400',
    pillInactiveClass: 'bg-slate-950 text-amber-300 border-amber-500/40',
    borderClass: 'border-amber-500/70',
    bgClass: 'bg-amber-950/40',
    textClass: 'text-amber-400',
    dotClass: 'bg-amber-400',
    ringClass: 'ring-amber-400',
    hex: '#f59e0b',
  },
  {
    badgeClass: 'bg-blue-950/90 border-blue-500/70 text-blue-300',
    pillActiveClass: 'bg-blue-600 text-white ring-2 ring-blue-400',
    pillInactiveClass: 'bg-slate-950 text-blue-300 border-blue-500/40',
    borderClass: 'border-blue-500/70',
    bgClass: 'bg-blue-950/40',
    textClass: 'text-blue-400',
    dotClass: 'bg-blue-400',
    ringClass: 'ring-blue-400',
    hex: '#3b82f6',
  },
  {
    badgeClass: 'bg-orange-950/90 border-orange-500/70 text-orange-300',
    pillActiveClass: 'bg-orange-600 text-white ring-2 ring-orange-400',
    pillInactiveClass: 'bg-slate-950 text-orange-300 border-orange-500/40',
    borderClass: 'border-orange-500/70',
    bgClass: 'bg-orange-950/40',
    textClass: 'text-orange-400',
    dotClass: 'bg-orange-400',
    ringClass: 'ring-orange-400',
    hex: '#f97316',
  },
  {
    badgeClass: 'bg-rose-950/90 border-rose-500/70 text-rose-300',
    pillActiveClass: 'bg-rose-600 text-white ring-2 ring-rose-400',
    pillInactiveClass: 'bg-slate-950 text-rose-300 border-rose-500/40',
    borderClass: 'border-rose-500/70',
    bgClass: 'bg-rose-950/40',
    textClass: 'text-rose-400',
    dotClass: 'bg-rose-400',
    ringClass: 'ring-rose-400',
    hex: '#f43f5e',
  },
  {
    badgeClass: 'bg-teal-950/90 border-teal-500/70 text-teal-300',
    pillActiveClass: 'bg-teal-600 text-white ring-2 ring-teal-400',
    pillInactiveClass: 'bg-slate-950 text-teal-300 border-teal-500/40',
    borderClass: 'border-teal-500/70',
    bgClass: 'bg-teal-950/40',
    textClass: 'text-teal-400',
    dotClass: 'bg-teal-400',
    ringClass: 'ring-teal-400',
    hex: '#14b8a6',
  },
  {
    badgeClass: 'bg-sky-950/90 border-sky-500/70 text-sky-300',
    pillActiveClass: 'bg-sky-600 text-white ring-2 ring-sky-400',
    pillInactiveClass: 'bg-slate-950 text-sky-300 border-sky-500/40',
    borderClass: 'border-sky-500/70',
    bgClass: 'bg-sky-950/40',
    textClass: 'text-sky-400',
    dotClass: 'bg-sky-400',
    ringClass: 'ring-sky-400',
    hex: '#0ea5e9',
  },
];

/**
 * Retorna a configuração de cor visual exclusiva e determinística de um responsável
 */
export function getResponsibleColor(name?: string | null): ResponsibleColorConfig {
  if (!name || !name.trim()) {
    return {
      nome: 'SEM RESPONSÁVEL',
      label: 'Cinza Neutro',
      badgeClass: 'bg-slate-900 border-slate-700 text-slate-400',
      pillActiveClass: 'bg-slate-700 text-white',
      pillInactiveClass: 'bg-slate-950 text-slate-400 border-slate-800',
      borderClass: 'border-slate-700',
      bgClass: 'bg-slate-900/40',
      textClass: 'text-slate-400',
      dotClass: 'bg-slate-500',
      ringClass: 'ring-slate-500',
      hex: '#64748b',
    };
  }

  const upper = name.trim().toUpperCase();
  if (RESPONSIBLE_COLOR_MAP[upper]) {
    return RESPONSIBLE_COLOR_MAP[upper];
  }

  // Se for nome desconhecido, calcular hash determinístico
  let hash = 0;
  for (let i = 0; i < upper.length; i++) {
    hash = upper.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % FALLBACK_PALETTE.length;
  const fallback = FALLBACK_PALETTE[index];

  return {
    nome: upper,
    label: upper,
    ...fallback,
  };
}

/**
 * Calcula o status visual do prazo para demandas e tarefas
 * @returns 'atrasado' (vermelho) | 'hoje' (âmbar vivo) | 'em_dia' (âmbar/próximo) | 'distante' (verde) | 'sem_prazo' | 'concluido'
 */
export function calculatePrazoInfo(dataLimite?: string, concluido?: boolean): PrazoVisualInfo {
  if (concluido) {
    return {
      status: 'concluido',
      rotulo: 'Concluído',
      rotuloCurto: '✓ OK',
      badgeClass: 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 font-medium',
    };
  }

  if (!dataLimite || !dataLimite.trim()) {
    return {
      status: 'sem_prazo',
      rotulo: '',
      rotuloCurto: '',
      badgeClass: '',
    };
  }

  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let ano = hoje.getFullYear();
    let mes = hoje.getMonth();
    let dia = hoje.getDate();

    const parts = dataLimite.trim().split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        ano = parseInt(parts[0], 10);
        mes = parseInt(parts[1], 10) - 1;
        dia = parseInt(parts[2], 10);
      } else {
        // DD/MM/YYYY
        dia = parseInt(parts[0], 10);
        mes = parseInt(parts[1], 10) - 1;
        ano = parseInt(parts[2], 10);
      }
    } else if (parts.length === 2) {
      // DD/MM
      dia = parseInt(parts[0], 10);
      mes = parseInt(parts[1], 10) - 1;
    }

    const prazo = new Date(ano, mes, dia, 0, 0, 0, 0);
    const diffMs = prazo.getTime() - hoje.getTime();
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const dataFormatada = `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}`;

    if (diffDias < 0) {
      const diasAtraso = Math.abs(diffDias);
      return {
        status: 'atrasado',
        rotulo: `🚨 Atrasado (${diasAtraso}d)`,
        rotuloCurto: `🚨 ${diasAtraso}d`,
        badgeClass: 'bg-rose-950/90 border border-rose-500 text-rose-300 animate-pulse font-black shadow-sm',
        diasRestantes: diffDias,
      };
    } else if (diffDias === 0) {
      return {
        status: 'hoje',
        rotulo: '⚠️ Vence Hoje',
        rotuloCurto: '⚠️ Hoje',
        badgeClass: 'bg-amber-950/90 border border-amber-500 text-amber-300 animate-pulse font-black shadow-sm',
        diasRestantes: 0,
      };
    } else if (diffDias <= 3) {
      return {
        status: 'em_dia',
        rotulo: `⏳ Vence em ${diffDias}d (${dataFormatada})`,
        rotuloCurto: `⏳ ${diffDias}d`,
        badgeClass: 'bg-amber-950/50 border border-amber-500/50 text-amber-300 font-bold',
        diasRestantes: diffDias,
      };
    } else {
      return {
        status: 'distante',
        rotulo: `🗓️ ${dataFormatada} (${diffDias}d)`,
        rotuloCurto: `🗓️ ${dataFormatada}`,
        badgeClass: 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-medium',
        diasRestantes: diffDias,
      };
    }
  } catch {
    return {
      status: 'sem_prazo',
      rotulo: dataLimite,
      rotuloCurto: dataLimite,
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    };
  }
}

/**
 * Infere a lista de responsáveis padrão a partir do texto ou descrição
 */
export function inferDefaultResponsaveis(text: string): string[] {
  if (!text) return [];
  const upper = text.toUpperCase();
  const resps: string[] = [];

  // 1. Extração direta de menções com @ ou # (ex: @MARCOS, @melissa, @matheus, @guilherme)
  const mentions = text.match(/[@#]([a-zA-ZÀ-ÿ0-9_-]+)/g);
  if (mentions) {
    mentions.forEach(m => {
      const clean = m.replace(/^[@#]/, '').trim().toUpperCase();
      if (clean) resps.push(clean);
    });
  }

  // 2. Extração de padrões de prefixo [NOME] ou NOME: no início da tarefa
  const prefixMatch = text.match(/^\[?([a-zA-ZÀ-ÿ]+)\]?[:\s-]/);
  if (prefixMatch) {
    const candidate = prefixMatch[1].toUpperCase();
    if (['MARCOS', 'MATHEUS', 'MELISSA', 'GUILHERME', 'FINANCEIRO', 'JURÍDICO', 'CONTÁBIL', 'TI'].includes(candidate)) {
      resps.push(candidate);
    }
  }

  // 3. Menções nominais no corpo do texto
  if (upper.includes('MARCOS')) resps.push('MARCOS');
  if (upper.includes('MATHEUS')) resps.push('MATHEUS');
  if (upper.includes('MELISSA')) resps.push('MELISSA');
  if (upper.includes('GUILHERME')) resps.push('GUILHERME');

  if (
    upper.includes('CORREIOS DZM') ||
    upper.includes('INSS') ||
    upper.includes('DAS') ||
    upper.includes('PIS') ||
    upper.includes('COFINS') ||
    upper.includes('SICREDI') ||
    upper.includes('NUBANK') ||
    upper.includes('BANCO') ||
    upper.includes('COTAS YBOX') ||
    upper.includes('LIBERAÇÃO VALORES') ||
    upper.includes('RECORRENTES')
  ) {
    if (!resps.includes('FINANCEIRO')) resps.push('FINANCEIRO');
  }

  if (upper.includes('JURÍDICO') || upper.includes('RFB')) {
    if (!resps.includes('JURÍDICO')) resps.push('JURÍDICO');
  }

  if (upper.includes('CONTÁBIL') || upper.includes('CONTABILIDADE')) {
    if (!resps.includes('CONTÁBIL')) resps.push('CONTÁBIL');
  }

  if (upper.includes('ERP') || upper.includes('TI') || upper.includes('NIC.PY')) {
    if (!resps.includes('TI')) resps.push('TI');
  }

  return Array.from(new Set(resps));
}

/**
 * Infere o responsável padrão (texto formatado) para itens que ainda não tenham um definido
 */
export function inferDefaultResponsible(text: string): string | undefined {
  const list = inferDefaultResponsaveis(text);
  return list.length > 0 ? list.join(', ') : undefined;
}

/**
 * Retorna as mensagens de cultura padrão para o departamento indicado
 */
export function getDefaultCultureMessages(departmentSlug: string = 'financeiro', departmentName?: string): WhiteboardCultureMessages {
  const slug = (departmentSlug || 'financeiro').toLowerCase();
  switch (slug) {
    case 'financeiro':
      return {
        sloganEsquerdo: {
          frase: 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
          tag: 'MANUAL CULTURA MAR BRASIL',
        },
        sloganDireito: {
          frase: 'PAGAR CERTO, FATURAR CERTO, FECHAR CERTO!',
          tag: 'MANUAL DE CULTURA FINANCEIRA',
        },
      };
    case 'operacional':
      return {
        sloganEsquerdo: {
          frase: 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
          tag: 'MANUAL CULTURA MAR BRASIL',
        },
        sloganDireito: {
          frase: 'AGILIDADE, SEGURANÇA E PONTUALIDADE EM CADA OPERAÇÃO!',
          tag: 'MANUAL DE CULTURA OPERACIONAL',
        },
      };
    case 'comercial':
      return {
        sloganEsquerdo: {
          frase: 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
          tag: 'MANUAL CULTURA MAR BRASIL',
        },
        sloganDireito: {
          frase: 'RELACIONAMENTO, FOCO NO CLIENTE E RESULTADO COM EXCELÊNCIA!',
          tag: 'MANUAL DE CULTURA COMERCIAL',
        },
      };
    case 'recursos_humanos':
      return {
        sloganEsquerdo: {
          frase: 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
          tag: 'MANUAL CULTURA MAR BRASIL',
        },
        sloganDireito: {
          frase: 'DESENVOLVIMENTO, CUIDADO E ENGAJAMENTO DE PESSOAS!',
          tag: 'MANUAL DE CULTURA GENTE & GESTÃO',
        },
      };
    case 'ti':
      return {
        sloganEsquerdo: {
          frase: 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
          tag: 'MANUAL CULTURA MAR BRASIL',
        },
        sloganDireito: {
          frase: 'ESTABILIDADE, INOVAÇÃO E SEGURANÇA TECNOLÓGICA!',
          tag: 'MANUAL DE CULTURA TI',
        },
      };
    case 'juridico':
      return {
        sloganEsquerdo: {
          frase: 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
          tag: 'MANUAL CULTURA MAR BRASIL',
        },
        sloganDireito: {
          frase: 'CONFORMIDADE, SEGURANÇA JURÍDICA E INTEGRIDADE!',
          tag: 'MANUAL DE CULTURA JURÍDICA',
        },
      };
    default:
      const label = (departmentName || slug).toUpperCase();
      return {
        sloganEsquerdo: {
          frase: 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
          tag: 'MANUAL CULTURA MAR BRASIL',
        },
        sloganDireito: {
          frase: 'FOCO, COMPROMISSO E EXCELÊNCIA EM CADA ENTREGA!',
          tag: `MANUAL DE CULTURA ${label}`,
        },
      };
  }
}

/**
 * Dados autênticos da Lousa Operacional da Equipe Mar Brasil
 */
export const DEFAULT_WHITEBOARD_DATA: WhiteboardDataState = {
  mensagensCultura: getDefaultCultureMessages('financeiro'),
  colunas: [
    {
      id: 'col-1',
      titulo: 'CONTABILIDADE PY:',
      subtitulo: 'Operações e regularização no Paraguai',
      corMarcador: 'vermelho',
      dataLimite: '2026-10-15',
      itens: [
        { id: 'it-1-1', texto: 'JUSTIFICAR DEPÓSITOS CONTA PESSOAL;', concluido: false, responsavel: 'MARCOS', responsaveis: ['MARCOS'], dataLimite: '2026-10-05' },
        { id: 'it-1-2', texto: 'ANALISAR MELHOR OPÇÃO P/ EMPRÉSTIMOS FEITOS PY (CONTABILIDADE + GUILHERME)', concluido: false, responsavel: 'CONTÁBIL, GUILHERME', responsaveis: ['CONTÁBIL', 'GUILHERME'], dataLimite: '2026-10-15' },
        { id: 'it-1-3', texto: 'FLUXO DLOCAL => UENO: COMO JUSTIFICAR?*', concluido: false, destaque: true, responsavel: 'MARCOS', responsaveis: ['MARCOS'] },
        { id: 'it-1-4', texto: 'DOMÍNIOS NIC.PY', concluido: true, responsavel: 'TI, CONTÁBIL', responsaveis: ['TI', 'CONTÁBIL'] },
        { id: 'it-1-5', texto: 'ERP PY', concluido: false, responsavel: 'TI, CONTÁBIL', responsaveis: ['TI', 'CONTÁBIL'] },
      ],
    },
    {
      id: 'col-2',
      titulo: 'PAGOPAR CONTA G2:',
      subtitulo: 'Gateway e integração Paraguai',
      alertaDestaque: '* SUSPENSAS NOVAS CONTAS',
      corMarcador: 'vermelho',
      dataLimite: '2026-10-07',
      itens: [
        { id: 'it-2-1', texto: 'MSG ENVIADA', concluido: false, responsavel: 'MATHEUS', responsaveis: ['MATHEUS'], dataLimite: '2026-10-07' },
        { id: 'it-2-2', texto: 'RECEBIDO E-MAIL', concluido: false, responsavel: 'MATHEUS', responsaveis: ['MATHEUS'] },
        { id: 'it-2-3', texto: "RESPONDI PEDINDO CAMINHO + JOC'S", concluido: false, responsavel: 'MARCOS', responsaveis: ['MARCOS'] },
      ],
    },
    {
      id: 'col-3',
      titulo: 'DLOCAL G2:',
      subtitulo: 'Validação e fluxo cambial',
      corMarcador: 'vermelho',
      dataLimite: '2026-10-12',
      itens: [
        { id: 'it-3-1', texto: 'TABELA C/ FLUXO COMPLETO ATÉ VR EM USD NO UENO (PGTO DE U$ 9.99 DA MARBR)', concluido: false, responsavel: 'GUILHERME', responsaveis: ['GUILHERME'] },
        { id: 'it-3-2', texto: 'TESTAR SPLIT', concluido: false, responsavel: 'GUILHERME', responsaveis: ['GUILHERME'], dataLimite: '2026-10-09' },
        { id: 'it-3-3', texto: 'VALIDAÇÃO DA CONTA BANCÁRIA', concluido: false, responsavel: 'MARCOS', responsaveis: ['MARCOS'] },
        { id: 'it-3-4', texto: 'LIBERAÇÃO VALORES', concluido: true, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
      ],
    },
    {
      id: 'col-4',
      titulo: 'REMESSA CONFORME:',
      subtitulo: 'Correios, Jurídico e Receita Federal',
      corMarcador: 'vermelho',
      dataLimite: '2026-10-20',
      itens: [
        { id: 'it-4-1', texto: 'CRIAR GRUPO C/ JURÍDICO', concluido: false, responsavel: 'JURÍDICO', responsaveis: ['JURÍDICO'] },
        { id: 'it-4-2', texto: 'PAGAR CORREIOS DZM', concluido: true, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'it-4-3', texto: 'ABRIR CONTA CORREIOS G2', concluido: true, responsavel: 'MELISSA', responsaveis: ['MELISSA'] },
        { id: 'it-4-4', texto: 'PROCESSO JUNTO À RFB', concluido: false, responsavel: 'JURÍDICO', responsaveis: ['JURÍDICO'], dataLimite: '2026-10-25' },
      ],
    },
    {
      id: 'col-5',
      titulo: 'OUTUBRO / NOVEMBRO',
      subtitulo: 'Horizonte de Planejamento 2027',
      corMarcador: 'azul',
      dataLimite: '2026-11-30',
      itens: [
        { id: 'it-5-1', texto: 'INSERIR LANÇAMENTOS RECORRENTES NO OMIE P/ 2027', concluido: false, destaque: true, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'], dataLimite: '2026-11-30' },
      ],
    },
  ],

  followTheMoney: {
    cotacaoUsdGs: '5930',
    linhas: [
      {
        id: 'ftm-1',
        data: '23/09',
        de: 'MARBR',
        para: 'SAASTKT-DLOCAL',
        formato: 'CC',
        moeda: 'USD',
        valor: '9,99',
        diferenca: '—',
        percentual: '—',
        observacao: 'Pagamento inicial via Cartão Corporativo',
      },
      {
        id: 'ftm-2',
        data: '23/09',
        de: 'SAASTKT-DL',
        para: 'DLOCAL-G2',
        formato: 'MOEDA',
        moeda: 'USD',
        valor: '9,64',
        diferenca: '0,35',
        percentual: '3,5%',
        observacao: 'Taxa da processadora DLocal',
      },
      {
        id: 'ftm-3',
        data: '—',
        de: 'DLOCAL-G2',
        para: 'UENO-G2-GS',
        formato: 'MOEDA',
        moeda: 'G$',
        valor: '—',
        diferenca: '—',
        percentual: '—',
        observacao: 'Conversão para Guaranis no Banco Ueno',
      },
      {
        id: 'ftm-4',
        data: '—',
        de: 'UENO-G2-GS',
        para: 'UENO-G2-USD',
        formato: 'MOEDA',
        moeda: 'USD',
        valor: '—',
        diferenca: '—',
        percentual: '—',
        observacao: 'Conta final Dólar no Banco Ueno',
      },
    ],
  },

  cronograma: [
    {
      id: 'blk-1',
      intervalo: '01 a 05',
      diaInicio: 1,
      diaFim: 5,
      itens: [
        { id: 'tl-1', dia: 5, descricao: '05 - PLANNIGI', concluido: false, responsavel: 'MARCOS', responsaveis: ['MARCOS'] },
        { id: 'tl-2', dia: 5, descricao: '05 - CONTÁBIL PY', concluido: false, responsavel: 'CONTÁBIL', responsaveis: ['CONTÁBIL'] },
        { id: 'tl-3', dia: 5, descricao: '05 - ROTINAS OPERACIONAIS', concluido: false, responsavel: 'GUILHERME', responsaveis: ['GUILHERME'] },
        { id: 'tl-4', dia: 5, descricao: '05 - G2 8112', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
      ],
    },
    {
      id: 'blk-2',
      intervalo: '06 a 10',
      diaInicio: 6,
      diaFim: 10,
      itens: [
        { id: 'tl-5', dia: 10, descricao: '10 - COTAS YBOX', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'tl-6', dia: 10, descricao: '10 - DZM 6827', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'tl-7', dia: 10, descricao: '10 - 9693', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'tl-8', dia: 10, descricao: '10 - MBR 8583', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
      ],
    },
    {
      id: 'blk-3',
      intervalo: '11 a 15',
      diaInicio: 11,
      diaFim: 15,
      itens: [
        { id: 'tl-9', dia: 15, descricao: '15 - TERCEIRIZAÇÃO', concluido: false, responsavel: 'MELISSA', responsaveis: ['MELISSA'] },
      ],
    },
    {
      id: 'blk-4',
      intervalo: '16 a 20',
      diaInicio: 16,
      diaFim: 20,
      itens: [
        { id: 'tl-10', dia: 18, descricao: '18 - YBOX - SICREDI', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'tl-11', dia: 20, descricao: '20 - I.N.S.S', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'tl-12', dia: 20, descricao: '20 - PGTO / DAS', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
      ],
    },
    {
      id: 'blk-5',
      intervalo: '21 a 25',
      diaInicio: 21,
      diaFim: 25,
      itens: [
        { id: 'tl-13', dia: 23, descricao: '23 - MBR 0137', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'tl-14', dia: 25, descricao: '25 - NUBANK DZM', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'tl-15', dia: 25, descricao: '25 - PIS / COFINS', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'tl-16', dia: 25, descricao: '25 - RECORRENTES DZM', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'tl-17', dia: 27, descricao: '27 - BANCO DO BRASIL', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
      ],
    },
    {
      id: 'blk-6',
      intervalo: '26 a 30/31',
      diaInicio: 26,
      diaFim: 31,
      itens: [
        { id: 'tl-18', dia: 30, descricao: '30 - TRI JAN/ABR/JUL/OUT', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'tl-19', dia: 30, descricao: '30 - DAS PARCELADA MBR', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'tl-20', dia: 30, descricao: '30 - RECORRENTES MBR', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
      ],
    },
  ],
  gradeSemanal: [
    {
      diaSemana: 'seg',
      nome: 'Segunda-feira',
      sigla: 'SEG',
      itens: [
        { id: 'wd-seg-1', diaSemana: 'seg', descricao: 'ALINHAMENTO SEMANAL DE PRIORIDADES', concluido: false, responsavel: 'MARCOS', responsaveis: ['MARCOS'] },
        { id: 'wd-seg-2', diaSemana: 'seg', descricao: 'CONTAS A PAGAR & CONCILIAÇÃO DA SEMANA', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
      ],
    },
    {
      diaSemana: 'ter',
      nome: 'Terça-feira',
      sigla: 'TER',
      itens: [
        { id: 'wd-ter-1', diaSemana: 'ter', descricao: 'EMISSÃO E VALIDAÇÃO DE NOTAS FISCAIS', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'wd-ter-2', diaSemana: 'ter', descricao: 'ACOMPANHAMENTO DE ATENDIMENTOS E JURÍDICO', concluido: false, responsavel: 'JURÍDICO', responsaveis: ['JURÍDICO'] },
      ],
    },
    {
      diaSemana: 'qua',
      nome: 'Quarta-feira',
      sigla: 'QUA',
      itens: [
        { id: 'wd-qua-1', diaSemana: 'qua', descricao: 'CONCILIAÇÃO CAMBIAL & REVISÃO DLOCAL', concluido: false, responsavel: 'GUILHERME', responsaveis: ['GUILHERME'] },
        { id: 'wd-qua-2', diaSemana: 'qua', descricao: 'ROTINAS OPERACIONAIS G2 & TI', concluido: false, responsavel: 'TI', responsaveis: ['TI'] },
      ],
    },
    {
      diaSemana: 'qui',
      nome: 'Quinta-feira',
      sigla: 'QUI',
      itens: [
        { id: 'wd-qui-1', diaSemana: 'qui', descricao: 'REVISÃO DE CONTRATOS & PEOPLEBOARD', concluido: false, responsavel: 'MELISSA', responsaveis: ['MELISSA'] },
        { id: 'wd-qui-2', diaSemana: 'qui', descricao: 'AUDITORIA CONTÁBIL & FECHAMENTO PARCIAL', concluido: false, responsavel: 'CONTÁBIL', responsaveis: ['CONTÁBIL'] },
      ],
    },
    {
      diaSemana: 'sex',
      nome: 'Sexta-feira',
      sigla: 'SEX',
      itens: [
        { id: 'wd-sex-1', diaSemana: 'sex', descricao: 'FECHAMENTO OPERACIONAL & PREVISÃO DE CAIXA', concluido: false, responsavel: 'FINANCEIRO', responsaveis: ['FINANCEIRO'] },
        { id: 'wd-sex-2', diaSemana: 'sex', descricao: 'CHECK DE PENDÊNCIAS CRÍTICAS DA SEMANA', concluido: false, responsavel: 'MARCOS', responsaveis: ['MARCOS'] },
      ],
    },
  ],
};

export const DEFAULT_WEEKDAY_BLOCKS: WhiteboardWeekdayBlock[] = DEFAULT_WHITEBOARD_DATA.gradeSemanal || [];

export function createEmptyWhiteboardData(departmentSlug: string = 'operacional'): WhiteboardDataState {
  const hoje = new Date();
  const currentMonthKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  return {
    mesReferencia: currentMonthKey,
    mensagensCultura: getDefaultCultureMessages(departmentSlug),
    colunas: [],
    followTheMoney: { cotacaoUsdGs: '', linhas: [] },
    cronograma: [
      { id: 'blk-1', intervalo: '01 a 05', diaInicio: 1, diaFim: 5, itens: [] },
      { id: 'blk-2', intervalo: '06 a 10', diaInicio: 6, diaFim: 10, itens: [] },
      { id: 'blk-3', intervalo: '11 a 15', diaInicio: 11, diaFim: 15, itens: [] },
      { id: 'blk-4', intervalo: '16 a 20', diaInicio: 16, diaFim: 20, itens: [] },
      { id: 'blk-5', intervalo: '21 a 25', diaInicio: 21, diaFim: 25, itens: [] },
      { id: 'blk-6', intervalo: '26 a 30/31', diaInicio: 26, diaFim: 31, itens: [] },
    ],
    gradeSemanal: DEFAULT_WEEKDAY_BLOCKS.map(b => ({ ...b, itens: [] })),
  };
}

export class WarRoomService {
  /**
   * Retorna o ID do bloco do cronograma mensal correspondente a um dia do mês (1 a 31)
   */
  static getTimelineBlockIdForDay(dia: number): string {
    const num = Math.max(1, Math.min(31, Math.floor(dia)));
    if (num <= 5) return 'blk-1';
    if (num <= 10) return 'blk-2';
    if (num <= 15) return 'blk-3';
    if (num <= 20) return 'blk-4';
    if (num <= 25) return 'blk-5';
    return 'blk-6';
  }

  /**
   * Garante que a descrição do vencimento sempre contenha o dia formatado (ex: "30 - OBRIGAÇÃO")
   * e prioriza estritamente o dia selecionado pelo usuário.
   */
  static formatTimelineDescription(dia: number, rawDesc: string): { dia: number; descricao: string } {
    const clean = rawDesc.trim().toUpperCase();

    // Remove qualquer prefixo de número anterior (ex: "11 - ATUALIZAR...", "11: ...", "11 ...")
    const match = clean.match(/^(\d{1,2})\s*[-–—:]?\s*(.*)$/);
    let textoBase = clean;
    if (match) {
      textoBase = match[2].trim() || 'OBRIGAÇÃO';
    }

    // O dia selecionado tem precedência absoluta sobre o prefixo da string
    const finalDia = dia >= 1 && dia <= 31 ? dia : (match && Number(match[1]) >= 1 && Number(match[1]) <= 31 ? Number(match[1]) : 1);
    const finalDesc = `${String(finalDia).padStart(2, '0')} - ${textoBase}`;
    return { dia: finalDia, descricao: finalDesc };
  }

  /**
   * Sanitiza e ordena cronograma garantindo prefixo do dia e ordem cronológica crescente
   */
  static sanitizeCronograma(cronograma: WhiteboardTimelineBlock[]): WhiteboardTimelineBlock[] {
    return cronograma.map(block => {
      const sanitizedItens = block.itens.map(item => {
        const { dia, descricao } = this.formatTimelineDescription(item.dia, item.descricao);
        const resps = extractResponsaveisList(item.responsaveis || item.responsavel || inferDefaultResponsaveis(descricao));
        return {
          ...item,
          dia,
          descricao,
          responsaveis: resps,
          responsavel: item.responsavel || (resps.length > 0 ? resps.join(', ') : undefined),
        };
      });

      // Ordenar por dia crescente
      sanitizedItens.sort((a, b) => a.dia - b.dia);

      return {
        ...block,
        itens: sanitizedItens,
      };
    });
  }

  /**
   * Infere o responsável padrão para itens que ainda não tenham um definido
   */
  static inferDefaultResponsible(text: string): string | undefined {
    return inferDefaultResponsible(text);
  }

  /**
   * Infere múltiplos responsáveis para itens
   */
  static inferDefaultResponsaveis(text: string): string[] {
    return inferDefaultResponsaveis(text);
  }

  static createEmptyWhiteboardData(departmentSlug: string = 'operacional'): WhiteboardDataState {
    return createEmptyWhiteboardData(departmentSlug);
  }

  static getDefaultCultureMessages(departmentSlug?: string, departmentName?: string): WhiteboardCultureMessages {
    return getDefaultCultureMessages(departmentSlug, departmentName);
  }

  /**
   * Atualiza as mensagens de cultura da lousa do departamento
   */
  static updateCultureMessages(
    currentState: WhiteboardDataState,
    cultureMessages: WhiteboardCultureMessages,
    departmentSlug?: string
  ): WhiteboardDataState {
    const activeDept = departmentSlug || this.getActiveDepartmentSlug();
    const newState: WhiteboardDataState = {
      ...currentState,
      mensagensCultura: cultureMessages,
    };
    this.saveWhiteboardData(newState, activeDept);
    return newState;
  }

  static getActiveDepartmentSlug(): string {
    if (typeof window === 'undefined') return 'financeiro';
    try {
      return localStorage.getItem('mb_whiteboard_active_dept') || 'financeiro';
    } catch {
      return 'financeiro';
    }
  }

  static setActiveDepartmentSlug(slug: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('mb_whiteboard_active_dept', slug);
    } catch {
      // offline safe
    }
  }

  static getStorageKey(departmentSlug: string = 'financeiro'): string {
    if (departmentSlug === 'financeiro') return STORAGE_KEY;
    return `marbrasil_whiteboard_${departmentSlug}`;
  }

  /**
   * Obtém os dados da lousa com suporte a LocalStorage, multissetores, sanitização e renovação automática mensal
   */
  static getWhiteboardData(departmentSlug?: string): WhiteboardDataState {
    const activeDept = departmentSlug || this.getActiveDepartmentSlug();
    const hoje = new Date();
    const currentMonthKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const storageKey = this.getStorageKey(activeDept);
    const defaultData = activeDept === 'financeiro' ? DEFAULT_WHITEBOARD_DATA : createEmptyWhiteboardData(activeDept);

    if (typeof window === 'undefined') {
      return {
        ...defaultData,
        mesReferencia: currentMonthKey,
        cronograma: this.sanitizeCronograma(defaultData.cronograma),
      };
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: WhiteboardDataState = JSON.parse(stored);

        // ── RENOVAÇÃO AUTOMÁTICA NA VIRADA DO MÊS ──
        if (parsed.mesReferencia && parsed.mesReferencia !== currentMonthKey) {
          // Virada do mês detectada! Renovação automática de todos os eventos recorrentes da agenda
          if (parsed.cronograma) {
            parsed.cronograma = parsed.cronograma.map(block => ({
              ...block,
              itens: block.itens.map(item => ({ ...item, concluido: false })),
            }));
          }
          parsed.mesReferencia = currentMonthKey;
        } else if (!parsed.mesReferencia) {
          parsed.mesReferencia = currentMonthKey;
        }

        // Hidratação/inferência de múltiplos responsáveis e prazos se faltarem
        if (parsed.colunas) {
          parsed.colunas = parsed.colunas.map(col => {
            const defaultCol = defaultData.colunas.find(c => c.id === col.id);
            return {
              ...col,
              dataLimite: col.dataLimite || defaultCol?.dataLimite,
              itens: col.itens.map(it => {
                const defaultItem = defaultCol?.itens.find(i => i.id === it.id);
                const resps = extractResponsaveisList(
                  it.responsaveis || it.responsavel || (defaultItem ? defaultItem.responsaveis || defaultItem.responsavel : inferDefaultResponsaveis(it.texto))
                );
                return {
                  ...it,
                  responsaveis: resps,
                  responsavel: it.responsavel || (resps.length > 0 ? resps.join(', ') : undefined),
                  dataLimite: it.dataLimite || defaultItem?.dataLimite,
                };
              }),
            };
          });
        }

        if (parsed.cronograma) {
          parsed.cronograma = this.sanitizeCronograma(parsed.cronograma).map(blk => ({
            ...blk,
            itens: blk.itens.map(it => {
              const resps = extractResponsaveisList(it.responsaveis || it.responsavel || inferDefaultResponsaveis(it.descricao));
              return {
                ...it,
                responsaveis: resps,
                responsavel: it.responsavel || (resps.length > 0 ? resps.join(', ') : undefined),
              };
            }),
          }));
          // Persiste a versão sanitizada se houve correção ou virada de mês
          this.saveWhiteboardData(parsed, activeDept);
        }

        if (!parsed.gradeSemanal || !Array.isArray(parsed.gradeSemanal) || parsed.gradeSemanal.length !== 5) {
          parsed.gradeSemanal = defaultData.gradeSemanal || DEFAULT_WEEKDAY_BLOCKS;
        }

        if (!parsed.mensagensCultura) {
          parsed.mensagensCultura = defaultData.mensagensCultura || getDefaultCultureMessages(activeDept);
        }

        return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler dados da lousa do localStorage:', e);
    }

    return {
      ...defaultData,
      mesReferencia: currentMonthKey,
      cronograma: this.sanitizeCronograma(defaultData.cronograma),
      gradeSemanal: defaultData.gradeSemanal || DEFAULT_WEEKDAY_BLOCKS,
      mensagensCultura: defaultData.mensagensCultura || getDefaultCultureMessages(activeDept),
    };
  }

  /**
   * Carrega os dados mais recentes do Supabase para o departamento indicado
   */
  static async loadWhiteboardDataFromSupabase(departmentSlug?: string): Promise<WhiteboardDataState | null> {
    const activeDept = departmentSlug || this.getActiveDepartmentSlug();
    try {
      const { data, error } = await supabase
        .from('whiteboard_state')
        .select('data')
        .eq('id', activeDept)
        .maybeSingle();

      if (data && data.data && !error) {
        const parsed = data.data as WhiteboardDataState;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(this.getStorageKey(activeDept), JSON.stringify(parsed));
          } catch {}
        }
        return parsed;
      }

      // Fallback para financeiro se id='financeiro' não existir mas 'current_state' sim
      if (activeDept === 'financeiro') {
        const { data: fallbackData } = await supabase
          .from('whiteboard_state')
          .select('data')
          .eq('id', 'current_state')
          .maybeSingle();
        if (fallbackData && fallbackData.data) {
          const parsed = fallbackData.data as WhiteboardDataState;
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(this.getStorageKey('financeiro'), JSON.stringify(parsed));
            } catch {}
          }
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[WarRoomService] Erro ao carregar do Supabase:', err);
    }
    return null;
  }

  /**
   * Grava os dados da lousa no LocalStorage e sincroniza com o banco de produção Supabase
   */
  static saveWhiteboardData(data: WhiteboardDataState, departmentSlug?: string): void {
    const activeDept = departmentSlug || this.getActiveDepartmentSlug();
    const storageKey = this.getStorageKey(activeDept);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (e) {
        console.error('Erro ao salvar dados da lousa:', e);
      }
    }

    try {
      const promises = [
        supabase
          .from('whiteboard_state')
          .upsert({
            id: activeDept,
            data,
            updated_at: new Date().toISOString(),
          })
      ];

      if (activeDept === 'financeiro') {
        promises.push(
          supabase
            .from('whiteboard_state')
            .upsert({
              id: 'current_state',
              data,
              updated_at: new Date().toISOString(),
            })
        );
      }

      Promise.all(promises)
        .then(results => {
          results.forEach(res => {
            if (res.error) console.warn('[WarRoomService] Aviso na sincronização com Supabase:', res.error.message);
          });
        })
        .catch(err => console.warn('[WarRoomService] Erro ao sincronizar com Supabase:', err));
    } catch {
      // resguardo offline
    }
  }

  /**
   * Restaura para o padrão original da lousa fotografada
   */
  static resetToDefault(departmentSlug?: string): WhiteboardDataState {
    const activeDept = departmentSlug || this.getActiveDepartmentSlug();
    const storageKey = this.getStorageKey(activeDept);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.error('Erro ao resetar dados da lousa:', e);
      }
    }
    return activeDept === 'financeiro' ? DEFAULT_WHITEBOARD_DATA : createEmptyWhiteboardData(activeDept);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ── MÉTODOS DE CONTROLE DA GRADE SEMANAL RECORRENTE (SEGUNDA A SEXTA) ──
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Obtém os blocos dos dias da semana (Segunda a Sexta)
   */
  static getWeekdayBlocks(data?: WhiteboardDataState): WhiteboardWeekdayBlock[] {
    const current = data || this.getWhiteboardData();
    if (current.gradeSemanal && Array.isArray(current.gradeSemanal) && current.gradeSemanal.length === 5) {
      return current.gradeSemanal;
    }
    return DEFAULT_WEEKDAY_BLOCKS;
  }

  /**
   * Alterna a conclusão de uma rotina semanal específica
   */
  static toggleWeekdayItem(data: WhiteboardDataState, diaSemana: WeekdayKey, itemId: string): WhiteboardDataState {
    const grade = (data.gradeSemanal && data.gradeSemanal.length === 5) 
      ? [...data.gradeSemanal] 
      : [...DEFAULT_WEEKDAY_BLOCKS];

    const updated = grade.map(block => {
      if (block.diaSemana !== diaSemana) return block;
      return {
        ...block,
        itens: block.itens.map(it => it.id === itemId ? { ...it, concluido: !it.concluido } : it)
      };
    });

    const nextState: WhiteboardDataState = { ...data, gradeSemanal: updated };
    this.saveWhiteboardData(nextState);
    return nextState;
  }

  /**
   * Adiciona uma nova atividade recorrente a um dia da semana
   */
  static addWeekdayItem(
    data: WhiteboardDataState, 
    diaSemana: WeekdayKey, 
    descricao: string, 
    responsavel?: string, 
    responsaveis?: string[]
  ): WhiteboardDataState {
    const grade = (data.gradeSemanal && data.gradeSemanal.length === 5) 
      ? [...data.gradeSemanal] 
      : [...DEFAULT_WEEKDAY_BLOCKS];

    const resps = responsaveis && responsaveis.length > 0 ? responsaveis : (responsavel ? [responsavel] : ['MARCOS']);
    const newItem: WhiteboardWeekdayItem = {
      id: `wd-${diaSemana}-${Date.now()}`,
      diaSemana,
      descricao: descricao.trim().toUpperCase(),
      responsavel: resps[0],
      responsaveis: resps,
      concluido: false,
    };

    const updated = grade.map(block => {
      if (block.diaSemana !== diaSemana) return block;
      return {
        ...block,
        itens: [...block.itens, newItem]
      };
    });

    const nextState: WhiteboardDataState = { ...data, gradeSemanal: updated };
    this.saveWhiteboardData(nextState);
    return nextState;
  }

  /**
   * Edita uma atividade recorrente existente da semana
   */
  static editWeekdayItem(
    data: WhiteboardDataState,
    diaSemana: WeekdayKey,
    itemId: string,
    descricao: string,
    responsaveis: string[]
  ): WhiteboardDataState {
    const grade = (data.gradeSemanal && data.gradeSemanal.length === 5) 
      ? [...data.gradeSemanal] 
      : [...DEFAULT_WEEKDAY_BLOCKS];

    const resps = responsaveis.length > 0 ? responsaveis : ['MARCOS'];
    const updated = grade.map(block => {
      if (block.diaSemana !== diaSemana) return block;
      return {
        ...block,
        itens: block.itens.map(it => it.id === itemId ? {
          ...it,
          descricao: descricao.trim().toUpperCase(),
          responsavel: resps[0],
          responsaveis: resps
        } : it)
      };
    });

    const nextState: WhiteboardDataState = { ...data, gradeSemanal: updated };
    this.saveWhiteboardData(nextState);
    return nextState;
  }

  /**
   * Exclui uma atividade recorrente da semana
   */
  static deleteWeekdayItem(data: WhiteboardDataState, diaSemana: WeekdayKey, itemId: string): WhiteboardDataState {
    const grade = (data.gradeSemanal && data.gradeSemanal.length === 5) 
      ? [...data.gradeSemanal] 
      : [...DEFAULT_WEEKDAY_BLOCKS];

    const updated = grade.map(block => {
      if (block.diaSemana !== diaSemana) return block;
      return {
        ...block,
        itens: block.itens.filter(it => it.id !== itemId)
      };
    });

    const nextState: WhiteboardDataState = { ...data, gradeSemanal: updated };
    this.saveWhiteboardData(nextState);
    return nextState;
  }

  /**
   * Reinicia o ciclo semanal: desmarca todas as rotinas para a nova semana
   */
  static resetWeekdayCycle(data: WhiteboardDataState): WhiteboardDataState {
    const grade = (data.gradeSemanal && data.gradeSemanal.length === 5) 
      ? [...data.gradeSemanal] 
      : [...DEFAULT_WEEKDAY_BLOCKS];

    const updated = grade.map(block => ({
      ...block,
      itens: block.itens.map(it => ({ ...it, concluido: false }))
    }));

    const nextState: WhiteboardDataState = { ...data, gradeSemanal: updated };
    this.saveWhiteboardData(nextState);
    return nextState;
  }

  /**
   * Alterna estado de conclusão de um item de coluna
   */
  static toggleColumnItem(
    currentState: WhiteboardDataState,
    columnId: string,
    itemId: string
  ): WhiteboardDataState {
    const updatedColunas = currentState.colunas.map(col => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        itens: col.itens.map(item => {
          if (item.id !== itemId) return item;
          return { ...item, concluido: !item.concluido };
        }),
      };
    });

    const newState = { ...currentState, colunas: updatedColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Adiciona novo item (tarefa) a uma demanda/coluna com suporte a múltiplos responsáveis
   */
  static addColumnItem(
    currentState: WhiteboardDataState,
    columnId: string,
    texto: string,
    responsavel?: string,
    dataLimite?: string,
    responsaveis?: string[]
  ): WhiteboardDataState {
    const respsList = extractResponsaveisList(
      responsaveis && responsaveis.length > 0
        ? responsaveis
        : responsavel?.trim()
        ? responsavel
        : inferDefaultResponsaveis(texto)
    );

    const newItem: WhiteboardItem = {
      id: `it-${Date.now()}`,
      texto: texto.toUpperCase(),
      concluido: false,
      responsaveis: respsList,
      responsavel: respsList.length > 0 ? respsList.join(', ') : undefined,
      dataLimite: dataLimite?.trim() || undefined,
    };

    const updatedColunas = currentState.colunas.map(col => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        itens: [...col.itens, newItem],
      };
    });

    const newState = { ...currentState, colunas: updatedColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Exclui item (tarefa) de uma coluna
   */
  static deleteColumnItem(
    currentState: WhiteboardDataState,
    columnId: string,
    itemId: string
  ): WhiteboardDataState {
    const updatedColunas = currentState.colunas.map(col => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        itens: col.itens.filter(i => i.id !== itemId),
      };
    });

    const newState = { ...currentState, colunas: updatedColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  // ══════════════════════════════════════════════════════════════
  // ── GESTÃO DE DEMANDAS INTEIRAS (COLUNAS DA LOUSA) ──
  // ══════════════════════════════════════════════════════════════

  /**
   * Arquiva a demanda inteira (coluna), ocultando-a da lousa ativa a critério do usuário
   * (independente de todas as tarefas estarem executadas ou não)
   */
  static archiveDemand(
    currentState: WhiteboardDataState,
    columnId: string
  ): WhiteboardDataState {
    const updatedColunas = currentState.colunas.map(col => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        arquivado: true,
        arquivadoEm: new Date().toISOString(),
      };
    });

    const newState = { ...currentState, colunas: updatedColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Restaura uma demanda inteira (coluna) arquivada de volta para a lousa ativa
   */
  static restoreDemand(
    currentState: WhiteboardDataState,
    columnId: string
  ): WhiteboardDataState {
    const updatedColunas = currentState.colunas.map(col => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        arquivado: false,
        arquivadoEm: undefined,
      };
    });

    const newState = { ...currentState, colunas: updatedColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Atualiza dados estruturais de uma demanda (coluna inteira: título, subtítulo, alerta, data limite, cor)
   */
  static updateDemand(
    currentState: WhiteboardDataState,
    columnId: string,
    updates: {
      titulo?: string;
      subtitulo?: string;
      alertaDestaque?: string;
      dataLimite?: string;
      corMarcador?: 'vermelho' | 'azul' | 'ciano' | 'esmeralda' | 'ambar';
      arquivado?: boolean;
    }
  ): WhiteboardDataState {
    const updatedColunas = currentState.colunas.map(col => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        titulo: updates.titulo ? updates.titulo.trim().toUpperCase() : col.titulo,
        subtitulo: updates.subtitulo !== undefined ? updates.subtitulo.trim() : col.subtitulo,
        alertaDestaque: updates.alertaDestaque !== undefined ? updates.alertaDestaque.trim().toUpperCase() : col.alertaDestaque,
        dataLimite: updates.dataLimite !== undefined ? updates.dataLimite.trim() : col.dataLimite,
        corMarcador: updates.corMarcador || col.corMarcador,
        arquivado: updates.arquivado !== undefined ? updates.arquivado : col.arquivado,
        arquivadoEm: updates.arquivado ? (col.arquivadoEm || new Date().toISOString()) : (updates.arquivado === false ? undefined : col.arquivadoEm),
      };
    });

    const newState = { ...currentState, colunas: updatedColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Adiciona uma nova demanda (coluna) na lousa
   */
  static addDemand(
    currentState: WhiteboardDataState,
    payload: {
      titulo: string;
      subtitulo?: string;
      alertaDestaque?: string;
      dataLimite?: string;
      corMarcador?: 'vermelho' | 'azul' | 'ciano' | 'esmeralda' | 'ambar';
    }
  ): WhiteboardDataState {
    const newCol: WhiteboardColumn = {
      id: `col-${Date.now()}`,
      titulo: payload.titulo.trim().toUpperCase(),
      subtitulo: payload.subtitulo?.trim() || undefined,
      alertaDestaque: payload.alertaDestaque?.trim() ? payload.alertaDestaque.trim().toUpperCase() : undefined,
      corMarcador: payload.corMarcador || 'vermelho',
      dataLimite: payload.dataLimite?.trim() || undefined,
      itens: [],
      criadoEm: new Date().toISOString(),
    };

    const newState = { ...currentState, colunas: [...currentState.colunas, newCol] };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Exclui uma demanda inteira (coluna) e todas as suas tarefas
   */
  static deleteDemand(
    currentState: WhiteboardDataState,
    columnId: string
  ): WhiteboardDataState {
    const updatedColunas = currentState.colunas.filter(col => col.id !== columnId);
    const newState = { ...currentState, colunas: updatedColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Retorna a lista de todas as demandas (colunas) arquivadas
   */
  static getArchivedDemandsList(currentState: WhiteboardDataState): WhiteboardColumn[] {
    return currentState.colunas
      .filter(col => col.arquivado)
      .sort((a, b) => {
        const timeA = a.arquivadoEm ? new Date(a.arquivadoEm).getTime() : 0;
        const timeB = b.arquivadoEm ? new Date(b.arquivadoEm).getTime() : 0;
        return timeB - timeA;
      });
  }

  /**
   * Finaliza e arquiva uma demanda operacional
   */
  static archiveColumnItem(
    currentState: WhiteboardDataState,
    columnId: string,
    itemId: string,
    finalizadoPor?: string
  ): WhiteboardDataState {
    const updatedColunas = currentState.colunas.map(col => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        itens: col.itens.map(item => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            concluido: true,
            arquivado: true,
            arquivadoEm: new Date().toISOString(),
            finalizadoPor: finalizadoPor || item.responsavel || 'MARCO',
            colunaOrigemId: col.id,
            colunaOrigemTitulo: col.titulo,
          };
        }),
      };
    });

    const newState = { ...currentState, colunas: updatedColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Restaura uma demanda arquivada de volta para a visão ativa da lousa
   */
  static restoreArchivedItem(
    currentState: WhiteboardDataState,
    columnId: string,
    itemId: string
  ): WhiteboardDataState {
    const updatedColunas = currentState.colunas.map(col => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        itens: col.itens.map(item => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            arquivado: false,
            concluido: false,
            arquivadoEm: undefined,
          };
        }),
      };
    });

    const newState = { ...currentState, colunas: updatedColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Atualização completa de uma demanda (texto, responsável, destaque, observação, coluna de destino, prioridade, arquivado)
   */
  static updateFullDemand(
    currentState: WhiteboardDataState,
    currentColId: string,
    itemId: string,
    updates: {
      texto: string;
      responsavel?: string;
      dataLimite?: string;
      destaque?: boolean;
      observacao?: string;
      prioridade?: 'normal' | 'alta' | 'urgente';
      novaColunaId?: string;
      arquivado?: boolean;
    }
  ): WhiteboardDataState {
    const targetColId = updates.novaColunaId || currentColId;
    let targetItem: any = null;

    // Localiza e remove do local antigo
    const intermediateColunas = currentState.colunas.map(col => {
      if (col.id !== currentColId) return col;
      return {
        ...col,
        itens: col.itens.filter(item => {
          if (item.id === itemId) {
            const rawResps =
              (updates as any).responsaveis !== undefined
                ? (updates as any).responsaveis
                : updates.responsavel !== undefined
                ? updates.responsavel
                : item.responsaveis || item.responsavel || inferDefaultResponsaveis(updates.texto);

            const finalRespsList = extractResponsaveisList(rawResps);
            const finalResp = finalRespsList.length > 0 ? finalRespsList.join(', ') : undefined;

            targetItem = {
              ...item,
              texto: updates.texto.trim().toUpperCase(),
              responsavel: finalResp,
              responsaveis: finalRespsList,
              dataLimite: updates.dataLimite !== undefined ? (updates.dataLimite.trim() || undefined) : item.dataLimite,
              destaque: updates.destaque !== undefined ? updates.destaque : item.destaque,
              observacao: updates.observacao !== undefined ? updates.observacao.trim() : item.observacao,
              prioridade: updates.prioridade || item.prioridade || 'normal',
              arquivado: updates.arquivado !== undefined ? updates.arquivado : item.arquivado,
              arquivadoEm: updates.arquivado ? (item.arquivadoEm || new Date().toISOString()) : (updates.arquivado === false ? undefined : item.arquivadoEm),
              colunaOrigemId: targetColId,
            };
            return targetColId === currentColId;
          }
          return true;
        }),
      };
    });

    if (!targetItem) {
      return currentState;
    }

    let finalColunas = intermediateColunas;
    if (targetColId !== currentColId) {
      finalColunas = intermediateColunas.map(col => {
        if (col.id !== targetColId) return col;
        return {
          ...col,
          itens: [...col.itens, targetItem],
        };
      });
    } else {
      finalColunas = intermediateColunas.map(col => {
        if (col.id !== currentColId) return col;
        return {
          ...col,
          itens: col.itens.map(item => (item.id === itemId ? targetItem : item)),
        };
      });
    }

    const newState = { ...currentState, colunas: finalColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Retorna todas as demandas arquivadas em todas as colunas
   */
  static getAllArchivedDemands(currentState: WhiteboardDataState): Array<{
    item: import('@/types/war-room').WhiteboardItem;
    colunaId: string;
    colunaTitulo: string;
  }> {
    const archived: Array<{
      item: import('@/types/war-room').WhiteboardItem;
      colunaId: string;
      colunaTitulo: string;
    }> = [];

    currentState.colunas.forEach(col => {
      col.itens.forEach(it => {
        if (it.arquivado) {
          archived.push({
            item: it,
            colunaId: col.id,
            colunaTitulo: col.titulo,
          });
        }
      });
    });

    archived.sort((a, b) => {
      const timeA = a.item.arquivadoEm ? new Date(a.item.arquivadoEm).getTime() : 0;
      const timeB = b.item.arquivadoEm ? new Date(b.item.arquivadoEm).getTime() : 0;
      return timeB - timeA;
    });

    return archived;
  }

  /**
   * Atualiza a cotação USD = G$ do Follow The Money
   */
  static updateQuote(
    currentState: WhiteboardDataState,
    novaCotacao: string
  ): WhiteboardDataState {
    const newState: WhiteboardDataState = {
      ...currentState,
      followTheMoney: {
        ...currentState.followTheMoney,
        cotacaoUsdGs: novaCotacao,
      },
    };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Adiciona linha ao Follow The Money
   */
  static addFollowTheMoneyRow(
    currentState: WhiteboardDataState,
    row: Omit<FollowTheMoneyRow, 'id'>
  ): WhiteboardDataState {
    const newRow: FollowTheMoneyRow = {
      ...row,
      id: `ftm-${Date.now()}`,
    };

    const newState: WhiteboardDataState = {
      ...currentState,
      followTheMoney: {
        ...currentState.followTheMoney,
        linhas: [...currentState.followTheMoney.linhas, newRow],
      },
    };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Exclui linha do Follow The Money
   */
  static deleteFollowTheMoneyRow(
    currentState: WhiteboardDataState,
    id: string
  ): WhiteboardDataState {
    const newState: WhiteboardDataState = {
      ...currentState,
      followTheMoney: {
        ...currentState.followTheMoney,
        linhas: currentState.followTheMoney.linhas.filter(r => r.id !== id),
      },
    };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Alterna conclusão de item no cronograma
   */
  static toggleTimelineItem(
    currentState: WhiteboardDataState,
    blockId: string,
    itemId: string
  ): WhiteboardDataState {
    const updatedCronograma = currentState.cronograma.map(block => {
      if (block.id !== blockId) return block;
      return {
        ...block,
        itens: block.itens.map(item => {
          if (item.id !== itemId) return item;
          return { ...item, concluido: !item.concluido };
        }),
      };
    });

    const newState = { ...currentState, cronograma: updatedCronograma };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Atualiza texto e responsável de item de uma coluna
   */
  static updateColumnItem(
    currentState: WhiteboardDataState,
    columnId: string,
    itemId: string,
    novoTexto: string,
    novoResponsavel?: string,
    novaDataLimite?: string,
    novosResponsaveis?: string[]
  ): WhiteboardDataState {
    const updatedColunas = currentState.colunas.map(col => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        itens: col.itens.map(item => {
          if (item.id !== itemId) return item;
          const rawResps =
            novosResponsaveis !== undefined
              ? novosResponsaveis
              : novoResponsavel !== undefined
              ? novoResponsavel
              : item.responsaveis || item.responsavel || inferDefaultResponsaveis(novoTexto);

          const finalRespsList = extractResponsaveisList(rawResps);
          const finalResp = finalRespsList.length > 0 ? finalRespsList.join(', ') : undefined;

          return {
            ...item,
            texto: novoTexto.trim().toUpperCase(),
            responsavel: finalResp,
            responsaveis: finalRespsList,
            dataLimite: novaDataLimite !== undefined ? (novaDataLimite.trim() || undefined) : item.dataLimite,
          };
        }),
      };
    });

    const newState = { ...currentState, colunas: updatedColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Atualiza linha existente do Follow The Money
   */
  static updateFollowTheMoneyRow(
    currentState: WhiteboardDataState,
    updatedRow: FollowTheMoneyRow
  ): WhiteboardDataState {
    const newState: WhiteboardDataState = {
      ...currentState,
      followTheMoney: {
        ...currentState.followTheMoney,
        linhas: currentState.followTheMoney.linhas.map(row =>
          row.id === updatedRow.id ? updatedRow : row
        ),
      },
    };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Adiciona item a um bloco do cronograma com formatação automática de dia, múltiplos responsáveis e ordenação crescente
   */
  static addTimelineItem(
    currentState: WhiteboardDataState,
    blockId: string,
    dia: number,
    descricao: string,
    responsavel?: string,
    responsaveis?: string[]
  ): WhiteboardDataState {
    const formatted = this.formatTimelineDescription(dia, descricao);
    const rawResps =
      responsaveis !== undefined && responsaveis.length > 0
        ? responsaveis
        : responsavel?.trim()
        ? responsavel
        : inferDefaultResponsaveis(descricao);

    const respsList = extractResponsaveisList(rawResps);
    const finalResp = respsList.length > 0 ? respsList.join(', ') : undefined;

    const newItem: WhiteboardTimelineItem = {
      id: `tl-${Date.now()}`,
      dia: formatted.dia,
      descricao: formatted.descricao,
      concluido: false,
      responsavel: finalResp,
      responsaveis: respsList,
    };

    const updatedCronograma = currentState.cronograma.map(block => {
      if (block.id !== blockId) return block;
      const itens = [...block.itens, newItem];
      itens.sort((a, b) => a.dia - b.dia);
      return {
        ...block,
        itens,
      };
    });

    const newState = { ...currentState, cronograma: updatedCronograma };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Edita item do cronograma com formatação automática de dia, múltiplos responsáveis,
   * re-ordenação crescente e movimentação automática para o bloco correto se o dia mudar.
   */
  static updateTimelineItem(
    currentState: WhiteboardDataState,
    blockId: string,
    itemId: string,
    dia: number,
    descricao: string,
    novoResponsavel?: string,
    novosResponsaveis?: string[]
  ): WhiteboardDataState {
    const formatted = this.formatTimelineDescription(dia, descricao);
    const targetBlockId = this.getTimelineBlockIdForDay(formatted.dia);

    let updatedItem: WhiteboardTimelineItem | null = null;

    // 1. Encontrar o item e atualizar suas propriedades
    currentState.cronograma.forEach(block => {
      const found = block.itens.find(i => i.id === itemId);
      if (found) {
        const rawResps =
          novosResponsaveis !== undefined
            ? novosResponsaveis
            : novoResponsavel !== undefined
            ? novoResponsavel
            : found.responsaveis || found.responsavel || inferDefaultResponsaveis(descricao);

        const respsList = extractResponsaveisList(rawResps);
        const finalResp = respsList.length > 0 ? respsList.join(', ') : undefined;

        updatedItem = {
          ...found,
          dia: formatted.dia,
          descricao: formatted.descricao,
          responsavel: finalResp,
          responsaveis: respsList,
        };
      }
    });

    if (!updatedItem) return currentState;

    // 2. Se o novo dia permanece no mesmo bloco
    let updatedCronograma: WhiteboardTimelineBlock[];
    if (targetBlockId === blockId) {
      updatedCronograma = currentState.cronograma.map(block => {
        if (block.id !== blockId) return block;
        const itens = block.itens.map(item => (item.id === itemId ? updatedItem! : item));
        itens.sort((a, b) => a.dia - b.dia);
        return { ...block, itens };
      });
    } else {
      // 3. O dia mudou de período (ex: dia 11 foi para dia 30 -> migra de blk-3 para blk-6)
      updatedCronograma = currentState.cronograma.map(block => {
        if (block.id === blockId) {
          return {
            ...block,
            itens: block.itens.filter(item => item.id !== itemId),
          };
        }
        if (block.id === targetBlockId) {
          const itens = [...block.itens.filter(item => item.id !== itemId), updatedItem!];
          itens.sort((a, b) => a.dia - b.dia);
          return { ...block, itens };
        }
        return block;
      });
    }

    const newState = { ...currentState, cronograma: updatedCronograma };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Exclui item de um bloco do cronograma
   */
  static deleteTimelineItem(
    currentState: WhiteboardDataState,
    blockId: string,
    itemId: string
  ): WhiteboardDataState {
    const updatedCronograma = currentState.cronograma.map(block => {
      if (block.id !== blockId) return block;
      return {
        ...block,
        itens: block.itens.filter(i => i.id !== itemId),
      };
    });

    const newState = { ...currentState, cronograma: updatedCronograma };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Reseta manualmente os checks do cronograma para iniciar um novo ciclo mensal
   */
  static resetMonthlyRecurringChecks(currentState: WhiteboardDataState): WhiteboardDataState {
    const hoje = new Date();
    const currentMonthKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const updatedCronograma = currentState.cronograma.map(block => ({
      ...block,
      itens: block.itens.map(item => ({ ...item, concluido: false })),
    }));

    const newState: WhiteboardDataState = {
      ...currentState,
      mesReferencia: currentMonthKey,
      cronograma: updatedCronograma,
    };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Reordena itens dentro de um bloco do cronograma (Drag & Drop)
   */
  static reorderTimelineItems(
    currentState: WhiteboardDataState,
    blockId: string,
    startIndex: number,
    endIndex: number
  ): WhiteboardDataState {
    const updatedCronograma = currentState.cronograma.map(block => {
      if (block.id !== blockId) return block;
      const items = [...block.itens];
      const [movedItem] = items.splice(startIndex, 1);
      items.splice(endIndex, 0, movedItem);
      return { ...block, itens: items };
    });

    const newState = { ...currentState, cronograma: updatedCronograma };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Move item entre blocos do cronograma (Drag & Drop)
   */
  static moveTimelineItem(
    currentState: WhiteboardDataState,
    sourceBlockId: string,
    targetBlockId: string,
    itemId: string,
    targetIndex?: number
  ): WhiteboardDataState {
    let movedItem: WhiteboardTimelineItem | undefined;

    // 1. Remover do bloco de origem
    const withoutItem = currentState.cronograma.map(block => {
      if (block.id !== sourceBlockId) return block;
      const found = block.itens.find(i => i.id === itemId);
      if (found) movedItem = { ...found };
      return {
        ...block,
        itens: block.itens.filter(i => i.id !== itemId),
      };
    });

    if (!movedItem) return currentState;

    // 2. Inserir no bloco de destino
    const withItem = withoutItem.map(block => {
      if (block.id !== targetBlockId) return block;
      let itemToInsert = { ...movedItem! };
      if (itemToInsert.dia < block.diaInicio || itemToInsert.dia > block.diaFim) {
        itemToInsert.dia = block.diaInicio;
        const formatted = this.formatTimelineDescription(block.diaInicio, itemToInsert.descricao);
        itemToInsert.descricao = formatted.descricao;
      }

      const items = [...block.itens];
      if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= items.length) {
        items.splice(targetIndex, 0, itemToInsert);
      } else {
        items.push(itemToInsert);
      }
      return { ...block, itens: items };
    });

    const newState = { ...currentState, cronograma: withItem };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Reordena itens dentro de uma coluna de demandas (Drag & Drop)
   */
  static reorderColumnItems(
    currentState: WhiteboardDataState,
    columnId: string,
    startIndex: number,
    endIndex: number
  ): WhiteboardDataState {
    const updatedColunas = currentState.colunas.map(col => {
      if (col.id !== columnId) return col;
      const items = [...col.itens];
      const [movedItem] = items.splice(startIndex, 1);
      items.splice(endIndex, 0, movedItem);
      return { ...col, itens: items };
    });

    const newState = { ...currentState, colunas: updatedColunas };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Move item entre colunas de demandas (Drag & Drop)
   */
  static moveColumnItem(
    currentState: WhiteboardDataState,
    sourceColId: string,
    targetColId: string,
    itemId: string,
    targetIndex?: number
  ): WhiteboardDataState {
    let movedItem: any;

    const withoutItem = currentState.colunas.map(col => {
      if (col.id !== sourceColId) return col;
      const found = col.itens.find(i => i.id === itemId);
      if (found) movedItem = { ...found };
      return {
        ...col,
        itens: col.itens.filter(i => i.id !== itemId),
      };
    });

    if (!movedItem) return currentState;

    const withItem = withoutItem.map(col => {
      if (col.id !== targetColId) return col;
      const items = [...col.itens];
      if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= items.length) {
        items.splice(targetIndex, 0, movedItem);
      } else {
        items.push(movedItem);
      }
      return { ...col, itens: items };
    });

    const newState = { ...currentState, colunas: withItem };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Edita ou renomeia um membro em todas as tarefas e cronograma da lousa
   */
  static renameMember(
    currentState: WhiteboardDataState,
    oldName: string,
    newName: string
  ): WhiteboardDataState {
    const oldUpper = oldName.trim().toUpperCase();
    const newUpper = newName.trim().toUpperCase();
    if (!oldUpper || !newUpper || oldUpper === newUpper) return currentState;

    // 1. Atualizar em todas as colunas
    const updatedColunas = currentState.colunas.map(col => ({
      ...col,
      itens: col.itens.map(item => {
        const resps = extractResponsaveisList(item);
        if (!resps.includes(oldUpper)) return item;
        const newResps = Array.from(new Set(resps.map(r => r === oldUpper ? newUpper : r)));
        return {
          ...item,
          responsaveis: newResps,
          responsavel: newResps.join(', '),
        };
      })
    }));

    // 2. Atualizar em todo o cronograma
    const updatedCronograma = currentState.cronograma.map(block => ({
      ...block,
      itens: block.itens.map(item => {
        const resps = extractResponsaveisList(item);
        if (!resps.includes(oldUpper)) return item;
        const newResps = Array.from(new Set(resps.map(r => r === oldUpper ? newUpper : r)));
        return {
          ...item,
          responsaveis: newResps,
          responsavel: newResps.join(', '),
        };
      })
    }));

    const newState = {
      ...currentState,
      colunas: updatedColunas,
      cronograma: updatedCronograma,
    };
    this.saveWhiteboardData(newState);
    return newState;
  }

  /**
   * Exclui um membro da lousa, opcionalmente reatribuindo suas tarefas para outro responsável
   */
  static deleteMember(
    currentState: WhiteboardDataState,
    memberName: string,
    reassignedTo?: string | null
  ): WhiteboardDataState {
    const targetUpper = memberName.trim().toUpperCase();
    const reassignUpper = reassignedTo ? reassignedTo.trim().toUpperCase() : null;
    if (!targetUpper) return currentState;

    // 1. Remover ou reatribuir nas colunas
    const updatedColunas = currentState.colunas.map(col => ({
      ...col,
      itens: col.itens.map(item => {
        const resps = extractResponsaveisList(item);
        if (!resps.includes(targetUpper)) return item;
        let newResps = resps.filter(r => r !== targetUpper);
        if (reassignUpper && reassignUpper !== targetUpper) {
          newResps = Array.from(new Set([...newResps, reassignUpper]));
        }
        return {
          ...item,
          responsaveis: newResps,
          responsavel: newResps.length > 0 ? newResps.join(', ') : undefined,
        };
      })
    }));

    // 2. Remover ou reatribuir no cronograma
    const updatedCronograma = currentState.cronograma.map(block => ({
      ...block,
      itens: block.itens.map(item => {
        const resps = extractResponsaveisList(item);
        if (!resps.includes(targetUpper)) return item;
        let newResps = resps.filter(r => r !== targetUpper);
        if (reassignUpper && reassignUpper !== targetUpper) {
          newResps = Array.from(new Set([...newResps, reassignUpper]));
        }
        return {
          ...item,
          responsaveis: newResps,
          responsavel: newResps.length > 0 ? newResps.join(', ') : undefined,
        };
      })
    }));

    const newState = {
      ...currentState,
      colunas: updatedColunas,
      cronograma: updatedCronograma,
    };
    this.saveWhiteboardData(newState);
    return newState;
  }
}

export interface MemberActiveTask {
  id: string;
  itemId: string;
  origem: 'cronograma' | 'coluna' | 'semanal';
  origemId: string;
  origemNome: string;
  texto: string;
  dia?: number;
  dataLimite?: string;
  isOverdue: boolean;
  diasAtraso?: number;
  prazoTexto: string;
  responsavel: string;
  sortWeight: number;
}

export interface MemberActiveTaskGroup {
  nome: string;
  totalAtivas: number;
  atrasadas: number;
  tarefas: MemberActiveTask[];
}

/**
 * Compila para cada usuário/responsável suas até 5 próximas atividades ativas por ordem de data
 * (da mais atrasada até a vencer), substituindo por uma nova cada vez que uma for marcada como concluída
 */
export function getTopTasksPerMember(data: WhiteboardDataState, maxPerMember = 5): MemberActiveTaskGroup[] {
  const today = new Date();
  const todayDay = today.getDate();

  const memberTasksMap = new Map<string, MemberActiveTask[]>();

  const registerTask = (resp: string, task: Omit<MemberActiveTask, 'responsavel'>) => {
    const upper = resp.trim().toUpperCase();
    if (!upper) return;
    if (!memberTasksMap.has(upper)) {
      memberTasksMap.set(upper, []);
    }
    memberTasksMap.get(upper)!.push({ ...task, responsavel: upper });
  };

  // 1. Tarefas do Cronograma de Vencimentos
  data.cronograma.forEach(block => {
    block.itens.forEach(item => {
      if (item.concluido) return;
      const isOverdue = item.dia < todayDay;
      const diasAtraso = isOverdue ? todayDay - item.dia : 0;
      const resps = extractResponsaveisList(item);

      const prazoTexto = isOverdue
        ? `Dia ${String(item.dia).padStart(2, '0')} (${diasAtraso}d atr)`
        : item.dia === todayDay
        ? `Dia ${String(item.dia).padStart(2, '0')} (HOJE)`
        : `Dia ${String(item.dia).padStart(2, '0')}`;

      // sortWeight negativo para atrasados (quanto menor, mais atrasado)
      const sortWeight = item.dia - todayDay;

      resps.forEach(resp => {
        registerTask(resp, {
          id: `cronograma-${item.id}-${resp}`,
          itemId: item.id,
          origem: 'cronograma',
          origemId: block.id,
          origemNome: `Bloco ${block.intervalo}`,
          texto: item.descricao,
          dia: item.dia,
          isOverdue,
          diasAtraso,
          prazoTexto,
          sortWeight,
        });
      });
    });
  });

  // 2. Tarefas das Colunas / Demandas Operacionais
  data.colunas.forEach(col => {
    col.itens.forEach(item => {
      if (item.concluido || item.arquivado) return;
      const resps = extractResponsaveisList(item);

      let isOverdue = false;
      let diasAtraso = 0;
      let prazoTexto = 'Sem data';
      let sortWeight = 900;

      if (item.dataLimite) {
        const prazo = calculatePrazoInfo(item.dataLimite, false);
        const diasRestantes = prazo.diasRestantes ?? 0;
        if (prazo.status === 'atrasado') {
          isOverdue = true;
          diasAtraso = Math.abs(diasRestantes);
          prazoTexto = `${item.dataLimite} (${diasAtraso}d atr)`;
          sortWeight = diasRestantes;
        } else if (prazo.status === 'hoje') {
          isOverdue = false;
          prazoTexto = `${item.dataLimite} (HOJE)`;
          sortWeight = 0;
        } else {
          isOverdue = false;
          prazoTexto = item.dataLimite;
          sortWeight = diasRestantes;
        }
      }

      resps.forEach(resp => {
        registerTask(resp, {
          id: `coluna-${item.id}-${resp}`,
          itemId: item.id,
          origem: 'coluna',
          origemId: col.id,
          origemNome: col.titulo.replace(':', ''),
          texto: item.texto,
          dataLimite: item.dataLimite,
          isOverdue,
          diasAtraso,
          prazoTexto,
          sortWeight,
        });
      });
    });
  });

  // 3. Tarefas da Grade Semanal Recorrente
  if (data.gradeSemanal && Array.isArray(data.gradeSemanal)) {
    const jsDay = today.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
    const weekdayMap: Record<string, number> = {
      seg: 1,
      ter: 2,
      qua: 3,
      qui: 4,
      sex: 5,
    };

    data.gradeSemanal.forEach(block => {
      const blockJsDay = weekdayMap[block.diaSemana] || 1;
      const isToday = jsDay === blockJsDay;
      const isOverdue = jsDay > blockJsDay && jsDay <= 5;
      const diasAtraso = isOverdue ? jsDay - blockJsDay : 0;
      const prazoTexto = isToday 
        ? `Toda ${block.sigla} (HOJE)` 
        : isOverdue 
        ? `Toda ${block.sigla} (${diasAtraso}d atr)` 
        : `Toda ${block.sigla}`;

      const sortWeight = isOverdue ? -diasAtraso : isToday ? 0 : (blockJsDay > jsDay ? blockJsDay - jsDay : 7 - jsDay + blockJsDay);

      block.itens.forEach(item => {
        if (item.concluido) return;
        const resps = extractResponsaveisList(item.responsaveis || item.responsavel);
        resps.forEach(resp => {
          registerTask(resp, {
            id: `semanal-${item.id}-${resp}`,
            itemId: item.id,
            origem: 'semanal',
            origemId: block.diaSemana,
            origemNome: `Toda ${block.nome.split('-')[0]}`,
            texto: item.descricao,
            isOverdue,
            diasAtraso,
            prazoTexto,
            sortWeight,
          });
        });
      });
    });
  }

  // Apenas membros existentes que possuem tarefas ativas registradas
  const allNames = Array.from(memberTasksMap.keys());

  const groups: MemberActiveTaskGroup[] = [];

  allNames.forEach(nome => {
    const tasks = memberTasksMap.get(nome) || [];
    if (tasks.length === 0) return;

    // Ordenar da mais atrasada para a vencer no futuro
    const sorted = [...tasks].sort((a, b) => {
      if (a.sortWeight !== b.sortWeight) return a.sortWeight - b.sortWeight;
      return a.texto.localeCompare(b.texto);
    });

    const atrasadas = sorted.filter(t => t.isOverdue).length;

    groups.push({
      nome,
      totalAtivas: sorted.length,
      atrasadas,
      tarefas: sorted.slice(0, maxPerMember),
    });
  });

  // Ordenar grupos: primeiro quem tem atrasadas (DESC), depois quem tem mais tarefas pendentes
  groups.sort((a, b) => {
    if (a.atrasadas > 0 && b.atrasadas === 0) return -1;
    if (a.atrasadas === 0 && b.atrasadas > 0) return 1;
    if (b.atrasadas !== a.atrasadas) return b.atrasadas - a.atrasadas;
    return b.totalAtivas - a.totalAtivas;
  });

  return groups;
}
