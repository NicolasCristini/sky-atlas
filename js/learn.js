// The Learn area: a course in chapters (home sheet) and a lesson player (Watch, Try, The old way, Tonight outside) over the live sky.
// Text: content/<lang>/course.md (js/course/text.js parses it). Lesson logic: js/course/chN.js. Framework docs: js/course/README.md.
// Explore state: the quick-lesson engine in lessonui.js snapshots the user's sky when a lesson starts and restores it when they leave.
import { loadCourse } from './course/text.js';
import { CHAPTERS } from './course/index.js';
import { createOverlay } from './course/overlay.js';
import { createKit } from './course/kit.js';
import { SLIDER_MAX, sliderToYears, yearsToSlider, formatYear } from './ages.js';
import { attachNight } from './course/nightsky.js';

const $ = (s) => document.querySelector(s);
const body = document.body, root = document.documentElement;
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY = 'skyatlas.learn';
const STEP_KEYS = ['watch', 'try', 'oldway', 'tonight'];
const STEP_UI = ['stepWatch', 'stepTry', 'stepOldway', 'stepTonight'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = {
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  tick: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

(function wait() {
  const a = window.__atlas, L = window.__lessons;
  if (a && L && L.engine) boot(a, L.engine).catch((e) => console.error('learn', e)); else setTimeout(wait, 80);
})();

async function boot(a, engine) {
  const S = a.S, A = a.A, D = engine.D;
  let course = null;
  const ov = createOverlay(a);
  const K = createKit(a, engine, ov, () => course), ui = K.ui;
  course = await loadCourse('en');
  attachNight(K, a, engine);   // red night mode, "keep this setting", per-step cleanups (chapters 7 and 8)

  // ---------------------------------------------------------------- progress (localStorage, always try/catch)
  let prog = { v: 1, done: {}, steps: {}, last: null };
  try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && p.v === 1) prog = { v: 1, done: p.done || {}, steps: p.steps || {}, last: p.last || null }; } catch (e) { /* storage unavailable */ }
  const saveProg = () => { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) { /* ignore */ } };
  const stepsOf = (id) => prog.steps[id] || [];
  const isDone = (id) => !!prog.done[id];
  const markStep = (id, i) => { const s = prog.steps[id] || (prog.steps[id] = []); if (!s.includes(i)) { s.push(i); saveProg(); } };
  const markDone = (id) => { prog.done[id] = Date.now(); prog.last = id; saveProg(); };

  // ---------------------------------------------------------------- lookups
  const mdChapter = (id) => course && course.chapters.find((c) => c.id === id);
  const mdLesson = (id) => { if (!course) return null; for (const c of course.chapters) { const l = c.lessons.find((x) => x.id === id); if (l) return l; } return null; };
  const lessonList = () => CHAPTERS.flatMap((c) => c.lessons.map((def) => ({ def, ch: c })));
  const nextUnfinished = () => lessonList().find((x) => !isDone(x.def.id)) || null;
  const chapterProgress = (c) => ({ done: c.lessons.filter((l) => isDone(l.id)).length, total: c.lessons.length });

  // ---------------------------------------------------------------- the home sheet
  const home = document.createElement('div');
  home.id = 'learn'; home.hidden = true;
  home.innerHTML = `<div class="lh-scrim" data-a="close"></div>
    <section class="lh-panel panel" role="dialog" aria-modal="true" aria-labelledby="lh-title" tabindex="-1">
      <header class="lh-head"><div class="lh-id"><div class="eyebrow lh-eyebrow"></div><h2 id="lh-title"></h2><p class="lh-goal"></p></div><button class="icon-btn lh-x" type="button" data-a="close"></button></header>
      <div class="lh-body"></div>
      <footer class="lh-foot"><span class="eyebrow lh-more"></span><div class="lh-links"><button type="button" class="lh-link" data-a="quick"></button><button type="button" class="lh-link" data-a="explainer"></button></div></footer>
    </section>`;
  body.appendChild(home);
  const panel = home.querySelector('.lh-panel'), bodyEl = home.querySelector('.lh-body');
  let view = { name: 'home', ch: null }, opener = null;

  function ring(done, total, size = 40) {
    const r = size / 2 - 3, c = 2 * Math.PI * r, f = total ? done / total : 0;
    return `<svg class="lh-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(176,200,255,.18)" stroke-width="3"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${f >= 1 ? 'var(--accent)' : 'rgba(242,193,78,.85)'}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - f)).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  }
  function renderHome() {
    home.querySelector('.lh-eyebrow').textContent = ui('learn') || 'Learn';
    home.querySelector('#lh-title').textContent = course ? course.course.title : '';
    home.querySelector('.lh-goal').textContent = course ? course.course.goal : '';
    home.querySelector('.lh-x').innerHTML = ICON.x; home.querySelector('.lh-x').setAttribute('aria-label', ui('close')); home.querySelector('.lh-x').title = ui('close');
    home.querySelector('.lh-more').textContent = ui('moreWays');
    home.querySelector('[data-a=quick]').textContent = ui('quickLessons'); home.querySelector('[data-a=explainer]').textContent = ui('whyChanged');
    if (!course) { bodyEl.innerHTML = `<p class="lh-fail">${esc(ui('loadFailed'))}</p>`; return; }
    if (view.name === 'chapter') return renderChapter();
    const all = lessonList(), done = all.filter((x) => isDone(x.def.id)).length, nx = nextUnfinished();
    const anyProgress = done > 0 || Object.keys(prog.steps).length > 0;
    let cont = '';
    if (all.length) {
      const target = nx || all[0], tl = mdLesson(target.def.id);
      const label = !anyProgress ? ui('startCourse') : nx ? ui('continue') : ui('reviewCourse');
      cont = `<div class="lh-cont"><div class="lh-prog"><span class="lh-prog-n">${esc(ui('progress', { done, total: all.length }))}</span>${tl ? `<span class="lh-prog-next">${esc(ui('continueLesson', { lesson: tl.n, title: tl.title }))}</span>` : ''}</div><button type="button" class="lh-go" data-a="continue">${esc(label)}</button></div>`;
    }
    const cards = CHAPTERS.map((c) => {
      const m = mdChapter(c.id); if (!m) return '';
      const { done: d, total } = chapterProgress(c), has = c.lessons.length > 0, soon = c.status === 'active' && !has, planned = c.status === 'planned';
      const meta = planned ? ui('planned') : soon ? ui('comingSoon') : total === 1 ? ui('lessonCountOne') : ui('lessonCount', { count: total });
      const ringHtml = has ? ring(d, total) : `<span class="lh-ring lh-ring-off" aria-hidden="true"></span>`;
      const prog2 = has ? `<span class="lh-ch-n num">${d}/${total}</span>` : '';
      return `<button type="button" class="lh-ch${has ? '' : ' soon'}${planned ? ' planned' : ''}" data-ch="${c.id}" ${has ? '' : 'disabled aria-disabled="true"'}>
        <span class="lh-ch-ring">${ringHtml}${prog2}</span>
        <span class="lh-ch-t"><span class="lh-ch-no">${esc(ui('chapterN', { n: c.n }))}</span><b>${esc(m.title)}</b><span class="lh-ch-s">${esc(m.summary)}</span><span class="lh-ch-meta">${esc(meta)}</span></span>
      </button>`;
    }).join('');
    bodyEl.innerHTML = `${cont}<div class="lh-grid">${cards}</div>`;
  }
  function renderChapter() {
    const c = CHAPTERS.find((x) => x.id === view.ch), m = mdChapter(view.ch); if (!c || !m) { view = { name: 'home' }; return renderHome(); }
    const rows = c.lessons.map((def) => {
      const ml = mdLesson(def.id), d = isDone(def.id), n = stepsOf(def.id).length;
      return `<li><button type="button" class="lh-ls${d ? ' done' : ''}" data-lesson="${def.id}"><span class="lh-ls-tick" aria-hidden="true">${d ? ICON.tick : `<span class="num">${ml ? ml.n : ''}</span>`}</span><span class="lh-ls-t"><b>${esc(ml ? ml.title : def.id)}</b><span>${esc(ml ? ml.hook : '')}</span></span><span class="lh-ls-go" aria-hidden="true">${!d && n ? `<i class="lh-dots">${STEP_KEYS.map((_, i) => `<u class="${stepsOf(def.id).includes(i) ? 'on' : ''}"></u>`).join('')}</i>` : ''}${ICON.next}</span></button></li>`;
    }).join('');
    const { done, total } = chapterProgress(c);
    bodyEl.innerHTML = `<div class="lh-chhead"><button type="button" class="lh-back" data-a="chapters">${ICON.back}<span>${esc(ui('allChapters'))}</span></button></div>
      <div class="lh-chintro">${ring(done, total, 46)}<div><div class="eyebrow">${esc(ui('chapterN', { n: c.n }))}</div><h3>${esc(m.title)}</h3><p>${esc(m.summary)}</p></div></div><ol class="lh-ls-list">${rows}</ol>`;
  }
  function openHome(opts = {}) {
    if (engine.restoring) { setTimeout(() => openHome(opts), 200); return; }
    if (!P.active && !body.classList.contains('learn-on')) opener = document.activeElement;
    if (opts.chapter) view = { name: 'chapter', ch: opts.chapter }; else if (home.hidden) view = { name: 'home', ch: null };
    renderHome(); home.hidden = false; body.classList.add('learn-on', 'learn-home'); markButtons(true);
    requestAnimationFrame(() => { try { panel.focus({ preventScroll: true }); } catch (e) { /* ignore */ } });
  }
  function closeHome(restoreFocus = true) {
    home.hidden = true; body.classList.remove('learn-home');
    if (!P.active) body.classList.remove('learn-on');
    markButtons(false);
    if (restoreFocus && opener && opener.focus) { try { opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    opener = null;
  }
  function markButtons(on) { for (const b of [$('#lesson-btn'), $('#dk-explain')]) if (b) { b.classList.toggle('on', on); b.setAttribute('aria-expanded', String(on)); } }
  home.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a],[data-ch],[data-lesson]'); if (!t) return;
    if (t.dataset.ch) { view = { name: 'chapter', ch: t.dataset.ch }; renderHome(); bodyEl.scrollTop = 0; return; }
    if (t.dataset.lesson) { startLesson(t.dataset.lesson); return; }
    const act = t.dataset.a;
    if (act === 'close') closeHome();
    else if (act === 'chapters') { view = { name: 'home', ch: null }; renderHome(); }
    else if (act === 'continue') { const nx = nextUnfinished() || lessonList()[0]; if (nx) startLesson(nx.def.id, firstOpenStep(nx.def.id)); }
    else if (act === 'quick') { closeHome(false); body.classList.remove('learn-on'); if (window.__lessons) window.__lessons.show(); }
    else if (act === 'explainer') { closeHome(false); body.classList.remove('learn-on'); const ex = $('#explainer'), b = $('#explain-btn'); if (ex && b && ex.classList.contains('closed')) b.click(); }
  });
  const firstOpenStep = (id) => { const s = stepsOf(id); for (let i = 0; i < 4; i++) if (!s.includes(i)) return i; return 0; };

  // ---------------------------------------------------------------- the lesson card
  const card = document.createElement('section');
  card.id = 'lcard'; card.className = 'panel'; card.hidden = true; card.tabIndex = -1; card.setAttribute('role', 'region');
  card.innerHTML = `<div class="lc-top"><span class="lc-no num"></span><span class="lc-title"></span><span class="lc-step"></span><button type="button" class="lc-exit" data-a="exit"></button></div>
    <ol class="lc-prog"></ol>
    <div class="lc-body" aria-live="polite" aria-atomic="true"><p class="lc-text"></p><p class="lc-note"></p><div class="lc-opts" role="group"></div></div>
    <div class="lc-tool" hidden></div>
    <div class="lc-ctl"></div>`;
  body.appendChild(card);
  const el = { no: card.querySelector('.lc-no'), title: card.querySelector('.lc-title'), step: card.querySelector('.lc-step'), prog: card.querySelector('.lc-prog'), text: card.querySelector('.lc-text'), note: card.querySelector('.lc-note'), opts: card.querySelector('.lc-opts'), tool: card.querySelector('.lc-tool'), ctl: card.querySelector('.lc-ctl'), exit: card.querySelector('.lc-exit') };

  // The card covers the bottom of the sky. Shift the view up by half the covered height (a camera view offset: projection, picking and labels all
  // follow) so what a lesson frames sits in the free part of the screen. Measured when a lesson starts and on resize, so it never jumps mid-lesson.
  let offKey = '';
  function applyViewOffset(force) {
    const cam = a.cam, W = window.innerWidth, H = window.innerHeight;
    let dy = 0;
    if (P.active && !card.hidden && !root.classList.contains('land')) {
      const r = card.getBoundingClientRect();
      if (r.height > 0 && r.top > H * 0.4) dy = Math.round(Math.min((H - r.top) / 2, H * 0.2));
    }
    const key = `${W}x${H}:${dy}`; if (key === offKey && !force) return; offKey = key;
    if (dy) cam.setViewOffset(W, H, 0, dy, W, H); else cam.clearViewOffset();
  }
  window.addEventListener('resize', () => requestAnimationFrame(() => applyViewOffset(true)));

  // player state
  const P = { active: false, starting: false, def: null, ch: null, X: null, step: 0, token: 0, tryDone: false, tryShown: false, finished: false, watching: false, chk: null, poll: 0, okSince: 0, hintTimer: 0, wrongKey: '', opts: null, picked: new Set(), caption: '', textMode: '' };

  function setText(t, mode = '') { P.caption = t; P.textMode = mode; if (el.text.textContent !== t) el.text.textContent = t; el.text.classList.toggle('cap', mode === 'cap'); el.text.classList.toggle('wrong', mode === 'wrong'); }
  function setNote(t, cls = '') { el.note.textContent = t || ''; el.note.className = 'lc-note' + (cls ? ' ' + cls : ''); el.note.hidden = !t; }
  const keysOf = () => (P.chk && P.chk.keys ? P.chk.keys(P.X) : null) || { prompt: 'try.prompt', hint: 'try.hint', success: 'try.success' };

  function renderCard() {
    const md = mdLesson(P.def.id);
    el.no.textContent = md ? md.n : ''; el.title.textContent = md ? md.title : '';
    card.setAttribute('aria-label', `${md ? md.n : ''} ${md ? md.title : ''}`.trim());
    el.step.textContent = ui(STEP_UI[P.step]);
    const done = stepsOf(P.def.id);
    el.prog.innerHTML = STEP_KEYS.map((k, i) => `<li class="${i === P.step ? 'cur' : done.includes(i) ? 'done' : ''}" ${i === P.step ? `aria-current="step" aria-label="${esc(ui('stepOf', { n: i + 1, title: ui(STEP_UI[i]) }))}"` : ''}><i></i><span>${esc(ui(STEP_UI[i]))}</span></li>`).join('');
    el.exit.innerHTML = `${ICON.x}<span>${esc(ui('exit'))}</span>`; el.exit.setAttribute('aria-label', ui('exitLabel')); el.exit.title = ui('exitLabel');
    renderControls();
  }
  function btn(act, label, cls = '', extra = '') { return `<button type="button" class="lc-btn ${cls}" data-a="${act}" ${extra}>${label}</button>`; }
  function renderControls() {
    const focus = document.activeElement && card.contains(document.activeElement) ? document.activeElement.dataset.a : null;
    const backB = btn('back', ICON.back, 'icon', `aria-label="${esc(ui('back'))}" title="${esc(ui('back'))}" ${P.step === 0 ? 'disabled' : ''}`);
    const nextB = btn('next', `<span>${esc(ui('next'))}</span>${ICON.next}`, 'primary');
    let h = backB;
    if (P.step === 0) h += btn('replay', esc(reduced && !P.watchedOnce ? ui('watchPlay') : ui('replay')), 'alt') + nextB;
    else if (P.step === 1) {
      if (P.tryDone) h += nextB;
      else h += btn('show', esc(ui('showMe')), 'alt') + btn('skip', esc(ui('skip')), 'ghost');
    } else if (P.step === 2) h += nextB;
    else if (!P.finished) h += btn('finish', `<span>${esc(ui('finish'))}</span>${ICON.tick}`, 'primary');
    else { const nx = nextLessonAfter(P.def.id); h += nx ? btn('nextlesson', `<span>${esc(ui('nextLesson'))}</span>${ICON.next}`, 'primary') : btn('exit', `<span>${esc(ui('backToLearn'))}</span>`, 'primary'); }
    el.ctl.innerHTML = h;
    if (focus) { const t = el.ctl.querySelector(`[data-a=${focus}]`) || el.ctl.querySelector('.primary'); if (t) t.focus({ preventScroll: true }); }
  }
  const nextLessonAfter = (id) => { const l = lessonList(), i = l.findIndex((x) => x.def.id === id); return i >= 0 && i + 1 < l.length ? l[i + 1] : null; };

  // ---------------------------------------------------------------- steps
  /** Try steps must not hand over the answer: the pole marker's "pole star: ..." line and the name labels of the stars the Try declares (hideLabels: [HIP...]) are hidden until the step ends or is solved. */
  let hiddenLbls = [];
  function hideAnswerLabels(def, chk, x) {
    body.classList.add('learn-nopolestar');
    const list = [def.hideLabels, chk && chk.hideLabels].flatMap((h) => (typeof h === 'function' ? h(x) : h) || []);
    const items = (a.labels && a.labels.items) || [];
    for (const key of list) {                                  // a HIP number hides a star's name; a string hides any label with that text (a cluster, a planet)
      const i = typeof key === 'number' ? a.data.hipIndex.get(key) : -1;
      for (const it of items) if ((typeof key === 'number' && it.si === i && it.group === 'star') || (typeof key === 'string' && it.text === key)) { it.hidden = true; hiddenLbls.push(it); }
    }
  }
  function showAnswerLabels() { body.classList.remove('learn-nopolestar'); for (const it of hiddenLbls) it.hidden = false; hiddenLbls = []; }
  function endStep() {
    showAnswerLabels(); card.classList.remove('choice'); clearTimeout(P.wrongTimer);
    clearInterval(P.poll); clearTimeout(P.hintTimer); P.poll = 0; P.okSince = 0;
    engine.stop(); ov.clear(); body.classList.remove('learn-nopolelbl'); (K.cleanups || []).splice(0).forEach((f) => { try { f(); } catch (e) { console.error(e); } }); P.watching = false; P.chk = null; P.opts = null; P.picked = new Set(); P.wrongKey = '';
    el.opts.innerHTML = ''; el.opts.hidden = true; el.tool.hidden = true; el.tool.innerHTML = '';
    setNote('');
  }
  function setStep(i) {
    endStep();
    P.step = i; const tok = ++P.token; P.tryDone = false; P.tryShown = false; P.ready = false;
    setText(''); renderCard();
    [runWatch, runTry, runOld, runTonight][i](tok);
  }
  const X = () => P.X;
  /** Every step starts from the user's own place and clock, looking at the sky (not the globe). */
  async function homeAndClock(keepAway) {
    if (!(keepAway && K.awayName)) { await X().goHome(); X().resetClock(); }      // a Watch that travelled for this lesson leaves us there for its Try
    if (S.mode !== 'sky') { await D.prep(); await D.toSky(S.sky.az, S.sky.alt, S.sky.fov); }
  }

  async function runWatch(tok) {
    const md = mdLesson(P.def.id);
    setText(md ? md.hook : '', '');
    if (reduced && !P.watchedOnce) { renderControls(); return; }
    await playWatch(tok);
  }
  async function playWatch(tok) {
    P.watching = true; P.watchedOnce = true; ov.clear(); renderControls();
    const ok = await engine.runScript(async () => { await homeAndClock(); await P.def.watch(X()); }, { onCaption: (t) => { if (tok === P.token) setText(t, 'cap'); } });
    if (tok !== P.token) return;
    P.watching = false;
    if (ok) markStep(P.def.id, 0);
    renderCard();
  }

  async function runTry(tok) {
    const x = X(), def = P.def;
    P.chk = typeof def.try === 'function' ? def.try(x) : def.try;
    if (P.chk.reset) P.chk.reset(x);
    hideAnswerLabels(def, P.chk, x);
    x.stageChanged = (k) => { if (tok !== P.token) return; P.wrongKey = ''; setNote(''); renderTry(); };
    x.tryT0 = S.time; renderTry(); setNote('');
    await engine.runScript(async (d) => {
      await homeAndClock(true);
      if (def.trySetup) await def.trySetup(x); else { await d.prep(); await d.toSky(S.sky.az, S.sky.alt, S.sky.fov); }
    }, { onCaption: () => {} });
    if (tok !== P.token) return;
    x.tryT0 = S.time; x.justShown = false; a.select(null);
    P.ready = true; renderTry();
    P.hintTimer = setTimeout(() => { if (tok === P.token && !P.tryDone) setNote(`${ui('hintLead')} ${x.T(keysOf().hint)}`, 'hint'); }, 22000);
    if (P.chk.kind === 'choice') return;
    P.poll = setInterval(() => { if (tok === P.token) pollTry(tok); }, 130);
  }
  function renderTry() {
    const x = X(), k = keysOf();
    setText(x.T(k.prompt), '');
    card.classList.toggle('choice', P.chk.kind === 'choice');
    if (!P.ready) return;                  // the options and controls wait until the sky is set up (a tap during the set-up would act on a sky that is still moving)
    renderTool();
    if (P.chk.kind === 'choice') {
      if (!P.opts) P.opts = P.chk.options(x);
      el.opts.hidden = false;
      el.opts.innerHTML = P.opts.map((o) => `<button type="button" class="lc-opt" data-opt="${esc(o.id)}" ${P.tryDone || P.picked.has(String(o.id)) ? 'disabled' : ''}>${esc(o.text)}</button>`).join('');
    }
  }
  function pollTry(tok) {
    const x = X(); if (!P.chk || P.tryDone) return;
    let r; try { r = P.chk.test(x); } catch (e) { console.error(e); return; }
    syncTool();
    if (r === true) {
      const hold = P.chk.hold ?? 450, now = performance.now();
      if (!P.okSince) P.okSince = now;
      if (now - P.okSince >= hold) tryOk(tok);
    } else {
      P.okSince = 0;
      if (r && r.wrong) { const key = JSON.stringify(r.vars || {}); if (key !== P.wrongKey) { P.wrongKey = key; setNote(x.T('try.wrong', r.vars || {}), 'wrong'); } }
      else if (P.wrongKey) { P.wrongKey = ''; setNote(''); }
    }
  }
  function tryOk(tok, shown) {
    if (tok !== P.token || P.tryDone) return;
    clearInterval(P.poll); clearTimeout(P.hintTimer);
    P.tryDone = true; P.tryShown = !!shown; showAnswerLabels();
    markStep(P.def.id, 1); renderTool();
    setText(X().T(keysOf().success), 'ok'); setNote(shown ? ui('shownLine') : '', shown ? 'hint' : '');
    el.opts.querySelectorAll('.lc-opt').forEach((b) => { b.disabled = true; });
    renderControls();
  }
  async function showMe() {
    const tok = P.token, x = X(), chk = P.chk; if (!chk || P.tryDone || !P.ready) return;
    clearInterval(P.poll); clearTimeout(P.hintTimer); P.poll = 0; P.okSince = 0; setNote('');
    const ok = await engine.runScript(async () => { await chk.show(x); }, { onCaption: () => {} });
    if (tok !== P.token) return;
    if (chk.kind === 'choice') { const c = String(chk.correct(x)); el.opts.querySelectorAll('.lc-opt').forEach((b) => b.classList.toggle('right', b.dataset.opt === c)); }
    tryOk(tok, true);
  }
  el.opts.addEventListener('click', (e) => {
    const b = e.target.closest('[data-opt]'); if (!b || !P.chk || P.tryDone) return;
    const id = P.opts.find((o) => String(o.id) === b.dataset.opt).id, r = P.chk.answer(X(), id);
    if (r === true) { b.classList.add('right'); tryOk(P.token); }
    else {
      P.picked.add(String(id)); b.disabled = true; b.classList.add('wrong');
      // the feedback takes the place of the question for a few seconds, so the options never slide out of sight
      const tok = P.token; setText(X().T('try.wrong', (r && r.vars) || {}), 'wrong');
      clearTimeout(P.wrongTimer); P.wrongTimer = setTimeout(() => { if (tok === P.token && !P.tryDone) setText(X().T(keysOf().prompt), ''); }, 4500);
    }
  });

  // the small controls a Try step may ask for (checker.controls)
  const fmtH = (h) => { const r = Math.round(h * 10) / 10, s = r > 0 ? '+' : r < 0 ? '−' : ''; return ui('hoursShown', { hours: s + Math.abs(r).toFixed(Math.abs(r) % 1 ? 1 : 0) }); };
  /** A checker may bring its own small control: chk.tool before success, chk.keepTool after it ({ html(X), sync(X, el), onAct(X, act, btn), onInput(X, value) }). */
  const toolSpec = () => (P.chk ? (P.tryDone ? P.chk.keepTool : P.chk.tool) || null : null);
  function renderTool() {
    const spec = toolSpec(), t = el.tool;
    if (spec) { t.hidden = false; t.dataset.kind = 'spec'; t.innerHTML = spec.html(X()); syncTool(); return; }
    const c = P.chk && P.chk.controls;
    if (!c) { t.hidden = true; t.innerHTML = ''; return; }
    t.hidden = false; t.dataset.kind = c;
    if (c === 'hours') t.innerHTML = `<button type="button" class="lc-step-b" data-t="-1">${esc(ui('minusHour'))}</button><output class="lc-val num">${fmtH(0)}</output><button type="button" class="lc-step-b" data-t="1">${esc(ui('plusHour'))}</button>`;
    else if (c === 'scrub') t.innerHTML = `<label class="lc-lab2">${esc(ui('scrubLabel'))}</label><input type="range" min="-720" max="720" step="5" value="0" aria-label="${esc(ui('scrubLabel'))}"><output class="lc-val num">${fmtH(0)}</output>`;
    else if (c === 'lat') t.innerHTML = `<label class="lc-lab2">${esc(ui('latLabel'))}</label><input type="range" min="-90" max="90" step="0.5" value="${S.obs.lat.toFixed(1)}" aria-label="${esc(ui('latLabel'))}"><output class="lc-val num"></output>`;
    else if (c === 'year') t.innerHTML = `<label class="lc-lab2">${esc(ui('yearLabel'))}</label><input type="range" min="-183" max="183" step="1" value="${Math.round(S.yd)}" aria-label="${esc(ui('yearLabel'))}"><output class="lc-val num"></output>`;
    else if (c === 'days') t.innerHTML = `<button type="button" class="lc-step-b" data-d="-1">${esc(ui((P.def && P.def.dayKeys || [])[0] || 'prevDawn'))}</button><output class="lc-val num"></output><button type="button" class="lc-step-b" data-d="1">${esc(ui((P.def && P.def.dayKeys || [])[1] || 'nextDawn'))}</button>`;
    else if (c === 'ages') t.innerHTML = `<label class="lc-lab2">${esc(ui('agesLabel'))}</label><input type="range" min="${-SLIDER_MAX}" max="${SLIDER_MAX}" step="1" value="${Math.round(yearsToSlider(S.ages.years))}" aria-label="${esc(ui('agesLabel'))}"><output class="lc-val num"></output>`;
    syncTool();
  }
  function syncTool() {
    const spec = toolSpec(); if (spec) { if (spec.sync && !el.tool.hidden) spec.sync(X(), el.tool); return; }
    const c = P.chk && P.chk.controls, t = el.tool; if (!c || t.hidden || t.dataset.kind !== c) return;
    const out = t.querySelector('output'), inp = t.querySelector('input'), x = X();
    const dh = (S.time - (x.tryT0 || S.time)) / 3600e3;
    if (c === 'hours') out.textContent = fmtH(dh);
    else if (c === 'scrub') { out.textContent = fmtH(dh); if (document.activeElement !== inp) inp.value = String(Math.max(-720, Math.min(720, Math.round(dh * 12) * 5))); }
    else if (c === 'year') { out.textContent = x.dateNow(); if (document.activeElement !== inp) inp.value = String(Math.max(-183, Math.min(183, Math.round(S.yd)))); }
    else if (c === 'days') out.textContent = K.dateText(S.time, S.obs.lon);
    else if (c === 'ages') { out.textContent = formatYear(S.ages.baseYear + S.ages.years).text; if (document.activeElement !== inp) inp.value = String(Math.round(yearsToSlider(S.ages.years))); }
    else { out.textContent = `${Math.abs(S.obs.lat).toFixed(1)}°${S.obs.lat >= 0 ? 'N' : 'S'}`; if (document.activeElement !== inp) inp.value = S.obs.lat.toFixed(1); }
  }
  const setTime = (ms) => { S.playing = false; a.syncPlay(); S.time = ms; S.anchor = ms; a.updateCelestial(true); };
  el.tool.addEventListener('click', (e) => { const sp = toolSpec(); if (sp) { const sb = e.target.closest('[data-act]'); if (sb && sp.onAct) { sp.onAct(X(), sb.dataset.act, sb); syncTool(); } return; } const b = e.target.closest('[data-t],[data-d]'); if (!b) return; if (b.dataset.d && P.def && P.def.stepDays) P.def.stepDays(X(), +b.dataset.d); else setTime(S.time + (b.dataset.d ? (+b.dataset.d) * 864e5 : (+b.dataset.t) * 3600e3)); syncTool(); });
  el.tool.addEventListener('input', (e) => {
    const inp = e.target.closest('input'); if (!inp) return;
    const sp = toolSpec(); if (sp) { if (sp.onInput) sp.onInput(X(), inp.value); syncTool(); return; }
    if (el.tool.dataset.kind === 'scrub') setTime(X().tryT0 + (+inp.value) * 60e3);
    else if (el.tool.dataset.kind === 'year') { S.playing = false; a.syncPlay(); X().setYd(+inp.value); }
    else if (el.tool.dataset.kind === 'ages') { S.playing = false; a.syncPlay(); a.setYears(sliderToYears(+inp.value), true); }
    else if (el.tool.dataset.kind === 'lat') a.placeInstant({ lat: +inp.value, lon: S.obs.lon });
    syncTool();
  });

  function runOld(tok) {
    setText(X().T('oldway.text'), '');
    markStep(P.def.id, 2); renderCard();
    if (P.def.oldWay) engine.runScript(async () => { await homeAndClock(); await P.def.oldWay(X()); }, { onCaption: () => {} });
  }
  function runTonight(tok) {
    const x = X(), P0 = K.homeCtx(), key = P.def.tonightKey ? P.def.tonightKey(P0) : 'text';
    setText(x.T('tonight.' + key), ''); markStep(P.def.id, 3); renderCard();
  }

  // ---------------------------------------------------------------- lesson start / finish / exit
  async function startLesson(id, step = 0) {
    const L = lessonList().find((x) => x.def.id === id); if (!L || P.starting) return;
    if (!course) return;
    P.starting = true;
    try {
      if (engine.restoring) { await new Promise((r) => { const t = setInterval(() => { if (!engine.restoring) { clearInterval(t); r(); } }, 80); }); }
      closeHome(false); body.classList.add('learn-on', 'learn-play');
      if (!P.active) {
        const snap = await engine.begin();
        K.home = { lat: snap.lat, lon: snap.lon, place: K.placeShort(snap.lat, snap.lon), time: snap.time, follow: snap.follow };
      }
      P.active = true; P.def = L.def; P.ch = L.ch; P.X = K.makeX(L.def); P.finished = isDone(L.def.id); P.watchedOnce = false;
      prog.last = L.def.id; saveProg();
      card.hidden = false;
      setStep(step);
      requestAnimationFrame(() => { applyViewOffset(true); try { card.focus({ preventScroll: true }); } catch (e) { /* ignore */ } });
    } finally { P.starting = false; }
  }
  function finishLesson() { markDone(P.def.id); P.finished = true; renderCard(); setText(`${ui('lessonDone')}.`, 'ok'); }
  async function exitPlayer(toHome = true) {
    if (!P.active) return;
    const ch = P.ch; P.token++; endStep();
    card.hidden = true; P.active = false; body.classList.remove('learn-play'); applyViewOffset(true);
    try { if (K.beforeExit) await K.beforeExit(); await engine.end({ instant: true }); } catch (e) { console.error(e); }
    K.awayName = '';
    if (toHome) openHome({ chapter: ch ? ch.id : null }); else { body.classList.remove('learn-on'); }
  }
  async function leaveAll() { if (P.active) await exitPlayer(false); closeHome(false); body.classList.remove('learn-on'); }

  card.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a]'); if (!t || t.disabled) return;
    const act = t.dataset.a;
    if (act === 'exit') exitPlayer(true);
    else if (act === 'back') { if (P.step > 0) setStep(P.step - 1); }
    else if (act === 'next') goNext();
    else if (act === 'replay') { const tok = P.token; engine.stop(); ov.clear(); playWatch(tok); }
    else if (act === 'show') showMe();
    else if (act === 'skip') { markStep(P.def.id, 1); setStep(2); }
    else if (act === 'finish') finishLesson();
    else if (act === 'nextlesson') { const nx = nextLessonAfter(P.def.id); if (nx) { P.finished = false; P.def = nx.def; P.ch = nx.ch; P.X = K.makeX(nx.def); prog.last = nx.def.id; P.finished = isDone(nx.def.id); P.watchedOnce = false; setStep(0); } }
  });
  function goNext() { if (P.step < 3) setStep(P.step + 1); else if (!P.finished) finishLesson(); else card.querySelector('[data-a=nextlesson]') && card.querySelector('[data-a=nextlesson]').click(); }

  // ---------------------------------------------------------------- keys
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = e.target.matches && e.target.matches('input, textarea, select');
    if (e.key === 'Escape') {
      if (P.active) { e.preventDefault(); e.stopPropagation(); exitPlayer(true); }
      else if (!home.hidden) { e.preventDefault(); e.stopPropagation(); closeHome(); }
      return;
    }
    if ((!P.active && home.hidden) || typing) return;
    // Explore's own shortcuts (G globe, S sky, Space play/pause) must not change the sky behind the home sheet or leave a lesson's sky
    if (['g', 'G', 's', 'S'].includes(e.key) || (e.key === ' ' && !(e.target.matches && e.target.matches('button')))) { e.stopPropagation(); if (e.key === ' ') e.preventDefault(); return; }
    if (!P.active) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); if (P.step === 1 && !P.tryDone) { markStep(P.def.id, 1); setStep(2); } else goNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); if (P.step > 0) setStep(P.step - 1); }
  }, true);

  // the toolbar and dock Learn buttons
  const learnBtn = $('#lesson-btn'), dockBtn = $('#dk-explain');
  learnBtn && learnBtn.addEventListener('click', (e) => { e.stopPropagation(); if (!home.hidden) closeHome(); else openHome(); });
  window.__learn = {
    open: () => openHome(), close: () => leaveAll(), start: startLesson, exit: () => exitPlayer(true), step: (i) => setStep(i),
    get state() { return { active: P.active, step: P.step, lesson: P.def && P.def.id, tryDone: P.tryDone, finished: P.finished, watching: P.watching, prog }; },
    P, kit: K, ov, course: () => course, progress: () => prog, resetProgress() { prog = { v: 1, done: {}, steps: {}, last: null }; saveProg(); },
  };
  window.__learnReady = true;
}
