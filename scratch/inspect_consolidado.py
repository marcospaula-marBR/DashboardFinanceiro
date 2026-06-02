import openpyxl

wb = openpyxl.load_workbook('D:/DRE-V33-Dianna/dashboard-v2/public/Dianna.xlsx', read_only=True)
ws = wb['CONSOLIDADO ATIVO INATIVO NOVO']

print("=== CONSOLIDADO HEADERS AND SAMPLE ROWS ===")
for idx, r in enumerate(ws.iter_rows(values_only=True)):
    if idx < 5:
        print(f"Row {idx}: {[str(c)[:40] if c is not None else 'None' for c in r]}")
