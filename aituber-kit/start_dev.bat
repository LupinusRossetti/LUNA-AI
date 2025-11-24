@echo off
chcp 65001 >nul

cd /d C:\LUNA-AI\aituber-kit

echo ============================================
echo  AITuberKit  A ^& B (DEV MODE)  -  AB
echo ============================================

REM 1) .env.A から Windows ユーザー取得
set WINDOWS_USER=
for /f "tokens=2 delims==" %%U in ('findstr /r "^WINDOWS_USER=" .env.A') do set WINDOWS_USER=%%U

if "%WINDOWS_USER%"=="" (
    echo ERROR: .env.A に WINDOWS_USER がありません
    pause
    exit /b
)

echo Using Windows User: %WINDOWS_USER%
echo.

REM 2) python/.env を AB に切り替え
powershell -Command "(Get-Content 'C:\LUNA-AI\python\.env') -replace 'APP_MODE=.*','APP_MODE=AB' | Set-Content 'C:\LUNA-AI\python\.env'"
echo python/.env updated → APP_MODE=AB
echo.

REM 3) port kill
for %%p in (3000 3001 8765) do (
    for /f "tokens=5" %%q in ('netstat -ano ^| find ":%%p" ^| find "LISTENING"') do taskkill /PID %%q /F >nul 2>&1
)
echo Ports killed.
echo.

REM 4) simple_ws_server 起動
netstat -ano | find ":8765" | find "LISTENING" >nul
if %errorlevel%==0 (
    echo simple_ws_server.py already running
) else (
    start "WS_SERVER" cmd /k "cd C:\LUNA-AI\python && python simple_ws_server.py"
    timeout /t 2 >nul
)
echo.

REM 5) ws_router 起動
start "ORCHESTRATOR" cmd /k "cd C:\LUNA-AI\python && python -m orchestrator.ws_router"
timeout /t 2 >nul
echo.

REM 6) AivisSpeech 起動
start "" "C:\Users\%WINDOWS_USER%\AppData\Local\Programs\AivisSpeech\AivisSpeech.exe"
timeout /t 2 >nul
echo.

REM 7) A 起動 (3000)
start "AITuberKit_A" cmd /k ^
"set NEXT_PUBLIC_APP_MODE=AB && cd C:\LUNA-AI\aituber-kit && npm run dev:A"
echo Waiting 3000...
:W3000
timeout /t 1 >nul
netstat -ano | find ":3000" | find "LISTENING" >nul
if %errorlevel%==1 goto W3000

REM 8) B 起動 (3001)
start "AITuberKit_B" cmd /k ^
"set NEXT_PUBLIC_APP_MODE=AB && cd C:\LUNA-AI\aituber-kit && npm run dev:B"
echo Waiting 3001...
:W3001
timeout /t 1 >nul
netstat -ano | find ":3001" | find "LISTENING" >nul
if %errorlevel%==1 goto W3001

REM 9) chrome 起動
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3000?app=A"
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3001?app=B"

echo ============================================
echo     A + B Ready (AB MODE)
echo ============================================
