// Sky quality (light pollution) model. Pure maths: a slider position q in [0, 4] with five named stops drives the
// limiting magnitude, star gain, Milky Way visibility and sky-glow strength continuously.

export const QUALITY_STOPS = [
  { name: 'Big city', short: 'City', limit: 3.0, gain: 1.4, mw: 0.0, pol: 1.0 },
  { name: 'Suburb', short: 'Suburb', limit: 4.5, gain: 1.4, mw: 0.04, pol: 0.55 },
  { name: 'Countryside', short: 'Country', limit: 5.5, gain: 1.4, mw: 0.55, pol: 0.16 },
  { name: 'Dark site', short: 'Dark', limit: 6.5, gain: 1.4, mw: 1.0, pol: 0.0 },
  { name: 'Enhanced', short: 'Enhanced', limit: 9.0, gain: 2.3, mw: 1.8, pol: 0.0 },
];
export const QUALITY_DEFAULT = 3;
export const EXPOSURE_DEFAULT = 1;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** Interpolated sky parameters for slider position q (0..4). */
export function qualityParams(q) {
  q = clamp(+q || 0, 0, 4);
  const i = Math.min(3, Math.floor(q)), t = q - i, a = QUALITY_STOPS[i], b = QUALITY_STOPS[i + 1];
  const stop = QUALITY_STOPS[Math.round(q)];
  return {
    q, name: stop.name, enhanced: q > 3.5,
    limit: lerp(a.limit, b.limit, t), gain: lerp(a.gain, b.gain, t), mw: lerp(a.mw, b.mw, t), pol: lerp(a.pol, b.pol, t),
  };
}

/** Number of catalogue stars with magnitude <= limit above the horizon. up = observer zenith in the stars' frame (unit); eq = n*3 unit vectors. */
export function countVisible(eq, mag, n, up, limit) {
  let c = 0;
  for (let i = 0; i < n; i++) if (mag[i] <= limit && eq[i * 3] * up[0] + eq[i * 3 + 1] * up[1] + eq[i * 3 + 2] * up[2] > 0) c++;
  return c;
}

/** "about 2 480" style rounding for the live star count. */
export function aboutCount(n) {
  const r = n < 100 ? Math.round(n / 5) * 5 : n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 50) * 50;
  return r.toLocaleString('en').replace(/,/g, ' ');
}

/** Exposure slider (0..1) <-> 0.5x..3x, logarithmic so 1x sits near the middle-left. */
export const exposureFromSlider = (t) => 0.5 * Math.pow(6, clamp(t, 0, 1));
export const sliderFromExposure = (e) => Math.log(clamp(e, 0.5, 3) / 0.5) / Math.log(6);
