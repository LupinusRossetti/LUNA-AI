@echo off
chcp 65001 >nul

echo ==============================
echo     AITuberKit - A Launcher
echo ==============================


REM ============================================
REM 1) .env.A から Windows USER を取得
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
REM 2) python/.env から PROMPT_FILE_A を読込
REM ============================================
set PROMPT_FILE=

for /f "tokens=2 delims==" %%U in ('findstr /r "^PROMPT_FILE_A=" C:\LUNA-AI\python\.env') do set PROMPT_FILE=%%U

if "%PROMPT_FILE%"=="" (
    echo ERROR: python/.env に PROMPT_FILE_A がありません。
    pause
    exit /b
)

echo Using Prompt File: %PROMPT_FILE%
echo.


REM ============================================
REM 3) 古い Node / Python / WS を殺す
REM ============================================
echo Killing old servers...

for %%p in (3000 3001 8000) do (
    for /f "tokens=5" %%q in ('netstat -ano ^| find ":%%p" ^| find "LISTENING"') do taskkill /PID %%q /F >nul 2>&1
)

echo Killed old ports.
echo.


REM ============================================
REM 4) AivisSpeech 起動
REM ============================================
echo Starting AivisSpeech...
start "" "C:\Users\%WINDOWS_USER%\AppData\Local\Programs\AivisSpeech\AivisSpeech.exe"
timeout /t 3 >nul


REM ============================================
REM 5) simple_ws_server 起動（通常モード）
REM ============================================
echo Starting simple_ws_server.py...
start "WS_SERVER" cmd /k "cd C:\LUNA-AI\python && python simple_ws_server.py"


REM ============================================
REM 6) characterA.py 起動（wsA）
REM ============================================
echo Starting CharacterA agent...
start "CHARACTER_A" cmd /k ^
"cd C:\LUNA-AI\python && ^
 set PROMPT_FILE=%PROMPT_FILE% && ^
 set WS_URL=ws://localhost:8000/wsA && ^
 python characterA.py"


REM ============================================
REM 7) AITuberKit 起動 (dev:A)
REM ============================================
set APP_MODE=A

echo Starting AITuberKit (dev:A)...
start "AITuberKit_A" cmd /k "set APP_MODE=A && npm run dev"

echo Waiting for port 3000...
:WAIT_A
timeout /t 1 >nul
netstat -ano | find ":3000" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_A

echo Opening Chrome...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3000

echo.
echo ========== ALL STARTED ==========
echo   AITuberKit (A) 起動完了！
echo =================================


REM ============================================
REM 8) すべてのウィンドウを最小化（Chrome除く）
REM ============================================
timeout /t 2 >nul

powershell -command "
$chrome = 'chrome.exe'
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
