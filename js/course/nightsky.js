// Chapters 7 and 8 (What stars are; Losing and finding the night): pure maths that runs in the browser and in node tests,
// plus attachNight(), the small controller for the red night mode and for "keep this setting" (the only part that touches the page).
// Nothing here knows a sentence of the course: words live in content/<lang>/course.md.
import * as A from '../astro.js';
import * as G from './geo.js';
import { DISTANCES } from '../data.js';
import { countVisible, qualityParams } from '../skyquality.js';

const DEG = A.DEG;

// ---------------------------------------------------------------------------------------------------------------------------------
// 7.1  Colour and temperature
// ---------------------------------------------------------------------------------------------------------------------------------
/** Typical surface temperatures (K) by spectral type: letter + digit. Used for the hot stars (O, B, A), where the colour index under-reads. */
const SPEC_ANCHORS = [
  ['O', 5, 41000], ['B', 0, 30000], ['B', 2, 20900], ['B', 5, 15200], ['B', 8, 12400], ['A', 0, 9700], ['A', 5, 8100], ['F', 0, 7200],
  ['F', 5, 6500], ['G', 0, 5900], ['G', 5, 5600], ['K', 0, 5200], ['K', 5, 4400], ['M', 0, 3800], ['M', 2, 3600], ['M', 5, 3200],
];
const LETTER_BASE = { O: 0, B: 10, A: 20, F: 30, G: 40, K: 50, M: 60 };
/** "B8Ia" -> position on a 0..70 scale (letter * 10 + digit), or null. */
export function spectralIndex(spect) {
  const m = /^([OBAFGKM])\s*(\d(?:\.\d)?)?/.exec(String(spect || '').trim());
  if (!m) return null;
  return LETTER_BASE[m[1]] + (m[2] !== undefined ? parseFloat(m[2]) : 5);
}
/** Temperature (K) from a spectral type by interpolating the table; null if the type cannot be read. */
export function tempFromSpectral(spect) {
  const x = spectralIndex(spect); if (x === null) return null;
  const pts = SPEC_ANCHORS.map(([l, d, t]) => [LETTER_BASE[l] + d, t]);
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, t0] = pts[i - 1], [x1, t1] = pts[i]; return t0 + (t1 - t0) * (x - x0) / (x1 - x0); }
  return pts[pts.length - 1][1];
}
/** Surface temperature (K) of a star: the spectral type for blue and white stars, the B-V colour index for the cooler ones. Approximate. */
export function starTempK(bv, spect) {
  const x = spectralIndex(spect);
  const fromType = tempFromSpectral(spect), fromBv = Number.isFinite(bv) ? A.bvToTemp(Math.max(-0.4, Math.min(2.2, bv))) : null;
  if (x !== null && x < 30) return fromType;               // blue and white stars: the type is the better guide
  if (fromType !== null && fromBv !== null) return (fromType + fromBv) / 2;      // cooler stars: the two guides disagree by a few hundred K, so use both
  return fromBv !== null ? fromBv : fromType;
}
/** The colour a star shows, in plain words, from its B-V colour index (the app's own table, with "red-orange" for the reddest orange stars). */
export function colourWord(bv) {
  if (bv < -0.3) return 'blue'; if (bv < -0.02) return 'blue-white'; if (bv < 0.3) return 'white'; if (bv < 0.58) return 'yellow-white'; if (bv < 0.81) return 'yellow';
  if (bv < 1.45) return 'orange'; if (bv < 1.7) return 'red-orange'; return 'red';
}
/** Round for talking: nearest 100 K below 6000, 500 K up to 10 000, 1000 K above ("about 12,000"). */
export const roundTemp = (k) => (k < 6000 ? Math.round(k / 100) * 100 : k < 10000 ? Math.round(k / 500) * 500 : Math.round(k / 1000) * 1000);
export const fmtThousands = (n) => Math.round(n).toLocaleString('en-US');

