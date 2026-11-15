// The celestial sphere: stars, constellation lines, Milky Way, Sun/Moon/planets, equator/ecliptic, DSOs.
// Everything is built once in equatorial (J2000) coordinates inside `group`; main.js re-centres and rotates it.
import * as THREE from '../vendor/three.module.min.js';
import { STAR_VERT, STAR_FRAG, BODY_VERT, BODY_FRAG, MW_VERT, MW_FRAG } from './shaders.js';
import { eqToVec, bvToTemp, DEG, vecToEq, movedStar } from './astro.js';

export const R_SKY = 50;

function tempToRGB(T) {
  T /= 100; let r, g, b;
  if (T <= 66) { r = 255; g = 99.4708 * Math.log(T) - 161.1196; } else { r = 329.6987 * Math.pow(T - 60, -0.1332); g = 288.1222 * Math.pow(T - 60, -0.0755); }
  if (T >= 66) b = 255; else if (T <= 19) b = 0; else b = 138.5177 * Math.log(T - 10) - 305.0448;
  const c = (x) => Math.min(255, Math.max(0, x)) / 255;
  return [c(r), c(g), c(b)];
}
// Magnitude -> core diameter (CSS px), peak brightness and halo strength. Steep but smooth (exponential in magnitude):
// mag 6 is ~1.6 px dust at ~45% brightness, mag 0 a ~6 px core, Sirius ~9 px with a big soft halo.
export const starSize = (m) => 1.05 + 11 * Math.pow(10, -0.17 * (Math.min(Math.max(m, -2), 7) + 1.5));
export const starBright = (m) => Math.min(1, Math.max(0.42, Math.pow(10, -0.15 * (m - 1.2))));
export const starHalo = (m) => { const t = Math.min(1, Math.max(0, (2.4 - m) / 3.4)); return t * t * (3 - 2 * t); };
// More saturated than a plain blackbody mapping: push colour away from the luminance axis.
function starRGB(bv) {
  const rgb = tempToRGB(Math.min(Math.max(bvToTemp(bv), 2600), 28000));
  const l = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2], k = 1.6;
  const c = (x) => Math.min(1, Math.max(0, l + (x - l) * k));
  return [c(rgb[0]), c(rgb[1]), c(rgb[2])];
}

const BODIES = [
  { id: 'Sun', kind: 1, color: [1, 0.9, 0.65], type: 'Star (our Sun)' },
  { id: 'Moon', kind: 2, color: [0.92, 0.92, 0.9], type: 'Natural satellite' },
  { id: 'Mercury', kind: 0, color: [0.85, 0.8, 0.75], type: 'Planet' },
  { id: 'Venus', kind: 0, color: [1, 0.96, 0.82], type: 'Planet' },
  { id: 'Mars', kind: 0, color: [1, 0.55, 0.38], type: 'Planet' },
  { id: 'Jupiter', kind: 0, color: [1, 0.92, 0.8], type: 'Planet' },
  { id: 'Saturn', kind: 0, color: [1, 0.9, 0.62], type: 'Planet' },
];
const BODY_TEXT = {
  Sun: 'The star at the centre of the Solar System. Its position on the horizon sets the seasons and the length of day at your latitude.',
  Moon: 'Earth’s only natural satellite. From the southern hemisphere its face appears upside-down compared with the north.',
  Mercury: 'The innermost planet; it never strays far from the Sun, so it is seen only low in twilight.',
  Venus: 'The brightest planet, a cloud-wrapped world close to Earth’s size, always near the Sun in the sky.',
  Mars: 'The red planet: iron-rich dust gives it its colour.',
  Jupiter: 'The largest planet, a gas giant whose four big moons are visible in binoculars.',
  Saturn: 'The ringed gas giant, the farthest planet visible to the naked eye.',
};

