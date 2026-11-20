// Chapters 5 and 6: the Moon, the planets, eclipses, precession and proper motion. Pure maths, node-tested (tests/course.test.mjs).
// The planets, Moon and eclipses come from astronomy-engine (the global `Astronomy`, set by vendor/astronomy.browser.min.js in the browser;
// the tests set globalThis.Astronomy first). Everything else is the app's own astro.js.
import * as A from '../astro.js';
import { angleDeg } from './geo.js';

export const DAY = 864e5;
const DEG = A.DEG, RAD = A.RAD;
const AE = () => globalThis.Astronomy;
const date = (ms) => new Date(ms);
/** astronomy-engine J2000 equatorial vector -> the app's axes (x equinox, y north, z = -engine y). */
export const toApp = (v) => [v.x, v.z, -v.y];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const crossP = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** {ra, dec} (J2000 degrees) of an app-axes vector. */
export const eqOf = (v) => A.vecToEq(unit(v));
/** North pole of the ecliptic (J2000): RA 18 h, Dec 90 - 23.4393. */
export const ECL_POLE = { ra: 270, dec: 66.5607 };

// ---------------------------------------------------------------------------------------------------------------- the Moon
/** Moon phase now: angle = ecliptic longitude of the Moon minus the Sun's (0 new, 90 first quarter, 180 full), lit = illuminated fraction 0..1. */
export function moonPhase(ms) {
  const angle = AE().MoonPhase(date(ms)), lit = (1 - Math.cos(angle * DEG)) / 2;
  return { angle, lit, elong: angle <= 180 ? angle : 360 - angle };
}
/** Index 0..7 into new | waxing crescent | first quarter | waxing gibbous | full | waning gibbous | last quarter | waning crescent. */
export function phaseIndex(angle) {
  const a = ((angle % 360) + 360) % 360, near = (c) => Math.abs(a - c) <= 6.5 || Math.abs(a - c - 360) <= 6.5 || Math.abs(a - c + 360) <= 6.5;
  if (near(0)) return 0; if (near(90)) return 2; if (near(180)) return 4; if (near(270)) return 6;
  return a < 90 ? 1 : a < 180 ? 3 : a < 270 ? 5 : 7;
}
/** ms of the next moment the Moon's phase angle is `deg` (0 new, 90, 180 full, 270), searching `days` ahead. */
export function nextPhaseMs(deg, ms, days = 40) { const t = AE().SearchMoonPhase(deg, date(ms), days); return t ? t.date.getTime() : null; }
/** The next rise and set of a body after ms ({rise, set}, ms or null). */
export function riseSet(body, lat, lon, ms) {
  const o = new (AE().Observer)(lat, lon, 0), r = AE().SearchRiseSet(body, o, +1, date(ms), 1.2), s = AE().SearchRiseSet(body, o, -1, date(ms), 1.2);
  return { rise: r ? r.date.getTime() : null, set: s ? s.date.getTime() : null };
}
/** Altitude and azimuth (degrees, with refraction) of a planet, the Moon or the Sun from a place. */
export function bodyAltAz(body, lat, lon, ms) {
  const Ae = AE(), o = new Ae.Observer(lat, lon, 0), eq = Ae.Equator(body, date(ms), o, true, true), h = Ae.Horizon(date(ms), o, eq.ra, eq.dec, 'normal');
  return { alt: h.altitude, az: h.azimuth };
}
/** J2000 {ra, dec} of a body (geocentric, light-time corrected). */
export function skyPos(body, ms) { return eqOf(toApp(AE().GeoVector(body, date(ms), true))); }

