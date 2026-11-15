// App shell: service worker, mobile layout variables, touch wording, iOS "Add to Home Screen" hint.
// Kept separate from main.js so it never blocks or couples to the renderer; every part fails silently.
const root = document.documentElement;
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
};

// ---- service worker: not on the dev server (localhost / 127.0.0.1 : 5177), not with ?nosw ----
(function registerWorker() {
  const dev = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') && location.port === '5177';
  if (dev || /[?&]nosw\b/.test(location.search) || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => { /* plain http, private mode, ... */ }); });
})();

// ---- layout variables: measured heights so sheets/buttons stack above the time bar and below the header ----
(function layoutVars() {
  // --tb-top: distance from the bottom of the viewport to the top of whatever sits at the bottom edge: the time bar on desktop/tablet,
  // the icon dock on phones (portrait). In landscape phones the dock is a column on the right, so only the safe area is reserved.
  const isPhone = () => root.classList.contains('phone');
  const setTop = () => {
    const land = root.classList.contains('land');
    if (isPhone()) {
      const d = document.getElementById('dock'), r = d && d.getBoundingClientRect();
      root.style.setProperty('--tb-top', land ? 'var(--sab)' : Math.max(0, Math.round(window.innerHeight - (r ? r.top : window.innerHeight))) + 'px');
    } else {
      const el = document.getElementById('timebar'), r = el && el.getBoundingClientRect();
      if (r) root.style.setProperty('--tb-top', Math.max(0, Math.round(window.innerHeight - r.top)) + 'px');
    }
  };
  // bottom edge of the header card (desktop) or the status line (phones): the travel HUD and hints hang below it
  const setHdr = () => {
    const el = document.getElementById(isPhone() ? 'status' : 'place'); if (!el) return;
    const r = el.getBoundingClientRect(); root.style.setProperty('--hdr-b', Math.round(r.bottom) + 'px');
  };
  const run = () => { setTop(); setHdr(); };
  run();
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(run); ['timebar', 'place', 'dock', 'status'].forEach((id) => { const el = document.getElementById(id); if (el) ro.observe(el); }); }
  window.addEventListener('resize', run);
  new MutationObserver(run).observe(root, { attributes: true, attributeFilter: ['class'] });   // phone <-> desktop switch
  window.__relayout = run;
})();

// ---- Safari: no pinch/double-tap zoom of the page itself (the canvas handles its own gestures) ----
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));

// ---- touch wording in the first-run hint ----
(function touchHint() {
  if (!window.matchMedia || !matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  const li = document.querySelectorAll('#hint li');
  if (li[0]) li[0].innerHTML = '<b>Drag</b> to turn the globe, <b>pinch</b> to zoom.';
  if (li[2]) li[2].innerHTML = 'In the sky, <b>drag</b> to look around, <b>pinch</b> to zoom the view, and <b>tap any star or planet</b> for its card.';
})();

// ---- "Install on iPhone" hint: iOS Safari only, not when already installed, dismissible ----
(function iosInstall() {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);                // only Safari can add to the Home Screen reliably
  if (!ios || standalone || otherBrowser || ls.get('skyatlas.ios-hint') === '1') return;
  const el = document.createElement('div');
  el.id = 'ios-hint'; el.className = 'panel'; el.setAttribute('role', 'note');
  el.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg><span><b>Install Sky Atlas</b><br>Tap Share, then Add to Home Screen.</span><button class="icon-btn" aria-label="Dismiss" title="Dismiss"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  el.hidden = true; document.body.appendChild(el);
  el.querySelector('button').addEventListener('click', () => { el.hidden = true; ls.set('skyatlas.ios-hint', '1'); });
  const welcome = document.getElementById('hint');
  const show = () => { if (!welcome || welcome.hidden) { el.hidden = false; return true; } return false; };
  const start = () => { if (show() || !welcome) return; new MutationObserver((_, mo) => { if (welcome.hidden) { mo.disconnect(); setTimeout(show, 1500); } }).observe(welcome, { attributes: true, attributeFilter: ['hidden'] }); };
  setTimeout(start, 2500);
})();
