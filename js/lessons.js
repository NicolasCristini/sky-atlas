// StarSight lessons: the content (short texts with live numbers) and the "Show me" demo scripts.
// Pure content + scripts. The card, the snapshot/restore logic and the tips live in lessonui.js; a demo only talks to the toolkit `D`
// that lessonui builds (D.say, D.wait, D.toSky, D.slew, D.travel, D.play, D.layer, D.findTime ...). Every D call stops by throwing when the
// demo is cancelled, so a script never needs to check for it.
//
// L = live facts about the current place / time (built by lessonui): lat, lon, abs ("41.9"), hemi ('north'|'south'|'equator'), polar,
// pole ('north'|'south'), place, latTxt, nAlways, never (names), bodiesUp, nCity, nDark, pct, mirTxt, ...

const north = (L) => L.lat >= 0;
const poleAz = (L) => (north(L) ? 0 : 180);
const oppAz = (L) => (north(L) ? 180 : 0);
const oppPole = (L) => (north(L) ? 'south' : 'north');
const list = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const poleAlt = (L) => Math.min(Math.max(Math.abs(L.lat), 8), 70);   // where to look so the pole and the horizon are both in view

// pairs of a hot (blue-white) and a cool (orange-red) bright star, with the temperatures quoted in the lesson
export const COLOUR_PAIRS = [
  { hot: 24436, cool: 27989, hotN: 'Rigel', coolN: 'Betelgeuse', hotK: '12 000', coolK: '3 600' },
  { hot: 65474, cool: 80763, hotN: 'Spica', coolN: 'Antares', hotK: '22 000', coolK: '3 400' },
  { hot: 91262, cool: 69673, hotN: 'Vega', coolN: 'Arcturus', hotK: '9 600', coolK: '4 300' },
  { hot: 32349, cool: 21421, hotN: 'Sirius', coolN: 'Aldebaran', hotK: '9 900', coolK: '3 900' },
];

