// Chapter 3: The sky as a calendar. Lesson LOGIC only: every sentence the learner reads lives in content/<lang>/course.md under the same ids.
// See js/course/README.md for how a lesson is put together.
import * as G from './geo.js';
import { HIP } from './geo.js';
import { selected, choice, custom } from './checks.js';

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const DAY = 864e5;
const eqAz = (lat) => (lat >= 0 ? 180 : 0);                    // facing the celestial equator at its highest
const homeLat = (X) => (X.kit.home ? X.kit.home.lat : X.S.obs.lat);
/** A label that stays near the top of whatever the camera shows (date read-outs). */
const topPoint = (X) => () => ({ az: X.S.sky.az, alt: Math.min(86, X.S.sky.alt + X.S.sky.fov * 0.28) });

// ---- 3.1 ------------------------------------------------------------------------------------------------------------------
// the seasonal marker: Orion's centre (Alnilam) from most places, Auriga's Capella or Carina's Canopus from the far north or south
function seasonTarget(kit, lat) {
  const t = Math.abs(lat) <= 65 ? [HIP.alnilam, 'Ori'] : lat > 0 ? [HIP.capella, 'Aur'] : [HIP.canopus, 'Car'];
  const c = kit.data.consMap.get(t[1]);
  return { hip: t[0], name: c ? c.name : '' };
}
const BRIGHT = ['Ori', 'Sco', 'Leo', 'Cyg', 'Lyr', 'Tau', 'Gem', 'Cru', 'Cen', 'Sgr', 'Aql', 'Boo', 'Vir', 'Peg', 'Aur', 'CMa', 'Car', 'Cas', 'Per', 'And', 'UMa', 'Her', 'Lib', 'Cnc', 'Cap', 'Aqr'];
/** The bright constellations in the evening sky at P.ms, and those that will have replaced them three months on. */
function eveningLists(P, kit) {
  const A = kit.A, alt = (id, t) => { const c = kit.data.consMap.get(id); if (!c) return -90; const e = A.vecToEq(c.center); return A.eqToAltAz(e.ra, e.dec, P.lat, P.lon, A.jdFromMs(t)).alt; };
  const ms = P.ms, later = ms + 91 * DAY, nm = (id) => kit.data.consMap.get(id).name;
  const pick = (test) => { for (const lim of [30, 15, 1]) { const r = BRIGHT.filter((id) => test(id, lim)).slice(0, 3); if (r.length >= 2 || lim === 1) return r; } return []; };
  const now = pick((id, lim) => alt(id, ms) >= lim);
  let next = pick((id, lim) => alt(id, later) >= lim && alt(id, ms) < 15);
  if (next.length < 2) next = pick((id, lim) => alt(id, later) >= lim && !now.includes(id));
  return { now: now.map(nm), later: next.map(nm) };
}

// ---- 3.3 ------------------------------------------------------------------------------------------------------------------
const EGYPT = { lat: 30, lon: 31 };
const thisYear = () => new Date().getUTCFullYear();
/** First local date (dayKey) from late June when Sirius is seen at dawn at a place, by the simple rule. */
const siriusReturn = (kit, lat, lon) => G.firstDawnSeen(kit.starOf(HIP.sirius), lat, lon, Date.UTC(thisYear(), 5, 20)) ?? Date.UTC(thisYear(), 7, 7);
const dawnAt = (lat, lon, key, sunAlt = G.HELIACAL.sunAlt) => G.sunMorningAt(lat, lon, key, sunAlt) ?? G.localMs(key, lon, 4.5);
/** The brightest named star standing in the east at 5 am tonight, or ''. */
function dawnStar(P, kit) {
  const st = kit.data.stars, t = P.ms + 8 * 3600e3;
  for (const i of kit.data.named) { const aa = P.star(st.hip[i], t); if (aa.az > 40 && aa.az < 140 && aa.alt > 8 && aa.alt < 65) return kit.starName(st.hip[i]); }
  return '';
}

