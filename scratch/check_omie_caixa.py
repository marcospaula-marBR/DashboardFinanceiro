import requests
import json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# 1. Inspect sample row from omie_financas_unificado with data_pagamento
resp = requests.get(f"{SUPABASE_URL}/rest/v1/omie_financas_unificado?select=*&data_pagamento=not.is.null&limit=3", headers=HEADERS)
data = resp.json()
print(f"Sample omie_financas_unificado rows with data_pagamento: {len(data)}")
if data:
    for i, r in enumerate(data):
        print(f"Row {i}: tipo={r.get('tipo_registro')}, status={r.get('status')}, dt_pag={r.get('data_pagamento')}, dt_reg={r.get('data_registro')}, emp={r.get('empresa_nome')}, proj={r.get('projeto_nome')}, cat={r.get('categoria_nome')}, forn={r.get('cliente_fornecedor')}, val={r.get('valor_alocado')}")
        if 'raw_data' in r and r['raw_data']:
            print(f"  raw_data keys: {list(r['raw_data'].keys())}")
            if 'detalhes' in r['raw_data']:
                print(f"  detalhes keys: {list(r['raw_data']['detalhes'].keys())}")

# 2. Check count of records with data_pagamento
resp_count = requests.get(f"{SUPABASE_URL}/rest/v1/omie_financas_unificado?select=id&data_pagamento=not.is.null", headers={**HEADERS, "Range-Unit": "items", "Range": "0-0", "Prefer": "count=exact"})
print(f"Range-Count data_pagamento: {resp_count.headers.get('content-range')}")

# 3. Check types in omie_financas_unificado
resp_types = requests.get(f"{SUPABASE_URL}/rest/v1/omie_financas_unificado?select=tipo_registro,status&limit=100", headers=HEADERS)
types = set((x.get('tipo_registro'), x.get('status')) for x in resp_types.json())
print(f"Distinct (tipo_registro, status) in sample: {types}")
