import axios, { AxiosInstance } from 'axios';
import { ClaraConfig, ClaraRawTransaction, ClaraDocument } from '@/types/clara.types';
import { ClaraAuthService } from './clara-auth.service';

export interface GetTransactionsParams {
  lastUpdateDateRangeStart?: string; // ISO string
  lastUpdateDateRangeEnd?: string;   // ISO string
  page?: number;
  size?: number;
}

export class ClaraClient {
  private config: ClaraConfig;
  private baseUrl: string;

  constructor(config: ClaraConfig) {
    this.config = config;
    this.baseUrl = config.base_url?.replace(/\/+$/, '') || 'https://public-api.br.clara.com';
  }

  /**
   * Executa requisição HTTP autenticada à API Clara com retry automático único em caso de 401
   */
  private async request<T = any>(method: 'GET' | 'POST' | 'PUT', path: string, data?: any, params?: any): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const agent = ClaraAuthService.createHttpsAgent(this.config);

    const execute = async (forceRefresh = false) => {
      const token = await ClaraAuthService.getAccessToken(this.config, forceRefresh);
      return axios({
        method,
        url,
        data,
        params,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        httpsAgent: agent,
        timeout: 30000,
      });
    };

    try {
      const response = await execute(false);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Invalida e tenta novamente uma única vez com novo token
        ClaraAuthService.invalidateToken();
        const retryResponse = await execute(true);
        return retryResponse.data;
      }
      const status = error.response?.status;
      const data = error.response?.data;
      const msg = data?.message || data?.error || error.message;
      throw new Error(`Erro API Clara [${method} ${path}] (${status || 'REDE'}): ${msg}`);
    }
  }

  /**
   * Testa a conexão com a Clara obtendo um token e executando uma consulta teste
   */
  public async testConnection(): Promise<{ success: boolean; message: string; sampleTransactionsCount?: number }> {
    try {
      const token = await ClaraAuthService.getAccessToken(this.config, true);
      if (!token) {
        return { success: false, message: 'Não foi possível obter o token de acesso.' };
      }

      // Faz uma consulta de 1 registro para validar permissões de leitura
      const data = await this.request('GET', '/api/v3/transactions', undefined, { page: 1, size: 1 });
      const items = data.content || data.data || data.transactions || data.items || [];
      const total = data.totalElements ?? data.total ?? items.length;

      return {
        success: true,
        message: 'Conexão e autenticação com a Clara realizadas com sucesso!',
        sampleTransactionsCount: total,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Falha desconhecida ao conectar com a Clara.',
      };
    }
  }

  /**
   * Busca todas as páginas de transações da Clara dentro do filtro de datas
   */
  public async getAllTransactions(params: GetTransactionsParams = {}): Promise<ClaraRawTransaction[]> {
    const size = params.size || 100;
    let page = params.page || 1;
    let allTransactions: ClaraRawTransaction[] = [];
    let hasMore = true;
    const MAX_PAGES = 50; // Limite de segurança para 5.000 transações por execução

    while (hasMore && page <= MAX_PAGES) {
      const queryParams: Record<string, any> = {
        page,
        size,
      };

      if (params.lastUpdateDateRangeStart) {
        queryParams.lastUpdateDateRangeStart = params.lastUpdateDateRangeStart;
      }
      if (params.lastUpdateDateRangeEnd) {
        queryParams.lastUpdateDateRangeEnd = params.lastUpdateDateRangeEnd;
      }

      const response = await this.request('GET', '/api/v3/transactions', undefined, queryParams);

      const items: ClaraRawTransaction[] = 
        response.content ||
        response.data || 
        response.transactions || 
        response.items || 
        (Array.isArray(response) ? response : []);

      if (items.length > 0) {
        allTransactions.push(...items);
        
        // Verifica se há mais páginas
        const totalPages = response.totalPages || response.pages;
        if (totalPages !== undefined) {
          hasMore = page < totalPages;
        } else {
          hasMore = items.length === size;
        }
        page++;
      } else {
        hasMore = false;
      }
    }

    return allTransactions;
  }

  /**
   * Busca documentos / comprovantes anexados a uma transação específica
   */
  public async getTransactionDocuments(transactionUuid: string): Promise<ClaraDocument[]> {
    try {
      const response = await this.request('GET', `/api/v3/transactions/${transactionUuid}/documents`);
      const docs: ClaraDocument[] = 
        response.data || 
        response.documents || 
        (Array.isArray(response) ? response : []);
      return docs;
    } catch (error: any) {
      console.warn(`[ClaraClient] Não foi possível consultar documentos para ${transactionUuid}:`, error.message);
      return [];
    }
  }

  /**
   * Faz o download do binário de um comprovante e retorna o conteúdo em base64 para envio ao Omie
   */
  public async downloadDocumentAsBase64(documentUrl: string): Promise<{ base64: string; fileName: string; mimeType: string }> {
    const agent = ClaraAuthService.createHttpsAgent(this.config);
    const token = await ClaraAuthService.getAccessToken(this.config);

    const isFullUrl = documentUrl.startsWith('http://') || documentUrl.startsWith('https://');
    const targetUrl = isFullUrl ? documentUrl : `${this.baseUrl}${documentUrl.startsWith('/') ? documentUrl : `/${documentUrl}`}`;

    const res = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      httpsAgent: agent,
      timeout: 30000,
    });

    const buffer = Buffer.from(res.data);
    const base64 = buffer.toString('base64');
    const rawContentType = res.headers['content-type'];
    const mimeType = typeof rawContentType === 'string' ? rawContentType : 'application/pdf';
    
    // Extrai nome do arquivo dos headers ou URL
    let fileName = 'comprovante.pdf';
    const rawDisposition = res.headers['content-disposition'];
    const contentDisposition = typeof rawDisposition === 'string' ? rawDisposition : '';
    if (contentDisposition && contentDisposition.includes('filename=')) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) fileName = match[1];
    } else {
      const urlPath = new URL(targetUrl).pathname;
      const lastSegment = urlPath.split('/').pop();
      if (lastSegment && lastSegment.includes('.')) fileName = lastSegment;
    }

    return { base64, fileName, mimeType };
  }
}
