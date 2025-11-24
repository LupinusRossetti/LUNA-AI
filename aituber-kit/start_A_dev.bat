@echo off
chcp 65001 >nul

echo ==============================
echo     AITuberKit - A DEV MODE
echo ==============================

cd /d C:\LUNA-AI\aituber-kit

REM ============================================
REM 1) .env.A → WINDOWS_USER 読み込み
REM ============================================
set WINDOWS_USER=
for /f "tokens=2 delims==" %%U in ('findstr /r "^WINDOWS_USER=" .env.A') do set WINDOWS_USER=%%U

if "%WINDOWS_USER%"=="" (
    echo ERROR: .env.A に WINDOWS_USER がありません
    pause
    exit /b
)

echo Using Windows User: %WINDOWS_USER%
echo.

REM ============================================
REM 2) python/.env → APP_MODE=single_A
REM ============================================
powershell -Command "(Get-Content 'C:\LUNA-AI\python\.env') -replace 'APP_MODE=.*','APP_MODE=single_A' | Set-Content 'C:\LUNA-AI\python\.env'"
echo python/.env → APP_MODE=single_A
echo.

REM ============================================
REM 3) PORT kill
REM ============================================
echo Killing ports 3000 3001 8765 ...
for %%p in (3000 3001 8765) do (
    for /f "tokens=5" %%q in ('netstat -ano ^| find ":%%p" ^| find "LISTENING"') do taskkill /PID %%q /F >nul 2>&1
)
echo.

REM ============================================
REM 4) simple_ws_server (8765)
REM ============================================
echo Checking WebSocket server (8765)...
netstat -ano | find ":8765" | find "LISTENING" >nul
if %errorlevel%==0 (
    echo simple_ws_server.py は既に起動中
) else (
    start "WS_SERVER" cmd /k "cd C:\LUNA-AI\python && python simple_ws_server.py"
    timeout /t 2 >nul
)
echo.

REM ============================================
REM 5) ws_router.py（単体でも必要）
REM ============================================
echo Starting orchestrator (router single_A)...
start "ORCHESTRATOR" cmd /k "cd C:\LUNA-AI\python && python -m orchestrator.ws_router"
timeout /t 2 >nul
echo.

REM ============================================
REM 6) CharacterA.py 起動
REM ============================================
echo Starting CharacterA agent...
start "CHARA_A" cmd /k "cd C:\LUNA-AI\python && python characterA.py"
echo.

REM ============================================
REM 7) AItuberKit A 起動
REM ============================================
echo Starting AITuberKit (A)...
start "AITuberKit_A" cmd /k "set NEXT_PUBLIC_APP_MODE=single_A && npm run dev:A"

echo Waiting for port 3000...
:WAIT_A
timeout /t 1 >nul
netstat -ano | find ":3000" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_A

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3000?app=A"

echo A 起動完了！
echo.
exit /b
