# FiiLTHY.AI Signal & Proof Engine

## UX Flow For Signal Checks

1. User takes a promotion action:
   - Copy Post
   - I posted it
   - Copy Link
2. The frontend stores the current click and sale totals.
3. The UI immediately shows "Checking for activity..."
4. About 45 seconds later, the frontend refreshes `GET /api/first-result/{product_id}`.
5. If clicks or sales moved, the UI maps the signal back to the action:
   - "Your TikTok post is driving traffic."
   - "Link clicks detected from your promotion."
   - "Sale detected from your promotion."
6. If no movement appears:
   - "No traffic yet - try another post."

## React Component Updates

- `FirstResultEngine.jsx`
  - Adds action-triggered signal checks.
  - Adds a Signal Check panel under the launch-window feedback message.
  - Adds a Proof Layer beside live progress.
  - Uses existing totals from the first-result endpoint.

- `ProductDetail.jsx`
  - Adds `SignalProofStrip`, a compact sticky live signal module.
  - Shows viewed, clicked, and sales counts near the top of the product workspace.
  - Keeps stats contextual with copy like "Link clicks detected from your promotion."

## Timing Logic

- Frontend-based only.
- Signal checks run after action events.
- Default delay: 45 seconds.
- Existing polling remains at 10 seconds for near-real-time updates.

## UI Copy Examples

- "Checking for activity..."
- "Someone viewed your product."
- "Your TikTok post is driving traffic."
- "Link clicks detected from your promotion."
- "Good sign - traffic is coming in. Keep pushing."
- "Traffic starts with action - post again to get visibility."
- "You're ahead of most users - momentum matters."

## Backend Usage

No new backend system was added. The Signal & Proof Engine reuses:

- `GET /api/first-result/{product_id}`
- `POST /api/first-result/{product_id}/event`
- Existing `tracking_events` analytics for clicks, visitors, sales, and revenue.
