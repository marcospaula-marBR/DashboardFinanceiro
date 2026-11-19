const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadParserService() {
  const filePath = path.resolve(__dirname, '../src/services/people-ingestion-parser.service.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require: (id) => {
      if (id === 'fast-xml-parser') return require('fast-xml-parser');
      return require(id);
    },
    console,
    Intl,
    Date,
    Math,
    Number,
    String,
    Set,
    Map,
    Array,
    Object,
    parseInt,
    parseFloat,
    isNaN,
    Boolean,
  };
  vm.runInNewContext(transpiled.outputText, sandbox, { filename: filePath });
  return mod.exports;
}

const svc = loadParserService();
const {
  parseDominioPayrollText,
  parseBenefitsPdfText,
  parseNfseXml,
  parseEsocialS1200Xml,
  sanitizeParsedPayrollRecords,
  detectXmlDocumentType,
  isAdiantamentoSalarialRubrica,
} = svc;

console.log('=== TESTES UNITÁRIOS: MOTOR HÍBRIDO DE INGESTÃO (PDF DETERMINÍSTICO + XML NFS-e / eSocial) ===\n');

// 1. Parser determinístico de folha Domínio Sistemas
console.log('1. parseDominioPayrollText (formato Domínio, rubrica 48 VT, rubrica 981 Adiantamento e check contábil)...');
const dominioText = `
EXTRATO MENSAL
10/2026
Empresa: 001 - D.Z.M. LTDA
101 BRUNO VIANA DE SOUSA CHAVES Empr.:
CPF: 456.671.868-96 Cargo: 2 - OFICIAL DE SERVICOS GERAIS CBO: 5143
Situação: Trabalhando
1 1.849,81P SALARIO BASE
150 67,54P HORAS EXTRAS 50%
48 110,99D VALE TRANSPORTE
981 739,92D DESC.ADIANT.SALARIAL
998 142,16D I.N.S.S.
Proventos: 1.917,35 Descontos: 993,07 Líquido: 924,28
Valor FGTS: 153,39

102 ANDREA APARECIDA DE OLIVEIRA Empr.:
CPF: 261.523.218-59 Cargo: 1 - AUXILIAR DE SERVICOS GERAIS CBO: 5143
Situação: Trabalhando
1 1.849,81P SALARIO BASE
48 110,99D VALE TRANSPORTE
981 739,92D DESC.ADIANT.SALARIAL
998 142,16D I.N.S.S.
Proventos: 1.849,81 Descontos: 993,07 Líquido: 856,74
Valor FGTS: 147,98
Resumo por Rubricas
`;

const domRes = parseDominioPayrollText(dominioText);
assert.strictEqual(domRes.matched, true);
assert.strictEqual(domRes.competencia, '2026-10-01');
assert.strictEqual(domRes.empresa, 'DZM');
assert.strictEqual(domRes.records.length, 2);
assert.strictEqual(domRes.records[0].name, 'BRUNO VIANA DE SOUSA CHAVES');
assert.strictEqual(domRes.records[0].valor_holerite, 1917.35);
assert.strictEqual(domRes.records[0].valor_descontos, 993.07);
assert.strictEqual(domRes.records[0].valor_folha_liquido, 924.28);
assert.strictEqual(domRes.records[0].desconto_vt_6, 110.99);
assert.strictEqual(domRes.records[0].valor_vt, 0, 'Rubrica 48 nunca pode preencher valor_vt (crédito)');
assert.strictEqual(domRes.records[0].valor_adiantamento, 739.92);
assert.strictEqual(domRes.records[0].inss_empregado, 142.16);
assert.strictEqual(domRes.records[0].valor_fgts, 153.39);
console.log('   OK!');

// 2. Fallback automático para IA quando PDF é escaneado ou quebra check contábil
console.log('2. Fallback seguro para IA em PDF vazio/escaneado ou divergência contábil...');
assert.strictEqual(parseDominioPayrollText('').matched, false);
assert.strictEqual(parseDominioPayrollText('texto curto sem marcadores').matched, false);
const brokenAccounting = `
EXTRATO MENSAL
10/2026
Empresa: D.Z.M. LTDA
101 FULANO DE TAL Empr.:
CPF: 111.222.333-44
Proventos: 2.000,00 Descontos: 500,00 Líquido: 900,00
`;
assert.strictEqual(parseDominioPayrollText(brokenAccounting).matched, false, 'Deve delegar para IA se Proventos - Descontos != Líquido');
console.log('   OK!');

