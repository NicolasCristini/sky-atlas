import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import * as A from '../js/astro.js';
const require = createRequire(import.meta.url);
let Astronomy = null;
try { Astronomy = require('../vendor/astronomy.browser.min.js'); } catch (e) { console.log('SKIP astronomy-engine cross-checks:', e.message); }
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok -', name); };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} got ${a} expected ${b} (tol ${tol})`);
const stars = JSON.parse(fs.readFileSync(new URL('../data/stars.6.json', import.meta.url)));
const hip = (id) => { const f = stars.features.find((s) => s.id === id); const [ra, dec] = f.geometry.coordinates; return { ra: A.norm360(ra), dec }; };
const polaris = hip(11767), acrux = hip(60718), sirius = hip(32349);

ok('Polaris altitude ~ latitude (mean of culminations within 0.2 deg)', () => {
  for (const lat of [10, 30, 45, 60, 80]) {
    const up = A.classifyVisibility(polaris.dec, lat), mean = (up.maxAlt + up.minAlt) / 2;
    near(mean, lat, 0.2, `lat ${lat}`);
    assert.equal(up.kind, 'circumpolar');
  }
});
ok('Polaris altitude sampled over a day stays within 1 deg of latitude', () => {
  const jd0 = A.jdFromMs(Date.UTC(2026, 5, 1));
  for (const lat of [20, 41.9, 60]) {
    let lo = 99, hi = -99;
    for (let i = 0; i < 96; i++) { const r = A.eqToAltAz(polaris.ra, polaris.dec, lat, 12, jd0 + i / 96); lo = Math.min(lo, r.alt); hi = Math.max(hi, r.alt); }
    assert.ok(lo > lat - 1.2 && hi < lat + 1.2, `lat ${lat}: ${lo}..${hi}`);
  }
});
ok('Polaris at the North Pole is at the zenith (alt ~ 89.3)', () => {
  const r = A.eqToAltAz(polaris.ra, polaris.dec, 90, 0, A.jdFromMs(Date.now()));
  near(r.alt, 89.3, 0.3);
});
ok('Lat -34: Polaris never rises, Acrux circumpolar', () => {
  assert.equal(A.classifyVisibility(polaris.dec, -34).kind, 'never');
  assert.equal(A.classifyVisibility(acrux.dec, -34).kind, 'circumpolar');
  near(acrux.dec, -63.1, 0.3);
});
ok('Rome (41.9N): Acrux never rises; Sirius rises and sets', () => {
  assert.equal(A.classifyVisibility(acrux.dec, 41.9).kind, 'never');
  assert.equal(A.classifyVisibility(sirius.dec, 41.9).kind, 'risesSets');
  near(A.classifyVisibility(sirius.dec, 41.9).maxAlt, 90 - (41.9 + 16.72), 0.1);
});
ok('visible fraction', () => { near(A.visibleFraction(0), 1, 1e-9); near(A.visibleFraction(90), 0.5, 1e-9); near(A.visibleFraction(-60), 0.75, 1e-9); });
ok('lat/lon vector round trip, and Italy / Greenwich convention', () => {
  const v = A.latLonToVec(42, 12); const r = A.vecToLatLon(v); near(r.lat, 42, 1e-9); near(r.lon, 12, 1e-9);
  const g = A.latLonToVec(0, 0); near(g[0], 1, 1e-12); const e = A.latLonToVec(0, 90); near(e[2], -1, 1e-12);
  const b = A.localBasis(0, 0); near(b.E[2], -1, 1e-12); near(b.N[1], 1, 1e-12);
});
ok('great circle endpoints and transport', () => {
  const a = A.latLonToVec(41.9, 12.5), b = A.latLonToVec(-33.9, 151.2), gc = A.greatCircle(a, b);
  const s = gc.at(0), e = gc.at(1);
  for (let i = 0; i < 3; i++) { near(s[i], a[i], 1e-9); near(e[i], b[i], 1e-9); }
  const mid = gc.at(0.5); near(Math.hypot(...mid), 1, 1e-9);
  near(A.angleBetween(a, mid), gc.angle / 2, 1e-9);
  // transported vector stays at the same angle to the moving "up"
  const v = A.dirFromAzAlt(30, 40, A.localBasis(41.9, 12.5)); const w = gc.rotate(v, 1);
  near(A.angleBetween(v, a), A.angleBetween(w, b), 1e-9);
  near(A.distanceKm(41.9, 12.5, -33.9, 151.2), 16300, 400);
});
ok('GMST vs astronomy-engine', () => {
  if (!Astronomy) return;
  for (const ms of [Date.UTC(2026, 0, 1, 3), Date.UTC(2026, 8, 22, 18, 30), Date.UTC(2020, 5, 5)]) {
    const mine = A.gmstHours(A.jdFromMs(ms)), ref = Astronomy.SiderealTime(new Date(ms));
    const d = Math.abs(((mine - ref + 12) % 24 + 24) % 24 - 12); assert.ok(d < 0.001, `${mine} vs ${ref}`);
  }
});
ok('precession matches astronomy-engine EQJ->EQD', () => {
  if (!Astronomy) return;
  const date = new Date(Date.UTC(2026, 6, 1)), jd = A.jdFromMs(+date);
  const rot = Astronomy.Rotation_EQJ_EQD(date);
  const P = A.precessionMatrix(jd);
  const v = [0.3, 0.5, 0.8]; const l = Math.hypot(...v); const u = v.map((x) => x / l);
  const ref = Astronomy.RotateVector(rot, new Astronomy.Vector(u[0], u[1], u[2], date));
  const mine = [P[0] * u[0] + P[1] * u[1] + P[2] * u[2], P[3] * u[0] + P[4] * u[1] + P[5] * u[2], P[6] * u[0] + P[7] * u[1] + P[8] * u[2]];
  near(A.angleBetween(mine, [ref.x, ref.y, ref.z]) * A.RAD, 0, 0.01);
});
ok('Sirius alt/az within 0.5 deg of Astronomy.Horizon', () => {
  if (!Astronomy) return;
  const cases = [[41.9, 12.5, Date.UTC(2026, 0, 15, 21)], [-33.9, 151.2, Date.UTC(2026, 0, 15, 12)], [64.9, -18, Date.UTC(2026, 2, 3, 22)], [0, -78.5, Date.UTC(2026, 10, 15, 3)]];
  for (const [lat, lon, ms] of cases) {
    const date = new Date(ms), jd = A.jdFromMs(ms);
    const mine = A.eqToAltAz(sirius.ra, sirius.dec, lat, lon, jd);
    // refer to equator of date via astronomy-engine's own precession
    const v = A.eqToVec(sirius.ra, sirius.dec);
    const ofdate = Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(date), new Astronomy.Vector(v[0], -v[2], v[1], date));
    const sph = Astronomy.SphereFromVector(ofdate);
    const ref = Astronomy.Horizon(date, new Astronomy.Observer(lat, lon, 0), sph.lon / 15, sph.lat, null);
    near(mine.alt, ref.altitude, 0.5, 'alt'); const da = Math.abs(((mine.az - ref.azimuth + 180) % 360 + 360) % 360 - 180); assert.ok(da < 0.5, `az ${mine.az} vs ${ref.azimuth}`);
  }
});
ok('local solar time', () => { near(A.localSolarHours(Date.UTC(2026, 0, 1, 12), 15), 13, 1e-9); near(A.localSolarHours(Date.UTC(2026, 0, 1, 1), -30), 23, 1e-9); });
ok('handedness: stars rise in the east (az<180 => altitude increasing), counter-clockwise about Polaris from the north', () => {
  const jd0 = A.jdFromMs(Date.UTC(2026, 3, 10, 20));
  let checked = 0;
  for (const lat of [41.9, -33.9, 64]) {
    for (let i = 0; i < stars.features.length; i += 7) {
      const f = stars.features[i]; if (f.properties.mag > 4) continue;
      const ra = A.norm360(f.geometry.coordinates[0]), dec = f.geometry.coordinates[1];
      const a0 = A.eqToAltAz(ra, dec, lat, 10, jd0), a1 = A.eqToAltAz(ra, dec, lat, 10, jd0 + 0.01);
      if (a0.alt < 8 || a0.alt > 80) continue; if (Math.abs(a0.az - 180) < 10 || a0.az < 10 || a0.az > 350) continue;
      const rising = a1.alt > a0.alt; assert.equal(rising, a0.az < 180, `lat ${lat} star ${f.id} az ${a0.az} alt ${a0.alt}`); checked++;
    }
  }
  assert.ok(checked > 30, 'checked ' + checked);
  // counter-clockwise around the north pole (viewed facing north): azimuth of a circumpolar star near the pole decreases... use position angle
  const pa = (jd) => { const p = A.eqToAltAz(polaris.ra, polaris.dec, 41.9, 10, jd), k = A.eqToAltAz(A.norm360(165.9), 61.75, 41.9, 10, jd); // Dubhe
    // screen coords facing north: x = right (east), y = up; use stereographic-ish offsets relative to Polaris
    const sx = (o) => Math.cos(o.alt * A.DEG) * Math.sin(o.az * A.DEG), sy = (o) => Math.sin(o.alt * A.DEG);
    return Math.atan2(sy(k) - sy(p), sx(k) - sx(p)); };
  let d = pa(jd0 + 0.02) - pa(jd0); d = Math.atan2(Math.sin(d), Math.cos(d));
  assert.ok(d > 0, 'Dubhe should move counter-clockwise around Polaris, dAngle=' + d);
});


