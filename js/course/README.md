# Writing a lesson (js/course/)

A lesson is **logic in JavaScript + words in Markdown**, joined by one id. The player (`js/learn.js`), the card, progress, keys, snapshot and restore
are shared: adding a lesson never touches them.

```
content/en/course.md      every sentence (see content/README.md)
js/course/chN.js          the lessons of chapter N (an array of definitions)
js/course/index.js        the chapter list (a chapter with no lessons is shown as "coming soon")
js/course/checks.js       Try checkers          js/course/overlay.js   teaching graphics on the sky
js/course/kit.js          what a lesson sees as X                      js/course/geo.js   pure maths (node-tested)
js/course/text.js         the course.md parser   tools/check_course.mjs  consistency check
```

## 1. The definition

```js
export default [
  {
    id: 'l3.1',                                   // l<chapter>.<number>, in order; the heading in course.md is `## Lesson 3.1 {#l3.1}`
    keys: ['watch.c1', 'watch.c2', 'tonight.text'],   // extra text keys beyond the always-required ones (below)
    placeholders: ['moonWhere'],                  // names of live values this lesson adds
    values: (P, kit) => ({ moonWhere: ... }),     // computes them; P = place context (see below)
    tonightKey: (P) => 'text',                    // which tonight.* entry to show for the user's own sky (default 'text')
    try: facing({ az: 0, tol: 20 }),              // a checker, or (X) => checker when it depends on the live sky
    async trySetup(X) { ... },                    // optional: pose the sky for the Try step (default: leave it)
    async watch(X) { ... },                       // the scripted demo
    async oldWay(X) { ... },                      // optional: something to show while the old-way text is read
  },
];
```

Always required in `course.md`: `title`, `hook`, `try.prompt`, `try.hint`, `try.success`, `oldway.text`. The `keys` array adds the rest;
`watch.*` and `tonight.*` must each appear at least once. `node tools/check_course.mjs` reports missing, extra and unknown keys and placeholders,
and also checks that every `'watch.c1'`-style literal used in the code is listed in `keys`.

## 2. The Watch step: `async watch(X)`

Write it as a script. Every `X.D.*` call stops the script by throwing when the user leaves the step, so there is nothing to clean up.
Overlays are removed automatically at the end of the step.

```js
async watch(X) {
  const { D, ov } = X;
  await D.prep();                                  // pause the clock, leave the quick-lesson state, clear the selection
  await D.toSky(0, 20, 90);                        // az, alt, fov  (enters sky mode from the globe if needed)
  await X.say('watch.c1', 3000);                   // caption from course.md, held for 3 s (0 = leave it up)
  ov.segment(HIP.merak, HIP.dubhe, { extend: 5, color: 'gold' });   // draws on, follows the sky
  await D.wait(3000);
  await X.lapse(3600, 6000, { follow: HIP.dubhe, lines: ['watch.c2', 'watch.c3'] });   // 1 hour per second for 6 s
}
```

Useful on `X` (all in `js/course/kit.js`): `T(key, extra)` / `say(key, ms, extra)` (text with values filled), `ui(key)` (interface string), `hip(h)` (alt/az of a star),
`findTime(pred, hours)` (move the clock to a moment when pred(ms) holds), `goTo(lat, lon)` / `goHome()` / `pickAway('north' | 'south')`
(hemisphere awareness: travel to a place that can show the thing, say so in a caption), `lapse`, `advanceHours`, `tweenTime`, `sweepDays`, `starsNear(point, deg)`,
`handAngle(h)`, `altAt(h, ms)`, `bodyAltAz('Moon')`, `data`, `S` (app state), `a` (the atlas API), `G` (geo maths), `HIP` (star numbers).
Chapters 3 and 4 add: `yearAt(hour)` / `setYd(days)` / `tweenYear(days, ms)` (Year mode: the sky at one local hour, seasons sliding by; **in Year mode the instant is `S.time + S.yd * 864e5`, use `altAt`, not `hip`**), `setClock(ms)`, `dateNow()`, `star(hip)` ({ra, dec}), and on the kit `kit.sunCons(ms)` (astronomy-engine), `kit.dateText`, `kit.list`. `X.D` is the quick-lesson demo
toolkit from `js/lessonui.js` (`prep`, `toSky`, `slew`, `wait`, `travel`, `layer`, `highlight`, `until`, `midAz`, `fovFor` ...).

**Hemisphere rule.** A lesson uses the user's own place when the thing is visible there. When it is not (Polaris from Sydney), the demo says so in a caption
(`watch.away` uses `{awayPlace}`), travels with `X.goTo(...)`, and the `### Tonight outside` text gives the honest local version through `tonightKey(P)`.

