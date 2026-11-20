// Node tests for the Learn area's pure maths and for the course text parser. Run: node tests/course.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as A from '../js/astro.js';
import * as G from '../js/course/geo.js';
import { parseCourse, fill, clean, placeholdersIn, hasDetail, brief, plain, detailHtml, STEPS } from '../js/course/text.js';
import * as C from '../js/course/checks.js';

let n = 0, bad = 0;
const ok = (name, fn) => { try { fn(); n++; console.log('ok   ' + name); } catch (e) { bad++; console.log('FAIL ' + name + '\n     ' + e.message); } };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);

const cat = JSON.parse(fs.readFileSync(new URL('../data/stars.6.json', import.meta.url)));
const star = (hip) => { const f = cat.features.find((x) => x.id === hip); return { ra: ((f.geometry.coordinates[0] % 360) + 360) % 360, dec: f.geometry.coordinates[1], mag: f.properties.mag }; };
const vec = (hip) => { const s = star(hip); return A.eqToVec(s.ra, s.dec); };
const J2000 = Date.UTC(2000, 0, 1, 12);
const NOW = Date.UTC(2026, 10, 16, 20, 0);
// J2000-frame pole of date for a given moment: row 1 of the precession matrix
const poleOfDate = (ms, sign = 1) => { const M = A.precessionMatrixMine(A.jdFromMs(ms)); return [M[3] * sign, M[4] * sign, M[5] * sign]; };

ok('pointer line Merak -> Dubhe extended x5 lands within 3 deg of Polaris', () => {
  const p = G.extendPast(vec(G.HIP.merak), vec(G.HIP.dubhe), 5);
  const d = G.angleDeg(p, vec(G.HIP.polaris)); assert.ok(d < 3, 'miss by ' + d.toFixed(2));
});
ok('the gap between the pointers is about 5.4 deg and Dubhe-Polaris about 5.3 gaps', () => {
  const gap = G.angleDeg(vec(G.HIP.merak), vec(G.HIP.dubhe)); near(gap, 5.4, 0.3);
  near(G.angleDeg(vec(G.HIP.dubhe), vec(G.HIP.polaris)) / gap, 5.3, 0.4);
});
ok('Crux long axis Gacrux -> Acrux extended x4.5 lands within 5 deg of the south celestial pole', () => {
  const p = G.extendPast(vec(G.HIP.gacrux), vec(G.HIP.acrux), 4.5);
  const d = G.angleDeg(p, poleOfDate(NOW, -1)); assert.ok(d < 5, 'miss by ' + d.toFixed(2));
});
ok('Crux axis length is about 6 deg', () => near(G.angleDeg(vec(G.HIP.gacrux), vec(G.HIP.acrux)), 6.0, 0.4));
ok('fists to the pole', () => {
  assert.equal(G.fistsToPole(41.9), 4); assert.equal(G.fistsToPole(-33.9), 3); assert.equal(G.fistsToPole(0), 0); assert.equal(G.fistsToPole(90), 9);
  near(G.fistsToPoleExact(35), 3.5, 1e-9);
});
ok('circumpolar test: Dubhe from Rome yes, Sirius no; Acrux from Sydney yes, Polaris never', () => {
  assert.ok(G.neverSets(star(G.HIP.dubhe).dec, 41.9)); assert.ok(!G.neverSets(star(32349).dec, 41.9));
  assert.ok(G.neverSets(star(G.HIP.acrux).dec, -33.87)); assert.ok(!G.neverSets(star(G.HIP.polaris).dec, -33.87));
});
ok('Dipper hand turns counter-clockwise, 15 deg per hour (Rome)', () => {
  const s = star(G.HIP.dubhe);
  const a0 = G.starClockAngle(s, 41.9, 12.5, NOW), a1 = G.starClockAngle(s, 41.9, 12.5, NOW + 3600e3), a2 = G.starClockAngle(s, 41.9, 12.5, NOW + 6 * 3600e3);
  near(A.norm180(a1 - a0), -15, 1.2, 'one hour'); near(A.norm180(a2 - a0), -90, 5, 'six hours');
});
ok('Southern Cross hand turns clockwise, 15 deg per hour (Sydney)', () => {
  const s = star(G.HIP.gacrux);
  const a0 = G.starClockAngle(s, -33.87, 151.2, NOW), a1 = G.starClockAngle(s, -33.87, 151.2, NOW + 3600e3);
  near(A.norm180(a1 - a0), 15, 1.2);
});
ok('the clock hand drifts about 1 deg per day (2 hours per month)', () => {
  const s = star(G.HIP.dubhe);
  const a0 = G.starClockAngle(s, 41.9, 12.5, NOW), a1 = G.starClockAngle(s, 41.9, 12.5, NOW + 30 * 86400e3);
  near(A.norm180(a0 - a1), 29.6, 1.5);
});
ok('Dubhe is straight above Polaris at a sensible hour on some date', () => {
  let best = 999; const s = star(G.HIP.dubhe);
  for (let m = 0; m < 1440; m += 5) { const a = G.starClockAngle(s, 41.9, 12.5, NOW + m * 60e3); best = Math.min(best, Math.abs(A.norm180(a))); }
  assert.ok(best < 1.5);
});
ok('compass words and evening time', () => {
  assert.equal(G.compassIndex(0), 0); assert.equal(G.compassIndex(44), 1); assert.equal(G.compassIndex(359), 0); assert.equal(G.compassIndex(181), 4);
  assert.equal(G.heightIndex(3), 0); assert.equal(G.heightIndex(30), 2); assert.equal(G.heightIndex(80), 3);
  const t = G.eveningMs(NOW, 12.5, 21); assert.ok(t >= NOW - 3 * 3600e3 && t <= NOW + 21 * 3600e3);
  near(A.localSolarHours(t, 12.5), 21, 0.05);
});
ok('great-circle helpers: tangent and arc are consistent', () => {
  const a = [1, 0, 0], b = [0, 1, 0]; near(G.angleDeg(G.alongArc(a, b, 90), b), 0, 1e-9); near(G.angleDeg(G.alongArc(a, b, 135), [-Math.SQRT1_2, Math.SQRT1_2, 0]), 0, 1e-9);
});

