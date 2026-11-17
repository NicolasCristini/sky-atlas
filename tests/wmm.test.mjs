import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wmmField, declination, decimalYear, inValidRange } from '../js/ar/wmm.js';
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok -', name); };
const model = JSON.parse(fs.readFileSync(new URL('../data/wmm2025.json', import.meta.url)));
const rows = fs.readFileSync(new URL('./data/WMM2025_TestValues.txt', import.meta.url), 'utf8')
  .split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.trim().split(/\s+/).map(Number));

ok('model file has 90 coefficients and the WMM-2025 header', () => {
  assert.equal(model.coef.length, 90); assert.equal(model.model, 'WMM-2025'); assert.equal(model.epoch, 2025);
});

let maxD = 0, maxI = 0, maxC = 0;
ok(`official NOAA test values (${rows.length} rows): D,I within 0.01 deg; X,Y,Z,H,F within 0.5 nT`, () => {
  assert.equal(rows.length, 100);
  for (const [yr, alt, lat, lon, D, I, H, X, Y, Z, F] of rows) {
    const f = wmmField(model, lat, lon, alt, yr), tag = `row ${yr} ${alt}km ${lat},${lon}`;
    let dD = Math.abs(f.dec - D); if (dD > 180) dD = 360 - dD;
    maxD = Math.max(maxD, dD); maxI = Math.max(maxI, Math.abs(f.inc - I));
    assert.ok(dD <= 0.01, `${tag}: D ${f.dec} vs ${D}`);
    assert.ok(Math.abs(f.inc - I) <= 0.01, `${tag}: I ${f.inc} vs ${I}`);
    for (const [k, v] of [['X', X], ['Y', Y], ['Z', Z], ['H', H], ['F', F]]) {
      const d = Math.abs(f[k] - v); maxC = Math.max(maxC, d);
      assert.ok(d <= 0.5, `${tag}: ${k} ${f[k]} vs ${v}`);
    }
  }
  console.log(`   max |dD| ${maxD.toFixed(4)} deg, max |dI| ${maxI.toFixed(4)} deg, max component error ${maxC.toFixed(4)} nT`);
});

// Independent reference: pygeomag 1.1.0 (Python), GeoMag(coefficients_file='wmm/WMM_2025.COF').calculate(glat, glon, alt=0, time=2026.0).d
// NOAA's online calculator needs an API key, so it was not used.
const cities = [
  ['Rome', 41.9028, 12.4964, 4.002126663956113],
  ['Sydney', -33.8688, 151.2093, 12.810001720011787],
  ['New York', 40.7128, -74.0060, -12.494268368635483],
  ['Reykjavik', 64.1466, -21.9426, -11.283841923559665],
];
ok('cities: declination at 2026.0 within 0.5 deg of the pygeomag reference', () => {
  for (const [name, lat, lon, ref] of cities) {
    const d = declination(model, lat, lon, 2026.0);
    console.log(`   ${name}: ours ${d.toFixed(3)}  ref ${ref.toFixed(3)}`);
    assert.ok(Math.abs(d - ref) <= 0.5, `${name}: ${d} vs ${ref}`);
  }
});

ok('decimalYear: UTC, leap years, year boundaries', () => {
  assert.equal(decimalYear(Date.UTC(2026, 0, 1)), 2026);
  assert.ok(Math.abs(decimalYear(Date.UTC(2024, 6, 2)) - 2024.5) < 0.003);       // 2024 is a leap year: 366 days
  assert.ok(Math.abs(decimalYear(Date.UTC(2026, 6, 2, 12)) - 2026.5) < 0.001);
  assert.ok(decimalYear(Date.UTC(2026, 11, 31, 23, 59)) < 2027);
});
ok('inValidRange: 2025..2030 only', () => {
  assert.ok(inValidRange(model, 2026.3)); assert.ok(!inValidRange(model, 2024.9)); assert.ok(!inValidRange(model, 2030.1));
});
ok('exact poles are finite (nudge)', () => {
  for (const lat of [90, -90]) { const f = wmmField(model, lat, 0, 0, 2026); assert.ok(Number.isFinite(f.dec) && Number.isFinite(f.F)); }
});
console.log(`\n${n} tests passed`);
