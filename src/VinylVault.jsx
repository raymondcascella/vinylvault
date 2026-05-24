import React, { useState, useRef } from "react";
import { searchByTag, searchByArtist, branchFromTrack, detectQueryType } from "./lastfm";

// ── Vinyl Vault ───────────────────────────────────────────────
// A Wurlitzer-jukebox song picker. Name an artist, genre, or mood;
// it pulls records leaning toward deeper cuts. Tune with the dial,
// load up your stack, play the whole set.

const DEPTH_LABELS = [
  { v: 0, label: "Top of the Charts", blurb: "The songs everyone knows" },
  { v: 1, label: "Fan Favorites", blurb: "Popular, plus a few sleepers" },
  { v: 2, label: "Selectin' Deep", blurb: "Mostly lesser-known, some popular" },
  { v: 3, label: "Deep Cuts", blurb: "Album tracks & B-sides" },
  { v: 4, label: "Buried in the Stacks", blurb: "Obscurities only diehards know" },
];

// Surprise seeds, split into two curated lists. Surprise Me pulls from both.
// Each is only a STARTING POINT — the depth dial + coin flip dig outward from it.
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

      // Sort by depth: depth 0-2 = least obscure first, depth 3-4 = most obscure first
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
    const text = playlist.map((s) => `${s.artist} — ${s.title} (${s.year})`).join("\n");
    navigator.clipboard?.writeText(text);
  }

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* ── Jukebox crown ── */}
      <div style={S.cabinet} className="vv-cabinet">
        <div style={S.archGlow} aria-hidden />
        <div style={S.bubblerLeft} className="bubbler vv-bubbler-l" aria-hidden />
        <div style={S.bubblerRight} className="bubbler vv-bubbler-r" aria-hidden />

        <header style={S.header}>
          <div style={S.coinSlot}>◉ DROP A COIN · MAKE YOUR SELECTION</div>
          <h1 style={S.title} className="vv-title">Vinyl Vault</h1>
          <p style={S.subtitle}>
            Name an artist, a genre, a mood. The Vault skips the jukebox staples
            and reaches for the rare pressings locked away in the back.
          </p>
        </header>
      </div>

      {/* ── Controls ── */}
      <section style={S.controls}>
        <div style={S.searchRow}>
          <input
            style={S.input}
            placeholder="Sam Cooke · Northern soul · slow dance · desert blues…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && dig()}
          />
        </div>
        <div style={S.buttonRow}>
          <button style={S.digBtn} className="vv-btn" onClick={() => dig()} disabled={loading}>
            {loading ? "Cueing…" : "Make Selection"}
          </button>
          <button style={S.surpriseBtn} className="vv-btn" onClick={surprise} disabled={loading} title="Drop a random idea into the box">
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
              <span key={d.v} style={{ ...S.tick, color: d.v === depth ? "var(--red)" : "var(--ink-soft)" }}>
                {d.v <= depth ? "●" : "○"}
              </span>
            ))}
          </div>
        </div>

        <div style={S.fillWrap}>
          <span style={S.fillLabel}>Fill up to</span>
          <div style={S.fillChips}>
            {[
              { m: 30, t: "30 min" },
              { m: 60, t: "1 hr" },
              { m: 90, t: "90 min" },
              { m: 120, t: "2 hr" },
              { m: 180, t: "3 hr" },
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

      {/* ── Results ── */}
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
              <p style={{ marginTop: 18 }}>Pulling 45s for “{lastQuery || query}”…</p>
            </div>
          )}

          {!loading &&
            results.map((song, i) => {
              const playing = nowPlaying === song._id;
              return (
              <article
                key={song._id}
                className="record-row"
                style={{ ...S.row, ...(playing ? S.rowPlaying : {}), animationDelay: `${i * 55}ms` }}
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
                    onClick={(e) => { e.stopPropagation(); dig(query, song); }}
                    disabled={loading}
                    title={`Find more like "${song.title}"`}
                  >
                    ⌕ more like this
                  </button>
                </div>
              </article>
              );
            })}

          {!loading && results.length > 0 && (
            <button style={{ ...S.addAllBtn, ...(allQueued ? S.addAllDone : {}) }} onClick={addAll} disabled={allQueued}>
              {allQueued ? "✓ All loaded into the stack" : `▾ Load all ${results.length} into the stack`}
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
              <span style={{ color: remaining > 0 ? "var(--ink-soft)" : "var(--red)" }}>
                {remaining > 0 ? `${fmtClock(remaining)} to go` : remaining < -30 ? `${fmtClock(-remaining)} over` : "full ✓"}
              </span>
            </div>
            <div style={S.fillTrack}>
              <div style={{ ...S.fillBar, width: `${fillPct}%`, background: fillPct >= 100 ? "var(--red)" : "linear-gradient(90deg, #e7c067, #c0392b)" }} />
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
  return (
    <div style={S.meter} title={`Obscurity ${value}/100`}>
      <div style={S.meterBars}>
        {Array.from({ length: bars }).map((_, i) => (
          <span key={i} style={{ ...S.meterBar, background: i < filled ? "var(--red)" : "rgba(60,30,15,0.18)", height: 5 + i * 4 }} />
        ))}
      </div>
      <span style={S.meterLabel}>{value > 66 ? "rare" : value > 33 ? "cut" : "known"}</span>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Monoton&family=Fraunces:opsz,wght@9..144,400..800&family=DM+Mono:wght@400;500&display=swap');

* { box-sizing: border-box; }

.depth-dial {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 6px; border-radius: 6px;
  background: linear-gradient(90deg, #d9b86a, #c0392b);
  outline: none; cursor: pointer;
}
.depth-dial::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 30px; height: 30px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff7e6, #d9b86a 60%, #a8842f);
  border: 3px solid #6e2a1a;
  box-shadow: 0 3px 10px rgba(110,42,26,0.5); cursor: grab;
}
.depth-dial::-moz-range-thumb {
  width: 30px; height: 30px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff7e6, #d9b86a 60%, #a8842f);
  border: 3px solid #6e2a1a; cursor: grab;
}
.record-row { animation: slideIn 0.45s cubic-bezier(0.2,0.8,0.2,1) backwards; }
@keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.record-row:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(110,42,26,0.18); }
.spin-slow { animation: spin 8s linear infinite; }
.spin-fast { animation: spin 1.1s linear infinite; }
.spin-45 { animation: spin 1.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.disc { transition: box-shadow 0.2s; }
.record-row:hover .disc { box-shadow: 0 0 0 2px var(--amber); }
.bubbler { animation: bubble 3.5s ease-in-out infinite; }
@keyframes bubble { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
::-webkit-scrollbar { width: 10px; }
::-webkit-scrollbar-thumb { background: rgba(110,42,26,0.3); border-radius: 10px; }
@media (max-width: 760px) {
  .sel-body { grid-template-columns: 1fr !important; }
  .sel-stack { position: static !important; }
}
@media (max-width: 480px) {
  .vv-cabinet { padding-left: 30px !important; padding-right: 30px !important; border-radius: 90px 90px 20px 20px !important; }
  .vv-title { font-size: 13vw !important; }
  .vv-bubbler-l { left: 8px !important; width: 8px !important; }
  .vv-bubbler-r { right: 8px !important; width: 8px !important; }
  .vv-btn { padding-left: 12px !important; padding-right: 12px !important; font-size: 15px !important; }
}
.vv-btn { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
`;

const S = {
  root: {
    "--cream": "#f6e8c8",
    "--cream-deep": "#efd9a8",
    "--amber": "#d9a441",
    "--butter": "#e7c067",
    "--red": "#c0392b",
    "--red-deep": "#8e2b20",
    "--ink": "#3a241a",
    "--ink-soft": "#7a5a44",
    minHeight: "100vh",
    background:
      "radial-gradient(130% 70% at 50% -5%, #f9efd6 0%, #f1dcae 45%, #e7c98f 100%)",
    color: "var(--ink)",
    fontFamily: "'Fraunces', serif",
    padding: "clamp(16px, 4vw, 44px)",
    position: "relative",
    overflow: "hidden",
  },
  cabinet: {
    position: "relative",
    maxWidth: 860,
    margin: "0 auto",
    background: "linear-gradient(170deg, #fbf2da 0%, #f3deb0 100%)",
    border: "3px solid var(--red-deep)",
    borderRadius: "180px 180px 26px 26px",
    padding: "clamp(30px,5vw,52px) clamp(24px,5vw,56px) 38px",
    boxShadow: "inset 0 3px 0 rgba(255,255,255,0.7), 0 18px 50px rgba(110,42,26,0.28)",
    overflow: "hidden",
  },
  archGlow: {
    position: "absolute",
    top: -60,
    left: "50%",
    transform: "translateX(-50%)",
    width: "120%",
    height: 200,
    background: "radial-gradient(50% 100% at 50% 100%, rgba(231,192,103,0.6), transparent 70%)",
    pointerEvents: "none",
  },
  bubblerLeft: {
    position: "absolute",
    left: 14,
    top: 70,
    bottom: 24,
    width: 12,
    borderRadius: 12,
    background: "linear-gradient(180deg, #e7c067, #c0392b)",
    boxShadow: "0 0 14px rgba(217,164,65,0.8)",
  },
  bubblerRight: {
    position: "absolute",
    right: 14,
    top: 70,
    bottom: 24,
    width: 12,
    borderRadius: 12,
    background: "linear-gradient(180deg, #e7c067, #c0392b)",
    boxShadow: "0 0 14px rgba(217,164,65,0.8)",
    animationDelay: "1.2s",
  },
  header: { position: "relative", textAlign: "center", zIndex: 1 },
  coinSlot: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11.5,
    letterSpacing: "0.22em",
    color: "var(--red-deep)",
    marginBottom: 14,
  },
  title: {
    fontFamily: "'Monoton', sans-serif",
    fontSize: "clamp(40px, 8.5vw, 84px)",
    lineHeight: 1,
    margin: 0,
    color: "var(--red)",
    textShadow: "0 1px 0 #fff5dc, 0 3px 0 rgba(142,43,32,0.4), 0 6px 18px rgba(192,57,43,0.35)",
    letterSpacing: "0.02em",
  },
  subtitle: {
    marginTop: 18,
    fontSize: "clamp(15px, 1.8vw, 18px)",
    color: "var(--ink)",
    maxWidth: 520,
    margin: "18px auto 0",
    lineHeight: 1.55,
    fontWeight: 500,
  },
  controls: { maxWidth: 860, margin: "32px auto 0", position: "relative", zIndex: 1 },
  searchRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  buttonRow: { display: "flex", gap: 10, marginTop: 10 },
  input: {
    flex: "1 1 280px",
    padding: "16px 20px",
    fontSize: 17,
    fontFamily: "'Fraunces', serif",
    fontWeight: 500,
    background: "#fffaf0",
    border: "2px solid var(--amber)",
    borderRadius: 12,
    color: "var(--ink)",
    outline: "none",
    boxShadow: "inset 0 2px 5px rgba(110,42,26,0.1)",
  },
  digBtn: {
    flex: 1,
    padding: "16px 30px",
    fontSize: 17,
    fontWeight: 700,
    fontFamily: "'Fraunces', serif",
    background: "linear-gradient(180deg, #d44637, #a8291c)",
    color: "#fff4df",
    border: "2px solid #7a2016",
    borderRadius: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 0 #7a2016, 0 6px 14px rgba(142,43,32,0.4)",
  },
  dialWrap: {
    marginTop: 24,
    background: "#fffaf0",
    border: "2px solid var(--amber)",
    borderRadius: 16,
    padding: "18px 24px 16px",
    boxShadow: "inset 0 2px 6px rgba(110,42,26,0.08)",
  },
  dialHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 6 },
  dialLabel: { fontSize: 21, fontWeight: 700, color: "var(--red-deep)", letterSpacing: "-0.01em" },
  dialBlurb: { fontFamily: "'DM Mono', monospace", fontSize: 12.5, color: "var(--ink-soft)" },
  dialTicks: { display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 12 },
  tick: { fontFamily: "'DM Mono', monospace" },
  fillWrap: {
    marginTop: 20,
    background: "#fffaf0",
    border: "2px solid var(--amber)",
    borderRadius: 16,
    padding: "16px 22px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    boxShadow: "inset 0 2px 6px rgba(110,42,26,0.08)",
  },
  fillLabel: { fontSize: 17, fontWeight: 700, color: "var(--red-deep)", fontFamily: "'Fraunces', serif" },
  fillChips: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  fillChip: {
    padding: "8px 14px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'DM Mono', monospace",
    background: "transparent",
    color: "var(--ink-soft)",
    border: "2px solid var(--cream-deep)",
    borderRadius: 999,
    cursor: "pointer",
  },
  fillChipOn: { background: "var(--red)", color: "#fff4df", borderColor: "var(--red)" },
  fillCustom: { display: "flex", alignItems: "center", gap: 5, marginLeft: 4 },
  fillInput: {
    width: 62,
    padding: "8px 10px",
    fontSize: 14,
    fontFamily: "'DM Mono', monospace",
    background: "#fff",
    border: "2px solid var(--amber)",
    borderRadius: 10,
    color: "var(--ink)",
    outline: "none",
  },
  fillUnit: { fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--ink-soft)" },
  fillMeter: { marginTop: 14 },
  fillMeterTop: {
    display: "flex",
    justifyContent: "space-between",
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    color: "var(--ink-soft)",
    marginBottom: 7,
  },
  fillTrack: { height: 9, background: "var(--cream-deep)", borderRadius: 9, overflow: "hidden" },
  fillBar: { height: "100%", borderRadius: 9, transition: "width 0.4s cubic-bezier(0.2,0.8,0.2,1)" },
  error: {
    maxWidth: 860,
    margin: "20px auto 0",
    padding: "12px 18px",
    background: "rgba(192,57,43,0.1)",
    border: "2px solid var(--red)",
    borderRadius: 12,
    color: "var(--red-deep)",
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    textAlign: "center",
  },
  body: {
    maxWidth: 860,
    margin: "34px auto 0",
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 300px",
    gap: 26,
    position: "relative",
    zIndex: 1,
    alignItems: "start",
  },
  resultsCol: { display: "flex", flexDirection: "column", gap: 11, minHeight: 200 },
  empty: { textAlign: "center", padding: "56px 20px", color: "var(--ink-soft)", fontFamily: "'DM Mono', monospace", fontSize: 14 },
  emptyDisc: {
    width: 92,
    height: 92,
    borderRadius: "50%",
    margin: "0 auto",
    background: "repeating-radial-gradient(circle, #3a241a 0 3px, #6e4a32 3px 6px)",
    border: "4px solid #d9a441",
    boxShadow: "0 0 0 2px #8e2b20",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    background: "linear-gradient(180deg, #fffaf0, #fbedcf)",
    border: "2px solid var(--cream-deep)",
    borderRadius: 14,
    transition: "transform 0.18s, box-shadow 0.18s",
    cursor: "pointer",
  },
  rowPlaying: {
    borderColor: "var(--red)",
    background: "linear-gradient(180deg, #fff6e0, #ffe9c4)",
    boxShadow: "0 6px 18px rgba(192,57,43,0.22)",
  },
  discWrap: { position: "relative", width: 38, height: 38, flexShrink: 0, cursor: "pointer" },
  disc: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "repeating-radial-gradient(circle, #2a1810 0 2px, #4a2f1e 2px 4px)",
    boxShadow: "0 0 0 1px var(--red-deep)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  discHole: { width: 11, height: 11, borderRadius: "50%", background: "var(--red)", boxShadow: "inset 0 0 0 2px #fff4df" },
  eqBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    background: "var(--red)",
    color: "#fff4df",
    fontSize: 11,
    width: 18,
    height: 18,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 8px rgba(217,164,65,0.9)",
  },
  surpriseBtn: {
    flex: 1,
    padding: "16px 22px",
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "'Fraunces', serif",
    background: "#fffaf0",
    color: "var(--red-deep)",
    border: "2px solid var(--amber)",
    borderRadius: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 0 var(--amber)",
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)" },
  rowMeta: { fontFamily: "'DM Mono', monospace", fontSize: 12.5, color: "var(--red-deep)", marginTop: 2 },
  rowNote: { fontSize: 14, color: "var(--ink-soft)", marginTop: 6, fontStyle: "italic" },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "2px solid var(--red)",
    background: "#fffaf0",
    color: "var(--red)",
    fontSize: 22,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
    lineHeight: 1,
  },
  addBtnDone: { background: "var(--red)", color: "#fff4df", cursor: "default" },
  rowActions: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 },
  branchBtn: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.02em",
    color: "var(--red-deep)",
    background: "transparent",
    border: "1px solid var(--cream-deep)",
    borderRadius: 999,
    padding: "3px 9px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  addAllBtn: {
    marginTop: 6,
    padding: "15px",
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "'Fraunces', serif",
    background: "linear-gradient(180deg, #e7c067, #cfa23f)",
    color: "var(--ink)",
    border: "2px solid #a8842f",
    borderRadius: 14,
    cursor: "pointer",
    boxShadow: "0 4px 0 #a8842f, 0 6px 14px rgba(168,132,47,0.35)",
  },
  addAllDone: {
    background: "#efe0bd",
    color: "var(--ink-soft)",
    boxShadow: "none",
    cursor: "default",
  },
  meter: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 42, flexShrink: 0 },
  meterBars: { display: "flex", alignItems: "flex-end", gap: 2, height: 22 },
  meterBar: { width: 4, borderRadius: 2 },
  meterLabel: { fontFamily: "'DM Mono', monospace", fontSize: 9.5, letterSpacing: "0.05em", color: "var(--ink-soft)", textTransform: "uppercase" },
  stackCol: {
    background: "linear-gradient(180deg, #fffaf0, #f6e6c4)",
    border: "2px solid var(--amber)",
    borderRadius: 18,
    padding: 20,
    position: "sticky",
    top: 20,
    boxShadow: "0 8px 24px rgba(110,42,26,0.12)",
  },
  stackHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    letterSpacing: "0.2em",
    color: "var(--red-deep)",
    paddingBottom: 14,
    borderBottom: "2px solid var(--cream-deep)",
  },
  stackCount: { background: "var(--red)", color: "#fff4df", borderRadius: 20, padding: "1px 11px", fontWeight: 700 },
  stackEmpty: { fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5, marginTop: 16 },
  stackList: { display: "flex", flexDirection: "column", gap: 4, marginTop: 14, maxHeight: 440, overflowY: "auto" },
  stackItem: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px dashed var(--cream-deep)" },
  stackNum: { fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--amber)", fontWeight: 700, flexShrink: 0 },
  stackItemTitle: { fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink)" },
  stackItemArtist: { fontFamily: "'DM Mono', monospace", fontSize: 11.5, color: "var(--red-deep)" },
  removeBtn: { background: "none", border: "none", color: "var(--ink-soft)", fontSize: 20, cursor: "pointer", flexShrink: 0, lineHeight: 1 },
  copyBtn: {
    marginTop: 16,
    width: "100%",
    padding: "13px",
    background: "linear-gradient(180deg, #d44637, #a8291c)",
    border: "2px solid #7a2016",
    color: "#fff4df",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Fraunces', serif",
    boxShadow: "0 3px 0 #7a2016",
  },
};
