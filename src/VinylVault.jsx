import React, { useState, useRef } from "react";
import { searchByTag, searchByArtist, branchFromTrack, detectQueryType } from "./lastfm";

// ── Constants ──────────────────────────────────────────────────────────────────

const DEPTH_LABELS = [
  { v: 0, label: "Top of the Charts", blurb: "The songs everyone knows" },
  { v: 1, label: "Fan Favorites",      blurb: "Popular, plus a few sleepers" },
  { v: 2, label: "Selectin' Deep",     blurb: "Mostly lesser-known, some popular" },
  { v: 3, label: "Deep Cuts",          blurb: "Album tracks & B-sides" },
  { v: 4, label: "Buried in the Stacks", blurb: "Obscurities only diehards know" },
];

// Classic 45rpm label colors — Stax, Blue Note, Chess, Riverside, King, Specialty
const LABEL_COLORS = [
  { bg: "linear-gradient(145deg,#d42020 0%,#8e0a0a 100%)", rim: "#ff6040" },
  { bg: "linear-gradient(145deg,#1650b8 0%,#0b2e78 100%)", rim: "#4888ff" },
  { bg: "linear-gradient(145deg,#c89010 0%,#7a5400 100%)", rim: "#f0c030" },
  { bg: "linear-gradient(145deg,#1a8040 0%,#0a4820 100%)", rim: "#30d070" },
  { bg: "linear-gradient(145deg,#c05010 0%,#7a2800 100%)", rim: "#f07830" },
  { bg: "linear-gradient(145deg,#8820a0 0%,#4a0868 100%)", rim: "#cc50f0" },
];

const GENRE_SEEDS = [
  "Northern soul","dub reggae","krautrock","bossa nova","Tropicália",
  "post-punk","desert blues","doo-wop","shoegaze","spiritual jazz",
  "city pop","swamp rock","library music","Afrobeat","outlaw country",
  "psychedelic cumbia","lovers rock","freakbeat","yacht rock","minimal wave",
  "honky-tonk","Delta blues","hard bop","surf rock","garage rock",
  "dream pop","post-rock","highlife","fado","free jazz",
  "bluegrass","zydeco","mbaqanga","ethio-jazz","Philly soul",
  "deep funk","jangle pop","slowcore","trip-hop","acid jazz",
];
const VIBE_SEEDS = [
  "rainy Sunday","late-night drive","golden hour","last call","3am insomnia",
  "summer cookout","slow dance","road trip through the desert",
  "smoky basement club","front porch evening","snowed-in cabin",
  "dusty record shop","neon city after midnight","lazy hungover morning",
  "campfire singalong","dinner party warm-up","walking in the cold",
  "falling in love","getting over someone","sunrise comedown",
  "beach at dusk","autumn melancholy","quiet contemplation",
  "dancing alone in the kitchen","long train ride",
];
const SURPRISE_SEEDS = [...GENRE_SEEDS, ...VIBE_SEEDS];

// ── Subcomponents ──────────────────────────────────────────────────────────────

function BubbleTube({ mirror }) {
  return (
    <div className="vv-tube" style={mirror ? S.tubeRight : S.tubeLeft} aria-hidden>
      <div style={S.tubeGlass}>
        <div className="vv-bubble vv-b1" />
        <div className="vv-bubble vv-b2" />
        <div className="vv-bubble vv-b3" />
        <div className="vv-bubble vv-b4" />
        <div className="vv-bubble vv-b5" />
      </div>
      <div style={S.tubeShine} />
    </div>
  );
}

