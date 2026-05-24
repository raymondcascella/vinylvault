VINYL VAULT — Project Handover (current)
What it is: A single-file React artifact (vinyl-vault.jsx, ~840 lines). A song-discovery tool styled as a Wurlitzer jukebox. Type an artist, genre, era, or mood; it returns a set of real songs leaning toward deeper cuts; you build a playlist ("The Stack") toward a target runtime.
Aesthetic: Warm cream/butterscotch/jukebox-red palette, light theme. Cabinet "crown" with arched glow and two pulsing bubbler tubes. Title in Monoton (neon-tube font); body in Fraunces; mono details in DM Mono. All inline styles in an S object, plus one <style> block (CSS) for animations and media queries.
How song selection works:

Powered by the in-artifact Anthropic API (claude-sonnet-4-20250514), prompted as a record-store clerk. Returns JSON per track: title, artist, year, obscurity (0–100), note (one-liner), duration (seconds). Sorted by obscurity ascending.
Two dig modes in one dig(query, branchSong) function:

Normal: coin flip (Math.random() < 0.5) — 50% the seed artist gets one track, 50% they're excluded and used only as a compass toward adjacent/lesser-known artists.
Branch ("more like this"): seeds off a specific result song; pulls tracks sharing its sonic character (feel, tempo, instrumentation, production, era), mostly by other artists; excludes the song itself; caps the source artist at one. Replaces current results.


Depth dial (0–4: "Top of the Charts" → "Buried in the Stacks") re-weights obscurity; applies on next dig.
Track count is target-driven: clamp(5, 30, round(targetMin / 4)) (~4 min/track). 30 min ≈ 8, 1 hr ≈ 15, 2 hr ≈ 30 (cap). Threads through prompt, seed rule, "Load all N" label, and max_tokens (min(8000, 600 + trackCount*130)).
Per-artist cap: both prompts request max 2 songs/artist, AND a hard code-side filter enforces it after parsing (case-insensitive). MAX_PER_ARTIST = 2.

Features:

Search input on its own row; Make Selection + Surprise Me as a 50/50 button row beneath.
Surprise Me drops a random seed into the box (does NOT auto-search). Seeds in two named arrays: GENRE_SEEDS (~40) and VIBE_SEEDS (~25); SURPRISE_SEEDS = [...GENRE_SEEDS, ...VIBE_SEEDS].
Result rows: click to set "now playing" (spinning 45 + red highlight + ♪ badge); + adds to stack; ⌕ more like this branches; obscurity meter; per-track length as M:SS.
Load all N into the stack button at bottom of results (label reflects actual count).
Fill up to control: preset chips (30/60/90/120/180 min) + custom minutes input. Stack shows a progress bar totaling durations vs. target ("42m of 1h · 18m to go" / "full ✓" / "X over").
The Stack sidebar: numbered queue, remove buttons, "Copy the set" (plain-text clipboard export).
Responsive: single column ≤760px; extra ≤480px fixes (cabinet padding, title scale, bubblers, button-text ellipsis).

Known stubs / not real yet:

Durations are model estimates, not looked-up facts — stack totals approximate.
"Now playing" spinner is visual only — no audio playback.
Surprise seeds are hardcoded arrays, not a live feed.
No persistence — stack resets on reload (artifacts can't use browser storage).
Count locks at search time — changing fill target after a search won't resize existing results; dig again.
Per-artist cap can undershoot the count — filtering happens after the response, so an over-repetitive batch returns slightly fewer than requested (by design; re-dig or branch to top up).

Possible next steps (offered, not built): per-track Spotify/YouTube search links; coin-drop sound; audio previews (needs music API + keys + hosted env); persistence; backfill to always hit exact count; toggle to surprise from genres-only or vibes-only.
Context for Claude Code: Plan is to continue here with the Superpowers plugin (TDD/structured workflow). The artifact's fetch to api.anthropic.com works in the Claude.ai artifact sandbox (no key needed there) — in a standalone/hosted build you'll need to supply your own API key and likely proxy the call through a backend rather than calling from the browser. Good first real-data tasks: wire up actual track durations and audio previews via a music API (both push this from artifact to a real hosted project).
