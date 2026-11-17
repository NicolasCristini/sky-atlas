// "Point at the sky" mode: the sky view follows the phone's orientation (motion sensors), optionally over the live camera.
// Pure maths lives in orient.js / wmm.js; main.js only exposes three hooks (arPose, arDrag, arGrab) and S.arFx. Everything else is here:
// permissions, sensors, the entry trip, camera passthrough, night mode, calibration UI.
import * as THREE from '../../vendor/three.module.min.js';
import {
  DEG, qAxis, qMul, qSlerp, screenQuat, cameraVectors, azAltRoll, compassYawOffset, blendAngle, makeSmoother, coverVerticalFov, quatFromAzAltRoll,
} from './orient.js';
import { loadWMM, declination, decimalYear } from './wmm.js';

const $ = (s, r = document) => r.querySelector(s);
const root = document.documentElement, body = document.body;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEFAULT_LENS = 67;

// ---------------------------------------------------------------- preferences (localStorage, never required)
const KEY = 'skyatlas.ar';
const prefs = { nudge: 0, lens: DEFAULT_LENS, camera: false, night: false, camBright: 0.85, intro: false };
try {
  const o = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (o && typeof o === 'object') {
    if (Number.isFinite(o.nudge)) prefs.nudge = clamp(o.nudge, -30, 30);
    if (Number.isFinite(o.lens)) prefs.lens = clamp(o.lens, 40, 100);
    if (Number.isFinite(o.camBright)) prefs.camBright = clamp(o.camBright, 0.3, 1);
    prefs.camera = o.camera === true; prefs.night = o.night === true; prefs.intro = o.intro === true;
  }
} catch (e) { /* no storage */ }
const savePrefs = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* no storage */ } };

// ---------------------------------------------------------------- state (window.__ar.state)
const st = {
  active: false, phase: 'off', source: null, accuracy: 'unknown', accDeg: null, iosOffset: null, declination: 0, nudge: prefs.nudge,
  fov: 0, camera: false, night: prefs.night, az: 0, alt: 0, roll: 0, pos: { lat: null, lon: null, acc: null, fallback: false },
};
let atlas = null, tok = null, snapped = false, declOk = true, wmmP = null;
let wakeLock = null, absSeen = false, calNeeded = 0;
const raw = { alpha: 0, beta: 90, gamma: 0, has: false };
let lastIosT = 0, listening = false, waiter = null;
const smoother = makeSmoother();
const qT = [0, 0, 0, 1], qOut = [0, 0, 0, 1], qDragA = [0, 0, 0, 1];
let lastFrameT = 0, blend = null, grabbed = false, dragYaw = 0, dragPitch = 0, iosHintShown = false;

// ---------------------------------------------------------------- DOM
const SVG = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON_POINT = '<path d="M9 21.5l-3.3-6.8a1.7 1.7 0 0 1 .8-2.3l5.6-2.6a1.7 1.7 0 0 1 2.3.8l3.3 6.8a1.7 1.7 0 0 1-.8 2.3l-5.6 2.6a1.7 1.7 0 0 1-2.3-.8z" transform="rotate(-8 12 16)"/><path d="M12.4 15.6h.01" transform="rotate(-8 12 16)"/><path d="M7.2 3.4l.8 1.9 2 .1-1.6 1.2.6 2-1.8-1.1-1.8 1.1.6-2-1.6-1.2 2-.1z" opacity=".9"/><path d="M16 5.6a4.6 4.6 0 0 1 4.4 2.2" opacity=".55"/>';
const ICON_X = '<path d="M6 6l12 12M18 6L6 18"/>';
const ICON_CAM = '<path d="M4 8.2A1.7 1.7 0 0 1 5.7 6.5h2.2l1.2-1.8h5.8l1.2 1.8h2.2A1.7 1.7 0 0 1 20 8.2v8.6a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 16.8z"/><circle cx="12" cy="12.5" r="3.3"/>';
const ICON_MOON = '<path d="M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1z"/>';
const ICON_COMPASS = '<circle cx="12" cy="12" r="8.5"/><path d="M15.4 8.6l-1.9 4.9-4.9 1.9 1.9-4.9z"/>';

