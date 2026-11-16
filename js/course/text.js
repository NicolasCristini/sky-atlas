// The course text: parser for content/<lang>/course.md, placeholder filling, source-tag stripping.
// Pure (no DOM): used by the app (learn.js) and by tools/check_course.mjs. The format is documented in content/README.md.

/** Placeholders every lesson may use (the values come from learn.js; lessons add their own through `placeholders`). */
export const GLOBAL_PLACEHOLDERS = ['place', 'lat', 'latTxt', 'poleAlt', 'pole', 'poleName', 'localEveningTime', 'homePlace', 'awayPlace', 'fistsToPole', 'name'];
/** Placeholders the interface strings may use. */
export const UI_PLACEHOLDERS = ['n', 'total', 'done', 'chapter', 'lesson', 'title', 'step', 'count', 'hours', 'label', 'name', 'place', 'height', 'dir', 'alt', 'a', 'b'];
export const STEPS = ['watch', 'try', 'oldway', 'tonight'];

const SRC_RE = /[ \t]*\[src:([a-z0-9-]+)\]/g;
const PH_RE = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** Strip [src:id] tags (the app never shows them). Also tidies the space left in front of punctuation. */
export const clean = (s) => String(s).replace(SRC_RE, '').replace(/[ \t]+([.,;:!?])/g, '$1').replace(/ {2,}/g, ' ').trim();
export const sourcesIn = (s) => { const out = []; String(s).replace(SRC_RE, (_, id) => { out.push(id); return ''; }); return out; };
export const placeholdersIn = (s) => { const out = new Set(); String(s).replace(PH_RE, (_, k) => { out.add(k); return ''; }); return out; };

/** Replace {name} with values[name]. Unknown names stay as written and are reported through onMissing(name). */
export function fill(s, values, onMissing) {
  return String(s).replace(PH_RE, (m, k) => {
    const v = values && values[k];
    if (v === undefined || v === null) { if (onMissing) onMissing(k); return m; }
    return String(v);
  });
}

const HEAD = /^(#{1,3})\s+(.*?)\s*\{#([A-Za-z0-9._-]+)\}\s*$/;
const KEY = /^([a-z][A-Za-z0-9_.-]*):(?:\s+(.*)|\s*)$/;

/**
 * Parse course.md. Returns { course, ui, chapters, errors }.
 *   course   {title, goal, ...}
 *   ui       {key: text}
 *   chapters [{id, n, title, summary, lessons: [{id, n, title, hook, steps: {watch:{...}, try:{...}, oldway:{...}, tonight:{...}}}]}]
 * Lesson keys other than title/hook live under steps.<step>.<key>; the flat map lesson.keys has 'watch.c1' style names.
 */
export function parseCourse(md) {
  const errors = [], r = { course: {}, ui: {}, chapters: [], errors };
  let chapter = null, lesson = null, step = null, target = null, lastKey = null, where = 'start';
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  let inComment = false;
  const err = (i, m) => errors.push(`line ${i + 1}: ${m}`);
  const put = (i, key, val) => {
    if (!target) { err(i, `"${key}:" outside any section`); return; }
    if (Object.prototype.hasOwnProperty.call(target, key)) { err(i, `duplicate key "${key}"`); return; }
    target[key] = val; lastKey = key;
  };
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (inComment) { if (line.includes('-->')) inComment = false; continue; }
    if (/^\s*<!--/.test(line)) { if (!line.includes('-->')) inComment = true; continue; }
    if (/^\s*$/.test(line)) { lastKey = null; continue; }
    if (/^\s*>/.test(line)) continue;
    const h = HEAD.exec(line);
    if (/^#{1,6}\s/.test(line) && !h) { err(i, 'heading without an {#id} anchor'); continue; }
    if (h) {
      const [, hashes, , id] = h, depth = hashes.length;
      lastKey = null;
      if (depth === 1) {
        chapter = lesson = step = null;
        if (id === 'doc') { where = 'doc'; target = null; }
        else if (id === 'course') { where = 'course'; target = r.course; }
        else if (id === 'ui') { where = 'ui'; target = r.ui; }
        else if (/^ch\d+$/.test(id)) {
          if (r.chapters.some((c) => c.id === id)) err(i, `duplicate chapter ${id}`);
          chapter = { id, n: +id.slice(2), lessons: [] }; r.chapters.push(chapter); where = 'chapter'; target = chapter;
        } else err(i, `unknown top-level section {#${id}}`);
      } else if (depth === 2) {
        lesson = step = null;
        const m = /^l(\d+)\.(\d+)$/.exec(id);
        if (!chapter || !m) { err(i, `lesson heading {#${id}} must be l<chapter>.<n> inside a chapter`); target = null; continue; }
        if (+m[1] !== chapter.n) err(i, `lesson ${id} is inside chapter ${chapter.id}`);
        lesson = { id, n: `${m[1]}.${m[2]}`, steps: {}, keys: {} }; chapter.lessons.push(lesson); where = 'lesson'; target = lesson;
      } else {
        if (!lesson || !STEPS.includes(id)) { err(i, `step heading {#${id}} must be one of ${STEPS.join(', ')} inside a lesson`); target = null; continue; }
        step = id; lesson.steps[step] = lesson.steps[step] || {}; target = lesson.steps[step]; where = 'step';
      }
      continue;
    }
    if (/^\s+\S/.test(line) && lastKey !== null && target) { target[lastKey] += ' ' + line.trim(); continue; }
    const k = KEY.exec(line);
    if (k) {
      if (where === 'doc' || where === 'start') { continue; }
      put(i, k[1], (k[2] || '').trim());
      continue;
    }
    if (where === 'doc' || where === 'start') continue;       // free prose is allowed in the document header
    err(i, `not a "key: text" line: ${line.trim().slice(0, 60)}`);
  }
  // flatten the lesson keys
  for (const c of r.chapters) { c.title = c.title || ''; c.summary = c.summary || ''; for (const l of c.lessons) { l.title = l.title || ''; l.hook = l.hook || ''; } }
  for (const c of r.chapters) for (const l of c.lessons) {
    for (const s of STEPS) for (const [k, v] of Object.entries(l.steps[s] || {})) l.keys[`${s}.${k}`] = v;
    l.keys.title = l.title; l.keys.hook = l.hook;
  }
  for (const c of r.chapters) { if (!c.title) errors.push(`chapter ${c.id}: missing title`); if (!c.summary) errors.push(`chapter ${c.id}: missing summary`); }
  return r;
}

let cache = null;
/** Fetch and parse the course text once. Resolves to the parsed object, or null when it cannot be loaded. */
export function loadCourse(lang = 'en') {
  if (!cache) cache = {};
  if (!cache[lang]) {
    cache[lang] = fetch(`content/${lang}/course.md`).then((r) => { if (!r.ok) throw new Error('course.md ' + r.status); return r.text(); })
      .then((t) => { const p = parseCourse(t); if (p.errors.length) console.warn('course.md problems:', p.errors); return p; })
      .catch((e) => { console.error('course text', e); return null; });
  }
  return cache[lang];
}
