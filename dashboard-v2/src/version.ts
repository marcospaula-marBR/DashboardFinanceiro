export const APP_VERSION = "v.02.45.5";
export const VERSION_DATE = "2026-06-02";
export const VERSION_CHANGELOG = [
  "v.02.45.5 - Fix: Refatoração do dynamic require do pdf.service para import() dinâmico assíncrono eliminando alertas do linter.",
  "v.02.45.4 - Feat: Centralização da Ficha do Colaborador (Modal) com fontes e paddings ampliados para melhor legibilidade.",
  "v.02.45.3 - Feat: Geração da planilha unificada Dados_Consolidados_RH.xlsx contendo dados do Supabase e da planilha Dianna para limpeza.",
  "v.02.45.2 - Fix: Mapeamento de datas de admissão e desligamento e tratamento de data vazia (convertendo string vazia para null) ao salvar.",
  "v.02.45.1 - Fix: Correção crítica de colunas SQL e mapeamento de dados dos colaboradores no cockpit.",
  "v.02.45.0 - Feat: Nova versão renomeada para forçar atualização de cache e verificação do deploy.",
  "v.02.44.0 - Feat: Segregação completa de empréstimos na página People e criação do gráfico de folha Dianna.",
  "v.02.43.0 - Fix: Resolvido erro de compilação no Vercel adicionando o export faltante DEFAULT_DRE_ESTRUTURA no dre.service.ts.",
  "v.02.42.0 - Fix: Aplicação final da injeção do template DRE (DEFAULT_DRE_ESTRUTURA) na página.",
  "v.02.41.0 - Fix: Resolvido erro crítico no brisinhai.js (isResizing) que travava a execução do JavaScript.",
  "v.02.40.0 - Fix: Estrutura DRE inlinada no serviço — elimina falha silenciosa de fetch do template JSON.",
  "v.02.39.0 - Fix: DRE CSV agora parseado corretamente com delimitador ponto-e-vírgula (;) padrão BR.",
  "v.02.38.0 - Fix: Cadeia de fallback completa para resolver fornecedor em CP, CR e MOVIMENTO.",
];
