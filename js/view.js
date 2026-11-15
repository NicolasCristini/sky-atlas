// Camera pose helpers shared by the main view and the mini globe.
import * as THREE from '../vendor/three.module.min.js';
import { DEG } from './astro.js';

const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Matrix4();

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Orientation looking along `forward` with `upRef` as the approximate up. */
export function basisQuat(forward, upRef, out) {
  _f.copy(forward).normalize();
  _r.crossVectors(_f, upRef);
  if (_r.lengthSq() < 1e-10) _r.set(1, 0, 0).cross(_f);
  _r.normalize();
  _u.crossVectors(_r, _f).normalize();
  _m.makeBasis(_r, _u, _f.negate());
  return out.setFromRotationMatrix(_m);
}

export const vecFromLatLon = (lat, lon, out) => {
  const la = lat * DEG, lo = lon * DEG, c = Math.cos(la);
  return out.set(c * Math.cos(lo), Math.sin(la), -c * Math.sin(lo));
};

const _fw = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
/** Orbit pose: camera at dist from origin, looking at the centre, north up. */
export function globePose(view, pos, quat) {
  vecFromLatLon(view.lat, view.lon, pos).multiplyScalar(view.dist);
  _fw.copy(pos).negate();
  basisQuat(_fw, _up, quat);
}

/** Surface pose: camera at the observer looking along world direction `dir`, zenith up. */
export function skyPose(U, dir, height, pos, quat) {
  pos.copy(U).multiplyScalar(1 + height);
  basisQuat(dir, U, quat);
}

/** Spherical interpolation between unit vectors (THREE.Vector3). */
const _ax = new THREE.Vector3();
export function slerpV3(a, b, t, out) {
  let d = clamp(a.dot(b), -1, 1);
  let ang = Math.acos(d);
  if (ang < 1e-6) return out.copy(a);
  if (Math.PI - ang < 1e-4) { _ax.set(0, 1, 0).cross(a); if (_ax.lengthSq() < 1e-6) _ax.set(1, 0, 0).cross(a); _ax.normalize(); return out.copy(a).applyAxisAngle(_ax, Math.PI * t); }
  const s = Math.sin(ang);
  const w0 = Math.sin((1 - t) * ang) / s, w1 = Math.sin(t * ang) / s;
  return out.set(a.x * w0 + b.x * w1, a.y * w0 + b.y * w1, a.z * w0 + b.z * w1);
}