export const LESSONS = [
  // ------------------------------------------------------------------ 1
  {
    id: 'pole', topic: 'Latitude', title: 'The pole sits at your latitude', more: { sec: 'live' },
    text: (L) => (L.equator ? 'At the equator both celestial poles sit on your horizon, 0° up: exactly your latitude.'
      : L.polar ? `At the ${L.hemi} pole the celestial pole is straight overhead, 90° up: exactly your latitude.`
        : `From ${L.place}, the ${L.hemi} celestial pole stands ${L.abs}° above the horizon: exactly your latitude, ${L.latTxt}.`),
    demo: async (D) => {
      const L = D.L();
      await D.prep();
      D.layer('grid', true);
      D.say('The alt-az grid is on: its rings count degrees above the horizon.', 0);
      await D.toSky(poleAz(L), poleAlt(L), 75);
      await D.say(L.equator ? 'Facing north: at the equator the celestial poles sit right on the horizon.' : `Facing ${north(L) ? 'north' : 'south'}, towards the ${L.pole} celestial pole.`);
      await D.say(L.equator ? 'Its height above the horizon, 0°, equals your latitude.' : `It stands ${L.abs}° above the horizon: exactly your latitude, ${L.latTxt}.`);
      await D.say('Walk to a new latitude and the pole moves with you, degree for degree.');
    },
  },
  // ------------------------------------------------------------------ 2
  {
    id: 'circum', topic: 'Circumpolar', title: 'Stars that never set', more: { sec: 'live', list: 'always' },
    text: (L) => (L.equator ? 'At the equator no star is circumpolar: every star rises and sets.'
      : L.polar ? `At the ${L.hemi} pole every star circles the sky parallel to the horizon and never sets.`
        : `Stars within ${L.abs}° of the ${L.pole} pole circle it without ever setting: ${L.nAlways} constellations stay up all night, all year.`),
    demo: async (D) => {
      const L = D.L();
      await D.prep();
      D.say(L.equator ? 'Facing north at the equator: there is no circumpolar zone, the pole sits on the horizon.' : `Facing the ${L.pole} pole. Time will run at one hour per second.`, 0);
      await D.toSky(poleAz(L), Math.min(Math.max(Math.abs(L.lat), 18), 70), 100);
      await D.wait(1500);
      await D.play(3600, 8000, [
        L.equator ? 'Every star climbs out of the horizon and sinks again.' : `Stars within ${L.abs}° of the pole just circle it...`,
        L.equator ? 'Even stars near the pole touch the horizon.' : '...and never touch the horizon.',
        'The farther from the pole, the bigger the circle.',
      ]);
    },
  },
  // ------------------------------------------------------------------ 3
  {
    id: 'hidden', topic: 'Hidden sky', title: 'Stars you can never see', more: { sec: 'live', list: 'never' },
    text: (L) => (L.never.length === 0 ? 'From the equator nothing stays hidden: over a year you can see every star in the sky.'
      : `The same ${L.abs}° cap around the ${oppPole(L)} pole never rises here, so ${list(L.never.slice(0, 3))} stay hidden.`),
    demo: async (D) => {
      const L = D.L();
      await D.prep();
      D.say(`Turning to face ${north(L) ? 'south' : 'north'}, the side of the opposite pole.`, 0);
      await D.toSky(oppAz(L), 4, 85);
      await D.say(L.never.length ? `The sky ends at the horizon: the ${L.abs}° cap around the ${oppPole(L)} pole is below it.` : 'The sky is open on both sides: nothing is permanently below the horizon.');
      await D.say(L.never.length ? `Nothing in that cap ever rises here: ${list(L.never.slice(0, 3))}.` : 'Over a year, every star rises at some time.');
      D.say('Now from space: your sky is a dome standing on the horizon disc.', 0);
      await D.toGlobe();
      await D.wait(3200);
    },
  },
  // ------------------------------------------------------------------ 4
  {
    id: 'lat', topic: 'Travel north-south', title: 'Latitude decides which stars', more: { sec: 'cmp', fallback: 'idea' },
    text: (L) => (L.equator ? 'Each degree you travel north or south tilts the sky by 1°: the pole rises as you leave the equator.'
      : `Each degree you travel north or south tilts the sky by 1°. At ${L.latTxt} the pole is ${L.abs}° up; at the equator, 0°.`),
    demo: async (D) => {
      const L = D.L();
      const dest = Math.abs(L.lat) < 5 ? { lat: -40, lon: L.lon } : { lat: -L.lat, lon: L.lon };
      const dName = D.name(dest.lat, dest.lon), dAbs = Math.abs(dest.lat).toFixed(1), dHemi = dest.lat >= 0 ? 'north' : 'south';
      await D.prep();
      D.keepLocal(true);
      D.say(L.equator ? 'At the equator both poles are on the horizon.' : `${L.place}: the ${L.pole} pole is ${L.abs}° up. Facing it.`, 0);
      await D.toSky(poleAz(L), poleAlt(L), 75);
      await D.wait(2600);
      D.say(`Travelling to ${dName} (${dAbs}°${dest.lat >= 0 ? 'N' : 'S'}), same longitude. Watch the pole sink.`, 0);
      await D.travel(dest.lat, dest.lon, { duration: 7 });
      D.say(`Now the ${dHemi} pole is ${dAbs}° up, in the opposite direction: a whole different slice of sky.`, 0);
      D.slew(dest.lat >= 0 ? 0 : 180, poleAlt({ lat: dest.lat }), 75, 1.6);
      await D.wait(3200);
    },
  },
  // ------------------------------------------------------------------ 5
  {
    id: 'lon', topic: 'Travel east-west', title: 'Longitude only decides when', more: { sec: 'idea' },
    text: (L) => `Same latitude, same stars, only earlier or later: 15° of longitude is 1 hour. ${L.place} is ${L.lonH} h ${L.lon >= 0 ? 'ahead of' : 'behind'} Greenwich.`,
    demo: async (D) => {
      const L = D.L();
      await D.prep();
      D.keepLocal(true);
      D.say(`Facing the ${L.pole} pole from ${L.place}. Next: 90° east along the same latitude.`, 0);
      await D.toSky(poleAz(L), poleAlt(L), 75);
      await D.wait(2600);
      D.say('Travelling east with "Keep local time" on: the clock follows, so local time stays put.', 0);
      for (let i = 1; i <= 3; i++) await D.travel(L.lat, D.lonAdd(L.lon, 30 * i), { duration: 2.6 });
      D.slew(poleAz(L), poleAlt(L), 75, 1);
      await D.say(`Still ${L.abs}°: the pole has not moved and the same stars are up.`);
      await D.say('90° of longitude is 6 hours of clock time. The clock changed, the sky did not.');
    },
  },
  // ------------------------------------------------------------------ 6
  {
    id: 'spin', topic: 'Earth turns', title: 'The sky turns once a day', more: { sec: 'idea' },
    text: (L) => (L.hemi === 'south' ? 'Earth spins once a day: stars rise in the east, set in the west and wheel clockwise around the south pole.'
      : 'Earth spins once a day: stars rise in the east, set in the west and wheel counter-clockwise around the north pole.'),
    demo: async (D) => {
      const L = D.L();
      await D.prep();
      D.say('Facing east, where the sky rises.', 0);
      await D.toSky(90, 24, 85);
      await D.wait(1200);
      await D.play(3600, 8500, [
        'One hour per second: new stars climb out of the eastern horizon.',
        'Earth spins towards the east, so the sky seems to turn the other way.',
        L.hemi === 'south' ? 'Around the south pole they wheel clockwise.' : 'Around the north pole they wheel counter-clockwise.',
      ]);
    },
  },
  // ------------------------------------------------------------------ 7
  {
    id: 'seasons', topic: 'Seasons', title: 'Seasons change the night sky', more: { sec: 'idea' },
    text: (L) => (L.hemi === 'south' ? 'Earth’s orbit changes which stars are up at night. Orion is a southern summer evening sight, lost in winter’s glare.'
      : 'Earth’s orbit changes which stars are up at night. Orion rules northern winter evenings, lost in summer’s glare.'),
    demo: async (D) => {
      const L = D.L();
      await D.prep();
      D.setLocalSolar(22);
      D.say('A fixed hour: 22:00 local time, today. Orion is highlighted.', 0);
      D.highlight('Ori');
      await D.toSky(north(L) ? 180 : 0, 38, 100);
      await D.wait(2600);
      D.say('Year mode: the date runs forward, the clock stays at 22:00.', 0);
      D.timeMode('year');
      await D.play(40, 4500, null, 'year');
      await D.say('Six months later, at the same hour, Orion has gone and other stars have taken its place.');
    },
  },
  // ------------------------------------------------------------------ 8
  {
    id: 'ecliptic', topic: 'Ecliptic', title: 'The planets’ highway', more: { sec: 'idea' },
    text: (L) => `The Sun, Moon and planets all stay near one line, the ecliptic. ${L.bodiesUp.length ? `Up now from ${L.place}: ${list(L.bodiesUp.slice(0, 3))}.` : 'None of them is above your horizon right now.'}`,
    demo: async (D) => {
      await D.prep();
      D.layer('eq', true); D.layer('planets', true);
      const pick = await D.pickBodies();
      D.say('The ecliptic line is on: the path of the Sun through the year.', 0);
      await D.toSky(pick.first.az, Math.max(pick.first.alt, 12), 100);
      await D.wait(2600);
      for (const b of pick.route) {
        await D.say(`${b.id === 'Moon' ? 'The Moon' : b.id} is right on the line.`, 0);
        D.slew(b.az, Math.max(b.alt, 10), 90, 1.6);
        await D.wait(2800);
      }
      await D.say(pick.note);
    },
  },
  // ------------------------------------------------------------------ 9
  {
    id: 'flip', topic: 'Hemispheres', title: 'Upside-down down under', more: { sec: 'cmp', fallback: 'idea' },
    text: (L) => (L.equator ? 'Cross the equator and Orion, like the Moon, turns upside-down: the same stars, seen from the other side.'
      : `Cross the equator and Orion, like the Moon, turns upside-down. ${L.place} (${L.latTxt}) mirrors ${L.mirTxt}.`),
    demo: async (D) => {
      const L = D.L();
      await D.prep();
      const ori = D.consDir('Ori');
      const upAt = (t) => D.starAlt(ori.ra, ori.dec, t) > 22;
      const found = D.findTimeFn(upAt, 24);
      const dest = Math.abs(L.lat) < 5 ? { lat: -40, lon: L.lon } : { lat: -L.lat, lon: L.lon };
      D.keepLocal(true);
      D.highlight('Ori');
      D.say(found ? `Orion, as you see it from ${L.place}.` : 'Orion is low tonight; the demo shifts the clock to bring it up.', 0);
      D.updateNow();
      const aa = D.starAltAz(ori.ra, ori.dec);
      await D.toSky(aa.az, Math.max(aa.alt, 12), 60);
      await D.wait(3000);
      D.say(`Travelling to ${D.name(dest.lat, dest.lon)} (${Math.abs(dest.lat).toFixed(0)}°${dest.lat >= 0 ? 'N' : 'S'}), same longitude, same local time.`, 0);
      await D.travel(dest.lat, dest.lon, { duration: 7 });
      const bb = D.starAltAz(ori.ra, ori.dec);
      D.slew(bb.az, Math.max(bb.alt, 12), 60, 1.6);
      await D.say('Same constellation, flipped: it now stands on its head.', 3200);
      await D.say(bb.alt < 5 ? 'It is low at this hour: wait a little and it climbs.' : 'The Moon would flip the same way.');
    },
  },
  // ------------------------------------------------------------------ 10
  {
    id: 'precession', topic: 'Precession', title: 'The pole star is temporary', more: { sec: 'ages', fallback: 'idea' },
    text: () => 'Earth’s axis wobbles once per ~25 800 years. Thuban marked the pole for the pyramid builders; Vega will, in AD 13 700.',
    demo: async (D) => {
      const L = D.L();
      await D.prep({ day: false });
      D.say('Ages mode: jumping back to 2560 BC, when the pyramids were built.', 0);
      await D.toSky(poleAz(L), poleAlt(L), 70);
      D.epoch('pyramids');
      await D.until(() => !D.S.ages.tween, 9000);
      await D.wait(1600);
      await D.say(L.hemi === 'south' ? 'The pole has drifted across the sky: the south pole you see is no longer where it is today.'
        : 'Thuban, not Polaris, sat at the north pole then. Its name is on the pole marker.', 3200);
      D.say('Back to today.', 0);
      D.epoch('today');
      await D.until(() => !D.S.ages.tween, 9000);
      await D.wait(1600);
      await D.say(L.hemi === 'south' ? 'Today: the sky has turned back; Polaris marks the north pole.' : 'Today Polaris is the pole star again, within a degree of the pole.');
    },
  },
  // ------------------------------------------------------------------ 11
  {
    id: 'pollution', topic: 'Light pollution', title: 'Light pollution hides, not removes', more: { sec: 'idea' },
    text: (L) => `Light pollution hides stars, not removes them: from here about ${L.nCity} show in a big city, ${L.nDark} at a dark site.`,
    demo: async (D) => {
      const L = D.L();
      await D.prep();
      D.say('Facing the high southern sky.', 0);
      await D.toSky(north(L) ? 180 : 0, 50, 100);
      await D.wait(1500);
      D.say('Big city: the glow washes out everything faint.', 0);
      await D.tweenQ(0, 1800);
      await D.say(`Big city: about ${L.nCity} stars visible above your horizon.`, 2600);
      D.say('Now a dark site...', 0);
      await D.tweenQ(3, 3600);
      await D.say(`Dark site: about ${L.nDark} stars. They were there all along.`, 3000);
      D.say('Back to your own sky.', 0);
      await D.tweenQ(D.snapQ(), 2200);
      await D.wait(700);
    },
  },
  // ------------------------------------------------------------------ 12
  {
    id: 'milkyway', topic: 'Our galaxy', title: 'The Milky Way, edge-on', more: { sec: 'idea' },
    text: () => 'That band is the disc of our galaxy seen edge-on: hundreds of billions of stars. Its centre lies in Sagittarius.',
    demo: async (D) => {
      await D.prep();
      D.layer('mw', true);
      D.say('A dark site: the faint band of the Milky Way appears.', 0);
      const gc = D.galactic(0, 0);
      const t = D.findTimeFn((ms) => D.starAlt(gc.ra, gc.dec, ms) > 12, 24, { best: (ms) => D.starAlt(gc.ra, gc.dec, ms) });
      D.updateNow();
      const gcNow = D.starAltAz(gc.ra, gc.dec);
      let aim, note;
      if (gcNow.alt > 6) { aim = gcNow; note = t ? 'The galactic centre, in Sagittarius, is up: the band is brightest and thickest there.' : 'The galactic centre, in Sagittarius, is up.'; }
      else { aim = D.bandHighest(); note = 'The centre, in Sagittarius, is below your horizon at any hour from here; this is the highest part of the band.'; }
      await D.toSky(aim.az, Math.max(aim.alt, 15), 100);
      await D.tweenQ(Math.max(3, D.snapQ()), 2200);
      await D.say('That band is where we look edge-on through the disc of our own galaxy.', 3000);
      D.slew(aim.az, Math.max(aim.alt, 15), 70, 1.5);
      await D.say(note, 3600);
      await D.say('Hundreds of billions of stars, too faint and too many to resolve by eye.');
    },
  },
  // ------------------------------------------------------------------ 13
  {
    id: 'colour', topic: 'Star colour', title: 'Star colours are temperatures', more: { sec: 'idea' },
    text: () => 'Blue-white stars are hotter than orange-red ones: Rigel burns near 12 000 K, Betelgeuse near 3 600 K.',
    demo: async (D) => {
      await D.prep();
      const pair = D.pickPair();
      D.updateNow();
      const h = D.hipAltAz(pair.hot), c = D.hipAltAz(pair.cool);
      const mid = D.midAz(h.az, c.az);
      D.say(`A hot and a cool star together: ${pair.hotN} and ${pair.coolN}.`, 0);
      await D.toSky(mid, Math.max(Math.min((h.alt + c.alt) / 2, 60), 18), D.fovFor(h, c));
      await D.wait(2500);
      // on a phone the star card is a sheet that covers this card, so there the selection waits for the last step
      if (!D.phone) D.select(pair.hot);
      await D.say(`${pair.hotN} is blue-white: its surface is near ${pair.hotK} K.`, 3200);
      if (!D.phone) D.select(pair.cool);
      await D.say(`${pair.coolN} is orange-red: only about ${pair.coolK} K. Colour is temperature.`, 3200);
      if (D.phone) D.select(pair.hot);
    },
  },
  // ------------------------------------------------------------------ 14
  {
    id: 'equator', topic: 'Equator and poles', title: 'Equator sees all, poles half', more: { sec: 'journeys' },
    text: (L) => `At the equator every star rises at some point; at a pole half the sky circles forever. From ${L.place}: ${L.pct}% of it, ever.`,
    demo: async (D) => {
      await D.prep();
      D.keepLocal(true);
      D.say('The North Pole: Polaris is straight overhead and every star circles level around you.', 0);
      D.placeAt(89.9, 0); D.setLocalSolar(0, 0);
      await D.toSky(0, 62, 80);
      await D.wait(2700);
      D.say('Heading for the equator. The pole star sinks with every degree of latitude.', 0);
      await D.travel(-0.18, -78.47, { duration: 7, pitchTo: 4 });
      await D.say('The equator: both celestial poles lie on the horizon. Every star rises and sets.', 3000);
      D.say('On to the South Pole: now the south celestial pole climbs, with no bright star to mark it.', 0);
      await D.travel(-90, 0, { duration: 7, pitchTo: 75 });
      await D.say('South Pole: the south celestial pole is overhead. Only the other half of the sky is on view.', 3200);
    },
  },
];
