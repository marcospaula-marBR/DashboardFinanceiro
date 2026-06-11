import os
import json
import csv

def format_currency(value):
    try:
        val = float(str(value).replace('.', '').replace(',', '.').replace('R$', '').strip())
        return round(val, 2)
    except:
        return 0.0

MONTH_MAP = {
    'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
}

def parse_month_year(header):
    if not header: return None
    parts = header.strip().lower().split('/')
    if len(parts) == 2 and parts[0] in MONTH_MAP and parts[1].isdigit():
        month = MONTH_MAP[parts[0]]
        year = "20" + parts[1] if len(parts[1]) == 2 else parts[1]
        return f"{year}-{month}-01"
    return None

def main():
    print("Iniciando geração do Data Lake Dianna a partir do CSV (Formato Horizontal)...")
    
    csv_path = os.path.join(os.path.dirname(__file__), 'importacao.csv')
    if not os.path.exists(csv_path):
        print(f"Erro: Arquivo CSV não encontrado em {csv_path}")
        return
        
    print(f"Lendo {csv_path}...")
    
    data_lake = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = list(csv.DictReader(f, delimiter=';'))
    except UnicodeDecodeError:
        with open(csv_path, 'r', encoding='latin-1') as f:
            reader = list(csv.DictReader(f, delimiter=';'))
            
    if reader and len(reader) > 0 and len(reader[0].keys()) == 1:
        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = list(csv.DictReader(f, delimiter=','))
        except UnicodeDecodeError:
            with open(csv_path, 'r', encoding='latin-1') as f:
                reader = list(csv.DictReader(f, delimiter=','))

    # Identificar a coluna de Nome (Pode ser 'PRESTADORES DE SERVIÇO' ou 'Nome')
    if not reader or len(reader) == 0:
        print("CSV vazio.")
        return
        
    headers = list(reader[0].keys())
    name_col = next((h for h in headers if h and ('PRESTADOR' in h.upper() or 'NOME' in h.upper() or 'COLAB' in h.upper())), None)
    
    if not name_col:
        print("Erro: Coluna de Nome não encontrada. O CSV deve ter uma coluna como 'PRESTADORES DE SERVIÇO' ou 'Nome'.")
        return

    # Identificar quais colunas são de meses
    month_columns = {}
    for h in headers:
        comp_date = parse_month_year(h)
        if comp_date:
            month_columns[h] = comp_date

    print(f"Foram identificadas {len(month_columns)} colunas de meses (ex: out/20).")

    for row in reader:
        nome_bruto = row.get(name_col, '').strip()
        if not nome_bruto or nome_bruto.upper() in ["TOTAL", "MÉDIA", "NONE"]: continue
        
        # Para cada mês, extrair o valor se houver
        for col_name, comp_date in month_columns.items():
            raw_val = str(row.get(col_name, '')).strip()
            if not raw_val or raw_val == '-': continue
            
            valor = format_currency(raw_val)
            if valor == 0.0: continue
            
            data_lake.append({
                "sheet": "Planilha Horizontal",
                "competencia": comp_date,
                "nome_bruto": nome_bruto,
                "valor_total": valor
            })

    output_file = os.path.join(os.path.dirname(__file__), '..', 'dashboard-v2', 'public', 'dianna_source.json')
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data_lake, f, ensure_ascii=False, indent=2)

    print(f"\nData Lake gerado com sucesso!")
    print(f"[{len(data_lake)}] registros processados.")
    print(f"Arquivo salvo em: {output_file}")

if __name__ == "__main__":
    main()
