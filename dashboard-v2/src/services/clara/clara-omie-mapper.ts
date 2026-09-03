import crypto from 'crypto';
import { 
  ClaraTransactionRecord, 
  ClaraRawTransaction, 
  OmieLancCCPayload, 
  OmieAnexoPayload,
  ClaraConfig 
} from '@/types/clara.types';

export class ClaraOmieMapper {
  /**
   * Gera identificador único e determinístico para o campo cCodIntLanc do Omie.
   * O Omie aceita até 20 caracteres. Usamos prefixo 'CL' + 18 caracteres de SHA-256(clara_uuid).
   * O mesmo clara_uuid sempre produzirá exatamente o mesmo cCodIntLanc.
   */
  public static generateOmieIntegrationId(claraUuid: string): string {
    if (!claraUuid) {
      throw new Error('UUID da Clara é obrigatório para gerar cCodIntLanc.');
    }
    const hash = crypto.createHash('sha256').update(claraUuid.trim().toLowerCase()).digest('hex');
    return `CL${hash.substring(0, 18).toUpperCase()}`;
  }

  /**
   * Centraliza a convenção de valores e sinais monetários para o Omie.
   * Para lançamentos tipo Cartão de Crédito (cTipo: 'CRT') no Omie:
   * - PURCHASE: valor positivo (R$ > 0).
   * - REFUND / CREDIT: valor positivo ou negativo conforme classificação de estorno.
   */
  public static getOmieTransactionAmount(tx: ClaraTransactionRecord | ClaraRawTransaction): number {
    const rawVal = typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount || 0));
    const val = Math.abs(rawVal);
    return Math.round(val * 100) / 100;
  }

  /**
   * Converte data ISO (YYYY-MM-DD...) para o formato estrito do Omie (DD/MM/AAAA).
   */
  public static formatDateToOmie(isoDate?: string | null): string {
    if (!isoDate) {
      const now = new Date();
      return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }

    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) {
        // Se já for DD/MM/AAAA, retorna direto
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoDate)) return isoDate;
        // Tenta separar por -
        const parts = isoDate.split('T')[0].split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      const now = new Date();
      return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }
  }

  /**
   * Monta a observação estruturada para o lançamento do Omie (cObs).
   */
  public static buildOmieObservation(tx: ClaraTransactionRecord): string {
    const merchant = tx.merchant_name?.trim() || 'Estabelecimento Desconhecido';
    const last4 = tx.card_last_digits ? `****${tx.card_last_digits}` : 'N/A';
    const user = tx.user_name?.trim() || 'Portador Não Informado';
    const auth = tx.authorization_number ? `Auth ${tx.authorization_number}` : '';
    const uuid = tx.clara_uuid;

    const base = `CLARA | ${merchant} | Cartão ${last4} | ${user}`;
    const withAuth = auth ? `${base} | ${auth}` : base;
    const full = `${withAuth} | UUID: ${uuid}`;

    // Limita a 500 caracteres para garantir compatibilidade com o campo cObs do Omie
    return full.length > 500 ? full.substring(0, 497) + '...' : full;
  }

  /**
   * Constrói o payload completo para a call IncluirLancCC no Omie.
   */
  public static buildOmieLancamentoPayload(
    tx: ClaraTransactionRecord,
    nCodCC: number,
    categoryCode: string,
    departmentCode?: string | null,
    projectCode?: string | null
  ): OmieLancCCPayload {
    if (!nCodCC) {
      throw new Error('Conta Corrente da Clara (nCodCC) não definida na configuração.');
    }
    if (!categoryCode) {
      throw new Error(`Categoria Omie não definida para a transação ${tx.clara_uuid}.`);
    }

    const dDtLanc = this.formatDateToOmie(tx.operation_date);
    const nValorLanc = this.getOmieTransactionAmount(tx);
    const cCodIntLanc = tx.omie_integration_id || this.generateOmieIntegrationId(tx.clara_uuid);
    const cNumDoc = tx.authorization_number || tx.clara_uuid.substring(0, 20);
    const cObs = this.buildOmieObservation(tx);

    const payload: OmieLancCCPayload = {
      cCodIntLanc,
      cabecalho: {
        nCodCC,
        dDtLanc,
        nValorLanc,
      },
      detalhes: {
        cCodCateg: categoryCode,
        cTipo: 'CRT', // Cartão de Crédito
        cNumDoc,
        cObs,
      },
    };

    const proj = projectCode || tx.omie_project_code;
    if (proj && !isNaN(Number(proj))) {
      payload.detalhes.nCodProjeto = Number(proj);
    }

    if (departmentCode && departmentCode.trim()) {
      payload.departamentos = [
        {
          cCodDep: departmentCode.trim(),
          nPerDep: 100,
        },
      ];
    }

    return payload;
  }

  /**
   * Constrói o payload para a call IncluirAnexo no Omie.
   */
  public static buildOmieAnexoPayload(
    nCodLanc: number,
    fileName: string,
    base64Content: string
  ): OmieAnexoPayload {
    const cMd5 = crypto.createHash('md5').update(base64Content).digest('hex');

    return {
      cTabela: 'conta-corrente-lancamento',
      nId: nCodLanc,
      cNomeArquivo: fileName || 'comprovante_clara.pdf',
      cArquivo: base64Content,
      cMd5,
    };
  }
}
