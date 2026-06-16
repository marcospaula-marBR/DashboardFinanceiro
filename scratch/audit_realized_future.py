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
    status, emps = http("GET", "/rest/v1/employees?select=id,full_name")
    emp_map = {e['id']: e['full_name'] for e in emps}
    
    status, payments = http("GET", "/rest/v1/loan_payments?status=eq.PAGO&select=*")
    
    print("=== FUTURE PAYMENTS IN THE DATABASE MARKED AS PAGO ===")
    count = 0
    for p in sorted(payments, key=lambda x: x.get('due_date', '')):
        due_date = p.get('due_date')
        if due_date and due_date >= '2026-07-01':
            count += 1
            emp_name = emp_map.get(p['employee_id'], 'UNKNOWN')
            print(f"Due: {due_date} | Amt: {p['amount']} | Emp: {emp_name} | ID: {p['id']} | Contract ID: {p['contract_id']}")
    print(f"Total future PAGO payments: {count}")

if __name__ == "__main__":
    main()
