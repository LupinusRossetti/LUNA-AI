@echo off
chcp 65001 >nul

echo ==============================
echo    AITuberKit - AB Launcher
echo ==============================

REM --------------------------------------------
REM 1) .env.A から Windows USER を取得
REM --------------------------------------------
set WINDOWS_USER=
for /f "tokens=2 delims==" %%U in ('findstr /r "^WINDOWS_USER=" .env.A') do set WINDOWS_USER=%%U

if "%WINDOWS_USER%"=="" (
    echo ERROR: .env.A に WINDOWS_USER がありません
    pause
    exit /b
)

echo Using Windows User: %WINDOWS_USER%
echo.


REM --------------------------------------------
REM 2) python/.env から PROMPT_FILE_A/B を取得
REM --------------------------------------------
set PROMPT_FILE_A=
set PROMPT_FILE_B=

for /f "tokens=2 delims==" %%U in ('findstr /r "^PROMPT_FILE_A=" C:\LUNA-AI\python\.env') do set PROMPT_FILE_A=%%U
for /f "tokens=2 delims==" %%U in ('findstr /r "^PROMPT_FILE_B=" C:\LUNA-AI\python\.env') do set PROMPT_FILE_B=%%U

echo Prompt A: %PROMPT_FILE_A%
echo Prompt B: %PROMPT_FILE_B%
echo.


REM --------------------------------------------
REM 3) 古い Node / Python / WS を殺す
REM --------------------------------------------
echo Killing old servers...

for %%p in (3000 3001 8000) do (
    for /f "tokens=5" %%q in ('netstat -ano ^| find ":%%p" ^| find "LISTENING"') do taskkill /PID %%q /F >nul 2>&1
)

echo Killed old ports.
echo.


REM --------------------------------------------
REM 4) AivisSpeech 起動
REM --------------------------------------------
echo Starting AivisSpeech...
start "" "C:\Users\%WINDOWS_USER%\AppData\Local\Programs\AivisSpeech\AivisSpeech.exe"
timeout /t 3 >nul


REM --------------------------------------------
REM 5) simple_ws_server 起動
REM --------------------------------------------
echo Starting simple_ws_server.py...
start "WS_SERVER" cmd /k "cd C:\LUNA-AI\python && python simple_ws_server.py"


REM --------------------------------------------
REM 6) characterA.py（wsAB）
REM --------------------------------------------
echo Starting CharacterA (AB mode)...
start "CHARACTER_A" cmd /k ^
"cd C:\LUNA-AI\python && ^
 set PROMPT_FILE=%PROMPT_FILE_A% && ^
 set WS_URL=ws://localhost:8000/wsAB && ^
 python characterA.py"


REM --------------------------------------------
REM 7) characterB.py（wsAB）
REM --------------------------------------------
echo Starting CharacterB (AB mode)...
start "CHARACTER_B" cmd /k ^
"cd C:\LUNA-AI\python && ^
 set PROMPT_FILE=%PROMPT_FILE_B% && ^
 set WS_URL=ws://localhost:8000/wsAB && ^
 python characterB.py"


REM --------------------------------------------
REM 8) AITuberKit A & B 同時起動
REM --------------------------------------------
echo Starting AITuberKit A (port 3000)...
start "AITuberKit_A" cmd /k "set APP_MODE=A && npm run dev:A"

echo Starting AITuberKit B (port 3001)...
start "AITuberKit_B" cmd /k "set APP_MODE=B && npm run dev:B"


REM --------------------------------------------
REM 9) A/B ポートの起動待ち
REM --------------------------------------------
echo Waiting for port 3000...
:WAIT_A
timeout /t 1 >nul
netstat -ano | find ":3000" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_A

echo Waiting for port 3001...
:WAIT_B
timeout /t 1 >nul
netstat -ano | find ":3001" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_B


REM --------------------------------------------
REM 10) Chrome を 2タブ開く（A と B）
REM --------------------------------------------
echo Opening Chrome tabs...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3000 http://localhost:3001


echo.
echo ========== ALL STARTED ==========
echo   AB 掛け合いモード 起動完了！
echo =================================


REM --------------------------------------------
REM 11) すべて最小化（Chrome除く）
REM --------------------------------------------
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