function el(tag, attrs = {}, html = '') {
  const n = document.createElement(tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  n.innerHTML = html; return n;
}

let ui = null;
function buildUI() {
  const night = el('div', { id: 'ar-night', 'aria-hidden': 'true' });
  const intro = el('div', { id: 'ar-intro', class: 'panel', role: 'dialog', 'aria-label': 'Point at the sky' }, `
    <div class="eyebrow">Point at the sky</div>
    <ul>
      <li>Hold your phone up: the sky on screen follows it, horizon and all.</li>
      <li>Uses your location and motion sensors (and the camera, only if you switch it on).</li>
      <li><b>Location and camera never leave your phone.</b></li>
    </ul>
    <div class="ar-intro-btns"><button id="ar-intro-go" class="btn primary" type="button">Start</button><button id="ar-intro-no" class="btn" type="button">Not now</button></div>`);
  intro.hidden = true;
  const bar = el('nav', { id: 'ar-bar', 'aria-label': 'Point mode controls' }, `
    <button id="arb-exit" class="dk" type="button" aria-label="Exit point mode" title="Exit point mode">${SVG(ICON_X)}<span>Exit</span></button>
    <button id="arb-cam" class="dk" type="button" aria-pressed="false" aria-label="Camera: show the sky over the live camera" title="Camera: show the sky over the live camera">${SVG(ICON_CAM)}<span>Camera</span></button>
    <button id="arb-night" class="dk" type="button" aria-pressed="false" aria-label="Night mode: red light only" title="Night mode: red light only">${SVG(ICON_MOON)}<span>Night</span></button>
    <button id="arb-cal" class="dk" type="button" aria-expanded="false" aria-controls="ar-cal" aria-label="Calibrate the compass" title="Calibrate the compass">${SVG(ICON_COMPASS)}<span>Calibrate</span><i class="ar-badge" aria-hidden="true"></i></button>`);
  const acc = el('button', { id: 'ar-acc', type: 'button', class: 'ar-pill', 'aria-label': 'Compass accuracy: open calibration' }, '<i class="ar-dot" aria-hidden="true"></i><span id="ar-acc-t">Compass</span>');
  acc.hidden = true;
  const toast = el('div', { id: 'ar-toast', class: 'panel', role: 'status', 'aria-live': 'polite' });
  toast.hidden = true;
  const fig = el('div', { id: 'ar-fig8', class: 'panel', role: 'note' }, `
    <svg viewBox="0 0 80 40" width="80" height="40" aria-hidden="true"><path id="ar-8path" d="M14 20C14 9 30 9 40 20S66 31 66 20 50 9 40 20 14 31 14 20z" fill="none" stroke="rgba(176,200,255,.4)" stroke-width="1.6" stroke-linecap="round"/>
    <circle r="3.2" fill="#f2c14e" cx="14" cy="20">${matchMedia('(prefers-reduced-motion: reduce)').matches ? '' : '<animateMotion dur="2.4s" repeatCount="indefinite"><mpath href="#ar-8path"/></animateMotion>'}</circle></svg>
    <span>Wave your phone in a figure 8 a few times to calibrate the compass.</span>
    <button class="icon-btn" type="button" aria-label="Dismiss" title="Dismiss">${SVG('<path d="M6 6l12 12M18 6L6 18"/>', 'width="14" height="14"')}</button>`);
  fig.hidden = true;
  const cal = el('div', { id: 'ar-cal', class: 'panel', role: 'dialog', 'aria-label': 'Calibrate point mode' }, `
    <div class="arc-head"><span class="eyebrow">Calibrate</span><button id="arc-close" class="icon-btn" type="button" aria-label="Close" title="Close">${SVG('<path d="M6 6l12 12M18 6L6 18"/>', 'width="14" height="14"')}</button></div>
    <div class="arc-row"><span class="k">Compass</span><span class="v" id="arc-compass">--</span></div>
    <div class="arc-row"><span class="k">Heading nudge</span>
      <span class="arc-nudge"><button id="arc-m" class="btn" type="button" aria-label="Nudge 1 degree anticlockwise">−1°</button><b id="arc-nv" class="num">+0.0°</b><button id="arc-p" class="btn" type="button" aria-label="Nudge 1 degree clockwise">+1°</button><button id="arc-reset" class="btn" type="button">Reset</button></span></div>
    <div id="ar-strip" role="slider" aria-label="Fine heading nudge: drag sideways" aria-valuemin="-30" aria-valuemax="30" aria-valuenow="0" tabindex="0"></div>
    <div class="sm-note">Line up a bright star or a known landmark, then nudge until they match. Saved on this device.</div>
    <div id="arc-cam" class="arc-cam">
      <div class="arc-row"><span class="k">Lens</span><span class="arc-nudge"><button id="arc-lm" class="btn" type="button" aria-label="Narrower lens">−</button><b id="arc-lv" class="num">67.0°</b><button id="arc-lp" class="btn" type="button" aria-label="Wider lens">+</button></span></div>
      <div class="arc-row arc-slider"><label class="k" for="arc-bright">Camera brightness</label><input id="arc-bright" type="range" min="0.3" max="1" step="0.01" value="0.85"></div>
    </div>
    <div class="arc-info">
      <div class="sm-note" id="arc-decl"></div>
      <div class="sm-note" id="arc-loc"></div>
      <div class="sm-note">Screen too dim outdoors? Raise the brightness in Control Center: web apps can't change it.</div>
    </div>`);
  cal.hidden = true;
  body.append(night, intro, bar, acc, toast, fig, cal);
  return { night, intro, bar, acc, toast, fig, cal };
}

// ---------------------------------------------------------------- toasts
let toastTimer = 0;
function toast(msg, sticky = false) {
  if (!ui) return;
  clearTimeout(toastTimer); ui.toast.textContent = msg; ui.toast.hidden = false;
  if (!sticky) toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 5000);
}
function toastOff() { clearTimeout(toastTimer); if (ui) ui.toast.hidden = true; }

