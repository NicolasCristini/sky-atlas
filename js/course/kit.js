// The toolkit lessons are written against: place contexts with live values, text lookup, and sky helpers.
// learn.js builds one kit; a lesson sees it as X (see js/course/README.md for the full list).
import * as G from './geo.js';
import { clean, fill, GLOBAL_PLACEHOLDERS } from './text.js';
import { placeName, byName } from '../cities.js';
import { classifyConstellations } from '../explainer.js';

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// cities the Watch step may travel to when the user's own sky cannot show the thing (nearest in longitude wins)
const AWAY = {
  north: ['Madrid', 'Athens', 'Moscow', 'Beijing', 'Tokyo', 'New York', 'Los Angeles'],
  south: ['Cape Town', 'Perth', 'Sydney', 'Auckland', 'Santiago', 'Buenos Aires'],
};

export function createKit(a, engine, ov, getCourse) {
  const { S, A, data, sky } = a;
  const D = engine.D;
  const kit = { home: null, awayName: '', data, sky, a, A };

  // ---------------------------------------------------------------- text
  const course = () => getCourse() || { ui: {}, course: {}, chapters: [] };
  const FALLBACK = { close: 'Close', exit: 'Exit', loadFailed: 'The course text could not be loaded. Check your connection and try again.' };
  kit.ui = (key, extra) => {
    const t = course().ui[key];
    if (t === undefined) { if (key in FALLBACK) return FALLBACK[key]; console.warn('missing ui text', key); return ''; }
    return clean(fill(t, extra || {}, (k) => console.warn(`ui.${key}: no value for {${k}}`)));
  };
  kit.uiRaw = (key) => course().ui[key];
  kit.words = (key) => String(kit.uiRaw(key) || '').split('|').map((x) => x.trim());

  // ---------------------------------------------------------------- places
  const nameCache = new Map();
  kit.placeShort = (lat, lon) => {
    const k = lat.toFixed(2) + ',' + lon.toFixed(2); if (nameCache.has(k)) return nameCache.get(k);
    let v = 'here'; try { const p = placeName(lat, lon); v = p.short || p.title || 'here'; } catch (e) { /* ignore */ }
    if (nameCache.size > 100) nameCache.clear(); nameCache.set(k, v); return v;
  };
  const starIdx = (h) => data.hipIndex.get(h);
  kit.starName = (h) => { const i = starIdx(h); return i === undefined ? '' : data.starInfo(i).title; };
  /** Place context: what a lesson's values() sees. */
  kit.ctx = (lat, lon, ms) => {
    const abs = Math.abs(lat);
    const P = {
      kit, lat, lon, abs, ms, north: lat >= 0, place: kit.placeShort(lat, lon),
      /** alt/az of a catalogue star here, at P.ms (or another time) */
      star(h, t = ms) { const i = starIdx(h); return A.eqToAltAz(data.stars.ra[i], data.stars.dec[i], lat, lon, A.jdFromMs(t)); },
      dec(h) { return data.stars.dec[starIdx(h)]; },
      /** "high in the north-east, about 55° up" built from the course text */
      where(az, alt) { return kit.ui('where', { height: kit.words('heights')[G.heightIndex(alt)], dir: kit.words('compass')[G.compassIndex(az)], alt: Math.round(alt) }); },
      dirWord(az) { return kit.words('compass')[G.compassIndex(az)]; },
      /** Names of the first n constellations that never set here, best known first */
      alwaysCons(n = 2) { return classifyConstellations(data, lat).always.slice(0, n).map((c) => c.name); },
      clockOf(h, t = ms) { return G.starClockAngle({ ra: data.stars.ra[starIdx(h)], dec: data.stars.dec[starIdx(h)] }, lat, lon, t); },
    };
    return P;
  };
  kit.live = () => kit.ctx(S.obs.lat, S.obs.lon, S.time);
  /** The user's own place, at the real evening (21:00 local solar time, tonight). */
  kit.homeCtx = () => {
    const h = kit.home || { lat: S.obs.lat, lon: S.obs.lon };
    const P = kit.ctx(h.lat, h.lon, G.eveningMs(Date.now(), h.lon, 21)); P.tonight = true; return P;
  };

  kit.baseValues = (P) => ({
    place: P.place, lat: P.abs.toFixed(1), latTxt: `${P.abs.toFixed(1)}°${P.lat >= 0 ? 'N' : 'S'}`, poleAlt: Math.round(P.abs),
    pole: P.lat >= 0 ? 'north' : 'south', poleName: kit.ui(P.lat >= 0 ? 'poleNameN' : 'poleNameS'),
    fistsToPole: G.fistsToPole(P.lat), localEveningTime: kit.ui('eveningTime'),
    homePlace: kit.home ? kit.home.place : P.place, awayPlace: kit.awayName || '',
  });
  // ---------------------------------------------------------------- dates, lists, the Sun (chapters 3 and 4)
  /** "16 Nov" / "16 November" for the local solar date of an instant at a longitude. */
  kit.dateText = (ms, lon, long = false) => {
    const d = new Date(ms + (lon / 15) * 3600e3);
    return kit.ui('dateShown', { a: d.getUTCDate(), b: kit.words(long ? 'monthsLong' : 'months')[d.getUTCMonth()] });
  };
  /** "A", "A and B", "A, B and C" */
  kit.list = (arr) => (arr.length < 2 ? arr.join('') : kit.ui('listAnd', { a: arr.slice(0, -1).join(', '), b: arr[arr.length - 1] }));
  /** {ra, dec} (J2000 degrees) of a catalogue star */
  kit.starOf = (h) => { const i = data.hipIndex.get(h); return { ra: data.stars.ra[i], dec: data.stars.dec[i] }; };
  /** Name of the constellation the Sun is in at an instant (astronomy-engine), or of the opposite point of the ecliptic (anti = true). */
  kit.sunCons = (ms, anti = false) => {
    const Aa = globalThis.Astronomy; if (!Aa) return '';
    const v = Aa.GeoVector('Sun', new Date(ms), true), d = Math.hypot(v.x, v.y, v.z) * (anti ? -1 : 1);
    const e = A.vecToEq([v.x / d, v.z / d, -v.y / d]);
    try { return Aa.Constellation(e.ra / 15, e.dec).name; } catch (err) { return ''; }
  };
  kit.consId = (name) => { const c = data.cons.find((x) => x.name === name); return c ? c.id : null; };

  kit.valuesFor = (lesson, P) => ({ ...kit.baseValues(P), ...(lesson && lesson.values ? lesson.values(P, kit) : {}) });

  // ---------------------------------------------------------------- the lesson context X
  kit.makeX = (lesson) => {
    const X = {
      D, S, A, a, ov, data, sky, G, kit, lesson, state: {}, tryT0: 0, justShown: false, stageChanged: null,
      HIP: G.HIP,
      ui: kit.ui,
      /** Hide the app's own "North celestial pole" label for this step, when the lesson draws its own pole graphics. */
      noPoleLabel() { document.body.classList.add('learn-nopolelbl'); },
      /** A lesson text, placeholders filled, source tags stripped. Tonight texts use the user's own place; everything else the place the sky shows now. */
      T(key, extra) {
        const L = course().chapters.flatMap((c) => c.lessons).find((l) => l.id === lesson.id);
        const raw = L && L.keys[key];
        if (raw === undefined) { console.warn(`missing course text ${lesson.id} ${key}`); return ''; }
        const P = key.startsWith('tonight') ? kit.homeCtx() : kit.live();
        return clean(fill(raw, { ...kit.valuesFor(lesson, P), ...(extra || {}) }, (k) => console.warn(`${lesson.id} ${key}: no value for {${k}}`)));
      },
      has(key) { const L = course().chapters.flatMap((c) => c.lessons).find((l) => l.id === lesson.id); return !!(L && L.keys[key] !== undefined); },
      /** Say a text key as the current caption, for ms (0 = leave it up). */
      say: (key, ms = 3200, extra) => D.say(X.T(key, extra), ms),
      get home() { return kit.home; },
      here: () => ({ lat: S.obs.lat, lon: S.obs.lon, place: kit.placeShort(S.obs.lat, S.obs.lon) }),
      hip: (h) => D.hipAltAz(h),
      starName: kit.starName,
      altAt(h, ms) { const i = starIdx(h); return A.eqToAltAz(data.stars.ra[i], data.stars.dec[i], S.obs.lat, S.obs.lon, A.jdFromMs(ms)); },
      bodyAltAz(id) { const b = sky.bodies.find((x) => x.id === id); return b ? a.altAzOfEq(b.eq) : { az: 0, alt: -90 }; },
      /** Move the clock (within `hours`, in half-hour steps) to the first moment pred(ms) holds. Returns 'now' | 'moved' | false. */
      findTime(pred, hours = 24) {
        if (pred(S.time)) return 'now';
        return D.findTimeFn(pred, hours) ? 'moved' : false;
      },
      resetClock() { const h = kit.home; if (!h) return; if (S.tm !== 'day') a.setTimeMode('day', { keepTime: true }); S.yd = 0; const t = h.follow ? Date.now() : h.time; S.time = t; S.anchor = t; a.updateCelestial(true); },
      /** Travel (keeping local time) so the sky is seen from another place. */
      async goTo(lat, lon, dur = 5) { D.keepLocal(true); await D.travel(lat, lon, { duration: dur }); },
      async goHome() {
        const h = kit.home; kit.awayName = ''; if (!h) return;
        if (Math.abs(S.obs.lat - h.lat) > 0.01 || Math.abs(A.norm180(S.obs.lon - h.lon)) > 0.01) { D.keepLocal(true); await D.travel(h.lat, h.lon, { duration: 3.2 }); }
      },
      /** Name a suitable place in the other hemisphere / a place where the thing is visible, nearest in longitude to home. */
      pickAway(side) {
        const h = kit.home || { lon: S.obs.lon };
        let best = null, bd = 1e9;
        for (const n of AWAY[side]) { const c = byName(n); if (!c) continue; const d = Math.abs(A.norm180(c.lon - h.lon)); if (d < bd) { bd = d; best = c; } }
        return best;
      },
      /** Turn the camera so two things are framed. */
      frame(p, q, o = {}) {
        const aa = ov.altAz(p), bb = ov.altAz(q); if (!aa || !bb) return;
        const mid = D.midAz(aa.az, bb.az), alt = clamp(o.alt ?? (aa.alt + bb.alt) / 2 - (o.lower ?? 6), o.minAlt ?? 10, 75);
        return D.toSky(mid, alt, o.fov ?? clamp(D.fovFor(aa, bb) + 20, 70, 100));
      },
      /** Run the clock fast for ms, optionally keeping a star mid-screen and stepping through caption keys. */
      async lapse(speed, ms, o = {}) {
        const lines = o.lines || [];
        S.speed = speed; S.playing = true; a.syncPlay();
        const id = o.follow ? setInterval(() => {
          const aa = X.hip(o.follow), s = S.sky; S.slew = null;
          s.az = A.norm360(s.az + A.norm180(aa.az - s.az) * 0.18); s.alt += (clamp(aa.alt, 8, 80) - s.alt) * 0.18;
        }, 40) : 0;
        try {
          if (lines.length) { for (const k of lines) await X.say(k, ms / lines.length); } else await D.wait(ms);
        } finally { clearInterval(id); S.playing = false; S.speed = 1; a.syncPlay(); }
      },
      /** Move the clock on by `hours` at one hour per second and stop exactly there. */
      async advanceHours(hours) {
        const target = S.time + hours * 3600e3;
        S.speed = hours < 0 ? 3600 : 3600; S.playing = true; a.syncPlay();
        try { await D.until(() => S.time >= target - 1, 8000); } finally { S.playing = false; S.speed = 1; a.syncPlay(); }
        S.time = target; S.anchor = target; a.updateCelestial(true);
      },
      /** Glide the clock to an instant (stops at once when the step is cancelled: D.wait throws). */
      async tweenTime(target, ms = 2400) {
        const t0 = S.time, t = performance.now();
        for (let u = 0; u < 1;) {
          await D.wait(30);
          u = clamp((performance.now() - t) / ms, 0, 1);
          const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          S.time = t0 + (target - t0) * e; S.anchor = S.time; a.updateCelestial(true);
        }
      },
      /** Jump the clock by days with a visible sweep. */
      sweepDays(days, ms = 2600) { return X.tweenTime(S.time + days * 86400e3, ms); },
      async setLatitude(lat, dur = 2) { await D.travel(lat, S.obs.lon, { duration: dur }); },
      /** Brightest catalogue stars (HIP numbers) within maxDeg of a point, brightest first. */
      starsNear(point, maxDeg, maxMag = 4.6, limit = 70) {
        const out = [], st = data.stars;
        for (let i = 0; i < st.n; i++) { if (st.mag[i] > maxMag) continue; const ang = ov.angleBetween(st.hip[i], point); if (ang !== null && ang <= maxDeg) out.push({ hip: st.hip[i], mag: st.mag[i] }); }
        out.sort((p, q) => p.mag - q.mag);
        return out.slice(0, limit).map((o) => o.hip);
      },
      /** Set the clock (day mode) to an instant. */
      setClock(ms) { S.time = ms; S.anchor = ms; a.updateCelestial(true); },
      /** Year mode, frozen at local solar `hour` (21 = evening) at the place and date the clock shows; the seasons then slide past with S.yd. */
      yearAt(hour = 21) {
        if (S.tm !== 'day') a.setTimeMode('day', { keepTime: true });
        X.setClock(G.eveningMs(S.time, S.obs.lon, hour));
        a.setTimeMode('year'); S.yd = 0; a.updateCelestial(true); a.updateTimeUI(true);
      },
      setYd(v) { S.yd = v; a.updateCelestial(true); },
      /** Glide the year slider to a day offset (may pass beyond +-183). Stops when the step is cancelled. */
      async tweenYear(target, ms = 2400) {
        const y0 = S.yd, t = performance.now();
        for (let u = 0; u < 1;) {
          await D.wait(30);
          u = clamp((performance.now() - t) / ms, 0, 1);
          const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          S.yd = y0 + (target - y0) * e; a.updateCelestial(true);
        }
      },
      /** Date text for the instant the sky shows now (the year slider counted in). */
      dateNow(long = false) { return kit.dateText(S.time + (S.tm === 'year' ? S.yd * 864e5 : 0), S.obs.lon, long); },
      star: (h) => kit.starOf(h),
      /** Clock angle (degrees clockwise from up) of a star around the visible pole, now. */
      handAngle(h) { const p = ov.world('pole'), s = ov.world(h); return G.clockAngle(p, s, S.obs.U); },
    };
    return X;
  };
  return kit;
}
