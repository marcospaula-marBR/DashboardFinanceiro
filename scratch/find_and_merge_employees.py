import urllib.request
import json
import sys

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

def main():
    print("=" * 80)
    print("MERGE: Finding and Merging Duplicate Employee Profiles safely")
    print("=" * 80)

    # 1. Fetch all employees with full details
    print("\n[1/4] Buscando colaboradores do banco de dados...")
    status, emps = http("GET", "/rest/v1/employees?select=*")
    if status != 200:
        print(f"[ERROR] Falha ao buscar colaboradores: {emps}")
        return
    print(f"Encontrados {len(emps)} colaboradores.")

    # 2. Group by clean name
    by_name = {}
    for e in emps:
        c = clean_name(e['full_name'])
        if c not in by_name:
            by_name[c] = []
        by_name[c].append(e)

    duplicates = {k: v for k, v in by_name.items() if len(v) > 1}
    if not duplicates:
        print("Nenhum colaborador duplicado encontrado por nome limpo.")
        return

    print(f"Encontrados {len(duplicates)} nomes duplicados na base de dados.")

    # 3. Process each duplicate set
    for name, records in duplicates.items():
        print(f"\n- Processando duplicados de: '{name.upper()}' ({len(records)} registros)")
        
        # Check loan, bond, cost status for each duplicate to pick the "Master" record
        annotated_records = []
        for r in records:
            # Query related data counts
            _, loans = http("GET", f"/rest/v1/employee_loans?employee_id=eq.{r['id']}&select=id")
            _, loans_t = http("GET", f"/rest/v1/employee_loans_test?employee_id=eq.{r['id']}&select=id")
            _, bonds = http("GET", f"/rest/v1/people_employment_bonds?employee_id=eq.{r['id']}&select=id")
            _, costs = http("GET", f"/rest/v1/people_monthly_costs?employee_id=eq.{r['id']}&select=id")
            _, hist = http("GET", f"/rest/v1/employee_history?employee_id=eq.{r['id']}&select=id")
            _, hist_t = http("GET", f"/rest/v1/employee_history_test?employee_id=eq.{r['id']}&select=id")
            
            loans_count = len(loans) if isinstance(loans, list) else 0
            loans_t_count = len(loans_t) if isinstance(loans_t, list) else 0
            bonds_count = len(bonds) if isinstance(bonds, list) else 0
            costs_count = len(costs) if isinstance(costs, list) else 0
            hist_count = len(hist) if isinstance(hist, list) else 0
            hist_t_count = len(hist_t) if isinstance(hist_t, list) else 0
            
            # Score this record: prioritize records with loans, then bonds/costs, then those with filled fields
            filled_fields = sum(1 for k, v in r.items() if v is not None and v != "" and v != [])
            
            score = (loans_count * 1000) + (loans_t_count * 500) + (bonds_count * 100) + (costs_count * 10) + hist_count + (filled_fields * 0.1)
            
            annotated_records.append({
                "emp": r,
                "score": score,
                "loans": loans_count,
                "loans_t": loans_t_count,
                "bonds": bonds_count,
                "costs": costs_count,
                "hist": hist_count,
                "hist_t": hist_t_count,
                "filled_fields": filled_fields
            })
            
        # Sort annotated records by score descending
        annotated_records.sort(key=lambda x: x['score'], reverse=True)
        
        master = annotated_records[0]
        duplicates_to_merge = annotated_records[1:]
        
        master_emp = master['emp']
        master_id = master_emp['id']
        
        print(f"  [MASTER] ID: {master_id} | Score: {master['score']:.1f} | Empréstimos: {master['loans']} | Vínculos: {master['bonds']} | Custos: {master['costs']}")
        
        # Merge data from duplicates to master
        for dup in duplicates_to_merge:
            dup_emp = dup['emp']
            dup_id = dup_emp['id']
            print(f"  [MERGING] ID: {dup_id} | Score: {dup['score']:.1f} | Empréstimos: {dup['loans']} | Vínculos: {dup['bonds']} | Custos: {dup['costs']}")
            
            # A. Copy missing profile fields from duplicate to master
            fields_to_update = {}
            for key, val in dup_emp.items():
                if key == 'id' or key == 'created_at':
                    continue
                # If master field is empty/null and duplicate field has value, copy it
                master_val = master_emp.get(key)
                if (master_val is None or master_val == "" or master_val == []) and (val is not None and val != "" and val != []):
                    fields_to_update[key] = val
                    master_emp[key] = val # update local master object too
            
            if fields_to_update:
                print(f"    - Atualizando {len(fields_to_update)} campos na ficha do Master...")
                http("PATCH", f"/rest/v1/employees?id=eq.{master_id}", fields_to_update)
            
            # B. Re-link all related records to the Master ID
            tables_to_update = [
                ("employee_loans", "employee_id"),
                ("employee_loans_test", "employee_id"),
                ("people_employment_bonds", "employee_id"),
                ("people_monthly_costs", "employee_id"),
                ("employee_history", "employee_id"),
                ("employee_history_test", "employee_id")
            ]
            
            for table_name, fk_col in tables_to_update:
                # Find if duplicate has records in this table
                status_rel, rel_items = http("GET", f"/rest/v1/{table_name}?{fk_col}=eq.{dup_id}&select=id")
                if status_rel == 200 and rel_items:
                    print(f"    - Movendo {len(rel_items)} registros da tabela '{table_name}' para o Master...")
                    # Update all items
                    for item in rel_items:
                        http("PATCH", f"/rest/v1/{table_name}?id=eq.{item['id']}", {fk_col: master_id})
            
            # C. Safe Delete the duplicate employee record
            print(f"    - Removendo perfil duplicado ID: {dup_id} do cadastro...")
            del_status, del_res = http("DELETE", f"/rest/v1/employees?id=eq.{dup_id}")
            if del_status in (200, 204):
                print(f"    - [SUCCESS] Perfil duplicado ID {dup_id} deletado com sucesso.")
            else:
                print(f"    - [ERROR] Falha ao deletar ID {dup_id}: {del_res}")

    print("\n" + "=" * 80)
    print("Processo de mesclagem concluído com sucesso!")
    print("=" * 80)

if __name__ == "__main__":
    main()