/** Distance in light-years of a catalogue star: the app's own table of well-known stars first, then the HYG-derived value; 0 if unknown. */
export function lyOf(stars, i) { return LY_FIXED[stars.hip[i]] || DISTANCES[stars.hip[i]] || stars.ly[i] || 0; }
/** Where the app's two tables disagree, the course says what its source says: Deneb "about 2,000 light-years" (estimates run 1,400 to 2,600). */
const LY_FIXED = { 102098: 2000 };

/** Bright catalogue stars above minAlt at an instant, brightest first: [{i, hip, mag, alt, az, ly, temp}]. Only stars with a proper name when named = true. */
export function brightUp(data, lat, lon, ms, o = {}) {
  const { maxMag = 2.6, minAlt = 10, named = true } = o, st = data.stars, jd = A.jdFromMs(ms), out = [];
  for (let i = 0; i < st.n; i++) {
    if (st.mag[i] > maxMag) continue;
    if (named && !(data.names[st.hip[i]] || {}).name) continue;
    const aa = A.eqToAltAz(st.ra[i], st.dec[i], lat, lon, jd);
    if (aa.alt < minAlt) continue;
    out.push({ i, hip: st.hip[i], mag: st.mag[i], alt: aa.alt, az: aa.az, ly: lyOf(st, i), temp: starTempK(st.bv[i], st.spect[i]) });
  }
  return out.sort((p, q) => p.mag - q.mag);
}
/** Well-known contrasting pairs (hot, cool) as HIP numbers: Rigel/Betelgeuse, Spica/Antares, Vega/Arcturus, Sirius/Aldebaran. */
export const KNOWN_PAIRS = [[24436, 27989], [65474, 80763], [91262, 69673], [32349, 21421]];
/**
 * A contrasting pair among the stars that are up (list from brightUp): a well-known pair if both are up, otherwise the hottest and the coolest of the
 * brightest ones, as long as one is at least `ratio` times hotter.
 */
