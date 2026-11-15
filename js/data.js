// Loading and parsing of the d3-celestial data sets into compact typed structures.
import { eqToVec, norm360, normalize, bvToTemp, spectralClass } from './astro.js';

const j = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });

// Distances in light-years for well-known stars only (HIP -> ly). Nothing else is invented.
export const DISTANCES = {
  32349: 8.6, 30438: 310, 71683: 4.37, 69673: 36.7, 91262: 25, 24608: 42.9, 24436: 860, 37279: 11.5,
  7588: 139, 27989: 550, 68702: 390, 97649: 16.7, 60718: 320, 21421: 65, 80763: 550, 65474: 250,
  37826: 34, 113368: 25, 102098: 2600, 62434: 280, 49669: 79, 11767: 430,
};
const APPROX = new Set([27989, 102098, 11767]);
export const distanceText = (hip) => (DISTANCES[hip] ? `${APPROX.has(hip) ? '~' : ''}${DISTANCES[hip].toLocaleString('en')} light-years` : null);
/** Distance text from the HYG-derived table (light-years): rounded sensibly, "about" when it is far enough to be uncertain. */
export function distanceFromLy(ly) {
  if (!ly) return null;
  if (ly < 100) return `${ly.toFixed(1)} light-years`;
  const r = ly < 1000 ? Math.round(ly / 5) * 5 : Math.round(ly / 50) * 50;
  return `${ly >= 300 ? '~' : ''}${r.toLocaleString('en')} light-years`;
}

export const DSO_NAMES = {
  'PGC 17223': 'Large Magellanic Cloud', 'NGC 292': 'Small Magellanic Cloud', 'NGC 224': 'Andromeda Galaxy', 'NGC 598': 'Triangulum Galaxy',
  'NGC 1976': 'Orion Nebula', 'M 45': 'Pleiades', 'C 41': 'Hyades', 'NGC 2632': 'Beehive Cluster', 'NGC 3372': 'Carina Nebula',
  'NGC 5139': 'Omega Centauri', 'NGC 104': '47 Tucanae', 'IC 2602': 'Southern Pleiades', 'IC 2391': 'Omicron Velorum Cluster',
  'NGC 869': 'Double Cluster (h Per)', 'NGC 884': 'Double Cluster (chi Per)', 'M 8': 'Lagoon Nebula', 'NGC 6611': 'Eagle Nebula',
  'NGC 6475': 'Ptolemy Cluster (M7)', 'NGC 6405': 'Butterfly Cluster (M6)', 'NGC 2244': 'Rosette Cluster', 'NGC 6121': 'Messier 4',
  'NGC 2516': 'Southern Beehive', 'NGC 3532': 'Wishing Well Cluster', 'GC': 'Galactic Centre', 'Cr 256': 'Coma Star Cluster', 'C 41': 'Hyades',
  'Cr 399': 'Brocchi’s Cluster', 'NGC 6231': 'NGC 6231 cluster', 'Cr 140': 'Collinder 140', 'Cr 39': 'Alpha Persei Cluster',
  'NGC 2264': 'Christmas Tree Cluster', 'NGC 2362': 'Tau Canis Majoris Cluster', 'NGC 2451': 'NGC 2451 cluster',
};
const DSO_TYPES = { oc: 'open cluster', gc: 'globular cluster', sd: 'galaxy', s: 'galaxy', i: 'galaxy', sfr: 'star-forming nebula', en: 'emission nebula', pos: 'region' };

