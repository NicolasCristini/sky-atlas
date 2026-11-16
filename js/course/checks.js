// Try-step checkers: a small declarative API. A lesson says WHAT counts as success; the player polls it and owns all the UI.
//
//   try: facing({ az: 0, tol: 20, altMax: 40 })
//   try: selected(HIP.polaris)                  // a star's HIP number, or (sel, X) => boolean
//   try: timeAdvanced({ hours: 2, tol: 0.1 })   // shows the +-1 h control in the card
//   try: objectAltitude(HIP.dubhe, { min: 30 }) // a HIP number, or a body id such as 'Moon'
//   try: latitudeBetween(-35, -30)              // shows the latitude slider
//   try: choice({ options: (X) => [{ id, label }], correct: (X) => id })
//   try: sequence([selected(...), facing(...)]) // stages, each with its own prompt (try.prompt, try.prompt2 ...)
//   try: custom((X) => boolean, { show, controls, keys })
//   try: (X) => any of the above                // when the checker depends on the live sky (hemisphere ...)
//
// A checker is { kind, controls, test(X), show?(X), keys?(X), options?(X) , answer?(X, id) }.
//   test(X)  -> true | false | { wrong: true, vars: { name: 'Vega' } }   (wrong shows try.wrong with the vars filled in)
//   show(X)  -> async, runs in the demo runner ("Show me how"); it should leave the sky in the solved state
//   controls -> null | 'hours' (a -1 h / +1 h pair) | 'scrub' (a time slider, +-12 h) | 'lat' (a latitude slider)
//               | 'year' (a slider through the year, +-183 days; the lesson puts the sky in Year mode: X.yearAt(hour))
//               | 'days' (Earlier dawn / Next dawn buttons; the lesson may define stepDays(X, d) to keep the same moment of dawn)
//   keys(X)  -> { prompt, hint, success } text keys; defaults try.prompt / try.hint / try.success
// X is the lesson context built by learn.js (see js/course/README.md). Checkers never touch the DOM.
import * as G from './geo.js';

const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const val = (v, X) => (typeof v === 'function' ? v(X) : v);

export function facing(o) {
  return {
    kind: 'facing', controls: null,
    test(X) {
      const s = X.S.sky, az = val(o.az, X), tol = o.tol ?? 20;
      return angDiff(s.az, az) <= tol && s.alt >= (o.altMin ?? -10) && s.alt <= (o.altMax ?? 90) && X.S.mode === 'sky';
    },
    async show(X) {
      const az = val(o.az, X), lo = o.altMin ?? -10, hi = o.altMax ?? 90;
      X.D.slew(az, Math.min(hi - 3, Math.max(lo + 3, o.showAlt ?? (lo + hi) / 2)), o.fov ?? 85, 1.6);
      await X.D.wait(1900);
    },
  };
}

export function selected(target) {
  const hip = typeof target === 'number' ? target : null;
  const isIt = (X) => { const sel = X.S.sel; if (!sel) return false; if (hip !== null) return sel.type === 'star' && X.data.stars.hip[sel.index] === hip; return !!target(sel, X); };
  return {
    kind: 'selected', controls: null,
    test(X) {
      if (isIt(X)) return true;
      const sel = X.S.sel;
      if (sel && sel.type === 'star' && !X.justShown) return { wrong: true, vars: { name: X.data.starInfo(sel.index).title } };
      return false;
    },
    async show(X) {
      if (hip === null) return;
      const i = X.data.hipIndex.get(hip); if (i === undefined) return;
      const aa = X.hip(hip);
      X.D.slew(aa.az, Math.max(aa.alt, 8), 70, 1.4); await X.D.wait(1600);
      X.justShown = true; X.a.select({ type: 'star', index: i }); await X.D.wait(500);
    },
  };
}

export function timeAdvanced(o) {
  return {
    kind: 'timeAdvanced', controls: 'hours',
    test(X) { return Math.abs((X.S.time - X.tryT0) / 3600e3 - o.hours) <= (o.tol ?? 0.1); },
    async show(X) { await X.advanceHours(o.hours); },
  };
}

export function objectAltitude(id, o = {}) {
  const alt = (X) => (typeof id === 'number' ? X.hip(id).alt : X.bodyAltAz(id).alt);
  return {
    kind: 'objectAltitude', controls: o.controls ?? null,
    test(X) { const a = alt(X); return a >= (o.min ?? -90) && a <= (o.max ?? 90); },
    async show(X) { const aa = typeof id === 'number' ? X.hip(id) : X.bodyAltAz(id); X.D.slew(aa.az, Math.max(aa.alt, 10), 80, 1.4); await X.D.wait(1600); },
  };
}

export function latitudeBetween(lo, hi) {
  return {
    kind: 'latitudeBetween', controls: 'lat',
    test(X) { const l = X.S.obs.lat; return l >= Math.min(lo, hi) && l <= Math.max(lo, hi); },
    async show(X) { await X.setLatitude((lo + hi) / 2, 2.2); },
  };
}

export function choice(o) {
  return {
    kind: 'choice', controls: null, hold: 0,
    options: (X) => o.options(X),
    correct: (X) => o.correct(X),
    answer(X, id) { return id === o.correct(X) ? true : { wrong: true, vars: {} }; },
    test() { return false; },
    show: o.show || (async () => {}),
  };
}

export function custom(fn, o = {}) {
  return { kind: 'custom', controls: o.controls || null, hold: o.hold, test: fn, show: o.show || (async () => {}), keys: o.keys, reset: o.reset };
}

/** Several checkers one after another. Stage k uses try.prompt (k = 0), try.prompt2, try.prompt3 ... and try.hint, try.hint2 ... */
export function sequence(list) {
  let k = 0;
  const cur = () => list[Math.min(k, list.length - 1)];
  return {
    kind: 'sequence', hold: 0,
    get controls() { return cur().controls; },
    get stage() { return k; },
    reset(X) { k = 0; list.forEach((c) => c.reset && c.reset(X)); },
    keys(X) { const n = k === 0 ? '' : String(k + 1); return { prompt: 'try.prompt' + n, hint: 'try.hint' + n, success: 'try.success' }; },
    test(X) {
      const r = cur().test(X);
      if (r === true) { if (k >= list.length - 1) return true; k++; X.stageChanged && X.stageChanged(k); return false; }
      return r;
    },
    async show(X) { for (let i = k; i < list.length; i++) { k = i; X.stageChanged && X.stageChanged(k); await list[i].show(X); } k = list.length - 1; },
  };
}

export { G };
