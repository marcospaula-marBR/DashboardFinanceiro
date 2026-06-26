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
  console.log(`Testing: ${name}`);
  const res = await callOmieAPI(param);
  if (res.faultstring) {
    console.log('Result:', res.faultstring);
  } else {
    const records = res.conta_pagar_cadastro || [];
    console.log(`Success! Retornou ${records.length} registros. Total: ${res.total_de_registros}`);
    if (records.length > 0) {
      console.log('Amostra Vencimento:', records[0].data_vencimento, 'Alt:', records[0].info.dAlt);
    }
  }
}

async function run() {
  const de = '26/06/2026';

  await test('dDtVencInicial', { pagina: 1, registros_por_pagina: 5, dDtVencInicial: de });
  await test('dDtVencDe', { pagina: 1, registros_por_pagina: 5, dDtVencDe: de });
  await test('filtrar_por_venc_de', { pagina: 1, registros_por_pagina: 5, filtrar_por_venc_de: de });
  await test('filtrar_por_vencimento_de', { pagina: 1, registros_por_pagina: 5, filtrar_por_vencimento_de: de });
  await test('data_vencimento_de', { pagina: 1, registros_por_pagina: 5, data_vencimento_de: de });
  await test('cDataVencDe', { pagina: 1, registros_por_pagina: 5, cDataVencDe: de });
}

run().catch(console.error);
