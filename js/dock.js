// Phone shell: status line, icon dock, sheets, time pill. Pure DOM glue around the existing panels; the app logic stays in main.js.
// Everything here is inert unless <html> has the "phone" class (set by the inline script in index.html), so desktop and tablet are untouched.
const $ = (s) => document.querySelector(s);
const root = document.documentElement, body = document.body;
const isPhone = () => root.classList.contains('phone');
const atlas = () => window.__atlas;

const place = $('#place'), timebar = $('#timebar'), skyMenu = $('#sky-menu'), layersMenu = $('#layers-menu'), explainer = $('#explainer'), card = $('#card');
const canvas = $('#gl'), input = $('#search'), dock = $('#dock'), pill = $('#time-pill');
const skyBtn = $('#sky-btn'), layersBtn = $('#layers-btn'), exBtn = $('#explain-btn');

// ---------------------------------------------------------------- status line (place left, time right)
(function status() {
  const nm = $('#place-name'), co = $('#place-coords'), stName = $('#st-name'), stCo = $('#st-coords');
  const copy = () => { stName.textContent = nm.textContent; stCo.textContent = co.textContent; $('#st-place').setAttribute('aria-label', `Place: ${nm.textContent}, ${co.textContent}. Search a place, star or planet`); };
  copy();
  const mo = new MutationObserver(copy);
  [nm, co].forEach((el) => mo.observe(el, { childList: true, characterData: true, subtree: true }));

  const v = $('#st-time-v'), k = $('#st-time-k'), solar = $('#solar'), yearBig = $('#year-big'), yearSub = $('#year-sub'), dateOut = $('#date-out');
  let last = '';
  window.__statusTick = function tick() {
    const tm = timebar.dataset.tm || 'day';
    let a, b;
    if (tm === 'ages') { a = yearBig.textContent; b = yearSub.textContent; }
    else { a = solar.textContent; b = tm === 'year' ? dateOut.textContent : 'local solar'; }
    const key = a + '|' + b; if (key === last) return; last = key;
    v.textContent = a; k.textContent = b;
    $('#st-time').setAttribute('aria-label', `Time: ${a}${tm === 'ages' ? '' : ', local solar time'}. Open the time controls`);
  };
})();

// ---------------------------------------------------------------- visual viewport (keyboard): the search sheet rides at the top while typing
function trackViewport() {
  const vv = window.visualViewport;
  const set = () => { root.style.setProperty('--vv-top', (vv ? Math.round(vv.offsetTop) : 0) + 'px'); root.style.setProperty('--vv-h', (vv ? Math.round(vv.height) : window.innerHeight) + 'px'); };
  set();
  if (vv) { vv.addEventListener('resize', set); vv.addEventListener('scroll', set); }
  window.addEventListener('resize', set);
}
trackViewport();

// ---------------------------------------------------------------- sheets
let typingTimer = 0;
const SHEETS = {
  search: {
    btn: '#dk-search', stbtn: '#st-place', el: place,
    open: () => place.classList.contains('sheet-open'),
    set(v) { place.classList.toggle('sheet-open', v); if (!v) { place.classList.remove('typing'); if (document.activeElement === input) input.blur(); } },
  },
  time: {
    btn: '#dk-time', stbtn: '#st-time', el: timebar,
    open: () => timebar.classList.contains('sheet-open'),
    set(v) { timebar.classList.toggle('sheet-open', v); },
  },
  sky: { btn: '#dk-sky', el: skyMenu, open: () => !skyMenu.hidden, set(v) { if (v !== !skyMenu.hidden) skyBtn.click(); } },
  layers: { btn: '#dk-layers', el: layersMenu, open: () => !layersMenu.hidden, set(v) { if (v !== !layersMenu.hidden) layersBtn.click(); } },
  explain: { btn: '#dk-explain-sheet', el: explainer, open: () => !explainer.classList.contains('closed'), set(v) { if (v !== !explainer.classList.contains('closed')) exBtn.click(); } },
};
const NAMES = Object.keys(SHEETS);
const stamp = {}, was = {};
let cardWas = false, explainerWas = false;

