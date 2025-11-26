@echo off
chcp 65001 >nul

echo ============================================
echo      AITuberKit - Simple Dev Mode
echo ============================================
echo.

cd /d %~dp0

echo Starting Next.js...
echo.
call npm run dev

pause
