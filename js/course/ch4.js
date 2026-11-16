// Chapter 4: Where you stand. Lesson LOGIC only: every sentence the learner reads lives in content/<lang>/course.md under the same ids.
// See js/course/README.md for how a lesson is put together.
import * as G from './geo.js';
import { HIP } from './geo.js';
import { latitudeBetween, choice, custom, objectAltitude } from './checks.js';
import { CITIES } from '../cities.js';

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const DAY = 864e5;
const poleAz = (lat) => (lat >= 0 ? 0 : 180);
const homeLat = (P, kit) => (kit.home ? kit.home.lat : P.lat);
const norm180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

// ---- 4.2 ------------------------------------------------------------------------------------------------------------------
/** The brightest star that never rises from the learner's latitude, with the latitude you must get nearer the equator than to see it. */
function neverInfo(P, kit) {
  const lat = homeLat(P, kit);
  if (Math.abs(lat) < 2) return null;
  const st = kit.data.stars, nv = G.brightestNeverRises(st, lat);
  if (!nv) return null;
  const sgn = nv.latToSee >= 0 ? 'N' : 'S', words = kit.words('compass');
  return { i: nv.i, hip: st.hip[nv.i], dec: st.dec[nv.i], lat, neverStar: kit.starName(st.hip[nv.i]), latToSeeIt: `${Math.round(Math.abs(nv.latToSee))}°${sgn}`, towardsEquator: lat >= 0 ? words[4] : words[0], faceDir: lat >= 0 ? words[4] : words[0] };
}

// ---- 4.3 ------------------------------------------------------------------------------------------------------------------
const ASWAN = { lat: 24.09, lon: 32.89 }, ALEX = { lat: 31.2, lon: 29.92 };
/** Everything the lesson says in numbers, from the Sun's computed noon height at the June solstice. */
function eratosthenes() {
  const ms = Date.UTC(new Date().getUTCFullYear(), 5, 21, 10);
  const hA = G.noonSunAlt(ASWAN.lat, ms), hB = G.noonSunAlt(ALEX.lat, ms), gap = hA - hB;
  const km = G.roundTo(Math.abs(ALEX.lat - ASWAN.lat) * G.KM_PER_DEG, 10), earth = G.roundTo(G.circumferenceKm(gap, km), 1000);
  return { hA, hB, gap, km, earth, ms };
}
/** A city about 700 km north or south of the learner, on about the same meridian. */
function cityNS(P) {
  let best = null, bd = 1e9;
  for (const c of CITIES) {
    const km = Math.abs(c.lat - P.lat) * G.KM_PER_DEG;
    if (km < 300 || km > 1500 || Math.abs(norm180(c.lon - P.lon)) > 8) continue;
    if (Math.abs(km - 700) < bd) { bd = Math.abs(km - 700); best = c; }
  }
  return best;
}
/** Glide the globe camera to look at a place. */
async function aimGlobe(X, lat, lon, dist, ms) {
  const g = X.S.globe, l0 = g.lat, o0 = g.lon, d0 = g.dist, t0 = performance.now();
  for (let u = 0; u < 1;) {
    await X.D.wait(30);
    u = clamp((performance.now() - t0) / ms, 0, 1);
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    g.lat = l0 + (lat - l0) * e; g.lon = o0 + norm180(lon - o0) * e; g.dist = d0 + (dist - d0) * e; g.vLat = g.vLon = 0;
  }
}
/** The Aswan and Alexandria scene on the globe. step 0 = nothing, 1 = pins and the two Suns, 2 = the verticals, 3 = angles. Returns the pieces. */
async function eratoScene(X, quick) {
  const { D, ov, S } = X, n = eratosthenes();
  await D.prep();
  X.setClock(G.localMs(Date.UTC(new Date().getUTCFullYear(), 5, 21), ASWAN.lon, 12));
  await D.toGlobe();
  const tall = window.innerWidth < window.innerHeight;                      // phones: look nearer to Egypt, the sky is narrow
  await aimGlobe(X, tall ? 26 : 20, tall ? 24 : 12, tall ? 2.9 : 2.7, quick ? 500 : 1800);
  const pa = ov.geo(ASWAN.lat, ASWAN.lon), pb = ov.geo(ALEX.lat, ALEX.lon);
  const out = (p, k) => ov.geo(p === pa ? ASWAN.lat : ALEX.lat, p === pa ? ASWAN.lon : ALEX.lon, k);
  const ray = (p) => () => { const s = ov.sunDir(); return [p[0] + s[0] * 0.62, p[1] + s[1] * 0.62, p[2] + s[2] * 0.62]; };
  const sunTxt = (h) => X.ui('sunUp', { alt: Math.round(h) });
  const parts = {
    pins() {
      ov.gmarker(pa, { r: 6, color: 'gold', text: `${X.ui('placeAswan')}: ${sunTxt(n.hA)}`, align: 'right', dx: -10, dy: 0, size: 13 });
      ov.gmarker(pb, { r: 6, color: 'gold', text: `${X.ui('placeAlexandria')}: ${sunTxt(n.hB)}`, align: 'right', dx: -10, dy: 0, size: 13 });
    },
    sun() {
      ov.gline(pa, ray(pa), { color: 'gold', width: 2.6, text: X.ui('sunLabel'), textAt: 'end', dy: -12, hiddenAlpha: 0.1 });
      ov.gline(pb, ray(pb), { color: 'gold', width: 2.6, hiddenAlpha: 0.1 });
    },
    verticals() {
      for (const p of [pa, pb]) {
        ov.gline(p, out(p, 1.5), { color: 'white', width: 2.2, hiddenAlpha: 0.1 });
        ov.gline(p, [0, 0, 0], { color: 'blue', width: 1.6, dash: [5, 5], hiddenAlpha: 0.5 });
      }
    },
    angles() {
      ov.garc(pa, pb, 1.5, { color: 'gold', width: 2.8, text: `${n.gap.toFixed(1)}°`, dy: -14, size: 15 });
      ov.garc(pb, () => ov.sunDir(), 0.17, { center: pb, color: 'gold', width: 2.4, text: `${n.gap.toFixed(1)}°`, dx: 10, dy: 12, align: 'left', size: 13 });
    },
  };
  return { n, parts };
}