// 3. Parser determinístico de Benefícios (VA e VT) com conferência de TOTAL GERAL
console.log('3. parseBenefitsPdfText (VA/Cesta e VT com conferência de TOTAL GERAL)...');
const vaPdfText = `
VALE ALIMENTACAO / CESTA BASICA - OUTUBRO/2026
DZM - OUTUBRO/2026
COLABORADOR:VA
1Flavio Pereira da Silva320,00R$
2Andrea Aparecida de Oliveira320,00R$
TOTAL GERAL: 640,00R$
`;
const vaRes = parseBenefitsPdfText(vaPdfText);
assert.strictEqual(vaRes.matched, true);
assert.strictEqual(vaRes.competencia, '2026-10-01');
assert.strictEqual(vaRes.empresa, 'DZM');
assert.strictEqual(vaRes.records.length, 2);
assert.strictEqual(vaRes.totalCheck.extracted, 640);

const vaBrokenTotal = vaPdfText.replace('640,00R$', '999,00R$');
assert.strictEqual(parseBenefitsPdfText(vaBrokenTotal).matched, false, 'Soma divergente do TOTAL GERAL deve delegar para IA');

const vtPdfText = `
VALE TRANSPORTE - OUTUBRO/2026
DZM - OUTUBRO/2026
COLABORADOR:QTD SABADO ONIBUS 1 TOTAL SABADO TOTAL A PAGAR
1 Andrea Aparecida de Oliveira Ferreira 55,25R$ 2-R$ 52,50R$ 273,00R$
2 Bruno Viana de Sousa Chaves 40,00R$ 30,00R$ 421,60R$
TOTAL GERAL: 95,25R$ 82,50R$ 694,60R$
`;
const vtRes = parseBenefitsPdfText(vtPdfText);
assert.strictEqual(vtRes.matched, true);
assert.strictEqual(vtRes.records.length, 2);
assert.strictEqual(vtRes.records[0].valor_vt, 273);
assert.strictEqual(vtRes.records[1].valor_vt, 421.6);
console.log('   OK!');

// 4. Parser determinístico de XML NFS-e (ABRASF v2 e Padrão Nacional)
console.log('4. parseNfseXml (ABRASF v2 + Padrão Nacional + erro em XML inválido)...');
const abrasfXml = `<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Nfse>
    <InfNfse>
      <Numero>20260045</Numero>
      <DataEmissao>2026-10-05T10:20:00</DataEmissao>
      <Competencia>2026-09-01</Competencia>
      <PrestadorServico>
        <IdentificacaoPrestador><CpfCnpj><Cnpj>12345678000190</Cnpj></CpfCnpj></IdentificacaoPrestador>
        <RazaoSocial>SILVA CONSULTORIA TECNOLOGICA LTDA</RazaoSocial>
      </PrestadorServico>
      <TomadorServico>
        <IdentificacaoTomador><CpfCnpj><Cnpj>11222333000144</Cnpj></CpfCnpj></IdentificacaoTomador>
        <RazaoSocial>MAR BRASIL SERVICOS LTDA</RazaoSocial>
      </TomadorServico>
      <ValoresNfse>
        <ValorServicos>8500.00</ValorServicos>
        <ValorIr>127.50</ValorIr>
        <ValorLiquidoNfse>8372.50</ValorLiquidoNfse>
      </ValoresNfse>
      <Discriminacao>Consultoria em Engenharia de Software - Ref 09/2026</Discriminacao>
    </InfNfse>
  </Nfse>
</CompNfse>`;

assert.strictEqual(detectXmlDocumentType(abrasfXml), 'nfse');
const nfseRes = parseNfseXml(abrasfXml);
assert.strictEqual(nfseRes.matched, true);
assert.strictEqual(nfseRes.competencia, '2026-09-01');
assert.strictEqual(nfseRes.empresa, 'MarBR');
assert.strictEqual(nfseRes.records.length, 1);
assert.strictEqual(nfseRes.records[0].numeroNf, '20260045');
assert.strictEqual(nfseRes.records[0].prestadorCnpj, '12.345.678/0001-90');
assert.strictEqual(nfseRes.records[0].valorServicos, 8500);
assert.strictEqual(nfseRes.records[0].totalRetencoes, 127.5);
assert.strictEqual(nfseRes.records[0].valorLiquidoNfse, 8372.5);
assert.strictEqual(parseNfseXml('not xml').matched, false);
console.log('   OK!');

