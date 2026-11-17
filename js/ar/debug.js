// Desktop test harness for Point mode (loaded only with ?ardebug): fake motion sensors, fake GPS, fake camera.
// Physical pose (where the phone looks, roll, screen angle) -> W3C alpha/beta/gamma -> real DeviceOrientation-style events, so the
// whole path in ar.js (permission, source detection, compass offset, screen rotation, smoothing) is exercised as on a phone.
import { DEG, qAxis, qMul, quatFromAzAltRoll, eulerFromQuat } from './orient.js';

const PLACES = {
  Rome: { lat: 41.9028, lon: 12.4964 }, Sydney: { lat: -33.8688, lon: 151.2093 }, Reykjavik: { lat: 64.1466, lon: -21.9426 }, deny: null,
};
const cfg = { mode: 'absolute', az: 0, alt: 0, roll: 0, screen: 0, acc: 10, jitter: false, place: 'Rome' };
window.__arTest = { screenAngle: 0 };

// ---- fake permission, GPS, camera
try { DeviceOrientationEvent.requestPermission = async () => 'granted'; } catch (e) { /* read-only: leave it */ }
const fakeGeo = {
  getCurrentPosition(ok, err) {
    setTimeout(() => {
      const p = PLACES[cfg.place];
      if (!p) { err && err({ code: 1, message: 'denied' }); return; }
      ok({ coords: { latitude: p.lat, longitude: p.lon, accuracy: 12 }, timestamp: Date.now() });
    }, 300);
  },
  watchPosition() { return 0; }, clearWatch() { /* none */ },
};
try { Object.defineProperty(navigator, 'geolocation', { value: fakeGeo, configurable: true }); } catch (e) { navigator.geolocation.getCurrentPosition = fakeGeo.getCurrentPosition; }
try {
  const md = navigator.mediaDevices || {};
  const fakeCam = async () => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 480; const g = c.getContext('2d'); let k = 0;
    const draw = () => { k++; const gr = g.createLinearGradient(0, 0, 640, 480); gr.addColorStop(0, '#2a3a52'); gr.addColorStop(1, '#6b4b36'); g.fillStyle = gr; g.fillRect(0, 0, 640, 480); g.fillStyle = '#fff'; g.font = '28px sans-serif'; g.fillText('fake camera ' + k, 40, 80); g.strokeStyle = '#fff'; g.strokeRect(2, 2, 636, 476); };
    draw(); setInterval(draw, 100);
    return c.captureStream(10);
  };
  Object.defineProperty(navigator, 'mediaDevices', { value: Object.assign(Object.create(Object.getPrototypeOf(md)), { getUserMedia: fakeCam }), configurable: true });
} catch (e) { /* leave the real camera */ }

// ---- event synthesis
const norm360 = (a) => ((a % 360) + 360) % 360;
function dispatch() {
  const sa = cfg.screen; window.__arTest.screenAngle = sa;
  // sliders are TRUE azimuth: an absolute (magnetic) alpha frame is turned back by the declination the app will add
  const decl0 = (window.__ar && window.__ar.state.declination) || 0;
  const az = cfg.mode === 'absolute' ? norm360(cfg.az - decl0) : cfg.az;
  const q = qMul(quatFromAzAltRoll(az, cfg.alt, cfg.roll), qAxis(0, 0, 1, sa * DEG));
  const dev = cfg.mode === 'ios' ? qMul(qAxis(0, 0, 1, 137.3 * DEG), q) : q;
  const e = eulerFromQuat(dev), j = () => (cfg.jitter ? (Math.random() - 0.5) * 0.8 : 0);
  const props = { alpha: { value: e.alpha + j() }, beta: { value: e.beta + j() }, gamma: { value: e.gamma + j() } };
  let type = 'deviceorientation';
  if (cfg.mode === 'absolute') { type = 'deviceorientationabsolute'; props.absolute = { value: true }; }
  else {
    props.absolute = { value: false };
    if (cfg.mode === 'ios') {
      const decl = (window.__ar && window.__ar.state.declination) || 0;
      props.webkitCompassHeading = { value: norm360(cfg.az - decl) };
      props.webkitCompassAccuracy = { value: cfg.acc };
    }
  }
  const ev = new Event(type); Object.defineProperties(ev, props); window.dispatchEvent(ev);
}
setInterval(dispatch, 1000 / 30);

// ---- panel
const panel = document.createElement('div');
panel.id = 'ar-debug'; panel.className = 'panel';
panel.style.cssText = 'position:fixed;left:8px;bottom:84px;z-index:2147483100;padding:8px 10px;font-size:11px;line-height:1.3;width:210px;max-height:60vh;overflow:auto;';
const sl = (id, label, min, max, step, val) => `<label style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="width:30px">${label}</span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" style="flex:1;min-width:0"><b id="${id}-v" class="num" style="width:34px;text-align:right">${val}</b></label>`;
panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">AR test</span><button id="ard-fold" class="chip" type="button">hide</button></div>
<div id="ard-body">
<select id="ard-mode" style="width:100%;margin:4px 0"><option value="absolute">absolute (Android)</option><option value="ios">iOS (compass heading)</option><option value="relative">relative (no compass)</option></select>
${sl('ard-az', 'az', 0, 360, 0.5, 0)}${sl('ard-alt', 'alt', -90, 90, 0.5, 0)}${sl('ard-roll', 'roll', -90, 90, 0.5, 0)}${sl('ard-acc', 'acc', -1, 60, 1, 10)}
<label style="display:flex;gap:6px;align-items:center;margin:3px 0">screen <select id="ard-screen"><option>0</option><option>90</option><option>180</option><option>270</option></select>
<span style="margin-left:6px"><input id="ard-jit" type="checkbox"> jitter</span></label>
<label style="display:flex;gap:6px;align-items:center">place <select id="ard-place" style="flex:1"><option>Rome</option><option>Sydney</option><option>Reykjavik</option><option value="deny">deny</option></select></label>
</div>`;
document.body.appendChild(panel);
const $ = (s) => panel.querySelector(s);
function syncPanel() {
  $('#ard-mode').value = cfg.mode;
  for (const k of ['az', 'alt', 'roll', 'acc']) { $('#ard-' + k).value = cfg[k]; $('#ard-' + k + '-v').textContent = cfg[k]; }
  $('#ard-screen').value = String(cfg.screen); $('#ard-jit').checked = cfg.jitter; $('#ard-place').value = cfg.place;
}
$('#ard-mode').onchange = (e) => { cfg.mode = e.target.value; };
for (const k of ['az', 'alt', 'roll', 'acc']) $('#ard-' + k).oninput = (e) => { cfg[k] = +e.target.value; $('#ard-' + k + '-v').textContent = cfg[k]; };
$('#ard-screen').onchange = (e) => { cfg.screen = +e.target.value; };
$('#ard-jit').onchange = (e) => { cfg.jitter = e.target.checked; };
$('#ard-place').onchange = (e) => { cfg.place = e.target.value; };
$('#ard-fold').onclick = () => { const b = $('#ard-body'); b.hidden = !b.hidden; $('#ard-fold').textContent = b.hidden ? 'show' : 'hide'; };
if (!/ardebug=open/.test(location.search)) $('#ard-fold').click();

window.__arDebug = {
  set(o = {}) { Object.assign(cfg, o); syncPanel(); dispatch(); },
  get() { return { ...cfg }; },
};
