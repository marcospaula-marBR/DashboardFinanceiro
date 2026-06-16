import urllib.request
import json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
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
    payment_ids = [
        'f6d9ed02-fca7-4903-a99f-d5ce59488229', # R$ 100.00
        '1dd9baab-4192-4600-8dc5-3b52a505db4d'  # R$ 290.00
    ]
    
    for pid in payment_ids:
        # Update status to PENDENTE and paid_date to null
        status, res = http("PATCH", f"/rest/v1/loan_payments?id=eq.{pid}", {
            "status": "PENDENTE",
            "paid_date": None
        })
        print(f"Updated payment {pid}: status={status}, response={res}")

if __name__ == "__main__":
    main()
