// Pure astronomy / geometry maths. No three.js, no DOM: runs in node and in the browser.
//
// Conventions (shared with the renderer):
//   * World frame is Earth-fixed, unit Earth at the origin, north pole = +Y.
//   * latLonToVec(lat, lon) = (cos lat cos lon, sin lat, -cos lat sin lon).  Longitude 0 is +X, east is -Z.
//   * Celestial (equatorial) unit vector uses the same formula with (dec, ra), so a star with RA = GMST
//     lies over longitude 0.  The celestial frame is rotated about +Y by -GMST to reach the world frame.
//   * Local frame at an observer: U = up (the position vector), N = north tangent, E = N x U.
//   * Matrices are plain 3x3 row-major arrays of 9 numbers.

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const TAU = Math.PI * 2;

export const norm360 = (a) => ((a % 360) + 360) % 360;
export const norm180 = (a) => { a = norm360(a); return a > 180 ? a - 360 : a; };
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---------- time ----------
export const jdFromMs = (ms) => ms / 86400000 + 2440587.5;

/** Greenwich mean sidereal time in hours [0,24). */
export function gmstHours(jd) {
  const d = jd - 2451545.0;
  const T = d / 36525;
  const deg = 280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000;
  return norm360(deg) / 15;
}

/** Local solar time in hours [0,24) from a UTC epoch (ms) and east longitude (deg). */
export function localSolarHours(ms, lonDeg) {
  const dayMs = ((ms % 86400000) + 86400000) % 86400000;
  const h = dayMs / 3600000 + lonDeg / 15;
  return ((h % 24) + 24) % 24;
}

// ---------- vectors ----------
export function latLonToVec(latDeg, lonDeg, out = [0, 0, 0]) {
  const la = latDeg * DEG, lo = lonDeg * DEG, c = Math.cos(la);
  out[0] = c * Math.cos(lo); out[1] = Math.sin(la); out[2] = -c * Math.sin(lo);
  return out;
}
export function vecToLatLon(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return { lat: Math.asin(clamp(v[1] / l, -1, 1)) * RAD, lon: Math.atan2(-v[2], v[0]) * RAD };
}
/** Equatorial RA/Dec (deg) -> unit vector in the celestial frame (same layout as latLonToVec). */
export const eqToVec = (ra, dec, out) => latLonToVec(dec, ra, out);
export function vecToEq(v) {
  const l = vecToLatLon(v);
  return { ra: norm360(l.lon), dec: l.lat };
}
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b, o = [0, 0, 0]) => {
  const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
  o[0] = x; o[1] = y; o[2] = z; return o;
};
export function normalize(v, o = v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  o[0] = v[0] / l; o[1] = v[1] / l; o[2] = v[2] / l; return o;
}
export const angleBetween = (a, b) => {
  const c = cross(a, b);
  return Math.atan2(Math.hypot(c[0], c[1], c[2]), dot(a, b));
};

/** Local frame vectors at an observer. Well defined at the poles too. */
export function localBasis(latDeg, lonDeg, out) {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  const sl = Math.sin(la), cl = Math.cos(la), co = Math.cos(lo), so = Math.sin(lo);
  const U = [cl * co, sl, -cl * so];
  const N = [-sl * co, cl, sl * so];
  const E = cross(N, U);
  if (out) { out.U = U; out.N = N; out.E = E; return out; }
  return { U, N, E };
}

/** Local direction (az from north through east, alt) -> world vector, given a basis. */
export function dirFromAzAlt(azDeg, altDeg, b, o = [0, 0, 0]) {
  const az = azDeg * DEG, al = altDeg * DEG, ca = Math.cos(al);
  const n = ca * Math.cos(az), e = ca * Math.sin(az), u = Math.sin(al);
  o[0] = b.N[0] * n + b.E[0] * e + b.U[0] * u;
  o[1] = b.N[1] * n + b.E[1] * e + b.U[1] * u;
  o[2] = b.N[2] * n + b.E[2] * e + b.U[2] * u;
  return o;
}
export function azAltFromDir(d, b) {
  const n = dot(d, b.N), e = dot(d, b.E), u = dot(d, b.U);
  return { az: norm360(Math.atan2(e, n) * RAD), alt: Math.atan2(u, Math.hypot(n, e)) * RAD };
}

