"""
diagnose_quitados.py
Identifica contratos que deveriam estar quitados mas o novo sistema nao reconhece.
Logica: 
  - Busca todos os contratos e suas parcelas
  - Calcula o saldo devedor novo modo (baseado em status PAGO de loan_payments)
  - Compara com a logica antiga (paid_installments + amount_paid_extra)
  - Lista divergencias visiveis para o usuario
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
}

def fetch(table, extra=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*{extra}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

def main():
    print("Buscando dados do banco...")
    loans    = fetch("employee_loans")
    payments = fetch("loan_payments")

    # Indexa parcelas por contract_id
    pay_by_contract = {}
    for p in payments:
        cid = p.get("contract_id") or p.get("loan_id")
        pay_by_contract.setdefault(cid, []).append(p)

    print(f"Total contratos: {len(loans)}")
    print(f"Total parcelas: {len(payments)}")
    print()

    problemas = []
    quitados_corretos = []

    for loan in loans:
        cid = loan["id"]
        amount      = float(loan.get("amount") or 0)
        installments = int(loan.get("installments") or 1)
        parcela_valor = amount / installments

        parcelas = pay_by_contract.get(cid, [])
        
        # Modo NOVO: conta parcelas PAGO em loan_payments
        pagas_novo   = sum(1 for p in parcelas if p.get("status") == "PAGO")
        pendentes    = sum(1 for p in parcelas if p.get("status") == "PENDENTE")
        valor_pago_novo = sum(float(p.get("amount") or parcela_valor) 
                              for p in parcelas if p.get("status") == "PAGO")
        saldo_novo   = amount - valor_pago_novo
        
        # Modo ANTIGO: paid_installments + amount_paid_extra
        paid_inst    = int(loan.get("paid_installments") or 0)
        extra_paid   = float(loan.get("amount_paid_extra") or 0)
        saldo_antigo = max(0, amount - (paid_inst * parcela_valor) - extra_paid)

        # Classificacao
        quitado_antigo = saldo_antigo <= 0.01
        quitado_novo   = saldo_novo <= 0.01

        if quitado_antigo and not quitado_novo:
            # Sistema antigo diz quitado, novo diz aberto -> PROBLEMA
            problemas.append({
                "id": cid[:8],
                "amount": amount,
                "installments": installments,
                "parcelas_total": len(parcelas),
                "pagas_novo": pagas_novo,
                "pendentes": pendentes,
                "saldo_novo": round(saldo_novo, 2),
                "saldo_antigo": round(saldo_antigo, 2),
                "paid_inst_antigo": paid_inst,
                "extra_paid": extra_paid,
            })
        elif quitado_novo:
            quitados_corretos.append(cid[:8])

    print(f"Contratos quitados reconhecidos corretamente: {len(quitados_corretos)}")
    print(f"Contratos quitados NAO reconhecidos pelo novo sistema: {len(problemas)}")
    print()
    
    if problemas:
        print("DETALHES DOS CONTRATOS COM PROBLEMA:")
        print("-" * 80)
        for p in problemas:
            print(f"  ID: {p['id']}... | Valor: R${p['amount']:.2f} | {p['installments']}x")
            print(f"    Parcelas no banco: {p['parcelas_total']} | PAGO: {p['pagas_novo']} | PENDENTE: {p['pendentes']}")
            print(f"    Saldo novo: R${p['saldo_novo']:.2f} | Saldo antigo: R${p['saldo_antigo']:.2f}")
            print(f"    paid_installments: {p['paid_inst_antigo']} | amount_paid_extra: R${p['extra_paid']:.2f}")
            print()
    
    # Salva resultado para usar no fix
    with open("scratch/quitados_problema.json", "w", encoding="utf-8") as f:
        json.dump(problemas, f, indent=2, ensure_ascii=False)
    print(f"Lista salva em scratch/quitados_problema.json")

if __name__ == "__main__":
    main()
