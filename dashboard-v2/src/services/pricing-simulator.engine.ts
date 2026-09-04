import {
  ProposalPricingParams,
  ProposalPricingResult,
  DilutionEffectItem,
  ContractLossParams,
  ContractLossResult,
  SensitivityScenario,
  ConsolidatedSimulationMetrics,
  RubricAdjustmentItem
} from '@/types/pricing-simulator.types';

export interface BaseContractData {
  id: string;
  nome: string;
  faturamentoMensal: number;
  custoDiretoMensal: number;
}

export class PricingSimulatorEngine {

  /**
   * Módulo 1: Precificação de Nova Proposta em Licitação (Abordagem Marginal)
   * Baseado na Seção 2 da especificação funcional
   */
  static calculateProposalPricing(
    params: ProposalPricingParams,
    ftOriginal: number,
    drOriginal: number,
    contratosAtivos: BaseContractData[] = []
  ): ProposalPricingResult {
    const fNovo = Math.max(0, params.faturamentoNovo || 0);
    const cdNovo = Math.max(0, params.custoDiretoNovo || 0);
    const margemDesejadaPct = (params.margemDesejadaPct || 0) / 100;
    const aliquotaImpostosPct = (params.aliquotaImpostosPct || 0) / 100;
    const alertaCapacidade = (params.alertaCapacidadePct || 20) / 100;

    // Nova base de faturamento
    const ftNovo = ftOriginal + fNovo;
    
    // Participação da nova proposta
    const partNovoPct = ftNovo > 0 ? (fNovo / ftNovo) * 100 : 0;
    const partNovoDec = partNovoPct / 100;

    // Absorção de rateio da nova proposta
    const rateioNovo = partNovoDec * drOriginal;

    // Custo total
    const custoTotalNovo = cdNovo + rateioNovo;

    // Preço Mínimo A: Markup sobre Custo
    const precoMinMarkup = custoTotalNovo * (1 + margemDesejadaPct);

    // Preço Mínimo B: Margem sobre Preço (com dedução de impostos sobre receita)
    const divisorB = 1 - aliquotaImpostosPct - margemDesejadaPct;
    const precoMinMargemSobrePreco = divisorB > 0.01 ? custoTotalNovo / divisorB : custoTotalNovo;

    const diferencaPrecoPct = precoMinMarkup > 0 
      ? ((precoMinMargemSobrePreco - precoMinMarkup) / precoMinMarkup) * 100 
      : 0;

    // Margens da proposta
    const margemContribAbsoluta = fNovo - cdNovo;
    const margemContribPct = fNovo > 0 ? (margemContribAbsoluta / fNovo) * 100 : 0;
    const lucroLiquidoEstimado = fNovo - custoTotalNovo;

    // Efeito Diluição nos contratos existentes
    // Razão de diluição = FT_p / FT_novo
    const fatorDiluicaoContratos = ftNovo > 0 ? (ftOriginal / ftNovo) : 1;
    const reducaoRelativaRateioPct = (1 - fatorDiluicaoContratos) * 100;

    let economiaGlobalRateio = 0;
    const contratosDiluidos: DilutionEffectItem[] = contratosAtivos.map(c => {
      const partOriginalPct = ftOriginal > 0 ? (c.faturamentoMensal / ftOriginal) * 100 : 0;
      const partNovaPct = ftNovo > 0 ? (c.faturamentoMensal / ftNovo) * 100 : 0;
      
      const rateioOriginal = (partOriginalPct / 100) * drOriginal;
      const rateioNovoContrato = (partNovaPct / 100) * drOriginal;
      const economiaRateio = Math.max(0, rateioOriginal - rateioNovoContrato);
      economiaGlobalRateio += economiaRateio;

      return {
        id: c.id,
        nome: c.nome,
        faturamentoOriginal: c.faturamentoMensal,
        partOriginalPct,
        partNovaPct,
        rateioOriginal,
        rateioNovo: rateioNovoContrato,
        economiaRateio,
        reducaoRelativaPct: reducaoRelativaRateioPct
      };
    });

    // Alertas
    const mensagensAlerta: string[] = [];
    let alertaEstruturaNecessaria = false;
    let alertaMargemBaixa = false;

    if (ftOriginal > 0 && (fNovo / ftOriginal) >= alertaCapacidade) {
      alertaEstruturaNecessaria = true;
      mensagensAlerta.push(
        `A proposta representa ${((fNovo / ftOriginal) * 100).toFixed(1)}% do faturamento atual da empresa (acima do limite de ${(alertaCapacidade * 100).toFixed(0)}%). As despesas administrativas podem não se manter fixas; considere lançar custos indiretos adicionais como Custo Direto.`
      );
    }

    if (fNovo > 0 && fNovo < precoMinMargemSobrePreco) {
      alertaMargemBaixa = true;
      mensagensAlerta.push(
        `O faturamento estimado (R$ ${fNovo.toLocaleString('pt-BR')}) está abaixo do Preço Mínimo com Margem sobre Preço (R$ ${precoMinMargemSobrePreco.toLocaleString('pt-BR')}). Margem alvo de ${(margemDesejadaPct * 100).toFixed(0)}% não será atingida.`
      );
    }

    return {
      ftOriginal,
      drOriginal,
      ftNovo,
      partNovoPct,
      rateioNovo,
      custoTotalNovo,
      precoMinMarkup,
      precoMinMargemSobrePreco,
      diferencaPrecoPct,
      margemContribAbsoluta,
      margemContribPct,
      lucroLiquidoEstimado,
      fatorDiluicaoContratos,
      reducaoRelativaRateioPct,
      economiaGlobalRateio,
      contratosDiluidos,
      alertaEstruturaNecessaria,
      alertaMargemBaixa,
      mensagensAlerta
    };
  }

