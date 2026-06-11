"""
inspect_backup_statuses.py
Mostra status das parcelas de cada contrato no backup.
"""
import json
from collections import Counter, defaultdict

with open("backup/loan_payments_backup_20260610_135026.json", encoding="utf-8") as f:
    payments = json.load(f)

with open("backup/employee_loans_backup_20260610_135026.json", encoding="utf-8") as f:
    loans = json.load(f)

pay_by = defaultdict(list)
for p in payments:
    cid = p.get("contract_id") or p.get("loan_id")
    pay_by[cid].append(p)

print("CONTRATOS E STATUS DAS PARCELAS NO BACKUP:")
print("-" * 100)
for loan in sorted(loans, key=lambda x: x.get("start_cycle", "")):
    cid = loan["id"]
    parcelas = pay_by.get(cid, [])
    statuses = Counter(p.get("status") for p in parcelas)
    amount = loan["amount"]
    installments = loan["installments"]
    paid_inst = loan.get("paid_installments", 0)
    extra = loan.get("amount_paid_extra", 0)
    parcela_val = amount / installments if installments else 0
    saldo_antigo = max(0, amount - paid_inst * parcela_val - extra)
    print(
        f"  {cid[:8]} | {amount:8.2f} {installments:2}x start={loan.get('start_cycle')} "
        f"| parcelas={len(parcelas)} {dict(statuses)} "
        f"| paid_inst={paid_inst} extra={extra} "
        f"| saldo={saldo_antigo:.2f}"
    )
