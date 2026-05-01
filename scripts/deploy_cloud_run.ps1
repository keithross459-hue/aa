param(
  [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
  [string]$Region = "us-central1",
  [string]$Service = "fiilthy-ai-backend",
  [string]$FrontendUrl = "https://fiilthy-ai-production-frontend.vercel.app",
  [string]$BackendUrl = "https://api.fiilthy.ai",
  [string]$CorsOrigins = "https://fiilthy-ai-production-frontend.vercel.app,https://fiilthy.ai,https://www.fiilthy.ai",
  [switch]$UpdateVercel
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Resolve-Gcloud {
  $cmd = Get-Command gcloud -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "${env:ProgramFiles(x86)}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  return $null
}

$Gcloud = Resolve-Gcloud
if (-not $Gcloud) {
  throw "gcloud CLI is not installed. Install Google Cloud CLI, then run gcloud auth login."
}

if (-not (Test-Path (Join-Path $Root "backend/.env"))) {
  throw "backend/.env is required locally for production env values. It must stay ignored and uncommitted."
}

if (-not $ProjectId) {
  $ProjectId = (& $Gcloud config get-value project 2>$null).Trim()
}
if (-not $ProjectId) {
  throw "ProjectId is required. Pass -ProjectId YOUR_GCP_PROJECT_ID or set GOOGLE_CLOUD_PROJECT."
}

Push-Location $Root
try {
  & $Gcloud config set project $ProjectId | Out-Null
  & $Gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $ProjectId

  $envFile = Join-Path ([System.IO.Path]::GetTempPath()) ("fiilthy-cloudrun-env-" + [System.Guid]::NewGuid().ToString("N") + ".yaml")
  python scripts/write_cloud_run_env.py `
    --source backend/.env `
    --output $envFile `
    --frontend-url $FrontendUrl `
    --backend-url $BackendUrl `
    --cors-origins $CorsOrigins

  try {
    & $Gcloud run deploy $Service `
      --source . `
      --region $Region `
      --allow-unauthenticated `
      --port 8080 `
      --memory 1Gi `
      --cpu 1 `
      --concurrency 20 `
      --min-instances 0 `
      --max-instances 3 `
      --timeout 300 `
      --execution-environment gen2 `
      --env-vars-file $envFile `
      --project $ProjectId
  }
  finally {
    Remove-Item -LiteralPath $envFile -Force -ErrorAction SilentlyContinue
  }

  $serviceUrl = (& $Gcloud run services describe $Service --region $Region --project $ProjectId --format "value(status.url)").Trim()
  Write-Host "Cloud Run backend URL: $serviceUrl"

  python scripts/verify_live.py --backend $serviceUrl --frontend $FrontendUrl

  if ($UpdateVercel) {
    if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
      throw "Vercel CLI not found; cannot update frontend env automatically."
    }
    Push-Location (Join-Path $Root "frontend")
    try {
      & vercel env rm REACT_APP_BACKEND_URL production --yes
      $serviceUrl | & vercel env add REACT_APP_BACKEND_URL production
      & vercel --prod --yes
    }
    finally {
      Pop-Location
    }
  }
}
finally {
  Pop-Location
}
