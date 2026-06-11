import urllib.request
import json
import sys

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def run_diagnose():
    contract_id = "00c33747-48db-4851-a52d-20dad6d9685d"
    url = f"{SUPABASE_URL}/rest/v1/loan_payments?contract_id=eq.{contract_id}&order=due_date"
    try:
        req = urllib.request.Request(url, headers=HEADERS, method="GET")
        with urllib.request.urlopen(req) as resp:
            payments = json.loads(resp.read().decode('utf-8'))
            print(f"Payments count: {len(payments)}")
            for idx, p in enumerate(payments):
                print(f"Installment #{idx+1}:")
                print(f"  ID: {p.get('id')}")
                print(f"  Month Cycle: {p.get('month_cycle')}")
                print(f"  Due Date: {p.get('due_date')}")
                print(f"  Paid Date: {p.get('paid_date')}")
                print(f"  Amount: R$ {p.get('amount')}")
                print(f"  Status: {p.get('status')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    run_diagnose()
