import { NextResponse } from 'next/server';
import { ClaraSyncService } from '@/services/clara/clara-sync.service';
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
