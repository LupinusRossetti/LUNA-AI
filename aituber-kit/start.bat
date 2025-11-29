@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ============================================
echo      AITuberKit - YouTube Live Mode
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

REM Get live stream ID automatically
echo Getting current live stream ID from YouTube API...
echo.

REM Execute Node.js script to get live stream ID
node scripts/get-live-stream-id.js > temp_result.json 2>temp_error.txt

REM Check if script executed successfully
if not exist "temp_result.json" (
    echo Error: Script execution failed.
    if exist "temp_error.txt" (
        echo Error details:
        type temp_error.txt
    )
    pause
    exit /b 1
)

REM Parse JSON result using Node.js script
node scripts/parse-json-result.js > temp_parsed.txt 2>nul
if exist temp_parsed.txt (
    set line_num=0
    for /f "usebackq tokens=*" %%j in ("temp_parsed.txt") do (
        set /a line_num+=1
        if !line_num!==1 set "LIVE_ID=%%j"
        if !line_num!==2 set "IS_LIVE=%%j"
        if !line_num!==3 set "LATEST_VIDEO_ID=%%j"
        if !line_num!==4 set "CHANNEL_ID=%%j"
    )
    del temp_parsed.txt >nul 2>&1
) else (
    echo Error: Failed to parse JSON result
)

REM Clean up temp files
del temp_result.json >nul 2>&1
del temp_error.txt >nul 2>&1

REM Determine which video ID to use
if "!IS_LIVE!"=="True" (
    echo Currently LIVE! Stream ID: !LIVE_ID!
    if not "!LIVE_ID!"=="" if not "!LIVE_ID!"=="False" if not "!LIVE_ID!"=="True" (
        set "STREAM_ID=!LIVE_ID!"
        set "OPEN_URL=https://www.youtube.com/watch?v=!LIVE_ID!"
    ) else (
        echo Error: LIVE_ID is invalid: !LIVE_ID!
        REM Fallback to LATEST_VIDEO_ID if available
        if not "!LATEST_VIDEO_ID!"=="" if not "!LATEST_VIDEO_ID!"=="False" if not "!LATEST_VIDEO_ID!"=="True" (
            set "STREAM_ID=!LATEST_VIDEO_ID!"
            set "OPEN_URL=https://www.youtube.com/watch?v=!LATEST_VIDEO_ID!"
        ) else (
            set "STREAM_ID="
            set "OPEN_URL=https://studio.youtube.com"
        )
    )
) else (
    echo No active live stream found.
    if not "!LIVE_ID!"=="" if not "!LIVE_ID!"=="False" if not "!LIVE_ID!"=="True" (
        echo Upcoming stream ID: !LIVE_ID!
        set "STREAM_ID=!LIVE_ID!"
        set "OPEN_URL=https://studio.youtube.com/video/!LIVE_ID!/livestreaming"
    ) else if not "!LATEST_VIDEO_ID!"=="" if not "!LATEST_VIDEO_ID!"=="False" if not "!LATEST_VIDEO_ID!"=="True" (
        echo Latest video ID: !LATEST_VIDEO_ID!
        set "STREAM_ID=!LATEST_VIDEO_ID!"
        set "OPEN_URL=https://studio.youtube.com/video/!LATEST_VIDEO_ID!/livestreaming"
    ) else (
        echo No videos found.
        set "STREAM_ID="
        set "OPEN_URL=https://studio.youtube.com"
    )
)

REM Display result
echo.
echo ============================================
echo   Debug Information:
echo   LIVE_ID: !LIVE_ID!
echo   IS_LIVE: !IS_LIVE!
echo   LATEST_VIDEO_ID: !LATEST_VIDEO_ID!
echo   STREAM_ID: !STREAM_ID!
echo   OPEN_URL: !OPEN_URL!
echo ============================================
echo.

REM Update .env file with live stream ID
if not "!STREAM_ID!"=="" (
    echo Updating .env file...
    powershell -Command "$content = Get-Content .env -Raw -Encoding UTF8; if ($content -match 'NEXT_PUBLIC_YOUTUBE_LIVE_ID=') { $content = $content -replace 'NEXT_PUBLIC_YOUTUBE_LIVE_ID=.*', ('NEXT_PUBLIC_YOUTUBE_LIVE_ID=' + '!STREAM_ID!') } else { $content += \"`r`nNEXT_PUBLIC_YOUTUBE_LIVE_ID=!STREAM_ID!`r`n\" }; Set-Content .env -Value $content -NoNewline -Encoding UTF8"
    set "NEXT_PUBLIC_YOUTUBE_LIVE_ID=!STREAM_ID!"
)

REM Chrome URL to save for later use
set "CHROME_URL=!OPEN_URL!"

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
if not "!STREAM_ID!"=="" (
    set NEXT_PUBLIC_YOUTUBE_LIVE_ID=!STREAM_ID!
)

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
if not "!CHROME_URL!"=="" (
    echo Opening URL: !CHROME_URL!
    if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
        start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --new-window --start-maximized "!CHROME_URL!"
    ) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
        start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --new-window --start-maximized "!CHROME_URL!"
    ) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
        start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --new-window --start-maximized "!CHROME_URL!"
    ) else (
        echo Chrome not found. Opening with default browser...
        start "" "!CHROME_URL!"
    )
) else (
    echo Opening localhost:3000...
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
)

echo.
echo AITuberKit is running.
echo Server window is open separately.
echo Press any key to close this window (server will continue running)...
pause >nul
