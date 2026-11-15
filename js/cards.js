// HTML for the info cards (star, solar-system body, deep-sky object, constellation).
import { classifyVisibility, magnitudeNote } from './astro.js';
import { constellationVisibility } from './explainer.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WINDS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (az) => WINDS[Math.round(az / 22.5) % 16];
const fmtMag = (m) => (m < 0 ? '−' : '') + Math.abs(m).toFixed(2);
export function fmtRA(raDeg) { const h = raDeg / 15, hh = Math.floor(h), mm = (h - hh) * 60; return `${String(hh).padStart(2, '0')}h ${mm.toFixed(1).padStart(4, '0')}m`; }
export function fmtDec(d) { const s = d < 0 ? '−' : '+', a = Math.abs(d), dd = Math.floor(a), mm = Math.round((a - dd) * 60); return `${s}${String(dd).padStart(2, '0')}° ${String(mm).padStart(2, '0')}′`; }
const closeBtn = '<button class="icon-btn" data-act="close" aria-label="Close card (Esc)" title="Close (Esc)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';

export function moonPhaseName(deg) {
  const d = ((deg % 360) + 360) % 360;
  if (d < 6 || d > 354) return 'New Moon';
  if (d < 84) return 'Waxing crescent';
  if (d < 96) return 'First quarter';
  if (d < 174) return 'Waxing gibbous';
  if (d < 186) return 'Full Moon';
  if (d < 264) return 'Waning gibbous';
  if (d < 276) return 'Last quarter';
  return 'Waning crescent';
}

function altText(aa) {
  const above = aa.alt >= 0;
  return `<dt>Altitude / azimuth now</dt><dd>${aa.alt.toFixed(1)}° / ${aa.az.toFixed(1)}° ${compass(aa.az)}</dd>${above ? '' : '<dt></dt><dd style="color:var(--ink-3)">Below the horizon</dd>'}`;
}

/** Static part of a star card (does not change with time). */
export function starCard(info, S, i) {
  const sub = [info.designation && info.name ? info.designation : '', info.cons ? `in ${info.cons.name}` : ''].filter(Boolean).join(' · ');
  return `
  <div class="card-top"><div><div class="eyebrow">Star</div><h2>${esc(info.title)}</h2><div class="card-sub">${esc(sub || (info.cons ? info.cons.name : ''))}</div></div>${closeBtn}</div>
  <dl class="kv">
    <dt>Apparent magnitude</dt><dd>${fmtMag(info.mag)}</dd>
    <dt>Colour</dt><dd>${info.spec.text}, class ${info.spec.cls}</dd>
    ${info.spectral ? `<dt>Spectral type</dt><dd>${esc(info.spectral)}</dd>` : ''}
    <dt>Temperature</dt><dd>~${Math.round(info.temp / 100) * 100} K</dd>
    <dt>RA / Dec (J2000)</dt><dd>${fmtRA(S.ra[i])} / ${fmtDec(S.dec[i])}</dd>
    ${info.dist ? `<dt>Distance</dt><dd>${info.dist}</dd>` : ''}
    ${info.pm >= 100 ? `<dt>Proper motion</dt><dd>${(info.pm / 1000).toFixed(2)}″ per year</dd>` : ''}
  </dl>
  <p class="note">${magnitudeNote(info.mag)}.</p>
  <div id="card-live"></div>
  <div class="card-actions"><button class="btn primary" data-act="centre">Centre on it</button>${info.cons ? `<button class="btn" data-act="cons" data-id="${info.cons.id}">Show constellation</button>` : ''}</div>`;
}
/** dec = declination of date (deg) for the epoch on screen, so circumpolar / never-rises follows the selected era. */
export function starLive(dec, lat, aa) {
  const v = classifyVisibility(dec, lat), la = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
  let b;
  if (v.kind === 'circumpolar') b = `<span class="badge circ">Circumpolar: never sets</span><p class="note">From ${la} this star circles the pole without touching the horizon. It reaches ${v.maxAlt.toFixed(0)}° at its highest and ${v.minAlt.toFixed(0)}° at its lowest.</p>`;
  else if (v.kind === 'never') b = `<span class="badge nev">Never rises from here</span><p class="note">At ${la} this star always stays below the horizon (it would reach only ${v.maxAlt.toFixed(0)}°). Travel ${lat > 0 ? 'south' : 'north'} to see it.</p>`;
  else b = `<span class="badge rs">Rises and sets</span><p class="note">From ${la} it climbs to ${v.maxAlt.toFixed(0)}° altitude when it crosses the meridian.</p>`;
  return `<dl class="kv">${altText(aa)}</dl>${b}`;
}

