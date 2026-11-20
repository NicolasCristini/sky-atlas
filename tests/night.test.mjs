// Node tests for the maths behind chapters 7 and 8 (js/course/nightsky.js). Run: node tests/night.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as A from '../js/astro.js';
import * as G from '../js/course/geo.js';
import * as N from '../js/course/nightsky.js';

const require = createRequire(import.meta.url);
let Ast = null;
try { Ast = require('../vendor/astronomy.browser.min.js'); } catch (e) { console.log('SKIP astronomy-engine tests:', e.message); }
let n = 0, bad = 0;
const ok = (name, fn) => { try { fn(); n++; console.log('ok   ' + name); } catch (e) { bad++; console.log('FAIL ' + name + '\n     ' + e.message); } };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);

const cat = JSON.parse(fs.readFileSync(new URL('../data/stars.6.json', import.meta.url)));
const extra = JSON.parse(fs.readFileSync(new URL('../data/starextra.json', import.meta.url)));
const eIdx = new Map(extra.hip.map((h, k) => [h, k]));
const star = (hip) => { const f = cat.features.find((x) => x.id === hip), k = eIdx.get(hip); return { hip, bv: parseFloat(f.properties.bv), spect: extra.spect[k], ly: extra.ly[k], mag: f.properties.mag }; };
const T = (hip) => { const s = star(hip); return N.starTempK(s.bv, s.spect); };

ok('star temperatures: Rigel about 12,000 K, Betelgeuse about 3,500 K, Vega about 9,600 K, Arcturus about 4,300 K, Spica above 20,000 K', () => {
  near(N.roundTemp(T(24436)), 12000, 1000, 'Rigel'); near(T(27989), 3500, 350, 'Betelgeuse'); near(T(91262), 9600, 700, 'Vega'); near(T(69673), 4300, 400, 'Arcturus');
  assert.ok(T(65474) > 20000, 'Spica ' + T(65474)); near(T(80763), 3400, 400, 'Antares');
});
ok('every colour pair of lesson 7.1 has the blue star hotter by at least 1.5x', () => {
  for (const [h, c] of [[24436, 27989], [65474, 80763], [91262, 69673], [32349, 21421]]) assert.ok(T(h) >= 1.5 * T(c), `${h} vs ${c}: ${T(h)} ${T(c)}`);
});
ok('spectral parsing: B8Ia, A0Vvar, M2Ib, K1.5III, junk', () => {
  assert.equal(N.spectralIndex('B8Ia'), 18); assert.equal(N.spectralIndex('A0Vvar'), 20); assert.equal(N.spectralIndex('M2Ib'), 62); assert.equal(N.spectralIndex('K1.5III'), 51.5); assert.equal(N.spectralIndex(''), null);
});
ok('colour words: Rigel blue-white, Vega white, Sun yellow, Arcturus orange, Aldebaran red-orange, Antares red', () => {
  for (const [hip, w] of [[24436, 'blue-white'], [91262, 'white'], [69673, 'orange'], [21421, 'red-orange'], [80763, 'red']]) assert.equal(N.colourWord(star(hip).bv), w, String(hip) + ' bv ' + star(hip).bv);
  assert.equal(N.colourWord(0.65), 'yellow');
});
ok('roundTemp steps', () => { assert.equal(N.roundTemp(3334), 3300); assert.equal(N.roundTemp(9712), 9500); assert.equal(N.roundTemp(12449), 12000); });