const openNames = () => NAMES.filter((n) => SHEETS[n].open());
const cardOpen = () => !card.hidden;

function setBtn(btn, on) { if (!btn) return; btn.classList.toggle('on', on); btn.setAttribute('aria-expanded', String(on)); }
function closeCard() { const a = atlas(); if (a) a.closeCard(); }

/** Reconcile everything with the real state of the panels: one sheet at a time, dock highlight, body flags. */
function sync() {
  if (!isPhone()) { body.classList.remove('sheet-on', 'card-on'); return; }
  const now = performance.now();
  let open = openNames();
  for (const n of NAMES) { const o = open.includes(n); if (o && !was[n]) stamp[n] = now; was[n] = o; }
  const cardNow = cardOpen();
  if (cardNow && !cardWas && open.length) { open.forEach((n) => SHEETS[n].set(false)); open = []; }       // a star card opened: it takes the stage
  else if (cardNow && open.length) { closeCard(); }                                                       // a sheet opened over a card
  cardWas = cardOpen();
  if (open.length > 1) {                                                                                  // keep only the newest
    open.sort((a, b) => stamp[b] - stamp[a]);
    open.slice(1).forEach((n) => SHEETS[n].set(false));
    open = [open[0]];
  }
  for (const n of NAMES) { const on = open.includes(n); setBtn($(SHEETS[n].btn), on); if (SHEETS[n].stbtn) setBtn($(SHEETS[n].stbtn), on); was[n] = on; }
  body.classList.toggle('sheet-on', open.length > 0 || cardOpen());
  body.classList.toggle('card-on', cardOpen());
  refreshPill();
}

function openSheet(name) {
  if (!isPhone()) return;
  const hint = $('#hint'); if (hint && !hint.hidden) $('#hint-ok').click();
  for (const n of NAMES) if (n !== name) SHEETS[n].set(false);
  if (cardOpen()) closeCard();
  SHEETS[name].set(true);
  sync();
  if (name === 'search') focusSearch();
}
function closeSheet(name, focusBack) {
  SHEETS[name].set(false); sync();
  if (focusBack) { const b = $(SHEETS[name].btn); b && b.focus({ preventScroll: true }); }
}
function closeAll(focusBack) {
  const open = openNames();
  NAMES.forEach((n) => SHEETS[n].set(false)); sync();
  if (focusBack && open[0]) { const b = $(SHEETS[open[0]].btn); b && b.focus({ preventScroll: true }); }
}
const toggleSheet = (name) => (SHEETS[name].open() ? closeSheet(name) : openSheet(name));

function focusSearch() {
  // synchronous inside the tap, so iOS raises the keyboard; the sheet is already display:block by now
  try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  if (document.activeElement !== input) requestAnimationFrame(() => { try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } });
}
input.addEventListener('focus', () => { clearTimeout(typingTimer); if (isPhone() && SHEETS.search.open()) place.classList.add('typing'); });
input.addEventListener('blur', () => { clearTimeout(typingTimer); typingTimer = setTimeout(() => { if (document.activeElement !== input) place.classList.remove('typing'); }, 320); });   // late, so a tap on a chip is not lost to a layout jump
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && isPhone()) setTimeout(() => { if (!input.value) closeSheet('search'); }, 0); });
place.addEventListener('click', (e) => { if (isPhone() && e.target.closest('#suggest li[data-i], .chip, #geo')) setTimeout(() => closeSheet('search'), 0); });

