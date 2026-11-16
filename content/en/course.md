# Reading the Sky: course text (English) {#doc}

This file holds every sentence the Learn area shows. The app reads it at run time, so a change here is a change in the app.
Format rules, the list of placeholders and how to add a language are in content/README.md. Short version: each line is
"key: text", the {words in braces} are filled in with live values, and [src:id] tags point to content/en/SOURCES.md and are never shown.
Do not change the {#ids} in the headings, the keys, or the {placeholders}; translate everything else.

# The course {#course}

title: Reading the Sky

goal: Read the night sky the way our ancestors did, with a little help from today's technology.

# Interface {#ui}

<!-- Buttons, labels and small phrases. Lists inside one value are separated by | and keep their order. -->

learn: Learn

close: Close

exit: Exit

back: Back

next: Next

replay: Replay

watchPlay: Watch

showMe: Show me how

skip: Skip

hintLead: Hint:

shownLine: That is how it is done. Try it yourself any time.

continue: Continue

continueLesson: Lesson {lesson}: {title}

startCourse: Start the course

reviewCourse: Review the course

allChapters: All chapters

chapterN: Chapter {n}

lessonCount: {count} lessons

lessonCountOne: 1 lesson

comingSoon: Coming soon

planned: Planned

progress: {done} of {total} lessons done

moreWays: More ways to explore

quickLessons: Quick lessons

whyChanged: Why the sky changed

stepWatch: Watch

stepTry: Try

stepOldway: The old way

stepTonight: Tonight outside

stepOf: Step {n} of 4: {title}

finish: Finish lesson

lessonDone: Lesson complete

nextLesson: Next lesson

backToLearn: Back to Learn

exitLabel: Exit the lesson and go back to Learn

minusHour: −1 h

plusHour: +1 h

hoursShown: {hours} h

scrubLabel: Move the time

latLabel: Latitude

loadFailed: The course text could not be loaded. Check your connection and try again.

hourTick: {n} h

dir.n: North

dir.e: East

dir.s: South

dir.w: West

zenith: zenith

height: height

poleLabel: pole

poleLabelN: north celestial pole

poleLabelS: south celestial pole

poleNameN: the pole star

poleNameS: the south celestial pole

eveningTime: 9 pm

where: {height} in the {dir}, about {alt}° up

heights: very low|low|well up|high

compass: north|north-east|east|south-east|south|south-west|west|north-west

listAnd: {a} and {b}

handStarN: the Big Dipper's pointer stars

handStarS: the top of the Southern Cross

turnCcw: counter-clockwise

turnCw: clockwise

dateShown: {a} {b}

months: Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec

monthsLong: January|February|March|April|May|June|July|August|September|October|November|December

yearLabel: Move through the year

prevDawn: Earlier dawn

nextDawn: Next dawn

sunLabel: Sun

sunIn: The Sun is in {name}

sunUp: Sun {alt}° up

placeAswan: Aswan

placeAlexandria: Alexandria

arcturusHoku: Arcturus (Hōkūleʻa)

poleUp: climbs

poleDown: sinks

pleiades: The Pleiades

# Chapter 1 {#ch1}

title: Finding your way

summary: Your sky as a dome, your hand as a ruler, and the stars that show you north and south.

## Lesson 1.1 {#l1.1}

title: Your sky is a dome

hook: Everything you see sits on one great dome. Learn its four directions and its top.

### Watch {#watch}

c1: Out here the sky is a huge dome standing on a flat circle: the horizon.

n: This way is north.

e: Turn right and you face east, where the Sun rises.

s: Turn on to south, the opposite of north.

w: And west, where the Sun sets.

zenith: Now look straight up. That point right over your head is the zenith.

last: Any star can be placed with two numbers: its direction round the horizon, and its height above it.

### Try {#try}

prompt: Turn to face north, looking close to the horizon.

hint: Drag the sky sideways until the N is in the middle of the screen. Keep your view low, near the horizon.

success: That is north. You can now point at any direction.

### The old way {#oldway}

text: The word "zenith" comes from Arabic samt ar-ra's, "the direction of the head". The medieval Latin spelling "cenit" is usually explained by copyists misreading the letter m as "ni". [src:zenith-word] So when you say "zenith", you are using an Arab astronomer's phrase for the point over your head.

### Tonight outside {#tonight}

text: Note where the Sun sets tonight. That is roughly west. Stand facing it: north is on your right, south on your left, and east is behind you.

## Lesson 1.2 {#l1.2}

title: Measure the sky with your hand

hook: Your hand at arm's length is a ruler you always carry.

### Watch {#watch}

c1: At arm's length, a fist covers about 10° of sky, three middle fingers about 5°, and a little finger about 1°. [src:hand-angles]

c1b: A spread hand covers 20 to 25°. The Moon is only half a degree wide. [src:hand-angles]

c2: Now count fists up from the horizon to {poleName}.

c3: From {place} it takes about {fistsToPole} fists. The pole stands {poleAlt}° up.

flat: From {place} the pole sits right on the horizon: not even one fist up.

### Try {#try}

prompt: How many fists from the horizon up to {poleName}, seen from {place}?

hint: Count the 10° steps on the ruler. The pole stands as high as your latitude, {lat}°, and one fist is about 10°.

wrong: Not quite. One fist is 10°, and the pole stands {poleAlt}° up. Try again.

option: {label} fists

optionOne: {label} fist

success: Yes, about {fistsToPole} fists. The pole stands as high as your latitude, {lat}°.

### The old way {#oldway}

text: Arab navigators in the Indian Ocean measured the height of the Pole Star with the kamal, a card on a knotted cord. They counted in isba, or finger-widths, of about 1.6° each. [src:kamal] Your fist does the same job: you are using a very old tool.

### Tonight outside {#tonight}

north: From {place}, find the Big Dipper. Its two pointer stars are about three fingers apart, around 5°. Hold your hand out at arm's length and check.

south: From {place}, find the Southern Cross. Its long axis is about 6°, a little more than three fingers at arm's length. Hold your hand out and check.

## Lesson 1.3 {#l1.3}

title: Finding north

hook: Two stars of the Big Dipper point to Polaris, the star that marks north.

### Watch {#watch}

away: From {place} you cannot see Polaris, so we are flying to {awayPlace}.

moved: We moved the clock to an hour when the Big Dipper is up.

c1: This is the Big Dipper. The bowl ends in two "pointer" stars, Merak and Dubhe.

c2: Draw a line through the pointers, starting at Merak.

c3: Carry it on for about five times the gap between them.

c4: It lands on Polaris. Polaris is not bright, only around the 50th-brightest star. It matters because it stays put. [src:polaris-rank]

c5: Drop a line from Polaris straight down to the horizon: that direction is north.

### Try {#try}

prompt: Follow the pointers, then tap Polaris.

hint: Start at the end of the Dipper's bowl. Follow Merak and Dubhe, about five times the gap between them.

wrong: That is {name}. Follow the pointers again, a little further.

success: That is Polaris. Straight below it, on the horizon, is north.

### The old way {#oldway}

text: Greek writers say Phoenician sailors steered by the Little Bear, while Greeks used the Great Bear. Callimachus, quoted by Diogenes Laertius, credits Thales of Miletus with working out the stars of the "Wagon" that the Phoenicians used. Later writers called the constellation the "Phoenician Bear". [src:phoenician-bear]

### Tonight outside {#tonight}

visible: From {place} at {localEveningTime} tonight, the Big Dipper is {dipperWhere}. Find the two pointers at the end of its bowl, follow them about five times their gap, and Polaris is there.

below: From {place} the Big Dipper is below the horizon at {localEveningTime} tonight. Look later in the night, when it has swung round the pole, or on another evening of the year.

hidden: From {place} Polaris sits very low or below the horizon, so this trick will not work. The next lesson shows the southern way to find south.

## Lesson 1.4 {#l1.4}

title: Finding south

hook: No bright star marks the south pole of the sky. The Southern Cross shows where it is.

### Watch {#watch}

away: The Southern Cross never rises from {place}, so we are flying to {awayPlace}.

moved: We moved the clock to an hour when the Southern Cross is up.

c1: This is the Southern Cross. Its ends are Gacrux, at the top, and Acrux, at the foot.

c2: Its long axis runs from Gacrux to Acrux.

c3: Carry that line on for about four and a half times its length. It lands near the south celestial pole. [src:crux-pointer]

c4: Two bright stars nearby, Alpha and Beta Centauri, are the Pointers. They help you find the Cross. [src:crux-pointer]

c5: Drop a line from the pole straight down to the horizon: that direction is south.

### Try {#try}

prompt: Tap Acrux, the star at the foot of the Cross.

hint: Acrux is the brightest star of the Cross, at its lower end.

prompt2: Now turn to face the south celestial pole, the spot the long axis leads to.

hint2: Follow the long axis about four and a half lengths past Acrux, then turn the sky to put that spot in the middle.

wrong: That is {name}. Look for the brightest star of the Cross, at its foot.

success: You are facing the south celestial pole. Straight below it, on the horizon, is south.

### The old way {#oldway}

text: Thousands of years ago the Southern Cross rose in the northern sky, and Ptolemy listed its stars as part of Centaurus. Precession, the slow wobble of Earth's axis, sank them below the horizon of Europe, by about AD 400 across most of it. Europeans met them again in the south: the Venetian Cadamosto noted the Cross off West Africa in 1455. [src:crux-ancient]

### Tonight outside {#tonight}

visible: From {place} at {localEveningTime} tonight, the Southern Cross is {crossWhere}. Find its long axis and follow it about four and a half lengths to the south pole of the sky.

below: From {place} the Southern Cross is very low or below the horizon at {localEveningTime} tonight. It comes into view at another hour of the night, or at another time of year.

never: From {place} the Southern Cross never climbs above the horizon. Use lesson 1.3 instead: Polaris is your guide to north.

# Chapter 2 {#ch2}

title: The turning sky

summary: Why the stars wheel round the sky each night, and how that turns the sky into a clock.

## Lesson 2.1 {#l2.1}

title: The Earth turns

hook: The stars move across the sky because we turn, once every day.

### Watch {#watch}

c1: We face the east, where stars come up. One bright star is marked.

c2: Time now runs fast: one hour every second.

c3: The star climbs, and each tick marks one more hour: about 15° each time.

c4: The Earth turns 360° in 24 hours: 15° an hour, a fist and a half. So the sky seems to turn the other way.

### Try {#try}

prompt: Move the clock forward by exactly 2 hours, and watch the marked star.

hint: Press +1 h twice. The marker shows how far the star has moved.

success: Two hours, 30°: three fists. That is the Earth turning.

### The old way {#oldway}

text: For most of history people thought the sky turned round a still Earth. Aristarchus of Samos (3rd century BC) suggested, as Archimedes reports, that the Earth circles the Sun, and Heraclides of Pontus (4th century BC) is said to have taught that it turns once a day. Most people kept the Earth still until Copernicus. [src:earth-rotates-ancients]

### Tonight outside {#tonight}

text: Line a bright star up with a rooftop, a tree or a lamp post. Look again after 20 minutes without moving your head: it has moved about 5°, three fingers at arm's length.

## Lesson 2.2 {#l2.2}

title: The still point

hook: Every star circles one point in the sky, and that point never moves.

### Watch {#watch}

c1: We face the {pole} celestial pole, the point straight above Earth's axis.

flat: From {place} the pole sits right on the horizon. We face it all the same.

c2: Time runs fast, one hour every second. Every star draws a trail.

turnN: In the north the stars wheel counter-clockwise round the pole.

turnS: In the south the stars wheel clockwise round the pole.

c4: The pole itself does not move. Everything else circles it.

### Try {#try}

prompt: Find the one star that hardly moves, and tap it.

hint: It sits at the centre of all the circles. From {place} it stands {poleAlt}° above the horizon, due north.

success: That is Polaris. It sits within a degree of the pole, so it hardly moves.

promptS: Turn to face the {pole} celestial pole, the still point of the sky.

hintS: Face due {pole}, and look {poleAlt}° up. That is where all the circles are centred.

successS: You are facing the {pole} celestial pole, the still point of the sky.

### The old way {#oldway}

text: Several peoples pictured the pole star as a peg holding up the turning sky. Old Turkic texts call it the "gold stake". In China, the stars around the pole formed the palace of the celestial emperor, the Purple Forbidden Enclosure. [src:pole-nail]

### Tonight outside {#tonight}

north: Face north from {place} and find Polaris. Look at the stars near it twice, an hour apart: they have circled it, counter-clockwise, while Polaris stayed put.

south: From {place}, face south and look {poleAlt}° up: that empty spot is the south celestial pole. Look at the stars near it an hour apart: they circle it clockwise.

## Lesson 2.3 {#l2.3}

title: Stars that never set

hook: Some stars circle the pole without ever touching the horizon.

### Watch {#watch}

flat: At {place} the pole is on the horizon, so the circle shrinks to nothing: every star rises and sets.

c1: From {place} the pole stands {poleAlt}° above the horizon.

c2: Draw a circle round the pole with a radius equal to your latitude, {lat}°. Its lowest point just touches the horizon.

circleLabel: radius {lat}°

c3: Stars inside the circle never set. They circle the pole all night, all year.

c4: A star outside the circle dips below the horizon: it rises and sets.

### Try {#try}

prompt: Which of these stars never sets from {place}?

hint: Stars within {lat}° of the pole never set. The pole is {poleAlt}° up, in the {pole}.

wrong: Not quite. Only stars within {lat}° of the pole never set. Try again.

none: None of them

success: Yes. Only stars within {lat}° of the pole stay up all night.

### The old way {#oldway}

text: The Egyptians called the stars that never set the "Imperishable Ones", and the Pyramid Texts, spells cut into royal pyramids, promise the dead king a place among them. [src:imperishable] In Homer's poems the Bear never dips into the Ocean, and the goddess Calypso tells Odysseus to keep it on his left hand as he sails. [src:homer-bear]

### Tonight outside {#tonight}

text: Two constellations that never set from {place}: {circumpolarNames}. Look for them tonight, at any hour. They are always up.

none: From {place} no constellation stays up all night, because the pole sits on the horizon. Every star you see will set.

## Lesson 2.4 {#l2.4}

title: The star clock

hook: The turning sky is a clock, and the Big Dipper is its hand.

### Watch {#watch}

c1: Here is a clock face round the pole: 24 hours. The hand is the line from the pole to {handStar}.

c2: Time runs fast. The hand turns {handTurn}, 15° every hour.

c3: One full turn takes about a day.

c4: A month later, at the same clock time, the hand is 30° further round: two hours ahead. The sky gains about 4 minutes a day. [src:four-minutes]

### Try {#try}

prompt: Move the time until the hand points straight up.

hint: The hand is the line from the pole to {handStar}. Use the slider until it points to 12 o'clock on the dial.

success: Straight up. Read the hand like a clock hand, and you can tell the hour.

### The old way {#oldway}

text: Navigators used the nocturnal, a hand-held instrument, from about 1400 to 1800, and the pointer stars of the Great Bear served as its hour hand. [src:nocturnal] Much earlier, in the First Intermediate Period (about 2100 BC), Egyptians painted tables of 36 star groups, the decans, on coffin lids: each marked ten days, and 12 rows gave the hours of the night, so the decans helped give us the 12-hour night. [src:decans]

### Tonight outside {#tonight}

text: At {localEveningTime} tonight from {place}, the hand ({handStar}) points to about {handClock} o'clock on the clock face. Check again in a month at the same time: it will have turned about one hour, {handTurn}.

# Chapter 3 {#ch3}

title: The sky as a calendar

summary: How the sky changes through the year, and how farmers, flood-watchers and new-year festivals used it to keep time.

## Lesson 3.1 {#l3.1}

title: A different sky each season

hook: The stars you see at 9 pm change through the year, because the Earth travels round the Sun.

### Watch {#watch}

c1: It is 9 pm at {place}. We will look at the same sky at the same hour, and let a whole year go by.

c2: The Earth circles the Sun once a year. So the night side of the Earth faces a different part of space as the months pass.

c3: Each star rises about four minutes earlier every night. That is two hours a month, and a full turn in a year. [src:four-minutes]

c4: After twelve months the stars are back where they began. The sky is a calendar.

### Try {#try}

prompt: Slide through the year until {seasonCons} stands more than 20° above the horizon at 9 pm.

hint: Move the slider a month at a time. {seasonCons} climbs higher in the evening sky as its season comes, and sinks out of it again later.

success: {seasonCons} is high in your evening sky. This is its season.

### The old way {#oldway}

text: The Greek poet Hesiod, in his poem Works and Days, gave farmers a year told by the stars. When the Pleiades rise, begin the harvest. When Orion and Sirius are high in the sky and Arcturus rises at dawn, pick the grapes. When the Pleiades, the Hyades and Orion set, it is time to plough. [src:hesiod]

### Tonight outside {#tonight}

text: From {place} at {localEveningTime} this month, {eveningNow} stand in the evening sky. In three months, at the same hour, they will have moved west, and {eveningLater} will have risen to take their place. Look again then and check.

## Lesson 3.2 {#l3.2}

title: The Sun's path

hook: Against the stars the Sun moves along one line. The constellations on that line are the zodiac.

### Watch {#watch}

c1: The stars are always there, even by day. This is the noon sky at {place}, with the Sun among them.

c2: Each day the Sun creeps about 1° eastward against the stars. The line it follows is the ecliptic.

c3: Now a year goes by. Watch which constellation sits behind the Sun.

c4: The constellations on the ecliptic are the zodiac. You never see the Sun's own constellation, because the Sun is up in daylight. At midnight you see the opposite ones.

### Try {#try}

prompt: Which constellation is the Sun in today?

hint: Find the gold line, the ecliptic, and read the name of the constellation behind the Sun. The two wrong answers are its neighbours.

wrong: Not that one. Look at where the Sun sits among the stars, and try again.

success: Yes. Today the Sun is in {sunConsNow}. You cannot see that constellation tonight, because it is in the daytime sky.

### The old way {#oldway}

text: Around 400 BC, Babylonian astronomers split the Sun's path into twelve equal signs of 30° each. By today's official borders the path crosses thirteen constellations, one of them Ophiuchus. Since Babylonian times the slow wobble of Earth's axis has carried the March equinox from Aries into Pisces, so the signs have slipped by about one constellation. [src:zodiac-babylon]

### Tonight outside {#tonight}

text: From {place} this month, the zodiac constellation highest around midnight is {midnightZodiac}. It sits on the opposite side of the sky from the Sun. In six months the Sun itself will be there.

## Lesson 3.3 {#l3.3}

title: First light: a star returns

hook: Once a year a star slips out of the Sun's glare and reappears in the dawn. Ancient Egypt built its year on it.

### Watch {#watch}

c1: We are flying to Egypt, at latitude 30°N. The brightest star in the night sky, Sirius, has a famous yearly return here.

c2: It is the hour before sunrise, and we look east. For some weeks each year Sirius rises so close behind the Sun that its light is lost in the glare.

c3: Each morning the Sun has moved on by about 1°. At the same moment of dawn, Sirius stands a little higher.

c4: Around {siriusReturnDate} at this latitude, by this simple rule, Sirius first shows in the twilight before sunrise. This first dawn appearance is called its heliacal rising.

c5: Our rule: the Sun is about 9.5° below the horizon, and Sirius at least 2.5° above it. Real sightings depend on the sky and on the eyes of the watcher.

### Try {#try}

prompt: Tap Next dawn to step through the mornings, until Sirius shows in the twilight before sunrise.

hint: Sirius is the brightest star low in the east. Keep stepping until it stands about 2.5° up while the sky is still dark.

success: Sirius is back. On this morning it clears the horizon before the Sun rises.

### The old way {#oldway}

text: In ancient Egypt Sirius was called Sopdet, and the Greeks called it Sothis. It vanished from the sky for some weeks, then reappeared just before dawn at about the time the Nile began to rise, and its return was tied to the Egyptian New Year. [src:sirius-nile] The Greeks and Romans linked the star's return to the hottest part of summer, and we still say "dog days", from the Latin dies caniculares. [src:dog-days]

### Tonight outside {#tonight}

text: The stars you see in the east before dawn are the evening stars of about four months from now. At 5 am you look eight hours ahead of 9 pm, and each hour is about two weeks of drift. If you are up early, look east from {place} for {dawnPreviewStar}.

none: From {place} no bright star stands in the east at 5 am tonight. Still, the stars rising in the east before dawn are the evening stars of about four months from now.

## Lesson 3.4 {#l3.4}

title: The Pleiades calendar

hook: Farmers and sailors in many lands used one small cluster of stars to mark the seasons.

### Watch {#watch}

c1: These are the Pleiades, a tight cluster of stars in Taurus, near the orange star Aldebaran.

c2: In June, from {place}, they rise in the east before dawn, ahead of the Sun.

c3: By November they stand high in the evening sky.

c4: So the Pleiades rise before dawn around June and shine high in the evening by November. Anyone who knew this cluster could read the time of year from it.

### Try {#try}

prompt: Find the Pleiades and tap them.

hint: Find Orion's Belt. Follow its line up past the orange star Aldebaran, then go on about a fist and a half. You will reach a small, tight cluster.

wrong: That is {name}. The Pleiades are a small, tight cluster: go on past Aldebaran, about a fist and a half.

success: Those are the Pleiades. Count the stars you can see: most people see six or seven. [src:pleiades-count]

### The old way {#oldway}

text: In Greece, Hesiod told farmers to begin the harvest when the Pleiades rise and to plough when they set. [src:hesiod] In Aotearoa New Zealand, for many Māori communities the early-morning rising of Matariki, the Pleiades, in midwinter marks the new year, though some iwi look to Puanga (Rigel) instead; Matariki has been a public holiday since 2022. [src:matariki] In the Andes of Peru and Bolivia, farmers look at how clear the Pleiades are in June to decide when to plant potatoes, and a study in Nature in 2000 found that this works. [src:andes-pleiades]

### Tonight outside {#tonight}

evening: From {place} at {localEveningTime} tonight, the Pleiades are {pleiadesWhere}. Look for the small, tight cluster and count the stars you can see: most people see six or seven. [src:pleiades-count]

morning: The Pleiades are low or out of sight at {localEveningTime} tonight, but they come up before dawn. As the sky starts to brighten tomorrow morning at {place}, they are {pleiadesWhere}. Count the stars you can see: most people see six or seven. [src:pleiades-count]

hidden: This month the Pleiades are lost in the Sun's glare from {place}, or too low to see. They come back in a few weeks, first before dawn and later in the evening sky.

# Chapter 4 {#ch4}

title: Where you stand

summary: How the height of the stars tells you where you are on Earth, from the ancient measurers to the wayfinders of the Pacific.

## Lesson 4.1 {#l4.1}

title: The pole's height is your latitude

hook: Measure how high the pole of the sky stands, and you know how far north or south you are.

### Watch {#watch}

c1: From {place}, {poleName} stands {poleAlt}° above the horizon. That number is your latitude.

c2: Now we travel {tripDir} along the meridian, with the pole in view.

c3: With every degree of latitude we cover, the pole {poleMove} by one degree.

c4: Now we stand at latitude {latTxt}, and the pole stands {poleAlt}° up. Pole height and latitude are the same number.

### Try {#try}

prompt: Use the latitude slider to travel until the pole stands 60° above the horizon.

hint: The pole's height equals your latitude, so you need to reach latitude 60°. Slide until the slider shows 60°.

success: The pole stands 60° up, because you are at latitude 60°. The two numbers always match.

### The old way {#oldway}

text: In the 15th century Portuguese pilots found their latitude from the height of the Pole Star, using a quadrant or an astrolabe. After they crossed the equator they used the Sun's noon height and tables instead. They then "ran down the latitude": they sailed to the right latitude and followed it to their destination. [src:latitude-sailing] One degree of latitude is about 111 km on the ground. [src:km-per-degree]

### Tonight outside {#tonight}

north: Face north from {place} at {localEveningTime}. Hold your fist at arm's length on the horizon and stack fists upwards. Polaris stands about {fistsToPole} fists up, because your latitude is {latTxt}. It sits less than 1° from the true pole, so the count is close. [src:km-per-degree]

south: No bright star marks the south pole of the sky. Find it with the Southern Cross (lesson 1.4), then count fists up from the south horizon. From {place} it stands about {fistsToPole} fists up, because your latitude is {latTxt}.

flat: From {place} you are on the equator, at latitude {latTxt}. Both poles of the sky sit on your horizon, so the fist count is zero. Travel north or south and the pole starts to climb.

## Lesson 4.2 {#l4.2}

title: Stars you never see, until you travel

hook: A cap of sky around the far pole never rises for you. Travel towards the equator and new stars come up.

### Watch {#watch}

flat: From {place} you are on the equator, so every star rises at some hour of the year. Travel north or south and a cap of sky around the far pole drops out of view.

c1: Face {faceDir}. {neverStar}, one of the brightest stars in the sky, sits just below the horizon. From {place} it never rises.

c2: A cap of sky around the far pole never comes up for you. {neverStar} lies inside that cap.

c3: Now we travel towards the equator.

c4: At latitude {latTxt}, {neverStar} now climbs above the horizon. The closer you stand to the equator, the smaller the hidden cap.

### Try {#try}

prompt: Use the latitude slider to travel towards the equator until {neverStar} can rise above the horizon.

hint: {neverStar} can rise once you are {towardsEquator} of latitude {latToSeeIt}. Slide past that number.

success: Yes. At latitude {latTxt}, {neverStar} now rises, at least a little. From every place on Earth a cap of sky is hidden, and its size depends on your latitude.

promptFlat: Use the latitude slider to travel north to latitude 45°, and watch the southern stars sink.

hintFlat: Slide the latitude to 45°N. As you go north, the stars around the south pole of the sky drop below the horizon and never rise.

successFlat: From latitude 45° the stars around the south pole never rise. Their hidden cap grows the further you go from the equator.

### The old way {#oldway}

text: Aristotle pointed out that some stars are seen in Egypt and near Cyprus that are not seen in the north, and he argued that the Earth is a sphere of no great size. [src:aristotle-sphere] From Greece you cannot see Canopus, but from Alexandria it climbs above the horizon. About 100 BC Posidonius used that difference in height to estimate the size of the Earth, though his angle and distance were rough. [src:canopus-posidonius]

### Tonight outside {#tonight}

text: The brightest star that never rises from {place} is {neverStar}. To glimpse it, you would have to travel {towardsEquator} of about latitude {latToSeeIt}.

none: From {place} every bright star rises at some time of the year. Travel north or south, and the stars around the far pole will drop out of view.

## Lesson 4.3 {#l4.3}

title: Measuring the Earth with a shadow

hook: Two towns, one summer noon, and the Sun's height in each. That is enough to measure the whole Earth.

### Watch {#watch}

c1: It is noon at the June solstice. At Aswan in Egypt the Sun is almost straight overhead, about {aswanAlt}° up.

c2: At Alexandria, about {kmApart} km to the north, the same noon Sun is only {alexAlt}° up. Its rays slant.

c3: Follow each town's vertical line down into the Earth. The two lines meet at the centre, with an angle of {sunGap}° between them.

c4: {sunGap}° is about one fiftieth of a full circle. So the way round the Earth is about 50 times the distance between the towns.

c5: 360 ÷ {sunGap} × {kmApart} km is about {earthKm} km. The true figure is about 40,000 km.

### Try {#try}

prompt: The Sun's height differs by {sunGap}° between two towns {kmApart} km apart on the same meridian. How big is the Earth?

hint: Turn the gap into a fraction of a circle: 360 divided by the gap. Then multiply by the distance between the towns.

wrong: Not quite. Divide 360 by the gap, then multiply by the distance.

option: About {label} km

success: Yes, about {earthKm} km: the Earth is roughly 40,000 km round. You measured it with the Sun's height.

### The old way {#oldway}

text: About 240 BC Eratosthenes compared the noon Sun at Syene (Aswan), where it was said to be overhead at midsummer, with Alexandria, where it was about 7.2° from overhead, one fiftieth of a circle. With a distance of about 5,000 stadia he got roughly 250,000 stadia for the Earth's circumference. How close that is to the true 40,000 km depends on which stadion he used: from under 1 % off to about 16 % off. [src:eratosthenes]

### Tonight outside {#tonight}

text: On your next trip north or south, the height of {poleName} changes by 1° for every 111 km. [src:km-per-degree] From {place} to {cityNS}, about {kmToCity} km to the {cityDir}, that is about {degDiff}°.

generic: On your next trip north or south, the height of {poleName} changes by 1° for every 111 km. [src:km-per-degree] A trip of 555 km changes it by 5°.

## Lesson 4.4 {#l4.4}

title: The other way up, and your zenith star

hook: Cross the equator and the constellations turn around. Wherever you stand, one star passes straight overhead.

### Watch {#watch}

c1: This is Orion from {place}. {orionTop} is on top and {orionBottom} below. Orion sits on the sky's equator, so both hemispheres can see it.

c2: Now we travel to the same distance on the other side of the equator.

c3: Now {orionBottom} is on top. The whole sky is turned half a turn, not mirrored. [src:orion-flip]

c4: In Australia the Belt and Sword make "the Saucepan", with the Sword as its handle. [src:orion-flip]

c5: Now to Hawaiʻi, at about 19°N. Wherever you stand, some star passes straight overhead: the star whose declination, its distance north or south of the sky's equator, equals your latitude. [src:zenith-stars]

c6: Watch Arcturus. Its declination is about +19°, the latitude of Hawaiʻi. [src:zenith-stars]

c7: There it crosses the zenith, marked by the cross. The zenith star of Hawaiʻi is Hōkūleʻa, the star we call Arcturus. [src:zenith-stars]

### Try {#try}

prompt: Your zenith star is {zenithStar}. Move the time until it passes within 5° of straight overhead.

hint: Slide the time until {zenithStar} stands at its highest, in the middle of your sky and almost at the zenith.

promptPick: Which of these bright stars passes closest to straight overhead from {homePlace}?

hintPick: Pick the star whose declination is closest to your latitude, {homeLatTxt}.

wrong: Not that one. Its declination is further from your latitude. Try another.

success: {zenithStar} is almost straight overhead. Its declination matches your latitude, which is why it passes there.

successPick: Yes. {zenithStar} has a declination close to your latitude, so it passes nearest to your zenith.

### The old way {#oldway}

text: Polynesian wayfinders use zenith stars as markers of latitude: the zenith star of Hawaiʻi is Hōkūleʻa (Arcturus), and that of Tahiti is ʻAʻā (Sirius). [src:zenith-stars] In 1976 the canoe Hōkūleʻa sailed from Hawaiʻi to Tahiti in 34 days, guided by the navigator Mau Piailug of Satawal, in Micronesia, without instruments, for the Polynesian Voyaging Society. [src:hokulea-1976]

### Tonight outside {#tonight}

night: From {place} your zenith star is {zenithStar}: of the bright stars, it is the one whose declination best matches your latitude, {latTxt}. Tonight it crosses the middle of your sky at about {zenithStarTime}, {zenithMiss}.

season: From {place} your zenith star is {zenithStar}: of the bright stars, it is the one whose declination best matches your latitude, {latTxt}. It crosses the middle of your sky in the small hours or by day tonight, so look for it in {zenithMonth} at 9 pm, when it passes {zenithMiss}.

# Chapter 5 {#ch5}

title: The wanderers

summary: Planets, the Moon and the Sun's path: the lights that do not keep their places.

# Chapter 6 {#ch6}

title: The slow wobble

summary: How Earth's axis drifts, and why the pole star changes over thousands of years.

# Chapter 7 {#ch7}

title: What stars are

summary: Colour, brightness and distance: what stars are made of and how far away they lie.

# Chapter 8 {#ch8}

title: Losing and finding the night

summary: What city lights hide, and how to get the dark sky back.
