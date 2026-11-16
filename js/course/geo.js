// Pure geometry for the Learn area (no DOM, no three.js): runs in the browser and in node tests.
// Vectors are plain [x, y, z] arrays. "World" vectors use the app's Earth-fixed frame (see astro.js celestialToWorld);
// the celestial pole of date is +Y there. All angles are degrees unless a name says otherwise.
import * as A from '../astro.js';

export const DEG = A.DEG, RAD = A.RAD;

/** HIP numbers of the stars the lessons talk about. */
export const HIP = { polaris: 11767, dubhe: 54061, merak: 53910, alioth: 62956, acrux: 60718, gacrux: 61084, alphaCen: 71683, betaCen: 68702 };

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/** Normalised copy of a vector. */
export const unit = (v) => norm(v);

/** Angle between two unit vectors, degrees. */
export const angleDeg = (a, b) => Math.atan2(Math.hypot(...cross(a, b)), dot(a, b)) * RAD;

/** Unit tangent at `a` of the great circle towards `b`. */
export function tangentTowards(a, b) {
  const t = add(b, a, -dot(a, b));
  return Math.hypot(...t) < 1e-9 ? norm(cross(a, [0, 1, 0].map((x, i) => x + 0.1 * i))) : norm(t);
}

/** Point on the great circle from `a` towards `b`, `s` degrees from `a` (s may exceed |ab|: that is the extension). */
export function alongArc(a, b, s) {
  const t = tangentTowards(a, b), r = s * DEG;
  return norm(add(scale(a, Math.cos(r)), t, Math.sin(r)));
}

/** The point reached by carrying on past `b` for `factor` times the distance |ab| (pointer stars: factor 5 lands near Polaris). */
export function extendPast(a, b, factor) {
  const g = angleDeg(a, b);
  return alongArc(a, b, g * (1 + factor));
}

