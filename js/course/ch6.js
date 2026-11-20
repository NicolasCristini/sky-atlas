// Chapter 6: The slow wobble. Lesson LOGIC only: every sentence the learner reads lives in content/<lang>/course.md under the same ids.
// See js/course/README.md for how a lesson is put together. Ages mode (js/main.js) already applies long-term precession and proper motion; these
// lessons drive it with S.ages.years and draw on top of it. Maths: js/course/wanderers.js (node-tested).
import * as G from './geo.js';
import * as W from './wanderers.js';
import { choice, custom } from './checks.js';
import { formatYear, decimalYear } from '../ages.js';

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const DAY = 864e5;
const STAR = { thuban: 68756, vega: 91262, kochab: 72607, mizar: 65378, polaris: 11767, arcturus: 69673, dubhe: 54061, merak: 53910, phecda: 58001, megrez: 59774, alioth: 62956, alkaid: 67301 };
const GIZA = { lat: 29.98, lon: 31.13 };
const year = (X) => X.S.ages.baseYear + X.S.ages.years;              // the astronomical year the sky shows (1 BC = 0)
const homeLat = (X) => (X.kit.home ? X.kit.home.lat : X.S.obs.lat);

/** Enter Ages mode at a year. */
function agesAt(X, E) { if (X.S.tm !== 'ages') X.D.timeMode('ages'); X.a.setYears(E - X.S.ages.baseYear); }
/** Glide the Ages epoch to a year (stops at once when the step is cancelled). tick() runs every step. */
async function agesTween(X, E, ms, tick) {
  const { S, a, D } = X, y0 = S.ages.years, y1 = E - S.ages.baseYear, t0 = performance.now();
  for (let u = 0; u < 1;) {
    await D.wait(30);
    u = clamp((performance.now() - t0) / ms, 0, 1);
    a.setYears(y0 + (y1 - y0) * ease(u));
    if (tick) tick();
  }
}
/** Advance the clock a little so that a star stands on the meridian at its highest, whatever the epoch: Ages mode rotates the pole round the sky and a star
 *  would otherwise set. Only the hour of the night changes (never the date by more than a few hours). */
function lockMeridian(X, hip) {
  const { S, A, a, sky, data } = X, i = data.hipIndex.get(hip); if (i === undefined || S.tm !== 'ages') return;
  const d = A.applyMat(a.precP, [sky.cur[i * 3], sky.cur[i * 3 + 1], sky.cur[i * 3 + 2]]), ra = A.vecToEq(d).ra;
  const ha = A.norm180(A.gmstHours(A.jdFromMs(S.time)) * 15 + S.obs.lon - ra);
  if (Math.abs(ha) > 0.02) { S.time -= (ha / 15 / 1.0027379) * 3600e3; S.anchor = S.time; a.updateCelestial(true); }
}
/** Camera follow loop (Watch steps). Returns the timer: clear it in a finally. */
function follow(X, get, o = {}) {
  const { S, A } = X;
  return setInterval(() => {
    if (o.lock) lockMeridian(X, o.lock);
    const m = get(); if (!m) return;
    S.slew = null; S.sky.az = A.norm360(S.sky.az + A.norm180(m.az - S.sky.az) * 0.2); S.sky.alt += (clamp(m.alt, o.lo ?? 20, o.hi ?? 75) - S.sky.alt) * 0.2;
  }, 40);
}
/** Travel to a place in the northern hemisphere when the learner's own sky cannot show the north pole well (the usual "away" trip). */
async function northStage(X, announce, minLat = 12) {
  const { D, S } = X;
  await D.prep();
  if (S.obs.lat < minLat) {
    const c = X.pickAway('north'); X.kit.awayName = X.kit.placeShort(c.lat, c.lon);
    await D.toSky(0, 20, 90);
    if (announce) await X.say('watch.away', 3800);
    await X.goTo(c.lat, c.lon, 6);
  }
}
/** Pole-star facts for 6.1 from the catalogue and the long-term precession model. */
function polarisInfo(kit) {
  const st = kit.data.stars, i = kit.data.hipIndex.get(STAR.polaris);
  const at = (E) => W.starAtYear(st.ra[i], st.dec[i], st.pmra[i], st.pmdec[i], E), sep = (E) => W.poleSeparation(E, at(E));
  let best = null; for (let E = 2000; E <= 2300; E++) { const d = sep(E); if (!best || d < best.deg) best = { year: E, deg: d }; }
  return { sep: sep(decimalYear(Date.now())), year: Math.round(best.year / 10) * 10, min: best.deg };
}
/** The year the pole comes round to Vega, as the app's own Ages chip says (the pole stays within about 6 degrees of Vega for roughly 1,500 years around it). */
const vegaYear = () => formatYear(13700).text;
/** How far to turn the clock on (ms, under one sidereal day) so that two stars stand one directly above the other (the same azimuth, both up): the moment of Spence's
 *  proposed plumb-line method. Works on the current epoch: the sky only turns about the pole as the clock runs. Returns {dt, daz}. */
