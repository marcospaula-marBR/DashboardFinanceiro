"""
check_ana_carolina.py - Busca e inspeciona parcelas da Ana Carolina Pereira
"""
import urllib.request, json

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwi"
    "cm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0"
    "NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"
)
HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}

def fetch(path):
    req = urllib.request.Request(SUPABASE_URL + path, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode("utf-8"))

# 1. Busca todos os employees e filtra localmente
all_emps = fetch("/rest/v1/employees?select=id,full_name")
matches = [e for e in all_emps if "ana carolina" in (e.get("full_name") or "").lower()]

if not matches:
    print("Nenhum colaborador encontrado com 'Ana Carolina'")
    exit()

for emp in matches:
    eid = emp["id"]
    ename = emp["full_name"]
    print(f"\nColaborador: {ename}")
    print(f"ID: {eid}")
    print("=" * 80)

    loans = fetch(f"/rest/v1/employee_loans?select=*&employee_id=eq.{eid}")
    print(f"Contratos: {len(loans)}")

    for loan in loans:
        cid = loan["id"]
        amount = float(loan.get("amount") or 0)
        installments = int(loan.get("installments") or 1)
        pv = amount / installments
        paid_inst = loan.get("paid_installments", 0)
        extra = loan.get("amount_paid_extra", 0)

        print(f"\n  Contrato {cid[:8]}... | R${amount:.2f} em {installments}x")
        print(f"  Start: {loan.get('start_cycle')} | paid_inst: {paid_inst} | extra: {extra}")

        payments = fetch(f"/rest/v1/loan_payments?select=*&contract_id=eq.{cid}&order=due_date.asc")
        print(f"  Parcelas no banco: {len(payments)} | Esperado: {installments}")
        print(f"  {'#':<3} {'due_date':<14} {'status':<12} {'paid_date':<12} {'amount':>10}")
        print(f"  {'-'*55}")
        
        pagas = 0
        saldo = 0
        for i, p in enumerate(payments, 1):
            status = p.get("status", "?")
            due    = p.get("due_date") or p.get("month_cycle") or "?"
            paid   = p.get("paid_date") or "-"
            amt    = float(p.get("amount") or pv)
            if status == "PAGO":
                pagas += 1
            else:
                saldo += amt
            flag = " <-- EXTRA?" if i > installments else ""
            print(f"  {i:<3} {str(due):<14} {status:<12} {str(paid):<12} {amt:>10.2f}{flag}")

        print(f"\n  PAGO: {pagas}/{len(payments)} | Saldo devedor: R${saldo:.2f}")
        if len(payments) != installments:
            print(f"  ** ATENCAO: {len(payments)} parcelas no banco mas contrato tem {installments} **")
