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
    status, payments = http("GET", "/rest/v1/loan_payments?select=*")
    
    monthly_previsto = {}
    monthly_pago = {}
    
    for p in payments:
        if not p.get('due_date'): continue
        month = p['due_date'][:7]
        amt = float(p['amount'])
        
        monthly_previsto[month] = monthly_previsto.get(month, 0) + amt
        if p['status'] == 'PAGO':
            monthly_pago[month] = monthly_pago.get(month, 0) + amt
            
    print("=== Raw payments sums by due_date month ===")
    for m in sorted(monthly_previsto.keys()):
        print(f"  Month: {m} | Previsto: {monthly_previsto[m]:.2f} | Pago: {monthly_pago.get(m, 0):.2f}")

if __name__ == "__main__":
    main()
