<#
.SYNOPSIS
Downloads and installs Ungoogled Chromium for strictly portable use.

.DESCRIPTION
Fetches the latest release from ungoogled-software/ungoogled-chromium-windows,
extracts it to 'bin\chrome-win', and ensures the app uses ONLY this version.
#>

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BinDir = Join-Path $ScriptDir "bin"
$ChromeDir = Join-Path $BinDir "chrome-win"

# 1. Prepare Directory
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir | Out-Null
    Write-Host "Created bin directory." -ForegroundColor Cyan
}

if (Test-Path $ChromeDir) {
    Write-Host "Portable Chrome already exists at $ChromeDir" -ForegroundColor Yellow
    $Response = Read-Host "Do you want to reinstall/update it? (y/n)"
    if ($Response -ne 'y') {
        exit
    }
    Remove-Item -Recurse -Force $ChromeDir
}

# 2. Find Latest Release (GitHub API)
Write-Host "Fetching latest Ungoogled Chromium release info..." -ForegroundColor Cyan
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

try {
    # Fetch recent releases (up to 5) to find one with a valid asset
    $ApiUrl = "https://api.github.com/repos/ungoogled-software/ungoogled-chromium-windows/releases?per_page=5"
    $Releases = Invoke-RestMethod -Uri $ApiUrl
    
    $Asset = $null
    $SelectedRelease = $null

    foreach ($Release in $Releases) {
        # Look for the .zip (not .exe installer) for x64
        # Pattern matches ..._windows_x64.zip or ..._windows_x64_fixed.zip etc
        $PotentialAsset = $Release.assets | Where-Object { $_.name -like "*windows_x64*.zip" } | Select-Object -First 1
        
        if ($PotentialAsset) {
            $Asset = $PotentialAsset
            $SelectedRelease = $Release
            break
        }
    }
    
    if (-not $Asset) {
        throw "Could not find a windows_x64 zip asset in the last 5 releases."
    }
    
    Write-Host "Found version: $($SelectedRelease.tag_name)" -ForegroundColor Green
    Write-Host "Asset: $($Asset.name)" -ForegroundColor Gray
    
    $DownloadUrl = $Asset.browser_download_url
} catch {
    Write-Error "Failed to fetch release info from GitHub. $_"
    exit 1
}

# 3. Download
$ZipPath = Join-Path $BinDir "chrome_portable.zip"
Write-Host "Downloading Ungoogled Chromium..." -ForegroundColor Cyan
Write-Host "URL: $DownloadUrl" -ForegroundColor DarkGray
Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath

# 4. Extract
Write-Host "Extracting..." -ForegroundColor Cyan
Expand-Archive -LiteralPath $ZipPath -DestinationPath $BinDir -Force

# 5. Rename/Move
# The zip usually contains a folder like 'ungoogled-chromium_133.0.6943.127-1.1_windows_x64'
# We need to move its contents to 'chrome-win'
$ExtractedSubDir = Get-ChildItem -Path $BinDir -Directory | Where-Object { $_.Name -like "ungoogled-chromium*" } | Select-Object -First 1

if ($ExtractedSubDir) {
    Rename-Item -Path $ExtractedSubDir.FullName -NewName "chrome-win"
    Write-Host "Renamed $($ExtractedSubDir.Name) to chrome-win" -ForegroundColor Cyan
} else {
    Write-Warning "Could not identify extracted folder. You may need to rename it manually to 'chrome-win'."
}

# 6. Cleanup
if (Test-Path $ZipPath) { Remove-Item $ZipPath }

Write-Host "`n✅ STRICT PORTABLE MODE READY" -ForegroundColor Green
Write-Host "Browser: $ChromeDir\chrome.exe"
Write-Host "App will now REFUSE to launch unless this specific browser is present."
