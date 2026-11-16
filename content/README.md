# Course text: how `content/<lang>/course.md` works

Every sentence the Learn area shows lives in one Markdown file per language: `content/en/course.md`.
The app fetches it at run time (`js/course/text.js`), so editing the file changes the app. JavaScript holds only lesson
*logic*, keyed by stable ids (`js/course/ch1.js` ...). The file is meant to be read and reviewed as an ordinary document.

## The format in five lines

1. Headings carry a stable id in braces: `# Chapter 1 {#ch1}`, `## Lesson 1.3 {#l1.3}`, `### Watch {#watch}`. The words before the brace are for human readers only; the id is what the app uses.
2. Under a heading, every entry is one `key: text` line (key starts with a lower-case letter; letters, digits, `.`, `_`, `-`). A long entry may continue on following lines that start with spaces. Leave a blank line between entries.
3. `{name}` is a live value (see the list below). `[src:id]` after a claim names its source in `content/en/SOURCES.md`; the app strips it before showing the text.
4. `<!-- comments -->` and lines starting with `>` are ignored. Plain text only: no Markdown emphasis, no HTML.
5. Lists inside one value (a few interface strings) are separated by `|` and keep their order.

## Structure

```
# The course {#course}          title, goal
# Interface {#ui}               every button, label and small phrase
# Chapter N {#chN}              title, summary           (ch1 ... ch8)
## Lesson N.M {#lN.M}           title, hook              (the card in the chapter list)
### Watch {#watch}              one-line captions, c1, c2 ... (what the demo says while it runs)
### Try {#try}                  prompt, hint, success (+ wrong, option ..., depending on the lesson)
### The old way {#oldway}       text   (2-3 sentences of ancestral knowledge, each claim tagged [src:id])
### Tonight outside {#tonight}  text, or variants chosen by the lesson (north, south, visible, below ...)
```

Every lesson must have: `title`, `hook`, `try.prompt`, `try.hint`, `try.success`, `oldway.text`, at least one `watch.*` and at least one `tonight.*` entry.
Further keys (`watch.c3`, `try.wrong`, `tonight.north` ...) are listed per lesson in the `keys` array of its JS definition.
`node tools/check_course.mjs` compares the two and fails on any mismatch.

## What must not be changed when translating

* the `{#ids}` in headings, and the keys (the text before the colon);
* the `{placeholders}` (translate the sentence around them, keep the braces and the name);
* the `[src:id]` tags (keep them right after the claim they support);
* the `|` separators and the *order* of the items in `heights` and `compass`, and the meaning of `eveningTime` (the app computes
  "tonight" at 21:00 local solar time; if the word for that hour differs in your language, translate `eveningTime` only).

## Placeholders

Live values, filled in when a text is shown. A text never needs to know the numbers; it just names them.
Texts in `### Tonight outside` use the **user's own place** (the place saved in Explore) and tonight's real evening; every other text uses the
place the sky is showing at that moment (a Watch step may have travelled somewhere else, then `{place}` is that place).

