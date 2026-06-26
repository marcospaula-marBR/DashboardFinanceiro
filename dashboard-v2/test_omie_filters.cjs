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
  console.log('Params:', JSON.stringify(param));
  try {
    const res = await callOmieAPI(param);
    if (res.faultstring) {
      console.log('Erro:', res.faultstring);
      return;
    }
    const records = res.conta_pagar_cadastro || [];
    console.log(`Retornou ${records.length} registros. Total registros no Omie para esta query: ${res.total_de_registros}`);
    if (records.length > 0) {
      console.log('Amostras (primeiros 5):');
      records.slice(0, 5).forEach((r, idx) => {
        console.log(` [${idx}] ID: ${r.codigo_lancamento_omie} | Venc: ${r.data_vencimento} | Emissão: ${r.data_emissao} | Alt: ${r.info.dAlt} | Inc: ${r.info.dInc} | Status: ${r.status_titulo}`);
      });
    }
  } catch (err) {
    console.error('Erro de rede:', err.message);
  }
}

async function run() {
  const start = '26/06/2026';
  const end = '26/07/2026';

  // Teste 1: Padrão usado no fluxo-caixa/route.ts
  await test('Filtro simples (fluxo-caixa/route.ts)', {
    pagina: 1,
    registros_por_pagina: 10,
    filtrar_por_data_de: start,
    filtrar_por_data_ate: end
  });

  // Teste 2: Apenas inclusão "N", apenas alteração "N"
  await test('Filtro com Inclusao=N e Alteracao=N', {
    pagina: 1,
    registros_por_pagina: 10,
    filtrar_por_data_de: start,
    filtrar_por_data_ate: end,
    filtrar_apenas_inclusao: 'N',
    filtrar_apenas_alteracao: 'N'
  });

  // Teste 3: Apenas inclusão "S"
  await test('Filtro com Inclusao=S', {
    pagina: 1,
    registros_por_pagina: 10,
    filtrar_por_data_de: start,
    filtrar_por_data_ate: end,
    filtrar_apenas_inclusao: 'S',
    filtrar_apenas_alteracao: 'N'
  });

  // Teste 4: Apenas alteração "S"
  await test('Filtro com Alteracao=S', {
    pagina: 1,
    registros_por_pagina: 10,
    filtrar_por_data_de: start,
    filtrar_por_data_ate: end,
    filtrar_apenas_inclusao: 'N',
    filtrar_apenas_alteracao: 'S'
  });

  // Teste 5: Filtro dentro do objeto filters
  await test('Filtro dentro do objeto filters', {
    pagina: 1,
    registros_por_pagina: 10,
    filters: {
      filtrar_por_data_de: start,
      filtrar_por_data_ate: end
    }
  });
}

run().catch(console.error);