// ---------------------------------------------------------------------------------------------------------------- the planets
/** Geocentric ecliptic longitude of a body, degrees. */
export const eclLon = (body, ms) => AE().Ecliptic(AE().GeoVector(body, date(ms), true)).elon;
/** Geocentric ecliptic latitude of a body, degrees. */
export const eclLat = (body, ms) => AE().Ecliptic(AE().GeoVector(body, date(ms), true)).elat;
/** How fast a body moves along the ecliptic against the stars, degrees per day (negative = moving backwards, westward). */
export function lonSpeed(body, ms) { const d = eclLon(body, ms + DAY / 2) - eclLon(body, ms - DAY / 2); return ((d + 540) % 360) - 180; }
export const isRetrograde = (body, ms) => lonSpeed(body, ms) < 0;
/** The next opposition of an outer planet (the Sun and the planet on opposite sides of the sky) after ms. */
export function nextOpposition(body, ms) { return AE().SearchRelativeLongitude(body, 0, date(ms)).date.getTime(); }
/** The moments around an opposition when the planet turns back and turns forward again: {start, end} in ms. */
export function retrogradeSpan(body, oppMs) {
  // bisection between a moment of forward motion (120 days out) and the opposition itself (backward motion)
  const retro = (t) => lonSpeed(body, t) < 0, edge = (forwardT, backT) => {
    let f = forwardT, b = backT;
    for (let i = 0; i < 40; i++) { const m = (f + b) / 2; if (retro(m)) b = m; else f = m; }
    return (f + b) / 2;
  };
  return { start: edge(oppMs - 120 * DAY, oppMs), end: edge(oppMs + 120 * DAY, oppMs) };
}
/** Sample a body's J2000 sky position every `step` days from ms0 to ms1. */
export function skyTrack(body, ms0, ms1, step = 2) { const out = []; for (let t = ms0; t <= ms1 + 1; t += step * DAY) out.push(skyPos(body, t)); return out; }

/** Signed angle between an inner planet and the Sun: positive east of the Sun (evening sky), negative west (morning sky). */
export function signedElongation(body, ms) { const e = AE().Elongation(body, date(ms)); return e.visibility === 'evening' ? e.elongation : -e.elongation; }
/** 'evening' | 'morning' | 'near' (closer to the Sun than minDeg: lost in its glare). */
export function inferiorSide(body, ms, minDeg = 10) { const s = signedElongation(body, ms); return Math.abs(s) < minDeg ? 'near' : s > 0 ? 'evening' : 'morning'; }
/** The next greatest elongation after ms: {ms, deg, side: 'evening' | 'morning'}. */
export function nextMaxElongation(body, ms) { const m = AE().SearchMaxElongation(body, date(ms)); return { ms: m.time.date.getTime(), deg: m.elongation, side: m.visibility }; }
/** Signed elongation samples every `step` days: [{t, v}]. */
export function elongationSeries(body, ms0, days, step = 4) { const out = []; for (let d = 0; d <= days; d += step) out.push({ t: ms0 + d * DAY, v: signedElongation(body, ms0 + d * DAY) }); return out; }

