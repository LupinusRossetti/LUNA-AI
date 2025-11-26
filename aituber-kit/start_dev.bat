@echo off
chcp 65001 >nul

echo ============================================
echo      AITuberKit - Simple Dev Mode
echo ============================================
echo.

cd /d %~dp0

echo Starting Next.js...
echo.
start "" "http://localhost:3000"
timeout /t 3 /nobreak >nul
call npm run dev

pause
