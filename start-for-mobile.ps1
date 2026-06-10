# ============================================================
# KisaanConnect - Mobile-Ready Server Launcher v2.0 (ASCII Safe)
# Run this ONCE as Administrator for firewall rule.
# ============================================================

$PORT = 3000

Write-Host ""
Write-Host "+--------------------------------------------------+"
Write-Host "|     KisaanConnect - Mobile Server Launcher       |"
Write-Host "+--------------------------------------------------+"
Write-Host ""

# -- Step 1: Add Windows Firewall rule (requires admin) ----------------------
$ruleName = "KisaanConnect-Node-$PORT"
$existingRule = netsh advfirewall firewall show rule name=$ruleName 2>&1
if ($existingRule -match "No rules match") {
    Write-Host "[Firewall] Adding Windows Firewall rule for port $PORT..." -ForegroundColor Yellow
    $result = netsh advfirewall firewall add rule name=$ruleName dir=in action=allow protocol=TCP localport=$PORT profile=any description="Allow KisaanConnect Node.js server for mobile access" 2>&1

    if ($result -match "requires elevation") {
        Write-Host "[Warning] Firewall rule needs Admin rights." -ForegroundColor Red
        Write-Host "   -> Right-click this file -> 'Run as Administrator'" -ForegroundColor Yellow
        Write-Host "   -> OR: Windows will prompt you - click YES" -ForegroundColor Yellow
        Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile", "-NonInteractive", "-Command", "netsh advfirewall firewall add rule name='$ruleName' dir=in action=allow protocol=TCP localport=$PORT profile=any description='KisaanConnect mobile access'" -Wait -ErrorAction SilentlyContinue
    } else {
        Write-Host "[Success] Firewall rule added!" -ForegroundColor Green
    }
} else {
    Write-Host "[Success] Firewall rule already exists." -ForegroundColor Green
}

# -- Step 2: Get the real Wi-Fi IP (skip VirtualBox/Hyper-V) -----------------
$virtualKeywords = @("virtualbox", "hyper-v", "vmware", "vethernet", "loopback", "bluetooth")
$allAdapters = Get-NetIPAddress -AddressFamily IPv4

$wifiAdapters = [System.Collections.Generic.List[PSObject]]::new()
foreach ($adapter in $allAdapters) {
    $alias = $adapter.InterfaceAlias.ToLower()
    $isReal = $true
    foreach ($kw in $virtualKeywords) {
        if ($alias.Contains($kw)) {
            $isReal = $false
            break
        }
    }
    $ipStr = $adapter.IPAddress
    $isLAN = ($ipStr -match "^192\.168\." -or $ipStr -match "^10\." -or $ipStr -match "^172\.(1[6-9]|2[0-9]|3[01])\.")
    if ($isReal -and $isLAN) {
        $wifiAdapters.Add($adapter)
    }
}

if ($wifiAdapters.Count -gt 0) {
    $wifiAdapters = $wifiAdapters | Sort-Object {
        $alias = $_.InterfaceAlias.ToLower()
        if ($alias -match "wi-fi|wlan|wireless") { 0 } else { 1 }
    }
}

$ip = $null
if ($wifiAdapters.Count -gt 0) {
    $ip = $wifiAdapters[0].IPAddress
}

Write-Host ""
if ($ip) {
    Write-Host "+--------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "|  [Mobile] OPEN THIS ON YOUR MOBILE BROWSER:       |" -ForegroundColor Cyan
    Write-Host "|                                                  |" -ForegroundColor Cyan
    Write-Host ("|  http://{0}:{1}" -f $ip, $PORT) -ForegroundColor White -BackgroundColor DarkBlue
    Write-Host "|                                                  |" -ForegroundColor Cyan
    Write-Host "|  [Note] PC and phone must be on the SAME Wi-Fi!  |" -ForegroundColor Cyan
    Write-Host "+--------------------------------------------------+" -ForegroundColor Cyan
} else {
    Write-Host "[Warning] Could not detect Wi-Fi IP. Check your network connection." -ForegroundColor Red
    Write-Host "   Run 'ipconfig' and find your Wi-Fi IPv4 address manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[Network] All detected LAN IPs:" -ForegroundColor DarkGray
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notmatch "^127\." } |
    ForEach-Object { Write-Host "   $($_.InterfaceAlias): $($_.IPAddress)" -ForegroundColor DarkGray }

Write-Host ""
Write-Host "[Server] Starting KisaanConnect Server..." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

# -- Step 3: Sync HTML files to Android assets (if project exists) ------------
$assetsPath = ".\app\src\main\assets"
if (Test-Path $assetsPath) {
    Write-Host "[Sync] Syncing HTML files to Android assets..." -ForegroundColor Cyan
    $files = @("index.html","farmer-dashboard.html","customer-dashboard.html",
               "admin-dashboard.html","admin-login.html","kisaan-network.js",
               "sw.js","manifest.json","logo.png")
    foreach ($f in $files) {
        if (Test-Path $f) {
            Copy-Item -Path $f -Destination $assetsPath -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "[Sync] Assets synced to Android app!" -ForegroundColor Green
    Write-Host ""
}

# -- Step 4: Start the server -------------------------------------------------
node server.js
