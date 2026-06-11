"""
fix_ana_carolina.py
===================
1. Marca como PAGO os contratos quitados (1c21b50d, 7bf406e1, bc021b6b)
2. Gera as 10 parcelas do contrato vigente 8e685570 (unico ativo)
"""
import urllib.request
import urllib.error
import json
import time
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

EMPLOYEE_ID   = "375072bd-3d95-439b-924f-4a51c278e083"  # Ana Carolina
QUITADOS      = ["1c21b50d-1609-49a2-b954-33b1ff3cc5b0",
                 "7bf406e1-3670-4287-82be-65cdd6098da9",
                 "bc021b6b-9a29-4698-8cfc-7668e1864c46"]
VIGENTE_ID    = "8e685570-a96a-4c16-8515-9dde086f1659"
VIGENTE_AMOUNT       = 4000.0
VIGENTE_INSTALLMENTS = 10

HOJE = date(2026, 6, 11)


def request(url, method="GET", body=None, retries=3):
    for attempt in range(1, retries + 1):
        try:
            data = json.dumps(body).encode("utf-8") if body is not None else None
            req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
            with urllib.request.urlopen(req, timeout=15) as r:
                raw = r.read().decode("utf-8")
                return json.loads(raw) if raw.strip() else []
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            print(f"  HTTP {e.code}: {err[:200]}")
            return None
        except Exception as e:
            if attempt < retries:
                time.sleep(2)
            else:
                print(f"  ERRO: {e}")
                return None


def mark_all_pago(contract_id):
    """Marca todas as parcelas PENDENTE de um contrato como PAGO."""
    payments = request(f"{SUPABASE_URL}/rest/v1/loan_payments?contract_id=eq.{contract_id}&status=eq.PENDENTE&select=id,due_date")
    if not payments:
        print(f"  Nenhuma parcela PENDENTE em {contract_id[:8]}")
        return

    print(f"  {len(payments)} parcelas PENDENTE para quitar...")
    for p in payments:
        pid = p["id"]
        due = (p.get("due_date") or "")[:10]
        paid_date = due if due else str(HOJE)
        result = request(
            f"{SUPABASE_URL}/rest/v1/loan_payments?id=eq.{pid}",
            method="PATCH",
            body={"status": "PAGO", "paid_date": paid_date}
        )
        if result is None:
            print(f"  ERRO ao atualizar parcela {pid[:8]}")
        else:
            print(f"  OK: parcela {pid[:8]} venc={due} -> PAGO")


def generate_payments_vigente():
    """Gera as 10 parcelas do contrato vigente 8e685570."""
    parcela_val = VIGENTE_AMOUNT / VIGENTE_INSTALLMENTS

    # Calcula as due_dates: dia 10 a partir de abril/2026
    due_dates = []
    year, month = 2026, 4
    for _ in range(VIGENTE_INSTALLMENTS):
        due_dates.append(date(year, month, 10))
        month += 1
        if month > 12:
            month = 1
            year += 1

    print(f"\nGerando {VIGENTE_INSTALLMENTS} parcelas para contrato {VIGENTE_ID[:8]}...")
    for i, due in enumerate(due_dates, 1):
        # Passadas (< hoje) -> PAGO; futuras -> PENDENTE
        if due < HOJE:
            status = "PAGO"
            paid_date = str(due)
        else:
            status = "PENDENTE"
            paid_date = None

        payload = {
            "contract_id": VIGENTE_ID,
            "employee_id": EMPLOYEE_ID,
            "amount": parcela_val,
            "due_date": str(due),
            "status": status,
            "paid_date": paid_date,
            "month_cycle": f"{due.year}-{due.month:02d}",
        }

        result = request(
            f"{SUPABASE_URL}/rest/v1/loan_payments",
            method="POST",
            body=payload
        )
        if result is None:
            print(f"  ERRO ao criar parcela {i} (venc: {due})")
        else:
            print(f"  OK: parcela {i:02d} venc={due} status={status}")


def main():
    print("=" * 60)
    print("FIX - Ana Carolina Pereira")
    print("=" * 60)

    # Passo 1: quitar contratos encerrados
    print("\n[1/2] Quitando contratos encerrados...")
    for cid in QUITADOS:
        print(f"\n  Contrato {cid[:8]}:")
        mark_all_pago(cid)

    # Passo 2: gerar parcelas do contrato vigente
    print("\n[2/2] Gerando parcelas do contrato vigente (8e685570)...")
    generate_payments_vigente()

    print("\n" + "=" * 60)
    print("[OK] Correcao da Ana Carolina concluida!")
    print("=" * 60)


if __name__ == "__main__":
    main()
