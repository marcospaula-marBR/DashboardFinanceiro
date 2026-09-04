# Simulador de Precificação e Cenários — Especificação Funcional
### Módulo complementar ao DRE (Mar Brasil) — visão de CFO

---

## 0. Objetivo

Estender o simulador de DRE já existente com duas capacidades novas, alimentadas por dados reais importados do DRE:

1. **Precificação de propostas em licitação** — calcular quanto uma nova oportunidade de contrato deveria absorver de despesas rateadas, com base na sua participação estimada no faturamento.
2. **Simulador de cenários de perda de contrato** — projetar o impacto financeiro de perder um contrato existente e quantificar o que é necessário para neutralizar esse impacto (novo faturamento ou corte de despesas).

Os dois módulos compartilham a mesma lógica-base: **o rateio de despesas é proporcional à participação percentual de cada contrato no faturamento total do período**. Essa regra já está definida no DRE atual e não deve ser alterada — os módulos apenas a aplicam de forma prospectiva (simulação) em vez de só retrospectiva (apuração).

---

## 1. Conceitos e variáveis-base

| Símbolo | Significado |
|---|---|
| `FT_p` | Faturamento total do período de referência (soma de todos os contratos ativos) |
| `F_c` | Faturamento do contrato `c` no período |
| `Part_c` | Participação percentual do contrato `c` = `F_c / FT_p` |
| `DR_p` | Total de despesas rateadas do período (filtro já existente no DRE) |
| `Rateio_c` | Valor de despesa rateada absorvido pelo contrato `c` = `Part_c × DR_p` |
| `CD_c` | Custo direto do contrato `c` (vinculado à produção/execução, não é rateado) |

**Premissa central a deixar explícita no sistema:** no curto/médio prazo, `DR_p` é tratada como **relativamente fixa** (estrutura administrativa, não escala 1:1 com cada contrato). Isso é o que torna o rateio percentual sensível a ganho ou perda de contratos — é a mecânica que os dois módulos exploram. O sistema deve alertar o usuário sempre que uma simulação implicar necessidade de estrutura adicional (equipe, sistema, espaço), pois nesse caso o correto é lançar como **custo direto novo**, não diluir no rateio.

---

## 2. Módulo 1 — Precificação de Nova Proposta

### 2.1 Entradas
- Período de referência (mês ou acumulado, herdado do DRE real).
- `F_novo`: faturamento estimado do novo contrato/proposta (mensal).
- `CD_novo`: custo direto estimado do novo contrato (mão de obra, insumos, etc. — se o usuário não souber, sugerir puxar a média de custo direto/faturamento de contratos semelhantes já no DRE).
- Margem mínima desejada (%) e método (markup sobre custo **ou** margem sobre preço — oferecer os dois, com o sistema deixando claro a diferença numérica entre eles).

### 2.2 Cálculo (abordagem marginal — é a correta do ponto de vista de CFO)

```
FT_novo   = FT_p + F_novo                 // nova base de faturamento, incluindo a proposta
Part_novo = F_novo / FT_novo
Rateio_novo = Part_novo × DR_p            // quanto a proposta teria que absorver
```

**Efeito colateral que o sistema deve mostrar (é o insight mais valioso deste módulo):**
ao entrar um novo contrato, a base `FT_novo` cresce e a participação de *todos os contratos existentes* dilui:

```
Part_c'   = F_c / FT_novo        (para cada contrato já existente)
Rateio_c' = Part_c' × DR_p        → sempre menor que o Rateio_c atual
```

Isso serve de argumento interno: "fechar este contrato reduz o rateio de todos os outros em X".

### 2.3 Preço mínimo sugerido
```
Custo_Total_novo = CD_novo + Rateio_novo

// Método A — markup sobre custo:
Preco_min_A = Custo_Total_novo × (1 + margem_desejada%)

// Método B — margem sobre preço (mais usado para leitura de rentabilidade %):
Preco_min_B = Custo_Total_novo / (1 - margem_desejada%)
```
Mostrar os dois lado a lado, com a diferença percentual entre eles, para evitar erro clássico de confundir markup com margem.

