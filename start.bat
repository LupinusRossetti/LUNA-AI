@echo off
echo =====================================
echo  AITuberKit - Iris → Fiona 同時起動
echo =====================================

echo ▼ Iris 起動中...
start "Iris" cmd /k "npm run dev:iris"

echo ▼ Iris の起動を待機（3000 LISTENING）...
:WAIT_IRIS
timeout /t 1 >nul
netstat -ano | find ":3000" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_IRIS

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3000

echo Iris OK！
echo.

timeout /t 3 >nul

echo ▼ Fiona 起動中...
start "Fiona" cmd /k "npm run dev:fiona"

echo ▼ Fiona の起動を待機（3001 LISTENING）...
:WAIT_FIONA
timeout /t 1 >nul
netstat -ano | find ":3001" | find "LISTENING" >nul
if %errorlevel%==1 goto WAIT_FIONA

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3001

echo Fiona OK！
echo =====================================
exit
