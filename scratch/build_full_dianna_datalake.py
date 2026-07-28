import os
import json
import datetime
import openpyxl

def format_currency(value):
    if value is None:
        return 0.0
    try:
        val = float(str(value).replace('.', '').replace(',', '.').replace('R$', '').strip())
        return round(val, 2)
    except:
        return 0.0

def parse_month_col(val):
    if isinstance(val, datetime.datetime) or isinstance(val, datetime.date):
        return val.strftime('%Y-%m-01')
    if not val:
        return None
    s = str(val).strip().lower()
    if '/' in s:
        parts = s.split('/')
        if len(parts) == 2:
            m_map = {'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
                     'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'}
            m = m_map.get(parts[0][:3])
            y = "20" + parts[1] if len(parts[1]) == 2 else parts[1]
            if m and y.isdigit():
                return f"{y}-{m}-01"
    return None

def process_sheet(sheet, sheet_name):
    records = []
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return records
    
    header = rows[0]
    month_cols = {}
    for idx, cell in enumerate(header):
        parsed = parse_month_col(cell)
        if parsed:
            month_cols[idx] = parsed
            
    print(f"[{sheet_name}] Identificadas {len(month_cols)} colunas de competência.")
    
    name_col_idx = 1
    for idx, cell in enumerate(header[:10]):
        c_str = str(cell or '').upper()
        if 'FUNCION' in c_str or 'PRESTADOR' in c_str or 'NOME' in c_str:
            name_col_idx = idx
            break

    current_nome = None
    for row in rows[1:]:
        if not row: continue
        raw_name = row[name_col_idx] if len(row) > name_col_idx else None
        if raw_name and str(raw_name).strip() and str(raw_name).strip().upper() not in ["TOTAL", "MÉDIA", "NONE", "ITEM"]:
            current_nome = str(raw_name).strip()
            
        if not current_nome: continue
        
        for col_idx, comp_date in month_cols.items():
            if col_idx >= len(row): continue
            cell_val = row[col_idx]
            if cell_val is None or cell_val == '-' or cell_val == '': continue
            val = format_currency(cell_val)
            if val <= 0: continue
            
            records.append({
                "sheet": sheet_name,
                "competencia": comp_date,
                "nome_bruto": current_nome,
                "valor_total": val
            })
            
    return records

def main():
    excel_path = os.path.join(os.path.dirname(__file__), '..', 'dashboard-v2', 'public', 'Dianna.xlsx')
    if not os.path.exists(excel_path):
        print("Excel não encontrado:", excel_path)
        return
        
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    all_records = []
    
    target_sheets = ['MEI - NOVA', 'CLT NOVA', 'Rescisório - CLT']
    for s_name in target_sheets:
        if s_name in wb.sheetnames:
            recs = process_sheet(wb[s_name], s_name)
            print(f"[{s_name}] Extraídos {len(recs)} lançamentos.")
            all_records.extend(recs)
            
    unique_records = []
    seen = set()
    for r in all_records:
        key = (r['sheet'], r['competencia'], r['nome_bruto'].lower(), r['valor_total'])
        if key not in seen:
            seen.add(key)
            unique_records.append(r)
            
    output_path = os.path.join(os.path.dirname(__file__), '..', 'dashboard-v2', 'public', 'dianna_source.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(unique_records, f, ensure_ascii=False, indent=2)
        
    print(f"\nData Lake Dianna Total gerado com sucesso!")
    print(f"Total de registros unificados (CLT + MEI): {len(unique_records)}")
    print(f"Salvo em: {output_path}")

if __name__ == '__main__':
    main()
