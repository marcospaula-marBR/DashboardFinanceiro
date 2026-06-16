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
    status, emps = http("GET", "/rest/v1/employees_test?select=id,full_name")
    if status != 200:
        print("employees_test table not found or error:", emps)
        return
        
    emp_map = {e['id']: e['full_name'] for e in emps}
    gisele_id = None
    for emp in emps:
        if "gisele" in emp['full_name'].lower() or "gap" in emp['full_name'].lower():
            gisele_id = emp['id']
            print(f"Found Gisele in test: {emp}")
            
    if gisele_id:
        status, payments = http("GET", f"/rest/v1/loan_payments_test?employee_id=eq.{gisele_id}&select=*")
        print("\n=== GISELE PAYMENTS IN TEST DB ===")
        for p in sorted(payments, key=lambda x: x.get('due_date', '')):
            print(f"Due: {p['due_date']} | Amt: {p['amount']} | Status: {p['status']} | Contract ID: {p['contract_id']}")

if __name__ == "__main__":
    main()
