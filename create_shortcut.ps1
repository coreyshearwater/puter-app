$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$pwd\All Seeing Cat.lnk")
$Shortcut.TargetPath = "$pwd\bin\chrome-win\chrome.exe"
$Shortcut.Arguments = "--app=http://localhost:8000/index.html --start-maximized --user-data-dir=`"$pwd\chrome_data`""
$Shortcut.IconLocation = "$pwd\favicon.ico"
$Shortcut.WorkingDirectory = "$pwd"
$Shortcut.Save()

Write-Host "✨ Shortcut created at $pwd\All Seeing Cat.lnk"
