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
                self.proj_map[str(p["codigo"])] = p.get("nome")
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

    def process_cp_cr(self, records, tipo):
        rows = []
        sign = -1 if tipo == "PAGAR" else 1
        for r in records:
            omie_id = r.get("codigo_lancamento_omie")
            status = r.get("status_titulo")
            
            # Data de Pagamento: Baixa > Liquidação > Previsão (se PAGO)
            dt_baixa = format_date_iso_to_iso(r.get("data_baixa") or r.get("data_liquidacao"))
            dt_previsao = format_date_iso_to_iso(r.get("data_previsao"))
            
            data_pagamento = dt_baixa
            if not data_pagamento and (status == "PAGO" or status == "RECEBIDO"):
                data_pagamento = dt_previsao # Conforme regra do usuário: previsao vira pagamento na liquidação
            
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
                    "valor_total": float(r.get("valor_documento") or 0) * sign,
                    "valor_alocado": float(d.get("nValDep") or 0) * sign,
                    "data_emissao": dt_emissao,
                    "data_registro": data_registro,
                    "data_vencimento": format_date_iso_to_iso(r.get("data_vencimento")),
                    "data_previsao": dt_previsao,
                    "data_pagamento": data_pagamento,
                    "categoria_codigo": r.get("codigo_categoria"),
                    "categoria_nome": self.cat_map.get(str(r.get("codigo_categoria")), {}).get("descricao") or r.get("descricao_categoria"),
                    "projeto_nome": self.proj_map.get(str(r.get("codigo_projeto")), r.get("nome_projeto") or "Sem Projeto"),
                    "departamento_nome": d.get("cDesDep"),
                    "cliente_fornecedor": cliente_forn,
                    "numero_documento": r.get("numero_documento"),
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

    def process_movimentos(self, records):
        rows = []
        for r in records:
            det = r.get("detalhes", {})
            res = r.get("resumo", {})
            
            # Extração robusta do valor do movimento: nValorMovCC -> nValPago -> nValLiquido
            valor = float(det.get("nValorMovCC") or res.get("nValPago") or res.get("nValLiquido") or 0)
            sign = 1 if det.get("cTipo") == "E" else -1
            
            # Extração robusta de datas
            dt_registro_mov = format_date_iso_to_iso(det.get("dDtRegistro"))
            dt_pagto_mov = format_date_iso_to_iso(det.get("dDtPagto") or det.get("dDtPagamento") or det.get("dDataPagamento"))
            dt_venc_mov = format_date_iso_to_iso(det.get("dDtVenc"))
            dt_inc_mov = format_date_iso_to_iso(det.get("dDtInc") or r.get("info", {}).get("dInc"))
            
            # Cadeia unificada para extratos bancários (MOVIMENTO)
            data_registro = dt_registro_mov or dt_pagto_mov or dt_venc_mov or dt_inc_mov
            
            cat_key = str(det.get("cCodCateg") or "")
            cat_info = self.cat_map.get(cat_key)
            if isinstance(cat_info, dict):
                cat_nome = cat_info.get("descricao") or "Sem Categoria"
            else:
                cat_nome = cat_info or "Sem Categoria"
            
            rows.append({
                "empresa_nome": self.empresa_nome,
                "omie_id": det.get("nCodMovCC"),
                "tipo_registro": "MOVIMENTO",
                "status": "PAGO",
                "valor_total": valor * sign,
                "valor_alocado": valor * sign,
                "data_emissao": format_date_iso_to_iso(det.get("dDtEmissao")),
                "data_registro": data_registro,
                "data_vencimento": dt_venc_mov,
                "data_previsao": dt_pagto_mov,
                "data_pagamento": dt_pagto_mov,
                "categoria_codigo": det.get("cCodCateg"),
                "categoria_nome": cat_nome,
                "projeto_nome": self.proj_map.get(str(det.get("nCodProjeto")), "Sem Projeto"),
                "departamento_nome": "Principal",
                "cliente_fornecedor": det.get("cNomeCliente") or "N/D",
                "numero_documento": det.get("cNumDocFiscal"),
                "raw_data": r
            })
        return rows

def push_to_supabase(rows):
    if not rows: return
    log(f"Enviando {len(rows)} registros para o Supabase...")
    
    # Agrupar por empresa_nome e tipo_registro para fazer delete e insert seguros em lote
    groups = {}
    for r in rows:
        key = (r["empresa_nome"], r["tipo_registro"])
        if key not in groups:
            groups[key] = []
        groups[key].append(r)
        
    for (empresa, tipo), group_rows in groups.items():
        size = 100
        for i in range(0, len(group_rows), size):
            chunk = group_rows[i:i+size]
            ids = [r["omie_id"] for r in chunk]
            
            # 1. Deletar os antigos correspondentes
            ids_str = ",".join(map(str, ids))
            del_url = f"{SUPABASE_URL}/rest/v1/omie_financas_unificado?empresa_nome=eq.{empresa}&tipo_registro=eq.{tipo}&omie_id=in.({ids_str})"
            
            del_resp = requests.delete(del_url, headers=HEADERS_SB)
            if del_resp.status_code not in [200, 204]:
                log(f"Erro ao deletar registros antigos: {del_resp.text}")
                
            # 2. Inserir os novos registros atualizados
            post_resp = requests.post(f"{SUPABASE_URL}/rest/v1/omie_financas_unificado", headers=HEADERS_SB, json=chunk)
            if post_resp.status_code not in [200, 201, 204]:
                log(f"Erro ao inserir novos registros: {post_resp.text}")

def main():
    start_date = "01/05/2025"
    apps = [
        {"key": os.getenv("OMIE_APP_KEY_MARBRASIL"), "sec": os.getenv("OMIE_APP_SECRET_MARBRASIL"), "name": "Mar Brasil"},
        {"key": os.getenv("OMIE_APP_KEY_DZM"), "sec": os.getenv("OMIE_APP_SECRET_DZM"), "name": "DZM"}
    ]
    
    for app in apps:
        if not app["key"]: continue
        log(f"\n>>> Sincronizando {app['name']}")
        sync = OmieSync(app["key"], app["sec"], app["name"])
        sync.sync_dimensions()
        
        # Contas a Pagar
        log("Processando Contas a Pagar...")
        recs_cp = sync.fetch_records(URL_CP, "ListarContasPagar", "conta_pagar_cadastro", start_date)
        rows_cp = sync.process_cp_cr(recs_cp, "PAGAR")
        
        # Contas a Receber
        log("Processando Contas a Receber...")
        recs_cr = sync.fetch_records(URL_CR, "ListarContasReceber", "conta_receber_cadastro", start_date)
        rows_cr = sync.process_cp_cr(recs_cr, "RECEBER")
        
        # Movimentos
        log("Processando Movimentos Bancários...")
        recs_mov = sync.fetch_movimentos(start_date)
        rows_mov = sync.process_movimentos(recs_mov)
        
        # Push
        all_rows = rows_cp + rows_cr + rows_mov
        push_to_supabase(all_rows)

    log("\nSincronização Finalizada!")

if __name__ == "__main__":
    main()
