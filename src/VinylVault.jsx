import React, { useState, useRef } from "react";
import { searchByTag, searchByArtist, branchFromTrack, detectQueryType } from "./lastfm";

const DEPTH_LABELS = [
  { v: 0, label: "Top of the Charts", blurb: "The songs everyone knows" },
  { v: 1, label: "Fan Favorites", blurb: "Popular, plus a few sleepers" },
  { v: 2, label: "Selectin' Deep", blurb: "Mostly lesser-known, some popular" },
  { v: 3, label: "Deep Cuts", blurb: "Album tracks & B-sides" },
  { v: 4, label: "Buried in the Stacks", blurb: "Obscurities only diehards know" },
];

const GENRE_SEEDS = [
  "Northern soul", "dub reggae", "krautrock", "bossa nova", "Tropicália",
  "post-punk", "desert blues", "doo-wop", "shoegaze", "spiritual jazz",
  "city pop", "swamp rock", "library music", "Afrobeat", "outlaw country",
  "psychedelic cumbia", "lovers rock", "freakbeat", "yacht rock", "minimal wave",
  "honky-tonk", "Delta blues", "hard bop", "surf rock", "garage rock",
  "dream pop", "post-rock", "highlife", "fado", "free jazz",
  "bluegrass", "zydeco", "mbaqanga", "ethio-jazz", "Philly soul",
  "deep funk", "jangle pop", "slowcore", "trip-hop", "acid jazz",
];
const VIBE_SEEDS = [
  "rainy Sunday", "late-night drive", "golden hour", "last call", "3am insomnia",
  "summer cookout", "slow dance", "road trip through the desert",
  "smoky basement club", "front porch evening", "snowed-in cabin",
  "dusty record shop", "neon city after midnight", "lazy hungover morning",
  "campfire singalong", "dinner party warm-up", "walking in the cold",
  "falling in love", "getting over someone", "sunrise comedown",
  "beach at dusk", "autumn melancholy", "quiet contemplation",
  "dancing alone in the kitchen", "long train ride",
];
const SURPRISE_SEEDS = [...GENRE_SEEDS, ...VIBE_SEEDS];

