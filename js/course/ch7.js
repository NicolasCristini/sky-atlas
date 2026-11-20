// Chapter 7: What stars are. Lesson LOGIC only: every sentence the learner reads lives in content/<lang>/course.md under the same ids.
// See js/course/README.md for how a lesson is put together. Pure maths: nightsky.js. Live-app helpers: nightx.js.
import * as G from './geo.js';
import * as N from './nightsky.js';
import { choice, custom } from './checks.js';
import { clamp, homeNow, shared, moveToEvening, framePoints, nowYear, whereOf } from './nightx.js';

const HIP = { rigel: 24436, betelgeuse: 27989, vega: 91262, deneb: 102098, sirius: 32349 };
const idx = (kit, hip) => kit.data.hipIndex.get(hip);
const daySeed = () => Math.floor(Date.now() / 864e5);

/** Name, temperature text and colour word of a catalogue star. */
function starFacts(kit, hip) {
  const st = kit.data.stars, i = idx(kit, hip), k = N.roundTemp(N.starTempK(st.bv[i], st.spect[i]));
  return { i, hip, name: kit.starName(hip), temp: N.fmtThousands(k), tempK: k, colour: N.colourWord(st.bv[i]), mag: st.mag[i], ly: N.lyOf(st, i) };
}
/** "8.6", "43", "about 310", "about 2,600": a distance in light-years, rounded as sure as it is. */
export function lyText(ly) {
  if (ly < 20) return String(Math.round(ly * 10) / 10);
  if (ly < 100) return String(Math.round(ly));
  if (ly < 1000) return 'about ' + N.fmtThousands(Math.round(ly / 10) * 10);
  return 'about ' + N.fmtThousands(Math.round(ly / 100) * 100);
}
/** The words for light that took ly years to arrive: { ago, when } ("8.6 years ago", ", around the year 2018"). */
export function lightWords(kit, ly) {
  const t = N.lightTravel(ly, nowYear());
  if (t.kind === 'million') return { ago: kit.ui('millionYearsAgo', { n: t.n }), when: '' };
  if (t.kind === 'long') return { ago: kit.ui('yearsAgoAbout', { n: N.fmtThousands(t.n) }), when: '' };
  const ago = kit.ui(ly < 20 ? 'yearsAgo' : 'yearsAgoAbout', { n: t.n < 20 ? String(t.n) : N.fmtThousands(t.n) });
  return { ago, when: ', ' + kit.ui(t.kind === 'bc' ? 'whenBC' : 'whenCE', { n: String(t.year) }) };
}
const dso = (kit, name) => kit.data.dso.find((d) => d.name === name);

// ---- 7.1 ------------------------------------------------------------------------------------------------------------------
/** The pair for the Try of 7.1 and its facts, from the stars that are above the horizon at the learner's place now. */
function pair71(X) {
  const h = homeNow(X), D = X.data;
  let list = N.brightUp(D, h.lat, h.lon, h.ms, { maxMag: 2.4, minAlt: 10 }), pr = N.contrastPair(list);
  if (!pr) { list = N.brightUp(D, h.lat, h.lon, h.ms, { maxMag: 3.4, minAlt: 5 }); pr = N.contrastPair(list, 1.3); }
  if (!pr) pr = { hot: { hip: HIP.rigel }, cool: { hip: HIP.betelgeuse } };
  return { hot: pr.hot.hip, cool: pr.cool.hip };
}
function vals71(kit, p) {
  const h = starFacts(kit, p.hot), c = starFacts(kit, p.cool);
  return { hotName: h.name, hotTemp: h.temp, hotColour: h.colour, coolName: c.name, coolTemp: c.temp, coolColour: c.colour };
}

// ---- 7.2 ------------------------------------------------------------------------------------------------------------------
const vegaDeneb = (kit) => {
  const v = starFacts(kit, HIP.vega), d = starFacts(kit, HIP.deneb), ratio = d.ly / v.ly, boost = N.brightnessBoost(d.ly, v.ly);
  return { v, d, ratio, boost };
};
function pair72(X) {
  const h = homeNow(X), L = N.brightUp(X.data, h.lat, h.lon, h.ms, { maxMag: 2.6, minAlt: 8 });
  let p = N.brighterButFarther(L);
  if (!p) p = N.brighterButFarther(N.brightUp(X.data, h.lat, h.lon, h.ms, { maxMag: 3.2, minAlt: 3 }), 3, 0.1);
  if (!p) { const a = starFacts(X.kit, HIP.rigel), b = starFacts(X.kit, 97649); p = { far: { hip: a.hip }, near: { hip: b.hip } }; }
  return { far: p.far.hip, near: p.near.hip };
}
const magText = (m) => m.toFixed(2).replace('-', '−');
function vals72(kit, p) {
  const f = starFacts(kit, p.far), n = starFacts(kit, p.near);
  return { farName: f.name, farMag: magText(f.mag), farDist: lyText(f.ly), nearName: n.name, nearMag: magText(n.mag), nearDist: lyText(n.ly) };
}

