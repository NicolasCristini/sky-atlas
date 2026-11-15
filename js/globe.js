// The Earth (unit sphere, north = +Y) and the teaching geometry drawn at the observer.
import * as THREE from '../vendor/three.module.min.js';
import { EARTH_VERT, EARTH_FRAG, ATMO_VERT, ATMO_FRAG, PIN_VERT, PIN_FRAG, DOME_VERT, DOME_FRAG } from './shaders.js';
import { latLonToVec } from './astro.js';

export const GOLD = 0xf2c14e;

export function loadTextures(onDone) {
  const loader = new THREE.TextureLoader();
  const load = (u) => new Promise((res, rej) => loader.load(u, (t) => { t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; res(t); }, undefined, rej));
  return Promise.all([load('img/earth-blue-marble.jpg'), load('img/earth-night.jpg')]).then(([day, night]) => ({ day, night }));
}

/** Create Earth + atmosphere materials. `sun` is a shared THREE.Vector3 (world-frame sun direction). */
export function makeEarthMaterials(tex, sun) {
  const earth = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG,
    uniforms: { uDay: { value: tex.day }, uNight: { value: tex.night }, uSun: { value: sun }, uCam: { value: new THREE.Vector3(0, 0, 5) } },
  });
  const atmo = new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, transparent: true, depthWrite: false,
    blending: THREE.NormalBlending, uniforms: { uSun: { value: sun }, uCam: { value: new THREE.Vector3(0, 0, 5) } },
  });
  return { earth, atmo };
}

export function makePinMaterial(px) {
  return new THREE.ShaderMaterial({
    vertexShader: PIN_VERT, fragmentShader: PIN_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: px } },
  });
}
export function pinGeometry(size, color, pulse) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute([size], 1));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(color, 3));
  g.setAttribute('aPulse', new THREE.Float32BufferAttribute([pulse], 1));
  return g;
}

/** Great-circle arc line (points on sphere at radius r). */
export function makeArc(color = GOLD, opacity = 0.9) {
  const N = 96;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const l = new THREE.Line(g, m); l.frustumCulled = false; l.visible = false; l.userData.N = N;
  return l;
}
export function setArc(line, gc, r = 1.006) {
  const N = line.userData.N, a = line.geometry.attributes.position, p = [0, 0, 0];
  for (let i = 0; i <= N; i++) { gc.at(i / N, p); a.setXYZ(i, p[0] * r, p[1] * r, p[2] * r); }
  a.needsUpdate = true; line.visible = true;
}

export function createGlobe(tex, sunVec, px) {
  const root = new THREE.Group();
  const mats = makeEarthMaterials(tex, sunVec);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), mats.earth);
  earth.renderOrder = 0;
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.045, 96, 48), mats.atmo);
  atmo.renderOrder = 5;
  root.add(earth, atmo);

  // --- Earth's axis extended to the celestial poles + celestial equator ring (globe mode only)
  const axisGroup = new THREE.Group();
  const axisG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -2.7, 0), new THREE.Vector3(0, 2.7, 0)]);
  axisGroup.add(new THREE.Line(axisG, new THREE.LineBasicMaterial({ color: 0x9fb8e8, transparent: true, opacity: 0.45, depthWrite: false })));
  const eqPts = []; for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; eqPts.push(new THREE.Vector3(Math.cos(a) * 2.4, 0, -Math.sin(a) * 2.4)); }
  const eqRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(eqPts), new THREE.LineBasicMaterial({ color: 0x57c7ff, transparent: true, opacity: 0.22, depthWrite: false }));
  axisGroup.add(eqRing);
  axisGroup.renderOrder = 6;
  root.add(axisGroup);
  const AXIS_LABELS = { ncp: new THREE.Vector3(0, 2.78, 0), scp: new THREE.Vector3(0, -2.78, 0), eq: new THREE.Vector3(2.4, 0, 0) };

  // --- teaching group at the observer: horizon disc, zenith line, sky dome hemisphere, pole line
  const pin = new THREE.Group(); pin.matrixAutoUpdate = false;
  const RDOME = 0.5;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(RDOME, 96),
    new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.renderOrder = 7;
  const discEdgePts = []; for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; discEdgePts.push(new THREE.Vector3(Math.cos(a) * RDOME, 0, Math.sin(a) * RDOME)); }
  const discEdge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(discEdgePts), new THREE.LineBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.8, depthWrite: false }));
  discEdge.renderOrder = 8;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(RDOME, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x6fb6ff, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
  dome.renderOrder = 7;
  const wp = [];
  const dd = (az, al) => { const a = az * Math.PI / 180, b = al * Math.PI / 180; return [Math.cos(b) * Math.sin(a) * RDOME, Math.sin(b) * RDOME, -Math.cos(b) * Math.cos(a) * RDOME]; };
  for (const al of [30, 60]) for (let az = 0; az < 360; az += 6) wp.push(...dd(az, al), ...dd(az + 6, al));
  for (let az = 0; az < 360; az += 45) for (let al = 0; al < 90; al += 6) wp.push(...dd(az, al), ...dd(az, al + 6));
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  const domeWire = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.28, depthWrite: false }));
  domeWire.renderOrder = 7;
  const zenith = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, RDOME * 1.3, 0)]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }));
  zenith.renderOrder = 8;
  pin.add(disc, discEdge, dome, domeWire, zenith);
  root.add(pin);

  // pole line: from the observer toward the elevated celestial pole (parallel to the Earth's axis)
  const poleLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1.1, 0)]),
    new THREE.LineBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.95, depthWrite: false }));
  poleLine.renderOrder = 8; poleLine.matrixAutoUpdate = true;
  root.add(poleLine);

  // pin marker
  const pinMat = makePinMaterial(px);
  const pinPt = new THREE.Points(pinGeometry(40, [1, 0.8, 0.35], 1), pinMat); pinPt.renderOrder = 9; pinPt.frustumCulled = false;
  const fromPt = new THREE.Points(pinGeometry(22, [0.6, 0.8, 1], 0), pinMat); fromPt.renderOrder = 9; fromPt.frustumCulled = false; fromPt.visible = false;
  root.add(pinPt, fromPt);

  const arc = makeArc(GOLD, 0.9); arc.renderOrder = 8; root.add(arc);

  const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _E = new THREE.Vector3(), _U = new THREE.Vector3(), _mz = new THREE.Vector3();
  const api = {
    root, earth, atmo, mats, pinMat, pin, arc, fromPt, axisGroup, AXIS_LABELS, poleLine, pinPt,
    setObserver(obs) {
      _E.fromArray(obs.E); _U.fromArray(obs.U); _mz.fromArray(obs.N).negate();
      _m.makeBasis(_E, _U, _mz).setPosition(obs.U[0] * 1.002, obs.U[1] * 1.002, obs.U[2] * 1.002);
      pin.matrix.copy(_m); pin.matrixWorldNeedsUpdate = true;
      pinPt.position.set(obs.U[0] * 1.012, obs.U[1] * 1.012, obs.U[2] * 1.012);
      poleLine.position.set(obs.U[0] * 1.002, obs.U[1] * 1.002, obs.U[2] * 1.002);
      poleLine.rotation.set(obs.lat >= 0 ? 0 : Math.PI, 0, 0);
    },
    setFrom(v) { if (!v) { fromPt.visible = false; return; } fromPt.position.set(v[0] * 1.012, v[1] * 1.012, v[2] * 1.012); fromPt.visible = true; },
    setCamera(pos) { mats.earth.uniforms.uCam.value.copy(pos); mats.atmo.uniforms.uCam.value.copy(pos); },
  };
  return api;
}

