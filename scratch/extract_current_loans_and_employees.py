import urllib.request
import json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def http(method, path, body=None):
    url = SUPABASE_URL + path
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            text = r.read().decode()
            return r.status, json.loads(text) if text else []
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        return e.code, err

def main():
    # 1. Fetch employees
    status_e, emps = http("GET", "/rest/v1/employees?select=id,full_name,document_id,company,status")
    if status_e != 200:
        print("Error fetching employees:", emps)
        return

    # 2. Fetch active loans
    status_l, loans = http("GET", "/rest/v1/employee_loans?limit=1")
    if status_l != 200:
        print("Error fetching loans:", loans)
        return

    print("EMPLOYEE LOANS COLUMNS:")
    if loans:
        for k, v in loans[0].items():
            print(f"  {k}: {type(v).__name__} (value: {v})")
    else:
        print("employee_loans is empty.")
    return

if __name__ == "__main__":
    main()
