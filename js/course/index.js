// The chapter list. The Learn home draws one card per entry; titles and summaries come from content/<lang>/course.md (chapter ids match).
//   status 'active'  : has (or will have) lessons. With no lessons yet the card says "coming soon".
//   status 'planned' : a placeholder for later chapters.
// To add a chapter's lessons: fill the array in its chN.js. Nothing else here needs to change.
import ch1 from './ch1.js';
import ch2 from './ch2.js';
import ch3 from './ch3.js';
import ch4 from './ch4.js';
import ch5 from './ch5.js';
import ch6 from './ch6.js';
import ch7 from './ch7.js';
import ch8 from './ch8.js';

export const CHAPTERS = [
  { id: 'ch1', n: 1, status: 'active', lessons: ch1 },
  { id: 'ch2', n: 2, status: 'active', lessons: ch2 },
  { id: 'ch3', n: 3, status: 'active', lessons: ch3 },
  { id: 'ch4', n: 4, status: 'active', lessons: ch4 },
  { id: 'ch5', n: 5, status: 'active', lessons: ch5 },
  { id: 'ch6', n: 6, status: 'active', lessons: ch6 },
  { id: 'ch7', n: 7, status: 'active', lessons: ch7 },
  { id: 'ch8', n: 8, status: 'active', lessons: ch8 },
];
export const ALL_LESSONS = CHAPTERS.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c.id })));
