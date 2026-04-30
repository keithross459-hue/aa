# FiiLTHY.AI — Product Requirements Doc

## Original Problem Statement
GitHub repo: https://github.com/stackdigitz-netizen/april123.git — contained docs/plans for "FiiLTHY.AI" SaaS (no actual app code in the zip). User said *"use best judgment"* then *"I want it to generate digital products, run advertising campaigns for each product, and launch to all stores"*, and finally *"Connect my back end so this thing works"* (supplied real API keys).

## Vision
A creator-economy SaaS that turns a niche idea into a live, sellable digital product with paid-ad creatives ready and listings published on real storefronts — in under two minutes.

## User Personas
- **Hustler creator** — wants to ship 10 niche digital products this month without writing copy or designing creatives.
- **Faceless brand operator** — runs portfolio of niche stores; needs scale-friendly content + ads.
- **Solo agency** — generates client-facing offers + ad packs at speed.

## Core Requirements (static)
1. **AI Product Forge** — niche → full product (title, tagline, audience, price, bullets, outline, sales copy, cover concept).
2. **Per-product Ad Campaign Engine** — 5 platforms (TikTok, Meta, YouTube, Twitter, Pinterest).
3. **Multi-Store Launch** — 7 storefronts; REAL Gumroad publishing, rest simulated.
4. **JWT auth** + **plan-based usage limits** (Free 5 / Starter 50 / Pro 500 / Enterprise unlimited).
5. **Stripe Checkout** for plan upgrades.
6. **Brutalist anti-corporate dark UI**.

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`), MongoDB (Motor), JWT (PyJWT + bcrypt).
  - AI: Emergent LLM → Claude Sonnet 4.5 (emergentintegrations.llm.chat).
  - Payments: emergentintegrations.payments.stripe.checkout.
  - Real integration: Gumroad v2 API (httpx).
- **Frontend**: React 19 + React Router 7 + Tailwind, Lucide icons.
- **All API routes** prefixed `/api`; env-driven (MONGO_URL, DB_NAME, JWT_SECRET, EMERGENT_LLM_KEY, GUMROAD_ACCESS_TOKEN, STRIPE_API_KEY).

## Implemented (Jan 2026)
### Iteration 1 — MVP (21/21 backend, 5/5 frontend smoke)
- Auth: signup / login / me (JWT 30-day, bcrypt).
- Products: generate / list / get / delete (AI via Claude Sonnet 4.5).
- Campaigns: generate (5 platform variants) / list.
- Launch (simulated): 7 synthetic store listings.
- Usage limits: 403 LIMIT_REACHED per plan.
- Frontend pages: Landing, Pricing, Login, Signup, Dashboard, Products, ProductDetail, Campaigns list, Launches list.

### Iteration 2 — Real backend integrations (29/29)
- **REAL Gumroad publishing** — POST /api/launch for `gumroad` store creates a live product on Gumroad (confirmed: e.g. `https://keithster187.gumroad.com/l/xruiq`). Other 6 stores remain simulated.
- **Stripe Checkout** — POST /api/billing/create-checkout returns real Stripe Checkout URL (Starter $29 / Pro $79 / Enterprise $299 one-time).
- **Polling status** — GET /api/billing/status/{session_id} idempotently upgrades plan + resets generations_used. Wrapped in try/except so test-proxy 404s don't surface as 500.
- **Webhook** — POST /api/webhook/stripe handles checkout.session.completed with server-defined webhook_url.
- **Transactions** — payment_transactions collection tracks every session.
- **Billing success page** — /billing/success polls status and refreshes user.
- **CORS** — widened to user's Vercel domains.

### Iteration 3 — Meta Ads (manual bridge) + TikTok Content Engine (15/16)
- **Meta auto-launch on /api/launch** — creates PAUSED Meta campaign + ad set + 3 ads via Graph API v19.0. Currently fails at Graph with `API access blocked` because the user's Meta App is not approved for `ads_management` scope; error is caught and stored in `meta_launches` collection (no crash).
- **POST /api/meta/activate/{product_id}** — flips campaign + ad set + ads to ACTIVE once Meta approves the app.
- **GET /api/meta/export/{product_id}** — manual-launch bridge for Ads Manager paste-in: `{campaign, targeting, creatives[3 w/ recommended flag], product_url}`.
- **POST /api/tiktok/generate/{product_id}** — 5 viral posts via Claude Sonnet 4.5: `hook + 20-40s script + caption + hashtags[8-15] + visual_idea`. Consumes 1 usage.
- **GET /api/tiktok/export/{product_id}** — clean posts list for UI.
- **Auto-TikTok on /api/launch** — 5 posts best-effort, free of usage charge.
- **Frontend Ads Export Panel** — Campaign/Targeting/3 Creatives with Recommended badge, Copy Per Ad, Copy All, Copy Targeting, Copy Link, Open Meta Ads Manager button, "Post 3 videos today → get first sale" CTA.
- **Frontend TikTok Panel** — Generate/Regenerate button, per-post Copy, Best Pick badge, hook/script/caption/hashtags/visual split view.

### Iteration 4 — Tracking + Winner Detection (19/19)
- **tracking_events collection** — `{product_id, source:tiktok|meta, content_id, event_type:click|sale, value, created_at}`.
- **POST /api/track/click** / **/api/track/sale** — auth'd event writers; sale increments `product.revenue` + `sales_count` and recomputes `product.winners`.
- **GET /api/track/go** (PUBLIC) — paste-in-bio redirector: records click, 302s to product URL with `?utm_source=&utm_campaign=&utm_content=` appended (preserves existing query strings).
- **GET /api/analytics/{product_id}** — `{totals, performance[per source:content_id], winners[], rules}`.
- **Winner rules** — (clicks >= 20 AND conv >= 2%) OR revenue >= $50. Both rules independently verified.
- **tiktok/export + meta/export** now return `content_id` + `tracking_url` per item.
- **Frontend AnalyticsPanel** — totals tiles + per-content table with Winner badge, polls every 10s.

