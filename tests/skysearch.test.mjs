import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { buildIndex, searchSky, horizonNote } from '../js/skysearch.js';
const require = createRequire(import.meta.url);
const Astronomy = require('../vendor/astronomy.browser.min.js');
const rd = (f) => JSON.parse(fs.readFileSync(new URL('../data/' + f, import.meta.url)));
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok -', name); };

// minimal stand-in for loadData: same shapes, no three.js
const names = rd('starnames.json'), cons = rd('constellations.json'), dsos = rd('dsos.bright.json'), stars = rd('stars.6.json');
const consMap = new Map(cons.features.map((f) => [f.id, { id: f.id, name: f.properties.name, gen: f.properties.gen, en: f.properties.en || f.properties.name, rank: +f.properties.rank || 3 }]));
const S = { n: stars.features.length, hip: Int32Array.from(stars.features.map((f) => f.id)), mag: Float32Array.from(stars.features.map((f) => f.properties.mag)) };
const dso = dsos.features.map((f) => ({ id: f.id, name: f.properties.desig, desig: f.properties.desig, type: f.properties.type === 's' ? 'galaxy' : f.properties.type, mag: f.properties.mag, ra: f.geometry.coordinates[0], dec: f.geometry.coordinates[1] }));
dso.find((d) => d.id === 'NGC 224').name = 'Andromeda Galaxy';
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].map((id, i) => ({ id, kind: i < 2 ? i + 1 : 0 }));
const idx = buildIndex({ stars: S, names, dso, cons: [...consMap.values()], consMap }, { bodies: BODIES });
const top = (q, k = 5) => searchSky(idx, q, k);

ok('vega -> Vega first', () => { const r = top('vega'); assert.equal(r[0].title, 'Vega'); assert.equal(r[0].kind, 'star'); assert.equal(r[0].id, 91262); });
ok('alpha lyr, alpha lyrae and α Lyr -> Vega', () => { for (const q of ['alpha lyr', 'alpha lyrae', 'α Lyr', 'Α LYR', 'alp lyr']) assert.equal(top(q)[0].title, 'Vega', q); });
ok('Flamsteed 61 Cyg', () => assert.equal(top('61 cyg')[0].kind, 'star'));
ok('HIP 91262 and HD 172167 (thin space) -> Vega', () => { for (const q of ['HIP 91262', 'hip91262', 'HD 172167', 'hd  172167']) assert.equal(top(q)[0].title, 'Vega', q); });
ok('Acrux is found as alpha cru', () => assert.equal(top('alpha cru')[0].title, 'Acrux'));
ok('m31, M 31, NGC 224 -> Andromeda Galaxy', () => { for (const q of ['m31', 'M 31', 'm 31', 'NGC 224', 'ngc224']) { const r = top(q)[0]; assert.equal(r.kind, 'dso', q); assert.equal(r.id, 'NGC 224'); } });
ok('common name finds a DSO (andromeda: constellation first, galaxy follows)', () => assert.ok(top('andromeda').some((e) => e.kind === 'dso' && e.id === 'NGC 224')));
ok('Cr 140', () => assert.equal(top('cr 140')[0].id, 'Cr 140'));
ok('orion -> the constellation first', () => { const r = top('orion'); assert.equal(r[0].kind, 'cons'); assert.equal(r[0].id, 'Ori'); });
ok('abbreviation ori -> the constellation first', () => assert.equal(top('ori')[0].id, 'Ori'));
ok('mars -> planet', () => { const r = top('mars')[0]; assert.equal(r.kind, 'body'); assert.equal(r.title, 'Mars'); assert.deepEqual(r.sub, ['Planet']); });
ok('sun and moon are bodies', () => { assert.equal(top('sun')[0].id, 'Sun'); assert.equal(top('moon')[0].id, 'Moon'); });
ok('accent-insensitive (the 6-mag set holds no accented star names, so test the query side and a synthetic name)', () => {
  assert.equal(top('Véga')[0].title, 'Vega');
  const e = buildIndex({ stars: { n: 0 }, names: {}, dso: [], cons: [], consMap: new Map() }, { bodies: [] });
  const x = buildIndex({ stars: { n: 1, hip: [1], mag: [2] }, names: { 1: { name: 'Bélénos' } }, dso: [], cons: [], consMap: new Map() });
  assert.equal(e.length, 0); assert.equal(searchSky(x, 'belenos')[0].title, 'Bélénos'); assert.equal(searchSky(x, 'BÉLÉN')[0].title, 'Bélénos');
});
ok('case-insensitive and prefix', () => assert.equal(top('SIRI')[0].title, 'Sirius'));
ok('result row sub-line', () => assert.equal(top('vega')[0].sub.join(' · '), 'Star · Lyra · mag 0.0'));
ok('empty, blank and one-letter queries give nothing', () => { assert.deepEqual(top(''), []); assert.deepEqual(top('   '), []); assert.deepEqual(top('a'), []); });
ok('nonsense gives nothing; limit is honoured', () => { assert.deepEqual(top('zzzzqq'), []); assert.ok(top('alpha', 5).length <= 5); });

const when = Date.UTC(2026, 5, 1, 12);
ok('Acrux never rises from Rome: travel south', () => {
  const s = horizonNote({ Astronomy, name: 'Acrux', ra: 186.65, dec: -63.1, decNow: -63.1, lat: 41.9, lon: 12.5, ms: when, place: 'Rome', clock: true });
  assert.match(s, /^Never rises from Rome: you would need to travel south/);
});
ok('mirror: Polaris never rises from Sydney: travel north', () => {
  assert.match(horizonNote({ Astronomy, name: 'Polaris', ra: 37.95, dec: 89.26, decNow: 89.26, lat: -33.9, lon: 151.2, ms: when, place: 'Sydney', clock: true }), /travel north/);
});
ok('below-horizon star gets a rise time', () => {
  const s = horizonNote({ Astronomy, name: 'Sirius', ra: 101.29, dec: -16.72, decNow: -16.72, lat: 41.9, lon: 12.5, ms: when, place: 'Rome', clock: true });
  assert.match(s, /^Sirius is below your horizon right now\. It rises at \d\d:\d\d( tomorrow)?\.$/);
});
ok('below-horizon planet uses SearchRiseSet; no clock gives the plain note', () => {
  assert.match(horizonNote({ Astronomy, name: 'Mars', body: 'Mars', lat: 41.9, lon: 12.5, ms: when, place: 'Rome', clock: true }), /It rises at \d\d:\d\d/);
  assert.equal(horizonNote({ Astronomy, name: 'Mars', body: 'Mars', lat: 41.9, lon: 12.5, ms: when, place: 'Rome', clock: false }), 'Mars is below your horizon right now.');
});
console.log(`${n} skysearch tests passed`);
