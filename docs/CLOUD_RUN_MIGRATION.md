# Cloud Run Backend Migration

## Target

- Service: `fiilthy-ai-backend`
- Region: `us-central1`
- Runtime: Dockerized FastAPI on Cloud Run
- Free-stable posture: request-based billing, `min-instances=0`, `max-instances=3`
- Frontend remains on Vercel.
- MongoDB remains external.

## Why Cloud Run

Cloud Run has an official free tier for request-based services. It can scale to zero and wake on HTTP traffic, which makes it a better free backend target than Render Free for a production-adjacent launch. A Google Cloud billing account is still required.

## Files Added

- `Dockerfile`
- `.dockerignore`
- `.gcloudignore`
- `scripts/write_cloud_run_env.py`
- `scripts/deploy_cloud_run.ps1`

## Deploy

After installing Google Cloud CLI and authenticating:

```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
.\scripts\deploy_cloud_run.ps1 -ProjectId YOUR_PROJECT_ID -UpdateVercel
```

The script:

- Enables Cloud Run, Cloud Build, and Artifact Registry APIs.
- Builds from the existing repo using the root Dockerfile.
- Reads production values from ignored `backend/.env`.
- Deploys with restricted CORS.
- Verifies public backend routes.
- Optionally updates Vercel `REACT_APP_BACKEND_URL` and redeploys frontend.

## DNS After Deploy

For branded launch, map:

- `api.fiilthy.ai` -> Cloud Run custom domain mapping, or keep using the Cloud Run service URL until DNS is ready.
- `fiilthy.ai` and `www.fiilthy.ai` -> Vercel.

## Cost Guardrails

- `min-instances=0` keeps idle cost near zero.
- `max-instances=3` limits traffic spikes.
- `concurrency=20` reduces instance count.
- `timeout=300` supports AI and billing flows without keeping instances alive forever.

Set a Google Cloud budget alert before launch.
