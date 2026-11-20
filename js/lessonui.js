// Lessons: the floating card, the "Show me" demo runner (snapshot / restore of the user's sky), and the contextual tips.
// Content and demo scripts live in lessons.js. This module talks to main.js only through window.__atlas (state S, a few functions, hooks).
import { LESSONS, COLOUR_PAIRS } from './lessons.js';
import { placeName } from './cities.js';
import { classifyConstellations } from './explainer.js';
import { qualityParams, countVisible, aboutCount } from './skyquality.js';

const $ = (s) => document.querySelector(s);
const root = document.documentElement;
const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const CANCEL = { cancelled: true };
const KEY = 'skyatlas.lessons';
const N = LESSONS.length;
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const DEG = Math.PI / 180;

export function initLessons(a) {
  const S = a.S, A = a.A, data = a.data, sky = a.sky;
  const wrap = $('#lesson'), explainer = $('#explainer');
  if (!wrap) return;

  // ---------------------------------------------------------------- persisted state
  // Explore is the app without teaching UI: the quick-lesson pill is hidden and "Tips while exploring" is off until the user opts in.
  // v: 2 marks state saved after that change; older saves (which stored the old defaults) keep only the lessons already seen.
  const st = { v: 2, visible: false, collapsed: true, cur: 0, seen: [], tips: false };
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && typeof p === 'object') {
      if (Number.isInteger(p.cur) && p.cur >= 0 && p.cur < N) st.cur = p.cur;
      if (Array.isArray(p.seen)) st.seen = p.seen.filter((i) => Number.isInteger(i) && i >= 0 && i < N);
      if (p.v === 2) {
        if (typeof p.visible === 'boolean') st.visible = p.visible;
        if (typeof p.collapsed === 'boolean') st.collapsed = p.collapsed;
        if (typeof p.tips === 'boolean') st.tips = p.tips;
      }
    }
  } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
  const isPhone = () => root.classList.contains('phone');

  // ---------------------------------------------------------------- markup
  wrap.innerHTML = `<section class="lsn panel" role="region" aria-label="Lessons" tabindex="-1">
    <button class="lsn-pill" type="button" aria-expanded="false" aria-controls="lsn-full"><span class="lsn-gem" aria-hidden="true"></span><span class="lsn-pill-t"></span><svg class="lsn-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
    <div class="lsn-full" id="lsn-full">
      <div class="lsn-head">
        <div class="lsn-lab"><span class="lsn-lab-long"></span><span class="lsn-lab-short"></span><svg class="lsn-tick" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-label="seen" hidden><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
        <h3 class="lsn-title"></h3>
        <div class="lsn-nav">
          <button class="lsn-ic" type="button" data-a="prev" aria-label="Previous lesson" title="Previous lesson"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
          <button class="lsn-ic" type="button" data-a="next" aria-label="Next lesson" title="Next lesson"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
          <button class="lsn-ic" type="button" data-a="collapse" aria-label="Collapse lessons" title="Collapse"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
        </div>
      </div>
      <p class="lsn-body" aria-live="polite"></p>
      <div class="lsn-ctl">
        <button class="lsn-go" type="button" data-a="show">Show me</button>
        <button class="lsn-back" type="button" data-a="back" hidden>Back to my sky</button>
        <button class="lsn-more" type="button" data-a="more" title="Open the full explainer">More</button>
        <span class="lsn-dots" role="img"></span>
      </div>
    </div>
  </section>`;
  const card = wrap.querySelector('.lsn'), pill = wrap.querySelector('.lsn-pill'), pillT = wrap.querySelector('.lsn-pill-t');
  const labLong = wrap.querySelector('.lsn-lab-long'), labShort = wrap.querySelector('.lsn-lab-short'), tick = wrap.querySelector('.lsn-tick');
  const titleEl = wrap.querySelector('.lsn-title'), bodyEl = wrap.querySelector('.lsn-body'), dotsEl = wrap.querySelector('.lsn-dots');
  const goBtn = wrap.querySelector('.lsn-go'), backBtn = wrap.querySelector('.lsn-back'), moreBtn = wrap.querySelector('.lsn-more');
  dotsEl.innerHTML = LESSONS.map(() => '<i></i>').join('');

  // the explainer's sections get names so "More" can scroll to the right one
  [...explainer.querySelectorAll(':scope > .ex-sec')].forEach((el, i) => { el.dataset.sec = ['live', 'cmp', 'idea', 'ages', 'journeys'][i] || ''; });
  const cmpEl = explainer.querySelector('[data-sec=cmp]');

  // "Tips while exploring" row in the Layers menu (not part of S.layers)
  const layersMenu = $('#layers-menu');
  const tipRow = document.createElement('label'); tipRow.className = 'row lsn-tiprow';
  tipRow.innerHTML = '<span>Tips while exploring</span><input type="checkbox" id="lsn-tips"><span class="tg"></span>';
  layersMenu.appendChild(tipRow);
  const tipBox = tipRow.querySelector('input'); tipBox.checked = st.tips;
  tipBox.addEventListener('change', () => { st.tips = tipBox.checked; save(); if (!st.tips) { tipIdx = -1; pill.classList.remove('pulse'); renderPill(); } });

  // ---------------------------------------------------------------- live facts for the texts
  let lKey = '', Lc = null, nameKey = '', nameVal = 'here';
  const rotUp = () => {     // observer zenith expressed in the star frame (R^T U)
    const e = a.rotMat.elements, U = S.obs.U;
    return [e[0] * U[0] + e[1] * U[1] + e[2] * U[2], e[4] * U[0] + e[5] * U[1] + e[6] * U[2], e[8] * U[0] + e[9] * U[1] + e[10] * U[2]];
  };
  const starCount = (limit) => countVisible(sky.cur, data.stars.mag, data.stars.n, rotUp(), limit);
  function altAzEq(x, y, z) {   // equatorial unit vector (celestial frame) -> alt/az now
    const e = a.rotMat.elements;
    return A.azAltFromDir([e[0] * x + e[4] * y + e[8] * z, e[1] * x + e[5] * y + e[9] * z, e[2] * x + e[6] * y + e[10] * z], S.obs);
  }
  function placeShort(lat, lon) {
    const k = lat.toFixed(2) + ',' + lon.toFixed(2);
    if (k === nameKey) return nameVal;
    try { const p = placeName(lat, lon); nameVal = p.short || p.title || 'here'; } catch (e) { nameVal = 'here'; }
    nameKey = k; return nameVal;
  }
  function buildL() {
    const lat = S.obs.lat, lon = S.obs.lon, abs = Math.abs(lat);
    const key = [lat.toFixed(2), lon.toFixed(2), S.tm, Math.floor(S.time / 1800e3), Math.round(S.ages.years / 100), S.tm === 'year' ? Math.round(S.yd) : 0].join('|');
    if (Lc && key === lKey) return Lc;
    lKey = key;
    const ep = S.tm === 'ages' ? { P: a.precP, tag: 'a' + Math.round(S.ages.years / 100) } : undefined;
    const cls = classifyConstellations(data, lat, ep);
    const equator = abs < 0.5, polar = abs > 89.5;
    const up = [];
    if (S.ages.fade > 0.5) {
      for (const b of sky.bodies) { const aa = altAzEq(b.eq.x, b.eq.y, b.eq.z); if (aa.alt > 2) up.push({ id: b.id, alt: aa.alt, mag: b.mag }); }
    }
    up.sort((p, q) => (p.id === 'Sun' ? -2 : p.id === 'Moon' ? -1 : 0) - (q.id === 'Sun' ? -2 : q.id === 'Moon' ? -1 : 0) || p.mag - q.mag);
    Lc = {
      lat, lon, abs: abs.toFixed(1), equator, polar, hemi: equator ? 'equator' : lat > 0 ? 'north' : 'south', pole: lat >= 0 ? 'north' : 'south',
      place: placeShort(lat, lon), latTxt: `${abs.toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`, lonH: (Math.abs(lon) / 15).toFixed(1),
      nAlways: cls.always.length, never: cls.never.map((c) => c.name),
      bodiesUp: up.map((b) => (b.id === 'Moon' || b.id === 'Sun' ? 'the ' + b.id : b.id)),
      nCity: aboutCount(starCount(qualityParams(0).limit)), nDark: aboutCount(starCount(qualityParams(3).limit)),
      pct: (((1 + Math.cos(lat * DEG)) / 2) * 100).toFixed(0), mirTxt: `${abs.toFixed(1)}°${lat >= 0 ? 'S' : 'N'}`,
    };
    return Lc;
  }

  // ---------------------------------------------------------------- rendering
  let run = null;           // the running demo script: { cancel }
  let snap = null;          // the user's state, held from the first demo step until "Back to my sky"
  let restoring = false, caption = '', tipIdx = -1, tipTimer = 0, lastBody = '', onCap = null;   // onCap: the Learn player listens to demo captions
  const cur = () => LESSONS[st.cur];
  const demoActive = () => !!(run || snap || restoring);
  function renderDots() {
    [...dotsEl.children].forEach((d, i) => { d.className = (st.seen.includes(i) ? 'seen ' : '') + (i === st.cur ? 'cur' : ''); });
    dotsEl.setAttribute('aria-label', `${st.seen.length} of ${N} lessons seen`);
  }
  function renderPill() {
    const l = cur(), tip = tipIdx === st.cur && tipIdx >= 0;
    pillT.textContent = tip ? `Tip · ${l.title}` : `Lesson ${st.cur + 1} · ${l.title}`;
    pill.classList.toggle('tip', tip);
    pill.setAttribute('aria-label', `${tip ? 'Tip: ' : 'Lesson '}${l.title}. Expand`);
  }
  function renderBody(force) {
    let t;
    if (restoring) t = 'Taking you back to your sky...';
    else if (caption) t = caption;
    else { try { t = cur().text(buildL()); } catch (e) { console.error(e); t = ''; } }
    if (t !== lastBody || force) { lastBody = t; bodyEl.textContent = t; }
    bodyEl.classList.toggle('cap', !!caption && !restoring);
  }
  function renderButtons() {
    const held = !!snap || !!run || restoring;
    goBtn.hidden = false; goBtn.textContent = held ? 'Replay' : 'Show me';
    goBtn.classList.toggle('alt', held); backBtn.hidden = !held; backBtn.disabled = restoring;
    goBtn.disabled = restoring;
  }
  function render() {
    card.classList.toggle('collapsed', st.collapsed);
    wrap.hidden = !st.visible;
    pill.setAttribute('aria-expanded', String(!st.collapsed));
    const l = cur(), seen = st.seen.includes(st.cur);
    labLong.textContent = `Lesson ${st.cur + 1} of ${N} · ${l.topic}`; labShort.textContent = `${st.cur + 1}/${N}`;
    tick.hidden = !seen; titleEl.textContent = l.title;
    renderPill(); renderDots(); renderButtons(); renderBody(true);
    const open = st.visible && !st.collapsed;
    if (open && !st.seen.includes(st.cur)) { st.seen.push(st.cur); save(); renderDots(); tick.hidden = false; }
    place();
  }
  function go(i) {
    const was = st.cur; st.cur = (i + N) % N;
    if (run) cancelRun();                       // another lesson: the running script stops, the scene is held until "Back to my sky"
    caption = ''; if (tipIdx !== st.cur) tipIdx = -1;
    if (was !== st.cur) { lKey = ''; save(); }
    render();
  }
  function setCollapsed(c) { st.collapsed = c; if (c && !st.tips) st.visible = false; if (!c) { tipIdx = -1; clearTimeout(tipTimer); pill.classList.remove('pulse'); } save(); render(); }
  function toggle() {
    if (!st.visible || st.collapsed) { st.visible = true; setCollapsed(false); } else { st.visible = false; save(); render(); }
  }
  window.__lessons = { toggle, show: (i) => { if (Number.isInteger(i)) st.cur = i; st.visible = true; setCollapsed(false); }, state: st, get demo() { return { run: !!run, snap: !!snap }; }, tip: (i) => tryTip(i, true), buildL, snapshot: () => takeSnap(), restore: (o) => restore(o), start: (i) => { if (Number.isInteger(i)) go(i); return startDemo(); } };

  // ---------------------------------------------------------------- placement (desktop: top-centre between the left column and the toolbar)
  function place() {
    if (isPhone()) { wrap.style.left = wrap.style.right = ''; return; }
    const tb = $('#toolbar'), lc = $('#place');
    const tr = tb && tb.getBoundingClientRect(), lr = lc && lc.getBoundingClientRect();
    const sal = 0;
    let left = lr ? Math.round(lr.right + 12) : 376, right = tr && tr.width ? Math.round(window.innerWidth - tr.left + 12) : 404;
    right = Math.max(right, 404 - 0); left = Math.max(left, 376 + sal);
    if (window.innerWidth - left - right < 300) {   // narrow desktop/tablet: sit under the toolbar instead, still centred on the free strip
      wrap.classList.add('under'); wrap.style.left = '16px'; wrap.style.right = '16px';
    } else { wrap.classList.remove('under'); wrap.style.left = left + 'px'; wrap.style.right = right + 'px'; }
  }
  window.addEventListener('resize', place);
  new MutationObserver(place).observe(root, { attributes: true, attributeFilter: ['class'] });
  if ('ResizeObserver' in window && $('#toolbar')) new ResizeObserver(place).observe($('#toolbar'));

  // ---------------------------------------------------------------- controls
  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const act = b.dataset.a;
    if (act === 'prev') go(st.cur - 1); else if (act === 'next') go(st.cur + 1);
    else if (act === 'collapse') setCollapsed(true);
    else if (act === 'show') startDemo();
    else if (act === 'back') restore();
    else if (act === 'more') openMore();
  });
  pill.addEventListener('click', () => setCollapsed(false));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(st.cur - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(st.cur + 1); }
    else if (e.key === 'Escape' && !st.collapsed) { e.preventDefault(); setCollapsed(true); }
  });
  // swipe left / right on the card changes the lesson
  (function swipe() {
    let t0 = null;
    card.addEventListener('touchstart', (e) => { t0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() } : null; }, { passive: true });
    card.addEventListener('touchend', (e) => {
      if (!t0 || st.collapsed) { t0 = null; return; }
      const c = e.changedTouches[0], dx = c.clientX - t0.x, dy = c.clientY - t0.y; t0 = null;
      if (Math.abs(dx) > 42 && Math.abs(dx) > 1.8 * Math.abs(dy)) go(dx < 0 ? st.cur + 1 : st.cur - 1);
    });
  })();

  // "More": the full explainer, scrolled to the related section
  function openMore() {
    const l = cur(), m = l.more || { sec: 'idea' };
    const closed = explainer.classList.contains('closed');
    if (closed) $('#explain-btn').click();
    setTimeout(() => {
      let sec = explainer.querySelector(`[data-sec=${m.sec}]`);
      if (!sec || sec.hidden) sec = explainer.querySelector(`[data-sec=${m.fallback || 'idea'}]`) || explainer.querySelector('[data-sec=idea]');
      if (m.list) { const stat = explainer.querySelector(`[data-act=list][data-list=${m.list}]`); if (stat && !stat.classList.contains('open')) stat.click(); }
      explainer.classList.remove('compact');
      if (sec) { const head = explainer.querySelector('.ex-head'); explainer.scrollTo({ top: Math.max(0, sec.offsetTop - (head ? head.offsetHeight : 0) - 4), behavior: reduced ? 'auto' : 'smooth' }); }
    }, closed ? 340 : 30);
  }

  // ---------------------------------------------------------------- snapshot and restore of the user's sky
  const sleepRaw = (ms) => new Promise((r) => setTimeout(r, ms));
  async function settleRaw(maxMs = 9000) { const t0 = performance.now(); while ((S.trans || S.travel) && performance.now() - t0 < maxMs) await sleepRaw(50); }
  function syncLayerBoxes() { layersMenu.querySelectorAll('input[data-k]').forEach((i) => { i.checked = !!S.layers[i.dataset.k]; }); }
  function takeSnap() {
    const follow = S.tm === 'day' && S.playing && S.speed === 1 && Math.abs(S.time - Date.now()) < 3000;
    return {
      mode: S.mode, lat: S.obs.lat, lon: S.obs.lon, globe: { lat: S.globe.lat, lon: S.globe.lon, dist: S.globe.dist }, sky: { az: S.sky.az, alt: S.sky.alt, fov: S.sky.fov },
      tm: S.tm, time: S.time, anchor: S.anchor, yd: S.yd, ages: { years: S.ages.years, baseYear: S.ages.baseYear, chip: S.ages.chip },
      speed: S.speed, speedBy: { ...S.speedBy }, playing: S.playing, keepLocal: S.keepLocal, layers: { ...S.layers }, q: S.q, expo: S.expo,
      sel: S.sel, from: S.from, cmpHidden: cmpEl ? cmpEl.hidden : true, follow,
    };
  }
  function cancelRun() {
    clearPause();
    if (run) run.cancel = true;
    if (S.travel) S.travel.dur = 1;                   // a trip in flight lands at once
    if (S.ages.tween) S.ages.tween = null;
    S.slew = null;
  }
  /** Put everything back. keepPlace: leave the user where they are (a manual trip or journey took over): layers, quality, time mode and speed only. */
  async function restore(opts = {}) {
    if (!snap || restoring) return;
    const s = snap, keepPlace = !!opts.keepPlace, instant = !!opts.instant;
    restoring = true; cancelRun(); renderButtons(); renderBody();
    try {
      await settleRaw();
      run = null;
      S.playing = false; S.speed = 1;
      Object.assign(S.layers, s.layers); syncLayerBoxes(); S.q = s.q; S.expo = s.expo; a.syncSkyUI(); a.savePrefs();
      S.ages.tween = null;
      if (S.tm !== s.tm) a.setTimeMode(s.tm, { keepTime: true });
      S.keepLocal = false; a.syncKeep();
      if (!keepPlace) {
        // place: the app's own trip (the clock stays put, Keep local time is off while we go back)
        if (Math.abs(S.obs.lat - s.lat) > 1e-5 || Math.abs(A.norm180(S.obs.lon - s.lon)) > 1e-5) {
          if (instant) a.placeInstant({ lat: s.lat, lon: s.lon }); else await a.travelTo(s.lat, s.lon, { duration: 3.2 });
          await settleRaw();
        }
        // view mode
        if (s.mode === 'globe' && S.mode === 'sky') await a.leaveSky();
        else if (s.mode === 'sky' && S.mode === 'globe') await a.enterSky({ az: s.sky.az, alt: s.sky.alt, fov: s.sky.fov });
        await settleRaw();
        if (S.mode === 'sky') {
          a.slewTo(s.sky.az, s.sky.alt, s.sky.fov, instant ? 0.2 : 1.2); await sleepRaw(instant ? 350 : 1400);
          S.slew = null; S.sky.az = s.sky.az; S.sky.alt = s.sky.alt; S.sky.fov = s.sky.fov; S.sky.vAz = S.sky.vAlt = 0;
        } else { S.sky.az = s.sky.az; S.sky.alt = s.sky.alt; S.sky.fov = s.sky.fov; S.sky.vAz = S.sky.vAlt = 0; }
        S.globe.lat = s.globe.lat; S.globe.lon = s.globe.lon; S.globe.dist = s.globe.dist; S.globe.vLat = S.globe.vLon = 0; S.globe.auto = false;
        a.select(s.mode === 'sky' ? s.sel : null);
        S.from = s.from; if (cmpEl) cmpEl.hidden = s.cmpHidden;
      } else if (!S.sel) sky.setHighlight(null);
      S.keepLocal = s.keepLocal; a.syncKeep();
      // the clock last, so the restored instant is not stale by the length of the trip home
      if (!keepPlace) {
        const t = s.follow ? Date.now() : s.time;
        S.time = t; S.anchor = s.anchor + (t - s.time); S.yd = s.yd;
        S.ages.baseYear = s.ages.baseYear; S.ages.years = s.ages.years; S.ages.chip = s.ages.chip;
        a.updateCelestial(true); a.syncEpochs();
      }
      Object.assign(S.speedBy, s.speedBy); S.speed = s.speed; S.playing = s.playing; a.syncPlay();
    } catch (e) { console.error(e); }
    snap = null; restoring = false; caption = ''; syncTrackers();
    renderButtons(); renderBody(true);
  }

  // ---------------------------------------------------------------- the demo toolkit (what the scripts in lessons.js call)
  const chk = () => { if (!run || run.cancel) throw CANCEL; };
  // The demo clock: performance.now() minus the time spent paused (Learn's Pause / Go). Inert until engine.pause() is called, so Explore's quick lessons never see a difference.
  let pausedAt = 0, pausedTotal = 0, pauseHeld = null;
  const dnow = () => (pausedAt || performance.now()) - pausedTotal;
  const clearPause = () => { pausedAt = 0; pauseHeld = null; };   // pausedTotal is never reduced: the demo clock only moves forward
  const wait = (ms) => new Promise((res, rej) => {
    const r = run, t0 = dnow();
    const id = setInterval(() => { if (!r || r.cancel) { clearInterval(id); rej(CANCEL); } else if (dnow() - t0 >= ms) { clearInterval(id); res(); } }, 40);
  });
  const hours = (h) => h * 3600e3;
  const polar = (alt, az) => ({ alt, az });
  function bodyList() {
    const out = [];
    for (const b of sky.bodies) { const aa = altAzEq(b.eq.x, b.eq.y, b.eq.z); out.push({ id: b.id, kind: b.kind, mag: b.mag, az: aa.az, alt: aa.alt }); }
    return out;
  }
  const D = {
    S, A, a, L: () => { lKey = ''; return buildL(); }, phone: false,
    wait, now: dnow,
    async say(text, ms = 2600) { chk(); caption = text; renderBody(); if (onCap) onCap(text); if (ms > 0) await wait(ms); },
    async until(pred, maxMs = 8000) { const t0 = dnow(); while (!pred() && dnow() - t0 < maxMs) await wait(60); },
    async settle() { while (S.trans || S.travel) await wait(50); },
    async prep(o = {}) {
      chk();
      if (S.journey) S.journey.cancel = true;
      document.body.classList.remove('journey'); $('#caption').hidden = true;
      S.intro = null; S.globe.auto = false; S.globe.vLon = S.globe.vLat = 0; S.sky.vAz = S.sky.vAlt = 0; S.slew = null;
      await D.settle();
      if (o.day !== false && S.tm !== 'day') a.setTimeMode('day', { keepTime: true });
      S.layers.daylight = false; syncLayerBoxes();
      S.playing = false; S.speed = S.tm === 'day' ? 1 : S.speedBy[S.tm]; a.syncPlay();
      a.select(null);
      a.updateCelestial(true);
    },
    async toSky(az, alt, fov = 70) {
      chk(); await D.settle();
      if (S.mode === 'globe') { S.sky.az = ((az % 360) + 360) % 360; S.sky.alt = clamp(alt, -8, 89); S.sky.fov = fov; await a.enterSky(); chk(); }
      else { a.slewTo(az, alt, fov, 1.2); await wait(1350); }
    },
    async toGlobe() { chk(); await D.settle(); await a.leaveSky(); chk(); },
    slew(az, alt, fov, dur = 1.2) { chk(); a.slewTo(az, alt, fov, dur); },
    async travel(lat, lon, o = {}) { chk(); await D.settle(); await a.travelTo(lat, lon, o); await D.settle(); chk(); },
    placeAt(lat, lon) { chk(); a.placeInstant({ lat, lon }); },
    layer(k, on) { S.layers[k] = on; syncLayerBoxes(); },
    keepLocal(v) { S.keepLocal = v; a.syncKeep(); },
    setLocalSolar(h, lon) { a.setLocalSolar(h, lon === undefined ? S.obs.lon : lon); a.updateCelestial(true); },
    timeMode(m) { a.setTimeMode(m); S.playing = false; a.syncPlay(); },
    epoch(id) { a.goEpoch(id); },
    highlight(id) { sky.setHighlight(id); },
    updateNow() { a.updateCelestial(true); },
    name: (lat, lon) => placeShort(lat, lon),
    lonAdd: (lon, d) => A.norm180(lon + d),
    snapQ: () => (snap ? snap.q : S.q),
    async play(speed, ms, lines, kind) {
      chk();
      S.speed = speed; S.playing = true; a.syncPlay();
      try {
        if (lines && lines.length) { const each = Math.max(2500, ms / lines.length); for (const t of lines) { caption = t; renderBody(); if (onCap) onCap(t); await wait(each); } }
        else await wait(ms);
      } finally { S.playing = false; S.speed = kind === 'year' ? S.speedBy.year : 1; a.syncPlay(); }
    },
    async tweenQ(to, ms) {
      chk(); const q0 = S.q, t0 = dnow(), dur = reduced ? ms * 0.3 : ms;
      await new Promise((res, rej) => {
        const step = () => {
          if (!run || run.cancel) { rej(CANCEL); return; }
          const u = clamp((dnow() - t0) / dur, 0, 1), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          S.q = q0 + (to - q0) * e; a.syncSkyUI();
          if (u >= 1) res(); else requestAnimationFrame(step);
        };
        step();
      });
    },
    // ---- sky geometry helpers
    starAlt: (ra, dec, ms) => A.eqToAltAz(ra, dec, S.obs.lat, S.obs.lon, A.jdFromMs(ms === undefined ? S.time : ms)).alt,
    starAltAz: (ra, dec) => A.eqToAltAz(ra, dec, S.obs.lat, S.obs.lon, A.jdFromMs(S.time)),
    consDir(id) { const c = data.consMap.get(id); return A.vecToEq(c.center); },
    hipAltAz(hip) { const i = data.hipIndex.get(hip); return D.starAltAz(data.stars.ra[i], data.stars.dec[i]); },
    findTimeFn(pred, hrs = 24) {
      for (let k = 0; k <= hrs * 2; k++) {
        const t = S.time + k * 1800e3;
        if (pred(t)) { if (k > 0) { S.time = t; S.anchor = t; a.updateCelestial(true); } return true; }
      }
      return false;
    },
    galactic(l, b) {   // galactic -> J2000 equatorial (deg)
      const cl = Math.cos(l * DEG), sl = Math.sin(l * DEG), cb = Math.cos(b * DEG), sb = Math.sin(b * DEG);
      const g = [cb * cl, cb * sl, sb];
      const M = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.44482963, 0.7469822445], [-0.867666149, -0.1980763734, 0.4559837762]];
      const x = M[0][0] * g[0] + M[1][0] * g[1] + M[2][0] * g[2], y = M[0][1] * g[0] + M[1][1] * g[1] + M[2][1] * g[2], z = M[0][2] * g[0] + M[1][2] * g[1] + M[2][2] * g[2];
      return { ra: A.norm360(Math.atan2(y, x) / DEG), dec: Math.asin(clamp(z, -1, 1)) / DEG };
    },
    bandHighest() {
      let best = { alt: -90, az: 180 };
      for (let l = 0; l < 360; l += 3) { const g = D.galactic(l, 0), aa = D.starAltAz(g.ra, g.dec); if (aa.alt > best.alt) best = aa; }
      return best;
    },
    async pickBodies() {
      let list = bodyList().filter((b) => b.id !== 'Sun' && b.alt > 6), shifted = false;
      if (!list.length) {
        const t0 = S.time;
        for (let k = 1; k <= 48 && !list.length; k++) { S.time = t0 + k * 1800e3; S.anchor = S.time; a.updateCelestial(true); list = bodyList().filter((b) => b.id !== 'Sun' && b.alt > 6); }
        shifted = list.length > 0; if (!shifted) { S.time = t0; S.anchor = t0; a.updateCelestial(true); }
      }
      const moon = list.find((b) => b.id === 'Moon'), planets = list.filter((b) => b.kind === 0).sort((p, q) => p.mag - q.mag);
      const target = moon || planets[0];
      const route = list.filter((b) => b !== target).sort((p, q) => p.az - q.az).slice(0, 2).concat(target ? [target] : []);
      return { first: route[0] || { az: 180, alt: 30 }, route, shifted, note: shifted ? 'No planet was up at this hour, so the clock moved on until one rose. They all keep to the same line.' : 'The Sun, Moon and planets all keep to this one line across the sky.' };
    },
    pickPair() {
      let best = null;
      for (let k = 0; k <= 48 && !best; k++) {
        const t = S.time + k * 1800e3;
        for (const p of COLOUR_PAIRS) {
          const ih = data.hipIndex.get(p.hot), ic = data.hipIndex.get(p.cool); if (ih === undefined || ic === undefined) continue;
          if (D.starAlt(data.stars.ra[ih], data.stars.dec[ih], t) > 10 && D.starAlt(data.stars.ra[ic], data.stars.dec[ic], t) > 10) { best = { k, p }; break; }
        }
      }
      if (!best) return COLOUR_PAIRS[0];
      if (best.k > 0) { S.time += best.k * 1800e3; S.anchor = S.time; a.updateCelestial(true); }
      return best.p;
    },
    midAz(a1, a2) { const x = Math.sin(a1 * DEG) + Math.sin(a2 * DEG), y = Math.cos(a1 * DEG) + Math.cos(a2 * DEG); return A.norm360(Math.atan2(x, y) / DEG); },
    fovFor(p, q) {
      const c = Math.sin(p.alt * DEG) * Math.sin(q.alt * DEG) + Math.cos(p.alt * DEG) * Math.cos(q.alt * DEG) * Math.cos((p.az - q.az) * DEG);
      return clamp((Math.acos(clamp(c, -1, 1)) / DEG) * 2.2, 45, 95);
    },
    select(hip) { chk(); const i = data.hipIndex.get(hip); if (i !== undefined) a.select({ type: 'star', index: i }); },
  };

  async function startDemo() {
    if (restoring) return;
    const lesson = cur();
    if (run) cancelRun();
    if (snap) { await restore({ instant: true }); }       // back to the real baseline, without the long trip home
    else { await settleRaw(); }
    D.phone = isPhone();
    snap = takeSnap();
    clearPause();
    const r = run = { cancel: false };
    caption = ''; tipIdx = -1;
    if (!st.seen.includes(st.cur)) { st.seen.push(st.cur); save(); }
    renderButtons(); render();
    try { await lesson.demo(D); }
    catch (e) { if (e !== CANCEL) console.error(e); }
    finally {
      if (run === r) {
        run = null; S.playing = false;   // never leave time running fast
        if (S.speed > 1 && S.tm === 'day') S.speed = 1; a.syncPlay();
        if (!r.cancel) caption = '';
        renderButtons(); renderBody(true);
      }
    }
  }

  // ---------------------------------------------------------------- engine for the Learn player (js/learn.js)
  // The same toolkit, snapshot and restore the quick lessons use. begin() snapshots the user's Explore state once; end() puts it all back.
  const engine = {
    D, takeSnap,
    get held() { return !!snap; },
    get running() { return !!run; },
    get restoring() { return restoring; },
    /** Snapshot the user's sky (once: a second call while held keeps the first snapshot). */
    async begin() { if (restoring) return; if (!snap) { if (run) cancelRun(); await settleRaw(); snap = takeSnap(); } return snap; },
    /** Restore the snapshot. opts as restore(): { instant, keepPlace }. */
    async end(opts = { instant: true }) { cancelRun(); run = null; clearPause(); await restore(opts); onCap = null; },
    /** Run a script against the demo toolkit. hooks.onCaption(text) mirrors D.say / D.play captions. Resolves true if it finished, false if cancelled. */
    async runScript(fn, hooks = {}) {
      if (restoring) return false;
      if (run) cancelRun();
      await settleRaw();
      D.phone = isPhone(); onCap = hooks.onCaption || null; caption = ''; clearPause();
      const r = run = { cancel: false };
      try { await fn(D); } catch (e) { if (e !== CANCEL) { console.error(e); } return false; }
      finally { if (run === r) { run = null; clearPause(); S.playing = false; if (S.speed > 1 && S.tm === 'day') S.speed = 1; a.syncPlay(); } }
      return !r.cancel;
    },
    cancel() { cancelRun(); },
    /** Learn's Pause: the demo clock (D.now, D.wait, D.until, the tweens) and the sky clock stop; Go resumes. Animations already under way (slews, trips, drawn overlays) simply finish. */
    pause() { if (pausedAt || !run || run.cancel) return; pausedAt = performance.now(); pauseHeld = { playing: S.playing, speed: S.speed }; S.playing = false; a.syncPlay(); },
    resume() { if (!pausedAt) return; pausedTotal += performance.now() - pausedAt; pausedAt = 0; const h = pauseHeld; pauseHeld = null; if (h && h.playing) { S.speed = h.speed; S.playing = true; a.syncPlay(); } },
    get paused() { return !!pausedAt; },
    /** Stop whatever is moving without restoring: a lesson step ended. */
    stop() { clearPause(); if (run) { run.cancel = true; } if (S.travel) S.travel.dur = 1; S.ages.tween = null; S.slew = null; S.playing = false; if (S.speed > 1 && S.tm === 'day') S.speed = 1; a.syncPlay(); },
    clock: { get: () => ({ playing: S.playing, speed: S.speed }) },
    setQuickVisible(v) { st.visible = v; render(); },
  };
  window.__lessons.engine = engine;

  // a manual trip or a guided journey takes over: the demo ends, the user keeps their new place
  a.hooks.userTravel = () => { if (!snap && !run) return; if (S.travel) { cancelRun(); return; } restore({ keepPlace: true }); };
  explainer.addEventListener('click', (e) => { if (e.target.closest('[data-act=journey]') && (snap || run)) restore({ keepPlace: true }); }, true);

  // ---------------------------------------------------------------- contextual tips
  const trk = { tm: S.tm, sel: '', travel: null, fastSince: 0, lastTip: -1e9, shown: new Set() };
  const selKey = () => (!S.sel ? '' : S.sel.type === 'star' ? 's' + S.sel.index : S.sel.type === 'body' ? 'b' + S.sel.body.id : S.sel.type);
  function syncTrackers() { trk.tm = S.tm; trk.sel = selKey(); trk.travel = null; trk.fastSince = 0; }
  function tryTip(i, force) {
    if (!force) {
      if (!st.tips || (st.visible && !st.collapsed) || demoActive()) return;
      if (trk.shown.has(i)) return;
      const now = performance.now(); if (now - trk.lastTip < 45000) return;
      trk.lastTip = now;
    }
    trk.shown.add(i); tipIdx = i; st.cur = i; st.visible = true; st.collapsed = true; lKey = ''; caption = ''; save(); render();
    pill.classList.add('pulse'); clearTimeout(tipTimer); tipTimer = setTimeout(() => pill.classList.remove('pulse'), 7000);
  }
  function tipsTick() {
    if (demoActive()) { syncTrackers(); return; }
    // travel finished
    if (S.travel && !trk.travel) trk.travel = { lat0: S.travel.lat0, lon0: S.from ? S.from.lon : S.obs.lon };
    if (!S.travel && trk.travel) {
      const T = trk.travel; trk.travel = null;
      const dLat = S.obs.lat - T.lat0, dLon = A.norm180(S.obs.lon - T.lon0), eastWest = Math.abs(dLon) * Math.cos(((S.obs.lat + T.lat0) / 2) * DEG);
      if (T.lat0 * S.obs.lat < 0 && Math.abs(T.lat0) > 3 && Math.abs(S.obs.lat) > 3) tryTip(8);
      else if (Math.abs(dLon) > 8 && eastWest > 1.5 * Math.abs(dLat)) tryTip(4);
      else if (Math.abs(dLat) > 8 && Math.abs(dLat) > 1.5 * eastWest) tryTip(3);
    }
    // selection
    const k = selKey();
    if (k !== trk.sel) {
      trk.sel = k;
      if (S.sel && S.sel.type === 'star') { try { if (data.starInfo(S.sel.index).name === 'Polaris') tryTip(0); } catch (e) { /* ignore */ } }
      else if (S.sel && S.sel.type === 'body' && S.sel.body.id !== 'Sun') tryTip(7);
    }
    // time scale
    if (S.tm !== trk.tm) { trk.tm = S.tm; if (S.tm === 'ages') tryTip(9); else if (S.tm === 'year') tryTip(6); }
    // time running fast in Day mode
    if (S.tm === 'day' && S.playing && S.speed >= 600) { if (!trk.fastSince) trk.fastSince = performance.now(); else if (performance.now() - trk.fastSince > 1000) tryTip(5); } else trk.fastSince = 0;
  }
  $('#sq').addEventListener('input', () => { if (!demoActive()) tryTip(10); });

  // ---------------------------------------------------------------- housekeeping
  setInterval(() => {
    try { tipsTick(); } catch (e) { console.error(e); }
    const hud = $('#travel-hud'); if (hud && hud.classList.contains('on')) { const hh = Math.round(hud.firstElementChild.getBoundingClientRect().height); if (hh) root.style.setProperty('--hud-h', hh + 'px'); }
    if (!st.collapsed && st.visible && !caption && !restoring) renderBody();
  }, 300);
  render();
}
