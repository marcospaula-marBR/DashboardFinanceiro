/**
 * War Room Service — Lousa Digital Operacional (Modo TV)
 * Gerencia os dados da Lousa Digital com persistência e paridade com a lousa física
 * @version v.02.59.23
 */

import {
  WhiteboardDataState,
  WhiteboardColumn,
  FollowTheMoneyState,
  FollowTheMoneyRow,
  WhiteboardTimelineBlock,
  WhiteboardTimelineItem,
} from '@/types/war-room';

const STORAGE_KEY = 'marbrasil_whiteboard_v2';

/**
 * Dados autênticos fotografados diretamente da Lousa Operacional
 */
export const DEFAULT_WHITEBOARD_DATA: WhiteboardDataState = {
  colunas: [
    {
      id: 'col-1',
      titulo: 'CONTABILIDADE PY:',
      subtitulo: 'Operações e regularização no Paraguai',
      corMarcador: 'vermelho',
      itens: [
        { id: 'it-1-1', texto: 'JUSTIFICAR DEPÓSITOS CONTA PESSOAL;', concluido: false, responsavel: 'MARCO' },
        { id: 'it-1-2', texto: 'ANALISAR MELHOR OPÇÃO P/ EMPRÉSTIMOS FEITOS PY (CONTABILIDADE + ALDO)', concluido: false, responsavel: 'FINANCEIRO' },
        { id: 'it-1-3', texto: 'FLUXO DLOCAL => UENO: COMO JUSTIFICAR?*', concluido: false, destaque: true, responsavel: 'MARCO' },
        { id: 'it-1-4', texto: 'DOMÍNIOS NIC.PY', concluido: true, responsavel: 'TI / CONTÁBIL' },
        { id: 'it-1-5', texto: 'ERP PY', concluido: false, responsavel: 'TI / CONTÁBIL' },
      ],
    },
    {
      id: 'col-2',
      titulo: 'PAGOPAR CONTA G2:',
      subtitulo: 'Gateway e integração Paraguai',
      alertaDestaque: '* SUSPENSAS NOVAS CONTAS',
      corMarcador: 'vermelho',
      itens: [
        { id: 'it-2-1', texto: 'MSG ENVIADA', concluido: false, responsavel: 'MANUS' },
        { id: 'it-2-2', texto: 'RECEBIDO E-MAIL', concluido: false, responsavel: 'MANUS' },
        { id: 'it-2-3', texto: "RESPONDI PEDINDO CAMINHO + JOC'S", concluido: false, responsavel: 'MARCO' },
      ],
    },
    {
      id: 'col-3',
      titulo: 'DLOCAL G2:',
      subtitulo: 'Validação e fluxo cambial',
      corMarcador: 'vermelho',
      itens: [
        { id: 'it-3-1', texto: 'TABELA C/ FLUXO COMPLETO ATÉ VR EM USD NO UENO (PGTO DE U$ 9.99 DA MARBR)', concluido: false, responsavel: 'MANUS' },
        { id: 'it-3-2', texto: 'TESTAR SPLIT', concluido: false, responsavel: 'MANUS' },
        { id: 'it-3-3', texto: 'VALIDAÇÃO DA CONTA BANCÁRIA', concluido: false, responsavel: 'MARCO' },
        { id: 'it-3-4', texto: 'LIBERAÇÃO VALORES', concluido: true, responsavel: 'FINANCEIRO' },
      ],
    },
    {
      id: 'col-4',
      titulo: 'REMESSA CONFORME:',
      subtitulo: 'Correios, Jurídico e Receita Federal',
      corMarcador: 'vermelho',
      itens: [
        { id: 'it-4-1', texto: 'CRIAR GRUPO C/ JURÍDICO', concluido: false, responsavel: 'JURÍDICO' },
        { id: 'it-4-2', texto: 'PAGAR CORREIOS DZM', concluido: true, responsavel: 'FINANCEIRO' },
        { id: 'it-4-3', texto: 'ABRIR CONTA CORREIOS G2', concluido: true, responsavel: 'MANUS' },
        { id: 'it-4-4', texto: 'PROCESSO JUNTO À RFB', concluido: false, responsavel: 'JURÍDICO' },
      ],
    },
    {
      id: 'col-5',
      titulo: 'OUTUBRO / NOVEMBRO',
      subtitulo: 'Horizonte de Planejamento 2027',
      corMarcador: 'azul',
      itens: [
        { id: 'it-5-1', texto: 'INSERIR LANÇAMENTOS RECORRENTES NO OMIE P/ 2027', concluido: false, destaque: true, responsavel: 'FINANCEIRO' },
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
        { id: 'tl-1', dia: 5, descricao: '05 - PLANNIGI', concluido: false, responsavel: 'MARCO' },
        { id: 'tl-2', dia: 5, descricao: '05 - CONTÁBIL PY', concluido: false, responsavel: 'CONTÁBIL' },
        { id: 'tl-3', dia: 5, descricao: '05 - ALDO', concluido: false, responsavel: 'ALDO' },
        { id: 'tl-4', dia: 5, descricao: '05 - G2 8112', concluido: false, responsavel: 'FINANCEIRO' },
      ],
    },
    {
      id: 'blk-2',
      intervalo: '06 a 10',
      diaInicio: 6,
      diaFim: 10,
      itens: [
        { id: 'tl-5', dia: 10, descricao: '10 - COTAS YBOX', concluido: false, responsavel: 'FINANCEIRO' },
        { id: 'tl-6', dia: 10, descricao: '10 - DZM 6827', concluido: false, responsavel: 'FINANCEIRO' },
        { id: 'tl-7', dia: 10, descricao: '10 - 9693', concluido: false, responsavel: 'FINANCEIRO' },
        { id: 'tl-8', dia: 10, descricao: '10 - MBR 8583', concluido: false, responsavel: 'FINANCEIRO' },
      ],
    },
    {
      id: 'blk-3',
      intervalo: '11 a 15',
      diaInicio: 11,
      diaFim: 15,
      itens: [
        { id: 'tl-9', dia: 15, descricao: '15 - TERCEIRIZAÇÃO', concluido: false, responsavel: 'MANUS' },
      ],
    },
    {
      id: 'blk-4',
      intervalo: '16 a 20',
      diaInicio: 16,
      diaFim: 20,
      itens: [
        { id: 'tl-10', dia: 18, descricao: '18 - YBOX - SICREDI', concluido: false, responsavel: 'FINANCEIRO' },
        { id: 'tl-11', dia: 20, descricao: '20 - I.N.S.S', concluido: false, responsavel: 'FINANCEIRO' },
        { id: 'tl-12', dia: 20, descricao: '20 - PGTO / DAS', concluido: false, responsavel: 'FINANCEIRO' },
      ],
    },
    {
      id: 'blk-5',
      intervalo: '21 a 25',
      diaInicio: 21,
      diaFim: 25,
      itens: [
        { id: 'tl-13', dia: 23, descricao: '23 - MBR 0137', concluido: false, responsavel: 'FINANCEIRO' },
        { id: 'tl-14', dia: 25, descricao: '25 - NUBANK DZM', concluido: false, responsavel: 'FINANCEIRO' },
        { id: 'tl-15', dia: 25, descricao: '25 - PIS / COFINS', concluido: false, responsavel: 'FINANCEIRO' },
        { id: 'tl-16', dia: 25, descricao: '25 - MANUS / CLARA - DZM', concluido: false, responsavel: 'MANUS' },
        { id: 'tl-17', dia: 27, descricao: '27 - BANCO DO BRASIL', concluido: false, responsavel: 'FINANCEIRO' },
      ],
    },
    {
      id: 'blk-6',
      intervalo: '26 a 30/31',
      diaInicio: 26,
      diaFim: 31,
      itens: [
        { id: 'tl-18', dia: 30, descricao: '30 - TRI JAN/ABR/JUL/OUT', concluido: false, responsavel: 'FINANCEIRO' },
        { id: 'tl-19', dia: 30, descricao: '30 - DAS PARCELADA MBR', concluido: false, responsavel: 'FINANCEIRO' },
        { id: 'tl-20', dia: 30, descricao: '30 - CLARA - MBR', concluido: false, responsavel: 'CLARA' },
      ],
    },
  ],
};

