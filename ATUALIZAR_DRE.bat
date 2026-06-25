@echo off
title Mar Brasil - Atualizador de Dados DRE
echo ===================================================
echo   ATUALIZADOR DE DRE - Mar Brasil
echo ===================================================
echo.
echo Este script ira unir os arquivos:
echo 1. base_manual_dre.csv (Historico/Manual)
echo 2. dados_tratado_jun25_em_diante.csv (Novos Dados Omie)
echo.
echo Verificando arquivos...

cd dashboard-v2\public

if not exist "base_manual_dre.csv" (
    echo [ERRO] Arquivo 'base_manual_dre.csv' nao encontrado na pasta public!
    goto error
)

if not exist "dados_tratado_jun25_em_diante.csv" (
    if exist "..\..\dados_tratado_jun25_em_diante.csv" (
        echo Copiando dados do Omie da raiz para a pasta public...
        copy "..\..\dados_tratado_jun25_em_diante.csv" "dados_tratado_jun25_em_diante.csv"
    ) else (
        echo [ERRO] Arquivo 'dados_tratado_jun25_em_diante.csv' nao encontrado!
        echo Coloque este arquivo na raiz do projeto ou na pasta public.
        goto error
    )
)

echo [OK] Arquivos encontrados. Iniciando processamento...
echo.

node import-dre-dual-source.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Ocorreu um problema ao processar os dados.
    goto error
)

echo.
echo ===================================================
echo ✅ SUCESSO! Os dados foram atualizados.
echo Agora voce pode abrir o Dashboard para ver as mudancas.
echo ===================================================
echo.
pause
exit

:error
echo.
echo ===================================================
echo ❌ FALHA na atualizacao. Verifique as mensagens acima.
echo ===================================================
echo.
pause
exit
