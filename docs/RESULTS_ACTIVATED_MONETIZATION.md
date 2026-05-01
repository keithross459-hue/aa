# FiiLTHY.AI Results-Activated Monetization

## Monetization UX Flow

1. User starts free.
   - Manual builder and launch flow.
   - Basic TikTok content.
   - First result tracking.
   - No card required.

2. User gets proof.
   - First click.
   - First sale.
   - Winner signal.

3. Upgrade prompt appears at the moment of belief.
   - "This is working - scale it"
   - Shows speed, remixing, and batch launch value.

4. User tries a scale action.
   - Batch launch.
   - Five similar products.
   - More advanced remixing.
   - More content variations.

5. Prompt points to existing pricing/checkout.

## Paywall Trigger Points

- First click or first sale inside `FirstResultEngine.jsx`.
- Winning/result products inside `Dashboard.jsx`.
- Batch remix route: `/app/products?remix={id}&batch=5`.
- Existing generation limit errors in `Products.jsx` and `ProductDetail.jsx`.

## UI Copy

- "This is working - scale it"
- "You have proof now. Upgrade for faster loops, more launches, and more variations while momentum is warm."
- "Turn this signal into more products"
- "Batch product launches are for paid plans so your best signals can become a portfolio faster."
- "You used the free launch fuel. Upgrade when you want more speed, more remixes, and more launch attempts."

## React Component Structure

- `ScaleUpgradePrompt.jsx`
  - Reusable monetization prompt.
  - Supports `traction`, `winner`, `batch`, and `limit` triggers.

- `FirstResultEngine.jsx`
  - Shows scale prompt after traction/sale.

- `Dashboard.jsx`
  - Shows scale prompt below result highlights.

- `Products.jsx`
  - Shows batch prompt when free users enter batch Remix Mode.
  - Shows limit prompt when existing backend usage limit is reached.

- `ProductDetail.jsx`
  - Shows limit prompt when campaign/content generation hits existing backend limits.

- `Pricing.jsx`
  - Reframed around speed, scale, loops, and momentum.

## Pricing Model

- Monthly subscription remains the primary model.
- Optional usage-based scaling can be layered onto enterprise/CEO plan later for high-volume launches.

## Minimal Backend Changes

No backend rebuild was needed. The system reuses:

- Existing `plan`, `generations_used`, and `plan_limit`.
- Existing `LIMIT_REACHED` backend response.
- Existing Stripe checkout and billing routes.
- Existing tracking data to determine belief moments.