// ---- 4.4 ------------------------------------------------------------------------------------------------------------------
const named = (kit) => (i) => !!(kit.data.names[kit.data.stars.hip[i]] || {}).name;
function zenithOf(kit, lat) {
  const z = G.zenithStarOf(kit.data.stars, lat, 2.2, named(kit));
  if (!z) return null;
  const st = kit.data.stars;
  return { i: z.i, diff: z.diff, hip: st.hip[z.i], dec: st.dec[z.i], star: { ra: st.ra[z.i], dec: st.dec[z.i] } };
}
/** The zenith star of a place and when it crosses the middle of the sky. */
function zenithInfo(P, kit) {
  const z = zenithOf(kit, P.lat);
  if (!z) return null;
  const noon = G.localMs(G.dayKeyOf(P.ms, P.lon), P.lon, 12), t = G.nextTransitMs(z.star, P.lat, P.lon, noon), h = G.solarHour(t, P.lon);
  const t21 = G.transitNearHour(z.star, P.lat, P.lon, P.ms, 21, 366);
  return {
    ...z, night: h >= 18 || h < 5.5, time: G.clock12(h),
    miss: z.diff < 0.5 ? 'almost exactly overhead' : `${Math.round(z.diff)}° from straight overhead`,
    month: kit.words('monthsLong')[new Date(t21 + (P.lon / 15) * 3600e3).getUTCMonth()],
  };
}
/** A cross through the zenith, with its ring. */
function zenithCross(X) {
  const { ov } = X;
  ov.segment({ az: 0, alt: 76 }, { az: 180, alt: 76 }, { color: 'blue', width: 1.8, grow: 900 });
  ov.segment({ az: 90, alt: 76 }, { az: 270, alt: 76 }, { color: 'blue', width: 1.8, grow: 900 });
  ov.marker('zenith', { color: 'gold', r: 14, pulse: true, text: X.ui('zenith'), dy: 26, size: 13 });
}

