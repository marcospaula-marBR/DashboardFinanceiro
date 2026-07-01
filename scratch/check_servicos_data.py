import os
import requests
from collections import defaultdict

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

url = f"{SUPABASE_URL}/rest/v1/dre_lancamentos?select=*"
resp = requests.get(url, headers=HEADERS)

if not resp.ok:
    print(f"Erro: {resp.status_code} - {resp.text}")
    exit(1)

records = resp.json()

# Dicionários para acumular valores
# Periodo -> Categoria -> Valor
period_data = defaultdict(lambda: defaultdict(float))

for r in records:
    # Simular normalizações do DRE
    conta_dre = r.get('conta_dre', '').strip().replace('\u00e7', 'c').replace('\u00f5', 'o').replace('\u00ed', 'i') # Serviços -> Servicos
    # Vamos usar as originais para identificação precisa
    conta_orig = r.get('conta_dre', '').strip()
    cat_orig = r.get('categoria', '').strip()
    periodo = r.get('periodo', '').strip()
    valor = float(r.get('valor') or 0)
    
    if conta_orig == "Serviços" or cat_orig in ["Consórcios - a contemplar", "Renda Fixa"]:
        period_data[periodo][cat_orig] += valor
        period_data[periodo][f"CONTA_{conta_orig}"] += valor

print(f"{'Período':<10} | {'Conta Serviços':<18} | {'Cat Renda Fixa':<18} | {'Cat Consórcios':<18} | {'Outros em Serviços':<18}")
print("-" * 90)

for p in sorted(period_data.keys()):
    cats = period_data[p]
    renda_fixa = cats.get("Renda Fixa", 0.0)
    consorcios = cats.get("Consórcios - a contemplar", 0.0)
    total_servicos = cats.get("CONTA_Serviços", 0.0)
    # Outros itens que estão sob a conta DRE Serviços mas não são Renda Fixa nem Consórcios
    outros = total_servicos - renda_fixa - consorcios
    print(f"{p:<10} | R$ {total_servicos:>14.2f} | R$ {renda_fixa:>14.2f} | R$ {consorcios:>14.2f} | R$ {outros:>14.2f}")
