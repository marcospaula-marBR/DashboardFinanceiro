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
    status, history = http("GET", "/rest/v1/employee_history?select=*")
    print(f"Total history records: {len(history)}")
    
    # Filter records containing KaychWare or the contract ID
    # KaychWare employee id is dd0d3350-d50d-4708-8d00-f2ec2edb7734 is contract ID, employee name is KaychWare
    # Let's search if any employee has name KaychWare
    status, emps = http("GET", "/rest/v1/employees?select=id,full_name")
    kaych_emp_id = None
    for e in emps:
        if 'kaych' in e['full_name'].lower():
            kaych_emp_id = e['id']
            print(f"Found KaychWare employee: {e}")
            
    if kaych_emp_id:
        status, kaych_hist = http("GET", f"/rest/v1/employee_history?employee_id=eq.{kaych_emp_id}&select=*")
        print(f"\nHistory for KaychWare (total {len(kaych_hist)}):")
        for h in sorted(kaych_hist, key=lambda x: x.get('change_date', '')):
            print(f"  Date: {h.get('change_date')} | Type: {h.get('event_type')} | Obs: {h.get('observations')}")
            
    print("\n=== All events containing 'liquida' or 'quit' ===")
    for h in history:
        obs = h.get('observations') or ''
        event = h.get('event_type') or ''
        if 'liquida' in obs.lower() or 'quit' in obs.lower() or 'liquida' in event.lower() or 'quit' in event.lower():
            print(f"  Emp ID: {h['employee_id']} | Date: {h.get('change_date')} | Type: {event} | Obs: {obs}")

if __name__ == "__main__":
    main()
