// The chapter list. The Learn home draws one card per entry; titles and summaries come from content/<lang>/course.md (chapter ids match).
//   status 'active'  : has (or will have) lessons. With no lessons yet the card says "coming soon".
//   status 'planned' : a placeholder for later chapters.
// To add a chapter's lessons: fill the array in its chN.js. Nothing else here needs to change.
import ch1 from './ch1.js';
import ch2 from './ch2.js';
import ch3 from './ch3.js';
import ch4 from './ch4.js';

export const CHAPTERS = [
  { id: 'ch1', n: 1, status: 'active', lessons: ch1 },
  { id: 'ch2', n: 2, status: 'active', lessons: ch2 },
  { id: 'ch3', n: 3, status: 'active', lessons: ch3 },
  { id: 'ch4', n: 4, status: 'active', lessons: ch4 },
  { id: 'ch5', n: 5, status: 'planned', lessons: [] },
  { id: 'ch6', n: 6, status: 'planned', lessons: [] },
  { id: 'ch7', n: 7, status: 'planned', lessons: [] },
  { id: 'ch8', n: 8, status: 'planned', lessons: [] },
];
export const ALL_LESSONS = CHAPTERS.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c.id })));
