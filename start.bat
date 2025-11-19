@echo off
chcp 65001 >nul

echo ============================================
echo     AITuberKit A/B + AivisSpeech + LIVE ID
echo ============================================

REM ---------------------------------------------------
REM ■ 1) .env.A / .env.B から Windows ユーザー名取得
REM ---------------------------------------------------
set WINDOWS_USER=
for /f "tokens=2 delims==" %%U in ('findstr /r "^WINDOWS_USER=" .env.A') do set WINDOWS_USER=%%U

if "%WINDOWS_USER%"=="" (
    echo ERROR: .env.A に WINDOWS_USER がありません
    pause
    exit /b
)

echo Using Windows User: %WINDOWS_USER%
echo.

REM ---------------------------------------------------
REM ■ 2) Node ports kill
REM ---------------------------------------------------
echo Killing old node servers (3000 / 3001)...
for /f "tokens=5" %%p in ('netstat -ano ^| find ":3000" ^| find "LISTENING"') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| find ":3001" ^| find "LISTENING"') do taskkill /PID %%p /F >nul 2>&1

echo.

REM ---------------------------------------------------
REM ■ 3) AivisSpeech 起動
REM ---------------------------------------------------
echo Starting AivisSpeech...
start "" "C:\Users\%WINDOWS_USER%\AppData\Local\Programs\AivisSpeech\AivisSpeech.exe"
timeout /t 3 >nul
echo AivisSpeech OK
echo.

REM ---------------------------------------------------
REM ■ 4) YouTube LIVE ID 取得
REM ---------------------------------------------------
echo Fetching YouTube LIVE ID...
for /f %%i in ('python start_youtube_ai.py') do set LIVEID=%%i

if "%LIVEID%"=="" (
    echo ERROR: LIVE ID 取得失敗
    pause
    exit /b
)

echo LIVE ID = %LIVEID%
echo.

REM ---------------------------------------------------
REM ■ Chrome PATH（環境により修正可）
REM ---------------------------------------------------
set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

REM ---------------------------------------------------
REM ■ 5) A（env.A）起動 → ポート 3000 待機 → Chrome で開く
REM ---------------------------------------------------
echo ▼ Starting A (env.A)...
start "A" cmd /k "npm run dev:A"

echo Waiting for port 3000...
:WAIT_A
timeout /t 1 >nul
netstat -ano | find ":3000" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_A

echo A is Ready!
start "" "%CHROME_PATH%" http://localhost:3000
echo.

REM ---------------------------------------------------
REM ■ 6) B（env.B）起動 → ポート 3001 待機 → Chrome で開く
REM ---------------------------------------------------
echo ▼ Starting B (env.B)...
start "B" cmd /k "npm run dev:B"

echo Waiting for port 3001...
:WAIT_B
timeout /t 1 >nul
netstat -ano | find ":3001" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_B

echo B is Ready!
start "" "%CHROME_PATH%" http://localhost:3001
echo.

REM ---------------------------------------------------
REM ■ 7) YouTube 配信画面（Studio）と（視聴画面）を Chrome で開く
REM ---------------------------------------------------
echo Opening YouTube Studio LIVE dashboard...
start "" "%CHROME_PATH%" https://studio.youtube.com/video/%LIVEID%/livestreaming
start "" "%CHROME_PATH%" https://www.youtube.com/watch?v=%LIVEID%
echo.

echo ============================================
echo            All systems started!
echo ============================================
exit /b