// ---------- precession (J2000 -> date) ----------
export function precessionMatrix(jd) {
  const T = (jd - 2451545.0) / 36525, as = DEG / 3600;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * as;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * as;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * as;
  const cz = Math.cos(zeta), sz = Math.sin(zeta), cZ = Math.cos(z), sZ = Math.sin(z), ct = Math.cos(th), st = Math.sin(th);
  return [
    cz * ct * cZ - sz * sZ, -sz * ct * cZ - cz * sZ, -st * cZ,
    cz * ct * sZ + sz * cZ, -sz * ct * sZ + cz * cZ, -st * sZ,
    cz * st, -sz * st, ct,
  ];
}
// Equatorial axes used by astronomy-engine / textbooks: x = vernal equinox, y = RA 90, z = north.
// Our celestial axes: X = x, Y = z, Z = -y.
const mul3 = (A, B) => {
  const C = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
  return C;
};
/** Re-express a matrix given in the textbook axes (x equinox, y RA 90, z north) in ours: M = S P S^T, S = [[1,0,0],[0,0,1],[0,-1,0]]. */
export function toMineAxes(P) {
  const S = [1, 0, 0, 0, 0, 1, 0, -1, 0], St = [S[0], S[3], S[6], S[1], S[4], S[7], S[2], S[5], S[8]];
  return mul3(mul3(S, P), St);
}
export function precessionMatrixMine(jd) { return toMineAxes(precessionMatrix(jd)); }

// ---------- long-term precession (Ages mode) ----------
// A Fukushima-Williams style construction P = R1(-eps) R3(-psi) R1(phi) R3(gamma) (IAU 2006 form) whose angles are the
// IAU 2006 polynomials truncated at T^2 (their T^3..T^5 terms are fitted for a few centuries and blow up over millennia),
// except the obliquity, which uses Laskar's 1986 series (valid to about +-10 000 years, as given by Meeus, Astronomical
// Algorithms ch. 22) so it stays sensible out to the ends of the Ages scrubber. Agrees with astronomy-engine to a few
// arcseconds over +-2000 years (see tests); beyond that it is an approximation (no table-based long-term model).
const AS = DEG / 3600;
const R1 = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, s, 0, -s, c]; };
const R3 = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, -s, c, 0, 0, 0, 1]; };
/** Mean obliquity of the ecliptic of date in arcseconds, T in Julian centuries from J2000 (Laskar), |T| clamped to 160 centuries. */
export function obliquityLaskar(T) {
  const U = clamp(T / 100, -1.6, 1.6);
  return 84381.448 + U * (-4680.93 + U * (-1.55 + U * (1999.25 + U * (-51.38 + U * (-249.67 + U * (-39.05 + U * (7.12 + U * (27.87 + U * (5.79 + U * 2.45)))))))));
}
export const obliquityDeg = (T) => obliquityLaskar(T) / 3600;
/** General precession in longitude p_A (IAU 2006, quadratic part), arcseconds. */
export const generalPrecessionArcsec = (T) => 5028.796195 * T + 1.1054348 * T * T;
export function precessionMatrixLong(jd) {
  const T = (jd - 2451545.0) / 36525;
  const gam = (10.556378 * T + 0.4932044 * T * T) * AS;
  const phi = (84381.412819 - 46.811016 * T + 0.0511268 * T * T) * AS;
  const psi = (5038.481484 * T + 1.5584175 * T * T) * AS;
  const eps = (84381.412819 + (obliquityLaskar(T) - 84381.448)) * AS;
  return mul3(R1(-eps), mul3(R3(-psi), mul3(R1(phi), R3(gam))));
}
export const precessionMatrixLongMine = (jd) => toMineAxes(precessionMatrixLong(jd));
/** Direction of the celestial pole of date, as a J2000 unit vector in our axes (second row of a "Mine" matrix). */
export const poleOfDate = (M) => [M[3], M[4], M[5]];
/** Apply a 3x3 row-major matrix. */
export const applyMat = (M, v, o = [0, 0, 0]) => {
  const x = M[0] * v[0] + M[1] * v[1] + M[2] * v[2], y = M[3] * v[0] + M[4] * v[1] + M[5] * v[2], z = M[6] * v[0] + M[7] * v[1] + M[8] * v[2];
  o[0] = x; o[1] = y; o[2] = z; return o;
};
export const transposeMat = (M) => [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];
export const mulMat = mul3;

