import requests

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

tables = ["contratos_base", "recebimentos", "comissoes", "notas_fiscais"]

for table in tables:
    url = f"{SUPABASE_URL}/rest/v1/{table}?limit=1"
    resp = requests.get(url, headers=HEADERS)
    print(f"\n--- TABLE: {table} ---")
    if resp.status_code == 200:
        data = resp.json()
        if data:
            print("Columns/Sample:", data[0].keys())
            print("Sample row:", data[0])
        else:
            print("Table is empty")
    else:
        print(f"Error {resp.status_code}: {resp.text}")