/** Unit vector for a small circle of angular radius r around centre c, at bearing phi (radians, around c). */
export function circlePoint(c, u, v, rDeg, phi) {
  const r = rDeg * DEG, sr = Math.sin(r), cr = Math.cos(r);
  return norm([0, 1, 2].map((i) => c[i] * cr + (u[i] * Math.cos(phi) + v[i] * Math.sin(phi)) * sr));
}
/** Two unit vectors perpendicular to c (and each other). */
export function perpBasis(c) {
  const h = Math.abs(c[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(c, h)), v = cross(c, u);
  return [u, v];
}

/** Number of 10-degree fists from the horizon to the celestial pole: the pole stands |latitude| degrees up. */
export const fistsToPoleExact = (lat) => Math.abs(lat) / 10;
export const fistsToPole = (lat) => Math.round(Math.abs(lat) / 10);

/** Bright stars that never set: declination within (90 - |lat|) of the visible pole, on the same side. */
export function neverSets(decDeg, latDeg) { return A.classifyVisibility(decDeg, latDeg).kind === 'circumpolar'; }

/**
 * Where a star sits around the pole, like a clock face seen by someone facing the pole: degrees clockwise from "straight up".
 * pole, star, zenith are world vectors (pole = the visible celestial pole). 0 = star directly above the pole, 90 = to the right.
 */
export function clockAngle(pole, star, zenith) {
  const up = norm(add(zenith, pole, -dot(zenith, pole)));
  const right = cross(pole, up);
  const v = add(star, pole, -dot(star, pole));
  return A.norm360(Math.atan2(dot(v, right), dot(v, up)) * RAD);
}
/** Clock face position (1..12) of a clock angle. */
export const clockHour = (theta) => { const h = Math.round(A.norm360(theta) / 30) % 12; return h === 0 ? 12 : h; };

/** World vector of a J2000 RA/Dec at time ms. */
export function worldOf(raDeg, decDeg, ms) { return A.celestialToWorld(A.eqToVec(raDeg, decDeg), A.jdFromMs(ms)); }
/** The visible celestial pole in world frame for an observer: +Y in the north, -Y in the south. */
export const visiblePole = (lat) => [0, lat >= 0 ? 1 : -1, 0];

/**
 * Clock angle of a catalogue star around the visible pole for an observer.
 * star = {ra, dec} (J2000 degrees).
 */
export function starClockAngle(star, lat, lon, ms) {
  const b = A.localBasis(lat, lon);
  return clockAngle(visiblePole(lat), worldOf(star.ra, star.dec, ms), b.U);
}

/** Index 0..7 of the 8-point compass (N, NE, E, SE, S, SW, W, NW) for an azimuth in degrees from north through east. The words live in content/<lang>/course.md. */
export const compassIndex = (az) => Math.round(A.norm360(az) / 45) % 8;
/** Index 0..3 for how high something stands: 0 very low (< 8 deg), 1 low (< 25), 2 well up (< 60), 3 high. */
export const heightIndex = (alt) => (alt >= 60 ? 3 : alt >= 25 ? 2 : alt >= 8 ? 1 : 0);

/** Local solar time -> ms: the instance of `hour` (0-24) local solar time nearest to now, within [now - 3 h, now + 21 h]. */
export function eveningMs(nowMs, lonDeg, hour = 21) {
  const d = new Date(nowMs), day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  let t = day + (((hour - lonDeg / 15) % 24) + 24) % 24 * 3600e3;
  while (t < nowMs - 3 * 3600e3) t += 24 * 3600e3;
  while (t > nowMs + 21 * 3600e3) t -= 24 * 3600e3;
  return t;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Chapters 3 and 4: the Sun, the seasons, heliacal risings, culminations and zenith stars. Pure maths, node-tested (tests/course.test.mjs).
// A "star" below is any {ra, dec} in J2000 degrees. A "dayKey" is the UTC midnight (ms) that names a LOCAL solar date at a longitude.
// ---------------------------------------------------------------------------------------------------------------------------------
HIP.sirius = 32349; HIP.canopus = 30438; HIP.alnilam = 26311; HIP.capella = 24608; HIP.arcturus = 69673; HIP.alcyone = 17702; HIP.aldebaran = 21421; HIP.betelgeuse = 27989; HIP.rigel = 24436;

/** Apparent Sun, equatorial coordinates of date in degrees (Meeus ch. 25, about 0.01 deg), plus its ecliptic longitude. */
export function sunEq(ms) {
  const T = (A.jdFromMs(ms) - 2451545) / 36525, s = (x) => Math.sin(x * DEG), c = (x) => Math.cos(x * DEG);
  const L0 = 280.46646 + 36000.76983 * T, M = 357.52911 + 35999.05029 * T;
  const C = (1.914602 - 0.004817 * T) * s(M) + 0.019993 * s(2 * M) + 0.000289 * s(3 * M);
  const om = 125.04 - 1934.136 * T, lam = L0 + C - 0.00569 - 0.00478 * s(om), eps = 23.439291 - 0.0130042 * T + 0.00256 * c(om);
  const ra = A.norm360(Math.atan2(c(eps) * s(lam), c(lam)) * RAD), dec = Math.asin(s(eps) * s(lam)) * RAD;
  return { ra, dec, lon: A.norm360(lam) };
}
/** Altitude of the Sun (deg, no refraction) for an observer at lat/lon at time ms. */
export function sunAlt(lat, lon, ms) {
  const e = sunEq(ms), H = (A.gmstHours(A.jdFromMs(ms)) * 15 + lon - e.ra) * DEG;
  return Math.asin(Math.sin(lat * DEG) * Math.sin(e.dec * DEG) + Math.cos(lat * DEG) * Math.cos(e.dec * DEG) * Math.cos(H)) * RAD;
}
/** Altitude of the Sun at local solar noon on the day of `ms`: 90 - |latitude - declination|. */
export const noonSunAlt = (lat, ms) => 90 - Math.abs(lat - sunEq(ms).dec);

/** The UTC midnight that names the local solar date of ms at longitude lon. */
export const dayKeyOf = (ms, lon) => Math.floor((ms + (lon / 15) * 3600e3) / 86400e3) * 86400e3;
/** ms of local solar `hour` (0-24) on the local date named by dayKey. */
export const localMs = (dayKey, lon, hour) => dayKey + (hour - lon / 15) * 3600e3;
/** Altitude (deg) of a star at an instant. */
export const starAltAt = (star, lat, lon, ms) => A.eqToAltAz(star.ra, star.dec, lat, lon, A.jdFromMs(ms)).alt;
export const starAltAzAt = (star, lat, lon, ms) => A.eqToAltAz(star.ra, star.dec, lat, lon, A.jdFromMs(ms));

/** The morning moment (ms) on a local date when the rising Sun is at `alt` degrees; null where it never gets there (polar day or night). */
export function sunMorningAt(lat, lon, dayKey, alt) {
  let lo = localMs(dayKey, lon, 0), hi = localMs(dayKey, lon, 12);
  if (sunAlt(lat, lon, lo) > alt || sunAlt(lat, lon, hi) < alt) return null;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (sunAlt(lat, lon, mid) < alt) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/** The simple heliacal rule used by lesson 3.3: the star counts as "seen" when the Sun is `sunAlt` degrees below the horizon and the star at least `starAlt` above it. */
export const HELIACAL = { sunAlt: -9.5, starAlt: 2.5 };
/** Dawn check for one local date: { t, alt, seen }. */
export function dawnCheck(star, lat, lon, dayKey, rule = HELIACAL) {
  const t = sunMorningAt(lat, lon, dayKey, rule.sunAlt); if (t === null) return { t: null, alt: -90, seen: false };
  const alt = starAltAt(star, lat, lon, t); return { t, alt, seen: alt >= rule.starAlt };
}
/** First local date (dayKey) from `fromKey` within `days` days on which the star is seen at dawn by the rule (and was not the day before); null if none. */
export function firstDawnSeen(star, lat, lon, fromKey, days = 200, rule = HELIACAL) {
  let prev = dawnCheck(star, lat, lon, fromKey - 86400e3, rule).seen;
  for (let k = 0; k < days; k++) {
    const key = fromKey + k * 86400e3, r = dawnCheck(star, lat, lon, key, rule);
    if (r.seen && !prev) return key; prev = r.seen;
  }
  return null;
}

/** Altitude of a star at its upper culmination: 90 - |latitude - declination| (negative: it never rises). */
export const culminationAlt = (dec, lat) => 90 - Math.abs(lat - dec);
/**
 * Brightest star (index into the arrays) that never rises from latitude lat: culmination altitude <= 0. stars = {dec, mag, n}.
 * Returns {i, latToSee} where latToSee is the latitude (signed, same hemisphere as lat) the observer must be nearer the equator than, or null.
 */
export function brightestNeverRises(stars, lat, maxMag = 6) {
  let best = -1;
  for (let i = 0; i < stars.n; i++) {
    if (stars.mag[i] > maxMag || culminationAlt(stars.dec[i], lat) > 0) continue;
    if (best < 0 || stars.mag[i] < stars.mag[best]) best = i;
  }
  if (best < 0) return null;
  return { i: best, latToSee: (lat >= 0 ? 1 : -1) * (90 - Math.abs(stars.dec[best])) };
}
/** The star (index) among those brighter than maxMag whose declination is closest to the latitude; { i, diff } with diff in degrees. */
export function zenithStarOf(stars, lat, maxMag = 2.5, allowed = null) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < stars.n; i++) {
    if (stars.mag[i] > maxMag || (allowed && !allowed(i))) continue;
    const d = Math.abs(stars.dec[i] - lat);
    if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && stars.mag[i] < stars.mag[best])) { bd = d; best = i; }
  }
  return best < 0 ? null : { i: best, diff: bd };
}
/** The instant (ms) of the next upper culmination of a star on or after fromMs: analytic start, then refined by sampling the altitude. */
export function nextTransitMs(star, lat, lon, fromMs) {
  const lst = A.norm360(A.gmstHours(A.jdFromMs(fromMs)) * 15 + lon), dDeg = A.norm360(star.ra - lst);
  let t = fromMs + (dDeg / 360.98564736629) * 86400e3, best = t, ba = -99;
  for (let k = -20; k <= 20; k++) { const u = t + k * 60e3, al = starAltAt(star, lat, lon, u); if (al > ba) { ba = al; best = u; } }
  return best;
}
/** Local solar hour (0-24) of an instant at a longitude. */
export const solarHour = (ms, lon) => A.localSolarHours(ms, lon);

