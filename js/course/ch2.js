// Chapter 2: The turning sky. Lesson LOGIC only: every sentence lives in content/<lang>/course.md under the same ids.
import { HIP, clockHour } from './geo.js';
import { facing, selected, timeAdvanced, choice, custom } from './checks.js';
import { classifyVisibility } from '../astro.js';

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const poleAz = (lat) => (lat >= 0 ? 0 : 180);
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
// bright stars near the celestial equator rise due east and climb at about 15 degrees an hour (2.1)
const RISERS = [26311, 25930, 49669, 37279, 65474, 97649, 24436, 27989, 25336, 21421, 32349, 69673, 80763];
// the "hand" of the star clock: the Big Dipper's pointers around the north pole, the top of the Southern Cross around the south pole (2.4)
const handHip = (lat) => (lat >= 0 ? HIP.dubhe : HIP.gacrux);

/** A bright star rising in the east: moves the clock to a moment when one is low in the east. */
function pickRiser(X) {
  const { S } = X;
  const east = (t, h) => { const aa = X.altAt(h, t); return aa.az > 45 && aa.az < 135 && aa.alt > 5 && aa.alt < 20; };
  for (let k = 0; k <= 72; k++) {
    const t = S.time + k * 20 * 60e3, h = RISERS.find((x) => east(t, x));
    if (h) { if (k > 0) { S.time = t; S.anchor = t; X.a.updateCelestial(true); } return h; }
  }
  return 32349;
}

