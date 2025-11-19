@echo off
chcp 65001 >nul

echo ============================================
echo     AITuberKit A/B - DEV MODE (No LIVE ID)
echo ============================================

REM ---------------------------------------------------
REM ■ 1) .env.A から Windows USER を取得
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
echo.

REM ---------------------------------------------------
REM ■ Chrome PATH
REM ---------------------------------------------------
set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

REM ---------------------------------------------------
REM ■ 4) A 起動（env.A → localhost:3000）
REM ---------------------------------------------------
echo Starting A...
start "A" cmd /k "npm run dev:A"

echo Waiting for port 3000...
:WAIT_A
timeout /t 1 >nul
netstat -ano | find ":3000" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_A

start "" "%CHROME_PATH%" http://localhost:3000
echo A Ready!
echo.

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

start "" "%CHROME_PATH%" http://localhost:3001
echo B Ready!
echo.

echo ============================================
echo          DEV MODE START COMPLETE
echo ============================================
exit /b
