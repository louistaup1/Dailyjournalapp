import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatRange,
  isDateKey,
  isPastTimeToday,
  lastNDays,
  lastScheduledRecapDay,
  nextOccurrence,
  parseTime,
  previousWeek,
  toDateKey,
  weekEndingOn,
  weekdayOf,
} from './dates';

describe('date keys', () => {
  it('uses the local calendar day', () => {
    expect(toDateKey(new Date(2026, 10, 19, 23, 59))).toBe('2026-11-19');
    expect(toDateKey(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });

  it('validates keys', () => {
    expect(isDateKey('2026-11-19')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-1-1')).toBe(false);
    expect(isDateKey('nope')).toBe(false);
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is stable across DST changes', () => {
    // Europe and US DST transitions; noon anchoring keeps every step one day.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('lists the last n days oldest first', () => {
    expect(lastNDays('2026-11-19', 3)).toEqual(['2026-11-17', '2026-11-18', '2026-11-19']);
  });
});

describe('weeks', () => {
  it('builds a 7-day window ending on a day', () => {
    const w = weekEndingOn('2026-11-22');
    expect(w.start).toBe('2026-11-16');
    expect(w.days).toHaveLength(7);
    expect(previousWeek(w)).toMatchObject({ start: '2026-11-09', end: '2026-11-15' });
  });

  it('knows weekdays', () => {
    expect(weekdayOf('2026-11-22')).toBe(0); // Sunday
    expect(weekdayOf('2026-11-19')).toBe(4); // Thursday
  });

  it('formats ranges', () => {
    expect(formatRange('2026-11-16', '2026-11-22')).toBe('16–22 Nov');
    expect(formatRange('2026-11-30', '2026-12-06')).toBe('30 Nov – 6 Dec');
  });
});

describe('times', () => {
  it('parses HH:MM', () => {
    expect(parseTime('09:00')).toBe(540);
    expect(parseTime('23:59')).toBe(1439);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('9am')).toBeNull();
  });

  it('finds the next occurrence of a time', () => {
    const now = new Date(2026, 10, 19, 8, 30);
    expect(nextOccurrence('09:00', now)).toEqual(new Date(2026, 10, 19, 9, 0));
    const later = new Date(2026, 10, 19, 9, 0);
    expect(nextOccurrence('09:00', later)).toEqual(new Date(2026, 10, 20, 9, 0));
  });

  it('checks whether a time has passed today', () => {
    expect(isPastTimeToday('09:00', new Date(2026, 10, 19, 9, 0))).toBe(true);
    expect(isPastTimeToday('09:00', new Date(2026, 10, 19, 8, 59))).toBe(false);
  });

  it('finds the most recent scheduled recap day', () => {
    // Sunday 19:00 schedule.
    expect(lastScheduledRecapDay(0, '19:00', new Date(2026, 10, 22, 20, 0))).toBe('2026-11-22');
    expect(lastScheduledRecapDay(0, '19:00', new Date(2026, 10, 22, 18, 0))).toBe('2026-11-15');
    expect(lastScheduledRecapDay(0, '19:00', new Date(2026, 10, 19, 12, 0))).toBe('2026-11-15');
    expect(lastScheduledRecapDay(0, '19:00', new Date(2026, 10, 23, 7, 0))).toBe('2026-11-22');
  });
});
