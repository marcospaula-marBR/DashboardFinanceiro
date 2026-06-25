#!/usr/bin/env python3
"""
seed_dre_lancamentos.py
=======================
Carga inicial da tabela dre_lancamentos no Supabase.

Fontes:
  - dados-foraOmie.csv  → fonte='manual' (Conectius, Ybox, histórico pré-jun/25)
  - dados_tratado_jun25_em_diante.csv → fonte='omie'  (Mar Brasil e DZM jun/25+)

Execução:
  python seed_dre_lancamentos.py

  Flags opcionais:
  --dry-run          Mostra o que seria enviado, sem gravar no Supabase
  --apenas-manual    Envia somente dados-foraOmie (mais rápido para teste)
  --apenas-omie      Envia somente dados_tratado_jun25_em_diante
"""

import csv
import re
import os
import sys
import json
import time
import math
import urllib.request
import urllib.error
from datetime import datetime
from collections import defaultdict

# ── Configuração ─────────────────────────────────────────────────────────────
SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"
TABLE = "dre_lancamentos"

# Caminhos dos arquivos CSV (relativos ao diretório do script)
DIR = os.path.dirname(os.path.abspath(__file__))
FILE_MANUAL = os.path.join(DIR, "dashboard-v2", "public", "dados-foraOmie.csv")
FILE_OMIE   = os.path.join(DIR, "dashboard-v2", "public", "dados_tratado_jun25_em_diante.csv")

BATCH_SIZE  = 500   # registros por request ao Supabase
MESES_PT    = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]

# ── Helpers ───────────────────────────────────────────────────────────────────
def normalize_periodo(raw: str) -> str:
    """
    Normaliza 'jan/24' → 'Jan/24', 'January/2024' → 'Jan/24'
    """
    s = str(raw).strip().lower()
    mapa = {
        "jan":"Jan","fev":"Fev","feb":"Fev","mar":"Mar","abr":"Abr","apr":"Abr",
        "mai":"Mai","may":"Mai","jun":"Jun","jul":"Jul","ago":"Ago","aug":"Ago",
        "set":"Set","sep":"Set","out":"Out","oct":"Out","nov":"Nov","dez":"Dez","dec":"Dez"
    }
    for pt, norm in mapa.items():
        if s.startswith(pt):
            ano_match = re.search(r"\d{2,4}", s)
            if ano_match:
                ano = ano_match.group()
                if len(ano) == 4:
                    ano = ano[-2:]
                return f"{norm}/{ano}"
    return raw.strip()


def normalize_empresa(raw: str) -> str:
    """Padroniza nomes de empresa para o dashboard."""
    s = str(raw).strip()
    sup = s.upper()
    if re.search(r"D\.?Z\.?M", sup):     return "DZM"
    if "MAR BR" in sup:                   return "Mar Brasil"
    if "CONECTIUS" in sup:                return "Conectius"
    if "YBOX" in sup:                     return "Ybox"
    return s


def clean_valor(raw) -> float:
    """Converte valor string para float, retornando 0 em caso de vazio."""
    try:
        if raw is None or str(raw).strip() in ("", "N/D", "ND"):
            return 0.0
        s = str(raw).strip()
        # Remove possível sinal negativo (DRE usa valores absolutos)
        s = s.replace("-", "")
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            s = s.replace(",", ".")
        return abs(float(s))
    except Exception:
        return 0.0


def supabase_upsert(records: list, dry_run: bool = False) -> tuple:
    """
    Envia registros via upsert para o Supabase.
    Retorna (total_enviados, total_erros).
    """
    if dry_run:
        print(f"  [DRY-RUN] Enviaria {len(records)} registros")
        return len(records), 0

    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    headers = {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Prefer": "resolution=merge-duplicates,return=minimal"
    }

    enviados = 0
    erros = 0
    batches = math.ceil(len(records) / BATCH_SIZE)

    for i in range(batches):
        batch = records[i * BATCH_SIZE : (i + 1) * BATCH_SIZE]
        payload = json.dumps(batch).encode("utf-8")

        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                enviados += len(batch)
                print(f"  [OK] Batch {i+1}/{batches}: {len(batch)} registros enviados")
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"  [ERROR] Batch {i+1}/{batches} ERRO HTTP {e.code}: {body[:300]}")
            erros += len(batch)
        except Exception as ex:
            print(f"  [ERROR] Batch {i+1}/{batches} ERRO: {ex}")
            erros += len(batch)

        time.sleep(0.1)  # Rate-limit gentil

    return enviados, erros


