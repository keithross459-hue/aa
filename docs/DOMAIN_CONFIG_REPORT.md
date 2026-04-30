# Domain Config Report

## Preferred Domain

- `fiilthy.ai`
- Current DNS from this environment: unresolved.
- Vercel attachment: added to `fiilthy-ai-production-frontend`, pending DNS.
- `www.fiilthy.ai`: added to `fiilthy-ai-production-frontend`, pending DNS.

## Recommended DNS

For Vercel frontend:

- Apex `fiilthy.ai`: Vercel requested `A fiilthy.ai 76.76.21.21`.
- `www.fiilthy.ai`: Vercel CLI requested `A www.fiilthy.ai 76.76.21.21`; CNAME to Vercel can also be configured from dashboard if preferred.
- Redirect: `www.fiilthy.ai` -> `fiilthy.ai`.

For Render backend:

- `api.fiilthy.ai`: CNAME to the Render-provided custom-domain target after the Render web service is created.

## Email DNS

For SendGrid/domain sender authentication:

- SPF: include SendGrid in the domain policy.
- DKIM: add SendGrid-provided CNAME records.
- DMARC: start with `v=DMARC1; p=none; rua=mailto:dmarc@fiilthy.ai`, then move to quarantine/reject after monitoring.

## Premium Fallbacks To Check At Registrar

DNS currently has no resolution for these candidates from this environment, but registrar availability must be confirmed before purchase:

- `getfiilthy.ai`
- `fiilthyapp.com`
- `fiilthyhq.com`
- `fiilthy.io`
- `tryfiilthy.com`

## SSL

- Vercel will provision SSL after DNS validates.
- Render will provision SSL for `api.fiilthy.ai` after CNAME validates.
