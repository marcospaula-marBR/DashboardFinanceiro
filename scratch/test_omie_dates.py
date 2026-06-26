import os
import requests
from dotenv import load_dotenv

# Carregar variáveis do .env do dashboard-v2
load_dotenv("dashboard-v2/.env")

key = os.getenv("OMIE_APP_KEY_MARBRASIL")
secret = os.getenv("OMIE_APP_SECRET_MARBRASIL")

print(f"Key: {key[:10] if key else 'None'}...")
print(f"Secret: {secret[:10] if secret else 'None'}...")

url = "https://app.omie.com.br/api/v1/financas/contapagar/"

br_start = "26/06/2026"
br_end = "26/07/2026"

payload = {
    "call": "ListarContasPagar",
    "app_key": key,
    "app_secret": secret,
    "param": [{
        "pagina": 1,
        "registros_por_pagina": 100,
        "filtrar_por_data_de": br_start,
        "filtrar_por_data_ate": br_end
    }]
}

resp = requests.post(url, json=payload)
print(f"Status Code: {resp.status_code}")
data = resp.json()

if "faultstring" in data:
    print(f"Erro: {data['faultstring']}")
else:
    records = data.get("conta_pagar_cadastro", [])
    print(f"Encontrados {len(records)} registros para Mar Brasil no período {br_start} a {br_end}")
    for idx, r in enumerate(records[:15]):
        print(f"[{idx+1}] ID: {r.get('codigo_lancamento_omie')} | Venc: {r.get('data_vencimento')} | Emissao: {r.get('data_emissao')} | Status: {r.get('status_titulo')} | Valor: {r.get('valor_documento')} | Forn: {r.get('nm_cliente')}")
