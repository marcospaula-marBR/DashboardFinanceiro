@echo off
TITLE Mar Brasil System Server
COLOR 0B

echo ========================================================
echo      MAR BRASIL - SISTEMA DE GESTAO FINANCEIRA
echo ========================================================
echo.

:: 1. Tenta Python
python --version >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo [OK] Python detectado. Iniciando servidor...
    start http://localhost:8000
    python -m http.server 8000
    GOTO END
)

:: 2. Tenta Node.js (http-server)
call npm --version >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js detectado. Iniciando servidor...
    echo Aguarde... instalando/iniciando http-server...
    start http://localhost:8080
    call npx -y http-server -p 8080 -c-1
    GOTO END
)

:: 3. Fallback (Modo Offline)
echo [ATENCAO] Nem Python nem Node.js encontrados.
echo O sistema abrira em modo OFFLINE (sem carregamento automatico).
echo.
echo Abrindo navegador...
explorer "index.html"

:END
pause
