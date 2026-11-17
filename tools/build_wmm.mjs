// Convert NOAA's WMM2025.COF into data/wmm2025.json.  Usage: node tools/build_wmm.mjs <path-to-WMM2025.COF>
import fs from 'node:fs';
const src = process.argv[2];
if (!src) { console.error('usage: node tools/build_wmm.mjs <WMM2025.COF>'); process.exit(1); }
const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
const [epoch, name] = lines[0].trim().split(/\s+/);
if (name !== 'WMM-2025' || +epoch !== 2025) throw new Error('unexpected COF header: ' + lines[0]);
const coef = [];
for (const l of lines.slice(1)) {
  const t = l.trim().split(/\s+/);
  if (t.length !== 6) continue; // skips the trailing 9999 lines
  coef.push(t.map(Number));
}
if (coef.length !== 90) throw new Error('expected 90 coefficient rows, got ' + coef.length);
const head = { model: 'WMM-2025', epoch: 2025.0, released: '2024-11-13', validFrom: 2025.0, validTo: 2030.0,
  source: 'NOAA NCEI World Magnetic Model 2025 (public domain), WMM2025.COF' };
const out = JSON.stringify(head).slice(0, -1) + ',"coef":[\n' + coef.map((r) => JSON.stringify(r)).join(',\n') + '\n]}\n';
fs.writeFileSync(new URL('../data/wmm2025.json', import.meta.url), out);
console.log('wrote data/wmm2025.json with', coef.length, 'coefficients');
