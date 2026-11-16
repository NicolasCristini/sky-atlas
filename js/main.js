// Sky Atlas: bootstrap, state, camera, travel, transitions, input and UI wiring.
import * as THREE from '../vendor/three.module.min.js';
import * as A from './astro.js';
import { loadData } from './data.js';
import { createSky } from './sky.js';
import { loadTextures, createGlobe, createDome, createHorizonRig, setArc } from './globe.js';
import { MiniGlobe } from './mini.js';
import { LabelLayer } from './labels.js';
import { basisQuat, globePose, skyPose, vecFromLatLon, clamp, lerp, smooth, easeInOut, slerpV3 } from './view.js';
import { CITIES, QUICK, byName, placeName, searchCities, nearestCity, formatCoord } from './cities.js';
import { initSearch } from './search.js';
import * as EX from './explainer.js';
import * as CARD from './cards.js';
import { QUALITY_DEFAULT, EXPOSURE_DEFAULT, qualityParams, countVisible, aboutCount, exposureFromSlider, sliderFromExposure } from './skyquality.js';
import { SLIDER_MAX, AGES_MAX, sliderToYears, yearsToSlider, decimalYear, formatYear, bodiesFade, EPOCHS, nearestPoleStar } from './ages.js';
import { initLessons } from './lessonui.js';

const $ = (s) => document.querySelector(s);
const DEG = A.DEG, RAD = A.RAD;
const PX = Math.min(window.devicePixelRatio || 1, 2);
const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SKY_H = 0.00015;          // camera height above the surface when "landed"
const GLOBE_FOV = 45;
const IS_NARROW = () => window.innerWidth < 760;

// ------------------------------------------------------------------ state
const S = {
  mode: 'globe',
  obs: { lat: 41.9, lon: 12.5, U: [0, 1, 0], N: [0, 0, -1], E: [1, 0, 0] },
  time: Date.now(), anchor: Date.now(), speed: 1, playing: true,
  layers: { lines: true, constNames: true, starNames: true, planets: true, mw: true, grid: false, eq: false, daylight: false },
  keepLocal: true,
  globe: { lat: 30, lon: -90, dist: 6.5, vLat: 0, vLon: 0, auto: true },
  sky: { az: 180, alt: 30, fov: 70, vAz: 0, vAlt: 0 },
  trans: null, travel: null, slew: null, intro: null, journey: null,
  sel: null, from: null, exList: null, hintShown: false,
  // time scale: 'day' (clock), 'year' (seasons at fixed local solar time), 'ages' (precession epoch; the clock is frozen at its base date)
  tm: 'day', yd: 0, speedBy: { day: 1, year: 5, ages: 100 },
  ages: { years: 0, baseYear: 2026.9, tween: null, chip: null, fade: 1 },
  q: QUALITY_DEFAULT, expo: EXPOSURE_DEFAULT,
};
// preferences: sky quality, star brightness and layer toggles survive reloads (localStorage can be unavailable: always try/catch)
const PREF_KEY = 'skyatlas.prefs';
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); if (!p || typeof p !== 'object') return;
    if (Number.isFinite(p.q)) S.q = Math.min(4, Math.max(0, p.q));
    if (Number.isFinite(p.expo)) S.expo = Math.min(3, Math.max(0.5, p.expo));
    if (p.layers && typeof p.layers === 'object') for (const k of Object.keys(S.layers)) if (typeof p.layers[k] === 'boolean') S.layers[k] = p.layers[k];
  } catch (e) { /* ignore */ }
}
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify({ q: S.q, expo: S.expo, layers: S.layers })); } catch (e) { /* ignore */ } }
loadPrefs();
const obsU = new THREE.Vector3(0, 1, 0), obsE = new THREE.Vector3(1, 0, 0), obsN = new THREE.Vector3(0, 0, -1);

function setObserver(lat, lon) {
  const o = S.obs; o.lat = lat; o.lon = lon;
  A.localBasis(lat, lon, o);
  obsU.fromArray(o.U); obsE.fromArray(o.E); obsN.fromArray(o.N);
}
function setObserverVec(v) { const ll = A.vecToLatLon([v.x, v.y, v.z]); setObserver(ll.lat, ll.lon); obsU.copy(v).normalize(); o2arr(obsU, S.obs.U); }
const o2arr = (v, a) => { a[0] = v.x; a[1] = v.y; a[2] = v.z; };
setObserver(41.9, 12.5);

// ------------------------------------------------------------------ boot
init().catch((e) => { console.error(e); const t = $('#loading-text'); if (t) t.textContent = 'Something went wrong: ' + e.message; });

