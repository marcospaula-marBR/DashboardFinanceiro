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

def calc_installment_for_month(ln, month_str, contract_payments, is_liquidated):
    if is_liquidated:
        return 0
        
    if contract_payments:
        target_month_payments = [p for p in contract_payments if p['due_date'].startswith(month_str)]
        pending_amount = sum(float(p['amount']) for p in target_month_payments if p['status'] == 'PENDENTE')
        return pending_amount
        
    # Fallback simulation
    return 0

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
            'payments': []
        }
        
    for p in payments:
        cid = p['contract_id']
        if cid in loan_map:
            loan_map[cid]['payments'].append(p)
            if p['status'] == 'PAGO':
                loan_map[cid]['paid_amt'] += float(p['amount'])
                
    for month in ["2026-06", "2026-07"]:
        print(f"\n--- Installments for Month: {month} ---")
        total_previsto = 0
        for cid, ldata in loan_map.items():
            ln = ldata['info']
            amount = float(ln['amount'])
            extra = float(ln.get('amount_paid_extra') or 0)
            debt = max(0.0, amount - ldata['paid_amt'] - extra)
            is_liquidated = debt <= 0
            
            inst_val = calc_installment_for_month(ln, month, ldata['payments'], is_liquidated)
            if inst_val > 0:
                print(f"  Emp: {ldata['emp_name']} | Amt: {inst_val:.2f} | Contract: {cid[:8]}... | Liquidated: {is_liquidated}")
                total_previsto += inst_val
        print(f"Total Previsto in {month} for card: {total_previsto:.2f}")

if __name__ == "__main__":
    main()
