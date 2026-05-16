param(
  [string]$Flyctl = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Fly-io.flyctl_Microsoft.Winget.Source_8wekyb3d8bbwe\flyctl.exe",
  [string]$App = "fiilthy-ai-production-backend"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot "backend\.env"

if (!(Test-Path $Flyctl)) {
  $cmd = Get-Command flyctl -ErrorAction SilentlyContinue
  if ($cmd) {
    $Flyctl = $cmd.Source
  } else {
    throw "flyctl was not found. Install it, then rerun this script."
  }
}

Push-Location $repoRoot
try {
  & $Flyctl auth whoami | Out-Host

  if (Test-Path $envFile) {
    Write-Host "Importing Fly secrets from backend\.env..."
    Get-Content $envFile | & $Flyctl secrets import --app $App
  } else {
    Write-Warning "backend\.env was not found; skipping secret import."
  }

  & $Flyctl deploy --app $App --remote-only
} finally {
  Pop-Location
}