// ---- 3.4 ------------------------------------------------------------------------------------------------------------------
const PLEIADES = new Set([17499, 17531, 17573, 17608, 17702, 17847, 17851]);
/** Where the Pleiades are tonight: 'evening', 'morning' (as the dawn sky starts to brighten) or 'hidden', with their alt/az. */
function pleiadesTonight(P) {
  const star = P.kit.starOf(HIP.alcyone), ev = P.star(HIP.alcyone);
  if (ev.alt >= 12) return { key: 'evening', aa: ev };
  const key = G.dayKeyOf(P.ms, P.lon) + DAY, t = G.sunMorningAt(P.lat, P.lon, key, -12) ?? P.ms + 8 * 3600e3, m = G.starAltAzAt(star, P.lat, P.lon, t);
  return m.alt >= 10 ? { key: 'morning', aa: m } : { key: 'hidden', aa: ev };
}

export default [
  // ================================================================== 3.1
  {
    id: 'l3.1',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'tonight.text'],
    placeholders: ['seasonCons', 'eveningNow', 'eveningLater'],
    values: (P, kit) => {
      const l = eveningLists(P, kit);
      return { seasonCons: seasonTarget(kit, kit.home ? kit.home.lat : P.lat).name, eveningNow: kit.list(l.now), eveningLater: kit.list(l.later) };
    },
    try: (X) => {
      const t = seasonTarget(X.kit, homeLat(X)), altOf = (Y, yd = Y.S.yd) => Y.altAt(t.hip, Y.S.time + yd * DAY).alt;
      return custom((Y) => Y.S.tm === 'year' && altOf(Y) > 20, {
        controls: 'year',
        async show(Y) {
          let best = null;
          for (let k = 0; k <= 183 && best === null; k++) for (const yd of [k, -k]) if (altOf(Y, yd) >= 28) { best = yd; break; }
          await Y.tweenYear(best ?? 0, 2800);
        },
      });
    },
    /** Face the celestial equator where it stands highest, with room for the horizon. */
    frame(X) { const abs = Math.abs(X.S.obs.lat); return X.D.toSky(eqAz(X.S.obs.lat), clamp(90 - abs - 8, 14, 50), 105); },
    async trySetup(X) {
      const { D, ov, S } = X, t = seasonTarget(X.kit, S.obs.lat);
      await D.prep();
      X.yearAt(21);
      const alt = (yd) => X.altAt(t.hip, S.time + yd * DAY).alt;
      let sol = 0;                                                                                // the nearest day on which the star stands 28 degrees up
      for (let k = 0; k <= 183 && sol === 0; k++) for (const yd of [k, -k]) if (alt(yd) >= 28) { sol = yd || 0.001; break; }
      const az = X.altAt(t.hip, S.time + Math.round(sol) * DAY).az;
      if (alt(0) > 20) { let y = 0; while (y < 183 && alt(y) > -5) y++; X.setYd(y); }       // do not start already solved
      await D.toSky(az, 30, 100);
      ov.azArc(20, az - 75, az + 75, { color: 'blue', dash: [6, 6], alpha: 0.85, grow: 0 });
      ov.text({ az: az - 40, alt: 20 }, '20°', { color: 'blue', dy: -12, size: 13 });
      ov.marker(t.hip, { color: 'gold', r: 13, pulse: true, text: t.name, dy: -24, size: 14 });
      ov.text(topPoint(X), () => X.dateNow(true), { color: 'gold', size: 18 });
    },
    async watch(X) {
      const { D, ov, S } = X, t = seasonTarget(X.kit, S.obs.lat);
      await D.prep();
      X.yearAt(21);
      await X.lesson.frame(X);
      ov.marker(t.hip, { color: 'gold', r: 13, pulse: true, text: t.name, dy: -24, size: 14 });
      ov.text(topPoint(X), () => X.dateNow(true), { color: 'gold', size: 18 });
      await X.say('watch.c1', 4200);
      await X.say('watch.c2', 4400);
      D.say(X.T('watch.c3'), 0);
      await X.tweenYear(366, 13000);
      await X.say('watch.c4', 4600);
    },
  },

  // ================================================================== 3.2
  {
    id: 'l3.2',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'try.wrong', 'tonight.text'],
    placeholders: ['sunConsNow', 'midnightZodiac'],
    values: (P, kit) => ({ sunConsNow: kit.sunCons(Date.now()), midnightZodiac: kit.sunCons(P.ms, true) }),
    try: choice({
      options(X) {
        const t0 = X.lesson.noonToday(X), names = G.sunSegments((t) => X.kit.sunCons(t), t0, 366).map((s) => s.name);
        if (names.length > 1 && names[0] === names[names.length - 1]) names.pop();
        const right = X.kit.sunCons(t0), [prev, next] = G.neighbours(names, right);
        const list = [prev, right, next].filter((n, i, a) => n && a.indexOf(n) === i);
        const k = Math.floor(t0 / DAY) % list.length;                        // a fixed shuffle for the day
        return list.map((_, i) => list[(i + k) % list.length]).map((n) => ({ id: n, label: n, text: n }));
      },
      correct: (X) => X.kit.sunCons(X.lesson.noonToday(X)),
      async show(X) { const aa = X.bodyAltAz('Sun'); X.D.slew(aa.az, clamp(aa.alt, 10, 70), 80, 1.4); await X.D.wait(1700); },
    }),
    /** Local solar noon of the real today at the learner's own place (the Sun is up, with the stars behind it). */
    noonToday(X) { const lon = X.kit.home ? X.kit.home.lon : X.S.obs.lon; return G.localMs(G.dayKeyOf(Date.now(), lon), lon, 12); },
    sunPoint(X) { return () => { const b = X.sky.bodies[0]; return { ra: b.ra, dec: b.dec }; }; },
    async trySetup(X) {
      const { D, ov } = X;
      await D.prep();
      D.layer('eq', true);
      X.setClock(X.lesson.noonToday(X));
      const s = X.bodyAltAz('Sun');
      await D.toSky(s.az, clamp(s.alt - 6, 8, 60), 80);
      ov.marker(X.lesson.sunPoint(X), { color: 'gold', r: 17, pulse: true, text: X.ui('sunLabel'), dy: -30, size: 14 });
    },
    async watch(X) {
      const { D, ov, S, kit } = X;
      await D.prep();
      D.layer('eq', true);
      X.yearAt(12);
      const sun = () => X.bodyAltAz('Sun'), at = () => S.time + S.yd * DAY, view = (a) => clamp(a.alt - 8, 8, 62);
      const s0 = sun();
      await D.toSky(s0.az, view(s0), 95);
      let name = '', seen = -1;
      const nameNow = () => { const k = Math.round(S.yd * 4); if (k !== seen) { seen = k; name = kit.sunCons(at()); } return name; };
      ov.marker(X.lesson.sunPoint(X), { color: 'gold', r: 18, pulse: true, text: () => X.ui('sunIn', { name: nameNow() }), dy: -32, size: 15 });
      ov.text(topPoint(X), () => X.dateNow(true), { color: 'gold', size: 18 });
      await X.say('watch.c1', 4200);
      await X.say('watch.c2', 4600);
      D.say(X.T('watch.c3'), 0);
      let hl = '';
      const timer = setInterval(() => {
        const a = sun(); S.slew = null;
        S.sky.az = X.A.norm360(S.sky.az + X.A.norm180(a.az - S.sky.az) * 0.12); S.sky.alt += (view(a) - S.sky.alt) * 0.12;
        const n = nameNow(); if (n !== hl) { hl = n; D.highlight(kit.consId(n)); }
      }, 40);
      try {
        const segs = G.sunSegments((t) => kit.sunCons(t), S.time, 366);
        if (segs.length > 1 && segs[0].name === segs[segs.length - 1].name) segs.pop();
        for (let k = 0; k < segs.length; k++) { await X.tweenYear((segs[k].from + segs[k].to) / 2, k === 0 ? 500 : 800); await D.wait(450); }
        await X.tweenYear(366, 700);
      } finally { clearInterval(timer); D.highlight(null); }
      await X.say('watch.c4', 7000);
    },
  },

  // ================================================================== 3.3
  {
    id: 'l3.3',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'tonight.text', 'tonight.none'],
    placeholders: ['siriusReturnDate', 'dawnPreviewStar'],
    values: (P, kit) => ({ siriusReturnDate: kit.dateText(siriusReturn(kit, EGYPT.lat, EGYPT.lon) + 6 * 3600e3, 0, true), dawnPreviewStar: dawnStar(P, kit) }),
    tonightKey: (P) => (dawnStar(P, P.kit) ? 'text' : 'none'),
    try: (X) => {
      const sir = X.kit.starOf(HIP.sirius), rk = siriusReturn(X.kit, EGYPT.lat, EGYPT.lon);
      return custom((Y) => {
        const { lat, lon } = Y.S.obs, t = Y.S.time, sa = G.sunAlt(lat, lon, t);
        return sa <= -7 && sa >= -12 && G.starAltAt(sir, lat, lon, t) >= 2.4;
      }, {
        controls: 'days',
        async show(Y) { await Y.tweenTime(dawnAt(Y.S.obs.lat, Y.S.obs.lon, rk), 2800); },
      });
    },
    /** The "Next dawn" / "Earlier dawn" control: the same moment of dawn (Sun 9.5 degrees down), a day on. */
    stepDays(X, d) {
      const { S } = X, key = G.dayKeyOf(S.time, S.obs.lon) + d * DAY;
      X.setClock(G.sunMorningAt(S.obs.lat, S.obs.lon, key, G.HELIACAL.sunAlt) ?? S.time + d * DAY);
    },
    /** Egypt, a few mornings before the return, looking east; Sirius, its height and the date drawn on the sky. */
    async stage(X, daysBefore) {
      const { D, ov, S, kit } = X, sir = kit.starOf(HIP.sirius);
      await D.prep();
      D.layer('daylight', true);
      if (Math.abs(S.obs.lat - EGYPT.lat) > 2 || Math.abs(X.A.norm180(S.obs.lon - EGYPT.lon)) > 3) {
        await D.toSky(S.sky.az, 20, 90);
        await X.goTo(EGYPT.lat, EGYPT.lon, 5);
      }
      kit.awayName = kit.placeShort(S.obs.lat, S.obs.lon);        // the Try carries on from here
      const { lat, lon } = S.obs, rk = siriusReturn(kit, lat, lon);
      X.setClock(dawnAt(lat, lon, rk - daysBefore * DAY));
      const aS = G.starAltAzAt(sir, lat, lon, dawnAt(lat, lon, rk));
      await D.toSky(aS.az, 14, 62);
      ov.marker(HIP.sirius, { color: 'blue', r: 10, text: X.starName(HIP.sirius), dy: -22 });
      ov.segment(HIP.sirius, () => { const p = ov.altAz(HIP.sirius); return { az: p ? p.az : aS.az, alt: 0 }; }, {
        color: 'gold', width: 2, grow: 0, textDy: 0, textAt: 0.5, text: () => { const p = ov.altAz(HIP.sirius); return p && p.alt > 0 ? `${p.alt.toFixed(1)}°` : ''; },
      });
      ov.text(topPoint(X), () => X.dateNow(true), { color: 'gold', size: 18 });
      return { rk, lat, lon };
    },
    async trySetup(X) { await X.lesson.stage(X, 5); },
    async watch(X) {
      const { D, ov } = X;
      await D.prep();
      await D.toSky(X.S.sky.az, 20, 90);
      await X.say('watch.c1', 3400);
      const { rk, lat, lon } = await X.lesson.stage(X, 6);
      await X.say('watch.c2', 5200);
      D.say(X.T('watch.c3'), 0);
      for (let k = -5; k <= 0; k++) { X.setClock(dawnAt(lat, lon, rk + k * DAY)); await D.wait(k === 0 ? 800 : 1000); }
      ov.marker(HIP.sirius, { color: 'gold', r: 17, pulse: true, dy: -30 });
      await X.say('watch.c4', 6200);
      await X.say('watch.c5', 6200);
    },
  },

  // ================================================================== 3.4
  {
    id: 'l3.4',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'try.wrong', 'tonight.evening', 'tonight.morning', 'tonight.hidden'],
    placeholders: ['pleiadesWhere'],
    values: (P) => { const r = pleiadesTonight(P); return { pleiadesWhere: r.key === 'hidden' ? '' : P.where(r.aa.az, r.aa.alt) }; },
    tonightKey: (P) => pleiadesTonight(P).key,
    try: (() => {
      const c = selected((sel) => (sel.type === 'star' && PLEIADES.has(sel.hip)) || (sel.type === 'dso' && sel.dso && sel.dso.name === 'Pleiades')), base = selected(HIP.alcyone);
      const test = c.test;
      c.test = (X) => { const sel = X.S.sel; if (sel && sel.type === 'star' && PLEIADES.has(X.data.stars.hip[sel.index])) return true; if (sel && sel.type === 'dso' && sel.dso && sel.dso.name === 'Pleiades') return true; return test(X); };
      c.show = base.show;
      return c;
    })(),
    hideLabels: ['Pleiades', HIP.alcyone],
    async trySetup(X) {
      const { D, S } = X, lat = S.obs.lat, lon = S.obs.lon, star = X.star(HIP.alcyone);
      await D.prep();
      if (X.findTime((t) => G.starAltAt(star, lat, lon, t) > 28, 24) === false) X.findTime((t) => G.starAltAt(star, lat, lon, t) > 8, 24);
      X.a.updateCelestial(true);
      const aa = X.hip(HIP.alcyone);
      await D.toSky(aa.az + 70, clamp(aa.alt - 6, 18, 55), 90);
    },
    async watch(X) {
      const { D, ov, S } = X, lat = S.obs.lat, lon = S.obs.lon, year = thisYear(), star = X.star(HIP.alcyone);
      await D.prep();
      D.layer('daylight', true);
      const jun = Date.UTC(year, 5, 20), tA = G.sunMorningAt(lat, lon, jun, -10) ?? G.localMs(jun, lon, 4.5), tB = G.localMs(Date.UTC(year, 10, 15), lon, 21);
      X.setClock(tA);
      const aA = G.starAltAzAt(star, lat, lon, tA), aB = G.starAltAzAt(star, lat, lon, tB);
      await D.toSky(aA.az, clamp(aA.alt + 8, 12, 50), 62);
      ov.marker(HIP.alcyone, { color: 'gold', r: 26, pulse: true, text: X.ui('pleiades'), dy: -40, size: 14 });
      ov.marker(HIP.aldebaran, { color: 'blue', r: 8, text: X.starName(HIP.aldebaran), dy: 20, size: 12 });
      ov.text(topPoint(X), () => X.dateNow(true), { color: 'gold', size: 18 });
      await X.say('watch.c1', 4600);
      await X.say('watch.c2', 5000);
      D.say(X.T('watch.c3'), 0);
      await X.tweenTime(tB, 3600);
      D.layer('daylight', false);
      D.slew(aB.az, clamp(aB.alt - 6, 15, 55), 62, 1.6);
      await D.wait(2400);
      await X.say('watch.c4', 6000);
    },
  },
];
