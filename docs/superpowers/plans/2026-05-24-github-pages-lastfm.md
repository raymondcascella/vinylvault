# Vinyl Vault — GitHub Pages + Last.fm Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Vinyl Vault from a Claude.ai artifact to a Vite React SPA powered by Last.fm, deployed automatically to GitHub Pages.

**Architecture:** Single-page React app scaffolded with Vite. All Last.fm API calls are isolated in `src/lastfm.js`. `src/VinylVault.jsx` is the existing component with the Anthropic fetch replaced by Last.fm calls. GitHub Actions builds and deploys `dist/` to Pages on every push to `main`.

**Tech Stack:** React 18, Vite 5, Last.fm API (free key), GitHub Actions, GitHub Pages

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | Create | Vite + React dependencies |
| `vite.config.js` | Create | Base path for GitHub Pages |
| `index.html` | Create | Vite entry point |
| `src/main.jsx` | Create | React root mount |
| `src/config.js` | Create | Last.fm API key constant |
| `src/lastfm.js` | Create | All Last.fm API calls |
| `src/VinylVault.jsx` | Create (migrate) | Main component, Anthropic fetch removed |
| `.github/workflows/deploy.yml` | Create | Build + deploy to Pages on push to main |
| `.gitignore` | Create | Ignore node_modules, dist |

---

## Task 1: Scaffold Vite project

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "vinylvault",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/vinylvault/',
})
```

- [ ] **Step 3: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vinyl Vault</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import VinylVault from './VinylVault'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <VinylVault />
  </React.StrictMode>
)
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules
dist
.DS_Store
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Verify dev server starts**

Run: `npm run dev`

Expected: Vite prints a local URL (e.g. `http://localhost:5173/vinylvault/`). The page will be blank (no component yet) — that's fine. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```
git add package.json package-lock.json vite.config.js index.html src/main.jsx .gitignore
git commit -m "feat: scaffold Vite React project"
```

---

## Task 2: Create Last.fm config and API module

**Files:**
- Create: `src/config.js`
- Create: `src/lastfm.js`

You need a free Last.fm API key before this task. Get one at: https://www.last.fm/api/account/create (takes ~2 minutes, use any app name).

- [ ] **Step 1: Create `src/config.js`**

Replace `YOUR_KEY_HERE` with your actual Last.fm API key.

```js
export const LASTFM_KEY = 'YOUR_KEY_HERE';
```

- [ ] **Step 2: Create `src/lastfm.js` — base fetch helper**

```js
import { LASTFM_KEY } from './config';

const BASE = 'https://ws.audioscrobbler.com/2.0/';

