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

async function callOmieAPI(url, call, param) {
  const payload = {
    call,
    app_key: key,
    app_secret: secret,
    param: [param]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (data.faultstring) {
    if (data.faultstring.includes('Nenhum registro encontrado') || data.faultstring.includes('Nao existem registros')) {
      return null;
    }
    throw new Error(`Erro Omie (${call}): ${data.faultstring}`);
  }
  return data;
}

async function run() {
  const brStart = '01/06/2026';
  const brEnd = '26/06/2026';

  console.log(`Testando Mar Brasil com período de ${brStart} a ${brEnd}`);

  // 1. CP
  try {
    const resCP = await callOmieAPI('https://app.omie.com.br/api/v1/financas/contapagar/', 'ListarContasPagar', {
      pagina: 1,
      registros_por_pagina: 100,
      filtrar_por_data_de: brStart,
      filtrar_por_data_ate: brEnd
    });
    const cpLen = resCP?.conta_pagar_cadastro?.length || 0;
    console.log(`CP (ListarContasPagar): ${cpLen} registros na página 1`);
    if (cpLen > 0) {
      console.log(`Amostra CP [0]: Venc=${resCP.conta_pagar_cadastro[0].data_vencimento}, Pagto=${resCP.conta_pagar_cadastro[0].data_baixa || 'null'}, Status=${resCP.conta_pagar_cadastro[0].status_titulo}`);
    }
  } catch (err) {
    console.error('Erro CP:', err.message);
  }

  // 2. CR
  try {
    const resCR = await callOmieAPI('https://app.omie.com.br/api/v1/financas/contareceber/', 'ListarContasReceber', {
      pagina: 1,
      registros_por_pagina: 100,
      filtrar_por_data_de: brStart,
      filtrar_por_data_ate: brEnd
    });
    const crLen = resCR?.conta_receber_cadastro?.length || 0;
    console.log(`CR (ListarContasReceber): ${crLen} registros na página 1`);
    if (crLen > 0) {
      console.log(`Amostra CR [0]: Venc=${resCR.conta_receber_cadastro[0].data_vencimento}, Pagto=${resCR.conta_receber_cadastro[0].data_baixa || 'null'}, Status=${resCR.conta_receber_cadastro[0].status_titulo}`);
    }
  } catch (err) {
    console.error('Erro CR:', err.message);
  }

  // 3. MOV
  try {
    const resMOV = await callOmieAPI('https://app.omie.com.br/api/v1/financas/mf/', 'ListarMovimentos', {
      nPagina: 1,
      nRegPorPagina: 100,
      dDtPagtoDe: brStart,
      dDtPagtoAte: brEnd,
      lDadosCad: true
    });
    const movLen = resMOV?.movimentos?.length || 0;
    console.log(`MOV (ListarMovimentos com dDtPagtoDe): ${movLen} registros na página 1`);
    if (movLen > 0) {
      const d = resMOV.movimentos[0].detalhes;
      console.log(`Amostra MOV [0]: Pagto=${d.dDtPagto}, Reg=${d.dDtRegistro}, Venc=${d.dDtVenc}, Favorecido=${d.cFavorecido || d.cNomeCliente}`);
    }
  } catch (err) {
    console.error('Erro MOV (dDtPagtoDe):', err.message);
  }

  // 3b. MOV com dRegDe
  try {
    const resMOV2 = await callOmieAPI('https://app.omie.com.br/api/v1/financas/mf/', 'ListarMovimentos', {
      nPagina: 1,
      nRegPorPagina: 100,
      dRegDe: brStart,
      dRegAte: brEnd,
      lDadosCad: true
    });
    const movLen2 = resMOV2?.movimentos?.length || 0;
    console.log(`MOV (ListarMovimentos com dRegDe): ${movLen2} registros na página 1`);
    if (movLen2 > 0) {
      const d = resMOV2.movimentos[0].detalhes;
      console.log(`Amostra MOV2 [0]: Pagto=${d.dDtPagto}, Reg=${d.dDtRegistro}, Venc=${d.dDtVenc}, Favorecido=${d.cFavorecido || d.cNomeCliente}`);
    }
  } catch (err) {
    console.error('Erro MOV (dRegDe):', err.message);
  }
}

run().catch(console.error);
