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
    contract_ids = [
        '0f3acabf-8d78-45b0-8c3f-b2fdb2a0bc69',
        '1c21b50d-1609-49a2-b954-33b1ff3cc5b0',
        '7bf406e1-3670-4287-82be-65cdd6098da9',
        'bc021b6b-9a29-4698-8cfc-7668e1864c46',
        '5f912fa9-5c1a-42a0-9de0-ba9a727e5339'
    ]
    
    status, emps = http("GET", "/rest/v1/employees?select=id,full_name")
    emp_map = {e['id']: e['full_name'] for e in emps}
    
    for cid in contract_ids:
        status, payments = http("GET", f"/rest/v1/loan_payments?contract_id=eq.{cid}&select=*")
        print(f"\nPayments for contract {cid[:8]}...:")
        for p in sorted(payments, key=lambda x: x.get('due_date', '')):
            emp_name = emp_map.get(p['employee_id'], 'UNKNOWN')
            print(f"  Emp: {emp_name} | Due: {p['due_date']} | Amt: {p['amount']} | Status: {p['status']} | Paid Date: {p.get('paid_date')}")

if __name__ == "__main__":
    main()
