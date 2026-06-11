"""
restore_loans_backup.py
=======================
Restaura employee_loans e loan_payments para o estado do backup de 10/06/2026,
usando upsert (update por id). Mantém first_payment_date e contract_url intactos
se não constarem no backup. Não apaga registros criados após o backup.

Estratégia:
  - employee_loans: upsert dos campos mutáveis (amount_paid_extra, postponed_months,
    notes, paid_installments) pelo id.
  - loan_payments: upsert completo (status, paid_date, postponed_to, due_date, amount)
    pelo id. Parcelas que existem no banco mas não no backup são ignoradas (não apagadas).

Uso:
  python scratch/restore_loans_backup.py
"""

import urllib.request
import urllib.error
import json
import os

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
    "Prefer": "resolution=merge-duplicates",
}

BACKUP_DIR = "backup"

# Arquivos de backup (mais recente do dia 10/06)
LOANS_BACKUP  = os.path.join(BACKUP_DIR, "employee_loans_backup_20260610_135026.json")
PAYMENTS_BACKUP = os.path.join(BACKUP_DIR, "loan_payments_backup_20260610_135026.json")

# Campos de employee_loans que devem ser restaurados (os imutáveis são preservados)
LOANS_RESTORE_FIELDS = [
    "amount_paid_extra",
    "postponed_months",
    "paid_installments",
    "notes",
]

# Campos de loan_payments que devem ser restaurados
PAYMENTS_RESTORE_FIELDS = [
    "status",
    "paid_date",
    "postponed_to",
    "due_date",
    "amount",
    "month_cycle",
    "employee_id",
    "contract_id",
]


def supabase_patch_batch(table: str, rows: list[dict], id_field: str = "id") -> bool:
    """Faz PATCH individual em cada registro pelo id (update, nao insert)."""
    base_url = f"{SUPABASE_URL}/rest/v1/{table}"
    errors = []

    for i, row in enumerate(rows):
        row_id = row[id_field]
        payload_data = {k: v for k, v in row.items() if k != id_field}
        payload = json.dumps(payload_data).encode("utf-8")
        url = f"{base_url}?{id_field}=eq.{row_id}"

        patch_headers = {**HEADERS}
        patch_headers.pop("Prefer", None)  # PATCH nao precisa de Prefer

        req = urllib.request.Request(url, data=payload, headers=patch_headers, method="PATCH")
        try:
            with urllib.request.urlopen(req) as resp:
                pass  # 204 No Content e esperado
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            errors.append(f"  [ERRO] id={row_id}: HTTP {e.code} -- {body[:200]}")
        except Exception as e:
            errors.append(f"  [ERRO] id={row_id}: {e}")

        if (i + 1) % 20 == 0 or (i + 1) == len(rows):
            print(f"  Progresso: {i + 1}/{len(rows)}")

    if errors:
        for err in errors:
            print(err)
        return False
    return True


def supabase_upsert(table: str, rows: list[dict]) -> bool:
    """Faz upsert em lotes de 100 para evitar timeout."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    batch_size = 100
    total = len(rows)
    errors = []

    for i in range(0, total, batch_size):
        batch = rows[i:i + batch_size]
        payload = json.dumps(batch).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers=HEADERS, method="POST")
        req.add_header("Prefer", "resolution=merge-duplicates")

        try:
            with urllib.request.urlopen(req) as resp:
                status = resp.getcode()
                if status not in (200, 201):
                    errors.append(f"  Lote {i//batch_size + 1}: HTTP {status}")
                else:
                    print(f"  [OK] Lote {i//batch_size + 1}: {len(batch)} registros atualizados ({i + len(batch)}/{total})")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            errors.append(f"  [ERRO] Lote {i//batch_size + 1}: HTTP {e.code} -- {body[:200]}")
        except Exception as e:
            errors.append(f"  [ERRO] Lote {i//batch_size + 1}: {e}")

    if errors:
        for err in errors:
            print(err)
        return False
    return True


def restore_loans(backup_path: str) -> bool:
    print(f"\nLendo backup de contratos: {backup_path}")
    with open(backup_path, encoding="utf-8") as f:
        records = json.load(f)

    print(f"   {len(records)} contratos encontrados no backup.")

    # Monta os payloads de upsert com id + campos restauráveis
    rows = []
    for r in records:
        row = {"id": r["id"]}
        for field in LOANS_RESTORE_FIELDS:
            if field in r:
                row[field] = r[field]
        rows.append(row)

    print(f"Restaurando {len(rows)} contratos em employee_loans (PATCH por ID)...")
    return supabase_patch_batch("employee_loans", rows)


def restore_payments(backup_path: str) -> bool:
    print(f"\nLendo backup de parcelas: {backup_path}")
    with open(backup_path, encoding="utf-8") as f:
        records = json.load(f)

    print(f"   {len(records)} parcelas encontradas no backup.")

    rows = []
    for r in records:
        row = {"id": r["id"]}
        for field in PAYMENTS_RESTORE_FIELDS:
            if field in r:
                row[field] = r[field]
        rows.append(row)

    print(f"Restaurando {len(rows)} parcelas em loan_payments...")
    return supabase_upsert("loan_payments", rows)


if __name__ == "__main__":
    print("=" * 60)
    print("RESTORE - Banco de Dados Emprestimos (10/06/2026)")
    print("=" * 60)

    ok_loans    = restore_loans(LOANS_BACKUP)
    ok_payments = restore_payments(PAYMENTS_BACKUP)

    print("\n" + "=" * 60)
    if ok_loans and ok_payments:
        print("[OK] RESTORE CONCLUIDO COM SUCESSO!")
        print("   employee_loans  -> restaurado")
        print("   loan_payments   -> restaurado")
    else:
        print("[AVISO] RESTORE CONCLUIDO COM ERROS. Verifique acima.")
    print("=" * 60)
