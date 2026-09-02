import { NextResponse } from 'next/server';
import { ClaraConfigService } from '@/services/clara/clara-config.service';
import { ClaraClient } from '@/services/clara/clara-client';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await ClaraConfigService.getConfig();
    const claraClient = new ClaraClient(config);

    const docs = await claraClient.getTransactionDocuments(id);

    return NextResponse.json({
      status: 'success',
      data: docs || [],
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao carregar anexos da transação.',
    }, { status: 500 });
  }
}
