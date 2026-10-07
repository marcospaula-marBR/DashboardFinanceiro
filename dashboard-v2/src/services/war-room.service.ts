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
        { id: 'it-1-1', texto: 'JUSTIFICAR DEPÓSITOS CONTA PESSOAL;', concluido: false },
        { id: 'it-1-2', texto: 'ANALISAR MELHOR OPÇÃO P/ EMPRÉSTIMOS FEITOS PY (CONTABILIDADE + ALDO)', concluido: false },
        { id: 'it-1-3', texto: 'FLUXO DLOCAL => UENO: COMO JUSTIFICAR?*', concluido: false, destaque: true },
        { id: 'it-1-4', texto: 'DOMÍNIOS NIC.PY', concluido: true },
        { id: 'it-1-5', texto: 'ERP PY', concluido: false },
      ],
    },
    {
      id: 'col-2',
      titulo: 'PAGOPAR CONTA G2:',
      subtitulo: 'Gateway e integração Paraguai',
      alertaDestaque: '* SUSPENSAS NOVAS CONTAS',
      corMarcador: 'vermelho',
      itens: [
        { id: 'it-2-1', texto: 'MSG ENVIADA', concluido: false },
        { id: 'it-2-2', texto: 'RECEBIDO E-MAIL', concluido: false },
        { id: 'it-2-3', texto: "RESPONDI PEDINDO CAMINHO + JOC'S", concluido: false },
      ],
    },
    {
      id: 'col-3',
      titulo: 'DLOCAL G2:',
      subtitulo: 'Validação e fluxo cambial',
      corMarcador: 'vermelho',
      itens: [
        { id: 'it-3-1', texto: 'TABELA C/ FLUXO COMPLETO ATÉ VR EM USD NO UENO (PGTO DE U$ 9.99 DA MARBR)', concluido: false },
        { id: 'it-3-2', texto: 'TESTAR SPLIT', concluido: false },
        { id: 'it-3-3', texto: 'VALIDAÇÃO DA CONTA BANCÁRIA', concluido: false },
        { id: 'it-3-4', texto: 'LIBERAÇÃO VALORES', concluido: true },
      ],
    },
    {
      id: 'col-4',
      titulo: 'REMESSA CONFORME:',
      subtitulo: 'Correios, Jurídico e Receita Federal',
      corMarcador: 'vermelho',
      itens: [
        { id: 'it-4-1', texto: 'CRIAR GRUPO C/ JURÍDICO', concluido: false },
        { id: 'it-4-2', texto: 'PAGAR CORREIOS DZM', concluido: true },
        { id: 'it-4-3', texto: 'ABRIR CONTA CORREIOS G2', concluido: true },
        { id: 'it-4-4', texto: 'PROCESSO JUNTO À RFB', concluido: false },
      ],
    },
    {
      id: 'col-5',
      titulo: 'OUTUBRO / NOVEMBRO',
      subtitulo: 'Horizonte de Planejamento 2027',
      corMarcador: 'azul',
      itens: [
        { id: 'it-5-1', texto: 'INSERIR LANÇAMENTOS RECORRENTES NO OMIE P/ 2027', concluido: false, destaque: true },
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
        { id: 'tl-1', dia: 5, descricao: '05 - PLANNIGI', concluido: false },
        { id: 'tl-2', dia: 5, descricao: '05 - CONTÁBIL PY', concluido: false },
        { id: 'tl-3', dia: 5, descricao: '05 - ALDO', concluido: false },
        { id: 'tl-4', dia: 5, descricao: '05 - G2 8112', concluido: false },
      ],
    },
    {
      id: 'blk-2',
      intervalo: '06 a 10',
      diaInicio: 6,
      diaFim: 10,
      itens: [
        { id: 'tl-5', dia: 10, descricao: '10 - COTAS YBOX', concluido: false },
        { id: 'tl-6', dia: 10, descricao: '10 - DZM 6827', concluido: false },
        { id: 'tl-7', dia: 10, descricao: '10 - 9693', concluido: false },
        { id: 'tl-8', dia: 10, descricao: '10 - MBR 8583', concluido: false },
      ],
    },
    {
      id: 'blk-3',
      intervalo: '11 a 15',
      diaInicio: 11,
      diaFim: 15,
      itens: [
        { id: 'tl-9', dia: 15, descricao: '15 - TERCEIRIZAÇÃO', concluido: false },
      ],
    },
    {
      id: 'blk-4',
      intervalo: '16 a 20',
      diaInicio: 16,
      diaFim: 20,
      itens: [
        { id: 'tl-10', dia: 18, descricao: '18 - YBOX - SICREDI', concluido: false },
        { id: 'tl-11', dia: 20, descricao: '20 - I.N.S.S', concluido: false },
        { id: 'tl-12', dia: 20, descricao: '20 - PGTO / DAS', concluido: false },
      ],
    },
    {
      id: 'blk-5',
      intervalo: '21 a 25',
      diaInicio: 21,
      diaFim: 25,
      itens: [
        { id: 'tl-13', dia: 23, descricao: '23 - MBR 0137', concluido: false },
        { id: 'tl-14', dia: 25, descricao: '25 - NUBANK DZM', concluido: false },
        { id: 'tl-15', dia: 25, descricao: '25 - PIS / COFINS', concluido: false },
        { id: 'tl-16', dia: 25, descricao: '25 - MANUS / CLARA - DZM', concluido: false },
        { id: 'tl-17', dia: 27, descricao: '27 - BANCO DO BRASIL', concluido: false },
      ],
    },
    {
      id: 'blk-6',
      intervalo: '26 a 30/31',
      diaInicio: 26,
      diaFim: 31,
      itens: [
        { id: 'tl-18', dia: 30, descricao: '30 - TRI JAN/ABR/JUL/OUT', concluido: false },
        { id: 'tl-19', dia: 30, descricao: '30 - DAS PARCELADA MBR', concluido: false },
        { id: 'tl-20', dia: 30, descricao: '30 - CLARA - MBR', concluido: false },
      ],
    },
  ],
};

export class WarRoomService {
  /**
   * Obtém os dados da lousa com suporte a LocalStorage
   */
  static getWhiteboardData(): WhiteboardDataState {
    if (typeof window === 'undefined') return DEFAULT_WHITEBOARD_DATA;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Erro ao ler dados da lousa do localStorage:', e);
    }

    return DEFAULT_WHITEBOARD_DATA;
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
    texto: string
  ): WhiteboardDataState {
    const newItem = {
      id: `it-${Date.now()}`,
      texto: texto.toUpperCase(),
      concluido: false,
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
   * Adiciona item a um bloco do cronograma
   */
  static addTimelineItem(
    currentState: WhiteboardDataState,
    blockId: string,
    dia: number,
    descricao: string
  ): WhiteboardDataState {
    const newItem: WhiteboardTimelineItem = {
      id: `tl-${Date.now()}`,
      dia,
      descricao: descricao.toUpperCase(),
      concluido: false,
    };

    const updatedCronograma = currentState.cronograma.map(block => {
      if (block.id !== blockId) return block;
      return {
        ...block,
        itens: [...block.itens, newItem],
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
}
