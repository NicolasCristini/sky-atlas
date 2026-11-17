// AR mode maths: device orientation -> azimuth / altitude / roll, screen orientations, iOS compass offset, smoothing, camera FOV.
// Poses are built physically (as quaternions), turned into W3C alpha/beta/gamma with the same extraction WebKit uses on iOS
// (Source/WebCore/platform/ios/WebCoreMotionManager.mm), and fed back through the code path the app uses for real events.
import assert from 'node:assert/strict';
import * as O from '../js/ar/orient.js';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok -', name); };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} got ${a} expected ${b} (tol ${tol})`);
const nearAz = (a, b, tol, msg) => near(((a - b + 540) % 360) - 180, 0, tol, msg + ` (az ${a} vs ${b})`);
const D = O.DEG;

// rotation matrix (row-major) of a quaternion
function mat(q) {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}
// W3C alpha/beta/gamma of a device->ENU rotation, exactly as WebKit derives them (beta in [-180,180), gamma in [-90,90))
function euler(q) {
  const R = mat(q).map((v) => (Math.abs(v) < 1e-12 ? 0 : v)); let z, x, y;   // exact zeros at gimbal lock, as a real sensor never sits there
  if (R[8] > 0) { z = Math.atan2(-R[1], R[4]); x = Math.asin(R[7]); y = Math.atan2(-R[6], R[8]); }
  else if (R[8] < 0) { z = Math.atan2(R[1], -R[4]); x = -Math.asin(R[7]); x += x >= 0 ? -Math.PI : Math.PI; y = Math.atan2(R[6], -R[8]); }
  else if (R[6] > 0) { z = Math.atan2(-R[1], R[4]); x = Math.asin(R[7]); y = -Math.PI / 2; }
  else if (R[6] < 0) { z = Math.atan2(R[1], -R[4]); x = -Math.asin(R[7]); x += x >= 0 ? -Math.PI : Math.PI; y = -Math.PI / 2; }
  else { z = Math.atan2(R[3], R[0]); x = R[7] > 0 ? Math.PI / 2 : -Math.PI / 2; y = 0; }
  return { alpha: ((z * O.RAD) + 360) % 360, beta: x * O.RAD, gamma: y * O.RAD };
}
// physical pose: phone held upright in portrait facing compass heading h, camera tilted up by `up` degrees, phone turned clockwise
// (as seen by the user) by `cw` degrees about the view axis
function pose(h, up = 0, cw = 0) {
  const q = O.qAxis(0, 0, 1, -h * D);                             // face heading h (clockwise from north)
  O.qMul(q, O.qAxis(1, 0, 0, (90 + up) * D), q);                 // stand the phone up (camera to the horizon), then tilt up
  O.qMul(q, O.qAxis(0, 0, 1, -cw * D), q);                       // clockwise about the screen normal
  return O.qNormalize(q);
}
const viaEvent = (q, screenAngle = 0, yaw = 0) => { const e = euler(q); return O.azAltRoll(O.screenQuat(e.alpha, e.beta, e.gamma, screenAngle, yaw)); };

