import urllib.request
import json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def check_schema():
    try:
        # Pega um registro para inspecionar os campos retornados
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/contratos_base?limit=1",
            headers=HEADERS,
            method="GET"
        )
        with urllib.request.urlopen(req) as r:
            if r.status == 200:
                data = json.loads(r.read().decode())
                if data:
                    print("Columns in 'contratos_base':", list(data[0].keys()))
                    print("Sample row:", data[0])
                else:
                    print("Table 'contratos_base' is empty, cannot inspect fields.")
    except Exception as e:
        print(f"FAILED: Error checking schema: {e}")

if __name__ == "__main__":
    check_schema()
