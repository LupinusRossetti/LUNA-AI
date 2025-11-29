@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ============================================
echo      AITuberKit - Development Mode
echo ============================================
echo.

cd /d %~dp0

REM Check if .env file exists
if not exist ".env" (
    echo Error: .env file not found.
    echo Please copy example.env to .env file.
    pause
    exit /b 1
)

REM Clean up ports
echo Killing processes on ports 3000 and 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001"') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

REM Set environment variables
echo Setting DIALOGUE_MODE=true...
set NEXT_PUBLIC_DIALOGUE_MODE=true
set NEXT_PUBLIC_YOUTUBE_MODE=true

echo Starting AivisSpeech server...
if exist "C:\Program Files\AivisSpeech\AivisSpeech.exe" (
    start "AivisSpeech" "C:\Program Files\AivisSpeech\AivisSpeech.exe"
    timeout /t 2 /nobreak >nul
) else if exist "%LOCALAPPDATA%\Programs\AivisSpeech\AivisSpeech.exe" (
    start "AivisSpeech" "%LOCALAPPDATA%\Programs\AivisSpeech\AivisSpeech.exe"
    timeout /t 2 /nobreak >nul
) else (
    echo Warning: AivisSpeech not found. Please start it manually.
)

echo Starting Next.js...
echo.
timeout /t 2 /nobreak >nul

REM Start Next.js in a separate window
start "AITuberKit Server" cmd /k "npm run dev"

REM Wait for server to start
echo Waiting for server to start...
node scripts/wait-for-server.js
if errorlevel 1 (
    echo Error: Server did not start within timeout period.
    pause
    exit /b 1
)

REM Open Chrome after server is ready
echo.
echo Opening Chrome...
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --new-window --start-maximized "http://localhost:3000"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --new-window --start-maximized "http://localhost:3000"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --new-window --start-maximized "http://localhost:3000"
) else (
    echo Chrome not found. Opening with default browser...
    start "" "http://localhost:3000"
)

echo.
echo AITuberKit is running.
echo Server window is open separately.
echo Press any key to close this window (server will continue running)...
pause >nul
