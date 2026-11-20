# StarSight

Pick any place on a 3D globe, see the sky from there, and understand **why the sky changes with where you stand**.

- **Globe mode**: orbit the Earth (drag, wheel / pinch), with a real star field behind it, day/night shading from the true Sun, and the teaching geometry at your pin: horizon disc, zenith line, sky-dome hemisphere, the Earth's axis extended to the celestial poles, and the celestial equator.
- **Sky mode**: stand at the pin and look around (drag to look, wheel / pinch to change the field of view). Tap any star, planet, the Sun or Moon for an info card; tap a constellation name to highlight it.
- **Travel**: click the globe, the mini-globe, a quick chip or the search box. The observer glides along the great circle; in sky mode the view is parallel-transported so the horizon stays level while the whole sky swings. "Keep local time" shifts the clock by the longitude change so only the latitude effect remains.
- **Why the sky changed** panel: live facts for the current latitude (pole altitude, circumpolar and never-visible caps, share of the sky you can ever see), an A to B comparison after each trip, and three guided journeys.

- **Sky control** (toolbar, next to Layers): a *Sky quality* slider with named stops (Big city, Suburb, Countryside, Dark site, Enhanced) that drives the limiting magnitude (stars fade out smoothly near it), star gain, Milky Way visibility and a warm light-pollution haze from the horizon, with a live "about N stars above your horizon" count; and a *Star brightness* slider (0.5x to 3x). Both persist in `localStorage` together with the layer toggles.
- **Time scales** (time bar): *Day* (the existing +-12 h scrubber), *Year* (+-6 months at fixed local solar time: the seasons turn the night sky), *Ages* (about 11 000 BC to AD 15 000 on a log scrubber, with epoch chips). Ages applies long-term precession and proper motion to the star field, keeps the calendar date and local solar time, and re-tilts the Sun to the obliquity of the epoch. The pole marker names the pole star of the epoch ("pole star: Thuban, 1.3 deg away"). Moon and planets come from the instant `base + years`, and fade out beyond about 4000 years from 2000, where their positions are unreliable. Far from today the model is approximate (see below). Returning to Day mode restores the real present sky exactly.

- **Learn** (the **Learn** button in the toolbar, or in the phone dock): a course, *Reading the Sky*, in chapters. The home sheet lists the chapters (progress rings, "coming soon" / "planned" ones) and the lessons inside; **Continue** resumes the next unfinished lesson. Each lesson is four steps over the live sky, with the Explore chrome out of the way: **Watch** (a scripted demo with drawn guides: pointer lines, a fist ruler, a limiting circle, star trails, a 24-hour dial), **Try** (you do it in the sky and the app notices; *Show me how* and *Skip* always there), **The old way** (what sky-watchers knew, with sources in `content/en/SOURCES.md`) and **Tonight outside** (what to look for in your own sky, computed for your saved place). Leaving Learn puts your Explore place, view, time, layers and quality back exactly. Progress is kept in `localStorage`. Chapters 1 and 2 (eight lessons) are written; 3 and 4 are stubs. **All course text lives in `content/en/course.md`** (format and translation notes in `content/README.md`); lesson logic is in `js/course/` (how to add one: `js/course/README.md`); the player is `js/learn.js`. `node tools/check_course.mjs` checks the text against the code.
- **Quick lessons** (Learn > Quick lessons): the original fourteen one-idea cards that float over the sky, each with live numbers for your place and time. **Show me** runs a short scripted demo with the app's own controls (slew, time-lapse, Year/Ages, layers, sky quality, trips) and **Back to my sky** restores your place, view, time mode and instant, speed, layers and sky quality exactly. **More** opens the full explainer at the related section. Contextual tips (a trip across the equator, selecting Polaris or a planet, entering Ages or Year mode, moving the sky-quality slider, running time fast) are **off by default** now: switch them on under Layers > *Tips while exploring*. Content and demo scripts are in `js/lessons.js`, the card, snapshot/restore and tips in `js/lessonui.js` (which also exposes the same demo toolkit and restore engine to the Learn player). Phones: the card sits above the dock (top-centre in landscape), swipe left/right changes lesson, and it hides while a sheet is open.

- **Point** (phone dock, or the toolbar on touch tablets): an augmented "point at the sky" mode. The app asks for motion access (iOS) and your position, travels there with the usual animation, lands in the sky at the real time, then hands the camera to the phone's sensors: azimuth, altitude **and roll** follow the phone in all four screen orientations. North comes from `deviceorientationabsolute` on Android and from `webkitCompassHeading` on iOS (Safari's `alpha` has an arbitrary yaw origin; the compass heading fixes it, sampled only in poses where its meaning is unambiguous), corrected from magnetic to true north with the World Magnetic Model 2025 (`js/ar/wmm.js`, coefficients in `data/wmm2025.json`, public domain, NOAA). Orientation is smoothed with an adaptive quaternion low-pass (about 100 ms of lag, no 359°/0° wrap jumps). A drag nudges the view and it springs back when you let go. The bar holds **Camera** (rear camera behind a see-through sky, the ground and Milky Way faded, field of view matched to the iPhone main camera, adjustable), **Night** (everything red) and **Calibrate** (compass accuracy, a figure-8 hint when it is poor, a heading nudge remembered on this device, the lens field of view, the local magnetic declination). **Exit** puts your Explore place, view and time back. Location and camera never leave the device. Maths in `js/ar/orient.js`, runtime and UI in `js/ar/ar.js`; `?ardebug` adds a test panel (`js/ar/debug.js`) that fakes the sensors and the GPS so the mode can be checked on a desktop.

