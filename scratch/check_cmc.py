import os
import requests

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

print("--- Buscando CMC ou Custo Médio ---")
url = f"{SUPABASE_URL}/rest/v1/dre_lancamentos?or=(categoria.ilike.*CMC*,conta_dre.ilike.*CMC*,categoria.ilike.*Custo%20M%C3%A9dio*,conta_dre.ilike.*Custo%20M%C3%A9dio*)&select=*"
resp = requests.get(url, headers=HEADERS)
if resp.ok:
    data = resp.json()
    print(f"Encontrados {len(data)} registros:")
    for r in data[:10]:
        print(f"ID: {r.get('id')} | Empresa: {r.get('empresa')} | Conta DRE: {r.get('conta_dre')} | Categoria: {r.get('categoria')} | Valor: {r.get('valor')} | Período: {r.get('periodo')}")
else:
    print(f"Erro: {resp.status_code} - {resp.text}")
