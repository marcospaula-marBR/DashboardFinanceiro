const fs = require('fs');

// Ler o arquivo .env
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
      env[key] = val;
    }
  }
});

const key = env.OMIE_APP_KEY_MARBRASIL;
const secret = env.OMIE_APP_SECRET_MARBRASIL;

async function callOmieAPI(param) {
  const payload = {
    call: 'ListarContasPagar',
    app_key: key,
    app_secret: secret,
    param: [param]
  };

  const response = await fetch('https://app.omie.com.br/api/v1/financas/contapagar/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return response.json();
}

async function test(name, param) {
  console.log(`\n--- Testando: ${name} ---`);
  try {
    const res = await callOmieAPI(param);
    if (res.faultstring) {
      console.log('Erro/Ignorado:', res.faultstring);
      return;
    }
    const records = res.conta_pagar_cadastro || [];
    console.log(`Retornou ${records.length} registros. Total: ${res.total_de_registros}`);
    
    // Verificar se todas as amostras estão no intervalo de vencimento 26/06/2026 a 26/07/2026
    let allInInterval = true;
    const samples = [];
    records.forEach(r => {
      const parts = r.data_vencimento.split('/');
      const d = new Date(parts[2], parts[1]-1, parts[0]);
      const start = new Date(2026, 5, 26);
      const end = new Date(2026, 6, 26);
      const inInterval = d >= start && d <= end;
      if (!inInterval) allInInterval = false;
      samples.push(`${r.data_vencimento} (${inInterval ? 'OK' : 'FORA'})`);
    });

    console.log(`Todos no intervalo de vencimento? ${allInInterval ? 'SIM' : 'NÃO'}`);
    console.log('Vencimentos retornados:', samples.slice(0, 10).join(', '));
  } catch (err) {
    console.error('Erro:', err.message);
  }
}

async function run() {
  const de = '26/06/2026';
  const ate = '26/07/2026';

  // Candidato 1: filtrar_por_data_venc_de
  await test('filtrar_por_data_venc_de / ate', {
    pagina: 1, registros_por_pagina: 10,
    filtrar_por_data_venc_de: de, filtrar_por_data_venc_ate: ate
  });

  // Candidato 2: filtrar_por_venc_de
  await test('filtrar_por_venc_de / ate', {
    pagina: 1, registros_por_pagina: 10,
    filtrar_por_venc_de: de, filtrar_por_venc_ate: ate
  });

  // Candidato 3: filtrar_por_vencimento_de
  await test('filtrar_por_vencimento_de / ate', {
    pagina: 1, registros_por_pagina: 10,
    filtrar_por_vencimento_de: de, filtrar_por_vencimento_ate: ate
  });

  // Candidato 4: dDtVencDe
  await test('dDtVencDe / dDtVencAte', {
    pagina: 1, registros_por_pagina: 10,
    dDtVencDe: de, dDtVencAte: ate
  });

  // Candidato 5: data_vencimento_de
  await test('data_vencimento_de / ate', {
    pagina: 1, registros_por_pagina: 10,
    data_vencimento_de: de, data_vencimento_ate: ate
  });

  // Candidato 6: cDataVencDe
  await test('cDataVencDe / cDataVencAte', {
    pagina: 1, registros_por_pagina: 10,
    cDataVencDe: de, cDataVencAte: ate
  });

  // Candidato 7: filtrar_por_data_de (com apenas_alteracao e apenas_inclusao omitidos ou falsificados)
  // Alguns endpoints usam tags adicionais para especificar o tipo de data
  await test('filtrar_por_data_de com filtrar_por_data_vencimento="S"', {
    pagina: 1, registros_por_pagina: 10,
    filtrar_por_data_de: de, filtrar_por_data_ate: ate,
    filtrar_por_data_vencimento: 'S'
  });

  // Candidato 8: dDtVencInicial e dDtVencFinal
  await test('dDtVencInicial / dDtVencFinal', {
    pagina: 1, registros_por_pagina: 10,
    dDtVencInicial: de, dDtVencFinal: ate
  });
}

run().catch(console.error);
