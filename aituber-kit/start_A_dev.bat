@echo off
chcp 65001 >nul

echo ==============================
echo     AITuberKit - A DEV MODE
echo ==============================

REM ============================================
REM 1) .env.A から WINDOWS_USER を取得
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
REM 2) python/.env から PROMPT_FILE_A を取得
REM ============================================
set PROMPT_FILE=
for /f "tokens=2 delims==" %%U in ('findstr /r "^PROMPT_FILE_A=" C:\LUNA-AI\python\.env') do set PROMPT_FILE=%%U

if "%PROMPT_FILE%"=="" (
    echo ERROR: python/.env に PROMPT_FILE_A がありません
    pause
    exit /b
)

echo Using Prompt File: %PROMPT_FILE%
echo.

REM ============================================
REM 3) 古い Node / Python / WS を kill
REM ============================================
echo Killing ports 3000, 3001, 8765 ...
for %%p in (3000 3001 8765) do (
    for /f "tokens=5" %%q in ('netstat -ano ^| find ":%%p" ^| find "LISTENING"') do taskkill /PID %%q /F >nul 2>&1
)
echo Done.
echo.

REM ============================================
REM 4) simple_ws_server.py が起動中かチェック
REM ============================================
echo Checking WebSocket server (8765)...

netstat -ano | find ":8765" | find "LISTENING" >nul
if %errorlevel%==0 (
    echo simple_ws_server.py は既に起動しています
) else (
    echo simple_ws_server.py を起動します…
    start "WS_SERVER" cmd /k "cd C:\LUNA-AI\python && python simple_ws_server.py"
    timeout /t 2 >nul
)
echo.

REM ============================================
REM 5) AivisSpeech 起動
REM ============================================
echo Starting AivisSpeech...
start "" "C:\Users\%WINDOWS_USER%\AppData\Local\Programs\AivisSpeech\AivisSpeech.exe"
timeout /t 2 >nul
echo.

REM ============================================
REM 6) CharacterA.py 起動
REM ============================================
echo Starting CharacterA agent...
start "CHARA_A" cmd /k "cd C:\LUNA-AI\python && set PROMPT_FILE=%PROMPT_FILE% && python characterA.py"
echo.

REM ============================================
REM 7) AItuberKit 起動 (npm run dev:A)
REM ============================================
echo Starting AITuberKit (A)...
start "AITuberKit_A" cmd /k "npm run dev:A"

echo Waiting for port 3000...
:WAIT_A
timeout /t 1 >nul
netstat -ano | find ":3000" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_A

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3000?app=A"

echo A 起動完了！
echo.

REM ============================================
REM 8) Chrome 以外を最小化
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
