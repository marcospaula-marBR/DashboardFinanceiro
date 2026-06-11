import urllib.request
import json
import os
from datetime import datetime

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def backup_table(table_name, timestamp):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?select=*"
    req = urllib.request.Request(url, headers=HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            
            # Ensure backup directory exists
            os.makedirs("backup", exist_ok=True)
            
            filename = f"backup/{table_name}_backup_{timestamp}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            print(f"SUCCESS: Backup de '{table_name}' concluido com sucesso: {filename} ({len(data)} registros)")
            return True
    except Exception as e:
        print(f"ERROR: Erro ao fazer backup da tabela '{table_name}': {e}")
        return False

if __name__ == "__main__":
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    print(f"Iniciando backup em {timestamp}...")
    
    tables = [
        "employee_loans",
        "loan_payments",
        "employee_loans_test",
        "loan_payments_test"
    ]
    
    success = True
    for table in tables:
        res = backup_table(table, timestamp)
        if not res and "test" not in table:
            success = False
            
    if success:
        print("\nSUCCESS: Todos os backups de tabelas criticas concluidos com sucesso!")
    else:
        print("\nWARNING: Alguns backups falharam. Verifique os erros acima.")