// ---------------------------------------------------------------------------------------------------------------- the Moon's path and eclipses
/** The Moon's height above (+) or below (-) the Sun's path (ecliptic latitude), degrees. */
export const moonLat = (ms) => eclLat('Moon', ms);
/** Pole of the Moon's orbit and the two nodes, as J2000 {ra, dec}: ascending node is where the Moon crosses the ecliptic going north. */
export function moonPathGeometry(ms) {
  const Ae = AE(), s = Ae.GeoMoonState(date(ms)), n = unit(crossP(toApp(s), toApp({ x: s.vx, y: s.vy, z: s.vz })));
  const k = A.eqToVec(ECL_POLE.ra, ECL_POLE.dec), asc = unit(crossP(k, n));
  return { pole: eqOf(n), asc: eqOf(asc), desc: eqOf(asc.map((x) => -x)), tilt: angleDeg(k, n) };
}
const OBLIQ = 23.4393 * DEG;
/** App-axes vector (J2000) of the point at ecliptic longitude / latitude (degrees). */
export function eclToApp(lonDeg, latDeg = 0) {
  const l = lonDeg * DEG, b = latDeg * DEG, x = Math.cos(b) * Math.cos(l), ye = Math.cos(b) * Math.sin(l), ze = Math.sin(b);
  return [x, ye * Math.sin(OBLIQ) + ze * Math.cos(OBLIQ), -(ye * Math.cos(OBLIQ) - ze * Math.sin(OBLIQ))];
}
/** Ecliptic longitude (degrees) of an app-axes J2000 vector. */
export const eclLonOfApp = (v) => A.norm360(Math.atan2(-v[2] * Math.cos(OBLIQ) + v[1] * Math.sin(OBLIQ), v[0]) * RAD);
/** {ra, dec} of the point at ecliptic longitude lonDeg on the Sun's path (ecliptic latitude 0). */
export const eclPoint = (lonDeg) => eqOf(eclToApp(lonDeg, 0));
/** {ra, dec} of the point of the Moon's path (geometry g from moonPathGeometry) at ecliptic longitude lonDeg: its latitude is tilt * sin(longitude from the ascending node). */
export function moonPathPoint(g, lonDeg) {
  const asc = eclLonOfApp(A.eqToVec(g.asc.ra, g.asc.dec));
  return eqOf(eclToApp(lonDeg, g.tilt * Math.sin((lonDeg - asc) * DEG)));
}
/** The next `count` lunar eclipses after ms, partial or total only (penumbral shadings are barely visible): [{ms, kind}]. */
export function lunarEclipses(ms, count = 6) {
  const Ae = AE(), out = []; let e = Ae.SearchLunarEclipse(date(ms));
  for (let i = 0; i < 40 && out.length < count; i++) { if (e.kind !== 'penumbral') out.push({ ms: e.peak.date.getTime(), kind: e.kind }); e = Ae.NextLunarEclipse(e.peak); }
  return out;
}
/** True when any lunar eclipse (even penumbral) peaks within `days` of ms. */
export function anyLunarEclipseNear(ms, days = 2) {
  const Ae = AE(), e = Ae.SearchLunarEclipse(date(ms - days * DAY)); return Math.abs(e.peak.date.getTime() - ms) <= days * DAY;
}
/** The next lunar eclipse (partial or total) whose middle you can see from a place (the Moon is up at the peak): {ms, kind} or null. */
export function nextVisibleLunar(lat, lon, ms) {
  for (const e of lunarEclipses(ms, 14)) if (bodyAltAz('Moon', lat, lon, e.ms).alt > 0) return e;
  return null;
}
/** The next solar eclipse seen from a place with the Sun above the horizon at maximum: {ms, kind, obscuration} or null. */
export function nextVisibleSolar(lat, lon, ms) {
  const Ae = AE(), o = new Ae.Observer(lat, lon, 0);
  let e = Ae.SearchLocalSolarEclipse(date(ms), o);
  for (let i = 0; i < 24; i++) {
    if (e.peak.altitude > 0 && e.obscuration > 0.05) return { ms: e.peak.time.date.getTime(), kind: e.kind, obscuration: e.obscuration };
    e = Ae.NextLocalSolarEclipse(e.peak.time, o);
  }
  return null;
}
/** The full Moons from ms on: first `count` of them, ms each. */
export function fullMoons(ms, count = 14) { const out = []; let t = ms; for (let i = 0; i < count; i++) { const f = nextPhaseMs(180, t, 40); if (f === null) break; out.push(f); t = f + 5 * DAY; } return out; }
/** The full Moons around the next lunar eclipse: the eclipse itself and what it is compared with.
 *  Returns {eclipse: {ms, kind}, run: [{ms, lat, eclipsed}], index} where run is the full Moons from `before` earlier to `after` later (eclipsed = within the shadow band). */
export function eclipseRun(ms, before = 5, after = 1) {
  const e = lunarEclipses(ms, 1)[0];
  let f0 = e.ms - (before + 0.5) * 29.53 * DAY, list = [];
  for (let i = 0, t = f0; i < before + after + 2; i++) { const f = nextPhaseMs(180, t, 40); list.push(f); t = f + 5 * DAY; }
  const index = list.reduce((bi, f, i) => (Math.abs(f - e.ms) < Math.abs(list[bi] - e.ms) ? i : bi), 0);
  const run = list.slice(Math.max(0, index - before), index + after + 1).map((f) => ({ ms: f, lat: moonLat(f), eclipsed: anyLunarEclipseNear(f, 1.5) }));
  return { eclipse: e, run, index: Math.min(before, index) };
}
/** Three upcoming-ish full Moons for the Try: the eclipsed one and two neighbours with no eclipse of any kind. Returns [{ms, eclipsed}] in time order. */
export function eclipseChoices(ms) {
  const e = lunarEclipses(ms, 1)[0], fs = fullMoons(e.ms - 4 * 29.53 * DAY, 9), i = fs.reduce((bi, f, k) => (Math.abs(f - e.ms) < Math.abs(fs[bi] - e.ms) ? k : bi), 0);
  const ok = (k) => k >= 0 && k < fs.length && !anyLunarEclipseNear(fs[k], 3);
  let pick = [i - 1, i + 1].filter(ok); if (pick.length < 2) pick = [i - 2, i - 1, i + 1, i + 2].filter(ok).slice(0, 2);
  return [i, ...pick].sort((p, q) => p - q).map((k) => ({ ms: fs[k], eclipsed: k === i, kind: k === i ? e.kind : null, peak: k === i ? e.ms : null }));
}