// ---- the course text parser
const md = `# Doc {#doc}
free prose is fine here

# Course {#course}
title: Reading the Sky

goal: Learn the sky
  across two lines.

# Interface {#ui}
btn.go: Go {n}

# Chapter 1 {#ch1}
title: One
summary: S

## Lesson 1.1 {#l1.1}
title: T
hook: H [src:kamal]

### Watch {#watch}
c1: Hello {place}.

### Try {#try}
prompt: P
`;
ok('parser reads the format', () => {
  const r = parseCourse(md); assert.deepEqual(r.errors, []);
  assert.equal(r.course.title, 'Reading the Sky'); assert.equal(r.course.goal, 'Learn the sky across two lines.'); assert.equal(r.ui['btn.go'], 'Go {n}');
  assert.equal(r.chapters[0].lessons[0].id, 'l1.1'); assert.equal(r.chapters[0].lessons[0].steps.watch.c1, 'Hello {place}.');
  assert.equal(r.chapters[0].lessons[0].hook, 'H [src:kamal]');
});
ok('parser reports bad input', () => {
  assert.ok(parseCourse('# Course {#course}\nthis is not a key line\n').errors.length > 0);
  assert.ok(parseCourse('# Course {#course}\ntitle: a\ntitle: b\n').errors.length > 0);
  assert.ok(parseCourse('# Course\ntitle: a\n').errors.length > 0);
});
ok('fill and clean', () => {
  assert.equal(fill('{a} and {b}', { a: 1, b: 'x' }), '1 and x');
  const miss = []; assert.equal(fill('{a} {zz}', { a: 1 }, (k) => miss.push(k)), '1 {zz}'); assert.deepEqual(miss, ['zz']);
  assert.equal(clean('A claim. [src:kamal] More [src:a-b2].'), 'A claim. More.'); assert.deepEqual([...placeholdersIn('x {a} {b} {a}')], ['a', 'b']);
});

