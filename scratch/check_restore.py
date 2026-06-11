"""
check_restore.py
Compara o estado atual do banco com o backup de 10/06 para identificar divergencias.
"""
import urllib.request
import json

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

LOANS_BACKUP   = "backup/employee_loans_backup_20260610_135026.json"
PAYMENTS_BACKUP = "backup/loan_payments_backup_20260610_135026.json"

def fetch_table(table):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*"
    req = urllib.request.Request(url, headers=HEADERS, method="GET")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

def check_loans():
    print("\n=== CONTRATOS (employee_loans) ===")
    with open(LOANS_BACKUP, encoding="utf-8") as f:
        backup = {r["id"]: r for r in json.load(f)}

    live = {r["id"]: r for r in fetch_table("employee_loans")}

    FIELDS = ["amount_paid_extra", "postponed_months", "paid_installments", "notes"]
    diffs = []

    for cid, bk in backup.items():
        if cid not in live:
            diffs.append(f"  AUSENTE no banco: {cid}")
            continue
        lv = live[cid]
        for f in FIELDS:
            bv = bk.get(f)
            lv_v = lv.get(f)
            if str(bv) != str(lv_v):
                diffs.append(f"  Contrato {cid[:8]}... campo={f} | backup={bv!r} | banco={lv_v!r}")

    if diffs:
        print(f"  {len(diffs)} DIVERGENCIA(S) encontrada(s):")
        for d in diffs:
            print(d)
    else:
        print("  OK - Todos os contratos estao identicos ao backup.")

    # Contratos novos no banco (nao existiam no backup)
    novos = [lid for lid in live if lid not in backup]
    if novos:
        print(f"  INFO: {len(novos)} contrato(s) criado(s) apos o backup (nao tocados):")
        for n in novos:
            print(f"    {n[:8]}...")

def check_payments():
    print("\n=== PARCELAS (loan_payments) ===")
    with open(PAYMENTS_BACKUP, encoding="utf-8") as f:
        backup = {r["id"]: r for r in json.load(f)}

    live = {r["id"]: r for r in fetch_table("loan_payments")}

    FIELDS = ["status", "paid_date", "due_date"]
    diffs = []

    for pid, bk in backup.items():
        if pid not in live:
            diffs.append(f"  AUSENTE no banco: {pid}")
            continue
        lv = live[pid]
        for f in FIELDS:
            bv = bk.get(f)
            lv_v = lv.get(f)
            if str(bv) != str(lv_v):
                diffs.append(f"  Parcela {pid[:8]}... campo={f} | backup={bv!r} | banco={lv_v!r}")

    if diffs:
        print(f"  {len(diffs)} DIVERGENCIA(S) encontrada(s):")
        for d in diffs[:30]:  # limita para nao poluir
            print(d)
        if len(diffs) > 30:
            print(f"  ... e mais {len(diffs)-30} divergencias.")
    else:
        print("  OK - Todas as parcelas estao identicas ao backup.")

    novos = [lid for lid in live if lid not in backup]
    if novos:
        print(f"  INFO: {len(novos)} parcela(s) criada(s) apos o backup (nao tocadas).")

if __name__ == "__main__":
    print("Comparando banco atual com backup de 10/06/2026...")
    check_loans()
    check_payments()
    print("\nDiagnostico concluido.")
