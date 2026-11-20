import { describe, expect, it } from 'vitest';
import { parseImport, toExportJSON, toMarkdown } from './exportData';
import type { Entry } from './types';

const entries: Entry[] = [
  { date: '2026-11-18', mood: 4, thoughts: 'Busy mind', createdAt: 1, updatedAt: 2 },
  { date: '2026-11-19', mood: 6, practiced: true, minutes: 10, createdAt: 3, updatedAt: 4, completedAt: 4 },
];

describe('export and import', () => {
  it('round-trips through JSON', () => {
    const parsed = parseImport(toExportJSON(entries, []));
    expect(parsed.entries).toEqual(entries);
    expect(parsed.skipped).toBe(0);
  });

  it('rejects other files', () => {
    expect(() => parseImport('not json')).toThrow(/not valid JSON/);
    expect(() => parseImport('{"a":1}')).toThrow(/journal export/);
  });

  it('cleans and skips bad rows', () => {
    const text = JSON.stringify({
      format: 'mood-journal-export',
      version: 1,
      entries: [{ date: 'bad' }, { date: '2026-11-01', mood: 99, thoughts: '  ', feelings: 'ok' }],
    });
    const p = parseImport(text);
    expect(p.skipped).toBe(1);
    expect(p.entries[0]).toMatchObject({ date: '2026-11-01', feelings: 'ok' });
    expect(p.entries[0]).not.toHaveProperty('mood');
    expect(p.entries[0]).not.toHaveProperty('thoughts');
  });

  it('writes readable markdown', () => {
    const md = toMarkdown(entries, []);
    expect(md).toContain('## Thursday 19 Nov 2026');
    expect(md).toContain('6/10');
    expect(md).toContain('Busy mind');
    expect(md).toContain('10 min');
  });
});