export function contrastPair(list, ratio = 1.6, top = 14) {
  for (const [h, c] of KNOWN_PAIRS) { const hot = list.find((s) => s.hip === h), cool = list.find((s) => s.hip === c); if (hot && cool) return { hot, cool }; }
  const L = list.slice(0, top); if (L.length < 2) return null;
  let hot = L[0], cool = L[0];
  for (const s of L) { if (s.temp > hot.temp) hot = s; if (s.temp < cool.temp) cool = s; }
  return hot.temp >= cool.temp * ratio ? { hot, cool } : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 7.2  Brightness and distance
// ---------------------------------------------------------------------------------------------------------------------------------
/** A star that looks brighter than a closer one: { far (looks brighter, lies farther), near (looks fainter, lies much closer) }. */
export function brighterButFarther(list, factor = 4, minGap = 0.15) {
  const L = list.filter((s) => s.ly > 0);
  for (const far of L) {      // brightest-looking first
    const partners = L.filter((s) => s !== far && s.mag > far.mag + minGap && s.ly * factor < far.ly);
    if (partners.length) return { far, near: partners.sort((p, q) => p.mag - q.mag)[0] };
  }
  return null;
}
/** How many times brighter a star would look if it stood at another distance (the inverse-square law). */
export const brightnessBoost = (lyNow, lyThen) => (lyNow / lyThen) ** 2;
/** Magnitude difference for a brightness ratio (positive: brighter). */
export const magGain = (ratio) => 2.5 * Math.log10(ratio);
/** Round a ratio for talking: 4.2 -> 4; 80 -> 80; 104 -> 100; 6400 -> 6,000; 10816 -> 10,000. */
export function roundRatio(r) {
  if (r < 10) return Math.max(1, Math.round(r));
  if (r < 100) return Math.round(r / 10) * 10;
  const p = 10 ** Math.floor(Math.log10(r)); return Math.round(r / p) * p;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 7.3  Light travel time
// ---------------------------------------------------------------------------------------------------------------------------------
/**
 * What to say about light that took `ly` years to arrive. Returns { n, kind, year } where kind says how to phrase it:
 *   'years' (n years ago, a calendar year), 'bc' (a calendar year before year 1), 'long' (thousands of years: no calendar year), 'million' (n million years).
 * Rounding follows how sure the number is: 8.6 stays 8.6, 43 -> 43, 550 -> 550 (year to the nearest 50); from 1000 on no calendar year is given.
 */
export function lightTravel(ly, nowYear) {
  if (ly >= 1e6) return { kind: 'million', n: Math.round(ly / 1e5) / 10, year: null };
  if (ly >= 1000) return { kind: 'long', n: ly < 10000 ? Math.round(ly / 100) * 100 : Math.round(ly / 1000) * 1000, year: null };
  let n, step;
  if (ly < 20) { n = Math.round(ly * 10) / 10; step = 1; }
  else if (ly < 100) { n = Math.round(ly); step = 1; }
  else { n = Math.round(ly / 10) * 10; step = 50; }
  const y = Math.round((nowYear - n) / step) * step;
  return y >= 1 ? { kind: 'years', n, year: y } : { kind: 'bc', n, year: 1 - y };          // astronomical year 0 is 1 BC
}
/** Light left before this calendar year? (the Try of 7.3): ly greater than nowYear - year. */
export const leftBefore = (ly, year, nowYear) => ly > nowYear - year;
/** Pick up to `count` stars of increasing distance from candidates [{hip, ly, mag}], each at least `ratio` times farther than the last. */
export function distanceLadder(cands, count = 4, ratio = 2.2) {
  const L = cands.filter((c) => c.ly > 0).sort((p, q) => p.ly - q.ly), out = [];
  for (const c of L) if (!out.length || c.ly >= out[out.length - 1].ly * ratio) out.push(c);
  if (out.length <= count) return out;
  const keep = [out[0]];
  for (let k = 1; k < count; k++) keep.push(out[Math.round((k * (out.length - 1)) / (count - 1))]);
  return [...new Set(keep)];
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 7.4  The Milky Way's core
// ---------------------------------------------------------------------------------------------------------------------------------
/** Galactic coordinates (deg) to J2000 equatorial (deg). */
export function galacticToEq(l, b) {
  const cl = Math.cos(l * DEG), sl = Math.sin(l * DEG), cb = Math.cos(b * DEG), sb = Math.sin(b * DEG), g = [cb * cl, cb * sl, sb];
  const M = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.44482963, 0.7469822445], [-0.867666149, -0.1980763734, 0.4559837762]];
  const x = M[0][0] * g[0] + M[1][0] * g[1] + M[2][0] * g[2], y = M[0][1] * g[0] + M[1][1] * g[1] + M[2][1] * g[2], z = M[0][2] * g[0] + M[1][2] * g[1] + M[2][2] * g[2];
  return { ra: A.norm360(Math.atan2(y, x) / DEG), dec: Math.asin(Math.max(-1, Math.min(1, z))) / DEG };
}
export const GALACTIC_CENTRE = galacticToEq(0, 0);
export const COALSACK = galacticToEq(303, 0);

/**
 * The months (0..11, from the year of nowMs) in which an object {ra, dec} stands at least minAlt degrees up at local solar `hour`.
 * minAlt is lowered for places where the object never climbs far. Returns { months, from, to, maxAlt, thr } with the longest run
 * (cyclic) of months as from..to, or from = null when it never gets high enough.
 */
export function eveningMonths(obj, lat, lon, nowMs, hour = 22, minAlt = 20) {
  const maxAlt = G.culminationAlt(obj.dec, lat), y = new Date(nowMs).getUTCFullYear();
  const thr = Math.min(minAlt, maxAlt - 6), ok = [];
  for (let m = 0; m < 12; m++) {
    const key = G.dayKeyOf(Date.UTC(y, m, 15), lon);
    ok.push(maxAlt > 6 && G.starAltAt(obj, lat, lon, G.localMs(key, lon, hour)) >= thr);
  }
  const months = ok.map((v, m) => (v ? m : -1)).filter((m) => m >= 0);
  if (!months.length) return { months, from: null, to: null, maxAlt, thr };
  if (months.length === 12) return { months, from: 0, to: 11, maxAlt, thr };
  let best = { len: 0, from: 0 };
  for (let s = 0; s < 12; s++) {
    if (!ok[s] || ok[(s + 11) % 12]) continue;           // only start a run where the previous month is off
    let len = 0; while (ok[(s + len) % 12] && len < 12) len++;
    if (len > best.len) best = { len, from: s };
  }
  return { months, from: best.from, to: (best.from + best.len - 1) % 12, maxAlt, thr };
}
/** First day (0..days) on or after fromMs, evening at local solar `hour`, when pred(ms) holds; returns { ms, days } or null. */
export function firstEvening(fromMs, lon, pred, hour = 22, days = 366) {
  const base = G.localMs(G.dayKeyOf(fromMs, lon), lon, hour);
  for (let d = 0; d <= days; d++) { const t = base + d * 864e5; if (t < fromMs - 3 * 3600e3) continue; if (pred(t)) return { ms: t, days: d }; }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 8.1  How many stars a sky shows
// ---------------------------------------------------------------------------------------------------------------------------------
/** The observer's zenith in the J2000 frame of the star table (for countVisible). */
export function upInCelestial(lat, lon, ms) {
  const jd = A.jdFromMs(ms), U = A.localBasis(lat, lon).U;
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e) => A.dot(A.celestialToWorld(e, jd), U));
}
/** Catalogue stars (to magnitude 6) above the horizon that a limiting magnitude lets through. */
export function starsVisible(stars, lat, lon, ms, limit) { return countVisible(stars.eq, stars.mag, stars.n, upInCelestial(lat, lon, ms), limit); }
export const qualityLimit = (q) => qualityParams(q).limit;
export const qualityName = (q) => qualityParams(q).name;

