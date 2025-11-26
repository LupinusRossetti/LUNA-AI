@echo off
chcp 65001 >nul

echo ============================================
echo      AITuberKit - Simple Dev Mode (Duet)
echo ============================================
echo.

cd /d %~dp0

echo Setting DIALOGUE_MODE=true...
set NEXT_PUBLIC_DIALOGUE_MODE=true

echo Starting Next.js...
echo.
start "" "http://localhost:3000"
timeout /t 3 /nobreak >nul
call npm run dev

pause