export async function loadData(onProgress = () => {}) {
  const [stars, names, cons, lines, mw, dsos, extra] = await Promise.all([
    j('data/stars.6.json'), j('data/starnames.json'), j('data/constellations.json'),
    j('data/constellations.lines.json'), j('data/mw.json'), j('data/dsos.bright.json'),
    j('data/starextra.json').catch(() => null),   // proper motion, distance, spectral type (tools/build_starextra.py); optional
  ]);
  onProgress(0.8);

  // constellations (Serpens appears twice: merge)
  const consMap = new Map();
  for (const f of cons.features) {
    const p = f.properties;
    const [lra, ldec] = f.geometry.coordinates;
    let c = consMap.get(f.id);
    if (!c) {
      c = { id: f.id, name: p.name, gen: p.gen, en: p.en || p.name, rank: +p.rank || 3, labels: [], segs: [] };
      consMap.set(f.id, c);
    }
    c.labels.push({ ra: norm360(lra), dec: ldec, eq: eqToVec(norm360(lra), ldec) });
  }
  for (const f of lines.features) {
    const c = consMap.get(f.id); if (!c) continue;
    for (const ls of f.geometry.coordinates) c.segs.push(ls.map(([ra, dec]) => [norm360(ra), dec]));
  }
  for (const c of consMap.values()) {
    const sum = [0, 0, 0]; const decs = []; let nv = 0;
    for (const s of c.segs) for (const [ra, dec] of s) { const v = eqToVec(ra, dec); sum[0] += v[0]; sum[1] += v[1]; sum[2] += v[2]; decs.push(dec); nv++; }
    c.decs = decs.length ? decs : [c.labels[0].dec];
    c.vecs = new Float32Array(nv * 3); let k = 0;                      // vertex directions, to re-derive declinations for another epoch
    for (const s of c.segs) for (const [ra, dec] of s) { const v = eqToVec(ra, dec); c.vecs[k++] = v[0]; c.vecs[k++] = v[1]; c.vecs[k++] = v[2]; }
    c.center = nv ? normalize(sum) : c.labels[0].eq.slice();
    c.label = c.labels[0];
  }

  // stars
  const feats = stars.features, n = feats.length;
  const S = { n, ra: new Float32Array(n), dec: new Float32Array(n), mag: new Float32Array(n), bv: new Float32Array(n), hip: new Int32Array(n), eq: new Float32Array(n * 3) };
  const tmp = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const f = feats[i], [ra, dec] = f.geometry.coordinates, r = norm360(ra);
    S.ra[i] = r; S.dec[i] = dec; S.mag[i] = f.properties.mag; S.hip[i] = f.id;
    const bv = parseFloat(f.properties.bv); S.bv[i] = Number.isFinite(bv) ? bv : 0.6;
    eqToVec(r, dec, tmp); S.eq[i * 3] = tmp[0]; S.eq[i * 3 + 1] = tmp[1]; S.eq[i * 3 + 2] = tmp[2];
  }
  const hipIndex = new Map(); for (let i = 0; i < n; i++) hipIndex.set(S.hip[i], i);
  // proper motion (mas/yr; pmra includes cos dec), distance (ly) and spectral type from HYG
  S.pmra = new Float32Array(n); S.pmdec = new Float32Array(n); S.ly = new Float32Array(n); S.spect = new Array(n).fill('');
  S.hasPm = false;
  if (extra) {
    for (let k = 0; k < extra.hip.length; k++) {
      const i = hipIndex.get(extra.hip[k]); if (i === undefined) continue;
      S.pmra[i] = extra.pmra[k] || 0; S.pmdec[i] = extra.pmdec[k] || 0; S.ly[i] = extra.ly[k] || 0; S.spect[i] = extra.spect[k] || '';
    }
    S.hasPm = true;
  }

  const GREEK = { alp: 'α', bet: 'β', gam: 'γ', del: 'δ', eps: 'ε', zet: 'ζ', eta: 'η', the: 'θ', iot: 'ι', kap: 'κ', lam: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omi: 'ο', pi: 'π', rho: 'ρ', sig: 'σ', tau: 'τ', ups: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', ome: 'ω' };
  function starInfo(i) {
    const hip = S.hip[i], nm = names[hip] || {}, c = consMap.get(nm.c);
    const bayer = nm.desig || nm.bayer || '';
    let title;
    if (nm.name) title = nm.name;
    else if (bayer && c) title = `${GREEK[bayer] || bayer} ${c.gen}`;
    else if (nm.flam && c) title = `${nm.flam} ${c.gen}`;
    else title = `HIP ${hip}`;
    let designation = '';
    if (nm.name && bayer && c) designation = `${GREEK[bayer] || bayer} ${c.gen}`;
    else if (nm.name && nm.flam && c) designation = `${nm.flam} ${c.gen}`;
    return { hip, name: nm.name || '', title, designation, cons: c || null, bv: S.bv[i], mag: S.mag[i], dist: distanceText(hip) || distanceFromLy(S.ly[i]), spectral: S.spect[i] || '', pm: Math.hypot(S.pmra[i], S.pmdec[i]), temp: bvToTemp(S.bv[i]), spec: spectralClass(S.bv[i]) };
  }

  // named stars to label (mag-sorted priority)
  const named = [];
  for (let i = 0; i < n; i++) { const nm = names[S.hip[i]]; if (nm && nm.name && S.mag[i] < 3.3) named.push(i); }
  named.sort((a, b) => S.mag[a] - S.mag[b]);

  const dso = dsos.features.map((f) => {
    const [ra, dec] = f.geometry.coordinates, r = norm360(ra), p = f.properties;
    const d = String(p.dim).split('x').map(parseFloat)[0] || 10;
    return { id: f.id, name: DSO_NAMES[f.id] || DSO_NAMES[p.desig] || p.desig, desig: p.desig, type: DSO_TYPES[p.type] || p.type, mag: p.mag, dim: d / 60, ra: r, dec, eq: eqToVec(r, dec) };
  });

  onProgress(1);
  return { stars: S, hipIndex, starInfo, cons: [...consMap.values()], consMap, named, dso, mw, names };
}