// ---------------------------------------------------------------- sensors
function screenAngle() {
  const t = window.__arTest && window.__arTest.screenAngle;
  if (Number.isFinite(t)) return t;
  if (typeof window.orientation === 'number') return window.orientation;
  if (screen.orientation && Number.isFinite(screen.orientation.angle)) return screen.orientation.angle;
  return 0;
}

function onOrient(e) {
  if (e.alpha == null || e.beta == null || e.gamma == null) return;     // desktop browsers fire empty events: they must not pick the source
  const abs = e.type === 'deviceorientationabsolute' || e.absolute === true;
  if (abs) { absSeen = true; st.source = 'absolute'; }
  else if (absSeen) return;
  else if (typeof e.webkitCompassHeading === 'number') st.source = 'ios';
  else st.source = 'relative';
  raw.alpha = e.alpha; raw.beta = e.beta; raw.gamma = e.gamma;
  if (!raw.has) { raw.has = true; if (waiter) waiter(); }
  if (st.source === 'ios') {
    const now = performance.now(), first = st.iosOffset === null;
    const off = compassYawOffset(e.alpha, e.beta, e.gamma, e.webkitCompassHeading);
    if (off !== null) {
      st.iosOffset = blendAngle(st.iosOffset, off, first ? 1 : 1 - Math.exp(-(now - lastIosT) / 1000 / 1.0));
      lastIosT = now;
      if (first) smoother.reset();
    }
    const a = e.webkitCompassAccuracy;
    if (typeof a === 'number' && a >= 0) { st.accDeg = a; st.accuracy = a <= 15 ? 'good' : a <= 30 ? 'fair' : 'poor'; }
    else { st.accDeg = null; st.accuracy = 'unknown'; }
  } else if (st.source === 'absolute') {
    st.accDeg = null; st.accuracy = performance.now() - calNeeded < 15000 && calNeeded > 0 ? 'poor' : 'good';
  } else { st.accDeg = null; st.accuracy = 'none'; }
}
const onCalNeeded = () => { calNeeded = performance.now(); };

function listen() {
  if (listening) return; listening = true;
  window.addEventListener('deviceorientationabsolute', onOrient);
  window.addEventListener('deviceorientation', onOrient);
  window.addEventListener('compassneedscalibration', onCalNeeded);
}
function unlisten() {
  if (!listening) return; listening = false;
  window.removeEventListener('deviceorientationabsolute', onOrient);
  window.removeEventListener('deviceorientation', onOrient);
  window.removeEventListener('compassneedscalibration', onCalNeeded);
}
function resetSensors() {
  raw.has = false; absSeen = false; st.source = null; st.iosOffset = null; st.accDeg = null; st.accuracy = 'unknown'; calNeeded = 0; lastIosT = 0; waiter = null;
  smoother.reset(); dragYaw = dragPitch = 0; grabbed = false; iosHintShown = false;
}
function yawTotal() {
  return (st.source === 'ios' ? st.iosOffset || 0 : 0) + (st.source === 'relative' ? 0 : st.declination) + st.nudge;
}
function sensorQuat(out) { return screenQuat(raw.alpha, raw.beta, raw.gamma, screenAngle(), yawTotal(), out); }

// ---------------------------------------------------------------- camera passthrough
const cam = { video: null, tex: null, stream: null, busy: false };
const lensFov = () => coverVerticalFov(prefs.lens, ...(atlas.H > atlas.W ? [1440, 1920] : [1920, 1440]), atlas.W, atlas.H);
const defaultSkyFov = () => clamp(lensFov(), 20, 100);

