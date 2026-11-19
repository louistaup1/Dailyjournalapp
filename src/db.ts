import Dexie, { type EntityTable } from 'dexie';
import type { Entry, EntryPatch, Recap, Settings } from './lib/types';
import { DEFAULT_SETTINGS } from './lib/types';
import { applyPatch, isEmptyEntry, newEntry } from './lib/entry';
import type { DateKey } from './lib/dates';

interface SettingRow {
  key: string;
  value: unknown;
}

class JournalDB extends Dexie {
  entries!: EntityTable<Entry, 'date'>;
  recaps!: EntityTable<Recap, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor() {
    super('mood-journal');
    this.version(1).stores({
      entries: 'date',
      recaps: '++id, end, createdAt',
      settings: 'key',
    });
  }
}

export const db = new JournalDB();

// ---------- entries ----------

export function getEntry(date: DateKey): Promise<Entry | undefined> {
  return db.entries.get(date);
}

/**
 * Merge a patch into a day's entry. Blank values are dropped; if nothing is
 * left, the row is removed rather than stored empty.
 */
export async function saveEntry(date: DateKey, patch: EntryPatch): Promise<Entry | undefined> {
  return db.transaction('rw', db.entries, async () => {
    const existing = (await db.entries.get(date)) ?? newEntry(date);
    const next = applyPatch(existing, patch);
    next.updatedAt = Date.now();
    if (isEmptyEntry(next)) {
      await db.entries.delete(date);
      return undefined;
    }
    await db.entries.put(next);
    return next;
  });
}

export async function markComplete(date: DateKey): Promise<void> {
  const e = await db.entries.get(date);
  if (e && !e.completedAt) await db.entries.update(date, { completedAt: Date.now() });
}

export function allEntries(): Promise<Entry[]> {
  return db.entries.orderBy('date').toArray();
}

export function entriesBetween(start: DateKey, end: DateKey): Promise<Entry[]> {
  return db.entries.where('date').between(start, end, true, true).toArray();
}

// ---------- settings ----------

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return s as unknown as Settings;
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) await db.settings.delete(key);
      else await db.settings.put({ key, value });
    }
  });
}

/** Ask the browser not to evict our storage. Best effort; harmless if refused. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export function deleteEntry(date: DateKey): Promise<void> {
  return db.entries.delete(date);
}

// ---------- recaps ----------

export function allRecaps(): Promise<Recap[]> {
  return db.recaps.orderBy('createdAt').reverse().toArray();
}

// ---------- import ----------

/**
 * Merge imported data. For a day that exists on both sides, the more recently
 * updated version wins. Recaps already present (same kind, week and time) are
 * skipped.
 */
export async function importData(entries: Entry[], recaps: Recap[]): Promise<{ added: number; updated: number; kept: number; recaps: number }> {
  const res = { added: 0, updated: 0, kept: 0, recaps: 0 };
  await db.transaction('rw', db.entries, db.recaps, async () => {
    for (const e of entries) {
      const cur = await db.entries.get(e.date);
      if (!cur) {
        await db.entries.put(e);
        res.added++;
      } else if (e.updatedAt >= cur.updatedAt) {
        await db.entries.put(e);
        res.updated++;
      } else res.kept++;
    }
    const existing = await db.recaps.toArray();
    const seen = new Set(existing.map((r) => `${r.kind}|${r.end}|${r.createdAt}`));
    for (const r of recaps) {
      const k = `${r.kind}|${r.end}|${r.createdAt}`;
      if (seen.has(k)) continue;
      seen.add(k);
      await db.recaps.add(r);
      res.recaps++;
    }
  });
  return res;
}
