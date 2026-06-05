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
    # Fetch all loans
    status, loans = http("GET", "/rest/v1/employee_loans?select=*")
    if status != 200:
        print("Error fetching loans:", loans)
        return
        
    print(f"Total loans: {len(loans)}")
    
    # Count loans per employee
    counts = {}
    for l in loans:
        eid = l.get('employee_id')
        counts[eid] = counts.get(eid, 0) + 1
        
    multi = {k: v for k, v in counts.items() if v > 1}
    print(f"Employees with multiple loans: {len(multi)}")
    for eid, cnt in multi.items():
        # Fetch employee name
        _, emp = http("GET", f"/rest/v1/employees?id=eq.{eid}&select=full_name")
        name = emp[0]['full_name'] if emp else "UNKNOWN"
        print(f"  - Employee: '{name}' (ID: {eid}) has {cnt} loans.")

if __name__ == "__main__":
    main()
