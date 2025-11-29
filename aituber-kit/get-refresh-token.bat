@echo off
chcp 65001 >nul

echo ============================================
echo   YouTube OAuth2 Refresh Token取得
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

REM Check if CLIENT_ID and CLIENT_SECRET are set
echo Checking .env file...
echo.

REM Execute Node.js script to get refresh token
echo Starting refresh token acquisition process...
echo.
echo Please follow these steps:
echo   1. A browser window will open with the authentication URL
echo   2. Sign in with your Google account
echo   3. Grant permissions
echo   4. After authentication, return to this window
echo.
echo Press any key to continue...
pause >nul

node scripts/get-refresh-token.js

if errorlevel 1 (
    echo.
    echo Error: Failed to get refresh token.
    echo Please check:
    echo   1. CLIENT_ID is set in .env
    echo   2. CLIENT_SECRET is set in .env
    echo   3. Node.js is installed and accessible
    echo   4. Port 8080 is not in use
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Refresh Token acquisition completed!
echo ============================================
echo.
echo The REFRESH_TOKEN has been saved to .env file.
echo You can now use start.bat to start the application.
echo.
pause


