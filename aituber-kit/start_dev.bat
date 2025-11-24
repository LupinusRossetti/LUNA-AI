@echo off
chcp 65001 >nul

echo ============================================
echo      AITuberKit - AB MODE  (FULL)  
echo ============================================

REM ----- 基本パス -----
set KIT_DIR=C:\LUNA-AI\aituber-kit
set PY_DIR=C:\LUNA-AI\python

cd /d %KIT_DIR%


REM ============================================
REM 1) .env.A から Windows User 取得
REM ============================================
set WINDOWS_USER=
for /f "tokens=2 delims==" %%U in ('findstr /r "^WINDOWS_USER=" .env.A') do set WINDOWS_USER=%%U

if "%WINDOWS_USER%"=="" (
    echo ERROR: .env.AにWINDOWS_USERがありません
    pause
    exit /b
)

echo Using Windows User: %WINDOWS_USER%
echo.


REM ============================================
REM 2) python/.env → APP_MODE=AB に書き換え
REM ============================================
powershell -Command "(Get-Content '%PY_DIR%\.env') -replace 'APP_MODE=.*','APP_MODE=AB' | Set-Content '%PY_DIR%\.env'"
echo python/.env updated → APP_MODE=AB
echo.


REM ============================================
REM 3) 起動中のプロセス殺す（3000/3001/8765）
REM ============================================
echo Killing old ports...
for %%p in (3000 3001 8765) do (
    for /f "tokens=5" %%q in ('netstat -ano ^| find ":%%p" ^| find "LISTENING"') do taskkill /PID %%q /F >nul 2>&1
)
echo Ports killed.
echo.


REM ============================================
REM 4) simple_ws_server 起動（存在しなければのみ）
REM ============================================
netstat -ano | find ":8765" | find "LISTENING" >nul
if %errorlevel%==0 (
    echo simple_ws_server already running
) else (
    start "WS_SERVER" cmd /k "cd %PY_DIR% && python simple_ws_server.py"
    timeout /t 2 >nul
)
echo.


REM ============================================
REM 5) ws_router 起動
REM ============================================
start "ORCHESTRATOR" cmd /k "cd %PY_DIR% && python -m orchestrator.ws_router"
timeout /t 2 >nul
echo.


REM ============================================
REM 6) AivisSpeech 起動
REM ============================================
start "" "C:\Users\%WINDOWS_USER%\AppData\Local\Programs\AivisSpeech\AivisSpeech.exe"
timeout /t 2 >nul
echo.


REM ============================================
REM 7) A (3000)
REM ============================================
echo Starting AITuberKit A...
start "AITuberKit_A" cmd /k "cd %KIT_DIR% && npm run dev:A"

echo Waiting 3000...
:W3000
timeout /t 1 >nul
netstat -ano | find ":3000" | find "LISTENING" >nul
if %errorlevel%==1 goto W3000


REM ============================================
REM 8) B (3001)
REM ============================================
echo Starting AITuberKit B...
start "AITuberKit_B" cmd /k "cd %KIT_DIR% && npm run dev:B"

echo Waiting 3001...
:W3001
timeout /t 1 >nul
netstat -ano | find ":3001" | find "LISTENING" >nul
if %errorlevel%==1 goto W3001


REM ============================================
REM 9) Chrome 2タブ
REM ============================================
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3000?app=A"
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3001?app=B"

echo ============================================
echo        A & B READY (AB MODE)
echo ============================================
pause