### 2.4 Exemplo numérico (para teste)
- `FT_p` = R$ 1.000.000 | `DR_p` = R$ 80.000
- Proposta: `F_novo` = R$ 150.000 | `CD_novo` = R$ 90.000 | margem desejada = 15%

```
FT_novo   = 1.150.000
Part_novo = 150.000 / 1.150.000 = 13,04%
Rateio_novo = 13,04% × 80.000 = R$ 10.435
Custo_Total_novo = 90.000 + 10.435 = R$ 100.435
Preco_min_A (markup) = 100.435 × 1,15 = R$ 115.500
Preco_min_B (margem s/ preço) = 100.435 / 0,85 = R$ 118.159
```
E mostrar o efeito diluição: todo contrato existente reduz seu rateio pela razão `FT_p / FT_novo` = 86,96%.

### 2.5 Alertas do sistema
- Se `F_novo` for grande o suficiente para exigir nova estrutura (regra prática: acima de X% do `FT_p` — parametrizável), avisar que `DR_p` pode não se manter constante e sugerir revisão manual.
- Se a margem resultante ficar abaixo de um piso configurável, sinalizar risco antes de liberar o preço para a licitação.

---

## 3. Módulo 2 — Simulador de Cenário de Perda de Contrato

### 3.1 Entradas
- Contrato a simular a perda (selecionado dentre os ativos, com `F_X`, `CD_X`, `Part_X` puxados automaticamente do histórico real/médio).
- Horizonte até a perda: `N` meses.
- Meta de reposição: 0% a 100% (permitir simular parcial).
- (Opcional) buffer de segurança em % sobre a meta mensal, para compensar taxa de conversão de propostas.

### 3.2 Passo 1 — Impacto bruto imediato
```
Perda_faturamento_mensal = F_X
Reducao_custo_direto      = CD_X          // some automaticamente, pois está vinculado à produção
Margem_contrib_perdida    = F_X − CD_X    // o que esse contrato deixava de "sobra" para pagar rateio + lucro
```

### 3.3 Passo 2 — Redistribuição do rateio remanescente (se nada for feito)
```
FT_pos_perda = FT_p − F_X
DR_p permanece igual (não desaparece sozinha)

Para cada contrato remanescente c:
  Part_c_novo   = F_c / FT_pos_perda        → sobe
  Rateio_c_novo = Part_c_novo × DR_p        → sobe, mesmo com F_c inalterado
```
Este é o número que precisa aparecer em destaque: "cada contrato remanescente vai absorver, em média, +X% de rateio se nada for feito".

### 3.4 Passo 3 — Cenário SEM substituição: corte necessário em despesas fixas/rateadas
Para manter a relação `DR/FT` constante (ou seja, não sobrecarregar os contratos que ficaram), o corte necessário em `DR_p` é:
```
Corte_necessario_DR = Part_X × DR_p
```
Isso mantém o rateio-por-real-de-faturamento dos contratos remanescentes igual ao que era antes da perda.

**Camada adicional (mostrar como alerta, não só como número):** se `Margem_contrib_perdida` (F_X − CD_X) for maior que `Corte_necessario_DR`, significa que o contrato também gerava lucro líquido além de cobrir seu rateio — nesse caso, cobrir só o rateio não é suficiente para manter o resultado da empresa; o sistema deve indicar isso separadamente ("corte para manter rateio" vs. "corte adicional para manter margem de lucro").

### 3.5 Passo 4 — Cenário COM substituição: meta mensal de novos contratos
```
Meta_mensal_reposicao = (F_X × %meta_reposicao) / N
```
Com buffer opcional:
```
Meta_mensal_com_buffer = Meta_mensal_reposicao × (1 + buffer%)
```

