// Built-in list of ~90 major cities (instant fallback + journeys/chips) plus the lazily loaded worldwide
// GeoNames list (data/cities.txt, ~172k places with population >= 1000, CC BY 4.0) for search and naming.
const raw = `Rome|Italy|41.90|12.50
London|United Kingdom|51.51|-0.13
Paris|France|48.86|2.35
Madrid|Spain|40.42|-3.70
Lisbon|Portugal|38.72|-9.14
Berlin|Germany|52.52|13.40
Athens|Greece|37.98|23.73
Istanbul|Turkey|41.01|28.98
Moscow|Russia|55.76|37.62
Stockholm|Sweden|59.33|18.07
Reykjavik|Iceland|64.15|-21.94
Tromsø|Norway|69.65|18.96
Longyearbyen|Svalbard|78.22|15.65
Alert|Canada|82.50|-62.35
Murmansk|Russia|68.97|33.08
Yakutsk|Russia|62.03|129.73
Novosibirsk|Russia|55.03|82.92
Cairo|Egypt|30.04|31.24
Marrakesh|Morocco|31.63|-8.01
Lagos|Nigeria|6.52|3.38
Accra|Ghana|5.60|-0.19
Addis Ababa|Ethiopia|9.03|38.75
Nairobi|Kenya|-1.29|36.82
Kinshasa|DR Congo|-4.44|15.27
Luanda|Angola|-8.84|13.23
Johannesburg|South Africa|-26.20|28.05
Cape Town|South Africa|-33.92|18.42
Windhoek|Namibia|-22.56|17.08
Antananarivo|Madagascar|-18.88|47.51
Dubai|UAE|25.20|55.27
Riyadh|Saudi Arabia|24.71|46.68
Tehran|Iran|35.69|51.39
Karachi|Pakistan|24.86|67.01
Delhi|India|28.61|77.21
Mumbai|India|19.08|72.88
Chennai|India|13.08|80.27
Colombo|Sri Lanka|6.93|79.86
Kathmandu|Nepal|27.72|85.32
Dhaka|Bangladesh|23.81|90.41
Bangkok|Thailand|13.76|100.50
Singapore|Singapore|1.35|103.82
Jakarta|Indonesia|-6.21|106.85
Manila|Philippines|14.60|120.98
Hanoi|Vietnam|21.03|105.85
Hong Kong|China|22.32|114.17
Beijing|China|39.90|116.41
Shanghai|China|31.23|121.47
Ulaanbaatar|Mongolia|47.89|106.91
Seoul|South Korea|37.57|126.98
Tokyo|Japan|35.68|139.69
Sapporo|Japan|43.06|141.35
Perth|Australia|-31.95|115.86
Darwin|Australia|-12.46|130.84
Alice Springs|Australia|-23.70|133.88
Adelaide|Australia|-34.93|138.60
Melbourne|Australia|-37.81|144.96
Sydney|Australia|-33.87|151.21
Brisbane|Australia|-27.47|153.03
Hobart|Australia|-42.88|147.33
Auckland|New Zealand|-36.85|174.76
Wellington|New Zealand|-41.29|174.78
Port Moresby|Papua New Guinea|-9.44|147.18
Suva|Fiji|-18.14|178.44
Honolulu|USA|21.31|-157.86
Anchorage|USA|61.22|-149.90
Vancouver|Canada|49.28|-123.12
San Francisco|USA|37.77|-122.42
Los Angeles|USA|34.05|-118.24
Denver|USA|39.74|-104.99
Mexico City|Mexico|19.43|-99.13
Chicago|USA|41.88|-87.63
Toronto|Canada|43.65|-79.38
New York|USA|40.71|-74.01
Miami|USA|25.76|-80.19
Havana|Cuba|23.11|-82.37
Panama City|Panama|8.98|-79.52
Bogotá|Colombia|4.71|-74.07
Quito|Ecuador|-0.18|-78.47
Lima|Peru|-12.05|-77.04
La Paz|Bolivia|-16.50|-68.15
Manaus|Brazil|-3.12|-60.02
Rio de Janeiro|Brazil|-22.91|-43.17
São Paulo|Brazil|-23.55|-46.63
Santiago|Chile|-33.45|-70.67
Buenos Aires|Argentina|-34.60|-58.38
Punta Arenas|Chile|-53.16|-70.91
Ushuaia|Argentina|-54.80|-68.30
Port Stanley|Falkland Islands|-51.70|-57.85
Grytviken|South Georgia|-54.28|-36.51
Hobart Antarctic gateway|Australia|-42.88|147.33
Cape Town Antarctic gateway|South Africa|-33.92|18.42
McMurdo Station|Antarctica|-77.85|166.67
South Pole Station|Antarctica|-90.00|0.00
North Pole|Arctic|90.00|0.00`;

