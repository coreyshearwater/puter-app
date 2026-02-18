@echo off
title GravityChat Launcher
echo.
echo   =========================================
echo        --- All Seeing Cat v2.5.3 ---
echo          [ Windows Job Object Mode ]
echo   =========================================
echo.
echo   [1/1] Handing over control to launcher.py...
echo         (This ensures automatic cleanup on exit)
echo.

:: Check if python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not in your PATH.
    echo Please install Python 3.10+ and add it to PATH.
    pause
    exit /b
)

:: Run Electron App (which handles backend processes)
call npm start

echo.
echo   [System] Launcher exited.
pause
