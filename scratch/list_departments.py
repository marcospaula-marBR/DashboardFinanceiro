import urllib.request
import json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def main():
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/employees?select=id,full_name,department",
        headers=HEADERS,
        method="GET"
    )
    try:
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read().decode())
            print("DEPARTMENTS:")
            counts = {}
            for e in data:
                dept = e.get('department')
                counts[dept] = counts.get(dept, 0) + 1
            for dept, cnt in sorted(counts.items(), key=lambda x: str(x[0])):
                print(f"  - '{dept}': {cnt} records")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