async function init() {
  const canvas = $('#gl');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { $('#fallback').hidden = false; $('#loading').classList.add('done'); return; }
  renderer.setPixelRatio(PX); renderer.setClearColor(0x03050a, 1);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(GLOBE_FOV, 1, 0.001, 300);
  scene.add(cam);

  const [data, tex] = await Promise.all([loadData(), loadTextures()]);
  const sunWorld = new THREE.Vector3(1, 0, 0);
  const rotMat = new THREE.Matrix4(), rotInv = new THREE.Matrix4(), localMat = new THREE.Matrix4();

  // ----- scene objects
  const sky = createSky(data, PX); scene.add(sky.group);
  setTimeout(() => requestAnimationFrame(() => sky.loadMilkyWay(renderer, document.documentElement.classList.contains('phone'))), 600);   // photographic Milky Way, lazily after first render
  const globe = createGlobe(tex, sunWorld, PX); scene.add(globe.root);
  const dome = createDome(); scene.add(dome.mesh);
  const rig = createHorizonRig(); scene.add(rig.group);
  rig.group.matrixAutoUpdate = true;
  const mini = new MiniGlobe($('#mini'), tex, sunWorld, PX, (lat, lon) => goTo(lat, lon));

  // ----- labels
  const labels = new LabelLayer($('#labels'));
  const starLabels = [];
  const addConstLabels = () => {
    for (const c of data.cons) for (const l of c.labels) labels.add({ text: c.name, cls: 'const', kind: 'eq', v: new THREE.Vector3(...l.eq), group: 'const', prio: 20 + c.rank, charW: 8, id: c.id, click: () => selectCons(c.id) });
    for (const i of data.named) {
      const nm = data.names[data.stars.hip[i]];
      starLabels.push(labels.add({ text: nm.name, cls: 'star', kind: 'eq', v: new THREE.Vector3(data.stars.eq[i * 3], data.stars.eq[i * 3 + 1], data.stars.eq[i * 3 + 2]), group: 'star', prio: 3 + data.stars.mag[i] * 2, mag: data.stars.mag[i], anchor: 'r', charW: 6.2, si: i }));
    }
    for (const d of data.dso) if (DSO_LABELLED.has(d.name)) labels.add({ text: d.name, cls: 'dso', kind: 'eq', v: new THREE.Vector3(...d.eq), group: 'dso', prio: 18, anchor: 'r', charW: 6, baseOp: 0.9 });
    for (const b of sky.bodies) labels.add({ text: b.id, cls: 'body', kind: 'eq', v: b.eq, group: b.id === 'Sun' ? 'sunmoon' : b.kind ? 'moon' : 'planet', prio: 1, anchor: 'r', charW: 7, force: true });
    const card = [['N', 0, 'cardinal'], ['NE', 45, 'cardinal minor'], ['E', 90, 'cardinal'], ['SE', 135, 'cardinal minor'], ['S', 180, 'cardinal'], ['SW', 225, 'cardinal minor'], ['W', 270, 'cardinal'], ['NW', 315, 'cardinal minor']];
    for (const [t, az, cls] of card) { const a = az * DEG, al = 3 * DEG; labels.add({ text: t, cls, kind: 'local', v: new THREE.Vector3(Math.cos(al) * Math.sin(a), Math.sin(al), -Math.cos(al) * Math.cos(a)), group: 'cardinal', prio: 0, noCollide: true }); }
    poleLblN = labels.add({ text: 'North celestial pole', cls: 'polemark', kind: 'eq', v: new THREE.Vector3(0, 1, 0), group: 'polemark', prio: 2, noCollide: true, anchor: 'r', charW: 7.2, minAlt: -0.012 });
    poleLblS = labels.add({ text: 'South celestial pole', cls: 'polemark', kind: 'eq', v: new THREE.Vector3(0, -1, 0), group: 'polemark', prio: 2, noCollide: true, anchor: 'r', charW: 7.2, minAlt: -0.012 });
    labels.add({ text: 'zenith', cls: 'zenith', kind: 'local', v: new THREE.Vector3(0, 1, 0), group: 'zenith', prio: 5, noCollide: true });
    // globe-mode labels (world space)
    for (const [t, v, cls] of [['North celestial pole', globe.AXIS_LABELS.ncp, 'world'], ['South celestial pole', globe.AXIS_LABELS.scp, 'world'], ['Celestial equator', globe.AXIS_LABELS.eq, 'world eq']]) labels.add({ text: t, cls, kind: 'world', v: v.clone(), group: 'world', prio: 1, noCollide: true, charW: 7.2 });
    zenithLbl = labels.add({ text: 'Your zenith', cls: 'world zenith', kind: 'world', v: new THREE.Vector3(), group: 'worldPin', prio: 1, noCollide: true, charW: 6 });
    poleLbl = labels.add({ text: 'to celestial pole', cls: 'world', kind: 'world', v: new THREE.Vector3(), group: 'worldPin', prio: 1, noCollide: true, charW: 6.8 });
    labels.finalize();
  };
  let zenithLbl, poleLbl, poleLblN, poleLblS;
  const DSO_LABELLED = new Set(['Large Magellanic Cloud', 'Small Magellanic Cloud', 'Andromeda Galaxy', 'Orion Nebula', 'Pleiades', 'Carina Nebula', 'Omega Centauri', 'Galactic Centre', 'Hyades', '47 Tucanae', 'Double Cluster (h Per)', 'Southern Pleiades']);
  addConstLabels();

  // ------------------------------------------------------------------ time / celestial
  // Three time scales share one renderer:
  //   day  : the clock S.time runs / is scrubbed (existing behaviour).
  //   year : the clock is frozen at its base instant; S.yd days are added to the *date* while Earth's rotation is advanced only by the
  //          sidereal excess (K_SOL), so local solar time stays fixed and the seasons slide past without a daily blur.
  //   ages : the clock is frozen; S.ages.years moves the *epoch*: precession (long-term model) and proper motion are applied to the star
  //          field, the Sun keeps its calendar position in the equator of date, Moon/planets come from the instant base + years.
  const K_SOL = 0.98564736629 / 360.98564736629;
  let precJd = -1e9, precP = null, lastBodiesT = -1e18, lastBodiesWall = 0, lastInstKey = '', epochKey = '';
  const pole = [0, 1, 0];                       // celestial pole of date, as a J2000-frame unit vector
  const sunOfs = [0, 0, 0];
  function epochTag() { return S.tm === 'ages' ? 'a' + Math.round(S.ages.years / 100) : ''; }
  function epochArg() { return S.tm === 'ages' ? { P: precP, tag: epochTag() } : undefined; }
  function applyEpochStars(dt) {
    const key = dt.toFixed(4); if (key === epochKey) return; epochKey = key;
    sky.setEpoch(dt, data.stars.pmra, data.stars.pmdec);
    for (const it of starLabels) it.v.set(sky.cur[it.si * 3], sky.cur[it.si * 3 + 1], sky.cur[it.si * 3 + 2]);
  }
  function agesSun(jd, years, Pe) {
    const Aa = globalThis.Astronomy, v = Aa.GeoVector('Sun', new Date(S.time), true), d = Math.hypot(v.x, v.y, v.z);
    const sb = [v.x / d, v.z / d, -v.y / d];                                 // Sun at the base date, J2000 axes
    const ofDate = A.applyMat(A.precessionMatrixLongMine(jd), sb);           // its place in the equator of that date ...
    const T0 = (jd - 2451545) / 36525;
    const re = A.retiltObliquity(ofDate, A.obliquityDeg(T0) * DEG, A.obliquityDeg(T0 + years / 100) * DEG);   // ... re-tilted to the obliquity of the epoch
    return A.applyMat(A.transposeMat(Pe), re, sunOfs);                      // ... and back into the J2000 frame the star field lives in
  }
  function updateCelestial(force) {
    const tm = S.tm, jd = A.jdFromMs(S.time), now = performance.now();
    let jdRot = jd, jdP = jd, years = 0;
    if (tm === 'year') { jdRot = jd + S.yd * K_SOL; jdP = jd + S.yd; }
    if (tm === 'ages') {
      years = S.ages.years; jdP = jd + years * 365.25;
      precP = A.precessionMatrixLongMine(jdP); precJd = -1e9;
      applyEpochStars((jdP - 2451545) / 365.25);
    } else {
      if (epochKey !== '') { epochKey = ''; sky.setEpoch(0); for (const it of starLabels) it.v.set(sky.cur[it.si * 3], sky.cur[it.si * 3 + 1], sky.cur[it.si * 3 + 2]); }   // leaving Ages: catalogue positions again
      if (!precP || Math.abs(jdP - precJd) > 0.2) { precP = A.precessionMatrixMine(jdP); precJd = jdP; }
    }
    const gm = A.gmstHours(jdRot) * 15 * DEG, c = Math.cos(gm), s = Math.sin(gm), P = precP;
    rotMat.set(
      c * P[0] - s * P[6], c * P[1] - s * P[7], c * P[2] - s * P[8], 0,
      P[3], P[4], P[5], 0,
      s * P[0] + c * P[6], s * P[1] + c * P[7], s * P[2] + c * P[8], 0,
      0, 0, 0, 1);
    rotInv.copy(rotMat).transpose();
    // the equator ring, ecliptic and pole markers live in the equator-of-date frame; the ecliptic tilts by the obliquity of the epoch
    sky.eqGroup.matrix.set(P[0], P[3], P[6], 0, P[1], P[4], P[7], 0, P[2], P[5], P[8], 0, 0, 0, 0, 1); sky.eqGroup.matrixWorldNeedsUpdate = true;
    sky.setObliquity(A.obliquityDeg((jdP - 2451545) / 36525) * DEG);
    pole[0] = P[3]; pole[1] = P[4]; pole[2] = P[5];
    if (poleLblN) { poleLblN.v.set(pole[0], pole[1], pole[2]); poleLblS.v.set(-pole[0], -pole[1], -pole[2]); }
    // Sun, Moon, planets
    if (tm === 'day') {
      S.ages.fade = 1;
      if (force || Math.abs(S.time - lastBodiesT) > 1500) { sky.updateBodies(new Date(S.time)); lastBodiesT = S.time; }
    } else {
      const key = tm === 'year' ? S.yd.toFixed(3) : String(Math.round(years * 365.2422)) + '|' + S.ages.baseYear.toFixed(3) + '|' + years.toFixed(2);
      if (force || key !== lastInstKey) {
        if (force || now - lastBodiesWall > 70 || tm === 'year') {
          lastInstKey = key; lastBodiesWall = now;
          if (tm === 'year') { sky.updateBodies(new Date(S.time + S.yd * 864e5)); S.ages.fade = 1; }
          else {
            const E = S.ages.baseYear + years; S.ages.fade = bodiesFade(E);
            sky.updateBodies(new Date(S.time + Math.round(years * 365.2422) * 864e5), { sun: agesSun(jd, years, precP), skipOthers: S.ages.fade <= 0 });
          }
          lastBodiesT = S.time;
        }
      }
    }
    sky.bodyU.uOtherFade.value = S.ages.fade;
    sunWorld.copy(sky.bodies[0].eq).applyMatrix4(rotMat).normalize();
  }
  const _arr = [0, 0, 0];
  function altAzOfEq(v) { _t1.copy(v).applyMatrix4(rotMat); _arr[0] = _t1.x; _arr[1] = _t1.y; _arr[2] = _t1.z; return A.azAltFromDir(_arr, S.obs); }
  const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _pv = new THREE.Vector3();

  // ------------------------------------------------------------------ header / UI refresh
  const elName = $('#place-name'), elCoords = $('#place-coords');
  let lastHeader = '';
  function updateHeader() {
    const pn = placeName(S.obs.lat, S.obs.lon);
    const key = pn.title + S.obs.lat.toFixed(2) + S.obs.lon.toFixed(2);
    if (key === lastHeader) return; lastHeader = key;
    elName.textContent = pn.title; elName.classList.toggle('long', pn.title.length > 15); elName.title = `${pn.title} · ${pn.sub}`;
    elCoords.textContent = formatCoord(S.obs.lat, S.obs.lon);
  }
  function placeLabel(lat, lon) { const p = placeName(lat, lon); return p.short || p.title; }

  // ------------------------------------------------------------------ camera
  const SKY_DIR = new THREE.Vector3();
  function skyDirNormal(out) { A.dirFromAzAlt(S.sky.az, S.sky.alt, S.obs, _arr); return out.set(_arr[0], _arr[1], _arr[2]); }

  const tq0 = new THREE.Quaternion(), tq1 = new THREE.Quaternion(), tqA = new THREE.Quaternion(), tqD = new THREE.Quaternion();
  const tp0 = new THREE.Vector3(), tp1 = new THREE.Vector3(), tdir = new THREE.Vector3(), tfw = new THREE.Vector3();
  const tpos = new THREE.Vector3(), _hd = new THREE.Vector3();
  function transitionPose(u) {
    const T = S.trans;
    globePose(T.g, tp0, tq0);
    skyDirNormal(tdir); skyPose(obsU, tdir, SKY_H, tp1, tq1);
    const r0 = tp0.length();
    tp0.normalize();
    slerpV3(tp0, obsU, smooth(0, 0.85, u), tpos);
    const h0 = Math.max(r0 - 1, 0.05), h = Math.exp(lerp(Math.log(h0), Math.log(SKY_H), Math.pow(u, 1.25)));
    cam.position.copy(tpos).multiplyScalar(1 + h);
    tfw.copy(obsU).sub(cam.position);          // look down at the pin ...
    _hd.copy(tdir).addScaledVector(obsU, -tdir.dot(obsU));   // ... with the final heading pointing up the screen
    if (_hd.lengthSq() < 1e-6) _hd.copy(obsN);
    basisQuat(tfw, _hd, tqD);
    tqA.slerpQuaternions(tq0, tqD, smooth(0.04, 0.7, u));
    cam.quaternion.slerpQuaternions(tqA, tq1, smooth(0.5, 1, u));
    return lerp(GLOBE_FOV, S.sky.fov, smooth(0.5, 1, u));
  }
  let curFov = -1, curNear = -1;
  function updateCamera() {
    let fov;
    if (S.trans) fov = transitionPose(S.trans.u);
    else if (S.mode === 'globe') { globePose(S.globe, cam.position, cam.quaternion); fov = GLOBE_FOV; }
    else {
      const d = S.travel && S.travel.skyDir ? S.travel.skyDir : skyDirNormal(SKY_DIR);
      skyPose(obsU, d, SKY_H, cam.position, cam.quaternion); fov = S.sky.fov;
    }
    if (W < H) fov = 2 * Math.atan(Math.tan(fov * DEG / 2) * Math.pow(W / H, -0.6)) / DEG;   // portrait: keep the horizontal view usable
    const h = cam.position.length() - 1;
    const near = clamp(h * 0.3, 2e-5, 0.05);
    if (fov !== curFov || Math.abs(near - curNear) > curNear * 0.05) { cam.fov = fov; cam.near = near; cam.updateProjectionMatrix(); curFov = fov; curNear = near; }
    cam.updateMatrixWorld();
    return h;
  }


  // ------------------------------------------------------------------ travel HUD
  const hud = $('#travel-hud'), thRoute = $('#th-route'), thKm = $('#th-km'), thLat = $('#th-lat'), thPole = $('#th-pole'), thFill = $('#th-fill'), thLive = $('#th-live');
  const fmtLat = (v) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? 'N' : 'S'}`;
  let hudHide = 0;
  function hudStart(T) {
    clearTimeout(hudHide);
    thRoute.textContent = `${T.fromName} → ${T.toName}`;
    thKm.textContent = `${Math.round(T.km).toLocaleString('en-US')} km`;
    hudUpdate(T, 0);
    hud.classList.add('on');
    thLive.textContent = `Travelling from ${T.fromName} to ${T.toName}, ${Math.round(T.km).toLocaleString('en-US')} kilometres. The celestial pole is ${Math.abs(T.lat0).toFixed(0)} degrees above the horizon.`;
  }
  function hudPoleText(T) {
    const la = S.obs.lat, north0 = T.lat0 >= 0, north = la >= 0;
    if (Math.abs(la) < 0.5) return '<b>Both celestial poles</b> sit on the horizon (0°)';
    const name = north ? 'North' : 'South';
    const from = north === north0 ? Math.abs(T.lat0) : 0;
    return `<b>${name} celestial pole:</b> ${from.toFixed(1)}° → <b>${Math.abs(la).toFixed(1)}°</b> above the horizon`;
  }
  function hudUpdate(T, e) {
    thLat.textContent = fmtLat(S.obs.lat);
    thPole.innerHTML = hudPoleText(T);
    thFill.style.width = `${(e * 100).toFixed(1)}%`;
  }
  function hudEnd(T) {
    thFill.style.width = '100%'; thLat.textContent = fmtLat(S.obs.lat); thPole.innerHTML = hudPoleText(T);
    thLive.textContent = `Arrived in ${T.toName}. The ${S.obs.lat >= 0 ? 'north' : 'south'} celestial pole is ${Math.abs(S.obs.lat).toFixed(0)} degrees above the horizon.`;
    hudHide = setTimeout(() => hud.classList.remove('on'), 1100);
  }

  // ------------------------------------------------------------------ travel
  function travelTo(lat, lon, opts = {}) {
    if (S.travel || S.trans) return Promise.resolve(false);
    const A0 = new THREE.Vector3().copy(obsU), B0 = new THREE.Vector3(...A.latLonToVec(lat, lon));
    const gc = A.greatCircle([A0.x, A0.y, A0.z], [B0.x, B0.y, B0.z]);
    S.globe.auto = false; S.intro = null; hideHint();
    if (gc.angle < 0.0008) { setObserver(lat, lon); obsU.copy(B0); o2arr(B0, S.obs.U); onObserverChanged(true); return Promise.resolve(true); }
    S.from = { lat: S.obs.lat, lon: S.obs.lon, name: placeLabel(S.obs.lat, S.obs.lon) };
    const km = gc.angle * 6371;
    const dur = (opts.duration || clamp(2.5 + (gc.angle / Math.PI) * 2.3, 2.6, 4.8)) * (reduced ? 0.3 : 1);
    const T = {
      gc, A0, B0, axisV: new THREE.Vector3(...gc.axis), angle: gc.angle, t0: performance.now(), dur: dur * 1000,
      lonPrev: S.obs.lon, lonCum: 0, shiftDone: 0, dir0: S.mode === 'sky' ? skyDirNormal(new THREE.Vector3()) : null, skyDir: null,
      view0: vecFromLatLon(S.globe.lat, S.globe.lon, new THREE.Vector3()), dist0: S.globe.dist, pitchFrom: 0, pitchTo: opts.pitchTo,
      resolve: null, km, lastHdr: 0, lat0: S.obs.lat, fromName: S.from.name, toName: placeLabel(lat, lon),
    };
    if (T.dir0) { T.skyDir = T.dir0.clone(); T.pitchFrom = Math.asin(clamp(T.dir0.dot(A0), -1, 1)) / DEG; }
    S.travel = T; document.body.classList.add('busy');
    globe.setFrom([A0.x, A0.y, A0.z]); mini.setFrom([A0.x, A0.y, A0.z]);
    globe.pin.visible = true;
    setArc(globe.arc, gc); mini.setArc(gc); mini.recenter();
    hudStart(T);
    return new Promise((res) => { T.resolve = res; });
  }

  const _tv = new THREE.Vector3(), _hv = new THREE.Vector3();
  function updateTravel(now) {
    const T = S.travel; if (!T) return;
    const u = clamp((now - T.t0) / T.dur, 0, 1), e = easeInOut(u);
    _tv.copy(T.A0).applyAxisAngle(T.axisV, T.angle * e);
    if (u >= 1) _tv.copy(T.B0);
    setObserverVec(_tv);
    // local-time shift (continuous)
    const dl = A.norm180(S.obs.lon - T.lonPrev); T.lonPrev = S.obs.lon; T.lonCum += dl;
    if (S.keepLocal) {
      const shift = (-T.lonCum / 15) * 3600e3, delta = shift - T.shiftDone; T.shiftDone = shift;
      S.time += delta; S.anchor += delta;
    }
    if (T.skyDir) {
      T.skyDir.copy(T.dir0).applyAxisAngle(T.axisV, T.angle * e);
      if (T.pitchTo !== undefined) {   // tilt the view while keeping the horizon level and the heading
        const alt = lerp(T.pitchFrom, T.pitchTo, e) * DEG;
        _hv.copy(T.skyDir).addScaledVector(obsU, -T.skyDir.dot(obsU));
        if (_hv.lengthSq() > 1e-8) { _hv.normalize(); T.skyDir.copy(_hv).multiplyScalar(Math.cos(alt)).addScaledVector(obsU, Math.sin(alt)); }
      }
    } else {
      slerpV3(T.view0, T.B0, e, _pv);
      S.globe.lat = Math.asin(clamp(_pv.y, -1, 1)) * RAD; S.globe.lon = Math.atan2(-_pv.z, _pv.x) * RAD;
      S.globe.dist = T.dist0 * (1 + 0.16 * Math.sin(Math.PI * e));
    }
    onObserverChanged(false);
    if (now - T.lastHdr > 90 || u >= 1) { T.lastHdr = now; updateHeader(); refreshLive(); hudUpdate(T, e); }
    if (u >= 1) finishTravel();
  }
  function finishTravel() {
    const T = S.travel;
    if (T.skyDir) { const aa = A.azAltFromDir([T.skyDir.x, T.skyDir.y, T.skyDir.z], S.obs); S.sky.az = aa.az; S.sky.alt = clamp(aa.alt, -10, 89); }
    S.travel = null; document.body.classList.remove('busy'); hudEnd(T);
    onObserverChanged(true); updateHeader(); refreshLive(true);
    renderCompare();
    const r = T.resolve; r && r(true);
  }
  function onObserverChanged(final) {
    globe.setObserver(S.obs);
    mini.setObserver(S.obs.U, S.obs.lat, S.obs.lon);
    if (final) { updateHeader(); }
  }

  // ------------------------------------------------------------------ mode transitions
  function enterSky(opts = {}) {
    if (S.trans || S.travel || S.mode === 'sky') return Promise.resolve();
    if (opts.az !== undefined) { S.sky.az = opts.az; S.sky.alt = opts.alt ?? S.sky.alt; }
    if (opts.fov) S.sky.fov = opts.fov;
    hideHint(); S.globe.auto = false; S.intro = null;
    const g = { lat: S.globe.lat, lon: S.globe.lon, dist: S.globe.dist };
    S.mode = 'sky'; document.body.className = document.body.className.replace(/mode-\w+/, 'mode-sky'); syncSeg();
    return new Promise((res) => { S.trans = { dir: 'down', t0: performance.now(), dur: (reduced ? 0.4 : 2.6) * 1000, u: 0, g, res }; });
  }
  function leaveSky() {
    if (S.trans || S.travel || S.mode === 'globe') return Promise.resolve();
    S.globe.lat = S.obs.lat; S.globe.lon = S.obs.lon; S.globe.dist = S.globe.dist > 4.5 ? 3.4 : Math.max(S.globe.dist, 2.6);
    const g = { lat: S.globe.lat, lon: S.globe.lon, dist: S.globe.dist };
    S.mode = 'globe'; document.body.className = document.body.className.replace(/mode-\w+/, 'mode-globe'); syncSeg();
    $('#mini').hidden = true; closeCard();
    return new Promise((res) => { S.trans = { dir: 'up', t0: performance.now(), dur: (reduced ? 0.4 : 2.4) * 1000, u: 1, g, res }; });
  }
  function updateTransition(now) {
    const T = S.trans; if (!T) return;
    const t = clamp((now - T.t0) / T.dur, 0, 1), e = easeInOut(t);
    T.u = T.dir === 'down' ? e : 1 - e;
    if (t >= 1) {
      S.trans = null;
      if (T.dir === 'down') { $('#mini').hidden = false; mini.recenter(); mini.setObserver(S.obs.U, S.obs.lat, S.obs.lon); }
      T.res();
    }
  }

  // ------------------------------------------------------------------ slew (look at something)
  function slewTo(az, alt, fov, dur = 0.9) {
    const s = S.sky; let d = ((az - s.az + 540) % 360) - 180;
    S.slew = { t0: performance.now(), dur: (reduced ? 0.2 : dur) * 1000, az0: s.az, az1: s.az + d, alt0: s.alt, alt1: clamp(alt, -8, 89), fov0: s.fov, fov1: fov || s.fov };
    s.vAz = s.vAlt = 0;
  }
  function updateSlew(now) {
    const w = S.slew; if (!w) return;
    const t = clamp((now - w.t0) / w.dur, 0, 1), e = easeInOut(t);
    S.sky.az = A.norm360(lerp(w.az0, w.az1, e)); S.sky.alt = lerp(w.alt0, w.alt1, e); S.sky.fov = lerp(w.fov0, w.fov1, e);
    if (t >= 1) S.slew = null;
  }

  // ------------------------------------------------------------------ selection and cards
  const card = $('#card');
  function selEq(sel, out) {
    if (sel.type === 'star') return out.set(sky.cur[sel.index * 3], sky.cur[sel.index * 3 + 1], sky.cur[sel.index * 3 + 2]);
    if (sel.type === 'body') return out.copy(sel.body.eq);
    if (sel.type === 'dso') return out.set(...sel.dso.eq);
    if (sel.type === 'cons') return out.set(...sel.cons.center);
    return out.set(0, 1, 0);
  }
  function select(sel) {
    S.sel = sel;
    sky.setHighlight(sel && sel.type === 'cons' ? sel.cons.id : null);
    document.querySelectorAll('.lbl.const').forEach((e) => e.classList.remove('sel'));
    if (!sel) { card.hidden = true; explainer.classList.remove('compact'); return; }
    let html = '';
    if (sel.type === 'star') { sel.info = data.starInfo(sel.index); html = CARD.starCard(sel.info, data.stars, sel.index); }
    else if (sel.type === 'body') html = CARD.bodyCard(sel.body);
    else if (sel.type === 'dso') { let cn = ''; try { cn = Astronomy.Constellation(sel.dso.ra / 15, sel.dso.dec).name; } catch (e) { /* ignore */ } html = CARD.dsoCard(sel.dso, cn); }
    else if (sel.type === 'cons') html = CARD.consCard(sel.cons);
    card.innerHTML = html; card.hidden = false;
    if (!IS_NARROW()) explainer.classList.add('compact');   // the card takes the column; the explainer folds to its header
    if (IS_NARROW()) setExplainer(false);
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    refreshCardLive();
    if (sel.type === 'cons') labels.items.forEach((it) => { if (it.id === sel.cons.id) it.el.classList.add('sel'); });
  }
  function closeCard() { select(null); }
  function selectCons(id) { const c = data.consMap.get(id); if (!c) return; ensureSkyThen(() => select({ type: 'cons', cons: c })); }
  function selectStarByHip(hip) { const i = data.hipIndex.get(hip); if (i === undefined) return; ensureSkyThen(() => { select({ type: 'star', index: i }); centreOnSelection(); }); }
  function selectDso(id) { const d = data.dso.find((x) => x.id === id); if (!d) return; ensureSkyThen(() => { select({ type: 'dso', dso: d }); centreOnSelection(); }); }
  function ensureSkyThen(fn) {
    if (S.mode === 'sky' && !S.trans) { fn(); return; }
    if (S.mode === 'globe' && !S.trans && !S.travel) { enterSky().then(fn); return; }
    setTimeout(() => ensureSkyThen(fn), 200);
  }
  let liveT = 0;
  function refreshCardLive() {
    const sel = S.sel, el = $('#card-live'); if (!sel || !el) return;
    const eq = selEq(sel, _t3); const aa = altAzOfEq(eq), lat = S.obs.lat;
    const decNow = Math.asin(clamp(precP[3] * eq.x + precP[4] * eq.y + precP[5] * eq.z, -1, 1)) * RAD;   // declination of date: follows the epoch on screen
    if (sel.type === 'star') el.innerHTML = CARD.starLive(decNow, lat, aa);
    else if (sel.type === 'body') el.innerHTML = CARD.bodyLive(sel.body, aa, lat);
    else if (sel.type === 'dso') el.innerHTML = CARD.dsoLive(sel.dso, aa, lat, decNow);
    else if (sel.type === 'cons') el.innerHTML = CARD.consLive(data, sel.cons, lat, aa, epochArg());
  }
  function centreOnSelection() {
    if (!S.sel) return;
    const run = () => { const aa = altAzOfEq(selEq(S.sel, _t3)); slewTo(aa.az, Math.max(aa.alt, 6), S.sel.type === 'cons' ? Math.max(S.sky.fov, 65) : undefined); };
    if (S.mode === 'sky' && !S.trans) run();
    else if (S.mode === 'globe' && !S.trans && !S.travel) { const aa = altAzOfEq(selEq(S.sel, _t3)); enterSky({ az: aa.az, alt: Math.max(aa.alt, 6) }); }
  }
  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') closeCard(); else if (a === 'centre') centreOnSelection(); else if (a === 'cons') selectCons(b.dataset.id);
  });

  // reticle
  const reticle = $('#reticle');
  const _rp = new THREE.Vector3();
  function updateReticle(land) {
    if (!S.sel || S.sel.type === 'cons' || land < 0.5) { reticle.hidden = true; return; }
    selEq(S.sel, _rp).applyMatrix4(rotMat);
    const above = _rp.dot(obsU) > -0.01, front = _rp.dot(_fwd) > 0.05;
    if (!above || !front) { reticle.hidden = true; return; }
    _rp.multiplyScalar(50).add(cam.position).project(cam);
    reticle.hidden = false;
    reticle.style.transform = `translate3d(${((_rp.x * 0.5 + 0.5) * W).toFixed(1)}px,${((-_rp.y * 0.5 + 0.5) * H).toFixed(1)}px,0)`;
  }

  // ------------------------------------------------------------------ comparison + explainer
  const exLive = document.createElement('div'), exCmp = document.createElement('div'), exIdea = document.createElement('div'), exJ = document.createElement('div');
  const explainer = $('#explainer');
  explainer.innerHTML = `<div class="ex-head"><h2>Why the sky changed</h2><span class="ex-expand">Show</span><button class="icon-btn" id="ex-collapse" aria-label="Close panel" title="Close panel"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
  exLive.className = 'ex-sec'; exCmp.className = 'ex-sec'; exIdea.className = 'ex-sec'; exJ.className = 'ex-sec'; exCmp.hidden = true;
  exIdea.innerHTML = `<h3>The two rules</h3><p class="insight"><b>Latitude decides which stars you can ever see.</b> The celestial pole always sits as high above your horizon as your latitude.</p><p class="insight"><b>Longitude only decides when.</b> Moving east or west just shifts the clock: the same sky arrives earlier or later.</p>${EX.SKY_LINE_HTML}`;
  const exAges = document.createElement('div'); exAges.className = 'ex-sec'; exAges.innerHTML = EX.AGES_HTML; exAges.hidden = true;
  exJ.innerHTML = `<h3>Guided journeys</h3>${EX.journeysHTML()}`;
  exLive.innerHTML = '';
  explainer.append(exLive, exCmp, exIdea, exAges, exJ);
  let lastLiveKey = '';
  function refreshLive(force) {
    const key = S.obs.lat.toFixed(1) + '|' + epochTag();
    if (!force && key === lastLiveKey) return; lastLiveKey = key;
    const ep = epochArg();
    exLive.innerHTML = `<h3>Where you are now</h3>${EX.liveHTML(data, S.obs.lat, S.obs.lon, ep)}`;
    const holder = exLive.querySelector('#cons-list');
    if (S.exList) { holder.dataset.which = S.exList; holder.innerHTML = EX.listChips(data, S.obs.lat, S.exList, ep); exLive.querySelector(`[data-list="${S.exList}"]`)?.classList.add('open'); }
  }
  function renderCompare() {
    if (!S.from) return;
    const to = { lat: S.obs.lat, lon: S.obs.lon, name: placeLabel(S.obs.lat, S.obs.lon) };
    exCmp.hidden = false;
    exCmp.innerHTML = `<h3>After your journey</h3>${EX.compareHTML(data, S.from, to, { keepLocal: S.keepLocal })}`;
    if (!explainer.classList.contains('closed')) exCmp.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }
  explainer.addEventListener('click', (e) => {
    if (explainer.classList.contains('compact') && e.target.closest('.ex-head') && !e.target.closest('#ex-collapse')) { closeCard(); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'cons') selectCons(b.dataset.id);
    else if (a === 'star') selectStarByHip(+b.dataset.hip);
    else if (a === 'dso') selectDso(b.dataset.id);
    else if (a === 'list') { S.exList = S.exList === b.dataset.list ? null : b.dataset.list; refreshLive(true); }
    else if (a === 'journey') runJourney(+b.dataset.j);
  });
  const exBtn = $('#explain-btn');
  function setExplainer(open) {
    explainer.classList.toggle('closed', !open); exBtn.classList.toggle('on', open); exBtn.setAttribute('aria-expanded', open);
  }
  exBtn.addEventListener('click', () => { const open = explainer.classList.contains('closed'); if (open && IS_NARROW()) closeCard(); setExplainer(open); });
  $('#ex-collapse').addEventListener('click', () => setExplainer(false));
  if (IS_NARROW()) setExplainer(false);

  // ------------------------------------------------------------------ journeys
  const caption = $('#caption'), captionText = $('#caption-text');
  const sleep = (ms) => new Promise((r) => { const j = S.journey; const t0 = performance.now(); const id = setInterval(() => { if ((j && j.cancel) || performance.now() - t0 >= ms * (reduced ? 0.3 : 1)) { clearInterval(id); r(); } }, 50); });
  const say = (t) => { captionText.textContent = t; caption.hidden = false; };
  function setLocalSolar(hours, lon) { const d = new Date(S.time); const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); S.time = day + ((hours - lon / 15 + 48) % 24) * 3600e3; S.anchor = S.time; }
  function placeInstant(c) {
    setObserver(c.lat, c.lon); o2arr(obsU.fromArray(S.obs.U), S.obs.U);
    globe.arc.visible = false; mini.arc.visible = false; globe.setFrom(null); mini.setFrom(null);
    S.globe.lat = c.lat; S.globe.lon = c.lon; onObserverChanged(true); lastLiveKey = ''; refreshLive(true);
  }
  async function runJourney(id) {
    if (S.travel || S.trans) return;
    if (S.journey) S.journey.cancel = true;
    if (S.tm !== 'day') setTimeMode('day', { keepTime: true });
    const J = { cancel: false }; S.journey = J; document.body.classList.add('journey');
    const keep0 = S.keepLocal, play0 = { playing: S.playing, speed: S.speed };
    S.speed = 1; if (id === 2) S.playing = false; syncPlay();   // journey 3 freezes the clock; the others run at real speed
    const stillOn = () => !J.cancel;
    closeCard(); sky.setHighlight(null); S.from = null; exCmp.hidden = true;
    const toSky = async (az, alt, fov) => { if (S.mode === 'globe') { S.sky.az = az; S.sky.alt = alt; S.sky.fov = fov || 70; await enterSky(); } else { slewTo(az, alt, fov || 70, 1); await sleep(1000); } };
    try {
      if (id === 0) {
        const rome = byName('Rome'), syd = byName('Sydney');
        S.keepLocal = true; syncKeep();
        say('Rome, a clear night. Facing north: the pole star stands high above the horizon.');
        placeInstant(rome); setLocalSolar(22, rome.lon); updateCelestial(true);
        await toSky(0, 38, 75); if (!stillOn()) throw 0;
        await sleep(2500); if (!stillOn()) throw 0;
        say('Travelling south-east to Sydney, keeping local time. Watch Polaris sink and vanish below the horizon.');
        await travelTo(syd.lat, syd.lon, { duration: 6.5 }); if (!stillOn()) throw 0;
        say('Sydney: Polaris is gone. The celestial pole is now in the south, 34° up.');
        await sleep(2600); if (!stillOn()) throw 0;
        slewTo(180, 35, 80, 2); say('Turn to face south: the Southern Cross and the Magellanic Clouds, never visible from Rome.');
        await sleep(2200); selectCons('Cru'); await sleep(3500);
      } else if (id === 1) {
        const q = byName('Quito'), sp = QUICK[3];
        S.keepLocal = true; syncKeep();
        say('The North Pole: Polaris is straight overhead and every star circles level around you.');
        placeInstant({ lat: 89.9, lon: 0 }); setLocalSolar(0, 0); updateCelestial(true);
        await toSky(0, 62, 80); if (!stillOn()) throw 0;
        await sleep(2300); if (!stillOn()) throw 0;
        say('Heading for the equator. The pole star sinks with every degree of latitude you travel.');
        await travelTo(q.lat, q.lon, { duration: 7, pitchTo: 4 }); if (!stillOn()) throw 0;
        say('The equator: both celestial poles lie on the horizon. Every star rises and sets.');
        await sleep(2800); if (!stillOn()) throw 0;
        say('On to the South Pole. Now the south celestial pole climbs, with no bright star to mark it.');
        await travelTo(sp.lat, sp.lon, { duration: 7, pitchTo: 75 }); if (!stillOn()) throw 0;
        say('South Pole: the southern celestial pole is overhead. The sky has turned over completely.');
        await sleep(3500);
      } else {
        const rome = byName('Rome'), ny = byName('New York');
        S.keepLocal = false; syncKeep();
        say('Rome at 22:00 local solar time, facing south.');
        placeInstant(rome); setLocalSolar(22, rome.lon); updateCelestial(true);
        await toSky(180, 32, 80); if (!stillOn()) throw 0;
        await sleep(2000); if (!stillOn()) throw 0;
        say('Flying to New York at the same instant (clock frozen). The route bows north and settles back: nearly the same latitude, so nearly the same stars.');
        await travelTo(ny.lat, ny.lon, { duration: 5 }); if (!stillOn()) throw 0;
        const dh = Math.abs(ny.lon - rome.lon) / 15;
        say(`New York has the same stars as Rome, only ${dh.toFixed(1)} h behind on the clock: longitude shifts the time, not the cast of stars.`);
        await sleep(4500);
      }
    } catch (e) { if (e !== 0) console.error(e); }
    S.keepLocal = keep0; syncKeep(); S.speed = play0.speed; S.playing = play0.playing; syncPlay();
    caption.hidden = true; if (S.journey === J) { S.journey = null; document.body.classList.remove('journey'); }
  }
  $('#caption-stop').addEventListener('click', () => { if (S.journey) S.journey.cancel = true; caption.hidden = true; });

  // ------------------------------------------------------------------ time bar
  const scrub = $('#scrub'), utcIn = $('#utc-input'), solar = $('#solar'), playBtn = $('#play');
  const tbEl = $('#timebar'), speedsEl = $('#speeds'), ticksEl = $('#scrub-ticks'), tmodeEl = $('#tmode'), nowBtn = $('#now');
  const yearBig = $('#year-big'), yearSub = $('#year-sub'), dateOut = $('#date-out'), epochsEl = $('#epochs'), epochCap = $('#epoch-cap'), agesNote = $('#ages-note'), tbAges = $('#tb-ages');
  const ICON_PLAY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>';
  const ICON_PAUSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
  const SPEEDS = {
    day: [[1, '1×'], [60, '1 min/s'], [600, '10 min/s'], [3600, '1 h/s']],
    year: [[1, '1 d/s'], [5, '5 d/s'], [15, '15 d/s'], [40, '40 d/s']],
    ages: [[10, '10 yr/s'], [100, '100 yr/s'], [1000, '1000 yr/s']],
  };
  const SCRUB = {
    day: { min: -720, max: 720, step: 1, label: 'Time offset, plus or minus 12 hours', ticks: ['−12 h', '0', '+12 h'], now: 'Now', nowTitle: 'Jump to the current time' },
    year: { min: -183, max: 183, step: 0.25, label: 'Date offset, plus or minus 6 months, at the same local solar time', ticks: ['−6 mo', '0', '+6 mo'], now: 'Today', nowTitle: 'Back to today’s date' },
    ages: { min: -SLIDER_MAX, max: SLIDER_MAX, step: 1, label: 'Year, from about 11 000 BC to AD 15 000', ticks: [], now: 'Today', nowTitle: 'Back to the present epoch' },
  };
  function syncPlay() { playBtn.innerHTML = S.playing ? ICON_PAUSE : ICON_PLAY; document.querySelectorAll('#speeds button').forEach((b) => b.classList.toggle('on', +b.dataset.speed === S.speed && S.playing)); }
  function renderSpeeds() { speedsEl.innerHTML = SPEEDS[S.tm].map(([v, t]) => `<button data-speed="${v}">${t}</button>`).join(''); syncPlay(); }
  playBtn.addEventListener('click', () => { S.playing = !S.playing; syncPlay(); });
  speedsEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.speed = +b.dataset.speed; S.speedBy[S.tm] = S.speed; S.playing = true; syncPlay(); });

  // ----- Ages: epoch state, chips, tween
  const fmtGroup = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const clampYears = (y) => clamp(y, -AGES_MAX, AGES_MAX);
  function agesYearNow() { return S.ages.baseYear + S.ages.years; }
  function renderEpochs() {
    epochsEl.innerHTML = EPOCHS.map((e) => `<button class="chip" data-ep="${e.id}">${e.label}</button>`).join('');
    syncEpochs();
  }
  function syncEpochs() {
    epochsEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.ep === S.ages.chip));
    const ep = EPOCHS.find((e) => e.id === S.ages.chip);
    epochCap.hidden = !ep;
    if (ep) epochCap.innerHTML = `<span>${ep.caption}</span>${S.mode === 'sky' && (ep.pole || ep.cross) ? `<button class="btn" data-act="look" type="button">${ep.cross ? 'Look at the Cross' : 'Look at the pole'}</button>` : ''}`;
  }
  function stopTween() { S.ages.tween = null; }
  function setYears(y, fromUser) {
    S.ages.years = clampYears(y);
    if (fromUser) { S.ages.chip = null; stopTween(); syncEpochs(); }
    updateCelestial(true);
  }
  function tweenYears(to, then) {
    to = clampYears(to); const from = S.ages.years, d = Math.abs(to - from);
    if (d < 0.01) { if (then) then(); return; }
    S.ages.tween = { t0: performance.now(), dur: (reduced ? 0.25 : 1.1 + 0.4 * Math.log10(1 + d)) * 1000, from, to, then };
  }
  function updateAgesTween(now) {
    const T = S.ages.tween; if (!T) return false;
    const t = clamp((now - T.t0) / T.dur, 0, 1), e = easeInOut(t);
    S.ages.years = lerp(T.from, T.to, e);
    if (t >= 1) { S.ages.years = T.to; S.ages.tween = null; if (T.then) T.then(); }
    return true;
  }
  function polarTarget() { const north = S.obs.lat >= 0; return { az: north ? 0 : 180, alt: Math.max(Math.abs(S.obs.lat), 12) }; }
  function lookAtPole() {
    const t = polarTarget();
    if (S.mode === 'sky' && !S.trans) slewTo(t.az, t.alt, Math.min(Math.max(S.sky.fov, 55), 80), 1.2);
    else if (S.mode === 'globe' && !S.trans && !S.travel) enterSky({ az: t.az, alt: t.alt, fov: 70 });
  }
  function lookAtCross() {
    const c = data.consMap.get('Cru'); if (!c) return;
    const aa = altAzOfEq(_t3.set(c.center[0], c.center[1], c.center[2]));
    if (S.mode === 'sky' && !S.trans) slewTo(aa.az, Math.max(aa.alt, 10), 70, 1.2);
    else if (S.mode === 'globe' && !S.trans && !S.travel) enterSky({ az: aa.az, alt: Math.max(aa.alt, 10), fov: 70 });
  }
  function goEpoch(id) {
    const ep = EPOCHS.find((e) => e.id === id); if (!ep) return;
    if (S.tm !== 'ages') setTimeMode('ages');
    S.ages.chip = ep.id; S.playing = false; syncPlay(); syncEpochs();
    const to = ep.year === null ? 0 : ep.year - S.ages.baseYear;
    const after = () => { S.ages.chip = ep.id; syncEpochs(); if (ep.cross) lookAtCross(); else if (ep.pole) lookAtPole(); };
    if (S.mode === 'globe' && (ep.pole || ep.cross) && !S.trans && !S.travel) enterSky({ az: ep.cross ? 180 : polarTarget().az, alt: ep.cross ? 25 : polarTarget().alt, fov: 70 });
    tweenYears(to, after);
  }
  epochsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-ep]'); if (b) goEpoch(b.dataset.ep); });
  epochCap.addEventListener('click', (e) => { const b = e.target.closest('[data-act="look"]'); if (!b) return; if (S.ages.chip === 'cross') lookAtCross(); else lookAtPole(); });

  // ----- switching time scale
  function configureScrub() {
    const c = SCRUB[S.tm]; scrub.min = c.min; scrub.max = c.max; scrub.step = c.step; scrub.setAttribute('aria-label', c.label);
    nowBtn.textContent = c.now; nowBtn.title = c.nowTitle; nowBtn.setAttribute('aria-label', c.nowTitle);
    if (S.tm === 'ages') {
      const b = S.ages.baseYear, at = (E) => (0.5 + 0.5 * yearsToSlider(E - b) / SLIDER_MAX) * 100;
      const t = [[b - AGES_MAX, formatYear(b - AGES_MAX).text, 'l'], [-2999, '', 'dot'], [-999, '', 'dot'], [b, 'today', ''], [1000, '', 'dot'], [5000, '', 'dot'], [b + AGES_MAX, formatYear(b + AGES_MAX).text, 'r']];
      ticksEl.innerHTML = t.map(([E, txt, k]) => `<span class="${k}" style="left:${at(E).toFixed(1)}%">${txt}</span>`).join('');   // dots mark 3000 BC, 1000 BC, AD 1000, AD 5000 on the log scale
    }
    else ticksEl.innerHTML = c.ticks.map((t) => `<span>${t}</span>`).join('');
    ticksEl.classList.toggle('five', S.tm === 'ages');
  }
  function setTimeMode(m, opts = {}) {
    if (m === S.tm) return;
    const prev = S.tm;
    stopTween(); S.ages.chip = null;
    if (prev === 'year') { S.time += Math.round(S.yd) * 864e5; S.anchor = S.time; }   // keep the date reached, at the same local solar time
    S.yd = 0; S.ages.years = 0;
    S.speedBy[prev] = S.speed;
    S.tm = m;
    if (m === 'day') {
      if (!opts.keepTime) { S.time = Date.now(); S.anchor = S.time; S.playing = true; S.speed = 1; S.speedBy.day = 1; } else S.speed = S.speedBy.day;   // back to the real present sky
    } else {
      S.anchor = S.time; S.playing = false; S.speed = S.speedBy[m];
      if (m === 'ages') S.ages.baseYear = decimalYear(S.time);
    }
    tbEl.dataset.tm = m; document.body.classList.toggle('tm-ages', m === 'ages'); document.body.classList.toggle('tm-year', m === 'year');
    tmodeEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tm === m));
    tbAges.hidden = m !== 'ages'; exAges.hidden = m !== 'ages';
    configureScrub(); renderSpeeds(); if (m === 'ages') renderEpochs(); else { epochCap.hidden = true; agesNote.hidden = true; }
    lastUtcStr = ''; lastLiveKey = '';
    updateCelestial(true); refreshLive(true); refreshCardLive(); updateTimeUI(true);
  }
  tmodeEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTimeMode(b.dataset.tm); });

  scrub.addEventListener('input', () => {
    if (S.tm === 'day') { S.time = S.anchor + +scrub.value * 60000; updateCelestial(true); }
    else if (S.tm === 'year') { S.yd = +scrub.value; updateCelestial(true); }
    else { setYears(sliderToYears(+scrub.value), true); }
  });
  nowBtn.addEventListener('click', () => {
    if (S.tm === 'day') { S.time = Date.now(); S.anchor = S.time; updateCelestial(true); }
    else if (S.tm === 'year') { S.yd = 0; updateCelestial(true); }
    else goEpoch('today');
  });
  utcIn.addEventListener('change', () => { const t = Date.parse(utcIn.value + ':00Z'); if (Number.isFinite(t)) { S.time = t; S.anchor = t; updateCelestial(true); } });
  const keepEl = $('#keep-local');
  keepEl.addEventListener('change', () => { S.keepLocal = keepEl.checked; });
  function syncKeep() { keepEl.checked = S.keepLocal; }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let lastUtcStr = '', lastAgesTxt = '';
  function updateTimeUI(force) {
    if (S.tm === 'day') {
      const d = new Date(S.time), iso = d.toISOString().slice(0, 16);
      if (iso !== lastUtcStr) {
        lastUtcStr = iso;
        if (document.activeElement !== utcIn) utcIn.value = iso;
        const h = A.localSolarHours(S.time, S.obs.lon), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
        solar.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      }
      let off = (S.time - S.anchor) / 60000;
      if (Math.abs(off) > 720) { S.anchor = S.time; off = 0; }
      if (document.activeElement !== scrub) scrub.value = off.toFixed(0);
    } else if (S.tm === 'year') {
      const d = new Date(S.time + S.yd * 864e5), txt = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
      if (txt !== dateOut.textContent) dateOut.textContent = txt;
      if (document.activeElement !== scrub) scrub.value = S.yd.toFixed(2);
    } else {
      const E = agesYearNow(), f = formatYear(E), y = S.ages.years;
      const sub = Math.abs(y) < 0.5 ? 'today' : y < 0 ? `${fmtGroup(-y)} years ago` : `in ${fmtGroup(y)} years`;
      const txt = f.text + '|' + sub;
      if (txt !== lastAgesTxt || force) { lastAgesTxt = txt; yearBig.textContent = f.text; yearSub.textContent = sub; }
      if (document.activeElement !== scrub) scrub.value = Math.round(yearsToSlider(y));
      const hidden = S.ages.fade < 0.999;
      if (agesNote.hidden === !hidden) agesNote.hidden = !hidden;
      if (S.ages.chip) { const ep = EPOCHS.find((e) => e.id === S.ages.chip); const target = ep && (ep.year === null ? 0 : ep.year - S.ages.baseYear); if (ep && !S.ages.tween && Math.abs(y - target) > 1) { S.ages.chip = null; syncEpochs(); } }
    }
  }
  let solarKey = '';
  function updateSolar() { const k = Math.floor(S.time / 60000) + ':' + Math.round(S.obs.lon * 10); if (k === solarKey) return; solarKey = k; const h = A.localSolarHours(S.time, S.obs.lon), hh = Math.floor(h), mm = Math.floor((h - hh) * 60); solar.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }

  // ------------------------------------------------------------------ layers menu
  const LAYERS = [['lines', 'Constellation lines'], ['constNames', 'Constellation names'], ['starNames', 'Star names'], ['planets', 'Planets'], ['mw', 'Milky Way'], ['grid', 'Alt-az grid'], ['eq', 'Equator, ecliptic, poles'], ['daylight', 'Daylight sky']];
  const menu = $('#layers-menu'), lbtn = $('#layers-btn');
  menu.innerHTML = LAYERS.map(([k, t]) => `<label class="row"><span>${t}</span><input type="checkbox" data-k="${k}" ${S.layers[k] ? 'checked' : ''}><span class="tg"></span></label>`).join('');
  menu.addEventListener('change', (e) => { const k = e.target.dataset.k; if (k) { S.layers[k] = e.target.checked; savePrefs(); } });
  const skyMenu = $('#sky-menu'), skyBtn = $('#sky-btn');
  const setMenu = (m, b, open) => { m.hidden = !open; b.setAttribute('aria-expanded', open); };
  const closeMenus = () => { setMenu(menu, lbtn, false); setMenu(skyMenu, skyBtn, false); };
  lbtn.addEventListener('click', (e) => { e.stopPropagation(); const open = menu.hidden; closeMenus(); setMenu(menu, lbtn, open); });
  skyBtn.addEventListener('click', (e) => { e.stopPropagation(); const open = skyMenu.hidden; closeMenus(); setMenu(skyMenu, skyBtn, open); if (open) syncSkyUI(); });
  document.addEventListener('click', (e) => { if ((!menu.hidden || !skyMenu.hidden) && !e.target.closest('.menu-wrap')) closeMenus(); });

  // ----- sky quality + star brightness
  const sq = $('#sq'), sx = $('#sx'), sqName = $('#sq-name'), sqCount = $('#sq-count'), sxVal = $('#sx-val');
  const _up = new THREE.Vector3(), _upA = [0, 1, 0];
  let lastCountKey = '';
  function updateStarCount(force) {
    const qp = qualityParams(S.q);
    _up.copy(obsU).applyMatrix4(rotInv); _upA[0] = _up.x; _upA[1] = _up.y; _upA[2] = _up.z;
    const lim = qp.enhanced ? 99 : qp.limit;
    const key = qp.q.toFixed(2) + '|' + _upA.map((v) => v.toFixed(2)).join(',');
    if (!force && key === lastCountKey) return; lastCountKey = key;
    const n = countVisible(sky.cur, data.stars.mag, data.stars.n, _upA, lim);
    sqCount.textContent = qp.enhanced ? `all ${aboutCount(n)} catalogue stars above your horizon, boosted` : `about ${aboutCount(n)} stars visible above your horizon`;
  }
  function syncSkyUI() {
    const qp = qualityParams(S.q);
    sq.value = S.q; sqName.textContent = qp.name; sq.setAttribute('aria-valuetext', `${qp.name}, limiting magnitude ${qp.enhanced ? 'all stars' : qp.limit.toFixed(1)}`);
    sx.value = sliderFromExposure(S.expo).toFixed(3); sxVal.textContent = `${+S.expo.toFixed(2)}×`;
    updateStarCount(true);
  }
  sq.addEventListener('input', () => { let v = +sq.value; const r = Math.round(v); if (Math.abs(v - r) < 0.07) v = r; S.q = v; savePrefs(); syncSkyUI(); });
  sx.addEventListener('input', () => { let e = exposureFromSlider(+sx.value); if (Math.abs(e - 1) < 0.04) e = 1; S.expo = Math.round(e * 100) / 100; savePrefs(); syncSkyUI(); });
  $('#sky-reset').addEventListener('click', () => { S.q = QUALITY_DEFAULT; S.expo = EXPOSURE_DEFAULT; savePrefs(); syncSkyUI(); });
  syncSkyUI();

  // ------------------------------------------------------------------ search, chips, geolocation
  const chipsEl = $('#chips');
  chipsEl.innerHTML = QUICK.map((q, i) => `<button class="chip" data-i="${i}">${q.label}</button>`).join('');
  chipsEl.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; const q = QUICK[+b.dataset.i]; goTo(q.lat, q.lon); });
  const hooks = { userTravel: null };   // the lessons module listens here: a manual trip ends a running lesson demo
  function goTo(lat, lon) { if (S.journey) S.journey.cancel = true; if (hooks.userTravel) hooks.userTravel(); travelTo(lat, lon); }
  initSearch({ input: $('#search'), list: $('#suggest'), spinner: $('#search-spin'), live: $('#search-live'), onPick: (c) => goTo(c.lat, c.lon) });
  $('#geo').addEventListener('click', () => { if (!navigator.geolocation) return; try { navigator.geolocation.getCurrentPosition((p) => goTo(p.coords.latitude, p.coords.longitude), () => {}, { timeout: 8000, maximumAge: 600000 }); } catch (e) { /* fail silently */ } });

  // ------------------------------------------------------------------ mode switching UI
  const seg = $('#mode-seg');
  function syncSeg() { seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode)); }
  seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.dataset.mode === 'sky' ? enterSky() : leaveSky(); });
  $('#look-up').addEventListener('click', () => enterSky());
  $('#mini-expand').addEventListener('click', () => leaveSky());
  const hint = $('#hint');
  function hideHint() { if (!hint.hidden) { hint.hidden = true; try { localStorage.setItem('skyatlas.seen', '1'); } catch (e) { /* ignore */ } } }
  $('#hint-ok').addEventListener('click', hideHint);
  try { if (!localStorage.getItem('skyatlas.seen')) hint.hidden = false; } catch (e) { hint.hidden = false; }
  window.addEventListener('keydown', (e) => {
    const t = e.target, typing = t.matches && t.matches('input:not([type=checkbox]):not([type=range]), textarea, select');
    if (typing) return;
    if (e.key === ' ' && t.matches && (t.matches('input, select') || (t.matches('button') && t.matches(':focus-visible')))) return;   // keyboard-focused controls keep Space
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'g' || e.key === 'G') leaveSky(); else if (e.key === 's' || e.key === 'S') enterSky();
    else if (e.key === ' ') { e.preventDefault(); S.playing = !S.playing; syncPlay(); }
    else if (e.key === 'Escape') { closeCard(); hideHint(); if (!menu.hidden || !skyMenu.hidden) { const was = !skyMenu.hidden ? skyBtn : lbtn; closeMenus(); was.focus(); } }
  });

  // ------------------------------------------------------------------ input
  let W = 1, H = 1;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); curFov = -1;
  }
  window.addEventListener('resize', resize); resize();

  const ptrs = new Map(); let gest = null, pinch0 = 0, fov0 = 0, dist0 = 0;
  const busy = () => !!(S.trans || S.travel);
  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    S.globe.auto = false; S.intro = null; hideHint();
    if (ptrs.size === 1) { gest = { moved: 0, t0: performance.now(), x: e.clientX, y: e.clientY, last: performance.now() }; S.globe.vLon = S.globe.vLat = 0; S.sky.vAz = S.sky.vAlt = 0; S.slew = null; }
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); fov0 = S.sky.fov; dist0 = S.globe.dist; gest && (gest.moved = 99); }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) { canvas.style.cursor = (S.mode === 'sky' && labels.hitTest(e.clientX, e.clientY)) ? 'pointer' : ''; return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (busy()) return;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) { const k = pinch0 / d; if (S.mode === 'sky') S.sky.fov = clamp(fov0 * k, 20, 100); else S.globe.dist = clamp(dist0 * k, 1.35, 9); }
      return;
    }
    if (!gest) return;
    gest.moved += Math.abs(dx) + Math.abs(dy);
    const now = performance.now(), dt = Math.max((now - gest.last) / 1000, 0.008); gest.last = now;
    if (S.mode === 'globe') {
      const k = RAD * 2 * Math.tan(cam.fov * DEG / 2) * (S.globe.dist - 1) / H;
      S.globe.lon -= dx * k; S.globe.lat = clamp(S.globe.lat + dy * k, -85, 85);
      S.globe.vLon = lerp(S.globe.vLon, (-dx * k) / dt, 0.35); S.globe.vLat = lerp(S.globe.vLat, (dy * k) / dt, 0.35);
    } else {
      const k = cam.fov / H, s = S.sky;
      const dAz = -dx * k / Math.max(0.35, Math.cos(clamp(s.alt, -80, 80) * DEG)), dAlt = dy * k;
      s.az = A.norm360(s.az + dAz); s.alt = clamp(s.alt + dAlt, -10, 89);
      s.vAz = lerp(s.vAz, dAz / dt, 0.35); s.vAlt = lerp(s.vAlt, dAlt / dt, 0.35);
    }
  });
  const endPtr = (e) => {
    const had = ptrs.delete(e.pointerId);
    if (!had) return;
    if (gest && ptrs.size === 0) {
      if (performance.now() - gest.last > 90) { S.globe.vLon = S.globe.vLat = S.sky.vAz = S.sky.vAlt = 0; }
      if (e.type === 'pointerup' && gest.moved < 6 && performance.now() - gest.t0 < 700 && !busy()) onClick(e.clientX, e.clientY);
      gest = null;
    }
    if (ptrs.size < 2) pinch0 = 0;
  };
  canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); if (busy()) return; const f = Math.exp(clamp(e.deltaY, -120, 120) * 0.0014);
    S.globe.auto = false; S.intro = null; hideHint();
    if (S.mode === 'sky') S.sky.fov = clamp(S.sky.fov * f, 20, 100); else S.globe.dist = clamp(S.globe.dist * f, 1.35, 9);
  }, { passive: false });

  const _ray = new THREE.Vector3();
  function rayFromScreen(x, y) {
    _ray.set((x / W) * 2 - 1, -(y / H) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize(); return _ray;
  }
  function onClick(x, y) {
    if (S.mode === 'globe') {
      const d = rayFromScreen(x, y), o = cam.position, b = o.dot(d), c = o.lengthSq() - 1, disc = b * b - c;
      if (disc < 0) return;
      const t = -b - Math.sqrt(disc); _t1.copy(o).addScaledVector(d, t);
      goTo(Math.asin(clamp(_t1.y, -1, 1)) * RAD, Math.atan2(-_t1.z, _t1.x) * RAD);
      return;
    }
    const lh = labels.hitTest(x, y);
    if (lh) { lh.click(); return; }
    const d = rayFromScreen(x, y);
    if (d.dot(obsU) < -0.01) { closeCard(); return; }
    const pxAng = 2 * Math.tan(cam.fov * DEG / 2) / H;
    const tol = Math.max(pxAng * (IS_NARROW() ? 28 : 20), 0.4 * DEG);
    _t2.copy(d).applyMatrix4(rotInv);
    const hit = sky.pick([_t2.x, _t2.y, _t2.z], tol, { planets: S.layers.planets, hideOthers: S.ages.fade < 0.5, limit: qualityParams(S.q).limit });
    if (!hit) { closeCard(); return; }
    if (hit.type === 'star') select({ type: 'star', index: hit.index }); else if (hit.type === 'body') select({ type: 'body', body: hit.body }); else select({ type: 'dso', dso: hit.dso });
  }

  // ------------------------------------------------------------------ frame loop
  const _fwd = new THREE.Vector3();
  const tmpM = new THREE.Matrix4();
  // adaptive resolution: keep the frame rate near 60 fps on weaker GPUs
  const gov = { ratio: PX, acc: 0, n: 0 };
  function applyRatio(r) {
    gov.ratio = r; renderer.setPixelRatio(r); renderer.setSize(W, H, false);
    sky.uniforms.uPx.value = r; globe.pinMat.uniforms.uPx.value = r;
  }
  function govern(dtRaw) {
    if (dtRaw > 0.1) return;
    gov.acc += dtRaw; gov.n++;
    if (gov.n < 50) return;
    const avg = gov.acc / gov.n; gov.acc = 0; gov.n = 0;
    if (avg > 0.021 && gov.ratio > 1) applyRatio(Math.max(1, gov.ratio - 0.25));
    else if (avg < 0.0135 && gov.ratio < PX) applyRatio(Math.min(PX, gov.ratio + 0.25));
  }
  let last = performance.now(), frameN = 0, lastCardT = 0, lastMiniT = 0, tAccum = 0;
  const lblCtx = { camera: cam, rot: rotMat, local: localMat, U: obsU, on: {}, landed: false, w: 1, h: 1, fov: 70, forward: _fwd, magLimit: 3, selectedCons: null };

  function frame(now) {
    requestAnimationFrame(frame);
    const dtRaw = (now - last) / 1000, dt = Math.min(0.05, dtRaw); last = now; frameN++; govern(dtRaw);
    tAccum += dt;
    // time
    let timeChanged = false;
    if (S.playing) {
      if (S.tm === 'day') { S.time += dt * 1000 * S.speed; timeChanged = true; }
      else if (S.tm === 'year') { S.yd += dt * S.speed; if (S.yd > 183) S.yd -= 366; timeChanged = true; }
      else if (!S.ages.tween) {
        S.ages.years += dt * S.speed; timeChanged = true; if (S.ages.chip) { S.ages.chip = null; syncEpochs(); }
        if (S.ages.years >= AGES_MAX || S.ages.years <= -AGES_MAX) { S.ages.years = clampYears(S.ages.years); S.playing = false; syncPlay(); }
      }
    }
    if (updateAgesTween(now)) timeChanged = true;
    // motion
    updateIntro(now, dt); updateTravel(now); updateTransition(now); updateSlew(now);
    if (S.travel && S.keepLocal) timeChanged = true;
    if (timeChanged) updateCelestial(false);
    inertia(dt);
    const h = updateCamera();
    camera_frame(h, now, dt);
    renderer.render(scene, cam);
    // mini globe
    if (!$('#mini').hidden && now - lastMiniT > 33) { lastMiniT = now; mini.update(0.033); mini.render(now / 1000); }
    if (frameN % 6 === 0) { updateTimeUI(); updateSolar(); if (!skyMenu.hidden) updateStarCount(); }
    if (frameN % 20 === 1) updateLabelClip();
    if (S.tm === 'ages' && frameN % 24 === 0) refreshLive();
    if (S.sel && now - lastCardT > 500) { lastCardT = now; refreshCardLive(); }
    if (hooks.frame) hooks.frame(now);   // the Learn area draws its teaching overlay here, after the sky, in the same frame
  }

  // phones: keep canvas labels out of the status-line strip (place + time) at the top
  function updateLabelClip() {
    const st = document.documentElement.classList.contains('phone') ? $('#status') : null;
    if (!st) { lblCtx.clip = null; return; }
    const r = st.getBoundingClientRect();
    lblCtx.clip = r.height > 0 ? { l: r.left - 6, r: r.right + 6, b: r.bottom + 2 } : null;
  }

  function updateIntro(now, dt) {
    const I = S.intro; if (!I) { if (S.globe.auto && S.mode === 'globe' && !S.trans && !S.travel) S.globe.lon += 1.2 * dt; return; }
    const t = clamp((now - I.t0) / I.dur, 0, 1), e = 1 - Math.pow(1 - t, 3);
    S.globe.lat = lerp(I.from.lat, I.to.lat, e); S.globe.lon = lerp(I.from.lon, I.to.lon, e); S.globe.dist = lerp(I.from.dist, I.to.dist, e);
    if (t >= 1) { S.intro = null; S.globe.auto = true; }
  }
  function inertia(dt) {
    if (ptrs.size || busy()) return;
    const g = S.globe, s = S.sky, f = Math.exp(-dt * 3.2);
    if (S.mode === 'globe') {
      if (Math.abs(g.vLon) + Math.abs(g.vLat) > 0.05) { g.lon += g.vLon * dt; g.lat = clamp(g.lat + g.vLat * dt, -85, 85); g.vLon *= f; g.vLat *= f; } else g.vLon = g.vLat = 0;
    } else if (!S.slew) {
      if (Math.abs(s.vAz) + Math.abs(s.vAlt) > 0.05) { s.az = A.norm360(s.az + s.vAz * dt); s.alt = clamp(s.alt + s.vAlt * dt, -10, 89); s.vAz *= f; s.vAlt *= f; } else s.vAz = s.vAlt = 0;
    }
    g.lon = ((g.lon + 540) % 360) - 180;
  }

  const _pp = [0, 0, 0], starTitleCache = new Map();
  const starTitle = (i) => { let t = starTitleCache.get(i); if (!t) { t = data.starInfo(i).title; starTitleCache.set(i, t); } return t; };
  /** "pole star: Thuban, 0.4° away" for the pole of the epoch on screen (sign +1 north, -1 south), or "no bright pole star". */
  function poleStarHTML(sign) {
    _pp[0] = pole[0] * sign; _pp[1] = pole[1] * sign; _pp[2] = pole[2] * sign;
    const r = nearestPoleStar(sky.cur, data.stars.mag, data.stars.n, _pp, 4.2, 7);
    if (!r) return '<span class="pl-star none">no bright pole star</span>';
    return `<span class="pl-star">pole star: ${starTitle(r.index)}, ${r.sepDeg < 9.95 ? r.sepDeg.toFixed(1) : r.sepDeg.toFixed(0)}° away</span>`;
  }
  const _sunL = new THREE.Vector3();
  const nightZen = new THREE.Vector3(0.012, 0.02, 0.05), dayZen = new THREE.Vector3(0.16, 0.38, 0.8), nightHor = new THREE.Vector3(0.05, 0.08, 0.16), dayHor = new THREE.Vector3(0.62, 0.78, 0.96);
  function camera_frame(h, now, dt) {
    const land = 1 - smooth(0.02, 0.30, h);
    cam.getWorldDirection(_fwd);
    // observer-local frame (x=E, y=U, z=-N)
    _t1.copy(obsN).negate(); localMat.makeBasis(obsE, obsU, _t1);
    for (const o of [dome.mesh, rig.group]) { o.position.copy(cam.position); o.quaternion.setFromRotationMatrix(localMat); }
    // celestial group follows the camera
    sky.group.matrix.copy(rotMat).setPosition(cam.position); sky.group.matrixWorldNeedsUpdate = true;
    sky.uniforms.uTime.value = now / 1000;
    const lay = S.layers;
    // sky quality: limiting magnitude, gain, Milky Way, sky glow (only when landed; the globe-mode backdrop shows every star)
    const qp = qualityParams(S.q), su = sky.uniforms;
    su.uLimit.value = qp.limit; su.uGain.value = lerp(1.15, qp.gain, land); su.uExp.value = S.expo; su.uPol.value = qp.pol; su.uLand.value = land;
    _up.copy(obsU).applyMatrix4(rotInv); su.uUp.value.copy(_up);
    dome.u.uPol.value = qp.pol;
    const mwV = lerp(1, qp.mw, land);
    sky.mw.material.uniforms.uThr.value = (1 - Math.min(1, mwV)) * 0.3;
    sky.dsoMat.opacity = 0.55 * lerp(1, smooth(3.4, 5.4, qp.limit), land);
    // sun-based sky colour and star fade
    const sunAlt = Math.asin(clamp(sunWorld.dot(obsU), -1, 1)) / DEG;
    let starFade = 1, skyA = 0, tw = 0;
    if (lay.daylight) {
      starFade = 1 - smooth(-14, -4, sunAlt); skyA = smooth(-9, 3, sunAlt);
      tw = smooth(-14, -3, sunAlt) * (1 - smooth(0, 9, sunAlt));
      const k = smooth(-10, 8, sunAlt);
      dome.u.uZen.value.lerpVectors(nightZen, dayZen, k); dome.u.uHor.value.lerpVectors(nightHor, dayHor, k);
    }
    sky.setStarFade(starFade);
    sky.bodyU.uFade.value = Math.pow(starFade, 0.6); sky.bodyU.uSunGlare.value = lay.daylight ? 1 : 0.55;
    _sunL.set(sunWorld.dot(obsE), sunWorld.dot(obsU), -sunWorld.dot(obsN));
    dome.u.uSunL.value.copy(_sunL); dome.u.uSunTw.value = tw; dome.u.uSkyA.value = skyA; dome.u.uGround.value = land;
    dome.u.uGlow.value = lay.daylight ? 0.5 : 0.3;
    dome.u.uGlowCol.value.set(0.28 + 0.6 * tw, 0.42 + 0.1 * tw, 0.72 - 0.3 * tw);
    dome.mesh.visible = land > 0.003; rig.group.visible = land > 0.3;
    // fov-dependent star size
    const fovS = S.mode === 'sky' || S.trans ? clamp(1 + (60 - cam.fov) / 120, 0.82, 1.4) : 1;
    sky.uniforms.uScale.value = fovS;
    // layers
    sky.lines.visible = lay.lines; sky.lineMat.opacity = lay.daylight ? 0.42 * (1 - skyA * 0.7) : 0.42; sky.mw.visible = lay.mw && mwV > 0.01; sky.mw.material.uniforms.uOpacity.value = 0.9 * mwV * starFade;
    sky.mwUpdate({ on: lay.mw, v: mwV, fade: starFade, land, expo: S.expo, pol: qp.pol, up: su.uUp.value });
    rig.grid.visible = lay.grid; sky.eqGroup.visible = lay.eq && land > 0.3; sky.bodyPts.visible = true; sky.dsos.visible = lay.starNames;
    // globe objects
    const showGlobe = h > 0.003;
    globe.root.visible = showGlobe;
    globe.pin.visible = globe.poleLine.visible = h > 0.12; globe.pinPt.visible = h > 0.15;
    globe.axisGroup.visible = h > 0.6;
    if (showGlobe) {
      globe.setCamera(cam.position);
      globe.pinMat.uniforms.uTime.value = now / 1000;
      _t1.copy(obsU).multiplyScalar(1 + 0.5 * 1.32); zenithLbl.v.copy(_t1);
      _t1.copy(obsU).multiplyScalar(1.002); _t2.set(0, S.obs.lat >= 0 ? 1.12 : -1.12, 0); poleLbl.v.copy(_t1).add(_t2);
      poleLbl.el.textContent = S.obs.lat >= 0 ? 'to the north celestial pole' : 'to the south celestial pole';
    }
    // labels
    const landed = land > 0.5;
    const magFov = cam.fov > 85 ? 1.7 : cam.fov > 60 ? 2.3 : cam.fov > 40 ? 2.9 : 3.5;
    const mag = Math.min(magFov, qp.limit - 0.25);        // never label a star the sky quality hides
    const bodiesOn = S.ages.fade > 0.5;
    const on = lblCtx.on;
    on.const = lay.constNames && landed; on.star = lay.starNames && landed; on.dso = lay.starNames && landed && qp.limit > 4.4; on.planet = lay.planets && landed && bodiesOn; on.sunmoon = landed; on.moon = landed && bodiesOn;
    on.cardinal = land > 0.3; on.polemark = landed; on.zenith = false; on.world = h > 0.6; on.worldPin = h > 0.5 && h < 9;
    lblCtx.landed = landed; lblCtx.w = W; lblCtx.h = H; lblCtx.fov = cam.fov; lblCtx.magLimit = mag; lblCtx.selectedCons = S.sel && S.sel.type === 'cons' ? S.sel.cons.id : null;
    if (landed && frameN % 6 === 0) {   // live altitude on the pole marker + the nearest bright star to that pole
      const la = S.obs.lat, nA = la.toFixed(1), sA = (-la).toFixed(1);
      const ps = poleStarHTML(1), pt = poleStarHTML(-1);
      const kN = nA + ps, kS = sA + pt;
      if (poleLblN.alt !== kN) { poleLblN.alt = kN; poleLblN.el.innerHTML = `<span>North celestial pole · ${la >= 0 ? '' : '−'}${Math.abs(la).toFixed(1)}°</span>${ps}`; }
      if (poleLblS.alt !== kS) { poleLblS.alt = kS; poleLblS.el.innerHTML = `<span>South celestial pole · ${la <= 0 ? '' : '−'}${Math.abs(la).toFixed(1)}°</span>${pt}`; }
      poleLblN.w = poleLblS.w = 190;
    }
    sky.updateMoonScreen(cam, rotMat, W / H, pole);
    labels.update(lblCtx);
    updateReticle(land);
  }

  // ------------------------------------------------------------------ start
  updateCelestial(true);
  globe.setObserver(S.obs); mini.setObserver(S.obs.U, S.obs.lat, S.obs.lon);
  updateHeader(); refreshLive(true); syncSeg(); renderSpeeds(); syncKeep(); configureScrub(); updateTimeUI(); updateSolar();
  const rome = byName('Rome');
  S.globe.lat = 22; S.globe.lon = rome.lon - 100; S.globe.dist = 7.5;
  S.intro = { t0: performance.now() + 300, dur: reduced ? 200 : 4200, from: { lat: 22, lon: rome.lon - 100, dist: 7.5 }, to: { lat: 33, lon: rome.lon, dist: 3.4 } };
  S.globe.auto = false;
  setTimeout(() => { const l = $('#loading'); if (l) { l.classList.add('done'); setTimeout(() => l.remove(), 800); } }, 120);
  requestAnimationFrame(frame);

  // test / debug hooks
  window.__atlas = {
    S, sky, globe, mini, data, cam, A, enterSky, leaveSky, travelTo, select, selectCons, slewTo, updateCelestial, placeInstant, rotMat, runJourney,
    altAzOfEq, centreOnSelection, onClick, closeCard, scene, lblCtx, PX, setObserver, labels, renderer, get sunWorld() { return sunWorld; },
    setTimeMode, goEpoch, setYears, lookAtPole, get precP() { return precP; }, get pole() { return pole; }, syncSkyUI, savePrefs, poleStarHTML,
    hooks, syncPlay, syncKeep, setLocalSolar, syncEpochs, updateTimeUI, refreshLive, setExplainer,
  };
  try { initLessons(window.__atlas); } catch (e) { console.error('lessons', e); }
}