// ---------- proper motion ----------
/** J2000 position (ra, dec in degrees) moved by proper motion (mas/yr; pmra includes cos dec) over dtYears: unit vector in our axes. */
export function movedStar(raDeg, decDeg, pmraMas, pmdecMas, dtYears, o = [0, 0, 0]) {
  const a = raDeg * DEG, d = decDeg * DEG, sa = Math.sin(a), ca = Math.cos(a), sd = Math.sin(d), cd = Math.cos(d);
  const k = dtYears * 1e-3 * AS;
  const x = cd * ca + k * (pmraMas * -sa + pmdecMas * -sd * ca);
  const y = sd + k * (pmdecMas * cd);
  const z = -cd * sa + k * (pmraMas * -ca + pmdecMas * sd * sa);
  const l = Math.hypot(x, y, z); o[0] = x / l; o[1] = y / l; o[2] = z / l; return o;
}
const applyM = (M, v, o = [0, 0, 0]) => {
  const x = M[0] * v[0] + M[1] * v[1] + M[2] * v[2], y = M[3] * v[0] + M[4] * v[1] + M[5] * v[2], z = M[6] * v[0] + M[7] * v[1] + M[8] * v[2];
  o[0] = x; o[1] = y; o[2] = z; return o;
};

/** Rotate a celestial (J2000) unit vector into the Earth-fixed world frame for a given jd. */
export function celestialToWorld(v, jd, o = [0, 0, 0]) {
  const M = precessionMatrixMine(jd);
  applyM(M, v, o);
  const th = -gmstHours(jd) * 15 * DEG, c = Math.cos(th), s = Math.sin(th);
  // rotation about +Y by th: x' = x c + z s ; z' = -x s + z c
  const x = o[0] * c + o[2] * s, z = -o[0] * s + o[2] * c;
  o[0] = x; o[2] = z; return o;
}

/** Altitude/azimuth (deg) of a J2000 RA/Dec (deg) for an observer at lat/lon (deg) at time jd. */
export function eqToAltAz(raDeg, decDeg, latDeg, lonDeg, jd) {
  const v = celestialToWorld(eqToVec(raDeg, decDeg), jd);
  const b = localBasis(latDeg, lonDeg);
  return azAltFromDir(v, b);
}

// ---------- visibility ----------
/**
 * Classify a declination for an observer at latitude (deg), ignoring refraction.
 * circumpolar: never sets; risesSets; never: never rises.
 * maxAlt = altitude at upper culmination, minAlt = at lower culmination.
 */
export function classifyVisibility(decDeg, latDeg) {
  const maxAlt = 90 - Math.abs(latDeg - decDeg);
  // lower culmination altitude: dec + lat - 90 (north), -dec - lat - 90 (south)
  const lower = latDeg >= 0 ? decDeg + latDeg - 90 : -decDeg - latDeg - 90;
  let kind;
  if (maxAlt <= 0) kind = 'never';
  else if (lower > 0) kind = 'circumpolar';
  else kind = 'risesSets';
  return { kind, maxAlt, minAlt: lower };
}

/** Fraction of the celestial sphere that ever rises above the horizon at this latitude. */
export const visibleFraction = (latDeg) => (1 + Math.cos(latDeg * DEG)) / 2;

