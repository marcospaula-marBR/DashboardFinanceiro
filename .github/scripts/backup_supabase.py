#!/usr/bin/env python3
"""
Script de Backup Completo e Resiliente do Supabase via REST API (Porta 443 HTTPS).
- Descobre automaticamente todas as tabelas via OpenAPI specification
- Baixa os registros paginados (em lotes)
- Salva cada tabela em JSON estruturado
- Gera manifesto com métricas de registros e integridade
- Empacota tudo em arquivo compactado .tar.gz
"""

import os
import sys
import json
import time
import tarfile
import argparse
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_headers(api_key: str):
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Range-Unit": "items"
    }

def discover_tables(base_url: str, api_key: str):
    """Consulta o schema OpenAPI do PostgREST para listar todas as tabelas disponíveis."""
    url = base_url.rstrip("/") + "/rest/v1/"
    req = urllib.request.Request(url, headers=get_headers(api_key))
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            definitions = data.get("definitions", {})
            tables = sorted(list(definitions.keys()))
            return tables
    except Exception as e:
        print(f"⚠️  Não foi possível obter OpenAPI spec completo ({e}). Utilizando lista essencial de tabelas.")
        return [
            "dre_lancamentos", "dre_snapshots", "dre_mensal", "dre_categoria_override",
            "employees", "employment_contracts", "people_monthly_costs", "employee_history",
            "employee_loans", "loan_payments", "clara_transactions", "clara_config",
            "omie_financas_unificado", "omie_dre", "omie_raw", "companies", "profiles",
            "whiteboard_state", "push_subscriptions"
        ]

def fetch_table_data(base_url: str, api_key: str, table: str, output_dir: Path):
    """Baixa todos os registros de uma tabela utilizando paginação por Range."""
    table_url = f"{base_url.rstrip('/')}/rest/v1/{table}?select=*"
    batch_size = 1000
    offset = 0
    all_rows = []
    headers = get_headers(api_key)
    headers["Prefer"] = "count=exact"

    while True:
        range_header = f"{offset}-{offset + batch_size - 1}"
        req_headers = dict(headers)
        req_headers["Range"] = range_header

        req = urllib.request.Request(table_url, headers=req_headers)
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                content = resp.read().decode("utf-8")
                rows = json.loads(content)
                if not rows:
                    break

                all_rows.extend(rows)
                
                content_range = resp.headers.get("Content-Range")
                if content_range and "/" in content_range:
                    total_str = content_range.split("/")[1]
                    if total_str != "*" and len(all_rows) >= int(total_str):
                        break

                if len(rows) < batch_size:
                    break

                offset += batch_size
        except urllib.error.HTTPError as e:
            # Algumas views ou tabelas do sistema podem retornar 403/404 se não forem consultáveis
            error_msg = e.read().decode('utf-8', errors='ignore')
            return table, 0, f"HTTP {e.code}: {error_msg}"
        except Exception as e:
            return table, 0, str(e)

    # Grava o arquivo JSON da tabela
    out_file = output_dir / f"{table}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_rows, f, ensure_ascii=False, indent=2)

    return table, len(all_rows), None

def generate_sql_inserts(data_dir: Path, sql_file: Path, manifest_tables: list):
    """Gera um arquivo SQL com instruções INSERT para facilitar restauração direta em banco Postgres."""
    with open(sql_file, "w", encoding="utf-8") as f_sql:
        f_sql.write("-- Supabase Database Full Backup Dump\n")
        f_sql.write(f"-- Data: {datetime.now().isoformat()}\n\n")

        for table in manifest_tables:
            json_file = data_dir / f"{table}.json"
            if not json_file.exists():
                continue

            with open(json_file, "r", encoding="utf-8") as f_json:
                rows = json.load(f_json)

            if not rows:
                continue

            cols = list(rows[0].keys())
            cols_escaped = ", ".join([f'"{c}"' for c in cols])

            f_sql.write(f"\n-- Tabela: {table} ({len(rows)} registros)\n")
            f_sql.write(f"BEGIN;\n")

            for row in rows:
                vals = []
                for c in cols:
                    v = row.get(c)
                    if v is None:
                        vals.append("NULL")
                    elif isinstance(v, bool):
                        vals.append("TRUE" if v else "FALSE")
                    elif isinstance(v, (int, float)):
                        vals.append(str(v))
                    elif isinstance(v, (dict, list)):
                        escaped_json = json.dumps(v, ensure_ascii=False).replace("'", "''")
                        vals.append(f"'{escaped_json}'::jsonb")
                    else:
                        escaped_str = str(v).replace("'", "''")
                        vals.append(f"'{escaped_str}'")

                f_sql.write(f"INSERT INTO \"{table}\" ({cols_escaped}) VALUES ({', '.join(vals)});\n")

            f_sql.write(f"COMMIT;\n")

