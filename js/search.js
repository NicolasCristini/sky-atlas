// Unified search: combobox over things in the sky (stars, planets, objects: see skysearch.js) and the worldwide GeoNames index of places (lazy, built-in list as instant fallback).
import { searchCities, searchPlaces, loadPlaces, placesReady, onPlaces, parseCoords, norm, popHint, formatCoord } from './cities.js';

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Wrap the matched part of `text` in <mark> (only when normalisation kept string length). */
function hl(text, q) {
  const n = norm(text), i = q ? n.indexOf(q) : -1;
  if (i < 0 || n.length !== text.length) return esc(text);
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}

export function initSearch({ input, list, spinner, live, onPick, sky }) {
  let items = [], idx = -1, lastQ = '';   // items: the pickable rows in order (sky results, then places); idx indexes it
  const ID = 'sg-';
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  list.setAttribute('aria-label', 'Search results');

  function open(v) {
    list.hidden = !v; input.setAttribute('aria-expanded', String(!!v));
    if (!v) input.removeAttribute('aria-activedescendant');
    else fit();
  }
  // keep the list above the on-screen keyboard (visualViewport shrinks when it opens)
  function fit() {
    const vv = window.visualViewport, h = vv ? vv.height : window.innerHeight;
    const top = list.getBoundingClientRect().top - (vv ? 0 : 0);
    const room = Math.max(160, h - top - 12);
    list.style.maxHeight = Math.min(room, 8 * 52 + 16) + 'px';
  }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { if (!list.hidden) fit(); });

  function setSpin(on) { if (spinner) spinner.hidden = !on; }
  const rowAttrs = (i) => `role="option" id="${ID}${i}" data-i="${i}" aria-selected="${i === idx}" class="${i === idx ? 'act' : ''}"`;
  function skyRow(it, i, q) {
    const e = it.e, st = sky.status(e), sub = e.sub.join(' · ');
    const hint = st.hidden ? '' : `<small class="sg-hint ${st.alt >= 0 ? 'up' : ''}">${st.alt >= 0 ? 'up' : 'below horizon'}</small>`;
    const main = `<span class="sg-main"><span class="sg-name">${hl(e.title, q)}</span><span class="sg-sub">${esc(st.hidden ? 'Hidden at this epoch' : sub)}</span></span>`;
    return st.hidden ? `<li role="option" aria-disabled="true" class="sg-off">${main}</li>` : `<li ${rowAttrs(i)}>${main}${hint}</li>`;
  }
  function row(it, i, q) {
    if (it.kind === 'coords') {
      return `<li ${rowAttrs(i)}><span class="sg-main"><span class="sg-name">Go to coordinates</span><span class="sg-sub num">${formatCoord(it.lat, it.lon)}</span></span></li>`;
    }
    const sub = [it.region, it.country].filter(Boolean).join(', ');
    const via = it.via ? ` <span class="sg-via">(${hl(it.via, q)})</span>` : '';
    return `<li ${rowAttrs(i)}><span class="sg-main"><span class="sg-name">${hl(it.name, q)}${via}</span><span class="sg-sub">${esc(sub)}</span></span>${it.pop ? `<small class="sg-pop num">${popHint(it.pop)}</small>` : ''}</li>`;
  }
  function render() {
    const raw = input.value, t = raw.trim();
    if (!t) { items = []; open(false); say(''); return; }
    const c = parseCoords(t);
    const comma = t.indexOf(','), q = norm(comma > 0 ? t.slice(0, comma) : t);
    let place = placesReady() ? searchPlaces(t, 6) : searchCities(t, 6);
    if (placesReady() && place.length < 6) {            // built-in extras the worldwide list lacks (poles, research stations)
      const have = new Set(place.map((p) => norm(p.name)));
      for (const b of searchCities(t, 6)) if (!have.has(norm(b.name)) && place.length < 6) place.push(b);
    }
    const places = (c ? [{ kind: 'coords', lat: c.lat, lon: c.lon }] : []).concat(place).slice(0, 6);
    const hits = sky && !c ? sky.search(t, 5) : [];
    const rows = hits.map((e) => ({ grp: 'sky', e }));
    items = rows.filter((r) => !sky.status(r.e).hidden).concat(places);
    idx = items.length ? 0 : -1; lastQ = q;
    let html = '', n = 0;
    if (rows.length) html += '<li class="sg-group" role="presentation">In the sky</li>' + rows.map((r) => skyRow(r, sky.status(r.e).hidden ? -1 : n++, q)).join('');
    if (places.length) html += (rows.length ? '<li class="sg-group" role="presentation">On Earth</li>' : '') + places.map((it) => row(it, n++, q)).join('');
    if (!html) html = `<li class="sg-empty" role="presentation">${placesReady() ? 'No place found' : 'Loading all places…'}</li>`;
    list.innerHTML = html;
    if (places.length && placesReady()) list.insertAdjacentHTML('beforeend', '<li class="sg-credit" role="presentation">Places: GeoNames, CC BY 4.0</li>');
    open(true);
    if (items.length && idx >= 0) input.setAttribute('aria-activedescendant', ID + idx);
    say(items.length ? `${items.length} results` : 'No results');
  }
  function say(t) { if (live) live.textContent = t; }
  function move(d) {
    if (!items.length) return;
    idx = (idx + d + items.length) % items.length;
    const lis = list.querySelectorAll('li[data-i]');
    lis.forEach((li, i) => { li.classList.toggle('act', i === idx); li.setAttribute('aria-selected', String(i === idx)); });
    input.setAttribute('aria-activedescendant', ID + idx);
    lis[idx].scrollIntoView({ block: 'nearest' });
  }
  function pick(it) {
    if (!it) return;
    open(false); input.value = ''; input.blur(); items = [];
    if (it.grp === 'sky') sky.pick(it.e); else onPick(it);
  }
  function ensureLoaded() {
    if (placesReady()) return;
    setSpin(true);
    loadPlaces().finally(() => setSpin(false));
  }
  onPlaces((st) => { if (st === 'ready' && document.activeElement === input && input.value.trim()) render(); });

  input.addEventListener('focus', ensureLoaded);
  input.addEventListener('input', () => { ensureLoaded(); render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.hidden) render(); else move(e.key === 'ArrowDown' ? 1 : -1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[Math.max(idx, 0)]) pick(items[Math.max(idx, 0)]); }
    else if (e.key === 'Escape') { if (!list.hidden) open(false); else input.blur(); }
    e.stopPropagation();
  });
  list.addEventListener('pointerdown', (e) => { if (e.target.closest('li')) e.preventDefault(); });   // keep focus until click
  list.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) pick(items[+li.dataset.i]); });
  input.addEventListener('blur', () => setTimeout(() => open(false), 120));
}
