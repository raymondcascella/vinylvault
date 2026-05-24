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

function normalizeObscurity(tracks) {
  const max = Math.max(...tracks.map((t) => Number(t.listeners) || 0), 1);
  return tracks.map((t) => ({
    ...t,
    obscurity: Math.round((1 - (Number(t.listeners) || 0) / max) * 100),
  }));
}

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

// tag.getTopTracks returns neither listener counts nor duration.
// Obscurity is derived from rank position (rank 0 = most popular = obscurity 0; last = obscurity 100).
// Duration falls back to the 210s estimate in formatTrack.
export async function searchByTag(tag, limit = 20) {
  const data = await lfm({ method: 'tag.getTopTracks', tag, limit });
  const raw = data?.tracks?.track || [];
  const total = raw.length || 1;
  const tracks = raw.map((t, i) => ({
    name: t.name,
    artist: t.artist?.name || '',
    duration: 0,
    listeners: 0,
    obscurity: Math.round((i / (total - 1 || 1)) * 100),
  }));
  return dedupeAndCap(tracks.map(formatTrack));
}

export async function searchByArtist(artist, limit = 20, includeSeed = true) {
  const similarData = await lfm({ method: 'artist.getSimilar', artist, limit: includeSeed ? 3 : 5 });
  const similarArtists = (similarData?.similarartists?.artist || []).map((a) => a.name);

  const artistsToFetch = includeSeed ? [artist, ...similarArtists] : similarArtists;
  if (artistsToFetch.length === 0) return [];

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

export async function branchFromTrack(track, limit = 20) {
  const similarData = await lfm({ method: 'artist.getSimilar', artist: track.artist, limit: 6 });
  const similarArtists = (similarData?.similarartists?.artist || []).map((a) => a.name);
  if (similarArtists.length === 0) return [];

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