export function bodyCard(b) {
  const isMoon = b.id === 'Moon', isSun = b.id === 'Sun';
  const km = b.distAU * 149597870.7;
  const dist = isMoon ? `${Math.round(km).toLocaleString('en')} km` : `${b.distAU.toFixed(3)} AU · ${(km / 1e6).toFixed(1)} million km`;
  const ill = isSun ? '' : isMoon ? `<dt>Phase</dt><dd>${moonPhaseName(b.moonPhase)}</dd><dt>Illuminated</dt><dd>${(b.phaseFraction * 100).toFixed(0)}%</dd>` : `<dt>Illuminated</dt><dd>${(b.phaseFraction * 100).toFixed(0)}%</dd>`;
  return `
  <div class="card-top"><div><div class="eyebrow">${esc(b.type)}</div><h2>${b.id}</h2><div class="card-sub">${b.constellation ? `currently in ${esc(b.constellation)}` : ''}</div></div>${closeBtn}</div>
  <dl class="kv">
    <dt>Apparent magnitude</dt><dd>${fmtMag(b.mag)}</dd>
    <dt>Distance</dt><dd>${dist}</dd>${ill}
  </dl>
  <p class="note">${esc(b.text)}</p>
  <div id="card-live"></div>
  <div class="card-actions"><button class="btn primary" data-act="centre">Centre on it</button></div>`;
}
export function bodyLive(b, aa, lat) {
  let extra = '';
  if (b.id === 'Moon' && lat < -3) extra = '<p class="note">From the southern hemisphere the Moon looks upside-down compared with the north: the same craters, turned around.</p>';
  return `<dl class="kv">${altText(aa)}</dl>${extra}`;
}

export function dsoCard(d, cons) {
  return `
  <div class="card-top"><div><div class="eyebrow">Deep-sky object</div><h2>${esc(d.name)}</h2><div class="card-sub">${esc(d.type)}${cons ? ` · in ${esc(cons)}` : ''}</div></div>${closeBtn}</div>
  <dl class="kv"><dt>Designation</dt><dd>${esc(d.desig)}</dd><dt>Apparent magnitude</dt><dd>${fmtMag(d.mag)}</dd><dt>Size</dt><dd>${d.dim >= 1 ? d.dim.toFixed(1) + '°' : Math.round(d.dim * 60) + '′'}</dd><dt>RA / Dec (J2000)</dt><dd>${fmtRA(d.ra)} / ${fmtDec(d.dec)}</dd></dl>
  <div id="card-live"></div>
  <div class="card-actions"><button class="btn primary" data-act="centre">Centre on it</button></div>`;
}
export function dsoLive(d, aa, lat, decNow) {
  const v = classifyVisibility(decNow === undefined ? d.dec : decNow, lat);
  const b = v.kind === 'never' ? '<span class="badge nev">Never rises from here</span>' : v.kind === 'circumpolar' ? '<span class="badge circ">Circumpolar: never sets</span>' : '<span class="badge rs">Rises and sets</span>';
  return `<dl class="kv">${altText(aa)}</dl>${b}`;
}

export function consCard(c) {
  return `
  <div class="card-top"><div><div class="eyebrow">Constellation</div><h2>${esc(c.name)}</h2><div class="card-sub">${esc(c.en)} · ${esc(c.id)}</div></div>${closeBtn}</div>
  <div id="card-live"></div>
  <div class="card-actions"><button class="btn primary" data-act="centre">Centre on it</button></div>`;
}
export function consLive(data, c, lat, aa, ep) {
  const v = constellationVisibility(data, c.id, lat, ep);
  return `<span class="badge ${v.cls}">${v.text}</span>
  <dl class="kv"><dt>Meaning</dt><dd>${esc(c.en)}</dd><dt>Centre now</dt><dd>${aa.alt >= 0 ? aa.alt.toFixed(0) + '° up, ' + compass(aa.az) : 'below the horizon'}</dd></dl>
  <p class="note">The highlighted lines show the pattern; the gold names are clickable in the sky.</p>`;
}
