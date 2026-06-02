import openpyxl
import urllib.request
import json
import sys
from datetime import datetime, date

# Supabase Configurations
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

def clean_name(name):
    if not name:
        return ""
    n = str(name).strip().lower()
    return " ".join(n.split())

def parse_date(val):
    if not val:
        return None
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip().split(" ")[0]
    try:
        dt = datetime.strptime(s, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except:
        pass
    try:
        dt = datetime.strptime(s, "%d/%m/%Y")
        return dt.strftime("%Y-%m-%d")
    except:
        pass
    return None

def main():
    print("=" * 80)
    print("SYNC: Updating Employees start_date from Dianna.xlsx")
    print("=" * 80)

    # 1. Fetch existing employees from DB
    print("\n[1/3] Buscando colaboradores do banco...")
    status, db_employees = http("GET", "/rest/v1/employees?select=id,full_name,start_date,company,employment_type")
    if status != 200:
        print(f"[ERROR] Falha ao buscar colaboradores: {db_employees}")
        sys.exit(1)
    
    print(f"Encontrados {len(db_employees)} colaboradores cadastrados.")
    
    # Map of cleaned_name -> emp object
    emp_map = {}
    for emp in db_employees:
        cleaned = clean_name(emp['full_name'])
        emp_map[cleaned] = emp

    # 2. Load Dianna.xlsx
    print("\n[2/3] Carregando Dianna.xlsx...")
    wb = openpyxl.load_workbook("D:/DRE-V33-Dianna/dashboard-v2/public/Dianna.xlsx", data_only=True)
    ws = wb['CONSOLIDADO ATIVO INATIVO NOVO']
    rows = list(ws.iter_rows(values_only=True))
    print(f"Planilha carregada. Total de linhas: {len(rows)}")

    # 3. Process matches and update start_dates
    print("\n[3/3] Cruzando dados e atualizando admissões...")
    updates_count = 0
    skips_count = 0
    not_found_count = 0
    
    # Set of already updated ids to prevent duplicate updates in case name matches multiple rows
    updated_ids = set()

    for idx, row in enumerate(rows[1:]):
        if not row[1] or not str(row[1]).strip():
            continue
        
        name = str(row[1]).strip()
        cleaned = clean_name(name)
        
        emp = emp_map.get(cleaned)
        if not emp:
            # Try partial matching or fuzzy fallback just in case of minor typos
            # but direct cleaning clean_name is already very robust
            not_found_count += 1
            continue
            
        emp_id = emp['id']
        if emp_id in updated_ids:
            continue
            
        # Column 10 (index 9) is the start_date ("Data Admissão")
        st_date = parse_date(row[9])
        
        if not st_date:
            print(f"  [SKIPPED] {name} - Data de admissão vazia ou inválida na planilha.")
            skips_count += 1
            continue
            
        db_start_date = emp.get('start_date')
        
        # Update always to keep aligned with Dianna.xlsx, or only if mismatch/empty
        if db_start_date != st_date:
            payload = {
                "start_date": st_date
            }
            # Also update employment_type if it is empty
            tipo = str(row[6]).strip() if row[6] else "CLT"
            if tipo not in ["CLT", "MEI", "Estagiário", "PJ"]:
                tipo = "CLT"
            payload["employment_type"] = "PJ" if tipo == "MEI" else tipo
            
            upd_status, upd_res = http("PATCH", f"/rest/v1/employees?id=eq.{emp_id}", payload)
            if upd_status in (200, 201, 204):
                print(f"  [UPDATED] {name} - Admissão atualizada: {db_start_date} -> {st_date} | Vínculo: {payload['employment_type']}")
                updates_count += 1
                updated_ids.add(emp_id)
            else:
                print(f"[ERROR] Falha ao atualizar {name}: {upd_res}")
        else:
            skips_count += 1

    print("\n" + "=" * 80)
    print("RELATÓRIO DE SINCRONIZAÇÃO:")
    print(f"  - Colaboradores atualizados: {updates_count}")
    print(f"  - Mantidos sem alteração (já corretos): {skips_count}")
    print(f"  - Linhas sem correspondente no banco: {not_found_count}")
    print("=" * 80)

if __name__ == "__main__":
    main()