Keys: `G` globe, `S` sky, `Space` play/pause, `Esc` close card/menus (in a lesson: left/right arrow = previous/next step, `Esc` = exit to Learn).

## Run

No build step, no npm. Serve the folder with any static server:

```sh
cd sky-atlas
python3 -m http.server 5177
# open http://localhost:5177/
```

(`.claude/launch.json` already has this as the `sky-atlas` configuration.)

### Open it on a phone (same Wi-Fi)

Find the Mac's address (`ipconfig getifaddr en0`), keep the server running (bind to all interfaces: `python3 -m http.server 5177 --bind 0.0.0.0`) and open `http://<mac-ip>:5177` on the phone. Over plain `http` on a LAN address the browser does not allow service workers, so there is **no offline caching and no install-grade behaviour**; use this only to try the layout and touch gestures. (Geolocation also needs HTTPS.)

### Install on an iPhone (HTTPS host)

The app is a PWA: `manifest.webmanifest`, `icons/`, and `sw.js` (precaches the whole app, including the 5.4 MB places file, so it then works offline). All URLs are relative, so it works from a sub-path.

1. Publish the folder to any static HTTPS host. For GitHub Pages: push the contents of `sky-atlas/` to a repository (for example `sky-atlas`), then Settings > Pages > "Deploy from a branch", branch `main`, folder `/ (root)`. The site appears at `https://<user>.github.io/sky-atlas/`.
2. Open that URL in **Safari** on the iPhone, tap **Share**, then **Add to Home Screen**. It launches full-screen like an app (a one-time hint also appears in Safari).
3. To ship an update: change files, bump `CACHE_VERSION` at the top of `sw.js`, redeploy. JS, CSS and HTML are served stale-while-revalidate, so the new version appears the next time the app is launched (data, images and icons are cache-first and are only refetched when `CACHE_VERSION` changes). New files in `data/` are cached the first time they are fetched; add them to `PRECACHE` in `sw.js` to have them available offline from the first visit.

The service worker is not registered on `localhost:5177` / `127.0.0.1:5177` (the dev server), nor when the URL contains `?nosw`.

## Place search data

