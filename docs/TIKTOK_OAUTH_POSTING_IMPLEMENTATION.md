# TikTok OAuth + Posting Integration

Implemented in the existing FiiLTHY FastAPI backend and React frontend.

## Backend Routes

All routes are under the existing `/api` prefix:

- `GET /api/auth/tiktok/login`
- `GET /api/auth/tiktok/callback`
- `GET /api/auth/tiktok/status`
- `POST /api/post/tiktok`
- `GET /api/post/tiktok`
- `POST /api/disconnect/tiktok`
- `DELETE /api/disconnect/tiktok`

## Environment Variables

```txt
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
TIKTOK_REDIRECT_URI=https://fiilthy-ai-production-backend.onrender.com/api/auth/tiktok/callback
TIKTOK_SCOPES=user.info.basic,video.upload,video.publish
TIKTOK_MAX_UPLOAD_BYTES=67108864
ENABLE_TIKTOK_SCHEDULER=true
TIKTOK_SCHEDULER_INTERVAL_SECONDS=60
```

TikTok redirect URI to register:

```txt
https://fiilthy-ai-production-backend.onrender.com/api/auth/tiktok/callback
```

Temporary no-DNS callback alias also exists:

```txt
https://fiilthy-ai-production-backend.onrender.com/api/social/tiktok/callback
```

Use the Render default URL until `api.fiilthy.ai` DNS is live.

## Official TikTok APIs Used

- OAuth authorize URL: `https://www.tiktok.com/v2/auth/authorize/`
- Token exchange / refresh: `https://open.tiktokapis.com/v2/oauth/token/`
- Token revoke: `https://open.tiktokapis.com/v2/oauth/revoke/`
- User info: `https://open.tiktokapis.com/v2/user/info/`
- Inbox upload: `https://open.tiktokapis.com/v2/post/publish/inbox/video/init/`
- Direct post: `https://open.tiktokapis.com/v2/post/publish/video/init/`

## Frontend

Settings now includes:

- Connect TikTok button
- Connected profile/status
- Disconnect button
- Video upload form
- Caption + hashtags
- Direct post / inbox upload mode
- Schedule time
- Recent post job status

## Example API Requests

Start OAuth:

```bash
curl -H "Authorization: Bearer USER_JWT" \
  https://fiilthy-ai-production-backend.onrender.com/api/auth/tiktok/login
```

Upload immediately:

```bash
curl -X POST \
  -H "Authorization: Bearer USER_JWT" \
  -F "video=@demo.mp4" \
  -F "caption=My product is live" \
  -F "hashtags=digitalproducts launch" \
  -F "mode=direct" \
  -F "privacy_level=SELF_ONLY" \
  https://fiilthy-ai-production-backend.onrender.com/api/post/tiktok
```

Schedule:

```bash
curl -X POST \
  -H "Authorization: Bearer USER_JWT" \
  -F "video=@demo.mp4" \
  -F "caption=Scheduled product promo" \
  -F "hashtags=digitalproducts launch" \
  -F "schedule_at=2026-05-05T18:00:00-07:00" \
  https://fiilthy-ai-production-backend.onrender.com/api/post/tiktok
```

Disconnect:

```bash
curl -X DELETE \
  -H "Authorization: Bearer USER_JWT" \
  https://fiilthy-ai-production-backend.onrender.com/api/disconnect/tiktok
```

## Notes

- Tokens are encrypted before database storage.
- Scheduled videos are stored on the backend local filesystem. For stronger production durability, move scheduled media to object storage such as S3, Cloudflare R2, or Vercel Blob.
- TikTok may restrict unaudited direct posts to private visibility until app review is complete.
- The app must be approved for `video.upload` and/or `video.publish` before those scopes work for normal users.
- Only official TikTok APIs are used. No scraping or browser automation is used.
