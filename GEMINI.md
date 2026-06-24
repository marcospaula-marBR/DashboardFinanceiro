# GEMINI.md — Regras Universais do Projeto

Este documento define as regras obrigatórias que qualquer agente de IA, desenvolvedor ou assistente de código deve seguir ao trabalhar neste projeto.

Estas regras prevalecem sobre instruções genéricas e devem ser respeitadas em qualquer alteração de código, interface, lógica de negócio, dados, documentação, testes ou arquitetura.

---

## 1. Princípios não negociáveis

1. Nunca alterar código sem antes entender o contexto do projeto.
2. Nunca sobrescrever, apagar, mover ou refatorar arquivos relevantes sem justificativa clara.
3. Nunca alterar regras de negócio sem explicitar o impacto.
4. Nunca modificar dados reais, credenciais, variáveis de ambiente, schemas, migrações ou integrações sem aprovação explícita.
5. Nunca fazer alterações destrutivas.
6. Nunca mascarar erro com solução superficial.
7. Nunca entregar código sem validação mínima.
8. Nunca quebrar funcionalidades existentes para implementar uma nova.
9. Nunca presumir estrutura de dados quando ela puder ser inspecionada.
10. Nunca inventar números, métricas, campos ou regras financeiras.

O projeto deve ser tratado como um produto executivo, financeiro e operacional. Clareza, confiabilidade, rastreabilidade e consistência são mais importantes do que velocidade.

---

## 2. Versionamento obrigatório

Toda alteração deve respeitar o versionamento obrigatório.

**REGRA ABSOLUTA**: É estritamente obrigatório atualizar a versão do sistema a CADA modificação, correção de bug, ou implementação de nova funcionalidade. Nunca encerre uma tarefa ou realize um commit sem antes "bumpar" a versão no arquivo de controle correspondente (ex: `version.ts` ou changelog).

Antes de qualquer mudança:

1. identificar o estado atual;
2. listar arquivos que serão alterados;
3. explicar o objetivo da alteração;
4. registrar o motivo da mudança;
5. preservar compatibilidade com o comportamento atual, salvo instrução contrária.

Depois da alteração:

1. **Atualizar o arquivo de versão (incrementar número da versão e registrar no changelog)**;
2. informar todos os arquivos criados, alterados ou removidos;
3. resumir objetivamente o que mudou;
4. explicar impactos técnicos e funcionais;
5. informar testes executados;
6. informar riscos remanescentes;
7. sugerir próxima versão ou melhoria incremental.

Nenhuma alteração deve ser feita sem rastreabilidade. Quando houver changelog, histórico interno, comentários de versão ou arquivo `version.ts` no projeto, o incremento da versão e o registro da alteração devem ser realizados obrigatoriamente ANTES do commit.

Formato recomendado de registro:

```md
## Versão YYYY-MM-DD-HHMM — [Título curto]

### Objetivo
Descrição objetiva da mudança.

### Arquivos alterados
- arquivo A
- arquivo B

### Mudanças realizadas
- item 1
- item 2

### Impacto funcional
Descrição do impacto para o usuário.

### Impacto técnico
Descrição do impacto no código, dados, performance ou arquitetura.

### Testes realizados
- teste 1
- teste 2

### Riscos ou pendências
- item 1
- item 2
```

---

## 3. Mobile first obrigatório

Todo desenvolvimento visual deve seguir abordagem mobile first.

A interface deve ser desenhada primeiro para telas pequenas e depois expandida para tablet, desktop e telas executivas maiores.

Regras obrigatórias:

1. Nenhum componente deve depender exclusivamente de tela larga.
2. Cards, tabelas, filtros e gráficos devem funcionar bem em mobile.
3. A navegação deve ser simples, com hierarquia clara.
4. Inputs devem ser fáceis de tocar em telas sensíveis ao toque.
5. Modais, drawers e painéis laterais devem ter comportamento adequado em mobile.
6. Tabelas grandes devem ter alternativa responsiva: cards, accordion, scroll controlado ou visão resumida.
7. Gráficos devem manter legibilidade em telas pequenas.
8. Botões principais devem ter área clicável confortável.
9. Informações secundárias devem ficar recolhidas por padrão em mobile.
10. Nada deve ficar inacessível por overflow, corte visual ou dependência de hover.

