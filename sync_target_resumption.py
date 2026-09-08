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

def is_target_resumption(row):
    cat = (row.get("categoria_nome") or "").lower()
    obs = str(
        row.get("raw_data", {}).get("observacao") or 
        row.get("raw_data", {}).get("detalhes", {}).get("observacao") or 
        ""
    ).lower()
    text = f"{cat} {obs}"
    return (
        "intermedia" in text or 
        "terceiri" in text or 
        "dividendo" in text or 
        "distribuição de lucro" in text or 
        "distribuicao de lucro" in text
    )

def run_resumption():
    start_date = "01/06/2025"
    log(f"Iniciando sincronização específica para Intermediação, Terceirização e Dividendos (>= {start_date})...")

    apps = [
        {"key": os.getenv("OMIE_APP_KEY_MARBRASIL"), "sec": os.getenv("OMIE_APP_SECRET_MARBRASIL"), "name": "Mar Brasil"},
        {"key": os.getenv("OMIE_APP_KEY_DZM"), "sec": os.getenv("OMIE_APP_SECRET_DZM"), "name": "DZM"},
        {"key": os.getenv("OMIE_APP_KEY_G2"), "sec": os.getenv("OMIE_APP_SECRET_G2"), "name": "G2"},
        {"key": os.getenv("OMIE_APP_KEY_CONECTIUS"), "sec": os.getenv("OMIE_APP_SECRET_CONECTIUS"), "name": "Conectius"}
    ]

    total_target_rows = []

    for app in apps:
        if not app["key"] or not app["sec"]:
            log(f"[WARN] Chaves não configuradas para {app['name']}. Pulando...")
            continue

        log(f"\n==========================================")
        log(f">>> Processando {app['name']} a partir de {start_date}")
        log(f"==========================================")

        sync = OmieSync(app["key"], app["sec"], app["name"])
        sync.sync_dimensions()

        # 1. Contas a Pagar
        log("Processando Contas a Pagar...")
        recs_cp = sync.fetch_records(URL_CP, "ListarContasPagar", "conta_pagar_cadastro", start_date)
        rows_cp = sync.process_cp_cr(recs_cp, "PAGAR")
        target_cp = [r for r in rows_cp if is_target_resumption(r)]
        log(f"  CP: Total {len(rows_cp)} linhas | Alvos encontrados: {len(target_cp)}")

        # 2. Contas a Receber
        log("Processando Contas a Receber...")
        recs_cr = sync.fetch_records(URL_CR, "ListarContasReceber", "conta_receber_cadastro", start_date)
        rows_cr = sync.process_cp_cr(recs_cr, "RECEBER")
        target_cr = [r for r in rows_cr if is_target_resumption(r)]
        log(f"  CR: Total {len(rows_cr)} linhas | Alvos encontrados: {len(target_cr)}")

        # 3. Mapear conhecidos
        known_titles = set(str(r["omie_id"]) for r in rows_cp + rows_cr if r.get("omie_id"))

        # 4. Movimentos Bancários / Extratos
        log("Processando Movimentos Bancários...")
        recs_mov = sync.fetch_movimentos(start_date)
        rows_mov = sync.process_movimentos(recs_mov, known_titles=known_titles)
        target_mov = [r for r in rows_mov if is_target_resumption(r)]
        log(f"  MOV: Total {len(rows_mov)} linhas | Alvos encontrados: {len(target_mov)}")

        company_targets = target_cp + target_cr + target_mov
        # Trava >= 2025-06-01
        company_targets = [
            r for r in company_targets 
            if (r.get("data_pagamento") or r.get("data_registro") or "9999-12-31") >= "2025-06-01"
        ]
        log(f"  >>> Enviando {len(company_targets)} registros para {app['name']} no Supabase...")
        push_to_supabase(company_targets)
        total_target_rows.extend(company_targets)

    log(f"\n==========================================")
    log(f"SUCESSO TOTAL! {len(total_target_rows)} lançamentos de Intermediação, Terceirização e Dividendos sincronizados no Supabase!")

if __name__ == "__main__":
    run_resumption()
