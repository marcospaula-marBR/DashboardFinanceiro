import { NextResponse } from 'next/server';
import { ClaraConfigService } from '@/services/clara/clara-config.service';

export async function GET() {
  try {
    const mappings = await ClaraConfigService.getDepartmentMappings();
    return NextResponse.json({ status: 'success', data: mappings });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.clara_key || !body.omie_department_code) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'Chave Clara (usuário/label) e Departamento Omie são obrigatórios.' 
      }, { status: 400 });
    }

    await ClaraConfigService.saveDepartmentMapping({
      mapping_type: body.mapping_type || 'USER',
      clara_key: body.clara_key,
      omie_department_code: body.omie_department_code,
      omie_department_desc: body.omie_department_desc,
    });

    const mappings = await ClaraConfigService.getDepartmentMappings();
    return NextResponse.json({
      status: 'success',
      message: 'Mapeamento de centro de custo salvo com sucesso!',
      data: mappings,
    });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'USER';
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ status: 'error', message: 'Parâmetro key é obrigatório.' }, { status: 400 });
    }

    await ClaraConfigService.deleteDepartmentMapping(type, key);
    return NextResponse.json({ status: 'success', message: 'Mapeamento excluído com sucesso!' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