// ---------------------------------------------------------------- dock + status taps
dock.addEventListener('click', (e) => {
  e.stopPropagation();                                   // the document-level "click outside closes the menus" handler must not undo an open
  const b = e.target.closest('.dk'); if (!b) return;
  if (b.dataset.sheet) toggleSheet(b.dataset.sheet);
  else if (b.dataset.act === 'mode') toggleMode();
  else if (b.dataset.act === 'learn') { closeAll(); if (window.__learn) window.__learn.open(); }   // "Learn": the course; quick lessons and the explainer are its secondary links
});
$('#st-place').addEventListener('click', (e) => { e.stopPropagation(); toggleSheet('search'); });
$('#st-time').addEventListener('click', (e) => { e.stopPropagation(); toggleSheet('time'); });
pill.addEventListener('click', (e) => { e.stopPropagation(); openSheet('time'); });

function toggleMode() {
  const a = atlas(); if (!a) return;
  const hint = $('#hint'); if (hint && !hint.hidden) $('#hint-ok').click();
  closeAll();
  if (a.S.mode === 'globe') a.enterSky(); else a.leaveSky();
}
function syncMode() {
  const sky = body.classList.contains('mode-sky'), b = $('#dk-mode');
  b.setAttribute('aria-pressed', String(sky));
  $('#dk-mode-t').textContent = sky ? 'Globe' : 'Look up';
  const t = sky ? 'Back to the globe' : 'Look up at the sky from here';
  b.setAttribute('aria-label', t); b.title = t;
}

// tapping the sky while a sheet is open only closes the sheet: the tap never reaches the canvas (no travel, no selection)
window.addEventListener('pointerdown', (e) => {
  if (!isPhone() || e.target !== canvas) return;
  if (openNames().length) { e.stopPropagation(); closeAll(); }
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isPhone() && openNames().length) closeAll(true); }, true);

// ---------------------------------------------------------------- swipe a sheet down by its grab handle (top 36 px)
function attachSwipe(el, onClose) {
  const ZONE = 36; let st = null, touching = false;
  const begin = (y) => { const r = el.getBoundingClientRect(); if (!isPhone() || y < r.top || y - r.top > ZONE) return false; st = { y0: y, dy: 0, lastY: y, lastT: performance.now(), v: 0 }; el.classList.add('sheet-dragging'); el.style.transition = 'none'; return true; };
  const move = (y) => {
    if (!st) return; const t = performance.now();
    st.dy = Math.max(0, y - st.y0); st.v = (y - st.lastY) / Math.max(1, t - st.lastT); st.lastY = y; st.lastT = t;
    el.style.transform = `translateY(${st.dy}px)`; el.style.opacity = String(Math.max(0.35, 1 - st.dy / 280));
  };
  const end = () => {
    if (!st) return; const s = st; st = null;
    const close = s.dy > 70 || (s.v > 0.6 && s.dy > 24);
    el.classList.remove('sheet-dragging');
    if (close) { el.style.transform = ''; el.style.opacity = ''; el.style.transition = ''; onClose(); return; }
    el.style.transition = 'transform 160ms ease, opacity 160ms ease'; el.style.transform = ''; el.style.opacity = '';
    setTimeout(() => { el.style.transition = ''; }, 200);
  };
  el.addEventListener('touchstart', (e) => { touching = true; if (e.touches.length === 1) begin(e.touches[0].clientY); }, { passive: true });
  el.addEventListener('touchmove', (e) => { if (st) { e.preventDefault(); move(e.touches[0].clientY); } }, { passive: false });
  el.addEventListener('touchend', () => { end(); setTimeout(() => { touching = false; }, 400); });
  el.addEventListener('touchcancel', end);
  el.addEventListener('mousedown', (e) => { if (!touching && e.button === 0) begin(e.clientY); });
  window.addEventListener('mousemove', (e) => { if (st && !touching) move(e.clientY); });
  window.addEventListener('mouseup', () => { if (!touching) end(); });
}
NAMES.forEach((n) => attachSwipe(SHEETS[n].el, () => closeSheet(n)));
attachSwipe(card, closeCard);

