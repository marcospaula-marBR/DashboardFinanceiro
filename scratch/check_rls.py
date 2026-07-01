#!/usr/bin/env python3
import urllib.request
import json
import sys

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

# We can execute SQL queries by calling the RPC pg_graphql or running a query through Postgrest if we have access,
# or we can inspect the tables directly by querying the REST API /rest/v1/ and checking which tables respond
# without authentication or which tables exist.
# However, a very direct way is to query the Supabase API for the list of tables, or run an RPC if one exists.
# Let's write a script to query the database schema using Supabase's SQL API if available, or by checking
# the list of tables we know from the codebase and querying their RLS status.

# Let's check which tables we can access. The tables mentioned in the SQL files are:
# - dre_lancamentos
# - dre_snapshots
# - dre_equipamento_counts
# - colaboradores (or similar from people_tables.sql)
# - loans (or similar)
# - comissoes (or similar)

# Let's run a query to get the list of tables and their RLS status using PostgreSQL system catalogs.
# Supabase has an admin SQL API or we can use the Postgrest API to inspect the schema.
# Postgrest exposes the OpenAPI schema at the root URL! Let's fetch the OpenAPI spec to see all tables.

def inspect_schema():
    print("Obtendo a especificação OpenAPI do Supabase para listar as tabelas expostas...")
    url = f"{SUPABASE_URL}/rest/v1/"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            definitions = data.get("definitions", {})
            print(f"Tabelas encontradas na API pública ({len(definitions)}):")
            for table_name in definitions.keys():
                print(f" - {table_name}")
            return list(definitions.keys())
    except Exception as e:
        print("[ERROR] Falha ao obter a especificação da API:", e)
        return []

if __name__ == "__main__":
    inspect_schema()
