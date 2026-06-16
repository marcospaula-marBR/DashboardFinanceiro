import os

files_to_fix = [
    r"dashboard-v2/src/app/comissoes-v1-backup/page.tsx",
    r"dashboard-v2/src/components/comissoes-v1/ContratoModal.tsx",
    r"dashboard-v2/src/components/comissoes-v1/EquipeModal.tsx",
    r"dashboard-v2/src/components/comissoes-v1/HistoricoTable.tsx",
    r"dashboard-v2/src/components/comissoes-v1/KpiCards.tsx",
    r"dashboard-v2/src/components/comissoes-v1/LancamentoModal.tsx"
]

base_dir = r"d:\DRE-V33-Dianna"

for rel_path in files_to_fix:
    full_path = os.path.join(base_dir, rel_path)
    if not os.path.exists(full_path):
        print(f"File not found: {full_path}")
        continue
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replacements
    content = content.replace("@/services/comissoes.service", "@/services/comissoes-v1.service")
    content = content.replace('"@/services/comissoes.service"', '"@/services/comissoes-v1.service"')
    content = content.replace("@/types/comissoes", "@/types/comissoes-v1")
    content = content.replace('"@/types/comissoes"', '"@/types/comissoes-v1"')
    content = content.replace("@/components/comissoes/", "@/components/comissoes-v1/")
    content = content.replace('"@/components/comissoes/', '"@/components/comissoes-v1/')
    
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Updated: {rel_path}")
