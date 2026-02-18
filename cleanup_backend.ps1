# Cleanup Script for GravityChat Backend
# Targets: Specific Python scripts and Playwright-managed Chrome instances

$ErrorActionPreference = "SilentlyContinue"

Write-Host "🧹 Starting GravityChat Backend Cleanup..." -ForegroundColor Cyan

# 1. Kill Python processes running our scripts
$py_targets = @('api_server.py', 'grok_driver.py', 'edge_tts_server.py', 'debug_server.py', 'local_llm_server.py')
$py_procs = Get-CimInstance Win32_Process -Filter "Name = 'python.exe'"

foreach ($p in $py_procs) {
    if ($null -eq $p.CommandLine) { continue }
    
    foreach ($t in $py_targets) {
        if ($p.CommandLine -match $t) {
            Write-Host "   -> Killing Python [$t] (PID: $($p.ProcessId))" -ForegroundColor Yellow
            Stop-Process -Id $p.ProcessId -Force
        }
    }
}

# 2. Kill Playwright Chrome Instances
# We identify them by the 'user-data-dir' pointing to our specific 'playwright_profile' folder
# OR containing 'headless' if we want to be aggressive (but let's Stick to the profile for safety)
# Command line usually contains: ...chrome.exe ... --user-data-dir=.../playwright_profile ...

$chrome_procs = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'"
$killed_chrome = 0

foreach ($c in $chrome_procs) {
    if ($null -eq $c.CommandLine) { continue }
    
    # Check for our specific profile path
    if ($c.CommandLine -match "playwright_profile") {
        Write-Host "   -> Killing Zombie Chrome (PID: $($c.ProcessId))" -ForegroundColor Red
        Stop-Process -Id $c.ProcessId -Force
        $killed_chrome++
    }
}

if ($killed_chrome -eq 0) {
    Write-Host "   [Info] No zombie Chrome instances found." -ForegroundColor Gray
}

# 3. Port Sweep: Kill anything holding our ports (Critical for dead uvicorn workers)
$ports = @(8001, 8002, 8003, 6969, 5050)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        if ($conn.OwningProcess -ne 0) {
            Write-Host "   -> Killing PID $($conn.OwningProcess) on Port $port" -ForegroundColor Red
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "✅ Cleanup Complete." -ForegroundColor Green
Start-Sleep -Seconds 1
