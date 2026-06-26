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

async function run() {
  const url = 'https://app.omie.com.br/api/v1/financas/contapagar/';
  const payload = {
    call: 'ListarContasPagar',
    app_key: key,
    app_secret: secret,
    param: [{
      pagina: 1,
      registros_por_pagina: 100,
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
  const records = data.conta_pagar_cadastro || [];
  console.log(`Brutos do Omie: ${records.length} registros.`);

  // Simular processamento do backend
  const allRecords = [];
  const todayStr = '2026-06-26'; // fixado para hoje

  function formatOmieDateToISO(dateStr) {
    if (!dateStr) return null;
    try {
      if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        return `${y}-${m}-${d}`;
      }
      return dateStr.substring(0, 10);
    } catch {
      return null;
    }
  }

  for (const r of records) {
    if (r.status_titulo === 'CANCELADO') continue;

    const omieId = String(r.codigo_lancamento_omie);
    const statusRaw = String(r.status_titulo || 'ABERTO').toUpperCase();
    
    let status = 'ABERTO';
    const isPaid = statusRaw.includes('PAGO') || statusRaw.includes('LIQUIDADO');
    
    const dtVencISO = formatOmieDateToISO(r.data_vencimento);

    if (isPaid) {
      status = 'PAGO';
    } else if (dtVencISO && dtVencISO < todayStr) {
      status = 'ATRASADO';
    }

    const dtPagamento = formatOmieDateToISO(r.data_baixa || r.data_liquidacao || (isPaid ? r.data_previsao : null));
    const dtVencimento = dtVencISO;

    const dataAlocacao = (status === 'PAGO' && dtPagamento) ? dtPagamento : (dtVencimento || todayStr);

    allRecords.push({
      id_global: `pagar_${omieId}`,
      omie_id: omieId,
      status,
      data_vencimento: dtVencimento,
      data_pagamento: dtPagamento,
      data_alocacao: dataAlocacao,
      valor: r.valor_documento
    });
  }

  console.log(`Após normalização: ${allRecords.length} registros.`);
  
  // Imprimir os primeiros 10 registros mapeados com suas datas
  console.log("Amostra pós mapeamento:");
  allRecords.slice(0, 10).forEach(r => {
    console.log(`ID: ${r.omie_id} | Status: ${r.status} | Venc: ${r.data_vencimento} | Pgt: ${r.data_pagamento} | Alocacao: ${r.data_alocacao}`);
  });

  // Aplicar filtro de datas estrito
  const startDate = '2026-06-26';
  const endDate = '2026-07-26';

  const strictlyFilteredRecords = allRecords.filter(item => {
    return item.data_alocacao >= startDate && item.data_alocacao <= endDate;
  });

  console.log(`Após filtragem estrita (${startDate} a ${endDate}): ${strictlyFilteredRecords.length} registros.`);
  strictlyFilteredRecords.slice(0, 10).forEach(r => {
    console.log(`[Filtrado] ID: ${r.omie_id} | Status: ${r.status} | Alocacao: ${r.data_alocacao}`);
  });
}

run().catch(console.error);
