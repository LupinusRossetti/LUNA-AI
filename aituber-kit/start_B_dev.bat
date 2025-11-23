@echo off
chcp 65001 >nul

echo ==============================
echo     AITuberKit - B DEV MODE
echo ==============================

REM ============================================
REM 1) .env.B から WINDOWS_USER
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
REM 2) python/.env から PROMPT_FILE_B
REM ============================================
set PROMPT_FILE=
for /f "tokens=2 delims==" %%U in ('findstr /r "^PROMPT_FILE_B=" C:\LUNA-AI\python\.env') do set PROMPT_FILE=%%U

if "%PROMPT_FILE%"=="" (
    echo ERROR: python/.env に PROMPT_FILE_B がありません
    pause
    exit /b
)

echo Using Prompt File: %PROMPT_FILE%
echo.

REM ============================================
REM 3) PORT kill
REM ============================================
echo Killing ports 3000, 3001, 8765 ...
for %%p in (3000 3001 8765) do (
    for /f "tokens=5" %%q in ('netstat -ano ^| find ":%%p" ^| find "LISTENING"') do taskkill /PID %%q /F >nul 2>&1
)
echo.

REM ============================================
REM 4) simple_ws_server 起動チェック
REM ============================================
echo Checking WebSocket server (8765)...
netstat -ano | find ":8765" | find "LISTENING" >nul
if %errorlevel%==0 (
    echo simple_ws_server.py は既に起動中
) else (
    echo simple_ws_server.py を起動します…
    start "WS_SERVER" cmd /k "cd C:\LUNA-AI\python && python simple_ws_server.py"
    timeout /t 2 >nul
)
echo.

REM ============================================
REM 5) AivisSpeech
REM ============================================
echo Starting AivisSpeech...
start "" "C:\Users\%WINDOWS_USER%\AppData\Local\Programs\AivisSpeech\AivisSpeech.exe"
timeout /t 2 >nul
echo.

REM ============================================
REM 6) CharacterB.py
REM ============================================
echo Starting CharacterB agent...
start "CHARA_B" cmd /k "cd C:\LUNA-AI\python && set PROMPT_FILE=%PROMPT_FILE% && python characterB.py"
echo.

REM ============================================
REM 7) AItuberKit dev:B
REM ============================================
echo Starting AITuberKit (B)...
start "AITuberKit_B" cmd /k "npm run dev:B"

echo Waiting for port 3001...
:WAIT_B
timeout /t 1 >nul
netstat -ano | find ":3001" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_B

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3001?app=B"

echo B 起動完了！
echo.

REM ============================================
REM 8) Chrome 以外最小化
REM ============================================
timeout /t 2 >nul

powershell -command "
$windows = (New-Object -ComObject Shell.Application).Windows()
$wshell = New-Object -ComObject wscript.shell
foreach ($w in $windows) {
    if ($w.FullName -notlike '*chrome.exe') {
        $wshell.AppActivate($w.HWND)
        $wshell.SendKeys('% n')
    }
}
"

exit /b
