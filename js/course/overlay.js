// Teaching graphics drawn on a 2D canvas over the live sky, in the same projection, redrawn every frame so they follow drags and time.
// Everything is attached to sky positions ("points"), never to the screen. Gold = the active construction, pale blue = references.
//
// A point is any of:
//   11767 | {hip: 11767}      a catalogue star (follows time and proper motion)
//   {ra, dec}                  J2000 degrees
//   'pole' | 'npole' | 'spole' the celestial pole of date (visible one / north / south)
//   'zenith'
//   {az, alt}                  fixed on the horizon frame
//   () => point                computed every frame
//
// Creators return a handle {remove()}; ov.clear() drops everything (the player does this whenever a step ends).
import * as THREE from '../../vendor/three.module.min.js';
import * as G from './geo.js';

const R = 50;
const GOLD = [242, 193, 78], BLUE = [150, 198, 255], WHITE = [236, 242, 255];
const OMEGA = 2 * Math.PI / 86164090.5;    // sidereal rotation, radians per millisecond
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const COLORS = { gold: GOLD, blue: BLUE, white: WHITE };
const rgb = (c) => (Array.isArray(c) ? c : COLORS[c] || BLUE);

export function createOverlay(a) {
  const { S, A, cam, data, sky } = a;
  const canvas = document.createElement('canvas');
  canvas.id = 'teach'; canvas.setAttribute('aria-hidden', 'true');
  const gl = document.getElementById('gl');
  gl.parentNode.insertBefore(canvas, gl.nextSibling);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, shown = false;
  const items = [];
  const _v = new THREE.Vector3(), fwd = new THREE.Vector3();
  let up = [0, 1, 0], nowMs = 0;

  function resize() {
    W = window.innerWidth; H = window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize); resize();

  // ---------------------------------------------------------------- points -> world directions
  const rot = (v) => {
    const e = a.rotMat.elements;
    return [e[0] * v[0] + e[4] * v[1] + e[8] * v[2], e[1] * v[0] + e[5] * v[1] + e[9] * v[2], e[2] * v[0] + e[6] * v[1] + e[10] * v[2]];
  };
  /** World unit vector of a point, or null. */
  function world(p) {
    if (typeof p === 'function') p = p();
    if (p === null || p === undefined) return null;
    if (typeof p === 'number' || (typeof p === 'object' && p.hip !== undefined)) {
      const i = data.hipIndex.get(typeof p === 'number' ? p : p.hip); if (i === undefined) return null;
      return rot([sky.cur[i * 3], sky.cur[i * 3 + 1], sky.cur[i * 3 + 2]]);
    }
    if (p === 'zenith') return up.slice();
    if (p === 'pole') return [0, S.obs.lat >= 0 ? 1 : -1, 0];
    if (p === 'npole') return [0, 1, 0];
    if (p === 'spole') return [0, -1, 0];
    if (Array.isArray(p)) return p;
    if (p.ra !== undefined) return rot(A.eqToVec(p.ra, p.dec));
    if (p.az !== undefined) return A.dirFromAzAlt(p.az, p.alt, S.obs, [0, 0, 0]);
    return null;
  }
  const pointOf = world;

  // ---------------------------------------------------------------- projection and strokes
  const sp = [0, 0];
  function toScreen(d, clipHorizon) {
    if (dot(d, [fwd.x, fwd.y, fwd.z]) < 0.03) return false;
    if (clipHorizon && dot(d, up) < -0.007) return false;
    _v.set(d[0] * R + cam.position.x, d[1] * R + cam.position.y, d[2] * R + cam.position.z).project(cam);
    sp[0] = (_v.x * 0.5 + 0.5) * W; sp[1] = (-_v.y * 0.5 + 0.5) * H;
    return true;
  }
  /** Stroke a polyline of world points; `frac` of it is drawn (draw-on animation). */
  function stroke(pts, st, frac = 1) {
    const n = Math.max(1, Math.floor((pts.length - 1) * frac) + 1);
    const [r, g, b] = rgb(st.color), al = (st.alpha ?? 1) * st.fade;
    const draw = (w, col) => {
      ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(st.dash || []);
      ctx.beginPath(); let pen = false;
      for (let i = 0; i < n; i++) {
        if (toScreen(pts[i], st.horizon !== false)) { if (!pen) { ctx.moveTo(sp[0], sp[1]); pen = true; } else ctx.lineTo(sp[0], sp[1]); } else pen = false;
      }
      ctx.stroke();
    };
    if (st.halo !== false) draw((st.width || 2) + 2.6, `rgba(2,5,12,${(0.5 * al).toFixed(3)})`);
    draw(st.width || 2, `rgba(${r},${g},${b},${al.toFixed(3)})`);
    ctx.setLineDash([]);
  }
  function label(text, x, y, o) {
    const [r, g, b] = rgb(o.color), al = (o.alpha ?? 1) * o.fade;
    ctx.font = `${o.weight || 600} ${o.size || 12.5}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.4; ctx.strokeStyle = `rgba(2,5,12,${(0.85 * al).toFixed(3)})`; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y);
    ctx.fillStyle = `rgba(${r},${g},${b},${al.toFixed(3)})`; ctx.fillText(text, x, y);
  }
  function drawText(world3, text, o, dx = 0, dy = 0) {
    if (!world3 || !toScreen(world3, o.horizon !== false)) return;
    label(text, sp[0] + (o.dx || 0) + dx, sp[1] + (o.dy || 0) + dy, o);
  }

  // ---------------------------------------------------------------- geometry samplers
  function arcPoints(A0, tang, totalDeg, stepDeg = 1.5) {
    const n = Math.max(2, Math.ceil(totalDeg / stepDeg)), out = [];
    for (let i = 0; i <= n; i++) { const s = (totalDeg * i / n) * G.DEG, c = Math.cos(s), sn = Math.sin(s); out.push([A0[0] * c + tang[0] * sn, A0[1] * c + tang[1] * sn, A0[2] * c + tang[2] * sn]); }
    return out;
  }
  function circlePoints(c, rDeg, stepDeg = 2) {
    const [u, v] = G.perpBasis(c), n = Math.max(24, Math.ceil(360 / stepDeg)), out = [];
    for (let i = 0; i <= n; i++) out.push(G.circlePoint(c, u, v, rDeg, (i / n) * 2 * Math.PI));
    return out;
  }
  const altAzPts = (az0, alt0, az1, alt1, n = 40) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; out.push(A.dirFromAzAlt(az0 + (az1 - az0) * t, alt0 + (alt1 - alt0) * t, S.obs, [0, 0, 0])); } return out; };
  /** A star's position at an earlier time (the sky turns about the world Y axis). */
  const earlier = (d, deltaMs) => { const f = OMEGA * deltaMs, c = Math.cos(f), s = Math.sin(f); return [c * d[0] + s * d[2], d[1], -s * d[0] + c * d[2]]; };

  // ---------------------------------------------------------------- the drawers, one per kind
  const DRAW = {
    segment(it, u) {
      const A0 = world(it.a), B0 = world(it.b); if (!A0 || !B0) return;
      const gap = G.angleDeg(A0, B0), total = it.lengthDeg ?? gap * (1 + (it.extend || 0)), t = G.tangentTowards(A0, B0);
      const pts = arcPoints(A0, t, total);
      stroke(pts, it, u);
      const shownLen = total * u;
      if (it.dots) for (const [p, k] of [[A0, 0], [B0, gap / total]]) if (u >= k) { if (toScreen(p, false)) { ctx.beginPath(); ctx.arc(sp[0], sp[1], 3.2, 0, 7); ctx.fillStyle = `rgba(${rgb(it.color).join(',')},${it.fade})`; ctx.fill(); } }
      if (it.tip && u > 0.98) { const e = pts[pts.length - 1]; if (toScreen(e, it.horizon !== false)) { ctx.beginPath(); ctx.arc(sp[0], sp[1], 4.6, 0, 7); ctx.fillStyle = `rgba(${rgb(it.color).join(',')},${it.fade})`; ctx.fill(); } }
      if (it.text) { const at = it.textAt ?? 0.5, k = Math.min(shownLen, total * at) / total; const q = pts[Math.round(k * (pts.length - 1))]; drawText(q, typeof it.text === 'function' ? it.text() : it.text, { ...it, color: it.textColor || it.color }, 0, it.textDy ?? -14); }
    },
    circle(it, u) {
      const c = world(it.center); if (!c) return;
      stroke(circlePoints(c, typeof it.radius === 'function' ? it.radius() : it.radius), it, u);
      if (it.text && u > 0.5) { const [uu, vv] = G.perpBasis(c); drawText(G.circlePoint(c, uu, vv, typeof it.radius === 'function' ? it.radius() : it.radius, it.textPhi ?? 0), it.text, { ...it, color: it.textColor || it.color }, 0, -12); }
    },
    dial(it, u) {
      const c = world(it.center); if (!c) return;
      const upT = nrm([up[0] - dot(up, c) * c[0], up[1] - dot(up, c) * c[1], up[2] - dot(up, c) * c[2]]), rightT = cross(c, upT);
      const sgn = it.dir === 'cw' ? 1 : -1, at = (theta, rDeg) => { const th = theta * G.DEG, d = [0, 1, 2].map((i) => upT[i] * Math.cos(th) + rightT[i] * Math.sin(th)), r = rDeg * G.DEG; return nrm([0, 1, 2].map((i) => c[i] * Math.cos(r) + d[i] * Math.sin(r))); };
      const ring = []; for (let i = 0; i <= 120; i++) ring.push(at((i / 120) * 360, it.radius));
      stroke(ring, { ...it, width: 1.6, alpha: 0.8 }, u);
      for (let k = 0; k < 24; k++) {
        if (k / 24 > u) break;
        const major = k % 6 === 0, th = sgn * k * 15;
        stroke([at(th, it.radius - (major ? 2.2 : 1.1)), at(th, it.radius + (major ? 2.2 : 1.1))], { ...it, width: major ? 2.2 : 1.3, alpha: major ? 0.95 : 0.6, halo: major }, 1);
      }
      if (u > 0.6) (it.labels || []).forEach((txt, i) => drawText(at(sgn * i * 90, it.radius + 5.4), txt, { ...it, size: 12 }));
    },
    fists(it, u) {
      const top = typeof it.top === 'function' ? it.top() : it.top, az = it.az, step = it.step || 10, n = Math.floor(top / step + 1e-6);
      const spine = altAzPts(az, 0, az, top, 36);
      stroke(spine, { ...it, width: 1.6, alpha: 0.7 }, Math.min(1, u * 1.15));
      const kShown = Math.floor(u * (n + 0.999));
      for (let k = 0; k <= n; k++) {
        if (k > kShown) break;
        const alt = k * step, w = 2.6 / Math.max(0.35, Math.cos(alt * G.DEG));
        stroke(altAzPts(az - w, alt, az + w, alt, 4), { ...it, width: 2.4 }, 1);
        if (k > 0) drawText(A.dirFromAzAlt(az + w + 1.1, alt - step / 2, S.obs, [0, 0, 0]), String(k), { ...it, color: 'gold', size: 13, align: 'left' }, 0, 0);
      }
      if (u >= 1 && top - n * step > 0.5) stroke(altAzPts(az - 2.6, top, az + 2.6, top, 4), { ...it, width: 2.4 }, 1);
    },
    altArc(it, u) { stroke(altAzPts(it.az, it.from, it.az, it.to, 40), it, u); },
    azArc(it, u) { stroke(altAzPts(it.from, it.alt, it.to, it.alt, 60), it, u); },
    marker(it, u) {
      const p = world(it.p); if (!p || !toScreen(p, it.horizon !== false)) return;
      const [r, g, b] = rgb(it.color), pulse = reduced ? 0 : ((performance.now() - it.t0) % 1800) / 1800;
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(2,5,12,${0.5 * it.fade})`; ctx.beginPath(); ctx.arc(sp[0], sp[1], it.r + 1.5, 0, 7); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${r},${g},${b},${it.fade})`; ctx.beginPath(); ctx.arc(sp[0], sp[1], it.r, 0, 7); ctx.stroke();
      if (it.pulse && !reduced) { ctx.lineWidth = 1.4; ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - pulse) * 0.7 * it.fade})`; ctx.beginPath(); ctx.arc(sp[0], sp[1], it.r + pulse * 16, 0, 7); ctx.stroke(); }
      if (it.text) label(typeof it.text === 'function' ? it.text() : it.text, sp[0] + (it.dx ?? 0), sp[1] + (it.dy ?? -(it.r + 11)), { ...it, color: it.textColor || it.color });
    },
    text(it) {
      const p = world(it.p); if (!p) return;
      drawText(p, typeof it.str === 'function' ? it.str() : it.str, it);
    },
    trail(it, u) {
      const d = world(it.p); if (!d) return;
      const since = typeof it.since === 'function' ? it.since() : it.since, span = nowMs - since;
      if (Math.abs(span) < 60e3) return;
      const maxSpan = (it.maxHours ?? 14) * 3600e3, from = Math.abs(span) > maxSpan ? nowMs - Math.sign(span) * maxSpan : since;
      const total = nowMs - from, n = Math.min(90, Math.max(4, Math.ceil(Math.abs(total) / 360e3))), [r, g, b] = rgb(it.color);
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const age = (total * (n - i)) / n, pt = earlier(d, age), fade = (0.15 + 0.85 * (i / n)) * (it.alpha ?? 0.9) * it.fade;
        if (prev) { ctx.lineWidth = it.width || 1.6; ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(${r},${g},${b},${fade.toFixed(3)})`; if (toScreen(prev, it.horizon !== false)) { const x0 = sp[0], y0 = sp[1]; if (toScreen(pt, it.horizon !== false)) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(sp[0], sp[1]); ctx.stroke(); } } }
        prev = pt;
      }
      if (it.tickHours) {
        const step = it.tickHours * 3600e3, dir = Math.sign(nowMs - since) || 1;
        for (let k = 1; k * step <= Math.abs(nowMs - since) + 1; k++) {
          const t = since + dir * k * step, q = earlier(d, nowMs - t), q2 = earlier(d, nowMs - t - dir * 60e3);
          if (!toScreen(q, it.horizon !== false)) continue;
          const x = sp[0], y = sp[1];
          if (!toScreen(q2, it.horizon !== false)) continue;
          const dx = sp[0] - x, dy = sp[1] - y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 6, ny = dx / l * 6;
          ctx.lineWidth = 2; ctx.strokeStyle = `rgba(2,5,12,${0.5 * it.fade})`; ctx.beginPath(); ctx.moveTo(x - nx, y - ny); ctx.lineTo(x + nx, y + ny); ctx.stroke();
          ctx.lineWidth = 1.6; ctx.strokeStyle = `rgba(${r},${g},${b},${it.fade})`; ctx.beginPath(); ctx.moveTo(x - nx, y - ny); ctx.lineTo(x + nx, y + ny); ctx.stroke();
          if (it.tickLabel) label(it.tickLabel(k), x + nx * 2.1, y + ny * 2.1, { ...it, size: 11.5, color: it.color });
        }
      }
    },
  };

  // ---------------------------------------------------------------- globe mode (lesson 4.3)
  // Items made with gline / gmarker / garc live in the Earth-fixed world frame (Earth radius 1) and are drawn only while the globe is showing.
  const gval = (p) => (typeof p === 'function' ? p() : p);
  /** Screen position of a world point, and whether the Earth hides it from the camera. */
  function gProject(pv) {
    if (!pv) return null;
    const c = cam.position, dx = pv[0] - c.x, dy = pv[1] - c.y, dz = pv[2] - c.z, a2 = dx * dx + dy * dy + dz * dz;
    const b = 2 * (c.x * dx + c.y * dy + c.z * dz), cc = c.x * c.x + c.y * c.y + c.z * c.z - 1, disc = b * b - 4 * a2 * cc;
    let hidden = false;
    if (disc > 0) { const t = (-b - Math.sqrt(disc)) / (2 * a2); if (t > 0 && t < 0.999) hidden = true; }
    _v.set(pv[0], pv[1], pv[2]).project(cam);
    if (_v.z > 1 || _v.z < -1) return null;
    return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H, hidden };
  }
  function gStroke(pts, st, frac = 1) {
    const n = Math.max(1, Math.floor((pts.length - 1) * frac)), [r, g, b] = rgb(st.color), al = (st.alpha ?? 1) * st.fade;
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const q = gProject(pts[i]);
      if (prev && q) {
        const dim = prev.hidden || q.hidden ? (st.hiddenAlpha ?? 0.22) : 1;
        if (dim > 0) {
          for (const [w, col] of [[(st.width || 2) + 2.4, `rgba(2,5,12,${(0.45 * al * dim).toFixed(3)})`], [st.width || 2, `rgba(${r},${g},${b},${(al * dim).toFixed(3)})`]]) {
            ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.setLineDash(st.dash || []); ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      prev = q;
    }
    ctx.setLineDash([]);
  }
  Object.assign(DRAW, {
    gline(it, u) {
      const p0 = gval(it.a), p1 = gval(it.b); if (!p0 || !p1) return;
      const pts = []; for (let i = 0; i <= 28; i++) { const t = i / 28; pts.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t]); }
      gStroke(pts, it, u);
      if (it.text && u > 0.6) { const q = gProject(it.textAt === 'end' ? p1 : [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2]); if (q && !q.hidden) label(typeof it.text === 'function' ? it.text() : it.text, q.x + (it.dx || 0), q.y + (it.dy || 0), { ...it, color: it.textColor || it.color }); }
    },
    garc(it, u) {
      const d1 = G.unit(gval(it.a)), d2 = G.unit(gval(it.b)), gap = G.angleDeg(d1, d2), pts = [];
      const c0 = it.center ? gval(it.center) : [0, 0, 0];
      for (let i = 0; i <= 24; i++) { const v = G.alongArc(d1, d2, gap * i / 24); pts.push([c0[0] + v[0] * it.r, c0[1] + v[1] * it.r, c0[2] + v[2] * it.r]); }
      gStroke(pts, it, u);
      if (it.text && u > 0.6) { const v = G.alongArc(d1, d2, gap / 2), q = gProject([c0[0] + v[0] * it.r, c0[1] + v[1] * it.r, c0[2] + v[2] * it.r]); if (q) label(typeof it.text === 'function' ? it.text() : it.text, q.x + (it.dx || 0), q.y + (it.dy ?? -12), { ...it, color: it.textColor || it.color }); }
    },
    gmarker(it) {
      const q = gProject(gval(it.p)); if (!q || (q.hidden && !it.showHidden)) return;
      const [r, g, b] = rgb(it.color), pulse = reduced ? 0 : ((performance.now() - it.t0) % 1800) / 1800;
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(2,5,12,${0.5 * it.fade})`; ctx.beginPath(); ctx.arc(q.x, q.y, it.r + 1.5, 0, 7); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${r},${g},${b},${it.fade})`; ctx.beginPath(); ctx.arc(q.x, q.y, it.r, 0, 7); ctx.stroke();
      if (it.pulse && !reduced) { ctx.lineWidth = 1.4; ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - pulse) * 0.7 * it.fade})`; ctx.beginPath(); ctx.arc(q.x, q.y, it.r + pulse * 14, 0, 7); ctx.stroke(); }
      if (it.text) label(typeof it.text === 'function' ? it.text() : it.text, q.x + (it.dx ?? 0), q.y + (it.dy ?? -(it.r + 11)), { ...it, color: it.textColor || it.color });
    },
  });

  // ---------------------------------------------------------------- glow (7.2) and ground ring (8.3)
  Object.assign(DRAW, {
    /** A soft disc of light at a sky point whose radius (CSS px) grows from `from` to `to` over `ms` (an illustration of "if it were nearer"). */
    glow(it) {
      const p = world(it.p); if (!p || !toScreen(p, it.horizon !== false)) return;
      const k = reduced ? 1 : ease(Math.min(1, Math.max(0, (performance.now() - it.t0 - (it.delay || 0)) / (it.ms || 2400)))), r = it.from + (it.to - it.from) * k;
      const [cr, cg, cb] = rgb(it.color), al = it.fade * (it.alpha ?? 1), g = ctx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], r);
      g.addColorStop(0, `rgba(255,255,255,${al})`); g.addColorStop(0.18, `rgba(${cr},${cg},${cb},${0.85 * al})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp[0], sp[1], r, 0, 7); ctx.fill();
      if (it.text) label(it.text, sp[0] + (it.dx ?? 0), sp[1] + (it.dy ?? r + 14), { ...it, color: it.textColor || it.color });
    },
    /** Globe mode: a circle on the ground, radiusKm around a place (lat, lon). */
    gring(it, u) {
      const c = G.unit(A.latLonToVec(it.lat, it.lon)), ang = it.radiusKm / 6371 / G.DEG, [uu, vv] = G.perpBasis(c), pts = [];
      for (let i = 0; i <= 72; i++) { const v = G.circlePoint(c, uu, vv, ang, (i / 72) * 2 * Math.PI); pts.push([v[0] * 1.002, v[1] * 1.002, v[2] * 1.002]); }
      gStroke(pts, it, u);
      if (it.text && u > 0.6) { const v = G.circlePoint(c, uu, vv, ang, it.textPhi ?? 0.6), q = gProject([v[0] * 1.002, v[1] * 1.002, v[2] * 1.002]); if (q && !q.hidden) label(it.text, q.x + (it.dx || 0), q.y + (it.dy ?? -12), { ...it, color: it.textColor || it.color }); }
    },
  });

  // ---------------------------------------------------------------- paths on the sky and flat diagrams (chapters 5 and 6)
  Object.assign(DRAW, {
    /** A track of sky points ({ra, dec}, J2000: it follows the stars) drawn up to `upTo` (0..1 or a function); only the last `tail` points, fading towards the old end. */
    path(it, u) {
      const pts = typeof it.pts === 'function' ? it.pts() : it.pts, n = pts.length; if (n < 2) return;
      const f = typeof it.upTo === 'function' ? it.upTo() : (it.upTo ?? 1), cnt = Math.max(0, Math.min(n - 1, Math.floor(f * (n - 1) * u + 1e-9)));
      const from = it.tail ? Math.max(0, cnt - it.tail) : 0, [r, g, b] = rgb(it.color), hz = it.horizon !== false;
      let prev = world(pts[from]);
      for (let i = from + 1; i <= cnt; i++) {
        const cur = world(pts[i]);
        if (cur && prev && toScreen(prev, hz)) {
          const x0 = sp[0], y0 = sp[1];
          if (toScreen(cur, hz)) {
            const al = (it.fadeTail === false ? 1 : 0.12 + 0.88 * ((i - from) / Math.max(1, cnt - from))) * (it.alpha ?? 1) * it.fade;
            ctx.lineCap = 'round'; ctx.setLineDash(it.dash || []);
            for (const [w, col] of [[(it.width || 2.4) + 2.4, `rgba(2,5,12,${(0.4 * al).toFixed(3)})`], [it.width || 2.4, `rgba(${r},${g},${b},${al.toFixed(3)})`]]) { ctx.lineWidth = w; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(sp[0], sp[1]); ctx.stroke(); }
            ctx.setLineDash([]);
          }
        }
        prev = cur;
      }
    },
    /** A flat diagram in screen space: it.draw(ctx, { W, H, fade, u, label }) is called every frame (see js/course/diagrams.js). */
    screen(it, u) { it.draw(ctx, { W, H, fade: it.fade, u, label }); },
  });

  // ---------------------------------------------------------------- frame
  function frame(now) {
    nowMs = S.time;
    const landed = a.lblCtx && a.lblCtx.landed && S.mode === 'sky' && !S.trans, inGlobe = S.mode === 'globe' && !S.trans;
    if (!items.length || !(landed || inGlobe)) { if (shown) { ctx.clearRect(0, 0, W, H); shown = false; } return; }
    if (W !== window.innerWidth || H !== window.innerHeight) resize();
    ctx.clearRect(0, 0, W, H); shown = true;
    cam.getWorldDirection(fwd); up = S.obs.U;
    for (const it of items) {
      if (!!it.globe !== inGlobe) continue;
      const age = now - it.t0;
      it.fade = reduced ? 1 : Math.min(1, age / 280);
      const u = it.grow > 0 && !reduced ? ease(Math.min(1, age / it.grow)) : 1;
      try { DRAW[it.kind](it, u); } catch (e) { console.error('overlay', it.kind, e); it.dead = true; }
    }
    for (let i = items.length - 1; i >= 0; i--) if (items[i].dead) items.splice(i, 1);
  }
  (a.hooks || (a.hooks = {})).frame = frame;

  // ---------------------------------------------------------------- public API
  function add(kind, o) {
    const it = { kind, t0: performance.now(), grow: 0, fade: 0, color: 'blue', ...o };
    items.push(it);
    return { item: it, remove() { const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); } };
  }
  const grown = (o, ms) => ({ grow: reduced ? 0 : ms, ...o });
  return {
    /** Great-circle segment a -> b. extend: carry on past b for this many times the gap (pointer lines). {color, width, dash, grow, text, textAt, dots, tip, lengthDeg} */
    segment: (a0, b0, o = {}) => add('segment', grown({ a: a0, b: b0, color: 'gold', width: 2.6, ...o }, o.grow ?? 1600)),
    /** Small circle around a point, radius in degrees. */
    circle: (center, radius, o = {}) => add('circle', grown({ center, radius, width: 2, ...o }, o.grow ?? 1800)),
    /** 24-hour dial around a point. labels: four strings for the quarter ticks. dir: 'ccw' | 'cw'. */
    dial: (center, radius, o = {}) => add('dial', grown({ center, radius, dir: 'ccw', ...o }, o.grow ?? 1400)),
    /** Stack of fist-sized ticks up the vertical line at azimuth az, from the horizon to `top` degrees. */
    fists: (az, top, o = {}) => add('fists', grown({ az, top, color: 'gold', ...o }, o.grow ?? 3200)),
    altArc: (az, from, to, o = {}) => add('altArc', grown({ az, from, to, width: 2, ...o }, o.grow ?? 1200)),
    azArc: (alt, from, to, o = {}) => add('azArc', grown({ alt, from, to, width: 2, ...o }, o.grow ?? 1200)),
    marker: (p, o = {}) => add('marker', { p, r: 12, ...o }),
    text: (p, str, o = {}) => add('text', { p, str, ...o }),
    /** Star trail since a time (ms or fn). tickHours draws a tick per hour, tickLabel(k) names it. */
    trail: (p, o = {}) => add('trail', { p, since: S.time, ...o }),
    /** A track of {ra, dec} points on the sky (follows the stars), revealed up to upTo (0..1 or fn), last `tail` points only (5.2, 6.1, 6.4). {color, width, alpha, dash, tail, upTo, fadeTail} */
    path: (pts, o = {}) => add('path', { pts, color: 'gold', width: 2.6, ...o }),
    /** A flat diagram in screen space: draw(ctx, { W, H, fade, label }) runs every frame (5.1, 5.3, 5.4; see diagrams.js). */
    screen: (draw, o = {}) => add('screen', { draw, ...o }),
    /** Globe mode: straight line between two world points (arrays or functions), Earth radius 1. {color, width, dash, grow, text, textAt, hiddenAlpha} */
    gline: (a0, b0, o = {}) => add('gline', grown({ a: a0, b: b0, color: 'gold', width: 2.4, globe: true, ...o }, o.grow ?? 1200)),
    /** Globe mode: arc about the Earth's centre between two directions, at radius r. */
    garc: (a0, b0, r, o = {}) => add('garc', grown({ a: a0, b: b0, r, color: 'gold', width: 2.6, globe: true, ...o }, o.grow ?? 1200)),
    /** Globe mode: ring and label at a world point. */
    gmarker: (p, o = {}) => add('gmarker', { p, r: 7, color: 'gold', globe: true, ...o }),
    /** World position of a place (Earth radius 1 times k) and the Sun's direction (unit) in the globe's frame. */
    geo: (lat, lon, k = 1) => A.latLonToVec(lat, lon).map((x) => x * k),
    sunDir: () => [a.sunWorld.x, a.sunWorld.y, a.sunWorld.z],
    /** A soft disc of light at a sky point, radius growing from `from` to `to` px over `ms` (7.2). {color, ms, delay, text, dy} */
    glow: (p, from, to, o = {}) => add('glow', { p, from, to, color: 'white', ...o }),
    /** Globe mode: a circle on the ground radiusKm around (lat, lon) (8.3). {color, width, dash, grow, text, textPhi} */
    gring: (lat, lon, radiusKm, o = {}) => add('gring', grown({ lat, lon, radiusKm, color: 'gold', width: 2.2, globe: true, ...o }, o.grow ?? 1600)),
    clear() { items.length = 0; ctx.clearRect(0, 0, W, H); shown = false; },
    get count() { return items.length; },
    world: pointOf,
    /** alt/az (degrees) of a point right now */
    altAz(p) { const d = world(p); return d ? A.azAltFromDir(d, S.obs) : null; },
    angleBetween(p, q) { const d1 = world(p), d2 = world(q); return d1 && d2 ? G.angleDeg(d1, d2) : null; },
  };
}
