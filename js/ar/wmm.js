// World Magnetic Model (WMM2025) evaluator.
// Source: NOAA NCEI / BGS WMM2025 coefficients and Technical Report algorithm. Public domain.
// Computes the geomagnetic field (declination, inclination, H, X, Y, Z, F) at a place, altitude and date.
// Pure ES module: no DOM, no dependencies; runs in the browser and in node.

const A = 6378.137, F_FLAT = 1 / 298.257223563, E2 = F_FLAT * (2 - F_FLAT), RE = 6371.2; // km
const RAD = Math.PI / 180;

/** Decimal year (UTC) from a JS timestamp in ms. */
export function decimalYear(ms) {
  const d = new Date(ms), y = d.getUTCFullYear();
  const t0 = Date.UTC(y, 0, 1), t1 = Date.UTC(y + 1, 0, 1);
  return y + (ms - t0) / (t1 - t0);
}

/** True when decYear lies inside the model's published validity window. */
export function inValidRange(model, decYear) {
  return decYear >= model.validFrom && decYear <= model.validTo;
}

/** Fetch the model JSON. Returns null on any failure. */
export async function loadWMM(url = 'data/wmm2025.json') {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const m = await r.json();
    return m && Array.isArray(m.coef) ? m : null;
  } catch (e) { return null; }
}

/**
 * Field at geodetic lat/lon (deg), altitude above the WGS84 ellipsoid (km), decimal year.
 * Returns { dec, inc, H, X, Y, Z, F }: angles in degrees (dec east positive), components in nT
 * (X north, Y east, Z down). Outside validFrom..validTo it extrapolates.
 */
export function wmmField(model, latDeg, lonDeg, altKm, decYear) {
  const N = 12, dt = decYear - model.epoch;
  const g = [], h = [];
  for (let n = 0; n <= N; n++) { g.push(new Array(N + 1).fill(0)); h.push(new Array(N + 1).fill(0)); }
  for (const [n, m, gv, hv, gd, hd] of model.coef) { g[n][m] = gv + dt * gd; h[n][m] = hv + dt * hd; }

  // Geodetic -> geocentric spherical (WGS84). Nudge off the exact poles so 1/sin(theta) stays finite.
  const lat = Math.max(-90 + 1e-5, Math.min(90 - 1e-5, latDeg)) * RAD, lon = lonDeg * RAD;
  const sl = Math.sin(lat), cl = Math.cos(lat);
  const Rc = A / Math.sqrt(1 - E2 * sl * sl);
  const p = (Rc + altKm) * cl, z = (Rc * (1 - E2) + altKm) * sl;
  const r = Math.hypot(p, z), latc = Math.asin(z / r);
  const th = Math.PI / 2 - latc, ct = Math.cos(th), st = Math.sin(th); // colatitude

  // Schmidt semi-normalised associated Legendre functions P[n][m](cos th) and dP/dth.
  const P = [], dP = [];
  for (let n = 0; n <= N; n++) { P.push(new Array(N + 1).fill(0)); dP.push(new Array(N + 1).fill(0)); }
  P[0][0] = 1;
  for (let n = 1; n <= N; n++) {
    for (let m = 0; m <= n; m++) {
      if (n === m) {
        const k = n === 1 ? 1 : Math.sqrt(1 - 1 / (2 * n));
        P[n][n] = k * st * P[n - 1][n - 1];
        dP[n][n] = k * (st * dP[n - 1][n - 1] + ct * P[n - 1][n - 1]);
      } else {
        const d = Math.sqrt(n * n - m * m), K = n === 1 ? 0 : Math.sqrt((n - 1) * (n - 1) - m * m);
        const p2 = n >= 2 ? P[n - 2][m] : 0, dp2 = n >= 2 ? dP[n - 2][m] : 0;
        P[n][m] = ((2 * n - 1) * ct * P[n - 1][m] - K * p2) / d;
        dP[n][m] = ((2 * n - 1) * (ct * dP[n - 1][m] - st * P[n - 1][m]) - K * dp2) / d;
      }
    }
  }

  // Sum the spherical-harmonic series -> field in the geocentric frame (north, east, down).
  let Xs = 0, Ys = 0, Zs = 0;
  for (let n = 1; n <= N; n++) {
    const ar = Math.pow(RE / r, n + 2);
    for (let m = 0; m <= n; m++) {
      const c = Math.cos(m * lon), s = Math.sin(m * lon);
      const gc = g[n][m] * c + h[n][m] * s;
      Xs += ar * gc * dP[n][m];
      Ys += ar * m * (g[n][m] * s - h[n][m] * c) * P[n][m] / st;
      Zs -= ar * (n + 1) * gc * P[n][m];
    }
  }

  // Rotate from geocentric to geodetic frame.
  const psi = latc - lat, X = Xs * Math.cos(psi) - Zs * Math.sin(psi), Z = Xs * Math.sin(psi) + Zs * Math.cos(psi), Y = Ys;
  const H = Math.hypot(X, Y);
  return { dec: Math.atan2(Y, X) / RAD, inc: Math.atan2(Z, H) / RAD, H, X, Y, Z, F: Math.hypot(H, Z) };
}

/** Magnetic declination in degrees, east positive. */
export function declination(model, latDeg, lonDeg, decYear, altKm = 0) {
  return wmmField(model, latDeg, lonDeg, altKm, decYear).dec;
}
