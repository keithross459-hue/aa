# FiiLTHY.AI Clarity-First Onboarding

## Simplified Onboarding Flow

1. Choose niche
   - User sees one input and one primary button: "Start here".
   - Optional settings are hidden.

2. Build product
   - Product is created from the niche.
   - This is the first meaningful action.

3. Launch
   - After product creation, the only visible next step is "Launch now".
   - Advanced growth systems stay out of the way until after first action.

## First Meaningful Action

Primary FMA:

- `product_created`

Secondary milestones after FMA:

- `product_launched`
- `first_tiktok_copied`
- `first_click`
- `first_sale`

## Minimal Key Screens

- Builder first run
  - Step 1: Choose niche
  - Step 2: Build product
  - Step 3: Launch
  - One field, one CTA, optional settings hidden.

- Dashboard
  - Active product
  - Next recommended action
  - First result progress
  - Lightweight live stats only.

- Product detail
  - Launch remains the next major step after product creation.
  - Momentum, proof, sharing, and monetization remain post-action systems.

## Drop-Off Tracking Strategy

Frontend-only tracking uses `frontend/src/lib/onboardingTelemetry.js`.

Captured events:

- `onboarding_step_viewed`
- `onboarding_step_left`
- `onboarding_hesitation`
- `onboarding_dropoff_risk`
- `primary_cta_clicked`
- `first_action_started`
- `first_meaningful_action_completed`

Signals produced:

- "Users stop at niche selection" when `onboarding_hesitation` fires on `choose_niche`.
- "Users do not click launch button" when product exists but no launch milestone follows.
- "Users ignore TikTok step" when launch exists but first-promotion milestone remains false.

Events are sent to PostHog when configured and mirrored to `localStorage.fiilthy_onboarding_events` for lightweight inspection.

## Before / After

Before:

- Dashboard showed products, clicks, sales, winners, launch windows, sharing, upgrade prompts, and product columns.
- Builder showed niche, audience, type, style, mode, price, notes, examples, confidence, and library.

After:

- First-run builder asks only for niche.
- Dashboard shows one active product and one next action.
- Advanced decisions are hidden behind "Optional settings" or delayed until after first action.

## Critical Copy Improvements

- "Start here"
- "Launch now"
- "Get your first result"
- "Choose a niche"
- "One product. One next action. No extra noise."
- "Everything else can wait."