/** Altitude of the elevated celestial pole above the horizon = |latitude|. */
export const poleAltitude = (latDeg) => Math.abs(latDeg);

// ---------- great circles ----------
export function rotateAbout(v, axis, ang, o = [0, 0, 0]) {
  // Rodrigues
  const c = Math.cos(ang), s = Math.sin(ang), d = dot(axis, v);
  const cx = cross(axis, v);
  o[0] = v[0] * c + cx[0] * s + axis[0] * d * (1 - c);
  o[1] = v[1] * c + cx[1] * s + axis[1] * d * (1 - c);
  o[2] = v[2] * c + cx[2] * s + axis[2] * d * (1 - c);
  return o;
}

/** Great circle from unit vector a to b. at(t) returns the point, rotate(v, t) transports any vector. */
export function greatCircle(a, b) {
  a = normalize([...a]); b = normalize([...b]);
  const angle = angleBetween(a, b);
  let axis = cross(a, b);
  const l = Math.hypot(axis[0], axis[1], axis[2]);
  if (l < 1e-9) {
    // identical or antipodal: pick any axis perpendicular to a
    axis = Math.abs(a[1]) < 0.9 ? cross(a, [0, 1, 0]) : cross(a, [1, 0, 0]);
  }
  normalize(axis);
  return {
    a, b, angle, axis,
    at(t, o = [0, 0, 0]) { return rotateAbout(a, axis, angle * t, o); },
    rotate(v, t, o = [0, 0, 0]) { return rotateAbout(v, axis, angle * t, o); },
  };
}

/** Great-circle distance in km between two lat/lon points (deg). */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const a = latLonToVec(lat1, lon1), b = latLonToVec(lat2, lon2);
  return angleBetween(a, b) * 6371;
}

/** Convert B-V colour index to effective temperature (K) (Ballesteros 2012). */
export const bvToTemp = (bv) => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));

export function spectralClass(bv) {
  if (bv < -0.2) return { cls: 'O/B', text: 'blue', };
  if (bv < 0.0) return { cls: 'B', text: 'blue-white' };
  if (bv < 0.3) return { cls: 'A', text: 'white' };
  if (bv < 0.58) return { cls: 'F', text: 'yellow-white' };
  if (bv < 0.81) return { cls: 'G', text: 'yellow' };
  if (bv < 1.4) return { cls: 'K', text: 'orange' };
  return { cls: 'M', text: 'red' };
}

/** Plain-words note on apparent magnitude. */
export function magnitudeNote(m) {
  if (m < -1) return 'Dazzling: among the very brightest objects in the sky';
  if (m < 0.5) return 'Brilliant: one of the brightest stars, obvious even from a city';
  if (m < 1.5) return 'Very bright: easy to spot from a city';
  if (m < 2.5) return 'Bright: clearly visible, helps trace constellations';
  if (m < 3.5) return 'Moderately bright: easy under a suburban sky';
  if (m < 4.5) return 'Fainter: needs a reasonably dark sky';
  if (m < 5.5) return 'Faint: dark-sky star';
  return 'Very faint: at the limit of naked-eye vision';
}

/** Re-derive an equatorial direction (our axes) for another obliquity: ecliptic longitude/latitude stay, the tilt of the equator changes. */
export function retiltObliquity(v, eps0, eps1, o = [0, 0, 0]) {
  const x = v[0], y = -v[2], z = v[1];                 // our axes -> textbook (x equinox, y RA 90, z north)
  const c0 = Math.cos(eps0), s0 = Math.sin(eps0), c1 = Math.cos(eps1), s1 = Math.sin(eps1);
  const ye = y * c0 + z * s0, ze = -y * s0 + z * c0;   // ecliptic frame
  const y2 = ye * c1 - ze * s1, z2 = ye * s1 + ze * c1;
  o[0] = x; o[1] = z2; o[2] = -y2; return o;
}