Search works offline over about 227 000 places: [GeoNames](https://www.geonames.org) `cities500` (every populated place with 500 inhabitants or more), plus alternate names (native-language names and exonyms such as Roma, Wien, Koeln, Lisboa) for places with 50 000+. The compact file `data/cities.txt` (5.4 MB, about 2.8 MB gzipped) is built by `tools/build_cities.py` from `cities500.zip`, `admin1CodesASCII.txt`, `countryInfo.txt` and (optionally) `alternateNamesV2.zip` downloaded from <https://download.geonames.org/export/dump/>:

```sh
python3 -I tools/build_cities.py <folder-with-the-geonames-files>
```

It is loaded the first time the search box is focused. Until then, and as a fallback, the built-in list of about 90 cities in `js/cities.js` answers instantly. You can also type coordinates (`45.07, 7.69` or `45.07N 7.69E`).

Icons are rendered with `python3 tools/make_icons.py` (standard library only).

## Milky Way image

The Milky Way is a real all-sky photograph-like map drawn additively on an inside-out sphere in the same group as the stars (so it shares sidereal rotation and precession). `js/sky.js` loads it lazily after the first render (fade-in about 1 s): `img/milkyway-4k.jpg` (4096x2048) on desktops, `img/milkyway-2k.jpg` (2048x1024) on phones or GPUs with a max texture size below 4096. If it cannot be loaded, the old polygon band (`data/mw.json`) stays. Debug hook: `?mwimg=name.jpg` loads `img/name.jpg` instead (a missing name exercises the fallback). Shader: `MW2_FRAG` in `js/shaders.js` (threshold and gain per sky quality, horizon light-pollution wash, analytic galactic halo, dither).

Rebuild with `tools/make_milkyway.py` from NASA SVS 4851 `milkyway_2020_8k.exr` (see the script header for the exact file and the venv it needs).

## Test

```sh
node tests/astro.test.mjs
node tests/ar.test.mjs     # orientation -> az/alt/roll, screen orientations, iOS compass offset, smoothing, camera FOV
node tests/wmm.test.mjs    # WMM2025 against NOAA's 100 official test values and four cities
```

Covers the pure maths in `js/astro.js` (and `js/ages.js`, `js/skyquality.js`): Polaris altitude vs latitude, circumpolar / never-rises classification (Acrux, Polaris, Sirius), great-circle interpolation and transport, sidereal time and precession against astronomy-engine, Sirius alt/az against `Astronomy.Horizon`, and the handedness checks (stars rise in the east; counter-clockwise motion about Polaris). Deep-time tests: the long-term precession agrees with astronomy-engine to a few arcseconds over +-2000 years, Thuban lies within 1 degree of the pole near 2800 BC, Polaris is closest (0.46 deg) around AD 2102, Vega is the pole star (about 6 deg) around AD 13 500-14 000, Crux clears the horizon at 35N around 3000 BC, proper motion, the log scrubber, year formatting, sky-quality star counts and pole-star naming.

## Files

| File | Purpose |
|---|---|
| `index.html`, `css/styles.css` | Page skeleton and the glass-panel UI |
| `js/main.js` | State, camera, travel, globe/sky transitions, input, UI wiring, journeys |
| `js/astro.js` | Pure maths (no three.js): sidereal time, precession, alt/az, visibility, great circles |
| `js/data.js` | Loads and parses the star, constellation, Milky Way and DSO data |
| `js/sky.js` | The celestial sphere: stars, lines, Milky Way, Sun/Moon/planets, equator/ecliptic |
| `js/globe.js` | Earth, atmosphere, horizon disc / dome / pole line, ground dome and horizon rig |
| `js/mini.js` | The round mini-globe inset |
| `js/labels.js` | DOM label layer with priority collision avoidance |
| `js/view.js` | Camera pose helpers and easing |
| `js/shaders.js` | GLSL for stars, bodies, Milky Way, Earth, atmosphere, pin, ground dome |
| `js/cards.js`, `js/explainer.js` | Info-card and explainer-panel content |
| `js/lessons.js`, `js/lessonui.js` | Lessons: content + demo scripts; the card, snapshot/restore of your sky, tips. `tests/lessons.harness.js` is a browser-side check of every demo |
| `js/ages.js`, `js/skyquality.js` | Pure helpers: Ages scrubber mapping, year formatting, epoch chips, pole-star search; sky-quality stops, star counts |
| `data/starextra.json`, `tools/build_starextra.py` | Proper motion, distance and spectral type per star, built from the HYG database |
| `img/milkyway-4k.jpg`, `img/milkyway-2k.jpg`, `tools/make_milkyway.py` | Milky Way sky texture (desktop / phone) and the script that bakes it from NASA SVS 4851 |
| `js/cities.js` | Built-in cities, the lazy worldwide place index (search + "Near X" naming) |
| `js/search.js` | Search box: combobox, keyboard, highlighting, coordinates |
| `js/ar/orient.js`, `js/ar/wmm.js`, `js/ar/ar.js`, `js/ar/debug.js` | Point mode: orientation maths, World Magnetic Model, runtime and UI, `?ardebug` sensor simulator |
| `data/wmm2025.json`, `tools/build_wmm.mjs` | WMM2025 coefficients (NOAA, public domain) and the script that converts `WMM2025.COF` |
| `js/shell.js` | Service-worker registration, safe-area/layout variables, touch wording, iOS install hint |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA: offline cache, install metadata, app icons |
| `data/cities.txt` | Worldwide places (GeoNames), built by `tools/build_cities.py` |

## Conventions

World frame is Earth-fixed, north pole `+Y`, longitude 0 at `+X`, east toward `-Z`. The celestial sphere is built once in J2000 equatorial coordinates and rotated about `Y` by `-GMST` (plus precession), so a star whose RA equals the sidereal time sits over longitude 0.

Deep time: `precessionMatrixLong` is an IAU 2006 Fukushima-Williams construction with the angle polynomials truncated at T^2 and Laskar's obliquity series; it matches astronomy-engine within arcseconds at +-2000 years, and beyond that it is an extrapolation (no table-based long-term model such as Vondrak 2011). Proper motion is linear in the tangent plane (no radial-velocity or perspective effects). Constellation lines are snapped to their catalogue stars so they deform with proper motion; labels and deep-sky objects do not move.

Approximations: Sun, Moon and planets use geocentric positions (the Moon's parallax of up to about 1 degree is ignored); no atmospheric refraction.

## Credits

- Milky Way image: NASA/Goddard Space Flight Center Scientific Visualization Studio, "Deep Star Maps 2020" (SVS 4851, `milkyway_2020_8k.exr`, public domain), built from Gaia DR2 (ESA/Gaia/DPAC); resampled, denoised and tone-mapped by `tools/make_milkyway.py`.
- Proper motion, distance and spectral type: [HYG database](https://github.com/astronexus/HYG-Database) v4.1 (CC BY-SA 4.0), reduced by `tools/build_starextra.py`.
- Star, constellation, Milky Way and deep-sky data: [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn (BSD-3-Clause).
- [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19 by Don Cross (MIT).
- [three.js](https://threejs.org) r160 (MIT).
- Earth textures: NASA Blue Marble via [three-globe](https://github.com/vasturiano/three-globe).
- Place names and coordinates: [GeoNames](https://www.geonames.org) (`cities500`, `alternateNamesV2`, `admin1CodesASCII`, `countryInfo`), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
