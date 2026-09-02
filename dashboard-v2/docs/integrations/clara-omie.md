# Integração Clara Cartões → Omie ERP

Guia técnico e operacional completo da integração entre a **Clara Cartões** e o **Omie ERP**, implementada no Dashboard Financeiro.

---

## 1. Visão Geral & Arquitetura

O módulo funciona como uma **ponte operacional e autônoma** de alta confiabilidade entre a API oficial da Clara Brasil e a API do Omie ERP.

> **Importante**: Esta integração **não alimenta nem altera** os relatórios financeiros do dashboard (DRE, Fluxo de Caixa, etc.). O dashboard financeiro continua sendo abastecido exclusivamente pelos relatórios exportados do Omie (processo CSV / *"Base para IA tratar"*).

### Fluxo de Dados:
```text
CLARA CARDS (Brasil)
  ├── Transactions API v3 (GET /api/v3/transactions)
  └── Documents API (GET /api/v3/transactions/{id}/documents)
          │
          ▼ (mTLS + OAuth 2.0 Client Credentials)
DASHBOARD (Serviço de Sincronização)
  ├── 1. Espelho Local (clara_transactions com UNIQUE clara_uuid)
  ├── 2. Auditoria & Idempotência (CL + SHA256)
  └── 3. Motor de De-Para (Categorias & Departamentos)
          │
          ▼ (APIs Oficiais Omie)
OMIE ERP
  ├── /api/v1/financas/contacorrentelancamentos/ (IncluirLancCC)
  │    └── Criação do lançamento em conta corrente (tipo CR)
  └── /api/v1/geral/anexo/ (IncluirAnexo)
       └── Vinculação do comprovante/PDF em base64 (cTabela: "conta-corrente-lancamento")
```

---

## 2. Autenticação Clara (Brasil)

A Clara exige autenticação mTLS de ponta a ponta com OAuth 2.0:
- **Base URL**: `https://public-api.br.clara.com`
- **Token Endpoint**: `POST /oauth/token` (grant_type: `client_credentials`)
- **mTLS**: O `https.Agent` do Node.js carrega o Certificado (`client.crt`) e a Chave Privada (`client.key`) diretamente na camada de transporte TLS.
- **Cache de Token**: O token de acesso fica em memória e é renovado 5 minutos antes da expiração. Em caso de HTTP 401, o token é invalidado e uma nova tentativa automática única é realizada.

---

## 3. Idempotência Estrita & Anti-Duplicidade

1. **UUID da Clara**: Cada transação na Clara possui um UUID único (ex: `4ea5a94a-2c3c-4601-b623-c30260c21dbc`).
2. **Identificador de Integração Omie (`cCodIntLanc`)**:
   - Algoritmo determinístico: `'CL' + SHA256(clara_uuid).substring(0, 18).toUpperCase()`
   - Exemplo: `CL83721AF0166F8C812A`
   - O mesmo `clara_uuid` sempre produzirá exatamente o mesmo `cCodIntLanc`.
3. **Bloqueio de Duplicidade**:
   - Antes de qualquer envio, o sistema verifica se `omie_launch_id` já existe localmente. Se existir, o lançamento nunca é recriado.
   - Caso um lançamento já tenha sido criado no Omie mas o comprovante não tenha subido por oscilação de rede, reprocessamentos subsequentes enviarão apenas o anexo (`IncluirAnexo`).

---

## 4. Estrutura do Banco de Dados

Arquivo de migration: `supabase/migrations/20260902_clara_omie_integration.sql`

1. `clara_config`: Armazena credenciais da Clara, ID da conta Omie vinculada (`omie_n_cod_cc`), modo de teste (`safe_mode`), fallbacks e intervalo de sincronização.
2. `clara_transactions`: Registro atômico de cada transação Clara com espelho completo, dados Omie (`omie_launch_id`, `omie_integration_id`), status de anexo e status de sincronização (`PENDING`, `MAPPING_REQUIRED`, `READY`, `SYNCED`, `IGNORED`, `ERROR`).
3. `clara_category_mappings`: Tabela de De-Para (Categoria Clara → Categoria Omie).
4. `clara_department_mappings`: Tabela de De-Para (Portador/Label Clara → Departamento Omie).
5. `clara_sync_runs`: Histórico de execuções com contadores de transações, anexos e status.
6. `clara_sync_logs`: Auditoria detalhada por transação.

---

## 5. Endpoints Internos da Aplicação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/clara/config` | Consulta configuração (com mascaramento de chaves) |
| `POST` | `/api/clara/config` | Salva configuração e vínculo de conta |
| `POST` | `/api/clara/test` | Testa conexão mTLS + OAuth com a Clara |
| `GET` | `/api/clara/omie-resources` | Lista contas tipo CR, categorias e departamentos do Omie |
| `GET` | `/api/clara/transactions` | Lista transações com filtros e métricas |
| `POST` | `/api/clara/transactions/[id]` | Reprocessa ou ignora transação |
| `POST` | `/api/clara/sync` | Dispara sincronização (manual ou agendada) |
| `GET/PUT/DELETE` | `/api/clara/mappings/categories` | CRUD de mapeamento de categorias |
| `GET/PUT/DELETE` | `/api/clara/mappings/departments` | CRUD de centros de custo |
| `GET` | `/api/clara/sync-runs` | Histórico de execuções |

---

## 6. Como Operar o Módulo

1. **Acessar a tela**: Vá em `/clara` ou clique no card **Clara → Omie** na página inicial.
2. **Configuração Inicial**:
   - Clique em **Configurações**.
   - Insira o Client ID, Client Secret, Certificado PEM e Chave Privada PEM da Clara.
   - Clique em **Testar Conexão Clara**.
   - No campo **Conta Corrente da Clara no Omie**, selecione a conta de cartão corporativo da Clara cadastrada no Omie.
   - Defina os fallbacks de categoria e departamento.
   - Clique em **Salvar Configurações**.
3. **Mapeamento de Categorias**:
   - Clique em **Mapear Categorias** para vincular os tipos de gastos mais comuns aos códigos de categoria do Omie.
4. **Sincronização**:
   - Clique em **Sincronizar Agora**.
   - Enquanto o **Modo de Teste** estiver ativo, as transações serão baixadas, mapeadas e ficarão como `READY` sem lançar no Omie.
   - Ao confirmar que os dados estão corretos, desative o Modo de Teste nas Configurações para que as transações e seus comprovantes subam ao Omie.
