import os
import sys
import json
import requests
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Import the OmieSync class and helpers from sync_omie_unified_v4
from sync_omie_unified_v4 import (
    OmieSync,
    push_to_supabase,
    log,
    URL_CP,
    URL_CR
)

def run_sync():
    start_date = "01/01/2024"
    apps = [
        {"key": os.getenv("OMIE_APP_KEY_G2"), "sec": os.getenv("OMIE_APP_SECRET_G2"), "name": "G2"},
        {"key": os.getenv("OMIE_APP_KEY_CONECTIUS"), "sec": os.getenv("OMIE_APP_SECRET_CONECTIUS"), "name": "Conectius"}
    ]

    for app in apps:
        if not app["key"] or not app["sec"]:
            log(f"[WARN] Chaves não configuradas para {app['name']}. Pulando...")
            continue

        log(f"\n==========================================")
        log(f">>> Sincronizando {app['name']} a partir de {start_date}")
        log(f"==========================================")

        sync = OmieSync(app["key"], app["sec"], app["name"])
        sync.sync_dimensions()

        # Contas a Pagar
        log("Processando Contas a Pagar...")
        recs_cp = sync.fetch_records(URL_CP, "ListarContasPagar", "conta_pagar_cadastro", start_date)
        rows_cp = sync.process_cp_cr(recs_cp, "PAGAR")
        log(f"  CP processados: {len(rows_cp)} linhas de alocação")

        # Contas a Receber
        log("Processando Contas a Receber...")
        recs_cr = sync.fetch_records(URL_CR, "ListarContasReceber", "conta_receber_cadastro", start_date)
        rows_cr = sync.process_cp_cr(recs_cr, "RECEBER")
        log(f"  CR processados: {len(rows_cr)} linhas de alocação")

        # Movimentos Bancários / Extratos
        log("Processando Movimentos Bancários...")
        recs_mov = sync.fetch_movimentos(start_date)
        rows_mov = sync.process_movimentos(recs_mov)
        log(f"  MOV processados: {len(rows_mov)} linhas")

        all_rows = rows_cp + rows_cr + rows_mov
        log(f"Enviando {len(all_rows)} registros para omie_financas_unificado no Supabase...")
        push_to_supabase(all_rows)
        log(f"[SUCESSO] {app['name']} sincronizada com sucesso!")

    log("\nTodas as empresas G2 e Conectius foram sincronizadas com o Supabase!")

if __name__ == "__main__":
    run_sync()