// ---------------------------------------------------------------------------------------------------------------- precession and proper motion
export const J2000_MS = Date.UTC(2000, 0, 1, 12);
/** Julian date of an astronomical year number (year 0 = 1 BC), taken as the year's 1 July (J2000 = 2000.0). */
export const jdOfYear = (E) => 2451545 + (E - 2000) * 365.25;
/** The north celestial pole in the year E, as a J2000 unit vector in the app's axes (the app's long-term precession model). */
export function poleAtYear(E) { const M = A.precessionMatrixLongMine(jdOfYear(E)); return [M[3], M[4], M[5]]; }
/** The Earth-axis circle: points {ra, dec} of the pole at every `step` years across [E0, E1]. */
export function poleTrack(E0, E1, step = 100) { const out = []; for (let E = E0; E <= E1 + 1e-6; E += step) out.push(eqOf(poleAtYear(E))); return out; }
/** Angle between the pole of year E and a point (unit vector), degrees. */
export const poleSeparation = (E, v) => angleDeg(poleAtYear(E), unit(v));
/** The year in [E0, E1] when the pole comes closest to a J2000 point, and how close: {year, deg}. */
export function poleClosest(v, E0, E1, step = 1) { let best = null; for (let E = E0; E <= E1 + 1e-6; E += step) { const d = poleSeparation(E, v); if (!best || d < best.deg) best = { year: E, deg: d }; } return best; }
/** J2000 unit vector of a star moved by proper motion to the year E (pm in mas/yr, pmra includes cos dec). */
export function starAtYear(ra, dec, pmra, pmdec, E) { return A.movedStar(ra, dec, pmra || 0, pmdec || 0, E - 2000); }
/** A star's proper-motion path as {ra, dec} points every `step` years across [E0, E1]. */
export function propermotionTrack(ra, dec, pmra, pmdec, E0, E1, step = 250) { const out = []; for (let E = E0; E <= E1 + 1e-6; E += step) out.push(eqOf(starAtYear(ra, dec, pmra, pmdec, E))); return out; }
/** Year label: "3000 BC", "AD 6000" (astronomical year numbers; year 0 is written "1 BC"). */
export function yearText(E, bc = 'BC', ad = 'AD') { const y = Math.round(E); return y <= 0 ? `${1 - y} ${bc}` : `${ad} ${y}`; }

// ---------------------------------------------------------------------------------------------------------------- the Sun among the constellations
const zodiacOrder = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpius', 'Ophiuchus', 'Sagittarius', 'Capricornus', 'Aquarius', 'Pisces'];
export { zodiacOrder };
/** The June or December solstice of a year (ms), from astronomy-engine. */
export function solsticeMs(year, june = true) { const s = AE().Seasons(year); return (june ? s.jun_solstice : s.dec_solstice).date.getTime(); }
/** The next June (or December) solstice after ms. */
export function nextSolsticeOf(ms, june) {
  const y = new Date(ms).getUTCFullYear(); for (const yy of [y, y + 1]) { const t = solsticeMs(yy, june); if (t > ms) return t; } return solsticeMs(y + 2, june);
}
/** The next solstice after ms: {ms, june}. */
export function nextSolstice(ms) {
  const y = new Date(ms).getUTCFullYear(), c = [[solsticeMs(y, true), true], [solsticeMs(y, false), false], [solsticeMs(y + 1, true), true]].find(([t]) => t > ms);
  return { ms: c[0], june: c[1] };
}
/** Name of the constellation containing a J2000 {ra, dec}. */
export function consOf(eq) { try { return AE().Constellation(eq.ra / 15, eq.dec).name; } catch (e) { return ''; } }
/** Constellation of the Sun at an instant, from astronomy-engine (J2000). */
export function sunConsAt(ms) { return consOf(eqOf(toApp(AE().GeoVector('Sun', date(ms), false)))); }
/** The Tropic nearest a latitude: {north: true (Cancer) | false (Capricorn), km, from: 'south'|'north'} where `from` is the direction of the tropic from the place. */
export function nearestTropic(lat, obliq = 23.4393, kmPerDeg = 111.2) {
  const dn = Math.abs(lat - obliq), ds = Math.abs(lat + obliq), north = dn <= ds, line = north ? obliq : -obliq;
  return { north, km: Math.abs(lat - line) * kmPerDeg, toward: line > lat ? 'north' : line < lat ? 'south' : 'here' };
}
