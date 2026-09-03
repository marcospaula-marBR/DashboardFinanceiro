import { NextResponse } from 'next/server';
import { ClaraConfigService } from '@/services/clara/clara-config.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || 'marbrasil';
    const config = await ClaraConfigService.getConfig(companyId);
    // Sanitiza dados sensíveis antes de enviar ao frontend
    const sanitized = {
      ...config,
      client_secret_masked: config.client_secret ? '••••••••••••••••' : '',
      has_certificate: Boolean(config.certificate_pem),
      has_private_key: Boolean(config.private_key_pem),
      // Não envia a chave privada integralmente para o client
      private_key_pem: undefined,
    };
    return NextResponse.json({ status: 'success', data: sanitized });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyId = body.active_company_id || body.companyId || 'marbrasil';
    const current = await ClaraConfigService.getConfig(companyId);

    // Se o client enviou máscara ou campo vazio onde já havia secret, preserva o valor atual
    const toSave = {
      ...body,
      client_secret: (!body.client_secret || body.client_secret.includes('••')) ? current.client_secret : body.client_secret,
      certificate_pem: (!body.certificate_pem || body.certificate_pem.includes('••')) ? current.certificate_pem : body.certificate_pem,
      private_key_pem: (!body.private_key_pem || body.private_key_pem.includes('••')) ? current.private_key_pem : body.private_key_pem,
    };

    const saved = await ClaraConfigService.saveConfig(toSave, companyId);
    return NextResponse.json({ 
      status: 'success', 
      message: 'Configuração salva com sucesso!',
      data: {
        ...saved,
        client_secret_masked: saved.client_secret ? '••••••••••••••••' : '',
        has_certificate: Boolean(saved.certificate_pem),
        has_private_key: Boolean(saved.private_key_pem),
        private_key_pem: undefined,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