### 3.6 Passo 5 — Tabela de sensibilidade (gerar automaticamente 3 cenários)
| Cenário | % Reposição | Meta mensal de novo faturamento | Corte necessário em DR |
|---|---|---|---|
| Otimista | 100% | `F_X / N` | R$ 0 |
| Intermediário | 50% | `(F_X × 0,5) / N` | `Part_X × DR_p × 0,5` |
| Conservador | 0% | R$ 0 | `Part_X × DR_p` |

### 3.7 Exemplo numérico (para teste)
- `FT_p` = R$ 1.000.000 | `DR_p` = R$ 80.000
- Contrato X: `F_X` = R$ 200.000 (Part_X = 20%) | `CD_X` = R$ 130.000
- Horizonte: `N` = 12 meses

```
Margem_contrib_perdida = 200.000 − 130.000 = R$ 70.000
FT_pos_perda = 800.000
Rateio médio dos remanescentes sobe na proporção 1.000.000/800.000 = 25% a mais, em cada contrato

Corte_necessario_DR (cenário conservador) = 20% × 80.000 = R$ 16.000
  → mas a margem de contribuição perdida era R$ 70.000, então R$ 54.000 além do rateio
    também deixam de ser gerados — isso deve aparecer como alerta de resultado, não só de rateio.

Meta_mensal_reposicao (100%) = 200.000 / 12 = R$ 16.667/mês
Meta_mensal_reposicao (50%)  = R$ 8.333/mês
```

---

## 4. Estrutura de dados sugerida (integração com o DRE existente)

```
Contrato {
  id, nome,
  faturamento_medio_mensal,   // vem do DRE, últimos N meses ou período selecionado
  custo_direto_medio_mensal,  // centro de custo vinculado
  periodo_referencia
}

Periodo {
  faturamento_total (FT_p),
  despesas_rateadas_total (DR_p),  // já filtrado conforme regra existente
  lista_contratos[]
}
```
Ambos os módulos leem `Periodo` e `Contrato[]` diretamente do DRE — nenhuma duplicação manual de dados.

---

## 5. Camada de IA (insights automáticos, consistente com os outros módulos do sistema)
Gerar texto curto automático após cada simulação, por exemplo:
- Módulo 1: *"Esta proposta representaria 13% do faturamento total e absorveria R$ 10.435 de rateio. Ao ser fechada, reduz o rateio médio dos demais contratos em ~13%."*
- Módulo 2: *"Perder o Contrato X sem substituição eleva o rateio médio dos contratos remanescentes em 25% e exige corte de R$ 16.000/mês em despesas rateadas apenas para manter o rateio atual — sem considerar os R$ 54.000/mês de margem de contribuição também perdidos."*

## 6. Diretrizes de UX — múltiplos níveis de analista
- **Modo resumo**: 3–4 números-chave em destaque (ex: preço mínimo sugerido, ou meta mensal de reposição), com o texto de insight da IA.
- **Modo detalhado (toggle)**: exibir todas as fórmulas, tabela por contrato, e a tabela de sensibilidade completa — para quem precisa auditar ou apresentar internamente.
- Sempre expor as premissas assumidas (ex: "DR_p tratada como fixa neste cenário") de forma visível, não escondida em rodapé — evita decisão errada por premissa não lida.

## 7. Limitações a declarar explicitamente no sistema
- O rateio marginal assume que `DR_p` não muda com o novo contrato/perda — válido dentro da capacidade ociosa atual; acima de um certo volume, isso deixa de valer.
- O modelo não substitui análise de viabilidade de cada contrato individualmente (prazo, risco de inadimplência, capital de giro) — é uma ferramenta de precificação e sensibilidade de rateio, não uma avaliação de risco completa.
- Custo direto (`CD_c`) precisa estar corretamente segregado no DRE (não pode conter nada que na prática seja fixo/estrutural), senão o cálculo de "custo que some automaticamente" fica incorreto.
