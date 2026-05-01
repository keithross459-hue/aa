# FiiLTHY.AI Guided Digital Product Business Builder

## Updated UX Flow

1. Niche and direction selection
   - Ask for niche, buyer, product type, style, and mode.
   - Show realistic winning directions with price range, promise, and reason it could work.
   - User chooses one direction before generation.

2. Product builder
   - Generate title, tagline, description, cover concept, contents, value bullets, sales copy, and price.
   - User can edit the product before publishing.
   - Saved edits use `PATCH /api/products/{id}` and do not remove existing automation.

3. Confidence layer
   - Show why the product could work, trend signal, and suggested price.
   - Keep the product framed as a business decision, not an invisible AI output.

4. Launch phase
   - Existing launch endpoint remains the publishing path.
   - UI confirms: "Your product is now live and ready to make sales."

5. Visible content engine
   - TikTok posts are shown as traffic assets.
   - User can select and edit hooks, scripts, captions, and visual ideas before copying/posting.

6. Live dashboard
   - Dashboard is now a business control panel.
   - It separates winning products, testing products, and drafts.
   - It surfaces products created, tracked clicks, sales, and winners.

7. Loop system
   - Build -> Launch -> Promote -> Track -> Improve appears on dashboard and product workspace.

## Component Breakdown

- `Dashboard.jsx`: Business control panel, loop overview, product status columns.
- `Products.jsx`: Guided builder flow, examples, confidence layer, mode selector.
- `ProductDetail.jsx`: Editable product workspace, launch, campaign generation, analytics, traffic tools.
- `TikTokPanel.jsx`: Editable/selectable TikTok traffic engine.
- `AppLayout.jsx`: Navigation language updated from generator/machine framing to builder/auto mode.

## Key Screens

- Dashboard: "Your digital product business" with product status and next actions.
- Builder: Guided decision flow with niche, type, style, examples, confidence, and draft creation.
- Product workspace: Product preview, editable offer, confidence layer, Gumroad/store launch, ads, TikTok, analytics.
- Traffic engine: Selected post workflow with editable content before copying.

## Conversion Copy

- "Build a sellable product"
- "Make the key choices, review the offer, launch it, then feed the traffic system."
- "Pick a winning direction"
- "Review and launch"
- "Your product is now live and ready to make sales."
- "Track what is turning into money"
- "Testing products become winners through tracking"

## Backend-Safe Improvements

- Existing generation, Gumroad publishing, TikTok generation, Meta export, tracking, and winner detection remain intact.
- Only additive backend change: product update endpoint for user-approved edits before launch.
- Auto Mode is presented as an optional mode without replacing Guided Mode.