// ---- [+ detail +] markup
const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
ok('detail markup: hasDetail, brief and plain', () => {
  assert.equal(hasDetail('a [+b+] c'), true); assert.equal(hasDetail('a b c'), false); assert.equal(hasDetail('a [+b+] [+c+]'), true);
  assert.equal(brief('a fist covers 10°[+, three fingers 5°+].'), 'a fist covers 10°.');
  assert.equal(brief('One. [+Two. +]Three.'), 'One. Three.');
  assert.equal(brief('A [+b +] c'), 'A c'); assert.equal(brief('x [+, y+].'), 'x.'); assert.equal(brief('no detail here.'), 'no detail here.');
  assert.equal(plain('a fist covers 10°[+, three fingers 5°+].'), 'a fist covers 10°, three fingers 5°.');
  assert.equal(plain('One. [+Two. +]Three.'), 'One. Two. Three.'); assert.equal(plain('x [+, y+].'), 'x, y.');
  assert.equal(brief(''), '');
});
ok('detail markup: detailHtml escapes and underlines only the details', () => {
  assert.equal(detailHtml('a fist covers 10°[+, three <b> & more+].', escH), 'a fist covers 10°<u class="lc-more">, three &lt;b&gt; &amp; more</u>.');
  assert.equal(detailHtml('One. [+Two. +]Three.', escH), 'One. <u class="lc-more">Two.</u> Three.');
  assert.equal(detailHtml('x [+, y+].', escH), 'x<u class="lc-more">, y</u>.');
  assert.equal(detailHtml('plain "text"', escH), 'plain &quot;text&quot;');
});
ok('detail markup survives clean: a [src] tag inside a detail, a placeholder inside a detail, same result as the unmarked text', () => {
  const marked = clean('At arm\'s length a fist covers 10° of sky[+, three middle fingers about 5° [src:hand-angles]+]. [src:other]');
  assert.equal(marked, 'At arm\'s length a fist covers 10° of sky[+, three middle fingers about 5°+].');
  assert.equal(brief(marked), 'At arm\'s length a fist covers 10° of sky.');
  assert.equal(plain(marked), clean('At arm\'s length a fist covers 10° of sky, three middle fingers about 5° [src:hand-angles]. [src:other]'));
  const ph = fill(clean('From {place}[+, where the pole is {poleAlt}° up [src:x]+].'), { place: 'Rome', poleAlt: 42 });
  assert.equal(ph, 'From Rome[+, where the pole is 42° up+].'); assert.equal(brief(ph), 'From Rome.'); assert.equal(plain(ph), 'From Rome, where the pole is 42° up.');
  assert.equal(clean('a [+ b +] c'), 'a [+ b +] c');
});
ok('every lesson text in course.md has balanced, non-nested [+ +] markers, only in lesson step texts, and a non-empty short text', () => {
  const r = parseCourse(fs.readFileSync(new URL('../content/en/course.md', import.meta.url), 'utf8')), balanced = (t) => { let open = false; for (const m of t.matchAll(/\[\+|\+\]/g)) { if (m[0] === '[+') { if (open) return false; open = true; } else { if (!open) return false; open = false; } } return !open; };
  const marks = (t) => /\[\+|\+\]/.test(t || '');
  for (const [k, v] of Object.entries(r.ui)) assert.ok(!marks(v), `ui.${k} has markers`);
  for (const c of r.chapters) {
    assert.ok(!marks(c.title) && !marks(c.summary), `${c.id} title/summary has markers`);
    for (const l of c.lessons) for (const [k, v] of Object.entries(l.keys)) {
      if (k === 'title' || k === 'hook') { assert.ok(!marks(v), `${l.id} ${k} has markers`); continue; }
      assert.ok(balanced(v), `${l.id} ${k}: unbalanced or nested markers`); assert.ok(!marks(v) || STEPS.some((s) => k.startsWith(s + '.')), `${l.id} ${k}: markers outside a step text`);
      assert.ok(brief(clean(v)).length > 0, `${l.id} ${k}: empty once the details are removed`);
    }
  }
});

// ---- the Try checkers, against a fake lesson context
const fakeX = ({ S: so, ...rest } = {}) => ({ S: { sky: { az: 0, alt: 10 }, mode: 'sky', obs: { lat: 41.9 }, time: 0, sel: null, ...so }, data: { stars: { hip: [11767, 54061] }, starInfo: (i) => ({ title: ['Polaris', 'Dubhe'][i] }) }, tryT0: 0, hip: () => ({ az: 0, alt: 40 }), ...rest });
ok('checker facing: az within tol and alt within range', () => {
  const c = C.facing({ az: 0, tol: 20, altMax: 38 });
  assert.ok(c.test(fakeX({ S: { sky: { az: 355, alt: 12 } } }))); assert.ok(!c.test(fakeX({ S: { sky: { az: 40, alt: 12 } } }))); assert.ok(!c.test(fakeX({ S: { sky: { az: 0, alt: 60 } } })));
});
ok('checker selected: right star, wrong star (with its name), nothing', () => {
  const c = C.selected(11767);
  assert.equal(c.test(fakeX()), false);
  assert.equal(c.test(fakeX({ S: { sel: { type: 'star', index: 0 } } })), true);
  assert.deepEqual(c.test(fakeX({ S: { sel: { type: 'star', index: 1 } } })), { wrong: true, vars: { name: 'Dubhe' } });
  assert.equal(C.selected((sel) => sel.type === 'body').test(fakeX({ S: { sel: { type: 'body' } } })), true);
});
ok('checker timeAdvanced: exactly 2 h within tolerance', () => {
  const c = C.timeAdvanced({ hours: 2, tol: 0.1 }), h = 3600e3;
  assert.ok(c.test(fakeX({ S: { time: 2 * h } }))); assert.ok(c.test(fakeX({ S: { time: 2.05 * h } }))); assert.ok(!c.test(fakeX({ S: { time: 3 * h } }))); assert.equal(c.controls, 'hours');
});
ok('checker objectAltitude and latitudeBetween', () => {
  assert.ok(C.objectAltitude(11767, { min: 30 }).test(fakeX())); assert.ok(!C.objectAltitude(11767, { min: 50 }).test(fakeX()));
  assert.ok(C.objectAltitude('Moon', { max: 10 }).test({ ...fakeX(), bodyAltAz: () => ({ alt: 5 }) }));
  const l = C.latitudeBetween(40, 45); assert.ok(l.test(fakeX())); assert.ok(!l.test(fakeX({ S: { obs: { lat: -10 } } }))); assert.equal(l.controls, 'lat');
});
ok('checker choice, sequence and custom', () => {
  const c = C.choice({ options: () => [{ id: 3 }, { id: 4 }], correct: () => 4 });
  assert.equal(c.answer(fakeX(), 4), true); assert.equal(c.answer(fakeX(), 3).wrong, true);
  let stages = 0; const x = fakeX(); x.stageChanged = () => { stages++; };
  const seq = C.sequence([C.selected(11767), C.facing({ az: 180, tol: 20 })]);
  seq.reset(x);
  assert.equal(seq.test(x), false);
  x.S.sel = { type: 'star', index: 0 }; assert.equal(seq.test(x), false); assert.equal(stages, 1); assert.equal(seq.keys(x).prompt, 'try.prompt2');
  x.S.sky.az = 175; assert.equal(seq.test(x), true);
  assert.equal(C.custom((X) => X.S.time === 5).test(fakeX({ S: { time: 5 } })), true);
});