// ---------------------------------------------------------------------------------------------------------------------------------
// 8.3  The Moon and dark evenings.   `Ast` is the astronomy-engine namespace (globalThis.Astronomy in the page, require(...) in node).
// ---------------------------------------------------------------------------------------------------------------------------------
/** Altitude (deg, no refraction) of the Moon for an observer. */
export function moonAlt(Ast, lat, lon, ms) {
  const d = new Date(ms), ob = new Ast.Observer(lat, lon, 0), eq = Ast.Equator('Moon', d, ob, true, true);
  return Ast.Horizon(d, ob, eq.ra, eq.dec, null).altitude;
}
/** Moon phase angle at an instant, degrees: 0 new, 90 first quarter, 180 full, 270 last quarter. */
export const moonPhaseDeg = (Ast, ms) => Ast.MoonPhase(new Date(ms));
/** Fraction of the Moon's disc that is lit (0..1) from the phase angle. */
export const litFraction = (phaseDeg) => (1 - Math.cos(phaseDeg * DEG)) / 2;
/** Plain name of a phase angle. */
export function phaseName(phaseDeg) {
  const p = A.norm360(phaseDeg);
  if (p < 22.5 || p >= 337.5) return 'new'; if (p < 67.5) return 'waxing crescent'; if (p < 112.5) return 'first quarter'; if (p < 157.5) return 'waxing gibbous';
  if (p < 202.5) return 'full'; if (p < 247.5) return 'waning gibbous'; if (p < 292.5) return 'last quarter'; return 'waning crescent';
}
/** When the sky is properly dark on a local date: the end of astronomical twilight (Sun 18 deg down), or the best the latitude allows. */
export function duskMs(lat, lon, dayKey) {
  for (const target of [-18, -12, -6]) {
    let prev = G.localMs(dayKey, lon, 12);
    for (let t = prev + 10 * 60e3; t <= G.localMs(dayKey, lon, 30); t += 10 * 60e3) {
      if (G.sunAlt(lat, lon, t) <= target) { let lo = prev, hi = t; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (G.sunAlt(lat, lon, m) <= target) hi = m; else lo = m; } return { ms: hi, twilight: target }; }
      prev = t;
    }
  }
  return { ms: G.localMs(dayKey, lon, 22), twilight: null };
}
/**
 * One evening (dusk to local midnight) for stargazing: { dayKey, dusk, end, upFrac, illum, phase, moonless, score }.
 * upFrac = share of the window with the Moon above the horizon; score = upFrac * lit fraction (0 = as dark as it gets, 1 = a full Moon all evening).
 */
