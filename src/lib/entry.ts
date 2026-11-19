import type { Entry, EntryPatch } from './types';
import { REFLECTION_FIELDS } from './types';

const TEXT_FIELDS = ['moodNote', ...REFLECTION_FIELDS] as const;

/**
 * Apply a patch to an entry, dropping anything blank: empty or whitespace text,
 * moods outside 1–10, minutes when practice is unchecked, and so on. The result
 * holds only real content.
 */
export function applyPatch(base: Entry, patch: EntryPatch): Entry {
  const next: Entry = { ...base, ...patch };

  for (const f of TEXT_FIELDS) {
    const v = next[f];
    if (typeof v !== 'string' || v.trim() === '') delete next[f];
    else next[f] = v.replace(/\s+$/, '');
  }

  if (typeof next.mood !== 'number' || !Number.isInteger(next.mood) || next.mood < 1 || next.mood > 10) {
    delete next.mood;
  }

  if (next.practiced !== true) {
    delete next.practiced;
    delete next.minutes;
  } else if (typeof next.minutes !== 'number' || !Number.isFinite(next.minutes) || next.minutes <= 0) {
    delete next.minutes;
  } else {
    next.minutes = Math.min(Math.round(next.minutes), 24 * 60);
  }

  if (next.completedAt === undefined) delete next.completedAt;
  return next;
}

/** True when an entry holds nothing worth keeping. */
export function isEmptyEntry(e: Entry): boolean {
  return (
    e.mood === undefined &&
    e.practiced === undefined &&
    TEXT_FIELDS.every((f) => e[f] === undefined)
  );
}

export function newEntry(date: string, now = Date.now()): Entry {
  return { date, createdAt: now, updatedAt: now };
}