ok('light travel: years rounded as sure as the distance is', () => {
  let t = N.lightTravel(8.6, 2026); assert.deepEqual(t, { kind: 'years', n: 8.6, year: 2017 });
  t = N.lightTravel(43, 2026); assert.deepEqual([t.kind, t.n, t.year], ['years', 43, 1983]);
  t = N.lightTravel(550, 2026); assert.deepEqual([t.kind, t.n, t.year], ['years', 550, 1500]);
  t = N.lightTravel(2000, 2026); assert.deepEqual([t.kind, t.n, t.year], ['long', 2000, null]);
  t = N.lightTravel(2.5e6, 2026); assert.deepEqual([t.kind, t.n], ['million', 2.5]);
});
ok('Sirius light left before 1900? no. Betelgeuse, Rigel, Deneb? yes (cutoff 126 ly)', () => {
  assert.ok(!N.leftBefore(8.6, 1900, 2026)); assert.ok(!N.leftBefore(125, 1900, 2026)); assert.ok(N.leftBefore(127, 1900, 2026));
  assert.ok(N.leftBefore(550, 1900, 2026) && N.leftBefore(860, 1900, 2026) && N.leftBefore(2000, 1900, 2026));
});
ok('distance ladder: increasing, each at least 2.2x the last', () => {
  const l = N.distanceLadder([{ ly: 8.6 }, { ly: 11 }, { ly: 25 }, { ly: 37 }, { ly: 43 }, { ly: 250 }, { ly: 550 }, { ly: 860 }, { ly: 2000 }], 4, 2.2);
  assert.ok(l.length >= 3 && l.length <= 4); for (let i = 1; i < l.length; i++) assert.ok(l[i].ly >= 2.2 * l[i - 1].ly);
  assert.equal(l[0].ly, 8.6);
});
ok('inverse-square: Deneb at Vega distance is about 6,400 times brighter (about 9.5 magnitudes); rounded 6,000', () => {
  const b = N.brightnessBoost(2000, 25); near(b, 6400, 1); near(N.magGain(b), 9.51, 0.02); assert.equal(N.roundRatio(b), 6000); assert.equal(N.roundRatio(80), 80); assert.equal(N.roundRatio(104), 100); assert.equal(N.roundRatio(10816), 10000); assert.equal(N.roundRatio(4.2), 4);
});
ok('Deneb is set to 2,000 ly whatever the tables say; Vega is 25', () => {
  const st = { hip: new Int32Array([102098, 91262]), ly: new Float32Array([1412, 25]) };
  assert.equal(N.lyOf(st, 0), 2000); near(N.lyOf(st, 1), 25, 0.1);
});

ok('galactic centre is RA 266.4, Dec -28.94; Coalsack near RA 192, Dec -63', () => {
  near(N.GALACTIC_CENTRE.ra, 266.40, 0.1); near(N.GALACTIC_CENTRE.dec, -28.94, 0.05); near(N.COALSACK.ra, 192, 3); near(N.COALSACK.dec, -63, 2);
});
const NOW = Date.UTC(2026, 10, 20, 12);
ok('the Milky Way core from Rome: low (max about 19 deg), evening months in summer; from Sydney: high, autumn to winter', () => {
  const r = N.eveningMonths(N.GALACTIC_CENTRE, 41.9, 12.5, NOW, 22, 20);
  near(r.maxAlt, 19.2, 0.3); assert.ok(r.from !== null && r.months.includes(6) && r.months.includes(7) && !r.months.includes(0) && !r.months.includes(11), JSON.stringify(r));
  const s = N.eveningMonths(N.GALACTIC_CENTRE, -33.9, 151.2, NOW, 22, 20);
  assert.ok(s.months.includes(5) && s.months.includes(6) && !s.months.includes(0), JSON.stringify(s)); assert.ok(s.maxAlt > 80);
  const arctic = N.eveningMonths(N.GALACTIC_CENTRE, 64, 25, NOW, 22, 20); assert.equal(arctic.from, null);
});
ok('firstEvening: finds the first day the Galactic Centre is up at 22:00 from Rome (summer) and none for the Arctic', () => {
  const hit = N.firstEvening(NOW, 12.5, (t) => G.starAltAt(N.GALACTIC_CENTRE, 41.9, 12.5, t) >= 12, 22, 366);
  assert.ok(hit && hit.days > 100 && hit.days < 260, JSON.stringify(hit));
  assert.equal(N.firstEvening(NOW, 25, (t) => G.starAltAt(N.GALACTIC_CENTRE, 64, 25, t) >= 12, 22, 366), null);
});

ok('star counts: more stars with a higher limit, and a dark site shows several times a big city', () => {
  const st = { n: cat.features.length, eq: new Float32Array(cat.features.length * 3), mag: new Float32Array(cat.features.length) };
  cat.features.forEach((f, i) => { const v = A.eqToVec(((f.geometry.coordinates[0] % 360) + 360) % 360, f.geometry.coordinates[1]); st.eq.set(v, i * 3); st.mag[i] = f.properties.mag; });
  const c = (q) => N.starsVisible(st, 41.9, 12.5, NOW, N.qualityLimit(q));
  assert.ok(c(0) < c(1) && c(1) < c(2) && c(2) < c(3)); assert.ok(c(3) > 2 * c(0) && c(3) > 1500 && c(3) < 3200, `dark ${c(3)} city ${c(0)}`);
  near(c(3) / (st.n), 0.5, 0.08, 'about half the sky is up');
});

