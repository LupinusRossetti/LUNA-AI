@echo off
chcp 65001 >nul

echo ==============================
echo     AITuberKit - B 単体起動
echo ==============================

REM ---------------------------------------------------
REM ■ 1) .env.B から Windows USER を取得
REM ---------------------------------------------------
set WINDOWS_USER=
for /f "tokens=2 delims==" %%U in ('findstr /r "^WINDOWS_USER=" .env.B') do set WINDOWS_USER=%%U

if "%WINDOWS_USER%"=="" (
    echo ERROR: .env.B に WINDOWS_USER がありません
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
REM ■ Chrome PATH
REM ---------------------------------------------------
set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

REM ---------------------------------------------------
REM ■ 5) B 起動（env.B → localhost:3001）
REM ---------------------------------------------------
echo Starting B...
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
REM ■ 6) YouTube Studio & 視聴ページ を開く
REM ---------------------------------------------------
start "" "%CHROME_PATH%" https://studio.youtube.com/video/%LIVEID%/livestreaming
start "" "%CHROME_PATH%" https://www.youtube.com/watch?v=%LIVEID%
echo.

echo ==============================
echo     B 単体起動 完了！
echo ==============================
exit /b