export function eveningMoon(Ast, lat, lon, dayKey) {
  const d = duskMs(lat, lon, dayKey), dusk = d.ms;
  const end = Math.max(G.localMs(dayKey, lon, 24), dusk + 3 * 3600e3);
  let up = 0, n = 0;
  for (let t = dusk; t <= end; t += 15 * 60e3) { n++; if (moonAlt(Ast, lat, lon, t) > -0.5) up++; }
  const mid = (dusk + end) / 2, phase = moonPhaseDeg(Ast, mid), illum = litFraction(phase), upFrac = up / n;
  return { dayKey, dusk, end, upFrac, illum, phase, moonless: up === 0, score: upFrac * illum, twilight: d.twilight };
}
/** The next `days` evenings, from the local date of fromMs. */
export function eveningsAhead(Ast, lat, lon, fromMs, days = 31) {
  const k0 = G.dayKeyOf(fromMs, lon), out = [];
  for (let i = 0; i < days; i++) out.push(eveningMoon(Ast, lat, lon, k0 + i * 864e5));
  return out;
}
/** The first run of consecutive moonless evenings: { from, to, days, startsNow }, or null. */
export function moonlessRun(list) {
  let i = list.findIndex((e) => e.moonless); if (i < 0) return null;
  let j = i; while (j + 1 < list.length && list[j + 1].moonless) j++;
  return { from: list[i], to: list[j], days: j - i + 1, startsNow: i === 0 };
}
/** Evenings ranked from darkest to brightest (score, then how long the Moon is up). */
export const rankEvenings = (list) => [...list].sort((p, q) => p.score - q.score || p.upFrac - q.upFrac || p.dayKey - q.dayKey);
/**
 * Three evenings for the Try of 8.3: the darkest (the middle of the moonless run), a full-Moon evening, and one in between.
 * The darkest is the unique best by score; the other two are at least 2 days away from it and from each other. Null if the month is too short.
 */
export function darkChoices(list) {
  const ranked = rankEvenings(list), best0 = ranked[0];
  const plateau = list.filter((e) => e.score <= best0.score + 1e-9), run = moonlessRun(list);
  const best = run && run.from.score <= best0.score + 1e-9 ? list[Math.floor((list.indexOf(run.from) + list.indexOf(run.to)) / 2)] : plateau[Math.floor(plateau.length / 2)];
  const far = (e, used) => used.every((u) => Math.abs(e.dayKey - u.dayKey) >= 2 * 864e5);
  const maxScore = Math.max(...list.map((e) => e.score));
  const full = [...list].filter((e) => far(e, [best])).sort((p, q) => q.score - p.score)[0];
  if (!full) return null;
  const target = (best.score + full.score) / 2;
  const mid = [...list].filter((e) => far(e, [best, full]) && e.score > best.score + 0.08 && e.score < full.score - 0.08).sort((p, q) => Math.abs(p.score - target) - Math.abs(q.score - target))[0];
  if (!mid || maxScore <= best.score) return null;
  return { best, full, mid };
}