function ObscurityMeter({ value }) {
  const bars  = 5;
  const filled = Math.round((value / 100) * bars);
  const color  = value > 66 ? "#c0392b" : value > 33 ? "#d9a441" : "#b8975a";
  const label  = value > 66 ? "rare" : value > 33 ? "cut" : "known";
  return (
    <div style={S.meter} title={`Obscurity ${value}/100`}>
      <div style={S.meterBars}>
        {Array.from({ length: bars }).map((_, i) => (
          <span key={i} style={{
            ...S.meterBar,
            background: i < filled ? color : "rgba(60,30,10,0.18)",
            height: 5 + i * 4,
          }} />
        ))}
      </div>
      <span style={{ ...S.meterLabel, color }}>{label}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function VinylVault() {
  const [query,      setQuery]      = useState("");
  const [depth,      setDepth]      = useState(2);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [results,    setResults]    = useState([]);
  const [playlist,   setPlaylist]   = useState([]);
  const [lastQuery,  setLastQuery]  = useState("");
  const [nowPlaying, setNowPlaying] = useState(null);
  const [targetMin,  setTargetMin]  = useState(60);
  const listRef  = useRef(null);
  const stackRef = useRef(null);

  const depthInfo     = DEPTH_LABELS[depth];
  const stackSeconds  = playlist.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  const targetSeconds = targetMin * 60;
  const fillPct       = targetSeconds > 0 ? Math.min(100, (stackSeconds / targetSeconds) * 100) : 0;
  const remaining     = targetSeconds - stackSeconds;

  function fmtClock(totalSec) {
    const s = Math.max(0, Math.round(totalSec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`;
  }
  function fmtTrack(sec) {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2,"0")}`;
  }

  function surprise() {
    setQuery(SURPRISE_SEEDS[Math.floor(Math.random() * SURPRISE_SEEDS.length)]);
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
          tracks = await searchByArtist(q.trim(), trackCount, Math.random() < 0.5);
        } else {
          tracks = await searchByTag(q.trim(), trackCount);
          if (tracks.length === 0) tracks = await searchByArtist(q.trim(), trackCount, true);
        }
      }
      const sorted = [...tracks].sort((a, b) =>
        depth <= 2 ? a.obscurity - b.obscurity : b.obscurity - a.obscurity
      );
      setResults(sorted.map((p, i) => ({ ...p, _id: `${Date.now()}-${i}` })));
      setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch {
      setError("Couldn't load selections — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const keyOf       = (s) => `${s.artist}__${s.title}`.toLowerCase();
  const inStack     = (song) => playlist.some((x) => keyOf(x) === keyOf(song));
  const allQueued   = results.length > 0 && results.every(inStack);

  function addToStack(song) {
    setPlaylist((p) => p.some((x) => keyOf(x) === keyOf(song)) ? p : [...p, song]);
  }
  function addAll() {
    setPlaylist((p) => {
      const have  = new Set(p.map(keyOf));
      const fresh = results.filter((s) => !have.has(keyOf(s)));
      return [...p, ...fresh];
    });
    setTimeout(() => stackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  function removeFromStack(id) {
    setPlaylist((p) => p.filter((s) => s._id !== id));
  }
  function copyStack() {
    const text = playlist.map((s) =>
      `${s.artist} — ${s.title}${s.year ? ` (${s.year})` : ""}`
    ).join("\n");
    navigator.clipboard?.writeText(text);
  }

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* ── Wurlitzer Cabinet ── */}
      <div style={S.cabinet} className="vv-cabinet">
        {/* Chrome arch trim */}
        <div style={S.archChrome} aria-hidden />
        {/* Interior warm glow */}
        <div style={S.archGlow} aria-hidden />
        {/* Rainbow arch bloom */}
        <div style={S.archRainbow} aria-hidden />
        {/* Bubble tubes / rainbow pilasters */}
        <BubbleTube mirror={false} />
        <BubbleTube mirror={true} />

        <header style={S.header}>
          <div style={S.coinSlot}>◉ DROP A COIN · MAKE YOUR SELECTION</div>
          <h1 style={S.title} className="vv-title">Vinyl Vault</h1>
          <p style={S.subtitle}>
            Name an artist, a genre, a mood. The Vault skips the jukebox
            staples and reaches for the rare pressings locked in the back.
          </p>
        </header>
      </div>

      {/* ── Selection Panel ── */}
      <div style={S.panelWrap}>
        <section style={S.controls}>

          <div style={S.searchRow}>
            <input
              style={S.input}
              className="vv-input"
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
            <button style={S.surpriseBtn} className="vv-btn vv-surprise-btn" onClick={surprise} disabled={loading}>
              ⚄ Surprise Me
            </button>
          </div>

          {/* Depth dial */}
          <div style={S.dialWrap}>
            <div style={S.dialHead}>
              <span style={S.dialLabel}>{depthInfo.label}</span>
              <span style={S.dialBlurb}>{depthInfo.blurb}</span>
            </div>
            <input
              type="range" min="0" max="4" step="1"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="depth-dial"
            />
            <div style={S.dialTicks}>
              {DEPTH_LABELS.map((d) => (
                <span key={d.v} style={{
                  ...S.tick,
                  color: d.v === depth ? "var(--red)" : "var(--ink-soft)",
                }}>
                  {d.v <= depth ? "●" : "○"}
                </span>
              ))}
            </div>
          </div>

          {/* Fill target */}
          <div style={S.fillWrap}>
            <span style={S.fillLabel}>Fill up to</span>
            <div style={S.fillChips}>
              {[{ m:30,t:"30 min" },{ m:60,t:"1 hr" },{ m:90,t:"90 min" },{ m:120,t:"2 hr" },{ m:180,t:"3 hr" }].map((p) => (
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
                  type="number" min="1"
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
      </div>

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
              <p style={{ marginTop: 18 }}>Pulling 45s for "{lastQuery || query}"…</p>
            </div>
          )}

          {!loading && results.map((song, i) => {
            const playing = nowPlaying === song._id;
            const lc = LABEL_COLORS[i % LABEL_COLORS.length];
            return (
              <article
                key={song._id}
                className="record-row"
                style={{ ...S.row, ...(playing ? S.rowPlaying : {}), animationDelay: `${i * 55}ms` }}
                onClick={() => setNowPlaying(playing ? null : song._id)}
              >
                {/* Vinyl disc with colored 45rpm label */}
                <div style={S.discWrap}>
                  <div style={S.disc} className={playing ? "disc spin-45" : "disc"}>
                    {/* Grooves */}
                    <div style={{ ...S.discLabel, background: lc.bg, boxShadow: `0 0 0 1px ${lc.rim}44, inset 0 1px 3px rgba(255,255,255,0.25)` }}>
                      <div style={S.discHole} />
                    </div>
                  </div>
                  {playing && <span style={S.eqBadge} className="eq-badge">♫</span>}
                </div>

                <ObscurityMeter value={song.obscurity} />

                <div style={S.rowMain}>
                  <div style={S.rowTitle}>{song.title}</div>
                  <div style={S.rowMeta}>
                    {song.artist}
                    {song.year ? ` · ${song.year}` : ""}
                    {song.duration ? ` · ${fmtTrack(song.duration)}` : ""}
                  </div>
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
            <button
              style={{ ...S.addAllBtn, ...(allQueued ? S.addAllDone : {}) }}
              onClick={addAll}
              disabled={allQueued}
            >
              {allQueued ? "✓ All loaded into the stack" : `▾ Load all ${results.length} into the stack`}
            </button>
          )}
        </section>

        {/* ── The Stack ── */}
        <aside style={S.stackCol} className="sel-stack" ref={stackRef}>
          <div style={S.stackHead}>
            <span>THE STACK</span>
            <span style={S.stackCount}>{playlist.length}</span>
          </div>

          <div style={S.fillMeter}>
            <div style={S.fillMeterTop}>
              <span>{fmtClock(stackSeconds)} of {fmtClock(targetSeconds)}</span>
              <span style={{ color: remaining > 0 ? "var(--ink-soft)" : "var(--red)" }}>
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
                background: fillPct >= 100 ? "var(--red)" : "linear-gradient(90deg, #e7c067, #c0392b)",
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
                    <div style={{ overflow:"hidden", flex:1 }}>
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

// ── CSS ────────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Monoton&family=Fraunces:opsz,wght@9..144,400..800&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; }

/* ── Neon title flicker ── */
@keyframes neon-flicker {
  0%, 89%, 100% { opacity: 1; }
  90%  { opacity: 0.82; }
  91%  { opacity: 1;    }
  93%  { opacity: 0.68; }
  94%  { opacity: 1;    }
  96%  { opacity: 0.88; }
}
.vv-title {
  animation: neon-flicker 7s ease-in-out infinite;
}

/* ── Bubble tubes / rainbow pilasters ── */
.vv-tube {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 28px;
  border-radius: 6px;
  overflow: hidden;
}
@keyframes bubble-rise {
  0%   { transform: translateY(0);     opacity: 0;   }
  6%   { opacity: 0.9; }
  80%  { opacity: 0.75; }
  100% { transform: translateY(-320px); opacity: 0; }
}
.vv-bubble {
  position: absolute;
  bottom: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0.45);
  animation: bubble-rise linear infinite;
}
.vv-b1 { width: 5px; height: 6px;  left: 18%; animation-duration: 2.6s; animation-delay: 0.0s; }
.vv-b2 { width: 4px; height: 5px;  left: 58%; animation-duration: 3.3s; animation-delay: 0.9s; }
.vv-b3 { width: 6px; height: 7px;  left: 32%; animation-duration: 2.9s; animation-delay: 1.7s; }
.vv-b4 { width: 3px; height: 4px;  left: 70%; animation-duration: 3.8s; animation-delay: 0.4s; }
.vv-b5 { width: 5px; height: 5px;  left: 45%; animation-duration: 2.4s; animation-delay: 2.3s; }

/* ── Cabinet arch ── */
.vv-cabinet {
  border-radius: 200px 200px 28px 28px;
}

/* ── Depth dial ── */
.depth-dial {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 6px; border-radius: 6px;
  background: linear-gradient(90deg, #c9a24a, #c0392b);
  outline: none; cursor: pointer;
}
.depth-dial::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 30px; height: 30px; border-radius: 50%;
  background:
    radial-gradient(circle at 33% 28%, #fff9ee 0%, #f0ca60 35%, #c8952a 65%, #7a5010 100%);
  border: 3px solid #5a1a0a;
  box-shadow: 0 0 0 2px #c8952a, 0 4px 12px rgba(100,40,10,0.55);
  cursor: grab;
  transition: box-shadow 0.2s;
}
.depth-dial::-webkit-slider-thumb:hover {
  box-shadow: 0 0 0 3px #e8b030, 0 4px 16px rgba(100,40,10,0.7);
}
.depth-dial::-moz-range-thumb {
  width: 30px; height: 30px; border-radius: 50%;
  background: radial-gradient(circle at 33% 28%, #fff9ee, #f0ca60 35%, #c8952a 65%, #7a5010);
  border: 3px solid #5a1a0a; cursor: grab;
}

/* ── Track row entrance ── */
.record-row { animation: slideIn 0.45s cubic-bezier(0.2,0.8,0.2,1) backwards; }
@keyframes slideIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}
.record-row:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(100,40,10,0.22) !important; }

/* ── Disc spin ── */
.spin-slow { animation: spin 9s linear infinite; }
.spin-fast { animation: spin 1s linear infinite; }
.spin-45   { animation: spin 1.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.disc { transition: box-shadow 0.2s; }
.record-row:hover .disc { box-shadow: 0 0 0 2px var(--amber), 0 0 12px rgba(217,164,65,0.4) !important; }

/* ── eq badge pulse ── */
@keyframes eq-pulse { 0%,100% { box-shadow: 0 0 6px rgba(217,164,65,0.7); } 50% { box-shadow: 0 0 14px rgba(217,164,65,1); } }
.eq-badge { animation: eq-pulse 1s ease-in-out infinite; }

/* ── Inputs ── */
.vv-input:focus {
  border-color: var(--amber) !important;
  box-shadow: inset 0 2px 5px rgba(110,42,26,0.12), 0 0 0 3px rgba(217,164,65,0.2);
  outline: none;
}
.vv-dig-btn:not(:disabled):hover { filter: brightness(1.12); }
.vv-surprise-btn:not(:disabled):hover {
  background: #fff7e6 !important;
  box-shadow: 0 5px 0 var(--amber) !important;
}

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 10px; }
::-webkit-scrollbar-thumb { background: rgba(110,42,26,0.28); border-radius: 10px; }

/* ── Responsive ── */
@media (max-width: 760px) {
  .sel-body  { grid-template-columns: 1fr !important; }
  .sel-stack { position: static !important; }
}
@media (max-width: 500px) {
  .vv-cabinet { padding-left: 36px !important; padding-right: 36px !important; border-radius: 110px 110px 22px 22px !important; }
  .vv-title   { font-size: 12vw !important; }
  .vv-btn     { font-size: 15px !important; padding: 14px 14px !important; }
  .vv-tube    { width: 16px !important; }
}
.vv-btn { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
`;

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = {
  root: {
    "--cream":     "#f6e8c8",
    "--cream-deep":"#efd9a8",
    "--amber":     "#d9a441",
    "--butter":    "#e7c067",
    "--red":       "#c0392b",
    "--red-deep":  "#8e2b20",
    "--ink":       "#3a241a",
    "--ink-soft":  "#7a5a44",
    minHeight: "100vh",
    background: "radial-gradient(130% 70% at 50% -5%, #f9efd6 0%, #f1dcae 45%, #e7c98f 100%)",
    color: "var(--ink)",
    fontFamily: "'Fraunces', serif",
    padding: "clamp(14px,3.5vw,40px)",
    position: "relative",
    overflow: "hidden",
  },

  // ── Cabinet ──
  cabinet: {
    position: "relative",
    maxWidth: 860,
    margin: "0 auto",
    // Warm mahogany wood grain
    background: `
      repeating-linear-gradient(92deg,
        transparent 0px, transparent 5px,
        rgba(0,0,0,0.03) 5px, rgba(0,0,0,0.03) 6px,
        transparent 6px, transparent 12px,
        rgba(0,0,0,0.02) 12px, rgba(0,0,0,0.02) 13px
      ),
      linear-gradient(170deg, #6a2e10 0%, #4e1e08 50%, #3a1506 100%)
    `,
    // Four-sided chrome bezel (directional lighting: bright top-left, dark bottom-right)
    border: "5px solid",
    borderColor: "#e8d8b0 #9a7a40 #7a5a20 #c8a860",
    boxShadow: [
      "inset 0 4px 8px rgba(255,220,140,0.18)",
      "inset 0 -4px 12px rgba(0,0,0,0.45)",
      "inset 3px 0 6px rgba(255,200,100,0.1)",
      "inset -3px 0 6px rgba(0,0,0,0.3)",
      "0 24px 64px rgba(50,15,5,0.55)",
      "0 4px 0 rgba(50,15,5,0.4)",
    ].join(","),
    padding: "clamp(32px,5vw,54px) clamp(36px,6vw,68px) 38px",
    overflow: "hidden",
  },
  archChrome: {
    // Inner chrome rim following the arch
    position: "absolute",
    inset: 5,
    borderRadius: "190px 190px 18px 18px",
    border: "2px solid",
    borderColor: "rgba(255,220,140,0.4) rgba(255,200,100,0.15) rgba(0,0,0,0.2) rgba(255,220,140,0.3)",
    pointerEvents: "none",
    zIndex: 0,
  },
  archGlow: {
    // Warm amber interior glow from top
    position: "absolute",
    top: -80,
    left: "50%",
    transform: "translateX(-50%)",
    width: "130%",
    height: 260,
    background: "radial-gradient(50% 100% at 50% 100%, rgba(245,200,90,0.45), transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  archRainbow: {
    // Soft rainbow bloom radiating from the top of the arch dome
    position: "absolute",
    top: -20,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    height: 120,
    background: "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(255,40,40,0.22) 0%, rgba(255,160,0,0.18) 20%, rgba(240,220,0,0.15) 37%, rgba(20,200,80,0.14) 54%, rgba(30,120,255,0.16) 70%, rgba(160,20,200,0.14) 85%, transparent 100%)",
    pointerEvents: "none",
    zIndex: 0,
  },

  // Rainbow pilaster tubes (classic Wurlitzer segmented color columns)
  tubeLeft: {
    left: 8,
    background: `repeating-linear-gradient(180deg,
      #ff1020 0px,  #ff1020 18px,
      #ff8000 18px, #ff8000 36px,
      #f0d000 36px, #f0d000 54px,
      #10c840 54px, #10c840 72px,
      #0878ff 72px, #0878ff 90px,
      #9010c0 90px, #9010c0 108px
    )`,
    boxShadow: [
      "0 0 20px rgba(160,80,255,0.65)",
      "0 0 40px rgba(80,160,255,0.25)",
      "inset 3px 0 6px rgba(255,255,255,0.28)",
      "inset -1px 0 3px rgba(0,0,0,0.2)",
    ].join(","),
  },
  tubeRight: {
    right: 8,
    background: `repeating-linear-gradient(180deg,
      #9010c0 0px,  #9010c0 18px,
      #0878ff 18px, #0878ff 36px,
      #10c840 36px, #10c840 54px,
      #f0d000 54px, #f0d000 72px,
      #ff8000 72px, #ff8000 90px,
      #ff1020 90px, #ff1020 108px
    )`,
    boxShadow: [
      "0 0 20px rgba(255,100,30,0.65)",
      "0 0 40px rgba(255,200,50,0.25)",
      "inset -3px 0 6px rgba(255,255,255,0.28)",
      "inset 1px 0 3px rgba(0,0,0,0.2)",
    ].join(","),
  },
  tubeGlass: {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    overflow: "hidden",
  },
  tubeShine: {
    // Glass highlight on left side of tube
    position: "absolute",
    top: 0,
    left: 2,
    bottom: 0,
    width: 3,
    borderRadius: "10px 0 0 10px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 100%)",
    pointerEvents: "none",
  },

  header: { position: "relative", textAlign: "center", zIndex: 2 },
  coinSlot: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.24em",
    color: "#e8c878",
    marginBottom: 14,
    textShadow: "0 0 8px rgba(232,200,120,0.6)",
  },
  title: {
    fontFamily: "'Monoton', sans-serif",
    fontSize: "clamp(38px,8vw,82px)",
    lineHeight: 1.05,
    margin: 0,
    color: "#ff2800",
    // Layered neon glow: white core → red glow → deep shadow
    textShadow: [
      "0 0 4px #fff8dc",
      "0 0 10px rgba(255,80,20,0.9)",
      "0 0 24px rgba(255,40,0,0.65)",
      "0 0 50px rgba(220,30,0,0.4)",
      "0 3px 0 rgba(100,8,0,0.55)",
      "0 6px 16px rgba(180,30,10,0.35)",
    ].join(","),
    letterSpacing: "0.02em",
  },
  subtitle: {
    marginTop: 18,
    fontSize: "clamp(14px,1.7vw,17px)",
    color: "#e8d4a8",
    maxWidth: 500,
    margin: "18px auto 0",
    lineHeight: 1.55,
    fontWeight: 500,
    textShadow: "0 1px 3px rgba(0,0,0,0.4)",
  },

  // ── Selection Panel (controls) ──
  panelWrap: {
    maxWidth: 860,
    margin: "0 auto",
    background: "linear-gradient(180deg, #f3dfa8 0%, #ede0b0 100%)",
    border: "5px solid",
    borderColor: "#9a7a40 #7a5a20 #c8a860 #e8d8b0",
    borderTop: "none",
    borderRadius: "0 0 20px 20px",
    boxShadow: "0 16px 40px rgba(50,15,5,0.35), inset 0 2px 4px rgba(255,230,150,0.3)",
    padding: "0 clamp(24px,5vw,52px) 28px",
  },
  controls: { paddingTop: 28 },
  searchRow: { display:"flex", gap:10, flexWrap:"wrap" },
  buttonRow: { display:"flex", gap:10, marginTop:10 },
  input: {
    flex: "1 1 280px",
    padding: "15px 20px",
    fontSize: 16,
    fontFamily: "'Fraunces', serif",
    fontWeight: 500,
    background: "#fffaf0",
    border: "2px solid #c8a850",
    borderRadius: 10,
    color: "var(--ink)",
    outline: "none",
    boxShadow: "inset 0 2px 6px rgba(110,42,26,0.12), 0 1px 0 rgba(255,240,180,0.5)",
  },
  digBtn: {
    flex: 1,
    padding: "15px 28px",
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "'Fraunces', serif",
    background: "linear-gradient(180deg, #d84030 0%, #b02010 55%, #880e08 100%)",
    color: "#fff4df",
    border: "2px solid #6a0e06",
    borderRadius: 10,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: [
      "inset 0 1px 0 rgba(255,200,180,0.35)",
      "inset 0 -2px 0 rgba(0,0,0,0.3)",
      "0 5px 0 #5a0a04",
      "0 7px 16px rgba(140,20,10,0.45)",
    ].join(","),
    transition: "filter 0.15s",
  },
  surpriseBtn: {
    flex: 1,
    padding: "15px 20px",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "'Fraunces', serif",
    background: "#fffaf0",
    color: "var(--red-deep)",
    border: "2px solid var(--amber)",
    borderRadius: 10,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: [
      "inset 0 1px 0 rgba(255,255,220,0.6)",
      "0 4px 0 var(--amber)",
      "0 6px 12px rgba(168,132,47,0.3)",
    ].join(","),
    transition: "filter 0.15s, background 0.15s, box-shadow 0.15s",
  },
  dialWrap: {
    marginTop: 22,
    background: "#fffaf0",
    border: "2px solid #c8a850",
    borderRadius: 14,
    padding: "17px 22px 15px",
    boxShadow: "inset 0 2px 6px rgba(110,42,26,0.08), 0 1px 0 rgba(255,240,180,0.6)",
  },
  dialHead: {
    display:"flex", alignItems:"baseline", justifyContent:"space-between",
    marginBottom: 18, flexWrap:"wrap", gap: 6,
  },
  dialLabel: { fontSize: 20, fontWeight:700, color:"var(--red-deep)", letterSpacing:"-0.01em" },
  dialBlurb: { fontFamily:"'DM Mono', monospace", fontSize: 12, color:"var(--ink-soft)" },
  dialTicks: { display:"flex", justifyContent:"space-between", marginTop:13, fontSize:12 },
  tick: { fontFamily:"'DM Mono', monospace" },
  fillWrap: {
    marginTop: 16,
    background: "#fffaf0",
    border: "2px solid #c8a850",
    borderRadius: 14,
    padding: "14px 20px",
    display:"flex", alignItems:"center", gap:14, flexWrap:"wrap",
    boxShadow: "inset 0 2px 6px rgba(110,42,26,0.07), 0 1px 0 rgba(255,240,180,0.5)",
  },
  fillLabel: { fontSize: 16, fontWeight:700, color:"var(--red-deep)", fontFamily:"'Fraunces', serif", whiteSpace:"nowrap" },
  fillChips: { display:"flex", gap:7, flexWrap:"wrap", alignItems:"center" },
  fillChip: {
    padding: "7px 13px",
    fontSize: 13, fontWeight:600, fontFamily:"'DM Mono', monospace",
    background: "transparent", color:"var(--ink-soft)",
    border: "2px solid var(--cream-deep)",
    borderRadius: 999, cursor:"pointer", transition:"all 0.15s",
  },
  fillChipOn: { background:"var(--red)", color:"#fff4df", borderColor:"var(--red)" },
  fillCustom: { display:"flex", alignItems:"center", gap:5 },
  fillInput: {
    width: 60, padding:"7px 10px", fontSize:13,
    fontFamily:"'DM Mono', monospace",
    background:"#fff", border:"2px solid var(--amber)",
    borderRadius:8, color:"var(--ink)", outline:"none",
  },
  fillUnit: { fontFamily:"'DM Mono', monospace", fontSize:12, color:"var(--ink-soft)" },

  error: {
    maxWidth: 860, margin:"18px auto 0", padding:"12px 18px",
    background:"rgba(192,57,43,0.1)", border:"2px solid var(--red)",
    borderRadius:10, color:"var(--red-deep)",
    fontFamily:"'DM Mono', monospace", fontSize:13, textAlign:"center",
  },

  // ── Body ──
  body: {
    maxWidth: 860,
    margin: "30px auto 0",
    display:"grid",
    gridTemplateColumns: "minmax(0,1fr) 298px",
    gap: 24,
    alignItems:"start",
  },
  resultsCol: { display:"flex", flexDirection:"column", gap:10, minHeight:200 },

  empty: {
    textAlign:"center", padding:"56px 20px",
    color:"var(--ink-soft)", fontFamily:"'DM Mono', monospace", fontSize:13,
  },
  emptyDisc: {
    width: 88, height:88, borderRadius:"50%", margin:"0 auto",
    background: "repeating-radial-gradient(circle, #2a1810 0 2px, #4e3020 2px 4px, #2a1810 4px 6px)",
    border: "4px solid #c8a850",
    boxShadow: "0 0 0 2px #8e2b20, 0 0 20px rgba(200,168,80,0.25)",
  },

  // ── Record rows ──
  row: {
    display:"flex", alignItems:"center", gap:14,
    padding:"13px 15px",
    background:"linear-gradient(180deg, #fffaf2, #fbedcf)",
    border:"2px solid var(--cream-deep)",
    borderRadius:13,
    transition:"transform 0.18s, box-shadow 0.18s",
    cursor:"pointer",
    boxShadow:"0 2px 6px rgba(110,42,26,0.08)",
  },
  rowPlaying: {
    borderColor:"var(--red)",
    background:"linear-gradient(180deg, #fff6e0, #ffe9c4)",
    boxShadow:"0 6px 22px rgba(192,57,43,0.22), inset 0 0 0 1px rgba(192,57,43,0.12)",
  },

  // Vinyl disc
  discWrap: { position:"relative", width:44, height:44, flexShrink:0 },
  disc: {
    width:44, height:44, borderRadius:"50%",
    background:"repeating-radial-gradient(circle, #1a0e08 0 2px, #3a2018 2px 4px, #1a0e08 4px 6px)",
    boxShadow:"0 0 0 1px #5a2e10",
    display:"flex", alignItems:"center", justifyContent:"center",
  },
  discLabel: {
    width:"46%", height:"46%", borderRadius:"50%",
    display:"flex", alignItems:"center", justifyContent:"center",
  },
  discHole: {
    width:8, height:8, borderRadius:"50%",
    background:"rgba(255,240,200,0.9)",
    boxShadow:"inset 0 0 2px rgba(0,0,0,0.5)",
  },
  eqBadge: {
    position:"absolute", top:-6, right:-6,
    background:"var(--amber)", color:"#2a1008",
    fontSize:10, width:19, height:19, borderRadius:"50%",
    display:"flex", alignItems:"center", justifyContent:"center",
    fontWeight:700,
  },

  // Obscurity meter
  meter: { display:"flex", flexDirection:"column", alignItems:"center", gap:4, width:40, flexShrink:0 },
  meterBars: { display:"flex", alignItems:"flex-end", gap:2, height:22 },
  meterBar: { width:4, borderRadius:2 },
  meterLabel: { fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.06em", textTransform:"uppercase" },

  rowMain: { flex:1, minWidth:0 },
  rowTitle: { fontSize:18, fontWeight:700, letterSpacing:"-0.01em", color:"var(--ink)" },
  rowMeta:  { fontFamily:"'DM Mono', monospace", fontSize:12, color:"var(--red-deep)", marginTop:2 },
  rowNote:  { fontSize:13.5, color:"var(--ink-soft)", marginTop:5, fontStyle:"italic" },

  rowActions: { display:"flex", flexDirection:"column", alignItems:"center", gap:6, flexShrink:0 },
  addBtn: {
    width:42, height:42, borderRadius:"50%",
    border:"2px solid var(--red)",
    background:"linear-gradient(180deg,#fffaf0,#f8edcc)",
    color:"var(--red)", fontSize:22, fontWeight:700,
    cursor:"pointer", flexShrink:0, lineHeight:1,
    boxShadow:"inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 4px rgba(110,42,26,0.2)",
    display:"flex", alignItems:"center", justifyContent:"center",
    transition:"all 0.15s",
  },
  addBtnDone: {
    background:"linear-gradient(180deg,#d84030,#a81808)",
    color:"#fff4df", cursor:"default",
    boxShadow:"inset 0 1px 0 rgba(255,180,160,0.3), 0 2px 4px rgba(110,42,26,0.35)",
    fontSize:17,
  },
  branchBtn: {
    fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.03em",
    color:"var(--red-deep)", background:"transparent",
    border:"1px solid var(--cream-deep)",
    borderRadius:999, padding:"3px 10px",
    cursor:"pointer", whiteSpace:"nowrap",
    transition:"border-color 0.15s, color 0.15s",
  },
  addAllBtn: {
    marginTop:6, padding:"14px",
    fontSize:15, fontWeight:700, fontFamily:"'Fraunces', serif",
    background:"linear-gradient(180deg,#e8c258,#c89a30)",
    color:"var(--ink)", border:"2px solid #a07820",
    borderRadius:12, cursor:"pointer",
    boxShadow:"0 4px 0 #a07820, 0 6px 14px rgba(160,120,30,0.4), inset 0 1px 0 rgba(255,255,200,0.4)",
  },
  addAllDone: {
    background:"#efe0bd", color:"var(--ink-soft)",
    boxShadow:"none", cursor:"default",
  },

  // ── Stack column ──
  stackCol: {
    background:"linear-gradient(180deg,#fffaf2,#f6e4c0)",
    border:"2px solid #c8a850",
    borderRadius:16, padding:20,
    position:"sticky", top:20,
    boxShadow:"0 8px 28px rgba(110,42,26,0.14), inset 0 1px 0 rgba(255,240,180,0.5)",
  },
  stackHead: {
    display:"flex", justifyContent:"space-between", alignItems:"center",
    fontFamily:"'DM Mono', monospace", fontSize:11.5, letterSpacing:"0.22em",
    color:"var(--red-deep)",
    paddingBottom:13, borderBottom:"2px solid var(--cream-deep)",
  },
  stackCount: {
    background:"var(--red)", color:"#fff4df",
    borderRadius:20, padding:"2px 11px", fontWeight:700, fontSize:12,
  },
  fillMeter:    { marginTop:14 },
  fillMeterTop: {
    display:"flex", justifyContent:"space-between",
    fontFamily:"'DM Mono', monospace", fontSize:11.5,
    color:"var(--ink-soft)", marginBottom:6,
  },
  fillTrack: { height:8, background:"var(--cream-deep)", borderRadius:8, overflow:"hidden" },
  fillBar:   { height:"100%", borderRadius:8, transition:"width 0.4s cubic-bezier(0.2,0.8,0.2,1)" },
  stackEmpty: {
    fontFamily:"'DM Mono', monospace", fontSize:12.5,
    color:"var(--ink-soft)", lineHeight:1.55, marginTop:16,
  },
  stackList: {
    display:"flex", flexDirection:"column", gap:0,
    marginTop:14, maxHeight:440, overflowY:"auto",
  },
  stackItem: {
    display:"flex", alignItems:"center", gap:10,
    padding:"9px 0", borderBottom:"1px dashed var(--cream-deep)",
  },
  stackNum: { fontFamily:"'DM Mono', monospace", fontSize:11.5, color:"var(--amber)", fontWeight:700, flexShrink:0, width:22 },
  stackItemTitle:  { fontSize:14.5, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:"var(--ink)" },
  stackItemArtist: { fontFamily:"'DM Mono', monospace", fontSize:11, color:"var(--red-deep)" },
  removeBtn: {
    background:"none", border:"none", color:"var(--ink-soft)",
    fontSize:20, cursor:"pointer", flexShrink:0, lineHeight:1, opacity:0.6,
  },
  copyBtn: {
    marginTop:16, width:"100%", padding:"13px",
    background:"linear-gradient(180deg,#d84030,#a81808)",
    border:"2px solid #6a0e06", color:"#fff4df",
    borderRadius:10, fontSize:14, fontWeight:700,
    cursor:"pointer", fontFamily:"'Fraunces', serif",
    boxShadow:"0 3px 0 #6a0e06, inset 0 1px 0 rgba(255,180,160,0.3)",
    transition:"filter 0.15s",
  },
};
