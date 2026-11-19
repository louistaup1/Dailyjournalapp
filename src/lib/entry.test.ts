import { describe, expect, it } from 'vitest';
import { applyPatch, isEmptyEntry, newEntry } from './entry';

const base = newEntry('2026-11-19', 0);

describe('entry patches', () => {
  it('drops blank text', () => {
    const e = applyPatch(base, { thoughts: '   ', feelings: 'tired  \n', moodNote: '' });
    expect(e.thoughts).toBeUndefined();
    expect(e.moodNote).toBeUndefined();
    expect(e.feelings).toBe('tired');
  });

  it('keeps only valid moods', () => {
    expect(applyPatch(base, { mood: 6 }).mood).toBe(6);
    expect(applyPatch(base, { mood: 0 }).mood).toBeUndefined();
    expect(applyPatch(base, { mood: 11 }).mood).toBeUndefined();
    expect(applyPatch(base, { mood: 5.5 }).mood).toBeUndefined();
  });

  it('keeps minutes only when practice is checked', () => {
    expect(applyPatch(base, { practiced: false, minutes: 10 })).not.toHaveProperty('minutes');
    expect(applyPatch(base, { practiced: true, minutes: 10 }).minutes).toBe(10);
    expect(applyPatch(base, { practiced: true, minutes: 0 })).not.toHaveProperty('minutes');
  });

  it('clearing a field removes it', () => {
    const e = applyPatch(applyPatch(base, { thoughts: 'busy' }), { thoughts: '' });
    expect(e.thoughts).toBeUndefined();
    expect(isEmptyEntry(e)).toBe(true);
  });

  it('detects empty entries', () => {
    expect(isEmptyEntry(base)).toBe(true);
    expect(isEmptyEntry(applyPatch(base, { mood: 3 }))).toBe(false);
    expect(isEmptyEntry(applyPatch(base, { practiced: true }))).toBe(false);
  });
});
