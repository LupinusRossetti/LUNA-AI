@echo off
chcp 65001 >nul

echo ==============================
echo     AITuberKit - B DEV MODE
echo ==============================

cd /d C:\LUNA-AI\aituber-kit

REM ============================================
REM 1) .env.B → WINDOWS_USER
REM ============================================
set WINDOWS_USER=
for /f "tokens=2 delims==" %%U in ('findstr /r "^WINDOWS_USER=" .env.B') do set WINDOWS_USER=%%U

if "%WINDOWS_USER%"=="" (
    echo ERROR: .env.B に WINDOWS_USER がありません
    pause
    exit /b
)

echo Using Windows User: %WINDOWS_USER%
echo.

REM ============================================
REM 2) python/.env → APP_MODE=single_B
REM ============================================
powershell -Command "(Get-Content 'C:\LUNA-AI\python\.env') -replace 'APP_MODE=.*','APP_MODE=single_B' | Set-Content 'C:\LUNA-AI\python\.env'"
echo python/.env → APP_MODE=single_B
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
REM 4) simple_ws_server
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
echo Starting orchestrator (router single_B)...
start "ORCHESTRATOR" cmd /k "cd C:\LUNA-AI\python && python -m orchestrator.ws_router"
timeout /t 2 >nul
echo.

REM ============================================
REM 6) CharacterB.py
REM ============================================
echo Starting CharacterB agent...
start "CHARA_B" cmd /k "cd C:\LUNA-AI\python && python characterB.py"
echo.

REM ============================================
REM 7) AItuberKit B 起動
REM ============================================
echo Starting AITuberKit (B)...
start "AITuberKit_B" cmd /k "set NEXT_PUBLIC_APP_MODE=single_B && npm run dev:B"

echo Waiting for port 3001...
:WAIT_B
timeout /t 1 >nul
netstat -ano | find ":3001" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_B

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3001?app=B"

echo B 起動完了！
echo.
exit /b
