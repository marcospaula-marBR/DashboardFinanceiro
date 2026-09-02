import { NextResponse } from 'next/server';
import { ClaraConfigService } from '@/services/clara/clara-config.service';

export async function GET() {
  try {
    const mappings = await ClaraConfigService.getCategoryMappings();
    return NextResponse.json({ status: 'success', data: mappings });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.clara_category || !body.omie_category_code) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'Categoria Clara e Código da Categoria Omie são obrigatórios.' 
      }, { status: 400 });
    }

    await ClaraConfigService.saveCategoryMapping(body);
    const mappings = await ClaraConfigService.getCategoryMappings();

    return NextResponse.json({
      status: 'success',
      message: 'Mapeamento de categoria salvo com sucesso!',
      data: mappings,
    });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const claraCategory = searchParams.get('category');

    if (!claraCategory) {
      return NextResponse.json({ status: 'error', message: 'Parâmetro category é obrigatório.' }, { status: 400 });
    }

    await ClaraConfigService.deleteCategoryMapping(claraCategory);
    return NextResponse.json({ status: 'success', message: 'Mapeamento excluído com sucesso!' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
