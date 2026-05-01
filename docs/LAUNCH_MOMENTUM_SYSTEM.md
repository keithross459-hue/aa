# FiiLTHY.AI Launch Momentum System

## Updated Post-Launch UX Flow

1. Product launch completes.
2. Product workspace shows a launch-window banner with a 24-hour countdown.
3. User is pushed into one active step at a time:
   - Step 1: Post your first TikTok.
   - Step 2: Send your product link to 3 people.
   - Step 3: Check your traffic.
4. Compact progress stays visible:
   - Product launched
   - First promotion
   - First click
   - First visitor
   - First sale
5. Feedback copy changes as behavior or tracking changes.
6. If clicks or sales appear, the traction extension appears with next growth actions.

## React Component Structure

- `FirstResultEngine.jsx`
  - Launch window banner and countdown.
  - Step-based action flow.
  - Always-visible progress tracker.
  - Pressure and feedback messaging.
  - Traction extension buttons.

- `ProductDetail.jsx`
  - Primary integration point.
  - Renders Launch Momentum after the store launch section.
  - Anchors traffic and analytics sections for guided step navigation.

- `Dashboard.jsx`
  - Shows launch-window urgency indicators for recently launched products.
  - Adds "launch window" badges inside testing product rows.

## Key UI States

- Inactive
  - Product has not launched.
  - Launch Momentum is hidden.

- Active
  - Product has launched.
  - Countdown is visible.
  - Step 1 is open; later steps are locked.

- Action Taken
  - User copies/posts first TikTok.
  - Feedback: "You’re ahead of most users — keep going."
  - Step 2 unlocks.

- Click Detected
  - Existing analytics show at least one click.
  - Feedback: "You got your first click — momentum started."
  - Traction extension appears.

- Sale Detected
  - Existing analytics show at least one sale.
  - Feedback: "You just made your first sale."
  - Traction extension remains visible.

## UI Copy

- "Your product is in its launch window"
- "Products perform best when promoted immediately."
- "Take action now."
- "No promotion detected yet — most products don’t get traffic without this."
- "You’re ahead of most users — keep going."
- "You got your first click — momentum started."
- "You just made your first sale."
- "This product is gaining traction."

## Minimal Backend Additions

- `Product.launched_at` is now optional and is set when launch succeeds.
- `GET /api/first-result/{product_id}` returns `launched_at`, milestone status, events, posts, and totals.
- `POST /api/first-result/{product_id}/event` accepts `copy_link` in addition to first-promotion actions.

No Gumroad, TikTok, analytics, UTM tracking, sales tracking, or winner detection logic was removed.