| Placeholder | Meaning | Example |
|---|---|---|
| `{place}` | name of the place | Rome |
| `{lat}` | latitude without sign, 1 decimal | 41.9 |
| `{latTxt}` | latitude with N or S | 41.9°N |
| `{poleAlt}` | height of the visible celestial pole, whole degrees (= latitude) | 42 |
| `{pole}` | `north` or `south` | north |
| `{poleName}` | "the pole star" in the north, "the south celestial pole" in the south | the pole star |
| `{fistsToPole}` | whole 10° fists from horizon to the pole | 4 |
| `{localEveningTime}` | the evening hour used for "tonight" (interface string `eveningTime`) | 9 pm |
| `{homePlace}` | the user's own place, even during a trip | Rome |
| `{awayPlace}` | the place a Watch step travelled to (empty at home) | Sydney |
| `{name}` | the star the user tapped by mistake (in `try.wrong`) | Vega |
| `{label}` | a multiple-choice option's number (in `try.option`) | 4 |
| `{dipperWhere}` | where the Big Dipper is at the evening hour (1.3) | high in the north-east, about 55° up |
| `{crossWhere}` | where the Southern Cross is at the evening hour (1.4) | low in the south, about 20° up |
| `{circumpolarNames}` | two constellations that never set here (2.3) | Cepheus and Draco |
| `{handStar}` | what makes the star-clock hand (2.4) | the Big Dipper's pointer stars |
| `{handTurn}` | `counter-clockwise` (north) or `clockwise` (south) (2.4) | counter-clockwise |
| `{handClock}` | clock-face position of the hand at the evening hour (2.4) | 10 |
| `{seasonCons}` | the seasonal constellation of the Try in 3.1 (Orion, or Auriga / Carina at far latitudes) | Orion |
| `{eveningNow}` `{eveningLater}` | bright constellations in the evening sky now, and three months on (3.1) | Cygnus, Taurus and Pegasus |
| `{sunConsNow}` | the constellation the Sun is in today, from astronomy-engine (3.2) | Libra |
| `{midnightZodiac}` | the zodiac constellation opposite the Sun, on the midnight meridian (3.2) | Aries |
| `{siriusReturnDate}` | the day Sirius is first seen at dawn at 30°N 31°E by the simple rule (Sun 9.5° down, star 2.5° up), this year (3.3) | 7 August |
| `{dawnPreviewStar}` | the brightest star in the east at 5 am tonight (3.3) | Arcturus |
| `{pleiadesWhere}` | where the Pleiades are tonight, in the evening or at the start of dawn (3.4) | high in the east, about 55° up |
| `{tripDir}` `{poleMove}` | the direction of the Watch trip (north / south) and `climbs` / `sinks` (4.1, passed by the lesson) | north |
| `{neverStar}` `{latToSeeIt}` `{towardsEquator}` `{faceDir}` | the brightest star that never rises at the user's latitude, the latitude to pass to see it, and the directions (4.2) | Canopus, 37°N, south |
| `{sunGap}` `{kmApart}` `{aswanAlt}` `{alexAlt}` `{earthKm}` | the computed noon Sun heights at Aswan and Alexandria at the June solstice, their gap, the distance and the resulting circumference (4.3) | 7.1, 790, 89, 82, 40,000 |
| `{cityNS}` `{kmToCity}` `{cityDir}` `{degDiff}` | a city about 700 km north or south of the user, the distance, direction and the pole-height change (4.3) | Florence, 280, north, 3 |
| `{orionTop}` `{orionBottom}` | which of Betelgeuse and Rigel stands on top in the starting view (4.4, passed by the lesson) | Betelgeuse |
| `{zenithStar}` `{zenithStarTime}` `{zenithMiss}` `{zenithMonth}` | the bright named star whose declination is closest to the latitude, when it crosses the meridian tonight, how near the zenith, and the month it does so at 9 pm (4.4) | Almach, 11:40 pm, almost exactly overhead, March |

Interface strings may use `{n} {total} {done} {count} {chapter} {lesson} {title} {step} {hours} {label} {name} {place} {height} {dir} {alt} {a} {b}`
(see the `# Interface` section; each one is explained by the string it appears in).
Interface strings `months` and `monthsLong` hold twelve names separated by `|` (used for the dates the sky shows).
When a lesson needs a new placeholder, its definition lists it in `placeholders` and this table gains a row.

## Source tags

`[src:kamal]` means "this claim is supported by the entry `kamal` in `content/en/SOURCES.md`". Put the tag after the last claim it covers.
The research notes in that file say which claims are only partly confirmed: use the wording they recommend.
The check tool fails if a tag names an id that is not in `SOURCES.md`.

## Adding a language

1. Copy `content/en/course.md` to `content/<lang>/course.md` (for example `content/fr/course.md`) and translate; keep ids, keys, placeholders and tags.
2. Copy or translate `SOURCES.md` if reviewers need it (the tool only needs the ids to appear there).
3. Run `node tools/check_course.mjs <lang>`; it must print "ok".
4. Add `content/<lang>/course.md` to `PRECACHE` in `sw.js`, and pick the language in `js/learn.js` (`loadCourse('en')`; today the app is English only, so there is no switch yet).

## Checking your edit

```sh
node tools/check_course.mjs        # structure, keys, placeholders, source ids
node tests/course.test.mjs         # the parser and the lesson maths
```
