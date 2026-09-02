import https from 'https';
import axios from 'axios';
import { ClaraConfig } from '@/types/clara.types';

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Timestamp em milissegundos
}

let tokenCache: CachedToken | null = null;

export class ClaraAuthService {
  /**
  /**
   * Normaliza strings PEM removendo barras invertidas literais e aspas
   */
  public static normalizePem(pem?: string): string {
    if (!pem) return '';
    let cleaned = pem.trim();
    // Converte \n literal para quebra de linha real
    if (cleaned.includes('\\n')) {
      cleaned = cleaned.replace(/\\n/g, '\n');
    }
    // Remove aspas nas pontas
    cleaned = cleaned.replace(/^["']|["']$/g, '');
    // Tratamento para digitação acidental em quebra de linha
    if (cleaned.includes('nnRB/QbS7')) {
      cleaned = cleaned.replace('nnRB/QbS7', 'nRB/QbS7');
    }
    return cleaned;
  }

  /**
   * Cria um https.Agent com mTLS configurado se os certificados existirem
   */
  public static createHttpsAgent(config: ClaraConfig): https.Agent {
    const cert = this.normalizePem(config.certificate_pem);
    const key = this.normalizePem(config.private_key_pem);

    if (cert && key) {
      return new https.Agent({
        cert,
        key,
        rejectUnauthorized: false,
        keepAlive: true,
      });
    }

    // Fallback padrão se mTLS for administrado por proxy/gateway externo
    return new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true,
    });
  }

  /**
   * Obtém token de acesso da Clara com cache e renovação automática
   */
  public static async getAccessToken(config: ClaraConfig, forceRefresh = false): Promise<string> {
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;

    // Reutiliza o token em cache se for válido por pelo menos mais 5 minutos
    if (!forceRefresh && tokenCache && tokenCache.expiresAt - now > FIVE_MINUTES) {
      return tokenCache.accessToken;
    }

    const clientId = config.client_id?.trim();
    const clientSecret = config.client_secret?.trim();
    const baseUrl = config.base_url?.replace(/\/+$/, '') || 'https://public-api.br.clara.com';

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais da Clara incompletas: client_id e client_secret são obrigatórios.');
    }

    const agent = this.createHttpsAgent(config);

    try {
      // Endpoint OAuth 2.0 Clara Brasil com Basic Auth
      const tokenUrl = `${baseUrl}/oauth/token`;
      const basicAuth = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      
      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
        }).toString(),
        {
          headers: {
            'Authorization': basicAuth,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          httpsAgent: agent,
          timeout: 15000,
        }
      );

      const data = response.data;
      const token = data.access_token || data.token;
      const expiresIn = Number(data.expires_in) || 3600; // Segundos (padrão 1h)

      if (!token) {
        throw new Error('Resposta da Clara não continha um access_token válido.');
      }

      tokenCache = {
        accessToken: token,
        expiresAt: now + expiresIn * 1000,
      };

      return token;
    } catch (error: any) {
      tokenCache = null;
      const status = error.response?.status;
      const data = error.response?.data;
      const errMsg = data?.error_description || data?.message || error.message;
      throw new Error(`Falha na autenticação com a Clara (${status || 'REDE'}): ${errMsg}`);
    }
  }

  /**
   * Invalida o token em cache manualmente (ex: após 401)
   */
  public static invalidateToken(): void {
    tokenCache = null;
  }
}
