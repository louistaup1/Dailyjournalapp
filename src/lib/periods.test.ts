import { describe, expect, it } from 'vitest';
import { periodFor, periodLength } from './periods';
import { previousRange, rangeOf } from './dates';
import { compareWeeks, previousLabel, weekStats } from './stats';
import { buildRecapPrompt } from './recapPrompt';
import type { Entry } from './types';

const today = '2026-11-25';

describe('periodFor', () => {
  it('gives the last 7 and 14 days, ending today', () => {
    expect(periodFor('7', today, null, '', '')).toEqual({ start: '2026-11-19', end: today });
    expect(periodFor('14', today, null, '', '')).toEqual({ start: '2026-11-12', end: today });
  });

  it('starts the day after the last recap', () => {
    expect(periodFor('since', today, '2026-11-22', '', '')).toEqual({ start: '2026-11-23', end: today });
    expect(periodFor('since', today, null, '', '')).toBe('There is no earlier recap yet.');
    expect(periodFor('since', today, today, '', '')).toBe('Your last recap already covers today.');
  });

  it('caps a long gap since the last recap at 31 days', () => {
    const p = periodFor('since', today, '2026-08-01', '', '');
    expect(typeof p).toBe('object');
    expect(periodLength(p as { start: string; end: string })).toBe(31);
  });

  it('validates chosen dates', () => {
    expect(periodFor('custom', today, null, '2026-11-01', '2026-11-10')).toEqual({ start: '2026-11-01', end: '2026-11-10' });
    expect(periodFor('custom', today, null, '2026-11-10', '2026-11-01')).toMatch(/after the end/);
    expect(periodFor('custom', today, null, '2026-11-20', '2026-11-30')).toMatch(/future/);
    expect(periodFor('custom', today, null, '2026-09-01', '2026-11-10')).toMatch(/up to 31 days/);
    expect(periodFor('custom', today, null, '', '2026-11-10')).toMatch(/Choose/);
  });
});

describe('periods longer than a week', () => {
  const e = (date: string, extra: Partial<Entry> = {}): Entry => ({ date, createdAt: 0, updatedAt: 0, ...extra });
  const entries = [e('2026-11-01', { mood: 3 }), e('2026-11-14', { mood: 5, thoughts: 'busy' }), e('2026-11-25', { mood: 7 })];
  const range = rangeOf('2026-11-12', today);
  const prev = previousRange(range);

  it('compares with the same number of days before', () => {
    expect(range.days).toHaveLength(14);
    expect(prev).toMatchObject({ start: '2026-10-29', end: '2026-11-11' });
    expect(prev.days).toHaveLength(14);
    const cur = weekStats(range, entries);
    expect(cur.mood.byDay).toHaveLength(14);
    expect(previousLabel(cur)).toBe('the previous 14 days');
    expect(compareWeeks(cur, weekStats(prev, entries))[0]).toBe('Average mood was 6, up 3 from 3 the previous 14 days.');
  });

  it('describes the period in the prompt', () => {
    const p = buildRecapPrompt({ stats: weekStats(range, entries), entries }, { stats: weekStats(prev, entries), entries });
    expect(p.user).toContain('This period: 12–25 Nov (14 days)');
    expect(p.user).toContain('Days with entries: 2 of 14');
    expect(p.user).toContain('Previous period: 29 Oct – 11 Nov');
    expect(p.user).toContain('Mood by day: Thu 12 Nov -');
  });
});
