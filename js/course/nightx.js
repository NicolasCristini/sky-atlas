// Helpers for the lessons of chapters 7 and 8 that need the live app (X): the learner's own sky, moving the clock to a good evening,
// the globe camera, the moon-phase calendar. Pure maths is in nightsky.js.
import * as G from './geo.js';
import * as N from './nightsky.js';

export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const norm180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
export const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const nowYear = () => new Date().getUTCFullYear();

/** The learner's own place and the instant their Explore clock showed when the lesson began (now, unless they had set the clock). */
export function homeNow(X) {
  const h = X.kit.home || { lat: X.S.obs.lat, lon: X.S.obs.lon };
  return { lat: h.lat, lon: h.lon, ms: h.follow || h.time === undefined ? Date.now() : h.time };
}
/** State shared between the steps of the lesson being played (the texts' values may read it). Reset by each lesson's first step. */
export const shared = (kit) => kit.nx || (kit.nx = {});

/** Put the clock at 22:00 local solar time tonight at the place the sky shows: a dark sky to look at. */
export function nightClock(X, hour = 22) { X.setClock(G.eveningMs(homeNow(X).ms, X.S.obs.lon, hour)); }

/** "high in the north-east, about 55° up", or "almost straight overhead" when the compass direction means nothing. */
export function whereOf(P, az, alt) { return alt >= 78 ? P.kit.ui('overhead') : P.where(az, alt); }

/** Name of a star by HIP number. */
export const nameOf = (X, hip) => X.kit.starName(hip);

/**
 * Move the clock (with a visible sweep) to the evening, at local solar `hour`, of the first day on or after now when pred(ms) holds.
 * Returns 'now' (already fine; the clock is only set to that hour), 'moved' (a later day), or false (never within `days`).
 */
export async function moveToEvening(X, pred, o = {}) {
  const { hour = 21, days = 366, sweep = true } = o, S = X.S;
  const hit = N.firstEvening(S.time, S.obs.lon, pred, hour, days);
  if (!hit) return false;
  if (Math.abs(hit.ms - S.time) > 20 * 60e3) { if (sweep && hit.days > 0) await X.tweenTime(hit.ms, hit.days > 20 ? 2600 : 1500); else X.setClock(hit.ms); }
  return hit.days > 0 ? 'moved' : 'now';
}

/** Glide the globe camera to look at a place. */
export async function aimGlobe(X, lat, lon, dist, ms) {
  const g = X.S.globe, l0 = g.lat, o0 = g.lon, d0 = g.dist, t0 = performance.now();
  for (let u = 0; u < 1;) {
    await X.D.wait(30);
    u = clamp((performance.now() - t0) / ms, 0, 1);
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    g.lat = l0 + (lat - l0) * e; g.lon = o0 + norm180(lon - o0) * e; g.dist = d0 + (dist - d0) * e; g.vLat = g.vLon = 0;
  }
}

/** Number of catalogue stars a sky quality shows above the horizon right now. */
export const countNow = (X, q) => N.starsVisible(X.data.stars, X.S.obs.lat, X.S.obs.lon, X.S.time + (X.S.tm === 'year' ? X.S.yd * 864e5 : 0), N.qualityLimit(q));
/** "about 2 480" for talking. */
export function aboutN(n) { const r = n < 100 ? Math.round(n / 5) * 5 : n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 50) * 50; return r.toLocaleString('en-US'); }

/** Frame a list of sky points in one view. */
export function framePoints(X, pts, o = {}) {
  const aas = pts.map((p) => X.ov.altAz(p)).filter(Boolean); if (!aas.length) return Promise.resolve();
  let sx = 0, sy = 0, alt = 0; for (const a of aas) { sx += Math.sin(a.az * G.DEG); sy += Math.cos(a.az * G.DEG); alt += a.alt; }
  const az = (Math.atan2(sx, sy) / G.DEG + 360) % 360; alt /= aas.length;
  let spread = 0; for (const a of aas) spread = Math.max(spread, Math.abs(norm180(a.az - az)), Math.abs(a.alt - alt));
  return X.D.toSky(az, clamp(alt - (o.lower ?? 4), o.minAlt ?? 8, 75), clamp(spread * 2.8 + 34, o.minFov ?? 60, o.maxFov ?? 100));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The moon-phase calendar (8.3): a small panel over the sky, one cell per evening with a Moon glyph.
// ---------------------------------------------------------------------------------------------------------------------------------
/** SVG of the Moon at a phase angle. flip: draw the lit side on the other side (waning, or seen from the southern hemisphere, not both). */
export function moonSvg(phaseDeg, south, size = 24) {
  const R = 10, c = 12, p = ((phaseDeg % 360) + 360) % 360, waxing = p < 180, f = (1 - Math.cos(p * G.DEG)) / 2;
  const rx = (R * Math.abs(Math.cos(p * G.DEG))).toFixed(2), gib = (waxing ? p : 360 - p) > 90;
  const flip = waxing === south;       // north: waxing lit on the right; south: on the left
  const lit = f < 0.02 ? '' : f > 0.98 ? `<circle cx="${c}" cy="${c}" r="${R}" class="mc-lit"/>`
    : `<path class="mc-lit" d="M${c} ${c - R}A${R} ${R} 0 0 1 ${c} ${c + R}A${rx} ${R} 0 0 ${gib ? 1 : 0} ${c} ${c - R}Z"${flip ? ` transform="translate(24 0) scale(-1 1)"` : ''}/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${R}" class="mc-dark"/>${lit}</svg>`;
}

/** Builds the calendar panel. show(list, o): list = evening records (nightsky.eveningsAhead); o = { south, marks: Set(dayKey), highlight: (rec) => bool, weekdays, title }. */
export function moonCalendar(X) {
  let el = document.getElementById('moon-cal');
  if (!el) { el = document.createElement('div'); el.id = 'moon-cal'; el.className = 'panel'; el.hidden = true; el.setAttribute('role', 'img'); document.body.appendChild(el); }
  const api = {
    el,
    show(list, o = {}) {
      const wd = o.weekdays || ['S', 'M', 'T', 'W', 'T', 'F', 'S'], first = new Date(list[0].dayKey).getUTCDay();
      let cells = '';
      for (let i = 0; i < first; i++) cells += '<i class="mc-c mc-e"></i>';
      for (const e of list) {
        const d = new Date(e.dayKey), cls = ['mc-c'];
        if (o.highlight && o.highlight(e)) cls.push('dark');
        if (o.marks && o.marks.has(e.dayKey)) cls.push('mark');
        cells += `<i class="${cls.join(' ')}" data-k="${e.dayKey}"><b>${d.getUTCDate()}</b>${moonSvg(e.phase, !!o.south)}</i>`;
      }
      el.innerHTML = `<div class="mc-t">${o.title || ''}</div><div class="mc-w">${wd.map((w) => `<span>${w}</span>`).join('')}</div><div class="mc-g">${cells}</div>`;
      if (o.label) el.setAttribute('aria-label', o.label);
      el.hidden = false; document.body.classList.add('mooncal-on');
    },
    highlight(fn) { el.querySelectorAll('.mc-c[data-k]').forEach((c) => c.classList.toggle('dark', !!fn(+c.dataset.k))); },
    hide() { el.hidden = true; document.body.classList.remove('mooncal-on'); },
  };
  return api;
}
