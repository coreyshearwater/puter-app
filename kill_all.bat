@echo off
title GravityChat Force Cleanup
echo.
echo   =============================================
echo      GravityChat Force Cleanup / Kill Switch
echo   =============================================
echo.
echo   This will forcibly terminate:
echo    - Python (Backend services)
echo    - Chrome (Automated instances only)
echo.
powershell -ExecutionPolicy Bypass -File cleanup_backend.ps1
echo.
pause
