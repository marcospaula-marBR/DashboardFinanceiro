# Sincronizador Unificado Omie -> Supabase
# v31.0 - Mar Brasil / DZM / G2 / Conectius

Write-Host "--- Sincronizador Unificado Omie Dashboard ---" -ForegroundColor Cyan
Write-Host "Este script sincronizará dimensões (categorias, projetos, fornecedores) e omie_financas_unificado." -ForegroundColor Gray

$inputDate = Read-Host "`nInforme a data de início (DD/MM/AAAA) [01/06/2025]"
if ($inputDate -eq "") { $inputDate = "01/06/2025" }

# Trava mandatória: Omie iniciado em Junho/2025
$cutoff = [datetime]::ParseExact("01/06/2025", "dd/MM/yyyy", $null)
$parsed = [datetime]::ParseExact($inputDate, "dd/MM/yyyy", $null)
if ($parsed -lt $cutoff) {
    Write-Host "[AVISO] Omie iniciado apenas em Junho/25. Ajustando data para 01/06/2025..." -ForegroundColor Yellow
    $inputDate = "01/06/2025"
}

Write-Host "`n[1/1] Iniciando sincronização unificada a partir de $inputDate..." -ForegroundColor Yellow
python sync_omie_unified_v4.py --start-date $inputDate --empresa all

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[OK] Sincronização concluída com sucesso!" -ForegroundColor Green
} else {
    Write-Host "`n[!] Ocorreu um erro durante a sincronização. Verifique os logs acima." -ForegroundColor Red
}

Write-Host "`nPressione qualquer tecla para sair..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
