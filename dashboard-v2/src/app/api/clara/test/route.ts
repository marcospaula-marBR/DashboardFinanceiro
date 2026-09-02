import { NextResponse } from 'next/server';
import { ClaraConfigService } from '@/services/clara/clara-config.service';
import { ClaraClient } from '@/services/clara/clara-client';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const current = await ClaraConfigService.getConfig();

    const configToTest = {
      ...current,
      ...body,
      client_secret: (!body.client_secret || body.client_secret.includes('••')) ? current.client_secret : body.client_secret,
      certificate_pem: (!body.certificate_pem || body.certificate_pem.includes('••')) ? current.certificate_pem : body.certificate_pem,
      private_key_pem: (!body.private_key_pem || body.private_key_pem.includes('••')) ? current.private_key_pem : body.private_key_pem,
    };

    if (!configToTest.client_id || !configToTest.client_secret) {
      return NextResponse.json({
        status: 'error',
        message: 'Preencha o Client ID e Client Secret antes de testar a conexão.',
      }, { status: 400 });
    }

    const client = new ClaraClient(configToTest);
    const result = await client.testConnection();

    // Atualiza status do último teste na configuração
    await ClaraConfigService.saveConfig({
      last_connection_test: new Date().toISOString(),
      last_connection_status: result.success ? 'SUCCESS' : 'ERROR',
      last_connection_message: result.message,
    });

    return NextResponse.json({
      status: result.success ? 'success' : 'error',
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro inesperado ao testar conexão.',
    }, { status: 500 });
  }
}