export class WarRoomService {
  /**
   * Garante que a descrição do vencimento sempre contenha o dia formatado (ex: "25 - MANUS")
   * e extrai o dia correto caso o usuário tenha digitado "27 - BANCO DO BRASIL"
   */
  static formatTimelineDescription(dia: number, rawDesc: string): { dia: number; descricao: string } {
    const clean = rawDesc.trim().toUpperCase();
    let finalDia = dia;
    let finalDesc = clean;

    // Detecta se já começa com número do dia (ex: "25 - MANUS", "25 MANUS", "25: MANUS")
    const match = clean.match(/^(\d{1,2})\s*[-–—:]?\s*(.*)$/);
    if (match) {
      const parsedDia = Number(match[1]);
      if (parsedDia >= 1 && parsedDia <= 31) {
        finalDia = parsedDia;
        const rest = match[2].trim();
        finalDesc = `${String(finalDia).padStart(2, '0')} - ${rest || 'OBRIGAÇÃO'}`;
        return { dia: finalDia, descricao: finalDesc };
      }
    }

    // Se o usuário digitou apenas a obrigação (ex: "MANUS"), prefixa com o dia selecionado
    finalDesc = `${String(finalDia).padStart(2, '0')} - ${clean}`;
    return { dia: finalDia, descricao: finalDesc };
  }