function sameAzimuthShift(X, hipA, hipB) {
  const { ov, A, S } = X, a0 = ov.world(hipA), b0 = ov.world(hipB), OM = (2 * Math.PI) / 86164090.5;
  const turn = (d, ms) => { const f = -OM * ms, c = Math.cos(f), s = Math.sin(f); return [c * d[0] + s * d[2], d[1], -s * d[0] + c * d[2]]; };
  let best = null;
  for (let ms = 0; ms < 86164e3; ms += 5e3) {
    const p = A.azAltFromDir(turn(a0, ms), S.obs), q = A.azAltFromDir(turn(b0, ms), S.obs);
    if (p.alt < 8 || q.alt < 8) continue;
    const d = Math.abs(A.norm180(p.az - q.az)); if (!best || d < best.daz) best = { dt: ms, daz: d };
  }
  return best;
}
/** A point that is the star itself and, whenever the Ages epoch changes, re-centres the camera on it with the star on the meridian (Try steps). */
function trackStar(X, hip) {
  let last = null;
  return () => {
    const y = X.S.ages.years;
    if (y !== last) { last = y; lockMeridian(X, hip); const m = X.ov.altAz(hip); if (m) { X.S.slew = null; X.S.sky.az = m.az; X.S.sky.alt = clamp(m.alt, 22, 78); } }
    return hip;
  };
}
/** A label that stays near the top of the view. */
const topPoint = (X) => () => ({ az: X.S.sky.az, alt: Math.min(86, X.S.sky.alt + X.S.sky.fov * 0.28) });
const yearLabel = (X) => () => formatYear(year(X)).text;