/** Constellation segments the Sun walks through, starting from startMs for `days` days (consAt(ms) -> name). [{name, from, to}] in days from start, merged runs; the last run is merged into the first when they match. */
export function sunSegments(consAt, startMs, days = 366) {
  const segs = [];
  for (let d = 0; d <= days; d++) {
    const nm = consAt(startMs + d * 86400e3), last = segs[segs.length - 1];
    if (last && last.name === nm) last.to = d; else segs.push({ name: nm, from: d, to: d });
  }
  return segs;
}
/** Index of the segment containing day d, and its neighbours (cyclic). */
export function neighbours(names, name) { const i = names.indexOf(name), n = names.length; return i < 0 ? [] : [names[(i + n - 1) % n], names[(i + 1) % n]]; }

/** Kilometres in one degree of latitude. */
export const KM_PER_DEG = 111.2;
/** Earth's circumference (km) from a Sun-height gap in degrees between two places `km` apart on one meridian. */
export const circumferenceKm = (gapDeg, km) => (360 / gapDeg) * km;
export const roundTo = (x, step) => Math.round(x / step) * step;
/** "40,000" style number. */
export const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
/** "11:40 pm" from a local solar hour. */
export function clock12(h) { const t = Math.round(A.norm360(h * 15) / 15 * 60) % 1440, hh = Math.floor(t / 60), mm = t % 60, ap = hh >= 12 ? 'pm' : 'am', h12 = hh % 12 === 0 ? 12 : hh % 12; return `${h12}:${String(mm).padStart(2, '0')} ${ap}`; }

/** The culmination (ms) of a star, within `span` days from fromMs, that falls nearest to local solar `hour` (night-time culminations: 22 by default). */
export function transitNearHour(star, lat, lon, fromMs, hour = 22, span = 366) {
  let best = null, bd = 1e9;
  for (let d = 0; d < span; d++) {
    const noon = localMs(dayKeyOf(fromMs + d * 86400e3, lon), lon, 12), t = nextTransitMs(star, lat, lon, noon);
    const h = ((solarHour(t, lon) - 12 + 24) % 24) + 12, dist = Math.abs(h - hour);
    if (dist < bd) { bd = dist; best = t; }
  }
  return best;
}
