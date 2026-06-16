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

def get_billing_month():
    # Simulate getBillingMonthStr() for today June 16, 2026
    # 16 >= 10 -> True -> next month (July)
    return "2026-07"

def main():
    status, payments = http("GET", "/rest/v1/loan_payments?select=*")
    status, loans = http("GET", "/rest/v1/employee_loans?select=*")
    
    # Calculate loan balances
    loan_map = {}
    for l in loans:
        loan_map[l['id']] = {
            'amount': float(l['amount']),
            'extra': float(l.get('amount_paid_extra') or 0),
            'paid': 0
        }
    for p in payments:
        if p['status'] == 'PAGO':
            cid = p['contract_id']
            if cid in loan_map:
                loan_map[cid]['paid'] += float(p['amount'])
                
    def is_liquidated(cid):
        if cid not in loan_map: return False
        l = loan_map[cid]
        return (l['amount'] - l['paid'] - l['extra']) <= 0

    current_billing_month = get_billing_month()
    print("Current billing month:", current_billing_month)
    
    # 1. Simulate current getProjections (without filtering liquidated)
    monthly_current = {}
    for p in payments:
        if not p.get('due_date'): continue
        month_key = p['due_date'][:7]
        if month_key < current_billing_month: continue
        amount = float(p['amount'])
        
        if month_key not in monthly_current:
            monthly_current[month_key] = {'realizado': 0, 'previsto': 0}
            
        if p['status'] == 'PAGO':
            monthly_current[month_key]['realizado'] += amount
        monthly_current[month_key]['previsto'] += amount
        
    print("\n--- CURRENT PROJECTIONS (UNFILTERED) ---")
    for k in sorted(monthly_current.keys())[:5]:
        print(f"  Month: {k} | Realizado: {monthly_current[k]['realizado']:.2f} | Previsto: {monthly_current[k]['previsto']:.2f}")

    # 2. Simulate proposed getProjections (filtering out pending of liquidated)
    monthly_filtered = {}
    for p in payments:
        if not p.get('due_date'): continue
        month_key = p['due_date'][:7]
        if month_key < current_billing_month: continue
        
        # Filter out PENDENTE on liquidated loans
        if p['status'] == 'PENDENTE' and is_liquidated(p['contract_id']):
            continue
            
        amount = float(p['amount'])
        
        if month_key not in monthly_filtered:
            monthly_filtered[month_key] = {'realizado': 0, 'previsto': 0}
            
        if p['status'] == 'PAGO':
            monthly_filtered[month_key]['realizado'] += amount
        monthly_filtered[month_key]['previsto'] += amount
        
    print("\n--- FILTERED PROJECTIONS (FILTERED PENDING LIQUIDATED) ---")
    for k in sorted(monthly_filtered.keys())[:5]:
        print(f"  Month: {k} | Realizado: {monthly_filtered[k]['realizado']:.2f} | Previsto: {monthly_filtered[k]['previsto']:.2f}")

if __name__ == "__main__":
    main()