function fitCam() {
  if (!cam.tex || !cam.video || !cam.video.videoWidth) return;
  const va = cam.video.videoWidth / cam.video.videoHeight, sa = atlas.W / atlas.H, t = cam.tex;
  if (va > sa) { t.repeat.set(sa / va, 1); t.offset.set((1 - sa / va) / 2, 0); } else { t.repeat.set(1, va / sa); t.offset.set(0, (1 - va / sa) / 2); }
  t.matrixAutoUpdate = true;
}
/** Scene background, ground dome and Milky Way follow "AR on and camera running". */
function applyCameraFx() {
  const live = st.phase === 'on' && !!cam.stream && !!cam.tex;
  st.camera = live;
  if (live) { atlas.scene.background = cam.tex; atlas.scene.backgroundIntensity = prefs.camBright; atlas.S.arFx = { ground: 0, mw: 0.3 }; fitCam(); }
  else { atlas.scene.background = null; atlas.S.arFx = { ground: 1, mw: 1 }; }
}
function ensureVideo() {
  if (cam.video) return cam.video;
  const v = document.createElement('video');
  v.playsInline = true; v.muted = true; v.autoplay = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.setAttribute('autoplay', '');
  v.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  v.addEventListener('loadedmetadata', () => { fitCam(); });
  body.appendChild(v); cam.video = v; return v;
}
/** Must be called straight from a user gesture (it calls getUserMedia before returning). Resolves true when the stream plays. */
function cameraStart() {
  if (cam.stream || cam.busy) return Promise.resolve(!!cam.stream);
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('This browser cannot open the camera.'); cameraFailed(); return Promise.resolve(false); }
  cam.busy = true;
  let p;
  try { p = navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false }); } catch (e) { p = Promise.reject(e); }
  return p.then(async (stream) => {
    if (st.phase === 'off' || !prefs.camera) { stream.getTracks().forEach((t) => t.stop()); return false; }
    const v = ensureVideo(); v.srcObject = stream; cam.stream = stream;
    try { await v.play(); } catch (e) { /* autoplay: muted + playsinline should pass */ }
    if (!v.videoWidth) await new Promise((r) => { v.addEventListener('loadedmetadata', r, { once: true }); setTimeout(r, 2500); });
    if (!cam.tex) { cam.tex = new THREE.VideoTexture(v); cam.tex.colorSpace = THREE.SRGBColorSpace; }
    applyCameraFx(); syncUI(); return true;
  }).catch(() => { toast('Camera access was declined.'); cameraFailed(); return false; }).finally(() => { cam.busy = false; });
}
function cameraFailed() { prefs.camera = false; savePrefs(); cameraStop(); syncUI(); }
function cameraStop() {
  if (cam.stream) cam.stream.getTracks().forEach((t) => t.stop());
  cam.stream = null; if (cam.video) cam.video.srcObject = null;
  if (atlas) { const was = st.camera; applyCameraFx(); if (was && st.phase === 'on') atlas.S.sky.fov = defaultSkyFov(); }
}
function toggleCamera() {
  if (st.phase !== 'on') return;
  prefs.camera = !prefs.camera; savePrefs();
  if (prefs.camera) cameraStart(); else cameraStop();
  syncUI();
}

// ---------------------------------------------------------------- night mode, wake lock
function applyNight() {
  root.classList.toggle('ar-night', st.phase !== 'off' && prefs.night);
}
function toggleNight() { prefs.night = !prefs.night; st.night = prefs.night; savePrefs(); applyNight(); syncUI(); }
async function takeWake() { try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { wakeLock = null; } }
function dropWake() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (st.phase === 'off') return;
  if (document.hidden) { if (cam.stream) { cam.stream.getTracks().forEach((t) => t.stop()); cam.stream = null; if (cam.video) cam.video.srcObject = null; applyCameraFx(); } }
  else { takeWake(); if (st.phase === 'on' && prefs.camera && !cam.stream) cameraStart(); }
});