// 5. Parser determinístico de XML eSocial S-1200
console.log('5. parseEsocialS1200Xml (eSocial evtRemun, proventos, descontos, rubrica 48 e 981, ignora informativas)...');
const esocialXml = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtRemun/v_S_01_02_00">
  <evtRemun Id="ID12345">
    <ideEvento><perApur>2026-10</perApur></ideEvento>
    <ideTrabalhador><cpfTrab>45667186896</cpfTrab><nmTrab>BRUNO VIANA</nmTrab></ideTrabalhador>
    <dmDev>
      <infoPerApur>
        <ideEstabLot>
          <remunPerApur>
            <matricula>101</matricula>
            <itensRemun><codRubr>1</codRubr><dscRubr>SALARIO BASE</dscRubr><tpRubr>1</tpRubr><vrRubr>2000.00</vrRubr></itensRemun>
            <itensRemun><codRubr>150</codRubr><dscRubr>HORAS EXTRAS 50%</dscRubr><tpRubr>1</tpRubr><vrRubr>250.00</vrRubr></itensRemun>
            <itensRemun><codRubr>48</codRubr><dscRubr>VALE TRANSPORTE 6%</dscRubr><tpRubr>2</tpRubr><vrRubr>120.00</vrRubr></itensRemun>
            <itensRemun><codRubr>981</codRubr><dscRubr>DESC.ADIANT.SALARIAL</dscRubr><tpRubr>2</tpRubr><vrRubr>800.00</vrRubr></itensRemun>
            <itensRemun><codRubr>998</codRubr><dscRubr>INSS</dscRubr><tpRubr>2</tpRubr><vrRubr>180.00</vrRubr></itensRemun>
            <itensRemun><codRubr>990</codRubr><dscRubr>BASE INSS</dscRubr><tpRubr>3</tpRubr><vrRubr>2250.00</vrRubr></itensRemun>
          </remunPerApur>
        </ideEstabLot>
      </infoPerApur>
    </dmDev>
  </evtRemun>
</eSocial>`;

assert.strictEqual(detectXmlDocumentType(esocialXml), 'esocial_s1200');
const esoRes = parseEsocialS1200Xml(esocialXml);
assert.strictEqual(esoRes.matched, true);
assert.strictEqual(esoRes.competencia, '2026-10-01');
assert.strictEqual(esoRes.records.length, 1);
assert.strictEqual(esoRes.records[0].cpf, '456.671.868-96');
assert.strictEqual(esoRes.records[0].valor_holerite, 2250);
assert.strictEqual(esoRes.records[0].valor_hora_extra, 250);
assert.strictEqual(esoRes.records[0].valor_descontos, 1100);
assert.strictEqual(esoRes.records[0].valor_adiantamento, 800);
assert.strictEqual(esoRes.records[0].desconto_vt_6, 120);
assert.strictEqual(esoRes.records[0].valor_vt, 0);
console.log('   OK!');

// 6. Sanitizador contábil pós-IA (blindagem VT e auto-cura adiantamento sem férias)
console.log('6. sanitizeParsedPayrollRecords (blindagem valor_vt=0 na folha e exclusão de adiantamento de férias)...');
assert.strictEqual(isAdiantamentoSalarialRubrica('981', 'DESC.ADIANT.SALARIAL'), true);
assert.strictEqual(isAdiantamentoSalarialRubrica('505', 'ADIANTAMENTO DE FERIAS'), false);

const sanitized = sanitizeParsedPayrollRecords(
  [
    {
      name: 'MARIA SILVA',
      valor_holerite: 3000,
      valor_descontos: 1200,
      valor_vt: 180, // Alucinação da IA tentando copiar rubrica 48 para crédito
      rubricas_descontos: [
        { codigo: '505', descricao: 'ADIANTAMENTO DE FERIAS', valor: 1500 },
        { codigo: '981', descricao: 'DESC. ADIANT. SALARIAL', valor: 1000 },
      ],
    },
  ],
  'payroll',
  'DZM'
);
assert.strictEqual(sanitized[0].valor_vt, 0, 'Sanitizador deve zerar valor_vt no modo payroll');
assert.strictEqual(sanitized[0].valor_adiantamento, 1000, 'Deve auto-curar estritamente o adiantamento salarial (981), ignorando férias');
assert.strictEqual(sanitized[0].empresa, 'DZM');
console.log('   OK!');

console.log('\n✅ TODOS OS 6 BLOCOS DE TESTES DO MOTOR HÍBRIDO DE INGESTÃO PASSARAM COM SUCESSO!');
