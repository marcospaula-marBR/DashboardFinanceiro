import urllib.request
import json
import sys

# Supabase Configurations
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

def clean_name(name):
    if not name:
        return ""
    n = str(name).strip().lower()
    return " ".join(n.split())

def main():
    print("Fetching employees to check for duplicates...")
    status, emps = http("GET", "/rest/v1/employees?select=id,full_name,document_id,company,employment_type,remuneration")
    if status != 200:
        print("Error fetching employees:", emps)
        return
        
    print(f"Total employees: {len(emps)}")
    
    # 1. Group by cleaned name
    by_name = {}
    for e in emps:
        c = clean_name(e['full_name'])
        if c not in by_name:
            by_name[c] = []
        by_name[c].append(e)
        
    duplicates_by_name = {k: v for k, v in by_name.items() if len(v) > 1}
    print(f"\nDuplicates by clean name (found {len(duplicates_by_name)} names with multiple records):")
    for name, records in duplicates_by_name.items():
        print(f"Name: '{name}'")
        for r in records:
            print(f"  - ID: {r['id']} | Company: {r['company']} | Link: {r['employment_type']} | Doc: {r['document_id']} | Rem: {r['remuneration']}")
            
    # 2. Check for loans for each duplicate to see which records are linked to loans!
    if duplicates_by_name:
        print("\nChecking loans for duplicate records...")
        for name, records in duplicates_by_name.items():
            print(f"Name: '{name}'")
            for r in records:
                status_loans, loans = http("GET", f"/rest/v1/employee_loans?employee_id=eq.{r['id']}")
                status_bonds, bonds = http("GET", f"/rest/v1/people_employment_bonds?employee_id=eq.{r['id']}")
                status_costs, costs = http("GET", f"/rest/v1/people_monthly_costs?employee_id=eq.{r['id']}")
                
                loans_count = len(loans) if isinstance(loans, list) else 0
                bonds_count = len(bonds) if isinstance(bonds, list) else 0
                costs_count = len(costs) if isinstance(costs, list) else 0
                
                print(f"  - ID: {r['id']} | Loans: {loans_count} | Bonds: {bonds_count} | Costs: {costs_count}")

if __name__ == "__main__":
    main()
