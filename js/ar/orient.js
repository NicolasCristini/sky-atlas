// Device orientation -> sky camera. Pure maths (no DOM, no three.js), shared by the AR mode and tests/ar.test.mjs.
//
// Frames
//   device  : W3C DeviceOrientation device frame. x = right edge of the phone, y = top edge, z = out of the screen (towards the viewer).
//   screen  : the device frame turned about z so that x/y follow the displayed content (portrait, landscape, upside down).
//   ENU     : the observer's local frame. x = East, y = North, z = Up. Quaternions here map screen/device vectors into ENU.
//   camera  : looks along -z of the screen frame, with screen +y as its up (the back camera looks where the camera looks).
// Angles
//   alpha, beta, gamma : W3C intrinsic Z-X'-Y'' angles, R = Rz(alpha) Rx(beta) Ry(gamma). alpha is measured from north only for
//                        absolute events (Android deviceorientationabsolute); on iOS it is relative to an arbitrary start yaw and
//                        webkitCompassHeading supplies magnetic north (see compassYawOffset).
//   az  : azimuth, degrees clockwise from north through east (0..360), as in js/astro.js.
//   alt : altitude above the horizon, degrees.
//   roll: rotation of the phone about the view axis, degrees, positive when the phone is turned clockwise as seen by the user
//         (the horizon then appears tilted anticlockwise on the screen). 0 = horizon level.
// Quaternions are plain arrays [x, y, z, w].

export const DEG = Math.PI / 180, RAD = 180 / Math.PI;
const norm360 = (a) => ((a % 360) + 360) % 360;