## Integrations Status
| Service | Status | Notes |
|---|---|---|
| Emergent LLM (Claude Sonnet 4.5) | LIVE | All AI generation |
| Gumroad | LIVE | Real product publishing via access token |
| Stripe Checkout | LIVE (pod test key `sk_test_emergent`) | Swap to user's `sk_live_...` for prod |
| MongoDB | LOCAL (preview) | User's Atlas URL saved for prod swap |
| Stan Store / Whop / Payhip / Etsy / Stripe Link / Shopify | SIMULATED | URLs are synthetic `*.fiilthy.ai` |
| Meta / Instagram / TikTok / YouTube / ElevenLabs / SendGrid | STORED not wired | Tokens saved for future posting feature |

## MOCKED / Deferred
- **6 of 7 storefronts are SIMULATED** — only Gumroad is real.
- **Organic post scheduler** (TikTok/IG/YT posting) — not implemented.
- **Paid ad campaign auto-launch** (actually running on Meta/TikTok ad accounts) — generates creative only.
- **Cover image generation** (Gemini Nano Banana) — not wired.
- **Analytics** — not implemented.

## Backlog (P0 → P2)
- **P0** Real Stan Store / Whop integration (user's next most-used).
- **P0** For prod: swap `STRIPE_API_KEY` to `sk_live_...` and verify status retrieval; swap `MONGO_URL` to Atlas.
- **P1** Cover image generation via Gemini Nano Banana.
- **P1** Organic post scheduler + actual posting via Meta/TikTok APIs (tokens already stored).
- **P1** Actually launch generated ad creatives to Meta Ads Manager (token + ad account id available).
- **P2** Analytics dashboard (views/clicks/conversions).
- **P2** Modularize `server.py` (~730 lines) into routers.
- **P2** Rate limit on auth; roll back usage on LLM failure.
- **P2** Email notifications via SendGrid on product launch.

## Next Tasks
1. Wire real Stan Store / Whop publishing (P0).
2. Add cover image generation via Gemini Nano Banana (P1).
3. Real Meta Ads campaign launch from generated creatives (P1).

---

## Iteration 5 — Bring-Your-Own-Credentials + Downloads (Apr 30, 2026)

### New features
- **Per-user Integrations Hub** — `/app/settings` page lets each user save their own API credentials for 13 providers (Gumroad, Stan Store, Whop, Payhip, Shopify, Stripe, Meta, TikTok, Instagram, Twitter, YouTube, OpenAI, Anthropic). All secret fields encrypted at rest with Fernet (`SETTINGS_ENC_KEY` in backend .env, derived via SHA-256). Non-secret IDs (pixel_id, ad_account_id, etc.) stored plain.
- **Product downloads** — every generated product can be exported as:
  - **PDF** (`GET /api/products/{id}/download/pdf`) — typeset cover + overview + bullet features + outline + sales copy + cover concept using reportlab.
  - **Bundle ZIP** (`GET /api/products/{id}/download/bundle`) — product.pdf, product.md, ad_campaigns.md, tiktok_posts.md, sales_copy.txt.
  - **Whole library** (`GET /api/products/download/all`) — every product in a single `filthy-library.zip` with subfolders.
- **Real store integrations expanded** — `/api/launch` now uses per-user creds for Gumroad, Stan Store, Whop, Payhip. Unconfigured real-capable stores return status=`NOT_CONFIGURED` with an instructive error (no more silent placeholder URLs). Stripe checkout also uses per-user `secret_key` when present.
- **Credential test endpoint** — `POST /api/settings/test/{provider}` does a live HTTP verification call for Gumroad, Meta, Stripe; for others returns `{ok:true, note:"..."}`.
- **Stats API extended** — `/api/stats` now returns `integrations_configured` / `integrations_total` counts to power the "connect your stores" dashboard CTA.

### Backend files added
- `/app/backend/integrations/settings.py` — encryption helpers, provider schema, prepare/decrypt/redact.
- `/app/backend/integrations/downloads.py` — PDF + ZIP builders.
- `/app/backend/integrations/stores.py` — Stan Store, Whop, Payhip REST integrations.

### Frontend files added
- `/app/frontend/src/pages/Settings.jsx` — full Integrations Hub UI (save / test / clear per provider).
- AppLayout sidebar + Dashboard CTA updated.
- ProductDetail header now has **Download PDF** + **Full Bundle (.zip)** buttons.
- Products list now has a **Download all (.zip)** button.

### Testing
- Backend regression (testing subagent, iteration_1.json): **24/24 green** — covering auth, settings CRUD, encryption/redaction, downloads (valid PDF + ZIP magic bytes + 5-file bundle), campaign + launch + NOT_CONFIGURED fallback, stats integration counts.

## Backlog (updated)
- **P0** Real Meta ads publish path still requires user's Meta App to be approved for ads_management — unchanged.
- **P1** Stan / Whop / Payhip publish paths only validated structurally; needs a live token to confirm end-to-end.
- **P1** Add Stripe webhook secret per-user (current webhook handler still falls back to env; non-critical — polling `/api/billing/status` is authoritative).
- **P2** Split `server.py` (now ~1500 lines) into routers.
- **P2** `/api/products/download/all` rebuilds PDFs synchronously — move to streaming for large libraries.