// ---- 7.3 ------------------------------------------------------------------------------------------------------------------
const CUTOFF_YEAR = 1900;
const andromeda = (kit) => dso(kit, 'Andromeda Galaxy') || { ra: 10.68, dec: 41.27, name: 'Andromeda Galaxy' };
const lmc = (kit) => dso(kit, 'Large Magellanic Cloud') || { ra: 80.9, dec: -69.76, name: 'Large Magellanic Cloud' };
const upAt = (obj, lat, lon, ms) => G.starAltAzAt(obj, lat, lon, ms);

// ---- 7.4 ------------------------------------------------------------------------------------------------------------------
const GC = N.GALACTIC_CENTRE;
const gcOk = (lat, lon, ms) => { const m = G.culminationAlt(GC.dec, lat); return m > 8 && G.starAltAt(GC, lat, lon, ms) >= Math.min(20, m - 6); };

export default [
  // ================================================================== 7.1
  {
    id: 'l7.1',
    keys: ['watch.moved', 'watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'try.wrong', 'tonight.text', 'tonight.none'],
    placeholders: ['hotName', 'hotTemp', 'hotColour', 'coolName', 'coolTemp', 'coolColour'],
    values: (P, kit) => {
      if (P.tonight) {
        const pr = N.contrastPair(N.brightUp(kit.data, P.lat, P.lon, P.ms, { maxMag: 2.4, minAlt: 12 }));
        return pr ? vals71(kit, { hot: pr.hot.hip, cool: pr.cool.hip }) : {};
      }
      const s = shared(kit).p71; return s ? vals71(kit, s) : {};
    },
    tonightKey: (P) => (N.contrastPair(N.brightUp(P.kit.data, P.lat, P.lon, P.ms, { maxMag: 2.4, minAlt: 12 })) ? 'text' : 'none'),
    try: (X) => {
      const p = pair71(X), kit = X.kit; shared(kit).p71 = p;
      const swap = daySeed() % 2 === 1, ids = swap ? [p.cool, p.hot] : [p.hot, p.cool];
      const c = choice({
        options: (Y) => ids.map((hip) => ({ id: hip, label: hip, text: Y.kit.starName(hip) })),
        correct: () => p.hot,
        async show(Y) { await framePoints(Y, [p.hot, p.cool]); Y.ov.marker(p.hot, { color: 'gold', r: 12, pulse: true, text: Y.kit.starName(p.hot), dy: -22 }); await Y.D.wait(2200); },
      });
      c.answer = (Y, id) => (id === p.hot ? true : { wrong: true, vars: { name: Y.kit.starName(id) } });
      return c;
    },
    async trySetup(X) { const p = shared(X.kit).p71; await X.D.prep(); await framePoints(X, [p.hot, p.cool]); },
    async watch(X) {
      const { D, ov, S, kit } = X;
      await D.prep();
      const t0 = S.time;
      const pr = D.pickPair();
      let p = { hot: pr.hot, cool: pr.cool };
      if (X.hip(p.hot).alt < 4 || X.hip(p.cool).alt < 4) { await X.goTo(35 * (S.obs.lat < 0 ? -1 : 1), S.obs.lon, 6); }
      shared(kit).p71 = p;
      await framePoints(X, [p.hot, p.cool]);
      if (Math.abs(S.time - t0) > 60e3) await X.say('watch.moved', 3200);
      await X.say('watch.c1', 3800);
      const h = starFacts(kit, p.hot), c = starFacts(kit, p.cool);
      D.select(p.hot);
      ov.text(p.hot, X.ui('tempLabel', { name: h.name, a: h.temp }), { color: 'blue', dy: 28, size: 14 });
      await X.say('watch.c2', 5200);
      D.select(p.cool);
      ov.text(p.cool, X.ui('tempLabel', { name: c.name, a: c.temp }), { color: 'gold', dy: 28, size: 14 });
      await X.say('watch.c3', 5200);
      await X.say('watch.c4', 5200);
      await X.say('watch.c5', 4800);
    },
    async oldWay(X) {
      const hip = 80763, aa = X.hip(hip);        // Antares, when it is up
      if (aa.alt > 5) { X.D.slew(aa.az, Math.max(aa.alt, 12), 80, 1.6); X.ov.marker(hip, { color: 'gold', r: 12, pulse: true, text: X.starName(hip), dy: -22 }); }
    },
  },

  // ================================================================== 7.2
  {
    id: 'l7.2',
    keys: ['watch.away', 'watch.moved', 'watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'watch.c6', 'try.wrong', 'try.option', 'tonight.text', 'tonight.nodist'],
    placeholders: ['vegaDist', 'denebDist', 'vegaMag', 'denebMag', 'distRatio', 'boost', 'farName', 'farMag', 'farDist', 'nearName', 'nearMag', 'nearDist', 'label', 'tonightStar', 'tonightMag', 'tonightDist'],
    values: (P, kit) => {
      const { v, d, ratio, boost } = vegaDeneb(kit);
      const out = { vegaDist: lyText(v.ly), denebDist: lyText(d.ly), vegaMag: magText(v.mag), denebMag: magText(d.mag), distRatio: N.fmtThousands(N.roundRatio(ratio)), boost: N.fmtThousands(N.roundRatio(boost)) };
      const s = shared(kit).p72; if (s) Object.assign(out, vals72(kit, s));
      if (P.tonight) {
        const b = N.brightUp(kit.data, P.lat, P.lon, P.ms, { maxMag: 2.0, minAlt: 5, named: false })[0];
        if (b) { const f = starFacts(kit, b.hip); Object.assign(out, { tonightStar: f.name, tonightMag: magText(f.mag), tonightDist: lyText(f.ly) }); }
      }
      return out;
    },
    tonightKey: (P) => { const b = N.brightUp(P.kit.data, P.lat, P.lon, P.ms, { maxMag: 2.0, minAlt: 5, named: false })[0]; return b && b.ly > 0 ? 'text' : 'nodist'; },
    try: (X) => {
      const p = pair72(X), kit = X.kit; shared(kit).p72 = p;
      const f = starFacts(kit, p.far), n = starFacts(kit, p.near);
      const text = (s) => X.T('try.option', { label: s.name, farMag: magText(s.mag), farDist: lyText(s.ly) });
      const ids = daySeed() % 2 === 1 ? [p.near, p.far] : [p.far, p.near], by = { [p.far]: f, [p.near]: n };
      const c = choice({
        options: (Y) => ids.map((hip) => ({ id: hip, label: hip, text: Y.T('try.option', { label: by[hip].name, farMag: magText(by[hip].mag), farDist: lyText(by[hip].ly) }) })),
        correct: () => p.far,
        async show(Y) { await framePoints(Y, [p.far, p.near]); Y.ov.marker(p.far, { color: 'gold', r: 12, pulse: true, text: f.name, dy: -22 }); await Y.D.wait(2200); },
      });
      c.answer = (Y, id) => (id === p.far ? true : { wrong: true, vars: { name: by[id].name } });
      void text;
      return c;
    },
    async trySetup(X) { const p = shared(X.kit).p72; await X.D.prep(); await framePoints(X, [p.far, p.near]); },
    async watch(X) {
      const { D, ov, S, kit } = X;
      await D.prep();
      const lat0 = S.obs.lat, cu = G.culminationAlt(kit.starOf(HIP.deneb).dec, lat0);
      if (cu < 9) { const c = { lat: 35 * (lat0 < 0 ? -1 : 1), lon: S.obs.lon }; kit.awayName = kit.placeShort(c.lat, c.lon); await D.toSky(0, 20, 90); await X.say('watch.away', 3600); await X.goTo(c.lat, c.lon, 6); }
      const star = (h) => kit.starOf(h), thr = (h) => Math.min(14, G.culminationAlt(star(h).dec, S.obs.lat) - 3);
      const how = await moveToEvening(X, (t) => G.starAltAt(star(HIP.vega), S.obs.lat, S.obs.lon, t) > thr(HIP.vega) && G.starAltAt(star(HIP.deneb), S.obs.lat, S.obs.lon, t) > thr(HIP.deneb), { hour: 21 });
      await D.wait(200);
      await framePoints(X, [HIP.vega, HIP.deneb], { minFov: 50, maxFov: 85 });
      if (how === 'moved') await X.say('watch.moved', 3000);
      ov.marker(HIP.vega, { color: 'blue', r: 11, text: X.starName(HIP.vega), dy: -22 });
      ov.marker(HIP.deneb, { color: 'blue', r: 11, text: X.starName(HIP.deneb), dy: -22 });
      await X.say('watch.c1', 4200);
      ov.text(HIP.vega, X.ui('lyLabel', { a: lyText(starFacts(kit, HIP.vega).ly) }), { color: 'gold', dy: 26, size: 14 });
      ov.text(HIP.deneb, X.ui('lyLabel', { a: lyText(starFacts(kit, HIP.deneb).ly) }), { color: 'gold', dy: 26, size: 14 });
      await X.say('watch.c2', 4600);
      await X.say('watch.c3', 5200);
      // Deneb at Vega's distance: a growing glow on Deneb (an illustration, said so on screen)
      ov.glow(HIP.deneb, 7, clamp(Math.min(window.innerWidth, window.innerHeight) * 0.2, 40, 90), { color: 'gold', ms: 3200, text: X.ui('illustration'), dy: 70, size: 13 });
      await X.say('watch.c4', 6200);
      await X.say('watch.c5', 5200);
      await X.say('watch.c6', 6200);
    },
  },

  // ================================================================== 7.3
  {
    id: 'l7.3',
    keys: ['watch.moved', 'watch.c1', 'watch.c2', 'watch.star', 'watch.andromeda', 'watch.lmc', 'watch.last', 'try.wrong', 'tonight.up', 'tonight.lmc', 'tonight.below'],
    placeholders: ['cutoffYear', 'cutoffLy', 'farStars', 'starName', 'starLy', 'ago', 'when', 'andAgo', 'andWhere', 'andSeasonLine', 'lmcWhere'],
    values: (P, kit) => {
      const cut = nowYear() - CUTOFF_YEAR, out = { cutoffYear: String(CUTOFF_YEAR), cutoffLy: N.fmtThousands(cut), andAgo: kit.ui('millionYearsAgo', { n: 2.5 }) };
      const far = shared(kit).far71; if (far) out.farStars = kit.list(far);
      if (P.tonight) {
        const A = andromeda(kit), aa = upAt(A, P.lat, P.lon, P.ms);
        if (aa.alt > 5) out.andWhere = whereOf(P, aa.az, aa.alt);
        const m = N.eveningMonths(A, P.lat, P.lon, P.ms, 21, 25), w = kit.words('monthsLong');
        out.andSeasonLine = m.from !== null ? kit.ui('andBest', { a: m.from === m.to ? w[m.from] : kit.ui('fromTo', { a: w[m.from], b: w[m.to] }) }) : kit.ui('andNever', { place: P.place });
        const L = lmc(kit), la = upAt(L, P.lat, P.lon, P.ms); if (la.alt > 5) out.lmcWhere = whereOf(P, la.az, la.alt);
      }
      return out;
    },
    tonightKey: (P) => {
      const aa = upAt(andromeda(P.kit), P.lat, P.lon, P.ms);
      if (aa.alt > 5) return 'up';
      if (P.lat < -15 && upAt(lmc(P.kit), P.lat, P.lon, P.ms).alt > 5) return 'lmc';
      return 'below';
    },
    try: (X) => {
      const kit = X.kit, h = homeNow(X), st = X.data.stars, cut = nowYear() - CUTOFF_YEAR;
      const far = N.brightUp(X.data, h.lat, h.lon, h.ms, { maxMag: 2.6, minAlt: 8 }).filter((s) => s.ly > cut * 1.5).slice(0, 3);
      shared(kit).far71 = far.map((s) => kit.starName(s.hip));
      const c = custom((Y) => {
        const sel = Y.S.sel; if (!sel || sel.type !== 'star') return false;
        const ly = N.lyOf(st, sel.index); if (!ly) return false;
        if (N.leftBefore(ly, CUTOFF_YEAR, nowYear())) return true;
        return Y.justShown ? false : { wrong: true, vars: { name: Y.data.starInfo(sel.index).title, starLy: lyText(ly) } };
      }, {
        async show(Y) {
          const t = far[0] || N.brightUp(Y.data, Y.S.obs.lat, Y.S.obs.lon, Y.S.time, { maxMag: 2.6, minAlt: 8 }).find((s) => s.ly > cut);
          if (!t) return;
          const aa = Y.hip(t.hip); Y.D.slew(aa.az, Math.max(aa.alt, 10), 70, 1.4); await Y.D.wait(1600);
          Y.justShown = true; Y.a.select({ type: 'star', index: idx(Y.kit, t.hip) }); await Y.D.wait(500);
        },
      });
      return c;
    },
    async trySetup(X) { await X.D.prep(); await X.D.toSky(X.S.sky.az, Math.max(X.S.sky.alt, 25), 95); },
    async watch(X) {
      const { D, ov, S, kit } = X;
      await D.prep();
      const A = andromeda(kit), end = G.culminationAlt(A.dec, S.obs.lat) > 8 ? A : lmc(kit), isAnd = end === A;   // the Large Magellanic Cloud for the far south
      const upCands = (ms) => N.brightUp(X.data, S.obs.lat, S.obs.lon, ms, { maxMag: 1.9, minAlt: 8 }).filter((s) => s.ly > 0);
      const good = (ms) => { const l = N.distanceLadder(upCands(ms), 4, 2.2); return l.length >= 3 && l[l.length - 1].ly >= 300; };
      const thr = Math.min(12, G.culminationAlt(end.dec, S.obs.lat) - 3);
      const how = await moveToEvening(X, (t) => G.starAltAt(end, S.obs.lat, S.obs.lon, t) >= thr && good(t), { hour: 21 });
      const ladder = N.distanceLadder(upCands(S.time), 4, 2.2);
      await D.toSky(S.sky.az, 35, 90);
      if (how === 'moved') await X.say('watch.moved', 3000);
      await X.say('watch.c1', 4200);
      await X.say('watch.c2', 4200);
      for (const s of ladder) {
        const aa = X.hip(s.hip); D.slew(aa.az, clamp(aa.alt, 15, 60), 70, 1.5);
        D.select(s.hip);
        const m = ov.marker(s.hip, { color: 'gold', r: 12, pulse: true, text: X.starName(s.hip), dy: -22 });
        const w = lightWords(kit, s.ly);
        await X.say('watch.star', 6200, { starName: X.starName(s.hip), starLy: lyText(s.ly), ago: w.ago, when: w.when });
        m.remove();
      }
      X.a.select(null);
      const aa = ov.altAz(end);
      D.slew(aa.az, clamp(aa.alt, 12, 55), 75, 2);
      ov.marker(end, { color: 'gold', r: 18, pulse: true, text: isAnd ? 'Andromeda Galaxy' : 'Large Magellanic Cloud', dy: -30, size: 14, horizon: true });
      await D.wait(1600);
      await X.say(isAnd ? 'watch.andromeda' : 'watch.lmc', 7000);
      await X.say('watch.last', 5200);
    },
  },

  // ================================================================== 7.4
  {
    id: 'l7.4',
    keys: ['watch.away', 'watch.moved', 'watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'watch.c6', 'tonight.text', 'tonight.low'],
    placeholders: ['gcWhere', 'mwFrom', 'mwTo', 'mwMax', 'mwWhere'],
    values: (P, kit) => {
      const aa = G.starAltAzAt(GC, P.lat, P.lon, P.ms), out = { gcWhere: whereOf(P, aa.az, aa.alt) };
      if (P.tonight) {
        const m = N.eveningMonths(GC, P.lat, P.lon, P.ms, 22, 20), w = kit.words('monthsLong');
        out.mwMax = String(Math.round(m.maxAlt));
        if (m.from !== null) {
          out.mwFrom = w[m.from]; out.mwTo = w[m.to];
          const mid = G.localMs(G.dayKeyOf(Date.UTC(new Date(P.ms).getUTCFullYear(), (m.from + Math.floor(((m.to - m.from + 12) % 12) / 2)) % 12, 15), P.lon), P.lon, 22);
          const at = G.starAltAzAt(GC, P.lat, P.lon, mid); out.mwWhere = whereOf(P, at.az, at.alt);
        }
      }
      return out;
    },
    tonightKey: (P) => { const m = N.eveningMonths(GC, P.lat, P.lon, P.ms, 22, 20); return m.from === null || m.maxAlt < 12 ? 'low' : 'text'; },
    try: custom((X) => {
      const aa = X.hip ? G.starAltAzAt(GC, X.S.obs.lat, X.S.obs.lon, X.S.time + (X.S.tm === 'year' ? X.S.yd * 864e5 : 0)) : null;
      if (!aa || aa.alt < -2 || X.S.mode !== 'sky') return false;
      const d = X.ov.angleBetween({ az: X.S.sky.az, alt: X.S.sky.alt }, GC);
      return d !== null && d <= 10;
    }, {
      async show(X) { const aa = G.starAltAzAt(GC, X.S.obs.lat, X.S.obs.lon, X.S.time); X.D.slew(aa.az, clamp(aa.alt, 8, 50), 90, 1.6); await X.D.wait(1900); },
    }),
    /** Dark site, band on, an evening when the centre is up (travelling to 35 degrees of latitude if this place can never show it). Returns true if the clock moved. */
    async stage(X) {
      const { D, S, kit } = X;
      await D.prep(); D.layer('mw', true);
      await D.tweenQ(3, 700);
      if (G.culminationAlt(GC.dec, S.obs.lat) < 9) { const c = { lat: 35, lon: S.obs.lon }; kit.awayName = kit.placeShort(c.lat, c.lon); await D.toSky(S.sky.az, 25, 90); await X.say('watch.away', 3600); await X.goTo(c.lat, c.lon, 6); }
      const how = await moveToEvening(X, (t) => gcOk(S.obs.lat, S.obs.lon, t), { hour: 22 });
      return how === 'moved';
    },
    hideLabels: ['Galactic Centre'],
    async trySetup(X) {
      await X.lesson.stage(X);
      const aa = G.starAltAzAt(GC, X.S.obs.lat, X.S.obs.lon, X.S.time);
      await X.D.toSky(aa.az + 130, 32, 90);
    },
    async watch(X) {
      const { D, ov, S } = X;
      const moved = await X.lesson.stage(X);
      const at = (l, b = 0) => N.galacticToEq(l, b);
      await D.toSky(X.G.starAltAzAt(at(75), S.obs.lat, S.obs.lon, S.time).az, 40, 100);
      if (moved) await X.say('watch.moved', 3200);
      await X.say('watch.c1', 4600);
      const L = [110, 70, 30, 0, 330, 290];
      for (let k = 0; k + 1 < L.length; k++) ov.segment(at(L[k]), at(L[k + 1]), { color: 'blue', dash: [7, 6], width: 2, grow: 2600, halo: true });
      await X.say('watch.c2', 5200);
      // along the band to the centre
      const pts = [70, 40, 15, 0].map((l) => ({ l, aa: G.starAltAzAt(at(l), S.obs.lat, S.obs.lon, S.time) })).filter((p) => p.aa.alt > 3);
      for (const p of pts) { D.slew(p.aa.az, clamp(p.aa.alt + 6, 14, 55), 100, 1.5); await D.wait(1300); }
      const gc = G.starAltAzAt(GC, S.obs.lat, S.obs.lon, S.time);
      D.slew(gc.az, clamp(gc.alt + 8, 14, 50), 100, 1.4);
      ov.marker(GC, { color: 'gold', r: 16, pulse: true, text: X.ui('galacticCentre'), dy: -28, size: 14 });
      await X.say('watch.c3', 6200);
      ov.text(at(35), X.ui('greatRift'), { color: 'white', size: 14 });
      await X.say('watch.c4', 6200);
      const cs = G.starAltAzAt(N.COALSACK, S.obs.lat, S.obs.lon, S.time);
      if (cs.alt > 4) {
        D.slew(cs.az, clamp(cs.alt + 8, 14, 50), 90, 1.8);
        ov.marker(N.COALSACK, { color: 'white', r: 14, text: X.ui('coalsack'), dy: -24, size: 14 });
        await X.say('watch.c5', 5800);
      }
      await X.say('watch.c6', 5400);
    },
    async oldWay(X) {
      // the Emu's head is the Coalsack: show it when it is up
      const { D, S } = X; D.layer('mw', true);
      const cs = G.starAltAzAt(N.COALSACK, S.obs.lat, S.obs.lon, S.time);
      if (cs.alt > 4) { D.slew(cs.az, clamp(cs.alt + 8, 14, 50), 90, 1.6); X.ov.marker(N.COALSACK, { color: 'gold', r: 14, pulse: true, text: X.ui('emuHead'), dy: -24, size: 14 }); }
    },
  },
];
