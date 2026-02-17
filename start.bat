@echo off
title GravityChat Server
echo ==========================================
echo       --- Starting GravityChat v2.4.1 ---
echo         [ Grok 4.20 / Expert Mode ]
echo ==========================================
echo.

:: Kill potential zombies from failed exe
taskkill /F /IM GravityChat.exe >nul 2>&1
:: taskkill /F /IM python.exe >nul 2>&1

:: STRICT PORTABLE MODE
set "CHROME_PATH="
if exist "%~dp0bin\chrome-win\chrome.exe" set "CHROME_PATH=%~dp0bin\chrome-win\chrome.exe"

if not defined CHROME_PATH (
    echo [INFO] Portable Ungoogled Chromium not found.
    echo.
    echo       Downloading and installing bundled browser...
    echo       This may take a few minutes depending on your connection.
    echo.
    
    powershell -ExecutionPolicy Bypass -File setup_portable.ps1
    
    :: Re-check after install
    if exist "%~dp0bin\chrome-win\chrome.exe" set "CHROME_PATH=%~dp0bin\chrome-win\chrome.exe"
)

if not defined CHROME_PATH (
    echo [ERROR] Browser setup failed or was cancelled.
    echo       Cannot start GravityChat without the bundled browser.
    echo.
    pause
    exit /b 1
)

echo [1/4] Starting Grok API Bridge...
if exist "Grok-Api-main\venv\Scripts\python.exe" (
    powershell -Command "Start-Process 'Grok-Api-main\venv\Scripts\python.exe' -ArgumentList 'api_server.py' -WorkingDirectory 'Grok-Api-main' -NoNewWindow"
    echo       [OK] Grok Bridge starting in background...
) else (
    echo       [WARN] Grok venv not found.
)

echo [2/4] Starting Edge TTS Bridge...
if exist "edge_tts_venv\Scripts\python.exe" (
    powershell -Command "Start-Process 'edge_tts_venv\Scripts\python.exe' -ArgumentList 'edge_tts_server.py' -NoNewWindow"
    echo       [OK] Edge TTS Bridge starting in background...
) else (
    echo       [WARN] Edge TTS venv not found.
)

echo [3/4] Starting local Debug server...
if exist "debug_server.py" (
    :: Run in background so we can continue the script to launch browser
    start /b python debug_server.py
    echo       [OK] Debug Server starting...
) else (
    echo       [WARN] debug_server.py not found.
)

echo.
echo [4/4] Warming up engines (3s)...
timeout /t 3 /nobreak >nul

if defined CHROME_PATH (
    echo [HOT] Launching App Mode...
    
    :: Create/Update shortcut
    powershell -ExecutionPolicy Bypass -File create_shortcut.ps1
    
    :: Launch
    start "" "GravityChat.lnk"
)

echo.
echo ======================================================
echo   READY! All logs are streaming below.
echo   Do not close this window while using the app.
echo ======================================================
echo.

:: Keep window open and show logs
:: This also allows the user to press a key to clean up and exit
pause

:: Cleanup background bridges on exit
echo [System] Shutting down bridges...
taskkill /F /IM python.exe >nul 2>&1
