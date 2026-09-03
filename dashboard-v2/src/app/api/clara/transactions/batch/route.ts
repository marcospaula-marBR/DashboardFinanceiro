import { NextResponse } from 'next/server';
import { ClaraSyncService } from '@/services/clara/clara-sync.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action; // 'sync' | 'update_fields'
    const uuids: string[] = body.uuids || [];

    if (!Array.isArray(uuids) || uuids.length === 0) {
      return NextResponse.json({
        status: 'error',
        message: 'Nenhuma transação selecionada para ação em lote.',
      }, { status: 400 });
    }

    if (action === 'update_fields') {
      const { 
        omie_category_code, 
        omie_department_code, 
        omie_project_code,
        registration_date,
        due_date 
      } = body;
      const updatedList = [];

      for (const uuid of uuids) {
        try {
          const u = await ClaraSyncService.updateTransactionFields(uuid, {
            omie_category_code,
            omie_department_code,
            omie_project_code,
            registration_date,
            due_date,
          });
          updatedList.push(u);
        } catch (e: any) {
          console.warn(`[Batch Update] Erro ao atualizar ${uuid}:`, e.message);
        }
      }

      return NextResponse.json({
        status: 'success',
        message: `${updatedList.length} transações atualizadas em lote com sucesso!`,
        data: { updatedCount: updatedList.length },
      });
    }

    if (action === 'sync') {
      const result = await ClaraSyncService.syncSelectedTransactions(uuids);
      return NextResponse.json({
        status: 'success',
        message: `${result.success} de ${result.total} transações processadas com sucesso para o Omie.`,
        data: result,
      });
    }

    return NextResponse.json({
      status: 'error',
      message: 'Ação em lote inválida. Use "sync" ou "update_fields".',
    }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao processar lote de transações.',
    }, { status: 500 });
  }
}