  /**
   * Módulo 2: Simulador de Cenário de Perda de Contrato
   * Baseado na Seção 3 da especificação funcional
   */
  static calculateContractLoss(
    params: ContractLossParams,
    ftOriginal: number,
    drOriginal: number,
    contratoNome: string,
    contratosAtivos: BaseContractData[] = []
  ): ContractLossResult {
    const fX = Math.max(0, params.faturamentoMensal || 0);
    const cdX = Math.max(0, params.custoDiretoMensal || 0);
    const n = Math.max(1, params.horizonteMeses || 12);
    const metaReposicaoPct = Math.min(100, Math.max(0, params.metaReposicaoPct || 100)) / 100;
    const bufferSegurancaPct = Math.max(0, params.bufferSegurancaPct || 0) / 100;

    // Participação original
    const partOriginalPct = ftOriginal > 0 ? (fX / ftOriginal) * 100 : 0;
    const partOriginalDec = partOriginalPct / 100;

    // Passo 1: Impacto Bruto Imediato
    const perdaFaturamentoMensal = fX;
    const reducaoCustoDireto = cdX;
    const margemContribPerdida = fX - cdX;

    // Passo 2: Redistribuição do rateio remanescente
    const ftPosPerda = Math.max(0, ftOriginal - fX);
    const fatorAumentoRateioPct = ftPosPerda > 0 ? ((ftOriginal / ftPosPerda) - 1) * 100 : 0;
    const rateioMedioAdicionalPct = fatorAumentoRateioPct;

    // Passo 3: Cenário SEM substituição (corte necessário em DR)
    const corteNecessarioDR = partOriginalDec * drOriginal;
    const lucroCessanteExcedente = Math.max(0, margemContribPerdida - corteNecessarioDR);
    const temLucroCessanteAlemDoRateio = lucroCessanteExcedente > 10;

    // Passo 4: Cenário COM substituição (meta mensal)
    const metaMensalReposicao = (fX * metaReposicaoPct) / n;
    const metaMensalComBuffer = metaMensalReposicao * (1 + bufferSegurancaPct);

    // Passo 5: Matriz de Sensibilidade (Otimista, Intermediário, Conservador)
    const sensibilidade: SensitivityScenario[] = [
      {
        cenario: 'Otimista',
        reposicaoPct: 100,
        metaMensalNovoFaturamento: fX / n,
        corteNecessarioDR: 0,
        impactoLiquidoResultado: 0,
        descricao: `Repor 100% da receita em ${n} meses (R$ ${(fX / n).toLocaleString('pt-BR')}/mês) sem necessidade de cortar despesas rateadas.`
      },
      {
        cenario: 'Intermediário',
        reposicaoPct: 50,
        metaMensalNovoFaturamento: (fX * 0.5) / n,
        corteNecessarioDR: corteNecessarioDR * 0.5,
        impactoLiquidoResultado: -(margemContribPerdida * 0.5 - (corteNecessarioDR * 0.5)),
        descricao: `Repor 50% da receita (R$ ${((fX * 0.5) / n).toLocaleString('pt-BR')}/mês) combinada a um corte de R$ ${(corteNecessarioDR * 0.5).toLocaleString('pt-BR')}/mês em despesas rateadas.`
      },
      {
        cenario: 'Conservador',
        reposicaoPct: 0,
        metaMensalNovoFaturamento: 0,
        corteNecessarioDR: corteNecessarioDR,
        impactoLiquidoResultado: -lucroCessanteExcedente,
        descricao: `Zero reposição de faturamento: corte imediato de R$ ${corteNecessarioDR.toLocaleString('pt-BR')}/mês em rateio para evitar sobrecarga nos outros contratos (ainda haverá perda de R$ ${lucroCessanteExcedente.toLocaleString('pt-BR')}/mês no lucro líquido).`
      }
    ];

    // Detalhamento por contrato remanescente
    const outrosContratos = contratosAtivos.filter(c => c.id !== params.contractId);
    const contratosSobrecarga = outrosContratos.map(c => {
      const partAntes = ftOriginal > 0 ? c.faturamentoMensal / ftOriginal : 0;
      const partDepois = ftPosPerda > 0 ? c.faturamentoMensal / ftPosPerda : 0;
      const rateioAtual = partAntes * drOriginal;
      const rateioPosPerda = partDepois * drOriginal;
      const aumentoRateioAbs = Math.max(0, rateioPosPerda - rateioAtual);
      const aumentoRateioPct = rateioAtual > 0 ? (aumentoRateioAbs / rateioAtual) * 100 : 0;

      return {
        id: c.id,
        nome: c.nome,
        faturamento: c.faturamentoMensal,
        rateioAtual,
        rateioPosPerda,
        aumentoRateioAbs,
        aumentoRateioPct
      };
    });

    return {
      contratoNome,
      ftOriginal,
      drOriginal,
      partOriginalPct,
      perdaFaturamentoMensal,
      reducaoCustoDireto,
      margemContribPerdida,
      ftPosPerda,
      fatorAumentoRateioPct,
      rateioMedioAdicionalPct,
      corteNecessarioDR,
      lucroCessanteExcedente,
      temLucroCessanteAlemDoRateio,
      metaMensalReposicao,
      metaMensalComBuffer,
      sensibilidade,
      contratosSobrecarga
    };
  }

