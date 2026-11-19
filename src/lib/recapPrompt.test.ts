import { describe, expect, it } from 'vitest';
import { buildRecapPrompt, formatEntry, RECAP_SCHEMA, RECAP_SYSTEM } from './recapPrompt';
import { normalize } from './recapApi';
import { previousWeek, weekEndingOn } from './dates';
import { weekStats } from './stats';
import type { Entry } from './types';

const e = (date: string, extra: Partial<Entry> = {}): Entry => ({ date, createdAt: 0, updatedAt: 0, ...extra });

const entries = [
  e('2026-11-10', { mood: 4, thoughts: 'Old week worry' }),
  e('2026-11-16', { mood: 6, moodNote: 'slow start', thoughts: 'I will fall behind', practiced: true, minutes: 12 }),
  e('2026-11-19', { feelings: 'Tight chest', values: 'Away: I avoided the call' }),
  e('2026-11-25', { thoughts: 'Next week, must not appear' }),
];
const week = weekEndingOn('2026-11-22');
const prev = previousWeek(week);

describe('formatEntry', () => {
  it('includes only what was written', () => {
    const t = formatEntry(entries[2]);
    expect(t).toContain('Thursday 19 Nov 2026');
    expect(t).toContain('What feelings did I experience?\nTight chest');
    expect(t).not.toContain('Mood:');
    expect(t).not.toContain('What thoughts');
    expect(t).not.toContain('Practiced');
  });
});

describe('buildRecapPrompt', () => {
  const p = buildRecapPrompt(
    { stats: weekStats(week, entries), entries },
    { stats: weekStats(prev, entries), entries },
  );

  it('uses the neutral system prompt', () => {
    expect(p.system).toBe(RECAP_SYSTEM);
    expect(p.system).toMatch(/No diagnosis/);
    expect(p.system).toMatch(/No advice/);
    expect(p.system).toMatch(/2-3 open, curious questions/);
  });

  it('includes this week, its stats, and nothing outside the two weeks', () => {
    expect(p.user).toContain('This week: 16–22 Nov');
    expect(p.user).toContain('Mood average: 6');
    expect(p.user).toContain('Mood: 6/10 (slow start)');
    expect(p.user).toContain('Practiced mindfulness: 12 min');
    expect(p.user).toContain('Mindfulness: 1 days, 12 minutes');
    expect(p.user).not.toContain('must not appear');
  });

  it('includes the previous week separately when there is one', () => {
    expect(p.user).toContain('Previous week: 9–15 Nov');
    const [thisWeek, prevWeek] = p.user.split('<entries week="previous">');
    expect(thisWeek).not.toContain('Old week worry');
    expect(prevWeek).toContain('Old week worry');
  });

  it('says there is no previous week when there is none', () => {
    const q = buildRecapPrompt({ stats: weekStats(week, entries), entries }, null);
    expect(q.user).not.toContain('Previous week:');
    expect(q.user).toContain('return an empty list for changes');
  });

  it('marks an empty week', () => {
    const empty = weekEndingOn('2026-12-31');
    const q = buildRecapPrompt({ stats: weekStats(empty, entries), entries }, null);
    expect(q.user).toContain('(no entries)');
  });
});

describe('recap schema and parsing', () => {
  it('requires every section', () => {
    expect(RECAP_SCHEMA.required).toEqual(['themes', 'changes', 'questions']);
  });
  it('normalizes model output defensively', () => {
    const r = normalize({ themes: { thoughts: ['a', '', 3] }, changes: 'x', questions: ['q1', 'q2', 'q3', 'q4'] });
    expect(r.themes).toEqual({ thoughts: ['a'], feelings: [], response: [], values: [] });
    expect(r.changes).toEqual([]);
    expect(r.questions).toHaveLength(3);
  });
});