export const CITIES = raw.split('\n').map((l) => {
  const [name, country, lat, lon] = l.split('|');
  return { name, country, lat: +lat, lon: +lon };
}).filter((c) => !c.name.includes('gateway'));

export const QUICK = [
  { label: 'North Pole', lat: 90, lon: 0, name: 'North Pole' },
  { label: 'Equator (Quito)', lat: -0.18, lon: -78.47, name: 'Quito' },
  { label: 'Sydney', lat: -33.87, lon: 151.21, name: 'Sydney' },
  { label: 'South Pole', lat: -90, lon: 0, name: 'South Pole Station' },
];

export const byName = (n) => CITIES.find((c) => c.name === n);

const DEG = Math.PI / 180;
function hav(lat1, lon1, lat2, lon2) {
  const r = DEG, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function nearestCity(lat, lon) {
  let best = null, bd = 1e9;
  for (const c of CITIES) { const d = hav(lat, lon, c.lat, c.lon); if (d < bd) { bd = d; best = c; } }
  return { city: best, km: bd };
}

export function formatCoord(lat, lon) {
  const a = Math.abs(lat).toFixed(2), o = Math.abs(lon).toFixed(2);
  return `${a}°${lat >= 0 ? 'N' : 'S'}  ${o}°${lon >= 0 ? 'E' : 'W'}`;
}

// ---------------------------------------------------------------------------------------------
// Worldwide place index (lazy). Layout of data/cities.txt is documented in tools/build_cities.py.
// ---------------------------------------------------------------------------------------------
const SPECIAL = { 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i', 'ħ': 'h' };
const RE_SPECIAL = /[øæœßłđðþıħ]/g, RE_MARKS = /[̀-ͯ]/g, RE_SEP = /[-–'’.]+/g, ASCII = /^[\x20-\x7e]*$/;
/** Lower-case, strip diacritics, fold a few special letters, hyphens/apostrophes -> space. */
export function norm(s) {
  s = s.toLowerCase();
  if (!ASCII.test(s)) s = s.replace(RE_SPECIAL, (c) => SPECIAL[c]).normalize('NFD').replace(RE_MARKS, '');
  return s.replace(RE_SEP, ' ').replace(/\s+/g, ' ').trim();
}

let P = null;            // loaded index
let loadPromise = null;
let loadState = 'idle';  // idle | loading | ready | error
const listeners = new Set();
export const placesState = () => loadState;
export const placesReady = () => !!P;
export const onPlaces = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const tick = () => new Promise((r) => setTimeout(r, 0));
const b36 = (s) => parseInt(s, 36);

/** Fetch + index data/cities.txt once. Safe to call repeatedly; never throws. */
export function loadPlaces(url = 'data/cities.txt') {
  if (loadPromise) return loadPromise;
  loadState = 'loading'; listeners.forEach((f) => f(loadState));
  loadPromise = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('cities ' + res.status);
    const text = await res.text();
    await tick();
    const nl = text.indexOf('\n'), hdr = JSON.parse(text.slice(0, nl)), N = hdr.n;
    const lat = new Int32Array(N), lon = new Int32Array(N), pop = new Int32Array(N), grp = new Uint16Array(N);
    const names = new Array(N), extra = new Map();            // extra: idx -> [ascii, alts[]]
    const keys = new Array(N), akeys = [], aown = [];
    let pos = nl + 1, i = 0;
    for (let g = 0; g < hdr.groups.length; g++) {
      let prev = 0;
      for (let k = hdr.groups[g][2]; k > 0; k--, i++) {
        let e = text.indexOf('\n', pos); if (e < 0) e = text.length;
        const f = text.slice(pos, e).split('\t'); pos = e + 1;
        names[i] = f[0]; prev += b36(f[1]); lat[i] = prev; lon[i] = b36(f[2]); pop[i] = b36(f[3]); grp[i] = g;
        const nk = norm(f[0]); keys[i] = nk;
        if (f.length > 4) {
          const al = f[5] ? f[5].split('|') : [];
          extra.set(i, [f[4], al]);
          if (f[4]) { const ak = norm(f[4]); if (ak !== nk) { akeys.push(ak); aown.push(i); } }
          for (let j = 0; j < al.length; j++) { const ak = norm(al[j]); if (ak !== nk) { akeys.push(ak); aown.push(i); } }
        }
        if ((i & 16383) === 16383) await tick();
      }
    }
    // search entries in population order: primary keys then alternates (stable by owner popularity)
    const order = new Int32Array(N); for (let j = 0; j < N; j++) order[j] = j;
    order.sort((a, b) => pop[b] - pop[a] || a - b);
    const rank = new Int32Array(N); for (let j = 0; j < N; j++) rank[order[j]] = j;
    const M = N + akeys.length, eKey = new Array(M), eOwn = new Int32Array(M), eAlt = new Uint8Array(M);
    const ent = new Int32Array(M); for (let j = 0; j < M; j++) ent[j] = j;
    const ownOf = (j) => (j < N ? j : aown[j - N]);
    ent.sort((a, b) => rank[ownOf(a)] - rank[ownOf(b)] || a - b);
    for (let j = 0; j < M; j++) { const x = ent[j]; eOwn[j] = ownOf(x); eAlt[j] = x < N ? 0 : 1; eKey[j] = x < N ? keys[x] : akeys[x - N]; }
    await tick();
    // 1-degree grid for "nearest place" naming
    const CELLS = 180 * 360, cstart = new Int32Array(CELLS + 1), cell = new Int32Array(N);
    for (let j = 0; j < N; j++) { cell[j] = cellOf(lat[j] / 1e4 - 90, lon[j] / 1e4 - 180); cstart[cell[j] + 1]++; }
    for (let c = 0; c < CELLS; c++) cstart[c + 1] += cstart[c];
    const fill = cstart.slice(0, CELLS), citems = new Int32Array(N);
    for (let j = 0; j < N; j++) citems[fill[cell[j]]++] = j;
    P = { N, lat, lon, pop, grp, names, extra, groups: hdr.groups, keys, eKey, eOwn, eAlt, M, cstart, citems };
    nameCache.clear(); loadState = 'ready'; listeners.forEach((f) => f(loadState));
    return P;
  })().catch((err) => { loadState = 'error'; loadPromise = null; listeners.forEach((f) => f(loadState)); console.warn('places not loaded', err); return null; });
  return loadPromise;
}
function cellOf(lat, lon) {
  const r = Math.min(179, Math.max(0, Math.floor(lat + 90))), c = ((Math.floor(lon + 180) % 360) + 360) % 360;
  return r * 360 + c;
}
const placeLat = (j) => P.lat[j] / 1e4 - 90, placeLon = (j) => P.lon[j] / 1e4 - 180;
function describe(j, via) {
  const g = P.groups[P.grp[j]], name = P.names[j], region = g[1] && g[1] !== name ? g[1] : '';
  const x = P.extra.get(j);
  return { name, region, country: g[0], lat: placeLat(j), lon: placeLon(j), pop: P.pop[j], ascii: x ? x[0] : '', via: via || '', idx: j, kind: 'place' };
}
/** Compact population hint: 2.1 M, 340 k, 4.2 k */
export function popHint(p) {
  if (p >= 1e6) return (p / 1e6).toFixed(p >= 1e7 ? 0 : 1).replace(/\.0$/, '') + ' M';
  if (p >= 1e4) return Math.round(p / 1e3) + ' k';
  return (p / 1e3).toFixed(1).replace(/\.0$/, '') + ' k';
}

/** Parse "45.07, 7.69", "45.07N 7.69E", "45°04'N 7°41'E", "S33.9 E151.2" -> {lat, lon} or null. */
export function parseCoords(q) {
  q = q.trim().replace(/[°º]/g, ' ').replace(/[′’']/g, ' ').replace(/[″"]/g, ' ').replace(/,/g, ' ').replace(/\s+/g, ' ');
  const tok = '([NSEW])?\\s*([+-]?\\d{1,3}(?:\\.\\d+)?)(?:\\s(\\d{1,2}(?:\\.\\d+)?))?(?:\\s(\\d{1,2}(?:\\.\\d+)?))?\\s*([NSEW])?';
  const m = new RegExp('^' + tok + '\\s+' + tok + '$', 'i').exec(q);
  if (!m) return null;
  const one = (pre, d, mi, se, post) => {
    let v = Math.abs(parseFloat(d)) + (mi ? parseFloat(mi) / 60 : 0) + (se ? parseFloat(se) / 3600 : 0);
    if (String(d).startsWith('-')) v = -v;
    const h = (pre || post || '').toUpperCase();
    if (pre && post) return null;
    return { v: (h === 'S' || h === 'W') ? -Math.abs(v) : v, h };
  };
  const a = one(m[1], m[2], m[3], m[4], m[5]), b = one(m[6], m[7], m[8], m[9], m[10]);
  if (!a || !b) return null;
  let lat, lon;
  if (a.h === 'E' || a.h === 'W' || b.h === 'N' || b.h === 'S') { lon = a.v; lat = b.v; } else { lat = a.v; lon = b.v; }
  if ((a.h === 'N' || a.h === 'S') && (b.h === 'N' || b.h === 'S')) return null;
  if ((a.h === 'E' || a.h === 'W') && (b.h === 'E' || b.h === 'W')) return null;
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
  return { lat, lon };
}

const isWordStart = (k, i) => i === 0 || k.charCodeAt(i - 1) === 32;
/**
 * Worldwide search. Tiers: 0 exact, 1 prefix, 2 word-prefix, 3 substring; each ranked by population.
 * Accepts "name, region/country" (anything after a comma must match the region or country).
 * Returns [] until the file is loaded.
 */
export function searchPlaces(query, limit = 8) {
  if (!P) return [];
  let ctx = '', q = query;
  const comma = query.indexOf(',');
  if (comma > 0) { q = query.slice(0, comma); ctx = norm(query.slice(comma + 1)); }
  q = norm(q);
  if (q.length < 1) return [];
  const b = [[], [], [], []], { eKey, eOwn, eAlt, M } = P, qlen = q.length;
  const seen = new Set();
  for (let j = 0; j < M; j++) {
    const k = eKey[j], i = k.indexOf(q);
    if (i < 0) continue;
    let t = 3;
    if (i === 0) t = k.length === qlen ? 0 : 1; else if (isWordStart(k, i)) t = 2;
    else { const w = k.indexOf(' ' + q); if (w >= 0) t = 2; }
    const bt = b[t]; if (bt.length >= limit) continue;
    const o = eOwn[j];
    if (seen.has(o)) continue;
    if (ctx) { const g = P.groups[P.grp[o]]; if (!norm(g[0]).includes(ctx) && !norm(g[1]).includes(ctx)) continue; }
    seen.add(o); bt.push(eAlt[j] ? o + 0.5 : o);       // .5 marks "matched via alternate name"
    if (t === 0 && bt.length >= limit) break;
  }
  const out = [];
  for (let t = 0; t < 4 && out.length < limit; t++) for (const o of b[t]) {
    if (out.length >= limit) break;
    const idx = Math.floor(o), via = o !== idx ? matchedAlt(idx, q) : '';
    out.push(Object.assign(describe(idx, via), { tier: t }));
  }
  return out;
}
function matchedAlt(idx, q) {
  const x = P.extra.get(idx); if (!x) return '';
  const all = x[1].concat(x[0] ? [x[0]] : []);
  let best = '';
  for (const a of all) { const k = norm(a); if (k.startsWith(q)) return a; if (!best && k.includes(q)) best = a; }
  return best;
}

// --- naming arbitrary points -------------------------------------------------------------------
const nameCache = new Map();
/** Best nearby place: nearest, but a bigger place wins over a hamlet at similar distance. */
function nearestPlace(lat, lon, R) {
  const latC = Math.floor(lat + 90), dr = Math.ceil(R / 111) + 0;
  const cosl = Math.max(Math.cos(Math.min(Math.abs(lat) + R / 111, 89) * DEG), 0.02);
  const dc = Math.min(180, Math.ceil(R / (111 * cosl)));
  const lonC = Math.floor(lon + 180);
  let best = -1, bs = 1e9, bk = 0;
  for (let r = Math.max(0, latC - dr); r <= Math.min(179, latC + dr); r++) {
    for (let d = -dc; d <= dc; d++) {
      const c = r * 360 + ((((lonC + d) % 360) + 360) % 360);
      for (let a = P.cstart[c], e = P.cstart[c + 1]; a < e; a++) {
        const j = P.citems[a], km = hav(lat, lon, placeLat(j), placeLon(j));
        if (km > R) continue;
        const score = km / (1 + Math.log10(Math.max(P.pop[j], 500) / 500));
        if (score < bs) { bs = score; best = j; bk = km; }
      }
    }
  }
  return best < 0 ? null : { j: best, km: bk };
}
export function nearestPlaceInfo(lat, lon) {
  if (!P) return null;
  const r = nearestPlace(lat, lon, 100) || nearestPlace(lat, lon, 450);
  return r ? { place: describe(r.j), km: r.km } : null;
}

/** Human place name: at a place -> its name, nearby -> "Near X", else distance from the closest city. */
export function placeName(lat, lon) {
  if (lat >= 89.9) return { title: 'North Pole', sub: 'Arctic' };
  if (lat <= -89.9) return { title: 'South Pole', sub: 'Antarctica' };
  if (P) {
    const key = Math.round(lat * 50) * 100000 + Math.round(lon * 50);
    let r = nameCache.get(key);
    if (!r) {
      r = bigName(lat, lon);
      if (nameCache.size > 400) nameCache.clear();
      nameCache.set(key, r);
    }
    return r;
  }
  return legacyName(lat, lon);
}
function legacyName(lat, lon) {
  const { city, km } = nearestCity(lat, lon);
  if (km < 40) return { title: city.name, sub: city.country };
  if (km < 300) return { title: `Near ${city.name}`, sub: city.country };
  return farName(lat, lon, city, km);
}
function farName(lat, lon, city, km) {
  const tag = Math.abs(lat) > 66.5 ? (lat > 0 ? 'Arctic' : 'Antarctic') : lat > 0 ? 'Northern hemisphere' : 'Southern hemisphere';
  const km50 = Math.round(km / 50) * 50;
  return { title: `${km50.toLocaleString('en-US')} km from ${city.name}`, sub: tag, short: formatCoord(lat, lon).replace(/\s+/g, ' ') };
}
function bigName(lat, lon) {
  const c = nearestCity(lat, lon);
  if (c.km < 15) return { title: c.city.name, sub: c.city.country };            // a built-in major city / station wins at its centre
  const r = nearestPlace(lat, lon, 100) || nearestPlace(lat, lon, 450);
  if (!r) return legacyName(lat, lon);
  const p = describe(r.j), sub = [p.region, p.country].filter(Boolean).join(', ');
  if (r.km <= 6 || (r.km <= 15 && p.pop >= 100000)) return { title: p.name, sub };
  if (r.km <= 300) return { title: `Near ${p.name}`, sub };
  return legacyName(lat, lon);
}

/** Built-in short list search (instant fallback until the worldwide file is loaded). */
export function searchCities(q, limit = 7) {
  const nq = norm(q);
  if (!nq) return [];
  const scored = [];
  for (const c of CITIES) {
    const n = norm(c.name), k = norm(c.country);
    let s = -1;
    if (n.startsWith(nq)) s = 0; else if (n.includes(nq)) s = 1; else if (k.startsWith(nq)) s = 2;
    if (s >= 0) scored.push([s, c]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));
  return scored.slice(0, limit).map((x) => Object.assign({ region: '', via: '', pop: 0, kind: 'place' }, x[1]));
}