  /**
   * Cálculo de Métricas Consolidadas para Simulação Rápida e Rubricas
   */
  static calculateConsolidatedMetrics(
    receitaBase: number,
    custosBase: number,
    despesasBase: number,
    deltaReceita: number = 0,
    deltaCustos: number = 0,
    deltaDespesas: number = 0
  ): ConsolidatedSimulationMetrics {
    const rOrig = Math.max(0, receitaBase);
    const cOrig = Math.max(0, custosBase);
    const dOrig = Math.max(0, despesasBase);

    const rSim = Math.max(0, rOrig + deltaReceita);
    const cSim = Math.max(0, cOrig + deltaCustos);
    const dSim = Math.max(0, dOrig + deltaDespesas);

    const margemBrutaOriginalPct = rOrig > 0 ? ((rOrig - cOrig) / rOrig) * 100 : 0;
    const margemBrutaSimuladaPct = rSim > 0 ? ((rSim - cSim) / rSim) * 100 : 0;

    const ebitdaOriginal = rOrig - cOrig - dOrig;
    const ebitdaSimulado = rSim - cSim - dSim;

    const ebitdaOriginalPct = rOrig > 0 ? (ebitdaOriginal / rOrig) * 100 : 0;
    const ebitdaSimuladoPct = rSim > 0 ? (ebitdaSimulado / rSim) * 100 : 0;

    // Break-even simplificado (Despesas Fixas / Margem de Contribuição %)
    const mcOrigRatio = rOrig > 0 ? (rOrig - cOrig) / rOrig : 0.4;
    const mcSimRatio = rSim > 0 ? (rSim - cSim) / rSim : 0.4;

    const breakEvenOriginal = mcOrigRatio > 0.05 ? dOrig / mcOrigRatio : 0;
    const breakEvenSimulado = mcSimRatio > 0.05 ? dSim / mcSimRatio : 0;

    const fclOriginal = ebitdaOriginal;
    const fclSimulado = ebitdaSimulado;
    const variacaoResultadoAbsoluta = ebitdaSimulado - ebitdaOriginal;

    return {
      receitaOriginal: rOrig,
      receitaSimulada: rSim,
      custosOriginal: cOrig,
      custosSimulada: cSim,
      despesasOriginal: dOrig,
      despesasSimulada: dSim,
      margemBrutaOriginalPct,
      margemBrutaSimuladaPct,
      ebitdaOriginal,
      ebitdaSimulado,
      ebitdaOriginalPct,
      ebitdaSimuladoPct,
      fclOriginal,
      fclSimulado,
      breakEvenOriginal,
      breakEvenSimulado,
      variacaoResultadoAbsoluta
    };
  }