// ---------------------------------------------------------------- pose (called every frame by main.js)
function arPose() {
  if (st.phase !== 'on') return null;
  const now = performance.now(), dt = lastFrameT ? clamp((now - lastFrameT) / 1000, 0, 0.1) : 0.016; lastFrameT = now;
  if (!raw.has) return null;
  const q = qOut;
  const qs = smoother.update(sensorQuat(qT), dt);
  q[0] = qs[0]; q[1] = qs[1]; q[2] = qs[2]; q[3] = qs[3];
  if (!grabbed && (dragYaw || dragPitch)) {
    const k = Math.exp(-dt / 0.18); dragYaw *= k; dragPitch *= k;
    if (Math.abs(dragYaw) < 0.005 && Math.abs(dragPitch) < 0.005) dragYaw = dragPitch = 0;
  }
  if (dragYaw || dragPitch) {
    qMul(qAxis(0, 0, 1, -dragYaw * DEG, qDragA), q, q);
    qMul(q, qAxis(1, 0, 0, dragPitch * DEG, qDragA), q);
  }
  if (blend) {
    const t = clamp((now - blend.t0) / 700, 0, 1), e = t * t * (3 - 2 * t);
    qSlerp(blend.q0, q, e, q);
    if (t >= 1) blend = null;
  }
  const v = cameraVectors(q), r = azAltRoll(q);
  st.az = r.az; st.alt = r.alt; st.roll = r.roll;
  atlas.S.sky.az = r.az; atlas.S.sky.alt = r.alt;
  const fov = st.camera && cam.video && cam.video.videoWidth
    ? coverVerticalFov(prefs.lens, cam.video.videoWidth, cam.video.videoHeight, atlas.W, atlas.H) : atlas.S.sky.fov;
  st.fov = fov;
  return { dir: v.dir, up: v.up, fov };
}
function arDrag(dxDeg, dyDeg) {
  if (st.phase !== 'on') return false;
  dragYaw -= dxDeg / Math.max(0.35, Math.cos(st.alt * DEG));
  dragPitch = clamp(dragPitch + dyDeg, -60, 60);
  return true;
}
function arGrab(down) { grabbed = !!down && st.phase === 'on'; }

// ---------------------------------------------------------------- entry / exit
const eng = () => (window.__lessons && window.__lessons.engine) || null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function idle(ms = 6000) { const t0 = performance.now(); while ((atlas.S.trans || atlas.S.travel) && performance.now() - t0 < ms) await sleep(50); }
function closeSheets() { document.querySelectorAll('#dock .dk.on[data-sheet]').forEach((b) => b.click()); }