async function lfm(params) {
  const url = new URL(BASE);
  Object.entries({ ...params, api_key: LASTFM_KEY, format: 'json' }).forEach(
    ([k, v]) => url.searchParams.set(k, v)
  );
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Last.fm error: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: Add `normalizeObscurity` helper to `src/lastfm.js`**

Append below the `lfm` function:

```js
function normalizeObscurity(tracks) {
  const max = Math.max(...tracks.map((t) => Number(t.listeners) || 0), 1);
  return tracks.map((t) => ({
    ...t,
    obscurity: Math.round((1 - (Number(t.listeners) || 0) / max) * 100),
  }));
}
```

- [ ] **Step 4: Add `formatTrack` helper to `src/lastfm.js`**

Append below `normalizeObscurity`:

```js
function formatTrack(raw) {
  const listeners = Number(raw.listeners) || Number(raw.playcount) || 0;
  const durationMs = Number(raw.duration) || 0;
  return {
    title: raw.name,
    artist: typeof raw.artist === 'string' ? raw.artist : raw.artist?.name || '',
    year: null,
    obscurity: raw.obscurity ?? 50,
    note: listeners > 0
      ? `${listeners >= 1000 ? Math.round(listeners / 1000) + 'k' : listeners} listeners`
      : '',
    duration: durationMs > 0 ? Math.round(durationMs / 1000) : 210,
    listeners,
  };
}
```

- [ ] **Step 5: Add `dedupeAndCap` helper to `src/lastfm.js`**

Append below `formatTrack`:

```js
const MAX_PER_ARTIST = 2;

function dedupeAndCap(tracks) {
  const seen = {};
  const seenTracks = new Set();
  return tracks.filter((t) => {
    const artistKey = String(t.artist || '').trim().toLowerCase();
    const trackKey = `${artistKey}__${String(t.title || '').trim().toLowerCase()}`;
    if (seenTracks.has(trackKey)) return false;
    seen[artistKey] = (seen[artistKey] || 0) + 1;
    if (seen[artistKey] > MAX_PER_ARTIST) return false;
    seenTracks.add(trackKey);
    return true;
  });
}
```

- [ ] **Step 6: Add `searchByTag` to `src/lastfm.js`**

Note: `tag.getTopTracks` returns neither listener counts nor duration. Obscurity is derived from rank position (rank 1 = most popular = obscurity 0; last = obscurity 100). Duration falls back to the 210s estimate in `formatTrack`.

Append:

```js
export async function searchByTag(tag, limit = 20) {
  const data = await lfm({ method: 'tag.getTopTracks', tag, limit });
  const raw = data?.tracks?.track || [];
  const total = raw.length || 1;
  // Assign rank-based obscurity since tag endpoint has no listener data
  const tracks = raw.map((t, i) => ({
    name: t.name,
    artist: t.artist?.name || '',
    duration: 0, // not provided by this endpoint; formatTrack will use 210s fallback
    listeners: 0,
    obscurity: Math.round((i / (total - 1 || 1)) * 100),
  }));
  return dedupeAndCap(tracks.map(formatTrack));
}
```

- [ ] **Step 7: Add `searchByArtist` to `src/lastfm.js`**

Append:

```js
export async function searchByArtist(artist, limit = 20, includeSeed = true) {
  const similarData = await lfm({ method: 'artist.getSimilar', artist, limit: includeSeed ? 3 : 5 });
  const similarArtists = (similarData?.similarartists?.artist || []).map((a) => a.name);

  const artistsToFetch = includeSeed ? [artist, ...similarArtists] : similarArtists;

  const perArtistLimit = Math.ceil(limit / artistsToFetch.length) + 2;

  const results = await Promise.all(
    artistsToFetch.map((a) =>
      lfm({ method: 'artist.getTopTracks', artist: a, limit: perArtistLimit })
        .then((d) => (d?.toptracks?.track || []).map((t) => ({ ...t, artist: { name: a } })))
        .catch(() => [])
    )
  );

  const flat = results.flat();
  const withObscurity = normalizeObscurity(flat);
  const sorted = withObscurity.sort((a, b) => a.obscurity - b.obscurity);
  return dedupeAndCap(sorted.map(formatTrack)).slice(0, limit);
}
```

- [ ] **Step 8: Add `branchFromTrack` to `src/lastfm.js`**

Append:

```js
export async function branchFromTrack(track, limit = 20) {
  const similarData = await lfm({ method: 'artist.getSimilar', artist: track.artist, limit: 6 });
  const similarArtists = (similarData?.similarartists?.artist || []).map((a) => a.name);

  const perArtistLimit = Math.ceil(limit / similarArtists.length) + 2;

  const results = await Promise.all(
    similarArtists.map((a) =>
      lfm({ method: 'artist.getTopTracks', artist: a, limit: perArtistLimit })
        .then((d) => (d?.toptracks?.track || []).map((t) => ({ ...t, artist: { name: a } })))
        .catch(() => [])
    )
  );

  const flat = results.flat().filter(
    (t) => t.name?.toLowerCase() !== track.title?.toLowerCase()
  );

  // Cap source artist at 1 track
  const seedArtistKey = track.artist.trim().toLowerCase();
  let seedCount = 0;
  const capped = flat.filter((t) => {
    const k = (typeof t.artist === 'string' ? t.artist : t.artist?.name || '').trim().toLowerCase();
    if (k === seedArtistKey) {
      seedCount++;
      return seedCount <= 1;
    }
    return true;
  });

  const withObscurity = normalizeObscurity(capped);
  return dedupeAndCap(withObscurity.map(formatTrack)).slice(0, limit);
}
```

- [ ] **Step 9: Add `detectQueryType` to `src/lastfm.js`**

Append:

```js
export async function detectQueryType(query) {
  try {
    const data = await lfm({ method: 'artist.search', artist: query, limit: 1 });
    const match = data?.results?.artistmatches?.artist?.[0];
    if (match && match.name.trim().toLowerCase() === query.trim().toLowerCase()) {
      return 'artist';
    }
  } catch (_) {}
  return 'tag';
}
```

- [ ] **Step 10: Commit**

```
git add src/config.js src/lastfm.js
git commit -m "feat: add Last.fm API module"
```

---

## Task 3: Migrate VinylVault component

**Files:**
- Create: `src/VinylVault.jsx` (migrated from `vinyl-vault.jsx`)

This task replaces the entire `dig()` function body. Everything else in the component (state, helpers, JSX, styles) is copied verbatim.

- [ ] **Step 1: Copy `vinyl-vault.jsx` to `src/VinylVault.jsx`**

Run: `copy vinyl-vault.jsx src\VinylVault.jsx`

- [ ] **Step 2: Replace the import line at the top of `src/VinylVault.jsx`**

Find:
```js
import React, { useState, useRef } from "react";
```

Replace with:
```js
import React, { useState, useRef } from "react";
import { searchByTag, searchByArtist, branchFromTrack, detectQueryType } from "./lastfm";
```

- [ ] **Step 3: Replace the entire `dig` function in `src/VinylVault.jsx`**

Find and replace the entire function from `async function dig(` through the closing `}` (lines 77–173 in the original). Replace with:

```js
async function dig(q = query, branchSong = null) {
  const term = (branchSong ? branchSong.artist : q).trim();
  if (!term) return;
  setLoading(true);
  setError("");
  setLastQuery(branchSong ? `${branchSong.title} — ${branchSong.artist}` : q.trim());

  const trackCount = Math.max(5, Math.min(30, Math.round(targetMin / 4)));

  try {
    let tracks;

    if (branchSong) {
      tracks = await branchFromTrack(branchSong, trackCount);
    } else {
      const queryType = await detectQueryType(q.trim());
      if (queryType === 'artist') {
        const includeSeed = Math.random() < 0.5;
        tracks = await searchByArtist(q.trim(), trackCount, includeSeed);
      } else {
        tracks = await searchByTag(q.trim(), trackCount);
        if (tracks.length === 0) {
          // Fallback: try as artist
          tracks = await searchByArtist(q.trim(), trackCount, true);
        }
      }
    }

    // Sort by depth: depth 0 = most listeners first (low obscurity), depth 4 = least listeners first (high obscurity)
    const sorted = [...tracks].sort((a, b) =>
      depth <= 2 ? a.obscurity - b.obscurity : b.obscurity - a.obscurity
    );

    setResults(sorted.map((p, i) => ({ ...p, _id: `${Date.now()}-${i}` })));
    setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  } catch (e) {
    setError("Couldn't load selections — check your connection and try again.");
  } finally {
    setLoading(false);
  }
}
```

- [ ] **Step 4: Verify the dev server renders the component**

Run: `npm run dev`

Open `http://localhost:5173/vinylvault/` in a browser. The jukebox UI should render. Enter a search term and verify results load (you'll need your Last.fm key in `src/config.js`). Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```
git add src/VinylVault.jsx
git commit -m "feat: migrate component to Last.fm, remove Anthropic dependency"
```

---

## Task 4: GitHub repository and Pages setup

**Files:**
- Create: `.github/workflows/deploy.yml`

You need a GitHub account and the `gh` CLI authenticated (`gh auth login`) for this task.

- [ ] **Step 1: Create GitHub repo**

Run:
```
gh repo create vinylvault --public --source=. --remote=origin --push
```

Expected: repo created at `https://github.com/<your-username>/vinylvault`, all files pushed.

- [ ] **Step 2: Enable GitHub Pages in repo settings**

Run:
```
gh api repos/{owner}/{repo} --method PATCH -f "has_pages=true" 2>$null
```

Then open the repo in browser and go to **Settings → Pages → Build and deployment → Source → GitHub Actions**. (This step requires the browser — the API alone doesn't set the Actions source.)

- [ ] **Step 3: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 4: Commit and push to trigger deploy**

```
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions deploy to Pages"
git push
```

- [ ] **Step 5: Watch the deployment**

Run: `gh run watch`

Expected: workflow completes with ✓. Site goes live at `https://<your-username>.github.io/vinylvault/`.

---

## Task 5: Verify live site and clean up

- [ ] **Step 1: Confirm live URL loads**

Open `https://<your-username>.github.io/vinylvault/` in a browser. The jukebox UI should render fully.

- [ ] **Step 2: Test a tag search**

Type `northern soul` and click Make Selection. Verify results appear with track name, artist, year, duration, obscurity meter, and listener count note.

- [ ] **Step 3: Test an artist search**

Type `Otis Redding` and click Make Selection. Verify results include tracks by similar artists (coin flip means sometimes Otis appears, sometimes not).

- [ ] **Step 4: Test branch**

Click ⌕ on any result. Verify results reload with tracks from similar artists.

- [ ] **Step 5: Test Surprise Me**

Click ⚄ Surprise Me. Verify a random seed drops into the search box (does not auto-search).

- [ ] **Step 6: Test stack**

Add several tracks, verify duration total updates, verify Copy the set copies plain text.

- [ ] **Step 7: Update CLAUDE.md with new dev commands**

Open `CLAUDE.md` and add a Commands section at the top (after the opening paragraph):

```markdown
## Commands

- `npm run dev` — start local dev server at `http://localhost:5173/vinylvault/`
- `npm run build` — build to `dist/`
- `npm run preview` — preview the production build locally

Deployment is automatic: push to `main` triggers GitHub Actions which builds and deploys to GitHub Pages.
```

- [ ] **Step 8: Final commit**

```
git add CLAUDE.md
git commit -m "docs: add dev commands to CLAUDE.md"
git push
```
