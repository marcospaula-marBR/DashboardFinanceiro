import urllib.request, json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

tables = ["people_employment_bonds", "people_monthly_costs", "employees"]

for table in tables:
    test_req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{table}?limit=1",
        headers=HEADERS,
        method="GET"
    )
    try:
        with urllib.request.urlopen(test_req) as r:
            print(f"Table '{table}' exists! HTTP Status: {r.status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Table '{table}' does NOT exist or has error (HTTP {e.code}): {body[:300]}")
