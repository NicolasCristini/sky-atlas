// Browser-side harness for the Lessons feature (not a node test). In the running app's console:
//   await import('/tests/lessons.harness.js?x=' + Date.now());  then  await __t.all()  (or  await __t.run(0))
// For each lesson it runs "Show me" to completion, presses "Back to my sky" and reports every state field that did not come back.
window.__errs = [];
window.addEventListener('error', (e) => __errs.push('E:' + e.message));
window.addEventListener('unhandledrejection', (e) => __errs.push('R:' + (e.reason && e.reason.message || e.reason)));
const oe = console.error; console.error = (...a) => { __errs.push('C:' + a.map((x) => (x && x.message) || x).join(' ')); oe(...a); };
window.__t = {
  dump() {
    const S = __atlas.S;
    return { mode: S.mode, lat: +S.obs.lat.toFixed(4), lon: +S.obs.lon.toFixed(4), g: [S.globe.lat, S.globe.lon, S.globe.dist].map((v) => +v.toFixed(2)).join(','), sky: [S.sky.az, S.sky.alt, S.sky.fov].map((v) => +v.toFixed(2)).join(','), tm: S.tm, time: S.time, yd: S.yd, ages: [S.ages.years, +S.ages.baseYear.toFixed(3), S.ages.chip].join(','), speed: S.speed, speedBy: JSON.stringify(S.speedBy), playing: S.playing, keep: S.keepLocal, layers: JSON.stringify(S.layers), q: S.q, expo: S.expo, sel: S.sel ? S.sel.type : null, pref: localStorage.getItem('skyatlas.prefs') };
  },
  async run(i) {
    const caps = [], body = document.querySelector('.lsn-body');
    const mo = new MutationObserver(() => caps.push(body.textContent)); mo.observe(body, { childList: true, characterData: true, subtree: true });
    const e0 = __errs.length, d0 = this.dump(), t0 = Date.now();
    const follow = d0.tm === 'day' && d0.playing && d0.speed === 1 && Math.abs(d0.time - Date.now()) < 3000;
    __lessons.show(i); const text = body.textContent;
    await __lessons.start(i);
    const d1 = this.dump(), dur = Date.now() - t0, held = __lessons.demo.snap;
    await __lessons.restore();
    const d2 = this.dump(); mo.disconnect();
    const diffs = [];
    for (const k of Object.keys(d0)) {
      const a = d0[k], b = d2[k];
      if (k === 'time') { const exp = follow ? Date.now() : d0.time; if (Math.abs(b - exp) > (d0.playing ? 4000 : 1)) diffs.push(`${k}:${a}->${b}`); continue; }
      if (a !== b) diffs.push(`${k}:${a}->${b}`);
    }
    return { n: i + 1, text, len: text.length, caps: caps.length, secs: Math.round(dur / 1000), errs: __errs.slice(e0), held, speedAfterDemo: d1.speed, playingAfterDemo: d1.playing, endMode: d1.mode, diffs };
  },
  async all(list) { const out = []; for (const i of (list || [...Array(14).keys()])) { try { out.push(await this.run(i)); } catch (e) { out.push({ n: i + 1, err: String(e && e.stack || e) }); } window.__R = out; } return out; },
};
