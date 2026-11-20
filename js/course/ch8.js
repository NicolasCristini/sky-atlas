// Chapter 8: Losing and finding the night. Lesson LOGIC only: every sentence the learner reads lives in content/<lang>/course.md under the same ids.
// See js/course/README.md for how a lesson is put together. Pure maths: nightsky.js. Live-app helpers: nightx.js.
import * as G from './geo.js';
import * as N from './nightsky.js';
import { custom, sequence, choice } from './checks.js';
import { keepTryTool } from './nightsky.js';
import { clamp, homeNow, shared, moveToEvening, aimGlobe, countNow, aboutN, moonCalendar, nightClock, whereOf } from './nightx.js';

const Ast = () => globalThis.Astronomy;
const idx = (kit, hip) => kit.data.hipIndex.get(hip);
const daySeed = () => Math.floor(Date.now() / 864e5);
const POLARIS = 11767, ACRUX = 60718;
const FRIENDLY = { Cru: 'the Southern Cross', UMa: 'the Big Dipper', Cyg: 'Cygnus the Swan', Ori: 'Orion', Cas: 'Cassiopeia', Sco: 'Scorpius', Leo: 'Leo', Tau: 'Taurus', Peg: 'Pegasus', Aur: 'Auriga', CMa: 'Canis Major', Lyr: 'Lyra', Aql: 'Aquila', Gem: 'Gemini' };
const consName = (kit, id) => FRIENDLY[id] || (kit.data.consMap.get(id) || {}).name || id;
const consAlt = (kit, id, lat, lon, ms) => { const c = kit.data.consMap.get(id); if (!c) return -90; const e = kit.A.vecToEq(c.center); return G.starAltAt(e, lat, lon, ms); };
const QNAMES = ['Big city', 'Suburb', 'Countryside', 'Dark site'];
const FAINT = [['Pleiades', 'the Pleiades'], ['Andromeda Galaxy', 'the Andromeda Galaxy'], ['Orion Nebula', 'the Orion Nebula'], ['Omega Centauri', 'Omega Centauri'], ['Large Magellanic Cloud', 'the Large Magellanic Cloud']];

/** The constellation the 8.1 Try shows (Globe at Night uses Orion; the Southern Cross, Cassiopeia or Scorpius when Orion is not up): the first one up at 22:00 tonight, else Orion or the Cross, whichever the place can see. */
function pickCons81(X) {
  const nx = shared(X.kit), h = homeNow(X), key = `${h.lat}|${h.lon}|${Math.floor(h.ms / 36e5)}`; if (nx.cons81 && nx.cons81.key === key) return nx.cons81;
  const ms = G.eveningMs(h.ms, h.lon, 22), up = (id) => consAlt(X.kit, id, h.lat, h.lon, ms) > 25;
  let id = ['Ori', 'Cru', 'Cas', 'Sco'].find(up);
  if (!id) id = G.culminationAlt(-1, h.lat) > 40 ? 'Ori' : 'Cru';
  nx.cons81 = { id, key }; nx.cons71 = consName(X.kit, id);
  return nx.cons81;
}

// ---- 8.3 ------------------------------------------------------------------------------------------------------------------
const evCache = new Map();
/** The next 31 evenings at a place (cached for the lesson: the maths is cheap but not free). */
function evenings(lat, lon, ms) {
  const key = `${lat.toFixed(2)}|${lon.toFixed(2)}|${G.dayKeyOf(ms, lon)}`;
  if (!evCache.has(key)) { if (evCache.size > 8) evCache.clear(); evCache.set(key, N.eveningsAhead(Ast(), lat, lon, ms, 31)); }
  return evCache.get(key);
}
const weekdayOf = (kit, dayKey) => kit.words('weekdays')[new Date(dayKey).getUTCDay()];
const dateOfEvening = (kit, e, lon) => kit.dateText(e.dusk, lon);