export default [
  // ================================================================== 6.1
  {
    id: 'l6.1',
    keys: ['watch.away', 'watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'watch.c6', 'tonight.north', 'tonight.south'],
    placeholders: ['polarisSep', 'polarisYear', 'vegaYear'],
    values: (P, kit) => {
      const v = { vegaYear: vegaYear() };
      if (P.tonight) { const p = polarisInfo(kit); v.polarisSep = p.sep.toFixed(1); v.polarisYear = formatYear(p.year).text; }
      return v;
    },
    tonightKey: (P) => (P.lat > 0.5 ? 'north' : 'south'),
    try: custom((X) => X.S.tm === 'ages' && G.angleDeg(X.ov.world(STAR.vega) || [1, 0, 0], [0, 1, 0]) <= 7, {
      controls: 'ages',
      async show(X) { await agesTween(X, 13700, 4200); },
    }),
    async trySetup(X) {
      const { D, ov, S } = X;
      await northStage(X, false);
      agesAt(X, S.ages.baseYear); X.noPoleLabel();
      await D.toSky(0, clamp(S.obs.lat, 15, 80), 100);
      ov.circle('pole', 7, { color: 'blue', width: 1.8, dash: [6, 6], alpha: 0.9, grow: 0 });
      ov.marker('pole', { color: 'gold', r: 8, pulse: true, text: X.ui('poleLabelN'), dy: -20, size: 13 });
      ov.marker(STAR.vega, { color: 'blue', r: 10, text: X.starName(STAR.vega), dy: 22, size: 13, horizon: false });
    },
    async watch(X) {
      const { D, ov, S, a, A } = X;
      await northStage(X, true);
      X.setClock(G.nextTransitMs(W.ECL_POLE, S.obs.lat, S.obs.lon, S.time));
      agesAt(X, -2999); X.noPoleLabel();
      const E0 = -2999, E1 = 13700, tick = (E) => (E - E0) / (E1 - E0), E = () => year(X);
      const q = ov.altAz(W.ECL_POLE);
      await D.toSky(q.az, clamp(q.alt, 25, 75), 96);
      ov.circle(W.ECL_POLE, () => A.obliquityDeg((W.jdOfYear(E()) - 2451545) / 36525), { color: 'blue', width: 1.8, dash: [6, 6], grow: 1800 });
      ov.marker(W.ECL_POLE, { color: 'blue', r: 6, text: X.ui('eclPoleLabel'), dy: -16, size: 13 });
      ov.path(W.poleTrack(E0, E1, 100), { upTo: () => clamp(tick(E()), 0, 1), color: 'gold', width: 3.4, fadeTail: false });
      for (const e of [E0, 1, S.ages.baseYear, 6000, E1]) {
        const p = W.eqOf(W.poleAtYear(e)), today = Math.abs(e - S.ages.baseYear) < 1;
        ov.marker(p, { color: today ? 'gold' : 'blue', r: 5, text: today ? X.ui('todayWord') : formatYear(e).text, dy: 17, size: 12.5 });
      }
      ov.marker('pole', { color: 'gold', r: 12, pulse: true, text: X.ui('poleLabelN'), dy: -23, size: 14 });
      ov.text(topPoint(X), yearLabel(X), { color: 'gold', size: 18 });
      const timer = follow(X, () => ov.altAz(W.ECL_POLE), { lo: 28, hi: 74 });
      try {
        await X.say('watch.c1', 5400);
        await X.say('watch.c2', 5400);
        D.say(X.T('watch.c3'), 0);
        await agesTween(X, S.ages.baseYear, 7500);
        await X.say('watch.c4', 5000);
        D.say(X.T('watch.c5'), 0);
        await agesTween(X, E1, 9000);
        await D.wait(2600);
        await X.say('watch.c6', 5200);
      } finally { clearInterval(timer); }
    },
  },

  // ================================================================== 6.2
  {
    id: 'l6.2',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'try.wrong', 'tonight.visible', 'tonight.below', 'tonight.hidden'],
    placeholders: ['thubanWhere'],
    values: (P) => {
      const t = P.star(STAR.thuban);
      return { thubanWhere: t.alt > 4 ? P.where(t.az, t.alt) : '' };
    },
    hideLabels: [STAR.thuban, STAR.polaris, STAR.vega],
    tonightKey: (P) => (P.lat < -25 ? 'hidden' : P.star(STAR.thuban).alt > 4 ? 'visible' : 'below'),
    try: choice({
      options(X) {
        const list = [STAR.thuban, STAR.polaris, STAR.vega].map((h) => ({ id: h, label: h, text: X.starName(h) }));
        const k = Math.floor(Date.now() / DAY) % 3;
        return list.map((_, i) => list[(i + k) % 3]);
      },
      correct: () => STAR.thuban,
      async show(X) { X.ov.marker(STAR.thuban, { color: 'gold', r: 14, pulse: true, text: X.starName(STAR.thuban), dy: -26, size: 14 }); await X.D.wait(2200); },
    }),
    /** At Giza, at night, facing north, in the year 2800 BC (or `E`). */
    async stage(X, E = -2799) {
      const { D, S } = X;
      await D.prep();
      if (Math.abs(S.obs.lat - GIZA.lat) > 0.05 || Math.abs(X.A.norm180(S.obs.lon - GIZA.lon)) > 0.05) { await D.toSky(S.obs.lat >= 0 ? 0 : 180, 30, 90); await X.goTo(GIZA.lat, GIZA.lon, 6); }
      X.setClock(G.eveningMs(S.time, GIZA.lon, 22));
      agesAt(X, E); X.noPoleLabel();
      await D.toSky(0, GIZA.lat, 88);
    },
    async trySetup(X) {
      await X.lesson.stage(X);
      X.ov.marker('pole', { color: 'gold', r: 12, pulse: true, dy: -22 });
    },
    async watch(X) {
      const { D, ov, S } = X;
      await D.prep();
      await D.toSky(S.obs.lat >= 0 ? 0 : 180, 30, 90);
      await X.goTo(GIZA.lat, GIZA.lon, 6);
      X.setClock(G.eveningMs(S.time, GIZA.lon, 22));
      agesAt(X, S.ages.baseYear); X.noPoleLabel();
      await D.toSky(0, GIZA.lat, 88);
      ov.text(topPoint(X), yearLabel(X), { color: 'gold', size: 18 });
      D.say(X.T('watch.c1'), 0);
      await agesTween(X, -2799, 6500);
      await D.wait(800);
      ov.marker('pole', { color: 'gold', r: 8, pulse: true });
      ov.marker(STAR.thuban, { color: 'gold', r: 15, text: X.starName(STAR.thuban), dy: -27, size: 15 });
      await X.say('watch.c2', 6200);
      D.say(X.T('watch.c3'), 0);
      await agesTween(X, -2559, 3600);
      const km = sameAzimuthShift(X, STAR.kochab, STAR.mizar);         // turn the night on until the two stars hang one above the other
      X.state.km = km;
      if (km) await X.tweenTime(S.time + km.dt, 3000);
      ov.marker(STAR.kochab, { color: 'blue', r: 10, text: X.starName(STAR.kochab), dy: -21, size: 13 });
      ov.marker(STAR.mizar, { color: 'blue', r: 10, text: X.starName(STAR.mizar), dy: 22, size: 13 });
      ov.segment(STAR.kochab, STAR.mizar, { color: 'gold', width: 2.6, dots: true, grow: 1600 });
      await D.wait(5200);
      await X.say('watch.c4', 5200);
      const lo = ov.altAz(STAR.kochab).alt < ov.altAz(STAR.mizar).alt ? STAR.kochab : STAR.mizar, az = ov.altAz(lo).az;      // the plumb line: straight down from the lower star
      ov.segment(lo, { az, alt: 0 }, { color: 'gold', grow: 1800, tip: true });
      ov.text({ az, alt: 0 }, X.ui('dir.n'), { color: 'gold', size: 16, dy: 18 });
      await X.say('watch.c5', 5600);
    },
  },

  // ================================================================== 6.3
  {
    id: 'l6.3',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'try.wrong', 'tonight.text', 'tonight.on'],
    placeholders: ['todayCons', 'tropicName', 'tropicKm', 'tropicDir', 'tropicCons', 'solsticeMonth', 'solsticeDate', 'solsticeCons'],
    values: (P, kit) => {
      if (!P.tonight) return { todayCons: W.sunConsAt(W.solsticeMs(new Date().getUTCFullYear(), true)) };
      const t = W.nearestTropic(P.lat), s = { ms: W.nextSolsticeOf(P.ms, t.north) }, words = kit.words('compass');       // the solstice that gave the tropic its name
      return {
        solsticeMonth: kit.words('monthsLong')[t.north ? 5 : 11],
        tropicName: kit.ui(t.north ? 'tropicCancer' : 'tropicCapricorn'), tropicCons: t.north ? 'Cancer' : 'Capricornus', tropicKm: G.fmtInt(G.roundTo(t.km, 10)),
        tropicDir: t.toward === 'north' ? words[0] : words[4], solsticeDate: `${kit.dateText(s.ms, P.lon, true)} ${new Date(s.ms + (P.lon / 15) * 3600e3).getUTCFullYear()}`, solsticeCons: W.sunConsAt(s.ms),
      };
    },
    tonightKey: (P) => (W.nearestTropic(P.lat).km < 100 ? 'on' : 'text'),
    try: choice({
      options(X) {
        const right = X.lesson.todayCons(), z = W.zodiacOrder, i = z.indexOf(right), near = [z[(i + z.length - 1) % z.length], right, z[(i + 1) % z.length]];
        const k = Math.floor(Date.now() / DAY) % 3;
        return near.map((_, j) => near[(j + k) % 3]).map((n) => ({ id: n, label: n, text: n }));
      },
      correct: (X) => X.lesson.todayCons(),
      async show(X) {
        const right = X.lesson.todayCons(), id = X.kit.consId(right);
        if (id) X.D.highlight(id);
        X.ov.text(() => X.bodyAltAz('Sun'), X.ui('sunIn', { name: right }), { color: 'gold', size: 15, dy: 34 }); await X.D.wait(2600);
      },
    }),
    todayCons() { return W.sunConsAt(W.solsticeMs(new Date().getUTCFullYear(), true)); },
    /** Noon at the June solstice of this year, at the place the sky shows, the Sun in view. */
    async stage(X) {
      const { D, S } = X, lon = S.obs.lon;
      await D.prep();
      X.setClock(G.localMs(G.dayKeyOf(W.solsticeMs(new Date().getUTCFullYear(), true), lon), lon, 12));
      const sun = X.bodyAltAz('Sun');
      await D.toSky(sun.az, clamp(sun.alt, 22, 68), 75);
    },
    async trySetup(X) {
      await X.lesson.stage(X);
      X.D.layer('constNames', false);                              // the constellation names would give the answer away; oldWay() and watch() switch them back on
      X.ov.marker(() => X.bodyAltAz('Sun'), { color: 'gold', r: 20, pulse: true, dy: -30 });
    },
    async oldWay(X) { X.D.layer('constNames', true); },
    async watch(X) {
      const { D, ov, S } = X;
      D.layer('constNames', true);
      await X.lesson.stage(X);
      agesAt(X, S.ages.baseYear); X.noPoleLabel();
      const sunAt = () => X.bodyAltAz('Sun'), consNow = () => { const b = X.sky.bodies[0].eq; return W.consOf(W.eqOf([b.x, b.y, b.z])); };
      let cons = '';
      const sync = () => { const c = consNow(); if (c !== cons) { cons = c; const id = X.kit.consId(c); if (id) D.highlight(id); } };
      sync();
      ov.marker(sunAt, { color: 'gold', r: 20, pulse: true });
      ov.text(topPoint(X), yearLabel(X), { color: 'gold', size: 18 });
      const timer = setInterval(sync, 100);
      try {
        await X.say('watch.c1', 5000);
        ov.text(sunAt, () => X.ui('sunIn', { name: consNow() }), { color: 'gold', size: 15, dy: 34 });
        await X.say('watch.c2', 5000);
        D.say(X.T('watch.c3'), 0);
        await agesTween(X, S.ages.baseYear - 2300, 8000, sync);
        await X.say('watch.c4', 6400);
        await X.say('watch.c5', 7000);
      } finally { clearInterval(timer); }
    },
  },

  // ================================================================== 6.4
  {
    id: 'l6.4',
    keys: ['watch.away', 'watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'tonight.visible', 'tonight.below'],
    placeholders: ['arcturusWhere'],
    values: (P) => {
      const a = P.star(STAR.arcturus);
      return { arcturusWhere: a.alt > 4 ? P.where(a.az, a.alt) : '' };
    },
    tonightKey: (P) => (P.star(STAR.arcturus).alt > 4 ? 'visible' : 'below'),
    try: custom((X) => {
      if (X.S.tm !== 'ages') return false;
      const i = X.data.hipIndex.get(STAR.arcturus), c = X.sky.cur, now = X.A.eqToVec(X.data.stars.ra[i], X.data.stars.dec[i]);
      return G.angleDeg([c[i * 3], c[i * 3 + 1], c[i * 3 + 2]], now) >= 5;
    }, {
      controls: 'ages',
      async show(X) { await agesTween(X, X.S.ages.baseYear + 9500, 4200, () => lockMeridian(X, STAR.arcturus)); },
    }),
    async trySetup(X) {
      const { D, ov, S } = X, st = X.kit.starOf(STAR.arcturus);
      await northStage(X, false, 10);
      agesAt(X, S.ages.baseYear); X.noPoleLabel();
      lockMeridian(X, STAR.arcturus);
      const m = ov.altAz(STAR.arcturus);
      await D.toSky(m.az, clamp(m.alt, 22, 75), 80);
      ov.circle(st, 5, { color: 'blue', width: 1.8, dash: [6, 6], alpha: 0.9, grow: 0 });
      ov.marker(trackStar(X, STAR.arcturus), { color: 'gold', r: 12, pulse: true, text: X.starName(STAR.arcturus), dy: -23, size: 14, horizon: false });
    },
    async watch(X) {
      const { D, ov, S } = X, i = X.data.hipIndex.get(STAR.arcturus), st = X.data.stars;
      await northStage(X, true, 10);
      agesAt(X, -10000); D.highlight('Boo'); X.noPoleLabel();
      lockMeridian(X, STAR.arcturus);
      const m = ov.altAz(STAR.arcturus);
      await D.toSky(m.az, clamp(m.alt, 22, 75), 80);
      const E0 = -10000, E1 = 15000, E = () => year(X);
      const track = W.propermotionTrack(st.ra[i], st.dec[i], st.pmra[i], st.pmdec[i], E0, E1, 250);
      ov.path(track, { upTo: () => clamp((E() - E0) / (E1 - E0), 0, 1), color: 'gold', width: 3.2, fadeTail: false, horizon: false });
      ov.marker(STAR.arcturus, { color: 'gold', r: 13, text: X.starName(STAR.arcturus), dy: -24, size: 14 });
      ov.text(topPoint(X), yearLabel(X), { color: 'gold', size: 18 });
      let timer = follow(X, () => ov.altAz(STAR.arcturus), { lock: STAR.arcturus, lo: 24, hi: 72 });
      try {
        await X.say('watch.c1', 5400);
        D.say(X.T('watch.c2'), 0);
        await agesTween(X, E1, 16000);
        await D.wait(1800);
        // the Big Dipper: only the stars' own drift, run 100 000 years each way at today's speed (the Ages range is too short for the Dipper to change much)
        clearInterval(timer); ov.clear(); D.highlight(null);
        X.a.setTimeMode('day', { keepTime: true }); S.speed = 1; X.resetClock();
        X.setClock(G.nextTransitMs(X.star(STAR.alioth), S.obs.lat, S.obs.lon, S.time));
        D.layer('starNames', false);
        const al = X.hip(STAR.alioth);
        await D.toSky(al.az, clamp(al.alt, 30, 70), 75);
        D.say(X.T('watch.c3'), 0);
        const pairs = [[STAR.dubhe, STAR.merak], [STAR.merak, STAR.phecda], [STAR.phecda, STAR.megrez], [STAR.megrez, STAR.dubhe], [STAR.megrez, STAR.alioth], [STAR.alioth, STAR.mizar], [STAR.mizar, STAR.alkaid]];
        for (const [p, q] of pairs) ov.segment(X.kit.starOf(p), X.kit.starOf(q), { color: 'blue', width: 1.8, dash: [6, 6], alpha: 0.85, grow: 0 });
        for (const [p, q] of pairs) ov.segment(p, q, { color: 'gold', width: 2.6, grow: 0 });
        let Ey = 2000;
        ov.text(topPoint(X), () => formatYear(Ey).text, { color: 'gold', size: 18 });
        const drift = (E) => { Ey = E; X.sky.setEpoch(E - 2000, st.pmra, st.pmdec); };
        await D.wait(3000);
        const sweep = async (to, ms) => { const e0 = Ey, t0 = performance.now(); for (let u = 0; u < 1;) { await D.wait(60); u = clamp((performance.now() - t0) / ms, 0, 1); drift(e0 + (to - e0) * ease(u)); } };
        D.say(X.T('watch.c4'), 0);
        await sweep(-100000, 6500);
        await D.wait(1500);
        await sweep(100000, 11000);
        await X.say('watch.c5', 5000);
      } finally { clearInterval(timer); X.sky.setEpoch(0); D.layer('starNames', true); }
    },
  },
];