if (Ast) {
  const lat = 41.9, lon = 12.5;
  const list = N.eveningsAhead(Ast, lat, lon, NOW, 31);
  ok('31 evenings, each from the end of twilight to local midnight', () => {
    assert.equal(list.length, 31);
    for (const e of list) { assert.ok(e.end > e.dusk && e.end - e.dusk < 9 * 3600e3 && e.twilight === -18, JSON.stringify(e)); assert.ok(G.sunAlt(lat, lon, e.dusk) <= -17.9); }
  });
  ok('a moonless evening really has the Moon below the horizon from dusk to midnight', () => {
    const run = N.moonlessRun(list); assert.ok(run, 'a moonless run in a month');
    assert.ok(run.days >= 3 && run.days <= 10, 'run length ' + run.days);
    for (const e of list.filter((x) => x.moonless)) for (let t = e.dusk; t <= e.end; t += 20 * 60e3) assert.ok(N.moonAlt(Ast, lat, lon, t) < 0.5, 'moon up at ' + new Date(t).toISOString());
  });
  ok('moonless evenings cluster round new Moon (a few days either side) and never near full Moon', () => {
    const nm = Ast.SearchMoonPhase(0, new Date(NOW), 40).date.getTime(), fm = Ast.SearchMoonPhase(180, new Date(NOW), 40).date.getTime();
    const run = N.moonlessRun(list); const mid = (run.from.dusk + run.to.dusk) / 2;
    assert.ok(Math.abs(mid - nm) < 6 * 864e5, `run middle ${new Date(mid).toISOString()} vs new Moon ${new Date(nm).toISOString()}`);
    for (const e of list) if (Math.abs(e.dusk - fm) < 3 * 864e5) assert.ok(!e.moonless && e.illum > 0.85, 'full Moon evening ' + e.illum);
  });
  ok('the darkest evening ranks first and is moonless; the full-Moon evening ranks last', () => {
    const r = N.rankEvenings(list); assert.equal(r[0].score, 0); assert.ok(r[0].moonless); assert.ok(r[r.length - 1].score > 0.6, 'worst ' + r[r.length - 1].score);
  });
  ok('three evenings for the 8.3 Try: darkest, in between, brightest; two days apart; darkest unique by score', () => {
    for (const [la, lo] of [[41.9, 12.5], [-33.87, 151.2]]) {
      const l = N.eveningsAhead(Ast, la, lo, NOW, 31), c = N.darkChoices(l); assert.ok(c);
      assert.equal(c.best.score, 0); assert.ok(c.mid.score > 0.08 && c.mid.score < c.full.score - 0.08); assert.ok(c.full.score > 0.5);
      const ks = [c.best, c.mid, c.full].map((e) => e.dayKey); assert.equal(new Set(ks).size, 3);
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.abs(ks[i] - ks[j]) >= 2 * 864e5);
    }
  });
  ok('Moon phase names and lit fraction', () => {
    assert.equal(N.phaseName(0), 'new'); assert.equal(N.phaseName(90), 'first quarter'); assert.equal(N.phaseName(180), 'full'); assert.equal(N.phaseName(270), 'last quarter');
    near(N.litFraction(90), 0.5, 1e-9); near(N.litFraction(180), 1, 1e-9);
    const nm = Ast.SearchMoonPhase(180, new Date(NOW), 40).date.getTime(); assert.equal(N.phaseName(N.moonPhaseDeg(Ast, nm)), 'full');
  });
  ok('planets up tonight: brightest first, all above the limit; Moon now has a sensible altitude', () => {
    const p = N.planetsUp(Ast, lat, lon, Date.UTC(2026, 10, 20, 20), 8);
    for (let i = 1; i < p.length; i++) assert.ok(p[i].mag >= p[i - 1].mag); for (const x of p) assert.ok(x.alt >= 8);
    const m = N.moonNow(Ast, lat, lon, Date.UTC(2026, 10, 20, 20)); assert.ok(m.alt >= -90 && m.alt <= 90 && m.illum >= 0 && m.illum <= 1);
  });
}

console.log(`\n${n} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
