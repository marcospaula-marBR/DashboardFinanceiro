import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const GAMMA_API_KEY = process.env.GAMMA_API_KEY;
    
    if (!GAMMA_API_KEY) {
      return NextResponse.json({ error: 'Chave de API do Gamma não configurada.' }, { status: 500 });
    }

    const response = await fetch(`https://public-api.gamma.app/v1.0/generations/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': GAMMA_API_KEY,
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro na API do Gamma (Status):', errorData);
      return NextResponse.json({ error: 'Falha ao comunicar com API do Gamma' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: unknown) {
    console.error('Erro na rota /api/gamma/status:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