export default [
  // ================================================================== 4.1
  {
    id: 'l4.1',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'tonight.north', 'tonight.south', 'tonight.flat'],
    placeholders: ['tripDir', 'poleMove'],
    tonightKey: (P) => (P.abs < 3 ? 'flat' : P.north ? 'north' : 'south'),
    try: (X) => (X.kit.home && X.kit.home.lat < 0 ? latitudeBetween(-62, -58) : latitudeBetween(58, 62)),
    /** Pole, fist ruler and a pole height read-out that follow the latitude. */
    ruler(X, grow) {
      const { ov, S } = X, az = poleAz(S.obs.lat);
      X.noPoleLabel();
      ov.fists(az, () => Math.abs(S.obs.lat), { grow });
      ov.marker('pole', { color: 'gold', r: 13, pulse: true, text: () => `${Math.round(Math.abs(S.obs.lat))}°`, dy: -24, size: 15 });
      return az;
    },
    async trySetup(X) {
      const { D, ov, S } = X, az = poleAz(S.obs.lat);
      await D.prep();
      await D.toSky(az, 38, 112);
      X.lesson.ruler(X, 0);
      ov.azArc(60, az - 55, az + 55, { color: 'blue', dash: [6, 6], alpha: 0.85, grow: 0 });
      ov.text({ az: az + 50, alt: 60 }, '60°', { color: 'blue', dy: -12, size: 13 });
    },
    async watch(X) {
      const { D, S } = X, lat = S.obs.lat, abs = Math.abs(lat), sgn = lat >= 0 ? 1 : -1;
      await D.prep();
      const down = abs >= 55, target = down ? Math.max(abs - 30, 5) : Math.min(abs + 25, 80), top = Math.max(abs, target);
      await D.toSky(poleAz(lat), clamp(top / 2 - 2, 10, 50), top > 60 ? 118 : 108);
      X.lesson.ruler(X, 2200);
      await X.say('watch.c1', 5200);
      const words = X.kit.words('compass'), tripDir = (target > abs) === (sgn > 0) ? words[0] : words[4];
      await X.say('watch.c2', 2800, { tripDir });
      D.say(X.T('watch.c3', { poleMove: X.ui(down ? 'poleDown' : 'poleUp') }), 0);
      await X.goTo(sgn * target, S.obs.lon, 8);
      await D.wait(500);
      await X.say('watch.c4', 6200);
    },
  },

  // ================================================================== 4.2
  {
    id: 'l4.2',
    keys: ['watch.flat', 'watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'try.promptFlat', 'try.hintFlat', 'try.successFlat', 'tonight.text', 'tonight.none'],
    placeholders: ['neverStar', 'latToSeeIt', 'towardsEquator', 'faceDir'],
    values: (P, kit) => { const n = neverInfo(P, kit); return n ? { neverStar: n.neverStar, latToSeeIt: n.latToSeeIt, towardsEquator: n.towardsEquator, faceDir: n.faceDir } : {}; },
    tonightKey: (P) => (neverInfo(P, P.kit) ? 'text' : 'none'),
    try: (X) => {
      const n = neverInfo(X.kit.ctx(X.kit.home.lat, X.kit.home.lon, X.S.time), X.kit);
      if (!n) {
        const c = latitudeBetween(40, 60); c.keys = () => ({ prompt: 'try.promptFlat', hint: 'try.hintFlat', success: 'try.successFlat' }); return c;
      }
      const c = custom((Y) => G.culminationAlt(n.dec, Y.S.obs.lat) > 0.5, {
        controls: 'lat',
        async show(Y) { await Y.setLatitude((n.lat >= 0 ? 1 : -1) * clamp(90 - Math.abs(n.dec) - 6, 0, 85), 2.6); },
      });
      return c;
    },
    /** The clock at the star's highest moment (at night), looking at the horizon where it sits just below. Returns the info, or null on the equator. */
    async stage(X) {
      const { D, ov, S, data } = X, n = neverInfo(X.kit.ctx(S.obs.lat, S.obs.lon, S.time), X.kit);
      await D.prep();
      if (!n) return null;
      const star = X.star(n.hip);
      let t = G.nextTransitMs(star, S.obs.lat, S.obs.lon, S.time);
      const h = G.solarHour(t, S.obs.lon);
      if (h > 6.5 && h < 17.5) t = G.transitNearHour(star, S.obs.lat, S.obs.lon, S.time, 22);
      X.setClock(t);
      const cons = data.starInfo(n.i).cons; if (cons) D.highlight(cons.id);
      await D.toSky(S.obs.lat >= 0 ? 180 : 0, 9, 100);
      ov.marker(n.hip, { color: 'gold', r: 14, pulse: true, text: n.neverStar, dy: 26, horizon: false, size: 14 });
      return n;
    },
    async trySetup(X) { await X.lesson.stage(X); },
    async watch(X) {
      const { D, S } = X, lon = S.obs.lon;
      const n = await X.lesson.stage(X);
      if (!n) { await D.toSky(180, 22, 100); await X.say('watch.flat', 7000); return; }
      const ex = { neverStar: n.neverStar, faceDir: n.faceDir };
      await X.say('watch.c1', 5200, ex);
      await X.say('watch.c2', 4600, ex);
      D.say(X.T('watch.c3', ex), 0);
      await X.goTo((n.lat >= 0 ? 1 : -1) * clamp(90 - Math.abs(n.dec) - 14, 0, 85), lon, 8);
      await D.wait(400);
      await X.say('watch.c4', 6000, ex);
    },
  },

  // ================================================================== 4.3
  {
    id: 'l4.3',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'try.wrong', 'try.option', 'tonight.text', 'tonight.generic'],
    placeholders: ['label', 'sunGap', 'kmApart', 'aswanAlt', 'alexAlt', 'earthKm', 'cityNS', 'kmToCity', 'cityDir', 'degDiff'],
    values: (P, kit) => {
      const n = eratosthenes(), c = cityNS(P), words = kit.words('compass');
      const v = { sunGap: n.gap.toFixed(1), kmApart: G.fmtInt(n.km), aswanAlt: Math.round(n.hA), alexAlt: Math.round(n.hB), earthKm: G.fmtInt(n.earth) };
      if (c) Object.assign(v, { cityNS: c.name, kmToCity: G.fmtInt(G.roundTo(Math.abs(c.lat - P.lat) * G.KM_PER_DEG, 10)), cityDir: c.lat > P.lat ? words[0] : words[4], degDiff: Math.round(Math.abs(c.lat - P.lat)) });
      return v;
    },
    tonightKey: (P) => (cityNS(P) ? 'text' : 'generic'),
    try: choice({
      options(X) {
        const e = eratosthenes().earth, list = [G.roundTo(e / 2, 1000), e, G.roundTo(e * 10, 1000)];
        const k = Math.floor(Date.now() / DAY) % 3;
        return list.map((_, i) => list[(i + k) % 3]).map((v) => ({ id: v, label: v, text: X.T('try.option', { label: G.fmtInt(v) }) }));
      },
      correct: () => eratosthenes().earth,
      async show() {},
    }),
    async trySetup(X) {
      const { parts } = await eratoScene(X, true);
      parts.pins(); parts.sun(); parts.verticals(); parts.angles();
    },
    async watch(X) {
      const { D } = X, { parts } = await eratoScene(X, false);
      parts.pins();
      await X.say('watch.c1', 3200);
      parts.sun();
      await D.wait(1800);
      await X.say('watch.c2', 5200);
      parts.verticals();
      D.say(X.T('watch.c3'), 0);
      await D.wait(2400);
      parts.angles();
      await D.wait(3600);
      await X.say('watch.c4', 5600);
      await X.say('watch.c5', 7000);
    },
  },

  // ================================================================== 4.4
  {
    id: 'l4.4',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'watch.c6', 'watch.c7', 'try.promptPick', 'try.hintPick', 'try.successPick', 'try.wrong', 'tonight.night', 'tonight.season'],
    placeholders: ['orionTop', 'orionBottom', 'zenithStar', 'zenithStarTime', 'zenithMiss', 'zenithMonth', 'homeLatTxt'],
    values: (P, kit) => {
      const H = kit.home ? kit.ctx(kit.home.lat, kit.home.lon, P.ms) : P, z = zenithInfo(H, kit);      // always the learner's own place, even after a Watch trip
      const v = { homeLatTxt: `${H.abs.toFixed(1)}°${H.lat >= 0 ? 'N' : 'S'}` };
      return z ? { ...v, zenithStar: kit.starName(z.hip), zenithStarTime: z.time, zenithMiss: z.miss, zenithMonth: z.month } : v;
    },
    tonightKey: (P) => { const z = zenithInfo(P, P.kit); return z && z.night ? 'night' : 'season'; },
    try: (X) => {
      const lat = X.kit.home ? X.kit.home.lat : X.S.obs.lat, z = zenithOf(X.kit, lat), st = X.data.stars;
      if (z && z.diff <= 5) {
        const c = objectAltitude(z.hip, { min: 85, controls: 'scrub' });
        c.show = async (Y) => {
          const t = G.nextTransitMs(z.star, Y.S.obs.lat, Y.S.obs.lon, Y.tryT0 - 12 * 3600e3);
          await Y.tweenTime(t, 2800);
          const aa = Y.hip(z.hip); Y.D.slew(aa.az, Math.min(aa.alt, 70), 90, 1.4); await Y.D.wait(1600);
        };
        return c;
      }
      const others = [];
      for (let i = 0; i < st.n && others.length < 2; i++) if (st.mag[i] <= 2.0 && named(X.kit)(i) && Math.abs(st.dec[i] - lat) > 25 && i !== (z && z.i)) others.push(i);
      const opts = [z.i, ...others].map((i) => ({ id: st.hip[i], label: st.hip[i], text: X.kit.starName(st.hip[i]) }));
      const k = Math.floor(Math.abs(lat * 10)) % opts.length, list = opts.map((_, i) => opts[(i + k) % opts.length]);
      const c = choice({ options: () => list, correct: () => z.hip, async show() {} });
      c.keys = () => ({ prompt: 'try.promptPick', hint: 'try.hintPick', success: 'try.successPick' });
      return c;
    },
    async trySetup(X) {
      const { D, ov, S } = X, z = zenithOf(X.kit, X.kit.home ? X.kit.home.lat : S.obs.lat);
      await D.prep();
      await D.toSky(z && z.dec > S.obs.lat ? 0 : 180, 66, 100);
      zenithCross(X);
      if (z && z.diff <= 5) ov.marker(z.hip, { color: 'gold', r: 12, pulse: true, text: X.starName(z.hip), dy: -22, size: 13 });
    },
    async watch(X) {
      const { D, ov, S } = X, lat = S.obs.lat, lon = S.obs.lon;
      await D.prep();
      // Orion crossing the middle of the sky
      X.setClock(G.nextTransitMs(X.star(HIP.alnilam), lat, lon, S.time));
      const aim = () => { const aa = X.hip(HIP.alnilam); return D.toSky(aa.az, clamp(aa.alt - 2, 12, 60), 60); };
      await aim();
      ov.marker(HIP.betelgeuse, { color: 'blue', r: 9, text: X.starName(HIP.betelgeuse), dx: 0, dy: -20, size: 13 });
      ov.marker(HIP.rigel, { color: 'blue', r: 9, text: X.starName(HIP.rigel), dx: 0, dy: 22, size: 13 });
      ov.segment(HIP.betelgeuse, HIP.rigel, { color: 'gold', width: 2.2, dots: true, grow: 1400 });
      const b = X.hip(HIP.betelgeuse), r = X.hip(HIP.rigel), topIsB = b.alt > r.alt;
      const ex = { orionTop: X.starName(topIsB ? HIP.betelgeuse : HIP.rigel), orionBottom: X.starName(topIsB ? HIP.rigel : HIP.betelgeuse) };
      await X.say('watch.c1', 6200, ex);
      D.say(X.T('watch.c2', ex), 0);
      await X.goTo(Math.abs(lat) < 8 ? 35 : -lat, lon, 7);
      await aim();
      await X.say('watch.c3', 6200, ex);
      await X.say('watch.c4', 5000, ex);
      // Hawaiʻi and Arcturus at the zenith
      D.say(X.T('watch.c5'), 0);
      ov.clear();
      await X.goTo(19.5, -155.6, 8);
      D.say(X.T('watch.c5'), 0);
      const star = X.star(HIP.arcturus), t = G.transitNearHour(star, S.obs.lat, S.obs.lon, S.time, 22);
      X.setClock(t - 3 * 3600e3);
      await D.toSky(180, 62, 100);
      await D.wait(2400);
      await X.say('watch.c6', 4400);
      zenithCross(X);
      ov.marker(HIP.arcturus, { color: 'gold', r: 14, pulse: true, text: X.ui('arcturusHoku'), dy: -26, size: 14 });
      ov.trail(HIP.arcturus, { since: S.time, color: 'gold', width: 2.4, tickHours: 1, tickLabel: (k) => X.ui('hourTick', { n: k }), maxHours: 6 });
      D.say(X.T('watch.c7'), 0);
      await X.tweenTime(t, 6000);
      await D.wait(4800);
    },
  },
];