// ---- 8.4 ------------------------------------------------------------------------------------------------------------------
const CONS_PREF = ['Ori', 'Cas', 'Cyg', 'Sco', 'Cru', 'Leo', 'Tau', 'Peg', 'Aur', 'CMa', 'UMa', 'Lyr', 'Aql', 'Gem'];
const BODY_NAMES = { Venus: 'Venus', Jupiter: 'Jupiter', Mars: 'Mars', Saturn: 'Saturn', Mercury: 'Mercury' };
/** What tonight's tour shows from a place at an instant (evening): planet, pole, constellation, Moon, Milky Way, and the objects the learner may tap. */
function tourOf(kit, lat, lon, ms) {
  const key = `${lat.toFixed(2)}|${lon.toFixed(2)}|${Math.round(ms / 6e4)}`;
  if (kit.tourKey === key && kit.tour) return kit.tour;
  const D = kit.data, T = { lat, lon, ms, stops: [], targets: [] };
  const pl = N.planetsUp(Ast(), lat, lon, ms, 10)[0];
  if (pl) { T.planet = pl; T.stops.push('planet'); T.targets.push({ kind: 'body', id: pl.id, name: BODY_NAMES[pl.id] || pl.id, alt: pl.alt, az: pl.az }); }
  const poleHip = lat >= 0 ? POLARIS : ACRUX;
  if (Math.abs(lat) >= 8) {
    T.stops.push('pole');
    const aa = G.starAltAzAt(kit.starOf(poleHip), lat, lon, ms);
    if (aa.alt > 6) T.targets.push({ kind: 'star', hip: poleHip, name: kit.starName(poleHip), alt: aa.alt, az: aa.az });
  }
  const cid = CONS_PREF.find((id) => { const a = consAlt(kit, id, lat, lon, ms); return a > 25 && a < 85; });
  if (cid) {
    T.cons = cid; T.stops.push('cons');
    let best = null;
    for (let i = 0; i < D.stars.n; i++) { if (D.stars.mag[i] > 2.3) continue; const nm = D.names[D.stars.hip[i]]; if (!nm || !nm.name || nm.c !== cid) continue; if (!best || D.stars.mag[i] < D.stars.mag[best]) best = i; }
    if (best !== null) { const aa = G.starAltAzAt({ ra: D.stars.ra[best], dec: D.stars.dec[best] }, lat, lon, ms); if (aa.alt > 8) T.targets.push({ kind: 'star', hip: D.stars.hip[best], name: kit.starName(D.stars.hip[best]), alt: aa.alt, az: aa.az }); }
  }
  const mo = N.moonNow(Ast(), lat, lon, ms);
  if (mo.alt > 8 && mo.illum > 0.04) { T.moon = mo; T.stops.push('moon'); T.targets.push({ kind: 'body', id: 'Moon', name: kit.ui('moonWord'), alt: mo.alt, az: mo.az }); }
  // the Milky Way: its centre if that stands well up, otherwise the highest point of the band
  const gc = G.starAltAzAt(N.GALACTIC_CENTRE, lat, lon, ms);
  let mw = { alt: gc.alt, az: gc.az, centre: true };
  if (gc.alt < 15) { mw = { alt: -90, az: 0, centre: false }; for (let l = 0; l < 360; l += 5) { const e = N.galacticToEq(l, 0), aa = G.starAltAzAt(e, lat, lon, ms); if (aa.alt > mw.alt) mw = { alt: aa.alt, az: aa.az, centre: false, eq: e }; } }
  if (mw.alt > 20) { T.mw = mw; T.stops.push('mw'); }
  // a few bright stars so there are always at least three things to find
  const bright = N.brightUp(D, lat, lon, ms, { maxMag: 1.6, minAlt: 10 });
  for (const b of bright) { if (T.targets.length >= 6) break; if (!T.targets.some((t) => t.hip === b.hip)) T.targets.push({ kind: 'star', hip: b.hip, name: kit.starName(b.hip), alt: b.alt, az: b.az }); }
  kit.tourKey = key; kit.tour = T; return T;
}
const isTarget = (sel, t) => (t.kind === 'star' ? sel.type === 'star' && sel.hip === t.hip : sel.type === 'body' && sel.body && sel.body.id === t.id);
const selOf = (X) => { const s = X.S.sel; if (!s) return null; if (s.type === 'star') return { type: 'star', hip: X.data.stars.hip[s.index] }; if (s.type === 'body') return { type: 'body', body: s.body }; return { type: s.type }; };

function leftNames(kit) {
  const nx = shared(kit), T = nx.tourT; if (!T) return [];
  return T.targets.filter((t, i) => !nx.found.has(i)).map((t) => t.name);
}

