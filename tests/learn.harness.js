// Browser-side harness for the Learn area (not a node test). In the running app's console:
//   await import('/tests/learn.harness.js?x=' + Date.now());
//   __L.fast();                      // optional: drive animation with timers (useful when the tab is hidden and rAF is throttled)
//   __L.run('l1.1');                 // starts a full pass of one lesson; poll __R['l1.1'].phase until 'done'
// A pass: Watch to the end, Try via "Show me how", Old way, Tonight, Exit; then compares the Explore state before and after.
window.__errs = window.__errs || [];
addEventListener('error', (e) => __errs.push('E:' + e.message));
addEventListener('unhandledrejection', (e) => __errs.push('R:' + ((e.reason && e.reason.message) || e.reason)));
const oe = console.error; console.error = (...a) => { __errs.push('C:' + a.map((x) => (x && x.message) || x).join(' ')); oe(...a); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, max = 40000) => { const t0 = performance.now(); while (!fn() && performance.now() - t0 < max) await sleep(120); return !!fn(); };
window.__R = {};
window.__L = {
  sleep, until,
  fast() { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 20); },
  dump() {
    const S = __atlas.S;
    return { mode: S.mode, lat: +S.obs.lat.toFixed(4), lon: +S.obs.lon.toFixed(4), g: [S.globe.lat, S.globe.lon, S.globe.dist].map((v) => +v.toFixed(2)).join(','), sky: [S.sky.az, S.sky.alt, S.sky.fov].map((v) => +v.toFixed(2)).join(','), tm: S.tm, yd: S.yd, speed: S.speed, playing: S.playing, keep: S.keepLocal, layers: JSON.stringify(S.layers), q: S.q, expo: S.expo, sel: S.sel ? S.sel.type : null };
  },
  watchTo: async function (id, re, extra = 2500, max = 40000) {
    await __learn.start(id, 0); const t = document.querySelector('#lcard .lc-text'), caps = [];
    await until(() => { if (caps[caps.length - 1] !== t.textContent) caps.push(t.textContent); return re.test(t.textContent); }, max); await sleep(extra); return { t: t.textContent, caps };
  },
  async runAll(ids) { window.__allDone = false; for (const id of ids) { try { await this.run(id); } catch (e) { (window.__R[id] = window.__R[id] || {}).crash = String((e && e.stack) || e); window.__R[id].phase = 'crash'; try { await __learn.exit(); } catch (_) { /* ignore */ } await sleep(4000); } } window.__allDone = true; },
  async run(id, o = {}) {
    const out = { id, errs: [], watchCaps: [], phase: 'wait' }; window.__R[id] = out; const e0 = __errs.length;
    await until(() => !__lessons.engine.restoring && !__lessons.engine.held, 30000); await sleep(1200);
    const d0 = this.dump(), txt = document.querySelector('#lcard .lc-text');
    const mo = new MutationObserver(() => { if (out.phase === 'watch') out.watchCaps.push(txt.textContent); }); mo.observe(txt, { childList: true, characterData: true, subtree: true });
    out.maxH = 0; const card = document.getElementById('lcard'), ro = new ResizeObserver(() => { out.maxH = Math.max(out.maxH, Math.round(card.getBoundingClientRect().height)); }); ro.observe(card);
    out.phase = 'watch'; const t0 = performance.now();
    await __learn.start(id, 0);
    out.watchDone = await until(() => !__learn.P.watching, 150000); out.watchSecs = Math.round((performance.now() - t0) / 1000);
    out.phase = 'try'; __learn.step(1);
    await until(() => __learn.P.chk && (__learn.P.chk.kind === 'choice' ? __learn.P.hintTimer : __learn.P.poll), 60000); await sleep(500);
    out.prompt = txt.textContent; out.kind = __learn.P.chk.kind; out.opts = __learn.P.opts ? __learn.P.opts.map((x) => x.text) : null;
    const tool = document.querySelector('#lcard .lc-tool'); out.tool = tool.hidden ? null : tool.dataset.kind;
    out.cardH = Math.round(document.getElementById('lcard').getBoundingClientRect().height);
    if (!o.skipShow) {
      document.querySelector('#lcard [data-a=show]').click();
      out.tryDone = await until(() => __learn.P.tryDone, 60000);
      out.success = txt.textContent; out.note = document.querySelector('#lcard .lc-note').textContent;
    }
    out.phase = 'old'; __learn.step(2); await sleep(400); out.old = txt.textContent;
    __learn.step(3); await sleep(400); out.tonight = txt.textContent;
    mo.disconnect(); ro.disconnect();
    out.errs = __errs.slice(e0);
    out.bad = [...out.watchCaps, out.prompt, out.success, out.old, out.tonight].filter((s) => /[{}]|\[src|undefined|NaN/.test(s || ''));
    out.phase = 'exit';
    await __learn.exit(); await sleep(500); await until(() => !__lessons.engine.restoring && !__lessons.engine.held, 40000); await sleep(2500);
    const d1 = this.dump(); out.diffs = Object.keys(d0).filter((k) => d0[k] !== d1[k]).map((k) => k + ':' + d0[k] + '->' + d1[k]);
    out.phase = 'done'; return out;
  },
};