Breakpoints, classes responsivas ou media queries devem ser aplicados conscientemente, não como ajuste posterior.

---

## 4. Experiência executiva

O projeto deve ser adequado para diretoria, alta gestão e usuários não técnicos.

Toda funcionalidade deve responder rapidamente:

1. O que aconteceu?
2. Por que aconteceu?
3. Qual o impacto financeiro?
4. Qual o risco?
5. Qual a tendência?
6. Qual decisão pode ser tomada?
7. Qual ação reduz o problema?
8. Qual cenário é melhor?

A interface deve priorizar:

1. visão clara;
2. leitura rápida;
3. comparações objetivas;
4. indicadores financeiros relevantes;
5. drill-down quando necessário;
6. explicações executivas;
7. poucos cliques para ações frequentes;
8. linguagem de negócio, não apenas técnica.

Evitar excesso de filtros visíveis ao mesmo tempo. Filtros avançados devem ficar organizados, recolhidos ou separados da visão principal.

---

## 5. Regras para dashboards financeiros e DRE

Sempre preservar a integridade dos dados financeiros.

Ao trabalhar com DRE, receitas, despesas, margens, EBITDA, lucro, centros de custo, departamentos, contratos, rateios ou projeções:

1. nunca misturar dado real com dado simulado sem identificação clara;
2. sempre distinguir cenário base de cenário ajustado;
3. sempre exibir variação absoluta e percentual quando houver comparação;
4. sempre preservar o período de referência;
5. sempre respeitar filtros aplicados pelo usuário;
6. sempre indicar quando valores são projetados, simulados ou realizados;
7. nunca alterar o DRE real para produzir uma simulação;
8. nunca recalcular indicador financeiro sem confirmar sua fórmula no projeto;
9. nunca criar uma métrica nova sem nome, regra e origem;
10. sempre considerar consistência entre cards, gráficos e tabelas.

Toda métrica financeira deve ter origem rastreável.

---

## 6. Simulações e cenários

Simulações devem ser isoladas, auditáveis e reversíveis.

Regras obrigatórias:

1. O cenário base nunca deve ser sobrescrito.
2. Cenários simulados devem ser calculados separadamente.
3. O usuário deve conseguir entender quais premissas geraram o resultado.
4. O sistema deve diferenciar impacto percentual, valor absoluto, valor mensal e valor acumulado.
5. O sistema deve permitir comparação entre base e simulado.
6. O sistema deve permitir análise histórica quando não houver data futura.
7. O sistema deve permitir projeção futura quando houver horizonte definido.
8. O sistema deve registrar premissas usadas.
9. O sistema deve permitir incluir ou excluir despesas rateadas quando aplicável.
10. O sistema deve evitar efeitos colaterais em dados reais.

O motor de simulação deve ficar separado da interface.

Cálculos financeiros devem ser implementados preferencialmente em funções puras, testáveis e reutilizáveis.

---

## 7. IA integrada

Qualquer funcionalidade de IA deve respeitar os dados calculados pelo sistema.

A IA pode:

1. resumir resultados;
2. explicar impactos;
3. apontar riscos;
4. sugerir perguntas executivas;
5. comparar cenários;
6. identificar principais drivers;
7. propor ações;
8. gerar textos para análise gerencial.

A IA não pode:

1. inventar números;
2. alterar dados reais;
3. criar métricas sem base;
4. omitir premissas relevantes;
5. apresentar projeção como fato realizado;
6. substituir cálculo determinístico por resposta textual;
7. gerar conclusão sem indicar a base usada.

Toda análise por IA deve ser derivada de dados estruturados, calculados e disponíveis no sistema.

