# Vinyl Vault — GitHub + Last.fm Migration Design

**Date:** 2026-05-24  
**Status:** Approved

## Overview

Migrate Vinyl Vault from a Claude.ai artifact (Anthropic API-powered) to a Vite React SPA deployed on GitHub Pages. Replace the Anthropic API with Last.fm for song discovery. Remove all AI dependencies. UI is preserved as-is for a future design pass.

---

## Section 1: Tech Stack & Repo Structure

**Framework:** Vite React SPA  
**Deployment:** GitHub Pages via GitHub Actions (auto-deploy on push to `main`)

```
vinylvault/
  src/
    main.jsx          # React root mount
    VinylVault.jsx    # Main component (migrated from vinyl-vault.jsx)
    lastfm.js         # All Last.fm API calls
    config.js         # Last.fm API key constant
  index.html
  vite.config.js      # Includes base: '/vinylvault/' for Pages path
  .github/
    workflows/
      deploy.yml      # Build + deploy to Pages on push to main
  docs/
  CLAUDE.md
  PLAN.md
```

The Last.fm API key lives in `config.js` as a plain exported constant. Safe to commit — Last.fm keys are free, rate-limited, and carry no billing risk.

---

## Section 2: Last.fm Integration

All Last.fm API calls are isolated in `lastfm.js`. `VinylVault.jsx` imports only the three public functions below.

### `searchByTag(tag, limit)`
- Endpoint: `tag.getTopTracks`
- Used when query resolves as a mood, genre, or vibe
- Returns tracks with `playcount` and `listeners` for obscurity scoring

### `searchByArtist(artist, limit, includeSeed)`
- Used when query resolves as an artist name
- `includeSeed = true`: fetch seed artist's top tracks (`artist.getTopTracks`) + top 3 similar artists' tracks via `artist.getSimilar` → `artist.getTopTracks` per artist; merge and dedupe
- `includeSeed = false`: skip seed artist entirely; pull from top 5 similar artists only
- Coin flip (`Math.random() < 0.5`) preserved in `VinylVault.jsx`, passed as `includeSeed`

### `branchFromTrack(track)`
- Endpoint: `artist.getSimilar` on the track's artist → `artist.getTopTracks` per similar artist
- Excludes the source track itself
- Caps source artist at 1 track (same rule as current app)

### Artist vs. Tag Detection
- Run `artist.search(query)` first
- If the top result's name matches the query (case-insensitive), treat as artist search
- Otherwise treat as tag search
- Fallback: if tag search returns 0 results, retry as artist search

### Obscurity Scoring
- Replaces AI-generated `obscurity` field
- Formula: `obscurity = Math.round((1 - listeners / maxListeners) * 100)`
- `maxListeners` = highest listener count in the current result set
- Depth dial behavior unchanged: depth 0 = sort by most listeners first (known); depth 4 = least listeners first (buried)
- Same 0–100 scale; `ObscurityMeter` component requires no changes

### Duration
- Last.fm returns `duration` in milliseconds; convert to seconds
- If `duration === 0` or absent, fall back to `210` (3.5 min estimate)
- Stack totals remain approximate (same known limitation, now reduced in frequency)

---

## Section 3: UI Changes

The full visual design is preserved. No layout, color, font, animation, or structural changes. The UI will be handed off to a designer in a future pass.

**Changes:**
- Note field displays listener count formatted as `142k listeners` (same `rowNote` style) — reinforces the obscurity angle with no extra API calls
- Error message updated to reference a network/API failure (removes jukebox-coin metaphor tied to AI)
- `fetch` to `api.anthropic.com` and all prompt-building logic removed from `VinylVault.jsx`

**Unchanged:**
- `GENRE_SEEDS` and `VIBE_SEEDS` arrays — these strings are real Last.fm tags
- Depth dial, `ObscurityMeter`, stack, fill meter, responsive breakpoints
- "Surprise Me", "more like this" (branch), "Load all N", "Copy the set"
- All inline styles in `S` object and the `CSS` string

---

## Section 4: GitHub Setup & Deployment

### One-Time Setup
1. `git init` in project root, initial commit
2. Create new GitHub repo, push
3. Register a free Last.fm API key at [last.fm/api](https://www.last.fm/api/account/create), add to `src/config.js`
4. In repo Settings → Pages → set source to "GitHub Actions"

### GitHub Actions (`deploy.yml`)
- Trigger: push to `main`
- Steps: checkout → setup Node → `npm ci` → `npm run build` → deploy `dist/` to Pages
- Uses `actions/deploy-pages` (official GitHub action)

### Vite Config
```js
// vite.config.js
export default {
  base: '/vinylvault/',  // match GitHub repo name exactly
}
```

### Result
Push to `main` → GitHub Actions builds and deploys automatically. Live at `https://<username>.github.io/vinylvault/`.

---

## Known Limitations (Carried Forward)

- Duration estimates remain approximate for tracks where Last.fm returns 0
- Surprise seeds may return sparse results for very niche tags — acceptable, re-dig resolves it
- Per-artist cap can still undershoot requested count if similar-artist results over-repeat one artist
- No persistence (no localStorage on GitHub Pages artifact constraints lifted, but persistence is out of scope here)
