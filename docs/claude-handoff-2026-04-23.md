# Claude Handoff - 2026-04-23

## Scope

This handoff covers the new `social.outlawapps.online` app plus the related `outlawapps.online` hub updates made during this run.

## Repos

- `C:\Users\User\OneDrive\Documents\AI Projects\outlaw-social`
- `C:\Users\User\OneDrive\Documents\AI Projects\outlawapps-online`

## Production URLs

- Social app: `https://social.outlawapps.online`
- Hub: `https://outlawapps.online`

## Latest checked-in state

### `outlaw-social`

Latest commits on `main`:

1. `4cd1fff` - `Extend daily chart hover attribution`
2. `0a0fb76` - `Align chart hovers with displayed totals`
3. `cfa46be` - `Improve Instagram location and chart hover context`
4. `bcc3d0d` - `Refine Instagram visuals and platform tabs`
5. `f0925d1` - `Add platform tabs and deeper social breakdowns`

Latest production deploy:

- Deployment id: `dpl_AzEefa3wiGztShHxUEYPUv7cxGXz`
- Preview URL from deploy: `https://outlaw-social-8mjbtuymu-johnnyoutlawllc-1540s-projects.vercel.app`
- Production alias: `https://outlaw-social.vercel.app`

### `outlawapps-online`

Relevant commits on `main`:

1. `cba9d5c` - `Refine hub card order and social analytics icon`
2. `c1465cd` - `Add social analytics app card`

## What was implemented

### Auth and shell app

Files:

- `app/login/page.tsx`
- `app/page.tsx`
- `app/api/auth/callback/route.ts`
- `app/api/auth/signout/route.ts`
- `middleware.ts`
- `lib/allowed-users.ts`

Behavior:

- Google login gates the app.
- Only these emails are allowed:
  - `johnnyoutlawllc@gmail.com`
  - `bigsky30media@gmail.com`
- Anonymous access redirects to `/login`.

### Dashboard

Primary files:

- `app/api/dashboard/route.ts`
- `app/dashboard/page.tsx`

Current dashboard behavior:

- `All Platforms` is an overview tab only.
- `Facebook`, `Instagram`, and `TikTok` each have their own detail tab.
- Summary tiles include mini performance charts.
- Follower trend charts support `Include 0` vs `Zoom`.
- Detailed line charts have x/y axis labels.
- Summary sparklines now also render minimal x/y axes.

### Instagram work

- Missing top-post thumbnails were mostly fixed by preferring `thumbnail_url` over `media_url`.
- Some IG rows still have no stored thumbnail and no permalink in `outlaw_data`; those now render a branded fallback tile.
- `Content mix` is a donut chart.
- `Instagram audience location` is now split into:
  - country distribution
  - city distribution
  - embedded OpenStreetMap regional map with bubble overlay
- `Audience profile` is shown as percentage bars.
- `Recent post performance` was removed from the IG detail view.

### Daily chart tooltip pattern

Applied to:

- Instagram `Daily reach`
- Facebook `Daily reach`
- Facebook `Daily reactions`
- TikTok `Daily views`
- TikTok `Daily likes`

Behavior:

- Hover detail rows now reconcile to the chart total shown for that day.
- The tooltip shows an allocated breakdown of the chart value across the top contributing posts/videos for that day.

Important caveat:

- Instagram does **not** currently expose per-post reach in this dataset. The chart total is account-level reach from `instagram_insights`, while post-level data comes from `instagram_media_insights` (`likes`, `comments`, `saved`, `shares` only). The tooltip therefore uses an estimated allocation model so the rows add up to the chart total.
- Facebook page totals are also not perfectly 1:1 with per-post metrics, so the same allocation pattern is used there.
- TikTok is closest to direct attribution because both the chart and hover are built from per-video daily snapshot deltas.

## Data sources in `outlaw_data`

### Facebook

- `facebook_page_history`
- `facebook_page_insights`
- `facebook_post_metrics`
- `facebook_posts`

### Instagram

- `instagram_account_history`
- `instagram_insights`
- `instagram_demographics`
- `instagram_media`
- `instagram_media_insights`

### TikTok

- `tiktok_account_history`
- `tiktok_accounts`
- `tiktok_videos`
- `tiktok_video_snapshots`

## API payload notes

`app/api/dashboard/route.ts` now returns extra platform-level fields beyond the original stats/groups/topPosts:

- `contentMix`
- `topCities`
- `audience`
- `activityDrivers`
- `secondaryActivityDrivers`

These are consumed directly by `app/dashboard/page.tsx`.

## Current limitations / caveats

1. The IG map uses an OpenStreetMap embed plus overlayed markers. It is intentionally visual, not a true GIS control.
2. Some IG post rows in `outlaw_data.instagram_media` have no thumbnail, no `media_url`, and no permalink. Those cannot be regenerated from current stored data alone.
3. TikTok follower history is still sparse because `tiktok_account_history` is thin. The current follower chart uses what exists plus the latest `tiktok_accounts` snapshot fallback.
4. The social app still contains hardcoded `OUTLAW_DATA_URL` and anon key in `app/api/dashboard/route.ts`. That is functional, but moving them to env would be cleaner.

## Likely next tasks for Claude

1. Tighten the chart hover model if Johnny wants a less estimated tooltip language.
2. Backfill or regenerate missing IG thumbnails if there is an external source of media/permalink data.
3. Add better geospatial handling for the IG location view if a true map library or static tile service is desired.
4. Add more dashboard slices once Johnny decides what other Big Sky 30 metrics matter.
5. Move Outlaw Data Supabase connection config into environment variables.

## Related hub work

In `outlawapps-online`:

- `src/app/page.tsx`
- `public/images/social-analytics-icon.svg`

Hub changes already live:

- New `Social Analytics` card points to `https://social.outlawapps.online`
- `Church St Studio` moved to the bottom row
- `Page last updated` moved into the footer
- Social Analytics got a custom icon aligned to the existing card set

## Verification performed

In `outlaw-social`:

- `npm run build` passed after each major change set
- production was redeployed multiple times, latest deploy is the one listed above
- public route checks confirmed the app resolves on the live domain

At the end of this handoff:

- `outlaw-social` working tree is clean
- `outlawapps-online` working tree is clean