Quando houver incerteza, a IA deve explicitar a limitação.

---

## 8. Arquitetura e separação de responsabilidades

O código deve ser modular, legível e sustentável.

Separar claramente:

1. componentes visuais;
2. regras de negócio;
3. cálculos financeiros;
4. chamadas de API;
5. transformação de dados;
6. validação de inputs;
7. estado da interface;
8. persistência;
9. testes;
10. tipos/interfaces.

Evitar componentes grandes demais.

Evitar lógica financeira dentro de JSX, templates ou componentes visuais.

Evitar duplicação de regras.

Evitar funções com múltiplas responsabilidades.

Preferir nomes claros, explícitos e alinhados ao domínio de negócio.

---

## 9. Inspeção antes da implementação

Antes de implementar qualquer demanda relevante, o agente deve inspecionar o projeto e responder com:

1. entendimento da demanda;
2. arquivos provavelmente envolvidos;
3. componentes existentes relacionados;
4. dados ou estruturas já disponíveis;
5. lacunas encontradas;
6. proposta de solução;
7. riscos;
8. plano de implementação;
9. plano de testes.

Implementações grandes devem ser divididas em fases.

Não implementar tudo de uma vez quando a entrega puder ser incremental.

---

## 10. Critérios de aceite

Toda entrega deve ter critérios claros de aceite.

Uma entrega só deve ser considerada concluída quando:

1. o comportamento esperado foi implementado;
2. não houve quebra aparente de funcionalidades existentes;
3. os dados reais foram preservados;
4. a interface funciona em mobile;
5. a interface funciona em desktop;
6. os principais fluxos foram testados;
7. erros e estados vazios foram tratados;
8. loading states foram considerados quando necessário;
9. o código está organizado;
10. a alteração foi registrada no versionamento.

Quando não for possível testar algo, informar claramente.

---

## 11. Testes obrigatórios

Sempre que houver regra de negócio, cálculo financeiro, transformação de dados ou simulação, criar ou atualizar testes.

Testar no mínimo:

1. caso padrão;
2. caso vazio;
3. caso com valores zerados;
4. caso com valores negativos, quando aplicável;
5. caso com percentual;
6. caso com valor absoluto;
7. caso com múltiplos períodos;
8. caso com filtro aplicado;
9. caso com inclusão/exclusão de rateios;
10. caso de erro ou entrada inválida.

Testes devem validar comportamento, não apenas implementação.

---

## 12. Dados, segurança e privacidade

Nunca expor ou registrar indevidamente:

1. credenciais;
2. tokens;
3. secrets;
4. dados pessoais;
5. dados financeiros sensíveis;
6. informações internas;
7. variáveis de ambiente;
8. payloads completos sem necessidade.

Nunca inserir credenciais no código.

Nunca gerar mocks com dados reais sensíveis.

Nunca enviar dados sensíveis para IA externa sem autorização explícita.

Logs devem ser úteis, mas não devem vazar informações críticas.

---

## 13. Performance

Dashboards e simulações devem ser responsivos.

Regras:

1. evitar recalcular tudo desnecessariamente;
2. memoizar cálculos pesados quando fizer sentido;
3. evitar renderizações excessivas;
4. paginar, agrupar ou virtualizar listas grandes quando necessário;
5. reduzir transformações repetidas;
6. manter gráficos performáticos;
7. evitar chamadas duplicadas de API;
8. preservar boa experiência em mobile.

Cálculos pesados devem ser isolados e otimizáveis.

---

## 14. Acessibilidade e usabilidade

A interface deve ser utilizável por pessoas reais em contexto profissional.

Regras:

1. botões devem ter rótulos claros;
2. inputs devem ter labels;
3. estados de erro devem ser compreensíveis;
4. contraste visual deve ser adequado;
5. navegação por teclado deve ser considerada;
6. gráficos devem ter títulos e contexto;
7. cores não devem ser o único meio de transmitir informação;
8. tabelas devem ter cabeçalhos claros;
9. mensagens vazias devem orientar o usuário;
10. confirmações devem existir para ações críticas.

