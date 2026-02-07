@echo off
title GravityChat Server
echo ==========================================
echo       🚀 Starting GravityChat v1.0 🚀
echo ==========================================
echo.

:: Try to find Chrome
set "CHROME_PATH="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

echo [1/2] Launching App Mode...
if defined CHROME_PATH (
    echo       Found Chrome! Opening in App Mode...
    start "" "%CHROME_PATH%" --app=http://localhost:8000/index.html
) else (
    echo       Chrome not found at standard paths. Trying system default...
    :: If chrome is in PATH, this might work as app mode, otherwise just opens tab
    start chrome --app=http://localhost:8000/index.html || start "" "http://localhost:8000/index.html"
)

echo [2/2] Starting local Python server...
echo       Do not close this window while using the app!
echo.
python -m http.server 8000
pause
