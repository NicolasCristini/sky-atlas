// Chapter 5: The wanderers. Lesson LOGIC only: every sentence the learner reads lives in content/<lang>/course.md under the same ids.
// See js/course/README.md for how a lesson is put together. Maths: js/course/wanderers.js (node-tested). Flat diagrams: js/course/diagrams.js.
import * as G from './geo.js';
import * as W from './wanderers.js';
import { choice, custom } from './checks.js';
import { moonInset, elongationChart, eclipseChart } from './diagrams.js';

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const DAY = 864e5, HOUR = 3600e3;
const homeLon = (X) => (X.kit.home ? X.kit.home.lon : X.S.obs.lon);
const homeLat = (X) => (X.kit.home ? X.kit.home.lat : X.S.obs.lat);
/** "21 February 2027" for the local solar date of an instant at a longitude. */
const dateY = (kit, ms, lon) => `${kit.dateText(ms, lon, true)} ${new Date(ms + (lon / 15) * HOUR).getUTCFullYear()}`;
/** "15 Sep" */
const dateShort = (kit, ms, lon) => kit.dateText(ms, lon, false);
/** Memo for the day's astronomy-engine searches (a lesson's texts are filled in many times). */
const memo = new Map();
const once = (key, fn) => { const k = key + '|' + Math.floor(Date.now() / DAY); if (!memo.has(k)) { if (memo.size > 40) memo.clear(); memo.set(k, fn()); } return memo.get(k); };
const eclipseNext = () => once('eclnext', () => W.lunarEclipses(Date.now(), 1)[0]);
const eclipseOptions = () => once('eclopts', () => W.eclipseChoices(Date.now()));
/** Keep the camera on a moving body (a follow loop for a Watch step). Returns the timer: clear it in a finally. */
function follow(X, get, o = {}) {
  const { S, A } = X;
  return setInterval(() => {
    const m = get(); if (!m || m.alt < (o.minAlt ?? -2)) return;
    S.slew = null; S.sky.az = A.norm360(S.sky.az + A.norm180(m.az - S.sky.az) * 0.16); S.sky.alt += (clamp(m.alt, o.lo ?? 14, o.hi ?? 70) - S.sky.alt) * 0.16;
  }, 40);
}
/** A point function for a marker that also re-centres the camera on a body, but only when `stamp()` changes (the learner moved the time control). */
function trackOnChange(X, get, stamp, o = {}) {
  let last = null;
  return () => {
    const m = get(), k = stamp();
    if (k !== last) { last = k; if (m.alt > (o.minAlt ?? -2)) { X.S.slew = null; X.S.sky.az = m.az; X.S.sky.alt = clamp(m.alt, o.lo ?? 18, o.hi ?? 60); } }
    return m;
  };
}
/** The fixed local solar hours used by 5.1: an evening hour when the sky has darkened (Sun 6 degrees down) and a morning hour at the start of dawn. */
function moonHours(lat, lon, ms) {
  const key = G.dayKeyOf(ms, lon), ev = sunDownAt(lat, lon, key, -6, false), mo = sunDownAt(lat, lon, key, -6, true);
  return { ev: ev === null ? 20.5 : Math.round(G.solarHour(ev, lon) * 4) / 4, morn: mo === null ? 5 : Math.round(G.solarHour(mo, lon) * 4) / 4 };
}
/** Sun set (or rise) time with the Sun `alt` degrees down, on a local date: ms or null. */
function sunDownAt(lat, lon, dayKey, alt, morning) {
  if (morning) return G.sunMorningAt(lat, lon, dayKey, alt);
  let lo = G.localMs(dayKey, lon, 12), hi = G.localMs(dayKey, lon, 24);
  if (G.sunAlt(lat, lon, lo) < alt || G.sunAlt(lat, lon, hi) > alt) return null;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (G.sunAlt(lat, lon, m) > alt) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// ---- 5.1 ------------------------------------------------------------------------------------------------------------------
function moonTonight(P, kit) {
  const ph = W.moonPhase(P.ms), rs = W.riseSet('Moon', P.lat, P.lon, P.ms - 9 * HOUR);
  const ev = [['moonRises', rs.rise], ['moonSets', rs.set]].filter((x) => x[1] !== null).sort((p, q) => p[1] - q[1]);
  const full = W.nextPhaseMs(180, P.ms - 6 * HOUR);
  return {
    moonPhaseName: kit.words('moonPhases')[W.phaseIndex(ph.angle)], moonLit: Math.round(ph.lit * 100),
    moonTimes: ev.length ? kit.list(ev.map(([k, t]) => kit.ui(k, { a: G.clock12(G.solarHour(t, P.lon)) }))) : '',
    nextFullDate: full === null ? '' : kit.dateText(full, P.lon, true), hasTimes: ev.length > 0,
  };
}
/** The Sun-Earth-Moon inset, drawn from the live clock. */
const insetFor = (X, day) => moonInset({ angle: () => W.moonPhase(X.S.time).angle, day, sunText: X.ui('sunLabel'), earthText: X.ui('earthLabel'), moonText: X.ui('moonLabel') });

// ---- 5.2 ------------------------------------------------------------------------------------------------------------------
/** The planets above the horizon at P.ms, high ones first: [{name, alt, az}] (altitude over 5 degrees). */
function planetsUp(P, kit) {
  const names = kit.words('planetNames'), ids = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  return ids.map((id, i) => ({ name: names[i] || id, ...W.bodyAltAz(id, P.lat, P.lon, P.ms) })).filter((p) => p.alt > 5).sort((p, q) => q.alt - p.alt);
}

// ---- 5.3 ------------------------------------------------------------------------------------------------------------------
/** Venus this month: which side of the Sun, how far. */
function venusNow(ms) { const e = W.signedElongation('Venus', ms); return { side: W.inferiorSide('Venus', ms), deg: Math.abs(e) }; }
function venusTonight(P, kit) {
  const v = venusNow(P.ms), mx = W.nextMaxElongation('Venus', P.ms - 12 * HOUR);
  const out = {
    venusState: kit.ui(v.side === 'evening' ? 'venusEvening' : v.side === 'morning' ? 'venusMorning' : 'venusNear'), venusDeg: Math.round(v.deg),
    venusMaxDeg: Math.round(mx.deg), venusMaxSide: kit.ui(mx.side === 'evening' ? 'dir.e' : 'dir.w').toLowerCase(), venusMaxDate: dateY(kit, mx.ms, P.lon), venusLead: 45, venusWhere: '', venusOk: false,
  };
  if (v.side === 'near') return out;
  const sun = W.riseSet('Sun', P.lat, P.lon, P.ms - 9 * HOUR), sunNext = W.riseSet('Sun', P.lat, P.lon, P.ms);
  const t = v.side === 'evening' ? (sun.set === null ? null : sun.set + 45 * 60e3) : (sunNext.rise === null ? null : sunNext.rise - 45 * 60e3);
  if (t === null) return out;
  const aa = W.bodyAltAz('Venus', P.lat, P.lon, t);
  return { ...out, venusWhere: P.where(aa.az, Math.max(aa.alt, 0)), venusOk: aa.alt > 0 };
}

// ---- 5.4 ------------------------------------------------------------------------------------------------------------------
/** What the sky scene of 5.4 draws: the Sun's path, the Moon's path, the two nodes. Returns the geometry and the node that stands highest. */
function eclipseScene(X, atMs, quick) {
  const { ov } = X, g = W.moonPathGeometry(atMs), lat = X.S.obs.lat, k = quick ? 0 : 2600;
  ov.circle(W.ECL_POLE, 90, { color: 'gold', width: 2.8, grow: k });
  ov.circle(g.pole, 90, { color: 'white', width: 2.4, grow: k });
  const hiOf = (n) => G.culminationAlt(n.dec, lat), top = hiOf(g.asc) >= hiOf(g.desc) ? g.asc : g.desc, other = top === g.asc ? g.desc : g.asc;
  const lam = W.eclLonOfApp(X.A.eqToVec(top.ra, top.dec));
  return {
    g, top, other, lam,
    labels() {
      ov.text(W.eclPoint(lam - 22), X.ui('sunPathLabel'), { color: 'gold', size: 13, dy: 17, align: 'right' });
      ov.text(W.moonPathPoint(g, lam - 22), X.ui('moonPathLabel'), { color: 'white', size: 13, dy: -17, align: 'right' });
    },
    nodes() {
      ov.marker(top, { color: 'gold', r: 13, pulse: true, text: X.ui('nodeLabel'), dy: -24, size: 14 });
      ov.marker(other, { color: 'gold', r: 13, pulse: true, text: X.ui('nodeLabel'), dy: -24, size: 14 });
    },
  };
}

function lunarText(kit, e, lon) { return kit.ui('eclLunar', { a: kit.words('lunarKinds')[e.kind === 'total' ? 0 : 1], b: dateY(kit, e.ms, lon) }); }
function solarText(kit, e, lon) { return kit.ui('eclSolar', { a: kit.words('solarKinds')[e.kind === 'total' ? 0 : e.kind === 'annular' ? 1 : 2], b: dateY(kit, e.ms, lon) }); }

export default [
  // ================================================================== 5.1
  {
    id: 'l5.1',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'watch.c6', 'watch.c7', 'tonight.text', 'tonight.noTimes'],
    placeholders: ['moonPhaseName', 'moonLit', 'moonTimes', 'nextFullDate'],
    values: (P, kit) => (P.tonight ? moonTonight(P, kit) : {}),
    tonightKey: (P) => (moonTonight(P, P.kit).hasTimes ? 'text' : 'noTimes'),
    dayKeys: ['dayPrev', 'dayNext'],
    try: custom((X) => X.S.tm === 'day' && W.moonPhase(X.S.time).lit > 0.97, {
      controls: 'days',
      async show(X) { for (let k = 0; k < 22 && W.moonPhase(X.S.time).lit <= 0.975; k++) { X.lesson.stepDays(X, 1); await X.D.wait(520); } },
    }),
    /** One day on, keeping the Moon in view (the Try's next-day button calls this). */
    stepDays(X, d) {
      X.setClock(X.S.time + d * DAY);
      const m = X.bodyAltAz('Moon'); if (m.alt > 0) X.a.slewTo(m.az, clamp(m.alt, 15, 65), 80, 0.7);
    },
    async trySetup(X) {
      const { D, ov, S } = X, lon = S.obs.lon;
      await D.prep();
      const fm = W.nextPhaseMs(180, Date.now() - 6 * HOUR), hr = moonHours(S.obs.lat, lon, fm - 5 * DAY);
      X.setClock(G.localMs(G.dayKeyOf(fm, lon) - 5 * DAY, lon, hr.ev));
      const m = X.bodyAltAz('Moon');
      await D.toSky(m.az, clamp(m.alt, 18, 60), 80);
      ov.marker(() => X.bodyAltAz('Moon'), { color: 'gold', r: 17, pulse: true });
      ov.screen(insetFor(X, null));
    },
    async watch(X) {
      const { D, ov, S } = X, lon = S.obs.lon, lat = S.obs.lat;
      await D.prep();
      const nm = W.nextPhaseMs(0, S.time - DAY), key = G.dayKeyOf(nm, lon);
      const hr = moonHours(lat, lon, nm + 5 * DAY), at = (d) => G.localMs(key + Math.floor(d) * DAY, lon, d <= 15 ? hr.ev : hr.morn);       // evenings up to full Moon, dawns after it
      let day = 2;
      X.setClock(at(2));
      const m0 = X.bodyAltAz('Moon');
      await D.toSky(m0.az, clamp(m0.alt, 16, 55), 80);
      X.setClock(at(2));
      ov.marker(() => X.bodyAltAz('Moon'), { color: 'gold', r: 17 });
      ov.screen(insetFor(X, () => X.ui('dayN', { n: day })));
      const timer = follow(X, () => X.bodyAltAz('Moon'));
      try {
        await X.say('watch.c1', 4200);
        await X.say('watch.c2', 4200);
        D.say(X.T('watch.c3'), 0);
        for (day = 2; day <= 15; day++) {
          X.setClock(at(day));
          if (day === 7) { D.say(X.T('watch.c4'), 0); await D.wait(3200); } else if (day === 15) { D.say(X.T('watch.c5'), 0); await D.wait(4200); } else await D.wait(560);
        }
        D.say(X.T('watch.c6'), 0);
        for (day = 16; day <= 29; day++) { X.setClock(at(day)); await D.wait(day === 16 ? 1400 : 520); }
        await X.say('watch.c7', 4200);
      } finally { clearInterval(timer); }
    },
  },

  // ================================================================== 5.2
  {
    id: 'l5.2',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'watch.c6', 'tonight.text', 'tonight.none'],
    placeholders: ['marsOppDate', 'planetList'],
    values: (P, kit) => {
      const v = { marsOppDate: dateY(kit, W.nextOpposition('Mars', Date.now()), P.lon) };
      if (P.tonight) { const up = planetsUp(P, kit); v.planetList = kit.list(up.map((p) => `${p.name} is ${P.where(p.az, p.alt)}`)); }
      return v;
    },
    tonightKey: (P) => (planetsUp(P, P.kit).length ? 'text' : 'none'),
    /** Year mode, frozen at midnight, centred on the date Earth overtakes Mars. Returns the track of Mars among the stars and the dates it turns. */
    stage(X) {
      const { S } = X, lon = S.obs.lon, opp = W.nextOpposition('Mars', Date.now()), t0 = G.localMs(G.dayKeyOf(opp, lon), lon, 24);
      X.setClock(t0); X.yearAt(24);
      const base = S.time, rs = W.retrogradeSpan('Mars', opp);
      return { base, track: W.skyTrack('Mars', base - 80 * DAY, base + 80 * DAY, 2), turnA: (rs.start - base) / DAY, turnB: (rs.end - base) / DAY };
    },
    try: custom((X) => X.S.tm === 'year' && W.isRetrograde('Mars', X.S.time + X.S.yd * DAY), {
      controls: 'year',
      async show(X) { await X.tweenYear(0, 3200); },
    }),
    async trySetup(X) {
      const { D, ov, S } = X;
      await D.prep();
      const st = X.lesson.stage(X);
      X.setYd(Math.round(st.turnA - 22));
      const m = X.bodyAltAz('Mars');
      await D.toSky(m.az, clamp(m.alt, 18, 60), 70);
      ov.path(st.track, { upTo: () => clamp((S.yd + 80) / 160, 0, 1), tail: 9, width: 3 });
      ov.marker(trackOnChange(X, () => X.bodyAltAz('Mars'), () => Math.round(S.yd)), { color: 'gold', r: 13, pulse: true });
      ov.text(() => ({ az: S.sky.az, alt: Math.min(86, S.sky.alt + S.sky.fov * 0.28) }), () => X.dateNow(true), { color: 'gold', size: 17 });
    },
    async watch(X) {
      const { D, ov, S } = X;
      await D.prep();
      const st = X.lesson.stage(X);
      X.setYd(-80);
      const m = X.bodyAltAz('Mars');
      await D.toSky(m.az, clamp(m.alt, 18, 60), 70);
      ov.path(st.track, { upTo: () => clamp((S.yd + 80) / 160, 0, 1), width: 3 });
      ov.marker(() => X.bodyAltAz('Mars'), { color: 'gold', r: 13 });
      ov.text(() => ({ az: S.sky.az, alt: Math.min(86, S.sky.alt + S.sky.fov * 0.28) }), () => X.dateNow(true), { color: 'gold', size: 17 });
      const timer = follow(X, () => X.bodyAltAz('Mars'), { lo: 18, hi: 60 });
      try {
        await X.say('watch.c1', 4600);
        await X.say('watch.c2', 4600);
        D.say(X.T('watch.c3'), 0);
        let done = false, phase = 0;
        const tw = X.tweenYear(80, 15000); tw.then(() => { done = true; }, () => { done = true; });
        while (!done) {
          await D.wait(120);
          const yd = S.yd;
          if (phase === 0 && yd > st.turnA - 2) { phase = 1; D.say(X.T('watch.c4'), 0); }
          else if (phase === 1 && yd > (st.turnA + st.turnB) / 2) { phase = 2; D.say(X.T('watch.c5'), 0); }
          else if (phase === 2 && yd > st.turnB + 6) { phase = 3; D.say(X.T('watch.c6'), 0); }
        }
        await D.wait(5200);
      } finally { clearInterval(timer); }
    },
  },

  // ================================================================== 5.3
  {
    id: 'l5.3',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'try.optionEvening', 'try.optionMorning', 'try.optionNear', 'try.wrong', 'tonight.evening', 'tonight.morning', 'tonight.hidden'],
    placeholders: ['venusState', 'venusDeg', 'venusWhere', 'venusLead', 'venusMaxDeg', 'venusMaxSide', 'venusMaxDate'],
    values: (P, kit) => (P.tonight ? venusTonight(P, kit) : (() => { const v = venusNow(Date.now()); return { venusState: kit.ui(v.side === 'evening' ? 'venusEvening' : v.side === 'morning' ? 'venusMorning' : 'venusNear'), venusDeg: Math.round(v.deg) }; })()),
    tonightKey: (P) => { const t = venusTonight(P, P.kit); return t.venusOk ? (venusNow(P.ms).side === 'evening' ? 'evening' : 'morning') : 'hidden'; },
    try: choice({
      options(X) {
        const list = [{ id: 'evening', text: X.T('try.optionEvening') }, { id: 'morning', text: X.T('try.optionMorning') }, { id: 'near', text: X.T('try.optionNear') }];
        const k = Math.floor(Date.now() / DAY) % 3;
        return list.map((_, i) => list[(i + k) % 3]);
      },
      correct: () => venusNow(Date.now()).side,
      async show(X) {
        const venusAt = () => X.bodyAltAz('Venus'), sunAt = () => X.bodyAltAz('Sun');
        X.ov.marker(venusAt, { color: 'gold', r: 15, pulse: true, horizon: false });
        X.ov.segment(venusAt, sunAt, { color: 'gold', width: 2.2, dash: [7, 6], horizon: false, grow: 1200 });
        await X.D.wait(2200);
      },
    }),
    /** The sky at the dusk (or dawn) of a date, looking towards Venus and the Sun. Returns the Venus alt/az. */
    scene(X, dateMs, side) {
      const { S, ov } = X, lat = S.obs.lat, lon = S.obs.lon, key = G.dayKeyOf(dateMs, lon), morning = side === 'morning';
      const t = sunDownAt(lat, lon, key, -6, morning) ?? G.localMs(key, lon, morning ? 5 : 20.5);
      X.setClock(t);
      return X.bodyAltAz('Venus');
    },
    async trySetup(X) {
      const { D, ov, S } = X, lon = S.obs.lon;
      await D.prep();
      X.setClock(sunDownAt(S.obs.lat, lon, G.dayKeyOf(Date.now(), lon), -6, false) ?? G.eveningMs(Date.now(), lon, 20.5));
      const sun = X.bodyAltAz('Sun');
      await D.toSky(sun.az, 22, 85);
      ov.marker(() => X.bodyAltAz('Venus'), { color: 'gold', r: 15, pulse: true });
    },
    async watch(X) {
      const { D, ov, S } = X, lat = S.obs.lat, lon = S.obs.lon;
      await D.prep();
      // the next greatest elongation east of the Sun, then the one west of it that follows
      let ge = W.nextMaxElongation('Venus', Date.now() - 40 * DAY);
      if (ge.side !== 'evening') ge = W.nextMaxElongation('Venus', ge.ms + 10 * DAY);
      const gw = W.nextMaxElongation('Venus', ge.ms + 10 * DAY), span = 584, series = W.elongationSeries('Venus', ge.ms, span, 4);
      let v = 0;                                  // days since the first greatest elongation, drives the chart
      const showScene = async (ms, side) => {
        const aa = X.lesson.scene(X, ms, side);
        await D.toSky(aa.az, clamp(aa.alt, 16, 55), 85);
      };
      await showScene(ge.ms, 'evening');
      const venusAt = () => X.bodyAltAz('Venus'), sunAt = () => X.bodyAltAz('Sun');
      const mk = ov.marker(venusAt, { color: 'gold', r: 15, pulse: true });
      ov.segment(venusAt, sunAt, { color: 'gold', width: 2.2, dash: [7, 6], horizon: false, grow: 1400, text: () => `${Math.round(Math.abs(W.signedElongation('Venus', X.S.time)))}°`, textDy: -14 });
      await X.say('watch.c1', 5000);
      await X.say('watch.c2', 4600);
      mk.remove();
      ov.marker(venusAt, { color: 'gold', r: 15 });
      ov.screen(elongationChart({ series, progress: () => clamp(v / span, 0, 1), span: 50, topText: X.ui('eveningStar'), bottomText: X.ui('morningStar'), sunText: X.ui('sunLabel'), valueText: (x) => `${Math.round(Math.abs(x))}°` }));
      D.say(X.T('watch.c3'), 0);
      const sweep = async (to, ms) => { const v0 = v, t0 = performance.now(); for (let u = 0; u < 1;) { await D.wait(30); u = clamp((performance.now() - t0) / ms, 0, 1); v = v0 + (to - v0) * u; } };
      await sweep((gw.ms - ge.ms) / DAY, 7000);
      D.say(X.T('watch.c4'), 0);
      await showScene(gw.ms, 'morning');
      await D.wait(4200);
      D.say(X.T('watch.c5'), 0);
      await sweep(span, 7000);
      await D.wait(3200);
    },
  },

  // ================================================================== 5.4
  {
    id: 'l5.4',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'watch.c6', 'try.option', 'try.wrong', 'tonight.text'],
    placeholders: ['label', 'eclipseDate', 'eclipseKind', 'lunarNext', 'solarNext'],
    values: (P, kit) => {
      const v = {};
      if (P.tonight) {
        const l = once('vl' + P.lat.toFixed(1) + P.lon.toFixed(1), () => W.nextVisibleLunar(P.lat, P.lon, P.ms)), s = once('vs' + P.lat.toFixed(1) + P.lon.toFixed(1), () => W.nextVisibleSolar(P.lat, P.lon, P.ms));
        v.lunarNext = l ? lunarText(kit, l, P.lon) : kit.ui('eclNone'); v.solarNext = s ? solarText(kit, s, P.lon) : kit.ui('eclNone');
      }
      const e = eclipseNext();
      v.eclipseDate = dateY(kit, e.ms, P.lon); v.eclipseKind = kit.words('lunarKinds')[e.kind === 'total' ? 0 : 1];
      return v;
    },
    try: choice({
      options(X) {
        const lon = homeLon(X), ch = eclipseOptions();
        const list = ch.map((c) => ({ id: c.ms, label: c.ms, text: X.T('try.option', { label: dateY(X.kit, c.ms, lon) }), eclipsed: c.eclipsed }));
        const k = Math.floor(Date.now() / DAY) % 3;
        return list.map((_, i) => list[(i + k) % 3]);
      },
      correct: () => eclipseOptions().find((c) => c.eclipsed).ms,
      async show(X) {
        const right = eclipseOptions().find((c) => c.eclipsed), pos = W.skyPos('Moon', right.ms);
        X.ov.marker(pos, { color: 'gold', r: 20, pulse: true, horizon: false }); await X.D.wait(1800);
      },
    }),
    async trySetup(X) {
      const { D, ov } = X, lon = homeLon(X), ch = eclipseOptions(), right = ch.find((c) => c.eclipsed);
      await D.prep();
      const sc = eclipseScene(X, right.ms, true);
      X.setClock(G.nextTransitMs(sc.top, X.S.obs.lat, X.S.obs.lon, X.S.time));
      const q = ov.altAz(sc.top);
      await D.toSky(q.az, clamp(q.alt - 6, 14, 55), 100);
      sc.labels(); sc.nodes();
      for (const c of ch) ov.marker(W.skyPos('Moon', c.ms), { color: 'blue', r: 11, text: dateShort(X.kit, c.ms, lon), dy: 24, size: 13, horizon: false });
    },
    async watch(X) {
      const { D, ov, S } = X, lon = S.obs.lon, now = Date.now();
      await D.prep();
      const run = once('eclrun', () => W.eclipseRun(now, 4, 1)), e = run.eclipse;
      const sc = eclipseScene(X, e.ms, false);
      X.setClock(G.nextTransitMs(sc.top, S.obs.lat, S.obs.lon, S.time));
      const q = ov.altAz(sc.top);
      await D.toSky(q.az, clamp(q.alt - 6, 14, 55), 100);
      await X.say('watch.c1', 5200);
      sc.labels(); sc.nodes();
      await X.say('watch.c2', 4400);
      let shown = 0;
      const items = run.run.map((r) => ({ lat: r.lat, eclipsed: r.eclipsed && r.ms === run.run[run.index].ms, text: dateShort(X.kit, r.ms, lon) }));
      const note = (i) => { const it = items[i], r = run.run[i]; if (it.eclipsed) return X.ui('inShadow'); return X.ui(r.lat >= 0 ? 'degAbove' : 'degBelow', { n: Math.abs(r.lat).toFixed(1) }); };
      ov.screen(eclipseChart({ items, shown: () => shown, sunText: X.ui('sunPathLabel'), shadowText: X.ui('shadowLabel'), note }));
      D.say(X.T('watch.c3'), 0);
      await D.wait(3600);
      for (let i = 0; i < items.length; i++) {
        shown = i + 1;
        if (i === 0) D.say(X.T('watch.c4'), 0);
        if (items[i].eclipsed) { D.say(X.T('watch.c5', { eclipseDate: dateY(X.kit, e.ms, lon), eclipseKind: X.kit.words('lunarKinds')[e.kind === 'total' ? 0 : 1] }), 0); await D.wait(6200); } else await D.wait(i === 0 ? 3600 : 1500);
      }
      await X.say('watch.c6', 6400);
    },
  },
];
