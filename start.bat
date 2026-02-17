@echo off
title GravityChat Server
echo ==========================================
echo       --- Starting GravityChat v2.3.1 ---
echo ==========================================
echo.

:: Kill potential zombies from failed exe
taskkill /F /IM GravityChat.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1

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

echo [1/3] Launching App Mode...
if defined CHROME_PATH (
    echo       Found Chrome! Opening via Shortcut...
    
    :: Create/Update shortcut first to ensure path/icon is correct
    powershell -ExecutionPolicy Bypass -File create_shortcut.ps1
    
    :: Launch the shortcut
    start "" "GravityChat.lnk"
)

echo [2/3] Starting Grok API Bridge...
if exist "Grok-Api-main\venv\Scripts\python.exe" (
    if exist "Grok-Api-main\api_server.py" (
        start /min "Grok API" cmd /c "cd Grok-Api-main && .\venv\Scripts\python api_server.py"
    ) else (
        echo       [WARN] api_server.py not found in Grok-Api-main\
    )
) else (
    echo       [WARN] Grok venv not found. Grok models will be unavailable.
)

echo [3/3] Starting local Debug server...
echo       Do not close this window while using the app!
echo.
if exist "debug_server.py" (
    python debug_server.py
) else (
    echo       [WARN] debug_server.py not found. Debug logging unavailable.
)
pause
