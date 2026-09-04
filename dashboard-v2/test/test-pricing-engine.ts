import { PricingSimulatorEngine } from '../src/services/pricing-simulator.engine';

console.log('=== TESTE DO MOTOR DE SIMULAÇÃO DE PRECIFICAÇÃO E CENÁRIOS ===\n');

// 1. Teste Módulo 1: Precificação de Nova Proposta
console.log('--- TESTE 1: Módulo 1 (Precificação Proposta) ---');
const resProposta = PricingSimulatorEngine.calculateProposalPricing(
  {
    faturamentoNovo: 150000,
    custoDiretoNovo: 90000,
    margemDesejadaPct: 15,
    aliquotaImpostosPct: 0
  },
  1000000, // FT_p
  80000,   // DR_p
  [
    { id: 'c1', nome: 'Contrato A', faturamentoMensal: 500000, custoDiretoMensal: 300000 },
    { id: 'c2', nome: 'Contrato B', faturamentoMensal: 300000, custoDiretoMensal: 180000 },
    { id: 'c3', nome: 'Contrato C', faturamentoMensal: 200000, custoDiretoMensal: 120000 },
  ]
);

console.log('FT_novo:', resProposta.ftNovo, '(Esperado: 1150000)');
console.log('Part_novo%:', resProposta.partNovoPct.toFixed(2), '(Esperado: 13.04%)');
console.log('Rateio_novo:', resProposta.rateioNovo.toFixed(2), '(Esperado: 10434.78)');
console.log('Custo_Total_novo:', resProposta.custoTotalNovo.toFixed(2), '(Esperado: 100434.78)');
console.log('Preço Markup A:', resProposta.precoMinMarkup.toFixed(2), '(Esperado: 115500.00)');
console.log('Preço Margem B:', resProposta.precoMinMargemSobrePreco.toFixed(2), '(Esperado: 118158.57)');
console.log('Fator Diluição Contratos:', (resProposta.fatorDiluicaoContratos * 100).toFixed(2) + '%', '(Esperado: 86.96%)');

const ok1 = Math.abs(resProposta.precoMinMarkup - 115500) < 1 &&
            Math.abs(resProposta.precoMinMargemSobrePreco - 118158.57) < 1;
console.log('Status Teste 1:', ok1 ? '✅ APROVADO' : '❌ FALHOU');

// 2. Teste Módulo 2: Cenário de Perda de Contrato
console.log('\n--- TESTE 2: Módulo 2 (Perda de Contrato) ---');
const resPerda = PricingSimulatorEngine.calculateContractLoss(
  {
    contractId: 'cX',
    faturamentoMensal: 200000,
    custoDiretoMensal: 130000,
    horizonteMeses: 12,
    metaReposicaoPct: 100
  },
  1000000, // FT_p
  80000,   // DR_p
  'Contrato X'
);

console.log('MC Perdida:', resPerda.margemContribPerdida, '(Esperado: 70000)');
console.log('FT pós perda:', resPerda.ftPosPerda, '(Esperado: 800000)');
console.log('Sobrecarga de rateio%:', resPerda.rateioMedioAdicionalPct.toFixed(2) + '%', '(Esperado: 25.00%)');
console.log('Corte necessário DR:', resPerda.corteNecessarioDR.toFixed(2), '(Esperado: 16000.00)');
console.log('Lucro cessante excedente:', resPerda.lucroCessanteExcedente.toFixed(2), '(Esperado: 54000.00)');
console.log('Meta mensal reposição 100%:', resPerda.metaMensalReposicao.toFixed(2), '(Esperado: 16666.67)');

const ok2 = resPerda.margemContribPerdida === 70000 &&
            Math.abs(resPerda.rateioMedioAdicionalPct - 25) < 0.01 &&
            resPerda.corteNecessarioDR === 16000 &&
            resPerda.lucroCessanteExcedente === 54000;
console.log('Status Teste 2:', ok2 ? '✅ APROVADO' : '❌ FALHOU');

// 3. Teste Parecer Determinístico
console.log('\n--- TESTE 3: Síntese Determinística ---');
const insightProp = PricingSimulatorEngine.generateDeterministicInsight('precificacao', resProposta);
console.log('Insight Proposta:\n', insightProp);
const insightPerda = PricingSimulatorEngine.generateDeterministicInsight('perda', resPerda);
console.log('Insight Perda:\n', insightPerda);

if (ok1 && ok2) {
  console.log('\n🎉 TODOS OS TESTES NUMÉRICOS PASSARAM COM SUCESSO!');
} else {
  process.exit(1);
}
