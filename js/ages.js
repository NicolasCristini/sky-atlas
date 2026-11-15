// Deep-time helpers (Ages mode). Pure: no DOM, no three.js.
import { DEG, angleBetween } from './astro.js';

/** Largest offset from today the scrubber reaches, in years (about 10 975 BC .. AD 15 025). */
export const AGES_MAX = 13000;
const LOG_A = 3.5;          // curvature of the scrubber: fine control near today, long strides towards the ends
export const SLIDER_MAX = 2000;

/** Scrubber position (-2000..2000) -> years from today. Symmetric-log so +-500 y and +-10 000 y are both easy to hit. */
export function sliderToYears(s) {
  const u = Math.min(1, Math.abs(s) / SLIDER_MAX), y = AGES_MAX * (Math.exp(LOG_A * u) - 1) / (Math.exp(LOG_A) - 1);
  return Math.sign(s) * y;
}
export function yearsToSlider(y) {
  const v = Math.min(1, Math.abs(y) / AGES_MAX), u = Math.log(1 + v * (Math.exp(LOG_A) - 1)) / LOG_A;
  return Math.sign(y) * u * SLIDER_MAX;
}

/** Decimal astronomical year (year 0 = 1 BC) of a UTC epoch in ms. */
export function decimalYear(ms) {
  const d = new Date(ms), y = d.getUTCFullYear();
  const a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1);
  return y + (ms - a) / (b - a);
}

const NNBSP = ' ';
const grouped = (n) => (n >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP) : String(n));   // four digits stay together: 2026, 2560 BC; AD 13 700
/** Astronomical year number E (year 0 = 1 BC) -> {num, era, text}: -2559 -> "2560 BC", 2026 -> "AD 2026", 13700 -> "AD 13 700". */
export function formatYear(E) {
  const y = Math.floor(E + 1e-6);          // the calendar year the date falls in (2026-11-15 is AD 2026)
  if (y <= 0) { const n = 1 - y; return { num: grouped(n), era: 'BC', text: `${grouped(n)} BC` }; }
  return { num: grouped(y), era: 'AD', text: `AD ${grouped(y)}` };
}

/** Moon and planets are shown within about 4000 years of 2000 and fade out over the next 1000. 1 = fully shown. */
export function bodiesFade(E) {
  const d = Math.abs(E - 2000);
  if (d <= 4000) return 1;
  if (d >= 5000) return 0;
  const t = (d - 4000) / 1000; return 1 - t * t * (3 - 2 * t);
}

/** Epoch chips. year = astronomical year number (1 BC = 0). `today` is resolved to the current year by the UI. */
export const EPOCHS = [
  { id: 'today', label: 'Today', year: null, pole: true, caption: 'Today: Polaris is the pole star, within a degree of the north celestial pole.' },
  { id: 'pyramids', label: '2560 BC', year: -2559, pole: true, caption: 'Pyramids, 2560 BC: Thuban was the pole star.' },
  { id: 'hipparchus', label: '130 BC', year: -129, pole: true, caption: 'Hipparchus, 130 BC: precession discovered, by comparing star positions across centuries.' },
  { id: 'cross', label: '3000 BC', year: -2999, cross: true, caption: '3000 BC: the Southern Cross stood clear above the Mediterranean horizon; precession has since carried it south.' },
  { id: 'vega', label: 'AD 13 700', year: 13700, pole: true, caption: 'AD 13 700: Vega is the pole star (the pole circles back to it in ~25 800 years).' },
];

/**
 * The pole star for a pole direction: among stars brighter than maxMag within maxSepDeg of the pole, the one with the best mix of
 * closeness and brightness (each magnitude of brightness is worth 2.2 deg), so Vega wins over a faint star that happens to sit nearer.
 * cur = n*3 unit vectors (current star directions), mag = magnitudes, pole = unit vector in the same frame.
 * Returns {index, sepDeg} or null ("no bright pole star").
 */
export function nearestPoleStar(cur, mag, n, pole, maxMag = 4.2, maxSepDeg = 7) {
  const cosMax = Math.cos(maxSepDeg * DEG); let best = -1, bs = 1e9, bsep = 0;
  for (let i = 0; i < n; i++) {
    if (mag[i] > maxMag) continue;
    const c = cur[i * 3] * pole[0] + cur[i * 3 + 1] * pole[1] + cur[i * 3 + 2] * pole[2];
    if (c < cosMax) continue;
    const sep = Math.acos(Math.min(1, c)) / DEG, score = sep - 2.2 * (maxMag - mag[i]);
    if (score < bs) { bs = score; best = i; bsep = sep; }
  }
  return best < 0 ? null : { index: best, sepDeg: bsep };
}
