import { NextResponse } from 'next/server';
import axios from 'axios';
import { ClaraConfigService } from '@/services/clara/clara-config.service';

/**
 * POST /api/clara/verify-omie
 * Verifica se um lançamento de Contas a Pagar existe no Omie (validação reversa).
 * Body: { omieId: number }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const omieId = Number(body.omieId);

    if (!omieId) {
      return NextResponse.json({ status: 'error', message: 'omieId não informado.' }, { status: 400 });
    }

    const config = await ClaraConfigService.getConfig();
    const omieCreds = ClaraConfigService.getOmieCredentials(config.company_name);

    if (!omieCreds.appKey || !omieCreds.appSecret) {
      return NextResponse.json({ status: 'error', message: 'Credenciais Omie não configuradas.' }, { status: 400 });
    }

    // Busca o título pelo codigo_lancamento_omie
    const res = await axios.post(
      'https://app.omie.com.br/api/v1/financas/contapagar/',
      {
        call: 'ConsultarContaPagar',
        app_key: omieCreds.appKey,
        app_secret: omieCreds.appSecret,
        param: [{ codigo_lancamento_omie: omieId }],
      },
      { timeout: 15000 }
    );

    const data = res.data;

    // Se retornou dados do título, é um sucesso
    if (data && data.codigo_lancamento_omie) {
      return NextResponse.json({
        status: 'success',
        data: {
          codigo_lancamento_omie: data.codigo_lancamento_omie,
          codigo_lancamento_integracao: data.codigo_lancamento_integracao,
          descricao_status: data.status_titulo || '',
          valor_documento: data.valor_documento,
          data_vencimento: data.data_vencimento,
          numero_documento: data.numero_documento || '',
          observacao: data.observacao || '',
        },
        message: 'Lançamento encontrado e confirmado no Omie.',
      });
    }

    return NextResponse.json({
      status: 'error',
      message: 'Lançamento não encontrado no Omie.',
    }, { status: 404 });

  } catch (err: any) {
    const omieMsg = err.response?.data?.faultstring || err.response?.data?.message;
    const finalMsg = omieMsg || err.message || 'Erro ao consultar Omie.';

    // Se retornou faultstring, pode ser "não encontrado" — ainda assim retornamos como não-verificado
    return NextResponse.json({
      status: 'error',
      message: finalMsg,
    }, { status: 500 });
  }
}
