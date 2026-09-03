import { NextResponse } from 'next/server';
import { ClaraSyncService } from '@/services/clara/clara-sync.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
    const search = searchParams.get('search') || '';
    const syncStatus = searchParams.get('syncStatus') || 'ALL';
    const claraStatus = searchParams.get('claraStatus') || 'ALL';
    const transactionType = searchParams.get('transactionType') || 'ALL';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const companyId = searchParams.get('companyId') || undefined;

    const [txResult, metrics] = await Promise.all([
      ClaraSyncService.getTransactions({
        page,
        pageSize,
        search,
        syncStatus,
        claraStatus,
        transactionType,
        startDate,
        endDate,
        companyId,
      }),
      ClaraSyncService.getMetrics(companyId),
    ]);

    return NextResponse.json({
      status: 'success',
      data: {
        transactions: txResult.transactions,
        total: txResult.total,
        page,
        pageSize,
        metrics,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao carregar transações.',
    }, { status: 500 });
  }
}
