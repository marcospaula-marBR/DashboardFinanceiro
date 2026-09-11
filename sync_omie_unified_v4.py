import os
import sys
import json
import requests
import time
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Configuração de Ambiente
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Endpoints Omie
URL_CP = "https://app.omie.com.br/api/v1/financas/contapagar/"
URL_CR = "https://app.omie.com.br/api/v1/financas/contareceber/"
URL_MOV = "https://app.omie.com.br/api/v1/financas/mf/"
URL_GERAL = "https://app.omie.com.br/api/v1/geral/"

HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")
    sys.stdout.flush()

def format_date_br_to_iso(date_str):
    if not date_str: return None
    try:
        return datetime.strptime(date_str, "%d/%m/%Y").strftime("%Y-%m-%d")
    except:
        return None

def format_date_iso_to_iso(date_str):
    if not date_str: return None
    try:
        # Omie sometimes returns dates in different formats
        if "/" in date_str: return format_date_br_to_iso(date_str)
        return datetime.strptime(date_str[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
    except:
        return None

EXCLUSION_KEYWORDS = [
    'provis',         # provisões (rescisões, férias, 13o, tributos, clientes)
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

class OmieSync:
    def __init__(self, app_key, app_secret, empresa_nome):
        self.app_key = app_key
        self.app_secret = app_secret
        self.empresa_nome = empresa_nome
        self.cat_map = {}
        self.proj_map = {}
        self.forn_map = {}

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
        log(f"Carregando dimensões para {self.empresa_nome}...")
        
        # Categorias (Paginado - Limite de 100 da Omie)
        pagina = 1
        while True:
            res = self.call_api(f"{URL_GERAL}categorias/", "ListarCategorias", {"pagina": pagina, "registros_por_pagina": 100})
            cats = res.get("categoria_cadastro", [])
            if not cats: break
            for c in cats:
                self.cat_map[str(c["codigo"])] = {
                    "descricao": c.get("descricao"),
                    "codigo_conta_dre": c.get("codigo_dre")
                }
            if pagina >= res.get("total_de_paginas", 0): break
            pagina += 1
        log(f"  [OK] {len(self.cat_map)} categorias memorizadas.")
        
        # Projetos (Paginado - Limite de 100 da Omie)
        pagina = 1
        while True:
            res = self.call_api(f"{URL_GERAL}projetos/", "ListarProjetos", {"pagina": pagina, "registros_por_pagina": 100})
            projs = res.get("cadastro", [])
            if not projs: break
            for p in projs:
                p_nome = p.get("nome") or ""
                if "casa tupi" in p_nome.lower() or "tupi 771" in p_nome.lower():
                    p_nome = "Núcleo Jurídico"
                self.proj_map[str(p["codigo"])] = p_nome
            if pagina >= res.get("total_de_paginas", 0): break
            pagina += 1
        log(f"  [OK] {len(self.proj_map)} projetos memorizados.")
        
        # Clientes/Fornecedores (Paginado - Limite de 100 da Omie)
        pagina = 1
        while True:
            res = self.call_api(f"{URL_GERAL}clientes/", "ListarClientes", {"pagina": pagina, "registros_por_pagina": 100})
            clients = res.get("clientes_cadastro", [])
            if not clients: break
            for f in clients:
                self.forn_map[str(f["codigo_cliente_omie"])] = {
                    "nome_fantasia": f.get("nome_fantasia"),
                    "razao_social": f.get("razao_social"),
                    "cnpj_cpf": f.get("cnpj_cpf"),
                    "codigo_cliente_integracao": f.get("codigo_cliente_integracao")
                }
            if pagina >= res.get("total_de_paginas", 0): break
            pagina += 1
        log(f"  [OK] {len(self.forn_map)} fornecedores/clientes memorizados.")

    def fetch_records(self, url, call, list_key, start_date):
        records = []
        pagina = 1
        while True:
            param = {
                "pagina": pagina,
                "registros_por_pagina": 100,
                "filtrar_por_data_de": start_date,
                "exibir_obs": "S"
            }
            data = self.call_api(url, call, param)
            items = data.get(list_key, [])
            if not items: break
            records.extend(items)
            if pagina >= data.get("total_de_paginas", 0): break
            pagina += 1
            log(f"  {list_key}: Lendo página {pagina-1}...")
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
                        # ATENÇÃO: No Omie, a mesma liquidação gera múltiplos registros espelhos (ex: VENR e BAXR para CR, COMP e BAXP para CP).
                        # NUNCA SOMAR! O valor do título já é o valor total liquidado.
                        # Priorizar data mais recente e nCodMovCC da baixa bancária efetiva (BAXR/BAXP)
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
            
            # Filtro de Exclusão de Categorias Não Operacionais
            cat_codigo = r.get("codigo_categoria")
            cat_nome = self.cat_map.get(str(cat_codigo), {}).get("descricao") or r.get("descricao_categoria")
            obs = str(r.get("observacao") or "").lower()
            if is_excluded_caixa(cat_codigo, cat_nome, obs):
                continue
            
            omie_id_str = str(omie_id).strip() if omie_id else ""
            doc_val = float(r.get("valor_documento") or 0)
            
            # REGRA MESTRA DE REGIME DE CAIXA:
            # 1. Se o título possui registro de movimentação no extrato bancário (ListarMovimentos),
            # a data de pagamento É OBRIGATORIAMENTE a data efetiva de liquidação bancária (dDtPagamento do movimento),
            # e o valor é o valor líquido que efetivamente transitou pelas contas bancárias!
            if omie_id_str and omie_id_str in mov_map:
                m_info = mov_map[omie_id_str]
                data_pagamento = m_info["data_pagamento"]
                val_efetivo = m_info["valor_pago"]
                ratio = (val_efetivo / doc_val) if (doc_val > 0 and val_efetivo > 0) else 1.0
                valor_total = (val_efetivo if val_efetivo > 0 else doc_val) * sign
                status = "PAGO" if tipo == "PAGAR" else "RECEBIDO"
            else:
                # Se não há movimentação bancária comprovada no extrato, verificar se há data de baixa explícita no título
                dt_baixa = format_date_iso_to_iso(r.get("data_baixa") or r.get("data_liquidacao"))
                data_pagamento = dt_baixa
                # NUNCA USAR DATA_PREVISAO OU VENCIMENTO COMO DATA_PAGAMENTO!
                # Se não transitou pelo extrato bancário e não tem baixa confirmada, NÃO é caixa liquidado:
                valor_total = doc_val * sign
                ratio = 1.0
            
            dt_previsao = format_date_iso_to_iso(r.get("data_previsao"))
            raw_dist = r.get("distribuicao", [])
            if not raw_dist:
                raw_dist = [{"cDesDep": "Sem Departamento", "nValDep": r.get("valor_documento")}]
            
            # Cliente/Fornecedor Fallback
            cliente_forn = None
            f_info = self.forn_map.get(str(r.get("codigo_cliente_fornecedor")))
            if f_info:
                cliente_forn = f_info.get("nome_fantasia") or f_info.get("razao_social")
            if not cliente_forn:
                cliente_forn = r.get("nm_cliente") or r.get("cnab_integracao_bancaria", {}).get("nome_transferencia") or "N/D"

            dt_emissao = format_date_iso_to_iso(r.get("data_emissao"))
            dt_entrada = format_date_iso_to_iso(r.get("data_entrada"))
            dt_registro_raw = format_date_iso_to_iso(r.get("data_registro"))
            dt_vencimento = format_date_iso_to_iso(r.get("data_vencimento"))
            dt_inc = format_date_iso_to_iso(r.get("info", {}).get("dInc"))
            
            # Cadeia unificada de competência: entrada -> registro -> emissao -> vencimento -> log de inclusão
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
                    "data_vencimento": format_date_iso_to_iso(r.get("data_vencimento")),
                    "data_previsao": dt_previsao,
                    "data_pagamento": data_pagamento,
                    "categoria_codigo": cat_codigo,
                    "categoria_nome": cat_nome,
                    "projeto_nome": self.proj_map.get(str(r.get("codigo_projeto")), r.get("nome_projeto") or "Sem Projeto"),
                    "departamento_nome": d.get("cDesDep"),
                    "cliente_fornecedor": cliente_forn,
                    "numero_documento": r.get("numero_documento") or r.get("numero_documento_fiscal"),
                    "raw_data": r
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
            if not items: break
            records.extend(items)
            if pagina >= data.get("nTotPaginas", 0): break
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
            
            # REGRA: EVITAR DUPLICAÇÃO DE MOVIMENTO QUE JÁ CONSTA EM CONTAS A PAGAR OU RECEBER
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

            # REGRA: DESCONSIDERAR TRANSFERÊNCIAS ENTRE CONTAS OU ITENS EXCLUÍDOS DO CAIXA
            if (c_categ.startswith("0.") or c_categ == "0.01" or 
                "TRANSF" in c_grp or "TRANSF" in c_orig or c_orig in ["TRAR", "TRAP", "TRF"] or
                "transferência" in cat_nome.lower() or "transferencia" in cat_nome.lower() or
                "transferência" in obs or "transferencia" in obs or
                is_excluded_caixa(c_categ, cat_nome, obs)):
                continue

            # REGRA: IDENTIFICAÇÃO CORRETA DE ENTRADA (CRÉDITO/RECEITA) VS SAÍDA (DÉBITO/DESPESA)
            is_entrada = (c_nat == "R") or ("REC" in c_grp) or c_categ.startswith("1.") or (det.get("cTipo") == "E")
            sign = 1 if is_entrada else -1
            tipo_registro = "MOVIMENTO"

            # Extração do valor do movimento: nValorMovCC -> nValPago -> nValLiquido -> nValorTitulo
            valor = float(det.get("nValorMovCC") or res.get("nValPago") or res.get("nValLiquido") or det.get("nValorTitulo") or 0)
            
            # REGRA: DATA CORRETA DE DÉBITO OU CRÉDITO (Data efetiva de pagamento/movimentação)
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
            dt_inc_mov = format_date_iso_to_iso(det.get("dDtInc") or r.get("info", {}).get("dInc"))
            data_registro = dt_registro_mov or dt_pagto_mov or dt_venc_mov or dt_inc_mov
            
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
                "cliente_fornecedor": (self.forn_map.get(str(det.get("nCodCliente") or det.get("codigo_cliente_fornecedor") or "")) or {}).get("nome_fantasia") or (self.forn_map.get(str(det.get("nCodCliente") or det.get("codigo_cliente_fornecedor") or "")) or {}).get("razao_social") or det.get("cNomeCliente") or "N/D",
                "numero_documento": det.get("cNumDocFiscal") or det.get("cNumTitulo"),
                "raw_data": r
            })
        return rows

def push_to_supabase(rows, extra_delete_ids=None):
    if not rows: return
    log(f"Enviando {len(rows)} registros para o Supabase...")
    
    if extra_delete_ids is None:
        extra_delete_ids = set()
        
    # Agrupar por empresa_nome e tipo_registro para fazer delete e insert seguros em lote
    groups = {}
    for r in rows:
        key = (r["empresa_nome"], r["tipo_registro"])
        if key not in groups:
            groups[key] = []
        groups[key].append(r)
        
    for (empresa, tipo), group_rows in groups.items():
        # Limpeza prévia de IDs de movimentos espelho que possam existir no Supabase para esta empresa
        if extra_delete_ids:
            extra_list = [str(x) for x in extra_delete_ids if x]
            for j in range(0, len(extra_list), 100):
                batch_extra = extra_list[j:j+100]
                extra_str = ",".join(batch_extra)
                del_extra_url = f"{SUPABASE_URL}/rest/v1/omie_financas_unificado?empresa_nome=eq.{empresa}&omie_id=in.({extra_str})"
                requests.delete(del_extra_url, headers=HEADERS_SB)
            extra_delete_ids = set() # já purgado para a empresa

        size = 100
        for i in range(0, len(group_rows), size):
            chunk = group_rows[i:i+size]
            ids = [r["omie_id"] for r in chunk if r.get("omie_id") not in [None, "None", ""]]
            
            if ids:
                # 1. Deletar os antigos correspondentes de qualquer tipo com aquele omie_id na mesma empresa
                ids_str = ",".join(map(str, ids))
                del_url = f"{SUPABASE_URL}/rest/v1/omie_financas_unificado?empresa_nome=eq.{empresa}&omie_id=in.({ids_str})"
                
                del_resp = requests.delete(del_url, headers=HEADERS_SB)
                if del_resp.status_code not in [200, 204]:
                    log(f"Erro ao deletar registros antigos: {del_resp.text}")
                
            # 2. Inserir os novos registros atualizados
            post_resp = requests.post(f"{SUPABASE_URL}/rest/v1/omie_financas_unificado", headers=HEADERS_SB, json=chunk)
            if post_resp.status_code not in [200, 201, 204]:
                log(f"Erro ao inserir novos registros: {post_resp.text}")

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Sincronizador Unificado Omie -> Supabase")
    parser.add_argument("--start-date", default="01/06/2025", help="Data de início (DD/MM/AAAA) [01/06/2025]")
    parser.add_argument("--empresa", default="all", help="Empresa (Mar Brasil, DZM, G2, Conectius ou all)")
    args = parser.parse_args()

    # TRAVA MANDATÓRIA: Omie utilizado somente a partir de Junho/2025
    start_date = args.start_date
    apps = [
        {"key": os.getenv("OMIE_APP_KEY_MARBRASIL"), "sec": os.getenv("OMIE_APP_SECRET_MARBRASIL"), "name": "Mar Brasil"},
        {"key": os.getenv("OMIE_APP_KEY_DZM"), "sec": os.getenv("OMIE_APP_SECRET_DZM"), "name": "DZM"},
        {"key": os.getenv("OMIE_APP_KEY_G2"), "sec": os.getenv("OMIE_APP_SECRET_G2"), "name": "G2"},
        {"key": os.getenv("OMIE_APP_KEY_CONECTIUS"), "sec": os.getenv("OMIE_APP_SECRET_CONECTIUS"), "name": "Conectius"}
    ]

    if args.empresa and args.empresa.lower() != "all":
        apps = [a for a in apps if a["name"].lower() == args.empresa.lower()]
    
    for app in apps:
        if not app["key"]: continue
        log(f"\n>>> Sincronizando {app['name']}")
        sync = OmieSync(app["key"], app["sec"], app["name"])
        sync.sync_dimensions()
        
        # 1. Movimentos Bancários / Extratos Reais PRIMEIRO (Fonte Única da Verdade para Regime de Caixa)
        log("Processando Movimentos Bancários (Extratos Reais)...")
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
        
        # Mapear IDs de títulos de CP e CR para evitar duplicatas em movimentos
        known_titles = set(str(r["omie_id"]) for r in rows_cp + rows_cr if r.get("omie_id"))
        
        # 4. Movimentos Bancários não vinculados a títulos (ex: tarifas bancárias, despesas diretas de extrato)
        rows_mov = sync.process_movimentos(recs_mov, known_titles=known_titles)
        
        # 5. Push para o Supabase (com trava estrita >= 2025-06-01)
        all_rows = rows_cp + rows_cr + rows_mov
        all_rows = [
            r for r in all_rows 
            if (r.get("data_pagamento") or r.get("data_registro") or "9999-12-31") >= "2025-06-01"
        ]
        
        # Coletar IDs de nCodMovCC de movimentos vinculados a títulos para purgar duplicatas legadas
        extra_delete_ids = set()
        for tit_id, m_info in mov_map.items():
            if m_info.get("nCodMovCC"):
                extra_delete_ids.add(m_info["nCodMovCC"])
                
        push_to_supabase(all_rows, extra_delete_ids=extra_delete_ids)

    log("\nSincronização Finalizada!")

if __name__ == "__main__":
    main()
