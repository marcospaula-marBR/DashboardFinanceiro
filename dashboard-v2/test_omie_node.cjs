const fs = require('fs');

// Ler o arquivo .env manualmente
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

console.log("Key:", key ? key.substring(0, 10) + "..." : "None");
console.log("Secret:", secret ? secret.substring(0, 10) + "..." : "None");

async function run() {
  const url = 'https://app.omie.com.br/api/v1/financas/contapagar/';
  const payload = {
    call: 'ListarContasPagar',
    app_key: key,
    app_secret: secret,
    param: [{
      pagina: 1,
      registros_por_pagina: 5,
      filtrar_por_data_de: '26/06/2026',
      filtrar_por_data_ate: '26/07/2026'
    }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (data.faultstring) {
    console.log("Erro Omie:", data.faultstring);
  } else {
    const records = data.conta_pagar_cadastro || [];
    console.log(`Encontrados ${records.length} registros.`);
    if (records.length > 0) {
      console.log("Primeiro registro bruto no Node.js:");
      console.log(JSON.stringify(records[0], null, 2));
    }
  }
}

run().catch(console.error);
