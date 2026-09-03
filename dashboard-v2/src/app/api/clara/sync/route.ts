import { NextResponse } from 'next/server';
import { ClaraSyncService } from '@/services/clara/clara-sync.service';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const trigger = body.trigger || 'MANUAL';
    const forceSafeMode = body.forceSafeMode !== undefined ? Boolean(body.forceSafeMode) : undefined;
    const forceFullSync = Boolean(body.forceFullSync);
    const companyId = body.companyId || body.company || 'marbrasil';
    const companyName = body.companyName;

    const summary = await ClaraSyncService.syncClaraTransactions({
      trigger,
      forceSafeMode,
      forceFullSync,
      companyId,
      companyName,
    });

    return NextResponse.json({
      status: 'success',
      data: summary,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro durante a sincronização.',
    }, { status: 500 });
  }
}
