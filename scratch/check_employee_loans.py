"""
check_employee_loans.py
Busca emprestimos e parcelas de um colaborador pelo nome.
"""
import urllib.request
import json
import sys

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

def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

def main(name_filter):
    # Busca o colaborador
    import urllib.parse
    like = urllib.parse.quote(f"%{name_filter}%")
    employees = fetch(f"{SUPABASE_URL}/rest/v1/employees?select=id,name,full_name&or=(name.ilike.{like},full_name.ilike.{like})")
    
    if not employees:
        print(f"Nenhum colaborador encontrado com '{name_filter}'")
        return

    for emp in employees:
        eid = emp["id"]
        ename = emp.get("full_name") or emp.get("name")
        print(f"\nColaborador: {ename} (id: {eid})")
        print("=" * 80)

        # Busca contratos
        loans = fetch(f"{SUPABASE_URL}/rest/v1/employee_loans?select=*&employee_id=eq.{eid}")
        print(f"Total de contratos: {len(loans)}")

        for loan in loans:
            cid = loan["id"]
            amount = float(loan.get("amount") or 0)
            installments = int(loan.get("installments") or 1)
            parcela_val = amount / installments

            print(f"\n  Contrato: {cid}")
            print(f"  Valor: R${amount:.2f} em {installments}x (R${parcela_val:.2f}/parcela)")
            print(f"  Start cycle: {loan.get('start_cycle')} | paid_inst: {loan.get('paid_installments')} | extra: {loan.get('amount_paid_extra')}")
            print(f"  Notes: {loan.get('notes', '')[:80]}")

            # Busca parcelas
            payments = fetch(f"{SUPABASE_URL}/rest/v1/loan_payments?select=*&contract_id=eq.{cid}&order=due_date.asc")
            if not payments:
                payments = fetch(f"{SUPABASE_URL}/rest/v1/loan_payments?select=*&loan_id=eq.{cid}&order=due_date.asc")

            print(f"  Parcelas no banco: {len(payments)} (esperado: {installments})")
            print(f"  {'#':<3} {'due_date':<14} {'status':<12} {'paid_date':<14} {'amount':>10}")
            print(f"  {'-'*3} {'-'*14} {'-'*12} {'-'*14} {'-'*10}")
            
            pagas = 0
            saldo_real = 0
            for i, p in enumerate(payments, 1):
                status = p.get("status", "?")
                due    = p.get("due_date") or p.get("month_cycle") or "?"
                paid   = p.get("paid_date") or "-"
                amt    = float(p.get("amount") or parcela_val)
                if status == "PAGO":
                    pagas += 1
                else:
                    saldo_real += amt
                print(f"  {i:<3} {str(due):<14} {status:<12} {str(paid):<14} {amt:>10.2f}")

            print(f"\n  Saldo devedor (novo sistema): R${saldo_real:.2f}")
            print(f"  Parcelas PAGO: {pagas}/{len(payments)}")

            if len(payments) != installments:
                print(f"  ** ATENCAO: {len(payments)} parcelas no banco mas contrato diz {installments} **")

if __name__ == "__main__":
    name = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Ana Carolina"
    main(name)