export default function VinylVault() {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [playlist, setPlaylist] = useState([]);
  const [lastQuery, setLastQuery] = useState("");
  const [nowPlaying, setNowPlaying] = useState(null);
  const [targetMin, setTargetMin] = useState(60);
  const listRef = useRef(null);
  const stackRef = useRef(null);

  const depthInfo = DEPTH_LABELS[depth];

  const stackSeconds = playlist.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  const targetSeconds = targetMin * 60;
  const fillPct = targetSeconds > 0 ? Math.min(100, (stackSeconds / targetSeconds) * 100) : 0;
  const remaining = targetSeconds - stackSeconds;

  function fmtClock(totalSec) {
    const s = Math.max(0, Math.round(totalSec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
    return `${m}m`;
  }
  function fmtTrack(sec) {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function surprise() {
    const pick = SURPRISE_SEEDS[Math.floor(Math.random() * SURPRISE_SEEDS.length)];
    setQuery(pick);
  }

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
        if (queryType === "artist") {
          const includeSeed = Math.random() < 0.5;
          tracks = await searchByArtist(q.trim(), trackCount, includeSeed);
        } else {
          tracks = await searchByTag(q.trim(), trackCount);
          if (tracks.length === 0) {
            tracks = await searchByArtist(q.trim(), trackCount, true);
          }
        }
      }

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

  function keyOf(s) {
    return `${s.artist}__${s.title}`.toLowerCase();
  }
  function addToStack(song) {
    setPlaylist((p) => (p.some((x) => keyOf(x) === keyOf(song)) ? p : [...p, song]));
  }
  function addAll() {
    setPlaylist((p) => {
      const have = new Set(p.map(keyOf));
      const fresh = results.filter((s) => !have.has(keyOf(s)));
      return [...p, ...fresh];
    });
    setTimeout(() => stackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  function removeFromStack(id) {
    setPlaylist((p) => p.filter((s) => s._id !== id));
  }
  function inStack(song) {
    return playlist.some((x) => keyOf(x) === keyOf(song));
  }
  const allQueued = results.length > 0 && results.every(inStack);

  function copyStack() {
    const text = playlist.map((s) => `${s.artist} — ${s.title}${s.year ? ` (${s.year})` : ""}`).join("\n");
    navigator.clipboard?.writeText(text);
  }

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div style={S.cabinet}>
        <div style={S.bgDisc} aria-hidden>
          <div style={S.bgDiscLabel} />
          <div style={S.bgDiscHole} />
        </div>
        <header style={S.header}>
          <div style={S.coinSlot}>◉ DIG DEEP · PLAY RARE</div>
          <h1 style={S.title} className="vv-title">
            Vinyl<br />Vault
          </h1>
          <p style={S.subtitle}>
            Name an artist, a genre, a mood. The Vault skips the jukebox
            staples and reaches for the rare pressings locked in the back.
          </p>
        </header>
      </div>

      {/* ── Controls ── */}
      <section style={S.controls}>
        <div style={S.sectionRule}>
          <span style={S.sectionRuleLabel}>SELECTIONS</span>
        </div>

        <div style={S.searchRow}>
          <input
            className="vv-input"
            style={S.input}
            placeholder="Sam Cooke · Northern soul · slow dance · desert blues…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && dig()}
          />
        </div>
        <div style={S.buttonRow}>
          <button style={S.digBtn} className="vv-btn vv-dig-btn" onClick={() => dig()} disabled={loading}>
            {loading ? "Cueing…" : "Make Selection"}
          </button>
          <button style={S.surpriseBtn} className="vv-btn vv-surprise-btn" onClick={surprise} disabled={loading} title="Drop a random idea into the box">
            ⚄ Surprise Me
          </button>
        </div>

        <div style={S.dialWrap}>
          <div style={S.dialHead}>
            <span style={S.dialLabel}>{depthInfo.label}</span>
            <span style={S.dialBlurb}>{depthInfo.blurb}</span>
          </div>
          <input
            type="range"
            min="0"
            max="4"
            step="1"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="depth-dial"
          />
          <div style={S.dialTicks}>
            {DEPTH_LABELS.map((d) => (
              <span key={d.v} style={{ ...S.tick, color: d.v === depth ? "var(--gold)" : "var(--parchment-dim)" }}>
                {d.v <= depth ? "●" : "○"}
              </span>
            ))}
          </div>
        </div>

        <div style={S.fillWrap}>
          <span style={S.fillLabel}>Fill up to</span>
          <div style={S.fillChips}>
            {[
              { m: 30, t: "30m" },
              { m: 60, t: "1h" },
              { m: 90, t: "90m" },
              { m: 120, t: "2h" },
              { m: 180, t: "3h" },
            ].map((p) => (
              <button
                key={p.m}
                style={{ ...S.fillChip, ...(targetMin === p.m ? S.fillChipOn : {}) }}
                onClick={() => setTargetMin(p.m)}
              >
                {p.t}
              </button>
            ))}
            <div style={S.fillCustom}>
              <input
                type="number"
                min="1"
                value={targetMin}
                onChange={(e) => setTargetMin(Math.max(1, Number(e.target.value) || 0))}
                style={S.fillInput}
                aria-label="Custom minutes"
              />
              <span style={S.fillUnit}>min</span>
            </div>
          </div>
        </div>
      </section>

      {error && <div style={S.error}>{error}</div>}

      {/* ── Results + Stack ── */}
      <main style={S.body} className="sel-body">
        <section style={S.resultsCol} ref={listRef}>
          {results.length === 0 && !loading && (
            <div style={S.empty}>
              <div style={S.emptyDisc} className="spin-slow" />
              <p style={{ marginTop: 18 }}>No record cued. Make a selection above to load the turntable.</p>
            </div>
          )}

          {loading && (
            <div style={S.empty}>
              <div style={S.emptyDisc} className="spin-fast" />
              <p style={{ marginTop: 18 }}>Pulling selections for "{lastQuery || query}"…</p>
            </div>
          )}

          {!loading &&
            results.map((song, i) => {
              const playing = nowPlaying === song._id;
              const accentColor =
                song.obscurity > 66 ? "var(--ember)" :
                song.obscurity > 33 ? "var(--gold)" :
                "var(--gold-dim)";
              return (
                <article
                  key={song._id}
                  className="record-row"
                  style={{
                    ...S.row,
                    ...(playing ? S.rowPlaying : {}),
                    borderLeft: `3px solid ${accentColor}`,
                    animationDelay: `${i * 50}ms`,
                  }}
                  onClick={() => setNowPlaying(playing ? null : song._id)}
                >
                  <div style={S.discWrap}>
                    <div style={S.disc} className={playing ? "disc spin-45" : "disc"}>
                      <div style={S.discHole} />
                    </div>
                    {playing && <span style={S.eqBadge}>♪</span>}
                  </div>
                  <ObscurityMeter value={song.obscurity} />
                  <div style={S.rowMain}>
                    <div style={S.rowTitle}>{song.title}</div>
                    <div style={S.rowMeta}>{song.artist}{song.year ? ` · ${song.year}` : ""}{song.duration ? ` · ${fmtTrack(song.duration)}` : ""}</div>
                    <div style={S.rowNote}>{song.note}</div>
                  </div>
                  <div style={S.rowActions}>
                    <button
                      style={{ ...S.addBtn, ...(inStack(song) ? S.addBtnDone : {}) }}
                      onClick={(e) => { e.stopPropagation(); addToStack(song); }}
                      disabled={inStack(song)}
                      title={inStack(song) ? "In your stack" : "Add to stack"}
                    >
                      {inStack(song) ? "✓" : "+"}
                    </button>
                    <button
                      style={S.branchBtn}
                      className="vv-branch-btn"
                      onClick={(e) => { e.stopPropagation(); dig(query, song); }}
                      disabled={loading}
                      title={`Find more like "${song.title}"`}
                    >
                      more like this
                    </button>
                  </div>
                </article>
              );
            })}

          {!loading && results.length > 0 && (
            <button
              style={{ ...S.addAllBtn, ...(allQueued ? S.addAllDone : {}) }}
              onClick={addAll}
              disabled={allQueued}
            >
              {allQueued ? "✓ All loaded into the stack" : `Load all ${results.length} into the stack`}
            </button>
          )}
        </section>

        {/* ── Stack ── */}
        <aside style={S.stackCol} className="sel-stack" ref={stackRef}>
          <div style={S.stackHead}>
            <span>THE STACK</span>
            <span style={S.stackCount}>{playlist.length}</span>
          </div>

          <div style={S.fillMeter}>
            <div style={S.fillMeterTop}>
              <span>{fmtClock(stackSeconds)} of {fmtClock(targetSeconds)}</span>
              <span style={{ color: remaining > 0 ? "var(--parchment-muted)" : "var(--gold)" }}>
                {remaining > 0
                  ? `${fmtClock(remaining)} to go`
                  : remaining < -30
                  ? `${fmtClock(-remaining)} over`
                  : "full ✓"}
              </span>
            </div>
            <div style={S.fillTrack}>
              <div style={{
                ...S.fillBar,
                width: `${fillPct}%`,
                background: fillPct >= 100 ? "var(--ember)" : "var(--gold)",
              }} />
            </div>
          </div>

          {playlist.length === 0 ? (
            <p style={S.stackEmpty}>Records you load queue up here. Build a set, then play it through.</p>
          ) : (
            <>
              <div style={S.stackList}>
                {playlist.map((s, i) => (
                  <div key={s._id} style={S.stackItem}>
                    <span style={S.stackNum}>{String(i + 1).padStart(2, "0")}</span>
                    <div style={{ overflow: "hidden", flex: 1 }}>
                      <div style={S.stackItemTitle}>{s.title}</div>
                      <div style={S.stackItemArtist}>{s.artist}</div>
                    </div>
                    <button style={S.removeBtn} onClick={() => removeFromStack(s._id)}>×</button>
                  </div>
                ))}
              </div>
              <button style={S.copyBtn} onClick={copyStack}>Copy the set ⧉</button>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}

function ObscurityMeter({ value }) {
  const bars = 5;
  const filled = Math.round((value / 100) * bars);
  const barColor =
    value > 66 ? "var(--ember)" :
    value > 33 ? "var(--gold)" :
    "rgba(212,148,30,0.45)";
  const labelColor =
    value > 66 ? "var(--ember)" :
    value > 33 ? "var(--gold)" :
    "var(--parchment-muted)";
  return (
    <div style={S.meter} title={`Obscurity ${value}/100`}>
      <div style={S.meterBars}>
        {Array.from({ length: bars }).map((_, i) => (
          <span
            key={i}
            style={{
              ...S.meterBar,
              background: i < filled ? barColor : "rgba(255,255,255,0.06)",
              height: 5 + i * 4,
            }}
          />
        ))}
      </div>
      <span style={{ ...S.meterLabel, color: labelColor }}>
        {value > 66 ? "rare" : value > 33 ? "cut" : "known"}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,400;1,600;1,700&family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; }

body { margin: 0; background: #0e0c09; }

.depth-dial {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, #2e2818 0%, #d4941e 100%);
  outline: none; cursor: pointer;
}
.depth-dial::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 22px; height: 22px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #f0c840, #d4941e 55%, #7a5010);
  border: 2px solid #0e0c09;
  box-shadow: 0 0 0 2px rgba(212,148,30,0.4), 0 2px 8px rgba(0,0,0,0.6);
  cursor: grab;
  transition: box-shadow 0.2s;
}
.depth-dial::-webkit-slider-thumb:hover {
  box-shadow: 0 0 0 5px rgba(212,148,30,0.2), 0 2px 8px rgba(0,0,0,0.6);
}
.depth-dial::-moz-range-thumb {
  width: 22px; height: 22px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #f0c840, #d4941e 55%, #7a5010);
  border: 2px solid #0e0c09; cursor: grab;
}

.record-row {
  animation: rowIn 0.5s cubic-bezier(0.16,1,0.3,1) backwards;
}
@keyframes rowIn {
  from { opacity: 0; transform: translateX(-14px); }
  to   { opacity: 1; transform: none; }
}
.record-row:hover {
  transform: translateX(3px);
  border-right-color: rgba(212,148,30,0.1) !important;
}

.spin-slow { animation: spin 10s linear infinite; }
.spin-fast { animation: spin 1s linear infinite; }
.spin-45   { animation: spin 1.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.disc { transition: box-shadow 0.2s; }
.record-row:hover .disc {
  box-shadow: 0 0 0 1px rgba(212,148,30,0.5), 0 0 18px rgba(212,148,30,0.1) !important;
}

.vv-input:focus {
  border-color: var(--gold) !important;
  box-shadow: 0 0 0 3px rgba(212,148,30,0.12);
  outline: none;
}
.vv-dig-btn:not(:disabled):hover {
  background: var(--gold-bright) !important;
}
.vv-surprise-btn:not(:disabled):hover {
  border-color: var(--gold) !important;
  background: rgba(212,148,30,0.07) !important;
}
.vv-branch-btn:not(:disabled):hover {
  border-color: rgba(212,148,30,0.4) !important;
  color: var(--gold) !important;
}

::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(212,148,30,0.18); border-radius: 5px; }

@media (max-width: 760px) {
  .sel-body  { grid-template-columns: 1fr !important; }
  .sel-stack { position: static !important; }
}
@media (max-width: 580px) {
  .vv-title { font-size: 18vw !important; }
  .vv-btn   { font-size: 14px !important; padding: 14px 16px !important; }
  .vv-bg-disc { display: none; }
}
.vv-btn { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
`;

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const S = {
  root: {
    "--night":          "#0e0c09",
    "--night-2":        "#1a1710",
    "--night-3":        "#221e14",
    "--night-4":        "#2e2818",
    "--gold":           "#d4941e",
    "--gold-bright":    "#f0b830",
    "--gold-dim":       "#5a4010",
    "--ember":          "#c0392b",
    "--ember-deep":     "#8a2818",
    "--parchment":      "#e8dcc4",
    "--parchment-muted":"#7a6a50",
    "--parchment-dim":  "#3a3020",
    minHeight: "100vh",
    background: "var(--night)",
    color: "var(--parchment)",
    fontFamily: "'Syne', sans-serif",
    padding: "clamp(16px, 4vw, 44px)",
    position: "relative",
  },

  // ── Header ──
  cabinet: {
    position: "relative",
    maxWidth: 920,
    margin: "0 auto",
    padding: "clamp(44px,7vw,80px) clamp(24px,5vw,60px) clamp(44px,6vw,70px)",
    borderBottom: "1px solid var(--night-4)",
    overflow: "hidden",
  },
  bgDisc: {
    position: "absolute",
    right: -110,
    top: "50%",
    transform: "translateY(-50%)",
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "repeating-radial-gradient(circle, #0c0a07 0 3px, #1a1810 3px 7px, #0c0a07 7px 10px)",
    border: "1px solid #2a2418",
    boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
    opacity: 0.65,
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bgDiscLabel: {
    width: 110,
    height: 110,
    borderRadius: "50%",
    background: "radial-gradient(circle, #1e1a10 0%, #141008 100%)",
    border: "1px solid #3a2e18",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 30px rgba(212,148,30,0.08)",
  },
  bgDiscHole: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "var(--night)",
    border: "1px solid #3a2e18",
  },

  header: { position: "relative", zIndex: 2, maxWidth: 560 },
  coinSlot: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.32em",
    color: "var(--gold)",
    marginBottom: 22,
    opacity: 0.65,
  },
  title: {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: "italic",
    fontSize: "clamp(56px, 10vw, 116px)",
    fontWeight: 700,
    lineHeight: 0.88,
    margin: "0 0 28px",
    color: "var(--parchment)",
    letterSpacing: "-0.025em",
  },
  subtitle: {
    fontSize: "clamp(15px, 1.7vw, 18px)",
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: "italic",
    fontWeight: 400,
    color: "var(--parchment-muted)",
    maxWidth: 440,
    lineHeight: 1.65,
    margin: 0,
  },

  // ── Controls ──
  controls: {
    maxWidth: 920,
    margin: "36px auto 0",
    position: "relative",
    zIndex: 1,
  },
  sectionRule: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  sectionRuleLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9.5,
    letterSpacing: "0.35em",
    color: "var(--parchment-dim)",
    whiteSpace: "nowrap",
  },
  searchRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  buttonRow: { display: "flex", gap: 10, marginTop: 10 },
  input: {
    flex: "1 1 280px",
    padding: "16px 20px",
    fontSize: 16,
    fontFamily: "'Syne', sans-serif",
    fontWeight: 500,
    background: "var(--night-2)",
    border: "1px solid var(--night-4)",
    borderRadius: 10,
    color: "var(--parchment)",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  digBtn: {
    flex: 1,
    padding: "16px 30px",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    background: "var(--gold)",
    color: "var(--night)",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    transition: "background 0.15s",
  },
  surpriseBtn: {
    flex: 1,
    padding: "16px 22px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "0.04em",
    background: "transparent",
    color: "var(--gold)",
    border: "1px solid var(--gold-dim)",
    borderRadius: 10,
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
  },

  dialWrap: {
    marginTop: 20,
    background: "var(--night-2)",
    border: "1px solid var(--night-4)",
    borderRadius: 12,
    padding: "20px 24px 18px",
  },
  dialHead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 8,
  },
  dialLabel: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 17,
    fontWeight: 700,
    color: "var(--gold)",
    letterSpacing: "-0.01em",
  },
  dialBlurb: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: "var(--parchment-muted)",
  },
  dialTicks: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 16,
  },
  tick: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
  },

  fillWrap: {
    marginTop: 14,
    background: "var(--night-2)",
    border: "1px solid var(--night-4)",
    borderRadius: 12,
    padding: "16px 22px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  fillLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "var(--parchment-muted)",
    whiteSpace: "nowrap",
  },
  fillChips: { display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" },
  fillChip: {
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'IBM Plex Mono', monospace",
    background: "transparent",
    color: "var(--parchment-muted)",
    border: "1px solid var(--night-4)",
    borderRadius: 999,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  fillChipOn: {
    background: "var(--gold)",
    color: "var(--night)",
    borderColor: "var(--gold)",
  },
  fillCustom: { display: "flex", alignItems: "center", gap: 5, marginLeft: 2 },
  fillInput: {
    width: 58,
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "'IBM Plex Mono', monospace",
    background: "var(--night-3)",
    border: "1px solid var(--night-4)",
    borderRadius: 8,
    color: "var(--parchment)",
    outline: "none",
  },
  fillUnit: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: "var(--parchment-muted)",
  },

  error: {
    maxWidth: 920,
    margin: "16px auto 0",
    padding: "12px 18px",
    background: "rgba(192,57,43,0.1)",
    border: "1px solid rgba(192,57,43,0.4)",
    borderRadius: 10,
    color: "#e06858",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13,
    textAlign: "center",
  },

  // ── Body ──
  body: {
    maxWidth: 920,
    margin: "28px auto 0",
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 270px",
    gap: 22,
    alignItems: "start",
  },
  resultsCol: { display: "flex", flexDirection: "column", gap: 7, minHeight: 200 },

  empty: {
    textAlign: "center",
    padding: "64px 20px",
    color: "var(--parchment-muted)",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12,
    lineHeight: 1.7,
  },
  emptyDisc: {
    width: 86,
    height: 86,
    borderRadius: "50%",
    margin: "0 auto",
    background: "repeating-radial-gradient(circle, #0c0a07 0 3px, #1a1810 3px 6px)",
    border: "2px solid var(--gold-dim)",
    boxShadow: "0 0 30px rgba(212,148,30,0.06)",
  },

  // ── Track rows ──
  row: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "13px 16px 13px 14px",
    background: "var(--night-2)",
    border: "1px solid var(--night-4)",
    borderLeft: "3px solid var(--gold-dim)", // overridden inline per-track
    borderRadius: 10,
    transition: "transform 0.15s, border-color 0.15s",
    cursor: "pointer",
    position: "relative",
  },
  rowPlaying: {
    background: "var(--night-3)",
    borderColor: "var(--gold) !important",
    boxShadow: "0 0 0 1px rgba(212,148,30,0.15), 0 4px 20px rgba(0,0,0,0.35)",
  },
  discWrap: { position: "relative", width: 34, height: 34, flexShrink: 0 },
  disc: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "repeating-radial-gradient(circle, #080604 0 2px, #181410 2px 4px)",
    boxShadow: "0 0 0 1px var(--night-4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  discHole: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: "var(--gold)",
    boxShadow: "0 0 6px rgba(212,148,30,0.4)",
  },
  eqBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    background: "var(--gold)",
    color: "var(--night)",
    fontSize: 9,
    width: 16,
    height: 16,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "var(--parchment)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  rowMeta: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: "var(--parchment-muted)",
    marginTop: 3,
  },
  rowNote: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: "var(--gold)",
    marginTop: 5,
    opacity: 0.75,
  },
  rowActions: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1px solid var(--gold-dim)",
    background: "transparent",
    color: "var(--gold)",
    fontSize: 19,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
  },
  addBtnDone: {
    background: "var(--gold)",
    color: "var(--night)",
    borderColor: "var(--gold)",
    cursor: "default",
    fontSize: 15,
  },
  branchBtn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.04em",
    color: "var(--parchment-muted)",
    background: "transparent",
    border: "1px solid var(--night-4)",
    borderRadius: 999,
    padding: "3px 9px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s",
  },
  addAllBtn: {
    marginTop: 4,
    padding: "14px",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    background: "transparent",
    color: "var(--gold)",
    border: "1px solid var(--gold-dim)",
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  addAllDone: {
    color: "var(--parchment-muted)",
    borderColor: "var(--night-4)",
    cursor: "default",
  },

  // ── ObscurityMeter ──
  meter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    width: 38,
    flexShrink: 0,
  },
  meterBars: { display: "flex", alignItems: "flex-end", gap: 2, height: 20 },
  meterBar: { width: 4, borderRadius: 2 },
  meterLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 8,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },

  // ── Stack ──
  stackCol: {
    background: "var(--night-2)",
    border: "1px solid var(--night-4)",
    borderRadius: 12,
    padding: 18,
    position: "sticky",
    top: 20,
  },
  stackHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9.5,
    letterSpacing: "0.28em",
    color: "var(--parchment-muted)",
    paddingBottom: 14,
    borderBottom: "1px solid var(--night-4)",
    textTransform: "uppercase",
  },
  stackCount: {
    background: "var(--gold)",
    color: "var(--night)",
    borderRadius: 999,
    padding: "1px 9px",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.05em",
  },
  fillMeter: { marginTop: 14 },
  fillMeterTop: {
    display: "flex",
    justifyContent: "space-between",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10.5,
    color: "var(--parchment-muted)",
    marginBottom: 6,
  },
  fillTrack: { height: 2, background: "var(--night-4)", borderRadius: 2, overflow: "hidden" },
  fillBar: { height: "100%", borderRadius: 2, transition: "width 0.4s cubic-bezier(0.2,0.8,0.2,1)" },
  stackEmpty: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11.5,
    color: "var(--parchment-muted)",
    lineHeight: 1.65,
    marginTop: 16,
  },
  stackList: {
    display: "flex",
    flexDirection: "column",
    marginTop: 14,
    maxHeight: 420,
    overflowY: "auto",
  },
  stackItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 0",
    borderBottom: "1px solid var(--night-4)",
  },
  stackNum: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    color: "var(--gold)",
    fontWeight: 700,
    flexShrink: 0,
    opacity: 0.6,
    width: 20,
  },
  stackItemTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: "var(--parchment)",
  },
  stackItemArtist: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    color: "var(--parchment-muted)",
    marginTop: 1,
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "var(--parchment-muted)",
    fontSize: 17,
    cursor: "pointer",
    flexShrink: 0,
    lineHeight: 1,
    opacity: 0.45,
    transition: "opacity 0.15s",
    padding: "0 2px",
  },
  copyBtn: {
    marginTop: 16,
    width: "100%",
    padding: "12px",
    background: "var(--gold)",
    border: "none",
    color: "var(--night)",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Syne', sans-serif",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    transition: "background 0.15s",
  },
};
