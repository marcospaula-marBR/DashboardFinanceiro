import { NextResponse } from 'next/server';
import { ClaraConfigService } from '@/services/clara/clara-config.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get('company') || 'Mar Brasil';

    const [accounts, departments, categories, projects] = await Promise.all([
      ClaraConfigService.getOmieAccounts(false, company), // busca todas as contas da empresa
      ClaraConfigService.getOmieDepartments(company),
      ClaraConfigService.getOmieCategories(),
      ClaraConfigService.getOmieProjects(company),
    ]);

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
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao consultar recursos do Omie.',
    }, { status: 500 });
  }
}
