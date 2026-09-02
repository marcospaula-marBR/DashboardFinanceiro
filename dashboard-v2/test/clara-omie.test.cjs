const assert = require('assert');
const crypto = require('crypto');

console.log('=== TESTES UNITÁRIOS: INTEGRAÇÃO CLARA → OMIE ===\n');

// 1. Teste de Identificador Determinístico cCodIntLanc
function generateOmieIntegrationId(claraUuid) {
  const hash = crypto.createHash('sha256').update(claraUuid.trim().toLowerCase()).digest('hex');
  return `CL${hash.substring(0, 18).toUpperCase()}`;
}

console.log('1. Testando geração determinística de cCodIntLanc...');
const testUuid1 = '4ea5a94a-2c3c-4601-b623-c30260c21dbc';
const testUuid2 = '4ea5a94a-2c3c-4601-b623-c30260c21dbc'; // Mesmo UUID
const testUuid3 = '9fb12345-6789-4abc-def0-123456789abc'; // Outro UUID

const id1 = generateOmieIntegrationId(testUuid1);
const id2 = generateOmieIntegrationId(testUuid2);
const id3 = generateOmieIntegrationId(testUuid3);

assert.strictEqual(id1, id2, 'O mesmo UUID DEVE gerar exatamente o mesmo cCodIntLanc.');
assert.notStrictEqual(id1, id3, 'UUIDs diferentes DEVEM gerar cCodIntLanc diferentes.');
assert.ok(id1.startsWith('CL'), 'Identificador deve começar com o prefixo CL.');
assert.ok(id1.length <= 20, `Tamanho deve ser menor ou igual a 20 caracteres (obtido: ${id1.length}).`);
console.log(`   ✅ Idempotência de identificador validada: ${id1} (len: ${id1.length})`);

// 2. Convenção de Valores e Sinal Positivo
function getOmieTransactionAmount(rawAmount) {
  const val = Math.abs(parseFloat(String(rawAmount || 0)));
  return Math.round(val * 100) / 100;
}

console.log('\n2. Testando convenção de valores monetários...');
assert.strictEqual(getOmieTransactionAmount(150.5), 150.5);
assert.strictEqual(getOmieTransactionAmount(-89.9), 89.9, 'Valores negativos devem ser convertidos em positivos.');
assert.strictEqual(getOmieTransactionAmount('42.30'), 42.3);
assert.strictEqual(getOmieTransactionAmount(1284.004), 1284.00);
console.log('   ✅ Convenção de valores monetários validada com precisão de 2 casas decimais.');

// 3. Formatação de Data DD/MM/AAAA
function formatDateToOmie(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('T')[0].split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoDate;
}

console.log('\n3. Testando formatação de datas Omie...');
assert.strictEqual(formatDateToOmie('2026-09-02T14:30:00Z'), '02/09/2026');
assert.strictEqual(formatDateToOmie('2026-12-31'), '31/12/2026');
console.log('   ✅ Formatação de datas para formato DD/MM/AAAA validada.');

// 4. Elegibilidade de Transações (PURCHASE + AUTHORIZED)
function isTransactionEligibleForOmie(type, status) {
  return type === 'PURCHASE' && status === 'AUTHORIZED';
}

console.log('\n4. Testando filtros de elegibilidade...');
assert.ok(isTransactionEligibleForOmie('PURCHASE', 'AUTHORIZED'), 'PURCHASE + AUTHORIZED deve ser elegível.');
assert.ok(!isTransactionEligibleForOmie('PURCHASE', 'PRE_AUTHORIZED'), 'PRE_AUTHORIZED não deve ser enviado.');
assert.ok(!isTransactionEligibleForOmie('PURCHASE', 'REJECTED'), 'REJECTED não deve ser enviado.');
assert.ok(!isTransactionEligibleForOmie('PAYMENT', 'AUTHORIZED'), 'PAYMENT não deve ser enviado como despesa de cartão.');
assert.ok(!isTransactionEligibleForOmie('REFUND', 'AUTHORIZED'), 'REFUND no MVP deve ser tratado como fluxo separado.');
console.log('   ✅ Filtros de elegibilidade estritos validados com sucesso.');

// 5. Estrutura do Payload Omie IncluirAnexo
function buildOmieAnexoPayload(nCodLanc, fileName, base64) {
  const cMd5 = crypto.createHash('md5').update(base64).digest('hex');
  return {
    cTabela: 'conta-corrente-lancamento',
    nId: nCodLanc,
    cNomeArquivo: fileName,
    cArquivo: base64,
    cMd5,
  };
}

console.log('\n5. Testando estrutura de payload de anexo/comprovante...');
const payloadAnexo = buildOmieAnexoPayload(7654321, 'recibo_uber.pdf', 'JVBERi0xLjQK...');
assert.strictEqual(payloadAnexo.cTabela, 'conta-corrente-lancamento');
assert.strictEqual(payloadAnexo.nId, 7654321);
assert.strictEqual(payloadAnexo.cNomeArquivo, 'recibo_uber.pdf');
assert.ok(payloadAnexo.cMd5, 'O campo cMd5 deve ser gerado.');
console.log('   ✅ Payload para /api/v1/geral/anexo/ (IncluirAnexo com cMd5) validado.');

console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!\n');
