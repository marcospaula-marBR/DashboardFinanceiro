import sys
import urllib.request
import json
import os
from datetime import datetime

# Force UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

"""
backup_pre_audit.py
===================
Backup de seguranca DUPLO antes da auditoria de parcelas.

Camada 1: Salva JSON local (rapido, offline)
Camada 2: Verifica contagem e integridade dos dados

Tabelas alvo:
  - employee_loans   (contratos de emprestimo)
  - loan_payments    (parcelas - a que sofrara edicao)

Uso:
  python scratch/backup_pre_audit.py
"""

# Config
SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6"
    "InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ."
    "2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"
)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

TABLES = ["employee_loans", "loan_payments"]
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "backups")


def sep():
    print("-" * 60)


def fetch_table(table_name):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?select=*&order=created_at.asc"
    req = urllib.request.Request(url, headers=HEADERS, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def save_json(data, filename):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


def main():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    date_label = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    sep()
    print(f"  BACKUP PRE-AUDITORIA - {date_label}")
    sep()

    os.makedirs(BACKUP_DIR, exist_ok=True)

    summary = {}
    all_ok = True

    for table in TABLES:
        print(f"\n[...] Fazendo backup de: {table}")
        try:
            data = fetch_table(table)
            count = len(data)
            filename = os.path.join(BACKUP_DIR, f"{table}_backup_{timestamp}.json")
            save_json(data, filename)
            size_kb = os.path.getsize(filename) / 1024
            summary[table] = {"count": count, "file": filename, "data": data}
            print(f"  [OK] {count} registros -> {os.path.basename(filename)} ({size_kb:.1f} KB)")
        except Exception as e:
            print(f"  [ERRO] {e}")
            summary[table] = {"count": 0, "file": None, "data": [], "error": str(e)}
            all_ok = False

    # --- Relatorio de integridade ---
    print()
    sep()
    print("  RELATORIO DE INTEGRIDADE")
    sep()

    loans_count = summary.get("employee_loans", {}).get("count", 0)
    payments_count = summary.get("loan_payments", {}).get("count", 0)

    print(f"\n  Contratos (employee_loans):  {loans_count}")
    print(f"  Parcelas  (loan_payments):   {payments_count}")
    if loans_count > 0:
        print(f"  Media de parcelas/contrato:  {payments_count / loans_count:.1f}")

    # Distribuicao de status
    payments_data = summary.get("loan_payments", {}).get("data", [])
    if payments_data:
        status_counts = {}
        for p in payments_data:
            s = p.get("status", "?")
            status_counts[s] = status_counts.get(s, 0) + 1

        print("\n  Distribuicao de status das parcelas:")
        for status_key, cnt in sorted(status_counts.items()):
            pct = cnt / payments_count * 100 if payments_count > 0 else 0
            bar = "#" * int(pct / 5)
            print(f"    {status_key:<12} {cnt:>4} ({pct:5.1f}%)  {bar}")

    # Detecta excesso de parcelas pagas
    print("\n  Verificando contratos com possivel excesso de pagamentos...")
    loans_data = summary.get("employee_loans", {}).get("data", [])

    if loans_data and payments_data:
        loan_map = {ln["id"]: int(ln.get("installments") or 0) for ln in loans_data}

        paid_by_contract = {}
        for p in payments_data:
            cid = p.get("contract_id")
            if p.get("status") == "PAGO":
                paid_by_contract[cid] = paid_by_contract.get(cid, 0) + 1

        suspect = []
        for cid, paid in paid_by_contract.items():
            expected = loan_map.get(cid, 0)
            if expected > 0 and paid > expected:
                suspect.append({
                    "contract_id": cid,
                    "expected_installments": expected,
                    "paid_installments": paid,
                    "excess": paid - expected
                })

        if suspect:
            print(f"\n  [ATENCAO] {len(suspect)} contrato(s) com excesso de parcelas pagas!")
            for s in suspect:
                print(f"    * {s['contract_id'][:8]}... | Esperado: {s['expected_installments']} | Pago: {s['paid_installments']} | Excesso: +{s['excess']}")

            suspect_file = os.path.join(BACKUP_DIR, f"audit_suspects_{timestamp}.json")
            save_json(suspect, suspect_file)
            print(f"\n  [SALVO] Relatorio de suspeitos: {os.path.basename(suspect_file)}")
        else:
            print("  [OK] Nenhum contrato com excesso automaticamente detectado.")
            print("       (Confira manualmente os casos que voce ja identificou.)")

    # --- Resumo final ---
    print()
    sep()
    if all_ok:
        print(f"  [SUCESSO] BACKUP CONCLUIDO")
        print(f"  Arquivos salvos em: {BACKUP_DIR}")
    else:
        print("  [AVISO] BACKUP PARCIAL - verifique os erros acima antes de continuar!")
    sep()
    print()


if __name__ == "__main__":
    main()