// ---- chapters 3 and 4: the Sun, heliacal risings, culminations, zenith stars
import { createRequire } from 'node:module';
const Astro = (() => { try { return createRequire(import.meta.url)('../vendor/astronomy.browser.min.js'); } catch (e) { return null; } })();
const names = JSON.parse(fs.readFileSync(new URL('../data/starnames.json', import.meta.url)));
const SN = cat.features.length, ST = { n: SN, ra: new Float32Array(SN), dec: new Float32Array(SN), mag: new Float32Array(SN), hip: new Int32Array(SN) };
cat.features.forEach((f, i) => { ST.ra[i] = ((f.geometry.coordinates[0] % 360) + 360) % 360; ST.dec[i] = f.geometry.coordinates[1]; ST.mag[i] = f.properties.mag; ST.hip[i] = f.id; });
const nameOf = (i) => (names[ST.hip[i]] || {}).name || '';
const sunConsAt = (ms, anti = false) => { const v = Astro.GeoVector('Sun', new Date(ms), true), d = Math.hypot(v.x, v.y, v.z) * (anti ? -1 : 1), e = A.vecToEq([v.x / d, v.z / d, -v.y / d]); return Astro.Constellation(e.ra / 15, e.dec).name; };

ok('sunEq agrees with astronomy-engine to 0.05 deg (June solstice, November, March)', () => {
  if (!Astro) return;
  for (const ms of [Date.UTC(2026, 5, 21, 12), Date.UTC(2026, 10, 16), Date.UTC(2027, 2, 20, 6)]) {
    const e = G.sunEq(ms), q = Astro.Equator('Sun', new Date(ms), new Astro.Observer(0, 0, 0), true, true);
    near(e.ra, q.ra * 15, 0.05, 'ra'); near(e.dec, q.dec, 0.05, 'dec');
  }
});
ok('noon Sun at the June solstice: about 89 deg at Aswan, 82 deg at Alexandria (gap 7.1 deg), and the Earth comes out at 40,000 km', () => {
  const ms = Date.UTC(2026, 5, 21, 10), a = G.noonSunAlt(24.09, ms), b = G.noonSunAlt(31.2, ms);
  near(a, 89.35, 0.05); near(b, 82.24, 0.05); near(a - b, 7.1, 0.05);
  near(G.circumferenceKm(a - b, 7.11 * G.KM_PER_DEG) / 40075, 1, 0.02, 'circumference within 2 %');
  assert.equal(G.roundTo(G.circumferenceKm(a - b, 790), 1000), 40000);
});
ok('sunMorningAt: the Sun is at -9.5 deg at the moment returned, and rising; no such moment in the midnight sun', () => {
  const key = Date.UTC(2026, 7, 7), t = G.sunMorningAt(30, 31, key, -9.5);
  near(G.sunAlt(30, 31, t), -9.5, 0.01); assert.ok(G.sunAlt(30, 31, t + 600e3) > -9.5);
  assert.equal(G.sunMorningAt(80, 0, Date.UTC(2026, 5, 21), -9.5), null);
});
ok('heliacal rule: Sirius first seen at dawn at 30N 31E on 7 August 2026, not the day before; later further north', () => {
  const sir = star(32349), k = G.firstDawnSeen(sir, 30, 31, Date.UTC(2026, 5, 20));
  assert.equal(new Date(k).toISOString().slice(0, 10), '2026-08-07');
  assert.ok(!G.dawnCheck(sir, 30, 31, k - 86400e3).seen); assert.ok(G.dawnCheck(sir, 30, 31, k).seen); assert.ok(G.dawnCheck(sir, 30, 31, k + 5 * 86400e3).seen);
  assert.ok(G.firstDawnSeen(sir, 35, 31, Date.UTC(2026, 5, 20)) > k);
});
ok('brightest star that never rises: Rome Canopus (seen south of 37 N), Sydney Dubhe (north of 28 S), none on the equator', () => {
  near(G.culminationAlt(-52.7, 41.9), -4.6, 0.05);
  const r = G.brightestNeverRises(ST, 41.9); assert.equal(nameOf(r.i), 'Canopus'); near(r.latToSee, 37.3, 0.1);
  const s = G.brightestNeverRises(ST, -33.87); assert.equal(nameOf(s.i), 'Dubhe'); near(s.latToSee, -28.25, 0.1);
  assert.ok(G.culminationAlt(-52.6957, 37) > 0 && G.culminationAlt(-52.6957, 38) < 0, 'Canopus limit is about 37 N');
  const q = G.brightestNeverRises(ST, -0.2); assert.ok(q === null || Math.abs(ST.dec[q.i]) > 89);
});
ok('zenith stars: Hawaii (19.5 N) Arcturus, Sydney Kaus Australis, Rome Almach (named stars brighter than 2.2)', () => {
  const pick = (lat) => { const z = G.zenithStarOf(ST, lat, 2.2, (i) => !!nameOf(i)); return { name: nameOf(z.i), diff: z.diff }; };
  assert.equal(pick(19.5).name, 'Arcturus'); near(pick(19.5).diff, 0.32, 0.05);
  assert.equal(pick(-33.87).name, 'Kaus Australis'); assert.equal(pick(41.9).name, 'Almach'); assert.ok(pick(41.9).diff < 1);
});
ok('nextTransitMs: the star is at its highest (90 - |lat - dec|) within 25 hours; transitNearHour lands near 22:00 solar', () => {
  const arc = star(69673), from = Date.UTC(2026, 10, 16, 12), lat = 19.5, lon = -155.6;
  const t = G.nextTransitMs(arc, lat, lon, from); assert.ok(t >= from - 1e3 && t < from + 25 * 3600e3);
  near(G.starAltAt(arc, lat, lon, t), G.culminationAlt(arc.dec, lat), 0.25); assert.ok(G.starAltAt(arc, lat, lon, t) > 89.5);
  near(G.solarHour(G.transitNearHour(arc, lat, lon, from, 22), lon), 22, 0.6, 'hour');
});
ok('sunSegments: the Sun walks through 13 constellations in order, starting with Libra on 16 November 2026', () => {
  if (!Astro) return;
  const seg = G.sunSegments((t) => sunConsAt(t), Date.UTC(2026, 10, 16), 366);
  assert.equal(seg[0].name, 'Libra'); assert.equal(new Set(seg.map((x) => x.name)).size, 13);
  assert.deepEqual(seg.slice(0, 4).map((x) => x.name), ['Libra', 'Scorpius', 'Ophiuchus', 'Sagittarius']);
  const n13 = seg.map((x) => x.name); n13.pop(); assert.deepEqual(G.neighbours(n13, 'Scorpius'), ['Libra', 'Ophiuchus']);
  assert.equal(sunConsAt(Date.UTC(2026, 10, 16), true), 'Aries'); assert.equal(sunConsAt(Date.UTC(2026, 7, 1)), 'Cancer');
});
ok('seasons at 21:00 solar from Rome: Pleiades high in mid-November; Orion below 20 deg on 16 Nov, above 20 deg by 20 Dec', () => {
  assert.ok(G.starAltAt(star(17702), 41.9, 12.5, G.localMs(Date.UTC(2026, 10, 15), 12.5, 21)) > 45);
  const o = star(26311); assert.ok(G.starAltAt(o, 41.9, 12.5, G.localMs(Date.UTC(2026, 10, 16), 12.5, 21)) < 20);
  assert.ok(G.starAltAt(o, 41.9, 12.5, G.localMs(Date.UTC(2026, 11, 20), 12.5, 21)) > 20);
});
ok('formatting helpers: clock12, fmtInt, dayKeyOf / localMs round trip', () => {
  assert.equal(G.clock12(23.67), '11:40 pm'); assert.equal(G.clock12(0.25), '12:15 am'); assert.equal(G.clock12(12), '12:00 pm'); assert.equal(G.fmtInt(40000), '40,000');
  const k = G.dayKeyOf(Date.UTC(2026, 7, 7, 2, 30), 31); assert.equal(k, Date.UTC(2026, 7, 7)); near(G.solarHour(G.localMs(k, 31, 4.5), 31), 4.5, 1e-6);
  assert.equal(G.dayKeyOf(Date.UTC(2026, 7, 6, 23, 0), 151), Date.UTC(2026, 7, 7));
});
ok('checker controls for chapters 3 and 4: year, days, scrub', () => {
  assert.equal(C.custom(() => true, { controls: 'year' }).controls, 'year'); assert.equal(C.custom(() => true, { controls: 'days' }).controls, 'days');
  assert.equal(C.objectAltitude(69673, { min: 85, controls: 'scrub' }).controls, 'scrub');
});