def clear_source_data(fonte: str, dry_run: bool = False) -> bool:
    """
    Remove todos os registros de uma determinada fonte da tabela dre_lancamentos.
    """
    if dry_run:
        print(f"  [DRY-RUN] Limparia registros de fonte='{fonte}' da tabela dre_lancamentos")
        return True

    print(f"\nLimpando registros de fonte='{fonte}' na tabela dre_lancamentos no Supabase...")
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?fonte=eq.{fonte}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"  [OK] Registros de fonte='{fonte}' limpos com sucesso.")
            return True
    except Exception as e:
        print(f"  [ERROR] Erro ao limpar a tabela para fonte '{fonte}': {e}")
        return False


# ── Fase 2A: Seed dados-foraOmie.csv → fonte='manual' ──────────────────────
def seed_manual(dry_run: bool = False) -> int:
    print("\n" + "="*60)
    print("FASE 2A — dados-foraOmie.csv -> fonte='manual'")
    print("="*60)

    if not os.path.exists(FILE_MANUAL):
        print(f"  [ERROR] Arquivo não encontrado: {FILE_MANUAL}")
        return 0

    # Limpa dados anteriores da mesma fonte antes do novo seed
    clear_source_data("manual", dry_run)

    records = []
    skipped = 0

    for enc in ["utf-8-sig", "utf-8", "cp1252", "latin-1"]:
        try:
            print(f"  [DEBUG] Tentando encoding '{enc}' para FILE_MANUAL...")
            with open(FILE_MANUAL, "r", encoding=enc) as f:
                reader = csv.DictReader(f, delimiter=";")
                headers = reader.fieldnames or []
                mes_cols = [h for h in headers if "/" in h]

                for row in reader:
                    empresa     = normalize_empresa(row.get("Empresa", ""))
                    departamento = str(row.get("Departamento", "") or "").strip()
                    conta_dre   = str(row.get("Conta DRE", "") or "").strip()
                    categoria   = str(row.get("Categoria", "") or "").strip()

                    if not empresa or not categoria:
                        skipped += 1
                        continue

                    for mes_raw in mes_cols:
                        valor = clean_valor(row.get(mes_raw, ""))
                        if valor == 0.0:
                            continue  # Não inserir zeros — economiza espaço

                        periodo = normalize_periodo(mes_raw)
                        records.append({
                            "empresa":      empresa,
                            "departamento": departamento,
                            "conta_dre":    conta_dre,
                            "projeto":      "N/D",
                            "categoria":    categoria,
                            "periodo":      periodo,
                            "valor":        valor,
                            "fonte":        "manual"
                        })
            break
        except UnicodeDecodeError:
            continue

    print(f"  Registros gerados: {len(records):,} | Linhas ignoradas: {skipped}")
    if records:
        print("  Amostra dos 3 primeiros:")
        for r in records[:3]:
            print(f"    {r}")

    if not records:
        print("  [WARNING] Nenhum registro para enviar.")
        return 0

    enviados, erros = supabase_upsert(records, dry_run)
    print(f"\n  RESULTADO: {enviados:,} enviados | {erros:,} erros")
    return enviados


