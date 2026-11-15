// Content for the "Why the sky changed" panel. Pure functions that return HTML strings.
import { classifyVisibility, visibleFraction, DEG } from './astro.js';
import { placeName } from './cities.js';

const NOTABLE = ['Cru', 'Cen', 'Car', 'Ori', 'UMa', 'UMi', 'Sco', 'Sgr', 'CMa', 'Leo', 'Tau', 'Gem', 'Cyg', 'Lyr', 'Aql', 'Cas', 'Peg', 'And', 'Per', 'Aur', 'Boo', 'Vir', 'Eri', 'Pav', 'Tuc', 'Dor', 'Hyi', 'Vel', 'Pup', 'Lup', 'Mus', 'Cha', 'Aps', 'Oct', 'Tri', 'Dra', 'Cep'];
const NOTE_IDX = new Map(NOTABLE.map((id, i) => [id, i]));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtLat = (l) => `${Math.abs(l).toFixed(1)}°${l >= 0 ? 'N' : 'S'}`;

const _cache = new Map();
/** Classify every constellation: 'always' (all circumpolar), 'never' (never rises), 'sometimes'. */
/** ep = { P, tag }: optional precession matrix (our axes) of another epoch; declinations are then re-derived for that date. */
const decsOfDate = (c, P) => { const o = []; for (let k = 0; k < c.vecs.length; k += 3) o.push(Math.asin(Math.max(-1, Math.min(1, P[3] * c.vecs[k] + P[4] * c.vecs[k + 1] + P[5] * c.vecs[k + 2]))) / DEG); return o; };
export function classifyConstellations(data, lat, ep) {
  const key = lat.toFixed(2) + '|' + (ep ? ep.tag : '');
  if (_cache.has(key)) return _cache.get(key);
  const res = { always: [], sometimes: [], never: [], byId: new Map() };
  for (const c of data.cons) {
    let nc = 0, nn = 0, n = 0;
    for (const d of (ep && c.vecs && c.vecs.length ? decsOfDate(c, ep.P) : c.decs)) { const k = classifyVisibility(d, lat).kind; n++; if (k === 'circumpolar') nc++; else if (k === 'never') nn++; }
    let state = 'sometimes', coverage = 'full';
    if (nn === n) { state = 'never'; coverage = 'none'; } else if (nc === n) { state = 'always'; } else if (nn > 0) coverage = 'partial';
    const o = { c, state, coverage };
    res.byId.set(c.id, o); res[state].push(c);
  }
  const order = (a, b) => (NOTE_IDX.has(a.id) ? NOTE_IDX.get(a.id) : 99 + (a.rank || 3) * 10) - (NOTE_IDX.has(b.id) ? NOTE_IDX.get(b.id) : 99 + (b.rank || 3) * 10) || a.name.localeCompare(b.name);
  for (const k of ['always', 'sometimes', 'never']) res[k].sort(order);
  if (_cache.size > 400) _cache.clear();
  _cache.set(key, res);
  return res;
}

export function constellationVisibility(data, id, lat, ep) {
  const o = classifyConstellations(data, lat, ep).byId.get(id);
  if (!o) return { text: '', cls: 'rs' };
  if (o.state === 'never') return { text: 'Never rises from here', cls: 'nev' };
  if (o.state === 'always') return { text: 'Always above the horizon (circumpolar)', cls: 'circ' };
  if (o.coverage === 'partial') return { text: 'Partly visible: its lower stars never rise here', cls: 'rs' };
  return { text: 'Fully visible at some time of night or year', cls: 'rs' };
}