/** Planets above minAlt at an instant, brightest first: [{id, alt, az, mag}] (astronomy-engine). */
export function planetsUp(Ast, lat, lon, ms, minAlt = 8) {
  const d = new Date(ms), ob = new Ast.Observer(lat, lon, 0), out = [];
  for (const id of ['Venus', 'Jupiter', 'Mars', 'Saturn', 'Mercury']) {
    const eq = Ast.Equator(id, d, ob, true, true), hz = Ast.Horizon(d, ob, eq.ra, eq.dec, null);
    if (hz.altitude < minAlt) continue;
    let mag = 0; try { mag = Ast.Illumination(id, d).mag; } catch (e) { /* ignore */ }
    out.push({ id, alt: hz.altitude, az: hz.azimuth, mag });
  }
  return out.sort((p, q) => p.mag - q.mag);
}
/** Moon altitude, azimuth, phase and lit fraction at an instant. */
export function moonNow(Ast, lat, lon, ms) {
  const d = new Date(ms), ob = new Ast.Observer(lat, lon, 0), eq = Ast.Equator('Moon', d, ob, true, true), hz = Ast.Horizon(d, ob, eq.ra, eq.dec, null), phase = Ast.MoonPhase(d);
  return { alt: hz.altitude, az: hz.azimuth, phase, illum: litFraction(phase), name: phaseName(phase) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The page part: red night mode and "keep this setting".
// ---------------------------------------------------------------------------------------------------------------------------------
const RED_KEY = 'skyatlas.red';
const keepTool = (key, labelKey) => ({
  html: (X) => `<button type="button" class="lc-step-b" data-act="keep" aria-pressed="false">${X.ui(labelKey)}</button>`,
  sync: (X, t) => { const b = t.querySelector('[data-act=keep]'); if (!b) return; const on = !!X.kit.keep[key]; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); b.textContent = X.ui(on ? 'keptSetting' : labelKey); },
  onAct: (X) => { X.kit.keep[key] = !X.kit.keep[key]; },
});
/** A Try step's "Keep this setting" button, shown once the step is done. key: 'q' (sky quality) or 'red' (red night mode). */
export const keepTryTool = (key) => keepTool(key, key === 'red' ? 'keepRed' : 'keepSetting');

/**
 * Adds to the learn kit: K.red (the red night mode: K.red.on, K.red.set(on, persist)), K.keep ({ q, red }: settings the learner chose to keep)
 * and K.beforeExit() (called when the learner leaves a lesson, before Explore is restored). Also puts a "Red night mode" switch in the Sky menu.
 */
export function attachNight(K, a, engine) {
  const html = document.documentElement;
  let veil = document.getElementById('red-night');
  if (!veil) { veil = document.createElement('div'); veil.id = 'red-night'; veil.setAttribute('aria-hidden', 'true'); document.body.appendChild(veil); }
  const stored = () => { try { return localStorage.getItem(RED_KEY) === '1'; } catch (e) { return false; } };
  const store = (on) => { try { localStorage.setItem(RED_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ } };
  K.keep = { q: false, red: false };
  K.cleanups = [];          // functions run when a step ends (endStep in learn.js): hide panels, drop overrides
  K.redStart = null;
  K.snapQ = () => engine.D.snapQ();     // the sky quality the learner had in Explore when the lesson began
  const box = () => document.getElementById('red-mode');
  const red = K.red = {
    on: false,
    set(on, persist = false) {
      red.on = !!on; html.classList.toggle('red-night', red.on);
      if (box()) box().checked = red.on;
      if (persist) store(red.on);
    },
    /** A lesson turns the red mode on or off: remember what it was so leaving the lesson can put it back. */
    lesson(on) { if (K.redStart === null) K.redStart = red.on; red.set(on, false); },
  };
  red.set(stored(), false);
  // the switch in the Sky menu
  const menu = document.getElementById('sky-menu');
  if (menu && !box()) {
    const row = document.createElement('div'); row.className = 'sm-red';
    row.innerHTML = `<label class="sm-red-l"><input id="red-mode" type="checkbox"> <span>${K.ui('redMode')}</span></label><span class="sm-note">${K.ui('redModeNote')}</span>`;
    const foot = menu.querySelector('.sm-foot'); menu.insertBefore(row, foot || null);
    row.querySelector('input').checked = red.on;
    row.querySelector('input').addEventListener('change', (e) => red.set(e.target.checked, true));
  }
  K.beforeExit = async () => {
    const snap = await engine.begin();
    if (K.keep.q && snap) snap.q = a.S.q;
    if (K.keep.red) store(true); else if (K.redStart !== null) red.set(K.redStart, false);
    K.keep.q = K.keep.red = false; K.redStart = null;
    delete a.S.limOv; K.chosenQ = null;
  };
}