  /**
   * Síntese Executiva Determinística (Consistente com GEMINI.md e regras do projeto)
   */
  static generateDeterministicInsight(
    modulo: 'precificacao' | 'perda' | 'rapida' | 'rubricas',
    dados: any
  ): string {
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const fmtPct = (v: number) => `${v.toFixed(1)}%`;

    if (modulo === 'precificacao') {
      const p = dados as ProposalPricingResult;
      return (
        `Esta proposta representaria ${fmtPct(p.partNovoPct)} do faturamento total e absorveria ${fmt(p.rateioNovo)} de despesas rateadas. ` +
        `Ao ser fechada, ela dilui a base da empresa e reduz o rateio médio dos demais contratos em ${fmtPct(p.reducaoRelativaRateioPct || (100 - p.fatorDiluicaoContratos * 100))}. ` +
        `O preço mínimo com margem de lucro sobre o preço de venda é ${fmt(p.precoMinMargemSobrePreco)} (vs. ${fmt(p.precoMinMarkup)} em markup).`
      );
    }

    if (modulo === 'perda') {
      const l = dados as ContractLossResult;
      return (
        `A eventual perda do contrato "${l.contratoNome}" (${fmtPct(l.partOriginalPct)} da receita) sem reposição provocará sobrecarga de +${fmtPct(l.rateioMedioAdicionalPct)} no rateio dos contratos remanescentes. ` +
        `Para manter a relação de rateio estável, é obrigatório cortar ${fmt(l.corteNecessarioDR)}/mês em despesas rateadas. ` +
        `${l.temLucroCessanteAlemDoRateio ? `Adicionalmente, ${fmt(l.lucroCessanteExcedente)}/mês de margem de contribuição além do rateio deixarão de ser gerados.` : ''} ` +
        `A meta de reposição comercial para 100% da perda em ${dados.horizonteMeses || 12} meses é de ${fmt(l.metaMensalReposicao)}/mês.`
      );
    }

    if (modulo === 'rapida' || modulo === 'rubricas') {
      const m = dados as ConsolidatedSimulationMetrics;
      const varRes = m.variacaoResultadoAbsoluta;
      const impactoSinal = varRes >= 0 ? 'ganho' : 'impacto negativo';
      return (
        `O cenário simulado resulta em uma receita de ${fmt(m.receitaSimulada)} e EBITDA de ${fmt(m.ebitdaSimulado)} (${fmtPct(m.ebitdaSimuladoPct)}). ` +
        `Isso representa um ${impactoSinal} de ${fmt(Math.abs(varRes))} no resultado líquido operacional. ` +
        `O novo ponto de equilíbrio (Break-even) passa de ${fmt(m.breakEvenOriginal)} para ${fmt(m.breakEvenSimulado)}.`
      );
    }

    return 'Cenário simulado com sucesso. Examine os cartões de indicadores e os gráficos para detalhamento.';
  }
}
