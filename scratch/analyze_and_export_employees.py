import urllib.request
import json
import csv
import sys
import os

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def http(method, path, body=None):
    url = SUPABASE_URL + path
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            text = r.read().decode()
            return r.status, json.loads(text) if text else []
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        return e.code, err

def clean_doc(doc):
    if not doc:
        return ""
    # Remove dots, dashes, slashes, spaces
    return "".join(c for c in str(doc) if c.isdigit())

def clean_name(name):
    if not name:
        return ""
    return " ".join(str(name).strip().upper().split())

def main():
    print("=" * 80)
    print("ANALYSIS: Fetching and analyzing employees for duplicates...")
    print("=" * 80)

    # 1. Fetch employees
    status, emps = http("GET", "/rest/v1/employees?select=*")
    if status != 200:
        print(f"Error fetching employees: {emps}")
        return

    print(f"Loaded {len(emps)} employee records.")

    # 2. Check for duplicate document_ids (CPF/CNPJ)
    by_doc = {}
    for e in emps:
        doc = clean_doc(e.get('document_id'))
        if doc:
            if doc not in by_doc:
                by_doc[doc] = []
            by_doc[doc].append(e)

    dup_docs = {k: v for k, v in by_doc.items() if len(v) > 1}
    print(f"\n[1] Duplicidades por CPF/CNPJ (mesmo documento em múltiplos perfis): {len(dup_docs)}")
    for doc, records in dup_docs.items():
        print(f"  - Documento: {doc}")
        for r in records:
            print(f"    ID: {r['id']} | Nome: '{r['full_name']}' | Empresa: {r['company']} | Vínculo: {r['employment_type']} | Setor: {r['department']}")

    # 3. Check for duplicates by name similarity (exact name match)
    by_name = {}
    for e in emps:
        name = clean_name(e.get('full_name'))
        if name:
            if name not in by_name:
                by_name[name] = []
            by_name[name].append(e)

    dup_names = {k: v for k, v in by_name.items() if len(v) > 1}
    print(f"\n[2] Duplicidades por Nome Exato: {len(dup_names)}")
    for name, records in dup_names.items():
        print(f"  - Nome: '{name}'")
        for r in records:
            print(f"    ID: {r['id']} | Empresa: {r['company']} | Vínculo: {r['employment_type']} | Doc: {r['document_id']} | Setor: {r['department']}")

    # 4. Check how many of these duplicate profiles are linked to loans, bonds or costs
    all_duplicate_ids = set()
    for records in dup_docs.values():
        for r in records:
            all_duplicate_ids.add(r['id'])
    for records in dup_names.values():
        for r in records:
            all_duplicate_ids.add(r['id'])

    print(f"\n[3] Analisando dependências de {len(all_duplicate_ids)} registros potencialmente duplicados...")
    for eid in all_duplicate_ids:
        # Find employee name for logging
        emp_name = next(e['full_name'] for e in emps if e['id'] == eid)
        _, loans = http("GET", f"/rest/v1/employee_loans?employee_id=eq.{eid}&select=id")
        _, bonds = http("GET", f"/rest/v1/people_employment_bonds?employee_id=eq.{eid}&select=id")
        _, costs = http("GET", f"/rest/v1/people_monthly_costs?employee_id=eq.{eid}&select=id")
        
        loans_cnt = len(loans) if isinstance(loans, list) else 0
        bonds_cnt = len(bonds) if isinstance(bonds, list) else 0
        costs_cnt = len(costs) if isinstance(costs, list) else 0

        if loans_cnt > 0 or bonds_cnt > 0 or costs_cnt > 0:
            print(f"  - ID: {eid} | Nome: '{emp_name}' | Empréstimos: {loans_cnt} | Vínculos: {bonds_cnt} | Custos: {costs_cnt}")

    # 5. Export to CSV template
    csv_file_path = "d:/DRE-V33-Dianna/base_colaboradores_atual.csv"
    print(f"\n[4] Exportando todos os colaboradores para '{csv_file_path}'...")
    
    headers_br = [
        "ID_SISTEMA_DO_NOT_CHANGE",
        "NOME_COMPLETO_RAZAO_SOCIAL",
        "EMPRESA_MarBR_OU_DZM",
        "TIPO_VINCULO_CLT_MEI_ESTAGIARIO_PJ",
        "NOME_SOCIO_RESPONSAVEL",
        "CPF_SOCIO_RESPONSAVEL",
        "CPF_CNPJ_DOCUMENTO",
        "CHAVE_PIX",
        "CARGO",
        "SETOR",
        "SALARIO_FIXO_BRUTO",
        "VALOR_BONUS_FIXO",
        "VALOR_COMISSAO_FIXA",
        "DATA_ADMISSAO_INICIO_AAAA_MM_DD",
        "DATA_DESLIGAMENTO_AAAA_MM_DD",
        "STATUS_Ativo_Ferias_Inativo_Provisao",
        "TELEFONE",
        "EMAIL",
        "CEP",
        "RUA",
        "NUMERO",
        "COMPLEMENTO",
        "BAIRRO",
        "CIDADE",
        "ESTADO_UF",
        "GENERO_M_F",
        "ESTADO_CIVIL",
        "TELEFONE_PROFISSIONAL",
        "EMAIL_PROFISSIONAL"
    ]

    field_mappings = [
        ("id", "ID_SISTEMA_DO_NOT_CHANGE"),
        ("full_name", "NOME_COMPLETO_RAZAO_SOCIAL"),
        ("company", "EMPRESA_MarBR_OU_DZM"),
        ("employment_type", "TIPO_VINCULO_CLT_MEI_ESTAGIARIO_PJ"),
        ("responsible_name", "NOME_SOCIO_RESPONSAVEL"),
        ("responsible_cpf", "CPF_SOCIO_RESPONSAVEL"),
        ("document_id", "CPF_CNPJ_DOCUMENTO"),
        ("pix_key", "CHAVE_PIX"),
        ("job_role", "CARGO"),
        ("department", "SETOR"),
        ("remuneration_fixed", "SALARIO_FIXO_BRUTO"),
        ("remuneration_bonus", "VALOR_BONUS_FIXO"),
        ("remuneration_commission", "VALOR_COMISSAO_FIXA"),
        ("start_date", "DATA_ADMISSAO_INICIO_AAAA_MM_DD"),
        ("resignation_date", "DATA_DESLIGAMENTO_AAAA_MM_DD"),
        ("status", "STATUS_Ativo_Ferias_Inativo_Provisao"),
        ("phone", "TELEFONE"),
        ("email", "EMAIL"),
        ("zip_code", "CEP"),
        ("street", "RUA"),
        ("number", "NUMERO"),
        ("complement", "COMPLEMENTO"),
        ("neighborhood", "BAIRRO"),
        ("city", "CIDADE"),
        ("state", "ESTADO_UF"),
        ("gender", "GENERO_M_F"),
        ("marital_status", "ESTADO_CIVIL"),
        ("phone_professional", "TELEFONE_PROFISSIONAL"),
        ("email_professional", "EMAIL_PROFISSIONAL")
    ]

    try:
        with open(csv_file_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f, delimiter=";")
            writer.writerow(headers_br)
            for e in emps:
                row = []
                for db_field, csv_col in field_mappings:
                    val = e.get(db_field)
                    if val is None:
                        val = ""
                    row.append(str(val))
                writer.writerow(row)
        print("[SUCCESS] Exportação concluída com sucesso!")
        print(f"O arquivo está pronto para edição em: {csv_file_path}")
    except Exception as ex:
        print(f"[ERROR] Falha ao exportar CSV: {ex}")

if __name__ == "__main__":
    main()
