# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vinyl Vault** is a single-file React component (`vinyl-vault.jsx`, ~840 lines) — a Wurlitzer jukebox-themed song discovery tool. The user types an artist, genre, era, or mood; the app queries the Anthropic API and returns real songs weighted toward deeper cuts. Users build a timed playlist ("The Stack").

Currently structured as a **Claude.ai artifact** (no build system, no package.json). The `fetch` call to `api.anthropic.com` works without a key inside the artifact sandbox — moving to a hosted app requires an API key and a backend proxy.

## Architecture

Everything lives in `vinyl-vault.jsx`. Key sections:

- **Seed arrays** (`GENRE_SEEDS`, `VIBE_SEEDS`, `SURPRISE_SEEDS`) — hardcoded starting points for Surprise Me
- **`DEPTH_LABELS`** — 5-level obscurity dial (0 = "Top of the Charts" → 4 = "Buried in the Stacks")
- **`VinylVault` component** — all state, logic, and JSX
  - `dig(query, branchSong)` — the core async function; two modes:
    - **Normal dig**: 50/50 coin flip on whether to include/exclude the seed artist; returns tracks sorted by `obscurity` ascending
    - **Branch dig**: seeded off a specific result song; pulls sonically similar tracks by other artists
  - Post-parse hard cap: `MAX_PER_ARTIST = 2` (enforced after JSON parsing, not just in the prompt)
  - Track count formula: `clamp(5, 30, round(targetMin / 4))` — threads through prompt, token budget (`min(8000, 600 + trackCount*130)`), and UI labels
- **`ObscurityMeter`** — standalone component, 5-bar visual (0–100 → filled bars + "known/cut/rare" label)
- **`CSS`** — injected via `<style>` tag; handles animations, depth-dial custom styling, responsive breakpoints (≤760px, ≤480px)
- **`S` object** — all inline styles; uses CSS custom properties defined on `S.root` (`--cream`, `--amber`, `--red`, `--ink`, etc.)

## Design System

Fonts (Google Fonts): **Monoton** (title/neon), **Fraunces** (body/serif), **DM Mono** (metadata/mono)

Palette via CSS vars: `--cream #f6e8c8`, `--amber #d9a441`, `--red #c0392b`, `--red-deep #8e2b20`, `--ink #3a241a`, `--ink-soft #7a5a44`

Jukebox chrome: arched cabinet crown with `archGlow` overlay + two `bubbler` tubes (pulsing animation). All decorative elements use `aria-hidden`.

## API Integration

Model: `claude-sonnet-4-20250514` (update when rotating models)

Expected JSON per track: `{ title, artist, year, obscurity (0–100), note (≤12 words), duration (seconds) }`

Results are sorted by `obscurity` ascending, then filtered through the `MAX_PER_ARTIST` cap. Duration values are **model estimates**, not actual metadata.

## Known Constraints / Design Decisions

- **No persistence** — stack resets on reload (artifact limitation; localStorage unavailable)
- **Count can undershoot** — per-artist cap filters after parsing; an over-repetitive batch yields fewer than requested (by design; re-dig or branch to top up)
- **Track count locks at search time** — changing `targetMin` after a search doesn't resize results; requires a new dig
- **No audio playback** — "now playing" spinner is visual only
- **Durations are approximate** — model estimates, not looked-up facts

## Planned Next Steps (from PLAN.md)

Priority real-data integrations: wire actual track durations and audio previews via a music API. Both require moving from artifact to a hosted environment with a backend API proxy (since Anthropic API calls must not be made directly from the browser with an exposed key in production).

Other candidates: per-track Spotify/YouTube search links, coin-drop sound effect, persistence, backfill logic to always hit exact track count, Surprise Me toggle (genres-only vs vibes-only).