---

## 15. Gráficos e visualizações

Gráficos devem contar uma história de negócio.

Todo gráfico deve ter:

1. título claro;
2. período de referência;
3. unidade de medida;
4. legenda quando necessário;
5. comparação com base quando aplicável;
6. destaque para variações relevantes;
7. leitura adequada em mobile;
8. consistência com os cards e tabelas.

Para dashboards executivos, priorizar:

1. cards de KPI;
2. linha temporal;
3. barras comparativas;
4. waterfall de impacto;
5. ranking de maiores variações;
6. tabela detalhada;
7. heatmap quando houver matriz mês x categoria;
8. análise de sensibilidade quando houver cenários.

Não criar gráfico decorativo sem utilidade decisória.

---

## 16. Estados da interface

Toda tela ou componente relevante deve tratar:

1. carregando;
2. sem dados;
3. erro;
4. sucesso;
5. filtro sem resultado;
6. permissão insuficiente, se aplicável;
7. simulação sem premissas;
8. dados inconsistentes;
9. ação em processamento;
10. confirmação de ação crítica.

O usuário nunca deve ficar sem feedback.

---

## 17. Escrita, nomenclatura e domínio

Usar linguagem clara, profissional e alinhada ao negócio.

Preferir termos como:

1. cenário base;
2. cenário simulado;
3. realizado;
4. projetado;
5. variação absoluta;
6. variação percentual;
7. impacto acumulado;
8. margem;
9. receita;
10. despesa;
11. departamento/contrato;
12. rateio;
13. recomposição;
14. projeção;
15. premissa.

Evitar termos técnicos desnecessários na interface executiva.

No código, usar nomes explícitos e consistentes com o domínio.

---

## 18. Fluxo obrigatório para agentes de IA

Para qualquer solicitação relevante, seguir este fluxo:

1. Ler a demanda.
2. Inspecionar o projeto.
3. Identificar arquivos relacionados.
4. Explicar entendimento.
5. Propor plano.
6. Aguardar aprovação quando a mudança for grande, sensível ou estrutural.
7. Implementar incrementalmente.
8. Testar.
9. Registrar versionamento.
10. Resumir entrega.

Para mudanças pequenas e seguras, implementar diretamente, mas ainda assim registrar:

1. o que foi feito;
2. onde foi feito;
3. como testar;
4. riscos ou limitações.

---

## 19. Restrições para comandos e dependências

Não executar comandos destrutivos.

Não usar:

```bash
rm -rf
git reset --hard
git clean -fd
drop database
truncate
delete sem filtro
```

Não instalar dependências sem justificar.

Antes de adicionar biblioteca, avaliar:

1. se o projeto já possui alternativa;
2. impacto no bundle;
3. manutenção;
4. compatibilidade;
5. necessidade real.

Preferir solução simples, nativa e coerente com a stack existente.

---

## 20. Entrega final obrigatória

Ao final de cada tarefa, responder com:

1. resumo da alteração;
2. arquivos alterados;
3. regras de negócio implementadas;
4. impactos no usuário;
5. validações/testes realizados;
6. limitações conhecidas;
7. próxima melhoria recomendada.

Formato recomendado:

```md
## Entrega concluída

### Resumo
...

### Arquivos alterados
- ...

### Regras implementadas
- ...

### Como validar
1. ...
2. ...

### Testes realizados
- ...

### Riscos ou pendências
- ...

### Próxima evolução recomendada
...
```

---

## 21. Regra de ouro

O projeto deve evoluir como um sistema confiável para tomada de decisão executiva.

Sempre priorizar:

1. precisão;
2. rastreabilidade;
3. clareza;
4. segurança;
5. responsividade;
6. experiência executiva;
7. consistência financeira;
8. manutenção futura.

Não entregar apenas “algo que funciona”.

Entregar algo que possa ser confiado.
