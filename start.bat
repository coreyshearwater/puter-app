@echo off
title GravityChat Server
echo ==========================================
echo       🚀 Starting GravityChat v1.0 🚀
echo ==========================================
echo.
echo [1/2] Opening browser to http://localhost:8000/index.html...
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000/index.html"

echo [2/2] Starting local Python server...
echo       Do not close this window while using the app!
echo.
python -m http.server 8000
pause
