import urllib.request, json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def main():
    # Inspect employees
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/employees?limit=1",
        headers=HEADERS,
        method="GET"
    )
    try:
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read().decode())
            if data:
                print("EMPLOYEES COLUMNS:")
                for k, v in data[0].items():
                    print(f"  {k}: {type(v).__name__} (value: {v})")
            else:
                print("Employees table is empty.")
    except Exception as e:
        print(f"Error employees: {e}")

    # Inspect people_monthly_costs
    req_cost = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/people_monthly_costs?limit=1",
        headers=HEADERS,
        method="GET"
    )
    try:
        with urllib.request.urlopen(req_cost) as r:
            data = json.loads(r.read().decode())
            if data:
                print("\nPEOPLE_MONTHLY_COSTS COLUMNS:")
                for k, v in data[0].items():
                    print(f"  {k}: {type(v).__name__} (value: {v})")
            else:
                print("people_monthly_costs table is empty.")
    except Exception as e:
        print(f"Error monthly costs: {e}")

if __name__ == "__main__":
    main()