/** The three or four stars offered in 2.3: one that never sets from here (where one exists) and others that rise and set. */
function circumpolarOptions(X) {
  const lat = X.S.obs.lat, st = X.data.stars, rs = [], circ = [];
  for (const i of X.data.named) {
    if (st.mag[i] > 3.1) continue;
    const dec = st.dec[i], k = classifyVisibility(dec, lat).kind, fromPole = 90 - Math.abs(dec);
    if (fromPole < 6) continue;                                   // the pole star itself is too easy
    if (k === 'circumpolar') circ.push(i); else if (k === 'risesSets') rs.push(i);
  }
  const h = Math.abs(Math.round(lat * 10)), pick = (arr, n) => { const out = []; for (let j = 0; j < arr.length && out.length < n; j++) out.push(arr[(h + j * 2) % Math.min(arr.length, 6)]); return [...new Set(out)]; };
  let chosen, correct;
  if (circ.length) { chosen = [circ[h % Math.min(circ.length, 3)], ...pick(rs, 2)]; correct = st.hip[chosen[0]]; }
  else { chosen = pick(rs, 3); correct = 'none'; }
  const opts = chosen.slice(0, 3).map((i) => ({ id: st.hip[i], label: X.starName(st.hip[i]), text: X.starName(st.hip[i]) }));
  if (correct === 'none') opts.push({ id: 'none', label: '', text: X.T('try.none') });
  // deterministic shuffle so the right answer is not always first
  const order = opts.map((o, i) => [((h + 3) * (i + 7) * 2654435761) % 1000, o]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
  return { options: order, correct };
}

export default [
  // ================================================================== 2.1
  {
    id: 'l2.1',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'tonight.text'],
    placeholders: [],
    try: timeAdvanced({ hours: 2, tol: 0.12 }),
    async stage(X) {
      await X.D.prep();
      X.state.star = pickRiser(X);
      const aa = X.hip(X.state.star);
      await X.D.toSky(aa.az, 30, 95);
    },
    async trySetup(X) {
      const { ov, S } = X;
      await X.lesson.stage(X);
      const t0 = S.time, s = X.state.star;
      ov.marker(s, { color: 'gold', r: 13, pulse: true, text: () => `${Math.round(((S.time - t0) / 3600e3) * 15)}°`, dy: -22, size: 14 });
      ov.trail(s, { since: t0, color: 'gold', tickHours: 1, tickLabel: (k) => X.ui('hourTick', { n: k }), width: 2.4, maxHours: 14 });
    },
    async watch(X) {
      const { ov, S } = X;
      await X.lesson.stage(X);
      await X.say('watch.c1', 3400);
      const t0 = S.time, s = X.state.star;
      ov.marker(s, { color: 'gold', r: 13, pulse: true, text: () => `${Math.round(((S.time - t0) / 3600e3) * 15)}°`, dy: -22, size: 14 });
      ov.trail(s, { since: t0, color: 'gold', tickHours: 1, tickLabel: (k) => X.ui('hourTick', { n: k }), width: 2.4, maxHours: 14 });
      await X.lapse(3600, 5400, { follow: s, lines: ['watch.c2', 'watch.c3'] });
      await X.say('watch.c4', 5200);
    },
  },

  // ================================================================== 2.2
  {
    id: 'l2.2',
    keys: ['watch.c1', 'watch.flat', 'watch.c2', 'watch.turnN', 'watch.turnS', 'watch.c4', 'try.promptS', 'try.hintS', 'try.successS', 'tonight.north', 'tonight.south'],
    placeholders: [],
    tonightKey: (P) => (P.north ? 'north' : 'south'),
    try: (X) => {
      const lat = X.S.obs.lat;
      if (lat >= 10) return selected(HIP.polaris);
      const a = Math.abs(lat), c = facing({ az: poleAz(lat), tol: 24, altMin: a - 18, altMax: a + 18, showAlt: a, fov: 90 });
      c.keys = () => ({ prompt: 'try.promptS', hint: 'try.hintS', success: 'try.successS' });
      return c;
    },
    hideLabels: [11767],
    async trySetup(X) {
      const lat = X.S.obs.lat, a = Math.abs(lat);
      X.noPoleLabel();                                       // the pole label marks the answer
      await X.D.prep();
      await X.D.toSky(lat >= 10 ? 0 : poleAz(lat), clamp(a + 10, 25, 60), 90);
    },
    async watch(X) {
      const { D, ov, S } = X, lat = S.obs.lat, a = Math.abs(lat), north = lat >= 0;
      await D.prep();
      await D.toSky(poleAz(lat), clamp(a + 6, 22, 62), 105);
      await X.say(a < 3 ? 'watch.flat' : 'watch.c1', 3800);
      X.noPoleLabel();
      ov.marker('pole', { color: 'gold', r: 13, pulse: true, text: X.ui(north ? 'poleLabelN' : 'poleLabelS'), dy: -24, size: 13 });
      for (const r of [10, 20, 30, 40]) ov.circle('pole', r, { color: 'blue', width: 1.2, alpha: 0.5, dash: [3, 6], grow: 1400 });
      const t0 = S.time;
      for (const h of X.starsNear('pole', 62, 4.3, 70)) ov.trail(h, { since: t0, color: 'white', alpha: 0.85, width: 1.5, maxHours: 12 });
      await X.lapse(3600, 7600, { lines: ['watch.c2', north ? 'watch.turnN' : 'watch.turnS'] });
      await X.say('watch.c4', 4800);
    },
  },

  // ================================================================== 2.3
  {
    id: 'l2.3',
    keys: ['watch.flat', 'watch.c1', 'watch.c2', 'watch.circleLabel', 'watch.c3', 'watch.c4', 'try.wrong', 'try.none', 'tonight.text', 'tonight.none'],
    placeholders: ['circumpolarNames'],
    values: (P, kit) => {
      const n = P.alwaysCons(2);
      return { circumpolarNames: n.length === 2 ? kit.ui('listAnd', { a: n[0], b: n[1] }) : n.join('') };
    },
    tonightKey: (P) => (P.alwaysCons(1).length ? 'text' : 'none'),
    try: choice({ options: (X) => circumpolarOptions(X).options, correct: (X) => circumpolarOptions(X).correct, async show(X) { await X.D.wait(300); } }),
    async trySetup(X) {
      await X.D.prep();
      const lat = X.S.obs.lat, a = Math.abs(lat);
      await X.D.toSky(poleAz(lat), clamp(a * 0.55, 10, 36), 108);
      if (a > 3) X.ov.circle('pole', a, { color: 'blue', width: 1.6, alpha: 0.65, dash: [6, 6], grow: 0 });
    },
    async watch(X) {
      const { D, ov, S } = X, lat = S.obs.lat, a = Math.abs(lat), north = lat >= 0;
      await D.prep();
      if (a < 3) { await D.toSky(0, 8, 95); await X.say('watch.flat', 6000); return; }
      const st = X.data.stars;
      let inside = null, outside = null, best = 999;
      for (const i of X.data.named) {
        if (st.mag[i] > 2.8) continue;
        const d = st.dec[i], k = classifyVisibility(d, lat).kind, fromPole = 90 - (north ? d : -d);
        if (!inside && k === 'circumpolar' && fromPole > 8) inside = st.hip[i];
        if (k === 'risesSets' && fromPole > a + 6 && fromPole < best) { best = fromPole; outside = st.hip[i]; }   // the nearest bright star outside the circle: it grazes the horizon
      }
      if (outside) X.findTime((t) => { const p = X.altAt(outside, t); return p.alt > 8 && p.alt < 42 && p.az > 180 && X.altAt(outside, t + 6 * 3600e3).alt < -3; }, 24);
      X.a.updateCelestial(true);
      await D.toSky(poleAz(lat), clamp(a * 0.55, 10, 36), 108);
      await X.say('watch.c1', 3800);
      ov.circle('pole', a, { color: 'gold', width: 2.6, grow: 2400, text: X.T('watch.circleLabel'), textPhi: Math.PI });
      await X.say('watch.c2', 4400);
      const t0 = S.time;
      if (inside) { ov.marker(inside, { color: 'blue', text: X.starName(inside), dy: -20 }); ov.trail(inside, { since: t0, color: 'blue', width: 2.4, maxHours: 14 }); }
      if (outside) { ov.marker(outside, { color: 'white', text: X.starName(outside), dy: -20 }); ov.trail(outside, { since: t0, color: 'white', width: 2.4, maxHours: 14 }); }
      await X.lapse(3600, 8400, { lines: inside ? ['watch.c3', 'watch.c4'] : ['watch.c4'] });
    },
  },

  // ================================================================== 2.4
  {
    id: 'l2.4',
    keys: ['watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'tonight.text'],
    placeholders: ['handStar', 'handTurn', 'handClock'],
    values: (P, kit) => ({
      handStar: kit.ui(P.north ? 'handStarN' : 'handStarS'), handTurn: kit.ui(P.north ? 'turnCcw' : 'turnCw'), handClock: clockHour(P.clockOf(handHip(P.lat))),
    }),
    try: custom((X) => angDiff(X.handAngle(handHip(X.S.obs.lat)), 0) <= 10, {
      controls: 'scrub',
      async show(X) {
        const { S, data, G } = X, h = handHip(S.obs.lat), i = data.hipIndex.get(h), st = { ra: data.stars.ra[i], dec: data.stars.dec[i] };
        let best = 0, bd = 999;
        for (let m = -720; m <= 720; m += 5) { const d = angDiff(G.starClockAngle(st, S.obs.lat, S.obs.lon, X.tryT0 + m * 60e3), 0); if (d < bd) { bd = d; best = m; } }
        await X.tweenTime(X.tryT0 + best * 60e3, 2600);
      },
    }),
    async stage(X) {
      const { D, S } = X, lat = S.obs.lat, a = Math.abs(lat), h = handHip(lat);
      await D.prep();
      X.findTime((t) => X.altAt(h, t).alt > 20, 24);
      X.a.updateCelestial(true);
      await D.toSky(poleAz(lat), clamp(a + 8, 24, 62), 105);
    },
    dial(X) {
      X.noPoleLabel();
      const lat = X.S.obs.lat, h = handHip(lat), r = X.ov.angleBetween('pole', h);
      X.ov.dial('pole', r, { color: 'blue', dir: lat >= 0 ? 'ccw' : 'cw', labels: [0, 6, 12, 18].map((n) => X.ui('hourTick', { n })), grow: 1400 });
      X.ov.segment('pole', h, { color: 'gold', width: 3.4, dots: true, grow: 1200 });
    },
    async trySetup(X) { await X.lesson.stage(X); X.lesson.dial(X); },
    async watch(X) {
      const { D, S } = X;
      await X.lesson.stage(X);
      await X.say('watch.c1', 3800);
      X.lesson.dial(X);
      await D.wait(1700);
      const t0 = S.time;
      await X.lapse(3600, 6400, { lines: ['watch.c2', 'watch.c3'] });
      S.time = t0; S.anchor = t0; X.a.updateCelestial(true);
      await D.wait(500);
      X.D.say(X.T('watch.c4'), 0);
      await X.sweepDays(30, 3200);
      await D.wait(4200);
    },
  },
];
