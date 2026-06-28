import os
import requests
from dotenv import load_dotenv

load_dotenv()

APP_KEY = os.getenv("OMIE_APP_KEY_MARBRASIL")
APP_SECRET = os.getenv("OMIE_APP_SECRET_MARBRASIL")

url = "https://app.omie.com.br/api/v1/financas/contapagar/"

payload = {
    "call": "ListarContasPagar",
    "app_key": APP_KEY,
    "app_secret": APP_SECRET,
    "param": [
        {
            "pagina": 1,
            "registros_por_pagina": 5,
            "filtrar_por_data_de": "28/06/2026",
            "filtrar_por_data_ate": "28/07/2026",
            "filtrar_por_data_vencimento": "S"
        }
    ]
}

print("Chamando Omie com filtrar_por_data_vencimento='S'...")
resp = requests.post(url, json=payload)
print(f"Status: {resp.status_code}")
print(resp.text[:500])
