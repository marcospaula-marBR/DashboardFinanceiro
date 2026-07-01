#!/usr/bin/env python3
import urllib.request
import json
import sys

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

def check_rls_status():
    sql = """
    SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled
    FROM 
        pg_class c
    JOIN 
        pg_namespace n ON n.oid = c.relnamespace
    WHERE 
        n.nspname = 'public' 
        AND c.relkind = 'r'
    ORDER BY 
        c.relname;
    """
    
    payload = json.dumps({"query": sql}).encode()
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            results = json.loads(resp.read().decode('utf-8'))
            print("Status de Segurança das Tabelas (RLS):")
            print("-" * 50)
            rls_disabled = []
            for row in results:
                table = row['table_name']
                enabled = row['rls_enabled']
                status = "ATIVADO (Seguro)" if enabled else "DESATIVADO (Vulnerável)"
                print(f"Tabela: {table:<40} | RLS: {status}")
                if not enabled:
                    rls_disabled.append(table)
            print("-" * 50)
            print(f"Total: {len(results)} tabelas | Vulneráveis: {len(rls_disabled)}")
            return rls_disabled
    except Exception as e:
        print("[ERROR] Falha ao executar consulta de RLS:", e)
        sys.exit(1)

if __name__ == "__main__":
    check_rls_status()