// ======================= Deep time (Ages) =======================
import * as AG from '../js/ages.js';
import * as SQ from '../js/skyquality.js';
const extra = JSON.parse(fs.readFileSync(new URL('../data/starextra.json', import.meta.url)));
const J2000 = 2451545.0, jdOfYear = (y) => J2000 + (y - 2000) * 365.25;          // astronomical year number (1 BC = 0)
const starPm = (id) => { const s = hip(id), i = extra.hip.indexOf(id); return { ...s, pmra: extra.pmra[i] || 0, pmdec: extra.pmdec[i] || 0 }; };
const starAt = (id, year) => { const s = starPm(id); return A.movedStar(s.ra, s.dec, s.pmra, s.pmdec, year - 2000); };
const sepToPole = (id, year) => A.angleBetween(starAt(id, year), A.poleOfDate(A.precessionMatrixLongMine(jdOfYear(year)))) * A.RAD;
const THUBAN = 68756, VEGA = 91262, KOCHAB = 72607;

ok('long-term precession is the identity at J2000 and a rotation everywhere', () => {
  const I = A.precessionMatrixLong(J2000); [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((x, i) => near(I[i], x, 1e-9));
  for (const y of [-10000, -3000, 5000, 14000]) { const P = A.precessionMatrixLong(jdOfYear(y)); const PPt = A.mulMat(P, A.transposeMat(P)); [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((x, i) => near(PPt[i], x, 1e-9)); }
});
ok('long-term precession agrees with astronomy-engine within 0.3 deg at +-2000 years (actual: a few thousandths)', () => {
  if (!Astronomy) return;
  for (const y of [0, 500, 1000, 1500, 2000, 2500, 3000, 4000]) {
    const jd = jdOfYear(y), date = new Date((jd - 2440587.5) * 86400000), rot = Astronomy.Rotation_EQJ_EQD(date), P = A.precessionMatrixLong(jd);
    let worst = 0;
    for (const v of [[0.3, 0.5, 0.8], [1, 0, 0], [0, 0, 1], [-0.5, 0.7, 0.2], [0, 1, 0], [0.1, -0.9, -0.4]]) {
      const l = Math.hypot(...v), u = v.map((x) => x / l), ref = Astronomy.RotateVector(rot, new Astronomy.Vector(u[0], u[1], u[2], date));
      worst = Math.max(worst, A.angleBetween(A.applyMat(P, u), [ref.x, ref.y, ref.z]) * A.RAD);
    }
    assert.ok(worst < (Math.abs(y - 2000) <= 2000 ? 0.3 : 0.6), `year ${y}: ${worst} deg`);
    if (Math.abs(y - 2000) <= 2000) assert.ok(worst < 0.01, `year ${y} expected arcsecond-level agreement, got ${worst}`);
  }
});
ok('obliquity (Laskar): 23.439 deg now, larger in the past, smaller ahead', () => {
  near(A.obliquityDeg(0), 23.4393, 0.001); assert.ok(A.obliquityDeg(-50) > 24.0 && A.obliquityDeg(-50) < 24.3); assert.ok(A.obliquityDeg(100) < 22.7);
});
ok('Thuban lies within 1 deg of the north celestial pole near 2800 BC (with proper motion)', () => {
  const d = sepToPole(THUBAN, -2799); assert.ok(d < 1, `${d} deg`);
  assert.ok(sepToPole(THUBAN, 2000) > 20);
});
ok('Polaris: closest to the pole (<0.6 deg) around AD 2100, far from it in 1000 BC', () => {
  let best = [1e9, 0]; for (let y = 2000; y <= 2200; y++) { const d = sepToPole(11767, y); if (d < best[0]) best = [d, y]; }
  assert.ok(best[0] < 0.6 && best[1] >= 2090 && best[1] <= 2115, `min ${best[0]} deg in ${best[1]}`);
  // NOTE: the brief expected 8-12 deg in 1000 BC; the geometry gives ~17 deg (the pole moves 2*23.4*sin(21 deg) ~ 17 deg in 3000 years,
  // and Polaris sat next to the pole today). We assert the physical value and cross-check it against astronomy-engine's own precession.
  const d1000 = sepToPole(11767, -999); assert.ok(d1000 > 15 && d1000 < 19, `${d1000} deg`);
  if (Astronomy) {
    const jd = jdOfYear(-999), date = new Date((jd - 2440587.5) * 86400000), v = starAt(11767, -999);
    const ref = Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(date), new Astronomy.Vector(v[0], -v[2], v[1], date));   // ours -> textbook axes
    near(Math.acos(ref.z / Math.hypot(ref.x, ref.y, ref.z)) * A.RAD, d1000, 0.2, 'astronomy-engine agrees');
  }
});
ok('Vega is nearest the pole (4-6.5 deg) around AD 13 700-14 000, and is the bright pole star there', () => {
  let best = [1e9, 0]; for (let y = 12500; y <= 15000; y += 10) { const d = sepToPole(VEGA, y); if (d < best[0]) best = [d, y]; }
  assert.ok(best[0] > 4 && best[0] < 6.5 && best[1] >= 13300 && best[1] <= 14100, `min ${best[0]} deg in ${best[1]}`);
  const n = stars.features.length, cur = new Float32Array(n * 3), mag = new Float32Array(n);
  stars.features.forEach((f, i) => { const s = starPm(f.id), v = A.movedStar(s.ra, s.dec, s.pmra, s.pmdec, 13700 - 2000); cur.set(v, i * 3); mag[i] = f.properties.mag; });
  const r = AG.nearestPoleStar(cur, mag, n, A.poleOfDate(A.precessionMatrixLongMine(jdOfYear(13700))));
  assert.equal(stars.features[r.index].id, VEGA); assert.ok(r.sepDeg < 7);
});
ok('Crux is fully above the horizon at culmination from 35N around 3000 BC, and is not today', () => {
  for (const id of [60718, 62434, 61084, 59747]) {   // Acrux, Mimosa, Gacrux, Delta Cru
    const v = starAt(id, -2999), w = A.applyMat(A.precessionMatrixLongMine(jdOfYear(-2999)), v), dec = Math.asin(w[1]) * A.RAD;
    assert.ok(A.classifyVisibility(dec, 35).maxAlt > 10, `star ${id}: dec ${dec} max alt ${A.classifyVisibility(dec, 35).maxAlt}`);
    assert.equal(A.classifyVisibility(hip(id).dec, 35).kind, 'never');
  }
});
ok('no-wobble pole drift: the pole of date moves steadily (no jitter) along its circle', () => {
  const p = (y) => A.poleOfDate(A.precessionMatrixLongMine(jdOfYear(y)));
  let prev = null, steps = [];
  for (let y = -6000; y <= 6000; y += 100) { const q = p(y); if (prev) steps.push(A.angleBetween(prev, q) * A.RAD); prev = q; }
  const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
  for (const d of steps) assert.ok(Math.abs(d - mean) < 0.12 * mean + 0.02, `step ${d} vs mean ${mean}`);     // ~1.4 deg per century of precession on a 23-deg radius circle
});
ok('proper motion: Arcturus and Sirius move by |mu| * dt; zero dt is the identity', () => {
  for (const [id, mu] of [[69673, 2.281], [32349, 1.34]]) {
    const s = starPm(id), v0 = A.eqToVec(s.ra, s.dec), v1 = A.movedStar(s.ra, s.dec, s.pmra, s.pmdec, 1000);
    near(A.angleBetween(v0, v1) * A.RAD * 3600, mu * 1000, mu * 1000 * 0.02, `star ${id}`);
    near(A.angleBetween(v0, A.movedStar(s.ra, s.dec, s.pmra, s.pmdec, 0)), 0, 1e-9);
  }
});
ok('seasonal Sun: re-tilting to another obliquity moves the solstice Sun to that declination, identity for the same one', () => {
  const e0 = 23.44 * A.DEG, e1 = 24.2 * A.DEG, sun = [Math.cos(0), Math.sin(e0), -0];           // solstice: ecliptic longitude 90
  const sol = A.latLonToVec(0, 0); const v = [0, Math.sin(e0), -Math.cos(e0)];                   // RA 90 deg, dec = e0 in our axes
  near(A.vecToLatLon(A.retiltObliquity(v, e0, e0)).lat, 23.44, 1e-9);
  near(A.vecToLatLon(A.retiltObliquity(v, e0, e1)).lat, 24.2, 1e-9);
});
ok('Year mode: holding local solar time moves the sidereal angle by ~0.9856 deg per day', () => {
  const k = 0.98564736629 / 360.98564736629, jd = jdOfYear(2026) + 10;
  const d = A.norm180((A.gmstHours(jd + 1 * k) - A.gmstHours(jd)) * 15);
  near(d, 0.98564736629, 1e-5);
});
ok('Ages scrubber: log mapping round-trips, reaches +-13 000 years, and gives fine control near today', () => {
  for (const y of [-13000, -10000, -2500, -500, -3, 0, 3, 500, 2500, 10000, 13000]) near(AG.sliderToYears(AG.yearsToSlider(y)), y, 1e-6 * 13000);
  near(AG.sliderToYears(2000), 13000, 1e-6); near(AG.sliderToYears(-2000), -13000, 1e-6);
  let prev = -1e9; for (let s = -2000; s <= 2000; s += 25) { const y = AG.sliderToYears(s); assert.ok(y > prev); prev = y; }
  assert.ok(Math.abs(AG.sliderToYears(1)) < 1, 'one tick near today is under a year');
  const s500 = AG.yearsToSlider(500), s10k = AG.yearsToSlider(10000);
  assert.ok(s500 > 300 && s500 < 700 && s10k > 1500 && s10k < 1950, `${s500} ${s10k}`);       // both +-500 and +-10 000 sit comfortably inside the slider
});
ok('year formatting: BC/AD, thousands grouping, calendar-year floor', () => {
  assert.equal(AG.formatYear(-2559).text, '2560 BC'); assert.equal(AG.formatYear(-129).text, '130 BC'); assert.equal(AG.formatYear(0).text, '1 BC');
  assert.equal(AG.formatYear(2026.87).text, 'AD 2026'); assert.equal(AG.formatYear(13700).text, 'AD 13 700'); assert.equal(AG.formatYear(-9999).text, '10 000 BC');
  near(AG.decimalYear(Date.UTC(2026, 6, 2, 12)), 2026.5, 0.003);
});
ok('planets fade: full within 4000 years of 2000, gone beyond 5000', () => {
  assert.equal(AG.bodiesFade(2026), 1); assert.equal(AG.bodiesFade(-1999), 1); assert.equal(AG.bodiesFade(-4000), 0); assert.equal(AG.bodiesFade(7000), 0);
  const m = AG.bodiesFade(-2500); assert.ok(m > 0 && m < 1);
});
ok('sky quality: stops, monotone limits, star counts above the horizon', () => {
  const names = [0, 1, 2, 3, 4].map((q) => SQ.qualityParams(q).name); assert.deepEqual(names, ['Big city', 'Suburb', 'Countryside', 'Dark site', 'Enhanced']);
  near(SQ.qualityParams(0).limit, 3.0, 1e-9); near(SQ.qualityParams(1).limit, 4.5, 1e-9); near(SQ.qualityParams(2).limit, 5.5, 1e-9); near(SQ.qualityParams(3).limit, 6.5, 1e-9);
  assert.ok(SQ.qualityParams(3.5).limit > 6.5 && SQ.qualityParams(0.5).pol < 1 && SQ.qualityParams(0.5).pol > SQ.qualityParams(1).pol);
  assert.equal(SQ.qualityParams(0).mw, 0); assert.ok(SQ.qualityParams(2).mw > 0.3 && SQ.qualityParams(2).mw < 0.7 && SQ.qualityParams(3).mw === 1 && SQ.qualityParams(4).mw > 1);
  // count above the horizon in Rome, 22:00 local solar mid-November
  const n = stars.features.length, eq = new Float32Array(n * 3), mag = new Float32Array(n);
  stars.features.forEach((f, i) => { const [ra, dec] = f.geometry.coordinates; eq.set(A.eqToVec(A.norm360(ra), dec), i * 3); mag[i] = f.properties.mag; });
  const jd = A.jdFromMs(Date.UTC(2026, 10, 15, 21, 10)), P = A.precessionMatrixMine(jd), gm = A.gmstHours(jd) * 15 * A.DEG;
  const U = A.localBasis(41.9, 12.5).U, c = Math.cos(gm), s = Math.sin(gm);
  // world = Ry(-gmst) P v  =>  celestial-frame up = P^T Ry(gmst) U
  const Uc = [c * U[0] - s * U[2], U[1], s * U[0] + c * U[2]], up = A.applyMat(A.transposeMat(P), Uc);
  const counts = [3.0, 4.5, 5.5, 6.5, 99].map((l) => SQ.countVisible(eq, mag, n, up, l));
  assert.ok(counts[0] > 40 && counts[0] < 140, `city ${counts[0]}`); assert.ok(counts[3] > 2000 && counts[3] < 3000, `dark ${counts[3]}`);
  for (let i = 1; i < counts.length - 1; i++) assert.ok(counts[i] > counts[i - 1]);
  assert.equal(counts[4], counts[3]);   // the catalogue ends at 6.5
  console.log('   star counts above the horizon (Rome): city', counts[0], 'suburb', counts[1], 'country', counts[2], 'dark', counts[3]);
  near(SQ.exposureFromSlider(SQ.sliderFromExposure(1)), 1, 1e-9); near(SQ.exposureFromSlider(0), 0.5, 1e-9); near(SQ.exposureFromSlider(1), 3, 1e-9);
});
ok('pole star naming: Polaris today (north), nothing bright at the south pole', () => {
  const n = stars.features.length, cur = new Float32Array(n * 3), mag = new Float32Array(n);
  stars.features.forEach((f, i) => { const s = starPm(f.id); cur.set(A.movedStar(s.ra, s.dec, s.pmra, s.pmdec, 26), i * 3); mag[i] = f.properties.mag; });
  const p = A.poleOfDate(A.precessionMatrixMine(A.jdFromMs(Date.UTC(2026, 10, 15))));
  const r = AG.nearestPoleStar(cur, mag, n, p); assert.equal(stars.features[r.index].id, 11767); assert.ok(r.sepDeg > 0.4 && r.sepDeg < 0.8, `${r.sepDeg}`);
  assert.equal(AG.nearestPoleStar(cur, mag, n, p.map((x) => -x)), null);
});
console.log(`\n${n} tests passed`);