/** Called synchronously from a click: permissions must be requested before the first await. */
function start() {
  if (st.phase !== 'off' || !atlas) return;
  if (!window.isSecureContext) { toast('Point mode needs a secure (https) connection.'); return; }
  if (!('DeviceOrientationEvent' in window)) { toast("This device has no motion sensors, so Point mode can't follow it."); return; }
  st.phase = 'starting'; const my = tok = { cancel: false };
  let permP;
  try { permP = typeof DeviceOrientationEvent.requestPermission === 'function' ? DeviceOrientationEvent.requestPermission() : Promise.resolve('granted'); } catch (e) { permP = Promise.resolve('denied'); }
  permP = Promise.resolve(permP).catch(() => 'denied');
  const posP = new Promise((res) => {
    const done = (v) => res(v); const guard = setTimeout(() => done(null), 15000);
    try {
      navigator.geolocation.getCurrentPosition((p) => { clearTimeout(guard); done({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }); },
        () => { clearTimeout(guard); done(null); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    } catch (e) { clearTimeout(guard); done(null); }
  });
  if (prefs.camera) cameraStart();
  syncUI();
  run(my, permP, posP).catch((e) => { console.error('AR start', e); if (tok === my) abort(); });
}

async function run(my, permP, posP) {
  const a = atlas, S = a.S;
  const dead = () => my.cancel || tok !== my;
  if ((await permP) !== 'granted') { if (dead()) return; abort(); toast('Motion access was declined. To allow it: Settings › Apps › Safari › Motion & Orientation Access, then try again.'); return; }
  if (dead()) return;
  resetSensors(); listen();
  const got = await new Promise((res) => { if (raw.has) return res(true); waiter = () => res(true); setTimeout(() => res(false), 1500); });
  if (dead()) return;
  if (!got) { abort(); toast('No motion sensor data from this device.'); return; }
  // snapshot of the user's Explore state (closing Learn or a running lesson first)
  if (window.__learn && window.__learn.state && window.__learn.state.active) { try { window.__learn.close(); } catch (e) { /* ignore */ } }
  const engine = eng();
  if (engine && (engine.held || engine.running)) await engine.end({ instant: true });
  if (dead()) return;
  if (engine) { await engine.begin(); snapped = true; }
  if (dead()) return;
  closeSheets(); a.closeCard(); body.classList.add('ar-on'); applyNight(); syncUI();
  toast('Finding where you are…', true);
  const pos = await posP;
  if (dead()) return;
  if (pos) toastOff();
  if (pos) st.pos = { lat: pos.lat, lon: pos.lon, acc: pos.acc, fallback: false };
  else {
    st.pos = { lat: S.obs.lat, lon: S.obs.lon, acc: null, fallback: true };
    toast(`No location fix: using ${($('#place-name') || {}).textContent || 'the current place'}.`);
  }
  // real time
  S.keepLocal = false;
  if (S.tm !== 'day') a.setTimeMode('day');
  else { S.time = S.anchor = Date.now(); S.playing = true; S.speed = 1; a.syncPlay(); }
  a.closeCard();
  await idle();
  if (dead()) return;
  await a.travelTo(st.pos.lat, st.pos.lon);
  await idle();
  if (dead()) return;
  S.time = S.anchor = Date.now(); a.updateCelestial(true);
  // magnetic declination
  const m = await (wmmP || (wmmP = loadWMM()));
  try { st.declination = m ? declination(m, st.pos.lat, st.pos.lon, decimalYear(Date.now())) : 0; declOk = !!m; } catch (e) { st.declination = 0; declOk = false; }
  if (!Number.isFinite(st.declination)) { st.declination = 0; declOk = false; }
  if (dead()) return;
  // camera or not: the sky on screen has the scale of the real world
  if (!(prefs.camera || cam.stream || cam.busy)) S.sky.fov = defaultSkyFov();
  if (S.mode === 'globe') {
    const q0 = sensorQuat([0, 0, 0, 1]), r = azAltRoll(q0);
    await a.enterSky({ az: r.az, alt: r.alt, fov: S.sky.fov });
    await idle();
    if (dead()) return;
  }
  if (cam.busy) { for (let i = 0; i < 40 && cam.busy; i++) await sleep(100); if (dead()) return; }
  if (!cam.stream) S.sky.fov = defaultSkyFov();      // the camera did not come up (yet): the sky keeps the real-world scale; it takes over when it arrives
  // go live: glide from the pre-AR view into the sensor pose
  blend = { t0: performance.now(), q0: quatFromAzAltRoll(S.sky.az, S.sky.alt, 0) };
  smoother.reset(); lastFrameT = 0; dragYaw = dragPitch = 0;
  st.phase = 'on'; st.active = true; st.nudge = prefs.nudge; st.night = prefs.night;
  applyCameraFx();
  if (cam.stream && cam.video) st.fov = coverVerticalFov(prefs.lens, cam.video.videoWidth, cam.video.videoHeight, a.W, a.H);
  takeWake(); toastOff();
  if (st.source === 'relative') toast('No compass on this device: north is a guess. Use Calibrate › Nudge to line it up.');
  syncUI();
}

/** Tear down a start that did not get as far as going live (and restore if the snapshot was taken). */
function abort() { exit(); }

async function exit() {
  if (st.phase === 'off') return;
  if (tok) tok.cancel = true; tok = null;
  st.phase = 'off'; st.active = false; blend = null; grabbed = false; dragYaw = dragPitch = 0;
  unlisten(); cameraStop(); dropWake();
  if (atlas) { atlas.scene.background = null; atlas.S.arFx = { ground: 1, mw: 1 }; }
  st.camera = false;
  body.classList.remove('ar-on', 'ar-live'); root.classList.remove('ar-night');
  closeCal(); ui.fig.hidden = true; ui.acc.hidden = true; ui.intro.hidden = true;
  if (!ui.toast.hidden && /Finding where/.test(ui.toast.textContent)) toastOff();
  syncUI();
  if (snapped && eng()) { snapped = false; try { await eng().end({ instant: true }); } catch (e) { console.error(e); } }
}
window.addEventListener('pagehide', () => { if (st.phase !== 'off') exit(); });

// ---------------------------------------------------------------- UI wiring
let calOpen = false, figLast = -Infinity, prevAcc = '';   // -Infinity: performance.now() starts at page load, so 0 would block the hint for the first minute
function setNudge(v, save = true) {
  prefs.nudge = st.nudge = Math.round(clamp(v, -30, 30) * 10) / 10;
  if (save) savePrefs();
  syncCal();
}
function openCal() { calOpen = true; ui.cal.hidden = false; ui.fig.hidden = true; syncCal(); syncUI(); }
function closeCal() { calOpen = false; if (ui) ui.cal.hidden = true; syncUI(); }
const fmtSigned = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}°`;
function syncCal() {
  if (!calOpen) return;
  const src = { absolute: 'Android compass', ios: 'iPhone compass', relative: 'No compass' }[st.source] || '--';
  const txt = { good: 'Good', fair: 'Fair', poor: 'Poor: wave in a figure 8', none: 'Not available', unknown: st.source === 'ios' && st.iosOffset === null ? 'Finding north…' : 'Accuracy unknown' }[st.accuracy];
  $('#arc-compass').textContent = `${txt}${st.accDeg != null ? ` ±${Math.round(st.accDeg)}°` : ''} · ${src}`;
  $('#arc-nv').textContent = fmtSigned(st.nudge);
  const strip = $('#ar-strip'); strip.setAttribute('aria-valuenow', st.nudge.toFixed(1)); strip.style.backgroundPositionX = `${(-st.nudge * 30).toFixed(1)}px`;
  $('#arc-cam').hidden = !st.camera;
  $('#arc-lv').textContent = `${prefs.lens.toFixed(1)}°`;
  const br = $('#arc-bright'); if (document.activeElement !== br) br.value = prefs.camBright;
  const d = st.declination;
  $('#arc-decl').textContent = declOk ? `Magnetic declination here: ${Math.abs(d).toFixed(1)}° ${d >= 0 ? 'E' : 'W'} (World Magnetic Model 2025)` : 'Magnetic declination unavailable: assuming 0° (the model did not load).';
  $('#arc-loc').textContent = st.pos.fallback ? `Location: no GPS fix, using ${($('#place-name') || {}).textContent || 'the current place'}` : st.pos.acc != null ? `Location: ±${Math.round(st.pos.acc)} m` : 'Location: --';
}

function syncUI() {
  if (!ui) return;
  const on = st.phase !== 'off', live = st.phase === 'on';
  $('#dk-ar') && ($('#dk-ar').setAttribute('aria-pressed', String(on)), $('#dk-ar').classList.toggle('on', on));
  $('#ar-btn') && ($('#ar-btn').classList.toggle('on', on), $('#ar-btn').setAttribute('aria-pressed', String(on)));
  const cb = $('#arb-cam'); cb.classList.toggle('on', st.camera || (prefs.camera && on)); cb.setAttribute('aria-pressed', String(prefs.camera));
  const nb = $('#arb-night'); nb.classList.toggle('on', prefs.night); nb.setAttribute('aria-pressed', String(prefs.night));
  const cl = $('#arb-cal'); cl.classList.toggle('on', calOpen); cl.setAttribute('aria-expanded', String(calOpen));
  const finding = st.source === 'ios' && st.iosOffset === null;
  const kind = finding ? 'none0' : st.accuracy;
  ui.bar.dataset.acc = kind; ui.acc.dataset.acc = kind;
  ui.acc.hidden = !live; body.classList.toggle('ar-live', live);
  let t = 'Compass';
  if (finding) t = 'Finding north…';
  else if (st.accuracy === 'good') t = `Compass good${st.accDeg != null ? ` ±${Math.round(st.accDeg)}°` : ''}`;
  else if (st.accuracy === 'fair') t = `Compass fair${st.accDeg != null ? ` ±${Math.round(st.accDeg)}°` : ''}`;
  else if (st.accuracy === 'poor') t = 'Compass poor — calibrate';
  else if (st.accuracy === 'none') t = 'No compass';
  else t = 'Compass accuracy unknown';
  const tt = $('#ar-acc-t'); if (tt.textContent !== t) tt.textContent = t;
  // figure-8 hint when the compass turns poor (at most once a minute)
  if (live && st.accuracy === 'poor' && prevAcc !== 'poor' && !calOpen && performance.now() - figLast > 60000) { figLast = performance.now(); ui.fig.hidden = false; clearTimeout(figTimer); figTimer = setTimeout(() => { ui.fig.hidden = true; }, 15000); }
  prevAcc = live ? st.accuracy : '';            // only live changes count: a compass already poor at go-live still gets the hint
  if (live && finding && !iosHintShown) { iosHintShown = true; toast('Hold the phone upright for a moment to find north.'); }
  syncCal();
}
let figTimer = 0;

function onPointTap() {
  if (st.phase === 'on') { exit(); return; }
  if (st.phase === 'starting') return;
  if (!prefs.intro) { closeSheets(); ui.intro.hidden = false; const g = $('#ar-intro-go'); try { g.focus({ preventScroll: true }); } catch (e) { /* ignore */ } return; }
  start();
}

function wire() {
  const dk = $('#dk-ar'), tb = $('#ar-btn');
  dk && dk.addEventListener('click', onPointTap);
  tb && tb.addEventListener('click', (e) => { e.stopPropagation(); onPointTap(); });
  $('#ar-intro-go').addEventListener('click', () => { ui.intro.hidden = true; prefs.intro = true; savePrefs(); start(); });
  $('#ar-intro-no').addEventListener('click', () => { ui.intro.hidden = true; });
  $('#arb-exit').addEventListener('click', () => exit());
  $('#arb-cam').addEventListener('click', toggleCamera);
  $('#arb-night').addEventListener('click', toggleNight);
  $('#arb-cal').addEventListener('click', () => (calOpen ? closeCal() : openCal()));
  ui.acc.addEventListener('click', () => (calOpen ? closeCal() : openCal()));
  ui.fig.querySelector('button').addEventListener('click', () => { ui.fig.hidden = true; });
  $('#arc-close').addEventListener('click', closeCal);
  $('#arc-m').addEventListener('click', () => setNudge(st.nudge - 1));
  $('#arc-p').addEventListener('click', () => setNudge(st.nudge + 1));
  $('#arc-reset').addEventListener('click', () => setNudge(0));
  $('#arc-lm').addEventListener('click', () => { prefs.lens = clamp(Math.round((prefs.lens - 0.5) * 2) / 2, 40, 100); savePrefs(); syncCal(); });
  $('#arc-lp').addEventListener('click', () => { prefs.lens = clamp(Math.round((prefs.lens + 0.5) * 2) / 2, 40, 100); savePrefs(); syncCal(); });
  $('#arc-bright').addEventListener('input', (e) => { prefs.camBright = clamp(+e.target.value, 0.3, 1); atlas.scene.backgroundIntensity = prefs.camBright; savePrefs(); });
  // fine nudge strip: 0.1° per 3 px; the content follows the finger
  const strip = $('#ar-strip'); let sx = null;
  strip.addEventListener('pointerdown', (e) => { sx = e.clientX; try { strip.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } e.preventDefault(); });
  strip.addEventListener('pointermove', (e) => { if (sx === null) return; setNudge(st.nudge - ((e.clientX - sx) / 3) * 0.1, false); sx = e.clientX; });
  const endStrip = () => { if (sx !== null) { sx = null; savePrefs(); } };
  strip.addEventListener('pointerup', endStrip); strip.addEventListener('pointercancel', endStrip);
  strip.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { setNudge(st.nudge - 0.1); e.preventDefault(); } else if (e.key === 'ArrowRight') { setNudge(st.nudge + 0.1); e.preventDefault(); } });
  // swipe the calibration sheet down by its grab handle (phones)
  const cal = ui.cal; let sy = null, dy = 0;
  const swBegin = (y) => { const r = cal.getBoundingClientRect(); if (!root.classList.contains('phone') || root.classList.contains('land') || y - r.top > 36) return; sy = y; dy = 0; cal.style.transition = 'none'; };
  const swMove = (y) => { if (sy === null) return; dy = Math.max(0, y - sy); cal.style.transform = `translateY(${dy}px)`; cal.style.opacity = String(Math.max(0.35, 1 - dy / 280)); };
  const swEnd = () => { if (sy === null) return; const close = dy > 70; sy = null; cal.style.transition = 'transform 160ms ease, opacity 160ms ease'; cal.style.transform = ''; cal.style.opacity = ''; setTimeout(() => { cal.style.transition = ''; }, 200); if (close) closeCal(); };
  cal.addEventListener('touchstart', (e) => { if (e.touches.length === 1) swBegin(e.touches[0].clientY); }, { passive: true });
  cal.addEventListener('touchmove', (e) => { if (sy !== null) { e.preventDefault(); swMove(e.touches[0].clientY); } }, { passive: false });
  cal.addEventListener('touchend', swEnd); cal.addEventListener('touchcancel', swEnd);
  // the Point buttons exist only where the phone can point
  const can = (matchMedia('(hover: none) and (pointer: coarse)').matches && 'DeviceOrientationEvent' in window) || /[?&]ardebug\b/.test(location.search);
  if (can) { dk && (dk.hidden = false); tb && (tb.hidden = false); }
  // geometry changes
  const refit = () => fitCam();
  window.addEventListener('resize', refit); window.addEventListener('orientationchange', refit);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', refit);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.phase !== 'off') { if (calOpen) closeCal(); else exit(); } });
  // G / a transition left the sky view: the mode is over
  new MutationObserver(() => { if (st.phase === 'on' && !body.classList.contains('mode-sky')) exit(); }).observe(body, { attributes: true, attributeFilter: ['class'] });
  setInterval(syncUI, 250);
  syncUI();
}

function init() {
  atlas = window.__atlas;
  ui = buildUI();
  atlas.hooks.arPose = arPose; atlas.hooks.arDrag = arDrag; atlas.hooks.arGrab = arGrab;
  wire();
  if (/[?&]ardebug\b/.test(location.search)) import('./debug.js').catch((e) => console.error('ar debug', e));
}
window.__ar = {
  get state() { return st; },
  enter() { start(); }, exit() { return exit(); },
  toggle() { if (st.phase === 'off') start(); else if (st.phase === 'on') return exit(); },
};
(function wait() { if (window.__atlas) init(); else setTimeout(wait, 80); })();
