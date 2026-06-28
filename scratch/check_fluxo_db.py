import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_SERVICE_KEY")
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json"
}

print(f"SUPABASE_URL: {SUPABASE_URL}")

# 1. Verificar se a tabela fluxo_caixa_projetado existe e quantos registros tem
try:
    resp = requests.get(f"{SUPABASE_URL}/rest/v1/fluxo_caixa_projetado?select=count", headers=HEADERS)
    print(f"fluxo_caixa_projetado count status: {resp.status_code}")
    print(f"fluxo_caixa_projetado count headers: {resp.headers.get('Content-Range') or resp.text}")
except Exception as e:
    print(f"Erro ao consultar fluxo_caixa_projetado: {e}")

# 2. Verificar logs de sincronização
try:
    resp = requests.get(f"{SUPABASE_URL}/rest/v1/logs_sincronizacao_fluxo?order=data_hora.desc&limit=5", headers=HEADERS)
    print(f"\nlogs_sincronizacao_fluxo status: {resp.status_code}")
    if resp.status_code == 200:
        logs = resp.json()
        print(f"Últimos {len(logs)} logs:")
        for log in logs:
            print(f"- {log['data_hora']} | {log['empresa_consultada']} | {log['status_execucao']} | Retornados: {log['registros_retornados']} | Erros: {log['erros_api']}")
    else:
        print(f"Erro nos logs: {resp.text}")
except Exception as e:
    print(f"Erro ao consultar logs: {e}")
