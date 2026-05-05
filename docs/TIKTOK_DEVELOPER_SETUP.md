# TikTok Developer Setup

Do not commit TikTok client secrets to the repo. Store them only in Render/Vercel environment variables after rotating them.

## Basic Information

App name:
stackdigitz

Category:
Business / Productivity

Description:
Create, publish, and promote digital products with AI-generated launch assets and tracked TikTok content.

Terms of Service URL:
https://fiilthy-ai-production-frontend.vercel.app/terms

Privacy Policy URL:
https://fiilthy-ai-production-frontend.vercel.app/privacy

Platform:
Web

Website URL:
https://fiilthy-ai-production-frontend.vercel.app

## Products To Add

Start with:
- Login Kit
- Share Kit

Only add Content Posting API when the app has a real demo video showing the complete posting flow. Adding scopes you cannot demonstrate will slow review.

## Scopes

For Login Kit:
- user.info.basic

For Share Kit:
- No sensitive posting scope is needed if the app opens TikTok upload and the user posts manually.

For Content Posting API later:
- video.upload
- video.publish

Only request video upload/publish after the upload UI and callback flow are implemented.

## App Review Explanation

Paste this:

FiiLTHY.AI is a web app that helps users create, publish, and promote digital products. A user logs in, creates or selects a digital product, publishes it to a real store such as Gumroad, then uses the TikTok content engine to generate hooks, captions, scripts, visual briefs, hashtags, and tracked CTA links. The TikTok integration is used to let the user connect their TikTok account and share/upload approved promotional content for their own products. The app does not post without user action. The demo shows login, product selection, generated TikTok content, tracked link creation, and the user-controlled upload/share step.

## Demo Video Script

Record a screen video showing:

1. Open https://fiilthy-ai-production-frontend.vercel.app
2. Log in.
3. Open a product.
4. Show the real Gumroad listing.
5. Open the TikTok Content Engine.
6. Copy a generated post with the tracked CTA link.
7. Click Open TikTok upload.
8. Show that the user controls the final upload/post step.

## Important

The app currently supports TikTok content generation, tracked links, and manual upload. Automatic TikTok video-file rendering and auto-posting are not live yet. Do not claim automatic posting in TikTok review until that flow is implemented and demonstrable.
