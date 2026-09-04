import os
import requests
from dotenv import load_dotenv

load_dotenv()

def test_omie(name, key, sec):
    print(f"Testing {name}: key={key}")
    url = "https://app.omie.com.br/api/v1/geral/categorias/"
    payload = {
        "call": "ListarCategorias",
        "app_key": key,
        "app_secret": sec,
        "param": [{"pagina": 1, "registros_por_pagina": 1}]
    }
    resp = requests.post(url, json=payload)
    if resp.status_code == 200:
        data = resp.json()
        print(f"  [SUCCESS] {name} conectado! Total categorias: {data.get('total_de_registros')}")
    else:
        print(f"  [ERROR] {name} status={resp.status_code}: {resp.text[:200]}")

test_omie('G2', os.getenv('OMIE_APP_KEY_G2'), os.getenv('OMIE_APP_SECRET_G2'))
test_omie('Conectius', os.getenv('OMIE_APP_KEY_CONECTIUS'), os.getenv('OMIE_APP_SECRET_CONECTIUS'))
