import os
import requests
from dotenv import load_dotenv

load_dotenv()

def check_counts(name, key, sec):
    print(f"\n--- Checando volumes para {name} ---")
    
    # 1. Contas a Pagar
    url_cp = "https://app.omie.com.br/api/v1/financas/contapagar/"
    resp_cp = requests.post(url_cp, json={
        "call": "ListarContasPagar",
        "app_key": key,
        "app_secret": sec,
        "param": [{"pagina": 1, "registros_por_pagina": 1, "filtrar_por_data_de": "01/01/2024"}]
    })
    tot_cp = resp_cp.json().get("total_de_registros", 0) if resp_cp.status_code == 200 else resp_cp.text[:100]
    print(f"  Contas a Pagar (desde 2024): {tot_cp}")

    # 2. Contas a Receber
    url_cr = "https://app.omie.com.br/api/v1/financas/contareceber/"
    resp_cr = requests.post(url_cr, json={
        "call": "ListarContasReceber",
        "app_key": key,
        "app_secret": sec,
        "param": [{"pagina": 1, "registros_por_pagina": 1, "filtrar_por_data_de": "01/01/2024"}]
    })
    tot_cr = resp_cr.json().get("total_de_registros", 0) if resp_cr.status_code == 200 else resp_cr.text[:100]
    print(f"  Contas a Receber (desde 2024): {tot_cr}")

    # 3. Movimentos
    url_mov = "https://app.omie.com.br/api/v1/financas/mf/"
    resp_mov = requests.post(url_mov, json={
        "call": "ListarMovimentos",
        "app_key": key,
        "app_secret": sec,
        "param": [{"nPagina": 1, "nRegPorPagina": 1, "dDtPagtoDe": "01/01/2024"}]
    })
    tot_mov = resp_mov.json().get("nTotRegistros", 0) if resp_mov.status_code == 200 else resp_mov.text[:100]
    print(f"  Movimentos Bancários (desde 2024): {tot_mov}")

check_counts('G2', os.getenv('OMIE_APP_KEY_G2'), os.getenv('OMIE_APP_SECRET_G2'))
check_counts('Conectius', os.getenv('OMIE_APP_KEY_CONECTIUS'), os.getenv('OMIE_APP_SECRET_CONECTIUS'))
