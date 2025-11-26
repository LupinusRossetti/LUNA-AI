@echo off
chcp 65001 >nul

echo ============================================
echo      AITuberKit - Simple Dev Mode (Duet)
echo ============================================
echo.

cd /d %~dp0

echo Killing processes on ports 3000 and 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001"') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo Setting DIALOGUE_MODE=true...
set NEXT_PUBLIC_DIALOGUE_MODE=true

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
start "" "http://localhost:3000"
timeout /t 3 /nobreak >nul
call npm run dev

pause
