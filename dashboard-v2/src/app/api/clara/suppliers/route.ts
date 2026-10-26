import { NextResponse } from 'next/server';
import { ClaraConfigService } from '@/services/clara/clara-config.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get('company') || 'Mar Brasil';
    const q = searchParams.get('q') || '';

    if (!q.trim()) {
      const suppliers = await ClaraConfigService.getOmieSuppliers(company);
      return NextResponse.json({
        status: 'success',
        data: suppliers.slice(0, 100),
      });
    }

    const suppliers = await ClaraConfigService.searchOmieSuppliers(q, company);
    return NextResponse.json({
      status: 'success',
      data: suppliers,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao buscar fornecedores.',
    }, { status: 500 });
  }
}
