"""
Sincronizador isolado do DRE Studio (Fase A).

Regras e garantias:
- Grava exclusivamente nas tabelas `dre_studio_categorias` e `dre_studio_lancamentos`.
- Nunca altera `omie_financas_unificado`, `dre_lancamentos` ou `dre_snapshots`.
- Preserva plano de categorias próprio por empresa via `(empresa_id, codigo_categoria)`
  e campos oficiais `dadosDRE` do Omie.
- Preenche conciliação bancária real (`conciliado`, `data_conciliacao`, `situacao_extrato`)
  via endpoint `ListarExtrato` do Omie (match 1-para-1 por ID e chave composta).
- Remove somente transferências internas (`0.*`, `transferencia='S'`, `TRAR`/`TRAP`/`TRF`)
  e títulos cancelados na coleta; regras de DRE Gerencial, Caixa e FCL são aplicadas na leitura.
- Armazena valores monetários em magnitude positiva (`abs`) com coluna explícita `sinal` (+1 entrada / -1 saída).
"""

import argparse
from collections import defaultdict, deque
from datetime import datetime, timedelta
import html
import os
import sys
import time
import urllib.parse

from dotenv import load_dotenv
import requests

load_dotenv()

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
).strip()

URL_CP = "https://app.omie.com.br/api/v1/financas/contapagar/"
URL_CR = "https://app.omie.com.br/api/v1/financas/contareceber/"
URL_MOV = "https://app.omie.com.br/api/v1/financas/mf/"
URL_EXTRATO = "https://app.omie.com.br/api/v1/financas/extrato/"
URL_GERAL = "https://app.omie.com.br/api/v1/geral/"

DEFAULT_EMPRESA_IDS = {
    "mar brasil": "8w7sxfya",
    "dzm": "8w7t3s0f",
    "g2": "g2",
    "conectius": "conectius",
}

COMPANY_CUTOVER_ISO = {
    "mar brasil": "2025-06-01",
    "dzm": "2025-06-01",
    "g2": "2026-05-01",
    "conectius": "2026-07-01",
}


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")
    sys.stdout.flush()


def decode_html_entities(text):
    if text is None:
        return ""
    return html.unescape(str(text)).strip()


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


def get_company_cutover_iso(empresa_nome):
    key = normalize_company_name(empresa_nome).lower()
    return COMPANY_CUTOVER_ISO.get(key, "2025-06-01")


