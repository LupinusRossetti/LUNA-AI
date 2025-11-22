@echo off
chcp 65001 >nul

echo ==============================
echo     AITuberKit - B Launcher
echo ==============================


REM ============================================
REM 1) .env.B から Windows USER を取得
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
REM 2) python/.env から PROMPT_FILE_B を読込
REM ============================================
set PROMPT_FILE=

for /f "tokens=2 delims==" %%U in ('findstr /r "^PROMPT_FILE_B=" C:\LUNA-AI\python\.env') do set PROMPT_FILE=%%U

if "%PROMPT_FILE%"=="" (
    echo ERROR: python/.env に PROMPT_FILE_B がありません。
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
REM 5) simple_ws_server 起動
REM ============================================
echo Starting simple_ws_server.py...
start "WS_SERVER" cmd /k "cd C:\LUNA-AI\python && python simple_ws_server.py"


REM ============================================
REM 6) characterB.py 起動（wsB）
REM ============================================
echo Starting CharacterB agent...
start "CHARACTER_B" cmd /k ^
"cd C:\LUNA-AI\python && ^
 set PROMPT_FILE=%PROMPT_FILE% && ^
 set WS_URL=ws://localhost:8000/wsB && ^
 python characterB.py"


REM ============================================
REM 7) AITuberKit 起動 (dev:B)
REM ============================================
set APP_MODE=B

echo Starting AITuberKit (dev:B)...
start "AITuberKit_B" cmd /k "set APP_MODE=B && npm run dev"

echo Waiting for port 3001...
:WAIT_B
timeout /t 1 >nul
netstat -ano | find ":3001" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_B

echo Opening Chrome...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3001

echo.
echo ========== ALL STARTED ==========
echo   AITuberKit (B) 起動完了！
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
