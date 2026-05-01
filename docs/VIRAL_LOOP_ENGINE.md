# FiiLTHY.AI Viral Loop Engine

## UX Flow For Sharing And Remix

1. User gets traction:
   - First click
   - First visitor
   - First sale
2. First Result Engine shows a success share moment:
   - "You're getting results - share this"
   - Shareable result card
   - Prewritten caption
   - Copy share button
3. Promotion content can include a subtle watermark:
   - "Built with FiiLTHY.AI"
   - Enabled by default, user-controlled.
4. Product workspace and traction cards offer:
   - "Remix this product"
   - "Launch 5 similar products"
   - "Create more content like this"
5. Remix Mode opens the builder with source niche, product type, price, and outline prefilled.
6. When traction exists, referral momentum appears:
   - "Want to scale this faster?"
   - Copy invite link
   - Open invite system

## React Components

- `FirstResultEngine.jsx`
  - Success share card after click/sale milestones.
  - Watermark toggle on copied TikTok content.
  - Referral momentum card when traction exists.
  - Remix links for similar product loops.

- `ProductDetail.jsx`
  - Adds "Remix this product" as a primary product action.

- `Products.jsx`
  - Reads `?remix={product_id}` and preloads builder fields.
  - Supports `?batch=5` for similar-product launch prompts.

- `Dashboard.jsx`
  - Shows result highlights for products with sales/winner signals.
  - Allows copying share copy and entering Remix Mode.

## Copywriting Examples

- "You're getting results - share this"
- "First sale landed. Built, launched, and promoted with FiiLTHY.AI."
- "Launch momentum is real. Built with FiiLTHY.AI."
- "Remix this product"
- "Want to scale this faster?"
- "Invite a builder. More people using your link means more loops, more tests, and more chances to spot winners."

## Backend Additions

No new backend system was required. This reuses:

- Product detail endpoint for remix preload.
- Existing first-result milestones and totals.
- Existing referral endpoint `GET /api/referrals/me`.
