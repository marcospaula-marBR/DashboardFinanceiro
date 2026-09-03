import { NextResponse } from 'next/server';
import { ClaraSyncService } from '@/services/clara/clara-sync.service';
import { ClaraStorageService } from '@/services/clara/clara-storage.service';
import { ClaraOmieMapper } from '@/services/clara/clara-omie-mapper';
import { DEFAULT_CLARA_CONFIG } from '@/services/clara/clara-config.service';
import { supabase } from '@/lib/supabase';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'retry'; // retry, sync, ignore

    if (action === 'ignore') {
      try {
        await supabase
          .from('clara_transactions')
          .update({ sync_status: 'IGNORED', updated_at: new Date().toISOString() })
          .or(`id.eq.${id},clara_uuid.eq.${id}`);
      } catch (e: any) {
        console.warn('[API Clara ignore] Erro no Supabase:', e.message);
      }
      return NextResponse.json({ status: 'success', message: 'Transação marcada como ignorada.' });
    }

    if (action === 'update') {
      const updated = await ClaraSyncService.updateTransactionFields(id, {
        omie_category_code: body.omie_category_code,
        omie_department_code: body.omie_department_code,
        omie_project_code: body.omie_project_code,
      });
      return NextResponse.json({
        status: 'success',
        data: updated,
        message: 'Campos atualizados com sucesso!',
      });
    }

    if (action === 'force_resync') {
      // 1. Limpa memoryState e Supabase JSON
      await ClaraStorageService.resetTransactionForResync(id, DEFAULT_CLARA_CONFIG);

      // 2. Limpa também na tabela clara_transactions (se existir) com novo ID único de integração
      try {
        const freshIntegrationId = ClaraOmieMapper.generateOmieContaPagarIntegrationId(id, Date.now());
        await supabase
          .from('clara_transactions')
          .update({
            omie_launch_id: null,
            omie_account_id: null,
            omie_integration_id: freshIntegrationId,
            attachments_synced: false,
            sync_status: 'READY',
            last_sync_error: null,
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${id},clara_uuid.eq.${id}`);
      } catch (e: any) {
        console.warn('[API Clara force_resync] Aviso Supabase clara_transactions:', e.message);
      }

      // 3. Executa o retry (irá encontrar omie_launch_id=null e criar no ContaPagar)
      const resynced = await ClaraSyncService.retryTransaction(id);
      return NextResponse.json({
        status: 'success',
        data: resynced,
        message: resynced.omie_launch_id
          ? `Migrado com sucesso para Contas a Pagar! ID Omie: #${resynced.omie_launch_id}`
          : 'Processado — verifique o status.',
      });
    }

    // Ação de retry / sincronização pontual
    const updated = await ClaraSyncService.retryTransaction(id);

    return NextResponse.json({
      status: 'success',
      data: updated,
      message: updated.sync_status === 'SYNCED' 
        ? 'Transação sincronizada com sucesso no Omie!'
        : 'Transação processada com status: ' + updated.sync_status,
    });
  } catch (error: any) {
    const omieFault = error.response?.data?.faultstring;
    const axiosMsg = error.response?.data?.message || error.response?.data?.error;
    const finalMsg = omieFault || axiosMsg || error.message || 'Erro ao processar transação.';
    return NextResponse.json({
      status: 'error',
      message: finalMsg,
    }, { status: 500 });
  }
}
