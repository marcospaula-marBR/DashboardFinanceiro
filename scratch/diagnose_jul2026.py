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
    
    status, loans = http("GET", "/rest/v1/employee_loans?select=*")
    status, payments = http("GET", "/rest/v1/loan_payments?select=*")
    
    # Calculate loan balances
    loan_map = {}
    for l in loans:
        loan_map[l['id']] = {
            'info': l,
            'emp_name': emp_map.get(l['employee_id'], 'UNKNOWN'),
            'paid_amt': 0,
            'pago_statuses': [],
            'pendente_statuses': []
        }
        
    for p in payments:
        cid = p['contract_id']
        if cid in loan_map:
            if p['status'] == 'PAGO':
                loan_map[cid]['paid_amt'] += float(p['amount'])
                loan_map[cid]['pago_statuses'].append(p)
            elif p['status'] == 'PENDENTE':
                loan_map[cid]['pendente_statuses'].append(p)
                
    print("=== LIQUIDATED LOANS WITH PENDING PAYMENTS ===")
    for cid, ldata in loan_map.items():
        ln = ldata['info']
        amount = float(ln['amount'])
        extra = float(ln.get('amount_paid_extra') or 0)
        debt = max(0.0, amount - ldata['paid_amt'] - extra)
        if debt <= 0:
            pendentes = ldata['pendente_statuses']
            if len(pendentes) > 0:
                print(f"Loan ID: {cid[:8]}... | Emp: {ldata['emp_name']} | Amt: {amount} | Paid: {ldata['paid_amt']} | Extra: {extra} | Debt: {debt}")
                print(f"  Pending installments count: {len(pendentes)}")
                for p in sorted(pendentes, key=lambda x: x['due_date']):
                    print(f"    Due: {p['due_date']} | Amt: {p['amount']}")

if __name__ == "__main__":
    main()