export function createDome() {
  // Camera-centred dome in the observer's local frame (x=E, y=Up, z=-N): ground, horizon glow, optional daylight sky.
  const u = {
    uGround: { value: 0 }, uSkyA: { value: 0 }, uZen: { value: new THREE.Vector3(0.05, 0.12, 0.3) }, uHor: { value: new THREE.Vector3(0.3, 0.45, 0.7) },
    uGlowCol: { value: new THREE.Vector3(0.28, 0.42, 0.7) }, uGlow: { value: 0.32 }, uSunL: { value: new THREE.Vector3(0, -1, 0) }, uSunTw: { value: 0 },
    uPol: { value: 0 }, uPolCol: { value: new THREE.Vector3(0.66, 0.42, 0.24) },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, uniforms: u, side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(40, 64, 40), mat);
  mesh.renderOrder = 20; mesh.frustumCulled = false;
  return { mesh, u };
}

/** Horizon ticks, alt-az grid in local frame (x=E,y=U,z=-N). */
export function createHorizonRig() {
  const g = new THREE.Group(); g.frustumCulled = false;
  const R = 38.5;
  const dir = (az, al) => { const a = az * Math.PI / 180, b = al * Math.PI / 180; return [Math.cos(b) * Math.sin(a) * R, Math.sin(b) * R, -Math.cos(b) * Math.cos(a) * R]; };
  // horizon circle + ticks
  const hp = [];
  for (let az = 0; az < 360; az += 2) { const a = dir(az, 0), b = dir(az + 2, 0); hp.push(...a, ...b); }
  for (let az = 0; az < 360; az += 5) { const major = az % 45 === 0, mid = az % 15 === 0; const h = major ? 3.2 : mid ? 1.9 : 1.0; const a = dir(az, 0), b = dir(az, h); hp.push(...a, ...b); }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
  const horizon = new THREE.LineSegments(hg, new THREE.LineBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false }));
  horizon.renderOrder = 22; horizon.frustumCulled = false; g.add(horizon);
  // alt-az grid
  const gp = [];
  for (const alt of [15, 30, 45, 60, 75]) for (let az = 0; az < 360; az += 3) { gp.push(...dir(az, alt), ...dir(az + 3, alt)); }
  for (let az = 0; az < 360; az += 30) for (let alt = 0; alt < 90; alt += 3) { gp.push(...dir(az, alt), ...dir(az, Math.min(90, alt + 3))); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  const grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x7aa2e0, transparent: true, opacity: 0.2, depthTest: false, depthWrite: false }));
  grid.renderOrder = 21; grid.frustumCulled = false; grid.visible = false; g.add(grid);
  return { group: g, grid, horizon };
}