function subdivide(a, b, out, step = 0.07) {
  const ang = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  const n = Math.max(1, Math.ceil(ang / step));
  let prev = a;
  for (let k = 1; k <= n; k++) {
    const t = k / n; const s0 = Math.sin((1 - t) * ang) / Math.sin(ang || 1), s1 = Math.sin(t * ang) / Math.sin(ang || 1);
    const p = ang < 1e-6 ? b : [a[0] * s0 + b[0] * s1, a[1] * s0 + b[1] * s1, a[2] * s0 + b[2] * s1];
    out.push(prev[0] * R_SKY, prev[1] * R_SKY, prev[2] * R_SKY, p[0] * R_SKY, p[1] * R_SKY, p[2] * R_SKY);
    prev = p;
  }
}
/**
 * Constellation lines as a vertex table + segment list, so the vertices can follow their stars (proper motion).
 * Each vertex is snapped to the nearest catalogue star within 0.1 degrees (else it keeps its raw direction).
 */
function buildLineTable(data) {
  const S = data.stars, cosTol = Math.cos(0.1 * DEG);
  const vStar = [], vRaw = [], vKey = new Map(), segs = [], range = new Map();
  const vertex = (ra, dec) => {
    const key = ra + ',' + dec; let id = vKey.get(key); if (id !== undefined) return id;
    const v = eqToVec(ra, dec); let best = -1, bc = cosTol;
    for (let i = 0; i < S.n; i++) { const c = S.eq[i * 3] * v[0] + S.eq[i * 3 + 1] * v[1] + S.eq[i * 3 + 2] * v[2]; if (c > bc) { bc = c; best = i; } }
    id = vStar.length; vStar.push(best); vRaw.push(v[0], v[1], v[2]); vKey.set(key, id); return id;
  };
  for (const c of data.cons) {
    const s0 = segs.length / 2;
    for (const s of c.segs) for (let i = 1; i < s.length; i++) segs.push(vertex(s[i - 1][0], s[i - 1][1]), vertex(s[i][0], s[i][1]));
    range.set(c.id, [s0, segs.length / 2]);
  }
  return { vStar: Int32Array.from(vStar), vRaw: Float32Array.from(vRaw), segs: Int32Array.from(segs), range, nV: vStar.length, snapped: vStar.filter((x) => x >= 0).length };
}

function ringTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 20, 0, 7); g.stroke();
  g.lineWidth = 1.5; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(32, 4); g.lineTo(32, 12); g.moveTo(32, 52); g.lineTo(32, 60); g.stroke();
  return new THREE.CanvasTexture(cv);
}