  /**
   * Sanitiza e ordena cronograma garantindo prefixo do dia e ordem cronológica crescente
   */
  static sanitizeCronograma(cronograma: WhiteboardTimelineBlock[]): WhiteboardTimelineBlock[] {
    return cronograma.map(block => {
      const sanitizedItens = block.itens.map(item => {
        const { dia, descricao } = this.formatTimelineDescription(item.dia, item.descricao);
        return {
          ...item,
          dia,
          descricao,
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
    const upper = (text || '').toUpperCase();
    if (upper.includes('MANUS')) return 'MANUS';
    if (upper.includes('CLARA')) return 'CLARA';
    if (upper.includes('ALDO')) return 'ALDO';
    if (upper.includes('MARCO')) return 'MARCO';
    if (upper.includes('TERCEIRIZAÇÃO') || upper.includes('CORREIOS G2')) return 'MANUS';
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
      upper.includes('LIBERAÇÃO VALORES')
    ) {
      return 'FINANCEIRO';
    }
    if (upper.includes('JURÍDICO') || upper.includes('RFB')) return 'JURÍDICO';
    if (upper.includes('CONTÁBIL') || upper.includes('ERP')) return 'CONTÁBIL';
    return undefined;
  }

  /**
   * Obtém os dados da lousa com suporte a LocalStorage, sanitização e renovação automática mensal
   */
  static getWhiteboardData(): WhiteboardDataState {
    const hoje = new Date();
    const currentMonthKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    if (typeof window === 'undefined') {
      return {
        ...DEFAULT_WHITEBOARD_DATA,
        mesReferencia: currentMonthKey,
        cronograma: this.sanitizeCronograma(DEFAULT_WHITEBOARD_DATA.cronograma),
      };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
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

        // Hidratação/inferência de responsáveis se faltarem
        if (parsed.colunas) {
          parsed.colunas = parsed.colunas.map(col => ({
            ...col,
            itens: col.itens.map(it => ({
              ...it,
              responsavel: it.responsavel || this.inferDefaultResponsible(it.texto),
            })),
          }));
        }

        if (parsed.cronograma) {
          parsed.cronograma = this.sanitizeCronograma(parsed.cronograma).map(blk => ({
            ...blk,
            itens: blk.itens.map(it => ({
              ...it,
              responsavel: it.responsavel || this.inferDefaultResponsible(it.descricao),
            })),
          }));
          // Persiste a versão sanitizada se houve correção ou virada de mês
          this.saveWhiteboardData(parsed);
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler dados da lousa do localStorage:', e);
    }

    return {
      ...DEFAULT_WHITEBOARD_DATA,
      mesReferencia: currentMonthKey,
      cronograma: this.sanitizeCronograma(DEFAULT_WHITEBOARD_DATA.cronograma),
    };
  }

  /**
   * Grava os dados da lousa no LocalStorage
   */
  static saveWhiteboardData(data: WhiteboardDataState): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar dados da lousa:', e);
    }
  }

  /**
   * Restaura para o padrão original da lousa fotografada
   */
  static resetToDefault(): WhiteboardDataState {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error('Erro ao resetar dados da lousa:', e);
      }
    }
    return DEFAULT_WHITEBOARD_DATA;
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
   * Adiciona novo item a uma coluna
   */
  static addColumnItem(
    currentState: WhiteboardDataState,
    columnId: string,
    texto: string,
    responsavel?: string
  ): WhiteboardDataState {
    const finalResp = responsavel?.trim()
      ? responsavel.trim().toUpperCase()
      : this.inferDefaultResponsible(texto);

    const newItem = {
      id: `it-${Date.now()}`,
      texto: texto.toUpperCase(),
      concluido: false,
      responsavel: finalResp,
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
   * Exclui item de uma coluna
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
    novoResponsavel?: string
  ): WhiteboardDataState {
    const updatedColunas = currentState.colunas.map(col => {
      if (col.id !== columnId) return col;
      return {
        ...col,
        itens: col.itens.map(item => {
          if (item.id !== itemId) return item;
          const finalResp =
            novoResponsavel !== undefined
              ? (novoResponsavel ? novoResponsavel.trim().toUpperCase() : undefined)
              : (item.responsavel || this.inferDefaultResponsible(novoTexto));

          return {
            ...item,
            texto: novoTexto.trim().toUpperCase(),
            responsavel: finalResp,
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
   * Adiciona item a um bloco do cronograma com formatação automática de dia, responsável e ordenação crescente
   */
  static addTimelineItem(
    currentState: WhiteboardDataState,
    blockId: string,
    dia: number,
    descricao: string,
    responsavel?: string
  ): WhiteboardDataState {
    const formatted = this.formatTimelineDescription(dia, descricao);
    const finalResp = responsavel?.trim()
      ? responsavel.trim().toUpperCase()
      : this.inferDefaultResponsible(descricao);

    const newItem: WhiteboardTimelineItem = {
      id: `tl-${Date.now()}`,
      dia: formatted.dia,
      descricao: formatted.descricao,
      concluido: false,
      responsavel: finalResp,
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
   * Edita item de um bloco do cronograma com formatação automática de dia, responsável e re-ordenação crescente
   */
  static updateTimelineItem(
    currentState: WhiteboardDataState,
    blockId: string,
    itemId: string,
    dia: number,
    descricao: string,
    novoResponsavel?: string
  ): WhiteboardDataState {
    const formatted = this.formatTimelineDescription(dia, descricao);

    const updatedCronograma = currentState.cronograma.map(block => {
      if (block.id !== blockId) return block;
      const itens = block.itens.map(item => {
        if (item.id !== itemId) return item;
        const finalResp =
          novoResponsavel !== undefined
            ? (novoResponsavel ? novoResponsavel.trim().toUpperCase() : undefined)
            : (item.responsavel || this.inferDefaultResponsible(descricao));

        return {
          ...item,
          dia: formatted.dia,
          descricao: formatted.descricao,
          responsavel: finalResp,
        };
      });
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
}
