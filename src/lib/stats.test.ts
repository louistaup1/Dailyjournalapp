import { describe, expect, it } from 'vitest';
import { compareWeeks, mindfulnessTotals, moodAverage, weekStats } from './stats';
import { previousWeek, weekEndingOn } from './dates';
import type { Entry } from './types';

const e = (date: string, extra: Partial<Entry> = {}): Entry => ({ date, createdAt: 0, updatedAt: 0, ...extra });

describe('moodAverage', () => {
  it('returns null with no moods', () => expect(moodAverage([])).toBeNull());
  it('averages and rounds to one decimal', () => {
    expect(moodAverage([6])).toBe(6);
    expect(moodAverage([4, 5, 7])).toBe(5.3);
    expect(moodAverage([1, 2])).toBe(1.5);
    expect(moodAverage([7, 7, 8])).toBe(7.3);
  });
});

describe('mindfulnessTotals', () => {
  it('counts practiced days and sums minutes', () => {
    expect(
      mindfulnessTotals([
        e('2026-11-16', { practiced: true, minutes: 10 }),
        e('2026-11-17', { practiced: true }),
        e('2026-11-18', { minutes: 99 }), // not practiced: ignored
        e('2026-11-19', { practiced: true, minutes: 5 }),
      ]),
    ).toEqual({ daysPracticed: 3, totalMinutes: 15 });
  });
  it('is zero with no entries', () => expect(mindfulnessTotals([])).toEqual({ daysPracticed: 0, totalMinutes: 0 }));
});

describe('weekStats', () => {
  const week = weekEndingOn('2026-11-22');
  const entries = [
    e('2026-11-15', { mood: 1 }), // previous week: excluded
    e('2026-11-16', { mood: 5, thoughts: 'a', practiced: true, minutes: 10 }),
    e('2026-11-18', { mood: 8, feelings: 'b' }),
    e('2026-11-19', { mood: 3, thoughts: 'c' }),
    e('2026-11-20', { mood: 8 }),
    e('2026-11-22', { values: 'd' }),
  ];
  const s = weekStats(week, entries);

  it('covers exactly 7 days', () => {
    expect(s.mood.byDay.map((d) => d.date)).toEqual(week.days);
    expect(s.mood.byDay.map((d) => d.mood)).toEqual([5, null, 8, 3, 8, null, null]);
  });
  it('computes average, highest (earliest on ties) and lowest', () => {
    expect(s.mood.average).toBe(6);
    expect(s.mood.highest).toEqual({ date: '2026-11-18', mood: 8 });
    expect(s.mood.lowest).toEqual({ date: '2026-11-19', mood: 3 });
  });
  it('counts entries per question', () => {
    expect(s.daysWithEntries).toBe(5);
    expect(s.counts).toEqual({ thoughts: 2, feelings: 1, response: 0, values: 1 });
    expect(s.mindfulness).toEqual({ daysPracticed: 1, totalMinutes: 10 });
  });
  it('compares with the previous week', () => {
    const prev = weekStats(previousWeek(week), entries);
    const lines = compareWeeks(s, prev);
    expect(lines[0]).toBe('Average mood was 6, up 5 from 1 the previous week.');
    expect(compareWeeks(s, null)).toEqual([]);
  });
});
