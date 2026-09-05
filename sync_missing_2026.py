import os
import sys
import json
import requests
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from sync_omie_unified_v4 import (
    OmieSync,
    push_to_supabase,
    log,
    URL_CP,
    URL_CR
)

def run_sync_recent():
    # Sincronização a partir de 01/06/2026 para carregar completamente Junho, Julho e Agosto de 2026
    start_date = "01/06/2026"
    log(f"Iniciando sincronização complementar para períodos recentes (>= {start_date})...")

    apps = [
        {"key": os.getenv("OMIE_APP_KEY_MARBRASIL"), "sec": os.getenv("OMIE_APP_SECRET_MARBRASIL"), "name": "Mar Brasil"},
        {"key": os.getenv("OMIE_APP_KEY_DZM"), "sec": os.getenv("OMIE_APP_SECRET_DZM"), "name": "DZM"},
        {"key": os.getenv("OMIE_APP_KEY_G2"), "sec": os.getenv("OMIE_APP_SECRET_G2"), "name": "G2"},
        {"key": os.getenv("OMIE_APP_KEY_CONECTIUS"), "sec": os.getenv("OMIE_APP_SECRET_CONECTIUS"), "name": "Conectius"}
    ]

    for app in apps:
        if not app["key"] or not app["sec"]:
            log(f"[WARN] Chaves não encontradas para {app['name']}. Pulando...")
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
        log(f"  CP processados: {len(rows_cp)} linhas")

        # Contas a Receber
        log("Processando Contas a Receber...")
        recs_cr = sync.fetch_records(URL_CR, "ListarContasReceber", "conta_receber_cadastro", start_date)
        rows_cr = sync.process_cp_cr(recs_cr, "RECEBER")
        log(f"  CR processados: {len(rows_cr)} linhas")

        # Movimentos Bancários / Extratos
        log("Processando Movimentos Bancários (Extratos com débito/crédito real)...")
        recs_mov = sync.fetch_movimentos(start_date)
        rows_mov = sync.process_movimentos(recs_mov)
        log(f"  MOV processados: {len(rows_mov)} linhas")

        all_rows = rows_cp + rows_cr + rows_mov
        # Trava estrita de corte: impedir qualquer lançamento com data anterior a 2025-06-01
        all_rows = [
            r for r in all_rows 
            if (r.get("data_pagamento") or r.get("data_registro") or "9999-12-31") >= "2025-06-01"
        ]

        log(f"Enviando {len(all_rows)} registros validados para {app['name']} no Supabase...")
        push_to_supabase(all_rows)
        log(f"[SUCESSO] {app['name']} atualizado com sucesso!")

    log("\nSincronização de Junho, Julho e Agosto finalizada com êxito!")

if __name__ == "__main__":
    run_sync_recent()