## 3. Overlays: `X.ov`

Points: a HIP number, `{ra, dec}`, `'pole'`, `'npole'`, `'spole'`, `'zenith'`, `{az, alt}`, or a function returning one.
Gold is the active construction, pale blue the reference. Everything has a draw-on animation (`grow: ms`, instant with reduced motion).

| Call | Draws |
|---|---|
| `ov.segment(a, b, { extend, color, dash, text, tip })` | great-circle segment; `extend: 5` carries on 5 times the gap past b (pointer lines) |
| `ov.circle(center, radiusDeg, { text })` | small circle round a point (limiting circle, dial rings) |
| `ov.dial(center, radiusDeg, { dir: 'ccw', labels })` | 24-hour dial aligned to the vertical |
| `ov.fists(az, topAlt)` | tick stack of 10° fists up from the horizon |
| `ov.altArc(az, from, to)` / `ov.azArc(alt, from, to)` | arcs on the horizon frame |
| `ov.marker(p, { text, pulse })` / `ov.text(p, str)` | ring, label attached to a sky position |
| `ov.trail(p, { since, tickHours, tickLabel })` | the path a star has drawn since a time |
| `ov.path(points, { upTo, tail, color })` | a track of `{ra, dec}` points that follows the stars (Mars's loop, the pole's circle, a star's proper motion); `upTo` (0..1 or a function) reveals it as time runs |
| `ov.screen((ctx, env) => ...)` | a flat diagram in screen space, redrawn every frame (`js/course/diagrams.js`: Moon inset, Venus chart, eclipse chart) |
| `ov.gline(a, b, opts)`, `ov.garc(a, b, r, { center })`, `ov.gmarker(p, opts)` | **globe mode** (lesson 4.3): points are world positions of the unit Earth (`ov.geo(lat, lon, k)`; `ov.sunDir()` is the Sun's direction); only drawn while the globe shows |
| `ov.clear()` | everything (done for you when a step ends) |

## 4. The Try step: checkers (`js/course/checks.js`)

`facing({az, alt, tol})`, `selected(hip | predicate)`, `timeAdvanced({hours, tol})` (shows a -1 h / +1 h control), `objectAltitude(id, {min, max})`,
`latitudeBetween(a, b)` (shows a latitude slider), `custom(..., { controls: 'year' })` (a slider through the year, with `X.yearAt(21)` in `trySetup`), `{ controls: 'days' }` (Earlier / Next dawn buttons, `stepDays(X, d)` on the lesson; `dayKeys: ['dayPrev', 'dayNext']` on the lesson renames them), `{ controls: 'ages' }` (a slider through the ages in Ages mode: `X.D.timeMode('ages')`, `a.setYears(...)`), `choice({options(X), correct(X)})` (options are `{id, label, text}`), `sequence([...])` (prompts `try.prompt`, `try.prompt2` ...),
`custom((X) => boolean, { controls: 'scrub', show })`. "Show me how" runs the checker's `show(X)` in the demo runner; the player then marks the step done.
`checker.keys = () => ({ prompt, hint, success })` swaps in other text keys (see 2.2 for a sky-dependent Try).

## 5. Values and the user's own place

`values(P, kit)` returns the lesson's placeholders. `P` is a place context: `P.lat`, `P.lon`, `P.abs`, `P.north`, `P.place`, `P.ms`,
`P.star(hip, ms?)` (alt/az), `P.dec(hip)`, `P.where(az, alt)` ("high in the north-east, about 55° up", built from the interface strings),
`P.alwaysCons(n)`, `P.clockOf(hip)`. For `tonight.*` texts it describes the user's saved Explore place at 21:00 local solar time tonight; elsewhere the place the sky shows now.

## 6. Checklist for a new lesson

1. Add the definition to `chN.js` (ids in order).
2. Add its section to `content/en/course.md` (copy an existing lesson as a template; tag every historical claim `[src:id]`).
3. `node tools/check_course.mjs && node tests/course.test.mjs` (add node tests for any new pure maths in `geo.js`).
4. Browser: for each lesson, from a northern and a southern place: Watch runs, graphics sit on the right stars, Try succeeds by hand and with "Show me how", Exit restores the Explore state
   (`tests/learn.harness.js` automates a pass: `__L.run('l3.1')`).
5. Phones: the card must stay within about 140 px (long texts scroll inside it).
