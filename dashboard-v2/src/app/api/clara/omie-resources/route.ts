import { NextResponse } from 'next/server';
import { ClaraConfigService } from '@/services/clara/clara-config.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get('company') || 'Mar Brasil';

    const results = await Promise.allSettled([
      ClaraConfigService.getOmieAccounts(false, company), // busca todas as contas da empresa
      ClaraConfigService.getOmieDepartments(company),
      ClaraConfigService.getOmieCategories(company),
      ClaraConfigService.getOmieProjects(company),
    ]);

    const accounts = results[0].status === 'fulfilled' ? results[0].value : [];
    const departments = results[1].status === 'fulfilled' ? results[1].value : [];
    const categories = results[2].status === 'fulfilled' ? results[2].value : [];
    const projects = results[3].status === 'fulfilled' ? results[3].value : [];

    // Separa contas tipo CR (Cartão de Crédito) com prioridade
    const creditCardAccounts = accounts.filter(a => a.tipo === 'CR');
    const otherAccounts = accounts.filter(a => a.tipo !== 'CR');

    return NextResponse.json({
      status: 'success',
      data: {
        accounts: [...creditCardAccounts, ...otherAccounts],
        creditCardAccounts,
        departments,
        categories,
        projects,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao consultar recursos do Omie.',
    }, { status: 500 });
  }
}
