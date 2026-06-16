import requests

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# Fetch all tables by calling postgrest schema endpoint
resp = requests.get(f"{SUPABASE_URL}/rest/v1/", headers=HEADERS)
schema = resp.json()

print("--- SUPABASE TABLES ---")
if isinstance(schema, dict) and "paths" in schema:
    for path in schema["paths"].keys():
        if path.startswith("/"):
            table_name = path[1:]
            if table_name and not table_name.startswith("rpc/"):
                print(table_name)
else:
    print(schema)
