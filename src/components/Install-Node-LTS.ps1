# Install-Node-LTS.ps1
# Downloads latest Node LTS MSI and installs silently (x64).
# Usage (recommended): Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File .\Install-Node-LTS.ps1
# The script will re-launch itself elevated if not run as Admin.

function Is-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# If not admin, re-run self elevated
if (-not (Is-Administrator)) {
    Write-Output "Not running as Administrator — attempting to relaunch elevated..."
    $psArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Start-Process -FilePath "powershell" -ArgumentList $psArgs -Verb RunAs
    exit
}

Write-Output "Running as Administrator."

try {
    Write-Output "Fetching Node.js releases index..."
    $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
} catch {
    Write-Error "Failed to fetch Node.js release index: $_"
    exit 1
}

# Choose latest LTS release
$latestLTS = $index | Where-Object { $_.lts -ne $false } | Select-Object -First 1
if (-not $latestLTS) {
    Write-Error "Could not locate an LTS release in index.json."
    exit 1
}

$version = $latestLTS.version  # e.g., "v20.17.0"
Write-Output "Latest LTS found: $version"

# Build MSI URL for 64-bit Windows
$msiFileName = "node-$version-x64.msi"
$msiUrl = "https://nodejs.org/dist/$version/$msiFileName"
$outPath = Join-Path -Path $env:TEMP -ChildPath $msiFileName

Write-Output "Downloading $msiUrl to $outPath..."
try {
    Invoke-WebRequest -Uri $msiUrl -OutFile $outPath -UseBasicParsing -Verbose
} catch {
    Write-Error "Failed to download $msiUrl : $_"
    exit 1
}

# Run MSI silently (/qn = quiet, no UI). Remove /qn to show installer UI.
Write-Output "Running MSI installer (silent). This may take a minute..."
$msiArgs = "/i `"$outPath`" /qn /norestart"
$proc = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -PassThru
if ($proc.ExitCode -ne 0) {
    Write-Warning "msiexec finished with exit code $($proc.ExitCode). If you need the UI installer, re-run the MSI manually: $outPath"
} else {
    Write-Output "msiexec finished successfully (exit code 0)."
}

# Common install path
$possibleNodePaths = @(
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe"
)

$nodeFound = $false
foreach ($p in $possibleNodePaths) {
    if (Test-Path $p) {
        & $p --version
        & (Split-Path $p -Parent + "\npm.cmd") --version 2>$null
        $nodeFound = $true
        break
    }
}

if (-not $nodeFound) {
    Write-Output ""
    Write-Output "Node may have been installed but this shell doesn't see the updated PATH."
    Write-Output "Close and re-open PowerShell / VS Code to pick up PATH changes, then run:"
    Write-Output "  node --version"
    Write-Output "  npm --version"
} else {
    Write-Output ""
    Write-Output "Node appears installed. Verify versions above. You may need to restart terminals for PATH to refresh."
}

Write-Output "Downloaded MSI is at: $outPath"
Write-Output "If you want to remove the MSI, run:"
Write-Output "  Remove-Item -Path `"$outPath`" -Force"

Write-Output "Done."