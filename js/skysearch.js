// Search index for things in the sky: bodies, named and designated stars, deep-sky objects, constellations.
// Pure: no DOM, no three.js (runs in node). Entries only point at the data (kind + index/id); main.js turns them into selections.
import { norm } from './cities.js';

const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω' };
const LATIN = Object.fromEntries(Object.entries(GREEK).map(([k, v]) => [v, k]));
const BODY_MAG = { Sun: -27, Moon: -13 };       // order of brightness among bodies; real magnitudes vary
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const compact = (k) => k.replace(/ /g, '');

/** Spelling variants of a typed query: "alpha lyr" and "alp lyr" also try "α lyr". */
function variants(q) {
  const out = [q], sp = q.indexOf(' '), w = sp < 0 ? q : q.slice(0, sp);
  const full = GREEK[w], part = sp > 0 && w.length >= 3 ? Object.keys(GREEK).find((g) => g.startsWith(w)) : null;
  const g = full || (part && GREEK[part]);
  if (g) out.push(g + q.slice(w.length));
  return out;
}

/**
 * Build the index. data = { stars, names, dso, cons, hipIndex } as returned by loadData.
 * bodies = [{ id, type, kind }] (the app's Sun, Moon and planets); consOf(ra, dec) optionally names the constellation of a DSO.
 */
export function buildIndex(data, { bodies = [], consOf = null } = {}) {
  const E = [];
  const add = (e, keys, dkeys = []) => {
    e.keys = [...new Set(keys.filter(Boolean).map(norm))].map((k) => [k, compact(k)]);
    e.dkeys = [...new Set(dkeys.filter(Boolean).map(norm))].map((k) => [k, compact(k)]);
    E.push(e);
  };
  bodies.forEach((b, index) => add({ kind: 'body', id: b.id, index, title: b.id, sub: [b.kind === 0 ? 'Planet' : b.id === 'Sun' ? 'Star' : 'Moon'], rank: BODY_MAG[b.id] ?? -3 + index / 100, planet: true }, [b.id]));
  for (const c of data.cons) add({ kind: 'cons', id: c.id, title: c.name, sub: ['Constellation'], rank: 0.5 + c.rank }, [c.name, c.en, c.id]);
  data.dso.forEach((d, index) => {
    const cn = consOf ? consOf(d.ra, d.dec) : '', t = cap(d.type || 'object');
    add({ kind: 'dso', id: d.id, index, title: d.name, sub: [t, cn, d.name !== d.desig ? d.desig : ''].filter(Boolean), mag: d.mag, rank: d.mag }, [d.name, d.desig, d.id]);
  });
  const S = data.stars;
  for (let i = 0; i < S.n; i++) {
    const hip = S.hip[i], nm = data.names[hip] || {}, c = data.consMap.get(nm.c);
    const m = /^([α-ω])(\d*)$/.exec(nm.bayer || '');
    const d = [];                                                     // designations match from the start only: "orion" must not drag in every "α Orionis"
    if (m && c) for (const s of [m[1], LATIN[m[1]]]) for (const n of m[2] ? [m[2], ''] : ['']) d.push(`${s}${n} ${c.id}`, `${s}${n} ${c.gen}`);
    if (nm.flam && c) d.push(`${nm.flam} ${c.id}`, `${nm.flam} ${c.gen}`);
    d.push(`HIP ${hip}`, nm.hd);
    const title = nm.name || (m && c ? `${m[1]}${m[2]} ${c.id}` : nm.flam && c ? `${nm.flam} ${c.id}` : `HIP ${hip}`);
    const mag = S.mag[i];
    add({ kind: 'star', id: hip, index: i, title, sub: ['Star', c ? c.name : '', `mag ${mag < 0 ? '−' : ''}${Math.abs(mag).toFixed(1)}`].filter(Boolean), mag, rank: mag }, [nm.name], d);
  }
  return E;
}

/** 3 exact, 2 prefix, 1 word prefix (names only), 0 none. */
function score(e, qs) {
  let best = 0;
  for (const { q, qc } of qs) {
    const digits = /\d/.test(qc);
    for (const [k, kc] of e.keys) {
      if (k === q || (digits && kc === qc)) return 3;
      best = Math.max(best, k.startsWith(q) || (digits && kc.startsWith(qc)) ? 2 : (' ' + k).includes(' ' + q) ? 1 : 0);
    }
    for (const [k, kc] of e.dkeys) {
      if (k === q || (digits && kc === qc)) return 3;
      if (k.startsWith(q) || (digits && kc.startsWith(qc))) best = Math.max(best, 2);
    }
  }
  return best;
}

/** Best matches, exact first, then brightest (Sun, Moon, planets boosted). Empty for queries under 2 characters. */
export function searchSky(index, query, limit = 5) {
  const q = norm(String(query || ''));
  if (q.length < 2) return [];
  const qs = variants(q).map((v) => ({ q: v, qc: compact(v) }));
  const hits = [];
  for (const e of index) { const s = score(e, qs); if (s) hits.push({ e, s, r: e.rank + (s === 1 ? 2 : 0) }); }
  hits.sort((a, b) => (b.s === 3) - (a.s === 3) || a.r - b.r);
  return hits.slice(0, limit).map((h) => h.e);
}

const hhmm = (ms, lon) => {
  const h = (((ms / 3600000 + lon / 15) % 24) + 24) % 24, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/**
 * Plain-language note for something that is below the horizon now: when it rises, or that it never does from here.
 * o = { Astronomy, name, body (engine body name) | ra, dec (deg, J2000), decNow (deg of date), lat, lon, ms, place, clock (true when the displayed time is the real clock) }.
 */
export function horizonNote(o) {
  const { Astronomy: Ast, name, lat, lon, ms, place } = o;
  if (!o.body && Math.abs(lat) < 89.99 && (lat >= 0 ? o.decNow < -(90 - lat) : o.decNow > 90 + lat)) {
    return `Never rises from ${place}: you would need to travel ${o.decNow < 0 ? 'south' : 'north'} to see it.`;
  }
  const base = `${name} is below your horizon right now.`;
  if (!o.clock || !Ast) return base;
  try {
    const obs = new Ast.Observer(lat, lon, 0);
    let b = o.body;
    if (!b) { Ast.DefineStar('Star8', o.ra / 15, o.dec, 1000); b = 'Star8'; }
    const t = Ast.SearchRiseSet(b, obs, +1, new Date(ms), 2);
    if (!t) return `${base} It does not rise from ${place} in the next two days.`;
    const day = (x) => Math.floor((x + (lon / 15) * 3600000) / 86400000);
    return `${base} It rises at ${hhmm(t.date.getTime(), lon)}${day(t.date.getTime()) > day(ms) ? ' tomorrow' : ''}.`;
  } catch (e) { return base; }
}
