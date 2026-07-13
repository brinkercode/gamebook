---
name: steam-store-page
description: Steam store page + submission prep — copy structure, asset checklist, review-process timeline (dual Valve review, 2-week Coming Soon minimum), Deck Verified expectations. For release-manager and community-writer seats.
version: 1.0
---

# Steam Store Page

## When to use

`release-wave` / `cert-preflight-wave` store prep, or any time the user asks for store copy.

## The hard constraints (from Steamworks docs — plan around them)

1. **Two independent Valve reviews**, store page and game build, each **3–5 business days**.
2. **Coming Soon page must be live ≥2 weeks before release** — the page ships long before gold.
3. Content Survey (Steam's own) is mandatory before the page goes live.
4. Builds flow through SteamPipe branches; promoting `default` and pressing release are **always
   manual human actions** — the harness prepares, never publishes.

## Page structure (what community-writer drafts)

- **Short description** (~300 chars): hook + genre + fantasy, no feature lists.
- **About**: 2–3 paragraphs, feature bullets with small gifs/caps between them.
- **Capsules**: header 460×215, small 231×87, main 616×353, vertical 374×448 + library assets —
  release-manager keeps the checklist; actual art goes through art-director sign-off.
- **Trailer**: first 5 seconds = gameplay; store pages with gameplay-first trailers convert better.
- **Tags**: 15+, most-specific first (they drive discovery queues).
- System requirements from the perf baseline in `references/<project>/config.json`.

## Deck Verified (if `steam` capability + Deck target)

Controller-complete UI, legible text at 1280×800, no launcher hangs, default proton-clean —
`qa-compliance` runs the checklist in `cert-preflight-wave`; store page declares support level.

## Output

`docs/store/steam-page.md` (copy + asset checklist + status table) in the handoff. The submission
timeline goes in the release-wave report so the human schedules reviews with slack.
