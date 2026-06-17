import urllib.request
import json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def inspect_contracts():
    try:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/contratos_base?select=id,nome_contrato,ativo&order=nome_contrato",
            headers=HEADERS,
            method="GET"
        )
        with urllib.request.urlopen(req) as r:
            if r.status == 200:
                data = json.loads(r.read().decode())
                print(f"Total contracts: {len(data)}")
                for idx, c in enumerate(data):
                    print(f"{idx+1:02d} - {c['nome_contrato']} (id: {c['id']}, ativo: {c['ativo']})")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    inspect_contracts()
