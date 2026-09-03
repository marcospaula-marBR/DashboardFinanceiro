import crypto from 'crypto';
import zlib from 'zlib';
import { 
  ClaraTransactionRecord, 
  ClaraRawTransaction, 
  OmieLancCCPayload, 
  OmieAnexoPayload,
  ClaraConfig 
} from '@/types/clara.types';

export class ClaraOmieMapper {
  /**
   * Empacota um buffer de arquivo em formato ZIP padrão (exigência estrita da API IncluirAnexo do Omie).
   */
  public static createZipBuffer(fileName: string, fileBuffer: Buffer): Buffer {
    const fileNameBuffer = Buffer.from(fileName, 'utf-8');
    const compressedData = zlib.deflateRawSync(fileBuffer);
    
    // Cálculo CRC32
    const crcTable: number[] = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[i] = c;
    }
    let crc = 0 ^ (-1);
    for (let i = 0; i < fileBuffer.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ fileBuffer[i]) & 0xFF];
    }
    crc = (crc ^ (-1)) >>> 0;

    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    // Local file header (30 bytes + filename + compressed data)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8
    localHeader.writeUInt16LE(8, 8);      // Deflate
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(fileBuffer.length, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localFileRecord = Buffer.concat([localHeader, fileNameBuffer, compressedData]);

    // Central directory header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedData.length, 20);
    centralHeader.writeUInt32LE(fileBuffer.length, 24);
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(0, 42); // Offset 0

    const centralDirRecord = Buffer.concat([centralHeader, fileNameBuffer]);

    // End of central directory record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(centralDirRecord.length, 12);
    eocd.writeUInt32LE(localFileRecord.length, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([localFileRecord, centralDirRecord, eocd]);
  }
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
   * O Omie exige que o cArquivo seja o Base64 de um arquivo .ZIP contendo o arquivo real com cNomeArquivo dentro.
   */
  public static buildOmieAnexoPayload(
    nCodLanc: number,
    fileName: string,
    fileBufferOrBase64: Buffer | string
  ): OmieAnexoPayload {
    const rawBuffer = Buffer.isBuffer(fileBufferOrBase64)
      ? fileBufferOrBase64
      : Buffer.from(fileBufferOrBase64, 'base64');

    const cleanName = fileName || 'comprovante_clara.pdf';
    const zipBuffer = this.createZipBuffer(cleanName, rawBuffer);
    const zipBase64 = zipBuffer.toString('base64');
    const cMd5 = crypto.createHash('md5').update(zipBase64).digest('hex');

    return {
      cTabela: 'conta-corrente-lancamento',
      nId: nCodLanc,
      cNomeArquivo: cleanName,
      cArquivo: zipBase64,
      cMd5,
    };
  }
}
