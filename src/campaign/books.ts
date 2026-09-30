import { BOOK_ONE_ROSTER, BUILDABLE_UNITS } from '../engine/data';
import type { UnitType } from '../engine/types';
import { BOOK_TWO_START } from './book2';
import { ACTS, MISSIONS, type Act } from './missions';

/**
 * A Book is one campaign: a run of MISSIONS (global indices start..end),
 * its acts, the units its factories may build, and where its progress is
 * stored.
 */
export interface Book {
  numeral: string;
  title: string;
  start: number;
  /** Inclusive. */
  end: number;
  roster: UnitType[];
  /** localStorage key holding "missions completed in this Book". */
  progressKey: string;
  /** Closing line on the last mission's results card. */
  ending: string;
  /** Scenery theme for the campaign map. */
  theme: 'valley' | 'coast';
}

export const BOOKS: Book[] = [
  {
    numeral: 'I',
    title: 'The Valley',
    start: 0,
    end: BOOK_TWO_START - 1,
    roster: BOOK_ONE_ROSTER,
    // Kept from the first release so existing players keep their unlocks.
    progressKey: 'tactics-clash-campaign',
    ending: 'Crossfire Valley is yours. Thanks for playing, Commander.',
    theme: 'valley',
  },
  {
    numeral: 'II',
    title: 'Skies and Seas',
    start: BOOK_TWO_START,
    end: MISSIONS.length - 1,
    roster: BUILDABLE_UNITS,
    progressKey: 'crossfire-valley-progress-2',
    ending: 'The coast is clear and the seas are ours. More to come, Commander.',
    theme: 'coast',
  },
];

export function bookOf(index: number): Book {
  return BOOKS.find((b) => index >= b.start && index <= b.end) ?? BOOKS[0];
}

export function actsOf(book: Book): Act[] {
  return ACTS.filter((a) => a.start >= book.start && a.start <= book.end);
}

/** "Mission 5" in Book I, "Book II · Mission 1" after it. */
export function missionLabel(index: number): string {
  const book = bookOf(index);
  const n = index - book.start + 1;
  return book === BOOKS[0] ? `Mission ${n}` : `Book ${book.numeral} · Mission ${n}`;
}
