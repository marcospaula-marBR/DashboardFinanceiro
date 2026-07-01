import os
import requests

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# 1. Buscar registros que mencionam 'Renda Fixa' em categoria
print("--- Buscando categoria 'Renda Fixa' ---")
url = f"{SUPABASE_URL}/rest/v1/dre_lancamentos?categoria=ilike.*Renda%20Fixa*&select=*"
resp = requests.get(url, headers=HEADERS)
if resp.ok:
    data = resp.json()
    print(f"Encontrados {len(data)} registros com categoria 'Renda Fixa':")
    for r in data[:10]:
        print(f"ID: {r.get('id')} | Empresa: {r.get('empresa')} | Conta DRE: {r.get('conta_dre')} | Categoria: {r.get('categoria')} | Valor: {r.get('valor')} | Período: {r.get('periodo')}")
else:
    print(f"Erro na busca: {resp.status_code} - {resp.text}")

# 2. Buscar registros que mencionam 'Renda Fixa' em conta_dre
print("\n--- Buscando conta_dre 'Renda Fixa' ---")
url = f"{SUPABASE_URL}/rest/v1/dre_lancamentos?conta_dre=ilike.*Renda%20Fixa*&select=*"
resp = requests.get(url, headers=HEADERS)
if resp.ok:
    data = resp.json()
    print(f"Encontrados {len(data)} registros com conta_dre 'Renda Fixa':")
    for r in data[:10]:
        print(f"ID: {r.get('id')} | Empresa: {r.get('empresa')} | Conta DRE: {r.get('conta_dre')} | Categoria: {r.get('categoria')} | Valor: {r.get('valor')} | Período: {r.get('periodo')}")
else:
    print(f"Erro na busca: {resp.status_code} - {resp.text}")