export function qAxis(ax, ay, az, angRad, o = [0, 0, 0, 1]) {
  const h = angRad / 2, s = Math.sin(h);
  o[0] = ax * s; o[1] = ay * s; o[2] = az * s; o[3] = Math.cos(h); return o;
}
/** a ⊗ b (apply b first, then a). */
export function qMul(a, b, o = [0, 0, 0, 1]) {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
  o[0] = aw * bx + ax * bw + ay * bz - az * by;
  o[1] = aw * by - ax * bz + ay * bw + az * bx;
  o[2] = aw * bz + ax * by - ay * bx + az * bw;
  o[3] = aw * bw - ax * bx - ay * by - az * bz;
  return o;
}
export function qNormalize(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l; return q; }
export function qRotate(q, v, o = [0, 0, 0]) {
  const x = v[0], y = v[1], z = v[2], qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
  o[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  o[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
  o[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
  return o;
}
/** Angle between two orientations, radians (0..pi). */
export function qAngle(a, b) { const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return 2 * Math.acos(Math.min(1, d)); }
/** Shortest-path spherical interpolation (handles the q / -q double cover, so 359° -> 0° never spins the long way). */
export function qSlerp(a, b, t, o = [0, 0, 0, 1]) {
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let c = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (c < 0) { c = -c; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let k0, k1;
  if (c > 0.9995) { k0 = 1 - t; k1 = t; }
  else { const th = Math.acos(c), s = Math.sin(th); k0 = Math.sin((1 - t) * th) / s; k1 = Math.sin(t * th) / s; }
  o[0] = a[0] * k0 + bx * k1; o[1] = a[1] * k0 + by * k1; o[2] = a[2] * k0 + bz * k1; o[3] = a[3] * k0 + bw * k1;
  return qNormalize(o);
}

const _qa = [0, 0, 0, 1], _qb = [0, 0, 0, 1], _qc = [0, 0, 0, 1];
/** Device -> ENU (yaw origin = whatever alpha is relative to) from the W3C angles, degrees. */
export function quatFromEuler(alpha, beta, gamma, o = [0, 0, 0, 1]) {
  qAxis(0, 0, 1, (alpha || 0) * DEG, _qa); qAxis(1, 0, 0, (beta || 0) * DEG, _qb); qAxis(0, 1, 0, (gamma || 0) * DEG, _qc);
  return qNormalize(qMul(qMul(_qa, _qb, o), _qc, o));
}

/**
 * Screen -> ENU orientation of the phone.
 * screenAngle: the angle the content is rotated by, degrees (window.orientation / screen.orientation.angle: 0 portrait,
 *              90 landscape with the phone turned anticlockwise, 180 upside down, 270 or -90 landscape turned clockwise).
 * yawDeg: added to every azimuth (magnetic north offset on iOS, declination, the user's manual nudge), degrees clockwise.
 */
export function screenQuat(alpha, beta, gamma, screenAngle = 0, yawDeg = 0, o = [0, 0, 0, 1]) {
  const qd = quatFromEuler(alpha, beta, gamma, [0, 0, 0, 1]);
  qMul(qd, qAxis(0, 0, 1, -(screenAngle || 0) * DEG, _qa), o);       // content frame: rotate about the screen normal
  qMul(qAxis(0, 0, 1, -(yawDeg || 0) * DEG, _qb), o, o);              // azimuth grows clockwise = negative turn about Up
  return qNormalize(o);
}

const _d = [0, 0, 0], _u = [0, 0, 0], _r = [0, 0, 0];
/** Camera view direction and up vector in ENU. */
export function cameraVectors(q, dir = [0, 0, 0], up = [0, 0, 0]) {
  qRotate(q, [0, 0, -1], dir); qRotate(q, [0, 1, 0], up); return { dir, up };
}

/** Azimuth, altitude and roll of the camera, degrees. Well defined at the zenith and nadir (azimuth then follows the phone's top edge). */
export function azAltRoll(q) {
  qRotate(q, [0, 0, -1], _d); qRotate(q, [0, 1, 0], _u);
  const alt = Math.asin(Math.max(-1, Math.min(1, _d[2]))) * RAD;
  const hz = Math.hypot(_d[0], _d[1]);
  if (hz < 0.01) {                                  // straight up or down: the facing direction is where the phone's bottom (up) or top (down) points
    const s = _d[2] > 0 ? -1 : 1;
    return { az: norm360(Math.atan2(s * _u[0], s * _u[1]) * RAD), alt, roll: 0 };
  }
  const az = norm360(Math.atan2(_d[0], _d[1]) * RAD);
  // level frame around the view direction: right = dir x Up, levelUp = right x dir
  _r[0] = _d[1]; _r[1] = -_d[0]; _r[2] = 0;                                // dir x (0,0,1)
  const rl = Math.hypot(_r[0], _r[1]); _r[0] /= rl; _r[1] /= rl;
  const lu = [_r[1] * _d[2] - _r[2] * _d[1], _r[2] * _d[0] - _r[0] * _d[2], _r[0] * _d[1] - _r[1] * _d[0]];
  const roll = Math.atan2(_u[0] * _r[0] + _u[1] * _r[1] + _u[2] * _r[2], _u[0] * lu[0] + _u[1] * lu[1] + _u[2] * lu[2]) * RAD;
  return { az, alt, roll };
}

/**
 * iOS: yaw offset (degrees) that turns Safari's arbitrary-yaw alpha frame into magnetic north, from webkitCompassHeading.
 * CoreLocation reports the heading of the phone's top edge (portrait reference); held upright, that edge points at the sky and the
 * heading follows the back camera instead. Both readings agree whenever the phone is not rolled sideways, so a sample is used only
 * when it is unambiguous: phone roughly flat (camera pointing down: top-edge heading) or roughly upright (camera within 40° of the
 * horizon: camera heading), with its right edge close to level. Returns null for ambiguous poses (keep the last offset).
 */
export function compassYawOffset(alpha, beta, gamma, heading) {
  if (!Number.isFinite(heading) || heading < 0) return null;
  const q = quatFromEuler(alpha, beta, gamma, [0, 0, 0, 1]);          // fresh output: quatFromEuler uses the module scratch quaternions
  const cam = qRotate(q, [0, 0, -1], [0, 0, 0]), top = qRotate(q, [0, 1, 0], [0, 0, 0]), right = qRotate(q, [1, 0, 0], [0, 0, 0]);
  if (Math.abs(right[2]) > 0.5) return null;                           // rolled more than 30°: top edge and camera headings disagree
  let v;
  if (cam[2] < -0.766) v = top;                                       // flat, screen up (camera > 50° below the horizon)
  else if (Math.abs(cam[2]) < 0.643) v = cam;                         // upright-ish (camera within 40° of the horizon)
  else return null;                                                    // looking high up or lying screen-down: ambiguous
  if (Math.hypot(v[0], v[1]) < 0.2) return null;
  const arb = Math.atan2(v[0], v[1]) * RAD;                            // heading of that edge in the alpha frame
  return norm360(heading - arb);
}

/** Circular low-pass for an angle in degrees (wrap-safe). k in 0..1 is the weight of the new sample. */
export function blendAngle(prev, next, k) {
  if (prev === null || prev === undefined || !Number.isFinite(prev)) return norm360(next);
  const d = ((next - prev + 540) % 360) - 180;
  return norm360(prev + d * k);
}

/**
 * Orientation smoother: a first-order low-pass on the rotation group whose time constant shrinks for fast turns, so sensor jitter
 * (under a degree) is averaged over ~140 ms while a real turn is followed with ~35 ms of lag. Shortest-path slerp, so no wrap jumps.
 */
export function makeSmoother({ tauSlow = 0.14, tauFast = 0.035, small = 1, large = 10 } = {}) {
  const cur = [0, 0, 0, 1]; let has = false;
  return {
    get q() { return cur; },
    reset(q) { if (q) { cur[0] = q[0]; cur[1] = q[1]; cur[2] = q[2]; cur[3] = q[3]; has = true; } else has = false; },
    update(target, dt) {
      if (!has) { this.reset(target); return cur; }
      const ang = qAngle(cur, target) * RAD;
      const s = Math.max(0, Math.min(1, (ang - small) / (large - small))), e = s * s * (3 - 2 * s);
      const tau = tauSlow + (tauFast - tauSlow) * e;
      const k = 1 - Math.exp(-Math.max(0, dt) / tau);
      qSlerp(cur, target, k, cur);
      return cur;
    },
  };
}

/**
 * Vertical field of view (degrees) of a camera stream shown full-screen with object-fit: cover.
 * longFovDeg: field of view across the sensor's long side (iPhone main camera about 66-70°). vw, vh: video size; W, H: viewport.
 */
export function coverVerticalFov(longFovDeg, vw, vh, W, H) {
  if (!(vw > 0 && vh > 0 && W > 0 && H > 0)) return longFovDeg;
  const f = (Math.max(vw, vh) / 2) / Math.tan(longFovDeg * DEG / 2);   // focal length in video pixels
  const s = Math.max(W / vw, H / vh);                                    // cover scale
  return 2 * Math.atan((H / s / 2) / f) * RAD;
}

/** Camera orientation (screen -> ENU) looking at az/alt with the given roll, degrees. Inverse of azAltRoll away from the zenith. */
export function quatFromAzAltRoll(az, alt, roll = 0, o = [0, 0, 0, 1]) {
  qAxis(0, 0, 1, -az * DEG, o);                                       // face the azimuth
  qMul(o, qAxis(1, 0, 0, (90 + alt) * DEG, _qa), o);                 // stand up (camera to the horizon), tilt up by alt
  qMul(o, qAxis(0, 0, 1, -roll * DEG, _qb), o);                      // clockwise about the screen normal
  return qNormalize(o);
}

/** W3C alpha/beta/gamma (degrees) of a device -> ENU quaternion, with the same branch logic WebKit uses on iOS. For synthetic events. */
export function eulerFromQuat(q) {
  const [x, y, z, w] = q;
  const R = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)].map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
  let zr, xr, yr;
  if (R[8] > 0) { zr = Math.atan2(-R[1], R[4]); xr = Math.asin(R[7]); yr = Math.atan2(-R[6], R[8]); }
  else if (R[8] < 0) { zr = Math.atan2(R[1], -R[4]); xr = -Math.asin(R[7]); xr += xr >= 0 ? -Math.PI : Math.PI; yr = Math.atan2(R[6], -R[8]); }
  else if (R[6] > 0) { zr = Math.atan2(-R[1], R[4]); xr = Math.asin(R[7]); yr = -Math.PI / 2; }
  else if (R[6] < 0) { zr = Math.atan2(R[1], -R[4]); xr = -Math.asin(R[7]); xr += xr >= 0 ? -Math.PI : Math.PI; yr = -Math.PI / 2; }
  else { zr = Math.atan2(R[3], R[0]); xr = R[7] > 0 ? Math.PI / 2 : -Math.PI / 2; yr = 0; }
  return { alpha: norm360(zr * RAD), beta: xr * RAD, gamma: yr * RAD };
}
