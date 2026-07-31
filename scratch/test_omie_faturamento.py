import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

companies = {
    "Mar Brasil": {
        "key": os.getenv("OMIE_APP_KEY_MARBRASIL"),
        "secret": os.getenv("OMIE_APP_SECRET_MARBRASIL")
    },
    "DZM": {
        "key": os.getenv("OMIE_APP_KEY_DZM"),
        "secret": os.getenv("OMIE_APP_SECRET_DZM")
    }
}

def call_omie(url, call_name, param, key, secret):
    payload = {
        "call": call_name,
        "app_key": key,
        "app_secret": secret,
        "param": [param]
    }
    headers = {"Content-Type": "application/json"}
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=15)
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"   [Error {resp.status_code}] {call_name}: {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"   [Exception] {call_name}: {e}")
        return None

results_summary = {}

for comp_name, creds in companies.items():
    key = creds["key"]
    secret = creds["secret"]
    if not key or not secret:
        continue
    
    print(f"\n========================================================")
    print(f"TESTANDO APIS OMIE DE FATURAMENTO / RECEBIVEIS: {comp_name.upper()}")
    print(f"========================================================")
    
    results_summary[comp_name] = {}
    
    # 1. Contas a Receber (ListarContasReceber)
    res_cr = call_omie(
        "https://app.omie.com.br/api/v1/financas/contareceber/",
        "ListarContasReceber",
        {"pagina": 1, "registros_por_pagina": 3},
        key, secret
    )
    if res_cr and "conta_receber_cadastro" in res_cr:
        items = res_cr["conta_receber_cadastro"]
        total = res_cr.get("total_de_registros", len(items))
        results_summary[comp_name]["ContasReceber"] = {"total": total, "sample": items[0]}
        print(f"[OK] [ContasReceber] Total: {total} registros. ID primeiro: {items[0].get('codigo_lancamento_omie')}")
    
    # 2. Ordens de Servico (ListarOS)
    res_os = call_omie(
        "https://app.omie.com.br/api/v1/servicos/os/",
        "ListarOS",
        {"pagina": 1, "registros_por_pagina": 3},
        key, secret
    )
    if res_os and "osCadastro" in res_os:
        items = res_os["osCadastro"]
        total = res_os.get("total_de_registros", len(items))
        results_summary[comp_name]["OrdensDeServico"] = {"total": total, "sample": items[0]}
        print(f"[OK] [OrdensDeServico] Total: {total} OSs. Numero primeira: {items[0].get('Cabecalho', {}).get('cNumOS')}")

    # 3. Pedidos de Venda (ListarPedidos)
    res_ped = call_omie(
        "https://app.omie.com.br/api/v1/produtos/pedido/",
        "ListarPedidos",
        {"pagina": 1, "registros_por_pagina": 3},
        key, secret
    )
    if res_ped and "pedido_venda_produto" in res_ped:
        items = res_ped["pedido_venda_produto"]
        total = res_ped.get("total_de_registros", len(items))
        results_summary[comp_name]["PedidosVenda"] = {"total": total, "sample": items[0]}
        print(f"[OK] [PedidosVenda] Total: {total} pedidos. Numero primeiro: {items[0].get('cabecalho', {}).get('numero_pedido')}")

    # 4. Movimentos Financeiros (ListarMovimentos)
    res_mov = call_omie(
        "https://app.omie.com.br/api/v1/financas/mf/",
        "ListarMovimentos",
        {"pagina": 1, "registros_por_pagina": 3, "data_de": "01/01/2026", "data_ate": "31/12/2026"},
        key, secret
    )
    if res_mov and "movimentos" in res_mov:
        items = res_mov["movimentos"]
        total = res_mov.get("total_de_registros", len(items))
        results_summary[comp_name]["MovimentosFinanceiros"] = {"total": total, "sample": items[0]}
        print(f"[OK] [MovimentosFinanceiros] Total em 2026: {total} movimentos.")

os.makedirs("scratch", exist_ok=True)
with open("scratch/omie_faturamento_samples.json", "w", encoding="utf-8") as f:
    json.dump(results_summary, f, indent=2, ensure_ascii=False)

print("\nSamples successfully saved to scratch/omie_faturamento_samples.json")
