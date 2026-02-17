$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$pwd\GravityChat.lnk")

# STRICT PORTABLE MODE
$ChromePath = "$pwd\bin\chrome-win\chrome.exe"

if (-not (Test-Path $ChromePath)) {
    Write-Host "[ERROR] Portable Ungoogled Chromium not found!" -ForegroundColor Red
    Write-Host "Please run 'setup_portable.ps1' first."
    exit
}

$Shortcut.TargetPath = $ChromePath
$Shortcut.Arguments = "--app=http://localhost:8000/index.html --start-maximized --user-data-dir=`"$pwd\chrome_data`""
$Shortcut.IconLocation = "$pwd\favicon.ico"
$Shortcut.WorkingDirectory = "$pwd"
$Shortcut.Save()

Write-Host "Shortcut created at $pwd\GravityChat.lnk"