def parse_br_date_to_iso(date_str):
    if not date_str:
        return None
    s = str(date_str).strip()
    if not s:
        return None
    try:
        if "/" in s:
            return datetime.strptime(s[:10], "%d/%m/%Y").strftime("%Y-%m-%d")
        return datetime.strptime(s[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
    except Exception:
        return None


def iso_to_br_date(iso_str):
    if not iso_str:
        return None
    return datetime.strptime(iso_str[:10], "%Y-%m-%d").strftime("%d/%m/%Y")


def resolve_omie_apps(empresa_filter="all"):
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
            apps_by_name[norm_name.lower()] = {
                "key": key,
                "sec": sec,
                "name": norm_name,
                "empresa_id": resolve_empresa_id(norm_name, os.getenv(id_var)),
                "cutover_iso": get_company_cutover_iso(norm_name),
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
        if norm_name.lower() not in apps_by_name:
            apps_by_name[norm_name.lower()] = {
                "key": key,
                "sec": sec,
                "name": norm_name,
                "empresa_id": resolve_empresa_id(norm_name, raw_id),
                "cutover_iso": get_company_cutover_iso(norm_name),
            }

    apps = list(apps_by_name.values())
    if empresa_filter and str(empresa_filter).strip().lower() != "all":
        target = normalize_company_name(empresa_filter).lower()
        apps = [a for a in apps if a["name"].lower() == target]
    return apps


def parse_category_record(empresa_id, empresa_nome, raw_cat):
    cod = str(raw_cat.get("codigo") or "").strip()
    if not cod:
        return None
    dados_dre = raw_cat.get("dadosDRE") if isinstance(raw_cat.get("dadosDRE"), dict) else {}
    cod_dre = str(dados_dre.get("codigoDRE") or raw_cat.get("codigo_dre") or "").strip() or None
    desc_dre = decode_html_entities(dados_dre.get("descricaoDRE") or "") or None
    sinal_dre = str(dados_dre.get("sinalDRE") or "").strip() or None
    nao_exibir_dre = (
        str(dados_dre.get("naoExibirDRE") or "N").strip().upper() == "S"
        or str(raw_cat.get("nao_exibir") or "N").strip().upper() == "S"
    )
    return {
        "empresa_id": empresa_id,
        "empresa_nome": empresa_nome,
        "codigo_categoria": cod,
        "descricao_categoria": decode_html_entities(raw_cat.get("descricao") or ""),
        "codigo_dre": cod_dre,
        "descricao_dre": desc_dre,
        "sinal_dre": sinal_dre,
        "nao_exibir_dre": nao_exibir_dre,
        "transferencia": str(raw_cat.get("transferencia") or "N").strip().upper() == "S",
        "conta_receita": str(raw_cat.get("conta_receita") or "N").strip().upper() == "S",
        "conta_despesa": str(raw_cat.get("conta_despesa") or "N").strip().upper() == "S",
        "conta_inativa": str(raw_cat.get("conta_inativa") or "N").strip().upper() == "S",
    }


def is_transfer_record(cat_info, cat_code, c_origem="", c_grupo=""):
    code = str(cat_code or "").strip()
    if cat_info and cat_info.get("transferencia"):
        return True
    if code.startswith("0.") or code == "0.01":
        return True
    orig = str(c_origem or "").strip().upper()
    if orig in ("TRAR", "TRAP", "TRF") or "TRANSF" in orig:
        return True
    grp = str(c_grupo or "").strip().upper()
    if "TRANSF" in grp:
        return True
    return False


class ExtratoReconciler:
    """Casa lançamentos financeiros com linhas do extrato Omie (conciliado/não conciliado)."""

    def __init__(self, extrato_items=None):
        self._entries = []
        self._by_id = defaultdict(deque)
        self._by_full = defaultdict(deque)
        self._by_fallback = defaultdict(deque)
        self._used = set()
        if extrato_items:
            for item in extrato_items:
                self.add_item(item)

    def add_item(self, item):
        situacao = decode_html_entities(item.get("cSituacao") or "")
        if not situacao:
            return
        idx = len(self._entries)
        dt_conc = parse_br_date_to_iso(item.get("dDataConciliacao"))
        dt_lanc = parse_br_date_to_iso(item.get("dDataLancamento"))
        cc_id = str(item.get("nCodCC") or "").strip()
        cli_id = str(item.get("nCodCliente") or "").strip()
        cat_code = str(item.get("cCodCategoria") or "").strip()
        abs_val = round(abs(float(item.get("nValorDocumento") or 0)), 2)

        entry = {
            "idx": idx,
            "situacao": situacao,
            "conciliado": situacao.lower() == "conciliado",
            "data_conciliacao": dt_conc if situacao.lower() == "conciliado" else None,
        }
        self._entries.append(entry)

        for key_name in ("nCodLancamento", "nCodLancRelac"):
            raw_id = str(item.get(key_name) or "").strip()
            if raw_id and raw_id not in ("0", "1"):
                self._by_id[raw_id].append(idx)

        if cc_id and dt_lanc:
            if cli_id:
                self._by_full[(cc_id, dt_lanc, cli_id, cat_code, abs_val)].append(idx)
            self._by_fallback[(cc_id, dt_lanc, cat_code, abs_val)].append(idx)

    def _pop_unused(self, q):
        while q:
            idx = q.popleft()
            if idx not in self._used:
                self._used.add(idx)
                return self._entries[idx]
        return None

    def match(self, cc_id, data_pagto_iso, cliente_cod, cat_code, abs_val, candidate_ids=None):
        for cid in candidate_ids or ():
            cid_s = str(cid or "").strip()
            if cid_s and cid_s in self._by_id:
                found = self._pop_unused(self._by_id[cid_s])
                if found:
                    return found["conciliado"], found["data_conciliacao"], found["situacao"]

        if cc_id and data_pagto_iso:
            cc_s = str(cc_id).strip()
            cli_s = str(cliente_cod or "").strip()
            cat_s = str(cat_code or "").strip()
            val_r = round(abs(float(abs_val or 0)), 2)

            if cli_s:
                k_full = (cc_s, data_pagto_iso, cli_s, cat_s, val_r)
                if k_full in self._by_full:
                    found = self._pop_unused(self._by_full[k_full])
                    if found:
                        return found["conciliado"], found["data_conciliacao"], found["situacao"]

            k_fb = (cc_s, data_pagto_iso, cat_s, val_r)
            if k_fb in self._by_fallback:
                found = self._pop_unused(self._by_fallback[k_fb])
                if found:
                    return found["conciliado"], found["data_conciliacao"], found["situacao"]

        return False, None, "Sem extrato"


def build_mov_enrichment_map(mov_records):
    mov_map = {}
    for m in mov_records:
        det = m.get("detalhes") or {}
        res = m.get("resumo") or {}
        tit = str(det.get("nCodTitulo") or "").strip()
        if not tit or tit == "0":
            continue
        dt_mov = parse_br_date_to_iso(
            det.get("dDtPagamento")
            or det.get("dDtCredito")
            or det.get("dDtDebito")
            or det.get("dDtPagto")
        )
        val_mov = float(
            res.get("nValLiquido")
            or res.get("nValPago")
            or det.get("nValorMovCC")
            or det.get("nValorTitulo")
            or 0
        )
        mov_cc = str(det.get("nCodMovCC") or "").strip()
        cc_id = str(det.get("nCodCC") or "").strip()
        c_orig = str(det.get("cOrigem") or "").upper()
        dt_reg = parse_br_date_to_iso(det.get("dDtRegistro"))

        if not dt_mov:
            continue
        if tit not in mov_map:
            mov_map[tit] = {
                "data_pagamento": dt_mov,
                "valor_pago": val_mov,
                "nCodMovCC": mov_cc,
                "nCodCC": cc_id,
                "cOrigem": c_orig,
                "dDtRegistro": dt_reg,
                "uInc": det.get("cUsInc"),
                "dInc": parse_br_date_to_iso(det.get("dDtInc")),
            }
        else:
            if dt_mov > mov_map[tit]["data_pagamento"]:
                mov_map[tit]["data_pagamento"] = dt_mov
            if mov_cc:
                mov_map[tit]["nCodMovCC"] = mov_cc
            if cc_id and not mov_map[tit]["nCodCC"]:
                mov_map[tit]["nCodCC"] = cc_id
            if val_mov > 0 and (mov_map[tit]["valor_pago"] == 0 or c_orig in ("BAXR", "BAXP")):
                mov_map[tit]["valor_pago"] = val_mov
    return mov_map


def _extract_impostos(record):
    ir = round(float(record.get("valor_ir") or 0), 2)
    iss = round(float(record.get("valor_iss") or 0), 2)
    pis = round(float(record.get("valor_pis") or 0), 2)
    cofins = round(float(record.get("valor_cofins") or 0), 2)
    csll = round(float(record.get("valor_csll") or 0), 2)
    inss = round(float(record.get("valor_inss") or 0), 2)
    total = round(ir + iss + pis + cofins + csll + inss, 2)
    if total == 0:
        return None
    return {"ir": ir, "iss": iss, "pis": pis, "cofins": cofins, "csll": csll, "inss": inss, "total": total}


def _resolve_fornecedor(forn_map, cod_cli, fallback_name=None):
    cod_s = str(cod_cli or "").strip()
    info = forn_map.get(cod_s) or {}
    nome = info.get("nome") or decode_html_entities(fallback_name or "") or "N/D"
    cnpj = info.get("cnpj_cpf") or None
    return cod_s or None, nome, cnpj


def _collapse_distributions(raw_dist, valor_doc, ratio):
    agg = defaultdict(lambda: [0.0, 0.0, 0.0])  # [net, gross, pct]
    items = raw_dist if raw_dist else [{"cDesDep": "Sem Departamento", "nValDep": valor_doc, "nPerDep": 100.0}]
    for d in items:
        dep_name = decode_html_entities(d.get("cDesDep") or "Sem Departamento") or "Sem Departamento"
        gross = abs(float(d.get("nValDep") or 0))
        net = gross * ratio
        pct = float(d.get("nPerDep") or 0)
        agg[dep_name][0] += net
        agg[dep_name][1] += gross
        agg[dep_name][2] += pct
    result = [
        {
            "departamento": dep,
            "valor": round(vals[0], 2),
            "valor_bruto": round(vals[1], 2),
            "percentual": round(vals[2], 2),
        }
        for dep, vals in agg.items()
    ]
    return result


def process_cp_cr_records(
    empresa_id,
    empresa_nome,
    records,
    tipo,
    cat_map,
    cc_map,
    proj_map,
    forn_map,
    mov_map,
    reconciler,
    cutover_iso,
):
    rows = []
    sinal = 1 if tipo == "RECEBER" else -1

    for r in records:
        status = str(r.get("status_titulo") or "").strip().upper()
        if status == "CANCELADO":
            continue

        cat_cod = str(r.get("codigo_categoria") or "").strip()
        cat_info = cat_map.get(cat_cod) or {}
        if is_transfer_record(cat_info, cat_cod, r.get("id_origem"), ""):
            continue

        omie_id = r.get("codigo_lancamento_omie")
        if omie_id in (None, ""):
            continue
        omie_id_int = int(omie_id)
        omie_id_str = str(omie_id_int)

        doc_val = round(abs(float(r.get("valor_documento") or 0)), 2)
        m_info = mov_map.get(omie_id_str)

        if m_info:
            dt_pagto = m_info["data_pagamento"]
            val_pago = round(abs(float(m_info["valor_pago"] or doc_val)), 2)
            ratio = (val_pago / doc_val) if (doc_val > 0 and val_pago > 0) else 1.0
            status_final = "RECEBIDO" if tipo == "RECEBER" else "PAGO"
            cc_id = str(r.get("id_conta_corrente") or m_info.get("nCodCC") or "").strip()
            mov_cc_id = m_info.get("nCodMovCC") or None
        else:
            dt_pagto = parse_br_date_to_iso(r.get("data_baixa") or r.get("data_liquidacao"))
            val_pago = doc_val
            ratio = 1.0
            status_final = status or "A VENCER"
            cc_id = str(r.get("id_conta_corrente") or "").strip()
            mov_cc_id = None

        dt_emissao = parse_br_date_to_iso(r.get("data_emissao"))
        dt_entrada = parse_br_date_to_iso(r.get("data_entrada"))
        dt_reg_raw = parse_br_date_to_iso(r.get("data_registro"))
        dt_venc = parse_br_date_to_iso(r.get("data_vencimento"))
        dt_prev = parse_br_date_to_iso(r.get("data_previsao")) or dt_venc
        dt_inc = parse_br_date_to_iso((r.get("info") or {}).get("dInc"))
        data_registro = dt_entrada or dt_reg_raw or dt_emissao or dt_venc or dt_inc

        # Mantém registros cujo ciclo atinge ou supera o corte da empresa
        relevant_dates = [d for d in (data_registro, dt_pagto, dt_venc) if d]
        if not relevant_dates or max(relevant_dates) < cutover_iso:
            continue

        cli_cod, cli_nome, cnpj_cpf = _resolve_fornecedor(
            forn_map,
            r.get("codigo_cliente_fornecedor"),
            r.get("nm_cliente") or (r.get("cnab_integracao_bancaria") or {}).get("nome_transferencia"),
        )
        proj_cod = str(r.get("codigo_projeto") or "").strip() or None
        proj_nome = proj_map.get(proj_cod or "", decode_html_entities(r.get("nome_projeto") or "Sem Projeto")) or "Sem Projeto"
        cc_nome = cc_map.get(cc_id) or decode_html_entities(r.get("cContaCorrente") or "") or None

        cat_nome = cat_info.get("descricao_categoria") or decode_html_entities(r.get("descricao_categoria") or "") or None

        if reconciler and dt_pagto:
            conciliado, dt_conc, sit_extrato = reconciler.match(
                cc_id, dt_pagto, cli_cod, cat_cod, val_pago, candidate_ids=[mov_cc_id, omie_id_str]
            )
        else:
            conciliado, dt_conc, sit_extrato = False, None, "Sem extrato"

        collapsed = _collapse_distributions(r.get("distribuicao") or [], doc_val, ratio)
        rateios_json = collapsed if len(collapsed) > 1 else None
        impostos = _extract_impostos(r)

        info_obj = r.get("info") or {}
        raw_meta = {
            k: v
            for k, v in {
                "cOrigem": r.get("id_origem"),
                "nCodMovCC": mov_cc_id,
                "uInc": info_obj.get("uInc"),
                "dInc": dt_inc,
            }.items()
            if v not in (None, "")
        } or None

        for dist in collapsed:
            rows.append(
                {
                    "empresa_id": empresa_id,
                    "empresa_nome": empresa_nome,
                    "omie_id": omie_id_int,
                    "tipo_registro": tipo,
                    "departamento_nome": dist["departamento"],
                    "status": status_final,
                    "valor_documento": doc_val,
                    "valor_pago": val_pago,
                    "valor_alocado": dist["valor"],
                    "valor_alocado_bruto": dist["valor_bruto"],
                    "sinal": sinal,
                    "data_emissao": dt_emissao,
                    "data_registro": data_registro,
                    "data_vencimento": dt_venc,
                    "data_previsao": dt_prev,
                    "data_pagamento": dt_pagto,
                    "conciliado": conciliado,
                    "data_conciliacao": dt_conc,
                    "situacao_extrato": sit_extrato,
                    "categoria_codigo": cat_cod or None,
                    "categoria_nome": cat_nome,
                    "codigo_dre": cat_info.get("codigo_dre"),
                    "conta_dre": cat_info.get("descricao_dre"),
                    "sinal_dre": cat_info.get("sinal_dre"),
                    "nao_exibir_dre": bool(cat_info.get("nao_exibir_dre", False)),
                    "projeto_codigo": proj_cod,
                    "projeto_nome": proj_nome,
                    "cliente_fornecedor_codigo": cli_cod,
                    "cliente_fornecedor": cli_nome,
                    "cnpj_cpf": cnpj_cpf,
                    "conta_corrente_id": cc_id or None,
                    "conta_corrente_nome": cc_nome,
                    "numero_documento": decode_html_entities(r.get("numero_documento") or r.get("numero_documento_fiscal") or "") or None,
                    "numero_parcela": decode_html_entities(r.get("numero_parcela") or "") or None,
                    "chave_nfe": r.get("chave_nfe") or None,
                    "contrato_omie": decode_html_entities(r.get("cNumeroContrato") or r.get("numero_pedido") or "") or None,
                    "observacao": decode_html_entities(r.get("observacao") or "") or None,
                    "impostos_retidos": impostos,
                    "rateios": rateios_json,
                    "raw_meta": raw_meta,
                }
            )
    return rows


def process_direct_cc_movements(
    empresa_id,
    empresa_nome,
    mov_records,
    known_titles,
    cat_map,
    cc_map,
    proj_map,
    forn_map,
    reconciler,
    cutover_iso,
):
    rows_by_key = {}

    for m in mov_records:
        det = m.get("detalhes") or {}
        res = m.get("resumo") or {}

        c_grp = str(det.get("cGrupo") or "").strip().upper()
        n_cod_tit = str(det.get("nCodTitulo") or "").strip()
        n_cod_mov = str(det.get("nCodMovCC") or "").strip()

        # Deduplicação estrita: qualquer vínculo com CP/CR não entra como MOVIMENTO_CC
        if c_grp in ("CONTA_A_PAGAR", "CONTA_A_RECEBER"):
            continue
        if n_cod_tit and n_cod_tit != "0":
            continue
        if n_cod_mov and n_cod_mov in known_titles:
            continue

        raw_omie_id = n_cod_mov or str(det.get("nCodLanc") or "").strip()
        if not raw_omie_id or not raw_omie_id.isdigit():
            continue
        omie_id_int = int(raw_omie_id)

        cat_cod = str(det.get("cCodCateg") or "").strip()
        cat_info = cat_map.get(cat_cod) or {}
        c_orig = str(det.get("cOrigem") or "").strip().upper()
        if is_transfer_record(cat_info, cat_cod, c_orig, c_grp):
            continue

        c_nat = str(det.get("cNatureza") or "").strip().upper()
        is_entrada = (
            (c_nat == "R")
            or ("REC" in c_grp)
            or bool(cat_info.get("conta_receita"))
            or (str(det.get("cTipo") or "").upper() == "E")
        )
        sinal = 1 if is_entrada else -1

        val = round(
            abs(
                float(
                    det.get("nValorMovCC")
                    or res.get("nValPago")
                    or res.get("nValLiquido")
                    or det.get("nValorTitulo")
                    or 0
                )
            ),
            2,
        )

        dt_pagto = parse_br_date_to_iso(
            det.get("dDtPagamento")
            or det.get("dDtPagto")
            or det.get("dDtCredito")
            or det.get("dDtDebito")
            or det.get("dDtRegistro")
        )
        dt_reg = parse_br_date_to_iso(det.get("dDtRegistro")) or dt_pagto
        dt_venc = parse_br_date_to_iso(det.get("dDtVenc"))
        dt_emissao = parse_br_date_to_iso(det.get("dDtEmissao"))
        dt_inc = parse_br_date_to_iso(det.get("dDtInc") or (m.get("info") or {}).get("dInc"))
        data_registro = dt_reg or dt_emissao or dt_venc or dt_inc

        relevant_dates = [d for d in (data_registro, dt_pagto, dt_venc) if d]
        if not relevant_dates or max(relevant_dates) < cutover_iso:
            continue

        cc_id = str(det.get("nCodCC") or "").strip()
        cc_nome = cc_map.get(cc_id) or decode_html_entities(det.get("cContaCorrente") or "") or None
        cli_cod, cli_nome, cnpj_cpf = _resolve_fornecedor(
            forn_map,
            det.get("nCodCliente") or det.get("codigo_cliente_fornecedor"),
            det.get("cNomeCliente") or det.get("cNomPessoa"),
        )
        cnpj_cpf = cnpj_cpf or det.get("cCPFCNPJCliente") or None

        proj_cod = str(det.get("cCodProjeto") or det.get("nCodProjeto") or "").strip() or None
        proj_nome = proj_map.get(proj_cod or "", "Sem Projeto") or "Sem Projeto"
        cat_nome = cat_info.get("descricao_categoria") or decode_html_entities(det.get("cDesCateg") or "") or None

        if reconciler and (dt_pagto or n_cod_mov):
            conciliado, dt_conc, sit_extrato = reconciler.match(
                cc_id, dt_pagto, cli_cod, cat_cod, val, candidate_ids=[raw_omie_id]
            )
        else:
            conciliado, dt_conc, sit_extrato = False, None, "Sem extrato"

        raw_meta = {
            k: v
            for k, v in {
                "cOrigem": c_orig or None,
                "cGrupo": c_grp or None,
                "cNatureza": c_nat or None,
                "uInc": det.get("cUsInc"),
                "dInc": dt_inc,
            }.items()
            if v not in (None, "")
        } or None

        key = (empresa_id, "MOVIMENTO_CC", omie_id_int, "Principal")
        rows_by_key[key] = {
            "empresa_id": empresa_id,
            "empresa_nome": empresa_nome,
            "omie_id": omie_id_int,
            "tipo_registro": "MOVIMENTO_CC",
            "departamento_nome": "Principal",
            "status": "RECEBIDO" if is_entrada else "PAGO",
            "valor_documento": val,
            "valor_pago": val,
            "valor_alocado": val,
            "valor_alocado_bruto": val,
            "sinal": sinal,
            "data_emissao": dt_emissao,
            "data_registro": data_registro,
            "data_vencimento": dt_venc,
            "data_previsao": dt_pagto,
            "data_pagamento": dt_pagto,
            "conciliado": conciliado,
            "data_conciliacao": dt_conc,
            "situacao_extrato": sit_extrato,
            "categoria_codigo": cat_cod or None,
            "categoria_nome": cat_nome,
            "codigo_dre": cat_info.get("codigo_dre"),
            "conta_dre": cat_info.get("descricao_dre"),
            "sinal_dre": cat_info.get("sinal_dre"),
            "nao_exibir_dre": bool(cat_info.get("nao_exibir_dre", False)),
            "projeto_codigo": proj_cod,
            "projeto_nome": proj_nome,
            "cliente_fornecedor_codigo": cli_cod,
            "cliente_fornecedor": cli_nome,
            "cnpj_cpf": cnpj_cpf,
            "conta_corrente_id": cc_id or None,
            "conta_corrente_nome": cc_nome,
            "numero_documento": decode_html_entities(det.get("cNumDocFiscal") or det.get("cNumTitulo") or "") or None,
            "numero_parcela": decode_html_entities(det.get("cNumParcela") or det.get("cNumParc") or "") or None,
            "chave_nfe": det.get("cChaveNFe") or None,
            "contrato_omie": decode_html_entities(det.get("cNumCtr") or det.get("cNumOS") or "") or None,
            "observacao": decode_html_entities(det.get("observacao") or det.get("cDesMov") or "") or None,
            "impostos_retidos": None,
            "rateios": None,
            "raw_meta": raw_meta,
        }

    return list(rows_by_key.values())


class OmieStudioClient:
    def __init__(self, app_key, app_secret, empresa_nome, empresa_id, cutover_iso):
        self.app_key = app_key
        self.app_secret = app_secret
        self.empresa_nome = empresa_nome
        self.empresa_id = empresa_id
        self.cutover_iso = cutover_iso

    def call_api(self, url, call, param):
        payload = {
            "call": call,
            "app_key": self.app_key,
            "app_secret": self.app_secret,
            "param": [param],
        }
        for attempt in range(4):
            try:
                resp = requests.post(url, json=payload, timeout=45)
                if resp.status_code == 200:
                    return resp.json()
                if resp.status_code == 429:
                    time.sleep(2 * (attempt + 1))
                    continue
                if resp.status_code == 500 and "SOAP-ERROR" in resp.text:
                    time.sleep(1.5)
                    continue
                log(f"  [API {resp.status_code}] {call}: {resp.text[:200]}")
                return {}
            except Exception as e:
                log(f"  [Conexão] {call}: {e}")
                time.sleep(1.5 * (attempt + 1))
        return {}

    def fetch_categories(self):
        cat_map = {}
        cat_rows = []
        pagina = 1
        while True:
            res = self.call_api(
                f"{URL_GERAL}categorias/",
                "ListarCategorias",
                {"pagina": pagina, "registros_por_pagina": 100},
            )
            items = res.get("categoria_cadastro") or []
            if not items:
                break
            for raw_cat in items:
                parsed = parse_category_record(self.empresa_id, self.empresa_nome, raw_cat)
                if parsed:
                    cat_map[parsed["codigo_categoria"]] = parsed
                    cat_rows.append(parsed)
            if pagina >= int(res.get("total_de_paginas") or 1):
                break
            pagina += 1
        return cat_map, cat_rows

    def fetch_contas_correntes(self):
        cc_map = {}
        active_ccs = []
        pagina = 1
        while True:
            res = self.call_api(
                f"{URL_GERAL}contacorrente/",
                "ListarContasCorrentes",
                {"pagina": pagina, "registros_por_pagina": 100},
            )
            items = res.get("ListarContasCorrentes") or []
            if not items:
                break
            for cc in items:
                cod = str(cc.get("nCodCC") or "").strip()
                desc = decode_html_entities(cc.get("descricao") or "")
                if cod:
                    cc_map[cod] = desc or f"CC {cod}"
                    active_ccs.append({"nCodCC": int(cod) if cod.isdigit() else cod, "descricao": desc, "inativo": cc.get("inativo")})
            if pagina >= int(res.get("total_de_paginas") or 1):
                break
            pagina += 1
        return cc_map, active_ccs

    def fetch_projetos(self):
        proj_map = {}
        pagina = 1
        while True:
            res = self.call_api(
                f"{URL_GERAL}projetos/",
                "ListarProjetos",
                {"pagina": pagina, "registros_por_pagina": 100},
            )
            items = res.get("cadastro") or []
            if not items:
                break
            for p in items:
                cod = str(p.get("codigo") or "").strip()
                if cod:
                    proj_map[cod] = decode_html_entities(p.get("nome") or "") or cod
            if pagina >= int(res.get("total_de_paginas") or 1):
                break
            pagina += 1
        return proj_map

    def fetch_fornecedores(self):
        forn_map = {}
        pagina = 1
        while True:
            res = self.call_api(
                f"{URL_GERAL}clientes/",
                "ListarClientes",
                {"pagina": pagina, "registros_por_pagina": 100},
            )
            items = res.get("clientes_cadastro") or []
            if not items:
                break
            for f in items:
                cod = str(f.get("codigo_cliente_omie") or "").strip()
                if cod:
                    nome = decode_html_entities(f.get("nome_fantasia") or f.get("razao_social") or "")
                    forn_map[cod] = {"nome": nome, "cnpj_cpf": f.get("cnpj_cpf")}
            if pagina >= int(res.get("total_de_paginas") or 1):
                break
            pagina += 1
        return forn_map

    def fetch_cp_cr(self, url, call, list_key, start_br=None, status_filter=None):
        records = []
        pagina = 1
        while True:
            param = {"pagina": pagina, "registros_por_pagina": 100, "exibir_obs": "S"}
            if start_br:
                param["filtrar_por_data_de"] = start_br
            if status_filter:
                param["filtrar_por_status"] = status_filter
            res = self.call_api(url, call, param)
            items = res.get(list_key) or []
            if not items:
                break
            records.extend(items)
            if pagina >= int(res.get("total_de_paginas") or 1):
                break
            pagina += 1
        return records

    def fetch_movimentos(self, start_br):
        records = []
        pagina = 1
        while True:
            res = self.call_api(
                URL_MOV,
                "ListarMovimentos",
                {"nPagina": pagina, "nRegPorPagina": 100, "dDtPagtoDe": start_br, "lDadosCad": True},
            )
            items = res.get("movimentos") or []
            if not items:
                break
            records.extend(items)
            if pagina >= int(res.get("nTotPaginas") or 1):
                break
            pagina += 1
        return records

    def fetch_extrato_reconciler(self, accounts, start_iso, end_iso):
        reconciler = ExtratoReconciler()
        start_dt = datetime.strptime(start_iso[:10], "%Y-%m-%d")
        end_dt = datetime.strptime(end_iso[:10], "%Y-%m-%d")

        windows = []
        cur = start_dt
        while cur <= end_dt:
            win_end = min(end_dt, cur + timedelta(days=89))
            windows.append((cur.strftime("%d/%m/%Y"), win_end.strftime("%d/%m/%Y")))
            cur = win_end + timedelta(days=1)

        total_items = 0
        for acc in accounts:
            if str(acc.get("inativo") or "N").upper() == "S":
                continue
            cod_cc = acc["nCodCC"]
            for d_ini, d_fim in windows:
                res = self.call_api(
                    URL_EXTRATO,
                    "ListarExtrato",
                    {"nCodCC": cod_cc, "cCodIntCC": "", "dPeriodoInicial": d_ini, "dPeriodoFinal": d_fim},
                )
                movs = res.get("listaMovimentos") or []
                for m in movs:
                    m_copy = dict(m)
                    m_copy.setdefault("nCodCC", cod_cc)
                    reconciler.add_item(m_copy)
                    total_items += 1
        log(f"  Extrato carregado: {total_items} itens de {len(accounts)} conta(s).")
        return reconciler


def upsert_supabase(table_name, rows, on_conflict, chunk_size=250):
    if not rows:
        return True
    if not SUPABASE_URL or not SUPABASE_KEY:
        log("[ERRO] SUPABASE_URL/SUPABASE_SERVICE_KEY ausentes.")
        return False

    conflict_q = urllib.parse.quote(on_conflict, safe=",")
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?on_conflict={conflict_q}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i : i + chunk_size]
        for attempt in range(3):
            resp = requests.post(url, headers=headers, json=chunk, timeout=60)
            if resp.status_code in (200, 201, 204):
                break
            if attempt == 2:
                log(f"  [ERRO] Upsert {table_name} chunk {i//chunk_size}: HTTP {resp.status_code} {resp.text[:300]}")
                return False
            time.sleep(1.5 * (attempt + 1))
    return True


def sync_company(app, days=None, skip_extrato=False, categories_only=False, dry_run=False):
    name = app["name"]
    emp_id = app["empresa_id"]
    cutover_iso = app["cutover_iso"]
    if days is not None:
        dt = max(datetime.strptime(cutover_iso, "%Y-%m-%d"), datetime.now() - timedelta(days=max(0, int(days))))
        start_iso = dt.strftime("%Y-%m-%d")
    else:
        start_iso = cutover_iso
    start_br = iso_to_br_date(start_iso)
    end_iso = datetime.now().strftime("%Y-%m-%d")

    log(f"=== {name} (id={emp_id} | corte={cutover_iso} | inicio_coleta={start_br}) ===")
    client = OmieStudioClient(app["key"], app["sec"], name, emp_id, cutover_iso)

    cat_map, cat_rows = client.fetch_categories()
    log(f"  Categorias carregadas: {len(cat_rows)}")
    if not dry_run:
        if not upsert_supabase("dre_studio_categorias", cat_rows, "empresa_id,codigo_categoria"):
            return False

    if categories_only:
        return True

    cc_map, active_ccs = client.fetch_contas_correntes()
    proj_map = client.fetch_projetos()
    forn_map = client.fetch_fornecedores()
    log(f"  Dimensões: CCs={len(cc_map)}, Projetos={len(proj_map)}, Clientes/Forns={len(forn_map)}")

    reconciler = None
    if not skip_extrato:
        reconciler = client.fetch_extrato_reconciler(active_ccs, start_iso, end_iso)

    # Coleta completa a partir da data de corte/início (por data de alteração/emissão) + títulos em aberto
    cp_main = client.fetch_cp_cr(URL_CP, "ListarContasPagar", "conta_pagar_cadastro", start_br=start_br)
    cp_open = client.fetch_cp_cr(URL_CP, "ListarContasPagar", "conta_pagar_cadastro", status_filter="EMABERTO")
    cp_by_id = {r.get("codigo_lancamento_omie"): r for r in (cp_main + cp_open) if r.get("codigo_lancamento_omie")}

    cr_main = client.fetch_cp_cr(URL_CR, "ListarContasReceber", "conta_receber_cadastro", start_br=start_br)
    cr_open = client.fetch_cp_cr(URL_CR, "ListarContasReceber", "conta_receber_cadastro", status_filter="EMABERTO")
    cr_by_id = {r.get("codigo_lancamento_omie"): r for r in (cr_main + cr_open) if r.get("codigo_lancamento_omie")}

    movs = client.fetch_movimentos(start_br)
    mov_map = build_mov_enrichment_map(movs)

    known_titles = {str(k) for k in cp_by_id.keys()} | {str(k) for k in cr_by_id.keys()} | set(mov_map.keys())
    log(f"  Bruto Omie: CP={len(cp_by_id)}, CR={len(cr_by_id)}, Movs={len(movs)}")

    rows_cp = process_cp_cr_records(
        emp_id, name, list(cp_by_id.values()), "PAGAR", cat_map, cc_map, proj_map, forn_map, mov_map, reconciler, cutover_iso
    )
    rows_cr = process_cp_cr_records(
        emp_id, name, list(cr_by_id.values()), "RECEBER", cat_map, cc_map, proj_map, forn_map, mov_map, reconciler, cutover_iso
    )
    rows_cc = process_direct_cc_movements(
        emp_id, name, movs, known_titles, cat_map, cc_map, proj_map, forn_map, reconciler, cutover_iso
    )

    all_rows = rows_cp + rows_cr + rows_cc
    conc_count = sum(1 for r in all_rows if r["conciliado"])
    log(
        f"  Processados: CP={len(rows_cp)}, CR={len(rows_cr)}, MOVIMENTO_CC={len(rows_cc)} "
        f"| Total={len(all_rows)} | Conciliados={conc_count}"
    )

    if dry_run:
        return True

    return upsert_supabase(
        "dre_studio_lancamentos",
        all_rows,
        "empresa_id,tipo_registro,omie_id,departamento_nome",
    )


def main():
    parser = argparse.ArgumentParser(description="Sincronizador isolado do DRE Studio")
    parser.add_argument("--empresa", default="all", help="all, Mar Brasil, DZM, G2 ou Conectius")
    parser.add_argument("--days", type=int, default=None, help="Janela incremental em dias (opcional)")
    parser.add_argument("--skip-extrato", action="store_true", help="Não consultar ListarExtrato")
    parser.add_argument("--categories-only", action="store_true", help="Sincroniza apenas dre_studio_categorias")
    parser.add_argument("--dry-run", action="store_true", help="Executa sem gravar no Supabase")
    args = parser.parse_args()

    apps = resolve_omie_apps(args.empresa)
    if not apps:
        log("Nenhuma empresa Omie configurada para o filtro informado.")
        return 1

    ok = True
    for app in apps:
        if not sync_company(
            app,
            days=args.days,
            skip_extrato=args.skip_extrato,
            categories_only=args.categories_only,
            dry_run=args.dry_run,
        ):
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