// ---------------------------------------------------------------- time pill: the clock is never hidden while the Time sheet is closed
const ICON_PLAY = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>';
const ICON_PAUSE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
const DAY_SPEEDS = { 60: '1 min/s', 600: '10 min/s', 3600: '1 h/s' };
let pillKey = '';
function refreshPill() {
  const a = atlas(); let show = false, icon = '', text = '';
  if (a && isPhone()) {
    const S = a.S;
    if (S.tm === 'ages') { show = true; icon = S.playing ? ICON_PLAY : ''; text = $('#year-big').textContent; }
    else if (S.tm === 'year') { show = true; icon = S.playing ? ICON_PLAY : ''; text = $('#date-out').textContent; }
    else if (!S.playing) { show = true; icon = ICON_PAUSE; text = 'paused'; }
    else if (S.speed !== 1) { show = true; icon = ICON_PLAY; text = DAY_SPEEDS[S.speed] || `${S.speed}×`; }
  }
  const key = show + '|' + icon.length + text; if (key === pillKey) return; pillKey = key;
  pill.hidden = !show; if (!show) return;
  $('#tp-icon').innerHTML = icon; $('#tp-text').textContent = text;
  pill.setAttribute('aria-label', `Time: ${text}. Open the time controls`);
}

// ---------------------------------------------------------------- first-run hint wording on phones
const hintLis = document.querySelectorAll('#hint li');
const hintOrig = hintLis[1] ? hintLis[1].innerHTML : '';
let hintExtra = null;
function hintWording(phone) {
  if (!hintLis[1]) return;
  if (phone) {
    hintLis[1].innerHTML = '<b>Tap the globe</b> to travel there, then tap <b>Look up</b> in the bar at the bottom.';
    if (!hintExtra) { hintExtra = document.createElement('li'); hintExtra.innerHTML = 'That bar also holds <b>search</b>, <b>time</b>, <b>sky quality</b>, <b>layers</b> and <b>Learn</b>.'; hintLis[1].after(hintExtra); }
  } else { hintLis[1].innerHTML = hintOrig; if (hintExtra) { hintExtra.remove(); hintExtra = null; } }
}

// ---------------------------------------------------------------- wiring once the app exists
function start() {
  const watch = (el, opts) => new MutationObserver(sync).observe(el, opts);
  watch(skyMenu, { attributes: true, attributeFilter: ['hidden'] });
  watch(layersMenu, { attributes: true, attributeFilter: ['hidden'] });
  watch(explainer, { attributes: true, attributeFilter: ['class'] });
  watch(card, { attributes: true, attributeFilter: ['hidden'] });
  let wasBusy = false, wasJourney = false;
  new MutationObserver(() => {
    syncMode();
    const busy = body.classList.contains('busy'), journey = body.classList.contains('journey');
    if (busy && !wasBusy && isPhone() && SHEETS.search.open()) closeSheet('search');     // a place was picked: the trip begins
    if (journey && !wasJourney && isPhone()) closeAll();                                  // a guided journey: clear the sky
    wasBusy = busy; wasJourney = journey;
  }).observe(body, { attributes: true, attributeFilter: ['class'] });
  syncMode();

  let phoneNow = null;
  const onPhone = () => {
    const p = isPhone(); if (p === phoneNow) return;
    const first = phoneNow === null; phoneNow = p;
    hintWording(p);
    if (p) {
      explainerWas = SHEETS.explain.open();
      NAMES.forEach((n) => SHEETS[n].set(false));                                         // start from sky only
    } else if (!first) {
      place.classList.remove('sheet-open', 'typing'); timebar.classList.remove('sheet-open');
      if (!skyMenu.hidden) skyBtn.click();
      if (!layersMenu.hidden) layersBtn.click();
      if (explainerWas) { SHEETS.explain.set(true); explainerWas = false; }               // back on desktop: the explainer returns
    }
    sync();
  };
  new MutationObserver(onPhone).observe(root, { attributes: true, attributeFilter: ['class'] });
  onPhone();
  setInterval(() => { window.__statusTick(); refreshPill(); }, 300);
  window.__statusTick(); refreshPill();
}
(function wait() { if (atlas()) start(); else setTimeout(wait, 80); })();