export default [
  // ================================================================== 8.1
  {
    id: 'l8.1',
    keys: ['watch.c1', 'watch.c2', 'watch.step', 'watch.c3', 'watch.c4', 'tonight.text'],
    placeholders: ['quality', 'count', 'consName', 'chosenName', 'chosenCount', 'darkCount', 'cityCount'],
    values: (P, kit) => {
      const nx = shared(kit), out = {};
      if (nx.cons71) out.consName = nx.cons71;
      const q = Math.round(kit.chosenQ ?? kit.snapQ());
      out.chosenName = QNAMES[clamp(q, 0, 3)].toLowerCase();
      out.chosenCount = aboutN(N.starsVisible(kit.data.stars, P.lat, P.lon, P.ms, N.qualityLimit(q)));
      out.darkCount = aboutN(N.starsVisible(kit.data.stars, P.lat, P.lon, P.ms, N.qualityLimit(3)));
      out.cityCount = aboutN(N.starsVisible(kit.data.stars, P.lat, P.lon, P.ms, N.qualityLimit(0)));
      return out;
    },
    try: (X) => {
      pickCons81(X);
      const c = custom((X) => {
        if (!shared(X.kit).qOk) return false;
        X.kit.chosenQ = Math.round(X.S.q); return true;
      }, {
        reset(X) { shared(X.kit).qOk = false; X.kit.chosenQ = null; },
        async show(X) {
          for (const q of [2, 1]) { await X.D.tweenQ(q, 900); await X.D.wait(900); }
          X.kit.chosenQ = 1;
        },
      });
      c.tool = {
        html: (X) => `<label class="lc-lab2">${X.ui('skyQuality')}</label><input type="range" min="0" max="3" step="1" value="${clamp(Math.round(X.S.q), 0, 3)}" aria-label="${X.ui('skyQuality')}"><output class="lc-val num"></output><button type="button" class="lc-step-b" data-act="ok">${X.ui('thatsMySky')}</button>`,
        sync: (X, t) => { const q = clamp(Math.round(X.S.q), 0, 3), inp = t.querySelector('input'); t.querySelector('output').textContent = QNAMES[q]; if (document.activeElement !== inp) inp.value = String(q); },
        onInput: (X, v) => { X.S.q = +v; X.a.syncSkyUI(); },
        onAct: (X) => { shared(X.kit).qOk = true; },
      };
      c.keepTool = keepTryTool('q');
      c.keep = true;
      return c;
    },
    /** Dark sky, band on, the constellation chosen for this lesson (Orion if it is up), framed. */
    async stage(X) {
      const { D, S, kit } = X, id = pickCons81(X).id;
      await D.prep(); D.layer('mw', true); nightClock(X);
      if (consAlt(kit, id, S.obs.lat, S.obs.lon, S.time) < 25) await moveToEvening(X, (t) => consAlt(kit, id, S.obs.lat, S.obs.lon, t) > 30, { hour: 22 });
      D.highlight(id);
      const e = X.A.vecToEq(kit.data.consMap.get(id).center), aa = D.starAltAz(e.ra, e.dec);
      await D.toSky(aa.az, clamp(aa.alt, 20, 60), 62);
    },
    async trySetup(X) {
      await X.lesson.stage(X);
      await X.D.tweenQ(3, 700);
      X.kit.chosenQ = null; shared(X.kit).qOk = false;
    },
    async watch(X) {
      const { D, ov, S, kit } = X;
      await D.prep(); D.layer('mw', true); D.highlight(null); nightClock(X);
      await D.tweenQ(3, 700);
      const b = D.bandHighest();
      await D.toSky(b.az, clamp(b.alt - 10, 20, 50), 105);
      ov.text(() => ({ az: S.sky.az, alt: clamp(S.sky.alt + (S.sky.fov * 0.3), 5, 85) }), () => X.ui('starsLabel', { count: aboutN(countNow(X, S.q)) }), { color: 'gold', size: 19, weight: 700 });
      await X.say('watch.c1', 4600);
      await X.say('watch.c2', 3000);
      for (const q of [2, 1, 0]) {
        await D.tweenQ(q, 2000);
        await X.say('watch.step', 3400, { quality: QNAMES[q], count: aboutN(countNow(X, q)) });
      }
      await X.say('watch.c3', 6000);
      await X.say('watch.c4', 5600);
    },
  },

  // ================================================================== 8.2
  {
    id: 'l8.2',
    keys: ['watch.c1', 'watch.min', 'watch.c2', 'watch.c3', 'watch.c4', 'tonight.text', 'tonight.generic'],
    placeholders: ['minute', 'limit', 'faintTarget', 'faintWhere'],
    values: (P, kit) => {
      const out = {};
      if (P.tonight) {
        for (const [name, say] of FAINT) {
          const d = kit.data.dso.find((x) => x.name === name); if (!d) continue;
          const aa = G.starAltAzAt(d, P.lat, P.lon, P.ms);
          if (aa.alt >= 20) { out.faintTarget = say; out.faintWhere = whereOf(P, aa.az, aa.alt); break; }
        }
      }
      return out;
    },
    tonightKey: (P) => (FAINT.some(([name]) => { const d = P.kit.data.dso.find((x) => x.name === name); return d && G.starAltAzAt(d, P.lat, P.lon, P.ms).alt >= 20; }) ? 'text' : 'generic'),
    try: (() => {
      const c = custom((X) => X.kit.red.on, {
        reset(X) { X.kit.red.lesson(false); },
        async show(X) { X.kit.red.lesson(true); await X.D.wait(1500); },
      });
      c.tool = {
        html: (X) => `<button type="button" class="lc-step-b" data-act="night" aria-pressed="false"></button>`,
        sync: (X, t) => { const b = t.querySelector('button'), on = X.kit.red.on; b.textContent = X.ui(on ? 'redModeOn' : 'redModeOff'); b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); },
        onAct: (X) => { X.kit.red.lesson(!X.kit.red.on); },
      };
      c.keepTool = keepTryTool('red');
      c.keep = true;
      return c;
    })(),
    async trySetup(X) { const { D } = X; await D.prep(); D.layer('mw', true); nightClock(X); X.kit.red.lesson(false); await D.tweenQ(3, 600); await D.toSky(X.S.sky.az, 45, 100); },
    async watch(X) {
      const { D, ov, S, kit } = X;
      await D.prep(); D.layer('mw', true); nightClock(X);
      await D.tweenQ(3, 700);
      const b = D.bandHighest();
      await D.toSky(b.az, clamp(b.alt - 10, 20, 50), 105);
      const was = kit.red.on;
      kit.red.lesson(false);
      kit.cleanups.push(() => { delete S.limOv; kit.red.set(was, false); });
      let lim = 3, minute = 1, count = 0;
      S.limOv = 3;
      const at = () => ({ az: S.sky.az, alt: clamp(S.sky.alt + S.sky.fov * 0.3, 5, 85) });
      ov.text(at, () => X.ui('adaptLabel', { a: minute }), { color: 'gold', size: 20, weight: 700 });
      ov.text(at, () => X.ui('adaptLabel2', { b: lim.toFixed(1), count: aboutN(count) }), { color: 'gold', size: 14, dy: 24 });
      const upd = () => { S.limOv = lim; count = N.starsVisible(X.data.stars, S.obs.lat, S.obs.lon, S.time, lim); };
      upd();
      await X.say('watch.c1', 3800);
      // ten seconds: the eye's limit climbs from about 3 to about 6 (a simulation, not a measurement)
      const t0 = performance.now(), total = 10000;
      const stops = [[0.0, 1], [0.34, 5], [0.67, 12], [1.0, 25]];
      let said = -1;
      for (let u = 0; u < 1;) {
        await D.wait(40);
        u = clamp((performance.now() - t0) / total, 0, 1);
        const e = 1 - Math.pow(1 - u, 2.2);
        lim = 3 + 3 * e; minute = Math.max(1, Math.round(1 + 24 * u)); upd();
        const k = stops.filter(([s]) => u >= s).length - 1;
        if (k > said && k > 0) { said = k; D.say(X.T('watch.min', { minute: stops[k][1], limit: (3 + 3 * (1 - Math.pow(1 - stops[k][0], 2.2))).toFixed(1) }), 0); }
      }
      await D.wait(1200);
      await X.say('watch.c2', 5600);
      kit.red.lesson(true);
      await X.say('watch.c3', 6200);
      await X.say('watch.c4', 6200);
    },
  },

  // ================================================================== 8.3
  {
    id: 'l8.3',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'try.wrong', 'try.option', 'tonight.text', 'tonight.now', 'tonight.none'],
    placeholders: ['label', 'winWhen', 'winTo', 'winDays'],
    values: (P, kit) => {
      const out = {};
      if (P.tonight) {
        const run = N.moonlessRun(evenings(P.lat, P.lon, P.ms));
        if (run) {
          const a = dateOfEvening(kit, run.from, P.lon), b = dateOfEvening(kit, run.to, P.lon);
          out.winWhen = run.days === 1 ? kit.ui('onDate', { a }) : kit.ui('fromToLong', { a, b }); out.winTo = b; out.winDays = String(run.days);
        }
      }
      return out;
    },
    tonightKey: (P) => { const run = N.moonlessRun(evenings(P.lat, P.lon, P.ms)); return !run ? 'none' : run.startsNow ? 'now' : 'text'; },
    try: (X) => {
      const h = homeNow(X), list = evenings(h.lat, h.lon, G.eveningMs(h.ms, h.lon, 21)), ch = N.darkChoices(list);
      const kit = X.kit;
      shared(kit).dark = { list, ch };
      if (!ch) return custom(() => true);
      const ids = [ch.best, ch.mid, ch.full], k = daySeed() % 3, ord = ids.map((_, i) => ids[(i + k) % 3]);
      const label = (e) => `${weekdayOf(kit, e.dayKey)} ${dateOfEvening(kit, e, h.lon)}`;
      const c = choice({
        options: (Y) => ord.map((e) => ({ id: e.dayKey, label: e.dayKey, text: Y.T('try.option', { label: label(e) }) })),
        correct: () => ch.best.dayKey,
        async show(Y) { Y.kit.cal && Y.kit.cal.highlight((k2) => k2 === ch.best.dayKey); await Y.D.wait(2200); },
      });
      c.answer = (Y, id) => (id === ch.best.dayKey ? true : { wrong: true, vars: { name: label(ord.find((e) => e.dayKey === id)) } });
      return c;
    },
    /** Sky view with the calendar over it; opts.highlight marks the moonless evenings. */
    showCalendar(X, opts = {}) {
      const { kit } = X, d = shared(kit).dark, h = homeNow(X), cal = moonCalendar(X);
      kit.cal = cal; kit.cleanups.push(() => cal.hide());
      const first = new Date(d.list[0].dusk + (h.lon / 15) * 3600e3), last = new Date(d.list[d.list.length - 1].dusk + (h.lon / 15) * 3600e3), mw = kit.words('months');
      cal.show(d.list, {
        south: h.lat < 0, weekdays: kit.words('weekdays1'), label: kit.ui('calLabel', { place: kit.placeShort(h.lat, h.lon) }),
        title: kit.ui('calTitle', { a: `${first.getUTCDate()} ${mw[first.getUTCMonth()]}`, b: `${last.getUTCDate()} ${mw[last.getUTCMonth()]}` }),
        marks: opts.marks, highlight: opts.highlight,
      });
    },
    async trySetup(X) {
      const { D, kit } = X, d = shared(kit).dark; await D.prep();
      X.setClock(G.eveningMs(homeNow(X).ms, homeNow(X).lon, 21));
      await D.toSky(X.S.sky.az, 40, 100);
      if (d && d.ch) X.lesson.showCalendar(X, { marks: new Set([d.ch.best.dayKey, d.ch.mid.dayKey, d.ch.full.dayKey]) });
    },
    async watch(X) {
      const { D, ov, S, kit } = X, h = homeNow(X);
      await D.prep();
      X.setClock(G.eveningMs(S.time, S.obs.lon, 22));
      await D.toGlobe();
      const tall = window.innerWidth < window.innerHeight;
      await aimGlobe(X, S.obs.lat, S.obs.lon, tall ? 1.17 : 1.2, 2600);
      const me = ov.geo(S.obs.lat, S.obs.lon);
      ov.gmarker(me, { r: 6, color: 'gold', text: kit.placeShort(S.obs.lat, S.obs.lon), dy: -16, size: 14 });
      await X.say('watch.c1', 5400);
      ov.gring(S.obs.lat, S.obs.lon, 50, { color: 'gold', text: X.ui('km', { n: 50 }), width: 2.4, size: 13, grow: 1600 });
      await D.wait(1700);
      ov.gring(S.obs.lat, S.obs.lon, 100, { color: 'white', text: X.ui('km', { n: 100 }), width: 2.4, size: 13, grow: 1800, textPhi: 2.4 });
      await X.say('watch.c2', 6200);
      await X.say('watch.c3', 5000);
      // back to the sky and the calendar
      ov.clear();
      X.resetClock();
      await D.toSky(S.sky.az, 40, 100);
      const list = evenings(h.lat, h.lon, G.eveningMs(h.ms, h.lon, 21)); shared(kit).dark = { list, ch: N.darkChoices(list) };
      X.lesson.showCalendar(X, {});
      await X.say('watch.c4', 5200);
      kit.cal.highlight((k) => list.some((e) => e.dayKey === k && e.moonless));
      await X.say('watch.c5', 7000);
    },
  },

  // ================================================================== 8.4
  {
    id: 'l8.4',
    keys: ['watch.c1', 'watch.planet', 'watch.pole', 'watch.cons', 'watch.moon', 'watch.mw', 'watch.last', 'try.prompt2', 'try.prompt3', 'try.hint2', 'try.hint3', 'try.wrong', 'tonight.text'],
    placeholders: ['tourDate', 'tourPlanet', 'tourCons', 'tourLeft', 'found', 'hintName', 'hintWhere', 'duskGap', 'moonLine', 'tourList'],
    values: (P, kit) => {
      const T = tourOf(kit, P.lat, P.lon, P.ms), nx = shared(kit), out = { tourDate: kit.dateText(P.ms, P.lon, true) };
      if (T.planet) out.tourPlanet = T.planet.id;
      if (T.cons) out.tourCons = consName(kit, T.cons);
      const left = nx.tourT ? leftNames(kit) : T.targets.map((t) => t.name);
      out.tourLeft = kit.list(left.slice(0, 5)); out.found = String(nx.found ? nx.found.size : 0);
      const first = (nx.tourT ? nx.tourT.targets.find((t, i) => !nx.found.has(i)) : T.targets[0]);
      if (first) { out.hintName = first.name; out.hintWhere = whereOf(P, first.az, first.alt); }
      if (P.tonight) {
        const sunset = sunAt(P.lat, P.lon, P.ms, -0.83), dusk = sunAt(P.lat, P.lon, P.ms, -18);
        out.duskGap = sunset && dusk ? kit.ui('gapText', { n: Math.round((dusk - sunset) / 6e4 / 10) * 10 }) : kit.ui('gapFallback');
        const mo = N.moonNow(Ast(), P.lat, P.lon, P.ms);
        out.moonLine = kit.ui(mo.alt > 0 ? 'moonUp' : 'moonDown', { a: mo.name, b: Math.round(mo.illum * 100) });
        out.tourList = kit.list(T.targets.slice(0, 4).map((t) => t.name));
      }
      return out;
    },
    tonightKey: () => 'text',
    try: (X) => {
      const nx = shared(X.kit), h = homeNow(X);
      nx.tourT = tourOf(X.kit, h.lat, h.lon, G.eveningMs(h.ms, h.lon, 21)); nx.found = new Set();      // before the first prompt is drawn
      const stage = (k) => custom((Y) => {
        const s = selOf(Y); if (!s || !nx.tourT) return false;
        const T = nx.tourT, i = T.targets.findIndex((t, j) => !nx.found.has(j) && isTarget(s, t));
        if (i >= 0) { nx.found.add(i); return true; }
        if (T.targets.some((t, j) => nx.found.has(j) && isTarget(s, t))) return false;     // one already found: say nothing
        if (s.type === 'star' || s.type === 'body') return Y.justShown ? false : { wrong: true, vars: { name: s.type === 'star' ? Y.data.starInfo(Y.S.sel.index).title : s.body.id } };
        return false;
      }, {
        async show(Y) {
          const t = nx.tourT.targets.find((tt, j) => !nx.found.has(j)); if (!t) return;
          const aa = t.kind === 'star' ? Y.hip(t.hip) : Y.bodyAltAz(t.id);
          Y.D.slew(aa.az, Math.max(aa.alt, 10), 70, 1.4); await Y.D.wait(1500);
          Y.justShown = true;
          if (t.kind === 'star') Y.a.select({ type: 'star', index: idx(Y.kit, t.hip) }); else { const b = Y.sky.bodies.find((x) => x.id === t.id); if (b) Y.a.select({ type: 'body', body: b }); }
          await Y.D.wait(500); nx.found.add(nx.tourT.targets.indexOf(t));
        },
      });
      return sequence([stage(0), stage(1), stage(2)]);
    },
    hideLabels: (X) => ((shared(X.kit).tourT || {}).targets || []).map((t) => (t.kind === 'star' ? t.hip : t.id)),
    async trySetup(X) {
      const { D, S, kit } = X, nx = shared(kit); await D.prep();
      const ms = G.eveningMs(homeNow(X).ms, homeNow(X).lon, 21); X.setClock(ms);
      nx.tourT = tourOf(kit, S.obs.lat, S.obs.lon, ms); nx.found = new Set();
      D.layer('mw', true); await D.tweenQ(3, 600);
      const t = nx.tourT.targets[0], aa = t.kind === 'star' ? X.hip(t.hip) : X.bodyAltAz(t.id);
      await D.toSky(aa.az + 100, 35, 95);
    },
    async watch(X) {
      const { D, ov, S, kit } = X, nx = shared(kit);
      await D.prep(); D.layer('mw', true);
      const ms = G.eveningMs(homeNow(X).ms, homeNow(X).lon, 21); X.setClock(ms);
      await D.tweenQ(3, 600);
      const T = tourOf(kit, S.obs.lat, S.obs.lon, ms); nx.tourT = T; nx.found = new Set();
      await D.toSky(S.sky.az, 40, 100);
      await X.say('watch.c1', 4200);
      for (const stop of T.stops) {
        if (stop === 'planet') {
          const b = X.sky.bodies.find((x) => x.id === T.planet.id), aa = X.bodyAltAz(T.planet.id);
          D.slew(aa.az, clamp(aa.alt, 15, 55), 75, 1.8); await D.wait(1700);
          const m = ov.marker(() => ({ ra: b.ra, dec: b.dec }), { color: 'gold', r: 14, pulse: true, text: T.planet.id, dy: -24, size: 14 });
          await X.say('watch.planet', 6200); m.remove();
        } else if (stop === 'pole') {
          const az = S.obs.lat >= 0 ? 0 : 180; D.slew(az, clamp(Math.abs(S.obs.lat) / 2 + 6, 14, 55), 95, 1.8); await D.wait(1700);
          const m = ov.marker('pole', { color: 'gold', r: 14, pulse: true, text: X.ui(S.obs.lat >= 0 ? 'poleLabelN' : 'poleLabelS'), dy: -24, size: 14 });
          await X.say('watch.pole', 6200); m.remove();
        } else if (stop === 'cons') {
          const e = X.A.vecToEq(kit.data.consMap.get(T.cons).center), aa = D.starAltAz(e.ra, e.dec);
          D.highlight(T.cons); D.slew(aa.az, clamp(aa.alt, 20, 60), 70, 1.8); await D.wait(1700);
          await X.say('watch.cons', 6200); D.highlight(null);
        } else if (stop === 'moon') {
          const aa = X.bodyAltAz('Moon'); D.slew(aa.az, clamp(aa.alt, 15, 60), 75, 1.8); await D.wait(1700);
          const b = X.sky.bodies.find((x) => x.id === 'Moon'), m = ov.marker(() => ({ ra: b.ra, dec: b.dec }), { color: 'gold', r: 16, pulse: true, text: X.ui('moonWord'), dy: -26, size: 14 });
          await X.say('watch.moon', 6200); m.remove();
        } else if (stop === 'mw') {
          D.slew(T.mw.az, clamp(T.mw.alt + 5, 18, 55), 105, 1.8); await D.wait(1700);
          const m = T.mw.centre ? ov.marker(N.GALACTIC_CENTRE, { color: 'gold', r: 16, pulse: true, text: X.ui('galacticCentre'), dy: -28, size: 14 }) : null;
          await X.say('watch.mw', 6200); if (m) m.remove();
        }
      }
      await X.say('watch.last', 5600);
    },
  },
];

/** Time (ms) in the evening of `ms` when the Sun crosses `alt` going down (alt in degrees), or null. */
function sunAt(lat, lon, ms, alt) {
  const k = G.dayKeyOf(ms, lon);
  let prev = G.localMs(k, lon, 12);
  for (let t = prev + 5 * 60e3; t <= G.localMs(k, lon, 30); t += 5 * 60e3) {
    if (G.sunAlt(lat, lon, t) <= alt) return t;
    prev = t;
  }
  return null;
}