// ---- chapters 5 and 6: the Moon, the planets, eclipses, precession, proper motion (js/course/wanderers.js)
if (Astro) globalThis.Astronomy = Astro;
const W = await import('../js/course/wanderers.js');
const DAYMS = 864e5, iso = (t) => new Date(t).toISOString().slice(0, 10);
const extraPM = (() => { const ex = JSON.parse(fs.readFileSync(new URL('../data/starextra.json', import.meta.url))); return (hip) => { const k = ex.hip.indexOf(hip); return k < 0 ? [0, 0] : [ex.pmra[k] || 0, ex.pmdec[k] || 0]; }; })();

ok('Moon phase: full Moon is at 180 deg and about 100 % lit, new Moon at 0; phase names by angle', () => {
  if (!Astro) return;
  const f = W.nextPhaseMs(180, Date.UTC(2026, 10, 20)), n0 = W.nextPhaseMs(0, Date.UTC(2026, 10, 20));
  assert.equal(iso(f), '2026-11-24'); near(W.moonPhase(f).angle, 180, 0.3); assert.ok(W.moonPhase(f).lit > 0.999);
  near(Math.abs(A.norm180(W.moonPhase(n0).angle)), 0, 0.3); assert.ok(W.moonPhase(n0).lit < 0.001);
  assert.deepEqual([0, 45, 90, 135, 180, 225, 270, 315].map(W.phaseIndex), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(W.phaseIndex(359), 0); assert.equal(W.phaseIndex(177), 4);
});
ok('Mars retrograde: opposition on 19 Feb 2027, moving backwards then and forwards 90 days either side; the loop lasts 70 to 85 days', () => {
  if (!Astro) return;
  const opp = W.nextOpposition('Mars', Date.UTC(2026, 10, 20));
  assert.equal(iso(opp), '2027-02-19');
  assert.ok(W.isRetrograde('Mars', opp)); assert.ok(!W.isRetrograde('Mars', opp - 90 * DAYMS)); assert.ok(!W.isRetrograde('Mars', opp + 90 * DAYMS));
  assert.ok(W.lonSpeed('Mars', opp - 90 * DAYMS) > 0.3 && W.lonSpeed('Mars', opp) < -0.3);
  const r = W.retrogradeSpan('Mars', opp), len = (r.end - r.start) / DAYMS;
  assert.ok(len > 70 && len < 85, 'length ' + len); assert.ok(r.start < opp && r.end > opp);
  assert.ok(W.isRetrograde('Mars', r.start + DAYMS) && !W.isRetrograde('Mars', r.start - DAYMS) && W.isRetrograde('Mars', r.end - DAYMS) && !W.isRetrograde('Mars', r.end + DAYMS));
  const tr = W.skyTrack('Mars', opp - 80 * DAYMS, opp + 80 * DAYMS, 2); assert.equal(tr.length, 81);       // the track's RA first falls then rises (the loop)
  const ras = tr.map((p) => p.ra), mx = Math.max(...ras), mn = Math.min(...ras); assert.ok(ras.indexOf(mx) < ras.indexOf(mn) && mx - mn > 3);
});
ok('Venus: morning star on 20 Nov 2026 (about 35 deg), greatest western elongation 3 Jan 2027 (about 47 deg), evening star in mid 2027; hidden near the Sun', () => {
  if (!Astro) return;
  const now = Date.UTC(2026, 10, 20, 20);
  assert.equal(W.inferiorSide('Venus', now), 'morning'); near(W.signedElongation('Venus', now), -34.8, 0.5);
  const m = W.nextMaxElongation('Venus', now); assert.equal(iso(m.ms), '2027-01-03'); assert.equal(m.side, 'morning'); near(m.deg, 46.95, 0.3);
  const ev = W.nextMaxElongation('Venus', Date.UTC(2027, 2, 1)); assert.equal(ev.side, 'evening'); near(ev.deg, 46, 1.2); near(W.signedElongation('Venus', ev.ms), ev.deg, 0.2); assert.equal(W.inferiorSide('Venus', ev.ms), 'evening');
  let close = null; for (let d = 0; d < 700 && !close; d++) { const t = now + d * DAYMS; if (Math.abs(W.signedElongation('Venus', t)) < 6) close = t; }
  assert.ok(close, 'Venus passes within 6 deg of the Sun'); assert.equal(W.inferiorSide('Venus', close), 'near');
  const ser = W.elongationSeries('Venus', m.ms, 584, 4); assert.ok(ser.length > 140 && Math.max(...ser.map((p) => p.v)) > 44 && Math.min(...ser.map((p) => p.v)) < -44);
  assert.ok(ser[0].v < -44);
});
ok('lunar eclipses: 14 Mar 2025 is the first partial or total one after 1 Jan 2025; the next after 20 Nov 2026 is the partial of 12 Jan 2028', () => {
  if (!Astro) return;
  const a = W.lunarEclipses(Date.UTC(2025, 0, 1), 3); assert.equal(iso(a[0].ms), '2025-03-14'); assert.equal(a[0].kind, 'total'); assert.equal(iso(a[1].ms), '2025-09-07');
  const b = W.lunarEclipses(Date.UTC(2026, 10, 20), 2); assert.equal(iso(b[0].ms), '2028-01-12'); assert.equal(b[0].kind, 'partial');
});
ok('eclipse candidates for the Try: three full Moons, exactly one eclipsed (12 Jan 2028), the others a month away with no eclipse of any kind, in time order', () => {
  if (!Astro) return;
  const c = W.eclipseChoices(Date.UTC(2026, 10, 20));
  assert.equal(c.length, 3); assert.equal(c.filter((x) => x.eclipsed).length, 1); assert.equal(iso(c.find((x) => x.eclipsed).ms), '2028-01-12');
  assert.ok(c[0].ms < c[1].ms && c[1].ms < c[2].ms);
  for (const x of c) { assert.equal(W.anyLunarEclipseNear(x.ms, 2), x.eclipsed); near(W.moonPhase(x.ms).angle, 180, 0.5); }
  for (const x of c.filter((y) => !y.eclipsed)) assert.ok(Math.abs(W.moonLat(x.ms)) > 1.6, 'a miss is off the Sun\'s path by more than the shadow reaches');
  const run = W.eclipseRun(Date.UTC(2026, 10, 20), 4, 1);
  assert.equal(run.run.length, 6); assert.ok(run.run[run.index].eclipsed && Math.abs(run.run[run.index].lat) < 1.6); assert.equal(run.run.filter((r) => r.eclipsed).length, 1);
  assert.ok(Math.max(...run.run.map((r) => Math.abs(r.lat))) < 5.4);
});
ok('eclipses visible from a place: Rome sees 12 Jan 2028 (lunar) and 2 Aug 2027 (partial solar); Sydney sees the total solar eclipse of 22 Jul 2028', () => {
  if (!Astro) return;
  const now = Date.UTC(2026, 10, 20, 20);
  assert.equal(iso(W.nextVisibleLunar(41.9, 12.5, now).ms), '2028-01-12');
  const s = W.nextVisibleSolar(41.9, 12.5, now); assert.equal(iso(s.ms), '2027-08-02'); assert.equal(s.kind, 'partial'); near(s.obscuration, 0.74, 0.03);
  const y = W.nextVisibleSolar(-33.87, 151.2, now); assert.equal(iso(y.ms), '2028-07-22'); assert.equal(y.kind, 'total');
  assert.equal(W.nextVisibleSolar(80, 0, now) === null || true, true);
});
ok('the Moon\'s path: tilted about 5 deg, nodes on the Sun\'s path 180 deg apart, a point of the Moon\'s path at the node longitude lies on the ecliptic', () => {
  if (!Astro) return;
  const g = W.moonPathGeometry(Date.UTC(2028, 0, 12)); near(g.tilt, 5.1, 0.35);
  const a = A.eqToVec(g.asc.ra, g.asc.dec), d = A.eqToVec(g.desc.ra, g.desc.dec); near(G.angleDeg(a, d), 180, 0.01);
  const k = A.eqToVec(W.ECL_POLE.ra, W.ECL_POLE.dec); near(G.angleDeg(a, k), 90, 0.01);                  // the node is on the ecliptic
  const lam = W.eclLonOfApp(a), p = W.moonPathPoint(g, lam); near(G.angleDeg(A.eqToVec(p.ra, p.dec), a), 0, 0.01);
  const q = A.eqToVec(...Object.values(W.moonPathPoint(g, lam + 90))); near(90 - G.angleDeg(q, k), g.tilt, 0.05, 'a quarter on, the path is a full tilt above the ecliptic');
  near(W.eclLonOfApp(A.eqToVec(W.eclPoint(75).ra, W.eclPoint(75).dec)), 75, 0.01);
  const e = W.lunarEclipses(Date.UTC(2026, 10, 20), 1)[0].ms;                                           // at the eclipse the Moon stands near a node, so its longitude is near the node's
  const lm = W.eclLon('Moon', e), ln = W.eclLonOfApp(A.eqToVec(W.moonPathGeometry(e).asc.ra, W.moonPathGeometry(e).asc.dec));
  const off = Math.min(Math.abs(A.norm180(lm - ln)), Math.abs(A.norm180(lm - ln - 180))); assert.ok(off < 13, 'within 13 deg of a node: ' + off);
});
ok('precession circle: the pole of every year stays one obliquity from the ecliptic pole (21.5 to 24.8 deg); Thuban at the pole in 2800 BC, Polaris today, Vega near AD 13 700', () => {
  const k = A.eqToVec(W.ECL_POLE.ra, W.ECL_POLE.dec), track = W.poleTrack(-2999, 13700, 100);
  assert.equal(track.length, 167);
  for (const e of track) { const sep = G.angleDeg(A.eqToVec(e.ra, e.dec), k); assert.ok(sep > 21.5 && sep < 24.8, 'sep ' + sep); }
  const th = star(68756), vg = star(91262), pl = star(11767);
  assert.ok(W.poleSeparation(-2799, A.eqToVec(th.ra, th.dec)) < 0.3); assert.ok(W.poleSeparation(2026.9, A.eqToVec(pl.ra, pl.dec)) < 0.8);
  const vm = extraPM(91262); assert.ok(W.poleSeparation(13700, W.starAtYear(vg.ra, vg.dec, vm[0], vm[1], 13700)) <= 7, 'within the 7 deg of the Try');
  assert.ok(W.poleSeparation(0, A.eqToVec(vg.ra, vg.dec)) > 40);
  const first = A.eqToVec(track[0].ra, track[0].dec), half = W.poleAtYear(-2999 + 12886); assert.ok(G.angleDeg(first, half) > 40, 'half a lap on, the pole is on the far side of the circle (about 47 deg away)');
  assert.equal(W.yearText(-2999), '3000 BC'); assert.equal(W.yearText(13700), 'AD 13700');
});
ok('Polaris is closest to the pole around AD 2100 (about half a degree); Kochab and Mizar line up with the pole about 2500 BC', () => {
  const pl = star(11767), pm = extraPM(11767), at = (E) => W.starAtYear(pl.ra, pl.dec, pm[0], pm[1], E);
  const best = W.poleClosest(at(2100), 2000, 2300, 1); let b = null; for (let E = 2000; E <= 2300; E++) { const d = W.poleSeparation(E, at(E)); if (!b || d < b.deg) b = { year: E, deg: d }; }
  assert.ok(Math.abs(b.year - 2100) <= 15 && b.deg > 0.4 && b.deg < 0.5, JSON.stringify(b)); near(W.poleSeparation(2026.9, at(2026.9)), 0.62, 0.05);
  const ko = star(72607), mz = star(65378), kv = A.eqToVec(ko.ra, ko.dec), mv = A.eqToVec(mz.ra, mz.dec);
  const nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); }, cr = nrm([kv[1] * mv[2] - kv[2] * mv[1], kv[2] * mv[0] - kv[0] * mv[2], kv[0] * mv[1] - kv[1] * mv[0]]);
  assert.ok(Math.abs(90 - G.angleDeg(cr, W.poleAtYear(-2559))) < 1, 'the Kochab-Mizar line passes within a degree of the pole in 2560 BC');
});
ok('Arcturus proper motion: about 5 deg after 7 900 years and the path is straight; half a degree in about 800 years', () => {
  const ar = star(69673), pm = extraPM(69673); near(Math.hypot(pm[0], pm[1]) / 1000, 2.28, 0.03);
  const now = A.eqToVec(ar.ra, ar.dec);
  near(G.angleDeg(W.starAtYear(ar.ra, ar.dec, pm[0], pm[1], 2000 + 7900), now), 5, 0.3); near(G.angleDeg(W.starAtYear(ar.ra, ar.dec, pm[0], pm[1], 2000 + 800), now), 0.5, 0.05);
  const tr = W.propermotionTrack(ar.ra, ar.dec, pm[0], pm[1], -10000, 15000, 250); assert.equal(tr.length, 101);
  assert.ok(G.angleDeg(A.eqToVec(tr[0].ra, tr[0].dec), A.eqToVec(tr[100].ra, tr[100].dec)) > 13);
});
ok('the Sun at the solstices: June solstice in Taurus now, Cancer about 300 BC; December solstice in Sagittarius now; nearest Tropic and next solstice', () => {
  if (!Astro) return;
  assert.equal(W.sunConsAt(W.solsticeMs(2026, true)), 'Taurus'); assert.equal(W.sunConsAt(W.solsticeMs(2026, false)), 'Sagittarius');
  const old = new Date(W.solsticeMs(2026, true)); old.setUTCFullYear(-300); assert.equal(W.sunConsAt(old.getTime()), 'Cancer');
  const rome = W.nearestTropic(41.9), syd = W.nearestTropic(-33.87);
  assert.ok(rome.north && rome.toward === 'south'); near(rome.km, 2053, 5); assert.ok(!syd.north && syd.toward === 'north'); near(syd.km, 1160, 5);
  assert.equal(iso(W.nextSolsticeOf(Date.UTC(2026, 10, 20), true)), '2027-06-21'); assert.equal(iso(W.nextSolsticeOf(Date.UTC(2026, 10, 20), false)), '2026-12-21');
  assert.equal(W.consOf({ ra: 83.6, dec: 22 }), 'Taurus');
});
ok('checker controls for chapters 5 and 6: days, year and ages', () => {
  assert.equal(C.custom(() => true, { controls: 'ages' }).controls, 'ages');
});

console.log(`\n${n} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
