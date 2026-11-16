#!/usr/bin/env node
// Checks that the course text (content/<lang>/course.md) and the lesson logic (js/course/*.js) agree.
//   node tools/check_course.mjs [lang]      default lang: en
// Exits 1 on any problem. No dependencies. Rules are explained in content/README.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lang = process.argv[2] || 'en';
const { parseCourse, GLOBAL_PLACEHOLDERS, UI_PLACEHOLDERS, placeholdersIn, sourcesIn, STEPS } = await import(pathToFileURL(path.join(root, 'js/course/text.js')));
const { CHAPTERS } = await import(pathToFileURL(path.join(root, 'js/course/index.js')));

const problems = [], notes = [];
const bad = (m) => problems.push(m);
const mdPath = path.join(root, 'content', lang, 'course.md');
if (!fs.existsSync(mdPath)) { console.error('missing ' + mdPath); process.exit(1); }
const course = parseCourse(fs.readFileSync(mdPath, 'utf8'));
course.errors.forEach((e) => bad(`course.md: ${e}`));

// ---- sources
const srcPath = path.join(root, 'content', lang, 'SOURCES.md');
const haveSources = fs.existsSync(srcPath), sourcesText = haveSources ? fs.readFileSync(srcPath, 'utf8') : '';
const knownSource = (id) => new RegExp(`(^|[^a-z0-9-])${id.replace(/[-]/g, '\\-')}([^a-z0-9-]|$)`).test(sourcesText);
if (!haveSources) notes.push('SOURCES.md not found: [src:...] ids were not checked');
const checkText = (where, text, allowed) => {
  for (const k of placeholdersIn(text)) if (!allowed.has(k)) bad(`${where}: unknown placeholder {${k}}`);
  for (const id of sourcesIn(text)) if (haveSources && !knownSource(id)) bad(`${where}: [src:${id}] is not in SOURCES.md`);
  const stripped = text.replace(/\[src:[a-z0-9-]+\]/g, '');
  if (/\[src:/.test(stripped)) bad(`${where}: malformed [src:...] tag`);
  if (/[{}]/.test(stripped.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, ''))) bad(`${where}: stray brace`);
};

// ---- ui
const uiAllowed = new Set(UI_PLACEHOLDERS);
for (const [k, v] of Object.entries(course.ui)) { if (!v) bad(`ui.${k}: empty`); checkText(`ui.${k}`, v, uiAllowed); }

// ---- chapters and lessons
const IMPLICIT = ['title', 'hook', 'try.prompt', 'try.hint', 'try.success', 'oldway.text'];
const jsChapters = new Map(CHAPTERS.map((c) => [c.id, c]));
for (const c of course.chapters) if (!jsChapters.has(c.id)) bad(`course.md has chapter ${c.id} that js/course/index.js does not list`);
for (const jc of CHAPTERS) {
  const mc = course.chapters.find((c) => c.id === jc.id);
  if (!mc) { bad(`chapter ${jc.id} is in js/course/index.js but not in course.md`); continue; }
  checkText(`${jc.id} title`, mc.title, new Set()); checkText(`${jc.id} summary`, mc.summary, new Set());
  const jsIds = jc.lessons.map((l) => l.id);
  for (const ml of mc.lessons) if (!jsIds.includes(ml.id)) bad(`course.md has lesson ${ml.id} but js/course/ch${jc.n}.js does not define it`);
  jc.lessons.forEach((jl, idx) => {
    const ml = mc.lessons.find((l) => l.id === jl.id);
    if (!ml) { bad(`lesson ${jl.id} is in js/course/ch${jc.n}.js but not in course.md`); return; }
    const want = `l${jc.n}.${idx + 1}`;
    if (jl.id !== want) bad(`lesson ${jl.id} is number ${idx + 1} in chapter ${jc.n}: its id should be ${want}`);
    const declared = new Set([...IMPLICIT, ...(jl.keys || [])]);
    for (const k of declared) { if (ml.keys[k] === undefined) bad(`${jl.id}: missing text for "${k}"`); else if (!ml.keys[k]) bad(`${jl.id}: empty text for "${k}"`); }
    for (const k of Object.keys(ml.keys)) if (!declared.has(k)) bad(`${jl.id}: course.md has "${k}" but the lesson does not list it in keys`);
    for (const s of STEPS) if (!ml.steps[s]) bad(`${jl.id}: no ### section for ${s}`);
    if (!(jl.keys || []).some((k) => k.startsWith('watch.'))) bad(`${jl.id}: declares no watch.* text`);
    if (!(jl.keys || []).some((k) => k.startsWith('tonight.'))) bad(`${jl.id}: declares no tonight.* text`);
    if (typeof jl.watch !== 'function') bad(`${jl.id}: no watch(X) function`);
    if (!jl.try) bad(`${jl.id}: no try checker`);
    const allowed = new Set([...GLOBAL_PLACEHOLDERS, ...(jl.placeholders || [])]);
    for (const [k, v] of Object.entries(ml.keys)) checkText(`${jl.id} ${k}`, v, allowed);
  });
}
for (const jc of CHAPTERS) if (jc.lessons.length === 0 && jc.status === 'active') notes.push(`chapter ${jc.id} has no lessons yet (shown as "coming soon")`);

// ---- literal text keys used in code must exist
const files = [...fs.readdirSync(path.join(root, 'js/course')).filter((f) => f.endsWith('.js')).map((f) => path.join(root, 'js/course', f)), path.join(root, 'js/learn.js')].filter((f) => fs.existsSync(f));
const DYNAMIC_UI = ['dir.n', 'dir.e', 'dir.s', 'dir.w'];       // built as 'dir.' + letter in the lessons
for (const k of DYNAMIC_UI) if (course.ui[k] === undefined) bad(`ui.${k} is missing`);
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8'), rel = path.relative(root, f);
  for (const m of src.matchAll(/\bui\(\s*'([A-Za-z0-9.]+)'\s*[,)]/g)) if (course.ui[m[1]] === undefined) bad(`${rel}: uses ui text "${m[1]}" that course.md does not define`);
  if (/ch\d\.js$/.test(f)) {
    const lessonOf = (pos) => { let id = null; for (const m of src.matchAll(/id: '(l\d+\.\d+)'/g)) if (m.index < pos) id = m[1]; return id; };
    for (const m of src.matchAll(/'((?:watch|try|tonight|oldway)\.[A-Za-z0-9]+)'/g)) {
      const id = lessonOf(m.index); if (!id) continue;
      const jl = CHAPTERS.flatMap((c) => c.lessons).find((l) => l.id === id);
      if (jl && !IMPLICIT.includes(m[1]) && !(jl.keys || []).includes(m[1])) bad(`${rel}: ${id} uses "${m[1]}" but does not list it in keys`);
    }
  }
}

notes.forEach((n) => console.log('note: ' + n));
if (problems.length) { problems.forEach((p) => console.error('PROBLEM: ' + p)); console.error(`\n${problems.length} problem(s)`); process.exit(1); }
const nl = CHAPTERS.reduce((n, c) => n + c.lessons.length, 0);
console.log(`course.md (${lang}) ok: ${course.chapters.length} chapters, ${nl} lessons with logic, ${Object.keys(course.ui).length} interface strings.`);
