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
    status, emps = http("GET", "/rest/v1/employees?select=id,full_name,company")
    if status != 200:
        print("Error fetching employees:", emps)
        return
        
    gisele_id = None
    for emp in emps:
        if "gisele" in emp['full_name'].lower() or "gap" in emp['full_name'].lower():
            print(f"Found Gisele/GAP: {emp}")
            gisele_id = emp['id']
            
    if gisele_id:
        status, loans = http("GET", f"/rest/v1/employee_loans?employee_id=eq.{gisele_id}&select=*")
        print(f"\nLoans for Gisele (total {len(loans)}):")
        for l in loans:
            print(f"  Loan ID: {l['id']}, Amount: {l['amount']}, Installments: {l['installments']}, Extra Paid: {l.get('amount_paid_extra')}, Notes: {l.get('notes')}")
            status, payments = http("GET", f"/rest/v1/loan_payments?contract_id=eq.{l['id']}&select=*")
            print(f"    Payments (total {len(payments)}):")
            for p in sorted(payments, key=lambda x: x.get('due_date', '')):
                print(f"      Payment ID: {p['id']}, Due: {p['due_date']}, Amount: {p['amount']}, Status: {p['status']}")
                
    # Fetch all payments and filter locally
    status, all_payments = http("GET", "/rest/v1/loan_payments?select=*")
    print(f"\nAll Payments HTTP status: {status}")
    if status != 200:
        print("Error response:", all_payments)
        return
        
    print(f"Total payments fetched: {len(all_payments)}")
    emp_map = {e['id']: e['full_name'] for e in emps}
    
    jul_payments = [p for p in all_payments if p.get('due_date') and p['due_date'].startswith('2026-07')]
    print(f"July 2026 Payments (total {len(jul_payments)}):")
    for p in sorted(jul_payments, key=lambda x: x.get('due_date', '')):
        emp_name = emp_map.get(p['employee_id'], "UNKNOWN")
        print(f"  Emp: {emp_name} | Due: {p['due_date']} | Amt: {p['amount']} | Status: {p['status']} | Contract ID: {p['contract_id']}")

if __name__ == "__main__":
    main()
