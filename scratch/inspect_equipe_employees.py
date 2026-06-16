import requests

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# 1. Fetch equipe
resp_equipe = requests.get(f"{SUPABASE_URL}/rest/v1/equipe?select=*", headers=HEADERS)
equipe = resp_equipe.json()

# 2. Fetch employees
resp_employees = requests.get(f"{SUPABASE_URL}/rest/v1/employees?select=id,full_name", headers=HEADERS)
employees = resp_employees.json()

print(f"--- EQUIPE (total: {len(equipe)}) ---")
for eq in equipe:
    print(f"ID: {eq['id']} | Nome: {eq['nome']} | Ativo: {eq['ativo']} | % Padrão: {eq['pct_padrao']}")

print(f"\n--- EMPLOYEES (total: {len(employees)}) ---")
emp_names = {e['id']: e['full_name'] for e in employees}
for emp_id, emp_name in emp_names.items():
    print(f"ID: {emp_id} | Nome: {emp_name}")

print("\n--- MATCHING ANALYSIS ---")
matched_count = 0
for eq in equipe:
    eq_id = eq['id']
    if eq_id in emp_names:
        print(f"MATCH! Equipe ID {eq_id} ('{eq['nome']}') matches Employee '{emp_names[eq_id]}'")
        matched_count += 1
    else:
        # Check by name similarity
        matches_by_name = [name for id_, name in emp_names.items() if eq['nome'].lower() in name.lower() or name.lower() in eq['nome'].lower()]
        if matches_by_name:
            print(f"NAME MATCH ONLY! Equipe '{eq['nome']}' matches Employee(s) by name: {matches_by_name}")
        else:
            print(f"NO MATCH! Equipe '{eq['nome']}' (ID {eq_id}) has no corresponding employee by ID or Name")

print(f"\nTotal matched by ID: {matched_count} / {len(equipe)}")
