import urllib.request
import json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def check_columns():
    try:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/recebimentos?select=glosa,impostos&limit=1",
            headers=HEADERS,
            method="GET"
        )
        with urllib.request.urlopen(req) as r:
            if r.status == 200:
                print("OK: Columns 'glosa' and 'impostos' exist in table 'recebimentos'!")
                return True
    except urllib.error.HTTPError as e:
        print(f"FAILED: Columns check failed (HTTP {e.code}): {e.read().decode()}")
        return False
    except Exception as e:
        print(f"FAILED: Error checking columns: {e}")
        return False

if __name__ == "__main__":
    check_columns()
