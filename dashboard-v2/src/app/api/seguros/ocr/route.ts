/**
 * API Route: /api/seguros/ocr
 * Funcionalidade de OCR via Gemini descontinuada/desativada a pedido do usuário.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Funcionalidade de leitura por IA desativada. Por favor, utilize o preenchimento manual.' },
    { status: 410 }
  );
}
