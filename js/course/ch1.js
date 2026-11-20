// Chapter 1: Finding your way. Lesson LOGIC only: every sentence the learner reads lives in content/<lang>/course.md under the same ids.
// See js/course/README.md for how a lesson is put together.
import { HIP, fistsToPole } from './geo.js';
import { facing, selected, choice, sequence } from './checks.js';

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const poleAz = (lat) => (lat >= 0 ? 0 : 180);

export default [
  // ================================================================== 1.1
  {
    id: 'l1.1',
    keys: ['watch.c1', 'watch.n', 'watch.e', 'watch.s', 'watch.w', 'watch.zenith', 'watch.last', 'tonight.text'],
    placeholders: [],
    try: facing({ az: 0, tol: 22, altMin: -10, altMax: 38, showAlt: 10 }),
    async watch(X) {
      const { D, ov } = X;
      await D.prep();
      await D.toSky(0, 9, 100);
      await X.say('watch.c1', 3600);
      const dirs = [['n', 0], ['e', 90], ['s', 180], ['w', 270]];
      for (const [k, az] of dirs) {
        D.slew(az, 9, 100, 2);
        const m = ov.marker({ az, alt: 1.5 }, { color: 'gold', r: 11, pulse: true, text: X.ui('dir.' + k), size: 15, dy: -24 });
        await X.say('watch.' + k, 2800);
        m.remove();
      }
      D.slew(X.S.sky.az, 78, 85, 2.4);
      ov.marker('zenith', { color: 'gold', r: 12, pulse: true, text: X.ui('zenith'), dy: -24 });
      await X.say('watch.zenith', 3600);
      const az = X.S.sky.az;
      ov.altArc(az, 0, 89, { color: 'blue', width: 2.4, grow: 1800 });
      ov.text({ az, alt: 45 }, X.ui('height'), { color: 'blue', dx: 26, align: 'left' });
      await X.say('watch.last', 4200);
    },
  },

  // ================================================================== 1.2
  {
    id: 'l1.2',
    keys: ['watch.c1', 'watch.c1b', 'watch.c2', 'watch.c3', 'watch.flat', 'try.wrong', 'try.option', 'try.optionOne', 'tonight.north', 'tonight.south'],
    placeholders: ['label'],
    tonightKey: (P) => (P.north ? 'north' : 'south'),
    /** The pole label would read out the pole's height, which is the answer. */
    async trySetup(X) { X.noPoleLabel(); await X.D.prep(); await X.D.toSky(X.S.sky.az, X.S.sky.alt, X.S.sky.fov); },
    try: choice({
      options: (X) => {
        const n = fistsToPole(X.S.obs.lat), set = new Set([n - 1, n, n + 1, n + 2]);
        const list = [...set].filter((v) => v >= 0 && v <= 9).sort((p, q) => p - q);
        while (list.length > 3) list.splice(list[0] === n ? list.length - 1 : 0, 1);
        return list.map((v) => ({ id: v, label: v, text: X.T(v === 1 ? 'try.optionOne' : 'try.option', { label: v }) }));
      },
      correct: (X) => fistsToPole(X.S.obs.lat),
      async show(X) { await X.lesson.rulerScene(X, true); },
    }),
    /** Face the pole with room for the whole ruler. */
    frame(X) { const abs = Math.abs(X.S.obs.lat); return X.D.toSky(poleAz(X.S.obs.lat), clamp(abs / 2 - 2, 8, 42), abs > 60 ? 110 : 95); },
    async rulerScene(X, quick) {
      const { D, ov } = X, lat = X.S.obs.lat, abs = Math.abs(lat), az = poleAz(lat);
      await X.lesson.frame(X);
      if (abs < 3) { ov.marker('pole', { color: 'blue', text: X.ui('poleLabel') }); return false; }
      X.noPoleLabel();
      ov.fists(az, abs, { grow: quick ? 1800 : 3600 });
      await D.wait(quick ? 2000 : 3800);
      ov.marker('pole', { color: 'blue', r: 13, text: X.ui('poleLabel'), dy: -24 });
      return true;
    },
    async watch(X) {
      const { D } = X;
      await D.prep();
      await X.lesson.frame(X);
      await X.say('watch.c1', 4200);
      await X.say('watch.c1b', 3600);
      X.D.say(X.T('watch.c2'), 0);
      const ok = await X.lesson.rulerScene(X, false);
      await X.say(ok ? 'watch.c3' : 'watch.flat', 5200);
    },
  },

  // ================================================================== 1.3
  {
    id: 'l1.3',
    keys: ['watch.away', 'watch.moved', 'watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'try.wrong', 'tonight.visible', 'tonight.below', 'tonight.hidden'],
    placeholders: ['dipperWhere'],
    values: (P) => {
      const d = P.star(HIP.dubhe);
      return { dipperWhere: d.alt > 4 ? P.where(d.az, d.alt) : '' };
    },
    tonightKey: (P) => (P.lat < 12 ? 'hidden' : P.star(HIP.dubhe).alt > 4 ? 'visible' : 'below'),
    try: (() => {
      const c = selected(HIP.polaris), base = c.show;
      c.show = async (X) => { X.ov.segment(HIP.merak, HIP.dubhe, { extend: 5, color: 'gold', grow: 1600 }); await X.D.wait(1800); await base(X); };
      return c;
    })(),
    hideLabels: [11767],
    async trySetup(X) { await X.lesson.stage(X, false); },
    /** Put the Dipper and Polaris on screen at a good hour (travelling north first if this sky cannot show Polaris). */
    async stage(X, announce) {
      const { D, S } = X;
      await D.prep();
      if (S.obs.lat < 12) {
        const c = X.pickAway('north'); X.kit.awayName = X.kit.placeShort(c.lat, c.lon);
        await D.toSky(0, 20, 90);
        if (announce) await X.say('watch.away', 3800);
        await X.goTo(c.lat, c.lon, 6);
      }
      const how = X.findTime((t) => X.altAt(HIP.dubhe, t).alt > 28 && X.altAt(HIP.merak, t).alt > 24, 24);
      X.state.moved = how === 'moved';
      X.a.updateCelestial(true);
      D.highlight('UMa');
      const aD = X.hip(HIP.dubhe), aP = X.hip(HIP.polaris);
      await D.toSky(D.midAz(aD.az, aP.az), clamp((aD.alt + aP.alt) / 2 - 8, 14, 50), 95);
    },
    async watch(X) {
      const { D, ov } = X;
      await X.lesson.stage(X, true);
      if (X.state.moved) await X.say('watch.moved', 2600);
      ov.marker(HIP.merak, { color: 'blue', r: 10, text: X.starName(HIP.merak), dx: -22, dy: 22 });
      ov.marker(HIP.dubhe, { color: 'blue', r: 10, text: X.starName(HIP.dubhe), dx: 16, dy: -22 });
      await X.say('watch.c1', 4200);
      await X.say('watch.c2', 600);
      ov.segment(HIP.merak, HIP.dubhe, { color: 'gold', grow: 900 });
      await D.wait(2200);
      await X.say('watch.c3', 600);
      ov.segment(HIP.merak, HIP.dubhe, { extend: 5, color: 'gold', grow: 2600, tip: false });
      await D.wait(3600);
      ov.marker(HIP.polaris, { color: 'gold', r: 13, pulse: true, text: X.starName(HIP.polaris), dy: -22, size: 14 });
      await X.say('watch.c4', 5400);
      const aP = X.hip(HIP.polaris);
      ov.segment(HIP.polaris, { az: aP.az, alt: 0 }, { color: 'gold', grow: 1800, tip: true });
      ov.text({ az: aP.az, alt: 0 }, X.ui('dir.' + (X.S.obs.lat >= 0 ? 'n' : 's')), { color: 'gold', size: 16, dy: 18 });
      await X.say('watch.c5', 4800);
    },
  },

  // ================================================================== 1.4
  {
    id: 'l1.4',
    keys: ['watch.away', 'watch.moved', 'watch.c1', 'watch.c2', 'watch.c3', 'watch.c4', 'watch.c5', 'try.prompt2', 'try.hint2', 'try.wrong', 'tonight.visible', 'tonight.below', 'tonight.never'],
    placeholders: ['crossWhere'],
    values: (P) => {
      const c = P.star(HIP.acrux);
      return { crossWhere: c.alt > 4 ? P.where(c.az, c.alt) : '' };
    },
    tonightKey: (P) => {
      const maxAlt = 90 - Math.abs(P.lat - P.dec(HIP.acrux));
      if (maxAlt < 3) return 'never';
      return P.star(HIP.acrux).alt > 4 ? 'visible' : 'below';
    },
    try: (X) => sequence([
      selected(HIP.acrux),
      facing({ az: 180, tol: 24, altMin: Math.max(-5, Math.abs(X.S.obs.lat) - 22), altMax: Math.abs(X.S.obs.lat) + 22, showAlt: Math.abs(X.S.obs.lat), fov: 90 }),
    ]),
    hideLabels: [60718],
    async trySetup(X) { X.noPoleLabel(); await X.lesson.stage(X, false); X.a.select(null); },
    async stage(X, announce) {
      const { D, S } = X;
      await D.prep();
      if (S.obs.lat > 18) {
        const c = X.pickAway('south'); X.kit.awayName = X.kit.placeShort(c.lat, c.lon);
        await D.toSky(180, 20, 90);
        if (announce) await X.say('watch.away', 3800);
        await X.goTo(c.lat, c.lon, 6);
      }
      const how = X.findTime((t) => X.altAt(HIP.gacrux, t).alt > 22 && X.altAt(HIP.acrux, t).alt > 14, 24);
      X.state.moved = how === 'moved';
      X.a.updateCelestial(true);
      D.highlight('Cru');
      const g = X.hip(HIP.gacrux), pAlt = Math.abs(X.S.obs.lat);
      await D.toSky(D.midAz(g.az, 180), clamp((g.alt + pAlt) / 2 - 6, 14, 50), 100);
    },
    async watch(X) {
      const { D, ov } = X;
      await X.lesson.stage(X, true);
      if (X.state.moved) await X.say('watch.moved', 2600);
      ov.marker(HIP.gacrux, { color: 'blue', r: 10, text: X.starName(HIP.gacrux), dy: -20 });
      ov.marker(HIP.acrux, { color: 'blue', r: 10, text: X.starName(HIP.acrux), dy: 22 });
      await X.say('watch.c1', 3600);
      ov.segment(HIP.gacrux, HIP.acrux, { color: 'blue', width: 2.4, grow: 1400 });
      await X.say('watch.c2', 3800);
      ov.segment(HIP.gacrux, HIP.acrux, { extend: 4.5, color: 'gold', grow: 2600 });
      await D.wait(2900);
      ov.marker('spole', { color: 'gold', r: 13, pulse: true, text: X.ui('poleLabelS'), dy: -24, size: 14 });
      await X.say('watch.c3', 4200);
      const cr = X.hip(HIP.acrux), ce = X.hip(HIP.alphaCen), g0 = X.hip(HIP.gacrux);
      D.slew(D.midAz(cr.az, ce.az), clamp((cr.alt + ce.alt) / 2 - 2, 12, 70), 62, 2);
      ov.marker(HIP.alphaCen, { color: 'blue', r: 10, text: X.starName(HIP.alphaCen), dx: 18, dy: -20 });
      ov.marker(HIP.betaCen, { color: 'blue', r: 10, text: X.starName(HIP.betaCen), dx: -10, dy: -22 });
      ov.segment(HIP.betaCen, HIP.alphaCen, { color: 'blue', width: 2, dash: [6, 5], grow: 1000 });
      await X.say('watch.c4', 5800);
      D.slew(D.midAz(g0.az, 180), clamp((g0.alt + Math.abs(X.S.obs.lat)) / 2 - 6, 14, 50), 100, 1.8);
      await D.wait(1900);
      ov.segment('spole', { az: 180, alt: 0 }, { color: 'gold', grow: 1800, tip: true });
      ov.text({ az: 180, alt: 0 }, X.ui('dir.s'), { color: 'gold', size: 16, dy: 18 });
      await X.say('watch.c5', 4600);
    },
  },
];

