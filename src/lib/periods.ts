import { addDays, daysBetween, isDateKey, MAX_RECAP_DAYS, type DateKey } from './dates';

export interface Period {
  start: DateKey;
  end: DateKey;
}

export type Choice = '7' | '14' | 'since' | 'custom';

/** The period for a choice, or a plain reason it can't be used. */
export function periodFor(choice: Choice, today: string, lastEnd: string | null, from: string, to: string): Period | string {
  if (choice === '7') return { start: addDays(today, -6), end: today };
  if (choice === '14') return { start: addDays(today, -13), end: today };
  if (choice === 'since') {
    if (!lastEnd) return 'There is no earlier recap yet.';
    if (lastEnd >= today) return 'Your last recap already covers today.';
    const start = addDays(lastEnd, 1);
    // Longer gaps are cut to the most recent days.
    const capped = daysBetween(start, today) + 1 > MAX_RECAP_DAYS ? addDays(today, -(MAX_RECAP_DAYS - 1)) : start;
    return { start: capped, end: today };
  }
  if (!isDateKey(from) || !isDateKey(to)) return 'Choose a start and an end date.';
  if (from > to) return 'The start date is after the end date.';
  if (to > today) return 'The end date is in the future.';
  if (daysBetween(from, to) + 1 > MAX_RECAP_DAYS) return `A recap can cover up to ${MAX_RECAP_DAYS} days.`;
  return { start: from, end: to };
}

export const periodLength = (p: Period) => daysBetween(p.start, p.end) + 1;

