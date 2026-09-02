import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('clara_sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(30);

    return NextResponse.json({
      status: 'success',
      data: data || [],
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao carregar histórico de execuções.',
    }, { status: 500 });
  }
}