function diagramSVG(lat) {
  const phi = Math.abs(lat), cx = 160, cy = 112, R = 86, s = lat >= 0 ? 1 : -1;
  const pt = (a, side = s, r = R) => [cx + side * r * Math.cos(a * DEG), cy - r * Math.sin(a * DEG)];
  const arc = (a0, a1, side, vertical) => {
    const p0 = vertical ? [cx + side * R * Math.cos(a0 * DEG), cy + R * Math.sin(a0 * DEG)] : pt(a0, side);
    const p1 = vertical ? [cx + side * R * Math.cos(a1 * DEG), cy + R * Math.sin(a1 * DEG)] : pt(a1, side);
    const sweep = vertical ? (side === 1 ? 1 : 0) : (side === 1 ? 0 : 1);
    return `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${R} ${R} 0 0 ${sweep} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
  };
  const pole = pt(phi), oppSide = -s;
  const labelPole = lat >= 0 ? 'NCP' : 'SCP';
  const capUp = phi > 0.5 ? `<path d="${arc(0, Math.min(2 * phi, 180), s, false)}" fill="none" stroke="var(--accent)" stroke-width="9" stroke-linecap="butt" opacity=".9"/>` : '';
  const capDown = phi > 0.5 ? `<path d="${arc(0, Math.min(2 * phi, 180), oppSide, true)}" fill="none" stroke="#ff8a7a" stroke-width="9" opacity=".75"/>` : '';
  const ax = pt(phi / 2 + 0.01, s, 38);
  return `<svg class="diagram" viewBox="0 0 320 232" role="img" aria-label="Celestial pole is ${phi.toFixed(0)} degrees above the horizon">
    <defs><linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16264a" stop-opacity=".75"/><stop offset="1" stop-color="#0b1226" stop-opacity=".2"/></linearGradient></defs>
    <path d="M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy} Z" fill="url(#gSky)"/>
    <path d="M${cx - R} ${cy} A${R} ${R} 0 0 0 ${cx + R} ${cy} Z" fill="#05070d" opacity=".6"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(176,200,255,.3)" stroke-dasharray="2 4"/>
    ${capUp}${capDown}
    <line x1="${cx - R - 16}" y1="${cy}" x2="${cx + R + 16}" y2="${cy}" stroke="#cfe0ff" stroke-width="1.5"/>
    <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - R - 6}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3"/>
    <line x1="${cx}" y1="${cy}" x2="${pole[0].toFixed(1)}" y2="${pole[1].toFixed(1)}" stroke="#ffd98a" stroke-width="1.8"/>
    <path d="M${(cx + s * 40).toFixed(1)} ${cy} A40 40 0 0 ${s === 1 ? 0 : 1} ${pt(phi, s, 40)[0].toFixed(1)} ${pt(phi, s, 40)[1].toFixed(1)}" fill="none" stroke="#ffd98a" stroke-width="1.5"/>
    <text x="${(cx + s * 52).toFixed(1)}" y="${cy - 5}" fill="#ffd98a" font-size="11" text-anchor="${s === 1 ? 'start' : 'end'}" style="font-variant-numeric:tabular-nums">${phi.toFixed(1)}°</text>
    <circle cx="${pole[0].toFixed(1)}" cy="${pole[1].toFixed(1)}" r="4" fill="#ffd98a"/>
    <text x="${(pole[0] + s * 8).toFixed(1)}" y="${(pole[1] - 6).toFixed(1)}" fill="#ffd98a" font-size="11" font-weight="600" text-anchor="${s === 1 ? 'start' : 'end'}">${labelPole}</text>
    <circle cx="${cx}" cy="${cy}" r="3.5" fill="#fff"/>
    <text x="${cx - 8}" y="${cy - R - 10}" fill="#fff" font-size="10" text-anchor="end" opacity=".7">zenith</text>
    <text x="${cx + R + 14}" y="${cy + 16}" fill="#cfe0ff" font-size="12" font-weight="600" text-anchor="end">N</text>
    <text x="${cx - R - 14}" y="${cy + 16}" fill="#cfe0ff" font-size="12" font-weight="600" text-anchor="start">S</text>
    <text x="${cx}" y="${cy + R + 22}" fill="#7e8cab" font-size="10.5" text-anchor="middle">side view of your sky (looking east)</text>
  </svg>`;
}

export function liveHTML(data, lat, lon, ep) {
  const phi = Math.abs(lat), cls = classifyConstellations(data, lat, ep);
  const hemi = lat >= 0 ? 'north' : 'south';
  const pct = visibleFraction(lat) * 100;
  let line;
  if (phi < 0.5) line = `At the equator both celestial poles sit <b>on your horizon</b>, so every star rises and sets, and the whole sky is visible over a year.`;
  else if (phi > 89.5) line = `At the ${hemi} pole the celestial pole is <b>straight overhead</b>: stars circle around you parallel to the horizon and never rise or set.`;
  else line = `The ${hemi} celestial pole is <b>${phi.toFixed(1)}°</b> above your ${hemi}ern horizon. That is exactly your latitude, ${fmtLat(lat)}.`;
  const list = (arr) => arr.map((c) => `<button class="chip obj" data-act="cons" data-id="${c.id}">${esc(c.name)}</button>`).join('');
  return `
  <div class="fact">${line}</div>
  ${diagramSVG(lat)}
  <div class="legend"><span><i style="background:var(--accent)"></i>circumpolar: never sets</span><span><i style="background:#ff8a7a"></i>never rises</span></div>
  <div class="fact" style="margin-top:12px">From here you can ever see <b>${pct.toFixed(0)}%</b> of the celestial sphere${pct < 99.5 ? '' : ' (all of it)'}.</div>
  <div class="stat-row">
    <button class="stat" data-act="list" data-list="always"><div class="n">${cls.always.length}</div><div class="l">always up</div></button>
    <button class="stat" data-act="list" data-list="sometimes"><div class="n">${cls.sometimes.length}</div><div class="l">rise &amp; set</div></button>
    <button class="stat" data-act="list" data-list="never"><div class="n">${cls.never.length}</div><div class="l">never visible</div></button>
  </div>
  <div class="cons-list" id="cons-list" data-which="">${''}</div>`;
}
export function listChips(data, lat, which, ep) {
  const cls = classifyConstellations(data, lat, ep);
  return cls[which].map((c) => `<button class="chip obj" data-act="cons" data-id="${c.id}">${esc(c.name)}</button>`).join('') || '<span class="empty">None at this latitude.</span>';
}

/** Bright stars (mag < 2.1) and notable deep-sky objects that change visibility between two latitudes. */
function visibilityDiff(data, latA, latB) {
  const S = data.stars, gain = [], lost = [];
  const sA = (dec) => classifyVisibility(dec, latA).kind === 'never', sB = (dec) => classifyVisibility(dec, latB).kind === 'never';
  for (let i = 0; i < S.n; i++) {
    if (S.mag[i] > 2.1) continue; const nm = data.names[S.hip[i]]; if (!nm || !nm.name) continue;
    const a = sA(S.dec[i]), b = sB(S.dec[i]);
    if (a && !b) gain.push({ type: 'star', hip: S.hip[i], name: nm.name, mag: S.mag[i] }); else if (!a && b) lost.push({ type: 'star', hip: S.hip[i], name: nm.name, mag: S.mag[i] });
  }
  gain.sort((a, b) => a.mag - b.mag); lost.sort((a, b) => a.mag - b.mag);
  const dg = [], dl = [];
  for (const d of data.dso) {
    if (!['Large Magellanic Cloud', 'Small Magellanic Cloud', 'Carina Nebula', 'Omega Centauri', '47 Tucanae', 'Southern Pleiades', 'Andromeda Galaxy', 'Orion Nebula', 'Pleiades', 'Double Cluster (h Per)'].includes(d.name)) continue;
    const a = sA(d.dec), b = sB(d.dec);
    if (a && !b) dg.push({ type: 'dso', id: d.id, name: d.name }); else if (!a && b) dl.push({ type: 'dso', id: d.id, name: d.name });
  }
  return { gain: [...gain.slice(0, 7), ...dg.slice(0, 3)], lost: [...lost.slice(0, 7), ...dl.slice(0, 3)] };
}

export function compareHTML(data, A, B, info) {
  const ca = classifyConstellations(data, A.lat), cb = classifyConstellations(data, B.lat);
  const gainC = [], lostC = [];
  for (const c of data.cons) {
    const a = ca.byId.get(c.id), b = cb.byId.get(c.id);
    if (a.state === 'never' && b.state !== 'never') gainC.push(c);
    else if (a.state !== 'never' && b.state === 'never') lostC.push(c);
  }
  const ord = (x, y) => (NOTE_IDX.has(x.id) ? NOTE_IDX.get(x.id) : 99) - (NOTE_IDX.has(y.id) ? NOTE_IDX.get(y.id) : 99);
  gainC.sort(ord); lostC.sort(ord);
  const diff = visibilityDiff(data, A.lat, B.lat);
  const chipC = (c) => `<button class="chip obj" data-act="cons" data-id="${c.id}">${esc(c.name)}</button>`;
  const chipO = (o) => o.type === 'star' ? `<button class="chip obj" data-act="star" data-hip="${o.hip}">${esc(o.name)}</button>` : `<button class="chip obj" data-act="dso" data-id="${esc(o.id)}">${esc(o.name)}</button>`;
  const dLat = B.lat - A.lat;
  let dLon = ((B.lon - A.lon + 540) % 360) - 180;
  const hrs = Math.abs(dLon) / 15;
  const insights = [];
  if (Math.abs(dLat) < 4 && Math.abs(dLon) > 8) {
    insights.push(`<b>Same latitude, different longitude.</b> Latitude decides <i>which</i> stars you can ever see. You moved ${Math.abs(dLon).toFixed(0)}° ${dLon > 0 ? 'east' : 'west'} but barely changed latitude, so the cast of stars is the same.`);
  } else {
    insights.push(`<b>Latitude decides which stars you can ever see.</b> You moved ${Math.abs(dLat).toFixed(0)}° ${dLat >= 0 ? 'north' : 'south'}, so the celestial pole ${Math.abs(B.lat) < Math.abs(A.lat) ? 'dropped' : 'rose'} from ${Math.abs(A.lat).toFixed(0)}° to ${Math.abs(B.lat).toFixed(0)}° altitude (a pole is always as high as your latitude).`);
  }
  insights.push(`<b>Longitude only decides <i>when</i>.</b> ${Math.abs(dLon).toFixed(0)}° of longitude is ${hrs.toFixed(1)} h of clock time: the same sky arrives ${hrs.toFixed(1)} h ${dLon > 0 ? 'earlier' : 'later'} in the day. ${info && info.keepLocal ? 'With "Keep local time" on, we shifted the clock for you, so only the latitude change tilted the sky.' : 'You travelled at the same instant, so the sky is also at a different point of its daily turn.'}`);
  if (A.lat * B.lat < 0 && Math.abs(A.lat) > 3 && Math.abs(B.lat) > 3) {
    insights.push(`<b>You crossed the equator.</b> Orion and the Moon now appear <b>upside-down</b> compared with home, the sky turns the other way round the pole, and the bright pole star is gone: the south celestial pole has no bright star to mark it.`);
  } else if (Math.abs(dLat) >= 4) {
    insights.push(Math.abs(B.lat) > Math.abs(A.lat)
      ? `<b>Same hemisphere, higher pole.</b> Familiar patterns keep their orientation, but the pole stands higher: more stars circle without setting, and the far-side stars you used to see now stay below the horizon.`
      : `<b>Same hemisphere, lower pole.</b> Familiar patterns keep their orientation; circumpolar stars near the pole sink, and more of the opposite sky comes into view.`);
  }
  return `
  <div class="cmp-title"><span>${esc(A.name)}</span><span class="arrow">&rarr;</span><span>${esc(B.name)}</span></div>
  <div class="cmp-grid">
    <div class="cmp-cell"><div class="l">${esc(A.name)}: pole altitude</div><div class="v">${Math.abs(A.lat).toFixed(1)}° <small style="color:var(--ink-3);font-weight:400">${A.lat >= 0 ? 'NCP' : 'SCP'}</small></div></div>
    <div class="cmp-cell"><div class="l">${esc(B.name)}: pole altitude</div><div class="v">${Math.abs(B.lat).toFixed(1)}° <small style="color:var(--ink-3);font-weight:400">${B.lat >= 0 ? 'NCP' : 'SCP'}</small></div></div>
  </div>
  <div class="gain"><div class="sub">Newly visible: could never be seen from ${esc(A.name)}</div>
    <div class="cons-list">${gainC.slice(0, 9).map(chipC).join('')}${diff.gain.map(chipO).join('') || ''}${gainC.length + diff.gain.length ? '' : '<span class="empty">Nothing new: the same stars are available.</span>'}</div></div>
  <div class="lost"><div class="sub">Lost: can no longer be seen</div>
    <div class="cons-list">${lostC.slice(0, 9).map(chipC).join('')}${diff.lost.map(chipO).join('') || ''}${lostC.length + diff.lost.length ? '' : '<span class="empty">Nothing lost.</span>'}</div></div>
  <div style="margin-top:16px">${insights.map((t) => `<p class="insight">${t}</p>`).join('')}</div>`;
}

export const JOURNEYS = [
  { id: 'rome-sydney', title: 'Rome → Sydney', desc: 'Flip hemispheres: Polaris sinks, the Southern Cross rises.' },
  { id: 'poles', title: 'North Pole → Equator → South Pole', desc: 'Watch the pole star sink to the horizon and the other pole climb.' },
  { id: 'rome-ny', title: 'Rome → New York', desc: 'Same latitude: same stars, shifted in time.' },
];
export function journeysHTML() {
  return `<div class="journeys">${JOURNEYS.map((j, i) => `<button class="journey" data-act="journey" data-j="${i}"><span class="play"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg></span><span><div class="t">${j.title}</div><div class="d">${j.desc}</div></span></button>`).join('')}</div>`;
}
export { placeName };

/** One line connecting the star brightness / sky quality controls to the app's goal. */
export const SKY_LINE_HTML = '<p class="insight"><b>The stars are there from every place.</b> Light pollution only hides them (try the Sky control), and latitude decides which of them are above you.</p>';
/** "Across the ages" block (Ages time scale). */
export const AGES_HTML = '<h3>Across the ages</h3><p class="insight"><b>The pole star is temporary.</b> Earth\u2019s axis wobbles like a spinning top, once every ~25 800 years. The celestial pole drifts around a circle, so Thuban, Polaris and Vega each take a turn, the seasonal constellations slide round the calendar, and which southern stars clear your horizon changes too.</p><p class="insight">Stars also drift on their own: in tens of thousands of years the constellation shapes slowly deform. <b>Far from today this is an approximate model</b>: precession is extrapolated, the stars move in straight lines, and the planets and Moon are hidden beyond a few thousand years where their positions are unreliable.</p>';
