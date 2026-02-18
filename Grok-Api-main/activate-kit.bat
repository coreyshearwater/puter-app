@echo off
setlocal
echo ==========================================
echo        ANTIGRAVITY KIT INITIALIZER
echo ==========================================
echo.
echo Initializing in: %CD%
echo.

:: Run the init command via npx
:: --force ensures it overwrites/updates correctly
call npx -y @vudovn/ag-kit init --force

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [+] Successfully initialized Antigravity Kit!
    echo.
    :: Show status to confirm
    call npx @vudovn/ag-kit status
) else (
    echo.
    echo [!] Error: Initialization failed.
    echo.
    echo Make sure Node.js and npm are installed and available in your PATH.
)

echo.
echo Press any key to exit...
pause > nul
