import { NextResponse } from 'next/server';
import { ClaraOcrService } from '@/services/clara/clara-ocr.service';
import { ClaraStorageService } from '@/services/clara/clara-storage.service';
import { DEFAULT_CLARA_CONFIG, DEFAULT_CLARA_CONFIG_DZM } from '@/services/clara/clara-config.service';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { uuids, onlyPending = true, companyCnpj, companyName, companyId } = body;

    const compId = companyId || (companyName?.toLowerCase().includes('dzm') ? 'dzm' : 'marbrasil');
    const isDZM = compId.toLowerCase().includes('dzm');
    const defaultConfig = isDZM ? DEFAULT_CLARA_CONFIG_DZM : DEFAULT_CLARA_CONFIG;

    const config = await ClaraStorageService.getConfig(defaultConfig, isDZM ? 'dzm' : 'marbrasil');
    const state = await ClaraStorageService.getState(config);
    const allTransactions = Object.values(state.transactions || {});

    // Filtra transações a auditar
    let targetTransactions = allTransactions;

    if (Array.isArray(uuids) && uuids.length > 0) {
      const set = new Set(uuids);
      targetTransactions = allTransactions.filter(t => set.has(t.clara_uuid) || set.has(t.id));
    } else if (onlyPending) {
      // Pega todas as que possuem anexos e estão com status PENDING ou NOT_FOUND
      targetTransactions = allTransactions.filter(
        t => (t.has_attachments || (t.attachments_count && t.attachments_count > 0)) &&
             (!t.cnpj_match_status || t.cnpj_match_status === 'PENDING' || t.cnpj_match_status === 'NOT_FOUND')
      );
    }

    // Apenas as que de fato possuem anexos
    targetTransactions = targetTransactions.filter(
      t => Boolean(t.has_attachments || (t.attachments_count && t.attachments_count > 0) || ((t.raw_payload?.documents?.length ?? 0) > 0))
    );

    if (targetTransactions.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'Nenhum lançamento com comprovante pendente de auditoria fiscal.',
        data: {
          total: 0,
          processed: 0,
          matches: 0,
          divergent: 0,
          notFound: 0,
          errors: 0,
          updatedTransactions: [],
        },
      });
    }

    const targetCnpj = companyCnpj || config.active_company_cnpj || '02.233.923/0001-19';
    const targetName = companyName || config.active_company_name || 'Mar Brasil';

    // Dispara auditoria concorrente
    const result = await ClaraOcrService.processBatchOcr(
      targetTransactions,
      config,
      targetCnpj,
      targetName,
      3 // Concorrência de 3 por vez
    );

    return NextResponse.json({
      status: 'success',
      message: `Auditoria fiscal concluída: ${result.processed} comprovantes processados (${result.matches} compatíveis, ${result.divergent} divergentes, ${result.errors} erros).`,
      data: result,
    });
  } catch (error: any) {
    console.error('Erro na rota /api/clara/ocr/batch:', error);
    return NextResponse.json({
      status: 'error',
      message: `Erro ao processar auditoria fiscal em lote: ${error.message}`,
    }, { status: 500 });
  }
}