# ── Fase 2B: Seed dados_tratado_jun25_em_diante.csv → fonte='omie' ──────────
def seed_omie(dry_run: bool = False) -> int:
    print("\n" + "="*60)
    print("FASE 2B — dados_tratado_jun25_em_diante.csv -> fonte='omie'")
    print("="*60)

    if not os.path.exists(FILE_OMIE):
        print(f"  [ERROR] Arquivo não encontrado: {FILE_OMIE}")
        return 0

    # Limpa dados anteriores da mesma fonte antes do novo seed
    clear_source_data("omie", dry_run)

    # Mapeamento de colunas do CSV Omie (transacional) → campos da tabela
    pivot_map: dict = defaultdict(float)
    # pivot_map key: (empresa, departamento, conta_dre, projeto, categoria, periodo)

    linhas_lidas = 0
    linhas_ignoradas = 0

    for enc in ["utf-8-sig", "utf-8", "cp1252", "latin-1"]:
        try:
            print(f"  [DEBUG] Tentando encoding '{enc}' para FILE_OMIE...")
            with open(FILE_OMIE, "r", encoding=enc) as f:
                reader = csv.DictReader(f, delimiter=";")

                for row in reader:
                    linhas_lidas += 1

                    # ── Campos dimensionais ──
                    empresa_raw = (
                        row.get("Minha Empresa (Nome Fantasia)") or
                        row.get("Minha Empresa (Razão Social)") or ""
                    ).strip()
                    empresa = normalize_empresa(empresa_raw)
                    if not empresa:
                        linhas_ignoradas += 1
                        continue

                    departamento = str(row.get("Departamento") or "").strip()
                    conta_dre    = str(row.get("Conta do DRE") or "").strip()
                    projeto      = str(row.get("Projeto") or "").strip() or "N/D"
                    categoria    = str(row.get("Categoria") or "").strip()

                    if not categoria:
                        linhas_ignoradas += 1
                        continue

                    # ── Valor ──
                    valor = clean_valor(row.get("Valor", "0"))
                    if valor == 0.0:
                        linhas_ignoradas += 1
                        continue

                    # ── Período (Data MM/DD/YYYY do Omie) ──
                    data_raw = str(row.get("Data") or "").strip()
                    if not data_raw:
                        linhas_ignoradas += 1
                        continue

                    partes = data_raw.split("/")
                    if len(partes) == 3:
                        try:
                            mes  = int(partes[0])
                            ano  = partes[2].strip().split(" ")[0]  # Remove hora se houver
                            if mes < 1 or mes > 12:
                                # Pode ser DD/MM/YYYY (inverte)
                                mes = int(partes[1])
                            ano_curto = ano[-2:] if len(ano) == 4 else ano
                            periodo = f"{MESES_PT[mes-1]}/{ano_curto}"
                        except Exception:
                            linhas_ignoradas += 1
                            continue
                    else:
                        linhas_ignoradas += 1
                        continue

                    # ── Acumular no pivot ──
                    key = (empresa, departamento, conta_dre, projeto, categoria, periodo)
                    pivot_map[key] += valor

            break
        except UnicodeDecodeError:
            continue

    print(f"  Linhas do CSV lidas: {linhas_lidas:,} | ignoradas: {linhas_ignoradas:,}")
    print(f"  Combinações únicas pivotadas: {len(pivot_map):,}")

    records = []
    for (empresa, departamento, conta_dre, projeto, categoria, periodo), valor in pivot_map.items():
        if valor == 0.0:
            continue
        records.append({
            "empresa":      empresa,
            "departamento": departamento,
            "conta_dre":    conta_dre,
            "projeto":      projeto,
            "categoria":    categoria,
            "periodo":      periodo,
            "valor":        round(valor, 2),
            "fonte":        "omie"
        })

    print(f"  Registros para inserção (valor > 0): {len(records):,}")
    if records:
        print("  Amostra dos 3 primeiros:")
        for r in records[:3]:
            print(f"    {r}")

    if not records:
        print("  [WARNING] Nenhum registro para enviar.")
        return 0

    enviados, erros = supabase_upsert(records, dry_run)
    print(f"\n  RESULTADO: {enviados:,} enviados | {erros:,} erros")
    return enviados


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    dry_run      = "--dry-run"      in sys.argv
    apenas_manual = "--apenas-manual" in sys.argv
    apenas_omie   = "--apenas-omie"   in sys.argv

    print("=" * 60)
    print("  SEED — dre_lancamentos")
    print(f"  Modo: {'DRY-RUN (sem gravação)' if dry_run else 'PRODUÇÃO'}")
    print(f"  Data/hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    total = 0

    if not apenas_omie:
        total += seed_manual(dry_run)

    if not apenas_manual:
        total += seed_omie(dry_run)

    print("\n" + "=" * 60)
    print(f"  SEED CONCLUÍDO: {total:,} registros processados")
    print("  Execute para verificar no Supabase:")
    print("    SELECT fonte, COUNT(*), MIN(periodo), MAX(periodo)")
    print("    FROM dre_lancamentos")
    print("    GROUP BY fonte;")
    print("=" * 60)
