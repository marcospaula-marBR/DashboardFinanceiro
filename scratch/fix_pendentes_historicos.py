"""
fix_pendentes_historicos.py
===========================
Marca como PAGO todas as parcelas cujo due_date é anterior a 10/06/2026.
Raciocínio: parcelas vencidas antes da data de restore são histórico — 
o sistema antigo nunca gravou o status individual, mas elas já foram pagas.
paid_date = due_date (data original de vencimento).
"""
import urllib.request
import urllib.error
import json
from datetime import date

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwi"
    "cm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0"
    "NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"
)
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

CUTOFF = date(2026, 6, 10)  # parcelas vencidas ANTES desta data = historico pago

def fetch_all(table):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

def patch_payment(pid, paid_date_str, retries=3):
    url = f"{SUPABASE_URL}/rest/v1/loan_payments?id=eq.{pid}"
    payload = json.dumps({"status": "PAGO", "paid_date": paid_date_str}).encode("utf-8")
    headers = {**HEADERS}
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, data=payload, headers=headers, method="PATCH")
            with urllib.request.urlopen(req, timeout=15) as r:
                return True
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            print(f"  ERRO {pid[:8]}: HTTP {e.code} - {body[:150]}")
            return False
        except Exception as e:
            if attempt < retries:
                import time; time.sleep(2)
            else:
                print(f"  ERRO {pid[:8]} (tentativa {attempt}): {e}")
                return False
    return False

def main():
    print("Buscando parcelas do banco...")
    payments = fetch_all("loan_payments")
    print(f"Total de parcelas: {len(payments)}")

    # Identifica parcelas PENDENTE com due_date < cutoff
    to_fix = []
    for p in payments:
        if p.get("status") != "PENDENTE":
            continue
        due_raw = p.get("due_date") or p.get("month_cycle")
        if not due_raw:
            continue
        # due_date pode ser "YYYY-MM-DD" ou "YYYY-MM"
        try:
            if len(due_raw) == 7:  # "YYYY-MM" -> assume dia 10
                due = date(int(due_raw[:4]), int(due_raw[5:7]), 10)
                paid_date_str = f"{due_raw}-10"
            else:
                due = date.fromisoformat(due_raw[:10])
                paid_date_str = due_raw[:10]
        except Exception:
            continue

        if due < CUTOFF:
            to_fix.append((p["id"], paid_date_str, due_raw))

    print(f"Parcelas PENDENTE com vencimento anterior a {CUTOFF}: {len(to_fix)}")

    if not to_fix:
        print("Nenhuma parcela para corrigir.")
        return

    # Confirmacao implicita (usuario aprovou)
    print(f"\nMarcando {len(to_fix)} parcelas como PAGO...")
    ok = 0
    fail = 0
    for i, (pid, paid_date_str, due_raw) in enumerate(to_fix):
        success = patch_payment(pid, paid_date_str)
        if success:
            ok += 1
        else:
            fail += 1
        if (i + 1) % 50 == 0 or (i + 1) == len(to_fix):
            print(f"  Progresso: {i+1}/{len(to_fix)} | OK={ok} ERRO={fail}")

    print(f"\nConcluido: {ok} parcelas atualizadas, {fail} erros.")
    if fail == 0:
        print("[OK] Todas as parcelas historicas marcadas como PAGO com sucesso!")

if __name__ == "__main__":
    main()
