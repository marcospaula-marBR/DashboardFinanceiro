#!/usr/bin/env python3
import urllib.request
import json
import sys

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"
TABLE = "dre_lancamentos"

def clear_omie_records():
    print("Iniciando a limpeza de registros com fonte='omie' na tabela dre_lancamentos...")
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?fonte=eq.omie"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print("Status:", resp.status)
            print("[OK] Todos os registros de fonte='omie' foram excluídos com sucesso do Supabase.")
    except Exception as e:
        print("[ERROR] Falha ao excluir registros:", e)
        sys.exit(1)

if __name__ == "__main__":
    clear_omie_records()
