import os
import requests
import re
from collections import defaultdict

SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# Buscar apenas os lançamentos de Jan/26
url = f"{SUPABASE_URL}/rest/v1/dre_lancamentos?periodo=eq.Jan/26&select=*"
resp = requests.get(url, headers=HEADERS)

if not resp.ok:
    print(f"Erro: {resp.status_code} - {resp.text}")
    exit(1)

records = resp.json()
print(f"Total de registros carregados para Jan/26: {len(records)}")

subCategoriasEspecificas = [
  'Terceirização de Mão de Obra', 'Credenciado Operacional', 'Adiantamento - Credenciado Operacional',
  'Despesas com Pessoal', 'Manutenção Preventiva', 'Preventiva - B2G', 'Manutenção Corretiva',
  'Corretiva - B2G', 'Credenciado Administrativo', 'Adiantamento - Credenciado Administrativo',
  'Credenciado TI', 'Adiantamento - Credenciado TI', 'Distribuição de Dividendos', 'Dividendos',
  'Consórcios - a contemplar', 'Ativos', 'Mútuo - Entradas', 'Mútuo - Saídas',
  'Jurídico', 'Intermediação de Negócios'
]

catTotals = defaultdict(float)
catSourceRows = defaultdict(list)

for r in records:
    valor = float(r.get('valor') or 0)
    if valor == 0:
        continue

    # Normalizar Conta DRE e Categoria
    conta_dre = r.get('conta_dre', '').strip()
    conta_dre = re.sub(r'^\d+\.\s*', '', conta_dre)
    
    categoria = r.get('categoria', '').strip()
    
    cat = conta_dre
    if categoria and any(sub.lower() == categoria.lower() for sub in subCategoriasEspecificas):
        matched = [sub for sub in subCategoriasEspecificas if sub.lower() == categoria.lower()][0]
        cat = matched
        
    catTotals[cat] += valor
    catSourceRows[cat].append(r)

print("\n--- Totais por Categoria Mapeada em Jan/26 ---")
for cat, tot in sorted(catTotals.items()):
    print(f"{cat:<30}: R$ {tot:>12.2f} (Itens: {len(catSourceRows[cat])})")

print("\n--- Detalhes da Categoria 'Serviços' em Jan/26 ---")
for r in catSourceRows.get('Serviços', []):
    print(f"Empresa: {r.get('empresa')} | Categoria: {r.get('categoria')} | Valor: {r.get('valor')}")

# Simular o calculo final da DRE para a linha 'Serviços' e 'Consórcios a contemplar'
servicosBaseTotal = catTotals.get('Serviços', 0.0)
consorciosTotal = catTotals.get('Consórcios - a contemplar', 0.0)
ativosTotal = catTotals.get('Ativos', 0.0)

totalServicosAjustado = servicosBaseTotal - consorciosTotal if servicosBaseTotal >= consorciosTotal else 0.0
totalInvestimentos = consorciosTotal + totalServicosAjustado + ativosTotal

print("\n--- Resultado Final Calculado ---")
print(f"Serviços Base (Raw)          : R$ {servicosBaseTotal:>12.2f}")
print(f"Consórcios a contemplar      : R$ {consorciosTotal:>12.2f}")
print(f"Serviços Ajustado (DRE line) : R$ {totalServicosAjustado:>12.2f}")
print(f"Ativos                       : R$ {ativosTotal:>12.2f}")
print(f"Total Investimentos          : R$ {totalInvestimentos:>12.2f}")
