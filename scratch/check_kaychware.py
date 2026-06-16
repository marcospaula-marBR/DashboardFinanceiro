import urllib.request
import json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6"
    "InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ."
    "2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"
)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

contract_id = "dd0d3350-d50d-4708-8d00-f2ec2edb7734"

def get_data():
    # Fetch contract
    url_loan = f"{SUPABASE_URL}/rest/v1/employee_loans?id=eq.{contract_id}"
    req_loan = urllib.request.Request(url_loan, headers=HEADERS, method="GET")
    with urllib.request.urlopen(req_loan) as resp:
        loan = json.loads(resp.read().decode("utf-8"))[0]
        
    # Fetch payments
    url_payments = f"{SUPABASE_URL}/rest/v1/loan_payments?contract_id=eq.{contract_id}&order=due_date.asc"
    req_payments = urllib.request.Request(url_payments, headers=HEADERS, method="GET")
    with urllib.request.urlopen(req_payments) as resp:
        payments = json.loads(resp.read().decode("utf-8"))
        
    print("LOAN DETAILS:")
    print(json.dumps(loan, indent=2))
    print("\nPAYMENTS:")
    for p in payments:
        print(f"ID: {p['id']} | Due: {p['due_date']} | Status: {p['status']} | Amount: {p['amount']} | Paid Date: {p['paid_date']} | Postponed To: {p['postponed_to']}")

if __name__ == "__main__":
    get_data()
