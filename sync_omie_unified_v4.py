import os
import sys
import json
import time
import urllib.parse
import requests
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Configuração de Ambiente
load_dotenv()

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()

# Endpoints Omie
URL_CP = "https://app.omie.com.br/api/v1/financas/contapagar/"
URL_CR = "https://app.omie.com.br/api/v1/financas/contareceber/"
URL_MOV = "https://app.omie.com.br/api/v1/financas/mf/"
URL_GERAL = "https://app.omie.com.br/api/v1/geral/"

MIN_CUTOFF_BR = "01/06/2025"
MIN_CUTOFF_ISO = "2025-06-01"

DEFAULT_EMPRESA_IDS = {
    "mar brasil": "8w7sxfya",
    "dzm": "8w7t3s0f",
    "g2": "g2",
    "conectius": "conectius",
}


def get_supabase_headers(prefer="resolution=merge-duplicates"):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


HEADERS_SB = get_supabase_headers()


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")
    sys.stdout.flush()


def format_date_br_to_iso(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%d/%m/%Y").strftime("%Y-%m-%d")
    except Exception:
        return None


def format_date_iso_to_iso(date_str):
    if not date_str:
        return None
    try:
        if "/" in date_str:
            return format_date_br_to_iso(date_str)
        return datetime.strptime(date_str[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
    except Exception:
        return None


def normalize_company_name(name):
    raw = str(name or "").strip()
    lower = raw.lower()
    if lower in ("mar brasil", "marbrasil", "marbr", "mar br"):
        return "Mar Brasil"
    if lower == "dzm":
        return "DZM"
    if lower == "g2":
        return "G2"
    if lower == "conectius":
        return "Conectius"
    return raw


def resolve_empresa_id(empresa_nome, explicit_id=None):
    exp = str(explicit_id or "").strip()
    if exp and not exp.endswith("_ID_PLACEHOLDER"):
        return exp
    norm_key = normalize_company_name(empresa_nome).lower()
    if norm_key in DEFAULT_EMPRESA_IDS:
        return DEFAULT_EMPRESA_IDS[norm_key]
    slug = "".join(ch for ch in norm_key if ch.isalnum())
    return slug or "default"


def resolve_omie_apps(empresa_filter="all"):
    """
    Resolve empresas configuradas priorizando variaveis nomeadas (OMIE_APP_KEY_*)
    com fallback automatico para variaveis numeradas (OMIE_APP_1_KEY..OMIE_APP_4_KEY).
    Deduplica por nome normalizado de empresa e garante empresa_id oficial.
    """
    apps_by_name = {}

    named_specs = [
        ("Mar Brasil", "OMIE_APP_KEY_MARBRASIL", "OMIE_APP_SECRET_MARBRASIL", "OMIE_APP_EMPRESA_ID_MARBRASIL"),
        ("DZM", "OMIE_APP_KEY_DZM", "OMIE_APP_SECRET_DZM", "OMIE_APP_EMPRESA_ID_DZM"),
        ("G2", "OMIE_APP_KEY_G2", "OMIE_APP_SECRET_G2", "OMIE_APP_EMPRESA_ID_G2"),
        ("Conectius", "OMIE_APP_KEY_CONECTIUS", "OMIE_APP_SECRET_CONECTIUS", "OMIE_APP_EMPRESA_ID_CONECTIUS"),
    ]
    for name, k_var, s_var, id_var in named_specs:
        key = (os.getenv(k_var) or "").strip()
        sec = (os.getenv(s_var) or "").strip()
        if key and sec:
            norm_name = normalize_company_name(name)
            emp_id = resolve_empresa_id(norm_name, os.getenv(id_var))
            apps_by_name[norm_name.lower()] = {
                "key": key,
                "sec": sec,
                "name": norm_name,
                "empresa_id": emp_id,
            }

    for idx in ("1", "2", "3", "4"):
        key = (os.getenv(f"OMIE_APP_{idx}_KEY") or os.getenv(f"OMIE_APP_KEY_{idx}") or "").strip()
        sec = (os.getenv(f"OMIE_APP_{idx}_SECRET") or os.getenv(f"OMIE_APP_SECRET_{idx}") or "").strip()
        if not (key and sec):
            continue
        raw_name = (
            os.getenv(f"OMIE_APP_{idx}_EMPRESA_NOME")
            or os.getenv(f"OMIE_APP_EMPRESA_NOME_{idx}")
            or f"Empresa {idx}"
        )
        norm_name = normalize_company_name(raw_name)
        raw_id = os.getenv(f"OMIE_APP_{idx}_EMPRESA_ID") or os.getenv(f"OMIE_APP_EMPRESA_ID_{idx}")
        emp_id = resolve_empresa_id(norm_name, raw_id)
        if norm_name.lower() not in apps_by_name:
            apps_by_name[norm_name.lower()] = {
                "key": key,
                "sec": sec,
                "name": norm_name,
                "empresa_id": emp_id,
            }

    apps = list(apps_by_name.values())
    if empresa_filter and str(empresa_filter).strip().lower() != "all":
        target = normalize_company_name(empresa_filter).lower()
        apps = [a for a in apps if a["name"].lower() == target]
    return apps


def compute_start_date(start_date_arg=MIN_CUTOFF_BR, days_arg=None, today_dt=None):
    """Calcula a data inicial (DD/MM/AAAA) respeitando o corte minimo 01/06/2025."""
    cutoff = datetime.strptime(MIN_CUTOFF_BR, "%d/%m/%Y")
    if days_arg is not None:
        base_today = today_dt or datetime.now()
        dt = base_today - timedelta(days=max(0, int(days_arg)))
        if dt < cutoff:
            dt = cutoff
        return dt.strftime("%d/%m/%Y")
    try:
        dt = datetime.strptime((start_date_arg or MIN_CUTOFF_BR).strip(), "%d/%m/%Y")
        if dt < cutoff:
            dt = cutoff
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return MIN_CUTOFF_BR


EXCLUSION_KEYWORDS = [
    'mutuo',          # mútuo entradas/saídas
    'mútuo',
    'rendimento',     # rendimentos de aplicações
    'renda fixa',     # renda fixa
    'recarga',        # recarga de cartão corporativo
    'integraliza',    # integralização de capital
    'estorno',        # estornos bancários, estornos de pagamento
    'devolu',         # devoluções de compras/serviços
    'créditos mar brasil',
    'creditos mar brasil',
    'crédito mar brasil',
    'credito mar brasil',
    'antecipa',       # antecipações DZM, antecipações eventuais
    'aporte',         # aporte de capital
    'classificar'     # a classificar
]

COMPACT_RAW_TOP_KEYS = (
    "codigo_lancamento_omie", "status_titulo", "id_conta_corrente", "nCodCC", "cContaCorrente",
    "id_origem", "observacao", "codigo_cliente_fornecedor", "cnpj_cpf", "cCPFCNPJCliente",
    "nm_cliente", "nome_cliente", "codigo_projeto", "nCodProjeto", "cCodProjeto",
    "numero_parcela", "valor_documento", "valor_ir", "valor_iss", "valor_pis",
    "valor_cofins", "valor_csll", "valor_inss", "data_vencimento", "data_emissao",
    "cNumeroContrato", "numero_pedido", "chave_nfe",
)

COMPACT_RAW_DET_KEYS = (
    "nCodTitulo", "cCodCateg", "cDesCateg", "cOrigem", "cGrupo", "cNatureza", "observacao",
    "cObservacao", "cDesMov", "nCodCC", "cContaCorrente", "nCodMovCC", "cNumDocFiscal",
    "nCodCliente", "cCPFCNPJCliente", "cNomeCliente", "cNomPessoa", "cCodProjeto", "nCodProjeto",
    "cNumParcela", "cNumParc", "numero_parcela", "nValorIR", "nValorISS", "nValorPIS",
    "nValorCOFINS", "nValorCSLL", "nValorINSS", "nValorTitulo", "dDtVenc", "dDtEmissao",
    "cNumCtr", "cNumOS", "cChaveNFe", "cUsInc", "dDtInc",
)


def compact_raw_data(raw):
    """Preserva apenas os campos de raw_data lidos pelo DRE-Caixa, DRE-Painel e Conciliacao PJ."""
    if not isinstance(raw, dict):
        return {}
    out = {}
    for k in COMPACT_RAW_TOP_KEYS:
        v = raw.get(k)
        if v not in (None, "", 0, 0.0, False):
            out[k] = v

    dist = raw.get("distribuicao")
    if isinstance(dist, list) and len(dist) > 1:
        compact_dist = []
        for d in dist:
            if isinstance(d, dict):
                item = {k: d[k] for k in ("cDesDep", "nValDep", "nPerDep") if d.get(k) not in (None, "")}
                if item:
                    compact_dist.append(item)
        if compact_dist:
            out["distribuicao"] = compact_dist

    info = raw.get("info")
    if isinstance(info, dict):
        compact_info = {k: info[k] for k in ("uInc", "dInc") if info.get(k) not in (None, "")}
        if compact_info:
            out["info"] = compact_info

    cab = raw.get("cabecalho")
    if isinstance(cab, dict):
        compact_cab = {k: cab[k] for k in ("cNumParcela", "numero_parcela") if cab.get(k) not in (None, "")}
        if compact_cab:
            out["cabecalho"] = compact_cab

    res = raw.get("resumo")
    if isinstance(res, dict):
        compact_res = {k: res[k] for k in ("nValPago", "nValLiquido") if res.get(k) not in (None, 0, 0.0)}
        if compact_res:
            out["resumo"] = compact_res

    det = raw.get("detalhes")
    if isinstance(det, dict):
        compact_det = {k: det[k] for k in COMPACT_RAW_DET_KEYS if det.get(k) not in (None, "", 0, 0.0)}
        if compact_det:
            out["detalhes"] = compact_det

    return out


def is_excluded_caixa(c_categ, cat_nome, obs=""):
    code = str(c_categ or "").strip()
    if code.startswith("0.") or code == "0.01":
        return True

    text = f"{str(cat_nome or '').lower()} {str(obs or '').lower()}"
    if "transferência" in text or "transferencia" in text:
        return True

    for kw in EXCLUSION_KEYWORDS:
        if kw in text:
            return True

    return False


def upsert_dimension_table(table_name, rows, on_conflict, chunk_size=500):
    """Persiste registros de dimensao no Supabase com merge-duplicates e falha explicita."""
    if not rows:
        return True
    if not SUPABASE_URL or not SUPABASE_KEY:
        log(f"  [ERRO] SUPABASE_URL/SUPABASE_SERVICE_KEY ausentes para gravar {table_name}.")
        return False

    conflict_param = urllib.parse.quote(on_conflict, safe=",")
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?on_conflict={conflict_param}"
    headers = get_supabase_headers()

    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        try:
            resp = requests.post(url, headers=headers, json=chunk, timeout=40)
            if resp.status_code not in (200, 201, 204):
                log(f"  [ERRO] Falha ao gravar {table_name} (HTTP {resp.status_code}): {resp.text[:300]}")
                return False
        except Exception as e:
            log(f"  [ERRO] Excecao ao gravar {table_name}: {e}")
            return False
    return True


class OmieSync:
    def __init__(self, app_key, app_secret, empresa_nome, empresa_id=None):
        self.app_key = app_key
        self.app_secret = app_secret
        self.empresa_nome = normalize_company_name(empresa_nome)
        self.empresa_id = resolve_empresa_id(self.empresa_nome, empresa_id)
        self.cat_map = {}
        self.proj_map = {}
        self.forn_map = {}
        self.proj_records = []
        self.forn_records = []

    def call_api(self, url, call, param):
        payload = {
            "call": call,
            "app_key": self.app_key,
            "app_secret": self.app_secret,
            "param": [param]
        }
        for i in range(3):
            try:
                resp = requests.post(url, json=payload, timeout=40)
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code == 429:
                    time.sleep(2 * (i + 1))
                else:
                    log(f"Erro API ({resp.status_code}): {resp.text[:200]}")
            except Exception as e:
                log(f"Erro Conexão: {e}")
                time.sleep(1)
        return {}

    def sync_dimensions(self):
        log(f"Carregando dimensões para {self.empresa_nome} (id={self.empresa_id})...")
        self.cat_map = {}
        self.proj_map = {}
        self.forn_map = {}
        self.proj_records = []
        self.forn_records = []

        # Categorias (Paginado - Limite de 100 da Omie)
        pagina = 1
        while True:
            res = self.call_api(f"{URL_GERAL}categorias/", "ListarCategorias", {"pagina": pagina, "registros_por_pagina": 100})
            cats = res.get("categoria_cadastro", [])
            if not cats:
                break
            for c in cats:
                cod = str(c.get("codigo") or "").strip()
                if not cod:
                    continue
                self.cat_map[cod] = {
                    "descricao": c.get("descricao"),
                    "codigo_conta_dre": c.get("codigo_dre")
                }
            if pagina >= res.get("total_de_paginas", 0):
                break
            pagina += 1
        log(f"  [OK] {len(self.cat_map)} categorias memorizadas.")

        # Projetos (Paginado - Limite de 100 da Omie)
        pagina = 1
        seen_proj = set()
        while True:
            res = self.call_api(f"{URL_GERAL}projetos/", "ListarProjetos", {"pagina": pagina, "registros_por_pagina": 100})
            projs = res.get("cadastro", [])
            if not projs:
                break
            for p in projs:
                raw_cod = p.get("codigo")
                if raw_cod is None or str(raw_cod).strip() == "":
                    continue
                p_nome = p.get("nome") or ""
                if "casa tupi" in p_nome.lower() or "tupi 771" in p_nome.lower():
                    p_nome = "Núcleo Jurídico"
                cod_str = str(raw_cod).strip()
                self.proj_map[cod_str] = p_nome
                if cod_str not in seen_proj:
                    seen_proj.add(cod_str)
                    self.proj_records.append({
                        "codigo_projeto": raw_cod,
                        "descricao_projeto": p_nome,
                    })
            if pagina >= res.get("total_de_paginas", 0):
                break
            pagina += 1
        log(f"  [OK] {len(self.proj_map)} projetos memorizados.")

        # Clientes/Fornecedores (Paginado - Limite de 100 da Omie)
        pagina = 1
        seen_forn = set()
        while True:
            res = self.call_api(f"{URL_GERAL}clientes/", "ListarClientes", {"pagina": pagina, "registros_por_pagina": 100})
            clients = res.get("clientes_cadastro", [])
            if not clients:
                break
            for f in clients:
                raw_cod = f.get("codigo_cliente_omie")
                if raw_cod is None or str(raw_cod).strip() == "":
                    continue
                cod_str = str(raw_cod).strip()
                info = {
                    "nome_fantasia": f.get("nome_fantasia"),
                    "razao_social": f.get("razao_social"),
                    "cnpj_cpf": f.get("cnpj_cpf"),
                    "codigo_cliente_integracao": f.get("codigo_cliente_integracao")
                }
                self.forn_map[cod_str] = info
                if cod_str not in seen_forn:
                    seen_forn.add(cod_str)
                    self.forn_records.append({
                        "codigo_cliente_omie": raw_cod,
                        **info,
                    })
            if pagina >= res.get("total_de_paginas", 0):
                break
            pagina += 1
        log(f"  [OK] {len(self.forn_map)} fornecedores/clientes memorizados.")

    def build_dim_categorias_payload(self):
        return [{
            "empresa_id": self.empresa_id,
            "empresa_nome": self.empresa_nome,
            "omie_app": "dashboard",
            "codigo_categoria": cod,
            "descricao_categoria": info.get("descricao"),
            "codigo_conta_dre": info.get("codigo_conta_dre"),
        } for cod, info in self.cat_map.items()]

    def build_dim_projetos_payload(self):
        source = self.proj_records or [
            {"codigo_projeto": int(k) if str(k).isdigit() else k, "descricao_projeto": v}
            for k, v in self.proj_map.items()
        ]
        seen = set()
        rows = []
        for p in source:
            cod = p.get("codigo_projeto")
            key = str(cod)
            if not key or key in seen:
                continue
            seen.add(key)
            rows.append({
                "empresa_id": self.empresa_id,
                "empresa_nome": self.empresa_nome,
                "omie_app": "dashboard",
                "codigo_projeto": cod,
                "descricao_projeto": p.get("descricao_projeto"),
            })
        return rows

    def build_dim_fornecedores_payload(self, now_iso=None):
        ts = now_iso or datetime.now(timezone.utc).isoformat()
        source = self.forn_records or [
            {"codigo_cliente_omie": int(k) if str(k).isdigit() else k, **v}
            for k, v in self.forn_map.items()
        ]
        seen = set()
        rows = []
        for f in source:
            cod = f.get("codigo_cliente_omie")
            key = str(cod)
            if not key or key in seen:
                continue
            seen.add(key)
            rows.append({
                "empresa_id": self.empresa_id,
                "empresa_nome": self.empresa_nome,
                "omie_app": "dashboard",
                "codigo_cliente_omie": cod,
                "nome_fantasia": f.get("nome_fantasia"),
                "razao_social": f.get("razao_social"),
                "cnpj_cpf": f.get("cnpj_cpf"),
                "codigo_cliente_integracao": f.get("codigo_cliente_integracao"),
                "last_update": ts,
            })
        return rows

    def persist_dimensions(self):
        log(f"Persistindo dimensões de {self.empresa_nome} no Supabase...")
        ok_cat = upsert_dimension_table(
            "omie_dim_categorias",
            self.build_dim_categorias_payload(),
            "empresa_id,codigo_categoria",
        )
        ok_proj = upsert_dimension_table(
            "omie_dim_projetos",
            self.build_dim_projetos_payload(),
            "empresa_id,codigo_projeto",
        )
        ok_forn = upsert_dimension_table(
            "omie_dim_fornecedores",
            self.build_dim_fornecedores_payload(),
            "empresa_id,codigo_cliente_omie",
        )
        if ok_cat and ok_proj and ok_forn:
            log(
                f"  [OK] Dimensões persistidas ({len(self.cat_map)} cats, "
                f"{len(self.proj_map)} projs, {len(self.forn_map)} fornecedores)."
            )
            return True
        return False

    def fetch_records(self, url, call, list_key, start_date=None, status_filter=None):
        records = []
        pagina = 1
        while True:
            param = {
                "pagina": pagina,
                "registros_por_pagina": 100,
                "exibir_obs": "S"
            }
            if start_date:
                param["filtrar_por_data_de"] = start_date
            if status_filter:
                param["filtrar_por_status"] = status_filter
            data = self.call_api(url, call, param)
            items = data.get(list_key, [])
            if not items:
                break
            records.extend(items)
            if pagina >= data.get("total_de_paginas", 0):
                break
            pagina += 1
            log(f"  {list_key} ({status_filter or start_date}): Lendo página {pagina-1}...")
        return records

    def build_mov_map(self, records):
        mov_map = {}
        for m in records:
            det = m.get("detalhes", {})
            res = m.get("resumo", {})
            tit = str(det.get("nCodTitulo") or "").strip()
            if tit and tit != "0":
                dt_mov = format_date_iso_to_iso(
                    det.get("dDtPagamento") or
                    det.get("dDtCredito") or
                    det.get("dDtDebito") or
                    det.get("dDtPagto")
                )
                val_mov = float(res.get("nValLiquido") or res.get("nValPago") or det.get("nValorMovCC") or det.get("nValorTitulo") or 0)
                mov_cc = str(det.get("nCodMovCC") or "").strip()
                c_orig = str(det.get("cOrigem") or "").upper()
                if dt_mov:
                    if tit not in mov_map:
                        mov_map[tit] = {
                            "data_pagamento": dt_mov,
                            "valor_pago": val_mov,
                            "nCodMovCC": mov_cc,
                            "cOrigem": c_orig,
                            "raw_mov": m
                        }
                    else:
                        if dt_mov > mov_map[tit]["data_pagamento"]:
                            mov_map[tit]["data_pagamento"] = dt_mov
                        if mov_cc:
                            mov_map[tit]["nCodMovCC"] = mov_cc
                        if val_mov > 0 and (mov_map[tit]["valor_pago"] == 0 or c_orig in ["BAXR", "BAXP"]):
                            mov_map[tit]["valor_pago"] = val_mov
        return mov_map

    def process_cp_cr(self, records, tipo, mov_map=None):
        if mov_map is None:
            mov_map = {}
        rows = []
        sign = -1 if tipo == "PAGAR" else 1
        for r in records:
            omie_id = r.get("codigo_lancamento_omie")
            status = r.get("status_titulo")
            if str(status or "").upper().strip() == "CANCELADO":
                continue

            # Filtro de Exclusão de Categorias Não Operacionais
            cat_codigo = r.get("codigo_categoria")
            cat_nome = self.cat_map.get(str(cat_codigo), {}).get("descricao") or r.get("descricao_categoria")
            obs = str(r.get("observacao") or "").lower()
            if is_excluded_caixa(cat_codigo, cat_nome, obs):
                continue

            omie_id_str = str(omie_id).strip() if omie_id else ""
            doc_val = float(r.get("valor_documento") or 0)

            if omie_id_str and omie_id_str in mov_map:
                m_info = mov_map[omie_id_str]
                data_pagamento = m_info["data_pagamento"]
                val_efetivo = m_info["valor_pago"]
                ratio = (val_efetivo / doc_val) if (doc_val > 0 and val_efetivo > 0) else 1.0
                valor_total = (val_efetivo if val_efetivo > 0 else doc_val) * sign
                status = "PAGO" if tipo == "PAGAR" else "RECEBIDO"
            else:
                dt_baixa = format_date_iso_to_iso(r.get("data_baixa") or r.get("data_liquidacao"))
                data_pagamento = dt_baixa
                valor_total = doc_val * sign
                ratio = 1.0

            dt_previsao = format_date_iso_to_iso(r.get("data_previsao"))
            raw_dist = r.get("distribuicao", [])
            if not raw_dist:
                raw_dist = [{"cDesDep": "Sem Departamento", "nValDep": r.get("valor_documento")}]

            cliente_forn = None
            f_info = self.forn_map.get(str(r.get("codigo_cliente_fornecedor")))
            if f_info:
                cliente_forn = f_info.get("nome_fantasia") or f_info.get("razao_social")
            if not cliente_forn:
                cliente_forn = r.get("nm_cliente") or (r.get("cnab_integracao_bancaria") or {}).get("nome_transferencia") or "N/D"

            dt_emissao = format_date_iso_to_iso(r.get("data_emissao"))
            dt_entrada = format_date_iso_to_iso(r.get("data_entrada"))
            dt_registro_raw = format_date_iso_to_iso(r.get("data_registro"))
            dt_vencimento = format_date_iso_to_iso(r.get("data_vencimento"))
            dt_inc = format_date_iso_to_iso((r.get("info") or {}).get("dInc"))

            data_registro = dt_entrada or dt_registro_raw or dt_emissao or dt_vencimento or dt_inc

            for d in raw_dist:
                rows.append({
                    "empresa_nome": self.empresa_nome,
                    "omie_id": omie_id,
                    "tipo_registro": tipo,
                    "status": status,
                    "valor_total": valor_total,
                    "valor_alocado": float(d.get("nValDep") or 0) * ratio * sign,
                    "data_emissao": dt_emissao,
                    "data_registro": data_registro,
                    "data_vencimento": dt_vencimento,
                    "data_previsao": dt_previsao,
                    "data_pagamento": data_pagamento,
                    "categoria_codigo": cat_codigo,
                    "categoria_nome": cat_nome,
                    "projeto_nome": self.proj_map.get(str(r.get("codigo_projeto")), r.get("nome_projeto") or "Sem Projeto"),
                    "departamento_nome": d.get("cDesDep"),
                    "cliente_fornecedor": cliente_forn,
                    "numero_documento": r.get("numero_documento") or r.get("numero_documento_fiscal"),
                    "raw_data": compact_raw_data(r)
                })
        return rows

    def fetch_movimentos(self, start_date):
        records = []
        pagina = 1
        while True:
            param = {
                "nPagina": pagina,
                "nRegPorPagina": 100,
                "dDtPagtoDe": start_date,
                "lDadosCad": True
            }
            data = self.call_api(URL_MOV, "ListarMovimentos", param)
            items = data.get("movimentos", [])
            if not items:
                break
            records.extend(items)
            if pagina >= data.get("nTotPaginas", 0):
                break
            pagina += 1
            log(f"  Movimentos: Lendo página {pagina-1}...")
        return records

    def process_movimentos(self, records, known_titles=None):
        if known_titles is None:
            known_titles = set()
        rows = []
        for r in records:
            det = r.get("detalhes", {})
            res = r.get("resumo", {})

            n_cod_tit = str(det.get("nCodTitulo") or "").strip()
            n_cod_mov = str(det.get("nCodMovCC") or "").strip()
            if n_cod_tit and n_cod_tit != "0" and n_cod_tit in known_titles:
                continue
            if n_cod_mov and n_cod_mov in known_titles:
                continue

            c_nat = (det.get("cNatureza") or "").upper()
            c_grp = (det.get("cGrupo") or "").upper()
            c_orig = (det.get("cOrigem") or "").upper()
            c_categ = str(det.get("cCodCateg") or "").strip()
            cat_info = self.cat_map.get(c_categ)
            if isinstance(cat_info, dict):
                cat_nome = cat_info.get("descricao") or "Sem Categoria"
            else:
                cat_nome = cat_info or "Sem Categoria"

            obs = (det.get("observacao") or "").lower()

            if (c_categ.startswith("0.") or c_categ == "0.01" or
                    "TRANSF" in c_grp or "TRANSF" in c_orig or c_orig in ["TRAR", "TRAP", "TRF"] or
                    "transferência" in cat_nome.lower() or "transferencia" in cat_nome.lower() or
                    "transferência" in obs or "transferencia" in obs or
                    is_excluded_caixa(c_categ, cat_nome, obs)):
                continue

            is_entrada = (c_nat == "R") or ("REC" in c_grp) or c_categ.startswith("1.") or (det.get("cTipo") == "E")
            sign = 1 if is_entrada else -1
            tipo_registro = "MOVIMENTO"

            valor = float(det.get("nValorMovCC") or res.get("nValPago") or res.get("nValLiquido") or det.get("nValorTitulo") or 0)

            dt_pagto_mov = format_date_iso_to_iso(
                det.get("dDtPagamento") or
                det.get("dDtPagto") or
                det.get("dDtCredito") or
                det.get("dDtDebito") or
                det.get("dDataPagamento") or
                det.get("dDtRegistro")
            )
            dt_registro_mov = format_date_iso_to_iso(det.get("dDtRegistro"))
            dt_venc_mov = format_date_iso_to_iso(det.get("dDtVenc"))
            dt_inc_mov = format_date_iso_to_iso(det.get("dDtInc") or (r.get("info") or {}).get("dInc"))
            data_registro = dt_registro_mov or dt_pagto_mov or dt_venc_mov or dt_inc_mov

            forn_cod = str(det.get("nCodCliente") or det.get("codigo_cliente_fornecedor") or "")
            forn_entry = self.forn_map.get(forn_cod) or {}
            cliente_forn = forn_entry.get("nome_fantasia") or forn_entry.get("razao_social") or det.get("cNomeCliente") or "N/D"

            rows.append({
                "empresa_nome": self.empresa_nome,
                "omie_id": det.get("nCodMovCC") or det.get("nCodTitulo"),
                "tipo_registro": tipo_registro,
                "status": "PAGO" if not is_entrada else "RECEBIDO",
                "valor_total": valor * sign,
                "valor_alocado": valor * sign,
                "data_emissao": format_date_iso_to_iso(det.get("dDtEmissao")),
                "data_registro": data_registro,
                "data_vencimento": dt_venc_mov,
                "data_previsao": dt_pagto_mov,
                "data_pagamento": dt_pagto_mov,
                "categoria_codigo": det.get("cCodCateg"),
                "categoria_nome": cat_nome,
                "projeto_nome": self.proj_map.get(str(det.get("cCodProjeto") or det.get("nCodProjeto") or "")) or "Sem Projeto",
                "departamento_nome": "Principal",
                "cliente_fornecedor": cliente_forn,
                "numero_documento": det.get("cNumDocFiscal") or det.get("cNumTitulo"),
                "raw_data": compact_raw_data(r)
            })
        return rows


def push_to_supabase(rows, extra_delete_ids=None):
    if not rows:
        return True
    if not SUPABASE_URL or not SUPABASE_KEY:
        log("Erro: SUPABASE_URL/SUPABASE_SERVICE_KEY ausentes.")
        return False

    log(f"Enviando {len(rows)} registros para o Supabase...")
    headers = get_supabase_headers()
    had_error = False

    if extra_delete_ids is None:
        extra_delete_ids = set()

    groups = {}
    for r in rows:
        key = (r["empresa_nome"], r["tipo_registro"])
        groups.setdefault(key, []).append(r)

    for (empresa, _tipo), group_rows in groups.items():
        emp_encoded = urllib.parse.quote(str(empresa), safe="")
        if extra_delete_ids:
            extra_list = [str(x) for x in extra_delete_ids if x]
            for j in range(0, len(extra_list), 100):
                batch_extra = extra_list[j:j + 100]
                extra_str = ",".join(batch_extra)
                del_extra_url = f"{SUPABASE_URL}/rest/v1/omie_financas_unificado?empresa_nome=eq.{emp_encoded}&omie_id=in.({extra_str})"
                resp = requests.delete(del_extra_url, headers=headers, timeout=40)
                if resp.status_code not in (200, 204):
                    log(f"Erro ao limpar espelhos antigos: {resp.text[:300]}")
                    had_error = True
            extra_delete_ids = set()

        by_omie_id = {}
        no_id_rows = []
        for r in group_rows:
            oid = r.get("omie_id")
            if oid not in [None, "None", ""]:
                by_omie_id.setdefault(str(oid), []).append(r)
            else:
                no_id_rows.append(r)

        chunk = []
        chunk_ids = []
        for oid_str, oid_rows in by_omie_id.items():
            if len(chunk) + len(oid_rows) > 100 and chunk:
                ids_str = ",".join(chunk_ids)
                del_url = f"{SUPABASE_URL}/rest/v1/omie_financas_unificado?empresa_nome=eq.{emp_encoded}&omie_id=in.({ids_str})"
                del_resp = requests.delete(del_url, headers=headers, timeout=40)
                if del_resp.status_code not in (200, 204):
                    log(f"Erro ao deletar registros antigos: {del_resp.text[:300]}")
                    had_error = True
                post_resp = requests.post(f"{SUPABASE_URL}/rest/v1/omie_financas_unificado", headers=headers, json=chunk, timeout=40)
                if post_resp.status_code not in (200, 201, 204):
                    log(f"Erro ao inserir novos registros: {post_resp.text[:300]}")
                    had_error = True
                chunk = []
                chunk_ids = []
            chunk.extend(oid_rows)
            chunk_ids.append(oid_str)

        if chunk:
            ids_str = ",".join(chunk_ids)
            del_url = f"{SUPABASE_URL}/rest/v1/omie_financas_unificado?empresa_nome=eq.{emp_encoded}&omie_id=in.({ids_str})"
            del_resp = requests.delete(del_url, headers=headers, timeout=40)
            if del_resp.status_code not in (200, 204):
                log(f"Erro ao deletar registros antigos: {del_resp.text[:300]}")
                had_error = True
            post_resp = requests.post(f"{SUPABASE_URL}/rest/v1/omie_financas_unificado", headers=headers, json=chunk, timeout=40)
            if post_resp.status_code not in (200, 201, 204):
                log(f"Erro ao inserir novos registros: {post_resp.text[:300]}")
                had_error = True

        for i in range(0, len(no_id_rows), 100):
            sub = no_id_rows[i:i + 100]
            post_resp = requests.post(f"{SUPABASE_URL}/rest/v1/omie_financas_unificado", headers=headers, json=sub, timeout=40)
            if post_resp.status_code not in (200, 201, 204):
                log(f"Erro ao inserir registros sem omie_id: {post_resp.text[:300]}")
                had_error = True

    return not had_error


def reconcile_cancelled_open_titles(sync, mov_map=None):
    """
    Consulta todos os títulos EMABERTO no Omie (Contas a Pagar e Contas a Receber),
    atualiza-os no Supabase e expurga do Supabase quaisquer títulos que constavam
    como 'A VENCER' / 'ATRASADO' / 'VENCE HOJE' / 'ABERTO' mas foram cancelados/excluídos no Omie.
    """
    log(f"Reconciliando títulos EM ABERTO e expurgando cancelados/excluídos para {sync.empresa_nome}...")
    open_cp = sync.fetch_records(URL_CP, "ListarContasPagar", "conta_pagar_cadastro", status_filter="EMABERTO")
    open_cr = sync.fetch_records(URL_CR, "ListarContasReceber", "conta_receber_cadastro", status_filter="EMABERTO")

    active_cp_ids = set(str(r.get("codigo_lancamento_omie")) for r in open_cp if r.get("codigo_lancamento_omie"))
    active_cr_ids = set(str(r.get("codigo_lancamento_omie")) for r in open_cr if r.get("codigo_lancamento_omie"))

    rows_open_cp = sync.process_cp_cr(open_cp, "PAGAR", mov_map=mov_map)
    rows_open_cr = sync.process_cp_cr(open_cr, "RECEBER", mov_map=mov_map)
    all_open_rows = [
        r for r in (rows_open_cp + rows_open_cr)
        if (r.get("data_pagamento") or r.get("data_registro") or r.get("data_vencimento") or "9999-12-31") >= MIN_CUTOFF_ISO
    ]
    had_error = False
    if all_open_rows:
        if not push_to_supabase(all_open_rows):
            had_error = True

    headers = get_supabase_headers()
    emp_encoded = urllib.parse.quote(str(sync.empresa_nome), safe="")
    offset = 0
    limit = 1000
    zombie_row_ids = []
    while True:
        q_url = (
            f"{SUPABASE_URL}/rest/v1/omie_financas_unificado"
            f"?select=id,omie_id,tipo_registro,status"
            f"&empresa_nome=eq.{emp_encoded}"
            f"&status=in.(%22A%20VENCER%22,%22ATRASADO%22,%22VENCE%20HOJE%22,%22ABERTO%22,%22PAGTO_PARCIAL%22)"
            f"&order=id.asc&offset={offset}&limit={limit}"
        )
        resp = requests.get(q_url, headers=headers, timeout=40)
        if resp.status_code != 200:
            log(f"Erro ao buscar titulos em aberto no Supabase: {resp.text[:300]}")
            had_error = True
            break
        db_items = resp.json()
        if not db_items:
            break
        for item in db_items:
            oid = str(item.get("omie_id") or "")
            t_reg = item.get("tipo_registro")
            if t_reg == "PAGAR" and oid not in active_cp_ids:
                zombie_row_ids.append(str(item["id"]))
            elif t_reg == "RECEBER" and oid not in active_cr_ids:
                zombie_row_ids.append(str(item["id"]))
        if len(db_items) < limit:
            break
        offset += limit

    if zombie_row_ids:
        log(f"  [EXPURGO] Removendo {len(zombie_row_ids)} lançamentos cancelados/excluídos no Omie para {sync.empresa_nome}...")
        for i in range(0, len(zombie_row_ids), 100):
            batch = zombie_row_ids[i:i + 100]
            ids_str = ",".join(batch)
            del_url = f"{SUPABASE_URL}/rest/v1/omie_financas_unificado?id=in.({ids_str})"
            del_resp = requests.delete(del_url, headers=headers, timeout=40)
            if del_resp.status_code not in (200, 204):
                log(f"Erro ao expurgar titulos zumbis: {del_resp.text[:300]}")
                had_error = True
    else:
        log(f"  [OK] Nenhum lançamento órfão/cancelado encontrado para {sync.empresa_nome}.")

    return not had_error


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Sincronizador Unificado Omie -> Supabase")
    parser.add_argument("--start-date", default=MIN_CUTOFF_BR, help=f"Data de início (DD/MM/AAAA) [{MIN_CUTOFF_BR}]")
    parser.add_argument("--days", type=int, default=None, help="Opcional: sincronizar apenas os últimos N dias (respeitando corte 01/06/2025)")
    parser.add_argument("--empresa", default="all", help="Empresa (Mar Brasil, DZM, G2, Conectius ou all)")
    parser.add_argument("--dimensions-only", action="store_true", help="Sincroniza e persiste apenas as 3 tabelas de dimensão (categorias, projetos, fornecedores)")
    parser.add_argument("--skip-dimensions-db", action="store_true", help="Não grava dimensões no Supabase (apenas memória + títulos/movimentos)")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        log("[ERRO] SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios.")
        sys.exit(1)

    start_date = compute_start_date(args.start_date, args.days)
    apps = resolve_omie_apps(args.empresa)
    if not apps:
        log("[ERRO] Nenhum aplicativo Omie configurado encontrado para o filtro informado.")
        sys.exit(1)

    had_errors = False

    for app in apps:
        log(f"\n>>> Sincronizando {app['name']} (empresa_id={app['empresa_id']})")
        sync = OmieSync(app["key"], app["sec"], app["name"], empresa_id=app["empresa_id"])
        sync.sync_dimensions()

        if not args.skip_dimensions_db:
            if not sync.persist_dimensions():
                had_errors = True

        if args.dimensions_only:
            continue

        # 1. Movimentos Bancários / Extratos Reais PRIMEIRO (Fonte Única da Verdade para Regime de Caixa)
        log(f"Processando Movimentos Bancários (Extratos Reais desde {start_date})...")
        recs_mov = sync.fetch_movimentos(start_date)
        mov_map = sync.build_mov_map(recs_mov)
        log(f"  [OK] {len(mov_map)} títulos associados a movimentações no extrato bancário.")

        # 2. Contas a Pagar
        log("Processando Contas a Pagar...")
        recs_cp = sync.fetch_records(URL_CP, "ListarContasPagar", "conta_pagar_cadastro", start_date)
        rows_cp = sync.process_cp_cr(recs_cp, "PAGAR", mov_map=mov_map)

        # 3. Contas a Receber
        log("Processando Contas a Receber...")
        recs_cr = sync.fetch_records(URL_CR, "ListarContasReceber", "conta_receber_cadastro", start_date)
        rows_cr = sync.process_cp_cr(recs_cr, "RECEBER", mov_map=mov_map)

        known_titles = set(str(r["omie_id"]) for r in rows_cp + rows_cr if r.get("omie_id"))

        # 4. Movimentos Bancários não vinculados a títulos
        rows_mov = sync.process_movimentos(recs_mov, known_titles=known_titles)

        # 5. Push para o Supabase (com trava estrita >= 2025-06-01)
        all_rows = rows_cp + rows_cr + rows_mov
        all_rows = [
            r for r in all_rows
            if (r.get("data_pagamento") or r.get("data_registro") or "9999-12-31") >= MIN_CUTOFF_ISO
        ]

        extra_delete_ids = set()
        for _tit_id, m_info in mov_map.items():
            if m_info.get("nCodMovCC"):
                extra_delete_ids.add(m_info["nCodMovCC"])

        if not push_to_supabase(all_rows, extra_delete_ids=extra_delete_ids):
            had_errors = True
        if not reconcile_cancelled_open_titles(sync, mov_map=mov_map):
            had_errors = True

    if had_errors:
        log("\n[ERRO] Sincronização finalizada com falhas em uma ou mais etapas.")
        sys.exit(1)

    log("\nSincronização Finalizada com sucesso!")


if __name__ == "__main__":
    main()