def main():
    parser = argparse.ArgumentParser(description="Backup Completo do Supabase via REST API")
    parser.add_argument("--url", default=os.environ.get("SUPABASE_URL"), help="URL do Supabase")
    parser.add_argument("--key", default=os.environ.get("SUPABASE_SERVICE_KEY"), help="Service Role Key do Supabase")
    parser.add_argument("--output-dir", default=".", help="Diretório onde o arquivo final será salvo")
    parser.add_argument("--workers", type=int, default=6, help="Número de threads simultâneas para download")
    args = parser.parse_args()

    supabase_url = args.url
    service_key = args.key

    if not supabase_url or not service_key:
        print("❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios.", file=sys.stderr)
        sys.exit(1)

    print(f"📡 Iniciando backup da base Supabase: {supabase_url}")
    start_time = time.time()

    # 1. Descoberta de tabelas
    tables = discover_tables(supabase_url, service_key)
    print(f"📋 Total de tabelas/recursos descobertos: {len(tables)}")

    staging_dir = Path("supabase_backup_staging")
    if staging_dir.exists():
        import shutil
        shutil.rmtree(staging_dir)
    staging_dir.mkdir(parents=True, exist_ok=True)
    tables_dir = staging_dir / "tables"
    tables_dir.mkdir(parents=True, exist_ok=True)

    # 2. Download paralelo dos dados
    manifest = {
        "timestamp": datetime.now().isoformat(),
        "supabase_url": supabase_url,
        "tables_count": len(tables),
        "tables": {},
        "total_records": 0,
        "errors": []
    }

    successful_tables = []
    print(f"🚀 Baixando dados com {args.workers} workers simultâneos...")

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        future_to_table = {
            executor.submit(fetch_table_data, supabase_url, service_key, t, tables_dir): t
            for t in tables
        }

        completed = 0
        for future in as_completed(future_to_table):
            completed += 1
            table, count, err = future.result()
            if err:
                # print(f"⚠️  [{completed}/{len(tables)}] {table}: {err}")
                manifest["errors"].append({"table": table, "error": err})
            else:
                manifest["tables"][table] = count
                manifest["total_records"] += count
                successful_tables.append(table)
                if count > 0:
                    print(f"✅ [{completed}/{len(tables)}] {table}: {count} registros")
                else:
                    # Tabela vazia
                    pass

    print(f"\n📊 Resumo da Extração:")
    print(f"   - Tabelas com sucesso: {len(successful_tables)}")
    print(f"   - Total de registros extraídos: {manifest['total_records']}")

    # 3. Gera script SQL de restauração
    sql_file = staging_dir / "full_database_dump.sql"
    print(f"📝 Gerando script SQL consolidado (INSERTs)...")
    generate_sql_inserts(tables_dir, sql_file, successful_tables)

    # 4. Grava manifesto
    duration = time.time() - start_time
    manifest["duration_seconds"] = round(duration, 2)
    manifest_file = staging_dir / "manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    # 5. Empacota em tar.gz
    timestamp_str = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    tar_filename = f"supabase_backup_{timestamp_str}.tar.gz"
    output_path = Path(args.output_dir) / tar_filename

    print(f"📦 Compactando arquivos em {output_path.name}...")
    with tarfile.open(output_path, "w:gz") as tar:
        tar.add(staging_dir, arcname="backup")

    # Limpeza do staging
    import shutil
    shutil.rmtree(staging_dir)

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"\n🎉 BACKUP CONCLUÍDO COM SUCESSO!")
    print(f"   - Arquivo: {output_path}")
    print(f"   - Tamanho final: {file_size_mb:.2f} MB")
    print(f"   - Duração total: {duration:.2f} segundos")

    # Salva variável de ambiente se estiver rodando no GitHub Actions
    github_env = os.environ.get("GITHUB_ENV")
    if github_env and os.path.exists(github_env):
        with open(github_env, "a", encoding="utf-8") as f:
            f.write(f"RAW_BACKUP_FILE={output_path}\n")

if __name__ == "__main__":
    main()
