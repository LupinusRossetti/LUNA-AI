@echo off
chcp 65001 >nul
title AITuberKit Orchestrator

:MENU
cls
echo =====================================
echo      AITuberKit - Orchestrator
echo =====================================
echo.
echo   1. Character A モード
echo   2. Character B モード
echo   3. 掛け合い AB モード
echo   4. 終了
echo.
set /p choice="番号を選んでください: "

if "%choice%"=="1" goto START_A
if "%choice%"=="2" goto START_B
if "%choice%"=="3" goto START_AB
if "%choice%"=="4" goto END
goto MENU


:START_A
echo 起動: Character A モード...
call start_A_dev.bat
goto END

:START_B
echo 起動: Character B モード...
call start_B_dev.bat
goto END

:START_AB
echo 起動: 掛け合い AB モード...
call start_AB_dev.bat
goto END

:END
echo 終了します。
timeout /t 1 >nul
exit /b