function buildMilkyWayTexture(mw) {
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  for (const f of mw.features) {
    const level = +String(f.id).replace(/\D/g, '') || 1;
    const path = new Path2D();
    for (const poly of f.geometry.coordinates) for (const ring of poly) {
      let prev = null, off = 0; const pts = [];
      for (const [ra, dec] of ring) {
        let r = ra + off;
        if (prev !== null) { while (r - prev > 180) { r -= 360; off -= 360; } while (r - prev < -180) { r += 360; off += 360; } }
        prev = r; pts.push([((r + 360) / 360) * W, ((90 - dec) / 180) * H]);
      }
      for (const dx of [-2 * W, -W, 0, W, 2 * W]) {
        path.moveTo(pts[0][0] + dx, pts[0][1]);
        for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0] + dx, pts[i][1]);
        path.closePath();
      }
    }
    g.fillStyle = `rgba(255,255,255,${0.07 + level * 0.012})`;
    g.fill(path, 'evenodd');
  }
  // Soften into a continuous band: sum several blur radii (wide ones carry the glow, narrow ones the structure).
  // Work on three tiled copies so the blur wraps across the RA = 0 seam.
  const W3 = W * 3;
  const tiled = document.createElement('canvas'); tiled.width = W3; tiled.height = H;
  const tg = tiled.getContext('2d'); for (let k = 0; k < 3; k++) tg.drawImage(cv, k * W, 0);
  const wide = document.createElement('canvas'); wide.width = W3; wide.height = H;
  const og = wide.getContext('2d');
  og.fillStyle = '#000'; og.fillRect(0, 0, W3, H);
  og.globalCompositeOperation = 'lighter';
  let filtered = false;
  try { og.filter = 'blur(1px)'; filtered = og.filter === 'blur(1px)'; og.filter = 'none'; } catch (e) { filtered = false; }
  if (filtered) {
    for (const [px, a] of [[5, 0.5], [13, 0.55], [30, 0.6]]) { og.filter = `blur(${px}px)`; og.globalAlpha = a; og.drawImage(tiled, 0, 0); }
    og.filter = 'none';
  } else {   // no canvas filter (older Safari): repeated down/up-scaling is a cheap blur
    for (const [f, a] of [[4, 0.5], [8, 0.55], [16, 0.6]]) {
      const sm = document.createElement('canvas'); sm.width = W3 / f; sm.height = H / f;
      const sg = sm.getContext('2d'); sg.imageSmoothingQuality = 'high'; sg.drawImage(tiled, 0, 0, sm.width, sm.height);
      og.imageSmoothingEnabled = true; og.globalAlpha = a; og.drawImage(sm, 0, 0, W3, H);
    }
  }
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  out.getContext('2d').drawImage(wide, W, 0, W, H, 0, 0, W, H);
  const tex = new THREE.CanvasTexture(out);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createSky(data, px) {
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.frustumCulled = false;
  const uniforms = {
    uTime: { value: 0 }, uPx: { value: px }, uScale: { value: 1 }, uFade: { value: 1 },
    uLimit: { value: 6.5 }, uGain: { value: 1 }, uExp: { value: 1 }, uPol: { value: 0 }, uLand: { value: 0 }, uUp: { value: new THREE.Vector3(0, 1, 0) },
  };
  const S = data.stars;

  // ----- Milky Way -----
  const mwTex = buildMilkyWayTexture(data.mw);
  const mwMat = new THREE.ShaderMaterial({
    vertexShader: MW_VERT, fragmentShader: MW_FRAG, uniforms: { uTex: { value: mwTex }, uOpacity: { value: 1.0 }, uThr: { value: 0 } },
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
  });
  const mw = new THREE.Mesh(new THREE.SphereGeometry(R_SKY * 0.98, 48, 32), mwMat);
  mw.renderOrder = -100; mw.frustumCulled = false;
  group.add(mw);

  // ----- constellation lines -----
  const lineMat = new THREE.LineBasicMaterial({ color: 0x7fa8ea, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending });
  const lt = buildLineTable(data);
  const vpos = new Float32Array(lt.nV * 3);          // current vertex directions (unit)
  const lineGeo = new THREE.BufferGeometry();
  let lineBuf = new Float32Array(1);
  /** Fill vertex directions from the current star directions, then subdivide segments [s0,s1) into out; returns floats written. */
  function lineVerts() {
    for (let v = 0; v < lt.nV; v++) {
      const st = lt.vStar[v], src = st >= 0 ? cur : lt.vRaw, o = st >= 0 ? st * 3 : v * 3;
      vpos[v * 3] = src[o]; vpos[v * 3 + 1] = src[o + 1]; vpos[v * 3 + 2] = src[o + 2];
    }
  }
  const _ta = [0, 0, 0], _tb = [0, 0, 0];
  function lineSegments(s0, s1) {
    const out = [];
    for (let k = s0; k < s1; k++) {
      const a = lt.segs[k * 2], b = lt.segs[k * 2 + 1];
      _ta[0] = vpos[a * 3]; _ta[1] = vpos[a * 3 + 1]; _ta[2] = vpos[a * 3 + 2]; _tb[0] = vpos[b * 3]; _tb[1] = vpos[b * 3 + 1]; _tb[2] = vpos[b * 3 + 2];
      subdivide(_ta.slice(), _tb.slice(), out);
    }
    return out;
  }
  function rebuildLines() {
    lineVerts();
    const out = lineSegments(0, lt.segs.length / 2);
    if (out.length > lineBuf.length || lineBuf.length === 1) {
      lineBuf = new Float32Array(Math.ceil(out.length * 1.5));
      lineGeo.setAttribute('position', new THREE.BufferAttribute(lineBuf, 3));
    }
    lineBuf.set(out); lineGeo.setDrawRange(0, out.length / 3); lineGeo.attributes.position.needsUpdate = true;
  }
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.renderOrder = -90; lines.frustumCulled = false;
  group.add(lines);
  const hlMat = new THREE.LineBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  const hlLines = new THREE.LineSegments(new THREE.BufferGeometry(), hlMat);
  hlLines.renderOrder = -89; hlLines.frustumCulled = false; hlLines.visible = false;
  group.add(hlLines);

  // ----- stars -----
  const n = S.n;
  const halo = new Float32Array(n), amag = new Float32Array(n);
  const pos = new Float32Array(n * 3), size = new Float32Array(n), bright = new Float32Array(n), col = new Float32Array(n * 3), phase = new Float32Array(n);
  const cur = new Float32Array(n * 3);               // current directions (J2000 axes, unit): J2000 plus proper motion
  for (let i = 0; i < n; i++) {
    pos[i * 3] = S.eq[i * 3] * R_SKY; pos[i * 3 + 1] = S.eq[i * 3 + 1] * R_SKY; pos[i * 3 + 2] = S.eq[i * 3 + 2] * R_SKY;
    cur[i * 3] = S.eq[i * 3]; cur[i * 3 + 1] = S.eq[i * 3 + 1]; cur[i * 3 + 2] = S.eq[i * 3 + 2];
    size[i] = starSize(S.mag[i]); bright[i] = starBright(S.mag[i]); amag[i] = S.mag[i];
    halo[i] = starHalo(S.mag[i]);
    const rgb = starRGB(S.bv[i]), w = 0.06 + 0.1 * (1 - halo[i]);   // faint stars stay a little whiter (rods), bright ones keep their hue
    col[i * 3] = (1 - w) * rgb[0] + w; col[i * 3 + 1] = (1 - w) * rgb[1] + w; col[i * 3 + 2] = (1 - w) * rgb[2] + w;
    phase[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1; phase[i] = Math.abs(phase[i]);
  }
  const sg = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  sg.setAttribute('position', posAttr);
  sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  sg.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
  sg.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  sg.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  sg.setAttribute('aHalo', new THREE.BufferAttribute(halo, 1));
  sg.setAttribute('aMag', new THREE.BufferAttribute(amag, 1));
  const starMat = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const stars = new THREE.Points(sg, starMat);
  stars.renderOrder = -80; stars.frustumCulled = false;
  group.add(stars);
  rebuildLines();

  // ----- deep-sky markers -----
  const dsoPos = new Float32Array(data.dso.length * 3);
  data.dso.forEach((d, i) => { dsoPos.set([d.eq[0] * R_SKY * 0.99, d.eq[1] * R_SKY * 0.99, d.eq[2] * R_SKY * 0.99], i * 3); });
  const dsoGeo = new THREE.BufferGeometry(); dsoGeo.setAttribute('position', new THREE.BufferAttribute(dsoPos, 3));
  const dsoMat = new THREE.PointsMaterial({ size: 17, sizeAttenuation: false, map: ringTexture(), transparent: true, opacity: 0.55, color: 0x8fc9ff, depthWrite: false, blending: THREE.AdditiveBlending });
  const dsos = new THREE.Points(dsoGeo, dsoMat); dsos.renderOrder = -75; dsos.frustumCulled = false;
  group.add(dsos);

  // ----- Sun / Moon / planets -----
  const nb = BODIES.length;
  const bpos = new Float32Array(nb * 3), bsize = new Float32Array(nb), bdisc = new Float32Array(nb), bcol = new Float32Array(nb * 3), bkind = new Float32Array(nb);
  BODIES.forEach((b, i) => { bcol.set(b.color, i * 3); bkind[i] = b.kind; });
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
  bg.setAttribute('aSize', new THREE.BufferAttribute(bsize, 1));
  bg.setAttribute('aColor', new THREE.BufferAttribute(bcol, 3));
  bg.setAttribute('aKind', new THREE.BufferAttribute(bkind, 1));
  bg.setAttribute('aDisc', new THREE.BufferAttribute(bdisc, 1));
  const bodyU = {
    uPx: uniforms.uPx, uScale: uniforms.uScale, uFade: { value: 1 }, uSunGlare: { value: 1 }, uOtherFade: { value: 1 },
    uMoonSun: { value: new THREE.Vector2(1, 0) }, uMoonNorth: { value: new THREE.Vector2(0, 1) }, uMoonAngle: { value: 0 },
  };
  const bodyMat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, uniforms: bodyU, transparent: true, depthWrite: false, blending: THREE.NormalBlending });
  const bodyPts = new THREE.Points(bg, bodyMat); bodyPts.renderOrder = -70; bodyPts.frustumCulled = false;
  group.add(bodyPts);
  // planets additive halo = same geometry would double up; the shader already draws glow with alpha.

  const bodies = BODIES.map((b, i) => ({
    id: b.id, type: b.type, kind: b.kind, index: i, eq: new THREE.Vector3(0, 1, 0), mag: 0, distAU: 0, ra: 0, dec: 0,
    phaseFraction: 1, moonPhase: 0, constellation: '', text: BODY_TEXT[b.id], elongation: 0,
  }));

  // ----- equator / ecliptic / poles -----
  // eqGroup lives in the equator-of-date frame (main.js sets its matrix to the transpose of the precession matrix):
  // the equator ring and the pole markers sit exactly on the true pole of the epoch, the ecliptic is tilted by the obliquity of that epoch.
  const eqGroup = new THREE.Group(); eqGroup.frustumCulled = false; eqGroup.matrixAutoUpdate = false;
  const ring = (fn, color, op) => {
    const p = []; for (let i = 0; i <= 180; i++) { const a = (i / 180) * Math.PI * 2; const v = fn(a); p.push(v[0] * R_SKY * 0.985, v[1] * R_SKY * 0.985, v[2] * R_SKY * 0.985); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
    l.frustumCulled = false; l.renderOrder = -85; return l;
  };
  eqGroup.add(ring((a) => [Math.cos(a), 0, -Math.sin(a)], 0x57c7ff, 0.5));
  const eclLine = ring((a) => [Math.cos(a), 0, -Math.sin(a)], 0xf2c14e, 0.45);
  eclLine.matrixAutoUpdate = false; eqGroup.add(eclLine);
  const pm = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, R_SKY * 0.985, 0, 0, -R_SKY * 0.985, 0], 3)),
    new THREE.PointsMaterial({ size: 11, sizeAttenuation: false, map: ringTexture(), transparent: true, opacity: 0.9, color: 0x57c7ff, depthWrite: false, blending: THREE.AdditiveBlending }));
  pm.frustumCulled = false; pm.renderOrder = -84; eqGroup.add(pm);
  group.add(eqGroup);
  const setObliquity = (epsRad) => { const c = Math.cos(epsRad), sn = Math.sin(epsRad); eclLine.matrix.set(1, 0, 0, 0, 0, c, -sn, 0, 0, sn, c, 0, 0, 0, 0, 1); eclLine.matrixWorldNeedsUpdate = true; };
  setObliquity(23.4393 * DEG);

  // ---------- API ----------
  let hlId = null;
  function rebuildHighlight() {
    const r = lt.range.get(hlId); if (!r) { hlLines.visible = false; return; }
    lineVerts();
    hlLines.geometry.dispose();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineSegments(r[0], r[1])), 3));
    hlLines.geometry = g; hlLines.visible = true;
  }
  const api = {
    group, uniforms, bodies, bodyU, eqGroup, mw, lines, hlLines, stars, dsos, dsoMat, bodyPts, lineMat, cur, setObliquity, lineTable: lt,
    setHighlight(id) {
      const c = id && data.consMap.get(id);
      hlId = c ? id : null;
      if (!c) { hlLines.visible = false; return; }
      rebuildHighlight();
    },
    /**
     * Move every star by its proper motion for dtYears since J2000 (pm = {pmra, pmdec} in mas/yr, Float32Array per star), and rebuild the
     * constellation lines so they follow their stars. dtYears = 0 restores the catalogue positions.
     */
    setEpoch(dtYears, pmra, pmdec) {
      const tmp = [0, 0, 0];
      if (!dtYears || !pmra) { cur.set(S.eq); }
      else for (let i = 0; i < n; i++) {
        if (pmra[i] === 0 && pmdec[i] === 0) { cur[i * 3] = S.eq[i * 3]; cur[i * 3 + 1] = S.eq[i * 3 + 1]; cur[i * 3 + 2] = S.eq[i * 3 + 2]; continue; }
        movedStar(S.ra[i], S.dec[i], pmra[i], pmdec[i], dtYears, tmp); cur[i * 3] = tmp[0]; cur[i * 3 + 1] = tmp[1]; cur[i * 3 + 2] = tmp[2];
      }
      for (let i = 0; i < n * 3; i++) pos[i] = cur[i] * R_SKY;
      posAttr.needsUpdate = true;
      rebuildLines(); if (hlId) rebuildHighlight();
    },
    /**
     * Recompute Sun, Moon, planets from astronomy-engine for a Date.
     * fix (Ages mode): { sun: [x,y,z] the Sun direction to use (J2000 axes), skipOthers } -- the Moon and planets, computed for the
     * far-away instant, are rigidly turned by the same small rotation that carries the instant's Sun onto `fix.sun`, so the Sun keeps
     * its seasonal position and every body keeps its true position relative to the Sun.
     */
    updateBodies(date, fix) {
      const A = globalThis.Astronomy; if (!A) return;
      const raw = (id) => { const v = A.GeoVector(id, date, true), d = Math.hypot(v.x, v.y, v.z); return { d, x: v.x / d, y: v.z / d, z: -v.y / d }; };   // EQJ (x, y, z) -> ours (x, z, -y)
      const sunR = raw('Sun');
      let q = null;
      if (fix) { _a.set(sunR.x, sunR.y, sunR.z); _b.set(fix.sun[0], fix.sun[1], fix.sun[2]); q = _q.setFromUnitVectors(_a, _b); }
      for (const b of bodies) {
        if (fix && fix.skipOthers && b.id !== 'Sun') continue;
        const v = b.id === 'Sun' ? sunR : raw(b.id);
        b.eq.set(v.x, v.y, v.z);
        if (q) { if (b.id === 'Sun') b.eq.set(fix.sun[0], fix.sun[1], fix.sun[2]); else b.eq.applyQuaternion(q); }
        b.distAU = v.d;
        const e = vecToEq([b.eq.x, b.eq.y, b.eq.z]); b.ra = e.ra; b.dec = e.dec;
        try { b.constellation = A.Constellation(e.ra / 15, e.dec).name; } catch (err) { b.constellation = ''; }
        let mag;
        if (b.id === 'Sun') mag = -26.74; else { try { const il = A.Illumination(b.id, date); mag = il.mag; b.phaseFraction = il.phase_fraction; } catch (err) { mag = 0; } }
        b.mag = mag;
        if (b.id === 'Moon') { b.moonPhase = A.MoonPhase(date); b.phaseFraction = (1 - Math.cos(b.moonPhase * DEG)) / 2; }
        bpos[b.index * 3] = b.eq.x * R_SKY * 0.97; bpos[b.index * 3 + 1] = b.eq.y * R_SKY * 0.97; bpos[b.index * 3 + 2] = b.eq.z * R_SKY * 0.97;
        if (b.id === 'Sun') bsize[b.index] = 150; else if (b.id === 'Moon') bsize[b.index] = 80;
        else {   // planet: sprite diameter and disc radius (CSS px) both grow with brightness
          const br = Math.min(6, Math.max(0, 1.6 - mag));
          bsize[b.index] = 22 + br * 6.5; bdisc[b.index] = (2.4 + br * 0.55) / (bsize[b.index] / 2);
        }
      }
      const sun = bodies[0], moon = bodies[1];
      sun.elongation = 0;
      moon.elongation = Math.acos(Math.min(1, Math.max(-1, sun.eq.dot(moon.eq)))) / DEG;
      bodyU.uMoonAngle.value = Math.PI - moon.elongation * DEG;
      bg.attributes.position.needsUpdate = true; bg.attributes.aSize.needsUpdate = true; bg.attributes.aDisc.needsUpdate = true;
    },
    /** Screen-space directions for the Moon shader. rot = celestial->world matrix. */
    updateMoonScreen(camera, rot, aspect, pole) {
      const sun = bodies[0].eq, moon = bodies[1].eq;
      const m = _a.copy(moon).applyMatrix4(rot), s = _b.copy(sun).applyMatrix4(rot);
      const proj = (v, out) => { _c.copy(v).multiplyScalar(R_SKY).add(camera.position).project(camera); out.set(_c.x * aspect, _c.y); };
      proj(m, _p0);
      _t.copy(s).addScaledVector(m, -s.dot(m)).normalize();
      _d.copy(m).addScaledVector(_t, 0.02).normalize(); proj(_d, _p1);
      bodyU.uMoonSun.value.copy(_p1).sub(_p0).normalize();
      if (pole) _t.set(pole[0], pole[1], pole[2]); else _t.set(0, 1, 0);
      _t.addScaledVector(m, -_t.dot(m)).normalize();
      _d.copy(m).addScaledVector(_t, 0.02).normalize(); proj(_d, _p1);
      bodyU.uMoonNorth.value.copy(_p1).sub(_p0).normalize();
    },
    /**
     * Nearest object to a direction (celestial frame unit vector `d`) within tolerance `tol` (rad).
     * Returns {type:'body'|'star'|'dso', ...}.
     */
    pick(d, tol, opts) {
      let best = null, bs = 1e9;
      for (const b of bodies) {
        if (!opts.planets && b.kind === 0) continue;
        if (opts.hideOthers && b.kind !== 1) continue;
        const ang = Math.acos(Math.min(1, b.eq.x * d[0] + b.eq.y * d[1] + b.eq.z * d[2]));
        const t = (b.kind ? Math.max(tol * 1.5, 0.045) : tol * 1.6);
        if (ang < t && ang < bs) { bs = ang; best = { type: 'body', body: b, ang }; }
      }
      if (best) return best;
      const cosTol = Math.cos(tol); let bsc = 1e9; const eq = cur;
      for (let i = 0; i < S.n; i++) {
        const c = eq[i * 3] * d[0] + eq[i * 3 + 1] * d[1] + eq[i * 3 + 2] * d[2];
        if (c < cosTol) continue;
        const ang = Math.acos(Math.min(1, c));
        if (opts.limit && S.mag[i] > opts.limit + 0.3) continue;   // invisible at this sky quality: not pickable
        const score = ang / tol - (6.6 - S.mag[i]) * 0.09;
        if (score < bsc) { bsc = score; best = { type: 'star', index: i, ang }; }
      }
      for (let i = 0; i < data.dso.length; i++) {
        const o = data.dso[i], ang = Math.acos(Math.min(1, o.eq[0] * d[0] + o.eq[1] * d[1] + o.eq[2] * d[2]));
        const t = Math.max(tol * 0.8, o.dim * 0.5 * DEG);
        if (ang < t) { const score = ang / t - 0.25 + 0.5; if (score < bsc) { bsc = score; best = { type: 'dso', dso: o, ang }; } }
      }
      return best;
    },
    setStarFade(f) { uniforms.uFade.value = f; },
  };
  return api;
}
const _q = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3();
const _p0 = new THREE.Vector2(), _p1 = new THREE.Vector2();
