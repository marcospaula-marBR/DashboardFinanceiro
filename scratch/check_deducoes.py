import os
import requests

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

print("--- Buscando Deduções ---")
url = f"{SUPABASE_URL}/rest/v1/dre_lancamentos?or=(categoria.ilike.*Dedu%C3%A7%C3%B5es*,conta_dre.ilike.*Dedu%C3%A7%C3%B5es*,categoria.ilike.*Dedu%C3%A7%C3%A3o*,conta_dre.ilike.*Dedu%C3%A7%C3%A3o*)&select=*"
resp = requests.get(url, headers=HEADERS)
if resp.ok:
    data = resp.json()
    print(f"Encontrados {len(data)} registros:")
    for r in data[:10]:
        print(f"ID: {r.get('id')} | Empresa: {r.get('empresa')} | Conta DRE: {r.get('conta_dre')} | Categoria: {r.get('categoria')} | Valor: {r.get('valor')} | Período: {r.get('periodo')}")
else:
    print(f"Erro: {resp.status_code} - {resp.text}")
