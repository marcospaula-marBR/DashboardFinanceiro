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
    sql = """
    -- Add columns to employees table
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS remuneration_fixed NUMERIC DEFAULT 0;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS remuneration_bonus NUMERIC DEFAULT 0;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS remuneration_commission NUMERIC DEFAULT 0;

    -- Add columns to employees_test table
    ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS remuneration_fixed NUMERIC DEFAULT 0;
    ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS remuneration_bonus NUMERIC DEFAULT 0;
    ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS remuneration_commission NUMERIC DEFAULT 0;

    -- Add columns to people_monthly_costs table
    ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS valor_fixo NUMERIC DEFAULT 0;
    ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS valor_bonus NUMERIC DEFAULT 0;
    ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS valor_comissao NUMERIC DEFAULT 0;
    """

    payload = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        data=payload,
        headers=HEADERS,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as r:
            print(f"Success! HTTP Status: {r.status}")
            print(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Failed with code {e.code}: {e.read().decode()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