ok('portrait, upright, facing north: north horizon, level', () => {
  const r = O.azAltRoll(O.screenQuat(0, 90, 0, 0)); nearAz(r.az, 0, 1e-9, 'az'); near(r.alt, 0, 1e-9, 'alt'); near(r.roll, 0, 1e-9, 'roll');
});
ok('portrait, upright, facing east (absolute alpha 270): az 90', () => {
  const r = O.azAltRoll(O.screenQuat(270, 90, 0, 0)); nearAz(r.az, 90, 1e-9, 'az'); near(r.alt, 0, 1e-9, 'alt'); near(r.roll, 0, 1e-9, 'roll');
});
ok('every heading round-trips through W3C angles (horizon, level)', () => {
  for (let h = 0; h < 360; h += 15) { const r = viaEvent(pose(h)); nearAz(r.az, h, 1e-6, `h ${h}`); near(r.alt, 0, 1e-6, 'alt'); near(r.roll, 0, 1e-6, 'roll'); }
});
ok('phone flat, screen up: camera at the nadir, azimuth follows the top edge', () => {
  const r = O.azAltRoll(O.screenQuat(0, 0, 0, 0)); near(r.alt, -90, 1e-9, 'alt'); nearAz(r.az, 0, 1e-6, 'az');
  const r2 = O.azAltRoll(O.screenQuat(360 - 120, 0, 0, 0)); nearAz(r2.az, 120, 1e-6, 'az flat facing 120');
});
ok('tilting up from the north horizon reaches the zenith without flipping', () => {
  let prev = -1;
  for (let up = 0; up <= 90; up += 0.5) {
    const r = viaEvent(pose(0, up));
    near(r.alt, up, 1e-6, `alt at ${up}`); assert.ok(r.alt >= prev - 1e-9, 'altitude never goes back'); prev = r.alt;
    nearAz(r.az, 0, 1e-4, `az at ${up}`); near(r.roll, 0, 1e-4, `roll at ${up}`);
  }
  const z = O.azAltRoll(O.screenQuat(0, 180, 0, 0)); near(z.alt, 90, 1e-9, 'beta 180 is the zenith'); nearAz(z.az, 0, 1e-6, 'facing north at the zenith');
});
ok('over the zenith: azimuth follows the way you face until the camera is really behind you (no jitter-driven flips)', () => {
  const a = viaEvent(pose(30, 89.6)), b = viaEvent(pose(30, 90)), c = viaEvent(pose(30, 90.4)), d = viaEvent(pose(30, 91));
  nearAz(a.az, 30, 1e-3, 'just before'); nearAz(b.az, 30, 1e-3, 'at the zenith'); nearAz(c.az, 30, 1e-3, 'leaning 0.4° back: still facing 30');
  near(c.alt, 89.6, 1e-6, 'alt past'); nearAz(d.az, 210, 1e-3, 'a degree past: the camera looks over to 210'); near(d.alt, 89, 1e-6, 'alt 89');
});
ok('rolling the phone tilts the horizon: roll = clockwise turn, at the horizon and looking up', () => {
  for (const cw of [-60, -20, 5, 30, 75]) for (const up of [0, 35]) {
    const r = viaEvent(pose(200, up, cw)); near(r.roll, cw, 1e-5, `roll cw ${cw} up ${up}`); nearAz(r.az, 200, 1e-5, 'az'); near(r.alt, up, 1e-5, 'alt');
  }
});
ok('four screen orientations: the content frame cancels the phone turn', () => {
  // landscape with the phone turned anticlockwise (top edge left): window.orientation 90; clockwise: -90 / 270; upside down: 180
  for (const [turnCw, angle] of [[0, 0], [-90, 90], [90, -90], [90, 270], [180, 180]]) for (const h of [0, 90, 233]) for (const up of [0, 40]) {
    const r = viaEvent(pose(h, up, turnCw), angle);
    nearAz(r.az, h, 1e-5, `turn ${turnCw} angle ${angle} h ${h}`); near(r.alt, up, 1e-5, 'alt'); near(r.roll, 0, 1e-5, 'roll');
  }
  // and a landscape phone rolled a little more shows that extra roll
  near(viaEvent(pose(10, 0, -90 + 12), 90).roll, 12, 1e-5, 'landscape + 12° roll');
});
ok('yaw offset (declination / nudge) adds to the azimuth', () => {
  nearAz(viaEvent(pose(350), 0, 15).az, 5, 1e-6, '350 + 15 wraps to 5'); nearAz(viaEvent(pose(10), 0, -3.5).az, 6.5, 1e-6, '10 - 3.5');
});
ok('iOS: compass heading turns the arbitrary alpha frame into north (upright and flat), ambiguous poses rejected', () => {
  const yaw0 = 137.3;                                             // Safari's arbitrary start yaw
  const arb = (q) => O.qMul(O.qAxis(0, 0, 1, yaw0 * D), q, [0, 0, 0, 1]);
  for (const [h, up] of [[30, 0], [30, 25], [250, -30], [359, 10]]) {     // upright: heading = back camera
    const e = euler(arb(pose(h, up))); const off = O.compassYawOffset(e.alpha, e.beta, e.gamma, h);
    assert.ok(off !== null, `offset for h ${h} up ${up}`);
    const r = O.azAltRoll(O.screenQuat(e.alpha, e.beta, e.gamma, 0, off)); nearAz(r.az, h, 1e-5, 'corrected az'); near(r.alt, up, 1e-5, 'alt');
  }
  { const flat = O.qAxis(0, 0, 1, -200 * D); const e = euler(arb(flat));     // flat, top edge to 200°
    const off = O.compassYawOffset(e.alpha, e.beta, e.gamma, 200); assert.ok(off !== null);
    nearAz(O.azAltRoll(O.screenQuat(e.alpha, e.beta, e.gamma, 0, off)).az, 200, 1e-5, 'flat'); }
  { const e = euler(arb(pose(30, 70))); assert.equal(O.compassYawOffset(e.alpha, e.beta, e.gamma, 30), null, 'looking high up'); }
  { const e = euler(arb(pose(30, 0, 45))); assert.equal(O.compassYawOffset(e.alpha, e.beta, e.gamma, 30), null, 'rolled 45°'); }
  assert.equal(O.compassYawOffset(0, 90, 0, -1), null, 'accuracy -1 / no heading');
});
ok('smoother follows the 359° -> 1° wrap the short way and settles', () => {
  const sm = O.makeSmoother(); sm.reset(O.screenQuat(1, 90, 0, 0));     // facing az 359
  const target = O.screenQuat(359, 90, 0, 0);                            // facing az 1
  for (let i = 0; i < 60; i++) { sm.update(target, 1 / 60); const a = O.azAltRoll(sm.q).az; assert.ok(a > 358 || a < 2, `stays near north: ${a}`); }
  nearAz(O.azAltRoll(sm.q).az, 1, 0.01, 'settled');
});
ok('smoother: jitter is damped, a real turn is followed within ~0.15 s', () => {
  const sm = O.makeSmoother(); const base = O.screenQuat(0, 90, 0, 0); sm.reset(base);
  let worst = 0;
  for (let i = 0; i < 120; i++) { const j = (i % 2 ? 0.4 : -0.4); sm.update(O.screenQuat(j, 90, 0, 0), 1 / 60); worst = Math.max(worst, Math.abs(((O.azAltRoll(sm.q).az + 180) % 360) - 180)); }
  assert.ok(worst < 0.15, `±0.4° jitter leaks ${worst.toFixed(3)}°`);
  sm.reset(base); const turn = O.screenQuat(360 - 40, 90, 0, 0);
  for (let i = 0; i < 9; i++) sm.update(turn, 1 / 60);                 // 150 ms after a sudden 40° step: > 90 % there
  assert.ok(O.azAltRoll(sm.q).az > 36, `after 150 ms of a 40° step: ${O.azAltRoll(sm.q).az.toFixed(2)}°`);
  for (const w of [30, 60, 120]) {                                        // steady sweep at w °/s: lag stays near or under 120 ms
    sm.reset(base); let a = 0;
    for (let i = 0; i < 120; i++) { a += w / 60; sm.update(O.screenQuat(360 - a, 90, 0, 0), 1 / 60); }
    const lagMs = ((a - O.azAltRoll(sm.q).az + 540) % 360 - 180) / w * 1000;
    assert.ok(lagMs > 0 && lagMs < 125, `lag at ${w}°/s: ${lagMs.toFixed(0)} ms`); console.log(`   lag at ${w}°/s: ${lagMs.toFixed(0)} ms`);
  }
});
ok('camera field of view under object-fit: cover', () => {
  near(O.coverVerticalFov(67, 1440, 1920, 390, 844), 67, 1e-9, 'portrait video, portrait screen: full long side');
  near(O.coverVerticalFov(67, 1920, 1440, 390, 844), 2 * Math.atan(Math.tan(33.5 * D) * 0.75) / D, 1e-9, 'landscape-shaped video in portrait: the short side is vertical');
  const l = O.coverVerticalFov(67, 1920, 1440, 844, 390); assert.ok(l > 30 && l < 40, `landscape screen ${l}`);
  near(O.coverVerticalFov(67, 0, 0, 390, 844), 67, 0, 'no video yet');
});
ok('quatFromAzAltRoll / eulerFromQuat round-trip through the event path', () => {
  for (const [az, alt, roll] of [[0, 0, 0], [123, 40, -15], [301, -20, 50], [77, 85, 0]]) {
    const q = O.quatFromAzAltRoll(az, alt, roll); const e = O.eulerFromQuat(q), e2 = euler(q);
    near(e.alpha, e2.alpha, 1e-9, 'alpha'); near(e.beta, e2.beta, 1e-9, 'beta'); near(e.gamma, e2.gamma, 1e-9, 'gamma');
    const r = O.azAltRoll(O.screenQuat(e.alpha, e.beta, e.gamma, 0)); nearAz(r.az, az, 1e-6, 'az'); near(r.alt, alt, 1e-6, 'alt'); near(r.roll, roll, 1e-6, 'roll');
  }
});
console.log(`\n${n} tests passed`);
