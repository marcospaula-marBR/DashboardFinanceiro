import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

key_mb = os.getenv("OMIE_APP_KEY_MARBRASIL")
secret_mb = os.getenv("OMIE_APP_SECRET_MARBRASIL")

key_dzm = os.getenv("OMIE_APP_KEY_DZM")
secret_dzm = os.getenv("OMIE_APP_SECRET_DZM")

def call_omie(url, call_name, param, key, secret):
    payload = {
        "call": call_name,
        "app_key": key,
        "app_secret": secret,
        "param": [param]
    }
    headers = {"Content-Type": "application/json"}
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=15)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"Exception: {e}")
    return None

print("=== APERFEIÇOAMENTO DA ANÁLISE DE DATAS DE REGISTRO NO OMIE ===")

# 1. Contas a Receber
res_cr = call_omie(
    "https://app.omie.com.br/api/v1/financas/contareceber/",
    "ListarContasReceber",
    {"pagina": 1, "registros_por_pagina": 10},
    key_mb, secret_mb
)

if res_cr and "conta_receber_cadastro" in res_cr:
    print("\n--- CONTAS A RECEBER (ListarContasReceber) ---")
    for i, item in enumerate(res_cr["conta_receber_cadastro"][:5]):
        print(f"\n[Registro {i+1}] Doc: {item.get('numero_documento_fiscal') or item.get('numero_documento')} | Cliente ID: {item.get('codigo_cliente_fornecedor')}")
        print(f"  - data_registro:  {item.get('data_registro')}")
        print(f"  - data_emissao:   {item.get('data_emissao')}")
        print(f"  - data_vencimento:{item.get('data_vencimento')}")
        print(f"  - data_previsao:  {item.get('data_previsao')}")
        info = item.get("info", {})
        print(f"  - info.dInc (Data Inclusao Sistema): {info.get('dInc')} ás {info.get('hInc')}")
        print(f"  - info.dAlt (Data Alteração):        {info.get('dAlt')} ás {info.get('hAlt')}")

# 2. Ordens de Serviço
res_os = call_omie(
    "https://app.omie.com.br/api/v1/servicos/os/",
    "ListarOS",
    {"pagina": 1, "registros_por_pagina": 10},
    key_mb, secret_mb
)

if res_os and "osCadastro" in res_os:
    print("\n--- ORDENS DE SERVIÇO (ListarOS) ---")
    for i, item in enumerate(res_os["osCadastro"][:5]):
        cab = item.get("Cabecalho", {})
        inf = item.get("InfoCadastro", {})
        print(f"\n[OS {i+1}] Num OS: {cab.get('cNumOS')} | Valor: R$ {cab.get('nValorTotal')}")
        print(f"  - InfoCadastro.dDtInc (Data Inclusao OS): {inf.get('dDtInc')} às {inf.get('cHrInc')}")
        print(f"  - InfoCadastro.dDtFat (Data Faturamento):   {inf.get('dDtFat')} às {inf.get('cHrFat')}")
        print(f"  - Cabecalho.dDtPrevisao:                  {cab.get('dDtPrevisao')}")

# 3. Consultar Lançamento Detalhado de Conta a Receber (ConsultarContaReceber)
sample_id = res_cr["conta_receber_cadastro"][0].get("codigo_lancamento_omie")
res_cr_det = call_omie(
    "https://app.omie.com.br/api/v1/financas/contareceber/",
    "ConsultarContaReceber",
    {"codigo_lancamento_omie": sample_id},
    key_mb, secret_mb
)

if res_cr_det:
    print("\n--- DETALHAMENTO DE UMA CONTA A RECEBER (ConsultarContaReceber) ---")
    print(f"ID Omie: {sample_id}")
    print(f"  - data_registro:   {res_cr_det.get('data_registro')}")
    print(f"  - data_emissao:    {res_cr_det.get('data_emissao')}")
    print(f"  - data_vencimento: {res_cr_det.get('data_vencimento')}")
    print(f"  - data_entrada:    {res_cr_det.get('data_entrada')}")
    info = res_cr_det.get("info", {})
    print(f"  - info.dInc:       {info.get('dInc')}")
